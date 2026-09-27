"""Opt-in OIDC HTTPS flow against the R41 pre-migrated isolated PG18 DB."""

import os
from unittest.mock import Mock

import pytest
import sqlalchemy as sa

from tests.integration.f18_oidc_live_host import run_live_oidc_host_flow


def _require_target_url(dsn: str) -> None:
    try:
        url = sa.engine.make_url(dsn)
        valid = (
            url.get_backend_name() == "postgresql"
            and url.host == "127.0.0.1"
            and url.port == 35418
            and url.database == "anvil_f18_r41_oidc"
            and url.username == "anvil_f18_r41_app"
            and not url.query
        )
    except (TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R41_PG18_TARGET_REJECTED") from None


def _require_database_identity(db: sa.Connection) -> None:
    try:
        version, name, role, superuser = db.execute(sa.text(
            "SELECT current_setting('server_version_num')::integer, current_database(), "
            "current_user, r.rolsuper FROM pg_roles r WHERE r.rolname = current_user"
        )).one()
        heads = db.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all()
        if (version // 10000 != 18 or name != "anvil_f18_r41_oidc"
                or role != "anvil_f18_r41_app" or superuser is not False
                or heads != ["0019_oidc_sessions"]):
            raise ValueError("R41_PG18_TARGET_REJECTED")
        for table in (
            "users", "roles", "user_roles", "oidc_subject_bindings",
            "oidc_pending_auth", "oidc_sessions",
        ):
            if db.execute(sa.text("SELECT count(*) FROM " + table)).scalar_one() != 0:
                raise ValueError("R41_PG18_TARGET_REJECTED")
    except Exception:
        raise ValueError("R41_PG18_TARGET_REJECTED") from None


@pytest.mark.parametrize("dsn", [
    "sqlite:///anvil_f18_r41_oidc",
    "postgresql://anvil_f18_r41_app@localhost:35418/anvil_f18_r41_oidc",
    "postgresql://anvil_f18_r41_app@127.0.0.2:35418/anvil_f18_r41_oidc",
    "postgresql://anvil_f18_r41_app@127.0.0.1:5432/anvil_f18_r41_oidc",
    "postgresql://other@127.0.0.1:35418/anvil_f18_r41_oidc",
    "postgresql://anvil_f18_r41_app@127.0.0.1:35418/other",
    "postgresql://secret:secret@127.0.0.1:35418/anvil_f18_r41_oidc?sslmode=disable",
])
def test_pg18_target_url_rejects_unscoped_dsn(dsn):
    with pytest.raises(ValueError, match="^R41_PG18_TARGET_REJECTED$") as error:
        _require_target_url(dsn)
    assert dsn not in str(error.value)


def test_pg18_target_url_accepts_exact_loopback():
    _require_target_url(
        "postgresql+psycopg://anvil_f18_r41_app@127.0.0.1:35418/anvil_f18_r41_oidc"
    )


@pytest.mark.parametrize("identity,heads", [
    ((170000, "anvil_f18_r41_oidc", "anvil_f18_r41_app", False), ["0019_oidc_sessions"]),
    ((180000, "other", "anvil_f18_r41_app", False), ["0019_oidc_sessions"]),
    ((180000, "anvil_f18_r41_oidc", "other", False), ["0019_oidc_sessions"]),
    ((180000, "anvil_f18_r41_oidc", "anvil_f18_r41_app", True), ["0019_oidc_sessions"]),
    ((180000, "anvil_f18_r41_oidc", "anvil_f18_r41_app", False), ["0016_operations_recovery"]),
    ((180000, "anvil_f18_r41_oidc", "anvil_f18_r41_app", False), []),
])
def test_pg18_identity_rejects_wrong_version_db_role_or_head(identity, heads):
    db = Mock()
    db.execute.side_effect = [Mock(one=Mock(return_value=identity)),
                              Mock(scalars=Mock(return_value=Mock(all=Mock(return_value=heads))))]
    with pytest.raises(ValueError, match="^R41_PG18_TARGET_REJECTED$"):
        _require_database_identity(db)


def test_oidc_live_host_on_pre_migrated_pg18():
    dsn = os.environ.get("ANVIL_F18_R41_PG18_DSN")
    isolated = os.environ.get("ANVIL_F18_R41_PG18_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R41 isolated PG18 opt-in not configured; real DB unverified")
    if not dsn or isolated != "1":
        pytest.fail("R41_PG18_TARGET_REJECTED")
    _require_target_url(dsn)
    engine = None
    try:
        engine = sa.create_engine(dsn)
        with engine.connect() as db:
            _require_database_identity(db)
    except Exception:
        if engine is not None:
            engine.dispose()
        pytest.fail("R41_PG18_TARGET_REJECTED", pytrace=False)
    try:
        try:
            evidence = run_live_oidc_host_flow(database_engine=engine)
        except Exception:
            pytest.fail("R41_PG18_FLOW_FAILED", pytrace=False)
        assert evidence.authorization_status == 200
        assert evidence.ready_status == 200
        assert evidence.callback_status == 200
        assert evidence.session_status == 200
        assert evidence.replay_status == 401
        assert evidence.pending_rows == 1
        assert evidence.session_rows == 1
        assert evidence.directory_rows == 1
        assert evidence.secret_calls == evidence.issuer_token_requests == 1
        assert evidence.cleanup_verified
        with engine.connect() as db:
            for table in (
                "users", "roles", "user_roles", "oidc_subject_bindings",
                "oidc_pending_auth", "oidc_sessions",
            ):
                assert db.execute(sa.text("SELECT count(*) FROM " + table)).scalar_one() == 0
    finally:
        engine.dispose()
