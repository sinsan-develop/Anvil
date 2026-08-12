import hashlib
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import scripts.check_a14_workbench_prototype as checker
from scripts.evidence_portability import portable_hash


class A14WorkbenchArtifactTests(unittest.TestCase):
    def test_contract_covers_assigned_ids_and_runtime_boundary(self):
        contract = json.loads((ROOT / "docs/architecture/a14/A-14_WORKBENCH_CONTRACT.json").read_text(encoding="utf-8"))
        self.assertEqual(contract["assigned_verification_ids"], ["AV-UI-004", "AV-UI-010", "AV-GATE-005"])
        self.assertEqual(contract["provider_order"], ["CEREBRAS","GROQ","MISTRAL","OPENROUTER","UPSTAGE","GEMINI","ANTHROPIC","OPENAI","OLLAMA"])
        self.assertEqual(contract["fixture_runtime_actions"], ["EMPTY","QUOTA","CANCEL","RECONNECT"])
        self.assertTrue(contract["state_reset_contract"]["fixture_change_clears_scan_provider_evidence"])
        self.assertTrue(contract["state_reset_contract"]["unsafe_state_clears_provider_selection"])
        self.assertEqual(contract["runtime_boundary"]["production"], "NOT_EXECUTED")
        self.assertFalse(contract["badge_contract"]["fixture_counts_as_pass"])

    def test_browser_source_has_only_relative_api_calls_and_no_sensitive_literals(self):
        browser_paths = [ROOT / "apps/web/index.html", *sorted((ROOT / "apps/web/src").rglob("*"))]
        findings = checker.browser_source_findings([path for path in browser_paths if path.is_file()])
        self.assertEqual(findings, [])

    def test_manifest_exact_paths_and_self_reference_false(self):
        result = checker.check(ROOT)
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["manifest"]["self_reference"], False)
        self.assertEqual(len(result["manifest"]["paths"]), 17)
        self.assertEqual(
            portable_hash(ROOT, "apps/web/server.mjs"),
            "432FF673E9271B3016D3FD8A2E175266DE77C73A990D4287BBFD52772BCD16D5",
        )
        self.assertEqual(
            portable_hash(ROOT, "tests/browser/a14/workbench-runtime.test.mjs"),
            "D6DC23724479AEBD43C91BFCB2CAFFA38940BFD161BE5F2C4E2DEC914AF59D9F",
        )
        acceptance = json.loads(
            (ROOT / "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json").read_text(encoding="utf-8")
        )
        self.assertEqual("accepted", acceptance["artifact_status"])
        self.assertEqual("R5_EXECUTED_UI_FINDINGS_CLOSED", acceptance["actual_browser_status"])
        self.assertEqual("ENVIRONMENT_BLOCKED / NOT_EXECUTED", acceptance["r6_iab_status"])
        self.assertEqual("NOT_EXECUTED", acceptance["actual_provider_status"])
        self.assertEqual("NOT_EXECUTED", acceptance["actual_production_status"])
        self.assertEqual("READY", acceptance["next_package_status"])

    def test_standalone_checker_passes(self):
        result = subprocess.run([sys.executable, "scripts/check_a14_workbench_prototype.py", str(ROOT)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("A-14 WORKBENCH CHECK: PASS", result.stdout)

    def test_a15_start_manifest_binds_live_a14_successor_rows(self):
        manifest_path = ROOT / "docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file(), "A-15 start manifest is not materialized")
        manifest = json.loads(
            manifest_path.read_text(encoding="utf-8")
        )
        successor = manifest["a14_successor_projection"]
        self.assertEqual(
            "910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09",
            successor["predecessor_manifest_sha256"],
        )
        self.assertEqual(
            {"scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"},
            {row["path"] for row in successor["live_raw_checksums"]},
        )

    def test_revision3_rework_manifest_supplies_live_successor_rows(self):
        manifest = json.loads((ROOT / "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json").read_text(encoding="utf-8"))
        successor = manifest["a14_successor_projection"]
        self.assertEqual("B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8", successor["predecessor_manifest_sha256"])
        self.assertTrue(
            {
                "apps/web/src/app/workbench.js",
                "apps/web/src/features/workbench/workbench-state.js",
                "apps/web/tests/workbench.test.mjs",
            }
            <= {row["path"] for row in successor["live_raw_checksums"]}
        )

        completion = json.loads(
            (ROOT / "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R3.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            {row["path"] for row in successor["live_raw_checksums"]},
            {row["path"] for row in completion["a14_successor_projection"]["live_raw_checksums"]},
        )

    def test_revision3_manifest_recomputes_exact_non_self_target(self):
        manifest_path = ROOT / "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        declared = manifest["declared_changed_paths"]
        self.assertIn(manifest_path.relative_to(ROOT).as_posix(), declared)
        target_paths = [path for path in declared if path != manifest_path.relative_to(ROOT).as_posix()]
        rows = []
        content_bytes = 0
        bound_rows = {
            row["path"]: row
            for projection in (manifest["a13_successor_projection"], manifest["a14_successor_projection"])
            for row in projection["live_raw_checksums"]
        }
        for path in sorted(target_paths, key=lambda value: value.encode("utf-8")):
            row = bound_rows[path]
            content_bytes += row["bytes"]
            rows.append(f"{path}\t{row['bytes']}\t{row['sha256']}")
        canonical = "\n".join(rows).encode("utf-8")
        target = hashlib.sha256(canonical).hexdigest().upper()
        self.assertEqual(manifest["target_canonical_bytes"], len(canonical))
        self.assertEqual(manifest["target_content_bytes"], content_bytes)
        self.assertEqual(manifest["target_hash"], target)
        self.assertEqual(manifest["delivered_hash"], target)

if __name__ == "__main__":
    unittest.main()
