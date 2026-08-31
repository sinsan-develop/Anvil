from packages.orchestration.result_envelope import canonical_hash
from packages.verification import (
    DefectAssessment, DiffReviewService, EvidenceManifest, GateResult, GateStatus,
    ProductValidation, ReleaseApprovalService, ReleaseDecision, evaluate_gates,
)


H = canonical_hash({"fixture": "c14"})


def manifest(*, status=GateStatus.PASS, target=H):
    gates = tuple(GateResult(code, status, target) for code in ("G0", "G1", "G2", "G3"))
    return EvidenceManifest(target, target, target, "env_fixture", gate_results=gates)


def test_gate_statuses_are_explicit_and_only_passes_count():
    assert evaluate_gates(manifest().gate_results, target_hash=H) == (True, ())
    for status in (GateStatus.FAIL, GateStatus.SKIPPED, GateStatus.BLOCKED, GateStatus.ERROR):
        ok, reasons = evaluate_gates(manifest(status=status).gate_results, target_hash=H)
        assert not ok and "PASS_REQUIRED" in reasons


def test_hash_mismatch_manifest_is_rejected():
    other = canonical_hash({"fixture": "other"})
    try:
        EvidenceManifest(H, other, H, "env_fixture")
    except ValueError as exc:
        assert "target_hash" in str(exc) or "hash" in str(exc)
    else:
        raise AssertionError("mismatched hashes must fail closed")
    assert evaluate_gates((GateResult("G0", GateStatus.PASS, other),), target_hash=H)[0] is False


def test_diff_review_rejects_scope_delete_test_and_secret():
    result = DiffReviewService().review(
        changed_paths=("packages/verification/gates.py", "apps/secret.txt"),
        allowed_paths=("packages/verification", "tests/verification"),
        deleted_paths=("tests/verification/test_old.py",), modified_tests=True,
        secret_patterns=("OPENAI_API_KEY=",),
    )
    assert not result.passed
    assert {"DIFF_OUT_OF_SCOPE", "DELETED_FILE", "TEST_MODIFIED", "SECRET_PATTERN"} <= set(result.reason_codes)


def test_manifest_rejects_gate_with_different_target_hash():
    other = canonical_hash({"other": True})
    gates = (GateResult("G0", GateStatus.PASS, other),)
    try:
        EvidenceManifest(H, H, H, "env_fixture", gate_results=gates)
    except ValueError as exc:
        assert "gate" in str(exc)
    else:
        raise AssertionError("manifest must bind every gate to its target")


def test_diff_review_rejects_traversal_and_backslash_escape():
    result = DiffReviewService().review(
        changed_paths=("packages/verification/../secrets.txt", r"packages\verification\..\secrets.txt"),
        allowed_paths=("packages/verification",),
    )
    assert not result.passed and "DIFF_OUT_OF_SCOPE" in result.reason_codes


def test_release_and_apply_require_suitable_validation_and_no_blocking_defect():
    service = ReleaseApprovalService()
    m = manifest()
    validation = ProductValidation("criterion-1", H, "SUITABLE", "human-1", "env_fixture")
    decision = service.decide(decision_id="decision-1", target_hash=H, decision="RELEASE",
                              actor_id="human-1", authenticated=True, manifest=m,
                              product_validations=(validation,), required_criteria=("criterion-1",))
    receipt = service.apply(approval_id="apply-1", target_hash=H, manifest=m, decision=decision)
    assert receipt.accepted
    assert service.apply(approval_id="apply-1", target_hash=H, manifest=m, decision=decision).duplicate

    try:
        service.decide(decision_id="decision-2", target_hash=H, decision=ReleaseDecision.RELEASE,
                       actor_id="human-1", authenticated=True, manifest=m,
                       product_validations=(validation,), required_criteria=("criterion-1",),
                       defects=(DefectAssessment("d-1", H, True),))
    except ValueError as exc:
        assert str(exc) == "BLOCKING_DEFECT"
    else:
        raise AssertionError("blocking defect must deny release")


def test_stale_decision_and_replay_conflict_fail_closed():
    service = ReleaseApprovalService(); m = manifest()
    v = ProductValidation("c", H, "SUITABLE", "human", "env_fixture")
    d = service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="human",
                       authenticated=True, manifest=m, product_validations=(v,), required_criteria=("c",))
    other = canonical_hash({"different": True})
    assert not service.apply(approval_id="a", target_hash=other, manifest=m, decision=d).accepted
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=d).accepted


def test_apply_rejects_forged_decision_record():
    service = ReleaseApprovalService(); m = manifest()
    v = ProductValidation("c", H, "SUITABLE", "human", "env_fixture")
    d = service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="human",
                       authenticated=True, manifest=m, product_validations=(v,), required_criteria=("c",))
    from packages.verification import ReleaseDecisionRecord
    forged = ReleaseDecisionRecord(d.decision_id, d.target_hash, d.decision, d.actor_id,
                                   d.authenticated, d.manifest_hash)
    receipt = service.apply(approval_id="forged", target_hash=H, manifest=m, decision=forged)
    assert not receipt.accepted and "STALE_APPROVAL" in receipt.reason_codes
