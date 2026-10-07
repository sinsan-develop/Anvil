"""F-19A Task 2 same-origin registration and exact-pair API contract."""

from __future__ import annotations

import base64
import hashlib
import json
import runpy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import create_app
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_runtime_factory import OidcRuntimeConfig
from packages.persistence.f19a_registration_repository import F19ARegistrationRepository, REGISTRATION_METADATA
from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, oidc_subject_bindings, roles, user_roles, users,
)
from packages.persistence.oidc_session_store import OIDC_SESSION_METADATA, OidcStoredSession, SqlAlchemyOidcSessionStore


def _principal(actor: str, permissions: set[str]) -> SessionPrincipal:
    return SessionPrincipal(actor, "operator", "csrf", frozenset(permissions),
        frozenset({"project-a", "project-b"}), frozenset({"test", "prod"}))


@pytest.fixture
def api():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False},
                              poolclass=sa.pool.StaticPool)

    @sa.event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    DIRECTORY_METADATA.create_all(engine)
    REGISTRATION_METADATA.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    permissions = {
        "admin": {"projects:register", "pair-grants:manage"},
        "reader": {"dashboard:read"},
        "other": {"dashboard:read"},
        "registrar": {"projects:register"},
        "manager": {"pair-grants:manage"},
    }
    with sessions.begin() as session:
        session.execute(users.insert(), [{"actor_id": actor, "active": True} for actor in permissions])
        session.execute(roles.insert(), [{"role_code": actor, "permissions": sorted(actions)}
                                         for actor, actions in permissions.items()])
        session.execute(user_roles.insert(), [{"actor_id": actor, "role_code": actor,
            "project_id": "host", "environment_id": "test", "step_up_required": False, "active": True}
            for actor in permissions])
    repository = F19ARegistrationRepository(sessions)
    principals = {actor: _principal(actor, actions) for actor, actions in permissions.items()}
    app = create_app(authenticate=lambda token: principals.get(token), registration_repository=repository)
    client = TestClient(app, base_url="https://anvil.local")
    yield client, repository
    client.close()
    engine.dispose()


def _as(client: TestClient, actor: str):
    client.cookies.set("anvil_session", actor)
    return client


def _send(client: TestClient, method: str, path: str, body: dict):
    return client.request(method, path, json=body,
        headers={"origin": "https://anvil.local", "x-csrf-token": "csrf"})


def _error(response, status: int, code: str | None = None):
    assert response.status_code == status
    error = response.json()["error"]
    assert set(error) == {"code", "message", "request_id"}
    assert isinstance(error["message"], str) and error["message"]
    assert isinstance(error["request_id"], str) and error["request_id"]
    if code is not None:
        assert error["code"] == code


def _register_pair(client, project="project-a", environment="test"):
    _as(client, "admin")
    project_result = _send(client, "POST", "/api/registration/projects",
        {"projectId": project, "displayName": project})
    environment_result = _send(client, "POST", f"/api/registration/projects/{project}/environments",
        {"environmentId": environment, "displayName": environment})
    return project_result, environment_result


def test_all_six_route_patterns_and_success_bodies(api):
    client, _ = api
    paths = {(method.upper(), path) for path, rows in client.app.openapi()["paths"].items()
             for method in rows if method in {"get", "post", "patch", "put"}}
    assert {("POST", "/api/registration/projects"),
        ("POST", "/api/registration/projects/{projectId}/environments"),
        ("PATCH", "/api/registration/projects/{projectId}"),
        ("PATCH", "/api/registration/projects/{projectId}/environments/{environmentId}"),
        ("PUT", "/api/authorization/pair-grants/{actorId}/{projectId}/{environmentId}/{permission}"),
        ("GET", "/api/dashboard/project-environments")} <= paths
    project, environment = _register_pair(client)
    assert project.status_code == environment.status_code == 201
    assert set(project.json()) == {"projectId", "displayName", "active", "registeredBy", "registeredAt"}
    assert set(environment.json()) == {"projectId", "environmentId", "displayName", "active", "registeredBy", "registeredAt"}
    assert datetime.fromisoformat(project.json()["registeredAt"].replace("Z", "+00:00")).tzinfo is not None
    grant = _send(client, "PUT", "/api/authorization/pair-grants/reader/project-a/test/dashboard:read",
        {"active": True})
    assert grant.status_code == 200
    assert set(grant.json()) == {"actorId", "projectId", "environmentId", "permission", "active", "updatedAt"}
    listed = _as(client, "reader").get("/api/dashboard/project-environments")
    assert listed.status_code == 200
    assert set(listed.json()) == {"items", "observedAt"}
    assert listed.json()["items"] == [{"projectId": "project-a", "environmentId": "test",
        "projectName": "project-a", "environmentName": "test"}]
    _as(client, "admin")
    environment_off = _send(client, "PATCH", "/api/registration/projects/project-a/environments/test",
        {"active": False})
    project_off = _send(client, "PATCH", "/api/registration/projects/project-a", {"active": False})
    assert environment_off.status_code == project_off.status_code == 200
    assert set(environment_off.json()) == {"projectId", "environmentId", "active", "updatedAt"}
    assert set(project_off.json()) == {"projectId", "active", "updatedAt"}


