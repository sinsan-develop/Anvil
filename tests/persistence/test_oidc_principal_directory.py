"""Local trusted-directory SQL contract; SQLite is not PostgreSQL acceptance."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker

from packages.api.oidc_principal import OidcPrincipalBinding


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "migrations/versions/0018_oidc_principal_directory.py"


def _migration():
    spec = importlib.util.spec_from_file_location("oidc_directory_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def database():
    from packages.persistence.oidc_principal_directory import DIRECTORY_METADATA

    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    @sa.event.listens_for(engine, "connect")
    def foreign_keys(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")
    DIRECTORY_METADATA.create_all(engine)
    try:
        yield engine, sessionmaker(bind=engine)
    finally:
        engine.dispose()


def _seed(engine, *, permissions=None):
    from packages.persistence.oidc_principal_directory import (
        users, roles, user_roles, oidc_subject_bindings,
    )
    with engine.begin() as connection:
        connection.execute(users.insert().values(actor_id="actor-1", active=True))
        connection.execute(roles.insert().values(
            role_code="operator", permissions=["tasks:read"] if permissions is None else permissions,
        ))
        connection.execute(user_roles.insert().values(
            actor_id="actor-1", role_code="operator", project_id="project-1",
            environment_id="wsl-qa", step_up_required=True, active=True,
        ))
        connection.execute(oidc_subject_bindings.insert().values(
            issuer="https://issuer.example.test", subject="sub-1", actor_id="actor-1", active=True,
        ))


def test_metadata_has_dedicated_tables_and_foreign_keys(database):
    from packages.persistence.oidc_principal_directory import DIRECTORY_METADATA

    assert set(DIRECTORY_METADATA.tables) == {
        "users", "roles", "user_roles", "oidc_subject_bindings",
    }
    inspector = sa.inspect(database[0])
    assert set(inspector.get_table_names()) == set(DIRECTORY_METADATA.tables)
    assert {fk["referred_table"] for fk in inspector.get_foreign_keys("user_roles")} == {"users", "roles"}
    assert {fk["referred_table"] for fk in inspector.get_foreign_keys("oidc_subject_bindings")} == {"users"}
    assert inspector.get_pk_constraint("user_roles")["constrained_columns"] == ["actor_id"]
    assert set(inspector.get_pk_constraint("oidc_subject_bindings")["constrained_columns"]) == {"issuer", "subject"}


def test_resolver_returns_single_server_owned_binding_using_select_only(database):
    from packages.persistence.oidc_principal_directory import SqlAlchemyOidcPrincipalResolver

    engine, factory = database
    _seed(engine)
    executed = []
    @sa.event.listens_for(engine, "before_cursor_execute")
    def observe(_connection, _cursor, statement, _parameters, _context, _many):
        executed.append(statement.lstrip().upper())
    binding = SqlAlchemyOidcPrincipalResolver(factory).resolve("https://issuer.example.test", "sub-1")
    assert binding == OidcPrincipalBinding(
        "https://issuer.example.test", "sub-1", "actor-1", "operator",
        frozenset({"tasks:read"}), frozenset({"project-1"}), frozenset({"wsl-qa"}), True,
    )
    assert executed and all(statement.startswith("SELECT") for statement in executed)


@pytest.mark.parametrize("table", ["users", "user_roles", "oidc_subject_bindings"])
def test_inactive_lineage_never_resolves(database, table):
    from packages.persistence.oidc_principal_directory import SqlAlchemyOidcPrincipalResolver

    engine, factory = database
    _seed(engine)
    with engine.begin() as connection:
        connection.execute(sa.text(f"UPDATE {table} SET active = false"))
    assert SqlAlchemyOidcPrincipalResolver(factory).resolve("https://issuer.example.test", "sub-1") is None


def test_unknown_subject_or_issuer_never_resolves(database):
    from packages.persistence.oidc_principal_directory import SqlAlchemyOidcPrincipalResolver

    engine, factory = database
    _seed(engine)
    resolver = SqlAlchemyOidcPrincipalResolver(factory)
    assert resolver.resolve("https://issuer.example.test", "sub-2") is None
    assert resolver.resolve("https://other.example.test", "sub-1") is None


@pytest.mark.parametrize("permissions", [
    [], ["tasks:read", "tasks:read"], ["*"], [" tasks:read"],
    ["tasks:read", 7], {"permissions": ["tasks:read"]}, "tasks:read",
])
def test_malformed_or_duplicate_permissions_fail_closed(database, permissions):
    from packages.persistence.oidc_principal_directory import (
        SqlAlchemyOidcPrincipalResolver, OidcDirectoryRejected,
    )

    engine, factory = database
    _seed(engine, permissions=permissions)
    with pytest.raises(OidcDirectoryRejected, match="^OIDC_DIRECTORY_NOT_AUTHORIZED$") as error:
        SqlAlchemyOidcPrincipalResolver(factory).resolve("https://issuer.example.test", "sub-1")
    assert error.value.__cause__ is None and error.value.__context__ is None


@pytest.mark.parametrize("field,value", [
    ("role_code", "*"), ("project_id", "project-1,project-2"),
    ("environment_id", '["wsl-qa","production"]'),
])
def test_invalid_role_or_multi_scope_fails_closed(database, field, value):
    from packages.persistence.oidc_principal_directory import (
        SqlAlchemyOidcPrincipalResolver, OidcDirectoryRejected,
    )

    engine, factory = database
    _seed(engine)
    with engine.begin() as connection:
        if field == "role_code":
            connection.execute(sa.text("INSERT INTO roles (role_code, permissions) "
                                       "VALUES ('*', '[\"tasks:read\"]')"))
        connection.execute(sa.text(f"UPDATE user_roles SET {field} = :value"), {"value": value})
    with pytest.raises(OidcDirectoryRejected, match="^OIDC_DIRECTORY_NOT_AUTHORIZED$"):
        SqlAlchemyOidcPrincipalResolver(factory).resolve("https://issuer.example.test", "sub-1")


def test_schema_rejects_nonboolean_step_up_flag(database):
    engine, _ = database
    _seed(engine)
    with engine.begin() as connection:
        with pytest.raises(sa.exc.IntegrityError):
            connection.execute(sa.text("UPDATE user_roles SET step_up_required = 2"))


def test_postgres_boolean_constraint_uses_boolean_literals():
    from packages.persistence.oidc_principal_directory import user_roles

    ddl = str(sa.schema.CreateTable(user_roles).compile(dialect=postgresql.dialect())).lower()
    assert "step_up_required in (false, true)" in ddl


@pytest.mark.parametrize("issuer,subject", [
    ("*", "sub-1"), ("https://issuer.example.test", ""),
    ("https://issuer.example.test", " sub-1"),
])
def test_invalid_lookup_input_is_redacted(database, issuer, subject):
    from packages.persistence.oidc_principal_directory import (
        SqlAlchemyOidcPrincipalResolver, OidcDirectoryRejected,
    )

    with pytest.raises(OidcDirectoryRejected, match="^OIDC_DIRECTORY_NOT_AUTHORIZED$"):
        SqlAlchemyOidcPrincipalResolver(database[1]).resolve(issuer, subject)


def test_database_error_has_no_identifiers_or_original_exception_chain(database):
    from packages.persistence.oidc_principal_directory import (
        SqlAlchemyOidcPrincipalResolver, OidcDirectoryRejected,
    )

    engine, factory = database
    with engine.begin() as connection:
        connection.execute(sa.text("DROP TABLE roles"))
    with pytest.raises(OidcDirectoryRejected, match="^OIDC_DIRECTORY_NOT_AVAILABLE$") as error:
        SqlAlchemyOidcPrincipalResolver(factory).resolve("https://issuer.example.test", "secret-subject")
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert "secret-subject" not in repr(error.value)


def test_migration_upgrade_empty_downgrade_and_data_guard():
    migration = _migration()
    assert migration.revision == "0018_oidc_principal_directory"
    assert migration.down_revision == "0017_oidc_pending_auth"
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert set(sa.inspect(connection).get_table_names()) == {
                "users", "roles", "user_roles", "oidc_subject_bindings",
            }
            connection.execute(sa.text("INSERT INTO users (actor_id, active) VALUES ('actor-1', true)"))
            with pytest.raises(RuntimeError, match="^DEPLOYMENT_ROLLBACK_DECISION_REQUIRED$"):
                migration.downgrade()
            assert "users" in sa.inspect(connection).get_table_names()
            connection.execute(sa.text("DELETE FROM users"))
            migration.downgrade()
            assert sa.inspect(connection).get_table_names() == []
    engine.dispose()


def test_postgres_downgrade_locks_all_tables_before_any_count(monkeypatch):
    migration = _migration()
    calls = []
    class Result:
        def scalar_one(self):
            return 0
    class Bind:
        dialect = SimpleNamespace(name="postgresql")
        def execute(self, statement):
            sql = str(statement)
            calls.append(sql)
            if sql.startswith("SELECT count"):
                assert calls[0].startswith("LOCK TABLE ")
                assert all(name in calls[0] for name in (
                    "users", "roles", "user_roles", "oidc_subject_bindings",
                ))
            return Result()
    monkeypatch.setattr(migration.op, "get_bind", lambda: Bind())
    monkeypatch.setattr(migration.op, "drop_table", lambda *_args, **_kwargs: None)
    migration.downgrade()
