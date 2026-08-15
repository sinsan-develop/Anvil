"""Persistence port for Event-bound progress outbox and snapshots."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from packages.outbox.models import OwnerType, OutboxReceipt, ProgressExportRequest
    from packages.progress.models import ProgressSnapshot


@runtime_checkable
class ProgressOutboxRepository(Protocol):
    def commit_event_and_enqueue(self, request: ProgressExportRequest) -> OutboxReceipt: ...

    def outbox_by_id(self, outbox_id: str) -> OutboxReceipt: ...

    def outbox_by_request_id(self, request_id: str) -> OutboxReceipt | None: ...

    def record_snapshot_and_ack(
        self,
        outbox_id: str,
        snapshot: ProgressSnapshot | str,
        created_at: datetime | None = None,
    ) -> ProgressSnapshot: ...

    def mark_persistence_error(self, outbox_id: str) -> OutboxReceipt: ...

    def is_acknowledged(self, owner_type: OwnerType, owner_id: str, event_sequence: int) -> bool: ...
