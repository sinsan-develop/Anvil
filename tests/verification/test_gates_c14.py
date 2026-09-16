from packages.orchestration.result_envelope import canonical_hash
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from itertools import count
import pytest
from packages.verification import gates as g

NOW = datetime(2026, 9, 16, tzinfo=timezone.utc)
from packages.verification import (
    DefectAssessment, DiffReviewService, EvidenceManifest, GateResult, GateStatus,
    ProductValidation, ReleaseApprovalService, ReleaseDecision, evaluate_gates,
)


H = canonical_hash({"fixture": "c14"})
HOST = g.GateEvidenceAuthority()
RETEST_IDS = count()


def manifest(*, status=GateStatus.PASS, target=H):
    # These are synthetic records testing the real-evidence contract, not real
    # process/browser evidence produced by this pytest run.
    engine = g.GateEngine(evidence_authority=HOST)
    tool = g.StaticTool("lint", ("lint", "src"), True, True, True, "1.0")
    review = g.DiffReviewService().review(changed_paths=("src/file.py",), allowed_paths=("src",),
        changes=(g.DiffFile("src/file.py", "x=1\n", "x=2\n"),),
        llm_findings=tuple(g.ReviewFinding(name, GateStatus.PASS, "review") for name in g.LLM_CHECKS))
    gates = (engine.baseline(target_hash=target, observations=baseline()),
        engine.static(target_hash=target, tools=(tool,), runner=lambda item: g.CommandEvidence(item.name, item.command, item.version, 0, "lint-result")),
        engine.change_review(target_hash=target, review=review),
        engine.tests(target_hash=target, evidence=(test_evidence(),)))
    result = EvidenceManifest(target, target, target, "env_fixture", gate_results=tuple(replace(item, status=status) for item in gates), acquisition_mode="real")
    return engine.issue_manifest(result) if status is GateStatus.PASS else result


def test_evidence(**changes):
    values = dict(test_id="flow", requirement_id="c", status=GateStatus.PASS, acquisition_mode="real",
        assertions={key: {"expected": "ok", "observed": "ok", "evidence_ref": key + "-ref"} for key in ("input", "store", "response", "ui")})
    values.update(changes)
    return g.TestEvidence(**values)
test_evidence.__test__ = False


def validation(criterion="c"):
    return ProductValidation(criterion, H, "SUITABLE", "human", "env_fixture", ("product-ref",),
        "real", H, "enter and persist", "ok", "ok", datetime(2026, 9, 1, tzinfo=timezone.utc))


def approve(service, decision, approval_id="a"):
    record = g.ApplyApprovalRecord(approval_id, decision.decision_id, decision.target_hash,
        decision.manifest_hash, "human", True, decision.decided_at, decision.expires_at)
    service.record_apply_approval(record)


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
    service = ReleaseApprovalService(evidence_authority=HOST)
    m = manifest()
    v = validation("criterion-1")
    decision = service.decide(decision_id="decision-1", target_hash=H, decision="RELEASE",
                              actor_id="human-1", authenticated=True, manifest=m,
                              product_validations=(v,), required_criteria=("criterion-1",))
    approve(service, decision, "apply-1")
    receipt = service.apply(approval_id="apply-1", target_hash=H, manifest=m, decision=decision)
    assert receipt.accepted
    assert service.apply(approval_id="apply-1", target_hash=H, manifest=m, decision=decision).duplicate

    try:
        service.decide(decision_id="decision-2", target_hash=H, decision=ReleaseDecision.RELEASE,
                       actor_id="human-1", authenticated=True, manifest=m,
                       product_validations=(v,), required_criteria=("criterion-1",),
                       defects=(DefectAssessment("d-1", H, True),))
    except ValueError as exc:
        assert str(exc) == "BLOCKING_DEFECT"
    else:
        raise AssertionError("blocking defect must deny release")


def test_stale_decision_and_replay_conflict_fail_closed():
    service = ReleaseApprovalService(evidence_authority=HOST); m = manifest()
    v = validation()
    d = service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="human",
                       authenticated=True, manifest=m, product_validations=(v,), required_criteria=("c",))
    other = canonical_hash({"different": True})
    approve(service, d)
    assert not service.apply(approval_id="a", target_hash=other, manifest=m, decision=d).accepted
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=d).accepted