def test_registration_does_not_grant_and_list_uses_exact_pair_not_independent_ids(api):
    client, _ = api
    _register_pair(client, "project-a", "test")
    _register_pair(client, "project-b", "test")
    _as(client, "reader")
    assert client.get("/api/dashboard/project-environments").json()["items"] == []
    _as(client, "admin")
    assert _send(client, "PUT", "/api/authorization/pair-grants/reader/project-a/test/dashboard:read",
        {"active": True}).status_code == 200
    assert _as(client, "reader").get("/api/dashboard/project-environments").json()["items"] == [
        {"projectId": "project-a", "environmentId": "test",
         "projectName": "project-a", "environmentName": "test"}]
    assert _as(client, "other").get("/api/dashboard/project-environments").json()["items"] == []


def test_revocation_and_inactive_registration_apply_on_next_list_request(api):
    client, _ = api
    _register_pair(client)
    path = "/api/authorization/pair-grants/reader/project-a/test/dashboard:read"
    assert _send(_as(client, "admin"), "PUT", path, {"active": True}).status_code == 200
    assert len(_as(client, "reader").get("/api/dashboard/project-environments").json()["items"]) == 1
    assert _send(_as(client, "admin"), "PUT", path, {"active": False}).status_code == 200
    assert _as(client, "reader").get("/api/dashboard/project-environments").json()["items"] == []
    _send(_as(client, "admin"), "PUT", path, {"active": True})
    _send(client, "PATCH", "/api/registration/projects/project-a/environments/test", {"active": False})
    assert _as(client, "reader").get("/api/dashboard/project-environments").json()["items"] == []


def test_400_401_403_404_409_and_manager_self_grant_denials(api):
    client, _ = api
    _error(_send(_as(client, "admin"), "POST", "/api/registration/projects",
        {"projectId": "project-a", "displayName": "A", "unknown": 1}), 400)
    _error(_send(client, "POST", "/api/registration/projects", {"projectId": "bad id", "displayName": "A"}), 400)
    client.cookies.clear()
    _error(client.get("/api/dashboard/project-environments"), 401)
    _error(_send(_as(client, "reader"), "POST", "/api/registration/projects",
        {"projectId": "project-a", "displayName": "A"}), 403)
    _register_pair(client)
    _error(_send(_as(client, "admin"), "POST", "/api/registration/projects",
        {"projectId": "project-a", "displayName": "A"}), 409)
    _error(_send(_as(client, "registrar"), "POST", "/api/registration/projects/project-a/environments",
        {"environmentId": "prod", "displayName": "Prod"}), 404)
    _error(_send(_as(client, "registrar"), "PATCH", "/api/registration/projects/absent",
        {"active": False}), 404)
    grant = "/api/authorization/pair-grants/reader/project-a/test/dashboard:read"
    _error(_send(_as(client, "reader"), "PUT", grant, {"active": True}), 403)
    _error(_send(_as(client, "admin"), "PUT",
        "/api/authorization/pair-grants/admin/project-a/test/dashboard:read", {"active": True}), 403)


def test_database_unavailable_is_503_not_empty_or_forbidden(api):
    client, repository = api
    _register_pair(client)
    original = repository._sessions

    def unavailable():
        raise RuntimeError("database unavailable")

    repository._sessions = unavailable
    try:
        _error(_as(client, "reader").get("/api/dashboard/project-environments"), 503,
               "PAIR_AUTHORIZATION_UNAVAILABLE")
        _error(_send(_as(client, "admin"), "PATCH", "/api/registration/projects/project-a",
            {"active": False}), 503, "PAIR_AUTHORIZATION_UNAVAILABLE")
    finally:
        repository._sessions = original


