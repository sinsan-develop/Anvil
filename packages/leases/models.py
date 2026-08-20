"""Immutable worker and write lease values."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class WorkerLease:
    run_id: str
    worker_id: str
    lease_epoch: int
    execution_fencing_token: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class WriteLease:
    run_id: str
    conflict_scope_key: str
    write_epoch: int
    write_fencing_token: str
    execution_fencing_token: str
    expires_at: datetime
