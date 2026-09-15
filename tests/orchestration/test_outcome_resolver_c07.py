from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier

import pytest

from packages.execution import DelegationStatus, ResultStatus, RunStatus
from packages.orchestration import (
    EvidenceReference, FailureLedger, FailureLedgerEntry, FailureLedgerReceipt,
    ResultEnvelope, ResultTest,
)
import packages.orchestration.outcome_resolver as outcome


HASH = "sha256:" + "a" * 64
OTHER_HASH = "sha256:" + "b" * 64
FINGERPRINT = "sha256:a658c9131e579ee8e83dc279fbeb7a943e2d7a7503e14010a950f2b4e1422b6e"


def test_c07_projection_and_context_types_are_public_orchestration_contracts():
    import packages.orchestration as orchestration

    for name in (
        "RunProjection", "StepAttemptProjection", "LeaseProjection",
        "OutcomeResolutionContext", "ResolverSnapshot", "ResolverRejectionEvent",
    ):
        assert getattr(orchestration, name) is getattr(outcome, name)


def envelope(status=ResultStatus.COMPLETED, **changes):
    value = dict(
        schema_version="subagent_result/v1", result_id="result-1",
        delegation_id="delegation-1", attempt_id="attempt-1", attempt_number=1,
        step_lineage_id="step-1", status=status, target_hash=HASH, summary="done",
        actions_taken=("inspect",), changed_paths=(),
        evidence_refs=(EvidenceReference("evidence-1", HASH),),
        tests=(ResultTest("pytest", "PASS", 0),), assumptions=(), unresolved=(),
        handoff={},
    )
    value.update(changes)
    return ResultEnvelope(**value)


def failure_envelope(**changes):
    value = dict(
        status=ResultStatus.FAILURE_REPORT, summary="assertion failed",
        changed_paths=("packages/x.py",),
        tests=(ResultTest("pytest tests/test_sample.py::test_case", "FAIL", 1),),
        unresolved=("repair",), decision_needed="repair",
        failure_fingerprint=FINGERPRINT,
        handoff={
            "problem_name": "assertion", "failure_stage": "test",
            "confirmed_cause": "bad assertion", "alternatives_considered": ("retry",),
            "normalized_error_code": "E_ASSERTION",
            "failing_test_or_gate": "pytest tests/test_sample.py::test_case",
            "relevant_stack_fingerprint": "stack:assert-equal",
            "failure_origin": "CODE_DEFECT",
        },
    )
    value.update(changes)
    return envelope(**value)


def context(**changes):
    value = dict(
        completion_guards_passed=False, lease_released=False,
        retry_budget_remaining=False, failure_receipt=None,
    )
    value.update(changes)
    return outcome.OutcomeResolutionContext(**value)


def resolver(
    *, step_state=outcome.StepState.RUNNING, run_status=RunStatus.ACTIVE,
    failure_ledger=None,
):
    service = outcome.DelegationOutcomeResolver(
        execution_fencing_token="exec-current", write_fencing_token="write-current",
        failure_ledger=failure_ledger,
    )
    service.register_run("run-1", run_status)
    service.register_step("step-1", run_id="run-1", state=step_state)
    service.register_attempt(
        "attempt-1", attempt_number=1, target_hash=HASH, step_lineage_id="step-1"
    )
    service.register_delegation(
        "delegation-1", attempt_id="attempt-1", status=DelegationStatus.REPORTING
    )
    service.register_lease("delegation-1")
    return service


def resolve(service, result, resolution_context=None, *, execution="exec-current", write="write-current"):
    return service.resolve(
        result, execution_fencing_token=execution, write_fencing_token=write,
        context=resolution_context or context(),
    )


def test_registered_attempt_and_delegation_bind_every_result_identity_field():
    service = resolver()
    before = service.snapshot()
    for candidate in (
        envelope(attempt_id="attempt-other"), envelope(attempt_number=2),
        envelope(target_hash=OTHER_HASH), envelope(step_lineage_id="step-other"),
    ):
        receipt = resolve(service, candidate, context(completion_guards_passed=True, lease_released=True))
        assert not receipt.accepted
        assert receipt.reason_codes == (outcome.ResolverReasonCode.RESULT_IDENTITY_MISMATCH.value,)
        assert service.snapshot() == before


