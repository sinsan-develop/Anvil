"""Immutable durable queue values."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import Enum


class QueueStatus(str, Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    SUCCEEDED = "SUCCEEDED"
    QUARANTINED = "QUARANTINED"


@dataclass(frozen=True, slots=True)
class QueueJob:
    job_id: str
    run_id: str
    payload: str
    available_at: datetime
    max_attempts: int
    status: QueueStatus = QueueStatus.PENDING
    attempts: int = 0
    lease_epoch: int = 0
    execution_fencing_token: str | None = None
    lease_expires_at: datetime | None = None
    graph_id: str | None = None
    graph_hash: str | None = None
    dependency_ids: tuple[str, ...] = ()
    conflict_keys: tuple[str, ...] = ()
    input_verified: bool = True
    completed_token_hash: str | None = None

    def __post_init__(self) -> None:
        if not self.job_id or not self.run_id or not self.payload:
            raise ValueError("queue identity and payload must be non-empty")
        if self.max_attempts < 1 or self.attempts < 0 or self.lease_epoch < 0:
            raise ValueError("queue attempt and lease counters must be non-negative")
        if self.available_at.tzinfo is None:
            raise ValueError("available_at must be timezone-aware")
        for values in (self.dependency_ids, self.conflict_keys):
            if type(values) is not tuple or len(values) != len(set(values)) or any(type(v) is not str or not v for v in values):
                raise ValueError("queue dependencies/conflicts must be immutable unique identities")
        if type(self.input_verified) is not bool or self.job_id in self.dependency_ids:
            raise ValueError("invalid queue dependency/input contract")

    def replace(self, **changes: object) -> "QueueJob":
        return replace(self, **changes)


@dataclass(frozen=True, slots=True)
class QueueClaim:
    job_id: str
    worker_id: str
    lease_epoch: int
    execution_fencing_token: str
    lease_expires_at: datetime


@dataclass(frozen=True, slots=True)
class QuarantinedJob:
    job_id: str
    attempts: int
    reason: str
    quarantined_at: datetime
