from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

from packages.events.transition_guard import OptimisticVersionConflict


TARGET_HASH = "sha256:" + "a" * 64


def _b11():
    try:
        common = importlib.import_module("packages.api.common")
        fastapi_app = importlib.import_module("packages.api.fastapi_app")
    except ModuleNotFoundError as error:
        pytest.fail(f"B-11 common API module is missing: {error}")
    return common, fastapi_app


def _scope_resolver(fastapi_app):
    return lambda _endpoint, _path: fastapi_app.AuthorizationScope(
        "project-1", "env-local", frozenset({"owner"})
    )


def _session(common):
    return common.SessionPrincipal(
        actor_id="owner-1",
        actor_role="owner",
        csrf_token="csrf-1",
        permissions=frozenset({"run:pause", "provider:read"}),
        project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"env-local"}),
    )


def _headers() -> dict[str, str]:
    return {
        "host": "anvil.local",
        "origin": "https://anvil.local",
        "x-csrf-token": "csrf-1",
        "idempotency-key": "idem-1",
        "if-match": '"7"',
        "x-target-hash": TARGET_HASH,
        "x-permission-scope": "run:pause",
        "x-reason": "operator requested pause",
    }


def test_optimistic_version_conflict_maps_to_stable_409_envelope() -> None:
    """Returning a 500, stack, or unstable detail for a version race must fail."""
    common, fastapi_app = _b11()

    def pause(_request):
        raise OptimisticVersionConflict("expected version 7, current version 8")

    ports = fastapi_app.ApiPorts(commands={"POST /api/runs/{id}:pause": pause})
    app = fastapi_app.create_app(
        ports=ports,
        authenticate=lambda token: _session(common) if token == "session-1" else None,
        authorization_resolver=_scope_resolver(fastapi_app),
    )
    client = TestClient(app)
    client.cookies.set("anvil_session", "session-1")

    response = client.post(
        "/api/runs/run-1:pause",
        headers={**_headers(), "x-request-id": "req-conflict-1"},
        json={"expected_state_version": 7, "comment": "safe point"},
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "OPTIMISTIC_VERSION_CONFLICT",
            "message": "The resource changed. Refresh and retry with the current version.",
            "request_id": "req-conflict-1",
        }
    }
    assert "expected version" not in response.text
    assert "traceback" not in response.text.lower()
    assert response.headers["x-request-id"] == "req-conflict-1"


def test_stable_cursor_is_opaque_resource_bound_and_tamper_evident() -> None:
    """Accepting a modified or cross-resource cursor must fail."""
    common, _ = _b11()
    codec = common.StableCursorCodec(b"cursor-signing-key-for-tests-32b")

    cursor = codec.encode(resource="runs", sort_key="2026-08-21T00:00:00Z", item_id="run-9")
    decoded = codec.decode(cursor, resource="runs")

    assert decoded.sort_key == "2026-08-21T00:00:00Z"
    assert decoded.item_id == "run-9"
    assert "run-9" not in cursor
    with pytest.raises(common.ApiContractError, match="cursor"):
        codec.decode(cursor[:-1] + ("A" if cursor[-1] != "A" else "B"), resource="runs")
    with pytest.raises(common.ApiContractError, match="cursor"):
        codec.decode(cursor, resource="projects")


def test_invalid_incoming_request_id_is_replaced_with_a_valid_correlation_id() -> None:
    """Reflecting hostile request-id bytes into headers must fail."""
    common, fastapi_app = _b11()
    app = fastapi_app.create_app(
        authenticate=lambda token: _session(common) if token == "session-1" else None,
        authorization_resolver=_scope_resolver(fastapi_app),
    )
    client = TestClient(app)
    client.cookies.set("anvil_session", "session-1")

    response = client.get(
        "/api/providers",
        headers={"host": "anvil.local", "x-request-id": "bad id with spaces"},
    )

    request_id = response.headers["x-request-id"]
    assert request_id != "bad id with spaces"
    assert request_id == response.json()["error"]["request_id"]
    assert request_id.startswith("req_")


def test_unexpected_port_error_is_masked_and_correlated() -> None:
    """Leaking a server path, raw exception, or traceback must fail."""
    common, fastapi_app = _b11()

    def fail(_request):
        raise RuntimeError("secret provider failure at C:\\internal\\service.py")

    client = TestClient(
        fastapi_app.create_app(
            ports=fastapi_app.ApiPorts(commands={"POST /api/runs/{id}:pause": fail}),
            authenticate=lambda token: _session(common) if token == "session-1" else None,
            authorization_resolver=_scope_resolver(fastapi_app),
        ),
        raise_server_exceptions=False,
    )
    client.cookies.set("anvil_session", "session-1")

    response = client.post(
        "/api/runs/run-1:pause",
        headers={**_headers(), "x-request-id": "req-error-1"},
        json={"expected_state_version": 7, "comment": "safe point"},
    )

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An internal error occurred.",
            "request_id": "req-error-1",
        }
    }
    assert "secret" not in response.text
    assert "internal\\service.py" not in response.text
