from packages.execution import ResultStatus
from packages.orchestration import FailureLedger, FailureLedgerReasonCode


HASH = "sha256:" + "a" * 64


def report(result_id="r-1", lineage="lineage-A", fingerprint="failure-A", **changes):
    value = {
        "schema_version": "subagent_result/v1", "result_id": result_id,
        "delegation_id": "del-1", "attempt_id": result_id, "attempt_number": 1,
        "step_lineage_id": lineage, "status": ResultStatus.FAILURE_REPORT.value,
        "target_hash": HASH, "summary": "assertion failed", "actions_taken": ["inspect"],
        "changed_paths": ["packages/x.py"],
        "evidence_refs": [{"evidence_id": "ev-" + result_id, "checksum": HASH, "kind": "test"}],
        "tests": [{"command": "pytest", "status": "FAIL", "exit_code": 1}],
        "assumptions": [], "unresolved": ["repair"], "decision_needed": "repair",
        "failure_fingerprint": fingerprint,
        "handoff": {"problem_name": "assertion", "failure_stage": "test",
                     "confirmed_cause": "bad assertion", "alternatives_considered": ["retry"]},
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
    assert ledger.get("lineage-A|failure-A").takeover_required is True


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


def test_lineage_and_fingerprint_are_separate_counters():
    ledger = FailureLedger()
    ledger.record(report("r-1", lineage="lineage-A", fingerprint="same"))
    ledger.record(report("r-2", lineage="lineage-B", fingerprint="same"))
    ledger.record(report("r-3", lineage="lineage-A", fingerprint="other"))
    assert ledger.get("lineage-A|same").valid_failure_count == 1
    assert ledger.get("lineage-B|same").valid_failure_count == 1
    assert ledger.get("lineage-A|other").valid_failure_count == 1


def test_invalid_and_environment_quota_permission_reports_do_not_count():
    ledger = FailureLedger()
    cases = [
        report("bad-1", failure_fingerprint=None),
        report("bad-2", summary="quota exceeded"),
        report("bad-3", summary="permission denied"),
        report("bad-4", summary="environment unavailable"),
        report("bad-5", tests=[{"command": "pytest", "status": "PASS", "exit_code": 0}]),
    ]
    for item in cases:
        receipt = ledger.record(item)
        assert not receipt.accepted and receipt.valid_failure_count == 0
    assert ledger.valid_failure_count == 0
    assert not ledger.takeover_candidates
    assert all(not entry.accepted for entry in ledger.entries)


def test_malformed_input_fails_closed_without_ledger_mutation():
    ledger = FailureLedger()
    receipt = ledger.record({"status": "FAILURE_REPORT"})
    assert not receipt.accepted
    assert receipt.reason_codes == (FailureLedgerReasonCode.INVALID_FAILURE_REPORT.value,)
    assert ledger.entries == ()
