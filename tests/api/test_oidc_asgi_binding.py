"""Trusted OIDC host binding through the public ASGI shell."""

import hashlib
import importlib
import json
import os
from dataclasses import replace
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
import sqlalchemy as sa
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from packages.api.fastapi_app import AuthorizationScope
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_runtime_factory import OidcRuntimeConfig, OidcRuntimeRejected
from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA, oidc_pending_auth
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, oidc_subject_bindings, roles, user_roles, users,
)
from packages.persistence.oidc_session_store import OIDC_SESSION_METADATA, oidc_sessions


ISSUER = "https://issuer.example.test/realms/anvil"
ORIGIN = "https://anvil.example.test"
REDIRECT = ORIGIN + "/auth/oidc/callback"
HEADERS = {"host": "anvil.example.test", "origin": ORIGIN}


@pytest.fixture
def host(monkeypatch):
    for name, value in {
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": ORIGIN,
        "ANVIL_PUBLIC_HOST": "anvil.example.test",
    }.items():
        monkeypatch.setenv(name, value)
    asgi = importlib.import_module("apps.api.anvil_api.asgi")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
                              connect_args={"check_same_thread": False}, poolclass=StaticPool)
    for metadata in (OIDC_PENDING_METADATA, DIRECTORY_METADATA, OIDC_SESSION_METADATA):
        metadata.create_all(engine)
    with engine.begin() as db:
        db.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        db.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES ('0019_oidc_sessions')"))
        db.execute(users.insert().values(actor_id="actor-1", active=True))
        db.execute(roles.insert().values(role_code="operator", permissions=["provider:read"]))
        db.execute(user_roles.insert().values(
            actor_id="actor-1", role_code="operator", project_id="project-1",
            environment_id="wsl-qa", step_up_required=False, active=True,
        ))
        db.execute(oidc_subject_bindings.insert().values(
            issuer=ISSUER, subject="subject-1", actor_id="actor-1", active=True,
        ))
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public.update(kid="key-1", use="sig", alg="RS256")
    config = OidcRuntimeConfig(
        issuer=ISSUER, client_id="anvil-web", redirect_uri=REDIRECT,
        jwks_json=json.dumps({"keys": [public]}), step_up_acr="urn:anvil:step-up",
        principal_policy=OidcPrincipalPolicy(
            ISSUER, frozenset({"operator"}), frozenset({"provider:read"}),
            frozenset({"project-1"}), frozenset({"wsl-qa"}),
        ),
    )
    environment = {
        "ANVIL_AUTH_MODE": "OIDC",
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": ORIGIN,
        "ANVIL_PUBLIC_HOST": "anvil.example.test",
        "UPSTAGE_API_KEY": "synthetic-presence",
    }
    factory = sessionmaker(bind=engine)
    try:
        yield asgi, engine, factory, private, config, environment
    finally:
        engine.dispose()


def _scope(_endpoint, _params):
    return AuthorizationScope("project-1", "wsl-qa", frozenset({"operator"}))


def _configured_app(host, *, change=None, secret=None, transport=None, operations_owner=None):
    asgi, engine, factory, _, config, environment = host
    environment.update({
        "ANVIL_OIDC_ISSUER": ISSUER,
        "ANVIL_OIDC_CLIENT_ID": "anvil-web",
        "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
    })
    environment.update(change or {})
    return asgi.create_configured_oidc_asgi_app(
        environment=environment, engine=engine, session_factory=factory,
        authorization_resolver=_scope, principal_policy=config.principal_policy,
        pinned_jwks_json=config.jwks_json, client_secret=secret, transport=transport,
        operations_owner=operations_owner,
    )