def test_completed_requires_explicit_completion_and_lease_release_guards():
    for resolution_context, expected in (
        (context(lease_released=True), outcome.ResolverReasonCode.COMPLETION_GUARDS_FAILED),
        (context(completion_guards_passed=True), outcome.ResolverReasonCode.LEASE_RELEASE_REQUIRED),
    ):
        service = resolver()
        before = service.snapshot()
        receipt = resolve(service, envelope(), resolution_context)
        assert not receipt.accepted and expected.value in receipt.reason_codes
        assert service.snapshot() == before


def test_completed_commits_all_projections_and_one_outbox_event_at_one_sequence():
    service = resolver()
    receipt = resolve(service, envelope(), context(completion_guards_passed=True, lease_released=True))
    assert receipt.accepted and not receipt.duplicate
    assert receipt.step.state is outcome.StepState.COMPLETED
    assert receipt.attempt.result_id == "result-1"
    assert receipt.delegation.status is DelegationStatus.COMPLETED
    assert receipt.run.status is RunStatus.ACTIVE
    assert receipt.lease.released
    assert {receipt.step.event_sequence, receipt.attempt.event_sequence,
            receipt.delegation.event_sequence, receipt.run.event_sequence,
            receipt.lease.event_sequence} == {1}
    assert [(event.event_type, event.event_sequence) for event in receipt.events] == [
        ("DelegationResultAccepted", 1)
    ]
    assert service.events == receipt.events


def test_stale_missing_and_invalid_transition_rejections_do_not_mutate_canonical_state():
    for execution, write in ((None, "write-current"), ("exec-current", None), ("old", "write-current")):
        service = resolver()
        before = service.snapshot()
        receipt = resolve(
            service, envelope(), context(completion_guards_passed=True, lease_released=True),
            execution=execution, write=write,
        )
        assert not receipt.accepted
        assert service.snapshot() == before and service.events == ()

    service = resolver(step_state=outcome.StepState.COMPLETED)
    before = service.snapshot()
    receipt = resolve(service, envelope(), context(completion_guards_passed=True, lease_released=True))
    assert receipt.reason_codes == (outcome.ResolverReasonCode.INVALID_TRANSITION.value,)
    assert service.snapshot() == before


def test_concurrent_identical_result_is_accepted_once_and_all_other_calls_are_duplicates():
    service = resolver()
    completion = context(completion_guards_passed=True, lease_released=True)

    def call(_):
        return resolve(service, envelope(), completion)

    with ThreadPoolExecutor(max_workers=12) as pool:
        receipts = list(pool.map(call, range(24)))
    assert sum(item.accepted and not item.duplicate for item in receipts) == 1
    assert sum(item.accepted and item.duplicate for item in receipts) == 23
    assert len(service.events) == 1
    assert len(service.snapshot().accepted_results) == 1


def test_conflicting_same_result_id_fails_closed_without_a_second_event():
    service = resolver()
    completion = context(completion_guards_passed=True, lease_released=True)
    first = resolve(service, envelope(), completion)
    conflict = resolve(service, envelope(summary="different"), completion)
    assert first.accepted and not conflict.accepted
    assert conflict.reason_codes == (outcome.ResolverReasonCode.CONFLICTING_RESULT_ID.value,)
    assert service.events == first.events
    assert len(service.snapshot().accepted_results) == 1


def test_incomplete_reason_codes_have_distinct_transitions_and_retry_requires_budget():
    cases = (
        ("RESULT_CONTRACT_INCOMPLETE", context(), outcome.StepState.NEEDS_FIX, RunStatus.ACTIVE),
        ("TRANSIENT_EXECUTION_ERROR", context(retry_budget_remaining=True), outcome.StepState.RETRY_WAIT, RunStatus.ACTIVE),
        ("CHECKPOINTED_INTERRUPTION", context(), outcome.StepState.INTERRUPTED, RunStatus.INTERRUPTED),
    )
    for reason, resolution_context, step_state, run_status in cases:
        service = resolver()
        candidate = envelope(
            status=ResultStatus.INCOMPLETE, reason_code=reason, unresolved=("continue",),
            checkpoint_ref="checkpoint-1" if reason == "CHECKPOINTED_INTERRUPTION" else None,
        )
        receipt = resolve(service, candidate, resolution_context)
        assert receipt.accepted
        assert receipt.step.state is step_state and receipt.run.status is run_status

    service = resolver()
    before = service.snapshot()
    rejected = resolve(
        service,
        envelope(status=ResultStatus.INCOMPLETE, reason_code="TRANSIENT_EXECUTION_ERROR", unresolved=("retry",)),
    )
    assert rejected.reason_codes == (outcome.ResolverReasonCode.RETRY_BUDGET_EXHAUSTED.value,)
    assert service.snapshot() == before


