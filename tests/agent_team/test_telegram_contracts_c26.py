"""Host observations only; no Telegram SDK, tokens, webhook or network."""
from datetime import timedelta
import pytest
from packages.agent_team import telegram_adapter as mod
from tests.agent_team.test_gateway_contracts_c25 import ready as gateway_ready,NOW,H


def ready(**options):
    assert hasattr(mod,'TelegramGatewayAdapter'),'C26 gateway adapter missing'
    m,g,i,t,p,r,tasks=gateway_ready(**options)
    adapter=mod.TelegramGatewayAdapter(g,team=t)
    binding=adapter.capture_binding('binding',identity=i,chat_hash=H,user_hash=H,device_id='device1',
        auth_observation_hash=H,now=NOW,expires_at=NOW+timedelta(minutes=2))
    return adapter,binding,g,i,t,p,r,tasks


def update(**changes):
    row=dict(update_id=100,chat_hash=H,user_hash=H,device_id='device1',session_id='session',command='/status',
        nonce='nonce',idempotency_key='idempotency',correlation_id='correlation',
        payload_ref={'artifact_id':'telegram-input','sha256':H,'privacy':'PRIVATE'},retention_seconds=120,
        issued_at=NOW,expires_at=NOW+timedelta(minutes=2))
    row.update(changes);return row


def process(a,b,**changes):
    return a.process(update(**changes),binding=b,execution_fence='exec1',now=NOW)


def test_normalized_telegram_status_is_gateway_bound_not_delivery_or_authority():
    a,b,g,*_=ready();receipt=process(a,b);v=receipt.to_dict()
    assert v['status']=='STATUS_REQUESTED' and v['delivery']=='NOT_EXECUTED'
    assert v['gateway_command']=='STATUS' and v['requested_control'] is None
    assert v['console_link']=='/sessions/session' and v['session_id']=='session'
    assert v['gateway_receipt_hash']==g.audit().to_dict()['events'][0]['receipt_hash']
    assert v['device_id']=='device1' and v['io_count']==0 and not v['automatic_acceptance']
    assert v['observed_status']['team_status']=='ACTIVE' and v['observed_status']['task_status']=='PENDING'
    assert v['observed_status']['target_hash']==H


@pytest.mark.parametrize('field,value',[('chat_hash','sha256:'+'b'*64),('user_hash','sha256:'+'c'*64),
    ('device_id','other'),('session_id','foreign')])
def test_mapping_mismatch_is_denied_before_gateway_admission(field,value):
    a,b,g,*_=ready()
    with pytest.raises(ValueError,match='TELEGRAM_IDENTITY_MISMATCH'):process(a,b,**{field:value})
    assert g.audit().to_dict()['total']==0 and a.audit().to_dict()['total']==0


def test_current_assignment_revocation_and_stale_fence_deny_replay():
    a,b,g,i,t,p,r,tasks=ready();process(a,b)
    with pytest.raises(ValueError,match='STALE_EXECUTION_FENCE'):
        a.process(update(),binding=b,execution_fence='stale',now=NOW)
    p.revoke(tasks[0].assignment.assignment_id)
    with pytest.raises(ValueError,match='ASSIGNMENT_REVOKED'):process(a,b)


def test_unregistered_or_tampered_binding_never_self_authenticates():
    a,b,g,*_=ready();object.__setattr__(b,'payload_json','{}')
    with pytest.raises(ValueError,match='BINDING_INVALID'):process(a,b)
    assert g.audit().to_dict()['total']==0


def test_registered_binding_cannot_turn_unregistered_identity_into_authority():
    from packages.provider_catalog.models import snapshot
    a,b,g,i,*_=ready();data=i.to_dict();data['identity_id']='self-minted'
    forged=snapshot('SNS_IDENTITY','self-minted',data)
    pending=a.capture_binding('pending',identity=forged,chat_hash=H,user_hash=H,device_id='device1',
        auth_observation_hash=H,now=NOW,expires_at=NOW+timedelta(minutes=2))
    assert pending.to_dict()['authority']=='HOST_OBSERVATION_PENDING_GATEWAY_CHECK'
    with pytest.raises(ValueError,match='IDENTITY_INVALID'):process(a,pending)
    assert g.audit().to_dict()['total']==a.audit().to_dict()['total']==0


def test_revoke_during_local_projection_stops_publication_and_preserves_owner_audit(monkeypatch):
    a,b,g,i,t,p,r,tasks=ready();original=mod._gateway_value
    def revoke(kind,key,data):
        result=original(kind,key,data)
        if kind=='TELEGRAM_RECEIPT':p.revoke(tasks[0].assignment.assignment_id)
        return result
    monkeypatch.setattr(mod,'_gateway_value',revoke)
    with pytest.raises(ValueError,match='ASSIGNMENT_REVOKED'):process(a,b)
    assert a.audit().to_dict()['total']==0
    assert g.audit().to_dict()['total']==1  # C25 admission happened; not a transport send.


def test_binding_revoke_cannot_be_undone_by_exact_capture_replay():
    a,b,g,i,*_=ready();a.revoke_binding('binding')
    with pytest.raises(ValueError,match='BINDING_REVOKED'):process(a,b)
    with pytest.raises(ValueError,match='BINDING_REVOKED'):
        a.capture_binding('binding',identity=i,chat_hash=H,user_hash=H,device_id='device1',
            auth_observation_hash=H,now=NOW,expires_at=NOW+timedelta(minutes=2))


def test_receipt_projection_is_registered_current_and_detached():
    a,b,g,*_=ready();r=process(a,b)
    view=a.receipt(r,binding=b,execution_fence='exec1',now=NOW)
    object.__setattr__(view,'payload_json','{}')
    assert a.receipt(r,binding=b,execution_fence='exec1',now=NOW).content_hash==r.content_hash
    with pytest.raises(ValueError,match='RECEIPT_INVALID'):a.receipt(view,binding=b,execution_fence='exec1',now=NOW)


def test_status_reads_current_c23_observation_without_changing_team():
    from tests.agent_team.test_orchestration_c23 import claim
    a,b,g,i,t,p,r,tasks=ready();claim(t,tasks[0]);before=t.project()
    value=process(a,b).to_dict()
    assert value['observed_status']['task_status']=='CLAIMED'
    assert value['observed_status']['projection_hash']==before.content_hash
    assert value['observed_status']['observed_at']==NOW.isoformat()
    assert t.project().payload==before.payload
