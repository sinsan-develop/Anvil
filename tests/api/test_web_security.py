from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


TARGET_HASH = "sha256:" + "b" * 64


def _b11():
    try:
        common = importlib.import_module("packages.api.common")
        security = importlib.import_module("packages.api.security")
        fastapi_app = importlib.import_module("packages.api.fastapi_app")
    except ModuleNotFoundError as error:
        pytest.fail(f"B-11 Web security module is missing: {error}")
    return common, security, fastapi_app


def _principal(common, permissions=frozenset({"run:pause", "run:events:read"})):
    return common.SessionPrincipal(
        actor_id="owner-1",
        actor_role="owner",
        csrf_token="csrf-1",
        permissions=permissions,
        project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"env-local"}),
    )


def _valid_mutation_headers() -> dict[str, str]:
    return {
        "host": "anvil.local",
        "origin": "https://anvil.local",
        "x-csrf-token": "csrf-1",
        "idempotency-key": "idem-1",
        "if-match": '"1"',
        "x-target-hash": TARGET_HASH,
        "x-permission-scope": "run:pause",
        "x-reason": "pause requested",
    }


@pytest.mark.parametrize("missing", ["origin", "x-csrf-token", "host"])
def test_mutation_rejects_missing_csrf_origin_or_host_before_side_effect(missing: str) -> None:
    """Moving Web checks after command dispatch must fail this side-effect assertion."""
    common, _, fastapi_app = _b11()
    calls: list[str] = []
    ports = fastapi_app.ApiPorts(commands={"POST /api/runs/{id}:pause": lambda request: calls.append(request.resource_id) or {"ok": True}})
    client = TestClient(
        fastapi_app.create_app(
            ports=ports,
            authenticate=lambda token: _principal(common) if token == "session-1" else None,
        )
    )
    client.cookies.set("anvil_session", "session-1")
    headers = _valid_mutation_headers()
    headers.pop(missing)

    response = client.post(
        "/api/runs/run-1:pause",
        headers=headers,
        json={"expected_state_version": 1},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] in {"CSRF_VALIDATION_FAILED", "ORIGIN_VALIDATION_FAILED", "HOST_VALIDATION_FAILED"}
    assert calls == []


def test_cookie_security_headers_cors_and_untrusted_proxy_are_fail_closed() -> None:
    """Weakening cookie/CSP/CORS/proxy defaults must fail observable headers."""
    common, security, fastapi_app = _b11()
    principal = _principal(common, frozenset({"provider:read"}))
    app = fastapi_app.create_app(
        authenticate=lambda token: principal if token == "session-1" else None,
        security_config=security.WebSecurityConfig(
            allowed_hosts=frozenset({"anvil.local"}),
            allowed_origins=frozenset({"https://anvil.local"}),
            trusted_proxy_ips=frozenset({"10.0.0.10"}),
        ),
    )
    client = TestClient(app)
    client.cookies.set("anvil_session", "session-1")

    response = client.get(
        "/api/providers",
        headers={"host": "anvil.local", "x-forwarded-host": "evil.invalid", "x-forwarded-proto": "http"},
    )
    assert response.status_code == 501
    assert response.headers["strict-transport-security"].startswith("max-age=")
    assert "unsafe-inline" not in response.headers["content-security-policy"]
    assert "unsafe-eval" not in response.headers["content-security-policy"]
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert "object-src 'none'" in response.headers["content-security-policy"]
    assert "evil.invalid" not in response.text

    cookie = security.build_session_cookie("opaque-token", max_age_seconds=900)
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie
    assert "Max-Age=900" in cookie
    with pytest.raises(ValueError, match="short-lived"):
        security.build_session_cookie("opaque-token", max_age_seconds=86_400)

    allowed = client.options(
        "/api/providers",
        headers={"host": "anvil.local", "origin": "https://anvil.local", "access-control-request-method": "GET"},
    )
    denied = client.options(
        "/api/providers",
        headers={"host": "anvil.local", "origin": "https://evil.invalid", "access-control-request-method": "GET"},
    )
    assert allowed.headers["access-control-allow-origin"] == "https://anvil.local"
    assert allowed.headers.get("access-control-allow-credentials") == "true"
    assert denied.headers.get("access-control-allow-origin") is None
    assert denied.status_code == 403


@pytest.mark.parametrize(
    ("path", "permission"),
    [
        ("/api/design-specifications/design-1:approve", "human:design:approve"),
        ("/api/evidence-manifests/evidence-1", "evidence:read"),
        ("/api/runs/run-1/events", "run:events:read"),
    ],
)
def test_sensitive_endpoints_authorize_every_request(path: str, permission: str) -> None:
    """Treating same-origin or authentication alone as authorization must fail."""
    common, _, fastapi_app = _b11()
    principal = _principal(common, frozenset())
    client = TestClient(
        fastapi_app.create_app(authenticate=lambda token: principal if token == "session-1" else None)
    )
    client.cookies.set("anvil_session", "session-1")
    method = "POST" if ":approve" in path else "GET"
    headers = _valid_mutation_headers() if method == "POST" else {"host": "anvil.local"}
    if method == "POST":
        headers["x-permission-scope"] = permission
    response = client.request(method, path, headers=headers, json={} if method == "POST" else None)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"