@pytest.mark.parametrize("change", [
    {"ANVIL_OIDC_ISSUER": ""},
    {"ANVIL_OIDC_CLIENT_ID": " anvil-web"},
    {"ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up\n"},
    {"ANVIL_OIDC_CLIENT_SECRET": "sensitive-client-secret"},
    {"ANVIL_OIDC_JWKS_JSON": "sensitive-jwks"},
    {"ANVIL_OIDC_UNRECOGNIZED": "sensitive-unknown"},
    {"ANVIL_CONSOLE_BASE_URL": "https://sensitive@anvil.example.test"},
    {"ANVIL_AUTH_MODE": "COOKIE"},
    {"ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": "sensitive-token"},
])
def test_configured_oidc_rejects_invalid_host_input_without_reflection(host, change):
    with pytest.raises(OidcRuntimeRejected) as error:
        _configured_app(host, change=change)
    assert str(error.value) == "OIDC_RUNTIME_NOT_CONFIGURED"
    assert error.value.__cause__ is None and error.value.__context__ is None


@pytest.mark.parametrize("missing", [
    "ANVIL_OIDC_ISSUER", "ANVIL_OIDC_CLIENT_ID", "ANVIL_OIDC_STEP_UP_ACR",
])
def test_configured_oidc_requires_each_nonsecret_field(host, missing):
    asgi, engine, factory, _, config, environment = host
    environment.update({
        "ANVIL_OIDC_ISSUER": ISSUER,
        "ANVIL_OIDC_CLIENT_ID": "anvil-web",
        "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
    })
    del environment[missing]
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$"):
        asgi.create_configured_oidc_asgi_app(
            environment=environment, engine=engine, session_factory=factory,
            authorization_resolver=_scope, principal_policy=config.principal_policy,
            pinned_jwks_json=config.jwks_json,
        )


def test_configured_oidc_binds_ready_host_and_keeps_secret_provider_lazy(host):
    asgi, engine, _, private, _, _ = host
    default_app = asgi.app
    secret_calls = []
    nonce = [None]

    def secret():
        secret_calls.append(True)
        return "synthetic-client-secret"

    def exchange(request):
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({
            "iss": ISSUER, "aud": "anvil-web", "sub": "subject-1", "nonce": nonce[0],
            "exp": now + 60, "iat": now,
        }, private, algorithm="RS256", headers={"kid": "key-1"})
        return httpx.Response(200, json={"id_token": token})

    app = _configured_app(
        host, secret=secret, transport=httpx.MockTransport(exchange),
    )
    assert asgi.app is default_app
    assert app.state.auth_mode == "OIDC"
    assert app.state.local_test_session_enabled is False
    assert secret_calls == []
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/health/ready", headers=HEADERS).status_code == 200
        started = client.post("/auth/oidc/authorization", headers=HEADERS, json={})
        assert started.status_code == 200
        url = urlsplit(started.json()["data"]["authorization_url"])
        assert parse_qs(url.query)["redirect_uri"] == [ORIGIN + "/"]
        assert secret_calls == []
        state = started.json()["data"]["browser_state"]
        with engine.connect() as db:
            nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
                oidc_pending_auth.c.state_digest == hashlib.sha256(state.encode()).digest(),
            )).scalar_one()
        callback = client.post("/auth/oidc/callback", headers=HEADERS, json={
            "code": "configured-code", "state": state, "browser_state": state,
        })
        assert callback.status_code == 200
        assert secret_calls == [True]


@pytest.mark.parametrize("change", [
    {"ANVIL_AUTH_MODE": "COOKIE"},
    {"ANVIL_AUTH_MODE": "WSL_ACCEPTANCE"},
    {"ANVIL_AUTH_MODE": ""},
    {"ANVIL_CONSOLE_BASE_URL": "http://anvil.example.test"},
    {"ANVIL_CONSOLE_BASE_URL": "https://other.example.test"},
    {"ANVIL_CONSOLE_BASE_URL": "https://anvil.example.test:8443"},
    {"ANVIL_CONSOLE_BASE_URL": "https://anvil.example.test/path"},
    {"ANVIL_CONSOLE_BASE_URL": "https://sensitive@anvil.example.test"},
    {"ANVIL_CONSOLE_BASE_URL": "https://anvil.example.test:invalid"},
    {"ANVIL_PUBLIC_HOST": "other.example.test"},
    {"ANVIL_PUBLIC_HOST": ""},
    {"ANVIL_TEST_SESSION_TTL_SECONDS": "900"},
    {"ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": "sensitive-bootstrap-token"},
])
def test_invalid_host_configuration_rejected_before_routes_or_exchange(host, change):
    asgi, engine, factory, _, config, environment = host
    environment.update(change)
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        asgi.create_oidc_asgi_app(
            oidc_config=config, engine=engine, session_factory=factory,
            authorization_resolver=_scope, environment=environment,
            transport=httpx.MockTransport(lambda request: pytest.fail("unexpected issuer exchange")),
        )
    assert error.value.__cause__ is None
    assert error.value.__context__ is None


