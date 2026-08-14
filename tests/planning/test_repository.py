import inspect
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class PlanningRepositoryTests(unittest.TestCase):
    def test_repository_port_and_contract_remain_framework_neutral_with_a_reversible_migration(self):
        try:
            from packages.api.planning_contracts import ApprovalErrorCode, ApprovalGuardRequest
            from packages.persistence.planning_repository import PlanningRepository
        except ModuleNotFoundError as error:
            self.fail(f"planning persistence or API contract is missing: {error}")

        self.assertTrue(getattr(PlanningRepository, "_is_protocol", False))
        methods = {name for name, value in inspect.getmembers(PlanningRepository, inspect.isfunction) if not name.startswith("_")}
        self.assertEqual({"get_approval", "get_work_plan", "invalidate_subject", "save_approval", "save_work_plan"}, methods)
        request = ApprovalGuardRequest("plan-1", "sha256:" + "a" * 64, "PLAN")
        self.assertEqual("plan-1", request.subject_id)
        self.assertEqual("APPROVAL_EXPIRED", ApprovalErrorCode.APPROVAL_EXPIRED.value)
        with self.assertRaises(ValueError):
            ApprovalGuardRequest("", "not-a-hash", "PLAN")

        migration = (ROOT / "migrations/versions/0003_planning_approvals.py").read_text(encoding="utf-8")
        for token in ("down_revision = \"0002_design_artifacts\"", "def upgrade", "def downgrade", "work_plans", "iteration_plans", "work_instructions", "approval_records", "nonsemantic_reconfirmations", "subject_hash", "root_human_approval_id", "timezone=True"):
            self.assertIn(token, migration)

    def test_migration_has_database_guards_for_human_approvals_and_nonsemantic_scope(self):
        migration = (ROOT / "migrations/versions/0003_planning_approvals.py").read_text(encoding="utf-8")
        for token in ("sa.CheckConstraint", "authenticated_human", "expires_at > approved_at", "semantic_diff = 'NONE'", "NOT functional_scope_changed", "NOT requirements_changed", "NOT critical_risk_changed"):
            self.assertIn(token, migration)


if __name__ == "__main__":
    unittest.main()
