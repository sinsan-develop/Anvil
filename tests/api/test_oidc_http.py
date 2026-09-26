"""Same-origin HTTP boundary for the explicitly injected OIDC coordinator."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient
import pytest

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import create_app
from packages.api.oidc_code_flow import OidcAuthorizationRequest
from packages.api.oidc_session_coordinator import OidcIssuedSession, OidcSessionRejected


ORIGIN = "https://anvil.example.test"
HEADERS = {"host": "anvil.example.test", "origin": ORIGIN}
BEARER = "A" * 43
CSRF = "B" * 43


class Coordinator:
    def __init__(self):
        self.calls = []
        self.failure = None
        self.revoked = set()

    def begin(self, require_step_up=False):
        self.calls.append(("begin", require_step_up))
        if self.failure:
            raise self.failure
        return OidcAuthorizationRequest(
            "https://issuer.example.test/authorize?state=secret-state",
            "secret-state",
        )

    def complete(self, *, code, state, browser_state):
        self.calls.append(("complete", code, state, browser_state))
        if self.failure:
            raise self.failure
        if (code, state, browser_state) != ("secret-code", "secret-state", "secret-state"):
            raise OidcSessionRejected("OIDC_SESSION_NOT_AUTHORIZED")
        return OidcIssuedSession(BEARER, CSRF, datetime(2026, 9, 26, tzinfo=timezone.utc))

    def authenticate(self, token):
        self.calls.append(("authenticate", token))
        if self.failure:
            raise self.failure
        if token != BEARER or token in self.revoked:
            return None
        return SessionPrincipal("actor", "operator", CSRF, frozenset({"tasks:read"}),
                                frozenset({"project"}), frozenset({"wsl"}))

    def revoke(self, token):
        self.calls.append(("revoke", token))
        if self.failure:
            raise self.failure
        self.revoked.add(token)


def _client(coordinator=None, **kwargs):
    from packages.api.security import WebSecurityConfig
    app = create_app(
        oidc_session_coordinator=coordinator,
        security_config=WebSecurityConfig(
            allowed_hosts=frozenset({"anvil.example.test"}),
            allowed_origins=frozenset({ORIGIN}),
        ),
        **kwargs,
    )
    return TestClient(app, base_url=ORIGIN)


def test_routes_absent_without_explicit_coordinator():
    with _client() as client:
        for route in ("authorization", "callback", "logout"):
            assert client.post(f"/auth/oidc/{route}", headers=HEADERS).status_code == 404
        assert client.get("/auth/session/status", headers=HEADERS).json()["authenticated"] is False


def test_oidc_and_bootstrap_issuer_cannot_be_active_together():
    with pytest.raises(ValueError):
        _client(Coordinator(), session_issuer=object())


def test_authorization_requires_same_origin_and_strict_body():
    coordinator = Coordinator()
    with _client(coordinator) as client:
        for headers in ({"host": "evil.test", "origin": ORIGIN},
                        {"host": "anvil.example.test"},
                        {"host": "anvil.example.test", "origin": "https://evil.test"}):
            assert client.post("/auth/oidc/authorization", headers=headers, json={}).status_code == 403
        for body in ({"require_step_up": 1}, {"unexpected": True}, [1],
                     {"require_step_up": False, "padding": "x" * 9000}):
            assert client.post("/auth/oidc/authorization", headers=HEADERS, json=body).status_code == 400
        assert coordinator.calls == []
        response = client.post("/auth/oidc/authorization", headers=HEADERS,
                               json={"require_step_up": True})
        assert response.status_code == 200
        assert response.json()["data"] == {
            "authorization_url": "https://issuer.example.test/authorize?state=secret-state",
            "browser_state": "secret-state",
        }
        assert response.headers["cache-control"] == "no-store"
        assert coordinator.calls == [("begin", True)]


def test_callback_issues_cookie_without_echoing_code_state_or_bearer():
    coordinator = Coordinator()
    with _client(coordinator, authenticate=lambda _token: None,
                 trusted_read_principal=SessionPrincipal(
                     "fallback", "fallback", "fallback", frozenset(), frozenset(), frozenset())) as client:
        body = {"code": "secret-code", "state": "secret-state", "browser_state": "secret-state"}
        response = client.post("/auth/oidc/callback", headers=HEADERS, json=body)
        assert response.status_code == 200
        assert response.json()["data"]["csrf_token"] == CSRF
        assert response.json()["data"]["expires_in"] == 900
        assert all(secret not in response.text for secret in ("secret-code", "secret-state", BEARER))
        assert "anvil_session=" + BEARER in response.headers["set-cookie"]
        assert all(flag in response.headers["set-cookie"] for flag in
                   ("Secure", "HttpOnly", "SameSite=Strict", "Max-Age=900", "Path=/"))
        status = client.get("/auth/session/status", headers=HEADERS)
        assert status.json()["authenticated"] is True
        assert status.json()["actor_role"] == "operator"


def test_callback_rejects_invalid_body_before_coordinator_and_redacts_failures():
    coordinator = Coordinator()
    with _client(coordinator) as client:
        for body in ({"code": 1, "state": "s", "browser_state": "s"},
                     {"code": "secret-code", "state": "secret-state"},
                     {"code": "secret-code", "state": "secret-state", "browser_state": "secret-state", "extra": 1}):
            assert client.post("/auth/oidc/callback", headers=HEADERS, json=body).status_code == 400
        assert coordinator.calls == []
        coordinator.failure = OidcSessionRejected("OIDC_SESSION_NOT_AVAILABLE")
        response = client.post("/auth/oidc/callback", headers=HEADERS,
                               json={"code": "secret-code", "state": "secret-state", "browser_state": "secret-state"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "OIDC_SESSION_NOT_AVAILABLE"
        assert all(secret not in response.text for secret in ("secret-code", "secret-state", BEARER))
        assert "set-cookie" not in response.headers


def test_logout_requires_authenticated_cookie_and_matching_csrf_then_revokes_only_it():
    coordinator = Coordinator()
    with _client(coordinator) as client:
        client.cookies.set("anvil_session", BEARER)
        for headers in ({"host": "anvil.example.test", "origin": ORIGIN},
                        {**HEADERS, "x-csrf-token": "wrong"},
                        {"host": "anvil.example.test", "x-csrf-token": CSRF}):
            response = client.post("/auth/oidc/logout", headers=headers)
            assert response.status_code in {401, 403}
        assert not coordinator.revoked
        response = client.post("/auth/oidc/logout", headers={**HEADERS, "x-csrf-token": CSRF})
        assert response.status_code == 200
        assert coordinator.revoked == {BEARER}
        assert "Max-Age=0" in response.headers["set-cookie"]
        assert "Path=/" in response.headers["set-cookie"]
        assert response.headers["cache-control"] == "no-store"


def test_authentication_backend_failure_is_redacted_at_status_api_and_logout():
    coordinator = Coordinator()
    coordinator.failure = OidcSessionRejected("OIDC_SESSION_NOT_AVAILABLE")
    with _client(coordinator) as client:
        client.cookies.set("anvil_session", BEARER)
        for method, path, headers in (
            (client.get, "/auth/session/status", HEADERS),
            (client.get, "/api/providers", HEADERS),
            (client.post, "/auth/oidc/logout", {**HEADERS, "x-csrf-token": CSRF}),
        ):
            response = method(path, headers=headers)
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "OIDC_SESSION_NOT_AVAILABLE"
            assert BEARER not in response.text
        assert not coordinator.revoked


def test_oidc_request_id_never_reflects_code_or_state_even_when_header_is_spoofed():
    coordinator = Coordinator()
    coordinator.failure = OidcSessionRejected("OIDC_SESSION_NOT_AUTHORIZED")
    with _client(coordinator) as client:
        response = client.post(
            "/auth/oidc/callback",
            headers={**HEADERS, "x-request-id": "secret-code"},
            json={"code": "secret-code", "state": "secret-state", "browser_state": "secret-state"},
        )
        assert response.status_code == 401
        assert "secret-code" not in response.text
        assert "secret-code" not in response.headers["x-request-id"]


def test_unexpected_oidc_backend_exception_is_redacted():
    coordinator = Coordinator()
    coordinator.failure = RuntimeError("sensitive backend stack secret-code")
    with _client(coordinator) as client:
        response = client.post("/auth/oidc/authorization", headers=HEADERS, json={})
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "secret-code" not in response.text
        assert "sensitive backend stack" not in response.text
