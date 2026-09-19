"""C30R3 Task2 real domain owners + local SQLite; no PG/process restart claim."""
from contextlib import contextmanager
from dataclasses import asdict, fields, replace
from datetime import datetime, timedelta, timezone
import importlib
import importlib.util
import json

import pytest
from sqlalchemy import event, text
from sqlalchemy.orm import sessionmaker

from packages.persistence.agent_team_owner_repository import (
    OwnerBinding, OwnerComponent, OwnerSnapshot, PrincipalMapping,
    SqlAlchemyAgentTeamOwnerRepository,
)
from packages.agent_team.role_contracts import RolePolicyService
from packages.agent_team.role_results import RoleResultService
from packages.agent_team.orchestration import RoleTeamOrchestrator
from packages.agent_team.moa import MoADeliberation
from tests.persistence.test_agent_team_owner_repository import database, sealed, canonical, digest


def product():
    name = "packages.agent_team.owner_component_restore"
    assert importlib.util.find_spec(name), "C30R3_TYPED_OWNER_ADAPTER_MISSING"
    return importlib.import_module(name)


@contextmanager
def setup(monkeypatch, roles=("REVIEW", "TEST")):
    m = product()
    import tests.agent_team.test_role_contracts_c22 as c22
    import tests.agent_team.test_orchestration_c23 as c23
    now = datetime.now(timezone.utc).replace(microsecond=0)
    monkeypatch.setattr(c22, "NOW", now)
    monkeypatch.setattr(c23, "NOW", now)
    team, policy, results, session, tasks = c23.fixture(roles)
    team.register_plan(tasks, actor_id="main", now=now)
    write_fence=None
    if roles[0]=="CODE":
        policy.register_code_write_lease(c22.lease(tasks[0].assignment),now=now)
        write_fence="write-a1"
    c23.claim(team, tasks[0],write_fence=write_fence)
    c23.complete(team, results, tasks[0],write_fence=write_fence)
    decision = c22.action(policy, tasks[0].assignment, request_id="read-once",
        usage=c22.r.BudgetLimits(1, 3, 1, 1))
    assert decision.allowed
    moa = MoADeliberation(team, quorum=1, deadline=now+timedelta(minutes=9))
    a = tasks[0].assignment
    moa.propose(proposal_id="proposal", task_id=a.packet.step_id, actor_id=a.actor_id,
        execution_fence=a.execution_fence, summary="fixture observation",
        evidence_refs=[c22.H], now=now)
    binding = OwnerBinding("project", "local", a.session_id, a.assignment_id, 1,
        a.actor_id, a.context_id, a.workspace_id, a.baseline_hash, a.target_hash,
        a.content_hash, a.execution_fence, write_fence)
    principal = sealed(PrincipalMapping(binding, digest("fixture-auth"), 1, a.actor_id,
        "tester", ("tasks:read",), now-timedelta(seconds=1),
        now+timedelta(minutes=8), ""), "mapping_hash")
    # Host serialization only; this seed is not an authenticated restore receipt.
    seed = m.OwnerComponentBundle(binding=binding, owner_version=1,
        owner_snapshot_hash=digest("unpersisted-host-capture"),
        principal_mapping_hash=principal.mapping_hash, restored_at=now,
        policy=policy, results=results, team=team, moa=moa)
    payloads = m.export_owner_components(seed)
    components = tuple(OwnerComponent(p.component_type, 1, canonical(asdict(p)),
        digest(canonical(asdict(p)))) for p in payloads)
    snapshot = sealed(OwnerSnapshot(binding, 1, *components, (principal,),
        now-timedelta(seconds=1), now+timedelta(minutes=8), ""))
    with database() as engine:
        sessions = sessionmaker(bind=engine)
        repo = SqlAlchemyAgentTeamOwnerRepository()
        with sessions() as s, s.begin():
            repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="initial")
        yield locals()


def restore(f, **updates):
    args = dict(snapshot=f["snapshot"], principal=f["principal"],
        session_factory=f["sessions"], now=f["now"])
    args.update(updates)
    return f["m"].restore_owner_components(**args)


