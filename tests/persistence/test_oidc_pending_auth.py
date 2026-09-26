"""Local SQL contract for the OIDC pending store; not PostgreSQL evidence."""

from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.orm import sessionmaker

from packages.api.oidc_code_flow import PendingOidcRequest


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "migrations/versions/0017_oidc_pending_auth.py"


def _migration():
    spec = importlib.util.spec_from_file_location("oidc_pending_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _pending(seconds=120):
    return PendingOidcRequest("n" * 43, "v" * 43,
                              datetime.now(timezone.utc) + timedelta(seconds=seconds), False)


@pytest.fixture
def database():
    from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA

    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    OIDC_PENDING_METADATA.create_all(engine)
    try:
        yield engine, sessionmaker(bind=engine)
    finally:
        engine.dispose()


def test_metadata_contains_only_dedicated_pending_table(database):
    from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA

    assert set(OIDC_PENDING_METADATA.tables) == {"oidc_pending_auth"}
    columns = OIDC_PENDING_METADATA.tables["oidc_pending_auth"].c
    assert set(columns.keys()) == {"state_digest", "nonce", "code_verifier", "expires_at", "require_step_up"}
    assert columns.state_digest.primary_key
    assert set(sa.inspect(database[0]).get_table_names()) == {"oidc_pending_auth"}


def test_put_consume_is_one_use_and_duplicate_does_not_overwrite(database):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, PendingAuthStoreRejected

    engine, factory = database
    store = SqlAlchemyPendingAuthStore(factory)
    digest = b"a" * 32
    pending = _pending()
    store.put(digest, pending)
    with pytest.raises(PendingAuthStoreRejected, match="^OIDC_PENDING_STORE_DUPLICATE$") as error:
        store.put(digest, _pending())
    assert error.value.__cause__ is None and error.value.__context__ is None
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT count(*) FROM oidc_pending_auth")).scalar_one() == 1
    assert store.consume(digest) == pending
    assert store.consume(digest) is None


@pytest.mark.parametrize("digest", [b"", b"a" * 31, b"a" * 33, "a" * 32, bytearray(b"a" * 32)])
def test_rejects_invalid_digest_before_database_access(database, digest):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, PendingAuthStoreRejected

    store = SqlAlchemyPendingAuthStore(database[1])
    with pytest.raises(PendingAuthStoreRejected, match="^OIDC_PENDING_STORE_INVALID_INPUT$"):
        store.put(digest, _pending())
    with pytest.raises(PendingAuthStoreRejected, match="^OIDC_PENDING_STORE_INVALID_INPUT$"):
        store.consume(digest)


@pytest.mark.parametrize("pending", [
    PendingOidcRequest("", "v" * 43, datetime.now(timezone.utc) + timedelta(seconds=60), False),
    PendingOidcRequest("n" * 43, "bad verifier", datetime.now(timezone.utc) + timedelta(seconds=60), False),
    PendingOidcRequest("n" * 43, "v" * 43, datetime.now() + timedelta(seconds=60), False),
    PendingOidcRequest("n" * 43, "v" * 43, datetime.now(timezone.utc) + timedelta(seconds=360), False),
    PendingOidcRequest("n" * 43, "v" * 43, datetime.now(timezone.utc) + timedelta(seconds=60), 1),
    object(),
])
def test_put_rejects_malformed_or_overlong_pending(database, pending):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, PendingAuthStoreRejected

    store = SqlAlchemyPendingAuthStore(database[1])
    with pytest.raises(PendingAuthStoreRejected, match="^OIDC_PENDING_STORE_INVALID_INPUT$"):
        store.put(b"b" * 32, pending)


def test_expired_row_is_consumed_without_returning_secrets(database):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, oidc_pending_auth

    engine, factory = database
    digest = b"c" * 32
    with engine.begin() as connection:
        connection.execute(oidc_pending_auth.insert().values(
            state_digest=digest, nonce="n" * 43, code_verifier="v" * 43,
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1), require_step_up=False,
        ))
    assert SqlAlchemyPendingAuthStore(factory).consume(digest) is None
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT count(*) FROM oidc_pending_auth")).scalar_one() == 0


def test_put_prunes_unconsumed_expired_rows_without_touching_live_rows(database):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, oidc_pending_auth

    engine, factory = database
    old, live, new = (bytes([number]) * 32 for number in (1, 2, 3))
    with engine.begin() as connection:
        for digest, seconds in ((old, -10), (live, 120)):
            connection.execute(oidc_pending_auth.insert().values(
                state_digest=digest, nonce="n" * 43, code_verifier="v" * 43,
                expires_at=datetime.now(timezone.utc) + timedelta(seconds=seconds),
                require_step_up=False,
            ))
    store = SqlAlchemyPendingAuthStore(factory)
    store.put(new, _pending())
    with engine.connect() as connection:
        digests = set(connection.execute(sa.select(oidc_pending_auth.c.state_digest)).scalars())
    assert digests == {live, new}


