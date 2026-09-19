"""Real C22/C23 owners, synthetic evidence only; no provider execution."""
from datetime import timedelta
import pytest
from packages.agent_team import moa
from tests.agent_team.test_orchestration_c23 import fixture,claim,complete,NOW,H


def ready(quorum=1):
    assert hasattr(moa,'MoADeliberation'), 'C24 deliberation missing'
    team,policy,results,_,tasks=fixture(('PLANNING','REVIEW','TEST'))
    team.register_plan(tasks,actor_id='main',now=NOW)
    for task in tasks:claim(team,task);complete(team,results,task)
    host=moa.MoADeliberation(team,quorum=quorum,deadline=NOW+timedelta(minutes=5))
    return host,team,policy,tasks


def proposal(host,tasks,**changes):
    args=dict(proposal_id='p1',task_id='task1',actor_id='actor1',execution_fence='exec1',
        summary='Use the scoped approach',evidence_refs=[H],now=NOW)
    args.update(changes);return host.propose(**args)


def vote(host,p,task=2,**changes):
    args=dict(critique_id='c'+str(task),proposal=p,task_id='task'+str(task),actor_id='actor'+str(task),
        execution_fence='exec'+str(task),verdict='SUPPORT',summary='Independent comparison',evidence_refs=[H],now=NOW)
    args.update(changes);return host.critique(**args)


def test_quorum_synthesis_is_bounded_main_proposal_not_routing_or_approval():
    h,team,p,tasks=ready();pr=proposal(h,tasks);vote(h,pr)
    result=h.synthesize(request_id='s',actor_id='main',now=NOW).to_dict()
    assert result['status']=='SYNTHESIZED_FOR_MAIN' and result['selected_proposal_id']=='p1'
    assert result['automatic_acceptance'] is False and result['provider_selection'] is None and result['io_count']==0
    assert result['session_id']=='session' and result['baseline_hash']==H


@pytest.mark.parametrize('variant,reason',[('quorum','QUORUM_NOT_REACHED'),('conflict','CONFLICT_UNRESOLVED'),('owner','MAIN_AUTHORITY_REQUIRED'),('stale','ASSIGNMENT_REVOKED')])
def test_synthesis_fail_closed(variant,reason):
    h,team,p,tasks=ready();pr=proposal(h,tasks)
    if variant!='quorum':vote(h,pr)
    if variant=='conflict':vote(h,pr,3,verdict='OBJECT')
    if variant=='stale':p.revoke(tasks[1].assignment.assignment_id)
    with pytest.raises(ValueError,match=reason):h.synthesize(request_id='s',actor_id='other' if variant=='owner' else 'main',now=NOW)


def test_proposal_replay_tamper_alias_and_self_critique_denied():
    h,_,_,tasks=ready();pr=proposal(h,tasks);old=pr.payload_json
    assert proposal(h,tasks).payload_json==old
    with pytest.raises(ValueError,match='REPLAY_CONFLICT'):proposal(h,tasks,summary='Other')
    with pytest.raises(ValueError,match='INDEPENDENT_CRITIQUE_REQUIRED'):vote(h,pr,1)
    object.__setattr__(pr,'payload_json','{}')
    with pytest.raises(ValueError,match='HANDLE_INVALID'):vote(h,pr)
    assert proposal(h,tasks).payload_json==old


def test_timeout_and_hostile_metadata_do_not_publish():
    h,_,_,tasks=ready();calls=[]
    class Hostile:
        def __deepcopy__(self,memo):calls.append(1);return 'safe'
        def __str__(self):calls.append(1);return 'safe'
    with pytest.raises(ValueError):proposal(h,tasks,summary=Hostile())
    with pytest.raises(ValueError,match='DELIBERATION_EXPIRED'):proposal(h,tasks,now=NOW+timedelta(minutes=6))
    assert calls==[] and h.project().to_dict()['proposals']==[]


def test_duplicate_voter_cannot_manufacture_quorum_and_partial_failure_blocks():
    h,team,_,tasks=ready(quorum=2);pr=proposal(h,tasks);vote(h,pr)
    with pytest.raises(ValueError,match='DUPLICATE_VOTER'):vote(h,pr,critique_id='another')
    with pytest.raises(ValueError,match='QUORUM_NOT_REACHED'):h.synthesize(request_id='s',actor_id='main',now=NOW)
    team.cancel(actor_id='main',now=NOW,request_id='cancel')
    with pytest.raises(ValueError,match='TEAM_PARTIAL_FAILURE'):h.synthesize(request_id='s',actor_id='main',now=NOW)


def test_two_supported_proposals_conflict_and_synthesis_snapshot_is_detached():
    h,_,_,tasks=ready();p1=proposal(h,tasks);vote(h,p1)
    first=h.synthesize(request_id='s',actor_id='main',now=NOW);old=first.payload_json
    object.__setattr__(first,'payload_json','{}')
    assert h.synthesize(request_id='s',actor_id='main',now=NOW).payload_json==old
    p2=proposal(h,tasks,proposal_id='p2',task_id='task2',actor_id='actor2',execution_fence='exec2')
    vote(h,p2,3)
    with pytest.raises(ValueError,match='CONFLICT_UNRESOLVED'):h.synthesize(request_id='s2',actor_id='main',now=NOW)


def test_incomplete_team_result_cannot_become_a_proposal():
    team,_,_,_,tasks=fixture(('PLANNING',));team.register_plan(tasks,actor_id='main',now=NOW)
    h=moa.MoADeliberation(team,quorum=1,deadline=NOW+timedelta(minutes=5))
    with pytest.raises(ValueError,match='COMPLETED_ROLE_RESULT_REQUIRED'):proposal(h,tasks)
