"""C30R2 session-scoped durable owner repository.

PostgreSQL uses DB wall time, transaction advisory guards and row CAS.
SQLite exercises portable SQL locally, NOT PostgreSQL lock/restart acceptance.
No owner export/restore, authentication, engine creation or session commit here.
"""
from __future__ import annotations

from dataclasses import dataclass, fields
from datetime import datetime, timezone
from hashlib import sha256
import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session


_CODES = frozenset(("OWNER_INPUT_INVALID", "OWNER_HASH_MISMATCH", "OWNER_NOT_CURRENT",
    "OWNER_REVOKED", "OWNER_EXPIRED", "STALE_FENCING_TOKEN", "OWNER_VERSION_CONFLICT",
    "PRINCIPAL_BINDING_MISMATCH", "RECEIPT_REPLAY_CONFLICT", "OWNER_COMPONENT_MISSING",
    "OWNER_RESTART_UNVERIFIED", "TRANSACTION_REQUIRED"))


class OwnerContractError(ValueError):
    def __init__(self, code):
        self.code = code if type(code) is str and code in _CODES else "OWNER_INPUT_INVALID"
        super().__init__(self.code)


def _deny(code="OWNER_INPUT_INVALID"):
    raise OwnerContractError(code)


@dataclass(frozen=True, slots=True)
class OwnerBinding:
    project_id: str
    environment_id: str
    session_id: str
    assignment_id: str
    generation: int
    actor_id: str
    context_id: str
    workspace_id: str
    baseline_hash: str
    target_hash: str
    assignment_hash: str
    execution_fence: str
    write_fence: str | None


@dataclass(frozen=True, slots=True)
class OwnerComponent:
    kind: str
    schema_version: int
    canonical_json: str
    content_hash: str


@dataclass(frozen=True, slots=True)
class PrincipalMapping:
    binding: OwnerBinding
    auth_session_hash: str
    auth_generation: int
    principal_actor_id: str
    principal_role: str
    permissions: tuple[str, ...]
    issued_at: datetime
    expires_at: datetime
    mapping_hash: str


@dataclass(frozen=True, slots=True)
class OwnerSnapshot:
    binding: OwnerBinding
    owner_version: int
    policy: OwnerComponent
    results: OwnerComponent
    team: OwnerComponent
    moa: OwnerComponent | None
    principal_mappings: tuple[PrincipalMapping, ...]
    created_at: datetime
    expires_at: datetime
    content_hash: str


@dataclass(frozen=True, slots=True)
class ProjectionReceipt:
    receipt_id: str
    request_id: str
    request_hash: str
    binding: OwnerBinding
    owner_version: int
    owner_snapshot_hash: str
    principal_mapping_hash: str
    menu: str
    response_json: str
    response_hash: str
    created_at: datetime
    content_hash: str


@dataclass(frozen=True, slots=True)
class RevocationReceipt:
    binding: OwnerBinding
    revoked_through_generation: int
    owner_version: int
    revoked_at: datetime
    reason: str
    request_id: str
    request_hash: str
    content_hash: str


_TYPES = (OwnerBinding, OwnerComponent, PrincipalMapping, OwnerSnapshot, ProjectionReceipt, RevocationReceipt)
_DATES = frozenset(("issued_at", "created_at", "expires_at", "revoked_at"))
_INTS = frozenset(("generation", "owner_version", "auth_generation", "schema_version", "revoked_through_generation"))
_COMPONENTS = {"policy": "ROLE_POLICY", "results": "ROLE_RESULTS", "team": "TEAM", "moa": "MOA"}
_IDENTITY = ("project_id", "environment_id", "session_id", "assignment_id")


def _id(value):
    if type(value) is not str or not value or value.strip() != value:
        _deny()
    try:
        if len(value.encode("utf-8")) > 128 or any(ord(c) < 32 for c in value):
            _deny()
    except UnicodeError:
        _deny()
    return value


def _integer(value, *, zero=False):
    if type(value) is not int or value < (0 if zero else 1) or value > 2**63-1:
        _deny()
    return value


def _hash(value):
    if type(value) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", value) is None:
        _deny()
    return value


def _time(value):
    if type(value) is not datetime or value.tzinfo is not timezone.utc:
        _deny()
    return datetime(value.year, value.month, value.day, value.hour, value.minute,
                    value.second, value.microsecond, tzinfo=timezone.utc)


