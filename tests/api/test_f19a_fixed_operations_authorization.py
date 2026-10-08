"""F-19A Task 3 exact-pair authorization for fixed Operations routes."""

import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.persistence.f19a_registration_repository import (
    F19ARegistrationRejected, F19ARegistrationRepository, REGISTRATION_METADATA,
)
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, oidc_subject_bindings, users, roles, user_roles,
)
from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA
from packages.persistence.oidc_session_store import (
    OIDC_SESSION_METADATA, OidcStoredSession, SqlAlchemyOidcSessionStore,
)
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_runtime_factory import OidcRuntimeConfig


FIXED = (
    ("GET /api/dashboard/operations", "/api/dashboard/operations", "dashboard:read"),
    ("GET /api/operations/alerts", "/api/operations/alerts", "operations:alerts:read"),
    ("POST /api/operations/alerts/{alertId}:acknowledge",
     "/api/operations/alerts/alert-1:acknowledge", "operations:alerts:acknowledge"),
)


class PairRepository:
    def __init__(self, rejected=None):
        self.rejected = rejected
        self.calls = []

    def require_pair_grant(self, actor_id, project_id, environment_id, permission):
        self.calls.append((actor_id, project_id, environment_id, permission))
        if self.rejected:
            raise F19ARegistrationRejected(self.rejected)
        return True


