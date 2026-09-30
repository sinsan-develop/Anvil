"""Internal, fail-closed summary of a bounded scoped Run observation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from packages.execution.models import RunPhase, RunStatus
from packages.persistence.operations_run_read import RunObservation, ScopedRunSource


@dataclass(frozen=True, slots=True)
class ScopedRunStatusSummary:
    observed_at: datetime
    observed_total: int
    active_runs: int
    waiting_approval_runs: int
    blocked_runs: int


def _identity(value: object) -> bool:
    return (type(value) is str and bool(value) and value == value.strip()
            and len(value) <= 128 and value.isprintable())


def summarize_scoped_runs(source: ScopedRunSource) -> ScopedRunStatusSummary:
    """Count only canonical statuses; never infer process or whole-project health."""
    try:
        if type(source) is not ScopedRunSource:
            raise ValueError("invalid source")
        observed_at = source.observed_at
        if (type(observed_at) is not datetime or observed_at.tzinfo is None
                or observed_at.utcoffset() is None):
            raise ValueError("invalid observation time")
        run_ids, runs = source.run_ids, source._runs
        if (type(run_ids) is not tuple or type(runs) is not dict
                or len(run_ids) > 100 or len(run_ids) != len(runs)
                or any(not _identity(run_id) for run_id in run_ids)
                or len(set(run_ids)) != len(run_ids)
                or set(run_ids) != set(runs)):
            raise ValueError("invalid run collection")

        active = waiting = blocked = 0
        for run_id in run_ids:
            row = runs[run_id]
            if (type(row) is not RunObservation or row.run_id != run_id
                    or not _identity(row.task_id)
                    or type(row.phase) is not RunPhase
                    or type(row.status) is not RunStatus
                    or type(row.version) is not int or row.version < 1):
                raise ValueError("invalid run observation")
            active += row.status is RunStatus.ACTIVE
            waiting += row.status is RunStatus.WAITING_APPROVAL
            blocked += row.status is RunStatus.BLOCKED
        return ScopedRunStatusSummary(
            observed_at, len(run_ids), active, waiting, blocked,
        )
    except Exception:
        raise RuntimeError("RUN_STATUS_SUMMARY_UNAVAILABLE") from None
