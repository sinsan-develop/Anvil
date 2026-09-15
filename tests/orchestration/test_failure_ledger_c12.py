from concurrent.futures import ThreadPoolExecutor
from itertools import permutations
from threading import Event
from types import SimpleNamespace

import pytest

from packages.execution import ResultStatus
from packages.orchestration import (
    FailureLedger, FailureLedgerReasonCode, MainAgentTakeoverService,
)


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


@pytest.mark.parametrize("order", [(1, 2, 3, 4), (2, 3, 1, 4)])
def test_failure_count_stops_at_three_after_takeover_candidate_is_emitted(order):
    ledger = FailureLedger()
    for number in order[:3]:
        assert ledger.record(report(f"r-{number}")).accepted

    before_entries = ledger.entries
    before_projection = ledger.projection()
    rejected = ledger.record(report(f"r-{order[3]}"))

    assert not rejected.accepted
    assert rejected.reason_codes == (
        FailureLedgerReasonCode.TAKEOVER_ALREADY_REQUIRED.value,
    )
    assert ledger.entries == before_entries
    assert ledger.projection() == before_projection
    assert ledger.valid_failure_count == 3


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


def test_attempt_number_cannot_be_replayed_by_rotating_delegation_and_attempt_ids():
    ledger = FailureLedger()
    first = ledger.record(report(
        "rotation-1", delegation_id="delegation-a",
        attempt_id="attempt-a", attempt_number=7,
    ))
    rejected = ledger.record(report(
        "rotation-2", delegation_id="delegation-b",
        attempt_id="attempt-b", attempt_number=7,
    ))

    assert first.accepted and first.valid_failure_count == 1
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


def test_projection_is_canonical_across_report_order():
    reports = (
        report("r-1", lineage="lineage-B"),
        report("r-2", lineage="lineage-A"),
    )
    forward = FailureLedger()
    reverse = FailureLedger()
    for item in reports:
        assert forward.record(item).accepted
    for item in reversed(reports):
        assert reverse.record(item).accepted

    assert forward.projection() == reverse.projection()


def test_same_key_projection_and_replayed_receipts_are_canonical_across_report_order():
    reports = (
        report("r-1", attempt_id="attempt-1", attempt_number=1),
        report("r-2", attempt_id="attempt-2", attempt_number=2),
    )
    forward = FailureLedger()
    reverse = FailureLedger()
    for item in reports:
        assert forward.record(item).accepted
    for item in reversed(reports):
        assert reverse.record(item).accepted

    assert forward.projection() == reverse.projection()
    assert {
        item["result_id"]: forward.record(item).valid_failure_count
        for item in reports
    } == {
        item["result_id"]: reverse.record(item).valid_failure_count
        for item in reports
    }


def test_prepared_receipt_cannot_mutate_the_unpublished_next_state():
    ledger = FailureLedger()
    prepared = ledger.prepare(report("r-1"))

    capability = prepared._prepared
    if hasattr(capability, "next_state"):
        capability.next_state.counts.clear()

    assert ledger.commit_prepared(prepared)
    projection = ledger.projection()
    assert len(projection) == 1
    assert projection[0].valid_failure_count == 1
    assert projection[0].latest_result_id == "r-1"


def test_third_arrival_receipt_is_takeover_for_canonical_attempt_permutations():
    projections = []
    replay_counts = []
    for order in ((1, 2, 3), (2, 3, 1)):
        ledger = FailureLedger()
        receipts = [ledger.record(report(f"r-{number}")) for number in order]

        assert [item.valid_failure_count for item in receipts] == [1, 2, 3]
        assert [item.takeover_required for item in receipts] == [False, False, True]
        projections.append(ledger.projection())
        replay_counts.append({
            number: ledger.record(report(f"r-{number}")).valid_failure_count
            for number in (1, 2, 3)
        })

    assert projections[0] == projections[1]
    assert projections[0][0].latest_result_id == "r-3"
    assert replay_counts == [{1: 1, 2: 2, 3: 3}, {1: 1, 2: 2, 3: 3}]


def test_concurrent_callers_have_one_third_commit_takeover_receipt():
    ledger = FailureLedger()
    second_done = Event()
    third_done = Event()

    def record_after(wait_for, number, release):
        if wait_for is not None:
            assert wait_for.wait(timeout=2)
        receipt = ledger.record(report(f"r-{number}"))
        if release is not None:
            release.set()
        return receipt

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = (
            pool.submit(record_after, None, 2, second_done),
            pool.submit(record_after, second_done, 3, third_done),
            pool.submit(record_after, third_done, 1, None),
        )
        receipts = [future.result() for future in futures]

    assert [item.valid_failure_count for item in receipts] == [1, 2, 3]
    assert sum(item.takeover_required for item in receipts) == 1
    assert ledger.projection()[0].valid_failure_count == 3
    assert ledger.projection()[0].takeover_required


def test_canonical_takeover_candidate_receipt_is_available_only_at_count_three():
    ledger = FailureLedger()
    key = f"lineage-A|{FINGERPRINT}"
    assert ledger.takeover_candidate_receipt(key) is None
    assert ledger.record(report("r-2")).accepted
    assert ledger.takeover_candidate_receipt(key) is None
    assert ledger.record(report("r-3")).accepted
    assert ledger.takeover_candidate_receipt(key) is None
    assert ledger.record(report("r-1")).takeover_required

    candidate = ledger.takeover_candidate_receipt(key)

    assert candidate is not None
    assert candidate.accepted and not candidate.duplicate
    assert candidate.valid_failure_count == 3
    assert candidate.takeover_required
    assert candidate.failure_key == key
    assert candidate.entry.result_id == "r-3"
    assert candidate.entry.valid_failure_count == 3
    assert candidate.entry.takeover_required


def test_canonical_candidate_receipt_is_accepted_by_existing_c13_for_all_permutations():
    class Lifecycle:
        def current(self, session_id):
            return SimpleNamespace(session_id=session_id, delegation_id="del-1")

        def stop(self, session_id):
            return None

    class Leases:
        def __init__(self):
            self._workers = {
                "worker": SimpleNamespace(
                    run_id="run-1", execution_fencing_token="exec",
                )
            }

        def revoke_run(self, session_id, *, execution_token):
            return None

    class Tools:
        def revoke(self, session_id):
            return None

    key = f"lineage-A|{FINGERPRINT}"
    for order in permutations((1, 2, 3)):
        ledger = FailureLedger()
        for number in order:
            assert ledger.record(report(f"r-{number}")).accepted
        receipt = ledger.takeover_candidate_receipt(key)
        service = MainAgentTakeoverService(
            ledger, Lifecycle(), Leases(), Tools(),
        )

        takeover = service.takeover(
            receipt, session_id="run-1", expected_lineage="lineage-A",
            expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        )

        assert takeover.accepted
        assert takeover.packet.report_ids == ("r-1", "r-2", "r-3")


def test_storage_failure_before_publish_leaves_every_canonical_collection_unchanged():
    class FailingResults(dict):
        def copy(self):
            return type(self)(self)

        def __setitem__(self, key, value):
            raise RuntimeError("injected result storage failure")

    ledger = FailureLedger()
    assert ledger.record(report("r-1")).accepted
    ledger._results = FailingResults(ledger._results)
    before = (
        ledger.entries, ledger.projection(), ledger.valid_failure_count,
        ledger.takeover_candidates,
    )

    with pytest.raises(RuntimeError, match="injected result storage failure"):
        ledger.record(report("r-2"))

    assert (
        ledger.entries, ledger.projection(), ledger.valid_failure_count,
        ledger.takeover_candidates,
    ) == before


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
