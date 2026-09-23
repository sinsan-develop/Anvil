"""Typed runtime restoration: local SQLite/ASGI, not PG or process restart."""
import asyncio
from contextlib import contextmanager
from dataclasses import replace
import importlib.util
from pathlib import Path

import httpx
import pytest
from sqlalchemy import event, text

from packages.api import runtime
from packages.api.common import SessionPrincipal
from apps.api.anvil_api.routes.agent_console import ConsoleProjectionService, create_agent_console_app
from tests.agent_team.test_owner_component_restore import setup as typed_setup, rewrite, install_fixture_snapshot
from tests.integration.test_c30r2_runtime_owner import setup as legacy_setup
from tests.api.test_runtime_app import _env


def request(app, method="GET", url="/api/agent-console/team", **kwargs):
    async def execute():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                base_url="https://anvil.sinsan.kr", cookies={"anvil_session":"fixture-auth"}) as c:
            return await c.request(method, url, **kwargs)
    return asyncio.run(execute())


@contextmanager
def setup(monkeypatch):
    with typed_setup(monkeypatch) as f:
        principal=SessionPrincipal(f["binding"].actor_id,"tester","csrf",frozenset({"tasks:read"}),
            frozenset({"project"}),frozenset({"local"}))
        state={"principal":principal,"mapping":f["principal"]}
        calls=[]
        def authenticate(token):
            calls.append("auth")
            return state["principal"] if token=="fixture-auth" else None
        def mapping(principal, token_hash):
            calls.append("mapping")
            return state["mapping"]
        def owner():
            return runtime.RuntimeConsoleOwner(session_factory=f["sessions"],authenticate=authenticate,
                resolve_mapping=mapping,clock=lambda:f["now"])
        app=create_agent_console_app(runtime_owner=owner())
        yield dict(f, state=state, calls=calls, authenticate=authenticate, mapping=mapping,
            owner=owner, app=app)


def receipts(f):
    with f["sessions"]() as s,s.begin():
        return s.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one()


@pytest.mark.parametrize("menu", ["team","moa","sns","adapters"])
def test_default_runtime_restores_real_owners_and_replays_durable_receipt(monkeypatch,menu):
    with setup(monkeypatch) as f:
        out=request(f["app"],url="/api/agent-console/"+menu)
        assert out.status_code==200,out.text
        body=out.json()
        assert body["counts_as_pass"] is False and body["external_runtime"]=="NOT_EXECUTED"
        if menu=="team":
            assert [r["role"] for r in body["data"]["tasks"]]==["REVIEW","TEST"]
            assert body["data"]["tasks"][0]["result_hash"] is not None
        if menu=="moa": assert len(body["data"]["proposals"])==1
        fresh=create_agent_console_app(runtime_owner=f["owner"]())
        assert request(fresh,url="/api/agent-console/"+menu).json()==body
        assert receipts(f)==1


@pytest.mark.parametrize("headers", [{"x-owner-snapshot":"forged"},{"x-principal-mapping":"forged"},
    {"x-owner-components":"forged"},{"x-execution-fence":"forged"},{"x-actor-id":"foreign"}])
def test_headers_cannot_supply_owner_authority(monkeypatch,headers):
    with setup(monkeypatch) as f:
        assert request(f["app"],headers=headers).status_code==403
        assert f["calls"]==[] and receipts(f)==0


@pytest.mark.parametrize("kwargs", [{"params":{"owner":"forged"}},
    {"content":b'{"snapshot":"forged"}'},{"content":b'not json'}])
def test_query_and_body_rejected_before_authentication(monkeypatch,kwargs):
    with setup(monkeypatch) as f:
        assert request(f["app"],**kwargs).status_code==400
        assert f["calls"]==[] and receipts(f)==0


def test_control_cannot_mutate_restored_owner(monkeypatch):
    with setup(monkeypatch) as f:
        assert request(f["app"],"POST","/api/agent-console/control",json={"action":"resume"}).status_code==403
        assert receipts(f)==0 and f["calls"]==[]


def test_mapping_revalidated_after_projection_before_receipt(monkeypatch):
    with setup(monkeypatch) as f:
        original=ConsoleProjectionService.read
        def changed(self,*args,**kwargs):
            out=original(self,*args,**kwargs)
            f["state"]["mapping"]=replace(f["principal"],auth_generation=2)
            return out
        monkeypatch.setattr(ConsoleProjectionService,"read",changed)
        assert request(f["app"]).status_code==403
        assert receipts(f)==0


def test_repository_revocation_before_final_publication_denies(monkeypatch):
    with setup(monkeypatch) as f:
        original=ConsoleProjectionService.read
        def changed(self,*args,**kwargs):
            out=original(self,*args,**kwargs)
            with f["sessions"]() as s,s.begin():
                f["repo"].revoke_generation(s,binding=f["binding"],expected_version=1,
                    request_id="revoke",reason="OWNER_REVOKED")
            return out
        monkeypatch.setattr(ConsoleProjectionService,"read",changed)
        assert request(f["app"]).status_code==403
        assert receipts(f)==0


