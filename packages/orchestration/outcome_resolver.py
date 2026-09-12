"""C-07 atomic, in-memory projection of validated delegated outcomes.

This module is deliberately not a database/outbox implementation.  It models
the single-lock commit boundary that a later repository adapter must preserve.
Failure counts are supplied only by an immutable C-12 ledger receipt; this
resolver never records or increments failures and never performs C-13 lease or
tool revocation or TakeoverPacket creation.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum
from threading import RLock
from types import MappingProxyType
from typing import Mapping

from packages.execution import DelegationStatus, ResultStatus, RunStatus

from .failure_ledger import FailureLedgerEntry, FailureLedgerReceipt
from .failure_report import validate_failure_report
from .result_envelope import ResultDomainReasonCode, ResultEnvelope, validate_result


_TERMINAL_RUN_STATUSES = frozenset({
    RunStatus.CANCELLED,
    RunStatus.SUCCEEDED,
    RunStatus.FAILED,
    RunStatus.FINISHED_WITH_FAILURES,
    RunStatus.REJECTED,
    RunStatus.DISCARDED,
})


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
    CONFLICTING_RESULT_ID = "CONFLICTING_RESULT_ID"
    INVALID_RESULT = "INVALID_RESULT"
    INVALID_TRANSITION = "INVALID_TRANSITION"
    COMPLETION_GUARDS_FAILED = "COMPLETION_GUARDS_FAILED"
    LEASE_RELEASE_REQUIRED = "LEASE_RELEASE_REQUIRED"
    RETRY_BUDGET_EXHAUSTED = "RETRY_BUDGET_EXHAUSTED"
    FAILURE_CONTEXT_REQUIRED = "FAILURE_CONTEXT_REQUIRED"
    FAILURE_CONTEXT_MISMATCH = "FAILURE_CONTEXT_MISMATCH"


@dataclass(frozen=True, slots=True)
class RunProjection:
    run_id: str
    status: RunStatus
    event_sequence: int = 0


@dataclass(frozen=True, slots=True)
class StepProjection:
    step_lineage_id: str
    run_id: str
    state: StepState
    event_sequence: int = 0


@dataclass(frozen=True, slots=True)
class StepAttemptProjection:
    attempt_id: str
    attempt_number: int
    target_hash: str
    step_lineage_id: str
    result_id: str | None = None
    result_status: ResultStatus | None = None
    event_sequence: int = 0


@dataclass(frozen=True, slots=True)
class DelegationProjection:
    delegation_id: str
    attempt_id: str
    attempt_number: int
    target_hash: str
    step_lineage_id: str
    status: DelegationStatus
    result_id: str | None = None
    event_sequence: int = 0


@dataclass(frozen=True, slots=True)
class LeaseProjection:
    delegation_id: str
    released: bool = False
    event_sequence: int = 0


@dataclass(frozen=True, slots=True)
class ResolverEvent:
    event_id: str
    event_type: str
    event_sequence: int
    idempotency_key: str
    result_id: str
    delegation_id: str
    step_lineage_id: str
    payload: Mapping[str, str]


@dataclass(frozen=True, slots=True)
class ResolverRejectionEvent:
    event_id: str
    event_type: str
    result_id: str
    reason_codes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class OutcomeResolutionContext:
    """Immutable facts resolved outside C-07 and consumed as guards only."""

    completion_guards_passed: bool = False
    lease_released: bool = False
    retry_budget_remaining: bool = False
    failure_receipt: FailureLedgerReceipt | None = None

    def __post_init__(self) -> None:
        for value, field in (
            (self.completion_guards_passed, "completion_guards_passed"),
            (self.lease_released, "lease_released"),
            (self.retry_budget_remaining, "retry_budget_remaining"),
        ):
            if type(value) is not bool:
                raise TypeError(f"{field} must be bool")
        if self.failure_receipt is not None and not isinstance(self.failure_receipt, FailureLedgerReceipt):
            raise TypeError("failure_receipt must be an immutable FailureLedgerReceipt")


@dataclass(frozen=True, slots=True)
class ResolverSnapshot:
    runs: tuple[RunProjection, ...]
    steps: tuple[StepProjection, ...]
    attempts: tuple[StepAttemptProjection, ...]
    delegations: tuple[DelegationProjection, ...]
    leases: tuple[LeaseProjection, ...]
    accepted_results: tuple[tuple[str, str], ...]
    events: tuple[ResolverEvent, ...]


@dataclass(frozen=True, slots=True)
class ResolutionReceipt:
    accepted: bool
    duplicate: bool = False
    reason_codes: tuple[str, ...] = ()
    run: RunProjection | None = None
    step: StepProjection | None = None
    attempt: StepAttemptProjection | None = None
    delegation: DelegationProjection | None = None
    lease: LeaseProjection | None = None
    events: tuple[ResolverEvent, ...] = ()
    rejection_events: tuple[ResolverRejectionEvent, ...] = ()


class DelegationOutcomeResolver:
    """Apply one terminal result to all C-07 projections under one lock."""

    def __init__(self, *, execution_fencing_token: str, write_fencing_token: str) -> None:
        _required(execution_fencing_token, "execution_fencing_token")
        _required(write_fencing_token, "write_fencing_token")
        self._execution_token = execution_fencing_token
        self._write_token = write_fencing_token
        self._lock = RLock()
        self._runs: dict[str, RunProjection] = {}
        self._steps: dict[str, StepProjection] = {}
        self._attempts: dict[str, StepAttemptProjection] = {}
        self._delegations: dict[str, DelegationProjection] = {}
        self._leases: dict[str, LeaseProjection] = {}
        self._accepted_results: dict[str, tuple[str, str]] = {}
        self._events: list[ResolverEvent] = []
        self._rejection_events: list[ResolverRejectionEvent] = []
        self._event_sequence = 0

    @property
    def events(self) -> tuple[ResolverEvent, ...]:
        with self._lock:
            return tuple(self._events)

    @property
    def rejection_events(self) -> tuple[ResolverRejectionEvent, ...]:
        with self._lock:
            return tuple(self._rejection_events)

    def register_run(self, run_id: str, status: RunStatus = RunStatus.ACTIVE) -> RunProjection:
        _required(run_id, "run_id")
        status = status if isinstance(status, RunStatus) else RunStatus(status)
        with self._lock:
            existing = self._runs.get(run_id)
            if existing is not None:
                if existing.status is not status:
                    raise ValueError("run identity is already registered with different status")
                return existing
            projection = RunProjection(run_id, status)
            self._runs[run_id] = projection
            return projection

    def register_step(
        self, step_lineage_id: str, state: StepState = StepState.READY, *, run_id: str | None = None,
    ) -> StepProjection:
        _required(step_lineage_id, "step_lineage_id")
        if run_id is None:
            run_id = f"run:{step_lineage_id}"
        _required(run_id, "run_id")
        state = state if isinstance(state, StepState) else StepState(state)
        with self._lock:
            if run_id not in self._runs:
                self._runs[run_id] = RunProjection(run_id, RunStatus.ACTIVE)
            existing = self._steps.get(step_lineage_id)
            if existing is not None:
                if (existing.run_id, existing.state) != (run_id, state):
                    raise ValueError("step identity is already registered differently")
                return existing
            projection = StepProjection(step_lineage_id, run_id, state)
            self._steps[step_lineage_id] = projection
            return projection

    def register_attempt(
        self, attempt_id: str, *, attempt_number: int, target_hash: str,
        step_lineage_id: str,
    ) -> StepAttemptProjection:
        _required(attempt_id, "attempt_id")
        if type(attempt_number) is not int or attempt_number < 1:
            raise ValueError("attempt_number must be a positive integer")
        _required(target_hash, "target_hash")
        with self._lock:
            if step_lineage_id not in self._steps:
                raise ValueError("step must be registered before attempt")
            projection = StepAttemptProjection(
                attempt_id, attempt_number, target_hash, step_lineage_id,
            )
            existing = self._attempts.get(attempt_id)
            if existing is not None:
                if existing != projection:
                    raise ValueError("attempt identity is already registered differently")
                return existing
            self._attempts[attempt_id] = projection
            return projection

    def register_delegation(
        self, delegation_id: str, step_lineage_id: str | None = None,
        status: DelegationStatus = DelegationStatus.PLANNED, *, attempt_id: str | None = None,
    ) -> DelegationProjection:
        _required(delegation_id, "delegation_id")
        status = status if isinstance(status, DelegationStatus) else DelegationStatus(status)
        with self._lock:
            if attempt_id is None:
                if step_lineage_id not in self._steps:
                    raise ValueError("step must be registered before legacy delegation")
                projection = DelegationProjection(
                    delegation_id, "", 0, "", step_lineage_id, status,
                )
                existing = self._delegations.get(delegation_id)
                if existing is not None:
                    return existing
                self._delegations[delegation_id] = projection
                return projection
            attempt = self._attempts.get(attempt_id)
            if attempt is None:
                raise ValueError("attempt must be registered before delegation")
            if step_lineage_id is not None and step_lineage_id != attempt.step_lineage_id:
                raise ValueError("delegation lineage must match registered attempt lineage")
            projection = DelegationProjection(
                delegation_id, attempt.attempt_id, attempt.attempt_number,
                attempt.target_hash, attempt.step_lineage_id, status,
            )
            existing = self._delegations.get(delegation_id)
            if existing is not None:
                if existing != projection:
                    raise ValueError("delegation identity is already registered differently")
                return existing
            if any(
                item.attempt_id == attempt_id and item.delegation_id != delegation_id
                for item in self._delegations.values()
            ):
                raise ValueError("attempt already has a delegation")
            self._delegations[delegation_id] = projection
            return projection

    def register_lease(self, delegation_id: str, *, released: bool = False) -> LeaseProjection:
        if type(released) is not bool:
            raise TypeError("released must be bool")
        with self._lock:
            if delegation_id not in self._delegations:
                raise ValueError("delegation must be registered before lease")
            projection = LeaseProjection(delegation_id, released)
            existing = self._leases.get(delegation_id)
            if existing is not None:
                if existing != projection:
                    raise ValueError("lease projection is already registered differently")
                return existing
            self._leases[delegation_id] = projection
            return projection

    def snapshot(self) -> ResolverSnapshot:
        """Return accepted canonical state; rejection receipts are separate."""
        with self._lock:
            return ResolverSnapshot(
                tuple(self._runs.values()), tuple(self._steps.values()),
                tuple(self._attempts.values()), tuple(self._delegations.values()),
                tuple(self._leases.values()),
                tuple((result_id, value[0]) for result_id, value in self._accepted_results.items()),
                tuple(self._events),
            )

    def resolve(
        self, result: ResultEnvelope | Mapping[str, object], *,
        execution_fencing_token: str | None, write_fencing_token: str | None,
        context: OutcomeResolutionContext | None = None,
    ) -> ResolutionReceipt:
        resolution_context = context or OutcomeResolutionContext()
        if not isinstance(resolution_context, OutcomeResolutionContext):
            return self._reject(None, (ResolverReasonCode.INVALID_RESULT.value,))

        try:
            candidate = result if isinstance(result, ResultEnvelope) else ResultEnvelope.from_dict(result)
        except Exception:
            candidate = None

        with self._lock:
            if not execution_fencing_token:
                return self._reject_locked(candidate, (ResolverReasonCode.EXECUTION_FENCING_TOKEN_REQUIRED.value,))
            if not write_fencing_token:
                return self._reject_locked(candidate, (ResolverReasonCode.WRITE_FENCING_TOKEN_REQUIRED.value,))
            if execution_fencing_token != self._execution_token or write_fencing_token != self._write_token:
                return self._reject_locked(candidate, (ResolverReasonCode.STALE_FENCING_TOKEN.value,))
            if candidate is None:
                return self._reject_locked(None, (ResolverReasonCode.INVALID_RESULT.value,))

            base_validation = validate_result(candidate)
            if candidate.status is ResultStatus.FAILURE_REPORT:
                failure_validation = validate_failure_report(candidate)
                if not failure_validation.valid:
                    return self._reject_locked(
                        candidate,
                        (ResolverReasonCode.INVALID_RESULT.value, *failure_validation.reason_codes),
                        correction=True,
                    )
            elif not base_validation.valid:
                return self._reject_locked(
                    candidate,
                    (ResolverReasonCode.INVALID_RESULT.value, *base_validation.reason_codes),
                )

            delegation = self._delegations.get(candidate.delegation_id)
            if delegation is None:
                return self._reject_locked(candidate, (ResolverReasonCode.UNKNOWN_DELEGATION.value,))
            attempt = self._attempts.get(delegation.attempt_id)
            if attempt is None or (
                candidate.attempt_id != attempt.attempt_id
                or candidate.attempt_number != attempt.attempt_number
                or candidate.target_hash != attempt.target_hash
                or candidate.step_lineage_id != attempt.step_lineage_id
                or candidate.attempt_id != delegation.attempt_id
                or candidate.attempt_number != delegation.attempt_number
                or candidate.target_hash != delegation.target_hash
                or candidate.step_lineage_id != delegation.step_lineage_id
            ):
                return self._reject_locked(candidate, (ResolverReasonCode.RESULT_IDENTITY_MISMATCH.value,))

            prior = self._accepted_results.get(candidate.result_id)
            if prior is not None:
                if prior[0] != candidate.canonical_hash:
                    return self._reject_locked(candidate, (ResolverReasonCode.CONFLICTING_RESULT_ID.value,))
                return self._duplicate_receipt(delegation)

            failure_count = 0
            if candidate.status is ResultStatus.FAILURE_REPORT:
                failure_reason = self._failure_context_reason(candidate, resolution_context.failure_receipt)
                if failure_reason is not None:
                    return self._reject_locked(candidate, (failure_reason.value,), correction=True)
                failure_count = resolution_context.failure_receipt.valid_failure_count

            guard_reasons = self._guard_reasons(candidate, resolution_context)
            if guard_reasons:
                return self._reject_locked(candidate, guard_reasons)

            step = self._steps[attempt.step_lineage_id]
            run = self._runs[step.run_id]
            lease = self._leases.get(delegation.delegation_id)
            if lease is None:
                return self._reject_locked(candidate, (ResolverReasonCode.INVALID_TRANSITION.value,))
            try:
                next_step_state, next_delegation_status, next_run_status = self._transition(
                    step, delegation, run, candidate, failure_count,
                )
            except _TransitionRejected:
                return self._reject_locked(candidate, (ResolverReasonCode.INVALID_TRANSITION.value,))

            sequence = self._event_sequence + 1
            next_run = replace(run, status=next_run_status, event_sequence=sequence)
            next_step = replace(step, state=next_step_state, event_sequence=sequence)
            next_attempt = replace(
                attempt, result_id=candidate.result_id, result_status=candidate.status,
                event_sequence=sequence,
            )
            next_delegation = replace(
                delegation, status=next_delegation_status, result_id=candidate.result_id,
                event_sequence=sequence,
            )
            next_lease = replace(
                lease, released=resolution_context.lease_released,
                event_sequence=sequence,
            )
            events = [self._accepted_event(candidate, sequence)]
            if failure_count == 3:
                events.append(self._takeover_required_event(candidate, sequence))

            # Single-lock commit point.  No external service is called here.
            self._runs[run.run_id] = next_run
            self._steps[step.step_lineage_id] = next_step
            self._attempts[attempt.attempt_id] = next_attempt
            self._delegations[delegation.delegation_id] = next_delegation
            self._leases[lease.delegation_id] = next_lease
            self._accepted_results[candidate.result_id] = (
                candidate.canonical_hash, candidate.delegation_id,
            )
            self._events.extend(events)
            self._event_sequence = sequence
            return ResolutionReceipt(
                True, run=next_run, step=next_step, attempt=next_attempt,
                delegation=next_delegation, lease=next_lease, events=tuple(events),
            )

    def _reject(
        self, candidate: ResultEnvelope | None, reason_codes: tuple[str, ...], *,
        correction: bool = False,
    ) -> ResolutionReceipt:
        with self._lock:
            return self._reject_locked(candidate, reason_codes, correction=correction)

    def _reject_locked(
        self, candidate: ResultEnvelope | None, reason_codes: tuple[str, ...], *,
        correction: bool = False,
    ) -> ResolutionReceipt:
        reasons = tuple(dict.fromkeys(reason_codes))
        result_id = candidate.result_id if candidate is not None else "UNPARSEABLE"
        events = [ResolverRejectionEvent(
            event_id=f"reject:{len(self._rejection_events) + 1}",
            event_type="DelegationResultRejected", result_id=result_id,
            reason_codes=reasons,
        )]
        if correction:
            events.append(ResolverRejectionEvent(
                event_id=f"reject:{len(self._rejection_events) + 2}",
                event_type="ResultCorrectionRequest", result_id=result_id,
                reason_codes=reasons,
            ))
        self._rejection_events.extend(events)
        return ResolutionReceipt(False, reason_codes=reasons, rejection_events=tuple(events))

    def _duplicate_receipt(self, delegation: DelegationProjection) -> ResolutionReceipt:
        attempt = self._attempts[delegation.attempt_id]
        step = self._steps[delegation.step_lineage_id]
        run = self._runs[step.run_id]
        lease = self._leases[delegation.delegation_id]
        return ResolutionReceipt(
            True, duplicate=True,
            reason_codes=(ResolverReasonCode.DUPLICATE_RESULT.value,),
            run=run, step=step, attempt=attempt, delegation=delegation, lease=lease,
        )

    @staticmethod
    def _failure_context_reason(
        candidate: ResultEnvelope, receipt: FailureLedgerReceipt | None,
    ) -> ResolverReasonCode | None:
        if receipt is None:
            return ResolverReasonCode.FAILURE_CONTEXT_REQUIRED
        entry = receipt.entry
        if type(entry) is not FailureLedgerEntry:
            return ResolverReasonCode.FAILURE_CONTEXT_MISMATCH
        if (
            type(receipt.accepted) is not bool
            or type(receipt.duplicate) is not bool
            or type(entry.accepted) is not bool
            or type(receipt.valid_failure_count) is not int
            or type(entry.valid_failure_count) is not int
            or type(receipt.takeover_required) is not bool
            or type(entry.takeover_required) is not bool
            or not receipt.accepted
            or not entry.accepted
        ):
            return ResolverReasonCode.FAILURE_CONTEXT_MISMATCH
        count = receipt.valid_failure_count
        if (
            count not in (1, 2, 3)
            or entry.valid_failure_count != count
            or receipt.takeover_required != entry.takeover_required
            or entry.takeover_required != (count == 3)
            or entry.result_id != candidate.result_id
            or entry.result_hash != candidate.canonical_hash
            or entry.step_lineage_id != candidate.step_lineage_id
            or entry.failure_fingerprint != candidate.failure_fingerprint
            or receipt.failure_key != f"{candidate.step_lineage_id}|{candidate.failure_fingerprint}"
        ):
            return ResolverReasonCode.FAILURE_CONTEXT_MISMATCH
        return None

    @staticmethod
    def _guard_reasons(
        candidate: ResultEnvelope, context: OutcomeResolutionContext,
    ) -> tuple[str, ...]:
        reasons: list[str] = []
        if candidate.status is ResultStatus.COMPLETED:
            if not context.completion_guards_passed:
                reasons.append(ResolverReasonCode.COMPLETION_GUARDS_FAILED.value)
            if not context.lease_released:
                reasons.append(ResolverReasonCode.LEASE_RELEASE_REQUIRED.value)
        elif candidate.status is ResultStatus.INCOMPLETE:
            if (
                candidate.reason_code is ResultDomainReasonCode.TRANSIENT_EXECUTION_ERROR
                and not context.retry_budget_remaining
            ):
                reasons.append(ResolverReasonCode.RETRY_BUDGET_EXHAUSTED.value)
        elif candidate.status is ResultStatus.BLOCKED and not context.lease_released:
            reasons.append(ResolverReasonCode.LEASE_RELEASE_REQUIRED.value)
        return tuple(reasons)

    @staticmethod
    def _transition(
        step: StepProjection, delegation: DelegationProjection, run: RunProjection,
        result: ResultEnvelope, failure_count: int,
    ) -> tuple[StepState, DelegationStatus, RunStatus]:
        if step.state is not StepState.RUNNING or delegation.status not in {
            DelegationStatus.RUNNING, DelegationStatus.REPORTING,
        }:
            raise _TransitionRejected
        if run.status in _TERMINAL_RUN_STATUSES:
            raise _TransitionRejected
        if run.status in {RunStatus.PAUSED_USER, RunStatus.PAUSED_QUOTA} and not (
            result.status is ResultStatus.INCOMPLETE
            and result.reason_code is ResultDomainReasonCode.CHECKPOINTED_INTERRUPTION
        ):
            raise _TransitionRejected
        if run.status is RunStatus.CANCEL_REQUESTED and not (
            result.status is ResultStatus.CANCELLED
            and result.reason_code is ResultDomainReasonCode.RUN_CANCEL_REQUESTED
        ):
            raise _TransitionRejected
        if result.status is ResultStatus.COMPLETED:
            return StepState.COMPLETED, DelegationStatus.COMPLETED, run.status
        if result.status is ResultStatus.FAILURE_REPORT:
            if failure_count == 3:
                return (
                    StepState.MAIN_AGENT_TAKEOVER_REQUIRED,
                    DelegationStatus.FAILURE_REPORT,
                    RunStatus.INTERRUPTED,
                )
            return StepState.NEEDS_FIX, DelegationStatus.FAILURE_REPORT, run.status
        if result.status is ResultStatus.INCOMPLETE:
            if result.reason_code is ResultDomainReasonCode.RESULT_CONTRACT_INCOMPLETE:
                return StepState.NEEDS_FIX, DelegationStatus.INCOMPLETE, run.status
            if result.reason_code is ResultDomainReasonCode.TRANSIENT_EXECUTION_ERROR:
                return StepState.RETRY_WAIT, DelegationStatus.INCOMPLETE, run.status
            if result.reason_code is ResultDomainReasonCode.CHECKPOINTED_INTERRUPTION:
                next_run_status = (
                    run.status
                    if run.status in {RunStatus.PAUSED_USER, RunStatus.PAUSED_QUOTA}
                    else RunStatus.INTERRUPTED
                )
                return StepState.INTERRUPTED, DelegationStatus.INCOMPLETE, next_run_status
            raise _TransitionRejected
        if result.status is ResultStatus.BLOCKED:
            if result.reason_code is ResultDomainReasonCode.DECISION_REQUIRED:
                return StepState.INTERRUPTED, DelegationStatus.BLOCKED, RunStatus.WAITING_DECISION
            if result.reason_code in {
                ResultDomainReasonCode.POLICY_BLOCKED,
                ResultDomainReasonCode.ENVIRONMENT_BLOCKED,
                ResultDomainReasonCode.PERMISSION_BLOCKED,
            }:
                return StepState.INTERRUPTED, DelegationStatus.BLOCKED, RunStatus.BLOCKED
            raise _TransitionRejected
        if result.status is ResultStatus.CANCELLED:
            if result.reason_code is ResultDomainReasonCode.RUN_CANCEL_REQUESTED:
                if run.status is not RunStatus.CANCEL_REQUESTED:
                    raise _TransitionRejected
                return StepState.INTERRUPTED, DelegationStatus.CANCELLED, RunStatus.CANCELLED
            if result.reason_code is ResultDomainReasonCode.DELEGATION_REASSIGN:
                return StepState.INTERRUPTED, DelegationStatus.CANCELLED, RunStatus.INTERRUPTED
        raise _TransitionRejected

    @staticmethod
    def _accepted_event(candidate: ResultEnvelope, sequence: int) -> ResolverEvent:
        return ResolverEvent(
            event_id=f"evt:{sequence}:accepted:{candidate.result_id}",
            event_type="DelegationResultAccepted", event_sequence=sequence,
            idempotency_key=f"delegation-result:{candidate.result_id}",
            result_id=candidate.result_id, delegation_id=candidate.delegation_id,
            step_lineage_id=candidate.step_lineage_id,
            payload=MappingProxyType({
                "status": candidate.status.value,
                "target_hash": candidate.target_hash,
                "attempt_id": candidate.attempt_id,
                "attempt_number": str(candidate.attempt_number),
            }),
        )

    @staticmethod
    def _takeover_required_event(candidate: ResultEnvelope, sequence: int) -> ResolverEvent:
        return ResolverEvent(
            event_id=f"evt:{sequence}:takeover:{candidate.result_id}",
            event_type="MainAgentTakeoverRequired", event_sequence=sequence,
            idempotency_key=f"main-agent-takeover-required:{candidate.result_id}",
            result_id=candidate.result_id, delegation_id=candidate.delegation_id,
            step_lineage_id=candidate.step_lineage_id,
            payload=MappingProxyType({
                "failure_fingerprint": candidate.failure_fingerprint or "",
                "valid_failure_count": "3",
            }),
        )


class _TransitionRejected(Exception):
    pass


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


__all__ = [
    "StepState", "ResolverReasonCode", "RunProjection", "StepProjection",
    "StepAttemptProjection", "DelegationProjection", "LeaseProjection",
    "ResolverEvent", "ResolverRejectionEvent", "OutcomeResolutionContext",
    "ResolverSnapshot", "ResolutionReceipt", "DelegationOutcomeResolver",
]