def rewrite(snapshot, index, change, *, resign_inner=False):
    components = [snapshot.policy, snapshot.results, snapshot.team, snapshot.moa]
    row = json.loads(components[index].canonical_json)
    change(row)
    if resign_inner:
        row["component_hash"] = digest(canonical({k:v for k,v in row.items() if k!="component_hash"}))
    raw = canonical(row)
    components[index] = replace(components[index], canonical_json=raw, content_hash=digest(raw))
    return sealed(replace(snapshot, policy=components[0], results=components[1],
        team=components[2], moa=components[3]))


def test_roundtrip_real_owners_preserves_results_moa_spent_and_exact_replay(monkeypatch):
    with setup(monkeypatch) as f:
        out = restore(f)
        assert type(out) is f["m"].OwnerComponentBundle
        for name, cls in [("policy",RolePolicyService),("results",RoleResultService),
                          ("team",RoleTeamOrchestrator),("moa",MoADeliberation)]:
            assert type(getattr(out,name)) is cls
            assert getattr(out,name) is not f[name]
        assert out.team.project() == f["team"].project()
        assert out.moa.project() == f["moa"].project()
        import tests.agent_team.test_role_contracts_c22 as c22
        assert c22.action(out.policy, f["tasks"][0].assignment, request_id="read-once",
            usage=c22.r.BudgetLimits(1,3,1,1)) == f["decision"]
        assert out.policy._spent == f["policy"]._spent
        assert out.results._results == f["results"]._results
        again = restore(f)
        assert again.receipt_hash == out.receipt_hash
        assert again.team is not out.team
        assert f["m"].export_owner_components(again) == f["payloads"]
        with f["sessions"]() as s, s.begin():
            assert s.execute(text("SELECT count(*) FROM agent_owner_requests")).scalar_one() == 1


def test_export_and_restored_returns_are_detached_from_caller_and_each_other(monkeypatch):
    with setup(monkeypatch) as f:
        one, two = restore(f), restore(f)
        payload = f["m"].export_owner_components(one)[0]
        payload.payload["state"]["revoked"].append("a1")
        object.__setattr__(payload.binding,"actor_id","foreign")
        one.policy.revoke("a1")
        assert two.policy.get_assignment("a1").actor_id == "actor1"
        assert "a1" not in two.policy._revoked
        assert "a1" not in f["policy"]._revoked
        assert restore(f).team.project() == f["team"].project()


@pytest.mark.parametrize("index", range(4))
def test_nested_component_hash_drift_denied_before_hydration(monkeypatch,index):
    with setup(monkeypatch) as f:
        bad = rewrite(f["snapshot"],index,lambda r:r["payload"]["state"].update(injected=[]))
        calls=[]
        monkeypatch.setattr(f["m"],"_construct_owners",lambda *a,**k:calls.append(1))
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad)
        assert calls == []


@pytest.mark.parametrize("where", ["outer","constructor","state","assignment","packet"])
def test_unknown_fields_fail_closed_even_when_outer_component_resigned(monkeypatch,where):
    with setup(monkeypatch) as f:
        def change(row):
            target=row
            if where in ("constructor","state"): target=row["payload"][where]
            if where in ("assignment","packet"):
                target=row["payload"]["state"]["assignments"][0]["value"]
                if where=="packet": target=target["packet"]
            target["unknown"] = "not supported"
        with pytest.raises(f["m"].OwnerContractError):
            restore(f,snapshot=rewrite(f["snapshot"],0,change,resign_inner=True))


@pytest.mark.parametrize("field", ["assignment_id","session_id","actor_id","context_id",
    "workspace_id","target_hash","baseline_hash","execution_fence","write_fence","generation"])
def test_foreign_or_stale_binding_never_constructs_owner(monkeypatch,field):
    with setup(monkeypatch) as f:
        value = 2 if field=="generation" else digest("foreign") if field.endswith("hash") else "foreign"
        binding = replace(f["binding"],**{field:value})
        bad = sealed(replace(f["principal"],binding=binding,
            principal_actor_id=binding.actor_id),"mapping_hash")
        calls=[]
        monkeypatch.setattr(f["m"],"_construct_owners",lambda *a,**k:calls.append(1))
        with pytest.raises(f["m"].OwnerContractError): restore(f,principal=bad)
        assert calls == []


