"""D10 in-memory authenticated API; HTTP 미실행."""
import importlib
import pytest
from tests.knowledge.test_hook_runtime_d10 import setup, ready, selection, ev, response, NOW, timedelta


def adapter(runtime, ctx):
    try:
        return importlib.import_module("packages.api.hook_runtime").HookRuntimeAPI(runtime, ctx)
    except ModuleNotFoundError:
        pytest.fail("D10_HOOK_RUNTIME_API_MISSING")


def test_query_and_active_run_projection_have_fake_boundary():
    _, runtime, ctx, target, executor, _, _, _ = setup(); ready(runtime, ctx, target, executor)
    selected = selection(runtime, ctx); api = adapter(runtime, ctx)
    assert api.request("query", dict(target=target), now=NOW)["body"]["status"] == "ACTIVE"
    executor.set_response("api", response())
    result = api.request("run", dict(selection_id=selected["selection_id"], event=ev(runtime, ctx, target, "api"), input={}), now=NOW + timedelta(seconds=1))
    assert result["status"] == 200 and result["body"]["boundary"] == "FAKE_SANDBOX_ONLY"


@pytest.mark.parametrize("op", ["capture_human_trust", "capture_pilot", "capture_run_start", "issue_trust", "execute_os"])
def test_api_cannot_mint_authority_or_call_os(op):
    _, runtime, ctx, _, executor, _, _, _ = setup()
    assert adapter(runtime, ctx).request(op, {}, now=NOW) == dict(status=400, body=dict(reason="INVALID_HOOK_RUNTIME_INPUT"))
    assert executor.calls == []


@pytest.mark.parametrize("claim", ["principal", "trust", "approval", "sandbox_pass", "hash"])
def test_api_rejects_raw_authority_claims(claim):
    _, runtime, ctx, target, executor, _, _, _ = setup()
    result = adapter(runtime, ctx).request("trust", dict(target=target, mode="human", expected_version=1, **{claim:"PRIVATE_MARKER"}), request_id="x", now=NOW)
    assert result["status"] == 400 and "PRIVATE_MARKER" not in str(result) and executor.calls == []