def test_blocked_never_leaves_step_ready_and_projects_run_reason():
    for reason, run_status in (
        ("DECISION_REQUIRED", RunStatus.WAITING_DECISION),
        ("POLICY_BLOCKED", RunStatus.BLOCKED),
        ("ENVIRONMENT_BLOCKED", RunStatus.BLOCKED),
        ("PERMISSION_BLOCKED", RunStatus.BLOCKED),
    ):
        service = resolver()
        receipt = resolve(
            service,
            envelope(status=ResultStatus.BLOCKED, reason_code=reason, decision_needed="owner action"),
            context(lease_released=True),
        )
        assert receipt.accepted
        assert receipt.step.state is outcome.StepState.INTERRUPTED
        assert receipt.step.state is not outcome.StepState.READY
        assert receipt.run.status is run_status and receipt.lease.released


def test_terminal_run_statuses_reject_every_terminal_result_without_canonical_mutation():
    failure_ledger, failure_receipt, failure = _ledger_receipt(failure_envelope())
    cases = (
        (envelope(), context(completion_guards_passed=True, lease_released=True), None),
        (failure, context(failure_receipt=failure_receipt), failure_ledger),
        (envelope(status=ResultStatus.INCOMPLETE, reason_code="RESULT_CONTRACT_INCOMPLETE",
                  unresolved=("repair",)), context(), None),
        (envelope(status=ResultStatus.BLOCKED, reason_code="DECISION_REQUIRED",
                  decision_needed="owner action"), context(lease_released=True), None),
        (envelope(status=ResultStatus.CANCELLED, reason_code="RUN_CANCEL_REQUESTED",
                  unresolved=("cancel",)), context(), None),
    )
    for run_status in (
        RunStatus.CANCELLED, RunStatus.SUCCEEDED, RunStatus.FAILED,
        RunStatus.FINISHED_WITH_FAILURES, RunStatus.REJECTED, RunStatus.DISCARDED,
    ):
        for candidate, resolution_context, ledger in cases:
            service = resolver(run_status=run_status, failure_ledger=ledger)
            before = service.snapshot()
            rejected = resolve(service, candidate, resolution_context)
            assert not rejected.accepted
            assert rejected.reason_codes == (outcome.ResolverReasonCode.INVALID_TRANSITION.value,)
            assert service.snapshot() == before


def test_run_cancel_result_requires_cancel_requested_run_status():
    candidate = envelope(
        status=ResultStatus.CANCELLED, reason_code="RUN_CANCEL_REQUESTED",
        unresolved=("cancel",),
    )
    active = resolver()
    before = active.snapshot()
    rejected = resolve(active, candidate)
    assert not rejected.accepted
    assert rejected.reason_codes == (outcome.ResolverReasonCode.INVALID_TRANSITION.value,)
    assert active.snapshot() == before

    cancelling = resolver(run_status=RunStatus.CANCEL_REQUESTED)
    accepted = resolve(cancelling, candidate)
    assert accepted.accepted
    assert accepted.run.status is RunStatus.CANCELLED


@pytest.mark.parametrize("paused_status", [RunStatus.PAUSED_USER, RunStatus.PAUSED_QUOTA])
def test_checkpointed_interruption_preserves_explicit_pause_status(paused_status):
    service = resolver(run_status=paused_status)
    receipt = resolve(
        service,
        envelope(status=ResultStatus.INCOMPLETE, reason_code="CHECKPOINTED_INTERRUPTION",
                 unresolved=("resume",), checkpoint_ref="checkpoint-1"),
    )
    assert receipt.accepted
    assert receipt.step.state is outcome.StepState.INTERRUPTED
    assert receipt.run.status is paused_status


