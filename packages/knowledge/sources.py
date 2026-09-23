"""D-03 순수 출처 registry: 실제 파일/URL/DB/Run IO 없음.

admit_host/authorize_capture는 인증·검사한 host control-plane의 trusted adapter
경계다. API payload로 호출할 수 없으며 실제 인증/승인 lifecycle은 구현하지 않는다.
본문은 hash/검사에만 사용하고 저장하지 않는다. Registry 정본은 JSON 문자열이다.
"""
from dataclasses import dataclass
from copy import deepcopy
from datetime import datetime
from hashlib import sha256
import json
import re
from threading import RLock
from types import MappingProxyType
from urllib.parse import unquote_plus, urlsplit

from .memory import (MemoryError, MemoryScope, _canonical, _hash, _scan,
                     _scope_key, _time, _instruction_override, to_primitive)


class SourceError(MemoryError):
    pass


def _guard(function):
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except SourceError:
            raise
        except MemoryError as error:
            raise SourceError(error.reason) from None
        except (TypeError, ValueError, OverflowError, RecursionError):
            raise SourceError("INVALID_SOURCE_INPUT") from None
    return guarded


def _freeze(value):
    if type(value) is dict:
        return MappingProxyType({k: _freeze(v) for k, v in value.items()})
    if type(value) is list:
        return tuple(_freeze(v) for v in value)
    return value


def _decode(raw, kind):
    values = json.loads(raw)
    if "created_at" in values:
        values["created_at"] = datetime.fromisoformat(values["created_at"])
    return kind(**{k: _freeze(v) for k, v in values.items()})


def _fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise SourceError("INVALID_SOURCE_INPUT")