@pytest.mark.parametrize("redirect", [
    "http://anvil.example.test/auth/oidc/callback",
    "https://other.example.test/auth/oidc/callback",
    "https://anvil.example.test:8443/auth/oidc/callback",
])
def test_redirect_origin_must_match_host_origin(host, redirect):
    asgi, engine, factory, _, config, environment = host
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$"):
        asgi.create_oidc_asgi_app(
            oidc_config=replace(config, redirect_uri=redirect), engine=engine,
            session_factory=factory,
            authorization_resolver=_scope, environment=environment,
        )


@pytest.mark.parametrize("control", ["\n", "\r", "\t"])
def test_console_url_control_characters_rejected_before_url_parse(host, control):
    asgi, engine, factory, _, config, environment = host
    environment["ANVIL_CONSOLE_BASE_URL"] = "https://anvil.exa" + control + "mple.test"
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        asgi.create_oidc_asgi_app(
            oidc_config=config, engine=engine, session_factory=factory,
            authorization_resolver=_scope, environment=environment,
        )
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_oidc_host_readiness_uses_the_same_bound_database(host):
    asgi, engine, factory, _, config, environment = host
    app = asgi.create_oidc_asgi_app(
        oidc_config=config, engine=engine, session_factory=factory,
        authorization_resolver=_scope, environment=environment,
    )
    with TestClient(app, base_url=ORIGIN) as client:
        ready = client.get("/health/ready", headers=HEADERS)
        assert ready.status_code == 200
        assert ready.json() == {"status": "ready", "migration_head": "0019_oidc_sessions"}
        with engine.begin() as db:
            db.execute(sa.text("UPDATE alembic_version SET version_num = '0016_operations_recovery'"))
        mismatch = client.get("/health/ready", headers=HEADERS)
        assert mismatch.status_code == 503
        assert mismatch.json() == {"status": "not_ready", "reason": "migration_head_mismatch"}
        with engine.begin() as db:
            db.execute(sa.text("UPDATE alembic_version SET version_num = '0013_task_bootstrap_authority'"))
        assert client.get("/health/ready", headers=HEADERS).status_code == 503


def test_oidc_host_rejects_missing_engine(host):
    asgi, _, factory, _, config, environment = host
    with pytest.raises(TypeError):
        asgi.create_oidc_asgi_app(
            oidc_config=config, session_factory=factory,
            authorization_resolver=_scope, environment=environment,
        )


def test_oidc_host_rejects_engine_not_bound_to_session_factory(host):
    asgi, _, factory, _, config, environment = host
    other_engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    try:
        with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$"):
            asgi.create_oidc_asgi_app(
                oidc_config=config, engine=other_engine, session_factory=factory,
                authorization_resolver=_scope, environment=environment,
            )
    finally:
        other_engine.dispose()


def test_oidc_host_rejects_non_engine(host):
    asgi, _, factory, _, config, environment = host
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$"):
        asgi.create_oidc_asgi_app(
            oidc_config=config, engine=None, session_factory=factory,
            authorization_resolver=_scope, environment=environment,
        )


