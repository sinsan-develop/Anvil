"""C-15 deterministic backend/API-shaped E2E scenarios (synthetic only)."""
from __future__ import annotations

import pytest
from dataclasses import replace
from datetime import timedelta
from itertools import count

from packages.e2e import E2EError, SyntheticE2EHarness, run_synthetic_e2e
from packages.verification.gates import DefectAssessment, ProductValidation

REQUESTS = count()


def api(harness, run_id, action, *, human=None, **changes):
    payload = {**harness.command_context(run_id), "request_id": f"api-{next(REQUESTS)}", **changes}
    return harness.request("POST", "/runs/" + action, payload, human=human)


def prepared(run_id="prepared"):
    h = SyntheticE2EHarness(); h.start(run_id); human = h.admit_human("human:owner")
    assert api(h, run_id, "approve-plan", human=human).status_code == 200
    assert api(h, run_id, "complete").status_code == 200
    return h, human


def test_c15_request_cannot_claim_technical_pass_before_execution():
    h = SyntheticE2EHarness(); h.start("new")
    assert not any(event["event_type"] == "TechnicalValidation" for event in h.projections[0].events)


@pytest.mark.parametrize("action", ["complete", "resume", "release", "apply", "discard", "takeover"])
def test_c15_api_requires_dual_fencing_before_mutation(action):
    h = SyntheticE2EHarness(); h.start("fenced")
    before = h.projections[0].to_dict()
    response = h.request("POST", "/runs/" + action, {"request_id": "mutation", "run_id": "fenced"})
    assert response.status_code == 409 and response.body["error"] == "FENCING_REQUIRED"
    assert h.projections[0].to_dict() == before


@pytest.mark.parametrize("claim", [True, 1, "true"])
def test_c15_api_cannot_self_authenticate_from_payload(claim):
    h = SyntheticE2EHarness(); h.start("auth")
    response = h.request("POST", "/runs/release", {"request_id": "release", "run_id": "auth", "authenticated": claim,
        "actor_id": "human", "execution_fencing_token": "bad", "write_fencing_token": "bad"})
    assert response.status_code == 409 and response.body["error"] == "STALE_FENCING_TOKEN"


def test_c15_projection_is_an_immutable_snapshot():
    h = SyntheticE2EHarness(); h.start("snapshot")
    snapshot = h.projections[0]
    with pytest.raises(TypeError): snapshot.events[0]["event_type"] = "FORGED"


def test_request_to_technical_product_defect_human_release_apply_projection() -> None:
    harness = SyntheticE2EHarness()
    run = harness.start("happy")
    human = harness.admit_human("human:owner")
    harness.approve_plan(run.run_id, human=human)
    projection = harness.complete(run.run_id)
    assert projection.phase == "TECHNICAL_VALIDATION"
    assert projection.evidence_manifest is not None
    assert {gate.gate_code for gate in projection.evidence_manifest.gate_results} == {"G0", "G1", "G2", "G3"}
    assert [event["event_type"] for event in projection.events].count("ProductValidation") == 1
    assert [event["event_type"] for event in projection.events].count("DefectAssessment") == 1
    harness.release_decision(run.run_id, "RELEASE", "human:owner", True, human=human)
    harness.approve_apply(run.run_id, "approval:happy", human=human)
    harness.apply(run.run_id, "approval:happy")
    assert harness.projections[0].phase == "APPLIED"
    assert harness.projections[0].release_receipt == {"accepted": True, "approval_id": "approval:happy"}


def test_interrupt_resume_and_stale_resume_are_fail_closed() -> None:
    harness = SyntheticE2EHarness()
    run = harness.start("pause")
    harness.pause(run.run_id)
    assert harness.projections[0].status == "PAUSED_USER"
    with pytest.raises(E2EError, match="STALE_TARGET_HASH"):
        harness.resume(run.run_id, "sha256:" + "f" * 64)
    harness.resume(run.run_id, run.target_hash)
    assert harness.projections[0].phase == "RESUMED"


