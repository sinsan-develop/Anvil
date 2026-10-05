"""R47: Database Health is a fresh, scoped SQL observation, not readiness."""

from datetime import datetime, timedelta, timezone
import json

from fastapi import FastAPI
import pytest
import sqlalchemy as sa
from sqlalchemy.pool import StaticPool

from apps.api.anvil_api import oidc_process
from packages.observability.service import OperationsError
from packages.persistence.operations_budget_read import ScopedBudgetSource
from tests.api.test_f20_u01_r37_provider_host_binding import QueueSource
from tests.api.test_oidc_process import _environment, _trust
from tests.observability.test_f13_operations import RecordingRepository


@pytest.fixture
def bound(tmp_path, monkeypatch):
    trust, _, _ = _trust(tmp_path)
    environment = _environment(trust)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:", poolclass=StaticPool)
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(sa.text("INSERT INTO alembic_version VALUES ('0019_oidc_sessions')"))
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_k: engine)
    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", lambda _dsn: RecordingRepository())
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", lambda *_a: QueueSource("job-1"))
    monkeypatch.setattr(oidc_process, "load_scoped_budget_source",
                        lambda *_a: ScopedBudgetSource((), ()))
    captured = []
    oidc_process.create_oidc_process_app(environment,
                                         lambda **kwargs: captured.append(kwargs) or FastAPI())
    try:
        yield captured[0]["operations_owner"], engine
    finally:
        engine.dispose()


def test_real_sql_and_exact_migration_observe_only_database(bound):
    owner, _engine = bound
    snapshot = owner.snapshot()
    database = snapshot["health"]["database"]
    assert database["state"] == "HEALTHY"
    assert database["error_count"] == 0
    assert database["detail_path"] == "/operations/health"
    assert database["evidence_ref"].startswith("sha256:")
    assert len(database["evidence_ref"]) == 71
    assert 0 < database["stale_after_seconds"] <= 300
    observed = datetime.fromisoformat(database["observed_at"])
    assert observed.tzinfo is not None
    assert observed <= datetime.fromisoformat(snapshot["observed_at"])
    assert "database" not in snapshot["source_gaps"]
    assert all(snapshot["health"][name]["state"] == "UNKNOWN" and name in snapshot["source_gaps"]
               for name in ("queue", "worker", "provider", "backend", "artifact_store"))
    assert "ANVIL_DATABASE_URL" not in json.dumps(snapshot)


def test_migration_mismatch_fails_closed_without_reusing_last_success(bound):
    owner, engine = bound
    assert owner.snapshot()["health"]["database"]["state"] == "HEALTHY"
    with engine.begin() as connection:
        connection.execute(sa.text("UPDATE alembic_version SET version_num = '0016_operations_recovery'"))
    snapshot = owner.snapshot()
    assert snapshot["health"]["database"]["state"] == "UNKNOWN"
    assert "database" in snapshot["source_gaps"]


def test_query_failure_fails_closed_without_reflecting_error(bound):
    owner, engine = bound
    with engine.begin() as connection:
        connection.execute(sa.text("DROP TABLE alembic_version"))
    snapshot = owner.snapshot()
    assert snapshot["health"]["database"]["state"] == "UNKNOWN"
    assert "database" in snapshot["source_gaps"]
    assert "alembic_version" not in json.dumps(snapshot)


def test_connection_failure_after_success_does_not_reuse_health_or_reflect_secret(bound, monkeypatch):
    owner, engine = bound
    assert owner.snapshot()["health"]["database"]["state"] == "HEALTHY"

    def disconnected():
        raise sa.exc.OperationalError("connect", {}, RuntimeError("R47_FAKE_SECRET_CONNECTION_FAILED"))

    monkeypatch.setattr(engine, "connect", disconnected)
    snapshot = owner.snapshot()
    assert snapshot["health"]["database"]["state"] == "UNKNOWN"
    assert "database" in snapshot["source_gaps"]
    assert "R47_FAKE_SECRET_CONNECTION_FAILED" not in json.dumps(snapshot)


@pytest.mark.parametrize("second_offset", [timedelta(seconds=6), timedelta(seconds=-1)])
def test_slow_or_backward_observation_is_not_healthy(bound, monkeypatch, second_offset):
    owner, _engine = bound
    start = datetime.now(timezone.utc)
    values = iter((start, start + second_offset))

    class Clock:
        @staticmethod
        def now(_zone):
            return next(values)

    monkeypatch.setattr(oidc_process, "datetime", Clock)
    snapshot = owner.snapshot()
    assert snapshot["health"]["database"]["state"] == "UNKNOWN"
    assert "database" in snapshot["source_gaps"]


def test_duplicate_migration_heads_are_not_a_valid_observation(bound):
    owner, engine = bound
    with engine.begin() as connection:
        connection.execute(sa.text("INSERT INTO alembic_version VALUES ('0019_oidc_sessions')"))
    snapshot = owner.snapshot()
    assert snapshot["health"]["database"]["state"] == "UNKNOWN"
    assert "database" in snapshot["source_gaps"]


def test_observation_time_is_consumed_once_not_reused_by_direct_loader(bound):
    owner, _engine = bound
    assert owner.snapshot()["health"]["database"]["state"] == "HEALTHY"
    direct = owner._source_loader("project-1", "wsl-qa")
    assert direct.health_signals == ()


def test_failed_queue_load_cannot_leave_a_reusable_observation_time(bound, monkeypatch):
    owner, _engine = bound
    original = oidc_process.load_scoped_queue_source
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source",
                        lambda *_a: (_ for _ in ()).throw(RuntimeError("queue unavailable")))
    with pytest.raises(OperationsError, match="^QUEUE_SOURCE_UNAVAILABLE$"):
        owner.snapshot()
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", original)
    assert owner._source_loader("project-1", "wsl-qa").health_signals == ()


@pytest.mark.parametrize("project,environment", [("other", "wsl-qa"), ("project-1", "other")])
def test_foreign_scope_rejected_before_sql(bound, project, environment):
    owner, _engine = bound
    with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
        owner._source_loader(project, environment)
