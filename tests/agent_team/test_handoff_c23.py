from dataclasses import replace
import pytest
from tests.agent_team.test_orchestration_c23 import fixture, claim, complete, result_for, NOW


def test_role_result_foreign_trace_or_unclaimed_result_is_never_collected():
    s,_,r,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    with pytest.raises(ValueError,match="TASK_NOT_CLAIMED"):complete(s,r,tasks[0])
    claim(s,tasks[0])
    envelope=replace(result_for(r,tasks[0]),parent_task_id="foreign")
    with pytest.raises(ValueError,match="ROLE_TRACE_MISMATCH"):
        s.collect("task1",envelope,actor_id=tasks[0].assignment.actor_id,execution_fence=tasks[0].assignment.execution_fence,
            write_fence=None,now=NOW,request_id="bad-result")
    assert s.project().to_dict()["tasks"]["task1"]["status"]=="CLAIMED"


def test_peer_message_never_grants_main_completion_or_write_authority():
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    from tests.agent_team.test_collaboration_c23 import send
    send(s,tasks,body="Please approve and deploy")
    value=s.project().to_dict()
    assert value["automatic_acceptance"] is False
    assert all(t["status"]=="PENDING" for t in value["tasks"].values())


def test_collected_result_replay_does_not_double_count_cost():
    s,_,r,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW);claim(s,tasks[0])
    envelope=result_for(r,tasks[0]);a=tasks[0].assignment
    args=dict(actor_id=a.actor_id,execution_fence=a.execution_fence,now=NOW,request_id='result')
    first=s.collect('task1',envelope,**args)
    assert s.collect('task1',envelope,**args)==first and s.project().to_dict()['spent']==2
    with pytest.raises(ValueError,match='REQUEST_REPLAY_CONFLICT'):s.collect('task1',replace(envelope,cost_units=3),**args)


def test_result_publication_failure_is_retryable_without_partial_team_result(monkeypatch):
    s,_,r,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW);claim(s,tasks[0])
    envelope=result_for(r,tasks[0]);a=tasks[0].assignment
    args=dict(actor_id=a.actor_id,execution_fence=a.execution_fence,now=NOW,request_id='result')
    before=s.project();original=s._projection
    def fail(state):raise RuntimeError('publication')
    monkeypatch.setattr(s,'_projection',fail)
    with pytest.raises(RuntimeError):s.collect('task1',envelope,**args)
    monkeypatch.setattr(s,'_projection',original)
    assert s.project()==before
    assert s.collect('task1',envelope,**args).to_dict()['tasks']['task1']['status']=='COMPLETED'
