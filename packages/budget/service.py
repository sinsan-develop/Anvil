"""Provider-call admission, quota pause, and final-usage reconciliation."""

from __future__ import annotations

from typing import Callable
from copy import deepcopy
from dataclasses import asdict, replace
from hashlib import sha256
import json
import re
from threading import RLock
from weakref import WeakKeyDictionary

from packages.persistence.intervention_budget_repository import (
    AtomicReservationRejected,
    InterventionBudgetRepository,
    ReconciliationConflict,
)

from .models import (
    _text,
    BudgetLimit,
    BudgetRequest,
    BudgetReservation,
    BudgetSnapshot,
    QuotaPause,
    QuotaWarning,
    ReconciliationReceipt,
    UsageReceipt,
    BudgetDispatch, ProviderOutcome, ReservationStatus,
)


# Host-side admission ledger shared by every service on the same B10 owner.
# This is not a durable DB send-once adapter. No external callback runs under
# either lock; order is admission lock -> repository lock, never the reverse.
_ADMISSIONS = WeakKeyDictionary()
_ADMISSIONS_LOCK = RLock()


def _digest(value):
    return 'sha256:' + sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()


class _AdmissionState:
    def __init__(self):
        self.lock = RLock()
        self.requests = {}
        self.reservations = {}
        self.overruns = {}


def _shared(repository):
    with _ADMISSIONS_LOCK:
        if repository not in _ADMISSIONS:
            _ADMISSIONS[repository] = _AdmissionState()
        return _ADMISSIONS[repository]


class BudgetError(ValueError):
    pass


class BudgetReservationFailed(BudgetError):
    code = "BUDGET_RESERVATION_FAILED"


class UsageReconciliationRequired(BudgetError):
    code = "USAGE_RECONCILIATION_REQUIRED"


