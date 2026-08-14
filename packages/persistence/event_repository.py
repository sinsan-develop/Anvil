"""Persistence port for append-only Run events."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from packages.events.models import StoredEvent


@runtime_checkable
class EventRepository(Protocol):
    def events_for(self, run_id: str) -> tuple[StoredEvent, ...]: ...

    def by_event_id(self, event_id: str) -> StoredEvent | None: ...

    def by_idempotency_key(self, run_id: str, key: str) -> StoredEvent | None: ...

    def append(self, event: StoredEvent) -> None: ...
