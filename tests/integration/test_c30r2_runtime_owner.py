"""Task3 local ASGI/SQL wiring; NOT live HTTP, PG or durable owner restoration."""
from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic.migration import MigrationContext
from alembic.operations import Operations

from packages.api import runtime
from packages.api.common import SessionPrincipal
from packages.persistence.agent_team_owner_repository import (
    OwnerBinding, OwnerComponent, OwnerSnapshot, PrincipalMapping,
    SqlAlchemyAgentTeamOwnerRepository,
)
from apps.api.anvil_api.routes.agent_console import ConsoleAuthority, ConsoleProjectionService, create_agent_console_app
from tests.persistence.test_agent_team_owner_repository import canonical, digest, sealed, migration
from tests.api.test_runtime_app import _env


def runtime_class():
    assert hasattr(runtime, "RuntimeConsoleOwner"), "C30R2_RUNTIME_OWNER_NOT_IMPLEMENTED"
    return runtime.RuntimeConsoleOwner


@contextmanager
def setup(monkeypatch):
    cls = runtime_class()
    import tests.agent_team.test_role_contracts_c22 as c22
    import tests.agent_team.test_orchestration_c23 as c23
    now = datetime.now(timezone.utc).replace(microsecond=0)
    monkeypatch.setattr(c22, "NOW", now)
    monkeypatch.setattr(c23, "NOW", now)
    team, policy, results, _, tasks = c23.fixture(("REVIEW", "TEST"))
    team.register_plan(tasks, actor_id="main", now=now)
    assignment = tasks[0].assignment
    service = ConsoleProjectionService(team,policy,
        assignment_ids={t.task.task_id:t.assignment.assignment_id for t in tasks})
    authority = ConsoleAuthority(assignment.assignment_id,assignment.actor_id,
        assignment.context_id,assignment.session_id,assignment.target_hash,assignment.execution_fence)
    assert hasattr(service, "owner_components"), "C30R2_MATERIALIZATION_BINDING_NOT_IMPLEMENTED"
    components = service.owner_components(authority, now=now)
    binding = OwnerBinding("project","local",assignment.session_id,assignment.assignment_id,1,
        assignment.actor_id,assignment.context_id,assignment.workspace_id,assignment.baseline_hash,
        assignment.target_hash,assignment.content_hash,assignment.execution_fence,None)
    token = "synthetic-session-token-only"
    principal = SessionPrincipal(binding.actor_id,"tester","synthetic-csrf",
        frozenset({"tasks:read"}),frozenset({"project"}),frozenset({"local"}))
    mapping = sealed(PrincipalMapping(binding,digest(token),1,binding.actor_id,"tester",
        ("tasks:read",),now-timedelta(seconds=1),now+timedelta(minutes=30),""),"mapping_hash")
    snapshot = sealed(OwnerSnapshot(binding,1,*components,(mapping,),
        now-timedelta(seconds=1),now+timedelta(minutes=30),""))
    engine = create_engine("sqlite://",poolclass=StaticPool,connect_args={"check_same_thread":False})
    @event.listens_for(engine,"connect")
    def connected(dbapi, _):
        dbapi.isolation_level = None
    @event.listens_for(engine,"begin")
    def begun(connection):
        connection.exec_driver_sql("BEGIN")
    with engine.begin() as c:
        with Operations.context(MigrationContext.configure(c)):
            migration().upgrade()
    sessions = sessionmaker(bind=engine)
    with sessions() as s, s.begin():
        SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
            s,snapshot=snapshot,expected_version=0,request_id="initial")
    state = {"principal":principal,"mapping":mapping,"service":service,"auth":True}
    calls = []
    def authenticate(value):
        calls.append("auth")
        return state["principal"] if state["auth"] and value==token else None
    def resolve_mapping(authenticated, token_hash):
        calls.append("mapping")
        assert token_hash == digest(token)
        return state["mapping"]
    def materialize(stored):
        calls.append("materialize")
        assert stored.content_hash == snapshot.content_hash
        return state["service"]
    owner = cls(session_factory=sessions,authenticate=authenticate,
        resolve_mapping=resolve_mapping,materialize=materialize,clock=lambda:now)
    app = create_agent_console_app(runtime_owner=owner)
    client = TestClient(app)
    client.cookies.set("anvil_session",token)
    try:
        yield locals()
    finally:
        client.close()
        engine.dispose()


