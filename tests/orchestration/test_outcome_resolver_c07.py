from datetime import datetime, timezone

from packages.execution import DelegationStatus, ResultStatus
from packages.orchestration import EvidenceReference, ResultEnvelope, ResultTest
from packages.orchestration.outcome_resolver import (
    DelegationOutcomeResolver, ResolverReasonCode, StepState,
)

HASH = "sha256:" + "a" * 64


def envelope(status=ResultStatus.COMPLETED, **changes):
    value = dict(
        schema_version="subagent_result/v1", result_id="result-1", delegation_id="delegation-1",
        attempt_id="attempt-1", attempt_number=1, step_lineage_id="step-1", status=status,
        target_hash=HASH, summary="done", actions_taken=("inspect",), changed_paths=(),
        evidence_refs=(EvidenceReference("evidence-1", HASH),),
        tests=(ResultTest("pytest", "PASS", 0),), assumptions=(), unresolved=(), handoff={},
    )
    value.update(changes)
    return ResultEnvelope(**value)


def resolver():
    service = DelegationOutcomeResolver(
        execution_fencing_token="exec-current", write_fencing_token="write-current"
    )
    service.register_step("step-1", StepState.RUNNING)
    service.register_delegation("delegation-1", "step-1", DelegationStatus.RUNNING)
    return service


def test_completed_result_atomically_updates_step_delegation_and_event():
    service = resolver()
    receipt = service.resolve(envelope(), execution_fencing_token="exec-current", write_fencing_token="write-current")
    assert receipt.accepted
    assert receipt.step.state is StepState.COMPLETED
    assert receipt.delegation.status is DelegationStatus.COMPLETED
    assert [event.event_type for event in receipt.events] == ["DelegationResultAccepted"]
    assert service.events == receipt.events


def test_stale_or_missing_fencing_is_rejected_without_mutation():
    service = resolver()
    before = service.snapshot()
    receipt = service.resolve(envelope(), execution_fencing_token="old", write_fencing_token="write-current")
    assert not receipt.accepted
    assert receipt.reason_codes == (ResolverReasonCode.STALE_FENCING_TOKEN.value,)
    assert service.snapshot() == before


def test_duplicate_same_result_is_idempotent_and_conflicting_replay_fails_closed():
    service = resolver()
    first = service.resolve(envelope(), execution_fencing_token="exec-current", write_fencing_token="write-current")
    second = service.resolve(envelope(), execution_fencing_token="exec-current", write_fencing_token="write-current")
    assert second.accepted and second.duplicate
    assert second.events == ()
    conflicting = service.resolve(envelope(summary="different"), execution_fencing_token="exec-current", write_fencing_token="write-current")
    assert not conflicting.accepted
    assert conflicting.reason_codes == (ResolverReasonCode.DUPLICATE_RESULT.value,)
    assert service.events == first.events


def test_invalid_transition_and_invalid_failure_are_rejected():
    service = resolver()
    service.register_step("step-2", StepState.COMPLETED)
    service.register_delegation("delegation-2", "step-2", DelegationStatus.COMPLETED)
    invalid = service.resolve(
        envelope(result_id="result-2", delegation_id="delegation-2", step_lineage_id="step-2"),
        execution_fencing_token="exec-current", write_fencing_token="write-current",
    )
    assert not invalid.accepted
    assert invalid.reason_codes == (ResolverReasonCode.INVALID_TRANSITION.value,)
    failure = envelope(
        status=ResultStatus.FAILURE_REPORT, result_id="result-3",
        failure_fingerprint="failure-abc", unresolved=("remaining",), tests=(ResultTest("pytest", "FAIL", 1),),
    )
    rejected = resolver().resolve(failure, execution_fencing_token="exec-current", write_fencing_token="write-current")
    assert not rejected.accepted
    assert ResolverReasonCode.INVALID_RESULT.value in rejected.reason_codes
