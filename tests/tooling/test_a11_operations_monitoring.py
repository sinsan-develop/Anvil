from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a11_operations_monitoring.py"
CATALOG_PATH = ROOT / "docs/architecture/a11/A-11_OPERATIONS_MONITORING_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a11/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a11/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-11_EVIDENCE_MANIFEST.json"
SUCCESSOR_PATH = ROOT / "docs/evidence/manifests/A-14_A11_SUCCESSOR_R5.json"


def _load_checker():
    if not CHECKER_PATH.is_file():
        return None
    spec = importlib.util.spec_from_file_location("check_a11_operations_monitoring", CHECKER_PATH)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class A11OperationsMonitoringContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_checker()

    def _require_contract(self):
        self.assertIsNotNone(self.checker, "A-11 static-contract checker is not implemented")
        self.assertTrue(CATALOG_PATH.is_file(), "A-11 operations catalog is not implemented")
        return self.checker, json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_canonical_catalog_and_predecessor_integrity_are_valid(self) -> None:
        checker, catalog = self._require_contract()
        self.assertEqual(checker.validate_catalog(catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        canonical = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(canonical["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(canonical["expected_package_verdict"], "STATIC_CONTRACT_PASS")

    def test_system_detector_evidence_and_actionability_are_required(self) -> None:
        checker, catalog = self._require_contract()
        self.assertTrue(catalog["anomaly_contract"]["system_detector_required"])
        self.assertEqual(checker.validate_catalog(catalog), [])
        for field, code in (
            ("system_detector_required", "MANUAL_ONLY_ANOMALY_PROMOTION_FORBIDDEN"),
            ("cause_required", "ANOMALY_CAUSE_REQUIRED"),
            ("impact_required", "ANOMALY_IMPACT_REQUIRED"),
            ("next_action_required", "ANOMALY_NEXT_ACTION_REQUIRED"),
            ("deep_link_required", "ANOMALY_DEEP_LINK_REQUIRED"),
        ):
            mutated = copy.deepcopy(catalog)
            mutated["anomaly_contract"][field] = False
            self.assertIn(code, checker.validate_catalog(mutated))

    def test_stale_health_alert_lifecycle_and_dedupe_fail_closed(self) -> None:
        checker, catalog = self._require_contract()
        self.assertTrue(catalog["health_contract"]["stale_signal_is_healthy_forbidden"])
        self.assertEqual(catalog["alert_contract"]["states"], ["open", "acknowledged", "resolved"])
        for path, value, code in (
            (("health_contract", "stale_signal_is_healthy_forbidden"), False, "STALE_HEALTHY_SIGNAL_FORBIDDEN"),
            (("alert_contract", "acknowledge_is_not_resolve"), False, "ALERT_ACK_RESOLVE_COLLAPSE_FORBIDDEN"),
            (("alert_contract", "resolve_evidence_required"), False, "ALERT_RESOLVE_EVIDENCE_REQUIRED"),
            (("alert_contract", "dedupe_key_required"), False, "ALERT_DEDUPE_KEY_REQUIRED"),
        ):
            mutated = copy.deepcopy(catalog)
            mutated[path[0]][path[1]] = value
            self.assertIn(code, checker.validate_catalog(mutated))

    def test_queue_worker_and_write_fencing_reject_stale_or_infinite_work(self) -> None:
        checker, catalog = self._require_contract()
        self.assertTrue(catalog["queue_contract"]["quarantine_required"])
        for path, value, code in (
            (("queue_contract", "stale_fencing_rejected"), False, "STALE_FENCING_REJECT_REQUIRED"),
            (("queue_contract", "max_attempts_required"), False, "INFINITE_RETRY_FORBIDDEN"),
            (("queue_contract", "quarantine_required"), False, "QUARANTINE_REQUIRED"),
            (("worker_lease_contract", "worker_and_write_fencing_separated"), False, "FENCING_LAYER_COLLAPSE_FORBIDDEN"),
        ):
            mutated = copy.deepcopy(catalog)
            mutated[path[0]][path[1]] = value
            self.assertIn(code, checker.validate_catalog(mutated))

    def test_budget_provider_and_deployment_guards_preserve_operational_order(self) -> None:
        checker, catalog = self._require_contract()
        self.assertEqual(catalog["budget_contract"]["sequence"], checker.BUDGET_SEQUENCE)
        self.assertEqual(catalog["deployment_contract"]["sequence"], checker.DEPLOYMENT_SEQUENCE)
        for path, value, code in (
            (("budget_contract", "reserve_before_provider_call"), False, "BUDGET_RESERVE_ORDER_REQUIRED"),
            (("budget_contract", "unknown_usage_zero_forbidden"), False, "UNKNOWN_USAGE_ZERO_FORBIDDEN"),
            (("budget_contract", "reconciliation_required"), False, "BUDGET_RECONCILIATION_REQUIRED"),
            (("provider_health_contract", "drift_blocks_unsafe_route"), False, "PROVIDER_DRIFT_FAIL_CLOSED_REQUIRED"),
            (("deployment_contract", "monitoring_window_required"), False, "DEPLOYMENT_MONITORING_WINDOW_REQUIRED"),
            (("deployment_contract", "owner_confirmation_required"), False, "DEPLOYMENT_OWNER_CONFIRMATION_REQUIRED"),
            (("deployment_contract", "automatic_data_loss_rollback_forbidden"), False, "AUTOMATIC_DATA_LOSS_ROLLBACK_FORBIDDEN"),
        ):
            mutated = copy.deepcopy(catalog)
            mutated[path[0]][path[1]] = value
            self.assertIn(code, checker.validate_catalog(mutated))

    def test_enums_permissions_sensitive_data_and_static_boundary_are_separated(self) -> None:
        checker, catalog = self._require_contract()
        for path, value, code in (
            (("enum_contract", "independent_enums_required"), False, "ENUM_COLLAPSE_FORBIDDEN"),
            (("permission_contract", "independent_permissions_required"), False, "PERMISSION_COLLAPSE_FORBIDDEN"),
            (("sensitive_data_contract", "raw_fencing_token_visible"), True, "RAW_FENCING_TOKEN_DISCLOSURE_FORBIDDEN"),
            (("sensitive_data_contract", "secret_literal_visible"), True, "SECRET_LITERAL_DISCLOSURE_FORBIDDEN"),
            (("runtime_boundary", "static_runtime_promotion_forbidden"), False, "STATIC_RUNTIME_PROMOTION_FORBIDDEN"),
        ):
            mutated = copy.deepcopy(catalog)
            mutated[path[0]][path[1]] = value
            self.assertIn(code, checker.validate_catalog(mutated))

    def test_documents_renders_and_runtime_boundary_are_valid(self) -> None:
        checker, _ = self._require_contract()
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutation_fixture_observes_all_stable_codes(self) -> None:
        checker, catalog = self._require_contract()
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 24)
        self.assertEqual(checker.validate_mutation_fixture(catalog, fixture), [])

    def test_manifest_binds_exact_raw_artifacts_without_self_reference(self) -> None:
        checker, _ = self._require_contract()
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn("EVIDENCE_RAW_HASH_MISMATCH", checker.validate_evidence_manifest(ROOT, mutated))
        mutated = copy.deepcopy(manifest)
        mutated["self_reference"] = True
        self.assertIn("EVIDENCE_SELF_REFERENCE_FORBIDDEN", checker.validate_evidence_manifest(ROOT, mutated))

        self.assertTrue(SUCCESSOR_PATH.is_file(), "A-11 successor registry is missing")
        with tempfile.TemporaryDirectory() as temp:
            clone = Path(temp) / "bundle"
            subprocess.run(
                ["git", "clone", "--quiet", "--local", "--no-hardlinks", str(ROOT), str(clone)],
                check=True,
            )
            clone_manifest = json.loads((clone / MANIFEST_PATH.relative_to(ROOT)).read_text(encoding="utf-8"))
            self.assertEqual(checker.validate_evidence_manifest(clone, clone_manifest), [])
            registry = json.loads((clone / SUCCESSOR_PATH.relative_to(ROOT)).read_text(encoding="utf-8"))
            registry["a11_successor_projection"]["live_raw_checksums"][0]["sha256"] = "0" * 64
            (clone / SUCCESSOR_PATH.relative_to(ROOT)).write_text(json.dumps(registry), encoding="utf-8")
            self.assertIn("EVIDENCE_RAW_HASH_MISMATCH", checker.validate_evidence_manifest(clone, clone_manifest))


if __name__ == "__main__":
    unittest.main()