def _pii(value):
    return re.search(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|\b\d{6}-[1-4]\d{6}\b|\b01[016789][- ]\d{3,4}[- ]\d{4}\b", value)


_CREDENTIAL_KEY = (
    r"(?<!\w)(?:token|(?:access|refresh|id|auth)[\s_-]*token|secret|client[\s_-]*secret|"
    r"password|passwd|api[\s_-]*key|authorization|credential)[\"']?"
)
_CREDENTIAL_ASSIGNMENT = re.compile(
    _CREDENTIAL_KEY + r"\s*[:=]\s*[\"']?[^\s\"'&,;}]+", re.IGNORECASE,
)
_EMPTY_CREDENTIAL_ASSIGNMENT = re.compile(
    _CREDENTIAL_KEY + r"\s*[:=]\s*(?:\"\"|'')?(?=\s*(?:$|[&,;}]))", re.IGNORECASE,
)
_MAPPING_CREDENTIAL_KEY = re.compile(_CREDENTIAL_KEY, re.IGNORECASE)


def _inspection_text(value):
    """검사 전용 URL decoding. 원본 locator를 변경하거나 네트워크를 호출하지 않는다."""
    for _ in range(4):
        decoded = unquote_plus(value)
        if decoded == value:
            return value
        value = decoded
    if unquote_plus(value) != value:
        raise SourceError("UNSAFE_SOURCE_METADATA")
    return value


def _scan_credentials(value):
    # 빈 query 값/빈 따옴표는 credential이 아니다. 이후의 다른 assignment는
    # 제거하지 않으므로 빈 값 뒤에 실제 secret을 숨길 수 없다.
    value = _EMPTY_CREDENTIAL_ASSIGNMENT.sub("", value)
    _scan(value)
    if _CREDENTIAL_ASSIGNMENT.search(value):
        raise SourceError("SECRET_LIKE_INPUT")


def _has_credential_value(value):
    """null/blank string/empty container만 비어 있다. 0과 false는 제공된 값이다."""
    if value is None:
        return False
    if type(value) is str:
        return bool(value.strip())
    if type(value) in (list, tuple, dict):
        return len(value) != 0
    return True


def _scan_body_credentials(value):
    # JSON escape 이전 mapping key/value 의미를 결합한다. 직렬화된 null/[]/{}
    # 문자를 credential 값으로 오판하거나 실제 TAB key를 놓치지 않는다.
    if type(value) is str:
        _scan_credentials(_inspection_text(value))
    elif type(value) is dict:
        for key, item in value.items():
            if (type(key) is str and _MAPPING_CREDENTIAL_KEY.fullmatch(_inspection_text(key).strip())
                    and _has_credential_value(item)):
                raise SourceError("SECRET_LIKE_INPUT")
            _scan_body_credentials(key)
            _scan_body_credentials(item)
    elif type(value) in (list, tuple):
        for item in value:
            _scan_body_credentials(item)


def _text(value):
    # 경계 whitespace를 조용히 strip하면 다른 revision/locator가 합쳐지므로 거부한다.
    if type(value) is not str or not value.strip() or value != value.strip() or len(value) > 4096:
        raise SourceError("INVALID_SOURCE_INPUT")
    inspected = _inspection_text(value)
    _scan_credentials(inspected)
    if _instruction_override(inspected) or _pii(inspected) or "EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in inspected:
        raise SourceError("UNSAFE_SOURCE_METADATA")
    return value


def _digest(value):
    if type(value) is not str or re.fullmatch("[a-f0-9]{64}", value) is None:
        raise SourceError("INVALID_SOURCE_HASH")
    return value


def _integer(value, minimum=1):
    if type(value) is not int or value < minimum:
        raise SourceError("INVALID_SOURCE_VERSION")
    return value


@_guard
def hash_body(body):
    if type(body) not in (str, dict, bytes):
        raise SourceError("INVALID_SOURCE_INPUT")
    content = body if type(body) is bytes else (body if type(body) is str else _canonical(body)).encode("utf-8")
    return sha256(content).hexdigest()


_SOURCE_FIELDS = "source_id version source_type locator body content_hash teaching_intent user_quality_label exclusions"
_LOCATORS = {
    "code_selection": "repository_id commit paths symbols", "repository_snapshot": "repository_id commit paths",
    "design_document": "document_id revision", "conversation": "conversation_id revision",
    "completed_run": "run_id revision", "url_or_package_doc": "url revision",
}
_DERIVED = frozenset("MEMORY CODE_PATTERN EXAMPLE_REFERENCE SKILL HOOK PROMPT BENCHMARK ANTI_PATTERN".split())


def _strings(value, nonempty=False):
    if type(value) not in (list, tuple) or (nonempty and not value):
        raise SourceError("INVALID_SOURCE_INPUT")
    return sorted(set(_text(x) for x in value))


def _candidate(payload):
    _fields(payload, _SOURCE_FIELDS)
    result = {k: v for k, v in payload.items() if k != "body"}
    for key in ("source_id", "teaching_intent", "user_quality_label"):
        _text(result[key])
    if result["user_quality_label"] not in ("exemplar", "reference", "unverified", "anti_pattern"):
        raise SourceError("INVALID_SOURCE_INPUT")
    _integer(result["version"])
    if result["source_type"] not in _LOCATORS:
        raise SourceError("INVALID_SOURCE_TYPE")
    locator = dict(result["locator"]) if type(result["locator"]) is dict else None
    _fields(locator, _LOCATORS[result["source_type"]])
    for key, value in locator.items():
        if key in ("paths", "symbols"):
            locator[key] = _strings(value, nonempty=True)
        else:
            _text(value)
    if "commit" in locator:
        if not re.fullmatch(r"[a-fA-F0-9]{40}|[a-fA-F0-9]{64}", locator["commit"]):
            raise SourceError("INVALID_SOURCE_LOCATOR")
        locator["commit"] = locator["commit"].lower()
    for path in locator.get("paths", []):
        if "\\" in path or ":" in path or any(p in ("", ".", "..") for p in path.split("/")):
            raise SourceError("INVALID_SOURCE_LOCATOR")
    if "url" in locator:
        parsed = urlsplit(locator["url"])
        if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
            raise SourceError("INVALID_SOURCE_LOCATOR")
    result["locator"] = locator
    result["exclusions"] = _strings(result["exclusions"])
    if _digest(result["content_hash"]) != hash_body(payload["body"]):
        raise SourceError("SOURCE_CONTENT_HASH_MISMATCH")
    return json.loads(_canonical(result))


def _findings(payload, metadata):
    findings = []
    def add(code, field="body"):
        findings.append(dict(code=code, severity="CRITICAL", field=field))
    body = payload["body"]
    text = body if type(body) is str else (_canonical(body) if type(body) is dict else "")
    try:
        _scan_body_credentials(body)
    except MemoryError:
        add("SECRET_LIKE_INPUT")
    if _pii(text):
        add("DIRECT_PII")
    if _instruction_override(text):
        add("MEMORY_INSTRUCTION_INJECTION")
    if "EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in text:
        add("MALWARE_MARKER")
    paths = payload["locator"].get("paths", [])
    if type(body) is bytes or "\x00" in text or any(p.lower().endswith((".exe", ".dll", ".com", ".so", ".bin")) for p in paths):
        add("BINARY_SOURCE")
    if any(len(line) > 500 and line.count(" ") < len(line) // 30 for line in text.splitlines()) or any(".min." in p.lower() for p in paths):
        add("MINIFIED_SOURCE")
    if any(set(p.lower().split("/")) & {"vendor", "node_modules", "third_party"} for p in paths):
        add("VENDORED_SOURCE", "locator")
    if metadata["license_ref"] is None:
        add("LICENSE_MISSING", "license")
    if metadata["license_status"] != "APPROVED":
        add("LICENSE_PROHIBITED" if metadata["license_status"] == "PROHIBITED" else "LICENSE_UNCLEAR", "license")
    if metadata["ownership"] not in ("OWNED", "LICENSED"):
        add("OWNERSHIP_REQUIRED", "ownership")
    return findings


@dataclass(frozen=True)
class SourceHostContext:
    context_id: str


@dataclass(frozen=True)
class LearningSource:
    source_id: str
    version: int
    source_type: str
    locator: object
    content_hash: str
    teaching_intent: str
    user_quality_label: str
    exclusions: tuple
    scope: object
    confidentiality: str
    license_ref: str | None
    license_status: str
    ownership: str
    quality_evidence: tuple
    quality_label: str
    activation_eligible: bool
    findings: tuple
    scan_revision: str
    previous_hash: str | None
    created_by: str
    created_at: datetime
    record_hash: str


@dataclass(frozen=True)
class SourceState:
    record: LearningSource
    status: str
    state_version: int


@dataclass(frozen=True)
class DerivedSourceItem:
    item_id: str
    version: int
    kind: str
    content_hash: str
    source_ref: object
    parent_ref: object
    scope: object
    confidentiality: str
    license_ref: str
    license_status: str
    ownership: str
    exclusions: tuple
    created_by: str
    created_at: datetime
    record_hash: str


@dataclass(frozen=True)
class SourceUsage:
    source_ref: object
    derived_ref: object
    snapshot_id: str
    run_id: str
    run_status: str
    scope: object
    confidentiality: str
    license_ref: str
    license_status: str
    ownership: str
    exclusions: tuple
    created_by: str
    created_at: datetime
    record_hash: str


@dataclass(frozen=True)
class SourceRevocationImpact:
    impact_id: str
    source_ref: object
    state_version: int
    status: str
    reason: str
    derived_items: tuple
    affected_snapshots: tuple
    affected_runs: tuple
    pause_required_runs: tuple
    new_use_blocked: bool
    created_by: str
    created_at: datetime
    record_hash: str


class LearningSourceRepository:
    def __init__(self):
        self._lock = RLock()
        self._hosts, self._captures, self._sources, self._states = {}, {}, {}, {}
        self._derived, self._usages, self._impacts, self._requests, self._runs = {}, [], {}, set(), {}

    @_guard
    def admit_host(self, actor, scope, *, now, expires_at):
        """Trusted host-only admission, not an HTTP/payload authentication API."""
        with self._lock:
            _text(actor)
            scope_key = _scope_key(scope)
            for identifier in scope_key:
                if identifier is not None:
                    _text(identifier)
            now, expires_at = _time(now), _time(expires_at)
            if now >= expires_at:
                raise SourceError("SOURCE_HOST_AUTHORITY_REQUIRED")
            context = SourceHostContext("host-" + str(len(self._hosts) + 1))
            self._hosts[id(context)] = (context, context.context_id, actor, scope_key, _canonical(scope), now, expires_at)
            return context

    def _host(self, context, now):
        now = _time(now)
        entry = self._hosts.get(id(context))
        if type(context) is not SourceHostContext or entry is None or entry[0] is not context or context.context_id != entry[1] or not entry[5] <= now < entry[6]:
            raise SourceError("SOURCE_HOST_AUTHORITY_REQUIRED")
        return entry

    def _request(self, host, request_id):
        key = (host[3], _text(request_id))
        if key in self._requests:
            raise SourceError("REQUEST_REPLAY")
        return key

    def _current(self, host, source_id):
        key = (host[3], _text(source_id))
        if key not in self._states:
            raise SourceError("SOURCE_NOT_FOUND")
        return key, self._states[key]

    def _source(self, host, source_ref):
        _fields(source_ref, "source_id version record_hash")
        _integer(source_ref["version"])
        _digest(source_ref["record_hash"])
        key, state = self._current(host, source_ref["source_id"])
        records = self._sources[key]
        index = source_ref["version"] - 1
        if index >= len(records):
            raise SourceError("SOURCE_LINEAGE_MISMATCH")
        record = json.loads(records[index])
        if record["record_hash"] != source_ref["record_hash"]:
            raise SourceError("SOURCE_LINEAGE_MISMATCH")
        if state[0] != "REGISTERED" or not record["activation_eligible"]:
            raise SourceError("LEARNING_SOURCE_REVOKED")
        return record

    def _child(self, host, reference):
        _fields(reference, "item_id version record_hash")
        _text(reference["item_id"])
        _integer(reference["version"])
        _digest(reference["record_hash"])
        values = self._derived.get((host[3], reference["item_id"]), [])
        if reference["version"] > len(values):
            raise SourceError("SOURCE_LINEAGE_MISMATCH")
        result = json.loads(values[reference["version"] - 1])
        if result["record_hash"] != reference["record_hash"]:
            raise SourceError("SOURCE_LINEAGE_MISMATCH")
        return result

    @staticmethod
    def _inherit(source):
        return {k: source[k] for k in ("scope", "confidentiality", "license_ref", "license_status", "ownership", "exclusions")}

    @_guard
    def authorize_capture(self, context, payload, *, confidentiality, license_ref, license_status, ownership, quality_evidence, now):
        """Trusted capture attestation binds exactly this candidate; no raw body is retained."""
        with self._lock:
            self._host(context, now)
            payload = deepcopy(payload)
            candidate = _candidate(payload)
            if confidentiality not in ("private", "internal", "public") or license_status not in ("APPROVED", "UNKNOWN", "PROHIBITED") or ownership not in ("OWNED", "LICENSED", "NONE", "UNKNOWN"):
                raise SourceError("INVALID_SOURCE_INPUT")
            if license_ref is not None:
                _text(license_ref)
            metadata = dict(confidentiality=confidentiality, license_ref=license_ref, license_status=license_status,
                            ownership=ownership, quality_evidence=_strings(quality_evidence))
            key = (id(context), _hash(candidate))
            raw = _canonical(metadata)
            if key in self._captures and self._captures[key][0] != raw:
                raise SourceError("SOURCE_CAPTURE_REBIND")
            if key not in self._captures:
                self._captures[key] = (raw, _time(now))

    @_guard
    def register(self, context, payload, *, expected_version, request_id, now):
        with self._lock:
            host = self._host(context, now)
            request = self._request(host, request_id)
            payload = deepcopy(payload)
            candidate = _candidate(payload)
            capture = self._captures.get((id(context), _hash(candidate)))
            if capture is None:
                raise SourceError("SOURCE_CAPTURE_AUTHORITY_REQUIRED")
            raw, captured_at = capture
            if _time(now) < captured_at:
                raise SourceError("STALE_SOURCE_TIME")
            key = (host[3], candidate["source_id"])
            previous = self._sources.get(key, [])
            state = self._states.get(key, ("REGISTERED", 0, _time(now)))
            if _integer(expected_version, 0) != state[1] or candidate["version"] != len(previous) + 1:
                raise SourceError("SOURCE_VERSION_CONFLICT")
            if state[0] != "REGISTERED":
                raise SourceError("LEARNING_SOURCE_REVOKED")
            if _time(now) < state[2]:
                raise SourceError("STALE_SOURCE_TIME")
            metadata = json.loads(raw)
            findings = _findings(payload, metadata)
            eligible = not findings and bool(metadata["quality_evidence"])
            body = dict(candidate, **metadata, scope=json.loads(host[4]), findings=findings, activation_eligible=eligible,
                        quality_label="VERIFIED" if eligible else "USER_ENDORSED_UNVERIFIED",
                        scan_revision="d03-security-v1", previous_hash=json.loads(previous[-1])["record_hash"] if previous else None,
                        created_by=host[2], created_at=_time(now))
            body["record_hash"] = _hash(body)
            stored = _canonical(body)
            self._sources[key] = previous + [stored]
            self._states[key] = ("QUARANTINED" if findings else "REGISTERED", state[1] + 1, _time(now))
            self._requests.add(request)
            return SourceState(_decode(stored, LearningSource), self._states[key][0], state[1] + 1)

    @_guard
    def get(self, context, source_id, *, now):
        with self._lock:
            key, state = self._current(self._host(context, now), source_id)
            return SourceState(_decode(self._sources[key][-1], LearningSource), state[0], state[1])

    @_guard
    def history(self, context, source_id, *, now):
        with self._lock:
            key, _ = self._current(self._host(context, now), source_id)
            return tuple(_decode(x, LearningSource) for x in self._sources[key])

    @_guard
    def register_derived(self, context, payload, *, expected_version, request_id, now):
        with self._lock:
            host = self._host(context, now)
            request = self._request(host, request_id)
            payload = deepcopy(payload)
            _fields(payload, "item_id version kind content_hash source_ref parent_ref")
            _text(payload["item_id"])
            _digest(payload["content_hash"])
            if payload["kind"] not in _DERIVED:
                raise SourceError("INVALID_SOURCE_INPUT")
            source = self._source(host, payload["source_ref"])
            if _time(now) < datetime.fromisoformat(source["created_at"]):
                raise SourceError("STALE_SOURCE_TIME")
            if payload["parent_ref"] is not None:
                parent = self._child(host, payload["parent_ref"])
                if parent["source_ref"] != payload["source_ref"] or _time(now) < datetime.fromisoformat(parent["created_at"]):
                    raise SourceError("SOURCE_LINEAGE_MISMATCH")
            key = (host[3], payload["item_id"])
            previous = self._derived.get(key, [])
            if _integer(expected_version, 0) != len(previous) or _integer(payload["version"]) != len(previous) + 1:
                raise SourceError("SOURCE_VERSION_CONFLICT")
            if previous:
                old = json.loads(previous[-1])
                if old["source_ref"] != payload["source_ref"] or old["kind"] != payload["kind"] or _time(now) < datetime.fromisoformat(old["created_at"]):
                    raise SourceError("SOURCE_LINEAGE_MISMATCH")
            body = dict(payload, **self._inherit(source), created_by=host[2], created_at=_time(now))
            body["record_hash"] = _hash(body)
            raw = _canonical(body)
            self._derived[key] = previous + [raw]
            self._requests.add(request)
            return _decode(raw, DerivedSourceItem)

    @_guard
    def record_usage(self, context, *, source_ref, derived_ref, snapshot_id, run_id, run_status, request_id, now):
        with self._lock:
            host = self._host(context, now)
            request = self._request(host, request_id)
            source_ref, derived_ref = deepcopy(source_ref), deepcopy(derived_ref)
            source = self._source(host, source_ref)
            _text(snapshot_id)
            _text(run_id)
            if run_status not in ("ACTIVE", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"):
                raise SourceError("INVALID_SOURCE_INPUT")
            if _time(now) < datetime.fromisoformat(source["created_at"]):
                raise SourceError("STALE_SOURCE_TIME")
            if derived_ref is not None:
                child = self._child(host, derived_ref)
                if child["source_ref"] != source_ref or _time(now) < datetime.fromisoformat(child["created_at"]):
                    raise SourceError("SOURCE_LINEAGE_MISMATCH")
            run_key = (host[3], run_id)
            old = self._runs.get(run_key)
            if old and (_time(now) < old[1] or (_time(now) == old[1] and run_status != old[0])):
                raise SourceError("STALE_SOURCE_TIME")
            body = dict(source_ref=source_ref, derived_ref=derived_ref, snapshot_id=snapshot_id, run_id=run_id,
                        run_status=run_status, **self._inherit(source), created_by=host[2], created_at=_time(now))
            body["record_hash"] = _hash(body)
            raw = _canonical(body)
            self._usages.append((host[3], raw))
            self._runs[run_key] = (run_status, _time(now))
            self._requests.add(request)
            return _decode(raw, SourceUsage)

    @_guard
    def list_derived(self, context, source_id, *, now):
        with self._lock:
            host = self._host(context, now)
            self._current(host, source_id)
            return tuple(_decode(raw, DerivedSourceItem) for (scope, _), values in sorted(self._derived.items(), key=str)
                         if scope == host[3] for raw in values if json.loads(raw)["source_ref"]["source_id"] == source_id)

    @_guard
    def transition(self, context, source_id, target, reason, *, expected_version, request_id, now):
        with self._lock:
            host = self._host(context, now)
            request = self._request(host, request_id)
            key, state = self._current(host, source_id)
            if _integer(expected_version, 0) != state[1]:
                raise SourceError("SOURCE_VERSION_CONFLICT")
            if target not in ("REVOKED", "QUARANTINED") or reason not in ("DELETED", "PERMISSION_REVOKED", "LICENSE_CHANGED", "SECRET_EXPOSED", "MALWARE", "SECURITY_REVIEW"):
                raise SourceError("INVALID_SOURCE_TRANSITION")
            if _time(now) < state[2]:
                raise SourceError("STALE_SOURCE_TIME")
            source = json.loads(self._sources[key][-1])
            children = self.list_derived(context, source_id, now=now)
            usages = [json.loads(raw) for scope, raw in self._usages if scope == host[3] and json.loads(raw)["source_ref"]["source_id"] == source_id]
            if any(_time(now) < datetime.fromisoformat(x["created_at"]) for x in usages) or any(_time(now) < x.created_at for x in children):
                raise SourceError("STALE_SOURCE_TIME")
            runs = sorted({x["run_id"] for x in usages})
            body = dict(source_ref={k: source[k] for k in ("source_id", "version", "record_hash")}, state_version=state[1] + 1,
                        status=target, reason=reason, derived_items=[dict(item_id=x.item_id, version=x.version, record_hash=x.record_hash) for x in children],
                        affected_snapshots=sorted({x["snapshot_id"] for x in usages}), affected_runs=runs,
                        pause_required_runs=[run for run in runs if self._runs[(host[3], run)][0] == "ACTIVE"],
                        new_use_blocked=True, created_by=host[2], created_at=_time(now))
            body["impact_id"] = "impact-" + _hash(body)
            body["record_hash"] = _hash(body)
            raw = _canonical(body)
            self._impacts[(host[3], body["impact_id"])] = raw
            self._states[key] = (target, state[1] + 1, _time(now))
            self._requests.add(request)
            return _decode(raw, SourceRevocationImpact)

    @_guard
    def get_impact(self, context, impact_id, *, now):
        with self._lock:
            host = self._host(context, now)
            raw = self._impacts.get((host[3], _text(impact_id)))
            if raw is None:
                raise SourceError("SOURCE_NOT_FOUND")
            return _decode(raw, SourceRevocationImpact)