def test_expired_duplicate_digest_cannot_be_reinserted(database):
    from packages.persistence.oidc_pending_auth import (
        SqlAlchemyPendingAuthStore, PendingAuthStoreRejected, oidc_pending_auth,
    )

    engine, factory = database
    digest = b"r" * 32
    with engine.begin() as connection:
        connection.execute(oidc_pending_auth.insert().values(
            state_digest=digest, nonce="n" * 43, code_verifier="v" * 43,
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=5),
            require_step_up=False,
        ))
    with pytest.raises(PendingAuthStoreRejected, match="^OIDC_PENDING_STORE_DUPLICATE$"):
        SqlAlchemyPendingAuthStore(factory).put(digest, _pending())


def test_consume_prunes_other_expired_rows(database):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, oidc_pending_auth

    engine, factory = database
    old, live = b"o" * 32, b"l" * 32
    store = SqlAlchemyPendingAuthStore(factory)
    store.put(live, _pending())
    with engine.begin() as connection:
        connection.execute(oidc_pending_auth.insert().values(
            state_digest=old, nonce="n" * 43, code_verifier="v" * 43,
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=5),
            require_step_up=False,
        ))
    assert isinstance(store.consume(live), PendingOidcRequest)
    with engine.connect() as connection:
        assert connection.execute(sa.select(sa.func.count()).select_from(oidc_pending_auth)).scalar_one() == 0


def test_database_error_is_redacted_and_failed_transaction_rolls_back(database):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore, PendingAuthStoreRejected

    engine, factory = database
    store = SqlAlchemyPendingAuthStore(factory)
    with engine.begin() as connection:
        connection.execute(sa.text("DROP TABLE oidc_pending_auth"))
    for operation in (lambda: store.put(b"d" * 32, _pending()),
                      lambda: store.consume(b"d" * 32)):
        with pytest.raises(PendingAuthStoreRejected) as error:
            operation()
        assert str(error.value) == "OIDC_PENDING_STORE_NOT_AVAILABLE"
        assert error.value.__cause__ is None
        assert error.value.__context__ is None
        assert "n" * 43 not in repr(error.value)


def test_failed_commit_rolls_back_insert_and_delete(database):
    from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore

    engine, factory = database
    class FaultySession(sa.orm.Session):
        pass

    @sa.event.listens_for(FaultySession, "before_commit")
    def fail_commit(_session):
        raise RuntimeError("secret-verifier-must-stay-hidden")

    broken = SqlAlchemyPendingAuthStore(sessionmaker(bind=engine, class_=FaultySession))
    digest = b"f" * 32
    with pytest.raises(ValueError, match="^OIDC_PENDING_STORE_NOT_AVAILABLE$") as error:
        broken.put(digest, _pending())
    assert "secret-verifier" not in str(error.value)
    assert error.value.__cause__ is None and error.value.__context__ is None
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT count(*) FROM oidc_pending_auth")).scalar_one() == 0

    SqlAlchemyPendingAuthStore(factory).put(digest, _pending())
    with pytest.raises(ValueError, match="^OIDC_PENDING_STORE_NOT_AVAILABLE$") as error:
        broken.consume(digest)
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert isinstance(SqlAlchemyPendingAuthStore(factory).consume(digest), PendingOidcRequest)


def test_migration_upgrade_and_empty_downgrade_are_reversible():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    migration = _migration()
    assert migration.revision == "0017_oidc_pending_auth"
    assert migration.down_revision == "0016_operations_recovery"
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert "oidc_pending_auth" in sa.inspect(connection).get_table_names()
            migration.downgrade()
            assert "oidc_pending_auth" not in sa.inspect(connection).get_table_names()
    engine.dispose()


def test_migration_refuses_downgrade_when_row_exists():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    migration = _migration()
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            connection.execute(sa.text("INSERT INTO oidc_pending_auth "
                "(state_digest, nonce, code_verifier, expires_at, require_step_up) "
                "VALUES (:digest, :nonce, :verifier, :expiry, :step)"), {
                    "digest": b"e" * 32, "nonce": "n" * 43, "verifier": "v" * 43,
                    "expiry": datetime.now(timezone.utc), "step": False,
                })
            with pytest.raises(RuntimeError, match="^DEPLOYMENT_ROLLBACK_DECISION_REQUIRED$"):
                migration.downgrade()
            assert "oidc_pending_auth" in sa.inspect(connection).get_table_names()
    engine.dispose()
