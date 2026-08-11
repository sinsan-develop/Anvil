from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a08_completion_validation.py"
CATALOG_PATH = ROOT / "docs/architecture/a08/A-08_COMPLETION_VALIDATION_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a08/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a08/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-08_EVIDENCE_MANIFEST.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a08_completion_validation", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-08 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A08CompletionValidationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_and_predecessors_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")

    def test_plan_actual_and_result_layers_remain_distinct(self) -> None:
        self.assertEqual(self.catalog["completion"]["plan_actual_fields"], checker.PLAN_ACTUAL_FIELDS)
        self.assertEqual(self.catalog["completion"]["result_layers"], checker.RESULT_LAYERS)
        self.assertFalse(self.catalog["completion"]["package_accepted_means_release"])

    def test_technical_results_are_exact_and_no_result_is_promoted(self) -> None:
        technical = self.catalog["technical_test"]
        self.assertEqual(technical["results"], checker.TECHNICAL_RESULTS)
        self.assertTrue(technical["static_mock_build_never_functional_pass"])
        self.assertTrue(technical["non_executed_never_pass"])

    def test_product_validation_is_criterion_and_hash_bound(self) -> None:
        pv = self.catalog["product_validation"]
        self.assertEqual(pv["verdicts"], checker.PV_VERDICTS)
        self.assertEqual(pv["criterion_fields"], checker.PV_CRITERION_FIELDS)
        self.assertTrue(pv["all_required_criteria_required"])
        self.assertTrue(pv["target_and_delivered_hash_must_match"])

    def test_defect_lifecycle_requires_independent_same_target_retest(self) -> None:
        defect = self.catalog["defect"]
        self.assertEqual(defect["lifecycle"], checker.DEFECT_LIFECYCLE)
        self.assertTrue(defect["developer_close_forbidden"])
        self.assertTrue(defect["independent_retest_required"])
        self.assertTrue(defect["same_target_hash_required"])

    def test_release_is_human_only_and_fail_closed(self) -> None:
        release = self.catalog["release_decision"]
        self.assertEqual(release["decisions"], checker.RELEASE_DECISIONS)
        self.assertTrue(release["authenticated_human_actor_required"])
        self.assertTrue(release["developer_decision_forbidden"])
        for action in ("release", "apply", "deploy"):
            self.assertEqual(release["guards"][action], checker.RELEASE_GUARDS)

    def test_rework_defer_reject_have_distinct_effects(self) -> None:
        effects = self.catalog["release_decision"]["effects"]
        self.assertEqual(effects["REWORK"], checker.REWORK_EFFECT)
        self.assertEqual(effects["DEFER"], checker.DEFER_EFFECT)
        self.assertEqual(effects["REJECT"], checker.REJECT_EFFECT)

    def test_hash_change_invalidates_evidence_and_decisions(self) -> None:
        invalidation = self.catalog["hash_invalidation"]
        self.assertEqual(invalidation["invalidated_objects"], checker.INVALIDATED_OBJECTS)
        self.assertTrue(invalidation["fail_closed_until_fresh_evidence"])
        self.assertFalse(invalidation["hash_reuse_allowed"])

    def test_documents_and_three_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutations_emit_declared_stable_reasons(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 35)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_permissions_static_qualifier_and_secrets_fail_closed(self) -> None:
        mutated = copy.deepcopy(self.catalog)
        mutated["permission_contract"]["developer_release_decision"] = True
        self.assertIn("PERMISSION_BOUNDARY_MISMATCH", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(self.catalog)
        mutated["verification_contracts"][0]["runtime_status"] = "PASS"
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(self.catalog)
        mutated["disclosure_contract"]["secret_visible"] = True
        self.assertIn("SENSITIVE_DISCLOSURE_FORBIDDEN", checker.validate_catalog(mutated))

    def test_manifest_binds_exact_raw_bytes_without_self_reference(self) -> None:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual(checker.validate_evidence_manifest(ROOT, manifest), [])
        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn("EVIDENCE_RAW_HASH_MISMATCH", checker.validate_evidence_manifest(ROOT, mutated))
        mutated = copy.deepcopy(manifest)
        mutated["self_reference"] = True
        self.assertIn("EVIDENCE_SELF_REFERENCE_FORBIDDEN", checker.validate_evidence_manifest(ROOT, mutated))


if __name__ == "__main__":
    unittest.main()
