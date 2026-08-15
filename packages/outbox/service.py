"""Transactional Event plus progress outbox enqueue and scheduling guard."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from uuid import uuid4

from packages.persistence.progress_outbox_repository import ProgressOutboxRepository
from packages.progress.models import ProgressSnapshot

from .models import OwnerType, OutboxReceipt, OutboxStatus, ProgressExportRequest


class ProgressOutboxError(ValueError):
    pass


class DuplicateProgressRequestConflict(ProgressOutboxError):
    pass


class ProgressSequenceError(ProgressOutboxError):
    pass


class ProgressExportPending(ProgressOutboxError):
    code = "PROGRESS_EXPORT_PENDING"


class InMemoryProgressOutboxRepository:
    """Reference repository whose copied state models a DB transaction boundary."""

    def __init__(self) -> None:
        self._events: dict[tuple[OwnerType, str], tuple[str, ...]] = {}
        self._outboxes: dict[str, OutboxReceipt] = {}
        self._requests: dict[str, str] = {}
        self._idempotency: dict[tuple[OwnerType, str, str], str] = {}
        self._sequences: dict[tuple[OwnerType, str, int], str] = {}
        self._snapshots: dict[tuple[OwnerType, str], tuple[ProgressSnapshot, ...]] = {}
        self.fail_next_enqueue = False
        self.fail_next_ack = False

    def event_ids(self, owner_type: OwnerType, owner_id: str) -> tuple[str, ...]:
        return self._events.get((owner_type, owner_id), ())

    def outbox_by_id(self, outbox_id: str) -> OutboxReceipt:
        return self._outboxes[outbox_id]

    def outbox_by_request_id(self, request_id: str) -> OutboxReceipt | None:
        outbox_id = self._requests.get(request_id)
        return None if outbox_id is None else self._outboxes[outbox_id]

    def snapshots_for(self, owner_type: OwnerType, owner_id: str) -> tuple[ProgressSnapshot, ...]:
        return self._snapshots.get((owner_type, owner_id), ())

    def commit_event_and_enqueue(self, request: ProgressExportRequest) -> OutboxReceipt:
        owner = (request.owner_type, request.owner_id)
        key = (request.owner_type, request.owner_id, request.idempotency_key)
        sequence_key = (request.owner_type, request.owner_id, request.event_sequence)
        duplicate_ids = {
            item for item in (self._requests.get(request.request_id), self._idempotency.get(key), self._sequences.get(sequence_key)) if item is not None
        }
        if duplicate_ids:
            if len(duplicate_ids) != 1:
                raise DuplicateProgressRequestConflict("progress identifiers resolve to different requests")
            existing = self._outboxes[next(iter(duplicate_ids))]
            if existing.request_hash != request.canonical_hash:
                if existing.request.event_sequence == request.event_sequence and existing.request.request_id != request.request_id:
                    raise ProgressSequenceError("event sequence cannot repeat")
                raise DuplicateProgressRequestConflict("duplicate progress identifier has a different canonical request")
            return replace(existing, duplicate=True)

        history = self._events.get(owner, ())
        owner_sequences = sorted(sequence for kind, identifier, sequence in self._sequences if (kind, identifier) == owner)
        if owner_sequences and request.event_sequence != owner_sequences[-1] + 1:
            raise ProgressSequenceError("event sequence must increase by exactly one")

        previous_events = self._events.copy()
        previous_outboxes = self._outboxes.copy()
        previous_requests = self._requests.copy()
        previous_idempotency = self._idempotency.copy()
        previous_sequences = self._sequences.copy()
        try:
            self._events[owner] = history + (request.event_id,)
            if self.fail_next_enqueue:
                self.fail_next_enqueue = False
                raise RuntimeError("injected outbox enqueue failure")
            outbox_id = f"outbox-{uuid4().hex}"
            receipt = OutboxReceipt(outbox_id, request, request.canonical_hash, OutboxStatus.PENDING, 0)
            self._outboxes[outbox_id] = receipt
            self._requests[request.request_id] = outbox_id
            self._idempotency[key] = outbox_id
            self._sequences[sequence_key] = outbox_id
            return receipt
        except Exception:
            self._events = previous_events
            self._outboxes = previous_outboxes
            self._requests = previous_requests
            self._idempotency = previous_idempotency
            self._sequences = previous_sequences
            raise

    def record_snapshot_and_ack(
        self,
        outbox_id: str,
        snapshot: ProgressSnapshot | str,
        created_at: datetime | None = None,
    ) -> ProgressSnapshot:
        receipt = self._outboxes[outbox_id]
        if self.fail_next_ack:
            self.fail_next_ack = False
            raise RuntimeError("injected snapshot/ack failure")
        request = receipt.request
        owner = (request.owner_type, request.owner_id)
        existing = tuple(item for item in self._snapshots.get(owner, ()) if item.event_sequence == request.event_sequence)
        if existing:
            current = existing[0]
            if isinstance(snapshot, ProgressSnapshot) and current != snapshot:
                raise DuplicateProgressRequestConflict("snapshot sequence has different content")
            self._outboxes[outbox_id] = replace(receipt, status=OutboxStatus.ACKNOWLEDGED)
            return current
        if isinstance(snapshot, str):
            if created_at is None:
                raise ValueError("created_at is required with a snapshot hash")
            snapshot = ProgressSnapshot(
                snapshot_id=f"snapshot-{uuid4().hex}",
                outbox_id=outbox_id,
                owner_type=request.owner_type,
                owner_id=request.owner_id,
                event_sequence=request.event_sequence,
                payload_hash=request.payload_hash,
                json_hash=snapshot,
                handoff_hash=snapshot,
                export_uri=request.export_uri,
                created_at=created_at,
            )
        self._snapshots[owner] = self._snapshots.get(owner, ()) + (snapshot,)
        self._outboxes[outbox_id] = replace(receipt, status=OutboxStatus.ACKNOWLEDGED)
        return snapshot

    def mark_persistence_error(self, outbox_id: str) -> OutboxReceipt:
        receipt = self._outboxes[outbox_id]
        failed = replace(
            receipt,
            status=OutboxStatus.PERSISTENCE_ERROR,
            retry_count=receipt.retry_count + 1,
        )
        self._outboxes[outbox_id] = failed
        return failed

    def is_acknowledged(self, owner_type: OwnerType, owner_id: str, event_sequence: int) -> bool:
        outbox_id = self._sequences.get((owner_type, owner_id, event_sequence))
        return outbox_id is not None and self._outboxes[outbox_id].status is OutboxStatus.ACKNOWLEDGED


class TransactionalOutboxService:
    def __init__(self, repository: ProgressOutboxRepository) -> None:
        self._repository = repository

    def commit_event_and_enqueue(self, request: ProgressExportRequest) -> OutboxReceipt:
        return self._repository.commit_event_and_enqueue(request)

    def require_export_acknowledged(self, owner_type: OwnerType, owner_id: str, event_sequence: int) -> None:
        if not self._repository.is_acknowledged(owner_type, owner_id, event_sequence):
            raise ProgressExportPending("progress export must be acknowledged before follow-up scheduling")

    def is_follow_up_allowed(self, owner_type: OwnerType, owner_id: str, event_sequence: int) -> bool:
        return self._repository.is_acknowledged(owner_type, owner_id, event_sequence)
