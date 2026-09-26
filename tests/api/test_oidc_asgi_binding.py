"""Trusted OIDC host binding through the public ASGI shell."""

import hashlib
import importlib
import json
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
        db.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES ('0013_task_bootstrap_authority')"))
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
        assert ready.json() == {"status": "ready", "migration_head": "0013_task_bootstrap_authority"}
        with engine.begin() as db:
            db.execute(sa.text("UPDATE alembic_version SET version_num = '0012_run_authority'"))
        mismatch = client.get("/health/ready", headers=HEADERS)
        assert mismatch.status_code == 503
        assert mismatch.json() == {"status": "not_ready", "reason": "migration_head_mismatch"}


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
