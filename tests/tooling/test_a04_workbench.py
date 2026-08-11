from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a04_workbench.py"
CATALOG_PATH = ROOT / "docs/architecture/a04/A-04_WORKBENCH_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a04/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a04/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a04_workbench", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-04 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A04WorkbenchContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_and_three_predecessors_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")
        self.assertEqual(fixture["expected_runtime_verdict"], "RUNTIME_DEFERRED / NOT_EXECUTED")

    def test_requirements_confirm_is_fail_closed(self) -> None:
        contract = self.catalog["requirements_contract"]
        self.assertEqual(
            contract["fields"],
            ["objective", "acceptance_criteria", "included_scope", "excluded_scope", "protected_scope", "assumptions", "questions"],
        )
        self.assertEqual(contract["confirm_guard"]["minimum_acceptance_criteria"], 1)
        self.assertEqual(contract["confirm_guard"]["mandatory_unanswered_count"], 0)
        self.assertTrue(contract["confirm_guard"]["all_assumptions_user_confirmed"])
        self.assertTrue(contract["agent_guess_separated_from_confirmed_fact"])

    def test_a01_rail_is_consumed_without_redefinition(self) -> None:
        rail = self.catalog["phase_rail_contract"]
        self.assertEqual(rail["step_ids"], [f"STEP-{number:02d}" for number in range(1, 15)])
        self.assertEqual(rail["human_intervention_points"], ["STEP-03", "STEP-06", "STEP-10", "STEP-12", "STEP-14"])
        self.assertEqual(set(rail["path_ids"]), {"PATH-NORMAL", "PATH-REJECT", "PATH-REVISE", "PATH-STOP", "PATH-RESUME"})
        self.assertFalse(rail["redefinition_allowed"])

    def test_modes_high_risk_and_execute_guards_remain_separate(self) -> None:
        control = self.catalog["control_contract"]
        self.assertEqual(control["control_levels"], ["LIGHT", "STANDARD", "CONTROLLED"])
        self.assertEqual(control["execution_strategies"], ["SINGLE_WORKER", "DELEGATED", "PARALLEL_BATCH"])
        self.assertEqual(control["failure_policies"], ["STOP", "CONTINUE_INDEPENDENT", "COLLECT_AND_REVIEW"])
        self.assertTrue(control["axes_separated"])
        self.assertEqual(control["high_risk_override"], {"control_level": "CONTROLLED", "failure_policy": "STOP"})
        self.assertEqual(self.catalog["execution_guard"], {"approval_required": True, "worker_lease_required": True, "write_lease_required_for_mutation": True, "automatic_execute_without_guards": False})

    def test_stop_resume_prevents_duplicate_execution(self) -> None:
        resume = self.catalog["stop_resume_contract"]
        self.assertEqual(resume["actions"], ["safe_resume", "hold", "restart", "discard"])
        self.assertTrue(resume["resume_guard"]["same_subject_hash_required"])
        self.assertTrue(resume["resume_guard"]["checkpoint_required"])
        self.assertTrue(resume["resume_guard"]["completed_steps_restored"])
        self.assertTrue(resume["resume_guard"]["side_effect_reconciliation_required"])
        self.assertFalse(resume["resume_guard"]["duplicate_execution_allowed"])

    def test_status_permission_and_preservation_are_honest(self) -> None:
        status = self.catalog["status_contract"]
        self.assertTrue(status["phase_and_run_status_separated"])
        self.assertEqual(status["non_success_statuses"], ["WAITING", "BLOCKED", "INTERRUPTED", "SKIPPED"])
        permission = self.catalog["permission_contract"]
        self.assertTrue(permission["capabilities_separated"])
        self.assertTrue(permission["unauthorized_action_disabled"])
        self.assertTrue(permission["reason_and_next_action_visible"])
        self.assertTrue(self.catalog["preservation_contract"]["draft_and_input_preserved_on_error"])
        self.assertTrue(self.catalog["preservation_contract"]["a03_unknown_and_conflict_fail_closed"])

    def test_documents_and_two_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT, self.catalog), [])
        self.assertEqual(checker.validate_renders(ROOT, self.catalog), [])

    def test_hostile_mutations_emit_declared_stable_reasons(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 30)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_static_qualifier_and_runtime_owners_cannot_be_promoted(self) -> None:
        runtime_pass = copy.deepcopy(self.catalog)
        runtime_pass["verification_contract"]["canonical_runtime_verdict"] = "PASS"
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(runtime_pass))
        wrong_owner = copy.deepcopy(self.catalog)
        wrong_owner["verification_contract"]["runtime_owners"]["AV-UI-004"] = ["A-04"]
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(wrong_owner))

    def test_manifest_binds_exact_raw_bytes_without_self_reference(self) -> None:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual(checker.validate_evidence_manifest(ROOT, manifest), [])
        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn("EVIDENCE_RAW_HASH_MISMATCH", checker.validate_evidence_manifest(ROOT, mutated))
        mutated = copy.deepcopy(manifest)
        mutated["self_reference"] = True
        self.assertIn("EVIDENCE_SELF_REFERENCE_FORBIDDEN", checker.validate_evidence_manifest(ROOT, mutated))

    def test_bundle_contract_fails_closed_when_catalog_is_invalid(self) -> None:
        self.assertEqual(checker.validate_bundle(ROOT), [])
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            path = temp / "docs/architecture/a04/A-04_WORKBENCH_CATALOG.json"
            path.parent.mkdir(parents=True)
            path.write_text("{}\n", encoding="utf-8")
            errors = checker.validate_bundle(temp)
            self.assertIn("PREDECESSOR_BINDING_MISMATCH", errors)
            self.assertIn("WORKBENCH_SURFACE_CONTRACT_MISMATCH", errors)


if __name__ == "__main__":
    unittest.main()