def test_authenticated_actual_domain_projection_and_committed_receipt_replay(monkeypatch):
    with setup(monkeypatch) as f:
        r = f["client"].get("/api/agent-console/team")
        assert r.status_code == 200, r.text
        assert [x["role"] for x in r.json()["data"]["tasks"]] == ["REVIEW","TEST"]
        assert r.json()["counts_as_pass"] is False
        assert f["client"].get("/api/agent-console/team").json() == r.json()
        with f["sessions"]() as s, s.begin():
            assert s.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one() == 1
        assert f["calls"].count("auth") >= 4


@pytest.mark.parametrize("menu",["team","moa","sns","adapters"])
def test_each_menu_reads_exact_server_owned_mapping(monkeypatch,menu):
    with setup(monkeypatch) as f:
        r=f["client"].get("/api/agent-console/"+menu)
        assert r.status_code == 200 and r.json()["menu"] == menu
        assert "execution_fence" not in r.text and "synthetic-session-token" not in r.text


@pytest.mark.parametrize("field,value",[
    ("actor_id","foreign"),("actor_role","human"),("permissions",frozenset()),
    ("project_ids",frozenset({"foreign"})),("environment_ids",frozenset({"foreign"})),
])
def test_authenticated_principal_mismatch_has_no_projection_or_receipt(monkeypatch,field,value):
    with setup(monkeypatch) as f:
        f["state"]["principal"]=replace(f["principal"],**{field:value})
        assert f["client"].get("/api/agent-console/team").status_code == 403
        assert "materialize" not in f["calls"]
        with f["sessions"]() as s, s.begin():
            assert s.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one() == 0


@pytest.mark.parametrize("field,value",[
    ("session_id","foreign"),("context_id","foreign"),("workspace_id","foreign"),
    ("execution_fence","stale"),("target_hash","sha256:"+"f"*64),
])
def test_mapping_spoof_cannot_select_foreign_or_stale_owner(monkeypatch,field,value):
    with setup(monkeypatch) as f:
        changed=replace(f["mapping"].binding,**{field:value})
        f["state"]["mapping"]=sealed(replace(f["mapping"],binding=changed),"mapping_hash")
        assert f["client"].get("/api/agent-console/team").status_code == 403
        assert "materialize" not in f["calls"]


def test_anonymous_header_body_and_query_cannot_mint_authority(monkeypatch):
    with setup(monkeypatch) as f:
        f["client"].cookies.clear()
        r=f["client"].get("/api/agent-console/team",headers={"x-actor-id":f["binding"].actor_id,
            "x-assignment-id":f["binding"].assignment_id,"x-execution-fence":f["binding"].execution_fence})
        assert r.status_code == 403
        assert f["client"].get("/api/agent-console/team?session_id=forged").status_code == 400
        assert f["client"].post("/api/agent-console/control",json={"actor_id":f["binding"].actor_id}).status_code == 403


def test_durable_revocation_wins_over_live_inprocess_owner(monkeypatch):
    with setup(monkeypatch) as f:
        assert f["client"].get("/api/agent-console/team").status_code == 200
        with f["sessions"]() as s, s.begin():
            SqlAlchemyAgentTeamOwnerRepository().revoke_generation(s,binding=f["binding"],
                expected_version=1,request_id="revoke",reason="OWNER_REVOKED")
        assert f["client"].get("/api/agent-console/team").status_code == 403


def test_materializer_auth_revocation_after_initial_check_publishes_nothing(monkeypatch):
    with setup(monkeypatch) as f:
        def materialize(snapshot):
            f["state"]["auth"]=False
            return f["service"]
        owner=runtime_class()(session_factory=f["sessions"],authenticate=f["authenticate"],
            resolve_mapping=f["resolve_mapping"],materialize=materialize,clock=lambda:f["now"])
        client=TestClient(create_agent_console_app(runtime_owner=owner))
        client.cookies.set("anvil_session",f["token"])
        assert client.get("/api/agent-console/team").status_code == 403
        with f["sessions"]() as s,s.begin():
            assert s.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one() == 0


def test_live_owner_drift_requires_new_persisted_snapshot(monkeypatch):
    with setup(monkeypatch) as f:
        from tests.agent_team.test_orchestration_c23 import claim
        claim(f["team"],f["tasks"][0])
        assert f["client"].get("/api/agent-console/team").status_code == 403


def test_default_and_incomplete_runtime_are_offline_not_fake_success(monkeypatch):
    assert TestClient(create_agent_console_app()).get("/api/agent-console/team").status_code == 503
    cls=runtime_class()
    with pytest.raises(runtime.RuntimeConfigurationError):
        cls(session_factory=lambda:None,authenticate=None,resolve_mapping=None,materialize=None)


