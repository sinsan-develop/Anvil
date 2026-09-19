"""C25 host-only contracts; real C22/C23 owners, no transport."""
from datetime import timedelta
from dataclasses import replace
import importlib
import importlib.util
import pytest
from tests.agent_team.test_orchestration_c23 import fixture, claim, complete, NOW, H


def ready(**options):
    assert importlib.util.find_spec('packages.agent_team.sns_gateway'), 'C25 gateway missing'
    mod=importlib.import_module('packages.agent_team.sns_gateway')
    team,policy,results,_,tasks=fixture(('REVIEW',))
    team.register_plan(tasks,actor_id='main',now=NOW)
    gateway=mod.SNSGateway(policy,team,tenant_id='tenant',project_id='project',**options)
    identity=gateway.capture_identity('identity',assignment=tasks[0].assignment,external_actor_hash=H,
        authn_hash=H,authz_hash=H,commands=('QUESTION','STATUS','RESULT'),retention_seconds=3600,
        now=NOW,expires_at=NOW+timedelta(minutes=5))
    return mod,gateway,identity,team,policy,results,tasks


def envelope(mod,**changes):
    args=dict(message_id='message',channel='SNS',session_id='session',task_id='task1',parent_task_id=None,
        external_actor_hash=H,internal_user='actor1',tenant_id='tenant',project_id='project',role='REVIEW',
        target_hash=H,baseline_hash=H,command='QUESTION',payload_ref={'artifact_id':'question','sha256':H,'privacy':'PRIVATE'},
        correlation_id='correlation',idempotency_key='idem',replay_nonce='nonce',attempt=1,
        privacy='PRIVATE',retention_seconds=120,issued_at=NOW,expires_at=NOW+timedelta(minutes=2))
    args.update(changes);return mod.SNSMessageEnvelope(**args)


def receive(gateway,identity,env,**changes):
    args=dict(identity=identity,execution_fence='exec1',now=NOW);args.update(changes)
    return gateway.receive(env,**args)


def test_envelope_preserves_trace_and_observation_without_execution_or_raw_payload():
    m,g,i,*_=ready();r=receive(g,i,envelope(m));v=r.to_dict()
    assert v['status']=='ACCEPTED_HOST_ONLY' and v['delivery']=='NOT_EXECUTED'
    assert v['trace']['session_id']=='session' and v['trace']['parent_task_id'] is None
    assert v['trace']['parent_run_id']=='parent-task'
    assert v['trace']['role']=='REVIEW' and v['authn_hash']==H and v['authz_hash']==H
    assert v['io_count']==0 and v['automatic_acceptance'] is False
    assert 'body' not in r.payload_json and 'stdout' not in r.payload_json


@pytest.mark.parametrize('field,value,reason',[
    ('session_id','foreign','TRACE_MISMATCH'),('role','CODE','TRACE_MISMATCH'),
    ('tenant_id','foreign','TRACE_MISMATCH'),('target_hash','sha256:'+'b'*64,'TRACE_MISMATCH'),
    ('parent_task_id','foreign','TRACE_MISMATCH'),('external_actor_hash','sha256:'+'c'*64,'TRACE_MISMATCH')])
def test_foreign_trace_denies_without_publication(field,value,reason):
    m,g,i,*_=ready()
    with pytest.raises(ValueError,match=reason):receive(g,i,envelope(m,**{field:value}))
    assert g.audit().to_dict()['events']==[]


def test_current_role_authority_revoke_and_wrong_fence_block_replay():
    m,g,i,t,p,r,tasks=ready();e=envelope(m);receive(g,i,e)
    with pytest.raises(ValueError,match='STALE_EXECUTION_FENCE'):receive(g,i,e,execution_fence='stale')
    p.revoke(tasks[0].assignment.assignment_id)
    with pytest.raises(ValueError,match='ASSIGNMENT_REVOKED'):receive(g,i,e)


def test_hostile_scalars_callback_zero_and_dataclass_alias_detached():
    m,g,i,*_=ready();calls=[]
    class Bad:
        def __str__(self):calls.append(1);return 'QUESTION'
        def __deepcopy__(self,memo):calls.append(1);return 'QUESTION'
    with pytest.raises(ValueError):receive(g,i,envelope(m,command=Bad()))
    assert calls==[] and g.audit().to_dict()['events']==[]
    e=envelope(m);r=receive(g,i,e);old=r.payload_json
    e.payload_ref['artifact_id']='changed'
    object.__setattr__(r,'payload_json','{}')
    assert receive(g,i,envelope(m)).payload_json==old


def test_same_idempotency_cannot_rebind_authenticated_observation():
    m,g,i,t,p,r,tasks=ready();receive(g,i,envelope(m))
    other=g.capture_identity('other',assignment=tasks[0].assignment,external_actor_hash=H,
        authn_hash='sha256:'+'b'*64,authz_hash=H,commands=('QUESTION','STATUS','RESULT'),retention_seconds=3600,
        now=NOW,expires_at=NOW+timedelta(minutes=5))
    with pytest.raises(ValueError,match='IDEMPOTENCY_CONFLICT'):receive(g,other,envelope(m))
    assert len(g.audit().to_dict()['events'])==1


def test_identity_capture_rechecks_current_role_before_publication(monkeypatch):
    m,g,i,t,p,r,tasks=ready();original=m._value
    def revoke_during_capture(kind,key,data):
        result=original(kind,key,data)
        if kind=='SNS_IDENTITY':p.revoke(tasks[0].assignment.assignment_id)
        return result
    monkeypatch.setattr(m,'_value',revoke_during_capture)
    with pytest.raises(ValueError,match='ASSIGNMENT_REVOKED'):
        g.capture_identity('new',assignment=tasks[0].assignment,external_actor_hash=H,authn_hash=H,authz_hash=H,
            commands=('QUESTION',),retention_seconds=120,now=NOW,expires_at=NOW+timedelta(minutes=2))
    assert 'new' not in g._identities


def test_concurrent_duplicate_admission_has_one_receipt_and_audit():
    from concurrent.futures import ThreadPoolExecutor
    m,g,i,*_=ready();e=envelope(m)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:receive(g,i,e),range(100)))
    assert len({r.content_hash for r in results})==1
    assert g.audit().to_dict()['total']==1


@pytest.mark.parametrize('field',['issued_at','expires_at'])
def test_mutable_time_callbacks_are_not_executed(field):
    from datetime import datetime,tzinfo
    m,g,i,*_=ready();calls=[]
    class Mutable(tzinfo):
        def utcoffset(self,dt):calls.append(1);return timedelta(0)
    value=datetime(2026,9,18,9,tzinfo=Mutable())
    with pytest.raises(ValueError):receive(g,i,envelope(m,**{field:value}))
    assert calls==[] and g.audit().to_dict()['total']==0
