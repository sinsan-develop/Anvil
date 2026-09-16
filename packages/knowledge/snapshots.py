"""D-02 immutable Session/Task/Run learning reference snapshots, without IO.

publish/authorize_revision are trusted host-control-plane entry points. They are
not available through the API adapter and do not implement human authentication
or the D-06 approval workflow. Source hashes reference host-verified artifacts;
this module validates metadata/lineage, not remote artifact contents.
"""
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
import json
import re
from threading import RLock
from types import MappingProxyType

from .memory import MemoryError, MemoryScope, _canonical, _hash, _scan, _scope_key, _text, _time, to_primitive


class SnapshotError(MemoryError):
    pass


_BASE_KINDS = frozenset(("SOUL", "USER", "MEMORY", "PROJECT_INSTRUCTION", "SKILL_CATALOG"))
_KINDS = frozenset(("MEMORY", "SKILL", "HOOK", "PROMPT", "CODE_PATTERN"))
_STATUSES = frozenset(("ACTIVE", "PENDING", "INACTIVE", "REVOKED", "QUARANTINED"))
_SOURCE_STATUSES = frozenset(("ACTIVE", "REVOKED", "QUARANTINED"))
_REF_FIELDS = frozenset(("source_id", "kind", "version", "content_hash"))
_SOURCE_FIELDS = _REF_FIELDS | frozenset(("scope", "user_id", "project_id", "status", "source_status",
                                         "activation_id", "activation_actor", "activated_at"))


def _boundary(function):
    """Preserve D-01 reason codes while exposing one D-02 error boundary."""
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except SnapshotError:
            raise
        except MemoryError as error:
            raise SnapshotError(error.reason, error.details) from None
    return guarded


def _identifier(value):
    _text(value)
    _scan(value)
    return value


def _digest(value):
    if type(value) is not str or re.fullmatch(r"[a-f0-9]{64}", value) is None:
        raise SnapshotError("INVALID_LEARNING_HASH")
    return value


def _freeze(value):
    if type(value) is dict:
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if type(value) is list:
        return tuple(_freeze(x) for x in value)
    return value


@dataclass(frozen=True)
class SessionMemorySnapshot:
    snapshot_id: str
    session_id: str
    scope: Mapping
    base_sources: tuple
    source_hashes: tuple
    catalog_hash: str
    created_at: datetime
    content_hash: str


@dataclass(frozen=True)
class TaskLearningSnapshot:
    snapshot_id: str
    session_id: str
    task_id: str
    run_id: str
    task_revision_id: str
    scope: Mapping
    session_snapshot_hash: str
    source_versions: tuple
    blocked_sources: tuple
    instruction_versions: tuple
    catalog_hash: str
    revision_authorization: Mapping | None
    created_at: datetime
    content_hash: str


def _decode(raw, kind):
    body = json.loads(raw)
    body["created_at"] = datetime.fromisoformat(body["created_at"])
    return kind(**{key: _freeze(value) for key, value in body.items()})


def _make(body, prefix):
    value = dict(body)
    value["snapshot_id"] = prefix + _hash(value)
    value["content_hash"] = _hash(value)
    return _canonical(value)


def _reference(value, kinds):
    if type(value) is not dict:
        raise SnapshotError("INVALID_LEARNING_SOURCE")
    _scan(value)
    _identifier(value.get("source_id"))
    if type(value.get("kind")) is not str or value["kind"] not in kinds:
        raise SnapshotError("INVALID_LEARNING_SOURCE")
    if type(value.get("version")) is not int or value["version"] < 1:
        raise SnapshotError("INVALID_LEARNING_SOURCE")
    _digest(value.get("content_hash"))


