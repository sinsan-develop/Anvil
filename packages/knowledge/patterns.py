"""D-04 in-memory curated pattern extraction/retrieval. 외부 IO·activation 없음.

attest는 인증된 host가 실제 source/evidence를 확인한 후 호출하는 trusted seam이다.
HTTP 인증·실제 Gate 실행을 대신하지 않으며 payload/API에는 노출하지 않는다.
D-03 registry의 lock과 host identity guard를 공유하여 조회/폐기의 TOCTOU를 막는다.
"""
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
import json
from threading import RLock

from .memory import MemoryError, _canonical, _hash, _time, to_primitive
from .sources import LearningSourceRepository, _text, _digest, _integer, _freeze


class PatternError(MemoryError):
    pass


def _guard(function):
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except PatternError:
            raise
        except MemoryError as error:
            raise PatternError(error.reason) from None
        except (TypeError, ValueError, OverflowError, RecursionError):
            raise PatternError("INVALID_PATTERN_INPUT") from None
    return guarded


def _fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise PatternError("INVALID_PATTERN_INPUT")


def _texts(value, *, required=True, ordered=False):
    if type(value) is not list or (required and not value):
        raise PatternError("INVALID_PATTERN_INPUT")
    items = [_text(x) for x in value]
    return items if ordered else sorted(set(items))


def _ref(value):
    _fields(value, "artifact_id version record_hash")
    _text(value["artifact_id"])
    _integer(value["version"])
    _digest(value["record_hash"])
    return dict(value)


_DETAIL_FIELDS = {
    "CODE_PATTERN": "intent languages frameworks problem_signals preconditions procedure tradeoffs prohibitions failure_conditions verification_refs example_refs",
    "EXAMPLE_REFERENCE": "purpose excerpt_hash selector",
    "ANTI_PATTERN": "failed_approach recurrence_conditions detection_signals impact safer_alternative verification_refs",
}
_RISKS = ("LOW", "MEDIUM", "HIGH")


def _payload(data):
    _fields(data, "artifact_id version kind source_ref risk details")
    data = deepcopy(data)
    _text(data["artifact_id"])
    _integer(data["version"])
    if data["kind"] not in _DETAIL_FIELDS or data["risk"] not in _RISKS:
        raise PatternError("INVALID_PATTERN_INPUT")
    _fields(data["source_ref"], "source_id version record_hash")
    _text(data["source_ref"]["source_id"])
    _integer(data["source_ref"]["version"])
    _digest(data["source_ref"]["record_hash"])
    details = data["details"]
    _fields(details, _DETAIL_FIELDS[data["kind"]])
    for key, value in details.items():
        if key == "example_refs":
            if type(value) is not list:
                raise PatternError("INVALID_PATTERN_INPUT")
            details[key] = sorted((_ref(x) for x in value), key=_canonical)
            if len({_canonical(x) for x in details[key]}) != len(value):
                raise PatternError("INVALID_PATTERN_INPUT")
        elif key == "selector":
            _fields(value, "path symbol start_line end_line")
            for field in ("path", "symbol"):
                if value[field] is not None:
                    _text(value[field])
            if _integer(value["end_line"]) < _integer(value["start_line"]):
                raise PatternError("INVALID_REFERENCE_SELECTOR")
        elif key == "excerpt_hash":
            _digest(value)
        elif key in ("intent", "purpose", "failed_approach", "impact", "safer_alternative"):
            _text(value)
        else:
            details[key] = _texts(value, required=key != "frameworks", ordered=key == "procedure")
    return data


def _proof(value):
    _fields(value, "final_artifact_hash approved_artifact_hash result tests gates origin independently_verified verification_refs failure_refs")
    value = deepcopy(value)
    _digest(value["final_artifact_hash"])
    if value["approved_artifact_hash"] is not None:
        _digest(value["approved_artifact_hash"])
    if value["result"] not in ("ACCEPTED", "SUCCEEDED", "FAILED", "REJECTED", "BLOCKED", "ERROR", "SKIPPED", "UNVERIFIED"):
        raise PatternError("INVALID_PATTERN_EVIDENCE")
    if value["origin"] not in ("HUMAN_CURATED", "SELF_GENERATED", "EXTERNAL") or type(value["independently_verified"]) is not bool:
        raise PatternError("INVALID_PATTERN_EVIDENCE")
    for field in ("tests", "gates"):
        if type(value[field]) is not dict:
            raise PatternError("INVALID_PATTERN_EVIDENCE")
        for key, status in value[field].items():
            _text(key)
            if status not in ("PASS", "FAILED", "REJECTED", "SKIPPED", "BLOCKED", "ERROR"):
                raise PatternError("INVALID_PATTERN_EVIDENCE")
    for field in ("verification_refs", "failure_refs"):
        value[field] = _texts(value[field], required=False)
    return value


