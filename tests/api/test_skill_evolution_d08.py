"""D08 host API adapter only; HTTP 없음."""
import importlib
import pytest
from tests.knowledge.test_skill_evolution_d08 import setup, attest, evaluated, human, AT


def api_type():
    try:
        return importlib.import_module("packages.api.skill_evolution").SkillEvolutionAPI
    except ModuleNotFoundError:
        pytest.fail("D08_API_MISSING")


def test_api_propose_and_query_are_detached_and_do_not_activate():
    api = api_type()
    repo, ctx, data, *_ = setup("CREATE")
    attest(repo, ctx, data)
    response = api(repo, ctx).request("propose", dict(proposal=data), request_id="p", now=AT)
    assert response["status"] == 201 and response["body"]["state"]["status"] == "PENDING"
    response["body"]["candidate"]["after"][0]["body"] = "MUTATED"
    query = api(repo, ctx).request("query", dict(evolution_id="evolution1"), now=AT)
    assert "MUTATED" not in str(query) and not query["body"]["activations"]


@pytest.mark.parametrize("op", ["capture-policy", "capture-human-approval", "capture-pilot", "execute-hook", "execute-script"])
def test_api_does_not_issue_authority_or_execute(op):
    api = api_type()
    repo, ctx, *_ = setup()
    assert api(repo, ctx).request(op, {"secret":"DO_NOT_ECHO"}, now=AT) == dict(status=400,body=dict(reason="INVALID_EVOLUTION_INPUT"))


def test_api_activation_reads_current_host_approval_not_payload():
    api = api_type()
    env = setup("CREATE")
    target = evaluated(env)
    response = api(env[0], env[1]).request("activate", dict(target=target), request_id="a", now=AT)
    assert response["body"]["reason"] == "EVOLUTION_HUMAN_APPROVAL_REQUIRED"
    human(env[0], env[1], target)
    response = api(env[0], env[1]).request("activate", dict(target=target), request_id="a", now=AT)
    assert response["status"] == 200 and response["body"]["status"] == "ACTIVE"


def test_r1_api_cannot_supply_pilot_identity_or_results_in_record_request():
    repo,ctx,data,*_=setup("CREATE")
    target=evaluated((repo,ctx,data))
    response=api_type()(repo,ctx).request("record-pilot",dict(target=target,pilot_id="pilot-0",task_ref="forged",status="PASS"),request_id="p",now=AT)
    assert response==dict(status=400,body=dict(reason="INVALID_EVOLUTION_INPUT"))
