"""C23 real domain owners, synthetic observations, no external execution."""
from dataclasses import replace
from datetime import timedelta
import pytest
from packages.agent_team import orchestration as o
from packages.agent_team.models import TeamSession, TeamSessionState, TeamTask, TeamTaskStatus
from packages.agent_team.collaboration import canonical_hash
from packages.agent_team.role_results import RoleResultService
from tests.agent_team.test_role_contracts_c22 import setup, lease, NOW, H


def fixture(roles=("REVIEW", "TEST"), budget=20):
    assert hasattr(o, "RoleTeamOrchestrator"), "C23 role-bound orchestration missing"
    policy, a = setup(roles[0])
    assignments = [a]
    for index, role in enumerate(roles[1:], 2):
        _, a = setup(role, service=policy, suffix=str(index))
        assignments.append(a)
    session = TeamSession("session", "main", frozenset({"main", *(a.actor_id for a in assignments)}), H,
        frozenset({"team:coordinate"}), budget, TeamSessionState.ACTIVE, 1, NOW)
    results = RoleResultService(policy)
    service = o.RoleTeamOrchestrator(session, policy, results, parent_task_id="parent-task", target_hash=H,
        deadline=NOW + timedelta(minutes=30))
    tasks = tuple(o.TeamTaskBinding(TeamTask(a.packet.step_id, "session", "bounded work", TeamTaskStatus.PENDING,
        frozenset(), ("src/a.py",), created_at=NOW, parent_hash=canonical_hash(session)), a, None,
        NOW + timedelta(minutes=10), 5) for a in assignments)
    return service, policy, results, session, tasks


def claim(service, task, **updates):
    a = task.assignment
    args = dict(actor_id=a.actor_id, execution_fence=a.execution_fence, write_fence=None, now=NOW, request_id="claim-" + task.task.task_id)
    args.update(updates)
    return service.claim(task.task.task_id, **args)


def result_for(results, binding, cost=2):
    from packages.agent_team.role_results import RoleResult, RoleEnvelope
    from packages.orchestration.result_envelope import ResultEnvelope, EvidenceReference, ResultTest
    from packages.execution.models import ResultStatus
    from tests.agent_team.test_role_contracts_c22 import EXPECTED
    a = binding.assignment
    e = results.capture_evidence(assignment=a, evidence_id="ev-" + a.assignment_id,
        kind=EXPECTED[a.definition.role][1], source=EXPECTED[a.definition.role][2], mode="real", status="PASS",
        raw_hash=H, command="observed command", exit_code=0, expected="contract", observed="pass", now=NOW)
    core = ResultEnvelope("subagent_result/v1", "result-" + a.assignment_id, a.packet.delegation_id, "attempt", 1,
        a.packet.step_id, ResultStatus.COMPLETED, H, "verified contract", evidence_refs=(EvidenceReference(e.evidence_id,H),),
        tests=(ResultTest(e.command,"PASS",0),))
    rr = RoleResult(a.definition.result_schema, a.assignment_id, a.content_hash, a.definition.role, a.actor_id,
        a.context_id,H,core,"completed",(),None,(e,))
    return RoleEnvelope(rr,a.packet.step_id,a.packet.parent_run_id,a.packet.parent_agent_id,H,
        (EvidenceReference("artifact",H),),("external runtime NOT_EXECUTED",),"discard candidate",cost,10,("host-observation",))


def complete(service, results, task, **updates):
    a = task.assignment
    args = dict(actor_id=a.actor_id, execution_fence=a.execution_fence, write_fence=None, now=NOW,
        request_id="result-" + task.task.task_id)
    args.update(updates)
    return service.collect(task.task.task_id,result_for(results,task),**args)


def test_plan_claim_result_lifecycle_is_proposal_not_main_acceptance():
    s,p,r,session,tasks = fixture()
    s.register_plan(tasks,actor_id="main",now=NOW)
    assert s.project().to_dict()["ready"] == ["task1","task2"]
    for t in tasks:
        assert claim(s,t).to_dict()["tasks"][t.task.task_id]["status"] == "CLAIMED"
        complete(s,r,t)
    value = s.project().to_dict()
    assert value["status"] == "COLLECTED_FOR_MAIN" and value["spent"] == 4
    assert value["automatic_acceptance"] is False and value["io_count"] == 0
    assert value["session"]["session_id"] == "session"