def test_hidden_and_missing_registrations_are_indistinguishable_to_nonowner(api):
    client, _ = api
    _register_pair(client)
    for project in ("project-a", "absent"):
        _error(_send(_as(client, "registrar"), "POST",
            f"/api/registration/projects/{project}/environments",
            {"environmentId": "prod", "displayName": "Prod"}), 404, "REGISTRATION_NOT_FOUND")
        _error(_send(client, "PATCH", f"/api/registration/projects/{project}",
            {"active": False}), 404, "REGISTRATION_NOT_FOUND")
        _error(_send(client, "PATCH", f"/api/registration/projects/{project}/environments/test",
            {"active": False}), 404, "REGISTRATION_NOT_FOUND")
    assert _send(_as(client, "manager"), "POST",
        "/api/registration/projects/project-a/environments",
        {"environmentId": "prod", "displayName": "Prod"}).status_code == 201


def test_invalid_pair_and_payloads_fail_closed_without_creating_grants(api):
    client, _ = api
    _register_pair(client)
    path = "/api/authorization/pair-grants/reader/project-a/prod/dashboard:read"
    _error(_send(_as(client, "admin"), "PUT", path, {"active": True}), 404,
           "REGISTRATION_NOT_FOUND")
    _error(_send(client, "PUT",
        "/api/authorization/pair-grants/reader/project-a/test/unknown:permission",
        {"active": True}), 400, "REGISTRATION_INVALID_INPUT")
    _error(_send(client, "PATCH", "/api/registration/projects/project-a", {"active": 1}),
           400, "REGISTRATION_INVALID_INPUT")
    _error(_send(client, "PATCH", "/api/registration/projects/bad%20id", {"active": True}),
           400, "REGISTRATION_INVALID_INPUT")
    _error(_send(client, "POST", "/api/registration/projects/project-a/environments",
        {"environmentId": "test", "displayName": "Test"}), 409, "REGISTRATION_CONFLICT")
    assert _as(client, "reader").get("/api/dashboard/project-environments").json()["items"] == []


def test_dashboard_list_has_no_request_body(api):
    client, _ = api
    _error(_as(client, "reader").request("GET", "/api/dashboard/project-environments",
        json={"projectId": "project-a"}), 400, "REGISTRATION_INVALID_INPUT")


def test_same_origin_csrf_and_unbound_repository_fail_closed(api):
    client, _ = api
    _as(client, "admin")
    _error(client.post("/api/registration/projects", json={"projectId": "x", "displayName": "X"},
        headers={"origin": "https://other.example", "x-csrf-token": "csrf"}), 403)
    _error(client.post("/api/registration/projects", json={"projectId": "x", "displayName": "X"},
        headers={"origin": "https://anvil.local", "x-csrf-token": "wrong"}), 403,
        "CSRF_VALIDATION_FAILED")
    principal = _principal("reader", {"dashboard:read"})
    unbound = TestClient(create_app(authenticate=lambda token: principal if token == "reader" else None),
                         base_url="https://anvil.local")
    try:
        _error(_as(unbound, "reader").get("/api/dashboard/project-environments"), 503,
               "PAIR_AUTHORIZATION_UNAVAILABLE")
    finally:
        unbound.close()


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/registration/projects"),
    ("POST", "/api/registration/projects/project-a/environments"),
    ("PATCH", "/api/registration/projects/project-a"),
    ("PATCH", "/api/registration/projects/project-a/environments/test"),
    ("PUT", "/api/authorization/pair-grants/reader/project-a/test/dashboard:read"),
    ("GET", "/api/dashboard/project-environments"),
])
def test_each_new_route_requires_authentication(api, method, path):
    client, _ = api
    client.cookies.clear()
    _error(client.request(method, path, json={} if method != "GET" else None,
        headers={"origin": "https://anvil.local", "x-csrf-token": "csrf"}), 401,
        "AUTHENTICATION_REQUIRED")


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/registration/projects"),
    ("POST", "/api/registration/projects/project-a/environments"),
    ("PATCH", "/api/registration/projects/project-a"),
    ("PATCH", "/api/registration/projects/project-a/environments/test"),
    ("PUT", "/api/authorization/pair-grants/reader/project-a/test/dashboard:read"),
])
def test_each_mutation_rejects_malformed_json(api, method, path):
    client, _ = api
    _error(_as(client, "admin").request(method, path, content="{broken",
        headers={"origin": "https://anvil.local", "x-csrf-token": "csrf",
                 "content-type": "application/json"}), 400, "INVALID_JSON")


