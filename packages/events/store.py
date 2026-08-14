"""Append-only event service with idempotent receipts and optimistic locking."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from hashlib import sha256
import json
from typing import Any, Mapping

from packages.persistence.event_repository import EventRepository

from .models import AppendReceipt, BlockedCode, EventCommand, RunProjection, StoredEvent
from .reducer import EventReducer
from .transition_guard import TransitionGuard


class EventStoreError(ValueError):
    pass


class DuplicateRequestConflict(EventStoreError):
    pass


def _plain(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in sorted(value.items())}
    if isinstance(value, (tuple, list)):
        return [_plain(item) for item in value]
    if isinstance(value, (set, frozenset)):
        return sorted(_plain(item) for item in value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, BlockedCode):
        return value.value
    return value


def request_hash(command: EventCommand) -> str:
    canonical = {
        "event_id": command.event_id,
        "run_id": command.run_id,
        "event_type": command.event_type,
        "actor_type": command.actor_type,
        "actor_id": command.actor_id,
        "correlation_id": command.correlation_id,
        "causation_event_id": command.causation_event_id,
        "idempotency_key": command.idempotency_key,
        "expected_version": command.expected_version,
        "payload": _plain(command.payload),
        "created_at": command.created_at,
        "blocked_code": command.blocked_code,
    }
    encoded = json.dumps(_plain(canonical), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{sha256(encoded).hexdigest()}"


class InMemoryEventRepository:
    def __init__(self) -> None:
        self._events: dict[str, tuple[StoredEvent, ...]] = {}
        self._event_ids: dict[str, StoredEvent] = {}
        self._idempotency: dict[tuple[str, str], StoredEvent] = {}

    def events_for(self, run_id: str) -> tuple[StoredEvent, ...]:
        return self._events.get(run_id, ())

    def by_event_id(self, event_id: str) -> StoredEvent | None:
        return self._event_ids.get(event_id)

    def by_idempotency_key(self, run_id: str, key: str) -> StoredEvent | None:
        return self._idempotency.get((run_id, key))

    def append(self, event: StoredEvent) -> None:
        if event.event_id in self._event_ids or (event.run_id, event.idempotency_key) in self._idempotency:
            raise DuplicateRequestConflict("event_id or idempotency_key already exists")
        current = self.events_for(event.run_id)
        if event.sequence_no != len(current) + 1:
            raise EventStoreError("sequence_no must be current event count plus one")
        self._events[event.run_id] = current + (event,)
        self._event_ids[event.event_id] = event
        self._idempotency[(event.run_id, event.idempotency_key)] = event


class RunEventStore:
    def __init__(
        self,
        repository: EventRepository,
        reducer: EventReducer | None = None,
        guard: TransitionGuard | None = None,
    ) -> None:
        self._repository = repository
        self._reducer = reducer or EventReducer()
        self._guard = guard or TransitionGuard()
        self._projections: dict[str, RunProjection] = {}
        self._receipts: dict[str, AppendReceipt] = {}

    def projection_for(self, run_id: str) -> RunProjection:
        return self._projections.get(run_id, RunProjection.initial(run_id))

    def append(self, command: EventCommand) -> AppendReceipt:
        fingerprint = request_hash(command)
        by_event = self._repository.by_event_id(command.event_id)
        by_key = self._repository.by_idempotency_key(command.run_id, command.idempotency_key)
        if by_event is not None or by_key is not None:
            if by_event is None or by_key is None or by_event != by_key or by_event.request_hash != fingerprint:
                raise DuplicateRequestConflict("duplicate identifier has a different canonical request")
            original = self._receipts.get(by_event.event_id)
            if original is None:
                history = self._repository.events_for(command.run_id)
                original_history = history[: by_event.sequence_no]
                original_projection = self._reducer.replay(command.run_id, original_history)
                self._projections[command.run_id] = self._reducer.replay(command.run_id, history)
                original = AppendReceipt(by_event, original_projection)
                self._receipts[by_event.event_id] = original
            return replace(original, duplicate=True)

        projection = self.projection_for(command.run_id)
        self._guard.validate(projection, command)
        blocked_code = None
        if command.event_type == "RUN_BLOCKED":
            blocked_code = self._guard.blocked_code(command.blocked_code)
        event = StoredEvent(
            event_id=command.event_id,
            run_id=command.run_id,
            sequence_no=len(self._repository.events_for(command.run_id)) + 1,
            event_type=command.event_type,
            actor_type=command.actor_type,
            actor_id=command.actor_id,
            correlation_id=command.correlation_id,
            causation_event_id=command.causation_event_id,
            idempotency_key=command.idempotency_key,
            expected_version=command.expected_version,
            applied_version=projection.version + 1,
            payload=command.payload,
            request_hash=fingerprint,
            created_at=command.created_at,
            blocked_code=blocked_code,
        )
        self._repository.append(event)
        next_projection = self._reducer.reduce(projection, event)
        self._projections[command.run_id] = next_projection
        receipt = AppendReceipt(event, next_projection)
        self._receipts[event.event_id] = receipt
        return receipt
