"""R10 Dashboard contract through the OIDC session-only ASGI entry."""

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.operations import OperationsPort
from tests.api.test_f20_u01_r10_dashboard_api import PATH, owner


class SessionCoordinator:
    def authenticate(self, token):
        if token != "oidc-session":
            return None
        return SessionPrincipal("operator", "operator", "csrf",
            frozenset({"dashboard:read"}), frozenset({"project-1"}), frozenset({"env-1"}))


def test_oidc_dashboard_needs_session_and_cannot_use_legacy_permission():
    dashboard = owner()
    app = create_app(ports=ApiPorts(queries=OperationsPort(dashboard).query_ports()),
        oidc_session_coordinator=SessionCoordinator(),
        authorization_resolver=lambda _endpoint, _params:
            AuthorizationScope("project-1", "env-1", frozenset({"operator"})))
    client = TestClient(app, base_url="https://anvil.local")
    assert client.get(PATH).status_code == 401
    client.cookies.set("anvil_session", "oidc-session")
    assert client.get(PATH).status_code == 200
    assert client.get("/api/operations/alerts").status_code == 403
