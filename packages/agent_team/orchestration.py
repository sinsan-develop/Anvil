"""Small, framework-free orchestration service for Agent Team collaboration."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Iterable, Mapping

from .collaboration import canonical_hash

from .models import (
    TeamMailbox,
    TeamMessage,
    TeamMessageType,
    TeamSession,
    TeamSessionState,
    TeamTask,
    TeamTaskStatus,
)


_RESERVED = frozenset({"approve", "approval", "merge", "deploy", "delete"})


class OrchestrationEventType(str, Enum):
    TEAMMATE_REGISTERED = "TEAMMATE_REGISTERED"
    TASK_CLAIMED = "TASK_CLAIMED"
    MESSAGE_SENT = "MESSAGE_SENT"
    PEER_REVIEWED = "PEER_REVIEWED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_BLOCKED = "TASK_BLOCKED"
    TASK_RESUMED = "TASK_RESUMED"
    HOOK_COMPLETED = "HOOK_COMPLETED"
    HOOK_IDLE = "HOOK_IDLE"
    COST_RECORDED = "COST_RECORDED"


@dataclass(frozen=True, slots=True)
class TeamMember:
    agent_id: str
    role: str
    capabilities: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class OrchestrationEvent:
    event_id: str
    event_type: OrchestrationEventType
    actor_id: str
    subject_id: str
    revision: int
    created_at: datetime
    details: tuple[tuple[str, str], ...] = ()
    parent_hash: str = "root"
    event_hash: str = ""

    def __post_init__(self) -> None:
        _required(self.event_id, "event_id")
        _required(self.actor_id, "actor_id")
        _required(self.subject_id, "subject_id")
        if type(self.revision) is not int or self.revision < 1:
            raise ValueError("revision must be positive")
        _utc(self.created_at)
        if not isinstance(self.details, tuple) or any(
            not isinstance(k, str) or not isinstance(v, str) for k, v in self.details
        ):
            raise ValueError("details must be a tuple of text pairs")
        if self.parent_hash != "root" and (not isinstance(self.parent_hash, str) or not self.parent_hash.startswith("sha256:") or len(self.parent_hash) != 71):
            raise ValueError("parent_hash must be canonical or root")
        expected = canonical_hash({
            "event_id": self.event_id, "event_type": self.event_type,
            "actor_id": self.actor_id, "subject_id": self.subject_id,
            "revision": self.revision, "created_at": self.created_at,
            "details": self.details, "parent_hash": self.parent_hash,
        })
        if self.event_hash and self.event_hash != expected:
            raise ValueError("event_hash does not match event contents")
        object.__setattr__(self, "event_hash", expected)


@dataclass(frozen=True, slots=True)
class PeerReview:
    review_id: str
    task_id: str
    reviewer_id: str
    outcome: str
    summary: str
    created_at: datetime


@dataclass(frozen=True, slots=True)
class TaskLease:
    task_id: str
    agent_id: str
    baseline_hash: str
    revision: int
    fencing_token: str


@dataclass(frozen=True, slots=True)
class HookRecord:
    hook: str
    actor_id: str
    subject_id: str
    revision: int


def _utc(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None or value.utcoffset().total_seconds() != 0:
        raise ValueError("created_at must be UTC")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _scope_conflicts(left: Iterable[str], right: Iterable[str]) -> bool:
    for a in left:
        for b in right:
            a_norm, b_norm = a.rstrip("/"), b.rstrip("/")
            if a_norm == b_norm or a_norm.startswith(b_norm + "/") or b_norm.startswith(a_norm + "/"):
                return True
    return False


class TeamOrchestrator:
    """In-memory coordinator; it never approves, merges, deploys, or deletes."""

    def __init__(self, session: TeamSession, *, now: datetime | None = None) -> None:
        if not isinstance(session, TeamSession):
            raise TypeError("session must be TeamSession")
        self.session = session
        self._members = {session.leader_id: TeamMember(session.leader_id, "LEADER")}
        self._tasks: dict[str, TeamTask] = {}
        self._mailboxes = {
            agent: TeamMailbox(f"mailbox-{agent}", session.session_id, agent, session.baseline_hash, session.revision)
            for agent in session.memberships
        }
        self._events: tuple[OrchestrationEvent, ...] = ()
        self._reviews: tuple[PeerReview, ...] = ()
        self._spent = 0
        self._counter = 0
        self._now = now or datetime.now(timezone.utc)
        self._task_leases: dict[str, TaskLease] = {}
        self._hooks: tuple[HookRecord, ...] = ()
        self._event_ids: set[str] = set()
        self._event_head = "root"

    @classmethod
    def create_session(cls, *, session_id: str, leader_id: str, baseline_hash: str, budget: int, permissions: frozenset[str] = frozenset({"team:coordinate"}), now: datetime | None = None) -> "TeamOrchestrator":
        session = TeamSession(session_id, leader_id, frozenset({leader_id}), baseline_hash, permissions, budget, TeamSessionState.DRAFT, 1)
        return cls(session, now=now)

    @property
    def members(self) -> tuple[TeamMember, ...]:
        return tuple(self._members.values())

    @property
    def tasks(self) -> tuple[TeamTask, ...]:
        return tuple(self._tasks.values())

    @property
    def events(self) -> tuple[OrchestrationEvent, ...]:
        return self._events

    @property
    def reviews(self) -> tuple[PeerReview, ...]:
        return self._reviews

    @property
    def hooks(self) -> tuple[HookRecord, ...]:
        return self._hooks

    def mailbox(self, owner_id: str) -> TeamMailbox:
        self._member(owner_id)
        return self._mailboxes[owner_id]

    def lease_for(self, task_id: str) -> TaskLease:
        try:
            return self._task_leases[task_id]
        except KeyError as exc:
            raise ValueError("task has no active lease") from exc

    @property
    def spent(self) -> int:
        return self._spent

    def _time(self, value: datetime | None) -> datetime:
        result = value or self._now
        _utc(result)
        return result

    def _event(self, event_type: OrchestrationEventType, actor_id: str, subject_id: str, *, now: datetime | None = None, details: tuple[tuple[str, str], ...] = ()) -> None:
        self._counter += 1
        event = OrchestrationEvent(
            f"event-{self._counter}", event_type, actor_id, subject_id,
            self.session.revision, self._time(now), details, self._event_head,
        )
        self._events += (event,)
        self._event_ids.add(event.event_id)
        self._event_head = event.event_hash

    def _member(self, agent_id: str) -> None:
        if agent_id not in self._members:
            raise PermissionError("agent is not a team member")

    def register_teammate(self, actor_id: str, agent_id: str, *, capabilities: frozenset[str] = frozenset()) -> TeamMember:
        if actor_id != self.session.leader_id:
            raise PermissionError("only the leader can register teammates")
        _required(agent_id, "agent_id")
        if agent_id in self._members:
            raise ValueError("agent is already registered")
        if any(not isinstance(capability, str) for capability in capabilities):
            raise TypeError("capabilities must contain only strings")
        if any(cap.lower() in _RESERVED for cap in capabilities):
            raise ValueError("capabilities must not grant reserved authority")
        member = TeamMember(agent_id, "TEAMMATE", frozenset(capabilities))
        self._members[agent_id] = member
        self._mailboxes[agent_id] = TeamMailbox(f"mailbox-{agent_id}", self.session.session_id, agent_id, self.session.baseline_hash, self.session.revision)
        self.session = TeamSession(self.session.session_id, self.session.leader_id, self.session.memberships | frozenset({agent_id}), self.session.baseline_hash, self.session.permissions, self.session.budget, self.session.state, self.session.revision)
        self._event(OrchestrationEventType.TEAMMATE_REGISTERED, actor_id, agent_id)
        return member

    def activate(self, actor_id: str) -> TeamSession:
        self._member(actor_id)
        if actor_id != self.session.leader_id:
            raise PermissionError("only the leader can activate the session")
        self.session = self.session.transition(TeamSessionState.ACTIVE)
        return self.session

    def add_task(self, actor_id: str, task: TeamTask) -> TeamTask:
        self._member(actor_id)
        if actor_id != self.session.leader_id:
            raise PermissionError("only the leader can add tasks")
        if task.session_id != self.session.session_id or task.task_id in self._tasks:
            raise ValueError("task does not belong to this session or already exists")
        if task.status is not TeamTaskStatus.PENDING or task.claimed_by is not None or task.completed_by is not None:
            raise ValueError("only a pristine PENDING task can be added")
        missing = task.dependency_ids.difference(self._tasks)
        if missing:
            raise ValueError("task dependencies must be registered")
        self._tasks[task.task_id] = task
        return task

    def claim_task(self, agent_id: str, task_id: str, *, baseline_hash: str, revision: int) -> TeamTask:
        self._member(agent_id)
        task = self._tasks[task_id]
        if baseline_hash != self.session.baseline_hash or revision != self.session.revision:
            raise ValueError("stale baseline or revision")
        if any(self._tasks[dep].status is not TeamTaskStatus.COMPLETED for dep in task.dependency_ids):
            raise ValueError("task dependencies are not completed")
        for other in self._tasks.values():
            if other.status is TeamTaskStatus.CLAIMED and _scope_conflicts(task.path_scope, other.path_scope):
                raise ValueError("write-scope conflict")
        self._tasks[task_id] = task.claim(agent_id)
        self._task_leases[task_id] = TaskLease(
            task_id, agent_id, baseline_hash, revision,
            f"lease-{self.session.session_id}-{task_id}-{len(self._task_leases) + 1}",
        )
        self._event(OrchestrationEventType.TASK_CLAIMED, agent_id, task_id)
        return self._tasks[task_id]

    def send_message(self, sender_id: str, receiver_id: str, message_type: TeamMessageType, body: str, *, idempotency_key: str, revision: int | None = None, artifact_refs: tuple[str, ...] = (), now: datetime | None = None) -> TeamMessage:
        self._member(sender_id)
        self._member(receiver_id)
        if sender_id == receiver_id:
            raise ValueError("direct peer message requires distinct sender and receiver")
        created = self._time(now)
        message_revision = self.session.revision if revision is None else revision
        if message_revision != self.session.revision:
            raise ValueError("stale or future session revision")
        message = TeamMessage(f"message-{self._counter + 1}", self.session.session_id, sender_id, receiver_id, message_type, body, artifact_refs, idempotency_key, self.session.baseline_hash, message_revision, created)
        self._mailboxes[receiver_id] = self._mailboxes[receiver_id].deliver(message, created)
        self._event(OrchestrationEventType.MESSAGE_SENT, sender_id, message.message_id, now=created, details=(("receiver_id", receiver_id),))
        return self._mailboxes[receiver_id].messages[-1]

    def acknowledge_message(self, receiver_id: str, message_id: str, *, now: datetime | None = None) -> None:
        self._member(receiver_id)
        self._mailboxes[receiver_id] = self._mailboxes[receiver_id].acknowledge(message_id, receiver_id, self._time(now))

    def record_peer_review(self, reviewer_id: str, task_id: str, outcome: str, summary: str, *, now: datetime | None = None) -> PeerReview:
        self._member(reviewer_id)
        if task_id not in self._tasks:
            raise ValueError("unknown task")
        if self._tasks[task_id].claimed_by == reviewer_id:
            raise PermissionError("a task cannot be peer-reviewed by its claimant")
        _required(outcome, "outcome")
        _required(summary, "summary")
        review = PeerReview(f"review-{len(self._reviews) + 1}", task_id, reviewer_id, outcome, summary, self._time(now))
        self._reviews += (review,)
        self._event(OrchestrationEventType.PEER_REVIEWED, reviewer_id, task_id, now=review.created_at)
        return review

    def complete_task(self, agent_id: str, task_id: str, *, cost: int = 0, now: datetime | None = None) -> TeamTask:
        task = self._tasks[task_id]
        if task.claimed_by != agent_id:
            raise PermissionError("only the claiming agent can complete task")
        self.record_cost(agent_id, cost)
        self._tasks[task_id] = task.complete(agent_id)
        self._task_leases.pop(task_id, None)
        self._event(OrchestrationEventType.TASK_COMPLETED, agent_id, task_id, now=now)
        self._event(OrchestrationEventType.HOOK_COMPLETED, agent_id, task_id, now=now)
        return self._tasks[task_id]

    def block_task(self, actor_id: str, task_id: str, *, now: datetime | None = None) -> TeamTask:
        self._member(actor_id)
        task = self._tasks[task_id]
        if task.status is not TeamTaskStatus.CLAIMED:
            raise ValueError("only CLAIMED task can be blocked")
        self._tasks[task_id] = TeamTask(task.task_id, task.session_id, task.title, TeamTaskStatus.BLOCKED, task.dependency_ids, task.path_scope, task.claimed_by, task.completed_by, task.created_at, task.parent_hash)
        self._event(OrchestrationEventType.TASK_BLOCKED, actor_id, task_id, now=now)
        return self._tasks[task_id]

    def resume_task(self, actor_id: str, task_id: str, *, now: datetime | None = None) -> TeamTask:
        self._member(actor_id)
        task = self._tasks[task_id]
        if task.status is not TeamTaskStatus.BLOCKED:
            raise ValueError("only BLOCKED task can resume")
        self._tasks[task_id] = TeamTask(task.task_id, task.session_id, task.title, TeamTaskStatus.CLAIMED, task.dependency_ids, task.path_scope, task.claimed_by, task.completed_by, task.created_at, task.parent_hash)
        self._event(OrchestrationEventType.TASK_RESUMED, actor_id, task_id, now=now)
        return self._tasks[task_id]

    def idle_hook(self, actor_id: str, *, now: datetime | None = None) -> None:
        self._member(actor_id)
        self._hooks += (HookRecord("idle", actor_id, self.session.session_id, self.session.revision),)
        self._event(OrchestrationEventType.HOOK_IDLE, actor_id, self.session.session_id, now=now)

    def completion_hook(self, actor_id: str, task_id: str, *, now: datetime | None = None) -> None:
        self._member(actor_id)
        task = self._tasks.get(task_id)
        if task is None or task.status is not TeamTaskStatus.COMPLETED:
            raise ValueError("completion hook requires a completed task")
        if task.completed_by != actor_id:
            raise PermissionError("only the completing agent can run completion hook")
        self._hooks += (HookRecord("completion", actor_id, task_id, self.session.revision),)
        self._event(OrchestrationEventType.HOOK_COMPLETED, actor_id, task_id, now=now)

    def pause(self, actor_id: str, *, reason: str = "user", now: datetime | None = None) -> TeamSession:
        self._member(actor_id)
        if actor_id != self.session.leader_id:
            raise PermissionError("only the leader can pause a team")
        _required(reason, "reason")
        self.session = self.session.transition(TeamSessionState.BLOCKED)
        self._event(OrchestrationEventType.TASK_BLOCKED, actor_id, self.session.session_id, now=now, details=(("reason", reason),))
        return self.session

    def resume(self, actor_id: str, *, now: datetime | None = None) -> TeamSession:
        self._member(actor_id)
        if actor_id != self.session.leader_id:
            raise PermissionError("only the leader can resume a team")
        self.session = self.session.transition(TeamSessionState.ACTIVE)
        self._event(OrchestrationEventType.TASK_RESUMED, actor_id, self.session.session_id, now=now)
        return self.session

    def replay_events(self, events: Iterable[OrchestrationEvent]) -> tuple[OrchestrationEvent, ...]:
        """Validate an exported event stream; exact replays are idempotent."""
        seen: set[str] = set()
        head = "root"
        accepted: list[OrchestrationEvent] = []
        for event in events:
            if not isinstance(event, OrchestrationEvent):
                raise TypeError("events must contain OrchestrationEvent")
            if event.event_id in seen:
                continue
            if event.actor_id not in self._members:
                raise PermissionError("event actor is not a team member")
            if event.parent_hash != head:
                raise ValueError("stale or foreign orchestration event")
            seen.add(event.event_id); accepted.append(event); head = event.event_hash
        return tuple(accepted)

    def record_cost(self, actor_id: str, amount: int) -> int:
        self._member(actor_id)
        if type(amount) is not int or amount < 0:
            raise ValueError("cost must be a non-negative integer")
        if self._spent + amount > self.session.budget:
            raise ValueError("session budget exceeded")
        self._spent += amount
        self._event(OrchestrationEventType.COST_RECORDED, actor_id, self.session.session_id, details=(("amount", str(amount)),))
        return self._spent
