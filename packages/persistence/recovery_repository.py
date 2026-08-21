"""Persistence port and deterministic in-memory recovery repository."""

from __future__ import annotations

from threading import RLock
from typing import Protocol, runtime_checkable

from packages.recovery.models import (
    RecoveryAuditEvent,
    RecoveryDecision,
    RecoveryInput,
    ResumeLease,
    ResumeReceipt,
    StaleRecoveryFencingToken,
)


@runtime_checkable
class RecoveryRepository(Protocol):
    def load(self, run_id: str) -> RecoveryInput: ...

    def save_decision(self, decision: RecoveryDecision) -> None: ...

    def append_audit(self, event: RecoveryAuditEvent) -> None: ...


class InMemoryRecoveryRepository:
    def __init__(self) -> None:
        self._lock = RLock()
        self._inputs: dict[str, RecoveryInput] = {}
        self._decisions: dict[str, RecoveryDecision] = {}
        self._audits: dict[str, list[RecoveryAuditEvent]] = {}
        self._leases: dict[str, ResumeLease] = {}
        self._receipts: dict[str, ResumeReceipt] = {}

    def seed(self, source: RecoveryInput) -> None:
        with self._lock:
            self._inputs[source.run_id] = source

    def load(self, run_id: str) -> RecoveryInput:
        with self._lock:
            return self._inputs[run_id]

    def save_decision(self, decision: RecoveryDecision) -> None:
        with self._lock:
            self._decisions[decision.run_id] = decision

    def decision(self, run_id: str) -> RecoveryDecision | None:
        with self._lock:
            return self._decisions.get(run_id)

    def append_audit(self, event: RecoveryAuditEvent) -> None:
        with self._lock:
            self._audits.setdefault(event.run_id, []).append(event)

    def audit_events(self, run_id: str) -> tuple[RecoveryAuditEvent, ...]:
        with self._lock:
            return tuple(self._audits.get(run_id, ()))

    def set_current_lease(self, lease: ResumeLease) -> None:
        with self._lock:
            current = self._leases.get(lease.run_id)
            if current is not None and (
                lease.worker_epoch <= current.worker_epoch or lease.write_epoch <= current.write_epoch
            ):
                raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN")
            self._leases[lease.run_id] = lease

    def commit_resume(
        self, run_id: str, lease: ResumeLease, checkpoint_id: str
    ) -> ResumeReceipt:
        with self._lock:
            current = self._leases.get(run_id)
            if current != lease or lease.run_id != run_id:
                raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN")
            existing = self._receipts.get(run_id)
            proposed = ResumeReceipt(run_id, lease.worker_epoch, checkpoint_id)
            if existing is not None:
                if existing != proposed:
                    raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN")
                return existing
            self._receipts[run_id] = proposed
            return proposed