def _json(value, maximum=1048576):
    if type(value) is not str:
        _deny()
    try:
        if len(value.encode("utf-8")) > maximum:
            _deny()
        def pairs(items):
            data = {}
            for key, val in items:
                if key in data:
                    _deny()
                data[key] = val
            return data
        def nonfinite(_):
            _deny()
        data = json.loads(value, object_pairs_hook=pairs, parse_constant=nonfinite)
        pending = [(data, 0)]
        count = 0
        while pending:
            item, depth = pending.pop()
            count += 1
            if depth > 24 or count > 20000:
                _deny()
            if type(item) is dict:
                pending.extend((v, depth+1) for v in item.values())
            elif type(item) is list:
                pending.extend((v, depth+1) for v in item)
        if _dump(data) != value:
            _deny()
        return data
    except (ValueError, TypeError, UnicodeError, RecursionError):
        _deny()


def _dump(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _digest(value):
    return "sha256:" + sha256(value.encode("utf-8")).hexdigest()


def _plain(value):
    # Internal only: called on exact-type validated detached values.
    if type(value) in _TYPES:
        return {f.name: _plain(getattr(value, f.name)) for f in fields(type(value))}
    if type(value) is tuple:
        return [_plain(v) for v in value]
    if type(value) is datetime:
        return value.isoformat(timespec="microseconds")
    return value


def _seal(value, hash_field="content_hash"):
    data = _plain(value)
    del data[hash_field]
    return _digest(_dump(data))


def _copy(value, cls):
    if type(value) is not cls:
        _deny("OWNER_COMPONENT_MISSING" if cls is OwnerComponent and value is None else "OWNER_INPUT_INVALID")
    values = {}
    for f in fields(cls):
        try:
            v = object.__getattribute__(value, f.name)
        except AttributeError:
            _deny()
        name = f.name
        if name == "binding":
            v = _copy(v, OwnerBinding)
        elif name in _COMPONENTS:
            v = None if name == "moa" and v is None else _copy(v, OwnerComponent)
            if v is not None and v.kind != _COMPONENTS[name]:
                _deny("OWNER_COMPONENT_MISSING")
        elif name == "principal_mappings":
            if type(v) is not tuple or len(v) > 64:
                _deny()
            v = tuple(_copy(p, PrincipalMapping) for p in v)
        elif name == "permissions":
            if type(v) is not tuple or len(v) > 32:
                _deny()
            v = tuple(_id(p) for p in v)
            if tuple(sorted(set(v))) != v:
                _deny()
        elif name in _DATES:
            v = _time(v)
        elif name in _INTS:
            v = _integer(v)
        elif name.endswith("_hash"):
            v = _hash(v)
        elif name in ("canonical_json", "response_json"):
            _json(v, 262144 if name == "canonical_json" else 65536)
        elif name == "write_fence" and v is None:
            pass
        else:
            v = _id(v)
        values[name] = v
    result = cls(**values)
    if cls is OwnerComponent:
        if result.kind not in _COMPONENTS.values() or result.schema_version != 1:
            _deny("OWNER_RESTART_UNVERIFIED")
        expected = _digest(result.canonical_json)
    elif cls is PrincipalMapping:
        if result.principal_actor_id != result.binding.actor_id or "tasks:read" not in result.permissions:
            _deny("PRINCIPAL_BINDING_MISMATCH")
        if result.issued_at >= result.expires_at:
            _deny()
        expected = _seal(result, "mapping_hash")
    elif cls is OwnerSnapshot:
        if result.created_at >= result.expires_at:
            _deny()
        hashes = tuple(p.mapping_hash for p in result.principal_mappings)
        if hashes != tuple(sorted(set(hashes))):
            _deny()
        for principal in result.principal_mappings:
            if principal.binding != result.binding or principal.expires_at > result.expires_at:
                _deny("PRINCIPAL_BINDING_MISMATCH")
        expected = _seal(result)
        if len(_dump(_plain(result)).encode("utf-8")) > 1048576:
            _deny()
    elif cls is ProjectionReceipt:
        if result.menu not in ("team", "moa", "sns", "adapters"):
            _deny()
        if result.response_hash != _digest(result.response_json):
            _deny("OWNER_HASH_MISMATCH")
        expected = _seal(result)
    elif cls is RevocationReceipt:
        if result.reason not in ("OWNER_REVOKED", "ASSIGNMENT_SUPERSEDED", "SESSION_REVOKED"):
            _deny()
        expected = _seal(result)
    else:
        return result
    actual = result.mapping_hash if cls is PrincipalMapping else result.content_hash
    if actual != expected:
        _deny("OWNER_HASH_MISMATCH")
    return result


def _decode(raw, cls):
    data = _json(raw)
    def convert(value, target):
        if type(value) is not dict or set(value) != {f.name for f in fields(target)}:
            _deny("OWNER_RESTART_UNVERIFIED")
        copied = dict(value)
        for name, item in value.items():
            if name == "binding":
                copied[name] = convert(item, OwnerBinding)
            elif name in _COMPONENTS:
                copied[name] = None if name == "moa" and item is None else convert(item, OwnerComponent)
            elif name == "principal_mappings":
                if type(item) is not list:
                    _deny()
                copied[name] = tuple(convert(p, PrincipalMapping) for p in item)
            elif name == "permissions":
                if type(item) is not list:
                    _deny()
                copied[name] = tuple(item)
            elif name in _DATES:
                if type(item) is not str:
                    _deny()
                try:
                    copied[name] = datetime.fromisoformat(item)
                except ValueError:
                    _deny()
        return _copy(target(**copied), target)
    return convert(data, cls)


def _key(binding):
    return _digest(_dump({key: getattr(binding, key) for key in _IDENTITY}))


class SqlAlchemyAgentTeamOwnerRepository:
    """Caller transaction owns all commits; host-only input, no authentication mint."""

    @staticmethod
    def _open(session, key):
        if not isinstance(session, Session) or not session.in_transaction():
            _deny("TRANSACTION_REQUIRED")
        dialect = session.get_bind().dialect.name
        if dialect not in ("postgresql", "sqlite"):
            _deny("TRANSACTION_REQUIRED")
        if dialect == "sqlite" and not session.connection().connection.driver_connection.in_transaction:
            _deny("TRANSACTION_REQUIRED")
        if dialect == "postgresql":
            session.execute(text("SELECT pg_advisory_xact_lock_shared(17015001)"))
            signed = int(key[7:23], 16)
            if signed >= 2**63:
                signed -= 2**64
            session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": signed})
        return dialect

    @staticmethod
    def _now(session):
        pg = session.get_bind().dialect.name == "postgresql"
        value = session.execute(text("SELECT clock_timestamp()" if pg else "SELECT CURRENT_TIMESTAMP")).scalar_one()
        if type(value) is str:
            value = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        if type(value) is not datetime:
            _deny()
        return value.astimezone(timezone.utc)

    @staticmethod
    def _row(session, key):
        suffix = " FOR UPDATE" if session.get_bind().dialect.name == "postgresql" else ""
        return session.execute(text("SELECT * FROM agent_owner_heads WHERE scope_key=:key"+suffix), {"key":key}).mappings().one_or_none()

    @staticmethod
    def _stored(row):
        snapshot = _decode(row["snapshot_json"], OwnerSnapshot)
        if row["scope_key"] != _key(snapshot.binding) or row["snapshot_hash"] != snapshot.content_hash:
            _deny("OWNER_HASH_MISMATCH")
        if row["generation"] != snapshot.binding.generation or any(row[k] != getattr(snapshot.binding,k) for k in _IDENTITY):
            _deny("OWNER_HASH_MISMATCH")
        expected_version = snapshot.owner_version + (1 if row["revoked_through"] == row["generation"] else 0)
        if row["owner_version"] != expected_version:
            _deny("OWNER_HASH_MISMATCH")
        return snapshot

    def _current(self, session, row, binding, principal=None, expected_version=None):
        snapshot = self._stored(row)
        if binding.generation <= row["revoked_through"]:
            _deny("OWNER_REVOKED")
        if snapshot.binding.execution_fence != binding.execution_fence or snapshot.binding.write_fence != binding.write_fence:
            _deny("STALE_FENCING_TOKEN")
        if snapshot.binding != binding:
            _deny("OWNER_NOT_CURRENT")
        if expected_version is not None and expected_version != row["owner_version"]:
            _deny("OWNER_VERSION_CONFLICT")
        now = self._now(session)
        if not snapshot.created_at <= now < snapshot.expires_at:
            _deny("OWNER_EXPIRED")
        if principal is not None:
            if principal not in snapshot.principal_mappings or principal.binding != binding:
                _deny("PRINCIPAL_BINDING_MISMATCH")
            if not principal.issued_at <= now < principal.expires_at:
                _deny("OWNER_EXPIRED")
        return snapshot

    @staticmethod
    def _request(session, key, request_id):
        return session.execute(text("SELECT * FROM agent_owner_requests WHERE scope_key=:key AND request_id=:request"),
                               {"key":key,"request":request_id}).mappings().one_or_none()

    @staticmethod
    def _replay(row, operation, request_hash, cls):
        if row["operation"] != operation or row["request_hash"] != request_hash:
            _deny("RECEIPT_REPLAY_CONFLICT")
        return _decode(row["response_json"], cls)

    @staticmethod
    def _publish_request(session, key, request_id, operation, request_hash, result, receipt_id=None):
        session.execute(text("INSERT INTO agent_owner_requests (scope_key,request_id,operation,request_hash,receipt_id,response_json) "
            "VALUES (:key,:request,:operation,:hash,:receipt,:response)"),
            {"key":key,"request":request_id,"operation":operation,"hash":request_hash,
             "receipt":receipt_id,"response":_dump(_plain(result))})

    def save_owner_snapshot(self, session, *, snapshot, expected_version, request_id):
        snapshot = _copy(snapshot, OwnerSnapshot)
        _integer(expected_version, zero=True); _id(request_id)
        key = _key(snapshot.binding)
        request_hash = _digest(_dump({"snapshot":_plain(snapshot),"expected_version":expected_version}))
        self._open(session, key)
        with session.begin_nested():
            row = self._row(session, key)
            prior = self._request(session, key, request_id)
            if prior is not None:
                result = self._replay(prior, "SNAPSHOT", request_hash, OwnerSnapshot)
                if row is None:
                    _deny("OWNER_NOT_CURRENT")
                current = self._current(session, row, result.binding)
                if current != result or row["owner_version"] != result.owner_version:
                    _deny("OWNER_NOT_CURRENT")
                return result
            if snapshot.owner_version != expected_version+1:
                _deny("OWNER_VERSION_CONFLICT")
            if row is None:
                if expected_version != 0 or snapshot.binding.generation != 1:
                    _deny("OWNER_VERSION_CONFLICT")
                revoked = 0
            else:
                old = self._stored(row)
                if row["owner_version"] != expected_version:
                    _deny("OWNER_VERSION_CONFLICT")
                delta = snapshot.binding.generation - row["generation"]
                if delta == 0:
                    self._current(session, row, snapshot.binding)
                    if old.binding != snapshot.binding:
                        _deny("OWNER_NOT_CURRENT")
                elif delta != 1:
                    _deny("OWNER_NOT_CURRENT")
                revoked = row["revoked_through"]
            now = self._now(session)
            if not snapshot.created_at <= now < snapshot.expires_at:
                _deny("OWNER_EXPIRED")
            for principal in snapshot.principal_mappings:
                if not principal.issued_at <= now < principal.expires_at:
                    _deny("OWNER_EXPIRED")
            params = dict(key=key, generation=snapshot.binding.generation,
                version=snapshot.owner_version, revoked=revoked, hash=snapshot.content_hash,
                payload=_dump(_plain(snapshot)))
            if row is None:
                params.update({k:getattr(snapshot.binding,k) for k in _IDENTITY})
                session.execute(text("INSERT INTO agent_owner_heads "
                    "(scope_key,project_id,environment_id,session_id,assignment_id,generation,owner_version,revoked_through,snapshot_hash,snapshot_json) "
                    "VALUES (:key,:project_id,:environment_id,:session_id,:assignment_id,:generation,:version,:revoked,:hash,:payload)"), params)
            else:
                params["expected"] = expected_version
                changed = session.execute(text("UPDATE agent_owner_heads SET generation=:generation, owner_version=:version, "
                    "snapshot_hash=:hash,snapshot_json=:payload WHERE scope_key=:key AND owner_version=:expected"), params)
                if changed.rowcount != 1:
                    _deny("OWNER_VERSION_CONFLICT")
            session.execute(text("INSERT INTO agent_owner_history (scope_key,owner_version,snapshot_hash,snapshot_json) "
                "VALUES (:key,:version,:hash,:payload)"), params)
            self._publish_request(session,key,request_id,"SNAPSHOT",request_hash,snapshot)
            return _copy(snapshot, OwnerSnapshot)

    def load_current_owner(self, session, *, binding, principal, expected_version=None):
        binding = _copy(binding, OwnerBinding); principal = _copy(principal, PrincipalMapping)
        if expected_version is not None:
            _integer(expected_version)
        key = _key(binding); self._open(session,key)
        row = self._row(session,key)
        return None if row is None else self._current(session,row,binding,principal,expected_version)

    def revoke_generation(self, session, *, binding, expected_version, request_id, reason):
        binding = _copy(binding, OwnerBinding); _integer(expected_version); _id(request_id); _id(reason)
        if reason not in ("OWNER_REVOKED","ASSIGNMENT_SUPERSEDED","SESSION_REVOKED"):
            _deny()
        key = _key(binding)
        request_hash = _digest(_dump({"binding":_plain(binding),"expected_version":expected_version,"reason":reason}))
        self._open(session,key)
        with session.begin_nested():
            row = self._row(session,key)
            if row is None:
                _deny("OWNER_NOT_CURRENT")
            old = self._stored(row)
            prior = self._request(session,key,request_id)
            if prior is not None:
                result = self._replay(prior,"REVOKE",request_hash,RevocationReceipt)
                if old.binding != binding or row["revoked_through"] != binding.generation or row["owner_version"] != result.owner_version:
                    _deny("OWNER_NOT_CURRENT")
                return result
            if old.binding != binding:
                _deny("OWNER_NOT_CURRENT")
            if row["owner_version"] != expected_version:
                _deny("OWNER_VERSION_CONFLICT")
            if binding.generation <= row["revoked_through"]:
                _deny("OWNER_REVOKED")
            result = RevocationReceipt(binding,binding.generation,expected_version+1,self._now(session),reason,request_id,request_hash,"")
            result = RevocationReceipt(*[_seal(result) if f.name=="content_hash" else getattr(result,f.name) for f in fields(RevocationReceipt)])
            changed = session.execute(text("UPDATE agent_owner_heads SET owner_version=:version,revoked_through=:generation "
                "WHERE scope_key=:key AND owner_version=:expected"),
                {"version":expected_version+1,"generation":binding.generation,"key":key,"expected":expected_version})
            if changed.rowcount != 1:
                _deny("OWNER_VERSION_CONFLICT")
            self._publish_request(session,key,request_id,"REVOKE",request_hash,result)
            return _copy(result,RevocationReceipt)

    def save_receipt(self, session, *, binding, principal, receipt, expected_version):
        binding = _copy(binding,OwnerBinding); principal = _copy(principal,PrincipalMapping)
        receipt = _copy(receipt,ProjectionReceipt); _integer(expected_version)
        key = _key(binding); self._open(session,key)
        with session.begin_nested():
            row = self._row(session,key)
            if row is None:
                _deny("OWNER_NOT_CURRENT")
            current = self._current(session,row,binding,principal,expected_version)
            self._receipt_current(session,receipt,current,principal)
            prior = self._request(session,key,receipt.request_id)
            if prior is not None:
                return self._replay(prior,"RECEIPT",receipt.content_hash,ProjectionReceipt)
            duplicate = session.execute(text("SELECT request_id FROM agent_owner_requests WHERE scope_key=:key AND receipt_id=:receipt"),
                {"key":key,"receipt":receipt.receipt_id}).first()
            if duplicate:
                _deny("RECEIPT_REPLAY_CONFLICT")
            self._publish_request(session,key,receipt.request_id,"RECEIPT",receipt.content_hash,receipt,receipt.receipt_id)
            return _copy(receipt,ProjectionReceipt)

    def _receipt_current(self, session, receipt, current, principal):
        if receipt.binding != current.binding or receipt.owner_version != current.owner_version or receipt.owner_snapshot_hash != current.content_hash:
            _deny("OWNER_NOT_CURRENT")
        if receipt.principal_mapping_hash != principal.mapping_hash:
            _deny("PRINCIPAL_BINDING_MISMATCH")
        if not max(current.created_at,principal.issued_at) <= receipt.created_at <= self._now(session):
            _deny("OWNER_EXPIRED")

    def load_receipt(self, session, *, binding, principal, request_id):
        binding = _copy(binding,OwnerBinding); principal = _copy(principal,PrincipalMapping); _id(request_id)
        key = _key(binding); self._open(session,key)
        row = self._row(session,key)
        if row is None:
            return None
        current = self._current(session,row,binding,principal)
        prior = self._request(session,key,request_id)
        if prior is None:
            return None
        if prior["operation"] != "RECEIPT":
            _deny("RECEIPT_REPLAY_CONFLICT")
        receipt = _decode(prior["response_json"],ProjectionReceipt)
        if receipt.content_hash != prior["request_hash"] or receipt.request_id != request_id or receipt.receipt_id != prior["receipt_id"]:
            _deny("OWNER_HASH_MISMATCH")
        self._receipt_current(session,receipt,current,principal)
        return receipt