@pytest.mark.parametrize("paused_status", [RunStatus.PAUSED_USER, RunStatus.PAUSED_QUOTA])
def test_paused_run_rejects_every_non_checkpoint_result_without_canonical_mutation(paused_status):
    first_ledger, first_receipt, first_failure = _ledger_receipt(failure_envelope())
    third_ledger, third_receipt, third_failure = _ledger_receipt(failure_envelope(), count=3)
    cases = (
        (envelope(), context(completion_guards_passed=True, lease_released=True), None),
        (first_failure, context(failure_receipt=first_receipt), first_ledger),
        (third_failure, context(failure_receipt=third_receipt), third_ledger),
        (envelope(status=ResultStatus.INCOMPLETE, reason_code="RESULT_CONTRACT_INCOMPLETE",
                  unresolved=("repair",)), context(), None),
        (envelope(status=ResultStatus.INCOMPLETE, reason_code="TRANSIENT_EXECUTION_ERROR",
                  unresolved=("retry",)), context(retry_budget_remaining=True), None),
        (envelope(status=ResultStatus.BLOCKED, reason_code="DECISION_REQUIRED",
                  decision_needed="owner action"), context(lease_released=True), None),
        (envelope(status=ResultStatus.BLOCKED, reason_code="POLICY_BLOCKED",
                  decision_needed="policy"), context(lease_released=True), None),
        (envelope(status=ResultStatus.BLOCKED, reason_code="ENVIRONMENT_BLOCKED",
                  decision_needed="environment"), context(lease_released=True), None),
        (envelope(status=ResultStatus.BLOCKED, reason_code="PERMISSION_BLOCKED",
                  decision_needed="permission"), context(lease_released=True), None),
        (envelope(status=ResultStatus.CANCELLED, reason_code="RUN_CANCEL_REQUESTED",
                  unresolved=("cancel",)), context(), None),
        (envelope(status=ResultStatus.CANCELLED, reason_code="DELEGATION_REASSIGN",
                  unresolved=("reassign",)), context(), None),
    )
    for candidate, resolution_context, ledger in cases:
        service = (
            failure_resolver(candidate, run_status=paused_status, failure_ledger=ledger)
            if candidate.status is ResultStatus.FAILURE_REPORT
            else resolver(run_status=paused_status)
        )
        before = service.snapshot()
        rejected = resolve(service, candidate, resolution_context)
        assert not rejected.accepted
        assert rejected.reason_codes == (outcome.ResolverReasonCode.INVALID_TRANSITION.value,)
        assert service.snapshot() == before


def _ledger_receipt(candidate, *, count=1):
    ledger = FailureLedger()
    receipt = None
    for number in range(1, count + 1):
        current = replace(
            candidate, result_id=f"result-{number}", attempt_id=f"attempt-{number}",
            attempt_number=number,
            evidence_refs=(EvidenceReference(f"evidence-{number}", HASH),),
        )
        receipt = ledger.prepare(current) if number == count else ledger.record(current)
    return ledger, receipt, current


def failure_resolver(
    candidate, *, run_status=RunStatus.ACTIVE, failure_ledger=None,
    resolver_type=outcome.DelegationOutcomeResolver,
):
    service = resolver_type(
        execution_fencing_token="exec-current", write_fencing_token="write-current",
        failure_ledger=failure_ledger,
    )
    service.register_run("run-1", run_status)
    service.register_step("step-1", run_id="run-1", state=outcome.StepState.RUNNING)
    service.register_attempt(
        candidate.attempt_id, attempt_number=candidate.attempt_number,
        target_hash=HASH, step_lineage_id="step-1",
    )
    service.register_delegation(
        "delegation-1", attempt_id=candidate.attempt_id, status=DelegationStatus.REPORTING
    )
    service.register_lease("delegation-1")
    return service


