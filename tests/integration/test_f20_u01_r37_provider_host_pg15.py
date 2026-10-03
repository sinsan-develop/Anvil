"""Main-owned isolated PG15 host/API QA, never a Provider probe or browser claim."""

import os
import base64
import hashlib
import importlib
import json
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from apps.api.anvil_api.oidc_process import create_oidc_process_app
from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA, oidc_pending_auth
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, users, roles, user_roles, oidc_subject_bindings,
)
from packages.persistence.oidc_session_store import (
    OIDC_SESSION_METADATA, oidc_sessions, OidcStoredSession, SqlAlchemyOidcSessionStore,
)
from tests.api.test_oidc_process import _environment, _trust, ISSUER
from tests.api.test_f20_u01_r10_dashboard_api import PATH
from tests.api.test_f20_u01_r37_provider_host_binding import FIELDS, assert_registration


def _target(environment):
    dsn = environment.get("ANVIL_U01_R37_PG_DSN")
    isolated = environment.get("ANVIL_U01_R37_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R37 isolated PostgreSQL 15 opt-in absent; Main-owned QA")
    try:
        url = sa.engine.make_url(dsn)
        valid = (isolated == "1" and url.drivername == "postgresql+psycopg"
                 and url.host == "127.0.0.1" and url.port == 5550
                 and url.username == url.database == "anvil_u01_r37" and not url.query)
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R37_PG_TARGET_REJECTED") from None
    return url


@pytest.mark.parametrize("dsn,isolated", [
    (None, "1"), ("postgresql+psycopg://anvil_u01_r37@127.0.0.1:5550/anvil_u01_r37", None),
    ("postgresql+psycopg://anvil_u01_r37@127.0.0.1:5550/anvil_u01_r37", "0"),
    ("postgresql+psycopg://anvil_u01_r37@127.0.0.1:5432/anvil_u01_r37", "1"),
    ("postgresql+psycopg://anvil_u01_r37@localhost:5550/anvil_u01_r37", "1"),
    ("postgresql+psycopg://shared@127.0.0.1:5550/anvil_u01_r37", "1"),
    ("postgresql+psycopg://anvil_u01_r37@127.0.0.1:5550/shared", "1"),
    ("postgresql+psycopg://anvil_u01_r37@127.0.0.1:5550/anvil_u01_r37?x=secret", "1"),
    ("sqlite://", "1"),
])
def test_opt_in_rejects_partial_shared_or_unapproved_targets(dsn, isolated, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *_a, **_k: pytest.fail("DB accessed"))
    with pytest.raises(ValueError, match="^R37_PG_TARGET_REJECTED$"):
        _target({"ANVIL_U01_R37_PG_DSN": dsn, "ANVIL_U01_R37_PG_ISOLATED": isolated})


def test_opt_in_accepts_only_exact_main_owned_target():
    url = _target({"ANVIL_U01_R37_PG_DSN":
        "postgresql+psycopg://anvil_u01_r37:synthetic@127.0.0.1:5550/anvil_u01_r37",
        "ANVIL_U01_R37_PG_ISOLATED": "1"})
    assert (url.host, url.port, url.username, url.database) == (
        "127.0.0.1", 5550, "anvil_u01_r37", "anvil_u01_r37")
    assert "synthetic" not in repr(url)


TABLES = ("tasks", "runs", "run_events", "durable_queue_jobs", "operations_audit_events",
          "agent_owner_heads", "agent_owner_history", "agent_owner_requests")


def _counts(engine):
    with engine.connect() as connection:
        return tuple(connection.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar_one()
                     for table in TABLES)


def _build_host(environment, monkeypatch):
    # Import the production module with inert startup configuration; no DB read.
    # The returned app below is a NEW production-configured OIDC app, not asgi.app.
    with monkeypatch.context() as startup:
        startup.delenv("ANVIL_AUTH_MODE", raising=False)
        for key in ("ANVIL_DATABASE_URL", "TELEGRAM_WEBHOOK_SECRET",
                    "TELEGRAM_INTERNAL_SIGNING_SECRET", "TELEGRAM_ALLOWED_IDENTITIES",
                    "ANVIL_CONSOLE_BASE_URL", "ANVIL_PUBLIC_HOST"):
            startup.setenv(key, environment[key])
        asgi = importlib.import_module("apps.api.anvil_api.asgi")
    captured = []
    def host(**kwargs):
        captured.append(kwargs)
        return asgi.create_configured_oidc_asgi_app(**kwargs,
            transport=httpx.MockTransport(lambda request: pytest.fail("external IdP exchange forbidden")))
    app = create_oidc_process_app(environment, host)
    assert app is not asgi.app
    return app, captured[0]["operations_owner"], captured[0]["engine"]


