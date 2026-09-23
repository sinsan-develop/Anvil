"""D-05 terminal review/Reflection와 in-memory job 계약. 실제 queue/Run/IO 없음.

attest는 host가 실제 terminal/evidence/human closure를 확인한 뒤 쓰는 trusted
control-plane seam이다. API는 이 권한을 만들지 않는다. D-06 descriptor만 반환한다.
"""
from contextlib import ExitStack, contextmanager
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
from threading import RLock

from .memory import MemoryError, MemoryRepository, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import LearningSourceRepository, _text, _digest, _integer, _freeze
from .snapshots import LearningSnapshotRepository
from .patterns import PatternRepository

TERMINAL_RESULTS = frozenset(("SUCCEEDED", "FINISHED_WITH_FAILURES", "FAILED", "CANCELLED", "REJECTED", "DISCARDED"))
VERIFICATION_STATES = ("PASS", "FAIL", "SKIPPED", "BLOCKED", "ERROR")


class ReviewError(MemoryError):
    pass


def _guard(function):
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except ReviewError:
            raise
        except MemoryError as error:
            raise ReviewError(error.reason) from None
        except (TypeError, ValueError, OverflowError, RecursionError):
            raise ReviewError("INVALID_REVIEW_INPUT") from None
    return guarded


def _fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise ReviewError("INVALID_REVIEW_INPUT")


def _refs(value, required=True):
    if type(value) is not list or (required and not value):
        raise ReviewError("REVIEW_EVIDENCE_REQUIRED")
    return sorted(set(_text(x) for x in value))


def _subject(value):
    _fields(value, "kind subject_id")
    if value["kind"] not in ("RUN", "ITERATION"):
        raise ReviewError("TERMINAL_SUBJECT_REQUIRED")
    _text(value["subject_id"])
    return dict(value)


def _reference(value):
    _fields(value, "kind artifact_id version content_hash locator")
    _text(value["kind"])
    _text(value["artifact_id"])
    _integer(value["version"])
    _digest(value["content_hash"])
    if type(value["locator"]) is not dict:
        raise ReviewError("INVALID_REVIEW_REFERENCE")
    for key, item in value["locator"].items():
        _text(key)
        _text(item)
    return deepcopy(value)


def _payload(value):
    _fields(value, "review_id version subject_ref decisions user_corrections reusable_successes failures_recoveries selected_patterns excluded_alternatives unresolved_risks candidate_actions no_change_reason")
    value = deepcopy(value)
    _text(value["review_id"])
    if _integer(value["version"]) != 1:
        raise ReviewError("REVIEW_VERSION_CONFLICT")
    _subject(value["subject_ref"])
    for field in ("decisions", "user_corrections", "reusable_successes", "failures_recoveries", "excluded_alternatives", "unresolved_risks", "candidate_actions"):
        if type(value[field]) is not list:
            raise ReviewError("INVALID_REVIEW_INPUT")
        for item in value[field]:
            fields = "failure recovery evidence_refs" if field == "failures_recoveries" else "kind action polarity summary evidence_refs" if field == "candidate_actions" else "summary evidence_refs"
            _fields(item, fields)
            for key in fields.split():
                if key == "evidence_refs":
                    item[key] = _refs(item[key])
                else:
                    _text(item[key])
            if field == "candidate_actions" and (item["kind"] not in ("MEMORY", "CODE_PATTERN", "ANTI_PATTERN", "SKILL", "HOOK", "PROMPT", "BENCHMARK", "ROUTING")
                    or item["action"] != "PROPOSE" or item["polarity"] not in ("POSITIVE", "NEGATIVE", "NEUTRAL")):
                raise ReviewError("INVALID_REVIEW_CANDIDATE")
    if type(value["selected_patterns"]) is not list:
        raise ReviewError("INVALID_REVIEW_INPUT")
    value["selected_patterns"] = sorted((_reference(x) for x in value["selected_patterns"]), key=_canonical)
    reason = value["no_change_reason"]
    if bool(value["candidate_actions"]) == (reason is not None):
        raise ReviewError("REVIEW_OUTCOME_REQUIRED")
    if reason is not None:
        _fields(reason, "code message evidence_refs")
        _text(reason["code"])
        _text(reason["message"])
        reason["evidence_refs"] = _refs(reason["evidence_refs"])
    return value