def test_failure_report_consumes_matching_immutable_c12_receipt_for_counts_one_two_three():
    expected = (
        (1, outcome.StepState.NEEDS_FIX, RunStatus.ACTIVE, ("DelegationResultAccepted",)),
        (2, outcome.StepState.NEEDS_FIX, RunStatus.ACTIVE, ("DelegationResultAccepted",)),
        (3, outcome.StepState.MAIN_AGENT_TAKEOVER_REQUIRED, RunStatus.INTERRUPTED,
         ("DelegationResultAccepted", "MainAgentTakeoverRequired")),
    )
    for count, step_state, run_status, event_types in expected:
        ledger, receipt_from_ledger, candidate = _ledger_receipt(failure_envelope(), count=count)
        service = failure_resolver(candidate, failure_ledger=ledger)
        accepted = resolve(service, candidate, context(failure_receipt=receipt_from_ledger))
        assert accepted.accepted
        assert accepted.step.state is step_state and accepted.run.status is run_status
        assert tuple(event.event_type for event in accepted.events) == event_types
        assert ledger.valid_failure_count == count
        assert ledger.entries[-1].result_id == candidate.result_id


def test_three_report_permutations_emit_exactly_one_takeover_candidate_event():
    projections = []
    for order in ((1, 2, 3), (2, 3, 1)):
        ledger = FailureLedger()
        receipts = []
        event_types = []
        for number in order:
            candidate = replace(
                failure_envelope(), result_id=f"result-{number}",
                attempt_id=f"attempt-{number}", attempt_number=number,
                evidence_refs=(EvidenceReference(f"evidence-{number}", HASH),),
            )
            prepared = ledger.prepare(candidate)
            service = failure_resolver(candidate, failure_ledger=ledger)
            accepted = resolve(service, candidate, context(failure_receipt=prepared))
            assert accepted.accepted
            receipts.append(prepared)
            event_types.extend(event.event_type for event in accepted.events)

        assert [item.valid_failure_count for item in receipts] == [1, 2, 3]
        assert event_types.count("MainAgentTakeoverRequired") == 1
        takeover_event = next(
            event for event in service.events
            if event.event_type == "MainAgentTakeoverRequired"
        )
        assert takeover_event.payload["failure_key"] == f"step-1|{FINGERPRINT}"
        projections.append(ledger.projection())

    assert projections[0] == projections[1]
    assert projections[0][0].latest_result_id == "result-3"


@pytest.mark.parametrize("store_name", ["_runs", "_steps"])
def test_resolver_storage_failure_keeps_ledger_and_c07_canonical_state_unchanged(store_name):
    class FailingStore(dict):
        def copy(self):
            return type(self)(self)

        def __setitem__(self, key, value):
            raise RuntimeError(f"injected {store_name} storage failure")

    ledger, prepared, candidate = _ledger_receipt(failure_envelope())
    service = failure_resolver(candidate, failure_ledger=ledger)
    setattr(service, store_name, FailingStore(getattr(service, store_name)))
    before = service.snapshot()

    with pytest.raises(RuntimeError, match="injected .* storage failure"):
        resolve(service, candidate, context(failure_receipt=prepared))

    assert service.snapshot() == before
    assert ledger.entries == ()
    assert ledger.projection() == ()


def test_ledger_state_swap_failure_rolls_back_already_published_resolver_state():
    class ExplodingLedger(FailureLedger):
        def __init__(self):
            self.explode_on_state_swap = False
            super().__init__()

        def __setattr__(self, name, value):
            if name == "_state" and getattr(self, "explode_on_state_swap", False):
                object.__setattr__(self, "explode_on_state_swap", False)
                raise RuntimeError("injected ledger state swap failure")
            super().__setattr__(name, value)

    ledger = ExplodingLedger()
    candidate = failure_envelope()
    prepared = ledger.prepare(candidate)
    service = failure_resolver(candidate, failure_ledger=ledger)
    before = service.snapshot()
    ledger.explode_on_state_swap = True

    with pytest.raises(RuntimeError, match="injected ledger state swap failure"):
        resolve(service, candidate, context(failure_receipt=prepared))

    assert service.snapshot() == before
    assert service.events == ()
    assert ledger.entries == ()
    assert ledger.projection() == ()
    assert ledger.verify_prepared(prepared)

    retried = resolve(service, candidate, context(failure_receipt=prepared))

    assert retried.accepted
    assert ledger.valid_failure_count == 1
    assert len(service.events) == 1


