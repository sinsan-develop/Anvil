import pytest
from tests.agent_team.test_gateway_contracts_c25 import ready,envelope,receive,NOW,H


@pytest.mark.parametrize('changes',[
    {'privacy':'PUBLIC'}, {'retention_seconds':3601},
    {'payload_ref':{'artifact_id':'question','sha256':H,'privacy':'PUBLIC'}},
    {'payload_ref':{'artifact_id':'question','sha256':H,'privacy':'PRIVATE','body':'private content'}},
    {'correlation_id':'user@example.test'}, {'correlation_id':'token=FAKE_TEST_ONLY'}])
def test_sensitive_metadata_and_privacy_expansion_never_enter_projection(changes):
    m,g,i,*_=ready()
    with pytest.raises(ValueError):receive(g,i,envelope(m,**changes))
    assert g.audit().to_dict()['events']==[]


def test_paged_audit_has_stable_sequence_no_external_identity_and_no_alias():
    m,g,i,*_=ready(rate_limit=100)
    for n in range(70):receive(g,i,envelope(m,message_id='m'+str(n),idempotency_key='i'+str(n),replay_nonce='n'+str(n)))
    first=g.audit(offset=0,limit=50);second=g.audit(offset=50,limit=50)
    assert [e['sequence'] for e in first.to_dict()['events']]==list(range(1,51))
    assert [e['sequence'] for e in second.to_dict()['events']]==list(range(51,71))
    assert first.to_dict()['next_offset']==50 and second.to_dict()['next_offset'] is None
    object.__setattr__(first,'payload_json','{}')
    assert len(g.audit().to_dict()['events'])==50


@pytest.mark.parametrize('value',['Authorization: Basic RkFLRV9PTkxZ','ｔｏｋｅｎ=FAKE_TEST_ONLY','api%20key=FAKE_TEST_ONLY'])
def test_encoded_secret_metadata_never_enters_audit_or_error(value):
    m,g,i,*_=ready()
    with pytest.raises(ValueError) as error:receive(g,i,envelope(m,correlation_id=value))
    assert value not in str(error.value) and 'FAKE_TEST_ONLY' not in str(error.value)
    assert g.audit().to_dict()['total']==0


@pytest.mark.parametrize('changes',[{'attempt':True},{'retention_seconds':False},{'retention_seconds':1},
    {'payload_ref':{'artifact_id':'../escape','sha256':H,'privacy':'PRIVATE'}},
    {'correlation_id':'x'*10000}])
def test_bounds_attempt_and_reference_paths_fail_closed(changes):
    m,g,i,*_=ready()
    with pytest.raises(ValueError):receive(g,i,envelope(m,**changes))
    assert g.audit().to_dict()['total']==0
