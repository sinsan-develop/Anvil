"""A-12 static cross-screen state contract tests (test-first)."""

from __future__ import annotations

import json
import copy
import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "docs/architecture/a12/A-12_SCREEN_STATE_CATALOG.json"
CHECKER = ROOT / "scripts/check_a12_screen_states.py"
MANIFEST = ROOT / "docs/evidence/manifests/A-12_EVIDENCE_MANIFEST.json"


def load_checker():
    spec = importlib.util.spec_from_file_location("check_a12_screen_states", CHECKER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class A12ScreenStateContractTests(unittest.TestCase):
    def test_catalog_exists_before_semantic_checks(self) -> None:
        self.assertTrue(CATALOG.is_file(), "A-12 machine-readable catalog is required")

    def test_catalog_has_complete_cross_surface_state_matrix(self) -> None:
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        required_states = {"LOADING", "EMPTY", "ERROR", "BLOCKED", "QUOTA", "CANCEL", "RECONNECT"}
        self.assertEqual(required_states, set(catalog["required_states"]))
        self.assertGreaterEqual(len(catalog["surfaces"]), 20)
        for surface in catalog["surfaces"]:
            self.assertEqual(required_states, set(surface["states"]))
            self.assertEqual("PERMISSION_DENIED", surface["permission_guard"])
        for row in catalog["state_envelopes"]:
            self.assertTrue(set(catalog["required_envelope_fields"]).issubset(row["envelope_fields"]))

    def test_non_pass_evidence_cannot_use_positive_semantics(self) -> None:
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        badges = {item["status"]: item for item in catalog["badge_catalog"]}
        self.assertEqual({"PASS", "FAIL", "SKIPPED", "BLOCKED", "ERROR", "NOT_EXECUTED", "MOCK", "FIXTURE", "STATIC"}, set(badges))
        for status in ("FAIL", "SKIPPED", "BLOCKED", "ERROR", "NOT_EXECUTED", "MOCK", "FIXTURE", "STATIC"):
            self.assertFalse(badges[status]["counts_as_pass"])
            self.assertNotEqual("success", badges[status]["color_semantic"])
            self.assertNotEqual("check", badges[status]["icon"])

    def test_checker_rejects_all_hostile_fixtures(self) -> None:
        self.assertTrue(CHECKER.is_file(), "A-12 checker is required")
        result = subprocess.run(
            [sys.executable, str(CHECKER), "--verify-fixtures"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("hostile fixtures rejected", result.stdout)

    def test_checker_accepts_only_complete_catalog_and_manifest(self) -> None:
        result = subprocess.run(
            [sys.executable, str(CHECKER)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("A-12 screen-state contract: PASS", result.stdout)

    def test_predecessor_and_manifest_bypass_are_rejected(self) -> None:
        checker = load_checker()
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        tampered_catalog = copy.deepcopy(catalog)
        tampered_catalog["predecessor_bindings"][0]["sha256"] = "0" * 64
        self.assertIn("PREDECESSOR_INTEGRITY_MISMATCH", checker.validate_predecessors(ROOT, tampered_catalog))
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        tampered_manifest = copy.deepcopy(manifest)
        tampered_manifest["target_hash"] = "0" * 64
        self.assertIn("EVIDENCE_TARGET_HASH_MISMATCH", checker.validate_manifest_document(ROOT, tampered_manifest))


if __name__ == "__main__":
    unittest.main()
