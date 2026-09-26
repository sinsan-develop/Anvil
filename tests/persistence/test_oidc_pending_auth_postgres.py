"""Opt-in real PostgreSQL contract; use only a disposable, isolated test DB."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import importlib.util
import os
from pathlib import Path
from threading import Barrier, Event, current_thread, main_thread
import time
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.orm import sessionmaker

from packages.api.oidc_code_flow import PendingOidcRequest
from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore


MIGRATION = Path(__file__).resolve().parents[2] / "migrations/versions/0017_oidc_pending_auth.py"


@pytest.fixture
def postgres():
    dsn = os.environ.get("ANVIL_OIDC_PENDING_TEST_DSN")
    if not dsn or os.environ.get("ANVIL_OIDC_PENDING_TEST_ISOLATED") != "1":
        pytest.skip("explicit isolated PostgreSQL DSN and marker required")
    engine = sa.create_engine(dsn)
    if engine.dialect.name != "postgresql":
        engine.dispose()
        pytest.skip("PostgreSQL required")
    spec = importlib.util.spec_from_file_location("oidc_pending_migration_pg", MIGRATION)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    created = False
    try:
        with engine.begin() as connection:
            assert "oidc_pending_auth" not in sa.inspect(connection).get_table_names(), "dedicated empty QA DB required"
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
        created = True
        yield engine, sessionmaker(bind=engine), migration
    finally:
        if created:
            with engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    # This fixture owns the dedicated disposable table only.
                    connection.execute(sa.text("DELETE FROM oidc_pending_auth"))
                    migration.downgrade()
        engine.dispose()


def _pending(seconds=120):
    return PendingOidcRequest("n" * 43, "v" * 43,
                              datetime.now(timezone.utc) + timedelta(seconds=seconds), False)


def test_postgres_one_use_concurrent_consume_and_replay(postgres):
    _, factory, _ = postgres
    store = SqlAlchemyPendingAuthStore(factory)
    digest = b"p" * 32
    store.put(digest, _pending())
    barrier = Barrier(2)

    def consume():
        barrier.wait(timeout=10)
        return SqlAlchemyPendingAuthStore(factory).consume(digest)

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(consume)
        second = pool.submit(consume)
        results = [first.result(timeout=15), second.result(timeout=15)]
    assert sum(isinstance(value, PendingOidcRequest) for value in results) == 1
    assert sum(value is None for value in results) == 1
    assert store.consume(digest) is None


def test_postgres_expired_row_and_downgrade_data_guard(postgres):
    engine, factory, migration = postgres
    digest = b"q" * 32
    with engine.begin() as connection:
        connection.execute(sa.text(
            "INSERT INTO oidc_pending_auth "
            "(state_digest, nonce, code_verifier, expires_at, require_step_up) "
            "VALUES (:digest, :nonce, :verifier, CURRENT_TIMESTAMP - INTERVAL '1 second', false)"
        ), {"digest": digest, "nonce": "n" * 43, "verifier": "v" * 43})
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match="^DEPLOYMENT_ROLLBACK_DECISION_REQUIRED$"):
                migration.downgrade()
    assert SqlAlchemyPendingAuthStore(factory).consume(digest) is None
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT count(*) FROM oidc_pending_auth")).scalar_one() == 0


def test_postgres_locked_row_expiring_during_wait_is_not_returned(postgres):
    engine, factory, _ = postgres
    digest = b"w" * 32
    SqlAlchemyPendingAuthStore(factory).put(digest, _pending(seconds=3))
    transaction_started = Event()

    def observed_worker_query(_connection, _cursor, _statement, _parameters, _context, _many):
        if current_thread() is not main_thread():
            transaction_started.set()

    sa.event.listen(engine, "after_cursor_execute", observed_worker_query)
    with ThreadPoolExecutor(max_workers=1) as pool:
        with engine.begin() as blocker:
            blocker.execute(sa.text(
                "SELECT state_digest FROM oidc_pending_auth WHERE state_digest = :digest FOR UPDATE"
            ), {"digest": digest}).one()
            waiting = pool.submit(SqlAlchemyPendingAuthStore(factory).consume, digest)
            assert transaction_started.wait(timeout=5)
            time.sleep(4)
        # The blocker transaction releases the row lock on context exit.
        assert waiting.result(timeout=10) is None
    sa.event.remove(engine, "after_cursor_execute", observed_worker_query)


def test_postgres_downgrade_blocks_insert_between_count_and_drop(postgres):
    engine, _, migration = postgres
    counted = Event()
    release_drop = Event()
    insert_started = Event()
    insert_completed = Event()
    original_drop_index = migration.op.drop_index

    def pause_before_drop(*args, **kwargs):
        counted.set()
        assert release_drop.wait(timeout=15)
        return original_drop_index(*args, **kwargs)

    def downgrade():
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                with patch.object(migration.op, "drop_index", pause_before_drop):
                    migration.downgrade()

    def insert():
        insert_started.set()
        try:
            with engine.begin() as connection:
                connection.execute(sa.text(
                    "INSERT INTO oidc_pending_auth "
                    "(state_digest, nonce, code_verifier, expires_at, require_step_up) "
                    "VALUES (:digest, :nonce, :verifier, CURRENT_TIMESTAMP, false)"
                ), {"digest": b"i" * 32, "nonce": "n" * 43, "verifier": "v" * 43})
            insert_completed.set()
        except sa.exc.DBAPIError:
            pass  # The table was dropped after the lock released.

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            removing = pool.submit(downgrade)
            assert counted.wait(timeout=10)
            inserting = pool.submit(insert)
            assert insert_started.wait(timeout=5)
            committed_before_drop = insert_completed.wait(timeout=1)
            release_drop.set()
            removing.result(timeout=15)
            inserting.result(timeout=15)
        assert not committed_before_drop, "concurrent insert committed after empty count"
    finally:
        release_drop.set()
        if "oidc_pending_auth" not in sa.inspect(engine).get_table_names():
            with engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    migration.upgrade()
