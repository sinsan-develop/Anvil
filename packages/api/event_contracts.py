"""Framework-neutral Event Store application boundary."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping

from packages.events.models import EventCommand
from packages.events.store import DuplicateRequestConflict, RunEventStore
from packages.events.transition_guard import OptimisticVersionConflict


class EventConflictCode(str, Enum):
    OPTIMISTIC_VERSION_CONFLICT = "OPTIMISTIC_VERSION_CONFLICT"
    DUPLICATE_REQUEST_CONFLICT = "DUPLICATE_REQUEST_CONFLICT"


class EventConflict(ValueError):
    def __init__(self, code: EventConflictCode, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class EventMutationRequest:
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
    blocked_code: str | None = None

    @classmethod
    def from_command(cls, command: EventCommand) -> "EventMutationRequest":
        code = command.blocked_code
        return cls(
            command.event_id,
            command.run_id,
            command.event_type,
            command.actor_type,
            command.actor_id,
            command.correlation_id,
            command.causation_event_id,
            command.idempotency_key,
            command.expected_version,
            command.payload,
            command.created_at,
            code.value if hasattr(code, "value") else code,
        )

    def to_command(self) -> EventCommand:
        return EventCommand(
            self.event_id,
            self.run_id,
            self.event_type,
            self.actor_type,
            self.actor_id,
            self.correlation_id,
            self.causation_event_id,
            self.idempotency_key,
            self.expected_version,
            self.payload,
            self.created_at,
            self.blocked_code,
        )


@dataclass(frozen=True, slots=True)
class EventMutationResult:
    event_id: str
    sequence_no: int
    version: int
    phase: str
    status: str
    duplicate: bool


class EventApplicationService:
    def __init__(self, store: RunEventStore) -> None:
        self._store = store

    def mutate(self, request: EventMutationRequest) -> EventMutationResult:
        try:
            receipt = self._store.append(request.to_command())
        except OptimisticVersionConflict as error:
            raise EventConflict(EventConflictCode.OPTIMISTIC_VERSION_CONFLICT, str(error)) from error
        except DuplicateRequestConflict as error:
            raise EventConflict(EventConflictCode.DUPLICATE_REQUEST_CONFLICT, str(error)) from error
        return EventMutationResult(
            event_id=receipt.event.event_id,
            sequence_no=receipt.event.sequence_no,
            version=receipt.projection.version,
            phase=receipt.projection.phase,
            status=receipt.projection.status,
            duplicate=receipt.duplicate,
        )
