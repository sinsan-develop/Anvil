"""Actual configured OIDC app; local SQL source doubles, not PG evidence."""
from decimal import Decimal

from fastapi.testclient import TestClient
import pytest

from apps.api.anvil_api import oidc_process
from tests.integration.test_f20_u01_r37_provider_host_pg15 import (
    local_host, _synthetic_auth_rows, _auth_rows, AUTH_TABLES, ORIGIN, roles,
)
from tests.api.test_f20_u01_r10_dashboard_api import PATH
from tests.api.test_f20_u01_r37_provider_host_binding import FIELDS, assert_registration
from tests.persistence.test_operations_budget_read import Engine, load, reservation


@pytest.fixture
def bound(local_host, monkeypatch):
    (app, owner, engine), environment, _ = local_host
    calls = []
    state = {"source": load(Engine())}
    def budget(actual, project, env):
        assert actual is engine
        calls.append((project, env))
        if "error" in state: raise RuntimeError("synthetic private SQL error")
        return state["source"]
    monkeypatch.setattr(oidc_process, "load_scoped_budget_source", budget, raising=False)
    yield app, owner, engine, state, calls


def test_current_host_missing_budget_wiring_is_not_accepted_as_empty(bound):
    app, owner, engine, state, calls = bound
    assert calls == []
    with _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
        assert api.get(PATH).status_code == 401 and calls == []
        api.cookies.set("anvil_session", token)
        before = _auth_rows(engine)
        response = api.get(PATH)
        assert response.status_code == 200
        data = response.json()["data"]
        assert set(data) == FIELDS
        assert data["budget"] == [{"budget_id": "b1", "hard_cost_limit": "20",
            "hard_token_limit": 1000, "reserved_cost": "2.1", "reserved_tokens": 21,
            "consumed_cost": "0.2", "consumed_tokens": 2, "active_requests": 1,
            "new_action_allowed": False}]
        assert data["reservations"][0]["reservation_id"] == "z1"
        assert data["reservations"][0]["forecast_cost"] == "2.1"
        assert data["reservations"][0]["actual_cost"] is None
        assert_registration(data)
        assert data["queue"] == data["alerts"] == []
        assert data["run_summary"]["status"] == "AVAILABLE"
        assert data["run_summary"]["observed_total"] == 0
        assert calls == [("project-1", "wsl-qa")]
        assert owner._source_loader("project-1", "wsl-qa").request_ids == ()
        assert _auth_rows(engine) == before


def test_empty_budget_is_real_empty_observation_not_missing_source(bound):
    app, _, engine, state, calls = bound
    state["source"] = load(Engine([], []))
    with _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
        api.cookies.set("anvil_session", token)
        data = api.get(PATH).json()["data"]
        assert data["budget"] == data["reservations"] == []
        assert calls == [("project-1", "wsl-qa")]


@pytest.mark.parametrize("project,environment", [("other", "wsl-qa"), ("project-1", "other"),
                                               (None, "wsl-qa"), ([], "wsl-qa")])
def test_scope_denied_before_queue_and_budget_reads(bound, monkeypatch, project, environment):
    _, owner, _, _, calls = bound
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", lambda *_a: pytest.fail("queue read"))
    with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
        owner._source_loader(project, environment)
    assert calls == []


@pytest.mark.parametrize("failure", ["queue", "budget"])
def test_database_failure_is_503_without_partial_or_private_values(bound, monkeypatch, failure):
    app, _, engine, state, calls = bound
    if failure == "queue":
        def fail(*_a): raise RuntimeError("synthetic private SQL error")
        monkeypatch.setattr(oidc_process, "load_scoped_queue_source", fail)
    else:
        state["error"] = True
    with _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
        api.cookies.set("anvil_session", token)
        before = _auth_rows(engine)
        response = api.get(PATH)
        assert response.status_code == 503
        assert "synthetic private SQL error" not in response.text
        assert "hard_cost_limit" not in response.text
        assert _auth_rows(engine) == before
    if failure == "queue": assert calls == []


def test_permission_revocation_denied_before_budget_read(bound):
    app, _, engine, _, calls = bound
    with _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
        api.cookies.set("anvil_session", token)
        assert api.get(PATH).status_code == 200
        calls.clear()
        with engine.begin() as db:
            db.execute(roles.update().where(roles.c.role_code == "operator").values(permissions=["provider:read"]))
        before = _auth_rows(engine)
        assert api.get(PATH).status_code == 403
        assert calls == [] and _auth_rows(engine) == before
    assert _auth_rows(engine) == ((),) * len(AUTH_TABLES)


def test_unknown_usage_keeps_exposure_without_inventing_actual_or_dispatch(bound):
    app, _, engine, state, _ = bound
    state["source"] = load(Engine(reservations=[reservation(status="RECONCILIATION_REQUIRED",
        consumed_cost=Decimal("0.7"))]))
    with _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
        api.cookies.set("anvil_session", token)
        data = api.get(PATH).json()["data"]
        assert data["budget"][0]["reserved_cost"] == "2.1"
        assert data["budget"][0]["consumed_cost"] == "0.7"
        row = data["reservations"][0]
        assert row["actual_cost"] is row["actual_tokens"] is None
        assert row["lifecycle"] == "USAGE_UNKNOWN"
