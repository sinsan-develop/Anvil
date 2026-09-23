"""C30R2 Task4A: local formal-entity preflight only.

NO PostgreSQL, live HTTP, browser or process restart is performed here.
TestClient and the existing in-memory SQLite fixture prove only local contracts.
A green preflight test proves that missing formal evidence blocks acceptance.
"""
from dataclasses import dataclass, fields
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from packages.api import runtime
from apps.api.anvil_api.routes.agent_console import create_agent_console_app
from tests.api.test_runtime_app import _env
from tests.integration.test_c30r2_runtime_owner import setup


@dataclass(frozen=True, slots=True)
class FormalPreflight:
    owner_runtime: str
    owner_restore: str
    release_target: str
    owner_schema_target: str
    migration_decision: str
    database_execution: str
    browser_execution: str
    restart_execution: str
    missing_evidence: tuple[str, ...]
    acceptance_allowed: bool = False
    counts_as_pass: bool = False

    def to_dict(self):
        return {f.name:getattr(self,f.name) for f in fields(type(self))}


def formal_preflight(app):
    """Read local wiring only; cannot accept a self-attested evidence payload.

    This is a test harness inventory, not a release gate or a network probe.
    Task4A deliberately has no method for turning status strings/fixtures into
    real PG15, live HTTP, browser Network or OS-restart evidence. Those require
    a separately authorized execution and independent review.
    """
    if type(app) is not FastAPI:
        raise ValueError("C30R2_PREFLIGHT_APP_REQUIRED")
    owner=getattr(app.state,"agent_console_runtime",None)
    target=getattr(app.state,"migration_head",None)
    target=target if type(target) is str and target in (
        "0013_task_bootstrap_authority","0015_agent_team_owner") else "UNVERIFIED"
    return FormalPreflight(
        owner_runtime="HOST_SEAM_ONLY" if type(owner) is runtime.RuntimeConsoleOwner else "MISSING",
        owner_restore="NOT_INTEGRATED", release_target=target,
        owner_schema_target="0015_agent_team_owner", migration_decision="MAIN_DECISION_REQUIRED",
        database_execution="NOT_EXECUTED",browser_execution="NOT_EXECUTED",restart_execution="NOT_EXECUTED",
        missing_evidence=("PG15_COMMITTED_ENTITY_AND_ROLLBACK","AUTHENTICATED_LIVE_HTTP",
            "BROWSER_SAME_ORIGIN_NETWORK","PROCESS_RESTART_OWNER_REVOCATION_RECEIPTS"),
    )


def preflight(app):
    inspect = globals().get("formal_preflight")
    assert callable(inspect), "C30R2_FORMAL_PREFLIGHT_NOT_IMPLEMENTED"
    return inspect(app)


def test_unwired_runtime_preflight_never_upgrades_database_refs_to_formal_pass():
    def forbidden_session():
        pytest.fail("preflight must not open a DB session")
    app=runtime.create_runtime_app(environment=_env(),session_factory=forbidden_session)
    p=preflight(app)
    assert p.owner_runtime == "MISSING"
    assert p.owner_restore == "NOT_INTEGRATED"
    assert p.release_target == "0013_task_bootstrap_authority"
    assert p.owner_schema_target == "0015_agent_team_owner"
    assert p.migration_decision == "MAIN_DECISION_REQUIRED"
    assert p.missing_evidence == (
        "PG15_COMMITTED_ENTITY_AND_ROLLBACK",
        "AUTHENTICATED_LIVE_HTTP",
        "BROWSER_SAME_ORIGIN_NETWORK",
        "PROCESS_RESTART_OWNER_REVOCATION_RECEIPTS",
    )
    assert not p.acceptance_allowed and not p.counts_as_pass


def test_host_materializer_seam_and_local_success_still_require_formal_evidence(monkeypatch):
    with setup(monkeypatch) as f:
        app=runtime.create_runtime_app(environment=_env(),session_factory=f["sessions"],
            engine=f["engine"],authenticate=f["authenticate"],
            console_mapping_resolver=f["resolve_mapping"],console_materializer=f["materialize"],
            console_clock=lambda:f["now"])
        p=preflight(app)
        assert p.owner_runtime == "HOST_SEAM_ONLY"
        assert p.database_execution == "NOT_EXECUTED"
        assert p.browser_execution == "NOT_EXECUTED"
        assert p.restart_execution == "NOT_EXECUTED"
        assert not p.acceptance_allowed
        for menu in ("team","moa","sns","adapters"):
            r=f["client"].get("/api/agent-console/"+menu)
            assert r.status_code == 200
        assert preflight(app) == p  # local fixture success does not satisfy formal evidence