def test_dependencies_block_claim_until_verified_result():
    s,p,r,_,tasks = fixture()
    tasks = (tasks[0],replace(tasks[1],task=replace(tasks[1].task,dependency_ids=frozenset({"task1"}))))
    s.register_plan(tasks,actor_id="main",now=NOW)
    with pytest.raises(ValueError,match="DEPENDENCY_NOT_COMPLETED"): claim(s,tasks[1])
    claim(s,tasks[0]); complete(s,r,tasks[0])
    assert claim(s,tasks[1]).to_dict()["tasks"]["task2"]["status"] == "CLAIMED"


@pytest.mark.parametrize("variant,reason", [("cycle","DEPENDENCY_CYCLE"),("unknown","UNKNOWN_DEPENDENCY"),
    ("duplicate","DUPLICATE_TASK"),("parent","UNKNOWN_PARENT"),("foreign","CROSS_SESSION")])
def test_invalid_graph_is_atomic(variant,reason):
    s,_,_,_,tasks = fixture()
    if variant == "cycle":
        tasks = tuple(replace(t,task=replace(t.task,dependency_ids=frozenset({"task2" if i == 0 else "task1"}))) for i,t in enumerate(tasks))
    elif variant == "unknown": tasks=(replace(tasks[0],task=replace(tasks[0].task,dependency_ids=frozenset({"missing"}))),tasks[1])
    elif variant == "duplicate": tasks=(tasks[0],tasks[0])
    elif variant == "parent": tasks=(replace(tasks[0],parent_task_id="missing"),tasks[1])
    else: tasks=(replace(tasks[0],task=replace(tasks[0].task,session_id="foreign")),tasks[1])
    before=s.project()
    with pytest.raises(ValueError,match=reason): s.register_plan(tasks,actor_id="main",now=NOW)
    assert s.project()==before


def test_code_claim_consumes_current_c22_lease_and_never_mints_one():
    s,p,r,_,tasks = fixture(("CODE",))
    t=tasks[0]
    s.register_plan(tasks,actor_id="main",now=NOW)
    with pytest.raises(ValueError,match="CODE_WRITE_LEASE_REQUIRED"): claim(s,t)
    p.register_code_write_lease(lease(t.assignment),now=NOW)
    with pytest.raises(ValueError,match="STALE_WRITE_FENCE"): claim(s,t,write_fence="wrong")
    claim(s,t,write_fence="write-a1")
    p.revoke_code_write_lease("lease-a1")
    with pytest.raises(ValueError,match="CODE_WRITE_LEASE_REQUIRED"): complete(s,r,t,write_fence="write-a1")
    assert s.project().to_dict()["tasks"]["task1"]["status"] == "CLAIMED"


def test_timeout_dependency_block_and_independent_work_remain_explicit():
    s,_,_,_,tasks=fixture(("REVIEW","TEST","PLANNING"))
    tasks=(replace(tasks[0],deadline=NOW+timedelta(seconds=1)),
        replace(tasks[1],task=replace(tasks[1].task,dependency_ids=frozenset({"task1"}))),tasks[2])
    s.register_plan(tasks,actor_id="main",now=NOW)
    value=s.tick(actor_id="main",now=NOW+timedelta(seconds=2),request_id="tick").to_dict()
    assert value["tasks"]["task1"]["status"]=="TIMED_OUT"
    assert value["tasks"]["task2"]["status"]=="BLOCKED_DEPENDENCY"
    assert value["ready"]==["task3"] and value["status"]=="REVIEW_REQUIRED"


def test_budget_exhaustion_cancellation_and_exact_replay_are_not_success():
    s,_,_,_,tasks=fixture(budget=5)
    s.register_plan(tasks,actor_id="main",now=NOW)
    first=claim(s,tasks[0])
    assert claim(s,tasks[0])==first
    with pytest.raises(ValueError,match="COST_BUDGET_EXCEEDED"): claim(s,tasks[1])
    cancelled=s.cancel(actor_id="main",now=NOW,request_id="cancel")
    assert cancelled.to_dict()["status"]=="CANCELLED"
    assert s.cancel(actor_id="main",now=NOW,request_id="cancel")==cancelled
    with pytest.raises(ValueError,match="SESSION_CANCELLED"): claim(s,tasks[0])