@dataclass(frozen=True)
class PatternArtifact:
    artifact_id: str
    version: int
    kind: str
    source_ref: object
    risk: str
    details: object
    provenance: object
    evidence_hash: str
    candidate_only: bool
    previous_hash: str | None
    created_by: str
    created_at: datetime
    record_hash: str


class CodePattern(PatternArtifact):
    pass


class ExampleReference(PatternArtifact):
    pass


class AntiPattern(PatternArtifact):
    pass


@dataclass(frozen=True)
class PatternSummary:
    artifact_id: str
    version: int
    kind: str
    record_hash: str
    intent: str
    languages: tuple
    frameworks: tuple
    risk: str
    source_ref: object
    provenance: object
    candidate_only: bool


def _decode(raw):
    body = json.loads(raw)
    body["created_at"] = datetime.fromisoformat(body["created_at"])
    kind = {"CODE_PATTERN": CodePattern, "EXAMPLE_REFERENCE": ExampleReference, "ANTI_PATTERN": AntiPattern}[body["kind"]]
    return kind(**{key: _freeze(value) for key, value in body.items()})


def _summary(artifact):
    details = artifact.details
    return PatternSummary(artifact.artifact_id, artifact.version, artifact.kind, artifact.record_hash,
                          details.get("intent", details.get("purpose", details.get("failed_approach", ""))),
                          details.get("languages", ()), details.get("frameworks", ()), artifact.risk,
                          artifact.source_ref, artifact.provenance, artifact.candidate_only)