@pytest.mark.parametrize("claimed",["PASS","REAL","RESTORED","PRODUCTION_READY"])
def test_host_status_string_cannot_attest_formal_restore(claimed):
    app=FastAPI()
    app.state.agent_console_restore_status=claimed
    app.state.runtime_database_configured=True
    app.state.migration_head="0015_agent_team_owner"
    p=preflight(app)
    assert p.owner_restore == "NOT_INTEGRATED"
    assert p.acceptance_allowed is False
    assert p.migration_decision == "MAIN_DECISION_REQUIRED"


def test_preflight_does_not_call_engine_clock_or_owner_descriptor():
    calls=[]
    class Hostile:
        def __getattribute__(self,name):
            calls.append(name)
            raise AssertionError("unexpected callback")
    app=FastAPI()
    app.state.agent_console_runtime=Hostile()
    app.state.database_engine=Hostile()
    app.state.migration_head=Hostile()
    p=preflight(app)
    assert p.owner_runtime == "MISSING" and p.release_target == "UNVERIFIED"
    assert calls == []


def test_preflight_projection_detached_no_raw_credentials_or_mutation():
    app=FastAPI()
    app.state.migration_head="0013_task_bootstrap_authority"
    first=preflight(app)
    object.__setattr__(first,"acceptance_allowed",True)
    assert preflight(app).acceptance_allowed is False
    serialized=json.dumps(preflight(app).to_dict())
    assert "cookie" not in serialized and "csrf" not in serialized
    assert "execution_fence" not in serialized


def test_local_four_menu_entity_receipts_bind_exact_owner_and_are_idempotent(monkeypatch):
    with setup(monkeypatch) as f:
        bodies={}
        for menu in ("team","moa","sns","adapters"):
            r=f["client"].get("/api/agent-console/"+menu)
            assert r.status_code == 200
            body=r.json()
            assert body["session_id"] == f["binding"].session_id
            assert body["target_hash"] == f["binding"].target_hash
            assert body["baseline_hash"] == f["binding"].baseline_hash
            assert not body["counts_as_pass"] and not body["automatic_acceptance"]
            assert body["external_runtime"] == "NOT_EXECUTED"
            assert f["token"] not in r.text and f["binding"].execution_fence not in r.text
            bodies[menu]=body
        assert bodies["team"]["data"]["tasks"][0]["task_id"] == "task1"
        assert bodies["team"]["data"]["tasks"][0]["assignment_hash"] == f["binding"].assignment_hash
        for menu,body in bodies.items():
            assert f["client"].get("/api/agent-console/"+menu).json() == body
        with f["sessions"]() as session,session.begin():
            rows=session.execute(text("SELECT response_json FROM agent_owner_requests WHERE operation='RECEIPT'")).scalars().all()
            assert len(rows)==4
            for raw in rows:
                stored=json.loads(raw)
                binding=stored["binding"]
                assert binding["assignment_id"] == f["binding"].assignment_id
                assert binding["generation"] == 1
                assert binding["actor_id"] == f["binding"].actor_id
                assert binding["context_id"] == f["binding"].context_id
                assert binding["session_id"] == f["binding"].session_id
                assert binding["target_hash"] == f["binding"].target_hash
                assert binding["execution_fence"] == f["binding"].execution_fence
                assert stored["owner_snapshot_hash"] == f["snapshot"].content_hash
                assert stored["principal_mapping_hash"] == f["mapping"].mapping_hash
                assert json.loads(stored["response_json"]) == bodies[stored["menu"]]


@pytest.mark.parametrize("action",["pause","resume","approve","deploy","delete"])
def test_local_control_refusal_never_mutates_owner_or_saves_fake_acceptance(monkeypatch,action):
    with setup(monkeypatch) as f:
        before=f["team"].project().content_hash
        response=f["client"].post("/api/agent-console/control",
            json={"action":action,"target_hash":f["binding"].target_hash,"request_id":"control"})
        assert response.status_code == 403 and not response.json()["counts_as_pass"]
        assert f["team"].project().content_hash == before
        with f["sessions"]() as session,session.begin():
            assert session.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one()==0


def test_local_spoofed_request_has_no_entity_or_receipt(monkeypatch):
    with setup(monkeypatch) as f:
        f["client"].cookies.clear()
        response=f["client"].get("/api/agent-console/team",
            headers={"x-actor-id":f["binding"].actor_id,"x-target-hash":f["binding"].target_hash})
        assert response.status_code == 403
        assert f["binding"].target_hash not in response.text
        with f["sessions"]() as session,session.begin():
            assert session.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one()==0
