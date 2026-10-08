"""R16: bounded scoped Run observations become an internal status summary."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, FrozenInstanceError
from datetime import datetime, timedelta, timezone

import pytest

from packages.execution.models import RunPhase, RunStatus
from packages.persistence.operations_run_read import RunObservation, ScopedRunSource
from packages.observability.run_status_summary import summarize_scoped_runs


OBSERVED_AT = datetime(2026, 9, 30, 11, 0, tzinfo=timezone(timedelta(hours=9)))


def observation(run_id: str, status: RunStatus = RunStatus.ACTIVE) -> RunObservation:
    return RunObservation(run_id, "task-secret", RunPhase.IMPLEMENTING, status, 1)


def source(*runs: RunObservation) -> ScopedRunSource:
    return ScopedRunSource(tuple(run.run_id for run in runs), OBSERVED_AT,
                           {run.run_id: run for run in runs})


def test_mixed_statuses_count_only_three_canonical_buckets_and_keep_timestamp():
    scoped = source(observation("r1", RunStatus.ACTIVE),
                    observation("r2", RunStatus.WAITING_APPROVAL),
                    observation("r3", RunStatus.BLOCKED),
                    observation("r4", RunStatus.QUEUED),
                    observation("r5", RunStatus.SUCCEEDED))
    before = deepcopy(scoped)

    result = summarize_scoped_runs(scoped)

    assert asdict(result) == {
        "observed_at": OBSERVED_AT,
        "observed_total": 5,
        "active_runs": 1,
        "waiting_approval_runs": 1,
        "blocked_runs": 1,
    }
    assert result.observed_at is scoped.observed_at
    assert scoped == before
    with pytest.raises(FrozenInstanceError):
        result.active_runs = 9
    assert "task-secret" not in repr(result)
    assert "r1" not in repr(result)


def test_empty_scope_is_zero_observed_rows():
    assert asdict(summarize_scoped_runs(source())) == {
        "observed_at": OBSERVED_AT,
        "observed_total": 0,
        "active_runs": 0,
        "waiting_approval_runs": 0,
        "blocked_runs": 0,
    }


def test_other_statuses_are_total_only():
    scoped = source(*(observation(f"r{i}", status) for i, status in enumerate(
        (RunStatus.INTERRUPTED, RunStatus.PAUSED_USER, RunStatus.FAILED,
         RunStatus.CANCELLED, RunStatus.WAITING_DECISION), 1)))
    result = summarize_scoped_runs(scoped)
    assert (result.observed_total, result.active_runs,
            result.waiting_approval_runs, result.blocked_runs) == (5, 0, 0, 0)


def test_exactly_100_rows_are_counted_without_mutating_source():
    scoped = source(*(observation(f"r{i:03d}") for i in range(100)))
    before = deepcopy(scoped)
    result = summarize_scoped_runs(scoped)
    assert (result.observed_total, result.active_runs) == (100, 100)
    assert scoped == before


@pytest.mark.parametrize("scoped", [
    None,
    {},
    ScopedRunSource(["r1"], OBSERVED_AT, {"r1": observation("r1")}),
    ScopedRunSource(("r1", "r1"), OBSERVED_AT, {"r1": observation("r1")}),
    ScopedRunSource(("r1",), OBSERVED_AT, {}),
    ScopedRunSource((), OBSERVED_AT, {"r1": observation("r1")}),
    ScopedRunSource(("r1",), OBSERVED_AT, {"r1": observation("r2")}),
    ScopedRunSource(("r1",), OBSERVED_AT, {"r1": object()}),
    ScopedRunSource(("r1",), OBSERVED_AT,
                    {"r1": RunObservation("r1", "t1", RunPhase.DRAFT, "ACTIVE", 1)}),
    ScopedRunSource(("r1",), OBSERVED_AT,
                    {"r1": RunObservation("r1", "t1", "DRAFT", RunStatus.ACTIVE, 1)}),
    ScopedRunSource(("r1",), OBSERVED_AT,
                    {"r1": RunObservation("r1", "t1", RunPhase.DRAFT, RunStatus.ACTIVE, True)}),
    ScopedRunSource(("r1",), OBSERVED_AT,
                    {"r1": RunObservation("r1", "t1", RunPhase.DRAFT, RunStatus.ACTIVE, 0)}),
    ScopedRunSource(("r1",), OBSERVED_AT,
                    {"r1": RunObservation("r1", "", RunPhase.DRAFT, RunStatus.ACTIVE, 1)}),
    ScopedRunSource((" r1",), OBSERVED_AT, {" r1": observation(" r1")}),
    ScopedRunSource((), datetime(2026, 9, 30), {}),
    ScopedRunSource((), "2026-09-30T00:00:00Z", {}),
    ScopedRunSource(tuple(f"r{i:03d}" for i in range(101)), OBSERVED_AT,
                    {f"r{i:03d}": observation(f"r{i:03d}") for i in range(101)}),
])
def test_malformed_or_oversized_source_fails_closed(scoped):
    with pytest.raises(RuntimeError, match="^RUN_STATUS_SUMMARY_UNAVAILABLE$") as error:
        summarize_scoped_runs(scoped)
    assert "secret" not in str(error.value)


def test_input_with_unexpected_secret_fields_never_leaks_to_result():
    scoped = source(observation("r1"))
    scoped._runs["r1"] = RunObservation("r1", "task-secret", RunPhase.DRAFT,
                                         RunStatus.ACTIVE, 1)
    result = summarize_scoped_runs(scoped)
    assert set(asdict(result)) == {
        "observed_at", "observed_total", "active_runs",
        "waiting_approval_runs", "blocked_runs",
    }
    assert "task-secret" not in repr(result)
