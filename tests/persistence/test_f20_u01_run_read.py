"""Local SQL contract tests for the bounded scoped Run observation."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

import pytest

from packages.execution.models import RunPhase, RunStatus
from packages.persistence.operations_run_read import load_scoped_run_source


NOW = datetime(2026, 9, 30, 0, 0, tzinfo=timezone.utc)


def run(run_id, task_id="t1", environment_id="e1", **changes):
    row = dict(run_id=run_id, task_id=task_id, phase="DRAFT", status="QUEUED",
               version=1, environment_id=environment_id,
               permission_snapshot_hash="secret-permission", payload="secret-payload")
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
        self.isolation = None
        self.read_only = False
        self.snapshot = None
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execution_options(self, *, isolation_level):
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
        assert "JOIN tasks ON tasks.task_id = runs.task_id" in sql
        if "legacy_unscoped_present" in sql:
            assert "runs.environment_id IS NULL" in sql
            return Rows([{"legacy_unscoped_present": any(
                self.snapshot["tasks"][row["task_id"]] == "p1"
                and row["environment_id"] is None
                for row in self.snapshot["runs"].values())}])
        assert "runs.environment_id = :environment_id" in sql
        assert "ORDER BY runs.run_id" in sql and "LIMIT 101" in sql
        assert "permission_snapshot_hash" not in sql and "payload" not in sql
        selected = [row for row in self.snapshot["runs"].values()
                    if self.snapshot["tasks"][row["task_id"]] == "p1"
                    and row["environment_id"] == "e1"]
        if self.engine.after_runs:
            self.engine.after_runs(self.engine.data)
        return Rows(sorted(selected, key=lambda row: row["run_id"])[:101])


class Engine:
    def __init__(self, *, tasks=None, runs=None, after_runs=None):
        self.data = {"tasks": tasks or {}, "runs": runs or {}}
        self.after_runs = after_runs
        self.connection = None

    def connect(self):
        self.connection = Connection(self)
        return self.connection


def load(engine):
    return load_scoped_run_source(engine, "p1", "e1")


def test_empty_scope_is_only_an_observation():
    source = load(Engine())
    assert source.run_ids == () and source.observed_at == NOW


def test_scope_order_enums_and_secret_exclusion():
    engine = Engine(tasks={"t1": "p1", "t2": "p1", "t3": "p2"}, runs={
        "r2": run("r2", phase="IMPLEMENTING", status="ACTIVE"),
        "r1": run("r1"), "r3": run("r3", task_id="t2", environment_id="e2"),
        "r4": run("r4", task_id="t3")})
    before = deepcopy(engine.data)
    source = load(engine)
    assert source.run_ids == ("r1", "r2")
    assert source.get("r2").phase is RunPhase.IMPLEMENTING
    assert source.get("r2").status is RunStatus.ACTIVE
    assert source.get("r1").version == 1
    with pytest.raises(KeyError):
        source.get("r3")
    assert engine.data == before
    assert "secret-permission" not in repr(source)
    assert "secret-payload" not in repr(source)
    assert engine.connection.statements[0] == "SET TRANSACTION READ ONLY"
    assert all(sql.startswith("SELECT ") for sql in engine.connection.statements[1:])


@pytest.mark.parametrize("count", [0, 100])
def test_boundaries_succeed(count):
    engine = Engine(tasks={"t1": "p1"}, runs={f"r{i:03d}": run(f"r{i:03d}") for i in range(count)})
    assert len(load(engine).run_ids) == count


def test_101_rows_fail_closed():
    engine = Engine(tasks={"t1": "p1"}, runs={f"r{i:03d}": run(f"r{i:03d}") for i in range(101)})
    with pytest.raises(RuntimeError, match="^RUN_SOURCE_UNAVAILABLE$"):
        load(engine)


def test_legacy_null_environment_fails_even_with_no_scoped_rows():
    engine = Engine(tasks={"t1": "p1"}, runs={"old": run("old", environment_id=None)})
    with pytest.raises(RuntimeError, match="^RUN_SOURCE_UNAVAILABLE$"):
        load(engine)


@pytest.mark.parametrize("changes", [
    {"phase": "password=secret"}, {"status": "password=secret"},
    {"version": 0}, {"version": True}, {"version": "1"},
    {"run_id": " bad"}, {"task_id": ""},
])
def test_malformed_row_fails_closed(changes):
    bad_row = run("r1")
    bad_row.update(changes)
    engine = Engine(tasks={"t1": "p1"}, runs={"bad": bad_row})
    with pytest.raises(RuntimeError, match="^RUN_SOURCE_UNAVAILABLE$") as error:
        load(engine)
    assert "secret" not in str(error.value)


@pytest.mark.parametrize("project,environment", [
    ("", "e1"), ("p1", " "), (None, "e1"), ("p1", 1), (" p1", "e1"),
])
def test_invalid_scope_fails_before_database_access(project, environment):
    engine = Engine()
    with pytest.raises(ValueError, match="^RUN_SOURCE_SCOPE_INVALID$"):
        load_scoped_run_source(engine, project, environment)
    assert engine.connection is None


def test_repeatable_snapshot_and_db_error_redaction():
    engine = Engine(tasks={"t1": "p1"}, runs={"r1": run("r1")},
                    after_runs=lambda data: data["runs"].update({"r2": run("r2")}))
    assert load(engine).run_ids == ("r1",)
    assert "r2" in engine.data["runs"]

    class FailingEngine:
        def connect(self):
            raise RuntimeError("password=secret-password")

    with pytest.raises(RuntimeError, match="^RUN_SOURCE_UNAVAILABLE$") as error:
        load(FailingEngine())
    assert "secret-password" not in str(error.value)