def test_f19a_oidc_host_requires_exact_0020_and_uses_session_actor(monkeypatch):
    for name, value in {"ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
                        "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
                        "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
                        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
                        "ANVIL_CONSOLE_BASE_URL": "https://anvil.example.test",
                        "ANVIL_PUBLIC_HOST": "anvil.example.test"}.items():
        monkeypatch.setenv(name, value)
    from apps.api.anvil_api.asgi import create_oidc_asgi_app

    origin = "https://anvil.example.test"
    issuer = "https://issuer.example.test/realms/anvil"
    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=sa.pool.StaticPool)
    try:
        for metadata in (OIDC_PENDING_METADATA, DIRECTORY_METADATA, OIDC_SESSION_METADATA,
                         REGISTRATION_METADATA):
            metadata.create_all(engine)
        sessions = sessionmaker(bind=engine, expire_on_commit=False)
        with engine.begin() as connection:
            connection.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
            connection.execute(sa.text("INSERT INTO alembic_version VALUES ('0019_oidc_sessions')"))
        permissions = {"admin": ["projects:register", "pair-grants:manage"],
                       "reader": ["dashboard:read"]}
        with sessions.begin() as session:
            session.execute(users.insert(), [{"actor_id": actor, "active": True} for actor in permissions])
            session.execute(roles.insert(), [{"role_code": actor, "permissions": actions}
                                             for actor, actions in permissions.items()])
            session.execute(user_roles.insert(), [{"actor_id": actor, "role_code": actor,
                "project_id": "host", "environment_id": "test", "step_up_required": False,
                "active": True} for actor in permissions])
            session.execute(oidc_subject_bindings.insert(), [{"issuer": issuer,
                "subject": f"subject-{actor}", "actor_id": actor, "active": True}
                for actor in permissions])
        tokens = {}
        store = SqlAlchemyOidcSessionStore(sessions)
        for actor, material in (("admin", b"a" * 32), ("reader", b"b" * 32)):
            token = base64.urlsafe_b64encode(material).rstrip(b"=").decode("ascii")
            csrf = base64.urlsafe_b64encode(b"c" * 32).rstrip(b"=").decode("ascii")
            store.put(hashlib.sha256(token.encode("ascii")).digest(), OidcStoredSession(
                issuer, f"subject-{actor}", csrf, datetime.now(timezone.utc) + timedelta(minutes=10), None))
            tokens[actor] = token
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
        public.update(kid="test-key", use="sig", alg="RS256")
        policy = OidcPrincipalPolicy(issuer, frozenset(permissions),
            frozenset({action for actions in permissions.values() for action in actions}),
            frozenset({"host"}), frozenset({"test"}))
        config = OidcRuntimeConfig(issuer, "anvil-web", origin + "/auth/oidc/callback",
            json.dumps({"keys": [public]}), "urn:anvil:step-up", policy)
        environment = {"ANVIL_AUTH_MODE": "OIDC", "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
            "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
            "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
            "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1", "ANVIL_CONSOLE_BASE_URL": origin,
            "ANVIL_PUBLIC_HOST": "anvil.example.test", "UPSTAGE_API_KEY": "synthetic-presence"}
        legacy = create_oidc_asgi_app(oidc_config=config, engine=engine, session_factory=sessions,
            authorization_resolver=lambda _endpoint, _params: None, environment=environment)
        assert "/api/registration/projects" not in legacy.openapi()["paths"]
        app = create_oidc_asgi_app(oidc_config=config, engine=engine, session_factory=sessions,
            authorization_resolver=lambda _endpoint, _params: None, environment=environment,
            f19a_enabled=True)
        with TestClient(app, base_url=origin) as client:
            assert client.get("/health/ready").status_code == 503
            with engine.begin() as connection:
                connection.execute(sa.text("UPDATE alembic_version SET version_num='0020_f19a_pair_grants'"))
            ready = client.get("/health/ready")
            assert ready.status_code == 200
            assert ready.json() == {"status": "ready", "migration_head": "0020_f19a_pair_grants"}
            client.cookies.set("anvil_session", tokens["admin"])
            headers = {"origin": origin, "x-csrf-token": csrf}
            assert client.post("/api/registration/projects", json={"projectId": "project-a",
                "displayName": "Project A"}, headers=headers).status_code == 201
            assert client.post("/api/registration/projects/project-a/environments",
                json={"environmentId": "prod", "displayName": "Prod"}, headers=headers).status_code == 201
            assert client.put("/api/authorization/pair-grants/reader/project-a/prod/dashboard:read",
                json={"active": True}, headers=headers).status_code == 200
            client.cookies.set("anvil_session", tokens["reader"])
            listed = client.get("/api/dashboard/project-environments")
            assert listed.status_code == 200
            assert listed.json()["items"] == [{"projectId": "project-a", "environmentId": "prod",
                "projectName": "Project A", "environmentName": "Prod"}]
    finally:
        engine.dispose()


