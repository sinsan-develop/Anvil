"""Local OIDC session persistence contract; not PostgreSQL acceptance."""

from dataclasses import replace
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.orm import sessionmaker


MIGRATION = Path(__file__).resolve().parents[2] / "migrations/versions/0019_oidc_sessions.py"
DIGEST = b"\x05" * 32
CSRF = "A" * 43


def _migration():
    spec = importlib.util.spec_from_file_location("oidc_sessions_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def database():
    from packages.persistence.oidc_session_store import OIDC_SESSION_METADATA

    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    OIDC_SESSION_METADATA.create_all(engine)
    try:
        yield engine, sessionmaker(bind=engine)
    finally:
        engine.dispose()


def _record(*, seconds=300, step_seconds=120):
    from packages.persistence.oidc_session_store import OidcStoredSession

    now = datetime.now(timezone.utc)
    return OidcStoredSession(
        "https://issuer.example.test", "sub-1", CSRF,
        now + timedelta(seconds=seconds),
        None if step_seconds is None else now + timedelta(seconds=step_seconds),
    )


def test_put_get_revoke_round_trip_and_digest_only(database):
    from packages.persistence.oidc_session_store import SqlAlchemyOidcSessionStore

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    record = _record()
    store.put(DIGEST, record)
    assert store.get(DIGEST) == record
    with engine.connect() as connection:
        row = connection.execute(sa.text("SELECT * FROM oidc_sessions")).mappings().one()
    assert row["session_digest"] == DIGEST
    assert len(row["session_digest"]) == 32
    assert not {"token", "bearer", "role", "permissions", "project_id"} & set(row)
    store.revoke(DIGEST)
    assert store.get(DIGEST) is None
    store.revoke(DIGEST)
    store.revoke(b"\x06" * 32)
    assert store.get(b"\x06" * 32) is None


def test_new_session_does_not_revoke_another_session(database):
    from packages.persistence.oidc_session_store import SqlAlchemyOidcSessionStore

    store = SqlAlchemyOidcSessionStore(database[1])
    record = _record()
    store.put(DIGEST, record)
    store.put(b"\x06" * 32, record)
    assert store.get(DIGEST) == record
    assert store.get(b"\x06" * 32) == record


def test_duplicate_digest_rejects_and_preserves_original_even_after_revoke(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    store = SqlAlchemyOidcSessionStore(database[1])
    original = _record()
    store.put(DIGEST, original)
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_DUPLICATE$") as error:
        store.put(DIGEST, replace(original, subject="sub-2"))
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert store.get(DIGEST) == original
    store.revoke(DIGEST)
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_DUPLICATE$"):
        store.put(DIGEST, original)


@pytest.mark.parametrize("digest", [b"", b"x" * 31, b"x" * 33, "x" * 32, bytearray(b"x" * 32)])
def test_invalid_digest_rejected_for_all_methods(database, digest):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    store = SqlAlchemyOidcSessionStore(database[1])
    for call in (
        lambda: store.put(digest, _record()),
        lambda: store.get(digest),
        lambda: store.revoke(digest),
    ):
        with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_INVALID_INPUT$"):
            call()


@pytest.mark.parametrize("change", [
    {"issuer": ""}, {"issuer": "*"}, {"issuer": "x" * 2049},
    {"subject": ""}, {"subject": " sub-1"}, {"subject": "x" * 513},
    {"csrf_token": "A" * 42}, {"csrf_token": "A" * 44},
    {"csrf_token": "+" + "A" * 42},
    {"expires_at": datetime(2020, 1, 1)},
    {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)},
    {"expires_at": "beyond-session-ttl"},
    {"step_up_valid_until": datetime(2020, 1, 1)},
    {"step_up_valid_until": datetime.now(timezone.utc) - timedelta(seconds=1)},
    {"step_up_valid_until": "beyond-step-up-ttl"},
])
def test_invalid_record_is_rejected_without_row(database, change):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    adjusted = dict(change)
    if adjusted.get("expires_at") == "beyond-session-ttl":
        adjusted["expires_at"] = datetime.now(timezone.utc) + timedelta(seconds=905)
    if adjusted.get("step_up_valid_until") == "beyond-step-up-ttl":
        adjusted["step_up_valid_until"] = datetime.now(timezone.utc) + timedelta(seconds=305)
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_INVALID_INPUT$"):
        SqlAlchemyOidcSessionStore(factory).put(DIGEST, replace(_record(), **adjusted))
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT count(*) FROM oidc_sessions")).scalar_one() == 0


def test_step_up_after_session_expiry_is_rejected(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    record = _record(seconds=60, step_seconds=120)
    with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_INVALID_INPUT$"):
        SqlAlchemyOidcSessionStore(database[1]).put(DIGEST, record)


def test_expired_or_revoked_session_never_resolves(database):
    from packages.persistence.oidc_session_store import SqlAlchemyOidcSessionStore

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    store.put(DIGEST, _record())
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE oidc_sessions SET expires_at = :expiry WHERE session_digest = :digest"
        ), {"expiry": datetime.now(timezone.utc) - timedelta(seconds=1), "digest": DIGEST})
    assert store.get(DIGEST) is None
    store.revoke(DIGEST)
    assert store.get(DIGEST) is None


def test_read_does_not_extend_step_up_time(database):
    from packages.persistence.oidc_session_store import SqlAlchemyOidcSessionStore

    store = SqlAlchemyOidcSessionStore(database[1])
    record = _record()
    store.put(DIGEST, record)
    first = store.get(DIGEST)
    second = store.get(DIGEST)
    assert first.step_up_valid_until == record.step_up_valid_until
    assert second.step_up_valid_until == record.step_up_valid_until


