"""C-15 deterministic backend/API-shaped E2E scenarios (synthetic only)."""
from __future__ import annotations

import pytest

from packages.e2e import E2EError, SyntheticE2EHarness, run_synthetic_e2e
from packages.verification.gates import DefectAssessment, ProductValidation


def test_request_to_technical_product_defect_human_release_apply_projection() -> None:
    harness = SyntheticE2EHarness()
    run = harness.start("happy")
    projection = harness.complete(run.run_id)
    assert projection.phase == "TECHNICAL_VALIDATION"
    assert projection.evidence_manifest is not None
    assert {gate.gate_code for gate in projection.evidence_manifest.gate_results} == {"G0", "G1", "G2", "G3"}
    assert [event["event_type"] for event in projection.events].count("ProductValidation") == 1
    assert [event["event_type"] for event in projection.events].count("DefectAssessment") == 1
    harness.release_decision(run.run_id, "RELEASE", "human:owner", True)
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
    assert rejected.reject(run.run_id).status == "REJECTED"
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
    harness = SyntheticE2EHarness(); run = harness.start("blocked-release"); harness.complete(run.run_id)
    with pytest.raises(ValueError, match="PRODUCT_VALIDATION_INCOMPLETE"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, required_criteria=("criterion:missing",))
    with pytest.raises(ValueError, match="BLOCKING_DEFECT"):
        harness.release_decision(
            run.run_id, "RELEASE", "human:owner", True,
            defects=(DefectAssessment("defect:blocking", run.target_hash, True),),
        )
    with pytest.raises(E2EError, match="EMPTY_VALIDATIONS"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, validations=())
    with pytest.raises(E2EError, match="EMPTY_DEFECTS"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, defects=())


def test_release_target_hash_mismatch_is_rejected() -> None:
    harness = SyntheticE2EHarness(); run = harness.start("stale-release"); harness.complete(run.run_id)
    stale = ProductValidation("criterion:fixture", "sha256:" + "a" * 64, "SUITABLE", "tester", "ENV-LOCAL")
    with pytest.raises(ValueError, match="TARGET_HASH_MISMATCH"):
        harness.release_decision(run.run_id, "RELEASE", "human:owner", True, validations=(stale,))


def test_happy_helper_is_reproducible_and_marks_fixture_boundary() -> None:
    projection = run_synthetic_e2e()
    assert projection.status == "SUCCEEDED"
    assert projection.evidence_manifest is not None
    assert projection.evidence_manifest.acquisition_mode == "synthetic-fixture"
    assert "provider" in projection.evidence_manifest.unverified_scope