def _host_environment(tmp_path, dsn):
    trust, document, _ = _trust(tmp_path)
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public.update(kid="r37-key", use="sig", alg="RS256")
    document["pinned_jwks_json"] = json.dumps({"keys": [public]})
    document["allowed_permissions"] = ["dashboard:read", "provider:read"]
    trust.write_text(json.dumps(document), encoding="utf-8")
    environment = _environment(trust)
    environment.update(ANVIL_DATABASE_URL=dsn,
        TELEGRAM_WEBHOOK_SECRET="r37-synthetic-webhook",
        TELEGRAM_INTERNAL_SIGNING_SECRET="r37-synthetic-signing",
        TELEGRAM_ALLOWED_IDENTITIES="chat-1:user-1")
    return environment


AUTH_TABLES = (users, roles, user_roles, oidc_subject_bindings, oidc_sessions, oidc_pending_auth)
ACTOR, SUBJECT = "r37-qa-actor", "r37-qa-subject"
ORIGIN = "https://anvil.example.test"


def _auth_rows(engine):
    with engine.connect() as db:
        return tuple(tuple(dict(row) for row in db.execute(sa.select(table)).mappings())
                     for table in AUTH_TABLES)


@contextmanager
def _synthetic_auth_rows(engine):
    """Exact disposable fixture rows, real DB session/directory authentication.

    No IdP exchange/login success is claimed. A synthetic session is installed
    through the existing store; GET must resolve its authority from the DB.
    """
    assert _auth_rows(engine) == ((),) * len(AUTH_TABLES), "R37_AUTH_NOT_EMPTY"
    token = base64.urlsafe_b64encode(b"r" * 32).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(token.encode("ascii")).digest()
    try:
        with engine.begin() as db:
            db.execute(users.insert().values(actor_id=ACTOR, active=True))
            db.execute(roles.insert().values(role_code="operator", permissions=["dashboard:read", "provider:read"]))
            db.execute(user_roles.insert().values(actor_id=ACTOR, role_code="operator",
                project_id="project-1", environment_id="wsl-qa", step_up_required=False, active=True))
            db.execute(oidc_subject_bindings.insert().values(issuer=ISSUER, subject=SUBJECT,
                                                           actor_id=ACTOR, active=True))
            at = db.execute(sa.select(sa.func.current_timestamp())).scalar_one()
        at = at.replace(tzinfo=timezone.utc) if at.tzinfo is None else at.astimezone(timezone.utc)
        SqlAlchemyOidcSessionStore(sessionmaker(bind=engine)).put(digest,
            OidcStoredSession(ISSUER, SUBJECT, "c" * 43, at + timedelta(minutes=5), None))
        yield token
    finally:
        with engine.begin() as db:
            db.execute(oidc_sessions.delete().where(oidc_sessions.c.session_digest == digest))
            db.execute(oidc_subject_bindings.delete().where(
                oidc_subject_bindings.c.issuer == ISSUER, oidc_subject_bindings.c.subject == SUBJECT))
            db.execute(user_roles.delete().where(user_roles.c.actor_id == ACTOR))
            db.execute(users.delete().where(users.c.actor_id == ACTOR))
            db.execute(roles.delete().where(roles.c.role_code == "operator"))
        assert _auth_rows(engine) == ((),) * len(AUTH_TABLES), "R37_AUTH_CLEANUP_RESIDUE"


def _exercise_returned_host(app, environment, engine):
    assert app.state.auth_mode == "OIDC"
    assert app.state.operations_bound is True
    assert app.state.local_test_session_enabled is False
    baseline = _counts(engine)
    with _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
        before = _auth_rows(engine)
        assert api.get(PATH).status_code == 401
        api.cookies.set("anvil_session", token)
        assert api.get("/health/ready").status_code == 200
        response = api.get(PATH)
        assert response.status_code == 200
        assert set(response.json()["data"]) == FIELDS
        assert_registration(response.json()["data"])
        environment.update(UPSTAGE_API_KEY="R37_SYNTHETIC_PRESENCE_ONLY",
                           OLLAMA_BASE_URL="http://r37-private.invalid:11434")
        response = api.get(PATH)
        assert response.status_code == 200
        data = response.json()["data"]
        assert set(data) == FIELDS
        assert_registration(data, ("upstage", "ollama"))
        assert data["queue"] == [] and data["alerts"] == []
        assert data["run_summary"]["status"] == "AVAILABLE"
        assert data["run_summary"]["observed_total"] == 0
        assert all(value not in response.text for value in (
            "R37_SYNTHETIC_PRESENCE_ONLY", "r37-private.invalid", "postgresql", token))
        environment.pop("UPSTAGE_API_KEY")
        environment.pop("OLLAMA_BASE_URL")
        assert_registration(api.get(PATH).json()["data"])
        assert _counts(engine) == baseline and _auth_rows(engine) == before
        # Same cookie/production resolver, persisted permission is now narrower.
        with engine.begin() as db:
            db.execute(roles.update().where(roles.c.role_code == "operator").values(permissions=["provider:read"]))
        denied_before = _auth_rows(engine)
        assert api.get(PATH).status_code == 403
        assert _auth_rows(engine) == denied_before and _counts(engine) == baseline
    assert _counts(engine) == baseline


