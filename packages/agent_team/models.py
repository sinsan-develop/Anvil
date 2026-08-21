"""Immutable collaboration primitives for Anvil Agent Teams."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_RESERVED_AUTHORITIES = frozenset(
    {
        "approve",
        "approval",
        "merge",
        "deploy",
        "delete",
        "bypass_write_lease",
        "bypass_egress",
        "bypass_fencing",
    }
)


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: str, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _positive(value: int, field: str) -> None:
    if type(value) is not int or value < 1:
        raise ValueError(f"{field} must be a positive integer")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


def _tuple_of_text(values: tuple[str, ...], field: str, *, allow_empty: bool = False) -> tuple[str, ...]:
    if not isinstance(values, tuple):
        raise ValueError(f"{field} must be a tuple")
    if not allow_empty and not values:
        raise ValueError(f"{field} must be a non-empty tuple")
    for value in values:
        _required(value, field)
    return values


def _frozenset_of_text(values: frozenset[str], field: str, *, allow_empty: bool = False) -> frozenset[str]:
    if not isinstance(values, frozenset):
        raise ValueError(f"{field} must be a frozenset")
    if not allow_empty and not values:
        raise ValueError(f"{field} must be a non-empty frozenset")
    for value in values:
        _required(value, field)
    return values


class TeamSessionState(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TeamTaskStatus(str, Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TeamMessageType(str, Enum):
    TASK_UPDATE = "TASK_UPDATE"
    QUESTION = "QUESTION"
    CONTEXT = "CONTEXT"
    REVIEW = "REVIEW"
    DECISION_REQUEST = "DECISION_REQUEST"
    REVISION_REQUEST = "REVISION_REQUEST"


class TeamDeliveryState(str, Enum):
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"


class ConversationRole(str, Enum):
    USER = "USER"
    LEADER = "LEADER"
    TEAMMATE = "TEAMMATE"


class RequestState(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True, slots=True)
class TeamSession:
    session_id: str
    leader_id: str
    memberships: frozenset[str]
    baseline_hash: str
    permissions: frozenset[str]
    budget: int
    state: TeamSessionState
    revision: int

    def __post_init__(self) -> None:
        _required(self.session_id, "session_id")
        _required(self.leader_id, "leader_id")
        _frozenset_of_text(self.memberships, "memberships")
        if self.leader_id not in self.memberships:
            raise ValueError("leader_id must be present in memberships")
        _hash(self.baseline_hash, "baseline_hash")
        _frozenset_of_text(self.permissions, "permissions")
        if type(self.budget) is not int or self.budget < 0:
            raise ValueError("budget must be a non-negative integer")
        if not isinstance(self.state, TeamSessionState):
            raise TypeError("state must be TeamSessionState")
        _positive(self.revision, "revision")
        for permission in self.permissions:
            if permission.lower() in _RESERVED_AUTHORITIES:
                raise ValueError("permissions must not include reserved authority")

    def transition(self, new_state: TeamSessionState) -> TeamSession:
        if not isinstance(new_state, TeamSessionState):
            raise TypeError("new_state must be TeamSessionState")
        allowed = {
            TeamSessionState.DRAFT: frozenset({TeamSessionState.ACTIVE, TeamSessionState.CANCELLED}),
            TeamSessionState.ACTIVE: frozenset({TeamSessionState.BLOCKED, TeamSessionState.COMPLETED, TeamSessionState.CANCELLED}),
            TeamSessionState.BLOCKED: frozenset({TeamSessionState.ACTIVE, TeamSessionState.CANCELLED}),
            TeamSessionState.COMPLETED: frozenset(),
            TeamSessionState.CANCELLED: frozenset(),
        }
        if new_state not in allowed[self.state]:
            raise ValueError("invalid TeamSession transition")
        return replace(self, state=new_state, revision=self.revision + 1)


@dataclass(frozen=True, slots=True)
class TeamTask:
    task_id: str
    session_id: str
    title: str
    status: TeamTaskStatus
    dependency_ids: frozenset[str]
    path_scope: tuple[str, ...]
    claimed_by: str | None = None
    completed_by: str | None = None

    def __post_init__(self) -> None:
        _required(self.task_id, "task_id")
        _required(self.session_id, "session_id")
        _required(self.title, "title")
        if not isinstance(self.status, TeamTaskStatus):
            raise TypeError("status must be TeamTaskStatus")
        _frozenset_of_text(self.dependency_ids, "dependency_ids", allow_empty=True)
        if self.task_id in self.dependency_ids:
            raise ValueError("dependency_ids must not contain the task itself")
        _tuple_of_text(self.path_scope, "path_scope")
        if self.claimed_by is not None:
            _required(self.claimed_by, "claimed_by")
        if self.completed_by is not None:
            _required(self.completed_by, "completed_by")
        if self.status is TeamTaskStatus.CLAIMED and self.claimed_by is None:
            raise ValueError("CLAIMED task requires claimed_by")
        if self.status is TeamTaskStatus.COMPLETED:
            if self.claimed_by is None or self.completed_by is None:
                raise ValueError("COMPLETED task requires claimed_by and completed_by")

    def claim(self, agent_id: str) -> TeamTask:
        _required(agent_id, "agent_id")
        if self.status is not TeamTaskStatus.PENDING:
            raise ValueError("only PENDING task can be claimed")
        return replace(self, status=TeamTaskStatus.CLAIMED, claimed_by=agent_id)

    def complete(self, agent_id: str) -> TeamTask:
        _required(agent_id, "agent_id")
        if self.status is not TeamTaskStatus.CLAIMED or self.claimed_by is None:
            raise ValueError("only CLAIMED task can be completed")
        if agent_id != self.claimed_by:
            raise PermissionError("completed_by must match the claiming agent")
        return replace(self, status=TeamTaskStatus.COMPLETED, completed_by=agent_id)


@dataclass(frozen=True, slots=True)
class TeamMessage:
    message_id: str
    session_id: str
    sender_id: str
    receiver_id: str
    message_type: TeamMessageType
    body: str
    artifact_refs: tuple[str, ...]
    idempotency_key: str
    baseline_hash: str
    revision: int
    created_at: datetime
    delivery_state: TeamDeliveryState = TeamDeliveryState.PENDING
    delivered_at: datetime | None = None
    acknowledged_at: datetime | None = None

    def __post_init__(self) -> None:
        for value, field in (
            (self.message_id, "message_id"),
            (self.session_id, "session_id"),
            (self.sender_id, "sender_id"),
            (self.receiver_id, "receiver_id"),
            (self.body, "body"),
            (self.idempotency_key, "idempotency_key"),
        ):
            _required(value, field)
        if not isinstance(self.message_type, TeamMessageType):
            raise TypeError("message_type must be TeamMessageType")
        _tuple_of_text(self.artifact_refs, "artifact_refs", allow_empty=True)
        _hash(self.baseline_hash, "baseline_hash")
        _positive(self.revision, "revision")
        _utc(self.created_at, "created_at")
        if not isinstance(self.delivery_state, TeamDeliveryState):
            raise TypeError("delivery_state must be TeamDeliveryState")
        if self.delivered_at is not None:
            _utc(self.delivered_at, "delivered_at")
        if self.acknowledged_at is not None:
            _utc(self.acknowledged_at, "acknowledged_at")


@dataclass(frozen=True, slots=True)
class TeamMailbox:
    mailbox_id: str
    session_id: str
    owner_id: str
    baseline_hash: str
    revision: int
    messages: tuple[TeamMessage, ...] = ()
    idempotency_keys: frozenset[str] = frozenset()

    def __post_init__(self) -> None:
        _required(self.mailbox_id, "mailbox_id")
        _required(self.session_id, "session_id")
        _required(self.owner_id, "owner_id")
        _hash(self.baseline_hash, "baseline_hash")
        _positive(self.revision, "revision")
        if not isinstance(self.messages, tuple):
            raise ValueError("messages must be a tuple")
        for message in self.messages:
            if not isinstance(message, TeamMessage):
                raise TypeError("messages must contain TeamMessage")
        _frozenset_of_text(self.idempotency_keys, "idempotency_keys", allow_empty=True)

    def deliver(self, message: TeamMessage, delivered_at: datetime) -> TeamMailbox:
        if not isinstance(message, TeamMessage):
            raise TypeError("message must be TeamMessage")
        _utc(delivered_at, "delivered_at")
        if message.session_id != self.session_id or message.receiver_id != self.owner_id:
            raise ValueError("message is not addressed to this mailbox owner")
        if message.baseline_hash != self.baseline_hash:
            raise ValueError("message baseline_hash does not match mailbox baseline")
        if message.revision < self.revision:
            raise ValueError("message revision is stale")
        if message.idempotency_key in self.idempotency_keys:
            raise ValueError("message replay rejected by idempotency_key")
        delivered = replace(message, delivery_state=TeamDeliveryState.DELIVERED, delivered_at=delivered_at)
        return replace(
            self,
            messages=self.messages + (delivered,),
            idempotency_keys=self.idempotency_keys | frozenset({message.idempotency_key}),
            revision=max(self.revision, message.revision),
        )

    def acknowledge(self, message_id: str, actor_id: str, acknowledged_at: datetime) -> TeamMailbox:
        _required(message_id, "message_id")
        _required(actor_id, "actor_id")
        _utc(acknowledged_at, "acknowledged_at")
        if actor_id != self.owner_id:
            raise PermissionError("only mailbox owner can acknowledge delivery")
        updated_messages: list[TeamMessage] = []
        found = False
        for message in self.messages:
            if message.message_id != message_id:
                updated_messages.append(message)
                continue
            found = True
            if message.delivery_state is TeamDeliveryState.ACKNOWLEDGED:
                raise ValueError("message was already acknowledged")
            updated_messages.append(
                replace(
                    message,
                    delivery_state=TeamDeliveryState.ACKNOWLEDGED,
                    acknowledged_at=acknowledged_at,
                )
            )
        if not found:
            raise ValueError("message_id was not delivered to this mailbox")
        return replace(self, messages=tuple(updated_messages))


@dataclass(frozen=True, slots=True)
class ConversationTurn:
    turn_id: str
    session_id: str
    thread_id: str
    sequence: int
    sender_id: str
    sender_role: ConversationRole
    receiver_id: str
    receiver_role: ConversationRole
    content: str
    revision_ref: str
    created_at: datetime

    def __post_init__(self) -> None:
        for value, field in (
            (self.turn_id, "turn_id"),
            (self.session_id, "session_id"),
            (self.thread_id, "thread_id"),
            (self.sender_id, "sender_id"),
            (self.receiver_id, "receiver_id"),
            (self.content, "content"),
            (self.revision_ref, "revision_ref"),
        ):
            _required(value, field)
        _positive(self.sequence, "sequence")
        if not isinstance(self.sender_role, ConversationRole):
            raise TypeError("sender_role must be ConversationRole")
        if not isinstance(self.receiver_role, ConversationRole):
            raise TypeError("receiver_role must be ConversationRole")
        _utc(self.created_at, "created_at")
        allowed = {
            (ConversationRole.USER, ConversationRole.LEADER),
            (ConversationRole.LEADER, ConversationRole.USER),
            (ConversationRole.USER, ConversationRole.TEAMMATE),
            (ConversationRole.TEAMMATE, ConversationRole.USER),
            (ConversationRole.TEAMMATE, ConversationRole.TEAMMATE),
        }
        if (self.sender_role, self.receiver_role) not in allowed:
            raise ValueError("unsupported conversation direction")


@dataclass(frozen=True, slots=True)
class DecisionRequest:
    request_id: str
    session_id: str
    requester_id: str
    approver_id: str
    summary: str
    options: tuple[str, ...]
    target_hash: str
    scope_paths: tuple[str, ...]
    allowed_changes: tuple[str, ...]
    forbidden_changes: tuple[str, ...]
    state: RequestState = RequestState.PENDING
    decided_by: str | None = None

    def __post_init__(self) -> None:
        for value, field in (
            (self.request_id, "request_id"),
            (self.session_id, "session_id"),
            (self.requester_id, "requester_id"),
            (self.approver_id, "approver_id"),
            (self.summary, "summary"),
        ):
            _required(value, field)
        _tuple_of_text(self.options, "options")
        _hash(self.target_hash, "target_hash")
        _tuple_of_text(self.scope_paths, "scope_paths")
        _tuple_of_text(self.allowed_changes, "allowed_changes")
        _tuple_of_text(self.forbidden_changes, "forbidden_changes")
        if frozenset(self.allowed_changes) & frozenset(self.forbidden_changes):
            raise ValueError("allowed_changes and forbidden_changes must not overlap")
        if not isinstance(self.state, RequestState):
            raise TypeError("state must be RequestState")
        if self.decided_by is not None:
            _required(self.decided_by, "decided_by")
        if self.state is not RequestState.PENDING and self.decided_by is None:
            raise ValueError("terminal request requires decided_by")

    def transition(self, new_state: RequestState, actor_id: str) -> DecisionRequest:
        if not isinstance(new_state, RequestState):
            raise TypeError("new_state must be RequestState")
        _required(actor_id, "actor_id")
        if self.state is not RequestState.PENDING:
            raise ValueError("terminal request cannot transition again")
        if new_state in {RequestState.APPROVED, RequestState.REJECTED} and actor_id != self.approver_id:
            raise PermissionError("only the approver can decide this request")
        if new_state is RequestState.CANCELLED and actor_id not in {self.requester_id, self.approver_id}:
            raise PermissionError("only requester or approver can cancel this request")
        return replace(self, state=new_state, decided_by=actor_id)


@dataclass(frozen=True, slots=True)
class RevisionRequest:
    request_id: str
    session_id: str
    requester_id: str
    approver_id: str
    summary: str
    target_hash: str
    scope_paths: tuple[str, ...]
    allowed_changes: tuple[str, ...]
    forbidden_changes: tuple[str, ...]
    revision_ref: str
    state: RequestState = RequestState.PENDING
    decided_by: str | None = None

    def __post_init__(self) -> None:
        for value, field in (
            (self.request_id, "request_id"),
            (self.session_id, "session_id"),
            (self.requester_id, "requester_id"),
            (self.approver_id, "approver_id"),
            (self.summary, "summary"),
            (self.revision_ref, "revision_ref"),
        ):
            _required(value, field)
        _hash(self.target_hash, "target_hash")
        _tuple_of_text(self.scope_paths, "scope_paths")
        _tuple_of_text(self.allowed_changes, "allowed_changes")
        _tuple_of_text(self.forbidden_changes, "forbidden_changes")
        if frozenset(self.allowed_changes) & frozenset(self.forbidden_changes):
            raise ValueError("allowed_changes and forbidden_changes must not overlap")
        if not isinstance(self.state, RequestState):
            raise TypeError("state must be RequestState")
        if self.decided_by is not None:
            _required(self.decided_by, "decided_by")
        if self.state is not RequestState.PENDING and self.decided_by is None:
            raise ValueError("terminal request requires decided_by")

    def transition(self, new_state: RequestState, actor_id: str) -> RevisionRequest:
        if not isinstance(new_state, RequestState):
            raise TypeError("new_state must be RequestState")
        _required(actor_id, "actor_id")
        if self.state is not RequestState.PENDING:
            raise ValueError("terminal request cannot transition again")
        if new_state in {RequestState.APPROVED, RequestState.REJECTED} and actor_id != self.approver_id:
            raise PermissionError("only the approver can decide this request")
        if new_state is RequestState.CANCELLED and actor_id not in {self.requester_id, self.approver_id}:
            raise PermissionError("only requester or approver can cancel this request")
        return replace(self, state=new_state, decided_by=actor_id)


TeamSessionStatus = TeamSessionState
RequestStatus = RequestState
Mailbox = TeamMailbox