def test_signed_oidc_flow_binds_same_coordinator_to_asgi_api_and_logout(host):
    asgi, engine, factory, private, config, environment = host
    nonce = [None]
    exchanges = []
    secret_calls = []

    def secret():
        secret_calls.append(True)
        return "synthetic-client-secret"

    def exchange(request):
        exchanges.append(request)
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({
            "iss": ISSUER, "aud": "anvil-web", "sub": "subject-1", "nonce": nonce[0],
            "exp": now + 60, "iat": now,
        }, private, algorithm="RS256", headers={"kid": "key-1"})
        return httpx.Response(200, headers={"Content-Type": "application/json"},
                              json={"id_token": token})

    scope_project = ["project-1"]

    def scope(_endpoint, _params):
        return AuthorizationScope(scope_project[0], "wsl-qa", frozenset({"operator"}))

    default_app = asgi.app
    app = asgi.create_oidc_asgi_app(
        oidc_config=replace(config, client_secret=secret), engine=engine,
        session_factory=factory,
        authorization_resolver=scope, environment=environment,
        transport=httpx.MockTransport(exchange),
    )
    assert asgi.app is default_app
    assert app.state.auth_mode == "OIDC"
    assert app.state.local_test_session_enabled is False
    assert secret_calls == [] and exchanges == []
    with TestClient(app, base_url=ORIGIN) as client:
        started = client.post("/auth/oidc/authorization", headers=HEADERS, json={})
        assert started.status_code == 200
        data = started.json()["data"]
        url = urlsplit(data["authorization_url"])
        assert url._replace(query="").geturl() == ISSUER + "/protocol/openid-connect/auth"
        assert parse_qs(url.query)["redirect_uri"] == [REDIRECT]
        assert secret_calls == [] and exchanges == []
        state = data["browser_state"]
        with engine.connect() as db:
            nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
                oidc_pending_auth.c.state_digest == hashlib.sha256(state.encode()).digest(),
            )).scalar_one()
        callback = client.post("/auth/oidc/callback", headers=HEADERS, json={
            "code": "one-use-code", "state": state, "browser_state": state,
        })
        assert callback.status_code == 200
        assert secret_calls == [True]
        assert [str(request.url) for request in exchanges] == [
            ISSUER + "/protocol/openid-connect/token"]
        assert "HttpOnly" in callback.headers["set-cookie"]
        assert "Secure" in callback.headers["set-cookie"]
        assert "anvil_session" in client.cookies
        assert state not in callback.text and "one-use-code" not in callback.text
        with engine.connect() as db:
            row = db.execute(sa.select(oidc_sessions)).mappings().one()
        assert row["session_digest"] == hashlib.sha256(
            client.cookies["anvil_session"].encode()).digest()
        assert client.cookies["anvil_session"] not in repr(dict(row))

        status = client.get("/auth/session/status", headers=HEADERS)
        allowed = client.get("/api/providers", headers=HEADERS)
        assert status.json() == {"authenticated": True, "mode": "OIDC", "actor_role": "operator"}
        assert allowed.status_code == 200
        scope_project[0] = "other-project"
        denied = client.get("/api/providers", headers=HEADERS)
        assert denied.status_code == 403
        assert denied.json()["error"]["code"] == "AUTHORIZATION_PROJECT_DENIED"
        scope_project[0] = "project-1"
        replay = client.post("/auth/oidc/callback", headers=HEADERS, json={
            "code": "one-use-code", "state": state, "browser_state": state,
        })
        assert replay.status_code == 401
        assert len(exchanges) == 1
        csrf = callback.json()["data"]["csrf_token"]
        logout = client.post("/auth/oidc/logout", headers={**HEADERS, "x-csrf-token": csrf})
        assert logout.status_code == 200
        assert client.get("/auth/session/status", headers=HEADERS).json()["authenticated"] is False
        with engine.connect() as db:
            assert db.execute(sa.select(oidc_sessions.c.revoked_at)).scalar_one() is not None


