"""D-07 API adapter projection; 실제 HTTP 호출 없음."""
import importlib
import pytest
from packages.knowledge.memory import to_primitive
from tests.knowledge.test_skills_d07 import setup, AT


def api_module():
    try:
        return importlib.import_module("packages.api.skills")
    except ModuleNotFoundError:
        pytest.fail("D07_SKILL_API_MISSING")


def test_api_progressive_load_uses_authenticated_context():
    api_type = api_module().SkillsAPI
    repo, ctx, sr, ref, data, *_ = setup()
    api = api_type(repo, ctx)
    result = api.request("catalog", dict(selection_ref=sr, scope=data["scope"]), now=AT)
    assert result["status"] == 200 and len(result["body"]["items"]) == 1
    assert "L1_ONLY" not in str(result) and "L2_ONLY" not in str(result)
    selected = api.request("select", dict(selection_ref=sr, skill_ref=to_primitive(ref), task="retry", mode="explicit"), request_id="s", now=AT)
    assert selected["status"] == 200
    ir = {k: selected["body"][k] for k in ("invocation_id", "content_hash")}
    l1 = api.request("load-l1", dict(invocation_ref=ir), now=AT)
    assert l1["body"]["body"] == data["body"]
    l2 = api.request("load-l2", dict(invocation_ref=ir, **data["resources"][0]), now=AT)
    assert l2["body"]["content"] == "L2_ONLY_REFERENCE_CONTENT"
    result = api.request("record-use", dict(invocation_ref=ir, outcome="SUCCESS", evidence_ref="e"), request_id="u", now=AT)
    assert result["body"]["run_id"] == "next-run"


@pytest.mark.parametrize("operation", ["capture-materialization", "create", "activate", "approve", "execute", "evolve"])
def test_api_never_exposes_materialization_or_execution_authority(operation):
    api_type = api_module().SkillsAPI
    repo, ctx, *_ = setup()
    response = api_type(repo, ctx).request(operation, {"body": "DO_NOT_ECHO"}, now=AT)
    assert response == dict(status=400, body=dict(reason="INVALID_SKILL_INPUT"))
    assert not repo._candidates._uses


def test_api_payload_cannot_replace_context_or_grant_approval():
    api_type = api_module().SkillsAPI
    repo, ctx, sr, ref, *_ = setup()
    result = api_type(repo, ctx).request("select", dict(selection_ref=sr, skill_ref=to_primitive(ref), task="retry", mode="implicit", approved=True, context="foreign"), request_id="x", now=AT)
    assert result == dict(status=400, body=dict(reason="INVALID_SKILL_INPUT"))


def test_api_adapter_reconnect_uses_same_pinned_version_not_latest_alias():
    api_type = api_module().SkillsAPI
    repo, ctx, sr, ref, data, *_ = setup()
    first = api_type(repo, ctx).request("catalog", dict(selection_ref=sr, scope=data["scope"]), now=AT)
    second = api_type(repo, ctx).request("catalog", dict(selection_ref=sr, scope=data["scope"]), now=AT)
    assert first == second and second["body"]["items"][0]["skill_ref"] == ref
    assert not repo.audit(ctx, sr, now=AT)["events"]


def test_api_foreign_context_and_malformed_payload_do_not_echo_raw_values():
    api_type = api_module().SkillsAPI
    repo, ctx, sr, ref, data, *_ = setup()
    response = api_type(repo, object()).request("catalog", dict(selection_ref=sr, scope=data["scope"]), now=AT)
    assert response["status"] in (400, 403) and set(response["body"]) == {"reason"}
    for payload in (None, [], "FAKE_TEST_ONLY", {"selection_ref": sr, "scope": data["scope"], "approval": "FAKE_TEST_ONLY"}):
        response = api_type(repo, ctx).request("catalog", payload, now=AT)
        assert response == dict(status=400, body=dict(reason="INVALID_SKILL_INPUT"))


def test_r1_api_cannot_claim_implicit_approval_from_boolean_or_metadata():
    repo, ctx, sr, ref, data, *_ = setup(risk={"implicit_trigger": True})
    api = api_module().SkillsAPI(repo, ctx)
    matched = api.request("match", dict(selection_ref=sr, scope=data["scope"], task="retry", limit=5), now=AT)
    assert matched["status"] == 200 and not matched["body"]["items"]
    selected = api.request("select", dict(selection_ref=sr, skill_ref=to_primitive(ref), task="retry", mode="implicit"), request_id="s", now=AT)
    assert selected == dict(status=400, body=dict(reason="IMPLICIT_SKILL_DENIED"))
    assert not repo.audit(ctx, sr, now=AT)["events"]
