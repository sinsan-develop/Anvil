"""Deterministic, in-memory durable primitives for Agent Team collaboration.

This module is deliberately transport and persistence agnostic.  It provides
the append-only boundary that a later orchestration adapter can persist.
"""
from __future__ import annotations

import json
from dataclasses import dataclass as _snapshot_dataclass


@_snapshot_dataclass(frozen=True)
class TeamSnapshot:
    """Detached bounded JSON projection; never a runtime authorization."""
    payload: str

    def __post_init__(self):
        if type(self.payload) is not str or len(self.payload.encode('utf-8')) > 1048576:
            raise ValueError('PROJECTION_INVALID')

    @property
    def content_hash(self):
        import hashlib
        return 'sha256:' + hashlib.sha256(self.payload.encode('utf-8')).hexdigest()

    def to_dict(self):
        return json.loads(self.payload)


def team_snapshot(value):
    payload = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    if len(payload.encode('utf-8')) > 1048576:
        raise ValueError('PROJECTION_BOUND_EXCEEDED')
    return TeamSnapshot(payload)

from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
import hashlib
import json
from types import MappingProxyType
from typing import Any, Iterable, Mapping

from .models import ConversationRole, ConversationTurn, TeamMessage, TeamSession, TeamTask

HASH_PREFIX = "sha256:"
_ROOT_PARENT = "root"


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, tuple):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, (set, frozenset)):
        return frozenset(_freeze(item) for item in value)
    return value


