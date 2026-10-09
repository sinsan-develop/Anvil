"""U-01 Task1 exact-pair Dashboard API shell; source computation belongs to Task2."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.persistence.f19a_registration_repository import (
    F19ARegistrationRepository, REGISTRATION_METADATA,
)
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, roles, user_roles, users,
)


PATH = "/api/projects/project-a/environments/test/dashboard"


def _principal(actor: str, permissions: set[str]) -> SessionPrincipal:
    return SessionPrincipal(actor, "reader", "csrf", frozenset(permissions),
                            frozenset({"project-a", "project-b"}), frozenset({"test"}))


@pytest.fixture
def api():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:",
                              connect_args={"check_same_thread": False}, poolclass=sa.pool.StaticPool)

    @sa.event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    DIRECTORY_METADATA.create_all(engine)
    REGISTRATION_METADATA.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    permissions = {"admin": {"projects:register", "pair-grants:manage"},
                   "reader": {"dashboard:read"}, "other": {"dashboard:read"}, "no-read": set()}
    with sessions.begin() as session:
        session.execute(users.insert(), [{"actor_id": actor, "active": True} for actor in permissions])
        session.execute(roles.insert(), [{"role_code": actor, "permissions": sorted(actions)}
                                         for actor, actions in permissions.items()])
        session.execute(user_roles.insert(), [{"actor_id": actor, "role_code": actor,
            "project_id": "host", "environment_id": "test", "step_up_required": False, "active": True}
            for actor in permissions])
    repository = F19ARegistrationRepository(sessions)
    for project, name in (("project-a", "Project A"), ("project-b", "Project B")):
        repository.register_project("admin", project, name)
        repository.register_environment("admin", project, "test", name + " Test")
    repository.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    calls = []

    def reader(project_id, environment_id, period_key, observed_at):
        calls.append((project_id, environment_id, period_key, observed_at))
        return {"period": {"key": period_key}, "current": {}, "occurrences": {},
                "sourceCompleteness": {}}

    principals = {actor: _principal(actor, actions) for actor, actions in permissions.items()}

    def client_for(source=reader, repo=repository):
        app = create_app(authenticate=lambda token: principals.get(token),
                         registration_repository=repo, scoped_dashboard_reader=source,
                         f19a_pair_guard_required=True,
                         authorization_resolver=lambda _endpoint, _path: AuthorizationScope(
                             "project-a", "test", frozenset({"reader"})),
                         ports=ApiPorts(queries={"GET /api/dashboard/operations":
                             lambda request: {"legacy": True}}))
        return TestClient(app, base_url="https://anvil.local")

    client = client_for()
    yield client, client_for, repository, calls
    client.close()
    engine.dispose()


def _get(client, path=PATH, actor="reader"):
    client.cookies.clear()
    if actor is not None:
        client.cookies.set("anvil_session", actor)
    return client.get(path)


def _error(response, status, code):
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert set(response.json()["error"]) == {"code", "message", "request_id"}


def test_scoped_dashboard_exact_pair_success_and_registry(api):
    client, _, _, calls = api
    endpoint = client.app.openapi()["paths"]["/api/projects/{projectId}/environments/{environmentId}/dashboard"]["get"]
    assert endpoint["tags"] == ["U-01 Task1"]
    response = _get(client, PATH + "?period=7d")
    assert response.status_code == 200
    assert set(response.json()) == {"data", "request_id"}
    assert response.json()["data"]["pair"] == {
        "projectId": "project-a", "projectName": "Project A",
        "environmentId": "test", "environmentName": "Project A Test"}
    assert response.json()["data"]["period"]["key"] == "7d"
    assert len(calls) == 1 and calls[0][:3] == ("project-a", "test", "7d")
    assert isinstance(calls[0][3], datetime) and calls[0][3].tzinfo is timezone.utc


def test_exact_pair_route_can_return_real_task2_reader_without_fixed_fallback(api):
    from packages.api.scoped_dashboard import read_scoped_dashboard

    _, client_for, _, _ = api

    class CompleteEmptyAudit:
        def load_complete(self, project_id, environment_id):
            assert (project_id, environment_id) == ("project-a", "test")
            return ()

    owner = CompleteEmptyAudit()
    with client_for(source=lambda project, environment, period, observed:
                    read_scoped_dashboard(project, environment, period, observed, owner)) as client:
        response = _get(client, PATH + "?period=1d")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["period"]["timeZone"] == "Asia/Seoul"
    assert data["occurrences"]["criticalDetected"]["count"] == 0
    assert data["current"]["health"]["database"]["status"] == "UNAVAILABLE"


@pytest.mark.parametrize("query", ["", "?period=", "?period=1D", "?period=01d",
                                   "?period=%31d",
                                   "?period=1d&period=7d", "?period=1d&extra=x", "?extra=x"])
def test_query_must_be_exact_one_canonical_period(api, query):
    client, _, _, calls = api
    _error(_get(client, PATH + query), 400, "SCOPED_DASHBOARD_INVALID_QUERY")
    assert calls == []


def test_authentication_coarse_and_exact_pair_denials_precede_source(api):
    client, _, repository, calls = api
    _error(_get(client, PATH + "?period=1d", None), 401, "AUTHENTICATION_REQUIRED")
    _error(_get(client, PATH + "?period=1d", "no-read"), 403, "AUTHORIZATION_SCOPE_MISMATCH")
    _error(_get(client, PATH + "?period=1d", "other"), 403, "AUTHORIZATION_SCOPE_MISMATCH")
    _error(_get(client, "/api/projects/project-b/environments/test/dashboard?period=1d"),
           403, "AUTHORIZATION_SCOPE_MISMATCH")
    _error(_get(client, "/api/projects/project-a/environments/absent/dashboard?period=1d"),
           403, "AUTHORIZATION_SCOPE_MISMATCH")
    assert calls == []
    repository.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", False)
    _error(_get(client, PATH + "?period=1d"), 403, "AUTHORIZATION_SCOPE_MISMATCH")
    repository.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    repository.set_registration_active("admin", "project-a", "test", False)
    _error(_get(client, PATH + "?period=1d"), 403, "AUTHORIZATION_SCOPE_MISMATCH")
    repository.set_registration_active("admin", "project-a", "test", True)
    repository.set_registration_active("admin", "project-a", None, False)
    _error(_get(client, PATH + "?period=1d"), 403, "AUTHORIZATION_SCOPE_MISMATCH")
    assert calls == []


def test_malformed_path_identifier_is_client_error_not_database_outage(api):
    client, _, _, calls = api
    _error(_get(client, "/api/projects/bad%20id/environments/test/dashboard?period=1d"),
           400, "REGISTRATION_INVALID_INPUT")
    assert calls == []


def test_database_reader_and_missing_reader_are_503_without_fixed_fallback(api):
    client, client_for, _, calls = api

    class BrokenRepository:
        def require_dashboard_pair(self, *_args):
            raise OSError("database down")

    with client_for(repo=BrokenRepository()) as broken:
        _error(_get(broken, PATH + "?period=1d"), 503, "PAIR_AUTHORIZATION_UNAVAILABLE")
    assert calls == []
    with client_for(source=None) as missing:
        _error(_get(missing, PATH + "?period=1d"), 503, "SCOPED_DASHBOARD_UNAVAILABLE")

    def broken_reader(*_args):
        raise OSError("source down")

    with client_for(source=broken_reader) as broken:
        _error(_get(broken, PATH + "?period=1d"), 503, "SCOPED_DASHBOARD_UNAVAILABLE")
    with client_for(source=lambda *_args: {"period": object(), "current": {},
                                                "occurrences": {}, "sourceCompleteness": {}}) as invalid:
        _error(_get(invalid, PATH + "?period=1d"), 503, "SCOPED_DASHBOARD_UNAVAILABLE")
    assert calls == []


def test_incomplete_critical_source_uses_dashboard_source_unavailable_envelope(api):
    from packages.api.scoped_dashboard import DashboardSourceUnavailable

    _, client_for, _, _ = api

    def incomplete(*_args):
        raise DashboardSourceUnavailable("DASHBOARD_SOURCE_UNAVAILABLE")

    with client_for(source=incomplete) as client:
        _error(_get(client, PATH + "?period=7d"), 503, "DASHBOARD_SOURCE_UNAVAILABLE")


@pytest.mark.parametrize("reader_data", [
    {"period": "7d", "current": {}, "occurrences": {}, "sourceCompleteness": {}},
    {"period": {"key": "30d"}, "current": {}, "occurrences": {}, "sourceCompleteness": {}},
    {"period": {"key": "7d"}, "current": 0, "occurrences": {}, "sourceCompleteness": {}},
    {"period": {"key": "7d"}, "current": {}, "occurrences": None, "sourceCompleteness": {}},
    {"period": {"key": "7d"}, "current": {}, "occurrences": {}, "sourceCompleteness": []},
    {"period": {"key": "7d"}, "current": {}, "occurrences": {}, "sourceCompleteness": {"bad": object()}},
])
def test_reader_top_level_types_period_match_and_json_safety_fail_closed(api, reader_data):
    _, client_for, _, _ = api
    with client_for(source=lambda *_args: reader_data) as client:
        _error(_get(client, PATH + "?period=7d"), 503, "SCOPED_DASHBOARD_UNAVAILABLE")


def test_existing_fixed_dashboard_get_is_not_replaced(api):
    client, _, _, calls = api
    response = _get(client, "/api/dashboard/operations")
    assert response.status_code == 200
    assert response.json()["data"] == {"legacy": True}
    assert calls == []
