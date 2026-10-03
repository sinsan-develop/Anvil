"""Main-owned opt-in PG15 QA; local default never connects to a database."""

from datetime import timedelta, timezone
from zoneinfo import ZoneInfo
import os
import time

from fastapi import FastAPI
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from apps.api.anvil_api.oidc_process import create_oidc_process_app
from packages.observability.service import OperationsError
from packages.persistence.agent_team_owner_repository import (
    OwnerBinding, OwnerComponent, OwnerSnapshot, SqlAlchemyAgentTeamOwnerRepository,
)
from tests.api.test_oidc_process import _environment, _trust
from tests.persistence.test_agent_team_owner_repository import canonical, digest, sealed


def _target(environment):
    dsn = environment.get("ANVIL_U01_R36_PG_DSN")
    isolated = environment.get("ANVIL_U01_R36_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R36 isolated PostgreSQL 15 opt-in is absent; Main-owned QA")
    try:
        url = sa.engine.make_url(dsn)
        valid = (isolated == "1" and url.drivername == "postgresql+psycopg"
                 and url.host == "127.0.0.1" and url.port == 5549
                 and url.username == url.database == "anvil_u01_r36" and not url.query)
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R36_PG_TARGET_REJECTED") from None
    return url


@pytest.mark.parametrize("dsn,isolated", [
    (None, "1"), ("postgresql+psycopg://anvil_u01_r36@127.0.0.1:5549/anvil_u01_r36", None),
    ("postgresql+psycopg://anvil_u01_r36@127.0.0.1:5549/anvil_u01_r36", "0"),
    ("postgresql+psycopg://anvil_u01_r36@127.0.0.1:5432/anvil_u01_r36", "1"),
    ("postgresql+psycopg://anvil_u01_r36@localhost:5549/anvil_u01_r36", "1"),
    ("postgresql+psycopg://shared@127.0.0.1:5549/anvil_u01_r36", "1"),
    ("postgresql+psycopg://anvil_u01_r36@127.0.0.1:5549/shared", "1"),
    ("postgresql+psycopg://anvil_u01_r36@127.0.0.1:5549/anvil_u01_r36?x=secret", "1"),
    ("sqlite://", "1"),
])
def test_opt_in_rejects_partial_shared_or_unapproved_targets(dsn, isolated, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *_a, **_k: pytest.fail("DB accessed"))
    with pytest.raises(ValueError, match="^R36_PG_TARGET_REJECTED$"):
        _target({"ANVIL_U01_R36_PG_DSN": dsn, "ANVIL_U01_R36_PG_ISOLATED": isolated})


def test_opt_in_accepts_only_exact_main_owned_target():
    url = _target({"ANVIL_U01_R36_PG_DSN":
        "postgresql+psycopg://anvil_u01_r36:synthetic@127.0.0.1:5549/anvil_u01_r36",
        "ANVIL_U01_R36_PG_ISOLATED": "1"})
    assert (url.host, url.port, url.username, url.database) == (
        "127.0.0.1", 5549, "anvil_u01_r36", "anvil_u01_r36")
    assert "synthetic" not in repr(url)


_TABLES = ("agent_owner_heads", "agent_owner_history", "agent_owner_requests",
           "operations_audit_events", "durable_queue_jobs")


def _counts(engine):
    with engine.connect() as connection:
        return tuple(connection.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar_one()
                     for table in _TABLES)


def _db_at(engine):
    with engine.connect() as connection:
        return connection.execute(sa.text("SELECT CURRENT_TIMESTAMP")).scalar_one()


def _preflight(engine):
    with engine.connect() as connection:
        facts = connection.execute(sa.text("SELECT current_database(), current_user, "
            "current_setting('server_version_num')::integer, "
            "(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)")).one()
        assert (facts[0], facts[1], facts[2] // 10000, facts[3]) == (
            "anvil_u01_r36", "anvil_u01_r36", 15, False), "R36_PG_PREFLIGHT_REJECTED"
        assert connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all() == [
            "0019_oidc_sessions"]
    assert _counts(engine) == (0,) * len(_TABLES), "R36_PG_NOT_EMPTY"


def _snapshot(at, assignment, *, project="project-1", environment="wsl-qa", expires=None):
    # psycopg DB values may use ZoneInfo('UTC'); the owner write contract requires
    # exact builtin timezone.utc. Keep the DB instant, not application wall time.
    at = at.astimezone(timezone.utc)
    if expires is not None:
        expires = expires.astimezone(timezone.utc)
    binding = OwnerBinding(project, environment, "r36-shared-session", assignment, 1,
        "r36-qa", "r36-context", "r36-workspace", digest("r36-baseline"),
        digest("r36-target"), digest(assignment), "r36-synthetic-fence", None)

    def component(kind):
        body = canonical({"schema": kind.lower() + "/v1", "records": []})
        return OwnerComponent(kind, 1, body, digest(body))

    return sealed(OwnerSnapshot(binding, 1, component("ROLE_POLICY"), component("ROLE_RESULTS"),
        component("TEAM"), None, (), at - timedelta(minutes=1),
        expires or at + timedelta(hours=1), ""))


def _expiring_snapshot(engine):
    expiring_at = _db_at(engine)
    expires = expiring_at + timedelta(seconds=2)
    return _snapshot(expiring_at, "expired", expires=expires)


