"""Persistence ports for DB-time queue claims and fencing leases."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Protocol, runtime_checkable

from packages.leases.models import WorkerLease, WriteLease
from packages.queue.models import QueueClaim, QueueJob


@runtime_checkable
class QueueLeaseRepository(Protocol):
    def enqueue(self, job: QueueJob) -> None: ...

    def claim_next(self, worker_id: str, db_now: datetime, visibility_timeout: timedelta) -> QueueClaim | None: ...

    def issue_worker_lease(self, run_id: str, worker_id: str, db_now: datetime, ttl: timedelta) -> WorkerLease: ...

    def issue_write_lease(self, worker: WorkerLease, conflict_scope_key: str, db_now: datetime, ttl: timedelta) -> WriteLease: ...