def test_oidc_process_entrypoint_selects_f19a_and_exact_0020_operations_signal(monkeypatch):
    from apps.api.anvil_api import oidc_process

    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=sa.pool.StaticPool)
    try:
        with engine.begin() as connection:
            connection.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
            connection.execute(sa.text("INSERT INTO alembic_version VALUES ('0019_oidc_sessions')"))
        scope = SimpleNamespace(project_id="host", environment_id="test")
        inputs = SimpleNamespace(authorization_scope=scope, principal_policy=object(),
            pinned_jwks_json="synthetic", client_secret=None, ca_bundle=None)
        monkeypatch.setattr(oidc_process, "load_oidc_process_inputs", lambda _environment: inputs)
        monkeypatch.setattr(oidc_process.DatabaseSettings, "from_environment",
                            lambda _environment: SimpleNamespace(dsn="sqlite+pysqlite:///:memory:"))
        monkeypatch.setattr(oidc_process, "create_engine", lambda *_args, **_kwargs: engine)
        class EmptyOperationsRepository:
            def __init__(self, _dsn):
                pass

            def load(self, _project_id, _environment_id):
                return ()

            def append(self, *_args):
                raise AssertionError("read-only fixture")

        monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", EmptyOperationsRepository)
        monkeypatch.setattr(oidc_process, "load_scoped_queue_source",
                            lambda *_args: SimpleNamespace(job_ids=()))
        monkeypatch.setattr(oidc_process, "load_scoped_budget_source",
                            lambda *_args: SimpleNamespace(budget_ids=(), reservation_ids=()))
        observed = {}

        def host(**kwargs):
            observed.update(kwargs)
            return create_app()

        oidc_process.create_oidc_process_app({"ANVIL_F15_OPERATIONAL_SHELL": "0"}, host,
                                             f19a_enabled=True)
        assert observed["f19a_enabled"] is True
        owner = observed["operations_owner"]
        owner._clock()
        assert owner._source_loader("host", "test").health_signals == ()
        with engine.begin() as connection:
            connection.execute(sa.text("UPDATE alembic_version SET version_num='0020_f19a_pair_grants'"))
        owner._clock()
        signals = owner._source_loader("host", "test").health_signals
        assert len(signals) == 1
        assert signals[0].component == "database" and signals[0].state == "HEALTHY"
        observed.clear()
        oidc_process.create_oidc_process_app({"ANVIL_F15_OPERATIONAL_SHELL": "0"}, host)
        assert "f19a_enabled" not in observed
        legacy_owner = observed["operations_owner"]
        legacy_owner._clock()
        assert legacy_owner._source_loader("host", "test").health_signals == ()
        with engine.begin() as connection:
            connection.execute(sa.text("UPDATE alembic_version SET version_num='0019_oidc_sessions'"))
        legacy_owner._clock()
        assert len(legacy_owner._source_loader("host", "test").health_signals) == 1
    finally:
        engine.dispose()


def test_real_asgi_oidc_entrypoint_enables_f19a(monkeypatch):
    from apps.api.anvil_api import oidc_process

    observed = {}

    def process(_environment, _factory, **kwargs):
        observed.update(kwargs)
        return create_app()

    monkeypatch.setattr(oidc_process, "create_oidc_process_app", process)
    monkeypatch.setenv("ANVIL_AUTH_MODE", "OIDC")
    result = runpy.run_module("apps.api.anvil_api.asgi", run_name="anvil_f19a_entrypoint_contract")
    assert observed == {"f19a_enabled": True}
    assert result["app"] is not None
