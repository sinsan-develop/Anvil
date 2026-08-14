from datetime import datetime, timezone
import unittest


NOW = datetime(2026, 8, 14, tzinfo=timezone.utc)
HASH = "sha256:" + "a" * 64


class PlanningModelTests(unittest.TestCase):
    def test_work_plan_iteration_and_instruction_preserve_their_approved_parent_hashes(self):
        try:
            from packages.planning.models import IterationPlan, WorkInstruction, WorkPlan
        except ModuleNotFoundError as error:
            self.fail(f"planning models are missing: {error}")

        work_plan = WorkPlan(
            artifact_id="plan-1",
            revision=1,
            content_hash=HASH,
            design_baseline_id="baseline-1",
            design_baseline_hash=HASH,
            scope=frozenset({"planning"}),
            created_at=NOW,
        )
        iteration = IterationPlan(
            artifact_id="iteration-1",
            revision=1,
            content_hash=HASH,
            work_plan_id="plan-1",
            work_plan_hash=HASH,
            sequence=1,
            created_at=NOW,
        )
        instruction = WorkInstruction(
            artifact_id="instruction-1",
            revision=1,
            content_hash=HASH,
            iteration_plan_id="iteration-1",
            iteration_plan_hash=HASH,
            allowed_paths=("packages/planning/models.py",),
            allowed_actions=("patch", "test"),
            completion_conditions=("focused tests pass",),
            created_at=NOW,
        )

        self.assertEqual("baseline-1", work_plan.design_baseline_id)
        self.assertEqual("plan-1", iteration.work_plan_id)
        self.assertEqual(("patch", "test"), instruction.allowed_actions)
        with self.assertRaises(ValueError):
            IterationPlan("bad", 1, HASH, "plan-1", "sha256:" + "b" * 64, 0, NOW)


if __name__ == "__main__":
    unittest.main()
