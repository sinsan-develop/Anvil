import importlib
import pytest
from tests.knowledge.test_model_registry_d11 import ready, model_data, NOW


@pytest.fixture
def modules():
    try: return importlib.import_module("packages.knowledge.model_registry"), importlib.import_module("packages.api.model_registry")
    except ModuleNotFoundError: pytest.fail("D11_API_MISSING")


def test_api_authenticated_host_projection_and_capture_consumption(modules):
    m, api = modules; repo, ctx, *_ = ready(m)
    adapter = api.ModelRegistryAPI(repo, ctx)
    assert adapter.request("query", {}, now=NOW)["status"] == 200
    capture = repo.capture_model(ctx, model_data(id="second", model_id="model-b", upstream_model="model-b"), now=NOW)
    result = adapter.request("probe", {"capture_id": capture}, now=NOW)
    assert result["status"] == 200 and result["body"]["data"]["id"] == "second"
    result["body"]["data"]["capabilities"].append("external")
    assert "external" not in str(adapter.request("query", {}, now=NOW)["body"]["models"])


@pytest.mark.parametrize("op,payload", [("capture_model", {}), ("probe", {"status": "AVAILABLE"}), ("activate", {"approved": True}), ("query", {"principal": "human1"}), ("benchmark", {"passed": True})])
def test_api_no_authority_mint_endpoint(modules, op, payload):
    m, api = modules; repo, ctx, *_ = ready(m)
    result = api.ModelRegistryAPI(repo, ctx).request(op, payload, now=NOW)
    assert result == {"status": 400, "body": {"reason": "INVALID_REGISTRY_INPUT"}}


def test_api_unknown_capture_and_fake_context_fail_closed(modules):
    m, api = modules; repo, ctx, *_ = ready(m)
    assert api.ModelRegistryAPI(repo, ctx).request("snapshot", {"capture_id": "fake"}, now=NOW)["body"]["reason"] == "HOST_CAPTURE_REQUIRED"
    assert api.ModelRegistryAPI(repo, object()).request("query", {}, now=NOW)["status"] == 400


def test_r2_api_does_not_publish_corrupted_host_capture(modules):
    m, api = modules; repo, ctx, *_ = ready(m)
    capture = repo.capture_model(ctx, model_data(version=2), now=NOW)
    repo._state["captures"][capture]["data"]["region"] = "modified-region"
    result = api.ModelRegistryAPI(repo, ctx).request("snapshot", {"capture_id": capture}, now=NOW)
    assert result == {"status": 400, "body": {"reason": "HOST_CAPTURE_INTEGRITY_MISMATCH"}}
    assert len(repo.query(ctx, now=NOW)["models"]) == 1
