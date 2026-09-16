"""D-05 create/get/list의 host authority와 projection 계약."""
import importlib
import pytest
from tests.knowledge.test_reviews_d05 import NOW, setup, payload, attest
from tests.knowledge.test_reviews_d05 import second_context, owned_subject


@pytest.fixture
def bundle():
    r = importlib.import_module("packages.knowledge.reviews")
    repo, _, context = setup(r)
    data = payload()
    attest(repo, context, data)
    api = importlib.import_module("packages.api.learning_reviews").LearningReviewsAPI(repo, context)
    return api, data


def test_api_create_get_list_and_replay(bundle):
    api, data = bundle
    result = api.request("create", {**data, "expected_version": 0}, request_id="create", now=NOW)
    assert result["status"] == 201
    replay = api.request("create", {**data, "expected_version": 0}, request_id="create", now=NOW)
    assert replay == result
    result["body"]["decisions"][0]["summary"] = "tamper"
    assert "tamper" not in str(api.request("get", {"review_id": "review1"}, now=NOW))
    assert len(api.request("list", {}, now=NOW)["body"]) == 1


@pytest.mark.parametrize("extra", [{"actor": "self"}, {"terminality": True}, {"target_hash": "b" * 64},
                                   {"verification": {"test1": "PASS"}}, {"approval": True}, {"body": "api key=FAKE_TEST_ONLY"}])
def test_api_rejects_authority_and_raw_evidence(bundle, extra):
    api, data = bundle
    result = api.request("create", {**data, **extra, "expected_version": 0}, request_id="bad", now=NOW)
    assert result["status"] == 400 and "FAKE_TEST_ONLY" not in str(result)
    assert api.request("list", {}, now=NOW)["body"] == []


@pytest.mark.parametrize("kind", ["RUN", "ITERATION"])
@pytest.mark.parametrize("actor", ["human2", "human1"])
def test_r1_api_blocks_same_scope_different_authority_before_and_after_create(kind, actor):
    r = importlib.import_module("packages.knowledge.reviews")
    repo, sources, owner = setup(r)
    other = second_context(sources, actor)
    data, _ = owned_subject(repo, owner, kind)
    api_type = importlib.import_module("packages.api.learning_reviews").LearningReviewsAPI
    own_api, other_api = api_type(repo, owner), api_type(repo, other)
    expected = {"status": 403, "body": {"reason": "REVIEW_AUTHORITY_MISMATCH"}}
    assert other_api.request("create", {**data, "expected_version": 0}, request_id="create", now=NOW) == expected
    assert own_api.request("create", {**data, "expected_version": 0}, request_id="create", now=NOW)["status"] == 201
    assert other_api.request("create", {**data, "expected_version": 0}, request_id="create", now=NOW) == expected
    assert other_api.request("get", {"review_id": "review1"}, now=NOW) == expected
    assert other_api.request("list", {}, now=NOW) == {"status": 200, "body": []}
