"""E-01 permission/independence adversarial contracts; no worker or external I/O."""
import importlib.util
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import pytest
from packages.orchestration.delegation import PermissionSnapshot, DataEgressProfile, DelegationPacket

NOW = datetime(2026, 9, 17, 0, 40, tzinfo=timezone.utc)
TARGET = "sha256:" + "a" * 64
CONTEXT = "sha256:" + "b" * 64


def api():
    from packages.agent_team import role_contracts as r
    return r


def fixture(role="TESTER", writable=False, **overrides):
    r=api()
    actions=("read","execute","write","patch") if role=="TESTER" else ("read",)
    tools=("repo_read","test_run","test_write","test_patch") if role=="TESTER" else ("repo_read","repo_diff")
    parent=PermissionSnapshot(("src/**","tests/**"),("read","execute","write","patch"),
        ("repo_read","repo_diff","test_run","test_write","test_patch"),("local",),(),(".git/**",),("delete","approve","deploy","merge","bypass"))
    child=replace(parent,allowed_actions=actions,allowed_tools=tools)
    egress=DataEgressProfile("local_only",(),(),())
    budget=r.BudgetLimits(3,1000,10,60)
    definition=r.AgentDefinition("reviewer" if role=="REVIEWER" else "tester",1,role,
        ("src/**","tests/**"),("tests/**",) if writable else (),(),child,budget,
        "reviewer_result/v1" if role=="REVIEWER" else "tester_result/v1",
        ("diff_review",) if role=="REVIEWER" else ("independent_execution",))
    packet=DelegationPacket("d1","parent-run","main","wi",1,"s1","review-workspace","verify",
        ("verification",),("implementation",),child.allowed_paths,child.prohibited_actions,"Observe" if not writable else "Guided",
        definition.result_schema,("evidence",),"budget1",("evidence bound",),TARGET,CONTEXT,child,child.snapshot_hash,
        parent.snapshot_hash,egress,egress.snapshot_hash,egress.snapshot_hash)
    service=r.RolePolicyService(session_id="session",baseline_hash=TARGET,target_hash=TARGET,
        implementation_actor="developer",implementation_context="dev-context",implementation_workspace="dev-workspace",
        implementation_context_hash="sha256:"+"c"*64,
        parent_permission=parent,parent_egress=egress,parent_budget=r.BudgetLimits(10,2000,20,120))
    grant=r.TestWriteGrant("grant","a1","tester-actor",("tests/**",),"write-lease","write-fence",NOW,NOW+timedelta(hours=1)) if writable else None
    if writable:
        service.register_test_write_lease(r.TestWriteLease("write-lease","a1","tester-actor","review-workspace",
            ("tests/**",),"exec-fence","write-fence",NOW,NOW+timedelta(hours=1)))
    registration=dict(assignment_id="a1",definition=definition,packet=packet,actor_id="tester-actor",
        context_id="independent-context",thread_id="thread",workspace_id="review-workspace",
        session_id="session",context_snapshot_hash=CONTEXT,issued_at=NOW,expires_at=NOW+timedelta(hours=1),execution_fence="exec-fence",test_write_grant=grant)
    registration.update(overrides)
    assignment=service.register(**registration)
    return r,service,assignment,definition,packet


def authorize(service,assignment,**updates):
    args=dict(assignment=assignment,actor_id=getattr(assignment,"actor_id","tester-actor"),session_id="session",context_id="independent-context",
        target_hash=TARGET,execution_fence="exec-fence",now=NOW,action="read",tool="repo_read",backend="local",path="src/main.py")
    args.update(updates)
    return service.authorize_action(**args)


def test_reviewer_read_works_and_all_mutation_aliases_are_denied_without_io():
    r,s,a,_,_=fixture("REVIEWER")
    assert authorize(s,a).allowed
    for action,tool in (("write","test_write"),("patch","test_patch"),("delete","repo_read"),("read","test_write"),("execute","repo_read")):
        receipt=authorize(s,a,action=action,tool=tool)
        assert not receipt.allowed and receipt.reason=="ROLE_ACTION_DENIED"
        assert receipt.io_count==0


def test_tester_default_read_only_and_explicit_test_grant():
    _,s,a,_,_=fixture()
    assert authorize(s,a,action="write",tool="test_write",path="tests/test_x.py").reason=="TEST_WRITE_GRANT_REQUIRED"
    _,s,a,_,_=fixture(writable=True)
    assert authorize(s,a,action="patch",tool="test_patch",path="tests/test_x.py",write_fence="write-fence").allowed
    assert authorize(s,a,action="patch",tool="test_patch",path="src/main.py",write_fence="write-fence").reason=="TEST_WRITE_SCOPE_DENIED"
    assert authorize(s,a,action="write",tool="test_write",path="tests/x.py",write_fence="stale").reason=="STALE_WRITE_FENCE"