@dataclass(frozen=True)
class LearningReview:
    review_id: str
    version: int
    subject_ref: object
    decisions: tuple
    user_corrections: tuple
    reusable_successes: tuple
    failures_recoveries: tuple
    selected_patterns: tuple
    excluded_alternatives: tuple
    unresolved_risks: tuple
    candidate_actions: tuple
    no_change_reason: object
    terminal_result: str
    human_closure: object
    target_hash: str
    verification: object
    verification_counts: object
    provenance: tuple
    scope: object
    evidence_digest: str
    next_task_effect: object
    created_by: str
    created_at: datetime
    content_hash: str
    reflection: object


@dataclass(frozen=True)
class ReviewJob:
    job_id: str
    subject_ref: object
    status: str


@dataclass(frozen=True)
class ReviewClaim:
    job_id: str
    epoch: int
    fencing_token: str
    expires_at: datetime


def _decode(raw):
    value = json.loads(raw)
    value["created_at"] = datetime.fromisoformat(value["created_at"])
    return LearningReview(**{k: _freeze(v) for k, v in value.items()})


class LearningReviewRepository:
    def __init__(self, sources, *, memory=None, snapshots=None, patterns=None):
        if type(sources) is not LearningSourceRepository:
            raise ReviewError("SOURCE_HOST_AUTHORITY_REQUIRED")
        for repository, expected in ((memory, MemoryRepository), (snapshots, LearningSnapshotRepository), (patterns, PatternRepository)):
            if repository is not None and type(repository) is not expected:
                raise ReviewError("INVALID_REVIEW_REPOSITORY")
        if patterns is not None and patterns._sources is not sources:
            raise ReviewError("INVALID_REVIEW_REPOSITORY")
        self._sources, self._memory, self._snapshots, self._patterns = sources, memory, snapshots, patterns
        self._lock = RLock()
        self._attestations, self._records, self._subjects, self._requests, self._jobs, self._claims = {}, {}, {}, {}, {}, {}
        self._owners = {}

    @contextmanager
    def _locked(self):
        # D-04와 같은 source→pattern 순서로 모든 provenance 읽기 경계를 고정한다.
        with ExitStack() as stack:
            for repository in (self._sources, self._patterns, self._memory, self._snapshots, self):
                if repository is not None:
                    stack.enter_context(repository._lock)
            yield

    def _host(self, context, now):
        return self._sources._host(context, now)

    @staticmethod
    def _key(host, subject):
        # Canonical subject remains scope-wide: another actor cannot mint a second owner.
        subject = _subject(subject)
        return (host[3], subject["kind"], subject["subject_id"])

    def _owned(self, context, host, subject):
        owner = self._owners.get(subject)
        return owner is not None and owner[0] is context and owner[1:] == host[1:]

    def _require_owner(self, context, host, subject):
        if subject not in self._owners:
            raise ReviewError("REVIEW_ATTESTATION_REQUIRED")
        if not self._owned(context, host, subject):
            raise ReviewError("REVIEW_AUTHORITY_MISMATCH")

    def _capture(self, context, host, subject, now, *, allow_expired=False):
        self._require_owner(context, host, subject)
        capture = json.loads(self._attestations[subject])
        closure = capture["terminal"]["human_closure"]
        if (capture["actor"] != host[2] or capture["context_id"] != host[1]
                or (closure is not None and closure["actor"] != host[2])):
            raise ReviewError("REVIEW_AUTHORITY_MISMATCH")
        if (_time(now) < datetime.fromisoformat(capture["captured_at"])
                or (not allow_expired and _time(now) >= datetime.fromisoformat(capture["expires_at"]))):
            raise ReviewError("STALE_REVIEW_ATTESTATION")
        return capture

    def _resolve(self, context, host, reference, now):
        reference = _reference(reference)
        kind, locator = reference["kind"], reference["locator"]
        scope = MemoryScope(*host[3])
        artifact_id, version, digest = reference["artifact_id"], reference["version"], reference["content_hash"]
        metadata = {}
        if kind == "SOURCE":
            if locator:
                raise ReviewError("INVALID_REVIEW_REFERENCE")
            current = self._sources.get(context, artifact_id, now=now)
            history = self._sources.history(context, artifact_id, now=now)
            if current.status != "REGISTERED" or version > len(history):
                raise ReviewError("LEARNING_SOURCE_REVOKED")
            artifact = history[version - 1]
            actual_hash = artifact.record_hash
            metadata = {k: to_primitive(getattr(artifact, k)) for k in ("scope", "confidentiality", "license_ref", "license_status", "ownership", "exclusions")}
            if artifact.findings or artifact.license_status != "APPROVED" or not artifact.license_ref:
                raise ReviewError("LEARNING_SOURCE_REVOKED")
        elif kind in ("CODE_PATTERN", "EXAMPLE_REFERENCE", "ANTI_PATTERN") and self._patterns is not None:
            if locator:
                raise ReviewError("INVALID_REVIEW_REFERENCE")
            artifact = self._patterns.get(context, artifact_id, version=version, now=now)
            if artifact.kind != kind:
                raise ReviewError("REVIEW_PROVENANCE_MISMATCH")
            actual_hash = artifact.record_hash
            metadata = to_primitive(artifact.provenance)
        elif kind in ("MEMORY", "USER") and self._memory is not None:
            if locator:
                raise ReviewError("INVALID_REVIEW_REFERENCE")
            artifact = self._memory.get(kind, scope, artifact_id, now=now)
            if artifact.version != version:
                raise ReviewError("REVIEW_PROVENANCE_MISMATCH")
            actual_hash = artifact.content_hash
            metadata = dict(scope=json.loads(host[4]))
        elif kind in ("SESSION_SNAPSHOT", "TASK_SNAPSHOT") and self._snapshots is not None:
            if version != 1:
                raise ReviewError("REVIEW_PROVENANCE_MISMATCH")
            _fields(locator, "session_id" if kind == "SESSION_SNAPSHOT" else "session_id task_id run_id")
            artifact = (self._snapshots.get_session(locator["session_id"], scope) if kind == "SESSION_SNAPSHOT"
                        else self._snapshots.get_task_run(locator["session_id"], locator["task_id"], locator["run_id"], scope))
            if artifact.snapshot_id != artifact_id or artifact.created_at > _time(now):
                raise ReviewError("REVIEW_PROVENANCE_MISMATCH")
            if kind == "TASK_SNAPSHOT":
                catalog = self._snapshots._catalog(host[3], _time(now))
                for pinned in artifact.source_versions:
                    live = [x for x in catalog["sources"] if x["source_id"] == pinned["source_id"] and x["kind"] == pinned["kind"] and x["version"] == pinned["version"]]
                    if not live or any(x["source_status"] != "ACTIVE" or x["status"] != "ACTIVE" or x["content_hash"] != pinned["content_hash"] for x in live):
                        raise ReviewError("LEARNING_SOURCE_REVOKED")
            actual_hash = artifact.content_hash
            metadata = dict(scope=to_primitive(artifact.scope))
        else:
            raise ReviewError("INVALID_REVIEW_REFERENCE")
        if actual_hash != digest or metadata["scope"] != json.loads(host[4]):
            raise ReviewError("REVIEW_PROVENANCE_MISMATCH")
        return dict(reference=reference, inherited=metadata)

    @_guard
    def attest(self, context, data, terminal, evidence, *, now, expires_at):
        """Trusted terminal capture; caller/API cannot mint verification or human closure."""
        with self._locked():
            host = self._host(context, now)
            data, terminal, evidence = _payload(data), deepcopy(terminal), deepcopy(evidence)
            key = self._key(host, data["subject_ref"])
            if key in self._owners:
                self._require_owner(context, host, key)
            _fields(terminal, "subject_ref result target_hash ended_at human_closure")
            if _subject(terminal["subject_ref"]) != data["subject_ref"]:
                raise ReviewError("REVIEW_TERMINAL_MISMATCH")
            _digest(terminal["target_hash"])
            if terminal["subject_ref"]["kind"] == "RUN":
                if terminal["result"] not in TERMINAL_RESULTS or terminal["human_closure"] is not None:
                    raise ReviewError("TERMINAL_SUBJECT_REQUIRED")
            else:
                closure = terminal["human_closure"]
                if terminal["result"] != "HUMAN_CLOSED" or type(closure) is not dict:
                    raise ReviewError("HUMAN_CLOSURE_REQUIRED")
                _fields(closure, "actor decision evidence_ref target_hash")
                if closure["actor"] != host[2] or closure["decision"] != "CLOSED" or closure["target_hash"] != terminal["target_hash"]:
                    raise ReviewError("HUMAN_CLOSURE_REQUIRED")
                _text(closure["evidence_ref"])
            ended_at, now, expires_at = _time(terminal["ended_at"]), _time(now), _time(expires_at)
            if not ended_at <= now < expires_at <= host[6]:
                raise ReviewError("STALE_REVIEW_ATTESTATION")
            _fields(evidence, "verification evidence_refs provenance")
            evidence["evidence_refs"] = _refs(evidence["evidence_refs"])
            if type(evidence["verification"]) is not dict or type(evidence["provenance"]) is not list:
                raise ReviewError("INVALID_REVIEW_EVIDENCE")
            for ref, check in evidence["verification"].items():
                _text(ref)
                _fields(check, "kind status target_hash")
                if check["kind"] not in ("TEST", "GATE") or check["status"] not in VERIFICATION_STATES:
                    raise ReviewError("INVALID_REVIEW_EVIDENCE")
                if check["target_hash"] != terminal["target_hash"] or ref not in evidence["evidence_refs"]:
                    raise ReviewError("REVIEW_EVIDENCE_TARGET_MISMATCH")
            if terminal["human_closure"] is not None and terminal["human_closure"]["evidence_ref"] not in evidence["evidence_refs"]:
                raise ReviewError("HUMAN_CLOSURE_REQUIRED")
            evidence["provenance"] = sorted((_reference(x) for x in evidence["provenance"]), key=_canonical)
            for ref in evidence["provenance"]:
                self._resolve(context, host, ref, now)
            value = dict(payload_hash=_hash(data), terminal=terminal, evidence=evidence, actor=host[2], context_id=host[1], captured_at=now, expires_at=expires_at)
            raw = _canonical(value)
            if key in self._attestations and self._attestations[key] != raw:
                previous = json.loads(self._attestations[key])
                binding = ("payload_hash", "terminal", "evidence", "actor", "context_id")
                current = json.loads(raw)
                if (now < datetime.fromisoformat(previous["expires_at"])
                        or any(previous[field] != current[field] for field in binding)):
                    raise ReviewError("REVIEW_ATTESTATION_REBIND")
            self._owners[key] = host
            self._attestations[key] = raw

    def _evidence_check(self, data, capture):
        evidence = capture["evidence"]
        known = set(evidence["evidence_refs"])
        positives = list(data["reusable_successes"])
        for field in ("decisions", "user_corrections", "reusable_successes", "failures_recoveries", "excluded_alternatives", "unresolved_risks", "candidate_actions"):
            for item in data[field]:
                if not set(item["evidence_refs"]) <= known:
                    raise ReviewError("REVIEW_EVIDENCE_REQUIRED")
                if field == "candidate_actions" and (item["polarity"] == "POSITIVE" or item["kind"] == "CODE_PATTERN"):
                    positives.append(item)
        if data["no_change_reason"] is not None and not set(data["no_change_reason"]["evidence_refs"]) <= known:
            raise ReviewError("REVIEW_EVIDENCE_REQUIRED")
        available = {_canonical(x) for x in evidence["provenance"] if x["kind"] in ("CODE_PATTERN", "EXAMPLE_REFERENCE", "ANTI_PATTERN")}
        if any(_canonical(x) not in available for x in data["selected_patterns"]):
            raise ReviewError("REVIEW_PROVENANCE_MISMATCH")
        checks = evidence["verification"]
        if positives and (capture["terminal"]["result"] != "SUCCEEDED" or not checks or any(x["status"] != "PASS" for x in checks.values())):
            raise ReviewError("POSITIVE_REVIEW_EVIDENCE_REQUIRED")
        for item in positives:
            if not set(item["evidence_refs"]) <= {k for k, v in checks.items() if v["status"] == "PASS"}:
                raise ReviewError("POSITIVE_REVIEW_EVIDENCE_REQUIRED")

    @_guard
    def create(self, context, data, *, expected_version, request_id, now):
        with self._locked():
            host = self._host(context, now)
            data = _payload(data)
            if _integer(expected_version, 0) != 0:
                raise ReviewError("REVIEW_VERSION_CONFLICT")
            subject = self._key(host, data["subject_ref"])
            # Ownership and capture start time apply before both idempotency fast paths.
            capture = self._capture(context, host, subject, now, allow_expired=subject in self._subjects)
            request = (host[3], _text(request_id))
            digest = _hash(data)
            if request in self._requests:
                prior_digest, review_id = self._requests[request]
                if prior_digest != digest:
                    raise ReviewError("REVIEW_REPLAY_CONFLICT")
                return _decode(self._records[(host[3], review_id)])
            if subject in self._subjects:
                prior_digest, review_id = self._subjects[subject]
                if prior_digest != digest:
                    raise ReviewError("REVIEW_ALREADY_EXISTS")
                self._requests[request] = (digest, review_id)
                return _decode(self._records[(host[3], review_id)])
            if capture["payload_hash"] != digest:
                raise ReviewError("REVIEW_ATTESTATION_MISMATCH")
            self._evidence_check(data, capture)
            provenance = [self._resolve(context, host, ref, now) for ref in capture["evidence"]["provenance"]]
            review_key = (host[3], data["review_id"])
            if review_key in self._records:
                raise ReviewError("REVIEW_IDENTITY_REBIND")
            verification = capture["evidence"]["verification"]
            counts = {state: sum(x["status"] == state for x in verification.values()) for state in VERIFICATION_STATES}
            body = dict(data, terminal_result=capture["terminal"]["result"], target_hash=capture["terminal"]["target_hash"],
                        human_closure=capture["terminal"]["human_closure"],
                        verification=verification, verification_counts=counts, provenance=provenance, scope=json.loads(host[4]),
                        evidence_digest=_hash(capture), next_task_effect=dict(mode="PROPOSAL_ONLY", applies_from="NEXT_TASK_AFTER_D06_APPROVAL", activation_ids=[]),
                        created_by=host[2], created_at=_time(now))
            body["content_hash"] = _hash(body)
            reflection = dict(review_hash=body["content_hash"], subject_ref=data["subject_ref"], scope=json.loads(host[4]),
                              candidate_count=len(data["candidate_actions"]), decision_count=len(data["decisions"]), correction_count=len(data["user_corrections"]),
                              verification_counts=counts, no_change_code=data["no_change_reason"]["code"] if data["no_change_reason"] else None)
            reflection["content_hash"] = _hash(reflection)
            body["reflection"] = reflection
            stored = _canonical(body)
            self._records[review_key] = stored
            self._subjects[subject] = (digest, data["review_id"])
            self._requests[request] = (digest, data["review_id"])
            return _decode(stored)

    @_guard
    def get(self, context, review_id, *, now):
        with self._locked():
            host = self._host(context, now)
            raw = self._records.get((host[3], _text(review_id)))
            if raw is None:
                raise ReviewError("REVIEW_NOT_FOUND")
            self._require_owner(context, host, self._key(host, json.loads(raw)["subject_ref"]))
            return _decode(raw)

    @_guard
    def list(self, context, *, now):
        with self._locked():
            host = self._host(context, now)
            return tuple(_decode(raw) for (scope, review_id), raw in sorted(self._records.items(), key=str)
                         if scope == host[3] and self._owned(context, host, self._key(host, json.loads(raw)["subject_ref"])))

    @_guard
    def enqueue(self, context, subject_ref, *, now):
        with self._locked():
            host = self._host(context, now)
            key = self._key(host, subject_ref)
            self._capture(context, host, key, now)
            job_id = "review-job-" + _hash(dict(scope=json.loads(host[4]), subject_ref=subject_ref))
            if job_id not in self._jobs:
                self._jobs[job_id] = dict(scope=host[3], subject_ref=deepcopy(subject_ref), status="QUEUED", epoch=0)
            job = self._jobs[job_id]
            return ReviewJob(job_id, _freeze(deepcopy(job["subject_ref"])), job["status"])

    @_guard
    def claim(self, context, job_id, *, now, lease_seconds=60):
        with self._locked():
            host = self._host(context, now)
            _text(job_id)
            job = self._jobs.get(job_id)
            if job is None or job["scope"] != host[3]:
                raise ReviewError("REVIEW_JOB_NOT_FOUND")
            self._capture(context, host, self._key(host, job["subject_ref"]), now)
            if job["status"] == "COMPLETED":
                raise ReviewError("REVIEW_JOB_COMPLETED")
            if job["status"] == "CLAIMED" and _time(now) < job["expires_at"]:
                raise ReviewError("REVIEW_JOB_CLAIMED")
            if _integer(lease_seconds) > 3600:
                raise ReviewError("INVALID_REVIEW_CLAIM")
            expiry = _time(now) + timedelta(seconds=lease_seconds)
            if expiry > host[6]:
                raise ReviewError("INVALID_REVIEW_CLAIM")
            epoch = job["epoch"] + 1
            token = _hash(dict(job_id=job_id, epoch=epoch, actor=host[2], issued_at=_time(now), expires_at=expiry))
            claim = ReviewClaim(job_id, epoch, token, expiry)
            self._claims[id(claim)] = (claim, id(context), _canonical(claim))
            job.update(status="CLAIMED", epoch=epoch, claimed_at=_time(now), expires_at=expiry, claim_id=id(claim))
            return claim

    @_guard
    def complete(self, context, claim, data, *, now):
        with self._locked():
            host = self._host(context, now)
            issued = self._claims.get(id(claim))
            if type(claim) is not ReviewClaim or issued is None or issued[0] is not claim or issued[2] != _canonical(claim):
                raise ReviewError("STALE_REVIEW_FENCING_TOKEN")
            job = self._jobs[claim.job_id]
            self._require_owner(context, host, self._key(host, job["subject_ref"]))
            if issued[1] != id(context):
                raise ReviewError("STALE_REVIEW_FENCING_TOKEN")
            if job.get("claim_id") != id(claim) or job["epoch"] != claim.epoch:
                raise ReviewError("STALE_REVIEW_FENCING_TOKEN")
            if job["status"] == "COMPLETED":
                raise ReviewError("REVIEW_JOB_COMPLETED")
            if not job["claimed_at"] <= _time(now) < claim.expires_at:
                raise ReviewError("STALE_REVIEW_FENCING_TOKEN")
            data = _payload(data)
            if data["subject_ref"] != job["subject_ref"]:
                raise ReviewError("REVIEW_TERMINAL_MISMATCH")
            result = self.create(context, data, expected_version=0, request_id="job-complete-" + claim.job_id, now=now)
            job["status"] = "COMPLETED"
            return result
