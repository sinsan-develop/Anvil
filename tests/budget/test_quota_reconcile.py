from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import unittest

try:
    from packages.budget.models import BudgetLimit, BudgetRequest, UsageReceipt
    from packages.budget.service import BudgetReservationFailed, BudgetService, UsageReconciliationRequired
    from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
except ModuleNotFoundError:
    BudgetLimit = BudgetRequest = UsageReceipt = None

    class UsageReconciliationRequired(ValueError):
        code = "USAGE_RECONCILIATION_REQUIRED"

    class BudgetReservationFailed(ValueError):
        pass

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

    def test_unknown_usage_remains_full_admission_exposure_until_final_receipt(self):
        service = BudgetService(InMemoryInterventionBudgetRepository())
        service.create_budget(BudgetLimit("budget-unresolved", Decimal("50.00"), 500, 1))
        service.reserve(
            BudgetRequest(
                "reservation-unresolved", "budget-unresolved", "run-q", "step-unresolved",
                "request-unresolved", "ANTHROPIC", "model-q", "price-v2", Decimal("40.00"), 400,
            )
        )
        unknown = UsageReceipt(
            "usage-unresolved", "reservation-unresolved", "request-unresolved", "ABORT_UNKNOWN",
            None, None, None, "bucket-a", "provider_missing_final_usage",
        )
        with self.assertRaises(UsageReconciliationRequired):
            service.reconcile(unknown)

        snapshot = service.snapshot("budget-unresolved")
        self.assertEqual(Decimal("40.00"), snapshot.reserved_cost)
        self.assertEqual(400, snapshot.reserved_tokens)
        self.assertEqual(1, snapshot.active_requests)
        sent: list[str] = []
        with self.assertRaises(BudgetReservationFailed):
            service.reserve_and_send(
                BudgetRequest(
                    "reservation-over", "budget-unresolved", "run-q", "step-over", "request-over",
                    "ANTHROPIC", "model-q", "price-v2", Decimal("50.00"), 500,
                ),
                lambda request_id: sent.append(request_id),
            )
        self.assertEqual([], sent)

    def test_final_receipt_replay_and_concurrent_reserve_release_exposure_once(self):
        service = BudgetService(InMemoryInterventionBudgetRepository())
        service.create_budget(BudgetLimit("budget-final", Decimal("50.00"), 500, 1))
        service.reserve(
            BudgetRequest(
                "reservation-final", "budget-final", "run-q", "step-final", "request-final",
                "ANTHROPIC", "model-q", "price-v2", Decimal("40.00"), 400,
            )
        )
        with self.assertRaises(UsageReconciliationRequired):
            service.reconcile(
                UsageReceipt(
                    "usage-unknown-final", "reservation-final", "request-final", "ABORT_UNKNOWN",
                    None, None, None, "bucket-a", "provider_missing_final_usage",
                )
            )
        final = UsageReceipt(
            "usage-authoritative-final", "reservation-final", "request-final", "ABORT_CONFIRMED",
            Decimal("12.00"), 120, None, "bucket-a", "provider_final_usage",
        )

        def reconcile_final():
            return service.reconcile(final)

        def reserve_remainder(index: int):
            try:
                return service.reserve(
                    BudgetRequest(
                        f"reservation-remainder-{index}", "budget-final", "run-q", f"step-{index}",
                        f"request-remainder-{index}", "ANTHROPIC", "model-q", "price-v2",
                        Decimal("38.00"), 380,
                    )
                )
            except BudgetReservationFailed:
                return None

        with ThreadPoolExecutor(max_workers=9) as pool:
            futures = [pool.submit(reconcile_final) for _ in range(4)]
            futures.extend(pool.submit(reserve_remainder, index) for index in range(5))
            results = tuple(future.result() for future in futures)

        reconciliation_results = results[:4]
        self.assertTrue(all(item == reconciliation_results[0] for item in reconciliation_results))
        snapshot = service.snapshot("budget-final")
        self.assertLessEqual(snapshot.reserved_cost + snapshot.consumed_cost, Decimal("50.00"))
        self.assertLessEqual(snapshot.reserved_tokens + snapshot.consumed_tokens, 500)
        self.assertLessEqual(snapshot.active_requests, 1)
        self.assertEqual(Decimal("12.00"), snapshot.consumed_cost)
        self.assertEqual(120, snapshot.consumed_tokens)
        reservation = service.reservation("reservation-final")
        self.assertEqual(Decimal("28.00"), reservation.released_cost)
        self.assertEqual(280, reservation.released_tokens)


if __name__ == "__main__":
    unittest.main()