def client(repository, *, actor="actor-a", scope=("project-a", "shared-env"), permissions=None,
           f19a_pair_guard_required=False):
    principal = SessionPrincipal(actor, "operator", "csrf", frozenset(permissions if permissions is not None else {
        "dashboard:read", "operations:alerts:read", "operations:alerts:acknowledge",
        "operations:audit:read"}), frozenset({"project-a", "project-b"}),
        frozenset({"shared-env"}))
    app = create_app(ports=ApiPorts(
        queries={key: lambda _request: {"ok": True} for key, _, _ in FIXED if key.startswith("GET ")}
        | {"GET /api/operations/audit": lambda _request: {"events": []}},
        commands={FIXED[2][0]: lambda _request: {"ok": True}}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _path: AuthorizationScope(*scope, frozenset({"operator"})),
        registration_repository=repository, f19a_pair_guard_required=f19a_pair_guard_required)
    result = TestClient(app, base_url="https://anvil.local")
    result.cookies.set("anvil_session", "session")
    return result


def request(client, key, path, permission):
    if key.startswith("GET "):
        return client.get(path)
    return client.post(path, json={}, headers={"origin": "https://anvil.local",
        "x-csrf-token": "csrf", "idempotency-key": "ack-1", "if-match": "1",
        "x-target-hash": "sha256:" + "a" * 64,
        "x-permission-scope": permission, "x-reason": "reviewed"})


def test_fixed_operations_requires_exact_pair_after_coarse_authorization():
    for key, path, permission in FIXED:
        repo = PairRepository("AUTHORIZATION_SCOPE_MISMATCH")
        response = request(client(repo, f19a_pair_guard_required=True), key, path, permission)
        assert response.status_code == 403, key
        assert response.json()["error"]["code"] == "AUTHORIZATION_SCOPE_MISMATCH"
        assert repo.calls == [("actor-a", "project-a", "shared-env", permission)]


def test_fixed_operations_db_failure_is_503_and_other_actor_is_independent():
    for key, path, permission in FIXED:
        repo = PairRepository("PAIR_AUTHORIZATION_UNAVAILABLE")
        response = request(client(repo, actor="actor-b", f19a_pair_guard_required=True), key, path, permission)
        assert response.status_code == 503, key
        assert response.json()["error"]["code"] == "PAIR_AUTHORIZATION_UNAVAILABLE"
        assert repo.calls == [("actor-b", "project-a", "shared-env", permission)]


def test_fixed_operations_granted_response_shape_and_scope_stay_unchanged():
    for key, path, permission in FIXED:
        repo = PairRepository()
        response = request(client(repo, f19a_pair_guard_required=True), key, path, permission)
        assert response.status_code == 200, key
        assert response.json()["data"] == {"ok": True}
        assert repo.calls == [("actor-a", "project-a", "shared-env", permission)]
    repo = PairRepository()
    response = client(repo, scope=("project-b", "shared-env"),
        f19a_pair_guard_required=True).get("/api/operations/alerts")
    assert response.status_code == 200
    assert repo.calls == [("actor-a", "project-b", "shared-env", "operations:alerts:read")]


def test_coarse_denial_precedes_pair_lookup_and_unknown_db_error_fails_closed():
    repo = PairRepository()
    denied = client(repo, permissions={"dashboard:read"},
        f19a_pair_guard_required=True).get("/api/operations/alerts")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
    assert repo.calls == []

    class BrokenRepository:
        def require_pair_grant(self, *_args):
            raise RuntimeError("database unavailable")

    failed = client(BrokenRepository(), f19a_pair_guard_required=True).get("/api/operations/alerts")
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "PAIR_AUTHORIZATION_UNAVAILABLE"

    class FalseRepository:
        def require_pair_grant(self, *_args):
            return False

    false = client(FalseRepository(), f19a_pair_guard_required=True).get("/api/operations/alerts")
    assert false.status_code == 403
    assert false.json()["error"]["code"] == "AUTHORIZATION_SCOPE_MISMATCH"


def test_legacy_without_registration_repository_and_audit_are_unchanged():
    for key, path, permission in FIXED:
        assert request(client(None), key, path, permission).status_code == 200
    repo = PairRepository("AUTHORIZATION_SCOPE_MISMATCH")
    assert client(repo, f19a_pair_guard_required=True).get("/api/operations/audit").status_code == 200
    assert repo.calls == []


def test_legacy_with_repository_does_not_change_fixed_operations_response():
    for key, path, permission in FIXED:
        repo = PairRepository("AUTHORIZATION_SCOPE_MISMATCH")
        response = request(client(repo, f19a_pair_guard_required=False), key, path, permission)
        assert response.status_code == 200, key
        assert response.json()["data"] == {"ok": True}
        assert repo.calls == []


def test_active_fixed_operations_with_missing_repository_fail_closed():
    for key, path, permission in FIXED:
        response = request(client(None, f19a_pair_guard_required=True), key, path, permission)
        assert response.status_code == 503, key
        assert response.json()["error"]["code"] == "PAIR_AUTHORIZATION_UNAVAILABLE"


def test_real_store_rechecks_same_session_exact_pair_revoke_and_inactive_next_request():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=sa.pool.StaticPool)
    @sa.event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")
    try:
        DIRECTORY_METADATA.create_all(engine)
        REGISTRATION_METADATA.create_all(engine)
        sessions = sessionmaker(bind=engine, expire_on_commit=False)
        actions = ["dashboard:read", "operations:alerts:read", "operations:alerts:acknowledge"]
        with sessions.begin() as session:
            session.execute(users.insert(), [{"actor_id": actor, "active": True}
                for actor in ("admin", "actor-a", "actor-b")])
            session.execute(roles.insert(), [{"role_code": "admin", "permissions":
                ["projects:register", "pair-grants:manage"]},
                {"role_code": "reader", "permissions": actions}])
            session.execute(user_roles.insert(), [{"actor_id": actor,
                "role_code": "admin" if actor == "admin" else "reader",
                "project_id": "host", "environment_id": "test", "step_up_required": False,
                "active": True} for actor in ("admin", "actor-a", "actor-b")])
        repository = F19ARegistrationRepository(sessions)
        for project in ("project-a", "project-b"):
            repository.register_project("admin", project, project)
            repository.register_environment("admin", project, "shared-env", "Shared")
        repository.set_pair_grant("admin", "actor-a", "project-b", "shared-env",
            "operations:alerts:read", True)
        session_client = client(repository, f19a_pair_guard_required=True)
        def read():
            return session_client.get("/api/operations/alerts")
        assert read().status_code == 403  # same environment id in a different project
        repository.set_pair_grant("admin", "actor-a", "project-a", "shared-env",
            "operations:alerts:read", True)
        assert read().status_code == 200
        assert client(repository, actor="actor-b", f19a_pair_guard_required=True).get(
            "/api/operations/alerts").status_code == 403
        repository.set_pair_grant("admin", "actor-a", "project-a", "shared-env",
            "operations:alerts:read", False)
        assert read().status_code == 403
        repository.set_pair_grant("admin", "actor-a", "project-a", "shared-env",
            "operations:alerts:read", True)
        repository.set_registration_active("admin", "project-a", "shared-env", False)
        assert read().status_code == 403
        repository.set_registration_active("admin", "project-a", "shared-env", True)
        assert read().status_code == 200
        repository.set_registration_active("admin", "project-a", None, False)
        assert read().status_code == 403
        repository.set_registration_active("admin", "project-a", None, True)
        assert read().status_code == 200
        engine.dispose()
        assert read().status_code == 503
    finally:
        engine.dispose()


