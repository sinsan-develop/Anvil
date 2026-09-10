import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import scripts.check_a14_workbench_prototype as checker
from scripts.evidence_portability import portable_hash


_A14_ACCEPTED = "4bb8155e2d4a6bae7db57d2832716bd08eb0e4f9"
_HISTORICAL_TEMP: tempfile.TemporaryDirectory[str] | None = None
_HISTORICAL_ROOT: Path | None = None


def setUpModule() -> None:
    global _HISTORICAL_TEMP, _HISTORICAL_ROOT
    _HISTORICAL_TEMP = tempfile.TemporaryDirectory(prefix="anvil-a14-frozen-")
    _HISTORICAL_ROOT = Path(_HISTORICAL_TEMP.name) / "repository"
    subprocess.run(
        [
            "git", "-c", "core.autocrlf=false", "-c", "core.eol=lf",
            "clone", "--quiet", "--local", "--no-hardlinks", "--no-checkout",
            str(ROOT), str(_HISTORICAL_ROOT),
        ],
        check=True,
    )


def tearDownModule() -> None:
    if _HISTORICAL_TEMP is not None:
        _HISTORICAL_TEMP.cleanup()


def _frozen_a14() -> tuple[Path, object]:
    assert _HISTORICAL_ROOT is not None
    subprocess.run(
        ["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "checkout", "--quiet", "--detach", "--force", _A14_ACCEPTED],
        cwd=_HISTORICAL_ROOT,
        check=True,
    )
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=_HISTORICAL_ROOT, check=True, capture_output=True, text=True).stdout.strip()
    status = subprocess.run(["git", "status", "--porcelain"], cwd=_HISTORICAL_ROOT, check=True, capture_output=True, text=True).stdout
    if head != _A14_ACCEPTED or status:
        raise AssertionError(f"unclean A-14 historical fixture: head={head} status={status!r}")
    checker_path = _HISTORICAL_ROOT / "scripts/check_a14_workbench_prototype.py"
    spec = importlib.util.spec_from_file_location("a14_historical_checker", checker_path)
    if spec is None or spec.loader is None:
        raise AssertionError("historical A-14 checker cannot be loaded")
    historical_checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(historical_checker)
    return _HISTORICAL_ROOT, historical_checker


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

    def test_browser_source_resolves_only_safe_root_relative_constants(self):
        with tempfile.TemporaryDirectory(prefix="anvil-a14-browser-source-", dir="D:/tmp") as temp:
            source = Path(temp) / "source.js"
            source.write_text(
                "const READY_PATH = '/api/ready';\n"
                "function render(container) { container.append('ready'); }\n"
                "fetch(READY_PATH);\n",
                encoding="utf-8",
            )
            self.assertEqual([], checker.browser_source_findings([source]))

            for label, content in (
                ("unresolved", "fetch(READY_PATH);\n"),
                ("protocol-relative", "const READY_PATH = '//example.invalid/ready';\nfetch(READY_PATH);\n"),
                ("absolute", "const READY_PATH = 'https://example.invalid/ready';\nfetch(READY_PATH);\n"),
            ):
                with self.subTest(label=label):
                    source.write_text(content, encoding="utf-8")
                    self.assertTrue(checker.browser_source_findings([source]))

    def test_browser_source_rejects_commented_shadowed_and_escaped_ready_path(self):
        with tempfile.TemporaryDirectory(prefix="anvil-a14-ready-path-adversarial-", dir="D:/tmp") as temp:
            source = Path(temp) / "source.js"
            cases = (
                ("commented-declaration", "/*\nconst READY_PATH = '/api/ready';\n*/\nfetch(READY_PATH);\n"),
                (
                    "shadowed-identifier",
                    "const READY_PATH = '/api/ready';\n"
                    "function load(READY_PATH) { return fetch(READY_PATH); }\n",
                ),
                (
                    "escaped-protocol-relative",
                    "const READY_PATH = '/\\x2fexample.invalid/ready';\nfetch(READY_PATH);\n",
                ),
            )
            for label, content in cases:
                with self.subTest(label=label):
                    source.write_text(content, encoding="utf-8")
                    self.assertTrue(checker.browser_source_findings([source]))

            declaration = Path(temp) / "declaration.js"
            use = Path(temp) / "unbound-use.js"
            declaration.write_text("export const READY_PATH = '/api/ready';\n", encoding="utf-8")
            use.write_text("fetch(READY_PATH);\n", encoding="utf-8")
            self.assertTrue(checker.browser_source_findings([declaration, use]))

    def test_browser_source_rejects_nested_ready_path_after_regex_literal_brace(self):
        with tempfile.TemporaryDirectory(prefix="anvil-a14-regex-brace-", dir="D:/tmp") as temp:
            source = Path(temp) / "source.js"
            source.write_text(
                "function nested() {\n"
                "const marker = /}/;\n"
                "const READY_PATH = '/api/ready';\n"
                "fetch(READY_PATH);\n"
                "}\n",
                encoding="utf-8",
            )
            self.assertTrue(checker.browser_source_findings([source]))

    def test_browser_source_rejects_nested_ready_path_when_regex_classes_balance_braces(self):
        with tempfile.TemporaryDirectory(prefix="anvil-a14-regex-class-braces-", dir="D:/tmp") as temp:
            source = Path(temp) / "source.js"
            source.write_text(
                "function load(flag, value) {\n"
                "  if (flag) /[}]/.test(value);\n"
                "  const READY_PATH = '/api/ready';\n"
                "  fetch(READY_PATH);\n"
                "  if (flag) /[{]/.test(value);\n"
                "}\n",
                encoding="utf-8",
            )
            self.assertTrue(checker.browser_source_findings([source]))

    def test_browser_source_rejects_template_interpolation_ready_path_shadow(self):
        with tempfile.TemporaryDirectory(prefix="anvil-a14-template-shadow-", dir="D:/tmp") as temp:
            source = Path(temp) / "source.js"
            source.write_text(
                "const READY_PATH = '/api/ready';\n"
                "const value = `prefix ${(() => { const READY_PATH = '//example.invalid/ready'; return fetch(READY_PATH); })()}`;\n"
                "fetch(READY_PATH);\n",
                encoding="utf-8",
            )
            self.assertTrue(checker.browser_source_findings([source]))

    def test_a14_successor_r6_registry_binds_live_scanner_and_test(self):
        registry_path = ROOT / "docs/evidence/manifests/A-14_A14_SUCCESSOR_R6.json"
        self.assertTrue(registry_path.is_file())
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        successor = registry["a14_successor_projection"]
        self.assertEqual(("a14_successor_registry", 6, False), (
            registry["artifact_type"], registry["revision"], registry["self_reference"]
        ))
        self.assertEqual(
            ("docs/evidence/manifests/A-14_A14_SUCCESSOR_R5.json", hashlib.sha256(
                (ROOT / "docs/evidence/manifests/A-14_A14_SUCCESSOR_R5.json").read_bytes()
            ).hexdigest().upper()),
            (successor["predecessor_registry_path"], successor["predecessor_registry_sha256"]),
        )
        rows = {row["path"]: row for row in successor["live_raw_checksums"]}
        self.assertEqual(
            {
                "apps/web/index.html",
                "apps/web/server.mjs",
                "apps/web/src/app/workbench.js",
                "apps/web/src/api/workbench-client.js",
                "apps/web/src/features/workbench/workbench-state.js",
                "apps/web/src/styles/workbench.css",
                "apps/web/tests/workbench.test.mjs",
                "tests/browser/a14/workbench-runtime.test.mjs",
                "scripts/check_a14_workbench_prototype.py",
                "tests/tooling/test_a14_workbench_prototype.py",
            },
            set(rows),
        )
        for path, row in rows.items():
            raw = (ROOT / path).read_bytes()
            self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest().upper()), (row["bytes"], row["sha256"]))

    def test_manifest_exact_paths_and_self_reference_false(self):
        historical_root, historical_checker = _frozen_a14()
        result = historical_checker.check(historical_root)
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["manifest"]["self_reference"], False)
        self.assertEqual(len(result["manifest"]["paths"]), 17)
        self.assertEqual(
            portable_hash(historical_root, "apps/web/server.mjs"),
            "432FF673E9271B3016D3FD8A2E175266DE77C73A990D4287BBFD52772BCD16D5",
        )
        self.assertEqual(
            portable_hash(historical_root, "tests/browser/a14/workbench-runtime.test.mjs"),
            "D6DC23724479AEBD43C91BFCB2CAFFA38940BFD161BE5F2C4E2DEC914AF59D9F",
        )
        acceptance = json.loads(
            (historical_root / "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json").read_text(encoding="utf-8")
        )
        self.assertEqual("accepted", acceptance["artifact_status"])
        self.assertEqual("R5_EXECUTED_UI_FINDINGS_CLOSED", acceptance["actual_browser_status"])
        self.assertEqual("ENVIRONMENT_BLOCKED / NOT_EXECUTED", acceptance["r6_iab_status"])
        self.assertEqual("NOT_EXECUTED", acceptance["actual_provider_status"])
        self.assertEqual("NOT_EXECUTED", acceptance["actual_production_status"])
        self.assertEqual("READY", acceptance["next_package_status"])

    def test_standalone_checker_passes(self):
        historical_root, _ = _frozen_a14()
        result = subprocess.run([sys.executable, "scripts/check_a14_workbench_prototype.py", str(historical_root)], cwd=historical_root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("A-14 WORKBENCH CHECK: PASS", result.stdout)

    def test_frozen_manifest_rejects_mutated_artifact(self):
        historical_root, historical_checker = _frozen_a14()
        with tempfile.TemporaryDirectory(prefix="anvil-a14-mutated-") as temp:
            mutated_root = Path(temp) / "repository"
            subprocess.run(
                ["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--local", "--no-hardlinks", str(historical_root), str(mutated_root)],
                check=True,
            )
            server = mutated_root / "apps/web/server.mjs"
            server.write_bytes(server.read_bytes() + b"\n// historical fixture mutation\n")
            self.assertIn("checksum:apps/web/server.mjs", historical_checker.check(mutated_root)["errors"])

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