def test_ledger_state_swap_then_failure_restores_both_states_and_prepared_retry():
    class ExplodingAfterSwapLedger(FailureLedger):
        def __init__(self):
            self.explode_after_state_swap = False
            super().__init__()

        def __setattr__(self, name, value):
            super().__setattr__(name, value)
            if name == "_state" and getattr(self, "explode_after_state_swap", False):
                object.__setattr__(self, "explode_after_state_swap", False)
                raise RuntimeError("injected failure after ledger state swap")

    ledger = ExplodingAfterSwapLedger()
    candidate = failure_envelope()
    prepared = ledger.prepare(candidate)
    service = failure_resolver(candidate, failure_ledger=ledger)
    before = service.snapshot()
    ledger.explode_after_state_swap = True

    with pytest.raises(RuntimeError, match="injected failure after ledger state swap"):
        resolve(service, candidate, context(failure_receipt=prepared))

    assert service.snapshot() == before
    assert service.events == ()
    assert ledger.entries == ()
    assert ledger.projection() == ()
    assert ledger.verify_prepared(prepared)

    retried = resolve(service, candidate, context(failure_receipt=prepared))

    assert retried.accepted
    assert ledger.valid_failure_count == 1
    assert len(service.events) == 1


@pytest.mark.parametrize("after_swap", (False, True), ids=("before-swap", "after-swap"))
def test_resolver_state_swap_failure_preserves_transaction_and_prepared_retry(after_swap):
    class ExplodingResolver(outcome.DelegationOutcomeResolver):
        def __init__(self, **kwargs):
            object.__setattr__(self, "explode_after_state_swap", None)
            super().__init__(**kwargs)

        def __setattr__(self, name, value):
            explosion = getattr(self, "explode_after_state_swap", None)
            if name == "_state" and explosion is not None:
                object.__setattr__(self, "explode_after_state_swap", None)
                if explosion:
                    object.__setattr__(self, name, value)
                raise RuntimeError("injected resolver state swap failure")
            super().__setattr__(name, value)

    ledger, prepared, candidate = _ledger_receipt(failure_envelope())
    service = failure_resolver(
        candidate, failure_ledger=ledger, resolver_type=ExplodingResolver,
    )
    before = service.snapshot()
    service.explode_after_state_swap = after_swap

    with pytest.raises(RuntimeError, match="injected resolver state swap failure"):
        resolve(service, candidate, context(failure_receipt=prepared))

    assert service.snapshot() == before
    assert service.events == ()
    assert ledger.entries == ()
    assert ledger.projection() == ()
    assert ledger.verify_prepared(prepared)

    retried = resolve(service, candidate, context(failure_receipt=prepared))

    assert retried.accepted
    assert ledger.valid_failure_count == 1
    assert len(service.events) == 1


def test_normal_failure_commit_and_concurrent_readers_finish_without_deadlock():
    ledger, prepared, candidate = _ledger_receipt(failure_envelope())
    service = failure_resolver(candidate, failure_ledger=ledger)
    start = Barrier(3)

    def commit():
        start.wait(timeout=2)
        return resolve(service, candidate, context(failure_receipt=prepared))

    def read_ledger():
        start.wait(timeout=2)
        return tuple(ledger.projection() for _ in range(100))

    def read_resolver():
        start.wait(timeout=2)
        return tuple(service.snapshot() for _ in range(100))

    with ThreadPoolExecutor(max_workers=3) as pool:
        commit_future = pool.submit(commit)
        ledger_future = pool.submit(read_ledger)
        resolver_future = pool.submit(read_resolver)
        accepted = commit_future.result(timeout=3)
        ledger_reads = ledger_future.result(timeout=3)
        resolver_reads = resolver_future.result(timeout=3)

    assert accepted.accepted
    assert ledger_reads and resolver_reads
    assert ledger.valid_failure_count == 1
    assert len(service.events) == 1


def test_failure_receipt_without_configured_ledger_authority_fails_closed():
    ledger, ledger_receipt, candidate = _ledger_receipt(failure_envelope())
    service = failure_resolver(candidate)
    before = service.snapshot()

    rejected = resolve(service, candidate, context(failure_receipt=ledger_receipt))

    assert not rejected.accepted
    assert rejected.reason_codes == (
        outcome.ResolverReasonCode.FAILURE_CONTEXT_MISMATCH.value,
    )
    assert service.snapshot() == before
    assert ledger.entries == ()