def test_apply_rejects_forged_decision_record():
    service = ReleaseApprovalService(evidence_authority=HOST); m = manifest()
    v = validation()
    d = service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="human",
                       authenticated=True, manifest=m, product_validations=(v,), required_criteria=("c",))
    from packages.verification import ReleaseDecisionRecord
    forged = ReleaseDecisionRecord(d.decision_id, d.target_hash, d.decision, d.actor_id,
                                   d.authenticated, d.manifest_hash)
    receipt = service.apply(approval_id="forged", target_hash=H, manifest=m, decision=forged)
    assert not receipt.accepted and "STALE_APPROVAL" in receipt.reason_codes


def baseline():
    return {
        "repository_readable": {"status": "PASS", "evidence_ref": "read", "value": True},
        "branch_head": {"status": "PASS", "evidence_ref": "git", "value": {"branch": "codex/c14", "head": "a" * 40}},
        "dirty_manifest": {"status": "PASS", "evidence_ref": "dirty", "value": {"tracked": [], "untracked": []}},
        "runtime_versions": {"status": "PASS", "evidence_ref": "versions", "value": {"python": "3.13.0"}},
        "baseline_tests": {"status": "PASS", "evidence_ref": "tests", "value": {"passed": 8, "failed": 0, "skipped": 0}},
        "backend_health": {"status": "PASS", "evidence_ref": "health", "value": True},
    }


@pytest.mark.parametrize("missing", list(baseline()))
def test_c14_g0_requires_all_six_observations(missing):
    data = baseline(); del data[missing]
    result = g.GateEngine(evidence_authority=HOST).baseline(target_hash=H, observations=data)
    assert result.status is GateStatus.BLOCKED and "BASELINE_INCOMPLETE" in result.reason_codes


def test_c14_g0_preserves_baseline_failure_not_new_failure():
    data = baseline(); data["baseline_tests"].update(status="FAIL", value={"passed": 7, "failed": 1, "skipped": 0})
    result = g.GateEngine(evidence_authority=HOST).baseline(target_hash=H, observations=data)
    assert result.status is GateStatus.FAIL and result.details["baseline_failure"] is True


def test_c14_g1_declared_missing_tool_blocks_before_runner():
    calls = []
    tool = g.StaticTool("ruff", ("ruff", "check", "src"), True, True, False, "")
    result = g.GateEngine(evidence_authority=HOST).static(target_hash=H, tools=(tool,), runner=lambda item: calls.append(item))
    assert result.status is GateStatus.BLOCKED and "TOOL_NOT_INSTALLED" in result.reason_codes and calls == []


@pytest.mark.parametrize("mode", ["fixture", "mock"])
def test_c14_g3_cannot_promote_mock_to_actual_boundary(mode):
    evidence = g.TestEvidence("test", "req", GateStatus.PASS, mode,
        {key: "ref-" + key for key in ("input", "store", "response", "ui")})
    result = g.GateEngine(evidence_authority=HOST).tests(target_hash=H, evidence=(evidence,))
    assert result.status is GateStatus.BLOCKED and "REAL_BOUNDARY_UNVERIFIED" in result.reason_codes


def test_c14_g2_detects_seven_classes_and_never_accepts_llm_override():
    changes = (
        g.DiffFile("outside.py", "def api():\n    return 1\n", "def other():\n    return 1\n"),
        g.DiffFile("src/test_old.py", "def test_ok():\n    assert True\n", None),
        g.DiffFile("src/requirements.txt", "old", "new"),
        g.DiffFile("src/key.py", "", "api_key = '" + "X" * 32 + "'"),
        g.DiffFile("src/format.py", "x = 1\n" * 21, "x=1\n" * 21),
    )
    llm = tuple(g.ReviewFinding(name, GateStatus.PASS, "review") for name in g.LLM_CHECKS)
    result = g.DiffReviewService().review(changed_paths=tuple(item.path for item in changes),
        allowed_paths=("src",), changes=changes, llm_findings=llm)
    assert not result.passed
    assert {"DIFF_OUT_OF_SCOPE", "DELETED_FILE", "TEST_MODIFIED", "DEPENDENCY_CHANGED",
        "PUBLIC_SURFACE_CHANGED", "SECRET_PATTERN", "FORMATTER_DRIFT"} <= set(result.reason_codes)
    assert len(result.llm_findings) == 5 and len(result.deterministic_findings) >= 7


