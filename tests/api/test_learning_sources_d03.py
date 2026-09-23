"""D-03 API host authority·redaction·replay 계약."""
from datetime import datetime, timedelta, timezone
import importlib
import pytest

NOW = datetime(2026, 9, 16, tzinfo=timezone.utc)


@pytest.fixture
def bundle():
    s = importlib.import_module("packages.knowledge.sources")
    module = importlib.import_module("packages.api.learning_sources")
    repo = s.LearningSourceRepository()
    context = repo.admit_host("human1", s.MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(days=1))
    data = dict(source_id="source1", version=1, source_type="design_document", locator=dict(document_id="doc1", revision="r1"),
                body="safe source", content_hash=s.hash_body("safe source"), teaching_intent="reuse", user_quality_label="exemplar", exclusions=[])
    repo.authorize_capture(context, data, confidentiality="private", license_ref="internal-owned", license_status="APPROVED",
                           ownership="OWNED", quality_evidence=["quality1"], now=NOW)
    return module.LearningSourcesAPI(repo, context), data


def test_api_register_get_revoke_and_redacted_impact(bundle):
    api, payload = bundle
    first = api.request("register", {**payload, "expected_version": 0}, request_id="r1", now=NOW)
    assert first["status"] == 201
    first["body"]["record"]["locator"]["revision"] = "tamper"
    assert api.request("get", {"source_id": "source1"}, now=NOW)["body"]["record"]["locator"]["revision"] == "r1"
    result = api.request("revoke", dict(source_id="source1", expected_version=1, reason="DELETED"), request_id="r2", now=NOW)
    assert result["status"] == 201 and result["body"]["new_use_blocked"]
    assert api.request("get-impact", {"impact_id": result["body"]["impact_id"]}, now=NOW)["body"] == result["body"]
    assert api.request("list-derived", {"source_id": "source1"}, now=NOW)["body"] == []


@pytest.mark.parametrize("change", [{"actor": "self"}, {"scope": "user"}, {"ownership": "OWNED"},
                                     {"license_status": "APPROVED"}, {"status": "ACTIVE"}, {"license_ref": "MIT"}])
def test_payload_cannot_grant_authority_or_license(bundle, change):
    api, payload = bundle
    result = api.request("register", {**payload, **change, "expected_version": 0}, request_id="r1", now=NOW)
    assert result["status"] == 400
    assert api.request("get", {"source_id": "source1"}, now=NOW)["status"] == 404


def test_api_capture_digest_and_request_replay_guard(bundle):
    api, payload = bundle
    changed = {**payload, "teaching_intent": "different", "expected_version": 0}
    assert api.request("register", changed, request_id="retry", now=NOW)["body"]["reason"] == "SOURCE_CAPTURE_AUTHORITY_REQUIRED"
    assert api.request("register", {**payload, "expected_version": 0}, request_id="retry", now=NOW)["status"] == 201
    replay = api.request("revoke", dict(source_id="source1", expected_version=1, reason="DELETED"), request_id="retry", now=NOW)
    assert replay["status"] == 409 and replay["body"]["reason"] == "REQUEST_REPLAY"


@pytest.mark.parametrize("bad", [None, [], {"source_id": "api_key=FAKE_TEST_ONLY"}])
def test_malformed_api_redacts_values(bundle, bad):
    api, _ = bundle
    result = api.request("register", bad, request_id="bad", now=NOW)
    assert result["status"] == 400 and "FAKE_TEST_ONLY" not in str(result)


@pytest.mark.parametrize("location", ["source_id", "teaching_intent", "user_quality_label", "exclusions", "revision", "url"])
def test_r1_api_metadata_credentials_have_safe_reason_and_zero_storage(bundle, location):
    api, data = bundle
    bad = dict(data)
    marker = "token=FAKE_TEST_ONLY"
    if location == "url":
        bad.update(source_type="url_or_package_doc", locator={"url": "https://docs.example.test/?" + marker, "revision": "r1"})
    elif location == "revision":
        bad["locator"] = {"document_id": "doc1", "revision": marker}
    else:
        bad[location] = [marker] if location == "exclusions" else marker
    result = api.request("register", {**bad, "expected_version": 0}, request_id="retry", now=NOW)
    assert result == {"status": 400, "body": {"reason": "SECRET_LIKE_INPUT"}}
    assert api.request("get", {"source_id": "source1"}, now=NOW)["status"] == 404
    valid = api.request("register", {**data, "expected_version": 0}, request_id="retry", now=NOW)
    assert valid["status"] == 201 and "FAKE_TEST_ONLY" not in str(valid)


@pytest.mark.parametrize("revision", [" r1", "r1 ", "\tr1", "r1\n"])
def test_r1_api_locator_whitespace_has_deterministic_failure(bundle, revision):
    api, payload = bundle
    payload = {**payload, "locator": {"document_id": "doc1", "revision": revision}, "expected_version": 0}
    assert api.request("register", payload, request_id="bad", now=NOW) == {"status": 400, "body": {"reason": "INVALID_SOURCE_INPUT"}}


@pytest.mark.parametrize("value", ["api key=FAKE_TEST_ONLY", "API\tKEY=FAKE_TEST_ONLY", "api%20key%3DFAKE_TEST_ONLY",
                                 "api+key%3DFAKE_TEST_ONLY", "api%2520key%253DFAKE_TEST_ONLY"])
@pytest.mark.parametrize("location", ["teaching_intent", "url"])
def test_r2_api_spaced_credentials_are_redacted_and_not_stored(bundle, value, location):
    api, data = bundle
    bad = dict(data)
    if location == "url":
        bad.update(source_type="url_or_package_doc", locator={"url": "https://docs.example.test/?" + value, "revision": "r1"})
    else:
        bad[location] = value
    result = api.request("register", {**bad, "expected_version": 0}, request_id="retry", now=NOW)
    assert result == {"status": 400, "body": {"reason": "SECRET_LIKE_INPUT"}}
    assert api.request("get", {"source_id": "source1"}, now=NOW)["status"] == 404
    assert api.request("register", {**data, "expected_version": 0}, request_id="retry", now=NOW)["status"] == 201


@pytest.mark.parametrize("value,blocked", [("FAKE_TEST_ONLY", True), (0, True), (False, True),
                                          (None, False), ("", False), ([], False), ({}, False)])
def test_r3_api_nested_mapping_key_value_binding(bundle, value, blocked):
    from packages.knowledge.sources import hash_body
    api, data = bundle
    body = {"nested": [{"API\tKEY": value}]}
    payload = {**data, "body": body, "content_hash": hash_body(body)}
    api.repository.authorize_capture(api.context, payload, confidentiality="private", license_ref="internal-owned",
                                     license_status="APPROVED", ownership="OWNED", quality_evidence=["quality1"], now=NOW)
    result = api.request("register", {**payload, "expected_version": 0}, request_id="r3", now=NOW)
    assert result["status"] == 201
    assert result["body"]["status"] == ("QUARANTINED" if blocked else "REGISTERED")
    assert result["body"]["record"]["activation_eligible"] is (not blocked)
    assert {f["code"] for f in result["body"]["record"]["findings"]} == ({"SECRET_LIKE_INPUT"} if blocked else set())
    fetched = api.request("get", {"source_id": "source1"}, now=NOW)
    assert fetched["body"] == result["body"] and "FAKE_TEST_ONLY" not in str(fetched)
