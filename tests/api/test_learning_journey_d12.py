import importlib
import pytest
from tests.knowledge.test_learning_journey_d12 import setup, AT


@pytest.fixture
def env():
    try:
        m = importlib.import_module("packages.knowledge.learning_journey")
        api = importlib.import_module("packages.api.learning_journey")
    except ModuleNotFoundError: pytest.fail("D12_API_MISSING")
    journey, ctx, _, _ = setup(m)
    return api.LearningJourneyAPI(journey, ctx)


def test_api_read_projection(env):
    result = env.request("query", {}, now=AT)
    assert result["status"] == 200 and result["body"]["nodes"]
    result["body"]["nodes"].clear()
    assert env.request("query", {}, now=AT)["body"]["nodes"]


@pytest.mark.parametrize("operation", ["capture", "capture_replay_evidence", "approve", "activate", "rollback", "create", "run", "export", "import"])
def test_api_has_no_mutation_or_authority_endpoint(env, operation):
    assert env.request(operation, {}, now=AT) == {"status":400,"body":{"reason":"INVALID_JOURNEY_INPUT"}}


def test_api_rejects_self_attested_status_and_foreign_context(env):
    assert env.request("query", {"status":"ACTIVE"}, now=AT)["status"] == 400
    env.context = object()
    assert env.request("query", {}, now=AT)["body"]["reason"] == "JOURNEY_AUTHORITY_MISMATCH"


def test_api_all_read_routes_and_value_safe_errors(env):
    page=env.request("list",dict(limit=2,cursor=None),now=AT)["body"]
    target=dict(node_id=page["items"][0]["node_id"],snapshot_hash=page["snapshot_hash"])
    for operation in ("detail","lineage"):
        assert env.request(operation,target,now=AT)["status"]==200
    assert env.request("menu-projection",dict(name="Learning Journey",snapshot_hash=page["snapshot_hash"]),now=AT)["status"]==200
    for operation,payload in (("skill-explanation",dict(invocation_id="token=FAKE_TEST_ONLY")),("hook-replay",dict(receipt_hash="token=FAKE_TEST_ONLY"))):
        result=env.request(operation,payload,now=AT)
        assert result["status"]==400 and "FAKE_TEST_ONLY" not in str(result)


@pytest.mark.parametrize("kind",["recursion","fallback"])
def test_r3_api_packetless_detail_only_exposes_verified_receipt_metadata(kind):
    from tests.knowledge.test_learning_journey_d12 import packetless_env
    m=importlib.import_module("packages.knowledge.learning_journey")
    journey,ctx,_,executor,receipt,instant=packetless_env(m,kind)
    api=importlib.import_module("packages.api.learning_journey").LearningJourneyAPI(journey,ctx)
    view=api.request("query",{},now=instant)["body"]
    target=dict(node_id="HOOK_RECEIPT:"+receipt["content_hash"],snapshot_hash=view["content_hash"])
    result=api.request("detail",target,now=instant)
    assert result["status"]==200 and result["body"]["stored_receipt"]["decision"]=="deny"
    assert "PRIVATE_INPUT_MARKER" not in str(result)
    result["body"]["stored_receipt"]["decision"]="allow"
    assert api.request("detail",target,now=instant)["body"]["stored_receipt"]["decision"]=="deny"
    assert api.request("detail",dict(target,decision="allow"),now=instant)["status"]==400
    assert api.request("hook-replay",dict(receipt_hash=receipt["content_hash"]),now=instant)["body"]["reason"]=="JOURNEY_MISSING_EVIDENCE"
    assert not executor.calls