class PatternRepository:
    def __init__(self, sources):
        if type(sources) is not LearningSourceRepository:
            raise PatternError("SOURCE_HOST_AUTHORITY_REQUIRED")
        self._sources = sources
        self._lock = RLock()
        self._attestations, self._records, self._requests = {}, {}, set()

    def _host(self, context, now):
        return self._sources._host(context, now)

    def _source(self, context, reference, now):
        _fields(reference, "source_id version record_hash")
        _integer(reference["version"])
        _digest(reference["record_hash"])
        current = self._sources.get(context, reference["source_id"], now=now)
        if current.status != "REGISTERED":
            raise PatternError("LEARNING_SOURCE_REVOKED")
        history = self._sources.history(context, reference["source_id"], now=now)
        if reference["version"] > len(history):
            raise PatternError("PATTERN_SOURCE_MISMATCH")
        source = history[reference["version"] - 1]
        if source.record_hash != reference["record_hash"]:
            raise PatternError("PATTERN_SOURCE_MISMATCH")
        if source.findings or source.license_status != "APPROVED" or not source.license_ref or source.ownership not in ("OWNED", "LICENSED"):
            raise PatternError("LEARNING_SOURCE_REVOKED")
        if _time(now) < source.created_at:
            raise PatternError("STALE_PATTERN_TIME")
        return source

    def _lookup(self, host, artifact_id, version):
        _text(artifact_id)
        _integer(version)
        values = self._records.get((host[3], artifact_id), [])
        if version > len(values):
            raise PatternError("PATTERN_NOT_FOUND")
        return _decode(values[version - 1])

    def _checked_ref(self, host, reference):
        _ref(reference)
        artifact = self._lookup(host, reference["artifact_id"], reference["version"])
        if artifact.record_hash != reference["record_hash"]:
            raise PatternError("PATTERN_REFERENCE_MISMATCH")
        return artifact

    @_guard
    def attest(self, context, data, evidence, *, now, expires_at):
        """Host-only exact capture of independently checked evidence. Not an API operation."""
        with self._sources._lock, self._lock:
            host = self._host(context, now)
            data, proof = _payload(data), _proof(evidence)
            self._source(context, data["source_ref"], now)
            now, expires_at = _time(now), _time(expires_at)
            if not now < expires_at <= host[6]:
                raise PatternError("INVALID_PATTERN_ATTESTATION")
            key = (id(context), _hash(data))
            record = _canonical(dict(proof=proof, captured_at=now, expires_at=expires_at, actor=host[2]))
            if key in self._attestations and self._attestations[key] != record:
                previous = json.loads(self._attestations[key])
                if now < datetime.fromisoformat(previous["expires_at"]):
                    raise PatternError("PATTERN_ATTESTATION_REBIND")
            self._attestations[key] = record

    def _quality(self, source, data, proof):
        if data["kind"] == "ANTI_PATTERN":
            if proof["final_artifact_hash"] != source.content_hash:
                raise PatternError("PATTERN_EVIDENCE_TARGET_MISMATCH")
            if not proof["failure_refs"] or not set(data["details"]["verification_refs"]) <= set(proof["failure_refs"]):
                raise PatternError("ANTIPATTERN_EVIDENCE_REQUIRED")
            return
        if (source.quality_label != "VERIFIED" or not source.activation_eligible
                or proof["result"] not in ("ACCEPTED", "SUCCEEDED") or not proof["independently_verified"]
                or proof["final_artifact_hash"] != source.content_hash
                or proof["approved_artifact_hash"] != proof["final_artifact_hash"]
                or not proof["tests"] or any(x != "PASS" for x in proof["tests"].values())
                or set(proof["gates"]) != {"G0", "G1", "G2", "G3"}
                or any(x != "PASS" for x in proof["gates"].values()) or not proof["verification_refs"]):
            raise PatternError("POSITIVE_EVIDENCE_REQUIRED")
        if data["kind"] == "CODE_PATTERN" and not set(data["details"]["verification_refs"]) <= set(proof["verification_refs"]):
            raise PatternError("POSITIVE_EVIDENCE_REQUIRED")
        pass_keys = {key for checks in (proof["tests"], proof["gates"]) for key, status in checks.items() if status == "PASS"}
        if not set(proof["verification_refs"]) <= pass_keys:
            raise PatternError("POSITIVE_EVIDENCE_REQUIRED")

    @_guard
    def extract(self, context, data, *, expected_version, request_id, now):
        with self._sources._lock, self._lock:
            host = self._host(context, now)
            request = (host[3], _text(request_id))
            if request in self._requests:
                raise PatternError("REQUEST_REPLAY")
            data = _payload(data)
            raw = self._attestations.get((id(context), _hash(data)))
            if raw is None:
                raise PatternError("PATTERN_ATTESTATION_REQUIRED")
            attestation = json.loads(raw)
            if not datetime.fromisoformat(attestation["captured_at"]) <= _time(now) < datetime.fromisoformat(attestation["expires_at"]):
                raise PatternError("STALE_PATTERN_ATTESTATION")
            source = self._source(context, data["source_ref"], now)
            self._quality(source, data, attestation["proof"])
            key = (host[3], data["artifact_id"])
            previous = self._records.get(key, [])
            if _integer(expected_version, 0) != len(previous) or data["version"] != len(previous) + 1:
                raise PatternError("PATTERN_VERSION_CONFLICT")
            if previous:
                old = _decode(previous[-1])
                if old.kind != data["kind"] or to_primitive(old.source_ref) != data["source_ref"]:
                    raise PatternError("PATTERN_IDENTITY_REBIND")
                if _time(now) < old.created_at:
                    raise PatternError("STALE_PATTERN_TIME")
            details = data["details"]
            if data["kind"] == "EXAMPLE_REFERENCE":
                selector, locator = details["selector"], to_primitive(source.locator)
                path, symbol = selector["path"], selector["symbol"]
                if "paths" in locator:
                    if path is None or "\\" in path or ":" in path or any(x in ("", ".", "..") for x in path.split("/")):
                        raise PatternError("INVALID_REFERENCE_SELECTOR")
                    if not any(path == parent or path.startswith(parent + "/") for parent in locator["paths"]):
                        raise PatternError("INVALID_REFERENCE_SELECTOR")
                elif path is not None:
                    raise PatternError("INVALID_REFERENCE_SELECTOR")
                if symbol is not None and symbol not in locator.get("symbols", []):
                    raise PatternError("INVALID_REFERENCE_SELECTOR")
                # Source의 identity는 유지하되 명시적으로 선택하지 않은 sibling
                # path/symbol은 artifact 정본에도 남기지 않는다.
                selected_locator = {key: value for key, value in locator.items() if key not in ("paths", "symbols")}
                if path is not None:
                    selected_locator["paths"] = [path]
                if symbol is not None:
                    selected_locator["symbols"] = [symbol]
                details["locator"] = selected_locator
            for reference in details.get("example_refs", []):
                example = self._checked_ref(host, reference)
                if example.kind != "EXAMPLE_REFERENCE" or to_primitive(example.source_ref) != data["source_ref"]:
                    raise PatternError("PATTERN_REFERENCE_MISMATCH")
                self._source(context, to_primitive(example.source_ref), now)
                if _time(now) < example.created_at:
                    raise PatternError("STALE_PATTERN_TIME")
            provenance = {k: to_primitive(getattr(source, k)) for k in (
                "scope", "confidentiality", "license_ref", "license_status", "ownership", "exclusions", "quality_label", "source_type", "content_hash")}
            body = dict(data, provenance=provenance, evidence_hash=_hash(attestation), candidate_only=True,
                        previous_hash=_decode(previous[-1]).record_hash if previous else None, created_by=host[2], created_at=_time(now))
            body["record_hash"] = _hash(body)
            stored = _canonical(body)
            self._records[key] = previous + [stored]
            self._requests.add(request)
            artifact = _decode(stored)
            return _summary(artifact) if artifact.kind == "EXAMPLE_REFERENCE" else artifact

    @_guard
    def get(self, context, artifact_id, *, version, now):
        with self._sources._lock, self._lock:
            host = self._host(context, now)
            artifact = self._lookup(host, artifact_id, version)
            self._source(context, to_primitive(artifact.source_ref), now)
            if _time(now) < artifact.created_at:
                raise PatternError("STALE_PATTERN_TIME")
            return _summary(artifact) if artifact.kind == "EXAMPLE_REFERENCE" else artifact

    @_guard
    def search(self, context, query, *, now):
        with self._sources._lock, self._lock:
            host = self._host(context, now)
            if type(query) is not dict or set(query) - {"intent", "language", "framework", "risk", "kind"}:
                raise PatternError("INVALID_PATTERN_INPUT")
            query = deepcopy(query)
            for value in query.values():
                _text(value)
            kind = query.get("kind", "CODE_PATTERN")
            if kind not in _DETAIL_FIELDS or ("risk" in query and query["risk"] not in _RISKS):
                raise PatternError("INVALID_PATTERN_INPUT")
            found = []
            for (scope, _), values in self._records.items():
                if scope != host[3]:
                    continue
                artifact = _decode(values[-1])
                if artifact.kind != kind or _time(now) < artifact.created_at:
                    continue
                try:
                    self._source(context, to_primitive(artifact.source_ref), now)
                except PatternError as error:
                    if error.reason == "LEARNING_SOURCE_REVOKED":
                        continue
                    raise
                summary = _summary(artifact)
                if "risk" in query and summary.risk != query["risk"]:
                    continue
                if "language" in query and query["language"].casefold() not in [x.casefold() for x in summary.languages]:
                    continue
                if "framework" in query and query["framework"].casefold() not in [x.casefold() for x in summary.frameworks]:
                    continue
                terms = query.get("intent", "").casefold().split()
                if not all(term in summary.intent.casefold() for term in terms):
                    continue
                score = sum(summary.intent.casefold().count(term) for term in terms)
                found.append((-score, summary.artifact_id, -summary.version, summary))
            return tuple(item[3] for item in sorted(found, key=lambda item: item[:3]))

    @_guard
    def load_reference(self, context, *, pattern_ref, reference_ref, now):
        with self._sources._lock, self._lock:
            host = self._host(context, now)
            pattern = self._checked_ref(host, pattern_ref)
            self._source(context, to_primitive(pattern.source_ref), now)
            if pattern.kind != "CODE_PATTERN" or reference_ref not in to_primitive(pattern.details["example_refs"]):
                raise PatternError("PATTERN_REFERENCE_NOT_SELECTED")
            reference = self._checked_ref(host, reference_ref)
            self._source(context, to_primitive(reference.source_ref), now)
            if reference.kind != "EXAMPLE_REFERENCE" or reference.source_ref != pattern.source_ref:
                raise PatternError("PATTERN_REFERENCE_MISMATCH")
            if _time(now) < max(pattern.created_at, reference.created_at):
                raise PatternError("STALE_PATTERN_TIME")
            return reference
