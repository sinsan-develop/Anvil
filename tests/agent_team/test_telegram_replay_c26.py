from datetime import timedelta
import pytest
from tests.agent_team.test_telegram_contracts_c26 import ready,process,update,NOW


def test_update_id_rebind_nonce_and_idempotency_are_not_bypassed():
    a,b,g,*_=ready();first=process(a,b)
    assert process(a,b,command='status').payload_json==first.payload_json
    with pytest.raises(ValueError,match='UPDATE_REBIND'):process(a,b,command='/pause')
    with pytest.raises(ValueError,match='REPLAY_NONCE'):process(a,b,update_id=101,idempotency_key='other')
    with pytest.raises(ValueError,match='IDEMPOTENCY_CONFLICT'):process(a,b,update_id=101,nonce='other')
    assert g.audit().to_dict()['total']==1 and a.audit().to_dict()['total']==1


def test_rate_limit_is_owned_by_gateway_and_denial_does_not_publish_adapter_receipt():
    a,b,g,*_=ready(rate_limit=1);process(a,b)
    with pytest.raises(ValueError,match='RATE_LIMITED'):process(a,b,update_id=101,nonce='n2',idempotency_key='i2')
    result=a.process(update(update_id=101,nonce='n2',idempotency_key='i2'),binding=b,execution_fence='exec1',now=NOW+timedelta(seconds=60))
    assert result.to_dict()['delivery']=='NOT_EXECUTED' and a.audit().to_dict()['total']==2


def test_100_concurrent_duplicate_updates_publish_once():
    from concurrent.futures import ThreadPoolExecutor
    a,b,g,*_=ready()
    with ThreadPoolExecutor(max_workers=8) as pool:values=list(pool.map(lambda _:process(a,b),range(100)))
    assert len({v.content_hash for v in values})==1
    assert a.audit().to_dict()['total']==g.audit().to_dict()['total']==1


def test_fresh_adapter_cannot_change_pause_to_resume_through_same_gateway_admission():
    from packages.agent_team.telegram_adapter import TelegramGatewayAdapter
    from tests.agent_team.test_telegram_contracts_c26 import H
    a,b,g,i,t,*_=ready();process(a,b,command='/pause')
    other=TelegramGatewayAdapter(g,team=t)
    other_binding=other.capture_binding('binding',identity=i,chat_hash=H,user_hash=H,device_id='device1',
        auth_observation_hash=H,now=NOW,expires_at=NOW+timedelta(minutes=2))
    with pytest.raises(ValueError,match='IDEMPOTENCY_CONFLICT'):process(other,other_binding,command='/resume')
    assert other.audit().to_dict()['total']==0 and g.audit().to_dict()['total']==1


def test_publication_failure_recovers_existing_c25_admission_without_second_spend(monkeypatch):
    from packages.agent_team import telegram_adapter as mod
    a,b,g,*_=ready(rate_limit=1);original=mod._gateway_value
    def fail(kind,key,data):
        if kind=='TELEGRAM_RECEIPT':raise RuntimeError('synthetic local projection fault')
        return original(kind,key,data)
    monkeypatch.setattr(mod,'_gateway_value',fail)
    with pytest.raises(RuntimeError):process(a,b)
    assert a.audit().to_dict()['total']==0 and g.audit().to_dict()['total']==1
    monkeypatch.setattr(mod,'_gateway_value',original)
    assert process(a,b).to_dict()['status']=='STATUS_REQUESTED'
    assert a.audit().to_dict()['total']==1 and g.audit().to_dict()['total']==1
