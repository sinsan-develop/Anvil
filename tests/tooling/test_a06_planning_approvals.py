from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a06_planning_approvals.py"
CATALOG_PATH = ROOT / "docs/architecture/a06/A-06_PLANNING_APPROVAL_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a06/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a06/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a06_planning_approvals", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-06 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A06PlanningApprovalContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_and_five_predecessors_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")

    def test_work_plan_and_iteration_are_complete_and_nonexpanding(self) -> None:
        plan = self.catalog["work_plan_contract"]
        self.assertEqual(plan["fields"], checker.WORK_PLAN_FIELDS)
        iteration = self.catalog["iteration_contract"]
        self.assertEqual(iteration["fields"], checker.ITERATION_FIELDS)
        self.assertTrue(iteration["parent_scope_subset_required"])

    def test_work_instruction_matches_g04_exact_template(self) -> None:
        wi = self.catalog["work_instruction_contract"]
        self.assertEqual(wi["template_fields"], checker.G04_WI_FIELDS)
        self.assertTrue(wi["allowed_forbidden_disjoint_required"])
        self.assertTrue(wi["reconstruction_and_verification_required"])

    def test_invocation_is_reference_only_and_stales_on_hash_change(self) -> None:
        invocation = self.catalog["invocation_contract"]
        self.assertEqual(invocation["duplicated_work_instruction_sections"], [])
        self.assertEqual(invocation["duplicated_section_count"], 0)
        self.assertTrue(invocation["work_instruction_hash_change_marks_stale"])
        self.assertTrue(invocation["approval_subject_hash_change_marks_stale"])

    def test_five_approval_lanes_are_independent_and_fail_closed(self) -> None:
        approval = self.catalog["approval_contract"]
        self.assertEqual(approval["types"], checker.APPROVAL_TYPES)
        self.assertTrue(approval["cross_substitution_forbidden"])
        self.assertTrue(approval["cross_record_reuse_forbidden"])
        self.assertTrue(approval["expiry_blocks"])
        self.assertTrue(approval["artifact_hash_change_invalidates"])
        self.assertFalse(approval["approval_triggers_execution"])

    def test_nonsemantic_binding_preserves_human_scope(self) -> None:
        contract = self.catalog["nonsemantic_baseline_contract"]
        self.assertEqual(contract["fields"], checker.NONSEMANTIC_FIELDS)
        self.assertFalse(contract["sample_binding"]["scope_expanded"])
        self.assertEqual(contract["sample_binding"]["semantic_diff"], "NONE")
        self.assertTrue(contract["material_change_requires_human_approval"])
        self.assertTrue(contract["root_and_parent_chain_required"])

    def test_permissions_and_execution_boundary_are_separate(self) -> None:
        permission = self.catalog["permission_contract"]
        self.assertEqual(permission["capabilities"], checker.PERMISSIONS)
        self.assertTrue(permission["capabilities_separated"])
        self.assertTrue(permission["unauthorized_action_disabled"])
        self.assertTrue(permission["reason_and_next_action_visible"])
        self.assertFalse(self.catalog["execution_guard"]["apply_open_in_a06"])
        self.assertFalse(self.catalog["execution_guard"]["deploy_open_in_a06"])
        self.assertFalse(self.catalog["execution_guard"]["destructive_open_in_a06"])

    def test_documents_and_three_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutations_emit_declared_stable_reasons(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 35)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_static_qualifier_cannot_be_promoted(self) -> None:
        mutated = copy.deepcopy(self.catalog)
        mutated["verification_contract"]["runtime_status"] = "PASS"
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(mutated))

    def test_manifest_binds_exact_raw_bytes_without_self_reference(self) -> None:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual(checker.validate_evidence_manifest(ROOT, manifest), [])
        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn("EVIDENCE_RAW_HASH_MISMATCH", checker.validate_evidence_manifest(ROOT, mutated))
        mutated = copy.deepcopy(manifest)
        mutated["self_reference"] = True
        self.assertIn("EVIDENCE_SELF_REFERENCE_FORBIDDEN", checker.validate_evidence_manifest(ROOT, mutated))

    def test_bundle_fails_closed_when_catalog_is_invalid(self) -> None:
        self.assertEqual(checker.validate_bundle(ROOT), [])
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            path = temp / "docs/architecture/a06/A-06_PLANNING_APPROVAL_CATALOG.json"
            path.parent.mkdir(parents=True)
            path.write_text("{}\n", encoding="utf-8")
            errors = checker.validate_bundle(temp)
            self.assertIn("PREDECESSOR_BINDING_MISMATCH", errors)
            self.assertIn("WORK_PLAN_CONTRACT_MISMATCH", errors)


if __name__ == "__main__":
    unittest.main()
