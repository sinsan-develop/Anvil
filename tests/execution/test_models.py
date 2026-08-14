from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
import inspect
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH_A = "sha256:" + "a" * 64


class ExecutionModelTests(unittest.TestCase):
    def test_execution_aggregates_are_immutable_and_preserve_parent_identity(self):
        from packages.execution.models import (
            ExecutorKind,
            PlanStep,
            Run,
            RunPhase,
            RunStatus,
            StepAttempt,
            Task,
            TaskStatus,
        )

        task = Task("task-1", "project-1", "repository-1", "Build", "Ship safely", "sinsan", TaskStatus.CONFIRMED)
        run = Run("run-1", task.task_id, "baseline-1", RunPhase.IMPLEMENTING, RunStatus.ACTIVE)
        step = PlanStep("step-1", run.run_id, "lineage-1", 1)
        attempt = StepAttempt("attempt-1", step.step_id, 1, ExecutorKind.SUBAGENT, HASH_A, NOW)

        self.assertEqual("task-1", run.task_id)
        self.assertEqual("run-1", step.run_id)
        self.assertEqual("step-1", attempt.step_id)
        with self.assertRaises(FrozenInstanceError):
            attempt.attempt_number = 2
        with self.assertRaises(ValueError):
            StepAttempt("bad", "step-1", 0, ExecutorKind.SUBAGENT, HASH_A, NOW)

    def test_repository_api_contract_and_migration_are_framework_neutral_and_reversible(self):
        from packages.api.execution_contracts import ExecutionErrorCode, RecordResultRequest
        from packages.persistence.execution_repository import ExecutionRepository

        self.assertTrue(getattr(ExecutionRepository, "_is_protocol", False))
        methods = {
            name
            for name, value in inspect.getmembers(ExecutionRepository, inspect.isfunction)
            if not name.startswith("_")
        }
        self.assertEqual(
            {
                "get_attempt",
                "get_dir_review",
                "get_release_decision",
                "get_run",
                "get_task",
                "save_attempt",
                "save_dir_review",
                "save_release_decision",
                "save_result",
                "save_run",
                "save_task",
            },
            methods,
        )
        request = RecordResultRequest("attempt-1", HASH_A, HASH_A, "developer-primary", 7)
        self.assertEqual(7, request.event_sequence)
        self.assertEqual("TERMINAL_RESULT_EXISTS", ExecutionErrorCode.TERMINAL_RESULT_EXISTS.value)
        with self.assertRaises(ValueError):
            RecordResultRequest("attempt-1", "bad", HASH_A, "developer-primary", 7)

        migration = (ROOT / "migrations/versions/0004_execution_release.py").read_text(encoding="utf-8")
        for token in (
            'down_revision = "0003_planning_approvals"',
            "def upgrade",
            "def downgrade",
            "tasks",
            "runs",
            "plan_steps",
            "step_attempts",
            "delegations",
            "results",
            "product_validations",
            "defects",
            "release_decisions",
            "design_intent_reviews",
        ):
            self.assertIn(token, migration)


if __name__ == "__main__":
    unittest.main()
