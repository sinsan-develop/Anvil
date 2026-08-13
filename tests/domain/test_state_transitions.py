import ast
from pathlib import Path
import unittest

from packages.domain.events import EventType
from packages.domain.states import (
    BLOCKED_TRANSITIONS,
    NORMAL_TRANSITIONS,
    BlockedCode,
    RunPhase,
    RunStatus,
)


EXPECTED = [
    ("DRAFT", "TASK_CONFIRMED", "ANALYZING", "Task snapshot"),
    ("ANALYZING", "ANALYSIS_COMPLETED", "EXECUTION_PLAN_REVIEW", "Impact Map"),
    ("EXECUTION_PLAN_REVIEW", "EXECUTION_PLAN_PROPOSED", "APPROVAL_PENDING", "ExecutionPlan artifact"),
    ("APPROVAL_PENDING", "EXECUTION_PLAN_APPROVED", "WORKSPACE_PREPARING", "Approval"),
    ("WORKSPACE_PREPARING", "WORKSPACE_READY", "IMPLEMENTING", "Workspace manifest"),
    ("IMPLEMENTING", "IMPLEMENTATION_COMPLETED", "VERIFYING", "Patch/Diff"),
    ("VERIFYING", "REQUIRED_GATES_PASSED", "RESULT_REVIEW", "Gate report"),
    ("RESULT_REVIEW", "REVIEW_APPROVED", "USER_VALIDATION", "Review report"),
    ("USER_VALIDATION", "RELEASE_DECIDED", "APPLY_PENDING", "ProductValidation·DefectAssessment·ReleaseDecision"),
    ("APPLY_PENDING", "APPLY_APPROVED", "APPLIED", "Apply result"),
    ("APPLIED", "POST_APPLY_VERIFIED", "COMPLETED", "Final report"),
]


class TransitionCatalogTests(unittest.TestCase):
    def test_exact_eleven_normal_transitions_and_artifacts(self):
        actual = [(x.source.value, x.event.value, x.target.value, x.required_artifact) for x in NORMAL_TRANSITIONS]
        self.assertEqual(EXPECTED, actual)

    def test_phase_status_and_event_are_closed_enums(self):
        self.assertEqual(12, len(RunPhase))
        self.assertIn(RunStatus.WAITING_APPROVAL, RunStatus)
        self.assertEqual(11, len(EventType))
        with self.assertRaises(ValueError):
            RunPhase("UNKNOWN")
        with self.assertRaises(ValueError):
            EventType("UNKNOWN")

    def test_domain_core_has_no_framework_or_adapter_imports(self):
        root = Path(__file__).resolve().parents[2]
        forbidden = {"fastapi", "pydantic", "sqlalchemy", "alembic", "psycopg", "docker", "apps"}
        for path in (root / "packages/domain").glob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            imported = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imported.update(alias.name.split(".")[0] for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                    imported.add(node.module.split(".")[0])
            self.assertTrue(forbidden.isdisjoint(imported), f"{path}: {forbidden & imported}")

    def test_section_27_2_blocked_codes_are_exact(self):
        self.assertEqual(
            {
                "BASELINE_CONFLICT", "SCOPE_EXPANSION_REQUIRED", "PROTECTED_PATH_DENIED",
                "TOOLCHAIN_UNAVAILABLE", "VERIFICATION_ENV_UNAVAILABLE", "LLM_PROVIDER_UNAVAILABLE",
                "BUDGET_OR_QUOTA_EXCEEDED", "APPROVAL_EXPIRED", "WORKER_INTERRUPTED",
            },
            {item.code.value for item in BLOCKED_TRANSITIONS},
        )
        self.assertEqual(set(BlockedCode), {item.code for item in BLOCKED_TRANSITIONS})


if __name__ == "__main__":
    unittest.main()
