from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts/check_a03_onboarding.py"
CATALOG_PATH = ROOT / "docs/architecture/a03/A-03_ONBOARDING_CATALOG.json"
CANONICAL_PATH = ROOT / "tests/fixtures/a03/canonical-contract.json"
MUTATION_PATH = ROOT / "tests/fixtures/a03/mutation-catalog.json"


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_a03_onboarding", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("A-03 checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()


class A03OnboardingContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_and_a02_predecessor_are_exact(self) -> None:
        self.assertEqual(checker.validate_catalog(self.catalog), [])
        self.assertEqual(checker.validate_a02_predecessor(ROOT), [])
        fixture = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["catalog_sha256"], checker.sha256_file(CATALOG_PATH))
        self.assertEqual(fixture["expected_package_verdict"], "STATIC_CONTRACT_PASS")
        self.assertEqual(fixture["expected_runtime_verdict"], "RUNTIME_DEFERRED / NOT_EXECUTED")

    def test_five_screens_keep_dirty_and_untracked_separate(self) -> None:
        screens = {item["screen_id"]: item for item in self.catalog["screens"]}
        self.assertEqual(set(screens), {"PROJECT_DASHBOARD", "PROJECT_REGISTER", "REPOSITORY_ONBOARDING", "ONBOARDING_REVIEW", "PROJECT_DETAIL"})
        for screen_id in ("REPOSITORY_ONBOARDING", "ONBOARDING_REVIEW", "PROJECT_DETAIL"):
            fields = set(screens[screen_id]["fields"])
            self.assertIn("tracked_dirty_count", fields)
            self.assertIn("untracked_count", fields)
        self.assertTrue(self.catalog["preservation_contract"]["tracked_dirty_and_untracked_separate"])

    def test_read_only_scan_and_fail_closed_states_forbid_mutation(self) -> None:
        preservation = self.catalog["preservation_contract"]
        self.assertEqual(preservation["scan_mode"], "READ_ONLY")
        for key in ("source_write_allowed", "install_allowed", "format_allowed", "git_mutation_allowed", "automatic_cleanup_allowed"):
            self.assertFalse(preservation[key])
        self.assertTrue(preservation["user_owned_source_preserved"])
        self.assertTrue(preservation["unknown_fail_closed"])
        self.assertEqual(checker.validate_catalog(self.catalog), [])

    def test_errors_permissions_dashboard_and_deep_links_are_bound(self) -> None:
        self.assertEqual([item["http_status"] for item in self.catalog["registration_errors"]], [409, 403, 422])
        permission = self.catalog["permission_contract"]
        self.assertTrue(permission["view_manage_separated"])
        self.assertEqual(permission["credential_display"], "REFERENCE_OR_MASKED_ONLY")
        dashboard = self.catalog["dashboard_contract"]
        self.assertEqual(len(dashboard["health_cards"]), 6)
        self.assertEqual(len(dashboard["operations_cards"]), 6)
        self.assertFalse(dashboard["skipped_counts_as_success"])
        self.assertIn("deep_link", dashboard["next_action_fields"])

    def test_documents_and_three_renders_are_semantically_bound(self) -> None:
        self.assertEqual(checker.validate_documents(ROOT, self.catalog), [])
        self.assertEqual(checker.validate_renders(ROOT, self.catalog), [])

    def test_hostile_mutations_all_emit_declared_stable_reason(self) -> None:
        fixture = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(fixture["mutations"]), 28)
        self.assertEqual(checker.validate_mutation_fixture(self.catalog, fixture), [])

    def test_runtime_pass_and_static_qualifier_forgery_are_rejected(self) -> None:
        runtime_pass = copy.deepcopy(self.catalog)
        runtime_pass["verification_contract"]["canonical_runtime_verdict"] = "PASS"
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(runtime_pass))
        wrong_owner = copy.deepcopy(self.catalog)
        wrong_owner["verification_contract"]["runtime_owners"]["AV-UI-003"] = ["A-03"]
        self.assertIn("VERIFICATION_CONTRACT_MISMATCH", checker.validate_catalog(wrong_owner))

    def test_manifest_binds_exact_raw_bytes_and_static_boundary(self) -> None:
        path = ROOT / "docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(checker.validate_evidence_manifest(ROOT, manifest), [])
        self.assertEqual(manifest["runtime_status"], "RUNTIME_DEFERRED / NOT_EXECUTED")
        self.assertEqual(manifest["evidence_qualifier"], "E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED")
        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn("EVIDENCE_RAW_HASH_MISMATCH", checker.validate_evidence_manifest(ROOT, mutated))

    def test_bundle_cli_contract_is_fail_closed(self) -> None:
        self.assertEqual(checker.validate_bundle(ROOT), [])
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            (temp / "docs/architecture/a03").mkdir(parents=True)
            (temp / "docs/architecture/a03/A-03_ONBOARDING_CATALOG.json").write_text("{}\n", encoding="utf-8")
            errors = checker.validate_bundle(temp)
            self.assertIn("A02_PREDECESSOR_BINDING_MISMATCH", errors)
            self.assertIn("SCREEN_SET_MISMATCH", errors)


if __name__ == "__main__":
    unittest.main()
