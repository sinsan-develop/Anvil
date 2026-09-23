"""Kakao drafts cannot authorize transport or internal actions."""
from dataclasses import replace
from datetime import timedelta
import importlib.util
import pytest
from tests.agent_team.test_gateway_contracts_c25 import ready as gateway_ready, NOW, H
from packages.agent_team.sns_gateway import SNSMessageEnvelope


def ready(**kw):
    assert importlib.util.find_spec('packages.agent_team.kakao_adapter'), 'C27 adapter missing'
    from packages.agent_team.kakao_adapter import KakaoContractAdapter
    _, g, *_ = gateway_ready()
    return KakaoContractAdapter(g, **kw), g


def envelope(**kw):
    row=dict(message_id='message', channel='KAKAO', session_id='session', task_id='task1',
        parent_task_id=None, external_actor_hash=H, internal_user='actor1', tenant_id='tenant',
        project_id='project', role='REVIEW', target_hash=H, baseline_hash=H, command='STATUS',
        payload_ref=dict(artifact_id='input', sha256=H, privacy='PRIVATE'), correlation_id='correlation',
        idempotency_key='idem', replay_nonce='nonce', attempt=1, privacy='PRIVATE', retention_seconds=120,
        issued_at=NOW, expires_at=NOW+timedelta(seconds=120))
    row.update(kw)
    return SNSMessageEnvelope(**row)


def test_unknown_external_contract_blocks_even_safe_status_without_gateway_admission():
    a,g=ready(); v=a.project(envelope(),now=NOW).to_dict()
    assert v['status']=='OPEN_DECISION' and v['allowed'] is False
    assert v['delivery']=='NOT_EXECUTED' and v['gateway_admission']=='NOT_EXECUTED'
    assert v['authority']=='UNVERIFIED_DECLARED_TRACE' and v['observed_status'] is None
    assert v['console_link']=='/sessions/session' and v['io_count']==0
    assert v['open_decisions']==['API_CHANNEL','AUTH_WEBHOOK_SIGNATURE_TOKEN','ACTOR_MAPPING','RATE_QUOTA','MESSAGE_POLICY','OPERATING_ACCOUNT']
    assert g.audit().to_dict()['total']==0


def test_inbound_outbound_use_same_transport_neutral_trace_but_no_delivery():
    a,g=ready(); e=envelope(command='RESULT')
    v=a.project(e,now=NOW,direction='OUTBOUND').to_dict()
    assert v['direction']=='OUTBOUND' and v['trace']['target_hash']==H
    assert v['trace']['task_id']=='task1' and v['payload_ref']['artifact_id']=='input'
    assert v['receipt_ref'] is None and v['automatic_acceptance'] is False
    assert g.audit().to_dict()['total']==0


def test_no_payload_authority_or_transport_enable_switch():
    a,g=ready()
    with pytest.raises(TypeError):a.project(envelope(),now=NOW,api_verified=True)
    with pytest.raises(ValueError,match='ENVELOPE_REQUIRED'):a.project({'verified':True},now=NOW)
    assert a.audit().to_dict()['total']==0


@pytest.mark.parametrize('field,value,code',[
    ('channel','SNS','TRANSPORT_INVALID'),('attempt',2,'ATTEMPT_INVALID'),
    ('privacy','PUBLIC','PRIVACY_DENIED'),('target_hash','bad','HASH'),
    ('session_id','../session','IDENTIFIER'),('retention_seconds',1,'RETENTION'),
    ('expires_at',NOW,'WINDOW')])
def test_invalid_envelope_fails_without_receipt(field,value,code):
    a,g=ready()
    with pytest.raises(ValueError,match=code):a.project(envelope(**{field:value}),now=NOW)
    assert a.audit().to_dict()['total']==0 and g.audit().to_dict()['total']==0