def test_c14_nested_gate_evidence_is_immutable():
    details = {"nested": ["original"]}
    gate = GateResult("G0", GateStatus.PASS, H, details=details)
    before = canonical_hash(gate.to_dict())
    details["nested"].append("changed")
    assert canonical_hash(gate.to_dict()) == before
    with pytest.raises(TypeError): gate.details["nested"] = ()


def test_c14_release_does_not_implicitly_create_apply_approval():
    service = ReleaseApprovalService(evidence_authority=HOST); m = manifest()
    v = validation()
    d = service.decide(decision_id="release", target_hash=H, decision="RELEASE", actor_id="human",
        authenticated=True, manifest=m, product_validations=(v,), required_criteria=("c",))
    receipt = service.apply(approval_id="never-approved", target_hash=H, manifest=m, decision=d)
    assert not receipt.accepted and "APPLY_APPROVAL_REQUIRED" in receipt.reason_codes


def test_c14_manifest_cannot_accept_bare_pass_badges_without_gate_evidence():
    bare = EvidenceManifest(H, H, H, "environment", gate_results=tuple(GateResult(code, GateStatus.PASS, H) for code in ("G0", "G1", "G2", "G3")))
    assert not g.GateEngine(evidence_authority=HOST).evaluate_manifest(bare)[0]


def test_c14_baseline_failure_cannot_be_relabelled_pass_in_manifest():
    m = manifest()
    data = baseline(); data["baseline_tests"].update(status="FAIL", value={"passed": 0, "failed": 1, "skipped": 0})
    original = g.GateEngine(evidence_authority=HOST).baseline(target_hash=H, observations=data)
    forged = replace(original, status=GateStatus.PASS, reason_codes=())
    assert not g.GateEngine(evidence_authority=HOST).evaluate_manifest(replace(m, gate_results=(forged, *m.gate_results[1:])))[0]


@pytest.mark.parametrize("path,before,after,reason", [
    ("src/pnpm-lock.yaml", "old", "new", "DEPENDENCY_CHANGED"),
    ("src/poetry.lock", "old", "new", "DEPENDENCY_CHANGED"),
    ("src/settings.env", "", "API_KEY=" + "X" * 32, "SECRET_PATTERN"),
    ("src/settings.py", "", "password = '" + "X" * 32 + "'", "SECRET_PATTERN"),
    ("src/api.py", "class API:\n def call(self, x): pass\n", "class API:\n def call(self, x, y): pass\n", "PUBLIC_SURFACE_CHANGED"),
    ("src/api.py", "__all__ = ['one']\n", "__all__ = ['two']\n", "PUBLIC_SURFACE_CHANGED"),
])
def test_c14_g2_additional_detection_variants(path, before, after, reason):
    review = g.DiffReviewService().review(changed_paths=(path,), allowed_paths=("src",), changes=(g.DiffFile(path, before, after),))
    assert reason in review.reason_codes


def test_c14_g2_deterministic_findings_survive_reason_code_removal():
    review = g.DiffReviewService().review(changed_paths=("src/a.py",), allowed_paths=("src",),
        changes=(g.DiffFile("src/a.py", "x=1", None),),
        llm_findings=tuple(g.ReviewFinding(name, GateStatus.PASS, "review") for name in g.LLM_CHECKS))
    forged = replace(review, passed=True, reason_codes=())
    assert g.GateEngine(evidence_authority=HOST).change_review(target_hash=H, review=forged).status is GateStatus.FAIL


def release_setup():
    service = ReleaseApprovalService(evidence_authority=HOST); m = manifest()
    decision = service.decide(decision_id="decision", target_hash=H, decision="RELEASE", actor_id="human",
        authenticated=True, manifest=m, product_validations=(validation(),), required_criteria=("c",),
        decided_at=NOW, expires_at=NOW + timedelta(hours=1))
    approve(service, decision)
    return service, m, decision


def test_c14_release_cannot_mutate_registered_decision_to_extend_expiry():
    service, m, decision = release_setup()
    object.__setattr__(decision, "expires_at", NOW + timedelta(days=1))
    service.record_apply_approval(g.ApplyApprovalRecord("late", decision.decision_id, H, m.manifest_hash,
        "human", True, NOW, NOW + timedelta(days=1)))
    receipt = service.apply(approval_id="late", target_hash=H, manifest=m, decision=decision, at=NOW + timedelta(hours=2))
    assert not receipt.accepted and receipt.reason_codes == ("STALE_APPROVAL",)


