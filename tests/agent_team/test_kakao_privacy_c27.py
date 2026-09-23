from datetime import datetime,tzinfo,timedelta
import pytest
from tests.agent_team.test_kakao_contracts_c27 import ready,envelope,NOW,H


@pytest.mark.parametrize('value',['token=FAKE_TEST_ONLY','Authorization: Basic FAKE','https://secret.local/token','사용자@email.test','../path'])
def test_raw_private_metadata_rejected_without_echo(value):
    a,g=ready()
    with pytest.raises(ValueError) as ex:a.project(envelope(correlation_id=value),now=NOW)
    assert value not in str(ex.value) and a.audit().to_dict()['total']==0


def test_hostile_scalar_and_timezone_callbacks_zero():
    a,g=ready(); calls=[]
    class Evil:
        def __deepcopy__(self,*args):calls.append('copy');return H
        def __str__(self):calls.append('str');return H
    with pytest.raises(ValueError):a.project(envelope(target_hash=Evil()),now=NOW)
    class Zone(tzinfo):
        def utcoffset(self,dt):calls.append('zone');return timedelta(0)
    with pytest.raises(ValueError):a.project(envelope(),now=datetime(2026,9,18,tzinfo=Zone()))
    assert calls==[]


def test_mutating_input_output_does_not_change_receipt_or_audit():
    a,g=ready(); e=envelope(); r=a.project(e,now=NOW); before=r.to_dict()
    e.payload_ref['artifact_id']='changed'; object.__setattr__(r,'payload_json','{}')
    same=a.project(envelope(),now=NOW)
    assert same.to_dict()==before
    audit=a.audit(); object.__setattr__(audit,'payload_json','{}')
    assert a.audit().to_dict()['total']==1
    assert 'actor1' not in a.audit().payload_json and 'input' not in a.audit().payload_json


def test_foreign_property_handle_and_container_subclasses_never_execute_callbacks():
    a,g=ready();calls=[]
    class Handle:
        @property
        def content_hash(self):calls.append('property');return H
    class Mapping(dict):
        def items(self):calls.append('items');return super().items()
    with pytest.raises(ValueError,match='RECEIPT_INVALID'):a.receipt(Handle(),now=NOW)
    with pytest.raises(ValueError):a.project(envelope(payload_ref=Mapping(artifact_id='input',sha256=H,privacy='PRIVATE')),now=NOW)
    assert calls==[] and a.audit().to_dict()['total']==0


@pytest.mark.parametrize('field,value', [('direction',[]),('limit',True),('offset',-1)])
def test_public_projection_bounds_fail_closed(field,value):
    a,g=ready()
    with pytest.raises(ValueError):
        if field=='direction':a.project(envelope(),now=NOW,direction=value)
        else:a.audit(**{field:value})


def test_audit_pages_preserve_sequence_without_raw_trace():
    a,g=ready(draft_limit=100)
    for n in range(70):
        a.project(envelope(message_id=f'm{n}',idempotency_key=f'i{n}',replay_nonce=f'n{n}'),now=NOW)
    first=a.audit().to_dict();second=a.audit(offset=first['next_offset']).to_dict()
    assert first['total']==70 and first['next_offset']==50 and second['next_offset'] is None
    assert [e['sequence'] for e in first['events']+second['events']]==list(range(1,71))
