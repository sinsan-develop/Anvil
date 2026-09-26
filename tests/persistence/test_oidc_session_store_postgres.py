"""Opt-in PostgreSQL 18 session-store QA on a disposable isolated DB."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import importlib.util
import os
from pathlib import Path
from threading import Event
import time
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.orm import sessionmaker

from packages.persistence.oidc_session_store import (
    OidcSessionStoreRejected, OidcStoredSession, SqlAlchemyOidcSessionStore,
    oidc_sessions,
)


MIGRATION = Path(__file__).resolve().parents[2] / "migrations/versions/0019_oidc_sessions.py"
DIGEST = b"\x11" * 32
CSRF = "B" * 43


@pytest.fixture
def postgres():
    dsn = os.environ.get("ANVIL_OIDC_SESSION_TEST_DSN")
    if not dsn or os.environ.get("ANVIL_OIDC_SESSION_TEST_ISOLATED") != "1":
        pytest.skip("explicit isolated PostgreSQL session DSN and marker required")
    engine = sa.create_engine(dsn)
    if engine.dialect.name != "postgresql":
        engine.dispose()
        pytest.skip("PostgreSQL required")
    spec = importlib.util.spec_from_file_location("oidc_session_migration_pg", MIGRATION)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    created = False
    try:
        with engine.begin() as connection:
            assert "oidc_sessions" not in sa.inspect(connection).get_table_names(), \
                "dedicated empty QA DB required"
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
        created = True
        yield engine, sessionmaker(bind=engine), migration
    finally:
        if created:
            with engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    connection.execute(sa.text("DELETE FROM oidc_sessions"))
                    migration.downgrade()
        engine.dispose()


def _record(*, seconds=600, step_seconds=120):
    now = datetime.now(timezone.utc)
    return OidcStoredSession(
        "https://issuer.example.test", "sub-pg", CSRF,
        now + timedelta(seconds=seconds),
        None if step_seconds is None else now + timedelta(seconds=step_seconds),
    )


def test_postgres_migration_digest_only_and_revoke(postgres):
    engine, factory, _ = postgres
    with engine.connect() as connection:
        assert connection.execute(sa.text(
            "SELECT rolsuper FROM pg_roles WHERE rolname = CURRENT_USER"
        )).scalar_one() is False
    store = SqlAlchemyOidcSessionStore(factory)
    record = _record()
    store.put(DIGEST, record)
    assert store.get(DIGEST) == record
    with engine.connect() as connection:
        row = connection.execute(sa.text("SELECT * FROM oidc_sessions")).mappings().one()
    assert bytes(row["session_digest"]) == DIGEST
    assert len(row["session_digest"]) == 32
    assert not {"token", "bearer", "role", "permissions", "project_id"} & set(row)
    store.revoke(DIGEST)
    store.revoke(DIGEST)
    assert store.get(DIGEST) is None


def test_postgres_db_clock_expiry_step_up_bound_and_duplicate(postgres):
    engine, factory, _ = postgres
    store = SqlAlchemyOidcSessionStore(factory)
    record = _record(seconds=60, step_seconds=30)
    store.put(DIGEST, record)
    assert store.get(DIGEST).step_up_valid_until == record.step_up_valid_until
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_DUPLICATE$"):
        store.put(DIGEST, _record(seconds=120, step_seconds=None))
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE oidc_sessions SET expires_at = clock_timestamp() - interval '1 millisecond' "
            "WHERE session_digest = :digest"
        ), {"digest": DIGEST})
    assert store.get(DIGEST) is None
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_INVALID_INPUT$"):
        store.put(b"\x12" * 32, _record(seconds=905, step_seconds=None))
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_INVALID_INPUT$"):
        store.put(b"\x13" * 32, _record(seconds=600, step_seconds=305))


def test_postgres_data_bearing_downgrade_preserves_row(postgres):
    engine, factory, migration = postgres
    SqlAlchemyOidcSessionStore(factory).put(DIGEST, _record())
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match="^DEPLOYMENT_ROLLBACK_DECISION_REQUIRED$"):
                migration.downgrade()
            assert connection.execute(sa.text("SELECT count(*) FROM oidc_sessions")).scalar_one() == 1


def _wait_for_session_table_lock(engine, pid, inserter, *, seconds=8):
    deadline = time.monotonic() + seconds
    while True:
        if inserter.done():
            raise AssertionError(f"INSERT finished before Lock wait: {inserter.result()}")
        with engine.connect() as observer:
            row = observer.execute(sa.text(
                "SELECT activity.wait_event_type FROM pg_stat_activity AS activity "
                "JOIN pg_locks AS waiting ON waiting.pid = activity.pid "
                "AND waiting.locktype = 'relation' AND NOT waiting.granted "
                "WHERE activity.pid = :pid AND waiting.relation = to_regclass('oidc_sessions')"
            ), {"pid": pid}).one_or_none()
        if row is not None and row.wait_event_type == "Lock":
            return
        if time.monotonic() >= deadline:
            raise AssertionError("INSERT did not wait on oidc_sessions relation lock")
        time.sleep(0.05)


def test_postgres_downgrade_blocks_concurrent_insert(postgres):
    engine, _, migration = postgres
    counted = Event()
    release_drop = Event()
    ready = Event()
    begin_insert = Event()
    backend_pid = []
    original_drop_table = migration.op.drop_table

    def pause_before_drop(*args, **kwargs):
        counted.set()
        assert release_drop.wait(timeout=15)
        return original_drop_table(*args, **kwargs)

    def downgrade():
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                with patch.object(migration.op, "drop_table", pause_before_drop):
                    migration.downgrade()

    def insert():
        with engine.connect() as connection:
            backend_pid.append(connection.execute(sa.text("SELECT pg_backend_pid()")).scalar_one())
            connection.rollback()
            ready.set()
            assert begin_insert.wait(timeout=10)
            try:
                with connection.begin():
                    connection.execute(oidc_sessions.insert().values(
                        session_digest=b"\x14" * 32, issuer="issuer", subject="subject",
                        csrf_token=CSRF, expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
                    ))
            except sa.exc.DBAPIError as error:
                sqlstate = getattr(error.orig, "sqlstate", None) or getattr(error.orig, "pgcode", None)
                if sqlstate != "42P01":
                    raise
                return sqlstate
            return "COMMITTED"

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            removing = pool.submit(downgrade)
            assert counted.wait(timeout=10)
            inserting = pool.submit(insert)
            assert ready.wait(timeout=5)
            begin_insert.set()
            try:
                _wait_for_session_table_lock(engine, backend_pid[0], inserting)
            finally:
                release_drop.set()
            removing.result(timeout=15)
            assert inserting.result(timeout=15) == "42P01"
    finally:
        begin_insert.set()
        release_drop.set()
        if "oidc_sessions" not in sa.inspect(engine).get_table_names():
            with engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    migration.upgrade()
