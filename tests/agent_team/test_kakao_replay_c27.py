from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import pytest
from tests.agent_team.test_kakao_contracts_c27 import ready,envelope,NOW


def test_exact_replay_is_same_blocked_receipt_and_never_dispatches():
    a,g=ready()
    with ThreadPoolExecutor(max_workers=8) as pool:
        hashes=list(pool.map(lambda _:a.project(envelope(),now=NOW).content_hash,range(100)))
    assert len(set(hashes))==1 and a.audit().to_dict()['total']==1
    assert g.audit().to_dict()['total']==0


@pytest.mark.parametrize('changes,code',[
    ({'command':'PAUSE'},'IDEMPOTENCY_CONFLICT'),
    ({'idempotency_key':'other'},'REPLAY_NONCE'),
    ({'idempotency_key':'other','replay_nonce':'other'},'MESSAGE_REBIND')])
def test_rebind_and_nonce_reuse_do_not_publish(changes,code):
    a,g=ready();a.project(envelope(),now=NOW)
    with pytest.raises(ValueError,match=code):a.project(envelope(**changes),now=NOW)
    assert a.audit().to_dict()['total']==1


def test_local_draft_limit_is_not_kakao_quota_and_replay_spends_nothing():
    a,g=ready(draft_limit=1);a.project(envelope(),now=NOW);a.project(envelope(),now=NOW)
    with pytest.raises(ValueError,match='LOCAL_DRAFT_RATE_LIMIT'):
        a.project(envelope(message_id='two',idempotency_key='two',replay_nonce='two'),now=NOW)
    assert a.audit().to_dict()['total']==1 and g.audit().to_dict()['total']==0


def test_expired_replay_and_foreign_receipt_deny():
    a,g=ready();r=a.project(envelope(),now=NOW)
    with pytest.raises(ValueError,match='WINDOW'):a.project(envelope(),now=NOW+timedelta(seconds=120))
    other,_=ready()
    with pytest.raises(ValueError,match='RECEIPT_INVALID'):other.receipt(r,now=NOW)
    assert a.receipt(r,now=NOW).content_hash==r.content_hash


def test_projection_failure_has_no_partial_receipt_rate_nonce_or_audit(monkeypatch):
    from packages.agent_team import kakao_adapter as mod
    a,g=ready(draft_limit=1);original=mod._value
    def fail(kind,key,data):
        if kind=='KAKAO_CONTRACT_RECEIPT':raise RuntimeError('injected')
        return original(kind,key,data)
    monkeypatch.setattr(mod,'_value',fail)
    with pytest.raises(RuntimeError,match='injected'):a.project(envelope(),now=NOW)
    assert a.audit().to_dict()['total']==0 and g.audit().to_dict()['total']==0
    monkeypatch.setattr(mod,'_value',original)
    assert a.project(envelope(),now=NOW).to_dict()['status']=='OPEN_DECISION'
    assert a.audit().to_dict()['total']==1


def test_direction_and_actor_cannot_reuse_inbound_idempotency():
    a,g=ready();a.project(envelope(),now=NOW)
    with pytest.raises(ValueError,match='IDEMPOTENCY_CONFLICT'):a.project(envelope(),now=NOW,direction='OUTBOUND')
    with pytest.raises(ValueError,match='IDEMPOTENCY_CONFLICT'):a.project(envelope(internal_user='foreign'),now=NOW)
    assert a.audit().to_dict()['total']==1


def test_local_rate_window_expires_but_external_quota_remains_unknown():
    a,g=ready(draft_limit=1)
    a.project(envelope(),now=NOW)
    later=NOW+timedelta(seconds=60)
    v=a.project(envelope(message_id='m2',idempotency_key='i2',replay_nonce='n2'),now=later).to_dict()
    assert v['status']=='OPEN_DECISION' and 'RATE_QUOTA' in v['open_decisions']
    assert v['local_rate_contract']=='HOST_DRAFT_ONLY_NOT_PROVIDER_QUOTA'
    assert g.audit().to_dict()['total']==0
