import importlib
import importlib.util
import pytest
from tests.agent_team.test_gateway_contracts_c25 import ready,envelope,NOW,H,claim,complete


def test_daon_question_and_verified_result_ref_no_network_or_approval():
    m,g,i,t,p,results,tasks=ready()
    assert importlib.util.find_spec('packages.agent_team.daon_user_api'),'C25 Daon boundary missing'
    api=importlib.import_module('packages.agent_team.daon_user_api').DaonUserAPI(g)
    q=api.question(envelope(m,channel='DAON_USER'),identity=i,execution_fence='exec1',now=NOW)
    with pytest.raises(ValueError,match='VERIFIED_RESULT_REQUIRED'):
        api.answer(q,identity=i,execution_fence='exec1',payload_ref={'artifact_id':'answer','sha256':H,'privacy':'PRIVATE'},now=NOW)
    claim(t,tasks[0]);complete(t,results,tasks[0])
    a=api.answer(q,identity=i,execution_fence='exec1',payload_ref={'artifact_id':'answer','sha256':H,'privacy':'PRIVATE'},now=NOW)
    v=a.to_dict()
    assert v['direction']=='OUTBOUND' and v['delivery']=='NOT_EXECUTED'
    assert v['inbound_hash']==q.content_hash and v['source_result_hash']==t.project().to_dict()['tasks']['task1']['result_hash']
    assert v['io_count']==0 and not v['automatic_acceptance']
    assert api.answer(q,identity=i,execution_fence='exec1',payload_ref={'artifact_id':'answer','sha256':H,'privacy':'PRIVATE'},now=NOW).payload_json==a.payload_json


def test_daon_cannot_accept_foreign_transport_or_mint_high_risk_authority():
    m,g,i,*_=ready()
    assert importlib.util.find_spec('packages.agent_team.daon_user_api'),'C25 Daon boundary missing'
    api=importlib.import_module('packages.agent_team.daon_user_api').DaonUserAPI(g)
    with pytest.raises(ValueError,match='DAON_QUESTION_REQUIRED'):api.question(envelope(m),identity=i,execution_fence='exec1',now=NOW)


def test_dead_letter_question_cannot_be_resurrected_into_outbound_answer():
    m,g,i,t,p,results,tasks=ready()
    api=importlib.import_module('packages.agent_team.daon_user_api').DaonUserAPI(g)
    q=api.question(envelope(m,channel='DAON_USER'),identity=i,execution_fence='exec1',now=NOW)
    g.retry(q,identity=i,execution_fence='exec1',request_id='failed',failure_code='PERMANENT_FAILURE',now=NOW)
    claim(t,tasks[0]);complete(t,results,tasks[0])
    with pytest.raises(ValueError,match='TERMINAL_RECEIPT'):
        api.answer(q,identity=i,execution_fence='exec1',payload_ref={'artifact_id':'answer','sha256':H,'privacy':'PRIVATE'},now=NOW)
    assert g.audit().to_dict()['total']==2
