"""Bounded, project/environment-scoped PostgreSQL Run observation.

The caller supplies a trusted Engine and IDs for an already authorized scope.
No Run, Task, audit, or queue state is changed by this read port.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Engine

from packages.execution.models import RunPhase, RunStatus


_MAX_ROWS = 100


@dataclass(frozen=True, slots=True)
class RunObservation:
    run_id: str
    task_id: str
    phase: RunPhase
    status: RunStatus
    version: int


@dataclass(frozen=True, slots=True)
class ScopedRunSource:
    run_ids: tuple[str, ...]
    observed_at: datetime
    _runs: dict[str, RunObservation]

    def get(self, run_id: str) -> RunObservation:
        return self._runs[run_id]


_RUNS_SQL = text("""SELECT runs.run_id, runs.task_id, runs.phase, runs.status, runs.version
FROM runs
JOIN tasks ON tasks.task_id = runs.task_id
WHERE tasks.project_id = :project_id AND runs.environment_id = :environment_id
ORDER BY runs.run_id LIMIT 101""")

_LEGACY_SQL = text("""SELECT EXISTS (
    SELECT 1 FROM runs
    JOIN tasks ON tasks.task_id = runs.task_id
    WHERE tasks.project_id = :project_id AND runs.environment_id IS NULL
) AS legacy_unscoped_present""")


def _identity(value: str) -> bool:
    return (type(value) is str and bool(value) and value == value.strip()
            and len(value) <= 128 and value.isprintable())


def _observation(row) -> RunObservation:
    run_id, task_id = row["run_id"], row["task_id"]
    version = row["version"]
    if not _identity(run_id) or not _identity(task_id) or type(version) is not int or version < 1:
        raise ValueError("malformed Run")
    return RunObservation(
        run_id=run_id, task_id=task_id,
        phase=RunPhase(row["phase"]), status=RunStatus(row["status"]),
        version=version,
    )


def load_scoped_run_source(
    engine: Engine, project_id: str, environment_id: str,
) -> ScopedRunSource:
    """Read at most 100 scoped Runs in one repeatable-read, read-only transaction.

    Any legacy NULL-environment Run in the project, overflow, malformed row,
    or database failure returns only a stable unavailable code.
    """
    if not _identity(project_id) or not _identity(environment_id):
        raise ValueError("RUN_SOURCE_SCOPE_INVALID")
    params = {"project_id": project_id, "environment_id": environment_id}
    try:
        with engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                connection.execute(text("SET TRANSACTION READ ONLY"))
                observed_at = connection.execute(
                    text("SELECT CURRENT_TIMESTAMP AS observed_at")
                ).mappings().one()["observed_at"]
                rows = connection.execute(_RUNS_SQL, params).mappings().all()
                if len(rows) > _MAX_ROWS:
                    raise ValueError("overflow")
                legacy = connection.execute(_LEGACY_SQL, params).mappings().one()[
                    "legacy_unscoped_present"
                ]
                if legacy is not False:
                    raise ValueError("legacy or malformed flag")
                runs = tuple(_observation(row) for row in rows)
        return ScopedRunSource(
            run_ids=tuple(run.run_id for run in runs), observed_at=observed_at,
            _runs={run.run_id: run for run in runs},
        )
    except Exception:
        raise RuntimeError("RUN_SOURCE_UNAVAILABLE") from None
