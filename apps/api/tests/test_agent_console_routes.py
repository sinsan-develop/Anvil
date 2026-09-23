from dataclasses import replace
import importlib.util
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from tests.agent_team.test_gateway_contracts_c25 import ready, envelope, NOW, H


def fixture(with_receipt=False):
    assert importlib.util.find_spec('apps.api.anvil_api.routes.agent_console'), 'C29 API missing'
    from apps.api.anvil_api.routes import agent_console as mod
    m,g,i,t,p,r,tasks=ready();a=tasks[0].assignment
    receipts=(g.receive(envelope(m),identity=i,execution_fence='exec1',now=NOW),) if with_receipt else ()
    service=mod.ConsoleProjectionService(t,p,assignment_ids={'task1':a.assignment_id},gateway=g,identity=i,sns_receipts=receipts)
    auth=mod.ConsoleAuthority(a.assignment_id,a.actor_id,a.context_id,a.session_id,H,a.execution_fence)
    app=mod.create_agent_console_app(service,resolve_authority=lambda request:auth,clock=lambda:NOW)
    return mod,service,auth,TestClient(app),t,p,g,tasks


def test_real_owner_projection_is_read_only_target_bound_and_value_safe():
    m,s,a,c,t,p,g,tasks=fixture();before=t.project().content_hash
    response=c.get('/api/agent-console/team');assert response.status_code==200
    v=response.json();assert v['state']=='NORMAL' and v['target_hash']==H
    assert v['data']['tasks'][0]['role']=='REVIEW' and v['data']['tasks'][0]['parent_task_id'] is None
    assert v['data']['tasks'][0]['status']=='PENDING' and v['data']['tasks'][0]['result_hash'] is None
    assert v['deploy_readiness']=='NOT_EVALUATED' and v['external_runtime']=='NOT_EXECUTED'
    assert v['automatic_acceptance'] is False and v['counts_as_pass'] is False
    assert t.project().content_hash==before and g.audit().to_dict()['total']==0


def test_default_factory_and_payload_headers_cannot_mint_authority():
    m,s,a,c,*_=fixture();denied=TestClient(m.create_agent_console_app(s))
    response=denied.get('/api/agent-console/team',headers={'x-role':'ORCH','x-actor':'main'})
    assert response.status_code==403 and response.json()['state']=='PERMISSION_DENIED'


@pytest.mark.parametrize('field,value',[('actor_id','other'),('context_id','other'),('session_id','foreign'),('target_hash','sha256:'+'b'*64),('execution_fence','stale')])
def test_cross_authority_or_fence_denies(field,value):
    m,s,a,c,*_=fixture();app=m.create_agent_console_app(s,resolve_authority=lambda _:replace(a,**{field:value}),clock=lambda:NOW)
    assert TestClient(app).get('/api/agent-console/team').status_code==403


def test_revoked_expired_authority_and_unknown_menu_do_not_leak():
    m,s,a,c,t,p,*_=fixture();p.revoke(a.assignment_id)
    assert c.get('/api/agent-console/team').status_code==403
    late=TestClient(m.create_agent_console_app(s,resolve_authority=lambda _:a,clock=lambda:NOW+timedelta(days=1)))
    assert late.get('/api/agent-console/team').status_code==403
    assert c.get('/api/agent-console/unknown').status_code==404


def test_unconfigured_menu_is_empty_not_mock_pass():
    m,s,a,c,*_=fixture()
    for menu in ('moa','sns'):
        v=c.get('/api/agent-console/'+menu).json();assert v['state']=='EMPTY' and v['counts_as_pass'] is False
    v=c.get('/api/agent-console/adapters').json()
    assert v['data']['kakao']['status']=='OPEN_DECISION' and v['data']['kakao']['allowed'] is False


def test_sns_uses_current_registered_receipt_without_raw_body_or_secret():
    m,s,a,c,t,p,g,*_=fixture(True);before=g.audit().to_dict()['total']
    v=c.get('/api/agent-console/sns').json()
    assert v['state']=='NORMAL' and v['data']['receipts'][0]['delivery']=='NOT_EXECUTED'
    assert v['data']['receipts'][0]['session_id']=='session'
    assert 'authn_hash' not in str(v) and 'payload_json' not in str(v)
    assert g.audit().to_dict()['total']==before


