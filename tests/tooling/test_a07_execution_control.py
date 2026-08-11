from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a07_execution_control.py"
CATALOG_PATH = ROOT / "docs/architecture/a07/A-07_EXECUTION_CONTROL_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a07/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a07/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-07_EVIDENCE_MANIFEST.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a07_execution_control", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-07 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A07ExecutionControlContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_and_predecessors_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")

    def test_execution_and_task_graph_keep_states_and_dependencies_distinct(self) -> None:
        self.assertEqual(self.catalog["execution_control"]["run_states"], checker.RUN_STATES)
        graph = self.catalog["task_graph"]
        self.assertEqual(graph["step_states"], checker.STEP_STATES)
        self.assertTrue(graph["dag_cycle_rejected"])
        self.assertTrue(graph["failed_dependency_blocks_run"])
        self.assertFalse(graph["independent_failure_allows_overall_success"])

    def test_agent_drawer_has_operational_fields_and_authorized_stop(self) -> None:
        agent = self.catalog["agent_drawer"]
        self.assertEqual(agent["fields"], checker.AGENT_FIELDS)
        self.assertTrue(agent["unauthorized_stop_disabled"])
        self.assertTrue(agent["stop_reason_and_next_action_visible"])
        self.assertTrue(agent["stop_blocks_new_action"])

    def test_mutation_requires_fresh_worker_and_write_fences(self) -> None:
        fencing = self.catalog["fencing_budget"]
        self.assertTrue(fencing["worker_and_write_required_for_mutation"])
        self.assertTrue(fencing["stale_token_commit_rejected"])
        self.assertTrue(fencing["path_alias_conflict_rejected"])
        self.assertTrue(fencing["heartbeat_expiry_blocks_execution"])

    def test_budget_reserves_before_request_and_reconciles(self) -> None:
        budget = self.catalog["fencing_budget"]["budget"]
        self.assertEqual(budget["sequence"], checker.BUDGET_SEQUENCE)
        self.assertTrue(budget["hard_limit_blocks"])
        self.assertTrue(budget["usage_must_reconcile"])
        self.assertFalse(budget["provider_request_before_reservation"])

    def test_failure_count_and_takeover_are_fail_closed(self) -> None:
        inbox = self.catalog["exception_inbox"]
        self.assertEqual(inbox["failure_classes"], checker.FAILURE_CLASSES)
        self.assertTrue(inbox["same_lineage_and_fingerprint_required"])
        self.assertEqual(inbox["excluded_from_valid_count"], checker.EXCLUDED_FAILURES)
        takeover = self.catalog["takeover"]
        self.assertEqual(takeover["automatic_trigger_valid_failure_count"], 3)
        self.assertTrue(takeover["human_override_record_required"])
        self.assertEqual(takeover["packet_fields"], checker.TAKEOVER_PACKET_FIELDS)

    def test_recovery_prevents_duplicate_execution(self) -> None:
        recovery = self.catalog["recovery_center"]
        self.assertEqual(recovery["reconciliation_dimensions"], checker.RECOVERY_DIMENSIONS)
        self.assertTrue(recovery["exact_checkpoint_hash_required"])
        self.assertTrue(recovery["side_effect_classification_required"])
        self.assertTrue(recovery["duplicate_execution_forbidden"])
        self.assertFalse(recovery["resume_after_stop_without_reconcile"])

    def test_dir_lifecycle_and_verdict_are_separate_and_owner_cleared(self) -> None:
        contract = self.catalog["dir_panel"]
        self.assertEqual(contract["lifecycle_states"], checker.DIR_STATES)
        self.assertEqual(contract["verdicts"], checker.DIR_VERDICTS)
        self.assertTrue(contract["state_and_verdict_separate"])
        self.assertTrue(contract["owner_direction_required_to_clear"])
        self.assertFalse(contract["auto_clear_allowed"])
        self.assertFalse(contract["actual_dir_reached_in_a07"])

    def test_documents_and_three_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutations_emit_declared_stable_reasons(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 35)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_static_qualifier_and_secrets_cannot_be_promoted(self) -> None:
        mutated = copy.deepcopy(self.catalog)
        mutated["verification_contract"]["runtime_status"] = "PASS"
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
