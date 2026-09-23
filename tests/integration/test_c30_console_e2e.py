"""Cross-owner integration, synthetic evidence, real local domain objects."""
from dataclasses import replace
import pytest
from fastapi.testclient import TestClient
from apps.api.anvil_api.routes.agent_console import ConsoleAuthority,ConsoleProjectionService,create_agent_console_app
from tests.agent_team.test_orchestration_c23 import fixture,claim,complete,NOW,H
from tests.agent_team.test_moa_c24 import proposal,vote
from packages.agent_team.moa import MoADeliberation
from datetime import timedelta


def ready():
    team,policy,results,_,tasks=fixture(('PLANNING','REVIEW','TEST'))
    bound=[tasks[0]]
    for task in tasks[1:]:
        a=task.assignment
        policy.revoke(a.assignment_id)
        child=policy.register(assignment_id='child-'+a.assignment_id,definition=a.definition,
            packet=replace(a.packet,parent_run_id='task1'),actor_id=a.actor_id,context_id=a.context_id,
            thread_id=a.thread_id,workspace_id=a.workspace_id,session_id=a.session_id,
            context_snapshot_hash=a.packet.context_snapshot_hash,issued_at=a.issued_at,expires_at=a.expires_at,
            execution_fence=a.execution_fence)
        bound.append(replace(task,assignment=child,parent_task_id='task1',task=replace(task.task,parent_hash=tasks[0].content_hash)))
    tasks=tuple(bound)
    team.register_plan(tasks,actor_id='main',now=NOW)
    a=tasks[0].assignment
    moa=MoADeliberation(team,quorum=1,deadline=NOW+timedelta(minutes=5))
    service=ConsoleProjectionService(team,policy,assignment_ids={t.task.task_id:t.assignment.assignment_id for t in tasks},moa=moa)
    authority=ConsoleAuthority(a.assignment_id,a.actor_id,a.context_id,a.session_id,H,a.execution_fence)
    client=TestClient(create_agent_console_app(service,resolve_authority=lambda _:authority,clock=lambda:NOW))
    return team,policy,results,tasks,moa,client,service,authority


def test_three_role_collection_moa_and_console_keep_exact_parent_child_evidence():
    team,policy,results,tasks,moa,client,*_=ready()
    initial=client.get('/api/agent-console/team').json()
    assert [r['parent_task_id'] for r in initial['data']['tasks']]==[None,'task1','task1']
    for task in tasks:claim(team,task);complete(team,results,task)
    pr=proposal(moa,tasks);vote(moa,pr)
    synthesis=moa.synthesize(request_id='synth',actor_id='main',now=NOW).to_dict()
    assert synthesis['status']=='SYNTHESIZED_FOR_MAIN' and not synthesis['automatic_acceptance']
    view=client.get('/api/agent-console/team').json()
    assert all(r['status']=='COMPLETED' and r['result_hash'] for r in view['data']['tasks'])
    assert view['data']['team_status']=='COLLECTED_FOR_MAIN'
    assert view['deploy_readiness']=='NOT_EVALUATED' and not view['counts_as_pass']
    mv=client.get('/api/agent-console/moa').json()
    assert mv['data']['proposals'][0]['evidence_refs']==[H]
    assert mv['data']['critiques'][0]['proposal_id']=='p1'
    assert 'execution_fence' not in str(mv) and 'summary' not in str(mv)


@pytest.mark.parametrize('action',['pause','resume','approve','apply','deploy','delete','provider','permission'])
def test_console_control_never_changes_team_or_creates_acceptance(action):
    team,policy,results,tasks,moa,client,*_=ready();before=team.project().content_hash
    r=client.post('/api/agent-console/control',json={'action':action,'target_hash':H,'request_id':'intent'})
    assert r.status_code==(202 if action in ('pause','resume') else 403)
    assert r.json()['applied'] is False and r.json()['io_count']==0
    assert team.project().content_hash==before


def test_current_revocation_clears_previously_read_console_authority():
    team,policy,results,tasks,moa,client,*_=ready()
    assert client.get('/api/agent-console/team').status_code==200
    policy.revoke(tasks[0].assignment.assignment_id)
    assert client.get('/api/agent-console/team').status_code==403
    assert client.get('/api/agent-console/moa').status_code==403


def test_telegram_request_and_kakao_open_decision_never_dispatch_runner():
    from tests.agent_team.test_telegram_contracts_c26 import ready as telegram_ready,process
    from tests.agent_team.test_kakao_contracts_c27 import ready as kakao_ready,envelope
    adapter,binding,gateway,identity,team,*_=telegram_ready();before=team.project().content_hash
    v=process(adapter,binding,command='/pause').to_dict()
    assert v['status']=='REQUESTED_NOT_APPLIED' and v['runner_dispatch']==0
    assert team.project().content_hash==before
    kakao,gateway=kakao_ready();v=kakao.project(envelope(),now=NOW).to_dict()
    assert v['status']=='OPEN_DECISION' and v['allowed'] is False and v['io_count']==0
    assert gateway.audit().to_dict()['total']==0


def test_unified_asgi_routes_console_before_frontend_without_fabricating_owner(monkeypatch):
    import importlib.util
    from pathlib import Path
    from fastapi import FastAPI
    import packages.api.runtime as runtime

    # The runtime factory constructs DB/provider ports and reads credentials.
    # Isolate that bootstrap only; exercise the real ASGI route registration.
    monkeypatch.setattr(runtime, 'create_runtime_app', FastAPI)
    path=Path(__file__).resolve().parents[2]/'apps/api/anvil_api/asgi.py'
    spec=importlib.util.spec_from_file_location('_c30_asgi_route_probe',path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with TestClient(module.app) as client:
        assert client.get('/health/live').json()=={'status':'ok'}
        for menu in ('team','moa','sns','adapters'):
            response=client.get('/api/agent-console/'+menu)
            assert response.status_code==503
            assert response.json()=={'state':'OFFLINE','reason':'CONSOLE_REQUEST_DENIED','counts_as_pass':False}
            assert response.headers['cache-control']=='no-store'
        control=client.post('/api/agent-console/control',json={'action':'deploy'})
        assert control.status_code==503 and control.json()['counts_as_pass'] is False
        assert client.get('/api/agent-console/unknown').status_code==404
        assert client.get('/api/agent-console/team?actor=forged').status_code==400
        assert client.get('/').status_code==200