def test_database_failure_is_redacted_without_exception_chain(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    with engine.begin() as connection:
        connection.execute(sa.text("DROP TABLE oidc_sessions"))
    store = SqlAlchemyOidcSessionStore(factory)
    for call in (lambda: store.put(DIGEST, _record()),
                 lambda: store.get(DIGEST), lambda: store.revoke(DIGEST)):
        with pytest.raises(OidcSessionStoreRejected, match="^OIDC_SESSION_STORE_NOT_AVAILABLE$") as error:
            call()
        assert error.value.__cause__ is None and error.value.__context__ is None
        assert CSRF not in repr(error.value)


def test_nonunique_integrity_failure_is_unavailable_not_duplicate(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    with engine.begin() as connection:
        connection.execute(sa.text(
            "CREATE TRIGGER deny_session BEFORE INSERT ON oidc_sessions "
            "BEGIN SELECT RAISE(ABORT, 'sensitive session constraint'); END"
        ))
    with pytest.raises(OidcSessionStoreRejected,
                       match="^OIDC_SESSION_STORE_NOT_AVAILABLE$") as error:
        SqlAlchemyOidcSessionStore(factory).put(DIGEST, _record())
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_corrupt_database_row_fails_closed_without_payload(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    store.put(DIGEST, _record())
    with engine.begin() as connection:
        connection.execute(sa.text("UPDATE oidc_sessions SET issuer = '*'"))
    with pytest.raises(OidcSessionStoreRejected,
                       match="^OIDC_SESSION_STORE_NOT_AVAILABLE$") as error:
        store.get(DIGEST)
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_corrupt_step_up_later_than_session_expiry_fails_closed(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    store.put(DIGEST, _record(seconds=300, step_seconds=120))
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE oidc_sessions SET step_up_valid_until = :invalid"
        ), {"invalid": datetime.now(timezone.utc) + timedelta(seconds=600)})
    with pytest.raises(OidcSessionStoreRejected,
                       match="^OIDC_SESSION_STORE_NOT_AVAILABLE$"):
        store.get(DIGEST)


def test_corrupt_session_expiry_beyond_db_now_plus_900_fails_closed(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    store.put(DIGEST, _record())
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE oidc_sessions SET expires_at = :invalid WHERE session_digest = :digest"
        ), {"invalid": datetime.now(timezone.utc) + timedelta(seconds=1000),
            "digest": DIGEST})
    with pytest.raises(OidcSessionStoreRejected,
                       match="^OIDC_SESSION_STORE_NOT_AVAILABLE$") as error:
        store.get(DIGEST)
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_corrupt_step_up_beyond_db_now_plus_300_fails_closed(database):
    from packages.persistence.oidc_session_store import (
        OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
    )

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    store.put(DIGEST, _record(seconds=600, step_seconds=120))
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE oidc_sessions SET step_up_valid_until = :invalid "
            "WHERE session_digest = :digest"
        ), {"invalid": datetime.now(timezone.utc) + timedelta(seconds=400),
            "digest": DIGEST})
    with pytest.raises(OidcSessionStoreRejected,
                       match="^OIDC_SESSION_STORE_NOT_AVAILABLE$") as error:
        store.get(DIGEST)
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_past_step_up_time_is_returned_for_coordinator_decision(database):
    from packages.persistence.oidc_session_store import SqlAlchemyOidcSessionStore

    engine, factory = database
    store = SqlAlchemyOidcSessionStore(factory)
    store.put(DIGEST, _record(seconds=600, step_seconds=120))
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE oidc_sessions SET step_up_valid_until = :past "
            "WHERE session_digest = :digest"
        ), {"past": datetime.now(timezone.utc) - timedelta(seconds=1),
            "digest": DIGEST})
    record = store.get(DIGEST)
    assert record is not None
    assert record.step_up_valid_until < datetime.now(timezone.utc)


def test_migration_empty_and_data_bearing_downgrade():
    migration = _migration()
    assert migration.revision == "0019_oidc_sessions"
    assert migration.down_revision == "0018_oidc_principal_directory"
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert "oidc_sessions" in sa.inspect(connection).get_table_names()
            connection.execute(sa.text(
                "INSERT INTO oidc_sessions (session_digest, issuer, subject, csrf_token, "
                "expires_at) VALUES (:digest, 'issuer', 'subject', :csrf, :expiry)"
            ), {"digest": DIGEST, "csrf": CSRF, "expiry": datetime.now(timezone.utc)})
            with pytest.raises(RuntimeError, match="^DEPLOYMENT_ROLLBACK_DECISION_REQUIRED$"):
                migration.downgrade()
            assert connection.execute(sa.text("SELECT count(*) FROM oidc_sessions")).scalar_one() == 1
            connection.execute(sa.text("DELETE FROM oidc_sessions"))
            migration.downgrade()
            assert "oidc_sessions" not in sa.inspect(connection).get_table_names()
    engine.dispose()


def test_postgres_downgrade_locks_before_count(monkeypatch):
    migration = _migration()
    calls = []

    class Result:
        def scalar_one(self):
            return 0

    class Bind:
        dialect = SimpleNamespace(name="postgresql")

        def execute(self, statement):
            calls.append(str(statement))
            if str(statement).startswith("SELECT count"):
                assert calls[0].startswith("LOCK TABLE oidc_sessions IN ACCESS EXCLUSIVE MODE")
            return Result()

    monkeypatch.setattr(migration.op, "get_bind", lambda: Bind())
    monkeypatch.setattr(migration.op, "drop_index", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(migration.op, "drop_table", lambda *_args, **_kwargs: None)
    migration.downgrade()