def test_expiring_snapshot_binds_one_db_observation_even_if_next_read_is_delayed(monkeypatch):
    from datetime import datetime
    calls = []
    engine = object()
    first = datetime(2026, 10, 4, tzinfo=ZoneInfo("UTC"))

    def delayed_db_at(actual):
        assert actual is engine
        calls.append(actual)
        return first + timedelta(seconds=70 * (len(calls) - 1))

    monkeypatch.setattr(__import__(__name__, fromlist=["_db_at"]), "_db_at", delayed_db_at)
    snapshot = _expiring_snapshot(engine)
    assert len(calls) == 1
    assert snapshot.created_at == first - timedelta(minutes=1)
    assert snapshot.expires_at == first + timedelta(seconds=2)
    assert snapshot.created_at < snapshot.expires_at
    assert snapshot.created_at.tzinfo is snapshot.expires_at.tzinfo is timezone.utc


@pytest.mark.parametrize("db_timezone", [timezone.utc, ZoneInfo("UTC")])
def test_qa_seed_and_inventory_use_the_existing_owner_repository_schema(db_timezone):
    """Local schema compatibility only, not PG clock/isolation evidence."""
    from tests.persistence.test_agent_team_owner_repository import database
    from datetime import datetime, timezone
    with database() as engine:
        with engine.begin() as connection:
            # These unrelated tables are only row-count sentinels in this local probe.
            connection.execute(sa.text("CREATE TABLE operations_audit_events (id INTEGER)"))
            connection.execute(sa.text("CREATE TABLE durable_queue_jobs (id INTEGER)"))
        snapshot = _snapshot(datetime.now(db_timezone), "seed")
        repo = SqlAlchemyAgentTeamOwnerRepository()
        with Session(engine) as session, session.begin():
            repo.save_owner_snapshot(session, snapshot=snapshot, expected_version=0, request_id="seed")
            repo.revoke_generation(session, binding=snapshot.binding, expected_version=1,
                                   request_id="revoke", reason="OWNER_REVOKED")
        assert _counts(engine) == (1, 1, 2, 0, 0)


def test_opt_in_real_pg15_scoped_owner_host_empty_mixed_revoke_and_expiry(tmp_path, monkeypatch):
    url = _target(os.environ)
    engine = sa.create_engine(url, pool_pre_ping=True)
    host_engine = None
    try:
        _preflight(engine)
        trust, _, _ = _trust(tmp_path)
        environment = _environment(trust)
        environment["ANVIL_DATABASE_URL"] = url.render_as_string(hide_password=False)
        captured = []

        def host(**kwargs):
            captured.append(kwargs)
            return FastAPI()

        create_oidc_process_app(environment, host)
        service = captured[0]["operations_owner"]
        host_engine = captured[0]["engine"]
        baseline = _counts(engine)
        assert service.agent_owner_summary().observed_total == 0
        assert _counts(engine) == baseline
        at = _db_at(engine)
        snapshots = [_snapshot(at, name) for name in ("active", "revoked")]
        snapshots += [_snapshot(at, "foreign-project", project="other"),
                      _snapshot(at, "foreign-environment", environment="other")]
        repository = SqlAlchemyAgentTeamOwnerRepository()
        with Session(engine) as session, session.begin():
            for snapshot in snapshots:
                repository.save_owner_snapshot(session, snapshot=snapshot, expected_version=0,
                    request_id="r36-create-" + snapshot.binding.assignment_id)
        expiring = _expiring_snapshot(engine)
        expires = expiring.expires_at
        with Session(engine) as session, session.begin():
            repository.save_owner_snapshot(session, snapshot=expiring, expected_version=0,
                                           request_id="r36-create-expired")
            repository.revoke_generation(session, binding=snapshots[1].binding,
                expected_version=1, request_id="r36-revoke", reason="OWNER_REVOKED")
        # Observe actual DB time crossing the saved expiry, never patch a clock or row.
        deadline = time.monotonic() + 10
        while _db_at(engine) < expires and time.monotonic() < deadline:
            time.sleep(0.05)
        assert _db_at(engine) >= expires, "R36_EXPIRY_NOT_OBSERVED"
        stored = _counts(engine)
        assert stored == (5, 5, 6, 0, 0)
        result = service.agent_owner_summary()
        assert (result.observed_total, result.active_owners,
                result.revoked_owners, result.expired_owners) == (3, 1, 1, 1)
        assert result.observed_at >= expires
        assert service.snapshot()["queue"] == []
        assert service.run_summary().observed_total == 0
        assert service.alerts() == service.audit() == []
        assert _counts(engine) == stored
        assert all(value not in repr(result) for value in (
            "r36-shared-session", "r36-synthetic-fence", "r36-context", "foreign-project"))
        with monkeypatch.context() as patch:
            patch.setattr(host_engine, "connect", lambda: pytest.fail("foreign scope reached DB"))
            for project, env in (("other", "wsl-qa"), ("project-1", "other")):
                with pytest.raises(ValueError, match="^AGENT_SOURCE_SCOPE_INVALID$"):
                    service._agent_owner_summary_loader(project, env)
        with monkeypatch.context() as patch:
            def failed():
                raise RuntimeError("DSN password=synthetic-secret")
            patch.setattr(host_engine, "connect", failed)
            with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
                service.agent_owner_summary()
        assert service.agent_owner_summary().observed_total == 3
        assert _counts(engine) == stored
    finally:
        if host_engine is not None:
            host_engine.dispose()
        engine.dispose()
    # No migration/drop/cleanup against shared data. Main removes this entire
    # verified disposable database/container, including append-only owner history.
