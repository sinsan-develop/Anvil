from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import importlib.util
import os
from pathlib import Path
import unittest
import uuid

try:
    from packages.budget.models import BudgetLimit, BudgetRequest
    from packages.budget.service import BudgetReservationFailed, BudgetService
    from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
except ModuleNotFoundError:
    BudgetLimit = BudgetRequest = None

    class BudgetReservationFailed(ValueError):
        pass

    class BudgetService:
        def __init__(self, *args, **kwargs):
            raise NotImplementedError("budget service is not implemented")

    class InMemoryInterventionBudgetRepository:
        pass


class AtomicReservationTests(unittest.TestCase):
    def test_migration_0009_is_chained_after_queue_fencing(self):
        path = Path(__file__).resolve().parents[2] / "migrations/versions/0009_intervention_budget.py"
        self.assertTrue(path.is_file(), "B-10 migration 0009 is missing")
        spec = importlib.util.spec_from_file_location("migration_0009", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual("0009_intervention_budget", module.revision)
        self.assertEqual("0008_queue_worker_leases", module.down_revision)

    def test_concurrent_forecast_reservations_never_exceed_remaining_hard_limit(self):
        repository = InMemoryInterventionBudgetRepository()
        service = BudgetService(repository)
        service.create_budget(BudgetLimit("budget-1", Decimal("100.00"), 1000, 4))

        def reserve(index: int):
            try:
                return service.reserve(
                    BudgetRequest(
                        reservation_id=f"reservation-{index}",
                        budget_id="budget-1",
                        run_id="run-1",
                        step_id=f"step-{index}",
                        request_id=f"request-{index}",
                        provider="OPENAI",
                        model="model-a",
                        pricing_version="price-v1",
                        forecast_cost=Decimal("30.00"),
                        forecast_tokens=300,
                    )
                )
            except BudgetReservationFailed:
                return None

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = tuple(pool.map(reserve, range(8)))

        successes = tuple(item for item in results if item is not None)
        self.assertEqual(3, len(successes))
        self.assertEqual(Decimal("90.00"), service.snapshot("budget-1").reserved_cost)
        self.assertEqual(900, service.snapshot("budget-1").reserved_tokens)

    def test_provider_is_called_only_after_successful_atomic_reservation(self):
        repository = InMemoryInterventionBudgetRepository()
        service = BudgetService(repository)
        service.create_budget(BudgetLimit("budget-2", Decimal("10.00"), 100, 1))
        sent: list[str] = []

        request = BudgetRequest(
            "reservation-ok", "budget-2", "run-2", "step-1", "request-ok",
            "GROQ", "model-b", "price-v1", Decimal("9.00"), 90,
        )
        service.reserve_and_send(request, lambda request_id: sent.append(request_id) or "provider-receipt")
        failing = BudgetRequest(
            "reservation-fail", "budget-2", "run-2", "step-2", "request-fail",
            "GROQ", "model-b", "price-v1", Decimal("2.00"), 20,
        )
        with self.assertRaises(BudgetReservationFailed):
            service.reserve_and_send(failing, lambda request_id: sent.append(request_id))
        self.assertEqual(["request-ok"], sent)

    def test_reservation_idempotency_replays_only_identical_canonical_request(self):
        service = BudgetService(InMemoryInterventionBudgetRepository())
        service.create_budget(BudgetLimit("budget-idempotent", Decimal("20.00"), 200, 2))
        original = BudgetRequest(
            "reservation-idempotent", "budget-idempotent", "run-i", "step-i", "request-i",
            "OPENAI", "model-i", "price-v1", Decimal("10.00"), 100,
        )
        first = service.reserve(original)
        self.assertEqual(first, service.reserve(original))
        changed = BudgetRequest(
            "reservation-idempotent", "budget-idempotent", "run-i", "step-i", "request-i",
            "OPENAI", "model-i", "price-v1", Decimal("11.00"), 100,
        )
        with self.assertRaises(BudgetReservationFailed):
            service.reserve(changed)

    @unittest.skipUnless(os.environ.get("ANVIL_B10_PG18_DSN"), "isolated PostgreSQL 18 DSN not configured")
    def test_postgres_concurrent_reservation_is_atomic(self):
        import psycopg

        dsn = os.environ["ANVIL_B10_PG18_DSN"]
        suffix = uuid.uuid4().hex[:12]
        task_id = f"task-b10-{suffix}"
        run_id = f"run-b10-{suffix}"
        budget_id = f"budget-b10-{suffix}"
        with psycopg.connect(dsn, autocommit=True) as connection:
            connection.execute(
                "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                "VALUES (%s,'project-b09','repo-b09','B10','B10','developer-primary-b10','IN_PROGRESS')",
                (task_id,),
            )
            connection.execute(
                "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                "VALUES (%s,%s,'baseline-b09','B','ACTIVE',1)",
                (run_id, task_id),
            )
            connection.execute(
                "INSERT INTO budget_ledgers(budget_id,run_id,hard_cost_limit,hard_token_limit,max_concurrent_requests) "
                "VALUES (%s,%s,100,1000,8)",
                (budget_id, run_id),
            )

        connections = tuple(psycopg.connect(dsn, autocommit=True) for _ in range(8))
        try:
            def reserve(index: int) -> bool:
                row = connections[index].execute(
                    "SELECT reservation_id FROM anvil_budget_reserve(%s,%s,%s,%s,%s,'OPENAI','m','p1',30,300)",
                    (f"r-{suffix}-{index}", budget_id, run_id, f"s-{index}", f"q-{suffix}-{index}"),
                ).fetchone()
                return row is not None and row[0] is not None

            with ThreadPoolExecutor(max_workers=8) as pool:
                accepted = tuple(pool.map(reserve, range(8)))
        finally:
            for connection in connections:
                connection.close()
        self.assertEqual(3, sum(accepted))
        with psycopg.connect(dsn, autocommit=True) as connection:
            totals = connection.execute(
                "SELECT COALESCE(sum(reserved_cost),0),COALESCE(sum(reserved_tokens),0) "
                "FROM budget_reservations WHERE budget_id=%s AND status='RESERVED'",
                (budget_id,),
            ).fetchone()
        self.assertEqual((Decimal("90"), 900), totals)

    @unittest.skipUnless(os.environ.get("ANVIL_B10_PG18_DSN"), "isolated PostgreSQL 18 DSN not configured")
    def test_postgres_unresolved_usage_remains_in_atomic_admission_totals(self):
        import psycopg

        dsn = os.environ["ANVIL_B10_PG18_DSN"]
        suffix = uuid.uuid4().hex[:12]
        scenarios = (
            ("cost", Decimal("50"), 5000, 8, Decimal("40"), 400, Decimal("20"), 100),
            ("tokens", Decimal("500"), 500, 8, Decimal("40"), 400, Decimal("20"), 200),
            ("concurrency", Decimal("500"), 5000, 1, Decimal("40"), 400, Decimal("1"), 1),
        )
        with psycopg.connect(dsn, autocommit=True) as connection:
            for (
                name, hard_cost, hard_tokens, max_concurrent,
                first_cost, first_tokens, second_cost, second_tokens,
            ) in scenarios:
                task_id = f"task-b10-{name}-{suffix}"
                run_id = f"run-b10-{name}-{suffix}"
                budget_id = f"budget-b10-{name}-{suffix}"
                first_id = f"r1-{name}-{suffix}"
                connection.execute(
                    "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                    "VALUES (%s,'project-b09','repo-b09','B10 unresolved','B10 unresolved','developer-primary-b10','IN_PROGRESS')",
                    (task_id,),
                )
                connection.execute(
                    "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                    "VALUES (%s,%s,'baseline-b09','B','ACTIVE',1)",
                    (run_id, task_id),
                )
                connection.execute(
                    "INSERT INTO budget_ledgers(budget_id,run_id,hard_cost_limit,hard_token_limit,max_concurrent_requests) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (budget_id, run_id, hard_cost, hard_tokens, max_concurrent),
                )
                first = connection.execute(
                    "SELECT reservation_id FROM anvil_budget_reserve(%s,%s,%s,'step-1',%s,'OPENAI','m','p1',%s,%s)",
                    (first_id, budget_id, run_id, f"q1-{name}-{suffix}", first_cost, first_tokens),
                ).fetchone()
                self.assertEqual(first_id, first[0])
                connection.execute(
                    "UPDATE budget_reservations SET status='RECONCILIATION_REQUIRED' WHERE reservation_id=%s",
                    (first_id,),
                )
                second = connection.execute(
                    "SELECT reservation_id FROM anvil_budget_reserve(%s,%s,%s,'step-2',%s,'OPENAI','m','p1',%s,%s)",
                    (
                        f"r2-{name}-{suffix}", budget_id, run_id, f"q2-{name}-{suffix}",
                        second_cost, second_tokens,
                    ),
                ).fetchone()
                exposure = connection.execute(
                    "SELECT status,reserved_cost,reserved_tokens FROM budget_reservations WHERE budget_id=%s",
                    (budget_id,),
                ).fetchall()

                with self.subTest(limit=name):
                    self.assertIsNone(second[0])
                    self.assertEqual(
                        [("RECONCILIATION_REQUIRED", first_cost, first_tokens)],
                        exposure,
                    )

    @unittest.skipUnless(os.environ.get("ANVIL_B10_PG18_DSN"), "isolated PostgreSQL 18 DSN not configured")
    def test_postgres_authoritative_final_is_unique_per_reservation(self):
        import psycopg

        dsn = os.environ["ANVIL_B10_PG18_DSN"]
        suffix = uuid.uuid4().hex[:12]
        task_id = f"task-b10-final-unique-{suffix}"
        run_id = f"run-b10-final-unique-{suffix}"
        budget_id = f"budget-b10-final-unique-{suffix}"
        reservation_id = f"reservation-final-unique-{suffix}"
        with psycopg.connect(dsn, autocommit=True) as connection:
            connection.execute(
                "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                "VALUES (%s,'project-b09','repo-b09','B10 final unique','B10 final unique','developer-primary-b10','IN_PROGRESS')",
                (task_id,),
            )
            connection.execute(
                "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                "VALUES (%s,%s,'baseline-b09','B','ACTIVE',1)",
                (run_id, task_id),
            )
            connection.execute(
                "INSERT INTO budget_ledgers(budget_id,run_id,hard_cost_limit,hard_token_limit,max_concurrent_requests) "
                "VALUES (%s,%s,50,500,2)",
                (budget_id, run_id),
            )
            connection.execute(
                "SELECT reservation_id FROM anvil_budget_reserve(%s,%s,%s,'step-final',%s,'OPENAI','m','p1',40,400)",
                (reservation_id, budget_id, run_id, f"request-final-unique-{suffix}"),
            )
            first_sql = (
                "INSERT INTO budget_usage_receipts(usage_receipt_id,reservation_id,request_id,abort_status,actual_cost,actual_tokens,released_cost,released_tokens,payload_hash,retry_after,rate_bucket,provenance,is_authoritative_final) "
                "VALUES (%s,%s,%s,'ABORT_CONFIRMED',12,120,28,280,%s,'30','bucket-a','provider_final_usage',true)"
            )
            try:
                connection.execute(
                    first_sql,
                    (f"usage-u1-{suffix}", reservation_id, f"request-final-unique-{suffix}", f"payload-u1-{suffix}"),
                )
            except psycopg.errors.UndefinedColumn:
                self.fail("authoritative final identity column is missing")
            with self.assertRaises(psycopg.errors.UniqueViolation):
                connection.execute(
                    first_sql,
                    (f"usage-u2-{suffix}", reservation_id, f"request-final-unique-{suffix}", f"payload-u2-{suffix}"),
                )

    @unittest.skipUnless(os.environ.get("ANVIL_B10_PG18_DSN"), "isolated PostgreSQL 18 DSN not configured")
    def test_postgres_concurrent_distinct_final_receipts_choose_one_and_reject_new49(self):
        import psycopg

        dsn = os.environ["ANVIL_B10_PG18_DSN"]
        suffix = uuid.uuid4().hex[:12]
        task_id = f"task-b10-final-race-{suffix}"
        run_id = f"run-b10-final-race-{suffix}"
        budget_id = f"budget-b10-final-race-{suffix}"
        reservation_id = f"reservation-final-race-{suffix}"
        request_id = f"request-final-race-{suffix}"
        with psycopg.connect(dsn, autocommit=True) as connection:
            connection.execute(
                "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                "VALUES (%s,'project-b09','repo-b09','B10 final race','B10 final race','developer-primary-b10','IN_PROGRESS')",
                (task_id,),
            )
            connection.execute(
                "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                "VALUES (%s,%s,'baseline-b09','B','ACTIVE',1)",
                (run_id, task_id),
            )
            connection.execute(
                "INSERT INTO budget_ledgers(budget_id,run_id,hard_cost_limit,hard_token_limit,max_concurrent_requests) "
                "VALUES (%s,%s,50,500,2)",
                (budget_id, run_id),
            )
            connection.execute(
                "SELECT reservation_id FROM anvil_budget_reserve(%s,%s,%s,'step-final',%s,'OPENAI','m','p1',40,400)",
                (reservation_id, budget_id, run_id, request_id),
            )

        connections = tuple(psycopg.connect(dsn, autocommit=True) for _ in range(8))
        try:
            def finalize(index: int):
                try:
                    row = connections[index].execute(
                        "SELECT usage_receipt_id FROM anvil_budget_reconcile(%s,%s,%s,'ABORT_CONFIRMED',12,120,28,280,%s,'30','bucket-a','provider_final_usage')",
                        (f"usage-race-{suffix}-{index}", reservation_id, request_id, f"payload-{suffix}-{index}"),
                    ).fetchone()
                except psycopg.errors.UndefinedFunction:
                    return "FUNCTION_MISSING"
                return None if row is None or row[0] is None else row[0]

            with ThreadPoolExecutor(max_workers=8) as pool:
                results = tuple(pool.map(finalize, range(8)))
        finally:
            for connection in connections:
                connection.close()

        self.assertNotIn("FUNCTION_MISSING", results)
        winners = tuple(item for item in results if item is not None)
        self.assertEqual(1, len(winners))
        winner = winners[0]
        winner_index = int(winner.rsplit("-", 1)[-1])
        with psycopg.connect(dsn, autocommit=True) as connection:
            replay = connection.execute(
                "SELECT usage_receipt_id FROM anvil_budget_reconcile(%s,%s,%s,'ABORT_CONFIRMED',12,120,28,280,%s,'30','bucket-a','provider_final_usage')",
                (winner, reservation_id, request_id, f"payload-{suffix}-{winner_index}"),
            ).fetchone()
            changed_identity = connection.execute(
                "SELECT usage_receipt_id FROM anvil_budget_reconcile(%s,%s,%s,'ABORT_CONFIRMED',12,120,28,280,%s,'30','bucket-a','provider_final_usage')",
                (f"usage-changed-{suffix}", reservation_id, request_id, f"payload-{suffix}-{winner_index}"),
            ).fetchone()
            changed_payload = connection.execute(
                "SELECT usage_receipt_id FROM anvil_budget_reconcile(%s,%s,%s,'ABORT_CONFIRMED',12,120,28,280,%s,'30','bucket-a','provider_final_usage')",
                (winner, reservation_id, request_id, f"payload-changed-{suffix}"),
            ).fetchone()
            changed_actual_release = connection.execute(
                "SELECT usage_receipt_id FROM anvil_budget_reconcile(%s,%s,%s,'ABORT_CONFIRMED',1,10,39,390,%s,'30','bucket-a','provider_final_usage')",
                (winner, reservation_id, request_id, f"payload-{suffix}-{winner_index}"),
            ).fetchone()
            new49 = connection.execute(
                "SELECT reservation_id FROM anvil_budget_reserve(%s,%s,%s,'step-new49',%s,'OPENAI','m','p1',49,490)",
                (f"reservation-new49-{suffix}", budget_id, run_id, f"request-new49-{suffix}"),
            ).fetchone()
            final_state = connection.execute(
                "SELECT consumed_cost,consumed_tokens,released_cost,released_tokens,status FROM budget_reservations WHERE reservation_id=%s",
                (reservation_id,),
            ).fetchone()
            receipt_count = connection.execute(
                "SELECT count(*) FROM budget_usage_receipts WHERE reservation_id=%s AND is_authoritative_final",
                (reservation_id,),
            ).fetchone()[0]

        self.assertEqual(winner, replay[0])
        self.assertIsNone(changed_identity[0])
        self.assertIsNone(changed_payload[0])
        self.assertIsNone(changed_actual_release[0])
        self.assertIsNone(new49[0])
        self.assertEqual((Decimal("12"), 120, Decimal("28"), 280, "CONSUMED"), final_state)
        self.assertEqual(1, receipt_count)


if __name__ == "__main__":
    unittest.main()