def test_repository_revocation_precedes_construction(monkeypatch):
    with setup(monkeypatch) as f:
        with f["sessions"]() as s,s.begin():
            f["repo"].revoke_generation(s,binding=f["binding"],expected_version=1,
                request_id="revoke",reason="OWNER_REVOKED")
        calls=[]
        monkeypatch.setattr(f["m"],"_construct_owners",lambda *a,**k:calls.append(1))
        with pytest.raises(f["m"].OwnerContractError): restore(f)
        assert calls == []


def test_version_mismatch_and_expired_now_deny(monkeypatch):
    with setup(monkeypatch) as f:
        with pytest.raises(f["m"].OwnerContractError):
            restore(f,snapshot=sealed(replace(f["snapshot"],owner_version=2)))
        with pytest.raises(f["m"].OwnerContractError):
            restore(f,now=f["now"]+timedelta(hours=1))


def test_final_authority_recheck_catches_revoke_during_construction(monkeypatch):
    with setup(monkeypatch) as f:
        original = f["m"]._construct_owners
        def injected(*args,**kwargs):
            owners=original(*args,**kwargs)
            with f["sessions"]() as s,s.begin():
                f["repo"].revoke_generation(s,binding=f["binding"],expected_version=1,
                    request_id="during",reason="OWNER_REVOKED")
            return owners
        monkeypatch.setattr(f["m"],"_construct_owners",injected)
        with pytest.raises(f["m"].OwnerContractError): restore(f)


def test_construction_failure_is_atomic_and_retry_recovers(monkeypatch):
    with setup(monkeypatch) as f:
        original = f["m"]._construct_owners
        def fail(*args,**kwargs):
            original(*args,**kwargs)
            raise RuntimeError("synthetic private payload must not leak")
        monkeypatch.setattr(f["m"],"_construct_owners",fail)
        with pytest.raises(f["m"].OwnerContractError) as error: restore(f)
        assert "synthetic" not in str(error.value)
        with f["sessions"]() as s,s.begin():
            assert f["repo"].load_current_owner(s,binding=f["binding"],principal=f["principal"]) == f["snapshot"]
            assert s.execute(text("SELECT count(*) FROM agent_owner_requests")).scalar_one() == 1
        monkeypatch.setattr(f["m"],"_construct_owners",original)
        assert restore(f).team.project() == f["team"].project()


def test_hostile_scalar_callback_zero_before_any_sql(monkeypatch):
    with setup(monkeypatch) as f:
        calls=[]
        class Hostile:
            def __deepcopy__(self,memo): calls.append("copy"); return "actor1"
            def __str__(self): calls.append("str"); return "actor1"
        object.__setattr__(f["snapshot"].binding,"actor_id",Hostile())
        event.listen(f["engine"],"before_cursor_execute",lambda *a:calls.append("sql"))
        with pytest.raises(f["m"].OwnerContractError): restore(f)
        assert calls == []


@pytest.mark.parametrize("value", [None,{},[],"snapshot"])
def test_untrusted_root_never_calls_session_factory(value):
    m=product(); calls=[]
    with pytest.raises(m.OwnerContractError):
        m.restore_owner_components(value,value,session_factory=lambda:calls.append(1),
            now=datetime.now(timezone.utc))
    assert calls == []


def resign_all(snapshot, change):
    rows=[json.loads(c.canonical_json) for c in (snapshot.policy,snapshot.results,snapshot.team,snapshot.moa)]
    change(rows)
    for i,row in enumerate(rows):
        ctor=row["payload"]["constructor"]
        if i in (1,2): ctor["policy_component_hash"]=rows[0]["component_hash"]
        if i==2: ctor["results_component_hash"]=rows[1]["component_hash"]
        if i==3: ctor["team_component_hash"]=rows[2]["component_hash"]
        row["component_hash"]=digest(canonical({k:v for k,v in row.items() if k!="component_hash"}))
    parts=[OwnerComponent(r["component_type"],1,canonical(r),digest(canonical(r))) for r in rows]
    return sealed(replace(snapshot,policy=parts[0],results=parts[1],team=parts[2],moa=parts[3]))