@pytest.mark.parametrize("path",["tests/../src/a.py","tests2/a.py","/tests/a.py","C:/tests/a.py","//server/tests/a.py","tests\\a.py","tests/a.py:stream","tests/CON","tests/a.py.","tests/%2e%2e/src/a.py"])
def test_test_write_path_escapes_are_denied(path):
    _,s,a,_,_=fixture(writable=True)
    assert not authorize(s,a,action="write",tool="test_write",path=path,write_fence="write-fence").allowed


@pytest.mark.parametrize("field,value",[("actor_id","developer"),("context_id","dev-context"),("workspace_id","dev-workspace")])
def test_implementation_identity_is_not_independent(field,value):
    with pytest.raises(ValueError,match="INDEPENDENCE_REQUIRED"):
        fixture(**{field:value})


@pytest.mark.parametrize("updates,reason",[({"actor_id":"foreign"},"ASSIGNMENT_IDENTITY_MISMATCH"),
    ({"session_id":"foreign"},"ASSIGNMENT_IDENTITY_MISMATCH"),({"context_id":"foreign"},"ASSIGNMENT_IDENTITY_MISMATCH"),
    ({"target_hash":"sha256:"+"c"*64},"TARGET_MISMATCH"),({"execution_fence":"old"},"STALE_EXECUTION_FENCE"),
    ({"now":NOW-timedelta(seconds=1)},"ASSIGNMENT_EXPIRED"),({"now":NOW+timedelta(hours=1)},"ASSIGNMENT_EXPIRED")])
def test_consumption_rechecks_current_authority(updates,reason):
    _,s,a,_,_=fixture()
    assert authorize(s,a,**updates).reason==reason


def test_snapshot_mutation_cannot_change_registered_authority():
    _,s,a,_,_=fixture()
    original=a.content_hash
    object.__setattr__(a,"actor_id","attacker")
    assert authorize(s,a).reason=="ASSIGNMENT_TAMPERED"
    clean=s.get_assignment("a1")
    assert clean.actor_id=="tester-actor" and clean.content_hash==original
    assert authorize(s,clean).allowed
    assert authorize(s,replace(clean,assignment_id="foreign")).reason=="ASSIGNMENT_UNKNOWN"


def test_revocation_and_new_target_invalidate_old_assignment():
    _,s,a,_,_=fixture()
    s.revoke("a1")
    assert authorize(s,a).reason=="ASSIGNMENT_REVOKED"
    _,s,a,_,_=fixture()
    s.set_current_target("sha256:"+"c"*64)
    assert authorize(s,a).reason=="TARGET_MISMATCH"


def test_budget_and_role_schema_are_not_interchangeable():
    r,_,_,definition,_=fixture()
    for changes in ({"result_schema":"reviewer_result/v1"},{"persistent_memory":"shared"},
                    {"write_scope":("src/**",)},{"budget":r.BudgetLimits(100,1000,10,60)}):
        if "budget" in changes:
            with pytest.raises(ValueError,match="BUDGET_EXPANSION"): fixture(definition=replace(definition,**changes))
        else:
            with pytest.raises(ValueError): replace(definition,**changes)
    for value in (-1,True,1.1,float("nan")):
        with pytest.raises(ValueError,match="BUDGET_INVALID"): r.BudgetLimits(value,1,1,1)


def test_parent_permission_and_egress_narrowing_are_consumed():
    r,_,_,d,p=fixture()
    expanded=replace(p.permission_snapshot,allowed_backends=("local","remote"))
    p2=replace(p,permission_snapshot=expanded,permission_snapshot_hash=expanded.snapshot_hash)
    with pytest.raises(ValueError,match="CHILD_BACKEND_SCOPE_EXPANSION"): fixture(packet=p2,definition=replace(d,permission_ceiling=expanded))
    e=replace(p.data_egress_profile,provider_allowlist=("outside",))
    with pytest.raises(ValueError,match="EGRESS_PROVIDER_EXPANSION"): fixture(packet=replace(p,data_egress_profile=e,egress_snapshot_hash=e.snapshot_hash))


def test_permission_ceiling_and_requested_tool_shape_are_enforced():
    _,s,a,_,_=fixture()
    assert authorize(s,a,tool="shell").reason=="ROLE_ACTION_DENIED"
    assert authorize(s,a,action="execute",tool="test_run",path="src/main.py").reason=="TEST_EXECUTION_SCOPE_DENIED"
    assert authorize(s,a,action="execute",tool="test_run",path="tests/test_x.py").allowed


def test_budget_replay_and_exhaustion_are_deterministic():
    _,s,a,_,_=fixture()
    one=authorize(s,a,request_id="one")
    assert authorize(s,a,request_id="one")==one
    assert authorize(s,a,request_id="one",path="src/other.py").reason=="REQUEST_REPLAY_CONFLICT"
    assert authorize(s,a,request_id="two").allowed
    assert authorize(s,a,request_id="three").allowed
    assert authorize(s,a,request_id="four").reason=="BUDGET_EXHAUSTED"


