"""D09 authenticated in-memory adapter; HTTP 실행 없음."""
import importlib
import pytest
from tests.knowledge.test_hooks_d09 import setup, capture, register, event, NOW


def api(repo, ctx):
    try:
        return importlib.import_module("packages.api.hooks").HookAPI(repo, ctx)
    except ModuleNotFoundError:
        pytest.fail("D09_HOOK_API_MISSING")


def test_api_candidate_register_query_match_and_fault():
    _, repo, ctx, data, _ = setup(); capture(repo, ctx, data)
    adapter = api(repo, ctx)
    created = adapter.request("candidate", dict(proposal=data), request_id="c", now=NOW)
    assert created["status"] == 201
    registered = adapter.request("register", dict(target=created["body"]["proposal_ref"]), request_id="r", now=NOW)
    assert registered["body"]["executable"] is False
    assert adapter.request("query", dict(proposal_id="proposal1"), now=NOW)["body"]["trust_status"] == "UNTRUSTED"
    assert len(adapter.request("match", dict(event=event()), now=NOW)["body"]["matched"]) == 1
    fault = adapter.request("fault-projection", dict(target=registered["body"]["hook_refs"][0], kind="timeout"), now=NOW)
    assert fault["body"]["decision"] == "deny" and fault["body"]["executed"] is False


@pytest.mark.parametrize("operation", ["execute", "activate", "shadow", "pilot", "capture-results", "capture-observations", "trust"])
def test_api_cannot_issue_authority_or_execute(operation):
    _, repo, ctx, _, _ = setup()
    response = api(repo, ctx).request(operation, {}, now=NOW)
    assert response == dict(status=400, body=dict(reason="INVALID_HOOK_INPUT"))


@pytest.mark.parametrize("claim", ["actor", "trust", "approval", "source", "result", "managed"])
def test_api_rejects_raw_authority_without_value_echo(claim):
    _, repo, ctx, data, _ = setup()
    response = api(repo, ctx).request("candidate", dict(proposal=data, **{claim: "PRIVATE_MARKER"}), request_id="claim", now=NOW)
    assert response["status"] == 400 and "PRIVATE_MARKER" not in str(response)


def test_api_version_and_merge_require_exact_host_issued_result_capture():
    from tests.knowledge.test_hooks_d09 import result_for
    from datetime import timedelta
    _, repo, ctx, data, _ = setup(); registered = register(repo, ctx, data)
    adapter = api(repo, ctx)
    version = adapter.request("version", dict(target=registered["hook_refs"][0]), now=NOW)
    assert version["status"] == 200 and version["body"]["hook_ref"] == registered["hook_refs"][0]
    receipt = repo.match(ctx, event(), now=NOW)
    capture = repo.capture_results(ctx, receipt["content_hash"], result_for(receipt, "deny"), now=NOW, expires_at=NOW + timedelta(minutes=1))
    result = adapter.request("merge", dict(capture_id=capture["capture_id"]), now=NOW)
    assert result["status"] == 200 and result["body"]["decision"] == "deny"
    result["body"]["decision"] = "allow"
    assert adapter.request("merge", dict(capture_id=capture["capture_id"]), now=NOW)["body"]["decision"] == "deny"


def test_r1_api_recursive_replay_is_stable_and_depth_rebind_fails_closed():
    _, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    adapter = api(repo, ctx)
    e = event(); e["depth"] = 1
    first = adapter.request("match", dict(event=e), now=NOW)
    assert first["status"] == 200 and first["body"]["reason"] == "HOOK_RECURSION_BLOCKED"
    assert adapter.request("match", dict(event=e), now=NOW) == first
    e["depth"] = 0
    assert adapter.request("match", dict(event=e), now=NOW) == dict(status=400, body=dict(reason="HOOK_IDEMPOTENCY_CONFLICT"))
