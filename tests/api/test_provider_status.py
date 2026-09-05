from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.provider_status import ProviderStatusPort


def _client(*, permissions: frozenset[str] = frozenset({"provider:read"})) -> TestClient:
    principal = SessionPrincipal(
        "operator-1",
        "tester",
        "csrf-not-used",
        permissions,
        frozenset({"project-1"}),
        frozenset({"env-local"}),
    )
    port = ProviderStatusPort({"UPSTAGE_API_KEY": "sentinel-provider-secret"})
    app = create_app(
        ports=ApiPorts(queries=port.query_ports()),
        authenticate=lambda token: principal if token == "session-1" else None,
        authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
            "project-1", "env-local", frozenset({"tester"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session-1")
    return client


def test_provider_list_detail_and_models_are_authenticated_read_contracts() -> None:
    """An unbound route or a response containing discovered fixture models must fail."""
    client = _client()

    listed = client.get("/api/providers", headers={"host": "anvil.local"})
    detailed = client.get("/api/providers/upstage", headers={"host": "anvil.local"})
    models = client.get(
        "/api/providers/upstage/models", headers={"host": "anvil.local"}
    )

    assert listed.status_code == detailed.status_code == models.status_code == 200
    assert [item["provider_id"] for item in listed.json()["data"]] == [
        "cerebras", "groq", "mistral", "openrouter", "upstage",
        "gemini", "anthropic", "openai", "ollama",
    ]
    assert detailed.json()["data"]["credential_status"] == "REGISTERED"
    assert detailed.json()["data"]["status"] == "DEGRADED"
    assert detailed.json()["data"]["models"] == []
    assert detailed.json()["data"]["moa_eligible"] is False
    assert models.json()["data"] == {
        "provider_id": "upstage",
        "models": [],
        "moa_eligible": False,
    }
    assert "sentinel-provider-secret" not in (
        listed.text + detailed.text + models.text + repr(client.app.state)
    )
    rendered = json.dumps(
        [listed.json(), detailed.json(), models.json()], sort_keys=True
    )
    assert "API_KEY" not in rendered
    assert "BASE_URL" not in rendered
    assert "http://" not in rendered
    assert "https://" not in rendered


@pytest.mark.parametrize("provider_id", ("UPSTAGE", "Upstage", "unknown"))
def test_unknown_or_mixed_case_provider_returns_404(provider_id: str) -> None:
    """Silently normalizing an invalid provider path must fail closed."""
    response = _client().get(
        f"/api/providers/{provider_id}", headers={"host": "anvil.local"}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROVIDER_NOT_FOUND"


def test_provider_read_requires_exact_permission() -> None:
    """A nearby plural or broad permission must not authorize provider metadata."""
    for permissions in (frozenset(), frozenset({"providers:read"}), frozenset({"*"})):
        response = _client(permissions=permissions).get(
            "/api/providers", headers={"host": "anvil.local"}
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.parametrize(
    "path,permission",
    (
        ("/api/providers/upstage:configure", "providers:configure"),
        ("/api/providers/upstage:test", "providers:test"),
        ("/api/providers/upstage:refresh-models", "providers:refresh-models"),
    ),
)
def test_provider_mutations_remain_explicitly_deferred(path: str, permission: str) -> None:
    """Accidentally binding a configure, test, or refresh command must fail this slice."""
    principal = SessionPrincipal(
        "operator-1", "tester", "csrf-token", frozenset({permission}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    app = create_app(
        ports=ApiPorts(queries=ProviderStatusPort({}).query_ports()),
        authenticate=lambda token: principal if token == "session-1" else None,
        authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
            "project-1", "env-local", frozenset({"tester"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session-1")

    response = client.post(
        path,
        headers={
            "host": "anvil.local",
            "origin": "https://anvil.local",
            "x-csrf-token": "csrf-token",
            "idempotency-key": "deferred-command",
            "if-match": "0",
            "x-target-hash": "sha256:" + "a" * 64,
            "x-permission-scope": permission,
            "x-reason": "Verify deferred command boundary.",
        },
    )

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "CAPABILITY_NOT_AVAILABLE"