def test_reject_and_discard_are_projected() -> None:
    rejected = SyntheticE2EHarness(); run = rejected.start("reject")
    human = rejected.admit_human("human")
    rejected.approve_plan(run.run_id, human=human); rejected.complete(run.run_id)
    assert rejected.reject(run.run_id, human=human).status == "REJECTED"
    discarded = SyntheticE2EHarness(); run = discarded.start("discard")
    discarded.discard(run.run_id)
    assert discarded.projections[0].status == "DISCARDED"


def test_three_valid_failures_trigger_main_takeover_and_audit() -> None:
    harness = SyntheticE2EHarness(); run = harness.start("takeover")
    projection = harness.record_takeover(run.run_id)
    assert projection.status == "BLOCKED"
    assert projection.phase == "MAIN_AGENT_TAKEOVER_REQUIRED"
    assert projection.events[-1]["event_type"] == "MainAgentTakeoverRequired"
    assert len(harness.takeover.audits) == 1


def test_duplicate_api_request_and_apply_before_human_decision_are_rejected() -> None:
    harness = SyntheticE2EHarness()
    first = harness.request("POST", "/runs", {"request_id": "r1", "run_id": "api"})
    assert first.status_code == 201
    duplicate = harness.request("POST", "/runs", {"request_id": "r1", "run_id": "api"})
    assert duplicate.status_code == 409 and duplicate.body["error"] == "DUPLICATE_REPLAY"
    with pytest.raises(E2EError, match="RELEASE_DECISION_REQUIRED"):
        harness.apply("api", "approval:api")


def test_incomplete_validation_and_blocking_defect_cannot_release() -> None:
    harness = SyntheticE2EHarness(); run = harness.start("blocked-release")
    human = harness.admit_human("human:owner"); harness.approve_plan(run.run_id, human=human); harness.complete(run.run_id)
    with pytest.raises(ValueError, match="PRODUCT_VALIDATION_INCOMPLETE"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, required_criteria=("criterion:missing",), human=human)
    with pytest.raises(ValueError, match="BLOCKING_DEFECT"):
        harness.release_decision(
            run.run_id, "RELEASE", "human:owner", True,
            defects=(DefectAssessment("defect:blocking", run.target_hash, True),),
            human=human,
        )
    with pytest.raises(E2EError, match="EMPTY_VALIDATIONS"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, validations=(), human=human)
    with pytest.raises(E2EError, match="EMPTY_DEFECTS"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, defects=(), human=human)


def test_release_target_hash_mismatch_is_rejected() -> None:
    harness = SyntheticE2EHarness(); run = harness.start("stale-release")
    human = harness.admit_human("human:owner"); harness.approve_plan(run.run_id, human=human); harness.complete(run.run_id)
    stale = ProductValidation("criterion:fixture", "sha256:" + "a" * 64, "SUITABLE", "tester", "ENV-LOCAL")
    with pytest.raises(ValueError, match="TARGET_HASH_MISMATCH"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, validations=(stale,), human=human)


def test_happy_helper_is_reproducible_and_marks_fixture_boundary() -> None:
    projection = run_synthetic_e2e()
    assert projection.status == "SUCCEEDED"
    assert projection.evidence_manifest is not None
    assert projection.to_dict()["acquisition_mode"] == "synthetic-fixture"
    assert "provider" in projection.to_dict()["unverified_scope"]
    assert projection.phase == "APPLIED" and projection.to_dict()["external_io_count"] == 0
    assert projection.to_dict() == run_synthetic_e2e().to_dict()


def test_c15_full_api_journey_preserves_original_until_separate_apply_approval():
    h, human = prepared("journey")
    assert h.projections[0].fixture_state == {"original": "hello", "candidate": "HELLO", "apply_count": 0}
    assert api(h, "journey", "release", human=human).status_code == 200
    blocked = api(h, "journey", "apply", approval_id="apply")
    assert blocked.body["error"] == "APPLY_APPROVAL_REQUIRED"
    assert h.projections[0].fixture_state["original"] == "hello"
    assert api(h, "journey", "approve-apply", human=human, approval_id="apply").status_code == 200
    assert api(h, "journey", "apply", approval_id="apply").status_code == 200
    assert h.projections[0].fixture_state == {"original": "HELLO", "candidate": "HELLO", "apply_count": 1}
    assert api(h, "journey", "apply", approval_id="apply").body["error"] == "INVALID_PHASE"
    assert h.projections[0].fixture_state["apply_count"] == 1


