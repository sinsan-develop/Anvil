import importlib
import pytest
from datetime import timedelta
from packages.knowledge.memory import to_primitive
from tests.knowledge.test_candidates_d06 import setup, NOW, ref, proof, snapshot, select


@pytest.mark.parametrize("field", ["actor", "approval", "trusted_auto", "permission", "evidence"])
def test_api_rejects_self_authority_without_value_exposure(field):
    c = importlib.import_module("packages.knowledge.candidates")
    repo, context, proposal, _, _ = setup(c)
    api = importlib.import_module("packages.api.learning_candidates").LearningCandidatesAPI(repo, context)
    result = api.request("create", {"proposal": proposal, "expected_version": 0, field: "DO_NOT_EXPOSE"}, request_id="create", now=NOW)
    assert result == {"status": 400, "body": {"reason": "INVALID_CANDIDATE_INPUT"}}


def test_api_create_query_and_no_approval_capture_route():
    c = importlib.import_module("packages.knowledge.candidates")
    repo, context, proposal, _, _ = setup(c)
    api = importlib.import_module("packages.api.learning_candidates").LearningCandidatesAPI(repo, context)
    result = api.request("create", {"proposal": proposal, "expected_version": 0}, request_id="create", now=NOW)
    assert result["status"] == 201
    result["body"]["candidate"]["target_scope"]["project_id"] = "tamper"
    result = api.request("query", {"candidate_id": proposal["candidate_id"]}, now=NOW)
    assert result["body"]["candidate"]["target_scope"]["project_id"] == "p1"
    assert api.request("capture_human_decision", {}, now=NOW)["status"] == 400


def test_api_full_lifecycle_requires_host_evidence_and_human_decision():
    c = importlib.import_module("packages.knowledge.candidates")
    repo, context, proposal, _, snapshots = setup(c, "HOOK")
    proposal["risk_delta"].update(risk="HIGH", capabilities=["WRITE", "NETWORK", "EXECUTE"], implicit_trigger=True, script=True, policy=True)
    api = importlib.import_module("packages.api.learning_candidates").LearningCandidatesAPI(repo, context)
    created = api.request("create", dict(proposal=proposal, expected_version=0), request_id="create", now=NOW)
    target = ref(created["body"])
    repo.capture_evaluation(context, target, proof(target), now=NOW, expires_at=NOW + timedelta(hours=1))
    assert api.request("evaluate", dict(candidate_ref=target, expected_version=1), request_id="eval", now=NOW)["status"] == 200
    assert api.request("request-approval", dict(candidate_ref=target, expected_version=2), request_id="request", now=NOW)["status"] == 200
    assert api.request("approve", dict(candidate_ref=target, expected_version=3), request_id="approve", now=NOW) == {"status": 403, "body": {"reason": "HUMAN_APPROVAL_REQUIRED"}}
    repo.capture_human_decision(context, target, decision="APPROVE", evidence_ref="authenticated-human-event", now=NOW, expires_at=NOW + timedelta(hours=1))
    assert api.request("approve", dict(candidate_ref=target, expected_version=3), request_id="approve", now=NOW)["status"] == 200
    active = api.request("activate", dict(candidate_ref=target, expected_version=4), request_id="activate", now=NOW)["body"]
    assert active["risk_delta"]["script"] is True and active["runtime_connected"] is False
    snap = snapshot(snapshots)
    selection = select(repo, context, [active], snap, now=NOW + timedelta(seconds=1))
    used = api.request("use", dict(activation_id=active["activation_id"], selection_id=selection["selection_id"], expected_selection_hash=selection["content_hash"]), request_id="use", now=NOW + timedelta(seconds=1))
    assert used["status"] == 200 and used["body"]["runtime_connected"] is False
    rolled = api.request("rollback", dict(candidate_ref=target, expected_version=5, reason="REGRESSION", evidence_ref="retest"), request_id="rollback", now=NOW + timedelta(seconds=2))
    assert rolled["body"]["state"]["status"] == "ROLLED_BACK"
