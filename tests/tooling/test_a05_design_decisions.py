from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a05_design_decisions.py"
CATALOG_PATH = ROOT / "docs/architecture/a05/A-05_DESIGN_DECISION_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a05/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a05/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a05_design_decisions", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-05 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A05DesignDecisionContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_and_four_predecessors_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")
        self.assertEqual(fixture["expected_runtime_verdict"], "RUNTIME_DEFERRED / NOT_EXECUTED")

    def test_proposals_require_two_complete_evidence_backed_alternatives(self) -> None:
        proposal = self.catalog["proposal_contract"]
        self.assertEqual(proposal["minimum_proposals"], 2)
        self.assertEqual(len(proposal["sample_proposals"]), 2)
        self.assertTrue(proposal["readiness_guard"]["all_fields_required"])
        self.assertTrue(proposal["readiness_guard"]["evidence_refs_required"])
        self.assertFalse(proposal["agent_recommendation"]["is_selected"])
        self.assertFalse(proposal["agent_recommendation"]["is_approved"])

    def test_human_decision_and_exact_subject_hash_are_mandatory(self) -> None:
        decision = self.catalog["decision_contract"]
        guard = decision["confirmation_guard"]
        self.assertTrue(guard["authenticated_human_required"])
        self.assertTrue(guard["exact_subject_hash_required"])
        self.assertFalse(guard["agent_can_confirm"])
        self.assertIn("SUPERSEDED", decision["states"])

    def test_hold_carryover_and_lineage_are_preserved(self) -> None:
        decision = self.catalog["decision_contract"]
        self.assertTrue(decision["carryover_contract"]["required_for_hold_and_future_extension"])
        self.assertTrue(decision["lineage_contract"]["acyclic_required"])
        self.assertTrue(decision["lineage_contract"]["superseded_preserved"])
        self.assertTrue(decision["lineage_contract"]["carryover_target_must_exist"])

    def test_design_approval_is_fail_closed_and_immutable(self) -> None:
        design = self.catalog["design_baseline_contract"]
        guard = design["approval_guard"]
        self.assertEqual(guard["unresolved_required_decisions"], 0)
        self.assertTrue(guard["source_evidence_valid_required"])
        self.assertTrue(guard["authenticated_human_required"])
        self.assertTrue(guard["exact_spec_hash_required"])
        self.assertTrue(design["immutability_contract"]["approved_baseline_immutable"])
        self.assertTrue(design["immutability_contract"]["spec_change_invalidates_approval"])
        self.assertTrue(design["immutability_contract"]["new_revision_and_approval_required"])

    def test_permissions_execute_and_disclosure_fail_closed(self) -> None:
        permission = self.catalog["permission_contract"]
        self.assertTrue(permission["capabilities_separated"])
        self.assertTrue(permission["unauthorized_action_disabled"])
        self.assertTrue(permission["reason_and_next_action_visible"])
        self.assertFalse(self.catalog["execution_guard"]["execute_open_in_a05"])
        self.assertTrue(self.catalog["execution_guard"]["human_select_opens_design_refinement_only"])
        self.assertFalse(self.catalog["disclosure_contract"]["secret_value_visible"])
        self.assertFalse(self.catalog["disclosure_contract"]["raw_internal_endpoint_visible"])

    def test_documents_and_two_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutations_emit_declared_stable_reasons(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 30)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_static_qualifier_and_runtime_owners_cannot_be_promoted(self) -> None:
        mutated = copy.deepcopy(self.catalog)
        mutated["verification_contract"]["canonical_runtime_verdict"] = "PASS"
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(self.catalog)
        mutated["verification_contract"]["runtime_owners"] = ["A-05"]
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
            path = temp / "docs/architecture/a05/A-05_DESIGN_DECISION_CATALOG.json"
            path.parent.mkdir(parents=True)
            path.write_text("{}\n", encoding="utf-8")
            errors = checker.validate_bundle(temp)
            self.assertIn("PREDECESSOR_BINDING_MISMATCH", errors)
            self.assertIn("PROPOSAL_CONTRACT_MISMATCH", errors)


if __name__ == "__main__":
    unittest.main()
