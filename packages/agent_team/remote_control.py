"""Framework-free remote monitoring and operator control primitives.

This module is deliberately transport agnostic.  It provides the domain
rules a Web Console/PWA adapter can use later, but performs no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum


def _text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


def _canonical_cursor(sequence: int) -> str:
    return str(sequence)


def _parse_cursor(cursor: str) -> int:
    _text(cursor, "cursor")
    if cursor == "0":
        return 0
    if not cursor.isdecimal() or cursor.startswith("0"):
        raise ValueError("cursor must be a canonical decimal sequence")
    return int(cursor)


class CommandKind(str, Enum):
    PAUSE = "pause"
    RESUME = "resume"
    REQUEST_STATUS = "request-status"
    MERGE = "merge"
    DEPLOY = "deploy"
    DELETE = "delete"
    CHANGE_PERMISSIONS = "change-permissions"
    CHANGE_PROVIDER_CREDENTIALS = "change-provider-credentials"


class ApprovalState(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


APPROVAL_REQUIRED = frozenset({
    CommandKind.MERGE, CommandKind.DEPLOY, CommandKind.DELETE,
    CommandKind.CHANGE_PERMISSIONS, CommandKind.CHANGE_PROVIDER_CREDENTIALS,
})
LOW_RISK = frozenset({CommandKind.PAUSE, CommandKind.RESUME, CommandKind.REQUEST_STATUS})


@dataclass(frozen=True, slots=True)
class RemoteSession:
    session_id: str
    operator_id: str
    authenticated_until: datetime
    created_at: datetime

    def __post_init__(self) -> None:
        _text(self.session_id, "session_id")
        _text(self.operator_id, "operator_id")
        _utc(self.authenticated_until, "authenticated_until")
        _utc(self.created_at, "created_at")
        if self.authenticated_until <= self.created_at:
            raise ValueError("authenticated_until must be after created_at")

    def is_authenticated(self, now: datetime) -> bool:
        _utc(now, "now")
        return now < self.authenticated_until


@dataclass(frozen=True, slots=True)
class AgentStatusSnapshot:
    agent_id: str
    status: str
    sequence: int
    cursor: str
    observed_at: datetime
    details: tuple[tuple[str, str], ...] = ()

    def __post_init__(self) -> None:
        _text(self.agent_id, "agent_id")
        _text(self.status, "status")
        if type(self.sequence) is not int or self.sequence < 1:
            raise ValueError("sequence must be a positive integer")
        if self.cursor != _canonical_cursor(self.sequence):
            raise ValueError("cursor must match sequence in canonical form")
        _utc(self.observed_at, "observed_at")


@dataclass(frozen=True, slots=True)
class ProgressEvent:
    event_id: str
    event_type: str
    sequence: int
    cursor: str
    idempotency_key: str
    occurred_at: datetime
    payload: tuple[tuple[str, str], ...] = ()

    def __post_init__(self) -> None:
        for value, field in ((self.event_id, "event_id"), (self.event_type, "event_type"), (self.cursor, "cursor"), (self.idempotency_key, "idempotency_key")):
            _text(value, field)
        if type(self.sequence) is not int or self.sequence < 1:
            raise ValueError("sequence must be a positive integer")
        if self.cursor != _canonical_cursor(self.sequence):
            raise ValueError("cursor must match sequence in canonical form")
        _utc(self.occurred_at, "occurred_at")


@dataclass(frozen=True, slots=True)
class OperatorCommand:
    command_id: str
    operator_id: str
    kind: CommandKind
    issued_at: datetime
    expires_at: datetime
    idempotency_key: str
    auth_token: str
    parameters: tuple[tuple[str, str], ...] = ()

    def __post_init__(self) -> None:
        for value, field in ((self.command_id, "command_id"), (self.operator_id, "operator_id"), (self.idempotency_key, "idempotency_key"), (self.auth_token, "auth_token")):
            _text(value, field)
        if not isinstance(self.kind, CommandKind):
            raise TypeError("kind must be CommandKind")
        _utc(self.issued_at, "issued_at")
        _utc(self.expires_at, "expires_at")
        if self.expires_at <= self.issued_at:
            raise ValueError("expires_at must be after issued_at")


@dataclass(frozen=True, slots=True)
class ApprovalRequest:
    request_id: str
    command: OperatorCommand
    requested_by: str
    reason: str
    created_at: datetime
    state: ApprovalState = ApprovalState.PENDING

    def __post_init__(self) -> None:
        _text(self.request_id, "request_id")
        if not isinstance(self.command, OperatorCommand):
            raise TypeError("command must be OperatorCommand")
        _text(self.requested_by, "requested_by")
        _text(self.reason, "reason")
        _utc(self.created_at, "created_at")
        if not isinstance(self.state, ApprovalState):
            raise TypeError("state must be ApprovalState")


@dataclass(frozen=True, slots=True)
class AuditEvent:
    audit_id: str
    command_id: str
    operator_id: str
    action: str
    outcome: str
    recorded_at: datetime
    details: tuple[tuple[str, str], ...] = ()

    def __post_init__(self) -> None:
        for value, field in ((self.audit_id, "audit_id"), (self.command_id, "command_id"), (self.operator_id, "operator_id"), (self.action, "action"), (self.outcome, "outcome")):
            _text(value, field)
        _utc(self.recorded_at, "recorded_at")


class ApprovalRequired(PermissionError):
    def __init__(self, request: ApprovalRequest) -> None:
        self.request = request
        super().__init__(f"approval required for {request.command.kind.value}")


class RemoteControlPlane:
    """In-memory control plane with replay and command safety invariants."""

    def __init__(self, *, queue_limit: int = 100) -> None:
        if type(queue_limit) is not int or queue_limit < 1:
            raise ValueError("queue_limit must be a positive integer")
        self._operators: dict[str, tuple[str, datetime]] = {}
        self._sessions: dict[str, RemoteSession] = {}
        self._snapshots: dict[str, AgentStatusSnapshot] = {}
        self._events: tuple[ProgressEvent, ...] = ()
        self._event_keys: set[str] = set()
        self._commands: set[str] = set()
        self._audits: tuple[AuditEvent, ...] = ()
        self._approvals: tuple[ApprovalRequest, ...] = ()
        self._offline = OfflineQueue(queue_limit)

    @property
    def events(self) -> tuple[ProgressEvent, ...]: return self._events
    @property
    def audits(self) -> tuple[AuditEvent, ...]: return self._audits
    @property
    def approvals(self) -> tuple[ApprovalRequest, ...]: return self._approvals
    @property
    def snapshots(self) -> tuple[AgentStatusSnapshot, ...]: return tuple(self._snapshots.values())

    def register_operator(self, operator_id: str, auth_token: str, valid_until: datetime) -> None:
        _text(operator_id, "operator_id"); _text(auth_token, "auth_token"); _utc(valid_until, "valid_until")
        self._operators[operator_id] = (auth_token, valid_until)

    def open_session(self, session: RemoteSession, *, auth_token: str, now: datetime) -> RemoteSession:
        _utc(now, "now"); _text(auth_token, "auth_token")
        registered = self._operators.get(session.operator_id)
        if registered is None or registered[0] != auth_token or registered[1] <= now or not session.is_authenticated(now):
            raise PermissionError("operator authentication failed")
        self._sessions[session.session_id] = session
        return session

    def publish_snapshot(self, snapshot: AgentStatusSnapshot) -> AgentStatusSnapshot:
        previous = self._snapshots.get(snapshot.agent_id)
        if previous and snapshot.sequence <= previous.sequence:
            raise ValueError("snapshot sequence must increase")
        self._snapshots[snapshot.agent_id] = snapshot
        return snapshot

    def publish_event(self, event: ProgressEvent) -> ProgressEvent:
        if event.idempotency_key in self._event_keys:
            raise ValueError("duplicate event rejected")
        if self._events and event.sequence <= self._events[-1].sequence:
            raise ValueError("event sequence must increase")
        self._event_keys.add(event.idempotency_key); self._events += (event,)
        return event

    def replay(self, *, cursor: str = "0", limit: int = 100) -> tuple[ProgressEvent, ...]:
        parsed_cursor = _parse_cursor(cursor)
        known_cursors = {event.cursor for event in self._events}
        if cursor != "0" and cursor not in known_cursors:
            raise ValueError("unknown cursor")
        if type(limit) is not int or not 1 <= limit <= 1000:
            raise ValueError("cursor/limit out of range")
        return tuple(event for event in self._events if event.sequence > parsed_cursor)[:limit]

    def execute(self, command: OperatorCommand, *, session_id: str, now: datetime) -> AuditEvent:
        _utc(now, "now")
        session = self._sessions.get(session_id)
        if session is None or session.operator_id != command.operator_id or not session.is_authenticated(now):
            self._audit(command, "SESSION_UNAUTHENTICATED", now)
            raise PermissionError("remote session is not authenticated")
        registered = self._operators.get(command.operator_id)
        if registered is None or registered[0] != command.auth_token or registered[1] <= now:
            self._audit(command, "AUTH_FAILED", now)
            raise PermissionError("operator authentication failed")
        if command.expires_at <= now:
            self._audit(command, "EXPIRED", now)
            raise ValueError("command is expired")
        if command.issued_at > now:
            self._audit(command, "FUTURE_ISSUED_AT", now)
            raise ValueError("command issued_at cannot be in the future")
        if command.idempotency_key in self._commands:
            self._audit(command, "DUPLICATE", now)
            raise ValueError("duplicate command rejected")
        self._commands.add(command.idempotency_key)
        if command.kind in APPROVAL_REQUIRED:
            request = ApprovalRequest(f"approval-{len(self._approvals) + 1}", command, command.operator_id, "remote command requires Leader/Main approval", now)
            self._approvals += (request,)
            self._audit(command, "APPROVAL_REQUIRED", now, (("request_id", request.request_id),))
            raise ApprovalRequired(request)
        if command.kind not in LOW_RISK:
            self._audit(command, "UNSUPPORTED", now)
            raise ValueError("unsupported command")
        return self._audit(command, "ACCEPTED", now)

    def _audit(self, command: OperatorCommand, outcome: str, now: datetime, details: tuple[tuple[str, str], ...] = ()) -> AuditEvent:
        audit = AuditEvent(f"audit-{len(self._audits) + 1}", command.command_id, command.operator_id, command.kind.value, outcome, now, details)
        self._audits += (audit,)
        return audit

    @property
    def offline_queue(self) -> "OfflineQueue": return self._offline


class OfflineQueue:
    def __init__(self, limit: int = 100) -> None:
        if type(limit) is not int or limit < 1: raise ValueError("limit must be a positive integer")
        self.limit = limit
        self._commands: list[OperatorCommand] = []
        self._keys: set[str] = set()
        self._last_drain_outcomes: tuple[tuple[str, str], ...] = ()

    @property
    def commands(self) -> tuple[OperatorCommand, ...]: return tuple(self._commands)

    @property
    def last_drain_outcomes(self) -> tuple[tuple[str, str], ...]:
        return self._last_drain_outcomes

    def enqueue(self, command: OperatorCommand) -> None:
        if not isinstance(command, OperatorCommand): raise TypeError("command must be OperatorCommand")
        if command.idempotency_key in self._keys: raise ValueError("duplicate queued command")
        if len(self._commands) >= self.limit: raise OverflowError("offline queue is full")
        self._commands.append(command); self._keys.add(command.idempotency_key)

    def drain(self, *, now: datetime, seen_keys: frozenset[str] = frozenset()) -> tuple[OperatorCommand, ...]:
        _utc(now, "now")
        if not isinstance(seen_keys, frozenset): raise TypeError("seen_keys must be a frozenset")
        ready: list[OperatorCommand] = []
        outcomes: list[tuple[str, str]] = []
        for command in self._commands:
            if command.idempotency_key in seen_keys:
                outcomes.append((command.idempotency_key, "DUPLICATE"))
                continue
            if command.expires_at <= now:
                outcomes.append((command.idempotency_key, "STALE"))
                continue
            if command.issued_at > now:
                outcomes.append((command.idempotency_key, "FUTURE_ISSUED_AT"))
                continue
            outcomes.append((command.idempotency_key, "READY"))
            ready.append(command)
        self._commands.clear(); self._keys.clear()
        self._last_drain_outcomes = tuple(outcomes)
        return tuple(ready)