def test_c15_plan_approval_and_paused_state_gate_execution():
    h = SyntheticE2EHarness(); h.start("plan")
    assert api(h, "plan", "complete").body["error"] == "DESIGN_APPROVAL_REQUIRED"
    human = h.admit_human("human"); api(h, "plan", "approve-plan", human=human)
    assert api(h, "plan", "pause").status_code == 200
    assert api(h, "plan", "complete").body["error"] == "INVALID_PHASE"
    assert api(h, "plan", "resume").status_code == 200
    assert api(h, "plan", "complete").status_code == 200


@pytest.mark.parametrize("field", ["execution_fencing_token", "write_fencing_token"])
def test_c15_each_stale_token_is_io0_and_cross_run_rejected(field):
    h, _ = prepared("A"); h.start("B")
    before = h.projections[0].to_dict()
    response = api(h, "A", "discard", **{field: h.command_context("B")[field]})
    assert response.body["error"] == "STALE_FENCING_TOKEN"
    assert h.projections[0].to_dict() == before


@pytest.mark.parametrize("field", ["target_hash", "manifest_hash"])
def test_c15_stale_subject_or_manifest_blocks_release_without_state_change(field):
    h, human = prepared(); before = h.projections[0].to_dict()
    response = api(h, "prepared", "release", human=human, **{field: "sha256:" + "f" * 64})
    assert response.body["error"] == ("STALE_TARGET_HASH" if field == "target_hash" else "STALE_MANIFEST_HASH")
    assert h.projections[0].to_dict() == before


@pytest.mark.parametrize("claim", [True, 1, "true"])
def test_c15_valid_fence_does_not_make_payload_authentication_trusted(claim):
    h, _ = prepared(); before = h.projections[0].to_dict()
    response = api(h, "prepared", "release", authenticated=claim, actor_id="human:owner")
    assert response.body["error"] == "AUTHENTICATED_HUMAN_REQUIRED"
    assert h.projections[0].to_dict() == before


def test_c15_foreign_host_human_and_tokens_are_rejected():
    h, _ = prepared("same"); foreign, foreign_human = prepared("same")
    assert api(h, "same", "release", human=foreign_human).body["error"] == "AUTHENTICATED_HUMAN_REQUIRED"
    values = foreign.command_context("same")
    response = api(h, "same", "discard", execution_fencing_token=values["execution_fencing_token"], write_fencing_token=values["write_fencing_token"])
    assert response.body["error"] == "STALE_FENCING_TOKEN"


@pytest.mark.parametrize("variant", ["foreign-authority", "different-run", "altered-details"])
def test_c15_stale_or_foreign_evidence_cannot_release(variant):
    h, human = prepared("A"); source = h._runs["A"].manifest
    if variant == "foreign-authority":
        other, _ = prepared("A"); forged = other._runs["A"].manifest
    elif variant == "different-run":
        h.start("B"); h.approve_plan("B", human=human); h.complete("B")
        other = h._runs["B"].manifest
        forged = replace(other, target_hash=source.target_hash, delivered_artifact_hash=source.target_hash,
            verified_artifact_hash=source.target_hash, gate_results=tuple(replace(item, target_hash=source.target_hash) for item in other.gate_results))
    else:
        forged = replace(source, gate_results=(replace(source.gate_results[0], details={}), *source.gate_results[1:]))
    h._runs["A"].manifest = forged
    assert api(h, "A", "release", human=human).body["error"] == "PASS_REQUIRED"
    assert h.projections[0].fixture_state["apply_count"] == 0