def test_revoked_generation_cannot_replay_existing_receipt(monkeypatch):
    with setup(monkeypatch) as f:
        assert request(f["app"]).status_code==200
        assert receipts(f)==1
        with f["sessions"]() as s,s.begin():
            f["repo"].revoke_generation(s,binding=f["binding"],expected_version=1,
                request_id="revoke",reason="OWNER_REVOKED")
        assert request(f["app"]).status_code==403
        assert receipts(f)==1


@pytest.mark.parametrize("field", ["actor_id","context_id","session_id","execution_fence","write_fence","target_hash"])
def test_principal_binding_spoof_cannot_select_a_persisted_owner(monkeypatch,field):
    with setup(monkeypatch) as f:
        f["state"]["mapping"]=replace(f["principal"],binding=replace(f["binding"],**{field:"forged"}))
        assert request(f["app"]).status_code==403
        assert receipts(f)==0


def test_restored_owner_changed_during_read_is_rejected(monkeypatch):
    with setup(monkeypatch) as f:
        original=ConsoleProjectionService.read
        def changed(self,*args,**kwargs):
            out=original(self,*args,**kwargs)
            self._policy.revoke(f["binding"].assignment_id)
            return out
        monkeypatch.setattr(ConsoleProjectionService,"read",changed)
        assert request(f["app"]).status_code==403
        assert receipts(f)==0
        monkeypatch.setattr(ConsoleProjectionService,"read",original)
        # Request-local hydrated owners never mutate the canonical export.
        assert request(f["app"]).status_code==200


def test_receipt_failure_rolls_back_and_fresh_restore_retries(monkeypatch):
    with setup(monkeypatch) as f:
        def fail(conn,cursor,statement,parameters,context,executemany):
            if "INSERT INTO agent_owner_requests" in statement:raise RuntimeError("synthetic-secret-no-leak")
        event.listen(f["engine"],"before_cursor_execute",fail)
        try:
            out=request(f["app"])
            assert out.status_code==503 and "synthetic-secret" not in out.text
        finally:
            event.remove(f["engine"],"before_cursor_execute",fail)
        assert receipts(f)==0
        assert request(f["app"]).status_code==200
        assert receipts(f)==1


def test_untrusted_mapping_field_callback_never_executes(monkeypatch):
    with setup(monkeypatch) as f:
        calls=[]
        class Hostile:
            def __deepcopy__(self,memo):calls.append("copy");return "actor1"
            def __eq__(self,other):calls.append("eq");return True
            def __str__(self):calls.append("str");return "actor1"
        object.__setattr__(f["state"]["mapping"].binding,"actor_id",Hostile())
        assert request(f["app"]).status_code==403
        assert calls==[] and receipts(f)==0


def test_nested_component_tamper_cannot_be_a_projection(monkeypatch):
    with setup(monkeypatch) as f:
        bad=rewrite(f["snapshot"],0,lambda row:row["payload"]["state"]["spent"].clear())
        install_fixture_snapshot(f,bad)
        assert request(f["app"]).status_code==403
        assert receipts(f)==0


def test_legacy_projection_is_not_export_and_remains_explicitly_not_integrated(monkeypatch):
    with legacy_setup(monkeypatch) as f:
        owner=runtime.RuntimeConsoleOwner(session_factory=f["sessions"],authenticate=f["authenticate"],
            resolve_mapping=f["resolve_mapping"],clock=lambda:f["now"])
        async def execute():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_agent_console_app(runtime_owner=owner)),
                    base_url="https://anvil.sinsan.kr",cookies={"anvil_session":f["token"]}) as c:
                return await c.get("/api/agent-console/team")
        out=asyncio.run(execute())
        assert out.status_code==503
        assert out.json()["owner_restore"]=="NOT_INTEGRATED"
        assert out.json()["reason"]=="OWNER_EXPORT_NOT_AVAILABLE"
        assert receipts(f)==0


def test_runtime_factory_and_actual_asgi_use_builtin_restore_without_materializer(monkeypatch):
    with setup(monkeypatch) as f:
        app=runtime.create_runtime_app(environment=_env(),session_factory=f["sessions"],
            authenticate=f["authenticate"],console_mapping_resolver=f["mapping"],console_clock=lambda:f["now"])
        assert app.state.agent_console_restore_status=="TYPED_OWNER_RESTORE_CONFIGURED"
        monkeypatch.setattr(runtime,"create_runtime_app",lambda:app)
        path=Path(__file__).resolve().parents[2]/"apps/api/anvil_api/asgi.py"
        spec=importlib.util.spec_from_file_location("_c30r3_asgi",path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        assert request(module.app).status_code==200
        assert app.state.migration_head=="0013_task_bootstrap_authority"
        assert request(module.app,url="/health/ready").status_code==503
