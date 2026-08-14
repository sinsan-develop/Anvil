"""Immutable models for append-only Run events and projections."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Any, Mapping

from packages.domain.states import BlockedCode


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): _freeze(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, (set, frozenset)):
        return frozenset(_freeze(item) for item in value)
    return value


@dataclass(frozen=True, slots=True)
class EventCommand:
    event_id: str
    run_id: str
    event_type: str
    actor_type: str
    actor_id: str
    correlation_id: str
    causation_event_id: str | None
    idempotency_key: str
    expected_version: int
    payload: Mapping[str, Any]
    created_at: datetime
    blocked_code: BlockedCode | str | None = None

    def __post_init__(self) -> None:
        for value, field in (
            (self.event_id, "event_id"),
            (self.run_id, "run_id"),
            (self.event_type, "event_type"),
            (self.actor_type, "actor_type"),
            (self.actor_id, "actor_id"),
            (self.correlation_id, "correlation_id"),
            (self.idempotency_key, "idempotency_key"),
        ):
            _required(value, field)
        if self.causation_event_id is not None:
            _required(self.causation_event_id, "causation_event_id")
        if type(self.expected_version) is not int or self.expected_version < 0:
            raise ValueError("expected_version must be a non-negative integer")
        if not isinstance(self.created_at, datetime) or self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("created_at must be timezone-aware")
        if not isinstance(self.payload, Mapping):
            raise TypeError("payload must be a mapping")
        object.__setattr__(self, "payload", _freeze(self.payload))


@dataclass(frozen=True, slots=True)
class StoredEvent:
    event_id: str
    run_id: str
    sequence_no: int
    event_type: str
    actor_type: str
    actor_id: str
    correlation_id: str
    causation_event_id: str | None
    idempotency_key: str
    expected_version: int
    applied_version: int
    payload: Mapping[str, Any]
    request_hash: str
    created_at: datetime
    blocked_code: BlockedCode | None = None

    def __post_init__(self) -> None:
        if type(self.sequence_no) is not int or self.sequence_no < 1:
            raise ValueError("sequence_no must be positive")
        if type(self.applied_version) is not int or self.applied_version < 1:
            raise ValueError("applied_version must be positive")
        object.__setattr__(self, "payload", _freeze(self.payload))


@dataclass(frozen=True, slots=True)
class RunProjection:
    run_id: str
    phase: str
    status: str
    version: int
    blocked_code: BlockedCode | None
    artifacts: tuple[str, ...]

    @classmethod
    def initial(cls, run_id: str) -> "RunProjection":
        _required(run_id, "run_id")
        return cls(run_id, "DRAFT", "ACTIVE", 0, None, ())


@dataclass(frozen=True, slots=True)
class AppendReceipt:
    event: StoredEvent
    projection: RunProjection
    duplicate: bool = False