def test_standalone_record_receipt_cannot_be_reused_for_c07_transaction():
    ledger = FailureLedger()
    candidate = failure_envelope()
    committed = ledger.record(candidate)
    service = failure_resolver(candidate, failure_ledger=ledger)
    before = service.snapshot()

    rejected = resolve(service, candidate, context(failure_receipt=committed))

    assert rejected.reason_codes == (
        outcome.ResolverReasonCode.FAILURE_CONTEXT_MISMATCH.value,
    )
    assert service.snapshot() == before
    assert ledger.valid_failure_count == 1


def test_self_consistent_receipt_not_issued_by_authoritative_ledger_is_rejected():
    candidate = failure_envelope()
    forged_entry = FailureLedgerEntry(
        sequence=1, result_id=candidate.result_id,
        result_hash=candidate.canonical_hash,
        step_lineage_id=candidate.step_lineage_id,
        failure_fingerprint=candidate.failure_fingerprint,
        accepted=True, valid_failure_count=3, takeover_required=True,
    )
    forged = FailureLedgerReceipt(
        accepted=True, valid_failure_count=3, takeover_required=True,
        failure_key=f"{candidate.step_lineage_id}|{candidate.failure_fingerprint}",
        entry=forged_entry,
    )
    authority = FailureLedger()
    service = failure_resolver(candidate, failure_ledger=authority)
    before = service.snapshot()

    rejected = resolve(service, candidate, context(failure_receipt=forged))

    assert not rejected.accepted
    assert rejected.reason_codes == (
        outcome.ResolverReasonCode.FAILURE_CONTEXT_MISMATCH.value,
    )
    assert service.snapshot() == before
    assert authority.entries == ()


def test_receipt_behind_authoritative_ledger_latest_count_is_rejected():
    ledger = FailureLedger()
    first = failure_envelope()
    stale = ledger.record(first)
    second = replace(
        first, result_id="result-2", attempt_id="attempt-2", attempt_number=2,
        evidence_refs=(EvidenceReference("evidence-2", HASH),),
    )
    assert ledger.record(second).valid_failure_count == 2
    service = failure_resolver(first, failure_ledger=ledger)
    before = service.snapshot()

    rejected = resolve(service, first, context(failure_receipt=stale))

    assert not rejected.accepted
    assert rejected.reason_codes == (
        outcome.ResolverReasonCode.FAILURE_CONTEXT_MISMATCH.value,
    )
    assert service.snapshot() == before
    assert ledger.valid_failure_count == 2


def test_c07_rejections_never_publish_prepared_failure_to_ledger():
    cases = (
        ("fencing", outcome.ResolverReasonCode.STALE_FENCING_TOKEN.value),
        ("identity", outcome.ResolverReasonCode.RESULT_IDENTITY_MISMATCH.value),
        ("transition", outcome.ResolverReasonCode.INVALID_TRANSITION.value),
    )
    for mode, reason in cases:
        ledger = FailureLedger()
        candidate = failure_envelope()
        receipt = ledger.prepare(candidate)
        service = (
            resolver(step_state=outcome.StepState.COMPLETED, failure_ledger=ledger)
            if mode == "transition"
            else failure_resolver(candidate, failure_ledger=ledger)
        )
        before = service.snapshot()
        actual = (
            replace(candidate, attempt_id="attempt-other")
            if mode == "identity"
            else candidate
        )

        rejected = resolve(
            service, actual, context(failure_receipt=receipt),
            execution="stale" if mode == "fencing" else "exec-current",
        )

        assert not rejected.accepted
        assert rejected.reason_codes == (reason,)
        assert service.snapshot() == before
        assert ledger.entries == ()
        assert ledger.valid_failure_count == 0


