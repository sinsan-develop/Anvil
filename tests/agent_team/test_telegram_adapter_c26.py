from datetime import timedelta
import pytest
from tests.agent_team.test_telegram_contracts_c26 import ready,process,update,NOW


@pytest.mark.parametrize('command,intent',[('/pause','PAUSE'),('/resume','RESUME')])
def test_low_risk_controls_only_request_console_confirmation(command,intent):
    a,b,g,i,team,*_=ready();before=team.project().payload
    v=process(a,b,command=command).to_dict()
    assert v['status']=='REQUESTED_NOT_APPLIED' and v['requested_control']==intent
    assert v['gateway_command']=='QUESTION' and v['console_link']=='/sessions/session'
    assert team.project().payload==before and v['runner_dispatch']==0


@pytest.mark.parametrize('command',['/deploy','/apply','/delete','/merge','/approve','/change-permissions',
    '/change-provider-credentials','/change-provider','/design-finalize','/secret'])
def test_high_risk_has_no_approval_object_gateway_event_or_runner_mutation(command):
    a,b,g,i,t,*_=ready();before=t.project().payload
    with pytest.raises(ValueError,match='CONSOLE_STEP_UP_REQUIRED'):process(a,b,command=command)
    assert g.audit().to_dict()['total']==0 and a.audit().to_dict()['total']==0 and t.project().payload==before


def test_expired_binding_and_update_are_explicitly_rejected():
    a,b,g,*_=ready()
    with pytest.raises(ValueError,match='BINDING_EXPIRED'):
        a.process(update(),binding=b,execution_fence='exec1',now=NOW+timedelta(minutes=2))
    with pytest.raises(ValueError,match='UPDATE_WINDOW_INVALID'):process(a,b,issued_at=NOW+timedelta(seconds=1))
    assert g.audit().to_dict()['total']==0