def test_actual_0020_oidc_host_uses_session_actor_for_fixed_operations(monkeypatch):
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from tests.observability.test_f13_operations import RecordingRepository

    origin, issuer = "https://anvil.example.test", "https://issuer.example.test/realms/anvil"
    environment = {"ANVIL_AUTH_MODE": "OIDC", "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1", "ANVIL_CONSOLE_BASE_URL": origin,
        "ANVIL_PUBLIC_HOST": "anvil.example.test", "UPSTAGE_API_KEY": "synthetic-presence"}
    for name, value in environment.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("ANVIL_AUTH_MODE", "COOKIE")
    from apps.api.anvil_api.asgi import create_oidc_asgi_app
    monkeypatch.setenv("ANVIL_AUTH_MODE", "OIDC")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=sa.pool.StaticPool)
    try:
        for metadata in (OIDC_PENDING_METADATA, DIRECTORY_METADATA, OIDC_SESSION_METADATA,
                         REGISTRATION_METADATA):
            metadata.create_all(engine)
        sessions = sessionmaker(bind=engine, expire_on_commit=False)
        with engine.begin() as connection:
            connection.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
            connection.execute(sa.text("INSERT INTO alembic_version VALUES ('0020_f19a_pair_grants')"))
        with sessions.begin() as session:
            session.execute(users.insert(), [{"actor_id": "admin", "active": True},
                {"actor_id": "reader", "active": True}])
            session.execute(roles.insert(), [{"role_code": "admin", "permissions":
                ["projects:register", "pair-grants:manage"]},
                {"role_code": "reader", "permissions": ["operations:alerts:read"]}])
            session.execute(user_roles.insert(), [{"actor_id": actor, "role_code": actor,
                "project_id": "host", "environment_id": "test", "step_up_required": False,
                "active": True} for actor in ("admin", "reader")])
            session.execute(oidc_subject_bindings.insert(), [{"issuer": issuer,
                "subject": f"subject-{actor}", "actor_id": actor, "active": True}
                for actor in ("admin", "reader")])
        token = base64.urlsafe_b64encode(b"r" * 32).rstrip(b"=").decode("ascii")
        csrf = base64.urlsafe_b64encode(b"c" * 32).rstrip(b"=").decode("ascii")
        SqlAlchemyOidcSessionStore(sessions).put(hashlib.sha256(token.encode()).digest(),
            OidcStoredSession(issuer, "subject-reader", csrf,
                datetime.now(timezone.utc) + timedelta(minutes=10), None))
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
        public.update(kid="test-key", use="sig", alg="RS256")
        policy = OidcPrincipalPolicy(issuer, frozenset({"admin", "reader"}),
            frozenset({"projects:register", "pair-grants:manage", "operations:alerts:read"}),
            frozenset({"host"}), frozenset({"test"}))
        config = OidcRuntimeConfig(issuer, "anvil-web", origin + "/auth/oidc/callback",
            json.dumps({"keys": [public]}), "urn:anvil:step-up", policy)
        owner = OperationsService("host", "test", OperationsSources(),
            repository=RecordingRepository(), clock=lambda: datetime.now(timezone.utc))
        app = create_oidc_asgi_app(oidc_config=config, engine=engine, session_factory=sessions,
            authorization_resolver=lambda _endpoint, _path: AuthorizationScope(
                "host", "test", frozenset({"reader"})), environment=environment,
            operations_owner=owner, f19a_enabled=True)
        repository = F19ARegistrationRepository(sessions)
        with TestClient(app, base_url=origin) as oidc_client:
            oidc_client.cookies.set("anvil_session", token)
            assert oidc_client.get("/health/ready").status_code == 200
            assert oidc_client.get("/api/operations/alerts").status_code == 403
            repository.register_project("admin", "host", "Host")
            repository.register_environment("admin", "host", "test", "Test")
            repository.set_pair_grant("admin", "reader", "host", "test",
                "operations:alerts:read", True)
            assert oidc_client.get("/api/operations/alerts").status_code == 200
            repository.set_pair_grant("admin", "reader", "host", "test",
                "operations:alerts:read", False)
            assert oidc_client.get("/api/operations/alerts").status_code == 403
        from apps.api.anvil_api import asgi as asgi_module
        monkeypatch.setattr(asgi_module, "F19ARegistrationRepository", lambda _sessions: None)
        miswired = create_oidc_asgi_app(oidc_config=config, engine=engine, session_factory=sessions,
            authorization_resolver=lambda _endpoint, _path: AuthorizationScope(
                "host", "test", frozenset({"reader"})), environment=environment,
            operations_owner=owner, f19a_enabled=True)
        with TestClient(miswired, base_url=origin) as miswired_client:
            miswired_client.cookies.set("anvil_session", token)
            missing = miswired_client.get("/api/operations/alerts")
            assert missing.status_code == 503
            assert missing.json()["error"]["code"] == "PAIR_AUTHORIZATION_UNAVAILABLE"
    finally:
        engine.dispose()