def test_failure_context_identity_or_count_mismatch_fails_closed():
    ledger, ledger_receipt, candidate = _ledger_receipt(failure_envelope())
    mutations = (
        replace(ledger_receipt, valid_failure_count=0),
        replace(ledger_receipt, valid_failure_count=4),
        replace(ledger_receipt, entry=replace(ledger_receipt.entry, result_id="other")),
        replace(ledger_receipt, entry=replace(ledger_receipt.entry, result_hash=OTHER_HASH)),
        replace(ledger_receipt, entry=replace(ledger_receipt.entry, step_lineage_id="other")),
        replace(ledger_receipt, entry=replace(ledger_receipt.entry, failure_fingerprint=OTHER_HASH)),
        replace(ledger_receipt, entry=replace(ledger_receipt.entry, accepted=False)),
        replace(ledger_receipt, valid_failure_count=True,
                entry=replace(ledger_receipt.entry, valid_failure_count=True)),
        replace(ledger_receipt, takeover_required=1,
                entry=replace(ledger_receipt.entry, takeover_required=1)),
        replace(ledger_receipt, _prepared=[]),
    )
    for failure_receipt in mutations:
        service = failure_resolver(candidate, failure_ledger=ledger)
        before = service.snapshot()
        rejected = resolve(service, candidate, context(failure_receipt=failure_receipt))
        assert not rejected.accepted
        assert outcome.ResolverReasonCode.FAILURE_CONTEXT_MISMATCH.value in rejected.reason_codes
        assert service.snapshot() == before


@pytest.mark.parametrize("invalid_entry", [{}, "invalid", 1])
def test_non_failure_ledger_entry_type_is_rejected_without_exception_or_canonical_mutation(invalid_entry):
    ledger, ledger_receipt, candidate = _ledger_receipt(failure_envelope())
    malformed = replace(ledger_receipt, entry=invalid_entry)
    service = failure_resolver(candidate, failure_ledger=ledger)
    before = service.snapshot()
    try:
        rejected = resolve(service, candidate, context(failure_receipt=malformed))
    except Exception as error:  # pragma: no cover - the assertion is the contract
        pytest.fail(f"resolver leaked {type(error).__name__}: {error}")
    assert not rejected.accepted
    assert rejected.reason_codes == (outcome.ResolverReasonCode.FAILURE_CONTEXT_MISMATCH.value,)
    assert tuple(event.event_type for event in rejected.rejection_events) == (
        "DelegationResultRejected", "ResultCorrectionRequest"
    )
    assert service.snapshot() == before


def test_invalid_failure_report_emits_separate_rejection_and_correction_without_pollution():
    service = resolver()
    before = service.snapshot()
    rejected = resolve(service, failure_envelope(failure_fingerprint=None))
    assert not rejected.accepted
    assert outcome.ResolverReasonCode.INVALID_RESULT.value in rejected.reason_codes
    assert "INVALID_FINGERPRINT" in rejected.reason_codes
    assert tuple(event.event_type for event in rejected.rejection_events) == (
        "DelegationResultRejected", "ResultCorrectionRequest"
    )
    assert service.snapshot() == before and service.events == ()
    assert len(service.rejection_events) == 2


def test_attempt_allows_at_most_one_delegation_and_registration_checks_explicit_lineage():
    service = outcome.DelegationOutcomeResolver(
        execution_fencing_token="exec-current", write_fencing_token="write-current"
    )
    service.register_run("run-1", RunStatus.ACTIVE)
    service.register_step("step-1", run_id="run-1", state=outcome.StepState.RUNNING)
    service.register_attempt(
        "attempt-1", attempt_number=1, target_hash=HASH, step_lineage_id="step-1"
    )
    first = service.register_delegation(
        "delegation-1", step_lineage_id="step-1", attempt_id="attempt-1",
        status=DelegationStatus.REPORTING,
    )
    assert service.register_delegation(
        "delegation-1", step_lineage_id="step-1", attempt_id="attempt-1",
        status=DelegationStatus.REPORTING,
    ) is first
    with pytest.raises(ValueError, match="already has a delegation"):
        service.register_delegation(
            "delegation-2", step_lineage_id="step-1", attempt_id="attempt-1",
            status=DelegationStatus.REPORTING,
        )

    other = outcome.DelegationOutcomeResolver(
        execution_fencing_token="exec-current", write_fencing_token="write-current"
    )
    other.register_run("run-1", RunStatus.ACTIVE)
    other.register_step("step-1", run_id="run-1", state=outcome.StepState.RUNNING)
    other.register_attempt(
        "attempt-1", attempt_number=1, target_hash=HASH, step_lineage_id="step-1"
    )
    with pytest.raises(ValueError, match="lineage"):
        other.register_delegation(
            "delegation-1", step_lineage_id="step-other", attempt_id="attempt-1",
            status=DelegationStatus.REPORTING,
        )