def test_input_and_projection_aliases_do_not_change_canonical_plan():
    s,_,_,_,tasks=fixture()
    s.register_plan(tasks,actor_id="main",now=NOW)
    old=s.project()
    object.__setattr__(tasks[0].task,"title","mutated")
    snapshot=s.project().to_dict(); snapshot["tasks"]["task1"]["status"]="COMPLETED"
    assert s.project()==old
    with pytest.raises(ValueError,match="BINDING_TAMPERED"): s.register_plan(tasks,actor_id="main",now=NOW)


def test_register_publication_failure_does_not_leave_plan(monkeypatch):
    s,_,_,_,tasks=fixture()
    before=s.project();original=s._projection;calls=[]
    def fail_second(state):
        calls.append(1)
        if len(calls)==2:raise RuntimeError('publication failure')
        return original(state)
    monkeypatch.setattr(s,'_projection',fail_second)
    try:s.register_plan(tasks,actor_id='main',now=NOW)
    except RuntimeError:
        monkeypatch.setattr(s,'_projection',original)
        assert s.project()==before
    else:
        assert len(calls)==1


@pytest.mark.parametrize('terminal',['cancel','timeout'])
def test_unreported_cost_exposure_survives_terminal_observation(terminal):
    s,_,_,_,tasks=fixture(budget=5);s.register_plan(tasks,actor_id='main',now=NOW)
    claim(s,tasks[0])
    if terminal=='cancel':value=s.cancel(actor_id='main',now=NOW,request_id='cancel').to_dict()
    else:value=s.tick(actor_id='main',now=NOW+timedelta(minutes=11),request_id='tick').to_dict()
    assert value['forecast_exposure']==5
    assert value['tasks']['task1']['usage_status']=='UNRECONCILED'


@pytest.mark.parametrize('field',['task_id','actor_id','execution_fence','write_fence','request_id'])
def test_public_untrusted_scalar_callback_zero(field):
    calls=[]
    class Hostile:
        def __hash__(self):calls.append('hash');return 1
        def __str__(self):calls.append('str');return 'task1'
        def __deepcopy__(self,memo):calls.append('copy');return 'task1'
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW)
    args=dict(task_id='task1',actor_id='actor1',execution_fence='exec1',write_fence=None,now=NOW,request_id='request')
    args[field]=Hostile();before=s.project()
    with pytest.raises(ValueError):s.claim(**args)
    assert calls==[] and s.project()==before


def test_datetime_subclass_and_mutable_timezone_rejected_without_callbacks():
    from datetime import datetime,tzinfo
    calls=[]
    class Clock(datetime):
        def isoformat(self,*args,**kwargs):calls.append('iso');return 'bad'
    class Zone(tzinfo):
        def utcoffset(self,dt):calls.append('offset');return timedelta(0)
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW)
    for now in (Clock(2026,9,18,tzinfo=NOW.tzinfo),datetime(2026,9,18,tzinfo=Zone())):
        with pytest.raises(ValueError,match='UTC_TIME_REQUIRED'):claim(s,tasks[0],now=now)
    assert calls==[]


def test_claim_publish_failure_exact_rollback_retry(monkeypatch):
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW)
    before=s.project();original=s._projection
    def fail(state):raise RuntimeError('projection failed')
    monkeypatch.setattr(s,'_projection',fail)
    with pytest.raises(RuntimeError):claim(s,tasks[0])
    monkeypatch.setattr(s,'_projection',original)
    assert s.project()==before
    assert claim(s,tasks[0]).to_dict()['forecast_exposure']==5


@pytest.mark.parametrize('change,reason',[('scope','PATH_SCOPE_DENIED'),('target','TARGET_MISMATCH'),('baseline','TASK_TRACE_MISMATCH'),('trace','TASK_TRACE_MISMATCH')])
def test_plan_identity_and_scope_fail_closed(change,reason):
    s,_,_,_,tasks=fixture();t=tasks[0]
    if change=='scope':t=replace(t,task=replace(t.task,path_scope=('foreign/a.py',)))
    elif change=='target':s._target='sha256:'+'f'*64
    elif change=='baseline':s._session=replace(s._session,baseline_hash='sha256:'+'f'*64)
    else:t=replace(t,task=replace(t.task,parent_hash='sha256:'+'f'*64))
    with pytest.raises(ValueError,match=reason):s.register_plan((t,tasks[1]),actor_id='main',now=NOW)


