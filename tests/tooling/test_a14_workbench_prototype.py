import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import scripts.check_a14_workbench_prototype as checker


class A14WorkbenchArtifactTests(unittest.TestCase):
    def test_contract_covers_assigned_ids_and_runtime_boundary(self):
        contract = json.loads((ROOT / "docs/architecture/a14/A-14_WORKBENCH_CONTRACT.json").read_text(encoding="utf-8"))
        self.assertEqual(contract["assigned_verification_ids"], ["AV-UI-004", "AV-UI-010", "AV-GATE-005"])
        self.assertEqual(contract["provider_order"], ["CEREBRAS","GROQ","MISTRAL","OPENROUTER","UPSTAGE","GEMINI","ANTHROPIC","OPENAI","OLLAMA"])
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

    def test_standalone_checker_passes(self):
        result = subprocess.run([sys.executable, "scripts/check_a14_workbench_prototype.py", str(ROOT)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("A-14 WORKBENCH CHECK: PASS", result.stdout)

    def test_revision3_rework_manifest_supplies_live_successor_rows(self):
        manifest = json.loads((ROOT / "docs/evidence/manifests/A-14_REWORK_START_MANIFEST_R3.json").read_text(encoding="utf-8"))
        successor = manifest["a14_successor_projection"]
        self.assertEqual("B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8", successor["predecessor_manifest_sha256"])
        self.assertIn("scripts/check_a14_workbench_prototype.py", {row["path"] for row in successor["live_raw_checksums"]})


if __name__ == "__main__":
    unittest.main()