def test_oidc_host_reads_scoped_stored_alerts_without_detector_or_append(host, monkeypatch):
    from datetime import timedelta
    from packages.leases.service import LeaseService
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from tests.observability.test_f13_operations import RecordingRepository

    asgi, engine, factory, private, config, environment = host
    with engine.begin() as db:
        db.execute(roles.update().where(roles.c.role_code == "operator").values(
            permissions=["provider:read", "operations:alerts:read"],
        ))
    policy = OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}),
        frozenset({"provider:read", "operations:alerts:read"}),
        frozenset({"project-1"}), frozenset({"wsl-qa"}),
    )
    leases = LeaseService(token_factory=lambda: "synthetic-private-fence")
    at = datetime(2026, 9, 28, tzinfo=timezone.utc)
    leases.issue_worker("run-1", "worker-1", at - timedelta(minutes=10), timedelta(minutes=1))
    repository = RecordingRepository()
    owner = OperationsService("project-1", "wsl-qa",
        OperationsSources(leases=leases, lease_run_ids=("run-1",)),
        repository=repository, clock=lambda: at)
    assert owner.detect() == 1
    before = repository.load("project-1", "wsl-qa")
    nonce = [None]

    def exchange(_request):
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({
            "iss": ISSUER, "aud": "anvil-web", "sub": "subject-1", "nonce": nonce[0],
            "exp": now + 60, "iat": now,
        }, private, algorithm="RS256", headers={"kid": "key-1"})
        return httpx.Response(200, json={"id_token": token})

    scope = ["project-1", "wsl-qa"]

    def resolve(_endpoint, _params):
        return AuthorizationScope(scope[0], scope[1], frozenset({"operator"}))

    app = asgi.create_oidc_asgi_app(
        oidc_config=replace(config, principal_policy=policy), engine=engine,
        session_factory=factory, authorization_resolver=resolve,
        environment=environment, transport=httpx.MockTransport(exchange),
        operations_owner=owner,
    )
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 401
        started = client.post("/auth/oidc/authorization", headers=HEADERS, json={})
        assert started.status_code == 200
        state = started.json()["data"]["browser_state"]
        with engine.connect() as db:
            nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
                oidc_pending_auth.c.state_digest == hashlib.sha256(state.encode()).digest(),
            )).scalar_one()
        callback = client.post("/auth/oidc/callback", headers=HEADERS, json={
            "code": "alerts-code", "state": state, "browser_state": state,
        })
        assert callback.status_code == 200
        alert = client.get("/api/operations/alerts", headers=HEADERS)
        assert alert.status_code == 200
        assert [row["code"] for row in alert.json()["data"]["alerts"]] == ["WORKER_LEASE_EXPIRED"]
        assert "synthetic-private-fence" not in alert.text
        assert repository.load("project-1", "wsl-qa") == before
        assert client.get("/api/operations/audit", headers=HEADERS).status_code == 403
        scope[0] = "other-project"
        assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 403
        scope[:] = ["project-1", "other-environment"]
        assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 403
        assert repository.load("project-1", "wsl-qa") == before
        scope[:] = ["project-1", "wsl-qa"]
        with engine.begin() as db:
            db.execute(roles.update().where(roles.c.role_code == "operator").values(
                permissions=["provider:read"],
            ))
        assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 403
        with engine.begin() as db:
            db.execute(roles.update().where(roles.c.role_code == "operator").values(
                permissions=["provider:read", "operations:alerts:read"],
            ))
        unbound = asgi.create_oidc_asgi_app(
            oidc_config=replace(config, principal_policy=policy), engine=engine,
            session_factory=factory, authorization_resolver=resolve,
            environment=environment,
        )
        with TestClient(unbound, base_url=ORIGIN) as generic:
            generic.cookies.set("anvil_session", client.cookies["anvil_session"])
            assert generic.get("/api/operations/alerts", headers=HEADERS).status_code == 501

        def broken_load(_project_id, _environment_id):
            raise RuntimeError("synthetic-secret-database-connection")

        monkeypatch.setattr(repository, "load", broken_load)
        failed = client.get("/api/operations/alerts", headers=HEADERS)
        assert failed.status_code == 500
        assert failed.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "synthetic-secret" not in failed.text


def test_generic_oidc_factory_still_leaves_alerts_unbound(host):
    asgi, engine, factory, _, config, environment = host
    app = asgi.create_oidc_asgi_app(
        oidc_config=config, engine=engine, session_factory=factory,
        authorization_resolver=_scope, environment=environment,
    )
    assert app.state.operations_bound is False


