from __future__ import annotations

import importlib
import re

import pytest
from fastapi.testclient import TestClient


def _b11():
    try:
        registry = importlib.import_module("packages.api.registry")
        fastapi_app = importlib.import_module("packages.api.fastapi_app")
        bff = importlib.import_module("packages.bff.client")
    except ModuleNotFoundError as error:
        pytest.fail(f"B-11 API/BFF module is missing: {error}")
    return registry, fastapi_app, bff


def _scope_resolver(fastapi_app):
    return lambda _endpoint, _path: fastapi_app.AuthorizationScope(
        "project-1", "env-local", frozenset({"owner", "tester"})
    )


def test_registry_is_the_single_openapi_source_and_has_no_command_aliases() -> None:
    """A removed canonical route or slash-command alias must change this contract."""
    registry, fastapi_app, _ = _b11()
    api_registry = registry.canonical_api_registry()
    entries = {(entry.method, entry.path) for entry in api_registry.endpoints}

    required = {
        ("POST", "/api/projects/{id}/intents"),
        ("POST", "/api/tasks/{taskId}/runs"),
        ("GET", "/api/runs/{id}/events"),
        ("POST", "/api/runs/{id}:pause"),
        ("POST", "/api/design-intent-reviews/{id}:continue"),
        ("POST", "/api/deployments/{id}:rollback"),
        ("GET", "/api/evidence-manifests/{id}"),
    }
    assert required <= entries
    assert ("POST", "/api/work-instructions/{id}/runs") not in entries
    assert ("POST", "/api/execution-plans/{id}/runs") not in entries
    assert all("/pause" not in path and "/approve" not in path for _, path in entries)
    assert len(entries) == len(api_registry.endpoints)

    app = fastapi_app.create_app(registry=api_registry)
    openapi = app.openapi()
    exposed = {
        (method.upper(), path)
        for path, operations in openapi["paths"].items()
        for method in operations
        if method.lower() in {"get", "post", "put", "patch", "delete"}
    }
    assert exposed == entries
    for path, operations in openapi["paths"].items():
        placeholders = set(re.findall(r"\{([^{}]+)\}", path))
        for operation in operations.values():
            declared = {
                parameter["name"]
                for parameter in operation.get("parameters", [])
                if parameter["in"] == "path"
            }
            assert declared == placeholders


def test_unbound_future_capability_fails_closed_instead_of_returning_fake_success() -> None:
    """Replacing the unbound-port guard with a placeholder success must fail."""
    _, fastapi_app, _ = _b11()
    common = importlib.import_module("packages.api.common")
    principal = common.SessionPrincipal(
        actor_id="owner-1",
        actor_role="owner",
        csrf_token="unused",
        permissions=frozenset({"provider:read"}),
        project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"env-local"}),
    )
    client = TestClient(
        fastapi_app.create_app(
            authenticate=lambda token: principal if token == "session-1" else None,
            authorization_resolver=_scope_resolver(fastapi_app),
        )
    )
    client.cookies.set("anvil_session", "session-1")

    response = client.get(
        "/api/providers",
        headers={"host": "anvil.local"},
    )

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "CAPABILITY_NOT_AVAILABLE"
    assert response.headers["x-request-id"] == response.json()["error"]["request_id"]


def test_browser_api_url_is_relative_while_server_bff_keeps_internal_base_private() -> None:
    """Allowing an absolute browser URL or reflecting the BFF base must fail."""
    _, _, bff = _b11()
    assert bff.browser_api_url("/api/runs/run-1/progress") == "/api/runs/run-1/progress"
    for hostile in (
        "http://localhost:8000/api/runs/run-1/progress",
        "https://api.internal/api/runs/run-1/progress",
        "//api.internal/api/runs/run-1/progress",
        "/runs/run-1/progress",
    ):
        with pytest.raises(ValueError):
            bff.browser_api_url(hostile)

    observed: list[str] = []

    def transport(method: str, url: str, headers: dict[str, str], body: bytes | None):
        observed.append(url)
        return bff.BffResponse(200, {"content-type": "application/json"}, b'{"ok":true}')

    client = bff.ServerBffClient("http://anvil-api:8000", transport)
    response = client.request("GET", "/api/runs/run-1/progress")

    assert observed == ["http://anvil-api:8000/api/runs/run-1/progress"]
    assert response.body == b'{"ok":true}'
    assert "anvil-api" not in repr(response)