def install_fixture_snapshot(f, snapshot):
    # Deliberate persisted corruption/adversarial fixture; local in-memory only.
    from tests.persistence.test_agent_team_owner_repository import primitive
    with f["sessions"]() as s,s.begin():
        s.execute(text("UPDATE agent_owner_heads SET snapshot_json=:raw,snapshot_hash=:hash"),
            dict(raw=canonical(primitive(snapshot)),hash=snapshot.content_hash))


@pytest.mark.parametrize("target", ["lock","registry"])
def test_export_rejects_hostile_owner_internals_without_callbacks(monkeypatch,target):
    with setup(monkeypatch) as f:
        bundle=restore(f); calls=[]
        class Hostile:
            def __enter__(self): calls.append("enter"); raise RuntimeError("callback")
            def __exit__(self,*args): calls.append("exit")
            def __iter__(self): calls.append("iterate"); return iter(())
        if target=="lock": bundle.policy._lock=Hostile()
        else: bundle.policy._revoked=Hostile()
        with pytest.raises(f["m"].OwnerContractError): f["m"].export_owner_components(bundle)
        assert calls==[]


def test_persisted_replay_projection_unknown_fields_are_rejected(monkeypatch):
    with setup(monkeypatch) as f:
        def change(rows):
            replay=rows[2]["payload"]["state"]["replay"][0]["value"]
            view=json.loads(replay[1]); view["unexpected_authority"]="forged"
            replay[1]=canonical(view)
        bad=resign_all(f["snapshot"],change)
        install_fixture_snapshot(f,bad)
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad)


def test_persisted_negative_cost_and_impossible_total_rejected(monkeypatch):
    with setup(monkeypatch) as f:
        def change(rows):
            rows[2]["payload"]["state"]["tasks"][0]["value"]["actual_cost"]=-1
        bad=resign_all(f["snapshot"],change)
        install_fixture_snapshot(f,bad)
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad)


def test_nested_revocation_is_preserved_not_reregistered(monkeypatch):
    with setup(monkeypatch) as f:
        bad=resign_all(f["snapshot"],lambda rows:rows[0]["payload"]["state"]["revoked"].append("a2"))
        install_fixture_snapshot(f,bad)
        out=restore(f,snapshot=bad)
        a=out.policy.get_assignment("a2")
        assert out.policy.validate_assignment(a,actor_id=a.actor_id,session_id=a.session_id,
            context_id=a.context_id,target_hash=a.target_hash,execution_fence=a.execution_fence,
            now=f["now"])=="ASSIGNMENT_REVOKED"


def test_current_assignment_revocation_rejected_before_construction(monkeypatch):
    with setup(monkeypatch) as f:
        bad=resign_all(f["snapshot"],lambda rows:rows[0]["payload"]["state"]["revoked"].append("a1"))
        install_fixture_snapshot(f,bad)
        calls=[]
        monkeypatch.setattr(f["m"],"_construct_owners",lambda *a,**k:calls.append(1))
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad)
        assert calls==[]


@pytest.mark.parametrize("role", ["PLANNING","CODE","REVIEW","TEST","DEPLOY"])
def test_all_five_roles_restore_exact_owner_identity_and_code_fence(monkeypatch,role):
    with setup(monkeypatch,(role,"TEST")) as f:
        out=restore(f)
        assert out.policy.get_assignment("a1").definition.role==role
        assert out.team.project()==f["team"].project()
        if role=="CODE":
            a=out.policy.get_assignment("a1")
            assert out.policy.validate_code_write(a,f["now"],paths=("src/a.py",),write_fence="write-a1") is None
            assert out.policy.validate_code_write(a,f["now"],paths=("src/a.py",),write_fence="stale")=="STALE_WRITE_FENCE"


