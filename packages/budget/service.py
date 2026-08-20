"""Provider-call admission, quota pause, and final-usage reconciliation."""

from __future__ import annotations

from typing import Callable

from packages.persistence.intervention_budget_repository import (
    AtomicReservationRejected,
    InterventionBudgetRepository,
    ReconciliationConflict,
)

from .models import (
    BudgetLimit,
    BudgetRequest,
    BudgetReservation,
    BudgetSnapshot,
    QuotaPause,
    QuotaWarning,
    ReconciliationReceipt,
    UsageReceipt,
)


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
        self._repository.create_budget(limit)

    def reserve(self, request: BudgetRequest) -> BudgetReservation:
        try:
            return self._repository.reserve(request)
        except AtomicReservationRejected as error:
            raise BudgetReservationFailed(str(error)) from error

    def reserve_and_send(self, request: BudgetRequest, sender: Callable[[str], object]) -> BudgetReservation:
        reservation = self.reserve(request)
        receipt = sender(request.request_id)
        if receipt is not None:
            reservation = self._repository.bind_provider_receipt(request.reservation_id, str(receipt))
        return reservation

    def reconcile(self, receipt: UsageReceipt) -> ReconciliationReceipt:
        try:
            return self._repository.reconcile(receipt)
        except ReconciliationConflict as error:
            raise UsageReconciliationRequired(str(error)) from error

    def approaching_quota(self, budget_id: str, *, checkpoint_ref: str, next_safe_action: str) -> QuotaWarning:
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
        return pause

    def snapshot(self, budget_id: str) -> BudgetSnapshot:
        return self._repository.snapshot(budget_id)

    def reservation(self, reservation_id: str) -> BudgetReservation:
        return self._repository.reservation(reservation_id)
