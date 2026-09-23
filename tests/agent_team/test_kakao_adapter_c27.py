import pytest
from tests.agent_team.test_kakao_contracts_c27 import ready,envelope,NOW


@pytest.mark.parametrize('command,want',[('STATUS',None),('QUESTION',None),('PAUSE','PAUSE'),('RESUME','RESUME')])
def test_low_risk_is_draft_only_not_applied(command,want):
    a,g=ready(); v=a.project(envelope(command=command),now=NOW).to_dict()
    assert v['intent_status']=='DRAFT_NOT_APPLIED' and v['requested_control']==want
    assert not v['allowed'] and v['runner_dispatch']==0 and g.audit().to_dict()['total']==0


@pytest.mark.parametrize('command',['APPROVE','DEPLOY','DELETE','APPLY','MERGE','PROVIDER_CHANGE','SECRET','GRANT','DESIGN_APPROVE'])
def test_high_risk_is_denied_and_requires_console_step_up(command):
    a,g=ready(); v=a.project(envelope(command=command),now=NOW).to_dict()
    assert v['status']=='OPEN_DECISION' and v['intent_status']=='DENIED_HIGH_RISK'
    assert v['reason']=='CONSOLE_STEP_UP_REQUIRED' and not v['allowed']
    assert g.audit().to_dict()['total']==0
