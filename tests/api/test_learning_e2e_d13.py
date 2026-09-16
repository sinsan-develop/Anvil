import importlib
import pytest
from tests.knowledge.test_learning_e2e_d13 import setup,NOW


@pytest.fixture
def api():
    try:
        m=importlib.import_module("packages.knowledge.learning_e2e")
        a=importlib.import_module("packages.api.learning_e2e")
    except ModuleNotFoundError: pytest.fail("D13_API_MISSING")
    h,ctx,*_=setup(m)
    return a.LearningE2EAPI(h,ctx)


def test_execute_and_query_are_value_safe(api):
    value=api.request("execute",dict(scenario_id="scenario",stage="propose"),now=NOW)
    assert value["status"]==200
    value["body"]["status"]="ACTIVE"
    assert api.request("query",dict(scenario_id="scenario"),now=NOW)["body"]["status"]=="PROPOSED"


@pytest.mark.parametrize("operation",["capture","capture_gate_verification","capture_human_decision","source-state","approve","dir-hold",
                                      "capture_terminal_evidence","capture_owner_selection"])
def test_payload_cannot_mint_host_authority(api,operation):
    result=api.request(operation,dict(scenario_id="scenario",approval=True,severity="CRITICAL"),now=NOW)
    assert result["status"]==400


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r3_api_pending_owner_receipt_cannot_claim_applied_or_finish(kind):
    from datetime import timedelta
    from tests.knowledge.test_learning_e2e_d13 import next_task
    m=importlib.import_module("packages.knowledge.learning_e2e")
    env=setup(m,kind); h,ctx,*_=env; next_task(env)
    api=importlib.import_module("packages.api.learning_e2e").LearningE2EAPI(h,ctx)
    now=NOW+timedelta(seconds=2)
    value=api.request("query",dict(scenario_id="scenario"),now=now)
    assert value["body"]["status"]=="PENDING_OWNER_EVIDENCE" and value["body"]["uses"]==[]
    for stage in ("load-references","revoke","rollback","no-change"):
        result=api.request("execute",dict(scenario_id="scenario",stage=stage),now=now)
        assert result==dict(status=400,body=dict(reason="E2E_OWNER_EVIDENCE_REQUIRED"))