@pytest.mark.parametrize('action,code,state',[('pause',202,'REQUESTED_NOT_APPLIED'),('resume',202,'REQUESTED_NOT_APPLIED'),('deploy',403,'HUMAN_APPROVAL_REQUIRED'),('delete',403,'HUMAN_APPROVAL_REQUIRED'),('approve',403,'HUMAN_APPROVAL_REQUIRED')])
def test_post_is_intent_only_and_never_mutates_owner(action,code,state):
    m,s,a,c,t,p,g,*_=fixture();before=t.project().content_hash
    v=c.post('/api/agent-console/control',json={'action':action,'target_hash':H,'request_id':'request'})
    assert v.status_code==code and v.json()['state']==state
    assert t.project().content_hash==before and g.audit().to_dict()['total']==0


def test_target_swap_raw_payload_and_callback_objects_denied_without_echo():
    m,s,a,c,*_=fixture()
    assert c.post('/api/agent-console/control',json={'action':'pause','target_hash':'sha256:'+'c'*64,'request_id':'r'}).status_code==403
    assert c.post('/api/agent-console/control',json={'action':'pause','target_hash':H,'request_id':'r','token':'FAKE_TEST_ONLY'}).status_code==400
    class Evil:
        @property
        def actor_id(self):raise AssertionError('callback')
    app=m.create_agent_console_app(s,resolve_authority=lambda _:Evil(),clock=lambda:NOW)
    assert TestClient(app).get('/api/agent-console/team').status_code==403


def test_real_moa_proposals_keep_evidence_without_summary_or_fence():
    from tests.agent_team.test_moa_c24 import ready as moa_ready, proposal, vote
    from apps.api.anvil_api.routes import agent_console as mod
    host,team,policy,tasks=moa_ready();pr=proposal(host,tasks);vote(host,pr)
    a=tasks[0].assignment
    s=mod.ConsoleProjectionService(team,policy,assignment_ids={t.assignment.packet.step_id:t.assignment.assignment_id for t in tasks},moa=host)
    auth=mod.ConsoleAuthority(a.assignment_id,a.actor_id,a.context_id,a.session_id,H,a.execution_fence)
    before=host.project().content_hash
    value=s.read('moa',auth,now=NOW)
    assert value['data']['proposals'][0]['evidence_refs']==[H]
    assert len(value['data']['critiques'])==1
    assert 'summary' not in str(value) and 'execution_fence' not in str(value)
    value['data']['proposals'].clear()
    assert len(s.read('moa',auth,now=NOW)['data']['proposals'])==1
    assert host.project().content_hash==before


def test_projection_return_and_mapping_inputs_are_detached():
    m,s,a,c,t,p,g,tasks=fixture();ids={'task1':a.assignment_id}
    other=m.ConsoleProjectionService(t,p,assignment_ids=ids);ids.clear()
    v=other.read('team',a,now=NOW);v['data']['tasks'].clear()
    assert len(other.read('team',a,now=NOW)['data']['tasks'])==1


def test_bounded_body_offline_and_queries_are_honest():
    m,s,a,c,*_=fixture()
    offline=TestClient(m.create_agent_console_app())
    assert offline.get('/api/agent-console/team').status_code==503
    assert c.get('/api/agent-console/team?token=FAKE_TEST_ONLY').status_code==400
    r=c.post('/api/agent-console/control',content='x'*4097)
    assert r.status_code==413 and 'xxx' not in r.text
    assert c.post('/api/agent-console/control',content='{').status_code==400


def test_projection_checksum_binds_menu_and_returned_data_not_only_team():
    import hashlib,json
    m,s,a,c,*_=fixture()
    team=c.get('/api/agent-console/team').json();sns=c.get('/api/agent-console/sns').json()
    assert team['projection_hash']!=sns['projection_hash']
    recorded=team.pop('projection_hash')
    assert recorded=='sha256:'+hashlib.sha256(json.dumps(team,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