def test_mailbox_ack_and_moa_critique_synthesis_survive_export_restore(monkeypatch):
    with setup(monkeypatch) as f:
        import tests.agent_team.test_orchestration_c23 as c23
        t=f["seed"].team; p=f["seed"].policy; r=f["seed"].results; m=f["seed"].moa
        first,second=f["tasks"]
        receipt=t.send("task1","task2",actor_id=first.assignment.actor_id,
            execution_fence=first.assignment.execution_fence,now=f["now"],request_id="message",body="bounded question")
        message=receipt.to_dict()["messages"][0]["message_id"]
        t.acknowledge("task2",message,actor_id=second.assignment.actor_id,
            execution_fence=second.assignment.execution_fence,now=f["now"],request_id="ack")
        c23.claim(t,second); c23.complete(t,r,second)
        proposal=m.propose(proposal_id="proposal",task_id="task1",actor_id=first.assignment.actor_id,
            execution_fence=first.assignment.execution_fence,summary="fixture observation",
            evidence_refs=[first.assignment.target_hash],now=f["now"])
        m.critique(critique_id="critique",proposal=proposal,task_id="task2",actor_id=second.assignment.actor_id,
            execution_fence=second.assignment.execution_fence,verdict="SUPPORT",summary="independent fixture",
            evidence_refs=[second.assignment.target_hash],now=f["now"])
        synthesized=m.synthesize(request_id="synthesis",actor_id="main",now=f["now"])
        parts=f["m"].export_owner_components(f["seed"])
        components=[OwnerComponent(x.component_type,1,canonical(asdict(x)),digest(canonical(asdict(x)))) for x in parts]
        snapshot=sealed(replace(f["snapshot"],policy=components[0],results=components[1],team=components[2],moa=components[3]))
        install_fixture_snapshot(f,snapshot)
        out=restore(f,snapshot=snapshot)
        assert out.moa.synthesize(request_id="synthesis",actor_id="main",now=f["now"])==synthesized
        assert out.team.mailbox("task2",actor_id=second.assignment.actor_id,
            execution_fence=second.assignment.execution_fence,now=f["now"]).to_dict()["messages"][0]["delivery_state"]=="ACKNOWLEDGED"


@pytest.mark.parametrize("variant", ["duplicate","missing","schema","nan","scalar_subclass","time_subclass"])
def test_malformed_payloads_and_time_never_reach_hydration(monkeypatch,variant):
    with setup(monkeypatch) as f:
        calls=[]; bad=f["snapshot"]; now=f["now"]
        if variant=="duplicate":
            bad=resign_all(bad,lambda rows:rows[0]["payload"]["state"]["assignments"].append(rows[0]["payload"]["state"]["assignments"][0]))
        elif variant=="missing": bad=sealed(replace(bad,moa=None))
        elif variant=="schema": bad=rewrite(bad,0,lambda row:row.update(schema_version="future/v9"),resign_inner=True)
        elif variant=="nan":
            raw=bad.policy.canonical_json.replace('"owner_version":1','"owner_version":NaN')
            bad=sealed(replace(bad,policy=replace(bad.policy,canonical_json=raw,content_hash=digest(raw))))
        elif variant=="scalar_subclass":
            class Text(str):
                def __deepcopy__(self,memo): calls.append("copy"); return str(self)
            object.__setattr__(bad,"content_hash",Text(bad.content_hash))
        else:
            class Time(datetime):
                def isoformat(self,*a,**kw): calls.append("time"); return "forged"
            now=Time.now(timezone.utc)
        monkeypatch.setattr(f["m"],"_construct_owners",lambda *a,**k:calls.append("construct"))
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad,now=now)
        assert calls==[]


def test_resigned_nested_assignment_actor_cannot_escape_canonical_seal(monkeypatch):
    with setup(monkeypatch) as f:
        def change(rows): rows[0]["payload"]["state"]["assignments"][0]["value"]["actor_id"]="foreign"
        bad=resign_all(f["snapshot"],change)
        install_fixture_snapshot(f,bad)
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad)


@pytest.mark.parametrize("field,value", [("summary",{"not":"text"}),("evidence_refs",[]),
    ("evidence_refs",["not-a-hash"]),("summary","")])
def test_resigned_moa_nested_metadata_keeps_original_owner_schema(monkeypatch,field,value):
    with setup(monkeypatch) as f:
        def change(rows):
            state=rows[3]["payload"]["state"]
            data=json.loads(state["proposals"][0]["value"])
            data[field]=value
            payload=canonical(data)
            state["proposals"][0]["value"]=payload
            state["records"][0]["value"]=[digest(payload),payload]
        bad=resign_all(f["snapshot"],change)
        install_fixture_snapshot(f,bad)
        with pytest.raises(f["m"].OwnerContractError): restore(f,snapshot=bad)
