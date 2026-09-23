"""D-04 API 권위·민감정보·metadata projection 계약."""
import importlib
import pytest
from tests.knowledge.test_patterns_d04 import NOW, setup, payload, evidence, attest, reference_chain


@pytest.fixture
def bundle():
    p = importlib.import_module("packages.knowledge.patterns")
    repo, _, context, state = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state))
    api = importlib.import_module("packages.api.knowledge_patterns").KnowledgePatternsAPI(repo, context)
    return api, data


def test_api_extract_search_get_are_detached(bundle):
    api, data = bundle
    result = api.request("extract", {**data, "expected_version": 0}, request_id="extract", now=NOW)
    assert result["status"] == 201
    result["body"]["details"]["procedure"].append("tamper")
    fetched = api.request("get", {"artifact_id": "artifact1", "version": 1}, now=NOW)
    assert "tamper" not in str(fetched)
    found = api.request("search", {"intent": "retry"}, now=NOW)
    assert found["status"] == 200 and len(found["body"]) == 1
    assert "procedure" not in str(found) and "locator" not in str(found)


@pytest.mark.parametrize("extra", [{"actor": "self"}, {"source_status": "REGISTERED"}, {"quality": "VERIFIED"},
                                   {"evidence": {"gates": "PASS"}}, {"scope": "user"}, {"license_ref": "MIT"}, {"body": "token=FAKE_TEST_ONLY"}])
def test_api_rejects_authority_and_body_injection_without_storage(bundle, extra):
    api, data = bundle
    result = api.request("extract", {**data, **extra, "expected_version": 0}, request_id="retry", now=NOW)
    assert result["status"] == 400 and "FAKE_TEST_ONLY" not in str(result)
    assert api.request("search", {}, now=NOW)["body"] == []


def test_api_missing_attestation_and_sensitive_metadata_fail_closed(bundle):
    api, data = bundle
    altered = {**data, "artifact_id": "other", "expected_version": 0}
    assert api.request("extract", altered, request_id="retry", now=NOW)["body"]["reason"] == "PATTERN_ATTESTATION_REQUIRED"
    data["details"]["intent"] = "api key=FAKE_TEST_ONLY"
    result = api.request("extract", {**data, "expected_version": 0}, request_id="retry", now=NOW)
    assert result["status"] == 400 and result["body"]["reason"] == "SECRET_LIKE_INPUT"


def test_api_explicit_load_reference_and_revoke_are_checked():
    p = importlib.import_module("packages.knowledge.patterns")
    repo, sources, context, state = setup(p)
    pattern, reference = reference_chain(repo, context, state)
    api = importlib.import_module("packages.api.knowledge_patterns").KnowledgePatternsAPI(repo, context)
    request = dict(pattern_ref=dict(artifact_id=pattern.artifact_id, version=1, record_hash=pattern.record_hash),
                   reference_ref=dict(artifact_id=reference.artifact_id, version=1, record_hash=reference.record_hash))
    loaded = api.request("load-reference", request, now=NOW)
    assert loaded["status"] == 200 and loaded["body"]["details"]["selector"]["path"] == "src/main.py"
    loaded["body"]["details"]["selector"]["path"] = "tamper"
    assert api.request("load-reference", request, now=NOW)["body"]["details"]["selector"]["path"] == "src/main.py"
    sources.transition(context, "s1", "REVOKED", "DELETED", expected_version=1, request_id="revoke", now=NOW)
    assert api.request("load-reference", request, now=NOW) == {"status": 409, "body": {"reason": "LEARNING_SOURCE_REVOKED"}}


@pytest.mark.parametrize("bad", [None, [], {"body": "api key=FAKE_TEST_ONLY"}, {"source_status": "ACTIVE"}])
def test_malformed_search_never_discloses_values(bundle, bad):
    api, _ = bundle
    result = api.request("search", bad, now=NOW)
    assert result["status"] == 400 and "FAKE_TEST_ONLY" not in str(result)


def test_r1_api_unrelated_pass_cannot_substitute_required_evidence():
    p = importlib.import_module("packages.knowledge.patterns")
    repo, _, context, state = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state, tests={"unrelated-smoke": "PASS"}))
    api = importlib.import_module("packages.api.knowledge_patterns").KnowledgePatternsAPI(repo, context)
    result = api.request("extract", {**data, "expected_version": 0}, request_id="r1", now=NOW)
    assert result == {"status": 400, "body": {"reason": "POSITIVE_EVIDENCE_REQUIRED"}}
    assert api.request("search", {}, now=NOW)["body"] == []


def test_r1_api_load_reference_does_not_disclose_sibling_locator():
    p = importlib.import_module("packages.knowledge.patterns")
    repo, _, context, state = setup(p, multi_locator=True)
    pattern, reference = reference_chain(repo, context, state)
    api = importlib.import_module("packages.api.knowledge_patterns").KnowledgePatternsAPI(repo, context)
    query = dict(pattern_ref=dict(artifact_id=pattern.artifact_id, version=1, record_hash=pattern.record_hash),
                 reference_ref=dict(artifact_id=reference.artifact_id, version=1, record_hash=reference.record_hash))
    result = api.request("load-reference", query, now=NOW)
    assert result["status"] == 200 and "sibling" not in str(result).lower()