@pytest.fixture
def local_host(tmp_path, monkeypatch):
    from apps.api.anvil_api import oidc_process
    from packages.persistence.operations_run_read import ScopedRunSource
    from tests.observability.test_f13_operations import RecordingRepository
    from packages.queue.service import DurableQueue
    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=StaticPool)
    for metadata in (DIRECTORY_METADATA, OIDC_SESSION_METADATA, OIDC_PENDING_METADATA):
        metadata.create_all(engine)
    with engine.begin() as db:
        db.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
        db.execute(sa.text("INSERT INTO alembic_version VALUES ('0019_oidc_sessions')"))
        for table in TABLES:
            db.execute(sa.text(f"CREATE TABLE {table} (id INTEGER)"))
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_k: engine)
    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", lambda _dsn: RecordingRepository())
    class EmptyQueue(DurableQueue):
        job_ids = ()
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", lambda *_a: EmptyQueue())
    monkeypatch.setattr(oidc_process, "load_scoped_run_source",
        lambda *_a: ScopedRunSource((), datetime.now(timezone.utc), {}))
    try:
        environment = _host_environment(tmp_path, "postgresql://isolated.invalid/anvil")
        yield _build_host(environment, monkeypatch), environment, engine
    finally:
        engine.dispose()


def test_pg_scenario_uses_returned_oidc_host_not_a_separate_api(local_host):
    (app, _, actual_engine), environment, engine = local_host
    try:
        assert app.state.database_engine is actual_engine is engine
        _exercise_returned_host(app, environment, engine)
    finally:
        assert _auth_rows(engine) == ((),) * len(AUTH_TABLES)


def test_synthetic_auth_cleanup_also_runs_after_assertion_failure(local_host):
    _, _, engine = local_host
    with pytest.raises(AssertionError, match="injected assertion"):
        with _synthetic_auth_rows(engine):
            raise AssertionError("injected assertion")
    assert _auth_rows(engine) == ((),) * len(AUTH_TABLES)


def test_opt_in_real_pg15_oidc_host_dashboard_registration_read_only(tmp_path, monkeypatch):
    url = _target(os.environ)
    engine = sa.create_engine(url, pool_pre_ping=True)
    host_engine = None
    try:
        with engine.connect() as connection:
            facts = connection.execute(sa.text("SELECT current_database(), current_user, "
                "current_setting('server_version_num')::integer, "
                "(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)")).one()
            assert (facts[0], facts[1], facts[2] // 10000, facts[3]) == (
                "anvil_u01_r37", "anvil_u01_r37", 15, False), "R37_PG_PREFLIGHT_REJECTED"
            assert connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all() == [
                "0019_oidc_sessions"]
        baseline = _counts(engine)
        assert baseline == (0,) * len(TABLES), "R37_PG_NOT_EMPTY"
        assert _auth_rows(engine) == ((),) * len(AUTH_TABLES), "R37_AUTH_NOT_EMPTY"
        environment = _host_environment(tmp_path, url.render_as_string(hide_password=False))
        app, owner, host_engine = _build_host(environment, monkeypatch)
        assert app.state.database_engine is host_engine
        _exercise_returned_host(app, environment, engine)
        assert owner.agent_owner_summary().observed_total == 0
        assert owner.alerts() == owner.audit() == []
        with monkeypatch.context() as patch:
            patch.setattr(host_engine, "connect", lambda: pytest.fail("foreign scope reached DB"))
            from apps.api.anvil_api import oidc_process
            patch.setattr(oidc_process, "ProviderStatusService",
                          lambda *_a: pytest.fail("foreign scope constructed Provider"))
            for project, env in (("other", "wsl-qa"), ("project-1", "other")):
                with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
                    owner._source_loader(project, env)
        assert _counts(engine) == baseline
        assert _auth_rows(engine) == ((),) * len(AUTH_TABLES)
    finally:
        if host_engine is not None:
            host_engine.dispose()
        engine.dispose()
    # Main owns migration/create/drop and disposable-container cleanup. This
    # Dashboard reads do not mutate DB. Only exact synthetic auth rows are
    # inserted/changed/deleted by the fixture with baseline restoration asserted.
