"""At-least-once durable queue reference service.

The persistence adapter owns the production DB-time conditional claim; this
small implementation preserves the same state and fencing contract for tests.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Callable

from .models import QueueClaim, QueueJob, QueueStatus, QuarantinedJob


class QueueError(ValueError):
    pass


class QueueTokenError(QueueError):
    code = "STALE_FENCING_TOKEN"


class DurableQueue:
    def __init__(self, *, token_factory: Callable[[], str] = lambda: token_urlsafe(32)) -> None:
        self._token_factory = token_factory
        self._jobs: dict[str, QueueJob] = {}
        self._quarantine: list[QuarantinedJob] = []

    def enqueue(self, job: QueueJob) -> None:
        if job.job_id in self._jobs:
            raise QueueError("duplicate queue job")
        self._jobs[job.job_id] = job

    def get(self, job_id: str) -> QueueJob:
        return self._jobs[job_id]

    def claim(self, worker_id: str, now: datetime, *, visibility_timeout: timedelta) -> QueueClaim | None:
        if not worker_id or visibility_timeout <= timedelta(0):
            raise ValueError("worker_id and a positive visibility timeout are required")
        self.recover_expired(now)
        candidates = sorted(
            (job for job in self._jobs.values() if job.status is QueueStatus.PENDING and job.available_at <= now),
            key=lambda job: (job.available_at, job.job_id),
        )
        if not candidates:
            return None
        job = candidates[0]
        token = self._token_factory()
        if not token:
            raise QueueError("execution fencing token must be non-empty")
        expires_at = now + visibility_timeout
        updated = job.replace(
            status=QueueStatus.CLAIMED,
            attempts=job.attempts + 1,
            lease_epoch=job.lease_epoch + 1,
            execution_fencing_token=token,
            lease_expires_at=expires_at,
        )
        self._jobs[job.job_id] = updated
        return QueueClaim(job.job_id, worker_id, updated.lease_epoch, token, expires_at)

    def heartbeat(self, job_id: str, token: str, now: datetime, *, visibility_timeout: timedelta) -> QueueJob:
        job = self._require_current(job_id, token, now)
        renewed = job.replace(lease_expires_at=now + visibility_timeout)
        self._jobs[job_id] = renewed
        return renewed

    def complete(self, job_id: str, token: str, now: datetime) -> QueueJob:
        job = self._require_current(job_id, token, now)
        completed = job.replace(status=QueueStatus.SUCCEEDED, execution_fencing_token=None, lease_expires_at=None)
        self._jobs[job_id] = completed
        return completed

    def fail(self, job_id: str, token: str, now: datetime, reason: str) -> QueueJob:
        if not reason:
            raise ValueError("failure reason is required")
        job = self._require_current(job_id, token, now)
        if job.attempts >= job.max_attempts:
            quarantined = job.replace(status=QueueStatus.QUARANTINED, execution_fencing_token=None, lease_expires_at=None)
            self._jobs[job_id] = quarantined
            self._quarantine.append(QuarantinedJob(job_id, job.attempts, reason, now))
            return quarantined
        retried = job.replace(status=QueueStatus.PENDING, available_at=now, execution_fencing_token=None, lease_expires_at=None)
        self._jobs[job_id] = retried
        return retried

    def recover_expired(self, now: datetime) -> tuple[str, ...]:
        recovered: list[str] = []
        for job in tuple(self._jobs.values()):
            if job.status is QueueStatus.CLAIMED and job.lease_expires_at is not None and job.lease_expires_at < now:
                if job.attempts >= job.max_attempts:
                    self._jobs[job.job_id] = job.replace(
                        status=QueueStatus.QUARANTINED,
                        execution_fencing_token=None,
                        lease_expires_at=None,
                    )
                    self._quarantine.append(
                        QuarantinedJob(job.job_id, job.attempts, "VISIBILITY_TIMEOUT_MAX_ATTEMPTS", now)
                    )
                else:
                    self._jobs[job.job_id] = job.replace(
                        status=QueueStatus.PENDING,
                        available_at=now,
                        execution_fencing_token=None,
                        lease_expires_at=None,
                    )
                recovered.append(job.job_id)
        return tuple(recovered)

    def quarantine(self) -> tuple[QuarantinedJob, ...]:
        return tuple(self._quarantine)

    def _require_current(self, job_id: str, token: str, now: datetime) -> QueueJob:
        job = self._jobs[job_id]
        if (
            job.status is not QueueStatus.CLAIMED
            or job.execution_fencing_token != token
            or job.lease_expires_at is None
            or job.lease_expires_at < now
        ):
            raise QueueTokenError("current execution fencing token is required")
        return job