@pytest.mark.parametrize("code", range(4))
@pytest.mark.parametrize("status", list(GateStatus))
def test_c14_exact_gates_all_five_statuses(code, status):
    m = manifest(); gates = list(m.gate_results); gates[code] = replace(gates[code], status=status)
    ok, reasons = g.GateEngine(evidence_authority=HOST).evaluate_manifest(replace(m, gate_results=tuple(gates)))
    assert ok is (status is GateStatus.PASS)
    if not ok: assert reasons == ("PASS_REQUIRED",)


@pytest.mark.parametrize("removed", range(4))
def test_c14_required_gate_removal_is_not_completion(removed):
    m = manifest()
    ok, reasons = g.GateEngine(evidence_authority=HOST).evaluate_manifest(replace(m, gate_results=m.gate_results[:removed] + m.gate_results[removed + 1:]))
    assert not ok and reasons == ("INVALID_GATE",)


@pytest.mark.parametrize("name,value", [
    ("repository_readable", "true"), ("branch_head", {"branch": "", "head": "a" * 40}),
    ("dirty_manifest", {"tracked": []}), ("runtime_versions", {"python": "unknown"}),
    ("baseline_tests", {"passed": 0, "failed": 0, "skipped": 0}), ("backend_health", 1),
])
def test_c14_g0_invalid_observation_cannot_pass(name, value):
    data = baseline(); data[name]["value"] = value
    result = g.GateEngine(evidence_authority=HOST).baseline(target_hash=H, observations=data)
    assert result.status is GateStatus.ERROR and result.reason_codes == ("BASELINE_INVALID",)


def test_c14_g1_only_detected_tools_run_and_evidence_is_bound():
    tools = (g.StaticTool("lint", ("lint", "src"), True, True, True, "1.0"),
        g.StaticTool("unknown", ("unknown",), False, False, False, ""))
    calls = []
    def runner(tool):
        calls.append(tool.name)
        return g.CommandEvidence(tool.name, tool.command, tool.version, 0, "command-ref")
    result = g.GateEngine(evidence_authority=HOST).static(target_hash=H, tools=tools, runner=runner)
    assert result.status is GateStatus.PASS and calls == ["lint"]
    assert result.details["commands"][0]["version"] == "1.0"
    result = g.GateEngine(evidence_authority=HOST).static(target_hash=H, tools=tools,
        runner=lambda tool: g.CommandEvidence("other", tool.command, tool.version, 0, "ref"))
    assert result.status is GateStatus.ERROR and result.reason_codes == ("TOOL_EXECUTION_ERROR",)


@pytest.mark.parametrize("installed,detected,reason", [(False, False, "TOOL_NOT_INSTALLED"), (True, False, "TOOL_NOT_DETECTED")])
def test_c14_g1_preflight_all_tools_before_first_dispatch(installed, detected, reason):
    tools = (g.StaticTool("ok", ("ok",), True, True, True, "1.0"),
        g.StaticTool("missing", ("missing",), True, detected, installed, "1.0" if installed else ""))
    calls = []
    result = g.GateEngine(evidence_authority=HOST).static(target_hash=H, tools=tools, runner=lambda tool: calls.append(tool))
    assert result.reason_codes == (reason,) and result.status is GateStatus.BLOCKED and not calls


@pytest.mark.parametrize("exit_code", [1, 127])
def test_c14_g1_nonzero_exit_is_fail(exit_code):
    tool = g.StaticTool("lint", ("lint",), True, True, True, "1.0")
    result = g.GateEngine(evidence_authority=HOST).static(target_hash=H, tools=(tool,),
        runner=lambda item: g.CommandEvidence(item.name, item.command, item.version, exit_code, "ref"))
    assert result.status is GateStatus.FAIL and result.reason_codes == ("STATIC_FAILED",)


@pytest.mark.parametrize("path", ["src/../outside.py", r"src\..\outside.py", "/src/a.py", "C:/src/a.py", "src2/a.py", "src/CON.py"])
def test_c14_g2_scope_escape_variants(path):
    review = g.DiffReviewService().review(changed_paths=(path,), allowed_paths=("src/**",), changes=(g.DiffFile(path, "x=1", "x=2"),))
    assert "DIFF_OUT_OF_SCOPE" in review.reason_codes


