"""Local contract tests for the scoped, read-only queue snapshot.

The connection double checks SQL shape and transaction setup. PostgreSQL 15
execution remains a separate Main-owned verification step.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

import pytest

from packages.observability.projection import OperationsSources, project_operations
from packages.persistence.operations_queue_read import load_scoped_queue_source


NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)


def job(job_id, run_id, **changes):
    row = dict(job_id=job_id, run_id=run_id, status="PENDING", available_at=NOW,
               attempts=0, max_attempts=3, lease_epoch=0, lease_expires_at=None,
               dependency_ids=[], conflict_keys=[], input_verified=True,
               payload="secret-payload", execution_fencing_token="secret-token")
    row.update(changes)
    return row


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def one(self):
        assert len(self.rows) == 1
        return self.rows[0]


class Transaction:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        self.connection.snapshot = deepcopy(self.connection.engine.data)
        return self

    def __exit__(self, *_):
        return False


class Connection:
    def __init__(self, engine):
        self.engine = engine
        self.statements = []
        self.snapshot = None
        self.read_only = False
        self.isolation = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execution_options(self, *, isolation_level):
        assert self.snapshot is None
        self.isolation = isolation_level
        return self

    def begin(self):
        assert self.isolation == "REPEATABLE READ"
        return Transaction(self)

    def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append(sql)
        if sql == "SET TRANSACTION READ ONLY":
            self.read_only = True
            return Rows([])
        assert self.read_only and self.snapshot is not None
        assert sql.lstrip().upper().startswith("SELECT ")
        if "CURRENT_TIMESTAMP" in sql:
            return Rows([{"observed_at": NOW}])
        assert params == {"project_id": "p1", "environment_id": "e1"}
        assert "tasks.project_id = :project_id" in sql
        scoped_runs = {run_id for run_id, (task_id, environment) in self.snapshot["runs"].items()
                       if self.snapshot["tasks"][task_id] == "p1" and environment == "e1"}
        if "legacy_unscoped_present" in sql:
            assert "FROM runs" in sql and "JOIN tasks" in sql
            assert "runs.environment_id IS NULL" in sql
            legacy_runs = {run_id for run_id, (task_id, environment) in self.snapshot["runs"].items()
                           if self.snapshot["tasks"][task_id] == "p1" and environment is None}
            present = bool(legacy_runs)
            if "FROM durable_queue_jobs" in sql:
                present = any(row["run_id"] in legacy_runs for row in self.snapshot["jobs"].values())
            return Rows([{"legacy_unscoped_present": present}])
        assert "JOIN runs" in sql and "JOIN tasks" in sql
        if "FROM queue_quarantine" in sql:
            assert "queue_quarantine.job_id = durable_queue_jobs.job_id" in sql
            assert "LIMIT 101" in sql
            rows = [q for q in self.snapshot["quarantine"]
                    if self.snapshot["jobs"][q["job_id"]]["run_id"] in scoped_runs]
            return Rows(rows[:101])
        assert "FROM durable_queue_jobs" in sql and "LIMIT 101" in sql
        assert "payload" not in sql and "fencing_token" not in sql
        rows = [row for row in self.snapshot["jobs"].values() if row["run_id"] in scoped_runs]
        if self.engine.after_jobs:
            self.engine.after_jobs(self.engine.data)
        return Rows(rows[:101])


class Engine:
    def __init__(self, *, runs=None, tasks=None, jobs=None, quarantine=None, after_jobs=None):
        self.data = {"runs": runs or {}, "tasks": tasks or {}, "jobs": jobs or {},
                     "quarantine": quarantine or []}
        self.after_jobs = after_jobs
        self.connection = None

    def connect(self):
        self.connection = Connection(self)
        return self.connection


def load(engine):
    return load_scoped_queue_source(engine, "p1", "e1")


def test_empty_scope_is_observed_without_claiming_health():
    source = load(Engine())
    assert source.job_ids == ()
    assert source.quarantine() == ()
    assert source.observed_at == NOW
    assert source.legacy_unscoped_present is False
    projected = project_operations(OperationsSources(queue=source, queue_job_ids=source.job_ids), observed_at=NOW)
    assert projected["queue"] == [] and projected["health"]["queue"]["state"] == "UNKNOWN"
    with pytest.raises(KeyError):
        source.get("outside")


def test_other_project_and_environment_jobs_and_quarantine_are_excluded():
    jobs = {key: job(key, run) for key, run in (("j1", "r1"), ("j2", "r2"), ("j3", "r3"))}
    engine = Engine(tasks={"t1": "p1", "t2": "p1", "t3": "p2"},
                    runs={"r1": ("t1", "e1"), "r2": ("t2", "e2"), "r3": ("t3", "e1")},
                    jobs=jobs, quarantine=[dict(job_id=key, attempts=1, reason="EXHAUSTED", quarantined_at=NOW)
                                           for key in jobs])
    source = load(engine)
    assert source.job_ids == ("j1",)
    assert tuple(row.job_id for row in source.quarantine()) == ("j1",)
    with pytest.raises(KeyError):
        source.get("j2")
    with pytest.raises(KeyError):
        source.get("j3")


def test_legacy_null_environment_is_explicit_even_when_no_scoped_jobs():
    source = load(Engine(tasks={"t1": "p1"}, runs={"r0": ("t1", None)},
                         jobs={"old": job("old", "r0")}))
    assert source.job_ids == ()
    assert source.legacy_unscoped_present is True


def test_legacy_run_without_queue_job_is_not_silently_reported_as_complete():
    source = load(Engine(tasks={"t1": "p1"}, runs={"r0": ("t1", None)}))
    assert source.job_ids == ()
    assert source.legacy_unscoped_present is True


def test_payload_and_fencing_token_never_enter_observation_or_projection():
    engine = Engine(tasks={"t1": "p1"}, runs={"r1": ("t1", "e1")},
                    jobs={"j1": job("j1", "r1", status="CLAIMED", attempts=1,
                                    lease_epoch=4, lease_expires_at=NOW)})
    source = load(engine)
    row = source.get("j1")
    assert not hasattr(row, "payload") and not hasattr(row, "execution_fencing_token")
    assert "secret-payload" not in repr(source) and "secret-token" not in repr(source)
    projected = project_operations(OperationsSources(queue=source, queue_job_ids=source.job_ids), observed_at=NOW)
    assert projected["queue"][0]["state"] == "CLAIMED"
    assert "secret-payload" not in repr(projected) and "secret-token" not in repr(projected)


def test_more_than_100_rows_fails_closed_instead_of_returning_partial_snapshot():
    jobs = {f"j{i:03d}": job(f"j{i:03d}", "r1") for i in range(101)}
    engine = Engine(tasks={"t1": "p1"}, runs={"r1": ("t1", "e1")}, jobs=jobs)
    with pytest.raises(ValueError, match="QUEUE_SOURCE_LIMIT_EXCEEDED"):
        load(engine)


def test_job_and_quarantine_use_same_repeatable_read_snapshot():
    def concurrent_change(data):
        data["quarantine"].append(dict(job_id="j1", attempts=1, reason="LATER", quarantined_at=NOW))

    engine = Engine(tasks={"t1": "p1"}, runs={"r1": ("t1", "e1")},
                    jobs={"j1": job("j1", "r1")}, after_jobs=concurrent_change)
    source = load(engine)
    assert source.job_ids == ("j1",) and source.quarantine() == ()
    assert len(engine.data["quarantine"]) == 1


def test_transaction_is_read_only_and_only_selects_nonsecret_columns():
    engine = Engine(tasks={"t1": "p1"}, runs={"r1": ("t1", "e1")},
                    jobs={"j1": job("j1", "r1")})
    load(engine)
    assert engine.connection.isolation == "REPEATABLE READ"
    assert engine.connection.statements[0] == "SET TRANSACTION READ ONLY"
    assert all(sql.startswith("SELECT ") for sql in engine.connection.statements[1:])


def test_database_error_is_fail_closed_without_driver_secret():
    class FailingEngine:
        def connect(self):
            raise RuntimeError("password=secret-password")

    with pytest.raises(RuntimeError, match="^QUEUE_SOURCE_UNAVAILABLE$") as error:
        load(FailingEngine())
    assert "secret-password" not in str(error.value)


def test_quarantine_reason_with_secret_is_redacted():
    engine = Engine(tasks={"t1": "p1"}, runs={"r1": ("t1", "e1")},
                    jobs={"j1": job("j1", "r1", status="QUARANTINED", attempts=1)},
                    quarantine=[dict(job_id="j1", attempts=1,
                                     reason="password=secret-password", quarantined_at=NOW)])
    source = load(engine)
    assert source.quarantine()[0].reason == "OWNER_REPORTED"
    assert "secret-password" not in repr(source)


@pytest.mark.parametrize("project,environment", [("", "e1"), ("p1", " "), (None, "e1"), ("p1", 1)])
def test_invalid_scope_fails_before_database_access(project, environment):
    engine = Engine()
    with pytest.raises(ValueError, match="QUEUE_SOURCE_SCOPE_INVALID"):
        load_scoped_queue_source(engine, project, environment)
    assert engine.connection is None
