"""F-15 same-origin shell and existing mutation-security regressions."""

from pathlib import Path

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.security import WebSecurityConfig


def _client(calls):
    principal = SessionPrincipal(
        actor_id="owner-1", actor_role="owner", csrf_token="csrf-synthetic",
        permissions=frozenset({"run:pause"}), project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"env-local"}),
    )
    app = create_app(
        ports=ApiPorts(commands={"POST /api/runs/{id}:pause": lambda request: calls.append(request.resource_id) or {"ok": True}}),
        authenticate=lambda token: principal if token == "synthetic-session" else None,
        authorization_resolver=lambda *_: AuthorizationScope("project-1", "env-local", frozenset({"owner"})),
        security_config=WebSecurityConfig(
            allowed_hosts=frozenset({"127.0.0.1"}),
            allowed_origins=frozenset({"http://127.0.0.1:8300"}),
        ),
    )
    client = TestClient(app)
    client.cookies.set("anvil_session", "synthetic-session")
    return client


def test_f15_mutations_reject_cross_origin_host_and_missing_csrf_before_owner_call():
    calls = []
    client = _client(calls)
    base = {
        "host": "127.0.0.1:8300", "origin": "http://127.0.0.1:8300",
        "x-csrf-token": "csrf-synthetic", "idempotency-key": "f15-synthetic",
        "if-match": '"1"', "x-target-hash": "sha256:" + "a" * 64,
        "x-permission-scope": "run:pause", "x-reason": "synthetic check",
    }
    for change in ({"origin": "https://evil.invalid"}, {"host": "evil.invalid"}, {"x-csrf-token": ""}):
        response = client.post(
            "/api/runs/run-1:pause", headers={**base, **change},
            json={"expected_state_version": 1},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] in {
            "HOST_VALIDATION_FAILED", "ORIGIN_VALIDATION_FAILED", "CSRF_VALIDATION_FAILED",
        }
    assert calls == []
    allowed = client.post(
        "/api/runs/run-1:pause", headers=base, json={"expected_state_version": 1},
    )
    assert allowed.status_code != 403
    assert calls == ["run-1"]


def test_f15_static_ingress_preserves_same_origin_csp_and_no_fixture():
    config = (Path(__file__).resolve().parents[2] / "deploy/local/nginx.conf").read_text(encoding="utf-8")
    assert "connect-src 'self'" in config
    assert "location = /fixture-workbench { return 404; }" in config
    assert "location = /fixture-workbench.html { return 404; }" in config
    # Preserve :8300: _origin compares the browser Origin port with Host authority.
    assert "proxy_set_header Host $http_host" in config