@pytest.mark.parametrize("path,before,after,reason", [
    ("src/a.py", "x=1", None, "DELETED_FILE"), ("src/b.js", "let x=1", None, "DELETED_FILE"),
    ("tests/test_a.py", "assert actual == expected", "assert True", "TEST_MODIFIED"),
    ("tests/a.spec.js", "it('works', run)", "it.skip('works', run)", "TEST_MODIFIED"),
    ("src/a.py", "x = 1\n" * 20, "x=1\n" * 20, "FORMATTER_DRIFT"),
    ("src/a.js", "let x = 1;\n" * 20, "let x=1;\n" * 20, "FORMATTER_DRIFT"),
])
def test_c14_g2_remaining_deterministic_variants(path, before, after, reason):
    review = g.DiffReviewService().review(changed_paths=(path,), allowed_paths=("src", "tests"), changes=(g.DiffFile(path, before, after),))
    assert reason in review.reason_codes
    assert all(f.status is GateStatus.FAIL for f in review.deterministic_findings)


def test_c14_g2_llm_incomplete_and_redacted_secret_evidence():
    secret = "X" * 32
    review = g.DiffReviewService().review(changed_paths=("src/key.py",), allowed_paths=("src",),
        changes=(g.DiffFile("src/key.py", "", "secret='" + secret + "'"),))
    assert secret not in repr(review)
    incomplete = g.DiffReviewService().review(changed_paths=("src/a.py",), allowed_paths=("src",), changes=(g.DiffFile("src/a.py", "x=1", "x=2"),))
    result = g.GateEngine(evidence_authority=HOST).change_review(target_hash=H, review=incomplete)
    assert result.status is GateStatus.BLOCKED and result.reason_codes == ("REVIEW_INCOMPLETE",)


@pytest.mark.parametrize("boundary", ["input", "store", "response", "ui"])
def test_c14_g3_each_actual_boundary_is_required_and_asserted(boundary):
    checks = {key: dict(value) for key, value in test_evidence().assertions.items()}
    del checks[boundary]
    result = g.GateEngine(evidence_authority=HOST).tests(target_hash=H, evidence=(test_evidence(assertions=checks),))
    assert result.status is GateStatus.BLOCKED and result.reason_codes == ("BOUNDARY_EVIDENCE_INCOMPLETE",)
    checks = {key: dict(value) for key, value in test_evidence().assertions.items()}
    checks[boundary]["observed"] = "wrong"
    result = g.GateEngine(evidence_authority=HOST).tests(target_hash=H, evidence=(test_evidence(assertions=checks),))
    assert result.status is GateStatus.FAIL and result.reason_codes == ("ASSERTION_FAILED",)


@pytest.mark.parametrize("requirement,reason", [("", "unavailable"), ("req", ""), ("req", "  ")])
def test_c14_g3_skip_requires_reason_and_requirement(requirement, reason):
    result = g.GateEngine(evidence_authority=HOST).tests(target_hash=H, evidence=(test_evidence(status=GateStatus.SKIPPED, requirement_id=requirement, skip_reason=reason),))
    assert result.status is GateStatus.ERROR and result.reason_codes == ("SKIP_CONTRACT_INVALID",)


def test_c14_g3_counts_and_valid_skip_never_pass():
    rows = tuple(test_evidence(test_id=status.value, status=status, skip_reason="requirement requires backend") for status in GateStatus)
    result = g.GateEngine(evidence_authority=HOST).tests(target_hash=H, evidence=rows)
    assert result.status is GateStatus.ERROR and dict(result.details["counts"]) == {status.value: 1 for status in GateStatus}
    result = g.GateEngine(evidence_authority=HOST).tests(target_hash=H, evidence=(rows[2],))
    assert result.status is GateStatus.SKIPPED


@pytest.mark.parametrize("authenticated,role", [(False, "HUMAN"), (1, "HUMAN"), ("yes", "HUMAN"), (True, "AGENT")])
def test_c14_release_and_apply_authentication_is_strict(authenticated, role):
    service = ReleaseApprovalService(evidence_authority=HOST); m = manifest()
    with pytest.raises(ValueError, match="UNAUTHENTICATED_ACTOR"):
        service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="agent", authenticated=authenticated,
            actor_role=role, manifest=m, product_validations=(validation(),), required_criteria=("c",))
    with pytest.raises(ValueError, match="UNAUTHENTICATED_ACTOR"):
        g.ApplyApprovalRecord("a", "d", H, m.manifest_hash, "agent", authenticated, NOW, NOW + timedelta(hours=1), actor_role=role)


