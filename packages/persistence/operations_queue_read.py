"""Bounded, project/environment-scoped PostgreSQL queue observations.

The caller supplies a trusted SQLAlchemy Engine and an already authorized
scope. This module never claims jobs, mutates durable rows, or reads payloads
and fencing tokens.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re

from sqlalchemy import text
from sqlalchemy.engine import Engine

from packages.queue.models import QuarantinedJob, QueueStatus


_MAX_ROWS = 100
_SAFE_REASON = re.compile(r"[A-Z][A-Z0-9_]{0,63}\Z")


@dataclass(frozen=True, slots=True)
class QueueObservation:
    job_id: str
    run_id: str
    status: QueueStatus
    available_at: datetime
    attempts: int
    max_attempts: int
    lease_epoch: int
    lease_expires_at: datetime | None
    dependency_ids: tuple[str, ...]
    conflict_keys: tuple[str, ...]
    input_verified: bool


@dataclass(frozen=True, slots=True)
class ScopedQueueSource:
    job_ids: tuple[str, ...]
    observed_at: datetime
    legacy_unscoped_present: bool
    _jobs: dict[str, QueueObservation]
    _quarantine: tuple[QuarantinedJob, ...]

    def get(self, job_id: str) -> QueueObservation:
        return self._jobs[job_id]

    def quarantine(self) -> tuple[QuarantinedJob, ...]:
        return self._quarantine


_JOBS_SQL = text("""SELECT durable_queue_jobs.job_id, durable_queue_jobs.run_id,
    durable_queue_jobs.status, durable_queue_jobs.available_at,
    durable_queue_jobs.attempts, durable_queue_jobs.max_attempts,
    durable_queue_jobs.lease_epoch, durable_queue_jobs.lease_expires_at,
    durable_queue_jobs.dependency_ids, durable_queue_jobs.conflict_keys,
    durable_queue_jobs.input_verified
FROM durable_queue_jobs
JOIN runs ON runs.run_id = durable_queue_jobs.run_id
JOIN tasks ON tasks.task_id = runs.task_id
WHERE tasks.project_id = :project_id AND runs.environment_id = :environment_id
ORDER BY durable_queue_jobs.job_id LIMIT 101""")

_QUARANTINE_SQL = text("""SELECT queue_quarantine.job_id, queue_quarantine.attempts,
    queue_quarantine.reason, queue_quarantine.quarantined_at
FROM queue_quarantine
JOIN durable_queue_jobs ON queue_quarantine.job_id = durable_queue_jobs.job_id
JOIN runs ON runs.run_id = durable_queue_jobs.run_id
JOIN tasks ON tasks.task_id = runs.task_id
WHERE tasks.project_id = :project_id AND runs.environment_id = :environment_id
ORDER BY queue_quarantine.job_id LIMIT 101""")

_LEGACY_SQL = text("""SELECT EXISTS (
    SELECT 1 FROM runs
    JOIN tasks ON tasks.task_id = runs.task_id
    WHERE tasks.project_id = :project_id AND runs.environment_id IS NULL
) AS legacy_unscoped_present""")


def _identity(value: str) -> bool:
    return type(value) is str and bool(value) and value == value.strip() and len(value) <= 128


def _observation(row) -> QueueObservation:
    return QueueObservation(
        job_id=row["job_id"], run_id=row["run_id"], status=QueueStatus(row["status"]),
        available_at=row["available_at"], attempts=row["attempts"],
        max_attempts=row["max_attempts"], lease_epoch=row["lease_epoch"],
        lease_expires_at=row["lease_expires_at"],
        dependency_ids=tuple(row["dependency_ids"]),
        conflict_keys=tuple(row["conflict_keys"]), input_verified=row["input_verified"],
    )


def load_scoped_queue_source(
    engine: Engine, project_id: str, environment_id: str,
) -> ScopedQueueSource:
    """Materialize one bounded, read-only repeatable-read observation.

    A NULL-environment legacy job is flagged for the host to withhold any
    complete queue count. Database or malformed-row errors expose only a
    stable unavailable code, never an SQL driver message or stored secret.
    """
    if not _identity(project_id) or not _identity(environment_id):
        raise ValueError("QUEUE_SOURCE_SCOPE_INVALID")
    params = {"project_id": project_id, "environment_id": environment_id}
    try:
        with engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                connection.execute(text("SET TRANSACTION READ ONLY"))
                observed_at = connection.execute(
                    text("SELECT CURRENT_TIMESTAMP AS observed_at")
                ).mappings().one()["observed_at"]
                job_rows = connection.execute(_JOBS_SQL, params).mappings().all()
                if len(job_rows) > _MAX_ROWS:
                    raise ValueError("QUEUE_SOURCE_LIMIT_EXCEEDED")
                quarantine_rows = connection.execute(_QUARANTINE_SQL, params).mappings().all()
                if len(quarantine_rows) > _MAX_ROWS:
                    raise ValueError("QUEUE_SOURCE_LIMIT_EXCEEDED")
                legacy = connection.execute(_LEGACY_SQL, params).mappings().one()[
                    "legacy_unscoped_present"
                ]
        jobs = tuple(_observation(row) for row in job_rows)
        quarantine = tuple(
            QuarantinedJob(
                row["job_id"], row["attempts"],
                row["reason"] if _SAFE_REASON.fullmatch(row["reason"]) else "OWNER_REPORTED",
                row["quarantined_at"],
            )
            for row in quarantine_rows
        )
        return ScopedQueueSource(
            job_ids=tuple(job.job_id for job in jobs), observed_at=observed_at,
            legacy_unscoped_present=bool(legacy),
            _jobs={job.job_id: job for job in jobs}, _quarantine=quarantine,
        )
    except ValueError as exc:
        if str(exc) == "QUEUE_SOURCE_LIMIT_EXCEEDED":
            raise
        raise RuntimeError("QUEUE_SOURCE_UNAVAILABLE") from None
    except Exception:
        raise RuntimeError("QUEUE_SOURCE_UNAVAILABLE") from None
