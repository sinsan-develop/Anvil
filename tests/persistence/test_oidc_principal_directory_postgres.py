"""Opt-in real PostgreSQL 18 QA, requiring a disposable isolated database."""

from concurrent.futures import ThreadPoolExecutor
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

from packages.api.oidc_principal import OidcPrincipalBinding
from packages.persistence.oidc_principal_directory import (
    SqlAlchemyOidcPrincipalResolver, oidc_subject_bindings, roles, user_roles, users,
)


MIGRATION = Path(__file__).resolve().parents[2] / "migrations/versions/0018_oidc_principal_directory.py"


@pytest.fixture
def postgres():
    dsn = os.environ.get("ANVIL_OIDC_DIRECTORY_TEST_DSN")
    if not dsn or os.environ.get("ANVIL_OIDC_DIRECTORY_TEST_ISOLATED") != "1":
        pytest.skip("explicit isolated PostgreSQL DSN and marker required")
    engine = sa.create_engine(dsn)
    if engine.dialect.name != "postgresql":
        engine.dispose()
        pytest.skip("PostgreSQL required")
    spec = importlib.util.spec_from_file_location("oidc_directory_migration_pg", MIGRATION)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    created = False
    tables = {"users", "roles", "user_roles", "oidc_subject_bindings"}
    try:
        with engine.begin() as connection:
            assert not tables & set(sa.inspect(connection).get_table_names()), "dedicated empty QA DB required"
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
        created = True
        yield engine, sessionmaker(bind=engine), migration
    finally:
        if created:
            with engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    for table in ("oidc_subject_bindings", "user_roles", "roles", "users"):
                        connection.execute(sa.text(f"DELETE FROM {table}"))
                    migration.downgrade()
        engine.dispose()


def _seed(engine):
    with engine.begin() as connection:
        connection.execute(users.insert().values(actor_id="actor-1", active=True))
        connection.execute(roles.insert().values(role_code="operator", permissions=["tasks:read"]))
        connection.execute(user_roles.insert().values(
            actor_id="actor-1", role_code="operator", project_id="project-1",
            environment_id="wsl-qa", step_up_required=True, active=True,
        ))
        connection.execute(oidc_subject_bindings.insert().values(
            issuer="https://issuer.example.test", subject="sub-1", actor_id="actor-1", active=True,
        ))


def test_postgres_migration_and_read_only_server_binding(postgres):
    engine, factory, _ = postgres
    with engine.connect() as connection:
        assert connection.execute(sa.text(
            "SELECT rolsuper FROM pg_roles WHERE rolname = CURRENT_USER"
        )).scalar_one() is False
    _seed(engine)
    assert SqlAlchemyOidcPrincipalResolver(factory).resolve(
        "https://issuer.example.test", "sub-1"
    ) == OidcPrincipalBinding(
        "https://issuer.example.test", "sub-1", "actor-1", "operator",
        frozenset({"tasks:read"}), frozenset({"project-1"}), frozenset({"wsl-qa"}), True,
    )


def test_postgres_inactive_and_corrupt_permission_deny(postgres):
    engine, factory, _ = postgres
    _seed(engine)
    resolver = SqlAlchemyOidcPrincipalResolver(factory)
    with engine.begin() as connection:
        connection.execute(sa.text("UPDATE user_roles SET active = false"))
    assert resolver.resolve("https://issuer.example.test", "sub-1") is None
    with engine.begin() as connection:
        connection.execute(sa.text("UPDATE user_roles SET active = true"))
        connection.execute(sa.text("UPDATE roles SET permissions = CAST(:permissions AS json)"),
                           {"permissions": '["tasks:read","tasks:read"]'})
    with pytest.raises(ValueError, match="^OIDC_DIRECTORY_NOT_AUTHORIZED$"):
        resolver.resolve("https://issuer.example.test", "sub-1")


def test_postgres_data_bearing_downgrade_refuses_and_preserves_tables(postgres):
    engine, _, migration = postgres
    _seed(engine)
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match="^DEPLOYMENT_ROLLBACK_DECISION_REQUIRED$"):
                migration.downgrade()
            assert "users" in sa.inspect(connection).get_table_names()
            assert connection.execute(sa.text("SELECT count(*) FROM users")).scalar_one() == 1


def _wait_for_user_table_lock(engine, pid, inserter, *, seconds=8):
    deadline = time.monotonic() + seconds
    while True:
        if inserter.done():
            outcome = inserter.result()
            raise AssertionError(f"INSERT finished before Lock wait: {outcome}")
        with engine.connect() as observer:
            row = observer.execute(sa.text(
                "SELECT activity.wait_event_type FROM pg_stat_activity AS activity "
                "JOIN pg_locks AS waiting ON waiting.pid = activity.pid "
                "AND waiting.locktype = 'relation' AND NOT waiting.granted "
                "WHERE activity.pid = :pid AND waiting.relation = to_regclass('users')"
            ), {"pid": pid}).one_or_none()
        if row is not None and row.wait_event_type == "Lock":
            return
        if time.monotonic() >= deadline:
            raise AssertionError("INSERT did not wait on users relation lock")
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
                    connection.execute(users.insert().values(actor_id="actor-race", active=True))
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
                _wait_for_user_table_lock(engine, backend_pid[0], inserting)
            finally:
                release_drop.set()
            removing.result(timeout=15)
            assert inserting.result(timeout=15) == "42P01"
    finally:
        begin_insert.set()
        release_drop.set()
        if "users" not in sa.inspect(engine).get_table_names():
            with engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    migration.upgrade()