class BudgetService:
    def __init__(self, repository: InterventionBudgetRepository) -> None:
        self._repository = repository
        self._quota_pauses: dict[str, QuotaPause] = {}

    def create_budget(self, limit: BudgetLimit) -> None:
        if type(limit) is not BudgetLimit:
            raise BudgetError('INVALID_BUDGET_LIMIT')
        self._repository.create_budget(replace(limit))

    def reserve(self, request: BudgetRequest) -> BudgetReservation:
        if type(request) is not BudgetRequest:
            raise BudgetError('INVALID_ADMISSION_INPUT')
        request = replace(request)
        try:
            return deepcopy(self._repository.reserve(request))
        except AtomicReservationRejected as error:
            raise BudgetReservationFailed(str(error)) from error

    def reserve_and_send(self, request: BudgetRequest, sender: Callable[[str], object]) -> BudgetReservation:
        # Preserve the legacy return shape, but share the same send ownership.
        # A provider reference is not an authoritative final usage receipt.
        def legacy_send(reserved):
            receipt = sender(reserved.request_id)
            if receipt is not None:
                _text(receipt, 'provider_receipt_ref')
                self._repository.bind_provider_receipt(reserved.reservation_id, receipt)
            return ProviderOutcome(reserved.request_id, reserved.provider, reserved.model,
                                   'UNKNOWN', None, None, 'UNKNOWN', None, None, None)
        result = self.dispatch(request, admission_hash=_digest('LEGACY_B10_SEND'), sender=legacy_send)
        if result.status == 'PAUSED_QUOTA':
            raise BudgetReservationFailed('BUDGET_RESERVATION_FAILED')
        return deepcopy(result.reservation)

    def reconcile(self, receipt: UsageReceipt) -> ReconciliationReceipt:
        if type(receipt) is not UsageReceipt:
            raise BudgetError('INVALID_USAGE_RECEIPT')
        receipt = replace(receipt)
        from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
        if type(self._repository) is InMemoryInterventionBudgetRepository:
            owner, state = self._admission_owner()
            with state.lock, owner._lock:
                reserved = owner.reservation(receipt.reservation_id)
                if self._is_overrun(receipt, reserved):
                    self._record_overrun(owner, state, receipt, reserved)
                    raise UsageReconciliationRequired('ACTUAL_USAGE_EXCEEDS_FORECAST')
                if receipt.reservation_id in state.overruns:
                    raise UsageReconciliationRequired('FINAL_USAGE_CONFLICT')
                before = (dict(owner._reservations), dict(owner._usage), dict(owner._finalizations))
                try:
                    return deepcopy(owner.reconcile(receipt))
                except ReconciliationConflict as error:
                    raise UsageReconciliationRequired(str(error)) from error
                except BaseException:
                    owner._reservations, owner._usage, owner._finalizations = before
                    raise
        try:
            return deepcopy(self._repository.reconcile(receipt))
        except ReconciliationConflict as error:
            raise UsageReconciliationRequired(str(error)) from error

    @staticmethod
    def _is_overrun(receipt, reserved):
        if receipt.request_id != reserved.request_id:
            raise UsageReconciliationRequired('USAGE_REQUEST_MISMATCH')
        return (receipt.provenance in {'PROVIDER_FINAL', 'provider_final_usage', 'provider_invoice'} and
                ((receipt.actual_cost is not None and receipt.actual_cost > reserved.reserved_cost) or
                 (receipt.actual_tokens is not None and receipt.actual_tokens > reserved.reserved_tokens)))

    @staticmethod
    def _record_overrun(owner, state, receipt, reserved):
        """Safety evidence is not rolled back with response publication.

        Exact in-memory owner only, admission+ledger locks already held. The
        B10 owner still makes the reconciliation transition; no cost is booked
        or refunded here. A failed adapter leaves full exposure and a stop.
        """
        previous = state.overruns.get(receipt.reservation_id)
        owner._allowed[reserved.budget_id] = False
        if previous is not None and previous != receipt:
            raise UsageReconciliationRequired('FINAL_USAGE_CONFLICT')
        state.overruns[receipt.reservation_id] = receipt
        current = state.requests.get(receipt.request_id)
        try:
            owner.reconcile(receipt)
        except ReconciliationConflict:
            pass
        finally:
            if current is not None:
                fingerprint, dispatch = current
                pause = QuotaPause(reserved.budget_id, 'PAUSED_QUOTA', reserved.step_id,
                                   dispatch.checkpoint_ref, dispatch.reset_hint,
                                   'RECONCILE_ACTUAL_USAGE_AND_APPROVED_BUDGET')
                updated = replace(dispatch, status='PAUSED_QUOTA', usage=receipt, reconciliation=None,
                                  reservation=replace(owner.reservation(receipt.reservation_id)), pause=pause,
                                  failure_code='ACTUAL_USAGE_EXCEEDS_FORECAST')
                state.requests[receipt.request_id] = (fingerprint, updated)
        return state.requests.get(receipt.request_id, (None, None))[1]

    def approaching_quota(self, budget_id: str, *, checkpoint_ref: str, next_safe_action: str) -> QuotaWarning:
        for value in (budget_id, checkpoint_ref, next_safe_action):
            _text(value, 'quota_metadata')
        self._repository.set_new_action_allowed(budget_id, False)
        return QuotaWarning(budget_id, checkpoint_ref, next_safe_action)

    def pause_for_quota(
        self,
        budget_id: str,
        *,
        incomplete_step_id: str,
        checkpoint_ref: str,
        reset_hint: str,
        next_safe_action: str,
    ) -> QuotaPause:
        for value in (budget_id, incomplete_step_id, checkpoint_ref, reset_hint, next_safe_action):
            _text(value, 'quota_metadata')
        self._repository.set_new_action_allowed(budget_id, False)
        pause = QuotaPause(
            budget_id,
            "PAUSED_QUOTA",
            incomplete_step_id,
            checkpoint_ref,
            reset_hint,
            next_safe_action,
        )
        self._quota_pauses[budget_id] = pause
        return deepcopy(pause)

    def snapshot(self, budget_id: str) -> BudgetSnapshot:
        _text(budget_id, 'budget_id')
        return deepcopy(self._repository.snapshot(budget_id))

    def reservation(self, reservation_id: str) -> BudgetReservation:
        _text(reservation_id, 'reservation_id')
        return deepcopy(self._repository.reservation(reservation_id))

    def _admission_owner(self):
        from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
        if type(self._repository) is not InMemoryInterventionBudgetRepository:
            raise BudgetError('DURABLE_ADMISSION_ADAPTER_NOT_INTEGRATED')
        return self._repository, _shared(self._repository)

    def dispatch(self, request: BudgetRequest, *, admission_hash: str, sender,
                 abort_before_send=False, checkpoint_ref=None, reset_hint='UNKNOWN', pre_send=None) -> BudgetDispatch:
        """Reserve maximum before invoking a host adapter, once per identity.

        An in-flight duplicate returns SEND_STARTED (not success) without waiting
        for arbitrary host callbacks. This also prevents callback reentry deadlock.
        """
        if type(request) is not BudgetRequest or type(abort_before_send) is not bool:
            raise BudgetError('INVALID_ADMISSION_INPUT')
        for name in ('reservation_id', 'budget_id', 'run_id', 'step_id', 'request_id', 'provider', 'model', 'pricing_version'):
            value = getattr(request, name)
            if type(value) is not str or not value or len(value) > 256:
                raise BudgetError('INVALID_ADMISSION_INPUT')
        request = replace(request)
        if type(admission_hash) is not str or not re.fullmatch(r'sha256:[a-f0-9]{64}', admission_hash):
            raise BudgetError('INVALID_ADMISSION_HASH')
        if not callable(sender) or (pre_send is not None and not callable(pre_send)):
            raise BudgetError('SENDER_REQUIRED')
        checkpoint_ref = 'budget-checkpoint:' + request.request_id if checkpoint_ref is None else checkpoint_ref
        for value in (checkpoint_ref, reset_hint):
            if type(value) is not str or not value or len(value) > 256:
                raise BudgetError('INVALID_PAUSE_METADATA')
        fingerprint = _digest((asdict(request), admission_hash, abort_before_send, checkpoint_ref, reset_hint))
        owner, state = self._admission_owner()
        with state.lock, owner._lock:
            previous = state.requests.get(request.request_id)
            if previous:
                if previous[0] != fingerprint:
                    raise BudgetError('REQUEST_IDENTITY_CONFLICT')
                return deepcopy(previous[1])
            if request.reservation_id in state.reservations or any(
                    r.request_id == request.request_id or r.reservation_id == request.reservation_id
                    for r in owner._reservations.values()):
                raise BudgetError('RESERVATION_IDENTITY_CONFLICT')
            # All fallible publication can be rolled back before any send.
            before = dict(owner._reservations), dict(owner._allowed)
            try:
                if abort_before_send:
                    result = BudgetDispatch(request, admission_hash, 'ABORTED_BEFORE_SEND', 0)
                else:
                    try:
                        reservation = owner.reserve(request)
                    except AtomicReservationRejected:
                        pause = QuotaPause(request.budget_id, 'PAUSED_QUOTA', request.step_id,
                                           checkpoint_ref, reset_hint, 'WAIT_FOR_RESET_OR_APPROVED_BUDGET')
                        owner.set_new_action_allowed(request.budget_id, False)
                        result = BudgetDispatch(request, admission_hash, 'PAUSED_QUOTA', 0, pause=pause)
                    else:
                        result = BudgetDispatch(request, admission_hash, 'RESERVED' if pre_send else 'SEND_STARTED',
                                                0 if pre_send else 1, deepcopy(reservation))
                result = replace(result, checkpoint_ref=checkpoint_ref, reset_hint=reset_hint)
                public = deepcopy(result)
                state.requests[request.request_id] = (fingerprint, result)
                state.reservations[request.reservation_id] = request.request_id
            except BaseException:
                owner._reservations, owner._allowed = before
                state.requests.pop(request.request_id, None)
                state.reservations.pop(request.reservation_id, None)
                raise
        if result.status == 'RESERVED':
            try:
                pre_send()
                guard_ok = True
            except BaseException:
                guard_ok = False
            with state.lock, owner._lock:
                current = owner.reservation(request.reservation_id)
                guard_ok = guard_ok and current == result.reservation and current.status is ReservationStatus.RESERVED
                result = replace(result, status='SEND_STARTED' if guard_ok else 'BLOCKED_BEFORE_SEND',
                                 send_count=1 if guard_ok else 0, reservation=deepcopy(current))
                public = deepcopy(result)
                state.requests[request.request_id] = (fingerprint, result)
        if result.status != 'SEND_STARTED':
            return public
        # Once entered, exceptions/abort/disconnection mean UNKNOWN, not refund.
        try:
            outcome = sender(deepcopy(request))
            self._validate_outcome(request, outcome)
        except BaseException:
            outcome = ProviderOutcome(request.request_id, request.provider, request.model,
                                      'UNKNOWN', None, None, 'UNKNOWN', None, None, 'ADAPTER_ERROR')
        return self.finalize(request.request_id, outcome)

    @staticmethod
    def _validate_outcome(request, outcome):
        if type(outcome) is not ProviderOutcome:
            raise BudgetError('INVALID_PROVIDER_OUTCOME')
        for name in ('request_id', 'provider', 'model', 'abort_status', 'provenance', 'retry_after', 'rate_bucket', 'failure_code'):
            value = getattr(outcome, name)
            if value is None and name in {'retry_after', 'rate_bucket', 'failure_code'}:
                continue
            if type(value) is not str or not value or len(value) > 256:
                raise BudgetError('INVALID_PROVIDER_OUTCOME')
        if (outcome.request_id, outcome.provider, outcome.model) != (request.request_id, request.provider, request.model):
            raise BudgetError('PROVIDER_IDENTITY_MISMATCH')
        # Reuse the B10 value contract, with bounded scalar metadata.
        UsageReceipt('validation', request.reservation_id, request.request_id, outcome.abort_status,
                     outcome.actual_cost, outcome.actual_tokens, outcome.retry_after, outcome.rate_bucket, outcome.provenance)
        for value in (outcome.abort_status, outcome.provenance, outcome.retry_after, outcome.rate_bucket, outcome.failure_code):
            if value is not None and (type(value) is not str or not value or len(value) > 256):
                raise BudgetError('INVALID_PROVIDER_OUTCOME')

    def finalize(self, request_id: str, outcome: ProviderOutcome) -> BudgetDispatch:
        owner, state = self._admission_owner()
        with state.lock, owner._lock:
            if type(request_id) is not str or request_id not in state.requests:
                raise BudgetError('UNKNOWN_REQUEST')
            fingerprint, current = state.requests[request_id]
            if current.status not in {'SEND_STARTED', 'USAGE_RECONCILIATION_REQUIRED', 'FINALIZED', 'PAUSED_QUOTA'} or current.send_count != 1:
                raise BudgetError('REQUEST_NOT_SENT')
            self._validate_outcome(current.request, outcome)
            authoritative = outcome.provenance in {'PROVIDER_FINAL', 'provider_final_usage', 'provider_invoice'}
            receipt = UsageReceipt('usage:' + _digest(asdict(outcome))[7:], current.request.reservation_id,
                request_id, outcome.abort_status, outcome.actual_cost if authoritative else None,
                outcome.actual_tokens if authoritative else None, outcome.retry_after, outcome.rate_bucket, outcome.provenance)
            if current.reconciliation is not None or current.failure_code == 'ACTUAL_USAGE_EXCEEDS_FORECAST':
                if receipt != current.usage:
                    raise BudgetError('FINAL_USAGE_CONFLICT')
                return deepcopy(current)
            reserved = owner.reservation(receipt.reservation_id)
            if self._is_overrun(receipt, reserved):
                return deepcopy(self._record_overrun(owner, state, receipt, reserved))
            stop_codes = {'QUOTA_EXHAUSTED', 'HARD_LIMIT'}
            if outcome.failure_code in stop_codes or current.failure_code in stop_codes:
                # Authenticated provider stop is already a safety observation,
                # independent of later accounting or detached-response success.
                code = current.failure_code if current.failure_code in stop_codes else outcome.failure_code
                pause = QuotaPause(current.request.budget_id, 'PAUSED_QUOTA', current.request.step_id,
                                   current.checkpoint_ref, current.reset_hint,
                                   'WAIT_FOR_RESET_OR_APPROVED_BUDGET')
                current = replace(current, status='PAUSED_QUOTA', usage=receipt, pause=pause,
                                  failure_code=code, reservation=replace(reserved))
                owner._allowed[current.request.budget_id] = False
                state.requests[request_id] = (fingerprint, current)
            before = (dict(owner._reservations), dict(owner._usage), dict(owner._finalizations), dict(owner._allowed))
            try:
                try:
                    reconciled = owner.reconcile(receipt)
                except ReconciliationConflict:
                    reconciled = None
                pause = current.pause
                updated = replace(current, status='FINALIZED' if reconciled else 'USAGE_RECONCILIATION_REQUIRED',
                                  usage=receipt, reconciliation=reconciled,
                                  reservation=deepcopy(owner.reservation(current.request.reservation_id)),
                                  failure_code=current.failure_code if current.failure_code in stop_codes else outcome.failure_code, pause=pause)
                if pause is not None:
                    updated = replace(updated, status='PAUSED_QUOTA')
                public = deepcopy(updated)
                state.requests[request_id] = (fingerprint, updated)
                return public
            except BaseException:
                owner._reservations, owner._usage, owner._finalizations, owner._allowed = before
                raise

    def dispatch_receipt(self, request_id):
        _, state = self._admission_owner()
        with state.lock:
            if type(request_id) is not str or request_id not in state.requests:
                raise BudgetError('UNKNOWN_REQUEST')
            return deepcopy(state.requests[request_id][1])
