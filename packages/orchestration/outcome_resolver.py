"""C-07 in-memory, fail-closed projection of delegated outcomes.

The resolver is the sole mutation boundary for Step/Delegation projections.
It deliberately has no persistence or external side effects; callers can hand
the emitted events to the later outbox/repository packages.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Mapping

from packages.execution import DelegationStatus, ResultStatus

from .failure_report import validate_failure_report
from .result_envelope import ResultEnvelope, validate_result


class StepState(StrEnum):
    READY = "READY"
    LEASED = "LEASED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    NEEDS_FIX = "NEEDS_FIX"
    RETRY_WAIT = "RETRY_WAIT"
    INTERRUPTED = "INTERRUPTED"
    MAIN_AGENT_TAKEOVER_REQUIRED = "MAIN_AGENT_TAKEOVER_REQUIRED"


class ResolverReasonCode(StrEnum):
    STALE_FENCING_TOKEN = "STALE_FENCING_TOKEN"
    EXECUTION_FENCING_TOKEN_REQUIRED = "EXECUTION_FENCING_TOKEN_REQUIRED"
    WRITE_FENCING_TOKEN_REQUIRED = "WRITE_FENCING_TOKEN_REQUIRED"
    UNKNOWN_DELEGATION = "UNKNOWN_DELEGATION"
    RESULT_IDENTITY_MISMATCH = "RESULT_IDENTITY_MISMATCH"
    DUPLICATE_RESULT = "DUPLICATE_RESULT"
    INVALID_RESULT = "INVALID_RESULT"
    INVALID_TRANSITION = "INVALID_TRANSITION"


@dataclass(frozen=True, slots=True)
class StepProjection:
    step_lineage_id: str
    state: StepState


@dataclass(frozen=True, slots=True)
class DelegationProjection:
    delegation_id: str
    step_lineage_id: str
    status: DelegationStatus


@dataclass(frozen=True, slots=True)
class ResolverEvent:
    event_id: str
    event_type: str
    idempotency_key: str
    result_id: str
    delegation_id: str
    step_lineage_id: str
    payload: Mapping[str, str]


@dataclass(frozen=True, slots=True)
class ResolutionReceipt:
    accepted: bool
    duplicate: bool = False
    reason_codes: tuple[str, ...] = ()
    step: StepProjection | None = None
    delegation: DelegationProjection | None = None
    events: tuple[ResolverEvent, ...] = ()


class DelegationOutcomeResolver:
    """Apply one validated result atomically to in-memory canonical projections."""

    def __init__(self, *, execution_fencing_token: str, write_fencing_token: str) -> None:
        if not isinstance(execution_fencing_token, str) or not execution_fencing_token:
            raise ValueError("execution_fencing_token must be non-empty")
        if not isinstance(write_fencing_token, str) or not write_fencing_token:
            raise ValueError("write_fencing_token must be non-empty")
        self._execution_token = execution_fencing_token
        self._write_token = write_fencing_token
        self._steps: dict[str, StepProjection] = {}
        self._delegations: dict[str, DelegationProjection] = {}
        self._results: dict[str, str] = {}
        self._events: list[ResolverEvent] = []

    @property
    def events(self) -> tuple[ResolverEvent, ...]:
        return tuple(self._events)

    def register_step(self, step_lineage_id: str, state: StepState = StepState.READY) -> StepProjection:
        if not isinstance(step_lineage_id, str) or not step_lineage_id.strip():
            raise ValueError("step_lineage_id must be non-empty")
        if not isinstance(state, StepState):
            state = StepState(state)
        existing = self._steps.get(step_lineage_id)
        if existing is not None:
            return existing
        projection = StepProjection(step_lineage_id, state)
        self._steps[step_lineage_id] = projection
        return projection

    def register_delegation(
        self, delegation_id: str, step_lineage_id: str,
        status: DelegationStatus = DelegationStatus.PLANNED,
    ) -> DelegationProjection:
        if not isinstance(delegation_id, str) or not delegation_id.strip():
            raise ValueError("delegation_id must be non-empty")
        if step_lineage_id not in self._steps:
            raise ValueError("step must be registered before delegation")
        if not isinstance(status, DelegationStatus):
            status = DelegationStatus(status)
        existing = self._delegations.get(delegation_id)
        if existing is not None:
            return existing
        projection = DelegationProjection(delegation_id, step_lineage_id, status)
        self._delegations[delegation_id] = projection
        return projection

    def snapshot(self) -> tuple[tuple[StepProjection, ...], tuple[DelegationProjection, ...], tuple[ResolverEvent, ...]]:
        return tuple(self._steps.values()), tuple(self._delegations.values()), self.events

    def resolve(
        self, result: ResultEnvelope | Mapping[str, object], *,
        execution_fencing_token: str | None, write_fencing_token: str | None,
    ) -> ResolutionReceipt:
        if execution_fencing_token is None or execution_fencing_token == "":
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.EXECUTION_FENCING_TOKEN_REQUIRED.value,))
        if write_fencing_token is None or write_fencing_token == "":
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.WRITE_FENCING_TOKEN_REQUIRED.value,))
        if execution_fencing_token != self._execution_token or write_fencing_token != self._write_token:
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.STALE_FENCING_TOKEN.value,))
        try:
            candidate = result if isinstance(result, ResultEnvelope) else ResultEnvelope.from_dict(result)
        except (TypeError, ValueError):
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.INVALID_RESULT.value,))
        delegation = self._delegations.get(candidate.delegation_id)
        if delegation is None:
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.UNKNOWN_DELEGATION.value,))
        if candidate.step_lineage_id != delegation.step_lineage_id:
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.RESULT_IDENTITY_MISMATCH.value,))
        prior_hash = self._results.get(candidate.result_id)
        if prior_hash is not None:
            if prior_hash == candidate.canonical_hash:
                return ResolutionReceipt(True, duplicate=True, step=self._steps[delegation.step_lineage_id], delegation=delegation)
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.DUPLICATE_RESULT.value,))
        valid = validate_result(candidate)
        if candidate.status is ResultStatus.FAILURE_REPORT:
            failure = validate_failure_report(candidate)
            if not failure.valid:
                return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.INVALID_RESULT.value, *failure.reason_codes))
        elif not valid.valid:
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.INVALID_RESULT.value, *valid.reason_codes))
        step = self._steps[delegation.step_lineage_id]
        try:
            next_step, next_status = self._transition(step, delegation, candidate)
        except _TransitionRejected:
            return ResolutionReceipt(False, reason_codes=(ResolverReasonCode.INVALID_TRANSITION.value,))
        # Commit point: all validation and transition checks happen before any mutation.
        event_type = "DelegationResultAccepted"
        event = ResolverEvent(
            event_id=f"evt_{candidate.result_id}", event_type=event_type,
            idempotency_key=f"delegation-result:{candidate.result_id}", result_id=candidate.result_id,
            delegation_id=delegation.delegation_id, step_lineage_id=step.step_lineage_id,
            payload={"status": candidate.status.value, "target_hash": candidate.target_hash},
        )
        self._steps[step.step_lineage_id] = next_step
        self._delegations[delegation.delegation_id] = next_status
        self._results[candidate.result_id] = candidate.canonical_hash
        self._events.append(event)
        return ResolutionReceipt(True, step=next_step, delegation=next_status, events=(event,))

    @staticmethod
    def _transition(step: StepProjection, delegation: DelegationProjection, result: ResultEnvelope) -> tuple[StepProjection, DelegationProjection]:
        if step.state not in {StepState.RUNNING, StepState.LEASED} or delegation.status not in {DelegationStatus.RUNNING, DelegationStatus.REPORTING}:
            raise _TransitionRejected
        if result.status is ResultStatus.COMPLETED:
            return replace(step, state=StepState.COMPLETED), replace(delegation, status=DelegationStatus.COMPLETED)
        if result.status is ResultStatus.FAILURE_REPORT:
            return replace(step, state=StepState.NEEDS_FIX), replace(delegation, status=DelegationStatus.FAILURE_REPORT)
        if result.status is ResultStatus.BLOCKED:
            return replace(step, state=StepState.INTERRUPTED), replace(delegation, status=DelegationStatus.BLOCKED)
        if result.status is ResultStatus.CANCELLED:
            return replace(step, state=StepState.INTERRUPTED), replace(delegation, status=DelegationStatus.CANCELLED)
        return replace(step, state=StepState.RETRY_WAIT), replace(delegation, status=DelegationStatus.INCOMPLETE)


class _TransitionRejected(Exception):
    pass


__all__ = ["StepState", "ResolverReasonCode", "StepProjection", "DelegationProjection", "ResolverEvent", "ResolutionReceipt", "DelegationOutcomeResolver"]
