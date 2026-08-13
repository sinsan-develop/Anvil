import inspect
from pathlib import Path
import unittest

from packages.api.design_contracts import ApproveDesignRequest, ContractErrorCode
from packages.persistence.design_repository import DesignArtifactRepository


ROOT = Path(__file__).resolve().parents[2]


class DesignRepositoryTests(unittest.TestCase):
    def test_repository_port_and_api_contract_are_framework_neutral(self):
        self.assertTrue(getattr(DesignArtifactRepository, "_is_protocol", False))
        methods = {name for name, value in inspect.getmembers(DesignArtifactRepository, inspect.isfunction) if not name.startswith("_")}
        self.assertEqual({"get", "save", "list_decisions"}, methods)
        request = ApproveDesignRequest("spec-1", "sha256:" + "a" * 64, "approval-1", "sinsan")
        self.assertEqual("approval-1", request.root_human_approval_id)
        self.assertEqual("HUMAN_APPROVAL_REQUIRED", ContractErrorCode.HUMAN_APPROVAL_REQUIRED.value)
        with self.assertRaises(ValueError):
            ApproveDesignRequest("", "not-a-hash", "", "")

    def test_migration_is_reversible_and_contains_lineage_integrity_columns(self):
        text = (ROOT / "migrations/versions/0002_design_artifacts.py").read_text(encoding="utf-8")
        for token in ("down_revision = \"0001_base\"", "def upgrade", "def downgrade", "design_artifacts", "decision_records", "design_baselines", "nonsemantic_revision_bindings", "carryover_items", "root_human_approval_id", "parent_baseline_id", "content_hash", "timezone=True"):
            self.assertIn(token, text)


if __name__ == "__main__":
    unittest.main()