def test_configured_oidc_factory_forwards_explicit_operations_owner(host):
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from tests.observability.test_f13_operations import RecordingRepository

    owner = OperationsService("project-1", "wsl-qa", OperationsSources(),
        repository=RecordingRepository())
    app = _configured_app(host, operations_owner=owner)
    assert app.state.operations_bound is True


def _cleanup_r3a_oidc_rows(engine):
    """Remove mutable QA identity rows; isolated container owns audit lifetime."""
    with engine.begin() as db:
        db.execute(oidc_sessions.delete())
        db.execute(oidc_pending_auth.delete())
        db.execute(oidc_subject_bindings.delete())
        db.execute(user_roles.delete())
        db.execute(roles.delete())
        db.execute(users.delete())


def test_isolated_pg_teardown_keeps_immutable_operations_audit():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    try:
        for metadata in (OIDC_PENDING_METADATA, DIRECTORY_METADATA, OIDC_SESSION_METADATA):
            metadata.create_all(engine)
        with engine.begin() as db:
            db.execute(users.insert().values(actor_id="r3a-actor", active=True))
            db.execute(sa.text("CREATE TABLE operations_audit_events (payload TEXT NOT NULL)"))
            db.execute(sa.text("INSERT INTO operations_audit_events(payload) VALUES ('append-only')"))
            db.execute(sa.text("CREATE TRIGGER immutable_audit BEFORE DELETE ON operations_audit_events "
                               "BEGIN SELECT RAISE(ABORT, 'operations audit is append-only'); END"))
        _cleanup_r3a_oidc_rows(engine)
        with engine.connect() as db:
            assert db.execute(sa.select(sa.func.count()).select_from(users)).scalar_one() == 0
            assert db.execute(sa.text("SELECT payload FROM operations_audit_events")).scalar_one() == "append-only"
    finally:
        engine.dispose()