@pytest.mark.parametrize("offset", [-1, 3600, 3601])
def test_c14_apply_half_open_validity(offset):
    service, m, decision = release_setup()
    result = service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW + timedelta(seconds=offset))
    assert not result.accepted and result.reason_codes == ("STALE_APPROVAL",)


@pytest.mark.parametrize("decision_value", ["REWORK", "DEFER", "REJECT"])
def test_c14_newer_nonrelease_decision_invalidates_old_approval(decision_value):
    service, m, decision = release_setup()
    service.decide(decision_id="new", target_hash=H, decision=decision_value, actor_id="human", authenticated=True,
        manifest=m, decided_at=NOW + timedelta(seconds=1))
    result = service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW + timedelta(seconds=2))
    assert result.reason_codes == ("STALE_APPROVAL",)


def test_c14_apply_revalidates_latest_defects_before_duplicate_success():
    service, m, decision = release_setup()
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW).accepted
    service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",),
        defects=(DefectAssessment("regression", H, True),))
    result = service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW)
    assert not result.accepted and result.reason_codes == ("BLOCKING_DEFECT",)


def test_c14_apply_revalidates_product_completion_and_preserves_criteria():
    service, m, decision = release_setup()
    service.record_validation_state(target_hash=H, product_validations=(), required_criteria=("c",))
    result = service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW)
    assert result.reason_codes == ("PRODUCT_VALIDATION_INCOMPLETE",)
    with pytest.raises(ValueError, match="PRODUCT_VALIDATION_INCOMPLETE"):
        service.record_validation_state(target_hash=H, product_validations=(), required_criteria=())
    with pytest.raises(ValueError, match="REQUIRED_CRITERIA_CHANGED"):
        service.record_validation_state(target_hash=H, product_validations=(validation("other"),), required_criteria=("other",))


def test_c14_apply_revocation_conflict_and_manifest_drift():
    service, m, decision = release_setup()
    changed = replace(m, environment_id="different")
    assert changed.manifest_hash != m.manifest_hash
    assert service.apply(approval_id="a", target_hash=H, manifest=changed, decision=decision, at=NOW).reason_codes == ("STALE_APPROVAL",)
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW).accepted
    approve(service, decision, "second")
    assert service.apply(approval_id="second", target_hash=H, manifest=m, decision=decision, at=NOW).reason_codes == ("REPLAY_CONFLICT",)
    service.revoke_apply_approval("a")
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW).reason_codes == ("STALE_APPROVAL",)
    with pytest.raises(ValueError, match="REPLAY_CONFLICT"): approve(service, decision)


@pytest.mark.parametrize("change", [dict(acquisition_mode="fixture"), dict(evidence_refs=()), dict(delivered_hash=canonical_hash({"wrong": 1})), dict(validated_at=NOW + timedelta(days=1))])
def test_c14_product_validation_cannot_promote_incomplete_evidence(change):
    service = ReleaseApprovalService(evidence_authority=HOST)
    with pytest.raises(ValueError, match="PRODUCT_VALIDATION_INCOMPLETE"):
        service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="human", authenticated=True, manifest=manifest(),
            product_validations=(replace(validation(), **change),), required_criteria=("c",), decided_at=NOW)


def test_c14_manifest_hash_is_deterministic_and_freezes_all_sources():
    first, second = manifest(), manifest()
    assert first.manifest_hash == second.manifest_hash
    exported = first.to_dict(); exported["gate_results"][0]["details"]["observations"]["backend_health"]["value"] = False
    assert first.manifest_hash == second.manifest_hash
    with pytest.raises(TypeError): first.gate_results[0].details["baseline_failure"] = True


def test_c14_baseline_hash_is_independent_of_mapping_insertion_order():
    data = baseline(); engine = g.GateEngine(evidence_authority=HOST)
    first = engine.baseline(target_hash=H, observations=data)
    second = engine.baseline(target_hash=H, observations=dict(reversed(tuple(data.items()))))
    assert canonical_hash(first.to_dict()) == canonical_hash(second.to_dict())


