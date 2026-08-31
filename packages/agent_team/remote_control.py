"""Framework-free remote monitoring and operator control primitives.

This module is deliberately transport agnostic.  It provides the domain
rules a Web Console/PWA adapter can use later, but performs no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
import re


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


def _pairs(values: tuple[tuple[str, str], ...], field: str) -> None:
    if not isinstance(values, tuple):
        raise TypeError(f"{field} must be a tuple")
    for pair in values:
        if not isinstance(pair, tuple) or len(pair) != 2:
            raise ValueError(f"{field} must contain key/value pairs")
        _text(pair[0], f"{field}.key"); _text(pair[1], f"{field}.value")
    if tuple(sorted(values)) != values or len({pair[0] for pair in values}) != len(values):
        raise ValueError(f"{field} must use sorted unique canonical keys")


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


class CommandState(str, Enum):
    PENDING_REMOTE = "PENDING_REMOTE"
    ACCEPTED = "ACCEPTED"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    REJECTED = "REJECTED"
    READY_TO_SYNC = "READY_TO_SYNC"


@dataclass(frozen=True, slots=True)
class ArtifactReference:
    artifact_id: str
    content_hash: str
    path: str
    kind: str = "artifact"

    def __post_init__(self) -> None:
        for value, field in ((self.artifact_id, "artifact_id"), (self.content_hash, "content_hash"), (self.path, "path"), (self.kind, "kind")):
            _text(value, field)
        if len(self.content_hash) < 16 or any(c not in "0123456789abcdefABCDEF" for c in self.content_hash):
            raise ValueError("content_hash must be hexadecimal")
        if self.path.startswith(("/", "\\")) or "://" in self.path or re.match(r"^[A-Za-z]:", self.path) or any(part in ("..", ".") for part in re.split(r"[/\\]", self.path)):
            raise ValueError("artifact path must be a relative reference")


@dataclass(frozen=True, slots=True)
class ConversationMessage:
    message_id: str
    author_id: str
    body: str
    sequence: int
    sent_at: datetime
    artifact_refs: tuple[ArtifactReference, ...] = ()
    conversation_id: str = "default"
    thread_id: str = "default"

    def __post_init__(self) -> None:
        for value, field in ((self.message_id, "message_id"), (self.author_id, "author_id"), (self.body, "body")):
            _text(value, field)
        _text(self.conversation_id, "conversation_id"); _text(self.thread_id, "thread_id")
        if type(self.sequence) is not int or self.sequence < 1:
            raise ValueError("sequence must be a positive integer")
        _utc(self.sent_at, "sent_at")
        if not all(isinstance(ref, ArtifactReference) for ref in self.artifact_refs):
            raise TypeError("artifact_refs must contain ArtifactReference values")


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
        _pairs(self.details, "details")


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
        _pairs(self.payload, "payload")


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
    fencing_token: str = ""

    def __post_init__(self) -> None:
        for value, field in ((self.command_id, "command_id"), (self.operator_id, "operator_id"), (self.idempotency_key, "idempotency_key"), (self.auth_token, "auth_token")):
            _text(value, field)
        if not isinstance(self.kind, CommandKind):
            raise TypeError("kind must be CommandKind")
        _utc(self.issued_at, "issued_at")
        _utc(self.expires_at, "expires_at")
        if self.expires_at <= self.issued_at:
            raise ValueError("expires_at must be after issued_at")
        _pairs(self.parameters, "parameters")
        if self.fencing_token:
            _text(self.fencing_token, "fencing_token")


@dataclass(frozen=True, slots=True)
class ApprovalRequest:
    request_id: str
    command: OperatorCommand
    requested_by: str
    reason: str
    created_at: datetime
    state: ApprovalState = ApprovalState.PENDING
    target_content_hash: str = ""
    decided_by: str = ""
    decided_at: datetime | None = None

    def __post_init__(self) -> None:
        _text(self.request_id, "request_id")
        if not isinstance(self.command, OperatorCommand):
            raise TypeError("command must be OperatorCommand")
        _text(self.requested_by, "requested_by")
        _text(self.reason, "reason")
        _utc(self.created_at, "created_at")
        if not isinstance(self.state, ApprovalState):
            raise TypeError("state must be ApprovalState")
        if self.target_content_hash and (len(self.target_content_hash) != 64 or any(c not in "0123456789abcdefABCDEF" for c in self.target_content_hash)):
            raise ValueError("target_content_hash must be a SHA-256 hexadecimal hash")
        if self.state is ApprovalState.PENDING and (self.decided_by or self.decided_at is not None):
            raise ValueError("pending approval cannot have a decision")
        if self.state is not ApprovalState.PENDING:
            _text(self.decided_by, "decided_by")
            if self.decided_at is None: raise ValueError("decided_at is required")
            _utc(self.decided_at, "decided_at")


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
        self._event_ids: dict[str, ProgressEvent] = {}
        self._commands: set[str] = set()
        self._audits: tuple[AuditEvent, ...] = ()
        self._approvals: tuple[ApprovalRequest, ...] = ()
        self._offline = OfflineQueue(queue_limit)
        self._fencing: dict[str, str] = {}
        self._conversation: tuple[ConversationMessage, ...] = ()

    @property
    def events(self) -> tuple[ProgressEvent, ...]: return self._events
    @property
    def audits(self) -> tuple[AuditEvent, ...]: return self._audits
    @property
    def approvals(self) -> tuple[ApprovalRequest, ...]: return self._approvals
    @property
    def snapshots(self) -> tuple[AgentStatusSnapshot, ...]: return tuple(self._snapshots.values())
    @property
    def conversation(self) -> tuple[ConversationMessage, ...]: return self._conversation

    def publish_message(self, message: ConversationMessage) -> ConversationMessage:
        same_scope = [m for m in self._conversation if (m.conversation_id, m.thread_id) == (message.conversation_id, message.thread_id)]
        if same_scope and message.sequence <= same_scope[-1].sequence:
            raise ValueError("conversation sequence must increase")
        if same_scope and message.sent_at < same_scope[-1].sent_at:
            raise ValueError("conversation timestamp must not move backwards")
        self._conversation += (message,)
        return message

    def approve(self, request_id: str, *, actor_id: str, now: datetime) -> ApprovalRequest:
        return self._decide(request_id, actor_id=actor_id, now=now, state=ApprovalState.APPROVED)

    def reject(self, request_id: str, *, actor_id: str, now: datetime) -> ApprovalRequest:
        return self._decide(request_id, actor_id=actor_id, now=now, state=ApprovalState.REJECTED)

    def _decide(self, request_id: str, *, actor_id: str, now: datetime, state: ApprovalState) -> ApprovalRequest:
        _text(request_id, "request_id"); _text(actor_id, "actor_id"); _utc(now, "now")
        request = next((item for item in self._approvals if item.request_id == request_id), None)
        if request is None: raise KeyError(request_id)
        if request.state is not ApprovalState.PENDING: raise ValueError("approval is already decided")
        updated = ApprovalRequest(request.request_id, request.command, request.requested_by, request.reason, request.created_at, state, request.target_content_hash, actor_id, now)
        self._approvals = tuple(updated if item.request_id == request_id else item for item in self._approvals)
        self._audit(request.command, "APPROVAL_DECISION", now, (("request_id", request_id), ("actor_id", actor_id), ("state", state.value)))
        return updated

    def register_operator(self, operator_id: str, auth_token: str, valid_until: datetime) -> None:
        _text(operator_id, "operator_id"); _text(auth_token, "auth_token"); _utc(valid_until, "valid_until")
        self._operators[operator_id] = (auth_token, valid_until)

    def rotate_fencing_token(self, operator_id: str, token: str) -> None:
        _text(operator_id, "operator_id"); _text(token, "token")
        if operator_id not in self._operators:
            raise KeyError(operator_id)
        self._fencing[operator_id] = token

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
        existing = self._event_ids.get(event.event_id)
        if existing is not None:
            if existing == event:
                return existing
            raise ValueError("event_id collision")
        if event.idempotency_key in self._event_keys:
            raise ValueError("duplicate event rejected")
        if self._events and event.sequence <= self._events[-1].sequence:
            raise ValueError("event sequence must increase")
        if self._events and event.occurred_at < self._events[-1].occurred_at:
            raise ValueError("event timestamp must not move backwards")
        self._event_keys.add(event.idempotency_key); self._events += (event,)
        self._event_ids[event.event_id] = event
        return event

    def replay(self, *, cursor: str = "0", last_event_id: str | None = None, limit: int = 100) -> tuple[ProgressEvent, ...]:
        if last_event_id is not None:
            _text(last_event_id, "last_event_id")
            if cursor != "0":
                raise ValueError("cursor and Last-Event-ID cannot both be set")
            match = next((e for e in self._events if e.event_id == last_event_id), None)
            if match is None:
                raise ValueError("unknown Last-Event-ID")
            cursor = match.cursor
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
        expected_fence = self._fencing.get(command.operator_id)
        if expected_fence is not None and command.fencing_token != expected_fence:
            self._audit(command, "FENCING_FAILED", now)
            raise PermissionError("stale fencing token")
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
            target_hash = next((value for key, value in command.parameters if key == "content_hash"), "")
            if len(target_hash) != 64 or any(c not in "0123456789abcdefABCDEF" for c in target_hash):
                self._audit(command, "SUBJECT_HASH_REQUIRED", now)
                raise ValueError("high-risk command requires a valid subject content hash")
            request = ApprovalRequest(f"approval-{len(self._approvals) + 1}", command, command.operator_id, "remote command requires Leader/Main approval", now, target_content_hash=target_hash)
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
        self._states: dict[str, CommandState] = {}

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
        self._states[command.idempotency_key] = CommandState.PENDING_REMOTE

    def state(self, idempotency_key: str) -> CommandState:
        _text(idempotency_key, "idempotency_key")
        return self._states.get(idempotency_key, CommandState.REJECTED)

    def drain(self, *, now: datetime, seen_keys: frozenset[str] = frozenset()) -> tuple[OperatorCommand, ...]:
        _utc(now, "now")
        if not isinstance(seen_keys, frozenset): raise TypeError("seen_keys must be a frozenset")
        ready: list[OperatorCommand] = []
        outcomes: list[tuple[str, str]] = []
        for command in self._commands:
            if command.idempotency_key in seen_keys:
                outcomes.append((command.idempotency_key, "DUPLICATE"))
                self._states[command.idempotency_key] = CommandState.REJECTED
                continue
            if command.expires_at <= now:
                outcomes.append((command.idempotency_key, "STALE"))
                self._states[command.idempotency_key] = CommandState.REJECTED
                continue
            if command.issued_at > now:
                outcomes.append((command.idempotency_key, "FUTURE_ISSUED_AT"))
                self._states[command.idempotency_key] = CommandState.REJECTED
                continue
            outcomes.append((command.idempotency_key, "READY"))
            ready.append(command)
            self._states[command.idempotency_key] = CommandState.READY_TO_SYNC
        self._commands.clear(); self._keys.clear()
        self._last_drain_outcomes = tuple(outcomes)
        return tuple(ready)