def test_context_hash_must_not_be_the_implementation_context_under_a_new_name():
    r,s,a,d,p=fixture()
    with pytest.raises(ValueError,match="INDEPENDENCE_REQUIRED"):
        fixture(context_snapshot_hash=s.implementation_context_hash,packet=replace(p,context_snapshot_hash=s.implementation_context_hash))
    with pytest.raises(ValueError,match="CONTEXT_SNAPSHOT_MISMATCH"):
        fixture(context_snapshot_hash="sha256:"+"d"*64)


def test_test_write_requires_separate_current_host_lease_not_just_grant_dto():
    r,s,a,d,p=fixture(writable=True)
    assert callable(getattr(s,"revoke_test_write_lease",None)), "current host write lease seam missing"
    s.revoke_test_write_lease("write-lease")
    receipt=authorize(s,a,action="write",tool="test_write",path="tests/x.py",write_fence="write-fence")
    assert receipt.reason=="WRITE_LEASE_INVALID" and receipt.io_count==0


def test_malformed_usage_and_forced_negative_budget_are_fail_closed():
    r,s,a,_,_=fixture()
    assert authorize(s,a,usage=object()).reason=="BUDGET_INVALID"
    amount=r.BudgetLimits(1,1,1,1)
    object.__setattr__(amount,"tokens",-100)
    assert authorize(s,a,usage=amount).reason=="BUDGET_INVALID"


def test_lease_grant_cannot_invent_host_current_authority():
    r,_,_,_,_=fixture()
    grant=r.TestWriteGrant("invented","a1","tester-actor",("tests/**",),"absent","forged",NOW,NOW+timedelta(minutes=5))
    with pytest.raises(ValueError,match="WRITE_LEASE_INVALID"):
        fixture(writable=True,test_write_grant=grant)


def test_definition_snapshot_hash_is_revalidated_and_profile_is_not_role_authority():
    r,s,a,d,p=fixture()
    object.__setattr__(d,"role","REVIEWER")
    with pytest.raises(ValueError,match="DEFINITION_TAMPERED"): fixture(definition=d)
    assert authorize(s,{"role":"TESTER","assignment_id":"a1"}).reason=="ASSIGNMENT_REQUIRED"


@pytest.mark.parametrize("field,values",[("allowed_paths",("src/**","tests/**","other/**")),
    ("allowed_actions",("read","execute","write","patch","network")),
    ("allowed_tools",("repo_read","test_run","shell")),("protected_paths",()),("prohibited_actions",())])
def test_parent_guard_rejects_permission_expansion_or_denial_removal(field,values):
    r,_,_,d,p=fixture()
    child=replace(p.permission_snapshot,**{field:values})
    changes=dict(permission_snapshot=child,permission_snapshot_hash=child.snapshot_hash)
    if field=="allowed_paths": changes["allowed_paths"]=values
    if field=="prohibited_actions": changes["prohibited_actions"]=values or ("unrelated",)
    if field=="prohibited_actions":
        child=replace(child,prohibited_actions=changes["prohibited_actions"])
        changes.update(permission_snapshot=child,permission_snapshot_hash=child.snapshot_hash)
    with pytest.raises(ValueError): fixture(packet=replace(p,**changes))


def test_read_only_receipt_hash_and_input_aliases_are_stable():
    _,s,a,_,_=fixture("REVIEWER")
    one=authorize(s,a,request_id="stable")
    assert authorize(s,a,request_id="stable")==one
    assert one.content_hash.startswith("sha256:") and len(one.content_hash)==71
    object.__setattr__(one,"allowed",False)
    assert authorize(s,a,request_id="stable").allowed


def test_forced_unhashable_assignment_identity_returns_denial_not_exception():
    _,s,a,_,_=fixture()
    object.__setattr__(a,"assignment_id",[])
    receipt=authorize(s,a)
    assert not receipt.allowed and receipt.reason=="ASSIGNMENT_INVALID" and receipt.io_count==0


def test_windows_case_alias_cannot_evade_prohibited_scope():
    _,_,_,definition,_=fixture("REVIEWER")
    with pytest.raises(ValueError,match="PROTECTED_SCOPE"):
        replace(definition,read_scope=("src/SECRET/**",),prohibited_scope=("src/secret/**",))


def test_windows_case_alias_test_write_leases_conflict():
    r,s,_,_,_=fixture()
    lease=r.TestWriteLease("first","a1","tester-actor","review-workspace",("tests/CASE/**",),"exec-fence","write-fence",NOW,NOW+timedelta(hours=1))
    s.register_test_write_lease(lease)
    with pytest.raises(ValueError,match="WRITE_LEASE_CONFLICT"):
        s.register_test_write_lease(replace(lease,lease_id="second",paths=("tests/case/**",)))


def test_windows_case_alias_preserves_original_hash_representation():
    _,s,a,_,_=fixture("REVIEWER")
    assert authorize(s,a,path="SRC/Main.py").allowed
    assert a.definition.read_scope==("src/**","tests/**")


def test_e01_role_policy_contract_is_available():
    assert importlib.util.find_spec("packages.agent_team.role_contracts") is not None, "role policy contract missing"