def _validate_bases(references):
    if type(references) not in (tuple, list):
        raise SnapshotError("SESSION_SOURCES_REQUIRED")
    checked, seen = [], set()
    for reference in references:
        _reference(reference, _BASE_KINDS)
        if set(reference) != _REF_FIELDS:
            raise SnapshotError("INVALID_LEARNING_SOURCE")
        identity = (reference["kind"], reference["source_id"])
        if identity in seen:
            raise SnapshotError("LEARNING_SOURCE_CONFLICT")
        seen.add(identity)
        checked.append(dict(reference))
    if {x["kind"] for x in checked} != _BASE_KINDS:
        raise SnapshotError("SESSION_SOURCES_REQUIRED")
    for kind in _BASE_KINDS - {"PROJECT_INSTRUCTION"}:
        if sum(x["kind"] == kind for x in checked) != 1:
            raise SnapshotError("SESSION_SOURCES_REQUIRED")
    return sorted(checked, key=lambda x: (x["kind"], x["source_id"], x["version"]))


def _validate_sources(records, scope):
    if type(records) not in (list, tuple):
        raise SnapshotError("INVALID_LEARNING_SOURCE")
    checked, seen = [], set()
    key = _scope_key(scope)
    for value in records:
        _reference(value, _KINDS)
        if set(value) != _SOURCE_FIELDS:
            raise SnapshotError("INVALID_LEARNING_SOURCE")
        source_scope = MemoryScope(value["user_id"], value["scope"], value["project_id"])
        source_key = _scope_key(source_scope)
        if source_key != key and source_key != (scope.user_id, "user", None):
            raise SnapshotError("LEARNING_SCOPE_DENIED")
        if (type(value["status"]) is not str or value["status"] not in _STATUSES
                or type(value["source_status"]) is not str or value["source_status"] not in _SOURCE_STATUSES):
            raise SnapshotError("INVALID_LEARNING_SOURCE")
        identity = (source_key, value["kind"], value["source_id"], value["version"])
        if identity in seen:
            raise SnapshotError("LEARNING_SOURCE_CONFLICT")
        seen.add(identity)
        record = dict(value)
        metadata = (value["activation_id"], value["activation_actor"], value["activated_at"])
        if any(x is not None for x in metadata):
            if any(x is None for x in metadata):
                raise SnapshotError("INVALID_LEARNING_ACTIVATION")
            _identifier(value["activation_id"])
            _identifier(value["activation_actor"])
            record["activated_at"] = _time(value["activated_at"])
        checked.append(record)
    return sorted(checked, key=_canonical)


def _select_sources(records, now):
    latest = {}
    for value in records:
        key = (value["scope"], value["project_id"], value["kind"], value["source_id"])
        latest[key] = max(latest.get(key, 0), value["version"])
    accepted, blocked = [], []
    for value in records:
        key = (value["scope"], value["project_id"], value["kind"], value["source_id"])
        if value["version"] != latest[key]:
            reason = "LEARNING_SUPERSEDED_VERSION"
        elif value["source_status"] != "ACTIVE":
            reason = "LEARNING_SOURCE_" + value["source_status"]
        elif value["status"] != "ACTIVE":
            reason = "LEARNING_" + value["status"]
        elif value["activated_at"] is None:
            reason = "LEARNING_NOT_APPROVED"
        elif datetime.fromisoformat(value["activated_at"]) > now:
            reason = "LEARNING_ACTIVATION_FUTURE"
        else:
            accepted.append(value)
            continue
        blocked.append(dict(source_id=value["source_id"], version=value["version"],
                            content_hash=value["content_hash"], reason=reason))
    return accepted, sorted(blocked, key=_canonical)