def test_opt_in_isolated_pg15_oidc_process_reads_stored_alerts(tmp_path, monkeypatch):
    """WSL-only: exercise process -> host -> real PostgreSQL audit under one QA scope."""
    dsn = os.environ.get("ANVIL_F20_R3A_PG_DSN")
    isolated = os.environ.get("ANVIL_F20_R3A_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R3a isolated PG15 opt-in not configured; real DB unverified")
    if not dsn or isolated != "1":
        pytest.fail("R3A_PG_TARGET_REJECTED", pytrace=False)
    try:
        url = sa.engine.make_url(dsn)
        valid = (url.get_backend_name() == "postgresql"
                 and url.drivername in {"postgresql+psycopg", "postgresql+psycopg2", "postgresql"}
                 and url.host == "127.0.0.1" and url.port is not None
                 and url.port > 1024 and url.port != 5432
                 and isinstance(url.database, str) and url.database.startswith("anvil_f20_r3a_")
                 and isinstance(url.username, str) and url.username.startswith("anvil_f20_r3a_")
                 and not url.query)
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        pytest.fail("R3A_PG_TARGET_REJECTED", pytrace=False)

    import certifi
    from apps.api.anvil_api.oidc_process import create_oidc_process_app
    from packages.leases.service import LeaseService
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from packages.persistence.config import DatabaseSettings
    from packages.persistence.operations_repository import PostgresOperationsRepository
    from tests.api.test_oidc_process import _environment, _trust
    from datetime import timedelta

    # Module import creates the default app; supply only synthetic bootstrap
    # inputs here. The opt-in DSN is passed explicitly to the process below.
    with monkeypatch.context() as startup:
        startup.delenv("ANVIL_AUTH_MODE", raising=False)
        for name, value in {
            "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
            "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
            "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
            "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
            "ANVIL_CONSOLE_BASE_URL": ORIGIN,
            "ANVIL_PUBLIC_HOST": "anvil.example.test",
            "UPSTAGE_API_KEY": "synthetic-presence",
        }.items():
            startup.setenv(name, value)
        asgi = importlib.import_module("apps.api.anvil_api.asgi")

    engine = None
    try:
        engine = sa.create_engine(DatabaseSettings(dsn).dsn, connect_args={"connect_timeout": 2})
    except Exception:
        pass
    if engine is None:
        pytest.fail("R3A_PG_TARGET_REJECTED", pytrace=False)
    app = None
    failure_app = None
    preflight_ok = False
    try:
        with engine.connect() as db:
            version, database, role, superuser = db.execute(sa.text(
                "SELECT current_setting('server_version_num')::integer, current_database(), "
                "current_user, r.rolsuper FROM pg_roles r WHERE r.rolname=current_user"
            )).one()
            heads = db.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all()
            assert (version // 10000 == 15 and database == url.database
                    and role == url.username and superuser is False
                    and heads == ["0019_oidc_sessions"])
            for table in (
                "users", "roles", "user_roles", "oidc_subject_bindings",
                "oidc_pending_auth", "oidc_sessions", "operations_audit_events",
                "operations_audit_heads",
            ):
                assert db.execute(sa.text("SELECT count(*) FROM " + table)).scalar_one() == 0
        preflight_ok = True
    except Exception:
        pass
    if not preflight_ok:
        engine.dispose()
        pytest.fail("R3A_PG_TARGET_REJECTED", pytrace=False)

    flow_ok = False
    cleanup_ok = False
    try:
        path, trust, _ = _trust(tmp_path)
        signing = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing.public_key()))
        public.update(kid="r3a-key", use="sig", alg="RS256")
        jwks = json.dumps({"keys": [public]})
        trust.update({
            "pinned_jwks_json": jwks,
            "ca_bundle_file": certifi.where(),
            "allowed_permissions": ["provider:read", "operations:alerts:read"],
            "allowed_project_ids": ["project-1", "foreign-project"],
            "allowed_environment_ids": ["wsl-qa", "foreign-environment"],
        })
        path.write_text(json.dumps(trust))
        environment = _environment(path)
        environment["ANVIL_DATABASE_URL"] = dsn
        environment.update({
            "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
            "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
            "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
            "UPSTAGE_API_KEY": "synthetic-presence",
        })
        with engine.begin() as db:
            db.execute(users.insert().values(actor_id="r3a-actor", active=True))
            db.execute(roles.insert().values(role_code="operator", permissions=[
                "provider:read", "operations:alerts:read",
            ]))
            db.execute(user_roles.insert().values(
                actor_id="r3a-actor", role_code="operator", project_id="project-1",
                environment_id="wsl-qa", step_up_required=False, active=True,
            ))
            db.execute(oidc_subject_bindings.insert().values(
                issuer=ISSUER, subject="r3a-subject", actor_id="r3a-actor", active=True,
            ))
        psycopg_dsn = dsn
        for prefix in ("postgresql+psycopg://", "postgresql+psycopg2://"):
            if dsn.startswith(prefix):
                psycopg_dsn = "postgresql://" + dsn[len(prefix):]
                break
        repository = PostgresOperationsRepository(psycopg_dsn)
        leases = LeaseService(token_factory=lambda: "r3a-private-fence")
        at = datetime(2026, 9, 28, tzinfo=timezone.utc)
        leases.issue_worker("r3a-run", "r3a-worker", at - timedelta(minutes=10), timedelta(minutes=1))
        detector = OperationsService("project-1", "wsl-qa",
            OperationsSources(leases=leases, lease_run_ids=("r3a-run",)),
            repository=repository, clock=lambda: at)
        assert detector.detect() == 1
        before = repository.load("project-1", "wsl-qa")
        nonce = [None]

        def exchange(_request):
            now = int(datetime.now(timezone.utc).timestamp())
            token = jwt.encode({
                "iss": ISSUER, "aud": "anvil-web", "sub": "r3a-subject", "nonce": nonce[0],
                "iat": now, "exp": now + 60,
            }, signing, algorithm="RS256", headers={"kid": "r3a-key"})
            return httpx.Response(200, json={"id_token": token})

        app = create_oidc_process_app(environment, lambda **kwargs:
            asgi.create_configured_oidc_asgi_app(
                **kwargs, transport=httpx.MockTransport(exchange)))
        with TestClient(app, base_url=ORIGIN) as client:
            assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 401
            started = client.post("/auth/oidc/authorization", headers=HEADERS, json={})
            assert started.status_code == 200
            state = started.json()["data"]["browser_state"]
            with engine.connect() as db:
                nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
                    oidc_pending_auth.c.state_digest == hashlib.sha256(state.encode()).digest(),
                )).scalar_one()
            callback = client.post("/auth/oidc/callback", headers=HEADERS, json={
                "code": "r3a-code", "state": state, "browser_state": state,
            })
            assert callback.status_code == 200
            alert = client.get("/api/operations/alerts", headers=HEADERS)
            assert alert.status_code == 200
            assert [row["code"] for row in alert.json()["data"]["alerts"]] == ["WORKER_LEASE_EXPIRED"]
            assert "r3a-private-fence" not in alert.text and dsn not in alert.text
            assert repository.load("project-1", "wsl-qa") == before
            assert client.get("/api/operations/audit", headers=HEADERS).status_code == 403

            with engine.begin() as db:
                db.execute(roles.update().where(roles.c.role_code == "operator").values(
                    permissions=["provider:read"],
                ))
            assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 403
            with engine.begin() as db:
                db.execute(roles.update().where(roles.c.role_code == "operator").values(
                    permissions=["provider:read", "operations:alerts:read"],
                ))
                db.execute(user_roles.update().where(user_roles.c.actor_id == "r3a-actor").values(
                    project_id="foreign-project",
                ))
            assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 403
            with engine.begin() as db:
                db.execute(user_roles.update().where(user_roles.c.actor_id == "r3a-actor").values(
                    project_id="project-1", environment_id="foreign-environment",
                ))
            assert client.get("/api/operations/alerts", headers=HEADERS).status_code == 403
            with engine.begin() as db:
                db.execute(user_roles.update().where(user_roles.c.actor_id == "r3a-actor").values(
                    environment_id="wsl-qa",
                ))

            failure_owner = OperationsService("project-1", "wsl-qa", OperationsSources(),
                repository=PostgresOperationsRepository(
                    "postgresql://127.0.0.1:1/anvil_f20_r3a_unreachable?connect_timeout=1"))
            failure_app = asgi.create_configured_oidc_asgi_app(
                environment=environment, engine=engine,
                session_factory=sessionmaker(bind=engine),
                authorization_resolver=_scope,
                principal_policy=OidcPrincipalPolicy(
                    ISSUER, frozenset({"operator"}),
                    frozenset({"provider:read", "operations:alerts:read"}),
                    frozenset({"project-1", "foreign-project"}),
                    frozenset({"wsl-qa", "foreign-environment"}),
                ),
                pinned_jwks_json=jwks, client_secret=lambda: "synthetic-client-secret",
                ca_bundle=certifi.where(), operations_owner=failure_owner,
            )
            with TestClient(failure_app, base_url=ORIGIN) as failure_client:
                failure_client.cookies.set("anvil_session", client.cookies["anvil_session"])
                failure = failure_client.get("/api/operations/alerts", headers=HEADERS)
                assert failure.status_code == 500
                assert failure.json()["error"]["code"] == "INTERNAL_ERROR"
                assert dsn not in failure.text
            assert repository.load("project-1", "wsl-qa") == before
        flow_ok = True
    except Exception:
        pass
    finally:
        try:
            _cleanup_r3a_oidc_rows(engine)
            cleanup_ok = True
        except Exception:
            pass
        finally:
            if app is not None:
                app.state.database_engine.dispose()
            if failure_app is not None:
                failure_app.state.database_engine.dispose()
            engine.dispose()
    if not flow_ok:
        pytest.fail("R3A_PG_FLOW_FAILED", pytrace=False)
    if not cleanup_ok:
        pytest.fail("R3A_PG_CLEANUP_FAILED", pytrace=False)