def test_actual_overrun_preserves_cost_and_blocks_new_claim():
    s,_,r,_,tasks=fixture(budget=5);s.register_plan(tasks,actor_id='main',now=NOW);claim(s,tasks[0])
    t=tasks[0];a=t.assignment
    value=s.collect(t.task.task_id,result_for(r,t,6),actor_id=a.actor_id,execution_fence=a.execution_fence,
        now=NOW,request_id='overrun').to_dict()
    assert value['spent']==6 and value['status']=='REVIEW_REQUIRED'
    assert value['tasks']['task1']['status']=='COST_EXCEEDED' and value['ready']==[]
    with pytest.raises(ValueError):claim(s,tasks[1])


def test_valid_parent_child_trace_uses_actual_parent_binding():
    s,p,r,_,tasks=fixture();a=tasks[1].assignment
    packet=replace(a.packet,parent_run_id='task1')
    child=p.register(assignment_id='child',definition=a.definition,packet=packet,actor_id=a.actor_id,
        context_id=a.context_id,thread_id=a.thread_id,workspace_id=a.workspace_id,session_id=a.session_id,
        context_snapshot_hash=a.packet.context_snapshot_hash,issued_at=a.issued_at,expires_at=a.expires_at,execution_fence=a.execution_fence)
    tasks=(tasks[0],replace(tasks[1],assignment=child,parent_task_id='task1',task=replace(tasks[1].task,parent_hash=tasks[0].content_hash)))
    s.register_plan(tasks,actor_id='main',now=NOW)
    assert s.project().to_dict()['ready']==['task1']
    with pytest.raises(ValueError,match='DEPENDENCY_NOT_COMPLETED'):claim(s,tasks[1])
    claim(s,tasks[0]);complete(s,r,tasks[0]);claim(s,tasks[1]);complete(s,r,tasks[1])
    assert s.project().to_dict()['status']=='COLLECTED_FOR_MAIN'


def test_plan_order_is_canonical_and_registration_replay_no_events():
    s,_,_,_,tasks=fixture();a=s.register_plan(tasks,actor_id='main',now=NOW)
    assert s.register_plan(tuple(reversed(tasks)),actor_id='main',now=NOW)==a


@pytest.mark.parametrize('revoke,reason',[(True,'ASSIGNMENT_REVOKED'),(False,'TASK_TIMED_OUT')])
def test_claim_replay_rechecks_current_authority(revoke,reason):
    s,p,_,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW);claim(s,tasks[0])
    now=NOW
    if revoke:p.revoke(tasks[0].assignment.assignment_id)
    else:now+=timedelta(minutes=11)
    with pytest.raises(ValueError,match=reason):claim(s,tasks[0],now=now)


def test_binding_and_plan_cost_cannot_expand_role_budget():
    s,_,_,_,tasks=fixture()
    t=replace(tasks[0],cost_limit=999)
    with pytest.raises(ValueError,match='ROLE_BUDGET_EXPANSION'):s.register_plan((t,tasks[1]),actor_id='main',now=NOW)


def test_mutated_session_field_types_are_revalidated_before_capture():
    s,p,r,session,_=fixture()
    object.__setattr__(session,'budget',True)
    with pytest.raises(ValueError):
        o.RoleTeamOrchestrator(session,p,r,parent_task_id='parent-task',target_hash=H,deadline=NOW+timedelta(minutes=30))


def test_mutated_task_container_type_is_not_resealed_as_valid():
    _,_,_,_,tasks=fixture()
    object.__setattr__(tasks[0].task,'path_scope',frozenset({'src/a.py'}))
    with pytest.raises(ValueError):replace(tasks[0])


def test_projection_constructor_does_not_accept_callback_payload():
    from packages.agent_team import TeamSnapshot
    calls=[]
    class Payload:
        def encode(self,*args):calls.append('encode');return b'{}'
    with pytest.raises(ValueError):TeamSnapshot(Payload())
    assert calls==[]