def test_c14_product_validation_environment_must_match_manifest():
    service = ReleaseApprovalService(evidence_authority=HOST)
    with pytest.raises(ValueError, match="PRODUCT_VALIDATION_INCOMPLETE"):
        service.decide(decision_id="d", target_hash=H, decision="RELEASE", actor_id="human", authenticated=True, manifest=manifest(),
            product_validations=(replace(validation(), environment_id="other-environment"),), required_criteria=("c",), decided_at=NOW)


def test_c14_review_never_claims_pass_without_five_llm_checks():
    review = g.DiffReviewService().review(changed_paths=("src/a.py",), allowed_paths=("src",), changes=(g.DiffFile("src/a.py", "x=1", "x=2"),))
    assert not review.passed


@pytest.mark.parametrize("variant", ["replace", "reconstruct"])
def test_c14_r1_target_relabel_cannot_reuse_host_evidence(variant):
    original = manifest(); other = canonical_hash({"artifact": "B"})
    if variant == "replace":
        forged = replace(original, target_hash=other, delivered_artifact_hash=other, verified_artifact_hash=other,
            gate_results=tuple(replace(item, target_hash=other) for item in original.gate_results))
    else:
        forged = EvidenceManifest(other, other, other, original.environment_id, acquisition_mode="real",
            gate_results=tuple(GateResult(item.gate_code, item.status, other, item.evidence_refs, item.reason_codes, item.details) for item in original.gate_results))
    assert not g.GateEngine(evidence_authority=HOST).evaluate_manifest(forged)[0]
    with pytest.raises(ValueError, match="PASS_REQUIRED"):
        ReleaseApprovalService(evidence_authority=HOST).decide(decision_id="forged", target_hash=other, decision="RELEASE", actor_id="human", authenticated=True,
            manifest=forged, product_validations=(replace(validation(), target_hash=other, delivered_hash=other),), required_criteria=("c",), decided_at=NOW)


@pytest.mark.parametrize("omitted", [(), (DefectAssessment("unrelated", H, False),)])
def test_c14_r1_omitting_blocking_defect_cannot_revive_duplicate_apply(omitted):
    service, m, decision = release_setup()
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW).accepted
    service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",), defects=(DefectAssessment("blocker", H, True),))
    service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",), defects=omitted)
    result = service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW)
    assert not result.accepted and result.reason_codes == ("BLOCKING_DEFECT",)


@pytest.mark.parametrize("path", ["src/requirements-dev.txt", "src/setup.py", "src/setup.cfg"])
def test_c14_r1_python_dependency_manifests_are_detected(path):
    review = g.DiffReviewService().review(changed_paths=(path,), allowed_paths=("src",), changes=(g.DiffFile(path, "old", "new"),))
    assert "DEPENDENCY_CHANGED" in review.reason_codes


def test_c14_r1_blocking_defect_cannot_close_without_independent_retest():
    service, m, decision = release_setup()
    service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",), defects=(DefectAssessment("blocker", H, True),))
    with pytest.raises(ValueError):
        service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",), defects=(DefectAssessment("blocker", H, True, "CLOSED"),))


def ready_defect(service):
    for status in ("OPEN", "ACCEPTED", "FIXING", "READY_FOR_RETEST"):
        service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",),
            defects=(DefectAssessment("blocker", H, True, status),))


def fresh_retest(*, authority=HOST, target=H, requirement="blocker", status=GateStatus.PASS):
    return g.GateEngine(evidence_authority=authority).tests(target_hash=target,
        evidence=(test_evidence(test_id="independent-retest-" + str(next(RETEST_IDS)), requirement_id=requirement, status=status),))


def test_c14_r1_same_target_unrelated_retest_cannot_close_defect():
    service, _, _ = release_setup(); ready_defect(service)
    result = fresh_retest(requirement="unrelated-criterion")
    with pytest.raises(ValueError, match="RETEST_EVIDENCE_INVALID"):
        service.record_defect_retest(target_hash=H, defect_id="blocker", gate_result=result, tester_id="independent", independent=True)


