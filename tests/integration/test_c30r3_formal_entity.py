"""C30R3 Task4 local preflight. WSL/PG/browser/process restart NOT_EXECUTED.

An SSH-blocked run cannot attest formal acceptance. The local database below is
the existing isolated in-memory SQLite fixture, never PostgreSQL evidence.
"""
import ast
from pathlib import Path

import pytest

from apps.api.anvil_api.routes.agent_console import create_agent_console_app
from tests.integration.test_c30r3_runtime_restore import setup, request, receipts


ROOT=Path(__file__).resolve().parents[2]


def formal_execution_plan():
    """This invocation's non-executing inventory, not an evidence issuer.

    The Main ruling permits a distinct disposable owner DB at 0015 while the
    candidate app DB stays 0013. No DB names/credentials/resources were minted
    because SSH alias resolution failed before reaching the remote host.
    """
    return dict(
        app_db_head="0013_task_bootstrap_authority",owner_db_head="0015_agent_team_owner",
        database_layout="ONE_DISPOSABLE_PG15_TWO_DISTINCT_DATABASES",release_schema_change=False,
        status="BLOCKED",blocker="SSH_ALIAS_UNRESOLVED_IN_WORKER",formal_acceptance=False,
        created_resources=[],execution={name:"NOT_EXECUTED" for name in (
            "postgresql","live_http","browser_network","process_restart","cleanup_inventory")},
    )


def plan():
    build=globals().get("formal_execution_plan")
    assert callable(build), "C30R3_DUAL_DATABASE_FORMAL_PREFLIGHT_MISSING"
    return build()


def test_dual_database_plan_preserves_release_head_without_claiming_execution():
    p=plan()
    assert p["app_db_head"]=="0013_task_bootstrap_authority"
    assert p["owner_db_head"]=="0015_agent_team_owner"
    assert p["database_layout"]=="ONE_DISPOSABLE_PG15_TWO_DISTINCT_DATABASES"
    assert p["release_schema_change"] is False
    assert p["formal_acceptance"] is False
    assert p["status"]=="BLOCKED"
    assert p["blocker"]=="SSH_ALIAS_UNRESOLVED_IN_WORKER"


@pytest.mark.parametrize("axis", ["postgresql","live_http","browser_network","process_restart","cleanup_inventory"])
def test_required_formal_axes_remain_not_executed(axis):
    assert plan()["execution"][axis]=="NOT_EXECUTED"


def test_plan_returns_detached_no_secret_or_runtime_self_attestation():
    one=plan()
    one["execution"]["postgresql"]="PASS"
    one["formal_acceptance"]=True
    assert plan()["execution"]["postgresql"]=="NOT_EXECUTED"
    assert plan()["formal_acceptance"] is False
    assert plan()["created_resources"]==[]


def test_migration_source_proves_owner_tables_are_not_in_release_0013():
    tables={}
    for path in sorted((ROOT/"migrations/versions").glob("*.py")):
        tree=ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=="create_table":
                if node.args and isinstance(node.args[0],ast.Constant):
                    tables[node.args[0].value]=path.name
    for name in ("agent_owner_heads","agent_owner_history","agent_owner_requests"):
        assert tables[name]=="0015_agent_team_owner.py"
    tree=ast.parse((ROOT/"apps/api/anvil_api/asgi.py").read_text(encoding="utf-8"))
    targets=[n.value.value for n in ast.walk(tree) if isinstance(n,ast.Assign)
        and any(isinstance(t,ast.Name) and t.id=="required_migration_head" for t in n.targets)]
    assert targets==["0013_task_bootstrap_authority"]


def test_local_four_menus_receipts_and_new_host_instance_do_not_attest_restart(monkeypatch):
    with setup(monkeypatch) as f:
        bodies={}
        for menu in ("team","moa","sns","adapters"):
            response=request(f["app"],url="/api/agent-console/"+menu)
            assert response.status_code==200,response.text
            bodies[menu]=response.json()
            assert bodies[menu]["target_hash"]==f["binding"].target_hash
            assert bodies[menu]["counts_as_pass"] is False
        assert bodies["sns"]["state"]=="EMPTY"
        assert bodies["adapters"]["data"]["kakao"]["status"]=="OPEN_DECISION"
        assert receipts(f)==4
        fresh=create_agent_console_app(runtime_owner=f["owner"]())
        for menu,body in bodies.items():
            assert request(fresh,url="/api/agent-console/"+menu).json()==body
        assert receipts(f)==4
        assert plan()["execution"]["process_restart"]=="NOT_EXECUTED"


@pytest.mark.parametrize("action", ["pause","resume","approve","apply","deploy","delete"])
@pytest.mark.parametrize("headers", [{},{"x-csrf-token":"synthetic-untrusted","origin":"https://foreign.invalid"}])
def test_local_runtime_control_and_high_risk_refused_without_receipt(monkeypatch,action,headers):
    with setup(monkeypatch) as f:
        response=request(f["app"],"POST","/api/agent-console/control",headers=headers,
            json={"action":action,"target_hash":f["binding"].target_hash,"request_id":"caller"})
        assert response.status_code==403
        assert response.json()["counts_as_pass"] is False
        assert receipts(f)==0


def test_local_offline_and_invalid_request_are_not_formal_browser_evidence():
    app=create_agent_console_app()
    assert request(app).status_code==503
    assert request(app,params={"owner":"forged"}).status_code==400
    assert request(app,url="/api/agent-console/unknown").status_code==404
    assert plan()["execution"]["browser_network"]=="NOT_EXECUTED"
