from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


def _b11():
    try:
        common = importlib.import_module("packages.api.common")
        sse = importlib.import_module("packages.api.sse")
        fastapi_app = importlib.import_module("packages.api.fastapi_app")
    except ModuleNotFoundError as error:
        pytest.fail(f"B-11 SSE module is missing: {error}")
    return common, sse, fastapi_app


def _scope_resolver(fastapi_app):
    return lambda _endpoint, _path: fastapi_app.AuthorizationScope(
        "project-1", "env-local", frozenset({"tester"})
    )


def _event_ids(body: str) -> list[str]:
    return [line[4:] for line in body.splitlines() if line.startswith("id: ")]


def test_last_event_id_reconnect_replays_only_strict_successors_three_times() -> None:
    """Replaying the cursor event, skipping a successor, or creating a run must fail."""
    common, sse, fastapi_app = _b11()
    journal = sse.InMemoryEventJournal(
        (
            sse.StreamEvent("evt-1", "run-1", 1, "RUN_CREATED", {"version": 1}),
            sse.StreamEvent("evt-2", "run-1", 2, "RUN_STARTED", {"version": 2}),
            sse.StreamEvent("evt-3", "run-1", 3, "RUN_PAUSED", {"version": 3}),
            sse.StreamEvent("evt-4", "run-1", 4, "RUN_RESUMED", {"version": 4}),
        )
    )
    principal = common.SessionPrincipal(
        actor_id="tester-1",
        actor_role="tester",
        csrf_token="unused",
        permissions=frozenset({"run:events:read"}),
        project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"env-local"}),
    )
    app = fastapi_app.create_app(
        event_stream=journal,
        authenticate=lambda token: principal if token == "session-1" else None,
        authorization_resolver=_scope_resolver(fastapi_app),
    )
    client = TestClient(app)
    client.cookies.set("anvil_session", "session-1")

    for _ in range(3):
        response = client.get(
            "/api/runs/run-1/events",
            headers={"host": "anvil.local", "last-event-id": "evt-2"},
        )
        assert response.status_code == 200
        assert _event_ids(response.text) == ["evt-3", "evt-4"]
        assert response.headers["content-type"].startswith("text/event-stream")

    assert journal.read_count == 3
    assert journal.run_creation_count == 0


def test_sse_rejects_query_alias_unknown_cursor_and_cross_run_cursor() -> None:
    """Accepting ?after= or an ambiguous cursor must fail closed."""
    common, sse, fastapi_app = _b11()
    journal = sse.InMemoryEventJournal(
        (
            sse.StreamEvent("evt-run-1", "run-1", 1, "RUN_CREATED", {}),
            sse.StreamEvent("evt-run-2", "run-2", 1, "RUN_CREATED", {}),
        )
    )
    principal = common.SessionPrincipal(
        actor_id="tester-1",
        actor_role="tester",
        csrf_token="unused",
        permissions=frozenset({"run:events:read"}),
        project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"env-local"}),
    )
    client = TestClient(
        fastapi_app.create_app(
            event_stream=journal,
            authenticate=lambda token: principal if token == "session-1" else None,
            authorization_resolver=_scope_resolver(fastapi_app),
        )
    )
    client.cookies.set("anvil_session", "session-1")
    base_headers = {"host": "anvil.local"}

    alias = client.get("/api/runs/run-1/events?after=evt-run-1", headers=base_headers)
    unknown = client.get(
        "/api/runs/run-1/events", headers={"host": "anvil.local", "last-event-id": "missing"}
    )
    cross_run = client.get(
        "/api/runs/run-1/events", headers={"host": "anvil.local", "last-event-id": "evt-run-2"}
    )

    assert alias.status_code == 400
    assert alias.json()["error"]["code"] == "SSE_QUERY_CURSOR_FORBIDDEN"
    assert unknown.status_code == 409
    assert unknown.json()["error"]["code"] == "SSE_CURSOR_INVALID"
    assert cross_run.status_code == 409
    assert cross_run.json()["error"]["code"] == "SSE_CURSOR_INVALID"