def _parent_hash(value: str, field: str = "parent_hash") -> None:
    if not isinstance(value, str) or value == _ROOT_PARENT:
        if value != _ROOT_PARENT:
            raise ValueError(f"{field} must be a canonical sha256 hash or root")
        return
    if len(value) != 71 or not value.startswith(HASH_PREFIX) or any(char not in "0123456789abcdef" for char in value[len(HASH_PREFIX):]):
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _plain(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, Mapping):
        return {str(k): _plain(v) for k, v in sorted(value.items(), key=lambda x: str(x[0]))}
    if isinstance(value, (tuple, list)):
        return [_plain(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted((_plain(v) for v in value), key=lambda v: json.dumps(v, sort_keys=True, ensure_ascii=False))
    if hasattr(value, "__dataclass_fields__"):
        return _plain(asdict(value))
    return value


def canonical_hash(value: Any) -> str:
    """Return a stable hash for an immutable schema or JSON-like value."""
    encoded = json.dumps(_plain(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return HASH_PREFIX + hashlib.sha256(encoded).hexdigest()


class ThreadKind(str, Enum):
    USER_AGENT = "USER_AGENT"
    AGENT_AGENT = "AGENT_AGENT"


@dataclass(frozen=True, slots=True)
class ThreadIdentity:
    thread_id: str
    session_id: str
    kind: ThreadKind
    initiator_id: str
    participant_ids: frozenset[str]
    parent_hash: str
    created_at: datetime

    def __post_init__(self) -> None:
        for value, field in ((self.thread_id, "thread_id"), (self.session_id, "session_id"), (self.initiator_id, "initiator_id"), (self.parent_hash, "parent_hash")):
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise ValueError(f"{field} must be a canonical non-empty string")
        if not isinstance(self.kind, ThreadKind):
            raise TypeError("kind must be ThreadKind")
        if not isinstance(self.participant_ids, frozenset) or not self.participant_ids:
            raise ValueError("participant_ids must be a non-empty frozenset")
        if any(not isinstance(value, str) or not value.strip() or value != value.strip() for value in self.participant_ids):
            raise ValueError("participant_ids must contain canonical non-empty strings")
        if self.initiator_id not in self.participant_ids:
            raise ValueError("initiator_id must be a participant")
        _parent_hash(self.parent_hash)
        if not isinstance(self.created_at, datetime) or self.created_at.tzinfo is None or self.created_at.utcoffset() is None or self.created_at.utcoffset().total_seconds() != 0:
            raise ValueError("created_at must be UTC")
        if self.kind is ThreadKind.USER_AGENT and len(self.participant_ids) != 2:
            raise ValueError("USER_AGENT thread must contain exactly user and agent")
        if self.kind is ThreadKind.AGENT_AGENT and len(self.participant_ids) < 2:
            raise ValueError("AGENT_AGENT thread requires two participants")

    @property
    def identity_hash(self) -> str:
        return canonical_hash(self)


@dataclass(frozen=True, slots=True)
class DependencyGraph:
    dependencies: tuple[tuple[str, tuple[str, ...]], ...] = ()

    def __post_init__(self) -> None:
        keys = [key for key, _ in self.dependencies]
        if len(keys) != len(set(keys)):
            raise ValueError("duplicate dependency node")
        nodes = set(keys) | {dep for _, deps in self.dependencies for dep in deps}
        for key, deps in self.dependencies:
            if not isinstance(key, str) or not key.strip() or key != key.strip():
                raise ValueError("dependency node identity must be canonical")
            if key in deps:
                raise ValueError("dependency cycle detected")
            if not isinstance(deps, tuple) or len(set(deps)) != len(deps):
                raise ValueError("dependencies must be a unique tuple")
            if any(not isinstance(dep, str) or not dep.strip() or dep != dep.strip() for dep in deps):
                raise ValueError("dependency identity must be canonical")
        graph = {key: set(deps) for key, deps in self.dependencies}
        visiting: set[str] = set(); visited: set[str] = set()
        def visit(node: str) -> None:
            if node in visiting:
                raise ValueError("dependency cycle detected")
            if node in visited:
                return
            visiting.add(node)
            for dep in graph.get(node, set()):
                visit(dep)
            visiting.remove(node); visited.add(node)
        for node in sorted(nodes):
            visit(node)
        object.__setattr__(self, "dependencies", tuple(sorted(((key, tuple(sorted(deps))) for key, deps in self.dependencies), key=lambda row: row[0])))

    @classmethod
    def from_tasks(cls, tasks: Iterable[TeamTask]) -> "DependencyGraph":
        rows = tuple(sorted(((task.task_id, tuple(sorted(task.dependency_ids))) for task in tasks), key=lambda row: row[0]))
        return cls(rows)

    def hash(self) -> str:
        return canonical_hash(self)


class TeamEventType(str, Enum):
    SESSION_CREATED = "SESSION_CREATED"
    TASK_CREATED = "TASK_CREATED"
    TASK_UPDATED = "TASK_UPDATED"
    MESSAGE_APPENDED = "MESSAGE_APPENDED"
    TURN_APPENDED = "TURN_APPENDED"
    DECISION_REQUESTED = "DECISION_REQUESTED"
    PROGRESS_RECORDED = "PROGRESS_RECORDED"


@dataclass(frozen=True, slots=True)
class TeamEvent:
    event_id: str
    session_id: str
    sequence: int
    event_type: TeamEventType
    actor_id: str
    subject_id: str
    parent_hash: str
    payload: Mapping[str, Any]
    created_at: datetime
    event_hash: str = ""

    def __post_init__(self) -> None:
        for value, field in ((self.event_id, "event_id"), (self.session_id, "session_id"), (self.actor_id, "actor_id"), (self.subject_id, "subject_id"), (self.parent_hash, "parent_hash")):
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise ValueError(f"{field} must be a canonical non-empty string")
        if type(self.sequence) is not int or self.sequence < 1:
            raise ValueError("sequence must be positive")
        if not isinstance(self.event_type, TeamEventType):
            raise TypeError("event_type must be TeamEventType")
        _parent_hash(self.parent_hash)
        if not isinstance(self.payload, Mapping):
            raise TypeError("payload must be a mapping")
        object.__setattr__(self, "payload", _freeze(self.payload))
        if not isinstance(self.created_at, datetime) or self.created_at.tzinfo is None or self.created_at.utcoffset() is None or self.created_at.utcoffset().total_seconds() != 0:
            raise ValueError("created_at must be UTC")
        expected = canonical_hash({"event_id": self.event_id, "session_id": self.session_id, "sequence": self.sequence, "event_type": self.event_type, "actor_id": self.actor_id, "subject_id": self.subject_id, "parent_hash": self.parent_hash, "payload": self.payload, "created_at": self.created_at})
        if self.event_hash and self.event_hash != expected:
            raise ValueError("event_hash does not match event contents")
        object.__setattr__(self, "event_hash", expected)


class AppendOnlyTeamLog:
    """A replayable log which rejects stale parents, duplicates, and bad actors."""
    def __init__(self, session: TeamSession, *, initial_parent_hash: str | None = None) -> None:
        self.session = session
        self._events: tuple[TeamEvent, ...] = ()
        self._event_ids: set[str] = set()
        self._parent_hash = initial_parent_hash or canonical_hash(session)
        _parent_hash(self._parent_hash)
        self._actors = set(session.memberships)

    @property
    def events(self) -> tuple[TeamEvent, ...]:
        return self._events

    @property
    def head_hash(self) -> str:
        return self._parent_hash

    def register_actor(self, actor_id: str) -> None:
        if not isinstance(actor_id, str) or not actor_id.strip():
            raise ValueError("actor_id must be canonical")
        self._actors.add(actor_id)

    def append(self, event: TeamEvent) -> TeamEvent:
        if event.session_id != self.session.session_id:
            raise ValueError("event session_id mismatch")
        if event.event_id in self._event_ids:
            raise ValueError("duplicate event_id")
        if event.sequence != len(self._events) + 1:
            raise ValueError("event sequence is not append-only")
        if event.parent_hash != self._parent_hash:
            raise ValueError("stale parent hash")
        if event.actor_id not in self._actors:
            raise PermissionError("actor is not a session member")
        self._events += (event,); self._event_ids.add(event.event_id); self._parent_hash = event.event_hash
        return event


@dataclass(frozen=True, slots=True)
class TeamProgressProjection:
    session_id: str
    revision: int
    completed_task_ids: tuple[str, ...]
    delivered_message_ids: tuple[str, ...]
    conversation_turn_ids: tuple[str, ...]
    last_event_hash: str

    @classmethod
    def initial(cls, session: TeamSession) -> "TeamProgressProjection":
        return cls(session.session_id, 0, (), (), (), canonical_hash(session))

    @classmethod
    def replay(cls, session: TeamSession, events: Iterable[TeamEvent]) -> "TeamProgressProjection":
        projection = cls.initial(session)
        completed = list(projection.completed_task_ids); messages = list(projection.delivered_message_ids); turns = list(projection.conversation_turn_ids)
        for event in events:
            if event.sequence != projection.revision + 1:
                raise ValueError("event history sequence is not contiguous")
            if event.session_id != session.session_id or event.parent_hash != projection.last_event_hash:
                raise ValueError("event history has stale or foreign parent")
            if event.actor_id not in session.memberships:
                raise PermissionError("event actor is not a session member")
            if event.event_type is TeamEventType.TASK_UPDATED and event.payload.get("status") == "COMPLETED":
                if event.subject_id in completed: raise ValueError("duplicate task progress")
                completed.append(event.subject_id)
            elif event.event_type is TeamEventType.MESSAGE_APPENDED:
                if event.payload.get("session_id", session.session_id) != session.session_id:
                    raise ValueError("message projection has foreign session")
                if event.subject_id in messages: raise ValueError("duplicate message progress")
                messages.append(event.subject_id)
            elif event.event_type is TeamEventType.TURN_APPENDED:
                if event.payload.get("session_id", session.session_id) != session.session_id:
                    raise ValueError("conversation projection has foreign session")
                if event.subject_id in turns: raise ValueError("duplicate conversation turn")
                turns.append(event.subject_id)
            projection = cls(session.session_id, projection.revision + 1, tuple(completed), tuple(messages), tuple(turns), event.event_hash)
        return projection


def validate_schema_identity(schema: Any, *, session_id: str, actor_id: str, parent_hash: str) -> str:
    """Common fail-closed guard for schemas entering the collaboration log."""
    if not isinstance(session_id, str) or not session_id.strip() or not isinstance(actor_id, str) or not actor_id.strip():
        raise ValueError("session and actor identity are required")
    _parent_hash(parent_hash)
    if getattr(schema, "session_id", None) != session_id:
        raise ValueError("schema session identity mismatch")
    return canonical_hash(schema)
