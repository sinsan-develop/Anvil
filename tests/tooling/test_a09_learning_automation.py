from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a09_learning_automation.py"
CATALOG_PATH = ROOT / "docs/architecture/a09/A-09_LEARNING_AUTOMATION_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a09/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a09/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-09_EVIDENCE_MANIFEST.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a09_learning_automation", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-09 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A09LearningAutomationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_predecessors_and_authority_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")

    def test_source_provenance_and_revoke_fail_closed(self) -> None:
        source = self.catalog["learning_source"]
        self.assertEqual(source["required_fields"], checker.SOURCE_FIELDS)
        self.assertTrue(source["revoked_blocks_new_use"])
        self.assertTrue(source["affected_runs_isolated_and_reported"])

    def test_candidate_activation_snapshot_and_rollback_are_distinct(self) -> None:
        lifecycle = self.catalog["learning_lifecycle"]
        self.assertEqual(lifecycle["states"], checker.LEARNING_STATES)
        self.assertTrue(lifecycle["current_run_snapshot_immutable"])
        self.assertTrue(lifecycle["rollback_preserves_lineage"])

    def test_skill_pilot_selection_and_progressive_disclosure(self) -> None:
        skill = self.catalog["skill_contract"]
        self.assertEqual(skill["lifecycle"], checker.SKILL_STATES)
        self.assertEqual(skill["minimum_representative_pilots"], 3)
        self.assertEqual(skill["selection_trace_fields"], checker.SELECTION_TRACE_FIELDS)
        self.assertEqual(skill["progressive_disclosure"], checker.PROGRESSIVE_DISCLOSURE)

    def test_hook_hash_trust_shadow_pilot_and_replay_are_fail_closed(self) -> None:
        hook = self.catalog["hook_contract"]
        self.assertEqual(hook["lifecycle"], checker.HOOK_STATES)
        self.assertEqual(hook["decision_precedence"], checker.HOOK_PRECEDENCE)
        self.assertTrue(hook["shadow_side_effect_forbidden"])
        self.assertTrue(hook["pilot_replay_required"])
        self.assertTrue(hook["changed_hash_invalidates_trust"])

    def test_hook_timeout_permission_recursion_and_modify_conflict_are_explicit(self) -> None:
        safety = self.catalog["hook_contract"]["safety"]
        self.assertEqual(safety["timeout_policies"], ["FAIL_OPEN", "FAIL_CLOSED"])
        self.assertEqual(safety["recursion_max_depth"], 1)
        self.assertTrue(safety["permission_profile_hash_bound"])
        self.assertTrue(safety["modify_conflict_blocks_without_merge"])

    def test_agent_definition_only_narrows_parent_permission(self) -> None:
        agent = self.catalog["agent_definition"]
        self.assertEqual(agent["permission_mode"], "inherit_and_narrow")
        self.assertTrue(agent["permission_expansion_forbidden"])
        self.assertEqual(agent["persistent_memory_default"], "none")
        self.assertTrue(agent["hook_subagent_spawn_forbidden"])

    def test_documents_and_three_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutations_emit_declared_stable_reasons(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 35)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_runtime_promotion_secrets_and_permission_expansion_fail_closed(self) -> None:
        mutated = copy.deepcopy(self.catalog)
        mutated["verification_contracts"][0]["runtime_status"] = "PASS"
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(self.catalog)
        mutated["disclosure_contract"]["secret_visible"] = True
        self.assertIn("SENSITIVE_DISCLOSURE_FORBIDDEN", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(self.catalog)
        mutated["agent_definition"]["permission_expansion_forbidden"] = False
        self.assertIn("AGENT_PERMISSION_BOUNDARY_MISMATCH", checker.validate_catalog(mutated))

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