class LearningSnapshotRepository:
    """One trusted host, serialized publications/creation, immutable JSON records.

    Catalog publication and revision authorization are deliberately host-only.
    The public DTOs are not capabilities; mutations to them cannot edit the
    repository. Existing snapshot reads/resumes never consult the live catalog.
    """

    def __init__(self):
        self._lock = RLock()
        self._catalogs = {}
        self._source_hashes = {}
        self._base_hashes = {}
        self._sessions = {}
        self._runs = {}
        self._tasks = {}
        self._authorizations = {}
        self._requests = set()

    @_boundary
    def publish(self, scope, *, base_sources, sources, now):
        now = _time(now)
        key = _scope_key(scope)
        base = _validate_bases(base_sources)
        learning = _validate_sources(sources, scope)
        body = dict(scope=to_primitive(scope), base_sources=base, sources=learning, observed_at=now)
        body["content_hash"] = _hash(body)
        raw = _canonical(body)
        with self._lock:
            previous = self._catalogs.get(key)
            if previous:
                old = json.loads(previous)
                previous_time = datetime.fromisoformat(old["observed_at"])
                if now < previous_time:
                    raise SnapshotError("LEARNING_CATALOG_STALE")
                if now == previous_time and raw != previous:
                    raise SnapshotError("LEARNING_CATALOG_CONFLICT")
            bindings = {}
            base_bindings = {}
            for reference in base:
                identity = (key, reference["kind"], reference["source_id"], reference["version"])
                if identity in self._base_hashes and self._base_hashes[identity] != reference["content_hash"]:
                    raise SnapshotError("LEARNING_SOURCE_CONFLICT")
                base_bindings[identity] = reference["content_hash"]
            for record in learning:
                identity = ((record["user_id"], record["scope"], record["project_id"]),
                            record["kind"], record["source_id"], record["version"])
                if identity in self._source_hashes and self._source_hashes[identity] != record["content_hash"]:
                    raise SnapshotError("LEARNING_SOURCE_CONFLICT")
                bindings[identity] = record["content_hash"]
            # Commit only after every record and collision check succeeds.
            self._source_hashes.update(bindings)
            self._base_hashes.update(base_bindings)
            self._catalogs[key] = raw
        return body["content_hash"]

    def _catalog(self, key, now):
        if key not in self._catalogs:
            raise SnapshotError("SESSION_SOURCES_REQUIRED")
        result = json.loads(self._catalogs[key])
        if datetime.fromisoformat(result["observed_at"]) > now:
            raise SnapshotError("INVALID_MEMORY_TIME")
        return result

    def _request(self, key, request_id):
        _identifier(request_id)
        identity = (key, request_id)
        if identity in self._requests:
            raise SnapshotError("REQUEST_REPLAY")
        return identity

    @_boundary
    def create_session(self, session_id, scope, *, now, request_id):
        now = _time(now)
        key = _scope_key(scope)
        _identifier(session_id)
        with self._lock:
            request = self._request(key, request_id)
            if (key, session_id) in self._sessions:
                raise SnapshotError("LEARNING_SNAPSHOT_EXISTS")
            catalog = self._catalog(key, now)
            refs = catalog["base_sources"]
            raw = _make(dict(session_id=session_id, scope=to_primitive(scope), base_sources=refs,
                             source_hashes=[dict(source_id=x["source_id"], kind=x["kind"], version=x["version"],
                                                content_hash=x["content_hash"]) for x in refs],
                             catalog_hash=catalog["content_hash"], created_at=now), "session-learning-")
            self._sessions[(key, session_id)] = raw
            self._requests.add(request)
            return _decode(raw, SessionMemorySnapshot)

    @_boundary
    def get_session(self, session_id, scope):
        key = _scope_key(scope)
        _identifier(session_id)
        with self._lock:
            raw = self._sessions.get((key, session_id))
            if raw is None:
                raise SnapshotError("LEARNING_SNAPSHOT_NOT_FOUND")
            return _decode(raw, SessionMemorySnapshot)

    @_boundary
    def authorize_revision(self, session_id, task_id, from_revision_id, to_revision_id, scope, *, actor, now, expires_at):
        key = _scope_key(scope)
        for item in (session_id, task_id, from_revision_id, to_revision_id, actor):
            _identifier(item)
        now, expiry = _time(now), _time(expires_at)
        if expiry <= now or from_revision_id == to_revision_id:
            raise SnapshotError("INVALID_LEARNING_AUTHORIZATION")
        with self._lock:
            current = self._tasks.get((key, task_id))
            if current is None or current[0] != session_id or current[1] != from_revision_id:
                raise SnapshotError("LEARNING_REVISION_AUTHORIZATION_REQUIRED")
            if now < current[3]:
                raise SnapshotError("INVALID_MEMORY_TIME")
            identity = (key, session_id, task_id, to_revision_id)
            body = dict(session_id=session_id, task_id=task_id, from_revision_id=from_revision_id,
                        to_revision_id=to_revision_id, scope=to_primitive(scope), actor=actor, issued_at=now, expires_at=expiry)
            body["authorization_id"] = _hash(body)
            raw = _canonical(body)
            if identity in self._authorizations and self._authorizations[identity] != raw:
                raise SnapshotError("LEARNING_AUTHORIZATION_CONFLICT")
            self._authorizations[identity] = raw
            return body["authorization_id"]

    @_boundary
    def create_task_run(self, session_id, task_id, run_id, task_revision_id, scope, *, now, request_id):
        now = _time(now)
        key = _scope_key(scope)
        for item in (session_id, task_id, run_id, task_revision_id):
            _identifier(item)
        with self._lock:
            request = self._request(key, request_id)
            if (key, run_id) in self._runs:
                raise SnapshotError("LEARNING_SNAPSHOT_EXISTS")
            session = self.get_session(session_id, scope)
            if session.created_at > now:
                raise SnapshotError("INVALID_MEMORY_TIME")
            catalog = self._catalog(key, now)
            current = self._tasks.get((key, task_id))
            authorization = None
            revisions = frozenset()
            if current is not None:
                if current[0] != session_id:
                    raise SnapshotError("LEARNING_SNAPSHOT_MISMATCH")
                if now < current[3]:
                    raise SnapshotError("INVALID_MEMORY_TIME")
                revisions = current[2]
                if current[1] == task_revision_id and current[4] is not None:
                    authorization = json.loads(current[4])
                if current[1] != task_revision_id:
                    if task_revision_id in revisions:
                        raise SnapshotError("LEARNING_TASK_REVISION_STALE")
                    raw_auth = self._authorizations.get((key, session_id, task_id, task_revision_id))
                    if raw_auth is None:
                        raise SnapshotError("LEARNING_REVISION_AUTHORIZATION_REQUIRED")
                    authorization = json.loads(raw_auth)
                    if (authorization["from_revision_id"] != current[1]
                            or not datetime.fromisoformat(authorization["issued_at"]) <= now
                            < datetime.fromisoformat(authorization["expires_at"])):
                        raise SnapshotError("LEARNING_REVISION_AUTHORIZATION_REQUIRED")
            accepted, blocked = _select_sources(catalog["sources"], now)
            raw = _make(dict(session_id=session_id, task_id=task_id, run_id=run_id, task_revision_id=task_revision_id,
                             scope=to_primitive(scope), session_snapshot_hash=session.content_hash,
                             source_versions=accepted, blocked_sources=blocked,
                             instruction_versions=[x for x in catalog["base_sources"] if x["kind"] == "PROJECT_INSTRUCTION"],
                             catalog_hash=catalog["content_hash"], revision_authorization=authorization, created_at=now),
                        "task-learning-")
            self._runs[(key, run_id)] = raw
            self._tasks[(key, task_id)] = (
                session_id, task_revision_id, revisions | {task_revision_id}, now,
                _canonical(authorization) if authorization is not None else None,
            )
            self._requests.add(request)
            return _decode(raw, TaskLearningSnapshot)

    @_boundary
    def get_task_run(self, session_id, task_id, run_id, scope):
        key = _scope_key(scope)
        for item in (session_id, task_id, run_id):
            _identifier(item)
        with self._lock:
            raw = self._runs.get((key, run_id))
            if raw is None:
                raise SnapshotError("LEARNING_SNAPSHOT_NOT_FOUND")
            result = _decode(raw, TaskLearningSnapshot)
            if result.session_id != session_id or result.task_id != task_id:
                raise SnapshotError("LEARNING_SNAPSHOT_MISMATCH")
            return result

    @_boundary
    def resume_task_run(self, session_id, task_id, run_id, scope, *, expected_hash):
        _digest(expected_hash)
        result = self.get_task_run(session_id, task_id, run_id, scope)
        if result.content_hash != expected_hash:
            raise SnapshotError("LEARNING_SNAPSHOT_MISMATCH")
        return result
