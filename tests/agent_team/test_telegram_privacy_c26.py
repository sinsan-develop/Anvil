import pytest
from tests.agent_team.test_telegram_contracts_c26 import ready,process,update,NOW


@pytest.mark.parametrize('changes',[
    {'text':'private raw message'}, {'bot_token':'FAKE_TEST_ONLY'}, {'device_id':'user@example.test'},
    {'command':'/status token=FAKE_TEST_ONLY'}, {'command':'/status\nAuthorization: Basic RkFLRQ=='},
    {'session_id':'../escape'}, {'device_id':'%2e%2e%2fadmin'}])
def test_raw_payload_secret_and_link_injection_never_enter_audit(changes):
    a,b,g,*_=ready()
    with pytest.raises(ValueError) as error:process(a,b,**changes)
    assert 'FAKE_TEST_ONLY' not in str(error.value) and 'private raw message' not in str(error.value)
    assert g.audit().to_dict()['total']==0 and a.audit().to_dict()['total']==0


def test_callback_zero_nested_alias_and_receipt_mutation_do_not_corrupt_state():
    a,b,g,*_=ready();calls=[]
    class Hostile:
        def __str__(self):calls.append(1);return '/status'
        def __deepcopy__(self,memo):calls.append(1);return '/status'
    with pytest.raises(ValueError):process(a,b,command=Hostile())
    assert calls==[]
    value=update();receipt=a.process(value,binding=b,execution_fence='exec1',now=NOW);old=receipt.payload_json
    value['payload_ref']['artifact_id']='tampered'
    object.__setattr__(receipt,'payload_json','{}')
    assert process(a,b).payload_json==old and a.audit().to_dict()['total']==1


@pytest.mark.parametrize('changes',[{'update_id':True},{'update_id':-1},{'update_id':2**53},
    {'retention_seconds':False},{'retention_seconds':1},{'command':'/status@unapprovedbot'},
    {'payload_ref':{'artifact_id':'../file','sha256':'sha256:'+'a'*64,'privacy':'PRIVATE'}},
    {'command':'/'+'a'*10000}])
def test_malformed_bounds_and_nested_refs_never_spend_gateway_rate(changes):
    a,b,g,*_=ready()
    with pytest.raises(ValueError):process(a,b,**changes)
    assert a.audit().to_dict()['total']==g.audit().to_dict()['total']==0


def test_mutable_timezone_callback_zero():
    from datetime import datetime,timedelta,tzinfo
    a,b,g,*_=ready();calls=[]
    class Mutable(tzinfo):
        def utcoffset(self,dt):calls.append(1);return timedelta(0)
    with pytest.raises(ValueError):process(a,b,issued_at=datetime(2026,9,18,9,tzinfo=Mutable()))
    assert calls==[] and g.audit().to_dict()['total']==0


def test_paged_receipts_do_not_expose_chat_or_user_hashes_or_alias():
    a,b,g,*_=ready(rate_limit=100)
    for n in range(70):process(a,b,update_id=n,nonce='n'+str(n),idempotency_key='i'+str(n))
    first=a.audit();second=a.audit(offset=50)
    assert [x['sequence'] for x in first.to_dict()['events']]==list(range(1,51))
    assert [x['sequence'] for x in second.to_dict()['events']]==list(range(51,71))
    assert all('user_hash' not in e and 'chat_hash' not in e for e in first.to_dict()['events'])
    object.__setattr__(first,'payload_json','{}')
    assert len(a.audit().to_dict()['events'])==50
