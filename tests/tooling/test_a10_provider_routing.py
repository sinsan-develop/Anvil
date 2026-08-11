from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a10_provider_routing.py"
CATALOG_PATH = ROOT / "docs/architecture/a10/A-10_PROVIDER_ROUTING_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a10/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a10/mutation-catalog.json"
MANIFEST_PATH = ROOT / "docs/evidence/manifests/A-10_EVIDENCE_MANIFEST.json"


def _load_checker():
    if not CHECKER_PATH.is_file():
        return None
    spec = importlib.util.spec_from_file_location("check_a10_provider_routing", CHECKER_PATH)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class A10ProviderRoutingContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_checker()

    def _require_contract(self):
        self.assertIsNotNone(self.checker, "A-10 static-contract checker is not implemented")
        self.assertTrue(CATALOG_PATH.is_file(), "A-10 provider catalog is not implemented")
        return self.checker, json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_canonical_catalog_and_predecessor_integrity_are_valid(self) -> None:
        checker, catalog = self._require_contract()
        self.assertEqual(checker.validate_catalog(catalog), [])
        self.assertEqual(checker.validate_predecessors(ROOT), [])
        canonical = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(canonical["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(canonical["expected_package_verdict"], "STATIC_CONTRACT_PASS")

    def test_provider_order_and_unavailable_states_remain_visible(self) -> None:
        checker, catalog = self._require_contract()
        self.assertEqual([row["provider_id"] for row in catalog["provider_catalog"]], checker.PROVIDERS)
        self.assertTrue(all(row["unavailable_reason_visible"] for row in catalog["provider_catalog"]))
        mutated = copy.deepcopy(catalog)
        mutated["provider_catalog"].reverse()
        self.assertIn("PROVIDER_CATALOG_ORDER_MISMATCH", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(catalog)
        mutated["provider_catalog"][0]["unavailable_reason_visible"] = False
        self.assertIn("UNAVAILABLE_STATE_HIDDEN", checker.validate_catalog(mutated))

    def test_capability_probe_benchmark_and_next_snapshot_activation_are_required(self) -> None:
        checker, catalog = self._require_contract()
        self.assertTrue(catalog["capability_snapshot"]["probe_required"])
        self.assertTrue(catalog["capability_snapshot"]["benchmark_required"])
        self.assertTrue(catalog["capability_snapshot"]["activation_next_snapshot_only"])
        mutated = copy.deepcopy(catalog)
        mutated["capability_snapshot"]["benchmark_required"] = False
        self.assertIn("CAPABILITY_BENCHMARK_REQUIRED", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(catalog)
        mutated["capability_snapshot"]["activation_next_snapshot_only"] = False
        self.assertIn("ROUTING_ACTIVATION_SNAPSHOT_BYPASS", checker.validate_catalog(mutated))

    def test_role_routing_requires_capability_privacy_and_egress_match(self) -> None:
        checker, catalog = self._require_contract()
        self.assertTrue(catalog["role_routing"]["capability_match_required"])
        self.assertTrue(catalog["role_routing"]["privacy_match_required"])
        self.assertTrue(catalog["role_routing"]["egress_match_required"])
        mutated = copy.deepcopy(catalog)
        mutated["role_routing"]["egress_match_required"] = False
        self.assertIn("ROUTING_EGRESS_MATCH_BYPASS", checker.validate_catalog(mutated))

    def test_egress_expansion_and_unsafe_fallback_fail_closed(self) -> None:
        checker, catalog = self._require_contract()
        self.assertEqual(catalog["data_egress_profile"]["modes"], checker.EGRESS_MODES)
        self.assertTrue(catalog["data_egress_profile"]["expansion_requires_human_approval"])
        self.assertTrue(catalog["fallback_policy"]["unsafe_fallback_blocked"])
        mutated = copy.deepcopy(catalog)
        mutated["data_egress_profile"]["expansion_requires_human_approval"] = False
        self.assertIn("EGRESS_EXPANSION_APPROVAL_BYPASS", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(catalog)
        mutated["fallback_policy"]["unsafe_fallback_blocked"] = False
        self.assertIn("UNSAFE_FALLBACK_NOT_BLOCKED", checker.validate_catalog(mutated))

    def test_secret_and_endpoint_disclosure_are_rejected(self) -> None:
        checker, catalog = self._require_contract()
        self.assertFalse(catalog["disclosure_contract"]["secret_literal_visible"])
        self.assertFalse(catalog["disclosure_contract"]["raw_internal_endpoint_visible"])
        self.assertTrue(catalog["secret_contract"]["revoked_or_expired_blocks_routing"])
        mutated = copy.deepcopy(catalog)
        mutated["disclosure_contract"]["secret_literal_visible"] = True
        self.assertIn("SECRET_LITERAL_DISCLOSURE_FORBIDDEN", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(catalog)
        mutated["secret_contract"]["revoked_or_expired_blocks_routing"] = False
        self.assertIn("REVOKED_SECRET_ROUTE_BYPASS", checker.validate_catalog(mutated))

    def test_capability_drift_and_permission_collapse_are_rejected(self) -> None:
        checker, catalog = self._require_contract()
        self.assertEqual(catalog["capability_drift"]["blocked_code"], "BLOCKED_CAPABILITY_DRIFT")
        self.assertTrue(catalog["permission_contract"]["independent_permissions_required"])
        mutated = copy.deepcopy(catalog)
        mutated["capability_drift"]["blocked_code"] = "WARN_CAPABILITY_DRIFT"
        self.assertIn("CAPABILITY_DRIFT_FAIL_CLOSED_REQUIRED", checker.validate_catalog(mutated))
        mutated = copy.deepcopy(catalog)
        mutated["permission_contract"]["independent_permissions_required"] = False
        self.assertIn("PERMISSION_COLLAPSE_FORBIDDEN", checker.validate_catalog(mutated))

    def test_documents_renders_and_runtime_boundary_are_valid(self) -> None:
        checker, _ = self._require_contract()
        self.assertEqual(checker.validate_documents(ROOT), [])
        self.assertEqual(checker.validate_renders(ROOT), [])

    def test_hostile_mutation_fixture_observes_all_stable_codes(self) -> None:
        checker, catalog = self._require_contract()
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 18)
        self.assertEqual(checker.validate_mutation_fixture(catalog, fixture), [])

    def test_manifest_binds_exact_raw_artifacts_without_self_reference(self) -> None:
        checker, _ = self._require_contract()
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