def test_runtime_factory_exposes_host_owner_to_actual_asgi_registration(monkeypatch):
    with setup(monkeypatch) as f:
        app=runtime.create_runtime_app(environment=_env(),session_factory=f["sessions"],
            authenticate=f["authenticate"],console_mapping_resolver=f["resolve_mapping"],
            console_materializer=f["materialize"],console_clock=lambda:f["now"])
        assert type(app.state.agent_console_runtime) is runtime_class()
        monkeypatch.setattr(runtime,"create_runtime_app",lambda:app)
        path=Path(__file__).resolve().parents[2]/"apps/api/anvil_api/asgi.py"
        spec=importlib.util.spec_from_file_location("_c30r2_asgi",path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        client=TestClient(module.app,base_url="https://anvil.sinsan.kr")
        client.cookies.set("anvil_session",f["token"])
        assert client.get("/api/agent-console/team").status_code == 200
        assert app.state.migration_head == "0013_task_bootstrap_authority"


def test_materializer_receives_detached_snapshot_and_cannot_rebind_authority(monkeypatch):
    with setup(monkeypatch) as f:
        def materialize(snapshot):
            object.__setattr__(snapshot.binding,"actor_id","tampered")
            return f["service"]
        owner=runtime_class()(session_factory=f["sessions"],authenticate=f["authenticate"],
            resolve_mapping=f["resolve_mapping"],materialize=materialize,clock=lambda:f["now"])
        c=TestClient(create_agent_console_app(runtime_owner=owner))
        c.cookies.set("anvil_session",f["token"])
        assert c.get("/api/agent-console/team").status_code == 200
        with f["sessions"]() as s,s.begin():
            stored=SqlAlchemyAgentTeamOwnerRepository().load_current_owner(
                s,binding=f["binding"],principal=f["mapping"])
            assert stored.binding.actor_id == f["binding"].actor_id


def test_repository_failure_returns_offline_and_receipt_publication_zero(monkeypatch):
    with setup(monkeypatch) as f:
        def fail(conn,cursor,statement,parameters,context,executemany):
            if "INSERT INTO agent_owner_requests" in statement:
                raise RuntimeError("synthetic failure, must not leak")
        event.listen(f["engine"],"before_cursor_execute",fail)
        try:
            r=f["client"].get("/api/agent-console/team")
            assert r.status_code == 503 and r.json()["counts_as_pass"] is False
            assert "synthetic failure" not in r.text
        finally:
            event.remove(f["engine"],"before_cursor_execute",fail)
        with f["sessions"]() as s,s.begin():
            assert s.execute(text("SELECT count(*) FROM agent_owner_requests WHERE operation='RECEIPT'")).scalar_one() == 0
        assert f["client"].get("/api/agent-console/team").status_code == 200


def test_live_policy_revocation_denies_even_with_current_persisted_snapshot(monkeypatch):
    with setup(monkeypatch) as f:
        f["policy"].revoke(f["authority"].assignment_id)
        assert f["client"].get("/api/agent-console/team").status_code == 403


def test_missing_or_generic_materialized_owner_not_trusted(monkeypatch):
    with setup(monkeypatch) as f:
        for bad in (None,object(),f["snapshot"]):
            f["state"]["service"]=bad
            assert f["client"].get("/api/agent-console/team").status_code == 403


def test_untrusted_principal_fields_never_invoke_metaclass_or_copy_callbacks(monkeypatch):
    with setup(monkeypatch) as f:
        calls=[]
        class Meta(type):
            def __eq__(self,other):
                calls.append("metaclass")
                return False
            __hash__=type.__hash__
        class Hostile(metaclass=Meta):
            def __deepcopy__(self,memo):
                calls.append("deepcopy")
                return f["binding"].actor_id
        object.__setattr__(f["state"]["principal"],"actor_id",Hostile())
        assert f["client"].get("/api/agent-console/team").status_code == 403
        assert calls == []


def test_mapping_resolver_mutation_cannot_change_authenticated_principal(monkeypatch):
    with setup(monkeypatch) as f:
        def resolver(principal,token_hash):
            object.__setattr__(principal,"actor_id","mutated-copy")
            return f["mapping"]
        owner=runtime_class()(session_factory=f["sessions"],authenticate=f["authenticate"],
            resolve_mapping=resolver,materialize=f["materialize"],clock=lambda:f["now"])
        c=TestClient(create_agent_console_app(runtime_owner=owner))
        c.cookies.set("anvil_session",f["token"])
        assert c.get("/api/agent-console/team").status_code == 200
        assert f["principal"].actor_id == f["binding"].actor_id
