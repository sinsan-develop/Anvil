"""Immutable domain events."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping

from .identifiers import AggregateId, EventId


class EventType(str, Enum):
    TASK_CONFIRMED = "TASK_CONFIRMED"
    ANALYSIS_COMPLETED = "ANALYSIS_COMPLETED"
    EXECUTION_PLAN_PROPOSED = "EXECUTION_PLAN_PROPOSED"
    EXECUTION_PLAN_APPROVED = "EXECUTION_PLAN_APPROVED"
    WORKSPACE_READY = "WORKSPACE_READY"
    IMPLEMENTATION_COMPLETED = "IMPLEMENTATION_COMPLETED"
    REQUIRED_GATES_PASSED = "REQUIRED_GATES_PASSED"
    REVIEW_APPROVED = "REVIEW_APPROVED"
    RELEASE_DECIDED = "RELEASE_DECIDED"
    APPLY_APPROVED = "APPLY_APPROVED"
    POST_APPLY_VERIFIED = "POST_APPLY_VERIFIED"


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, (set, frozenset)):
        return frozenset(_freeze(item) for item in value)
    return value


@dataclass(frozen=True, slots=True)
class DomainEvent:
    event_id: EventId
    aggregate_id: AggregateId
    sequence: int
    type: EventType
    occurred_at: datetime
    actor: str
    payload: Mapping[str, Any]

    def __post_init__(self) -> None:
        if not isinstance(self.sequence, int) or isinstance(self.sequence, bool) or self.sequence < 1:
            raise ValueError("sequence must be a positive integer")
        if not isinstance(self.type, EventType):
            raise TypeError("type must be EventType")
        if self.occurred_at.tzinfo is None or self.occurred_at.utcoffset() is None:
            raise ValueError("occurred_at must be timezone-aware")
        if not isinstance(self.actor, str) or not self.actor.strip():
            raise ValueError("actor must be non-empty")
        object.__setattr__(self, "payload", _freeze(self.payload))
