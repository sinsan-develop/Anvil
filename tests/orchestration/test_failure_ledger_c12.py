from packages.execution import ResultStatus
from packages.orchestration import FailureLedger, FailureLedgerReasonCode


HASH = "sha256:" + "a" * 64
FINGERPRINT = "sha256:a658c9131e579ee8e83dc279fbeb7a943e2d7a7503e14010a950f2b4e1422b6e"
OTHER_FINGERPRINT = "sha256:02e743a1f0198c6dd2b752914a21f90f76c3ad2ef9625fc4e083969d2a8745e5"


def report(
    result_id="r-1",
    lineage="lineage-A",
    fingerprint=FINGERPRINT,
    error_code="E_ASSERTION",
    failure_origin="CODE_DEFECT",
    attempt_number=None,
    **changes,
):
    if attempt_number is None:
        attempt_number = int(result_id.rsplit("-", 1)[-1])
    value = {
        "schema_version": "subagent_result/v1", "result_id": result_id,
        "delegation_id": "del-1", "attempt_id": result_id, "attempt_number": attempt_number,
        "step_lineage_id": lineage, "status": ResultStatus.FAILURE_REPORT.value,
        "target_hash": HASH, "summary": "assertion failed", "actions_taken": ["inspect"],
        "changed_paths": ["packages/x.py"],
        "evidence_refs": [{"evidence_id": "ev-" + result_id, "checksum": HASH, "kind": "test"}],
        "tests": [{"command": "pytest tests/test_sample.py::test_case", "status": "FAIL", "exit_code": 1}],
        "assumptions": [], "unresolved": ["repair"], "decision_needed": "repair",
        "failure_fingerprint": fingerprint,
        "handoff": {
            "problem_name": "assertion",
            "failure_stage": "test",
            "confirmed_cause": "bad assertion",
            "alternatives_considered": ["retry"],
            "normalized_error_code": error_code,
            "failing_test_or_gate": "pytest tests/test_sample.py::test_case",
            "relevant_stack_fingerprint": "stack:assert-equal",
            "failure_origin": failure_origin,
        },
    }
    value.update(changes)
    return value


def test_only_valid_same_key_counts_one_two_three_and_candidate_signal():
    ledger = FailureLedger()
    assert ledger.record(report("r-1")).valid_failure_count == 1
    assert ledger.record(report("r-2")).valid_failure_count == 2
    third = ledger.record(report("r-3"))
    assert third.valid_failure_count == 3
    assert third.takeover_required is True
    assert len(ledger.takeover_candidates) == 1
    # C-12 only emits a signal; no lease or tool mutation exists here.
    assert ledger.get(f"lineage-A|{FINGERPRINT}").takeover_required is True


def test_replay_is_idempotent_and_conflicting_replay_is_rejected():
    ledger = FailureLedger()
    first = ledger.record(report("r-1"))
    replay = ledger.record(report("r-1"))
    assert replay.accepted and replay.duplicate
    assert ledger.valid_failure_count == 1 and len(ledger.entries) == 1

    conflict = ledger.record(report("r-1", summary="different payload"))
    assert not conflict.accepted
    assert FailureLedgerReasonCode.CONFLICTING_REPLAY.value in conflict.reason_codes
    assert ledger.valid_failure_count == 1 and len(ledger.entries) == 1


def test_one_attempt_cannot_increment_count_by_rotating_result_id():
    ledger = FailureLedger()
    first = ledger.record(report("spam-1", attempt_id="same-attempt", attempt_number=1))
    second = ledger.record(report("spam-2", attempt_id="same-attempt", attempt_number=1))
    third = ledger.record(report("spam-3", attempt_id="same-attempt", attempt_number=1))

    assert first.accepted and first.valid_failure_count == 1
    assert not second.accepted and not third.accepted
    assert second.reason_codes == third.reason_codes == (FailureLedgerReasonCode.CONFLICTING_REPLAY.value,)
    assert ledger.valid_failure_count == 1
    assert len(ledger.entries) == 1
    assert not ledger.takeover_candidates


def test_attempt_identity_cannot_be_rotated_one_component_at_a_time():
    for reports in (
        [
            report("number-1", attempt_id="attempt-a", attempt_number=7),
            report("number-2", attempt_id="attempt-b", attempt_number=7),
        ],
        [
            report("id-1", attempt_id="attempt-fixed", attempt_number=7),
            report("id-2", attempt_id="attempt-fixed", attempt_number=8),
        ],
    ):
        ledger = FailureLedger()
        assert ledger.record(reports[0]).accepted
        rejected = ledger.record(reports[1])
        assert not rejected.accepted
        assert rejected.reason_codes == (FailureLedgerReasonCode.CONFLICTING_REPLAY.value,)
        assert ledger.valid_failure_count == 1
        assert len(ledger.entries) == 1


def test_lineage_and_fingerprint_are_separate_counters():
    ledger = FailureLedger()
    ledger.record(report("r-1", lineage="lineage-A"))
    ledger.record(report("r-2", lineage="lineage-B"))
    ledger.record(report("r-3", lineage="lineage-A", fingerprint=OTHER_FINGERPRINT, error_code="E_OTHER"))
    assert ledger.get(f"lineage-A|{FINGERPRINT}").valid_failure_count == 1
    assert ledger.get(f"lineage-B|{FINGERPRINT}").valid_failure_count == 1
    assert ledger.get(f"lineage-A|{OTHER_FINGERPRINT}").valid_failure_count == 1


def test_invalid_and_environment_quota_permission_reports_do_not_count():
    ledger = FailureLedger()
    cases = [
        report("bad-1", failure_fingerprint=None),
        report("bad-2", failure_origin="QUOTA_EXHAUSTED"),
        report("bad-3", failure_origin="PERMISSION_BLOCKED"),
        report("bad-4", failure_origin="ENVIRONMENT_BLOCKED"),
        report("bad-5", tests=[{"command": "pytest", "status": "PASS", "exit_code": 0}]),
    ]
    for item in cases:
        receipt = ledger.record(item)
        assert not receipt.accepted and receipt.valid_failure_count == 0
        assert receipt.entry is None
    assert ledger.valid_failure_count == 0
    assert not ledger.takeover_candidates
    assert ledger.entries == ()
    assert ledger.projection() == ()

    corrected = ledger.record(report("bad-1"))
    assert corrected.accepted and corrected.valid_failure_count == 1
    assert len(ledger.entries) == 1


def test_malformed_input_fails_closed_without_ledger_mutation():
    ledger = FailureLedger()
    receipt = ledger.record({"status": "FAILURE_REPORT"})
    assert not receipt.accepted
    assert receipt.reason_codes == (FailureLedgerReasonCode.INVALID_FAILURE_REPORT.value,)
    assert ledger.entries == ()
