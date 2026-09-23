from datetime import timedelta
import pytest
from tests.agent_team.test_gateway_contracts_c25 import ready,envelope,receive,NOW,H


def test_duplicate_idempotency_nonce_and_message_rebind_fail_closed():
    m,g,i,*_=ready();first=receive(g,i,envelope(m))
    assert receive(g,i,envelope(m)).payload_json==first.payload_json
    for args,reason in [({'command':'STATUS'},'IDEMPOTENCY_CONFLICT'),
        ({'message_id':'m2','idempotency_key':'id2'},'REPLAY_NONCE'),
        ({'idempotency_key':'id2','replay_nonce':'n2'},'MESSAGE_REBIND')]:
        with pytest.raises(ValueError,match=reason):receive(g,i,envelope(m,**args))
    assert len(g.audit().to_dict()['events'])==1


def test_rate_limit_is_identity_scoped_and_exact_replay_does_not_spend():
    m,g,i,*_=ready(rate_limit=1);e=envelope(m);receive(g,i,e);receive(g,i,e)
    e2=envelope(m,message_id='m2',idempotency_key='i2',replay_nonce='n2')
    with pytest.raises(ValueError,match='RATE_LIMITED'):receive(g,i,e2)
    assert receive(g,i,e2,now=NOW+timedelta(seconds=60)).to_dict()['status']=='ACCEPTED_HOST_ONLY'


def test_retry_backoff_dead_letter_and_receipt_replay_are_host_only():
    m,g,i,*_=ready(max_attempts=3);r=receive(g,i,envelope(m))
    args=dict(identity=i,execution_fence='exec1',request_id='retry1',failure_code='TRANSIENT_FAILURE',now=NOW)
    r2=g.retry(r,**args)
    assert r2.to_dict()['status']=='RETRY_WAIT' and r2.to_dict()['attempt']==2
    assert g.retry(r,**args).payload_json==r2.payload_json
    with pytest.raises(ValueError,match='RETRY_NOT_DUE'):
        g.retry(r2,**dict(args,request_id='retry2'))
    r3=g.retry(r2,**dict(args,request_id='retry2',now=NOW+timedelta(seconds=1)))
    assert r3.to_dict()['status']=='DLQ' and r3.to_dict()['delivery']=='NOT_EXECUTED'
    with pytest.raises(ValueError,match='TERMINAL_RECEIPT'):
        g.retry(r3,**dict(args,request_id='retry3',now=NOW+timedelta(seconds=5)))
    assert len(g.audit().to_dict()['events'])==3


@pytest.mark.parametrize('command',['DEPLOY','APPLY','DELETE','APPROVE','SECRET','PROVIDER_CHANGE','DESIGN_FINALIZE'])
def test_high_risk_command_requires_console_step_up(command):
    m,g,i,*_=ready()
    with pytest.raises(ValueError,match='CONSOLE_STEP_UP_REQUIRED'):receive(g,i,envelope(m,command=command))
    assert g.audit().to_dict()['events']==[]


def test_forged_or_expired_identity_and_receipt_fail_closed():
    m,g,i,*_=ready();r=receive(g,i,envelope(m))
    with pytest.raises(ValueError,match='RECEIPT_EXPIRED'):
        g.receipt(r,identity=i,execution_fence='exec1',now=NOW+timedelta(minutes=2))
    object.__setattr__(i,'payload_json','{}')
    with pytest.raises(ValueError,match='IDENTITY_INVALID'):receive(g,i,envelope(m))


def test_revoked_identity_exact_recapture_never_revives():
    m,g,i,t,p,r,tasks=ready();g.revoke_identity('identity')
    with pytest.raises(ValueError,match='IDENTITY_REVOKED'):receive(g,i,envelope(m))
    with pytest.raises(ValueError,match='IDENTITY_REVOKED'):
        g.capture_identity('identity',assignment=tasks[0].assignment,external_actor_hash=H,
            authn_hash=H,authz_hash=H,commands=('QUESTION','STATUS','RESULT'),retention_seconds=3600,
            now=NOW,expires_at=NOW+timedelta(minutes=5))


def test_receipt_publication_failure_does_not_spend_rate_nonce_or_idempotency(monkeypatch):
    m,g,i,*_=ready(rate_limit=1);original=m._value
    def fail(kind,key,data):
        if kind=='SNS_RECEIPT':raise RuntimeError('synthetic publication fault')
        return original(kind,key,data)
    monkeypatch.setattr(m,'_value',fail)
    with pytest.raises(RuntimeError):receive(g,i,envelope(m))
    assert g.audit().to_dict()['total']==0
    monkeypatch.setattr(m,'_value',original)
    assert receive(g,i,envelope(m)).to_dict()['status']=='ACCEPTED_HOST_ONLY'


def test_retry_conflict_and_expired_identity_do_not_republish():
    m,g,i,*_=ready();r=receive(g,i,envelope(m))
    args=dict(identity=i,execution_fence='exec1',request_id='retry1',failure_code='ADAPTER_UNAVAILABLE',now=NOW)
    g.retry(r,**args)
    with pytest.raises(ValueError,match='IDEMPOTENCY_CONFLICT'):g.retry(r,**dict(args,failure_code='TRANSIENT_FAILURE'))
    with pytest.raises(ValueError,match='IDENTITY_EXPIRED'):receive(g,i,envelope(m),now=NOW+timedelta(minutes=5))
    assert g.audit().to_dict()['total']==2