def test_c14_r1_independent_retest_closes_only_current_defect_revision():
    service, m, decision = release_setup(); ready_defect(service)
    with pytest.raises(ValueError, match="INDEPENDENT_RETEST_REQUIRED"):
        service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",),
            defects=(DefectAssessment("blocker", H, True, "CLOSED"),))
    result = fresh_retest()
    service.record_defect_retest(target_hash=H, defect_id="blocker", gate_result=result, tester_id="independent", independent=True)
    service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",),
        defects=(DefectAssessment("blocker", H, True, "CLOSED"),))
    assert service.apply(approval_id="a", target_hash=H, manifest=m, decision=decision, at=NOW).accepted
    history = service.defect_history(target_hash=H, defect_id="blocker")
    assert tuple(item.lifecycle for item in history) == ("OPEN", "ACCEPTED", "FIXING", "READY_FOR_RETEST", "CLOSED")
    object.__setattr__(history[-1], "lifecycle", "OPEN")
    assert service.defect_history(target_hash=H, defect_id="blocker")[-1].lifecycle == "CLOSED"
    ready_defect(service)
    with pytest.raises(ValueError, match="INDEPENDENT_RETEST_REQUIRED"):
        service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",),
            defects=(DefectAssessment("blocker", H, True, "CLOSED"),))
    with pytest.raises(ValueError, match="RETEST_EVIDENCE_INVALID"):
        service.record_defect_retest(target_hash=H, defect_id="blocker", gate_result=result, tester_id="independent", independent=True)


@pytest.mark.parametrize("variant", ["wrong-target", "stale", "failed", "same-author", "not-independent", "foreign-authority", "raw"])
def test_c14_r1_retest_admission_is_target_freshness_and_independence_bound(variant):
    service, _, _ = release_setup()
    old = fresh_retest(); ready_defect(service)
    result = fresh_retest()
    tester, independent, reason = "independent", True, "RETEST_EVIDENCE_INVALID"
    if variant == "wrong-target": result = fresh_retest(target=canonical_hash({"other": 1}))
    if variant == "stale": result = old
    if variant == "failed": result = fresh_retest(status=GateStatus.FAIL)
    if variant == "same-author": tester, reason = "developer", "INDEPENDENT_RETEST_REQUIRED"
    if variant == "not-independent": independent, reason = False, "INDEPENDENT_RETEST_REQUIRED"
    if variant == "foreign-authority": result = fresh_retest(authority=g.GateEvidenceAuthority())
    if variant == "raw": result = replace(result, evidence_id=None)
    with pytest.raises(ValueError, match=reason):
        service.record_defect_retest(target_hash=H, defect_id="blocker", gate_result=result, tester_id=tester, independent=independent)


def test_c14_r1_host_seal_required_even_when_raw_hash_can_be_computed():
    original = manifest()
    assert not g.GateEngine().evaluate_manifest(original)[0]
    other_host = g.GateEvidenceAuthority()
    assert not g.GateEngine(evidence_authority=other_host).evaluate_manifest(original)[0]
    raw = replace(original, seal_id=None)
    assert g.GateEngine(evidence_authority=HOST).evaluate_manifest(raw) == (False, ("MANIFEST_SEAL_INVALID",))
    with pytest.raises(ValueError, match="GATE_EVIDENCE_INVALID"):
        g.GateEngine(evidence_authority=other_host).issue_manifest(raw)
    with pytest.raises(ValueError, match="PASS_REQUIRED"):
        g.ReleaseApprovalService(evidence_authority=other_host).decide(decision_id="foreign", target_hash=H, decision="RELEASE",
            actor_id="human", authenticated=True, manifest=original, product_validations=(validation(),), required_criteria=("c",), decided_at=NOW)


@pytest.mark.parametrize("field", ["status", "target_hash", "details"])
def test_c14_r1_gate_identity_does_not_accept_mutated_payload(field):
    source = manifest().gate_results[0]
    changes = {"status": GateStatus.FAIL, "target_hash": canonical_hash({"B": 1}), "details": {}}
    forged = replace(source, **{field: changes[field]})
    assert not HOST.verify_gate(forged)


def test_c14_r1_omission_cannot_create_new_release_or_downgrade_blocker():
    service, m, _ = release_setup()
    service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",), defects=(DefectAssessment("blocker", H, True),))
    with pytest.raises(ValueError, match="BLOCKING_DEFECT"):
        service.decide(decision_id="new", target_hash=H, decision="RELEASE", actor_id="human", authenticated=True,
            manifest=m, product_validations=(validation(),), required_criteria=("c",), decided_at=NOW + timedelta(seconds=1))
    with pytest.raises(ValueError, match="DEFECT_IDENTITY_CHANGED"):
        service.record_validation_state(target_hash=H, product_validations=(validation(),), required_criteria=("c",), defects=(DefectAssessment("blocker", H, False),))
