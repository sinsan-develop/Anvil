"""Local SQL contract for bounded Agent owner observation; PG is Main-owned QA."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import fields, replace
from datetime import datetime, timedelta, timezone

import pytest

from packages.persistence import agent_team_owner_repository as owner
from packages.persistence.operations_agent_owner_read import load_scoped_agent_owner_source


NOW = datetime(2026, 9, 30, 0, 0, tzinfo=timezone.utc)


def head(index, *, project="p1", environment="e1", revoked=False, expired=False,
         future_created=False):
    binding = owner.OwnerBinding(project, environment, f"session-{index:03d}",
        f"assignment-{index:03d}", 1, "actor", "context", "workspace",
        owner._digest("baseline"), owner._digest("target"), owner._digest("assignment"),
        "secret-execution-fence", "secret-write-fence")
    def component(kind):
        body = owner._dump({"permission": "secret-permission", "kind": kind})
        return owner.OwnerComponent(kind, 1, body, owner._digest(body))
    snapshot = owner.OwnerSnapshot(binding, 1, component("ROLE_POLICY"),
        component("ROLE_RESULTS"), component("TEAM"), None, (),
        NOW+timedelta(hours=1) if future_created else NOW-timedelta(days=2),
        NOW+timedelta(hours=2) if future_created else
        NOW-timedelta(days=1) if expired else NOW+timedelta(days=1), "")
    snapshot = owner._copy(replace(snapshot, content_hash=owner._seal(snapshot)), owner.OwnerSnapshot)
    return dict(scope_key=owner._key(binding), project_id=project, environment_id=environment,
        session_id=binding.session_id, assignment_id=binding.assignment_id, generation=1,
        owner_version=2 if revoked else 1, revoked_through=1 if revoked else 0,
        snapshot_hash=snapshot.content_hash, snapshot_json=owner._dump(owner._plain(snapshot)))


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


class Connection:
    def __init__(self, engine):
        self.engine = engine
        self.snapshot = None
        self.read_only = False
        self.isolation = None
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
        connection = self
        class Transaction:
            def __enter__(self):
                connection.snapshot = deepcopy(connection.engine.rows)
            def __exit__(self, *_):
                return False
        return Transaction()

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
        assert "FROM agent_owner_heads" in sql
        assert "project_id = :project_id" in sql and "environment_id = :environment_id" in sql
        assert "ORDER BY scope_key" in sql and "LIMIT 101" in sql
        selected = [row for row in self.snapshot if row["project_id"] == "p1"
                    and row["environment_id"] == "e1"]
        return Rows(sorted(selected, key=lambda row: row["scope_key"])[:101])


class Engine:
    def __init__(self, rows=()):
        self.rows = list(rows)
        self.connection = None

    def connect(self):
        self.connection = Connection(self)
        return self.connection


def load(engine):
    return load_scoped_agent_owner_source(engine, "p1", "e1")


@pytest.mark.parametrize("count", [0, 100])
def test_bounded_scope_and_read_only(count):
    engine = Engine([head(i) for i in range(count)] + [head(999, project="p2"), head(998, environment="e2")])
    before = deepcopy(engine.rows)
    source = load(engine)
    assert len(source.agents) == count and source.observed_at == NOW
    expected = [row["session_id"] for row in sorted(before[:count], key=lambda row: row["scope_key"])]
    assert [item.session_id for item in source.agents] == expected
    assert engine.rows == before
    assert engine.connection.statements[0] == "SET TRANSACTION READ ONLY"
    assert all(sql.startswith("SELECT ") for sql in engine.connection.statements[1:])


def test_101_rows_fail_closed():
    with pytest.raises(RuntimeError, match="^AGENT_SOURCE_UNAVAILABLE$"):
        load(Engine([head(i) for i in range(101)]))


def test_status_precedence_and_minimal_public_fields():
    source = load(Engine([head(1), head(2, expired=True), head(3, revoked=True, expired=True)]))
    assert {item.session_id: item.status for item in source.agents} == {
        "session-001": "ACTIVE", "session-002": "EXPIRED", "session-003": "REVOKED"}
    assert {field.name for field in fields(source.agents[0])} == {
        "session_id", "assignment_id", "generation", "owner_version", "status", "observed_at"}
    assert set(source.__dict__) == {"agents", "observed_at"}
    for secret in ("secret-execution-fence", "secret-write-fence", "secret-permission", "sha256:"):
        assert secret not in repr(source)


def test_future_created_snapshot_fails_closed():
    row = head(4, future_created=True)
    # The repository accepts this structurally valid stored snapshot; it is
    # the scoped read's DB-time visibility check that must reject it.
    assert owner.SqlAlchemyAgentTeamOwnerRepository._stored(row).created_at > NOW
    with pytest.raises(RuntimeError, match="^AGENT_SOURCE_UNAVAILABLE$") as error:
        load(Engine([row]))
    assert error.value.__cause__ is None


def test_existing_stored_validator_is_used(monkeypatch):
    calls = []
    original = owner.SqlAlchemyAgentTeamOwnerRepository._stored
    def checked(row):
        calls.append(row["scope_key"])
        return original(row)
    monkeypatch.setattr(owner.SqlAlchemyAgentTeamOwnerRepository, "_stored", staticmethod(checked))
    assert len(load(Engine([head(1), head(2)])).agents) == 2
    assert len(calls) == 2


@pytest.mark.parametrize("change", [
    {"scope_key": "secret-key"}, {"snapshot_hash": "secret-hash"},
    {"session_id": "wrong"}, {"assignment_id": "wrong"},
    {"generation": 2}, {"owner_version": 2}, {"revoked_through": 2},
    {"snapshot_json": "secret-malformed"},
])
def test_tampered_row_fails_closed(change):
    row = head(1)
    row.update(change)
    with pytest.raises(RuntimeError, match="^AGENT_SOURCE_UNAVAILABLE$") as error:
        load(Engine([row]))
    assert "secret" not in str(error.value) and error.value.__cause__ is None


def test_duplicate_and_malformed_time_fail_closed(monkeypatch):
    row = head(1)
    with pytest.raises(RuntimeError, match="^AGENT_SOURCE_UNAVAILABLE$"):
        load(Engine([row, row]))
    original = Connection.execute
    def bad_time(self, statement, params=None):
        if "CURRENT_TIMESTAMP" in str(statement):
            return Rows([{"observed_at": "secret-invalid-time"}])
        return original(self, statement, params)
    monkeypatch.setattr(Connection, "execute", bad_time)
    with pytest.raises(RuntimeError, match="^AGENT_SOURCE_UNAVAILABLE$"):
        load(Engine([row]))


@pytest.mark.parametrize("project,environment", [
    ("", "e1"), (" p1", "e1"), ("p1", " "), (None, "e1"), ("p1", 1),
    ("p1\n", "e1"), ("x"*129, "e1"),
])
def test_invalid_ids_before_db(project, environment):
    engine = Engine()
    with pytest.raises(ValueError, match="^AGENT_SOURCE_SCOPE_INVALID$"):
        load_scoped_agent_owner_source(engine, project, environment)
    assert engine.connection is None


def test_db_failure_redacts_detail():
    class FailingEngine:
        def connect(self):
            raise RuntimeError("password=secret-password")
    with pytest.raises(RuntimeError, match="^AGENT_SOURCE_UNAVAILABLE$") as error:
        load(FailingEngine())
    assert "secret-password" not in repr(error.value) and error.value.__cause__ is None