def test_c15_new_blocking_defect_and_incomplete_validation_block_apply():
    h, human = prepared(); api(h, "prepared", "release", human=human)
    api(h, "prepared", "approve-apply", human=human, approval_id="apply")
    run = h._runs["prepared"]
    h.release.record_validation_state(target_hash=run.target_hash, product_validations=(), required_criteria=("criterion:fixture",),
        defects=(DefectAssessment("blocker", run.target_hash, True),))
    response = api(h, "prepared", "apply", approval_id="apply")
    assert response.body["error"] == "PRODUCT_VALIDATION_INCOMPLETE"
    assert h.projections[0].fixture_state["original"] == "hello"


def test_c15_takeover_revokes_worker_write_and_tools_and_blocks_late_action():
    h = SyntheticE2EHarness(); h.start("takeover-api")
    response = api(h, "takeover-api", "takeover")
    assert response.status_code == 200 and response.body["phase"] == "MAIN_AGENT_TAKEOVER_REQUIRED"
    assert h.leases.active_worker("takeover-api") is None and h.leases.active_writes("takeover-api") == ()
    assert not h.tools.active("takeover-api")
    assert api(h, "takeover-api", "complete").body["error"] == "STALE_FENCING_TOKEN"
    assert h.ledger.valid_failure_count == 3


def test_c15_rejection_then_discard_keeps_original_and_forbids_apply():
    h, human = prepared(); assert api(h, "prepared", "reject", human=human).status_code == 200
    assert api(h, "prepared", "discard").status_code == 200
    assert h.projections[0].fixture_state == {"original": "hello", "candidate": None, "apply_count": 0}
    assert api(h, "prepared", "complete").body["error"] == "INVALID_PHASE"


def test_c15_expired_lease_blocks_api_mutation():
    h = SyntheticE2EHarness(); h.start("expired"); h.now += timedelta(hours=2)
    assert api(h, "expired", "discard").body["error"] == "STALE_FENCING_TOKEN"


def test_c15_host_human_identity_cannot_be_relabelled_after_admission():
    h, human = prepared()
    object.__setattr__(human, "actor_id", "forged-human")
    response = api(h, "prepared", "release", human=human)
    assert response.body["error"] == "AUTHENTICATED_HUMAN_REQUIRED"


@pytest.mark.parametrize("variant", ["manifest", "gate", "nested-details"])
def test_c15_r1_projection_manifest_is_detached_from_canonical_release_state(variant):
    h = SyntheticE2EHarness(); h.start("alias"); human = h.admit_human("human:owner")
    h.approve_plan("alias", human=human)
    snapshot = h.complete("alias")
    canonical = h._runs["alias"].manifest
    original_hash, original_seal = canonical.manifest_hash, canonical.seal_id
    assert snapshot.evidence_manifest is not canonical
    for copied, source in zip(snapshot.evidence_manifest.gate_results, canonical.gate_results):
        assert copied is not source and copied.details is not source.details
    checks = snapshot.evidence_manifest.gate_results[3].details["tests"][0]["assertions"]
    assert checks is not canonical.gate_results[3].details["tests"][0]["assertions"]
    with pytest.raises(TypeError): checks["ui"]["observed"] = "MUTATED"
    if variant == "manifest":
        object.__setattr__(snapshot.evidence_manifest, "environment_id", "MUTATED-SNAPSHOT")
    elif variant == "gate":
        object.__setattr__(snapshot.evidence_manifest.gate_results[0], "target_hash", "sha256:" + "f" * 64)
    else:
        object.__setattr__(snapshot.evidence_manifest.gate_results[3], "details", {"tests": [{"assertions": {"ui": "MUTATED"}}]})
    assert canonical.manifest_hash == original_hash and canonical.seal_id == original_seal
    assert h.gates.evaluate_manifest(canonical) == (True, ())
    assert api(h, "alias", "release", human=human).status_code == 200
    assert api(h, "alias", "approve-apply", human=human, approval_id="alias-apply").status_code == 200
    assert api(h, "alias", "apply", approval_id="alias-apply").status_code == 200
