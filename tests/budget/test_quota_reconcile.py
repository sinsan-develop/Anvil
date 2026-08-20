from __future__ import annotations

from decimal import Decimal
import unittest

try:
    from packages.budget.models import BudgetLimit, BudgetRequest, UsageReceipt
    from packages.budget.service import BudgetService, UsageReconciliationRequired
    from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
except ModuleNotFoundError:
    BudgetLimit = BudgetRequest = UsageReceipt = None

    class UsageReconciliationRequired(ValueError):
        code = "USAGE_RECONCILIATION_REQUIRED"

    class BudgetService:
        def __init__(self, *args, **kwargs):
            raise NotImplementedError("budget service is not implemented")

    class InMemoryInterventionBudgetRepository:
        pass


class QuotaReconcileTests(unittest.TestCase):
    def setUp(self):
        self.service = BudgetService(InMemoryInterventionBudgetRepository())
        self.service.create_budget(BudgetLimit("budget-q", Decimal("50.00"), 500, 2))
        self.request = BudgetRequest(
            "reservation-q", "budget-q", "run-q", "step-q", "request-q",
            "ANTHROPIC", "model-q", "price-v2", Decimal("20.00"), 200,
        )
        self.service.reserve(self.request)

    def test_quota_pause_records_checkpoint_incomplete_step_reset_and_next_action(self):
        warning = self.service.approaching_quota(
            "budget-q", checkpoint_ref="checkpoint-q", next_safe_action="WAIT_FOR_RESET"
        )
        self.assertFalse(warning.new_action_allowed)
        self.assertTrue(warning.checkpoint_required)

        pause = self.service.pause_for_quota(
            "budget-q",
            incomplete_step_id="step-q",
            checkpoint_ref="checkpoint-q",
            reset_hint="2026-08-21T00:00:00Z",
            next_safe_action="WAIT_FOR_RESET",
        )
        self.assertEqual("PAUSED_QUOTA", pause.status)
        self.assertEqual("checkpoint-q", pause.checkpoint_ref)
        self.assertEqual("step-q", pause.incomplete_step_id)
        self.assertEqual("WAIT_FOR_RESET", pause.next_safe_action)

    def test_usage_reconcile_is_idempotent_and_unknown_usage_is_not_zeroed(self):
        receipt = UsageReceipt(
            usage_receipt_id="usage-q",
            reservation_id="reservation-q",
            request_id="request-q",
            abort_status="ABORT_CONFIRMED",
            actual_cost=Decimal("12.00"),
            actual_tokens=120,
            retry_after="30",
            rate_bucket="bucket-a",
            provenance="provider_final_usage",
        )
        first = self.service.reconcile(receipt)
        second = self.service.reconcile(receipt)
        self.assertEqual(first, second)
        snapshot = self.service.snapshot("budget-q")
        self.assertEqual(Decimal("12.00"), snapshot.consumed_cost)
        self.assertEqual(120, snapshot.consumed_tokens)
        self.assertEqual(Decimal("0.00"), snapshot.reserved_cost)

        self.service.reserve(
            BudgetRequest(
                "reservation-unknown", "budget-q", "run-q", "step-unknown", "request-unknown",
                "ANTHROPIC", "model-q", "price-v2", Decimal("10.00"), 100,
            )
        )
        unknown = UsageReceipt(
            "usage-unknown", "reservation-unknown", "request-unknown", "ABORT_UNKNOWN",
            None, None, None, "bucket-a", "provider_missing_final_usage",
        )
        with self.assertRaises(UsageReconciliationRequired) as caught:
            self.service.reconcile(unknown)
        self.assertEqual("USAGE_RECONCILIATION_REQUIRED", caught.exception.code)
        self.assertEqual(Decimal("10.00"), self.service.reservation("reservation-unknown").reserved_cost)


if __name__ == "__main__":
    unittest.main()
