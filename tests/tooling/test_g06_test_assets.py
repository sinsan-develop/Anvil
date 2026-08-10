"""Executable G-06 fixture, golden, scenario, and fault-contract tests."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts" / "check_g06_test_assets.py"
MATERIALIZER_PATH = ROOT / "scripts" / "materialize_fixture_repository.py"
FIXTURE_INDEX = ROOT / "tests" / "fixtures" / "repositories" / "fixture-index.json"
GOLDEN_INDEX = ROOT / "tests" / "fixtures" / "golden" / "golden-index.json"
GOLDEN_LOCK = ROOT / "tests" / "fixtures" / "golden" / "golden-lock.json"
GOLDEN_BASELINE = ROOT / "tests" / "fixtures" / "golden" / "golden-baseline-candidate.json"
SCENARIO_INDEX = ROOT / "tests" / "fault" / "scenario-index.json"
FAULT_INDEX = ROOT / "tests" / "fault" / "fault-injection-index.json"

FIXTURE_IDS = {
    "FIX-PY-CLEAN",
    "FIX-PY-DIRTY",
    "FIX-PY-REDFAIL",
    "FIX-TS-CLEAN",
    "FIX-TS-NOTOOL",
    "FIX-PROTECTED",
    "FIX-LARGE",
    "FIX-CONFLICT",
}
SCENARIO_MAP = {
    "S49-17-01": "AV-STAT-041",
    "S49-17-02": "AV-STAT-042",
    "S49-17-03": "AV-FLOW-024",
    "S49-17-04": "AV-FLOW-025",
    "S49-17-05": "AV-STAT-043",
    "S49-17-06": "AV-SAFE-028",
    "S49-17-07": "AV-AGT-038",
    "S49-17-08": "AV-OPS-019",
    "S49-17-09": "AV-SAFE-029",
    "S49-17-10": "AV-SAFE-030",
    "S49-17-11": "AV-SAFE-031",
    "S49-17-12": "AV-SAFE-032",
    "S49-17-13": "AV-LRN-027",
    "S49-17-14": "AV-LRN-028",
    "S49-17-15": "AV-GATE-025",
    "S49-17-16": "AV-OPS-020",
    "S49-17-17": "AV-OPS-021",
    "S49-17-18": "AV-OPS-022",
    "S49-17-19": "AV-OPS-023",
    "S49-17-20": "AV-OPS-024",
}
SCENARIO_AUTHORITY_MAP = {
    "S49-17-01": {"verification_id": "AV-STAT-041", "responsible_packages": {"A-15", "C-15", "E-11"}, "evidence_types": {"E-EVT", "E-PRG"}},
    "S49-17-02": {"verification_id": "AV-STAT-042", "responsible_packages": {"A-15", "C-15", "D-13", "E-11"}, "evidence_types": {"E-DEC", "E-EVT", "E-PRG"}},
    "S49-17-03": {"verification_id": "AV-FLOW-024", "responsible_packages": {"E-09"}, "evidence_types": {"E-API", "E-AUD"}},
    "S49-17-04": {"verification_id": "AV-FLOW-025", "responsible_packages": {"E-09"}, "evidence_types": {"E-DEC", "E-EVT"}},
    "S49-17-05": {"verification_id": "AV-STAT-043", "responsible_packages": {"B-09"}, "evidence_types": {"E-AUD", "E-EVT"}},
    "S49-17-06": {"verification_id": "AV-SAFE-028", "responsible_packages": {"B-09", "E-06"}, "evidence_types": {"E-AUD", "E-EVT"}},
    "S49-17-07": {"verification_id": "AV-AGT-038", "responsible_packages": {"E-08"}, "evidence_types": {"E-API", "E-AUD", "E-EVT"}},
    "S49-17-08": {"verification_id": "AV-OPS-019", "responsible_packages": {"E-08"}, "evidence_types": {"E-API", "E-AUD", "E-EVT"}},
    "S49-17-09": {"verification_id": "AV-SAFE-029", "responsible_packages": {"B-11", "F-15"}, "evidence_types": {"E-API", "E-AUD"}},
    "S49-17-10": {"verification_id": "AV-SAFE-030", "responsible_packages": {"F-01", "F-11"}, "evidence_types": {"E-AUD", "E-NET"}},
    "S49-17-11": {"verification_id": "AV-SAFE-031", "responsible_packages": {"B-12", "F-01"}, "evidence_types": {"E-AUD", "E-EVT"}},
    "S49-17-12": {"verification_id": "AV-SAFE-032", "responsible_packages": {"F-01", "F-02"}, "evidence_types": {"E-AUD", "E-NET"}},
    "S49-17-13": {"verification_id": "AV-LRN-027", "responsible_packages": {"D-03", "D-06"}, "evidence_types": {"E-AUD", "E-EVT"}},
    "S49-17-14": {"verification_id": "AV-LRN-028", "responsible_packages": {"D-11", "F-02"}, "evidence_types": {"E-AUD", "E-TEST"}},
    "S49-17-15": {"verification_id": "AV-GATE-025", "responsible_packages": {"E-09", "F-20"}, "evidence_types": {"E-AUD", "E-MAN"}},
    "S49-17-16": {"verification_id": "AV-OPS-020", "responsible_packages": {"F-18"}, "evidence_types": {"E-AUD", "E-GIT", "E-MAN"}},
    "S49-17-17": {"verification_id": "AV-OPS-021", "responsible_packages": {"F-16", "F-18"}, "evidence_types": {"E-AUD", "E-CMD", "E-GIT"}},
    "S49-17-18": {"verification_id": "AV-OPS-022", "responsible_packages": {"F-14", "F-20"}, "evidence_types": {"E-DEC", "E-EVT"}},
    "S49-17-19": {"verification_id": "AV-OPS-023", "responsible_packages": {"F-20"}, "evidence_types": {"E-NET", "E-SHOT"}},
    "S49-17-20": {"verification_id": "AV-OPS-024", "responsible_packages": {"F-20"}, "evidence_types": {"E-DEC", "E-EVT", "E-MAN"}},
}
GOLDEN_CASE_HASHES = {
    "GC-CONFLICT-01": "sha256:9B409201BBBC2E6212A7B24BF4C55A235C13DB49C4DF808253A1F27E9D3A6C39",
    "GC-LARGE-01": "sha256:D30FE80936F7DD19BA4C73EC5E350D0D5A4194A32CB9C0A522ABC64FF7CC882B",
    "GC-PROTECTED-01": "sha256:F06C2B8FB1B284F20A9B787669BFC83E3B1E6FEBEB6D3585529138AC2C905405",
    "GC-PY-CLEAN-01": "sha256:B848F9466450158D2DCA18C128F5F5A1996AD3D30F1027662DD77F4615C1E41D",
    "GC-PY-DIRTY-01": "sha256:753162D1CFF138297332BCA0816CB0418706E84060596DE2961A363D123EE49E",
    "GC-PY-REDFAIL-01": "sha256:65E22EA3D4660C84A0F1E5F54E3B5AE1A24F386426BBD3492305DDA70CA05F1E",
    "GC-TS-CLEAN-01": "sha256:0D0015E260B10DAF10DBF7180F607DD0D68689956B5226BAC8FBE32F57C89350",
    "GC-TS-NOTOOL-01": "sha256:0833BDDDA78E991EFA65325DC38ABBC12BB044532B4306D2EF6B88ED12D84E41",
}
FAULT_MAP = {
    "FI-01": ["AV-STAT-013"],
    "FI-02": ["AV-STAT-012"],
    "FI-03": ["AV-STAT-013"],
    "FI-04": ["AV-STAT-026", "AV-STAT-027"],
    "FI-05": ["AV-STAT-036"],
    "FI-06": ["AV-STAT-036"],
    "FI-07": ["AV-STAT-038", "AV-STAT-039"],
    "FI-08": ["AV-UI-016"],
}


def _load_module(path: Path, name: str):
    if not path.is_file():
        raise AssertionError(f"missing executable module: {path.relative_to(ROOT)}")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"cannot load module: {path.relative_to(ROOT)}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _run(command: list[str], cwd: Path, *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True, check=False)


class G06ExecutablePresenceTests(unittest.TestCase):
    def test_checker_and_materializer_exist_before_contract_tests_run(self) -> None:
        self.assertTrue(CHECKER_PATH.is_file(), "G-06 checker is not implemented")
        self.assertTrue(MATERIALIZER_PATH.is_file(), "G-06 materializer is not implemented")

    def test_checker_exposes_golden_lock_validation(self) -> None:
        checker = _load_module(CHECKER_PATH, "g06_asset_checker_presence")
        self.assertTrue(hasattr(checker, "validate_golden_lock"), "golden lock validation is not implemented")

    def test_checker_exposes_hashed_index_validation(self) -> None:
        checker = _load_module(CHECKER_PATH, "g06_asset_checker_index_presence")
        self.assertTrue(hasattr(checker, "validate_hashed_index"), "hashed index validation is not implemented")


class G06TestAssetContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_module(CHECKER_PATH, "g06_asset_checker")
        cls.materializer = _load_module(MATERIALIZER_PATH, "g06_materializer")

    def test_fixture_index_has_exactly_eight_unique_source_templates(self) -> None:
        index = _json(FIXTURE_INDEX)
        entries = index["fixtures"]
        self.assertEqual({entry["fixture_id"] for entry in entries}, FIXTURE_IDS)
        self.assertEqual(len(entries), 8)
        self.assertEqual(len({entry["manifest_path"] for entry in entries}), 8)
        self.assertEqual(self.checker.validate_bundle(ROOT), [])

    def test_registry_indexes_bind_every_registered_file_by_hash(self) -> None:
        contracts = (
            (FIXTURE_INDEX, "fixtures", "manifest_path"),
            (SCENARIO_INDEX, "scenarios", "scenario_path"),
            (FAULT_INDEX, "fault_injections", "contract_path"),
            (ROOT / "tests/fixtures/schemas/schema-index.json", "schemas", "path"),
        )
        for index_path, collection, path_field in contracts:
            with self.subTest(index=index_path.name):
                index = _json(index_path)
                self.assertEqual(
                    self.checker.validate_hashed_index(ROOT, index, collection, path_field),
                    [],
                )
                mutated = copy.deepcopy(index)
                mutated[collection][0]["sha256"] = "0" * 64
                errors = self.checker.validate_hashed_index(ROOT, mutated, collection, path_field)
                self.assertTrue(any("INDEX_FILE_HASH_MISMATCH" in error for error in errors))

    def test_fixture_manifests_bind_every_source_file_by_bytes_and_hash(self) -> None:
        for entry in _json(FIXTURE_INDEX)["fixtures"]:
            manifest = _json(ROOT / entry["manifest_path"])
            with self.subTest(fixture=entry["fixture_id"]):
                self.assertEqual(manifest["fixture_id"], entry["fixture_id"])
                self.assertEqual(self.checker.validate_fixture_manifest(ROOT, manifest), [])
                self.assertEqual(manifest["actual_secret_count"], 0)
                self.assertFalse(manifest["external_systems_allowed"])

    def test_fixture_manifest_rejects_an_unbound_source_file(self) -> None:
        entry = _json(FIXTURE_INDEX)["fixtures"][0]
        manifest = _json(ROOT / entry["manifest_path"])
        manifest["source_files"] = manifest["source_files"][:-1]

        errors = self.checker.validate_fixture_manifest(ROOT, manifest)

        self.assertTrue(any("FIXTURE_SOURCE_INVENTORY_MISMATCH" in error for error in errors))

    def test_each_fixture_has_one_pre_frozen_golden_case(self) -> None:
        index = _json(GOLDEN_INDEX)
        cases = [_json(ROOT / entry["case_path"]) for entry in index["cases"]]
        self.assertEqual({case["fixture_id"] for case in cases}, FIXTURE_IDS)
        self.assertEqual(len(cases), 8)
        for case in cases:
            with self.subTest(case=case["case_id"]):
                self.assertEqual(case["frozen_by"], "main-agent-eoul")
                self.assertEqual(
                    case["owner_approval_ref"],
                    "APPROVAL-20260810-INTEGRATED-BASELINE-001",
                )
                self.assertEqual(case["acquisition_mode"], "fixture")
                self.assertEqual(self.checker.validate_golden_case(case), [])

    def test_golden_lock_rejects_expected_value_rewrite_even_with_recomputed_case_hash(self) -> None:
        index = _json(GOLDEN_INDEX)
        lock = _json(GOLDEN_LOCK)
        cases = [_json(ROOT / entry["case_path"]) for entry in index["cases"]]
        self.assertEqual(self.checker.validate_golden_lock(index, lock, cases), [])

        cases[0]["expected_result_status"] = "PASS"
        cases[0]["golden_content_hash"] = self.checker.content_hash(cases[0], "golden_content_hash")
        errors = self.checker.validate_golden_lock(index, lock, cases)
        self.assertTrue(any("GOLDEN_LOCK_CASE_HASH_MISMATCH" in error for error in errors))

    def test_immutable_baseline_rejects_coordinated_case_and_lock_rewrite(self) -> None:
        self.assertTrue(GOLDEN_BASELINE.is_file(), "immutable golden baseline candidate is missing")
        index = _json(GOLDEN_INDEX)
        lock = _json(GOLDEN_LOCK)
        baseline = _json(GOLDEN_BASELINE)
        cases = [_json(ROOT / entry["case_path"]) for entry in index["cases"]]
        self.assertEqual(
            {entry["case_id"]: entry["golden_content_hash"] for entry in baseline["case_hashes"]},
            GOLDEN_CASE_HASHES,
        )
        self.assertEqual(self.checker.validate_golden_baseline_candidate(baseline, index, lock, cases), [])

        cases[0]["expected_result_status"] = "FAILURE_REPORT"
        cases[0]["golden_content_hash"] = self.checker.content_hash(cases[0], "golden_content_hash")
        lock_entry = next(entry for entry in lock["case_locks"] if entry["case_id"] == cases[0]["case_id"])
        lock_entry["golden_content_hash"] = cases[0]["golden_content_hash"]

        errors = self.checker.validate_golden_baseline_candidate(baseline, index, lock, cases)
        self.assertTrue(any("GOLDEN_BASELINE_CASE_HASH_MISMATCH" in error for error in errors))
        self.assertTrue(
            hasattr(self.checker, "validate_golden_baseline_anchor"),
            "immutable Main-authored baseline anchor validator is missing",
        )
        self.assertEqual(self.checker.validate_golden_baseline_anchor(ROOT, baseline), [])

    def test_scenario_catalog_maps_all_twenty_clauses_once_and_remains_unexecuted(self) -> None:
        entries = _json(SCENARIO_INDEX)["scenarios"]
        scenarios = [_json(ROOT / entry["scenario_path"]) for entry in entries]
        self.assertEqual({item["scenario_id"]: item["verification_id"] for item in scenarios}, SCENARIO_MAP)
        self.assertEqual(len({item["source_clause"] for item in scenarios}), 20)
        for scenario in scenarios:
            with self.subTest(scenario=scenario["scenario_id"]):
                self.assertEqual(scenario["implementation_status"], "DESIGN_LOCKED")
                self.assertEqual(scenario["execution_status"], "NOT_EXECUTED")
                self.assertTrue(scenario["responsible_package"])
                self.assertTrue(scenario["gate"])
                self.assertTrue(scenario["evidence_types"])
                self.assertEqual(self.checker.validate_scenario(scenario), [])

    def test_scenario_rejects_wrong_nonempty_package_and_evidence_trace(self) -> None:
        entries = _json(SCENARIO_INDEX)["scenarios"]
        scenarios = [_json(ROOT / entry["scenario_path"]) for entry in entries]
        observed = {
            scenario["scenario_id"]: {
                "verification_id": scenario["verification_id"],
                "responsible_packages": {part.strip() for part in scenario["responsible_package"].split(",")},
                "evidence_types": set(scenario["evidence_types"]),
            }
            for scenario in scenarios
        }
        self.assertEqual(observed, SCENARIO_AUTHORITY_MAP)

        mutated = copy.deepcopy(scenarios[0])
        mutated["responsible_package"] = "G-99"
        mutated["evidence_types"] = ["E-FAKE"]
        errors = self.checker.validate_scenario(mutated)
        self.assertIn("SCENARIO_PACKAGE_TRACE_MISMATCH", errors)
        self.assertIn("SCENARIO_EVIDENCE_TRACE_MISMATCH", errors)

    def test_fault_injection_catalog_freezes_fi01_through_fi08_as_not_executed(self) -> None:
        entries = _json(FAULT_INDEX)["fault_injections"]
        contracts = [_json(ROOT / entry["contract_path"]) for entry in entries]
        self.assertEqual({item["fault_id"]: item["verification_ids"] for item in contracts}, FAULT_MAP)
        for contract in contracts:
            with self.subTest(fault=contract["fault_id"]):
                self.assertEqual(contract["implementation_status"], "DESIGN_LOCKED")
                self.assertEqual(contract["execution_status"], "NOT_EXECUTED")
                self.assertEqual(contract["minimum_repeat_count"], 3)
                self.assertEqual(self.checker.validate_fault_contract(contract), [])

    def test_python_clean_materializes_as_clean_git_and_real_test_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self.materializer.materialize_fixture(ROOT, "FIX-PY-CLEAN", Path(temp) / "repo")
            status = _run(["git", "status", "--porcelain"], repo)
            test = _run([sys.executable, "-m", "unittest", "discover", "-s", "tests"], repo)
            self.assertEqual(status.stdout, "")
            self.assertEqual(test.returncode, 0, test.stdout + test.stderr)

    def test_python_dirty_materializes_exact_tracked_and_untracked_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self.materializer.materialize_fixture(ROOT, "FIX-PY-DIRTY", Path(temp) / "repo")
            status = _run(["git", "status", "--porcelain"], repo)
            self.assertEqual(status.stdout.splitlines(), [" M src/calc.py", "?? notes/local-note.txt"])

    def test_python_redfail_has_deterministic_expected_failure_fingerprint(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self.materializer.materialize_fixture(ROOT, "FIX-PY-REDFAIL", Path(temp) / "repo")
            manifest = self.materializer.fixture_manifest(ROOT, "FIX-PY-REDFAIL")
            fallback = lambda output, _root: hashlib.sha256(output.encode("utf-8")).hexdigest().upper()
            fingerprint = getattr(self.checker, "stable_failure_fingerprint", fallback)
            fingerprints: set[str] = set()
            for _ in range(32):
                result = _run([sys.executable, "-m", "unittest", "discover", "-s", "tests"], repo)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("FAIL: test_known_baseline_failure", result.stdout + result.stderr)
                fingerprints.add(fingerprint(result.stdout + result.stderr, repo))
            self.assertEqual(fingerprints, {manifest["expected_test"]["output_sha256"]})

    def test_failure_fingerprint_ignores_elapsed_path_and_address_noise(self) -> None:
        fallback = lambda output, _root: hashlib.sha256(output.encode("utf-8")).hexdigest().upper()
        fingerprint = getattr(self.checker, "stable_failure_fingerprint", fallback)
        first = """FAIL: test_known_baseline_failure (test_calc.CalcTest.test_known_baseline_failure)\nTraceback (most recent call last):\n  File \"C:\\tmp\\one\\tests\\test_calc.py\", line 8, in test_known_baseline_failure\n    self.assertEqual(add(1, 1), 2)\nAssertionError: 1 != 2\nRan 1 test in 0.001s\nworker=<Worker object at 0x000001AA>\n"""
        second = """FAIL: test_known_baseline_failure (test_calc.CalcTest.test_known_baseline_failure)\nTraceback (most recent call last):\n  File \"D:\\elsewhere\\two\\tests\\test_calc.py\", line 8, in test_known_baseline_failure\n    self.assertEqual(add(1, 1), 2)\nAssertionError: 1 != 2\nRan 1 test in 0.000s\nworker=<Worker object at 0x000009FF>\n"""
        self.assertEqual(fingerprint(first, Path("C:/tmp/one")), fingerprint(second, Path("D:/elsewhere/two")))

    def test_ts_clean_uses_offline_local_typescript_593_and_typechecks(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self.materializer.materialize_fixture(
                ROOT,
                "FIX-TS-CLEAN",
                Path(temp) / "repo",
                install_tools=True,
            )
            local_tsc = repo / "node_modules" / ".bin" / ("tsc.cmd" if os.name == "nt" else "tsc")
            version = _run([str(local_tsc), "--version"], repo)
            typecheck = _run([str(local_tsc), "--noEmit", "-p", "tsconfig.json"], repo)
            self.assertEqual(version.returncode, 0, version.stdout + version.stderr)
            self.assertEqual(version.stdout.strip(), "Version 5.9.3")
            self.assertEqual(typecheck.returncode, 0, typecheck.stdout + typecheck.stderr)

    def test_ts_notool_cannot_fall_back_to_global_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self.materializer.materialize_fixture(ROOT, "FIX-TS-NOTOOL", Path(temp) / "repo")
            outcome = self.materializer.check_local_typescript(repo, isolated_path=True)
            self.assertEqual(outcome["status"], "BLOCKED")
            self.assertEqual(outcome["error_code"], "TOOL_NOT_INSTALLED")
            self.assertFalse((repo / "node_modules" / ".bin" / "tsc.cmd").exists())

    def test_protected_large_and_conflict_states_are_observable(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            protected = self.materializer.materialize_fixture(ROOT, "FIX-PROTECTED", base / "protected")
            large = self.materializer.materialize_fixture(ROOT, "FIX-LARGE", base / "large")
            conflict = self.materializer.materialize_fixture(ROOT, "FIX-CONFLICT", base / "conflict")
            self.assertEqual((protected / ".env.synthetic").read_text(encoding="utf-8").strip(), "ANVIL_SYNTHETIC_SECRET=NOT_A_REAL_CREDENTIAL")
            self.assertGreaterEqual(len(list((large / "src" / "modules").glob("module_*.py"))), 24)
            graph = _json(conflict / "task-graph.json")
            self.assertEqual(graph["steps"][0]["write_paths"], graph["steps"][1]["write_paths"])

    def test_checker_does_not_change_dirty_or_untracked_content_mtime_or_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self.materializer.materialize_fixture(ROOT, "FIX-PY-DIRTY", Path(temp) / "repo")
            before = self.materializer.snapshot_worktree(repo)
            self.assertEqual(self.checker.inspect_materialized_fixture(repo, "FIX-PY-DIRTY"), [])
            after = self.materializer.snapshot_worktree(repo)
            self.assertEqual(after, before)

    def test_false_product_pass_and_missing_not_executed_are_rejected(self) -> None:
        scenario = _json(ROOT / _json(SCENARIO_INDEX)["scenarios"][0]["scenario_path"])
        for field, value, reason in (
            ("execution_status", "PASS", "SCENARIO_FALSE_PASS"),
            ("execution_status", None, "SCENARIO_EXECUTION_STATUS_INVALID"),
            ("implementation_status", "IMPLEMENTED", "SCENARIO_IMPLEMENTATION_STATUS_INVALID"),
        ):
            with self.subTest(field=field, value=value):
                mutated = copy.deepcopy(scenario)
                if value is None:
                    mutated.pop(field)
                else:
                    mutated[field] = value
                self.assertTrue(any(reason in error for error in self.checker.validate_scenario(mutated)))

    def test_golden_hash_expected_values_and_approval_are_immutable(self) -> None:
        case = _json(ROOT / _json(GOLDEN_INDEX)["cases"][0]["case_path"])
        mutations = (
            ("golden_content_hash", "sha256:" + "0" * 64, "GOLDEN_HASH_MISMATCH"),
            ("expected_result_status", "PASS", "GOLDEN_HASH_MISMATCH"),
            ("owner_approval_ref", "APPROVAL-UNBOUND", "GOLDEN_APPROVAL_INVALID"),
        )
        for field, value, reason in mutations:
            with self.subTest(field=field):
                mutated = copy.deepcopy(case)
                mutated[field] = value
                self.assertTrue(any(reason in error for error in self.checker.validate_golden_case(mutated)))

    def test_adversarial_trace_secret_duplicate_and_global_fallback_mutations_are_rejected(self) -> None:
        fixtures = _json(FIXTURE_INDEX)
        duplicate = copy.deepcopy(fixtures)
        duplicate["fixtures"].append(copy.deepcopy(duplicate["fixtures"][0]))
        self.assertTrue(any("FIXTURE_ID_DUPLICATE" in error for error in self.checker.validate_fixture_index(duplicate)))

        protected_entry = next(item for item in fixtures["fixtures"] if item["fixture_id"] == "FIX-PROTECTED")
        protected = _json(ROOT / protected_entry["manifest_path"])
        protected["synthetic_secret_rule"]["marker"] = "AKIA1234567890ABCDEF"
        self.assertTrue(any("ACTUAL_LOOKING_SECRET" in error for error in self.checker.validate_fixture_manifest(ROOT, protected)))

        scenario = _json(ROOT / _json(SCENARIO_INDEX)["scenarios"][0]["scenario_path"])
        scenario["responsible_package"] = ""
        scenario["evidence_types"] = []
        errors = self.checker.validate_scenario(scenario)
        self.assertTrue(any("SCENARIO_PACKAGE_REQUIRED" in error for error in errors))
        self.assertTrue(any("SCENARIO_EVIDENCE_REQUIRED" in error for error in errors))

        ts_entry = next(item for item in fixtures["fixtures"] if item["fixture_id"] == "FIX-TS-NOTOOL")
        ts_manifest = _json(ROOT / ts_entry["manifest_path"])
        ts_manifest["toolchain"]["allow_global_fallback"] = True
        self.assertTrue(any("TS_GLOBAL_FALLBACK_FORBIDDEN" in error for error in self.checker.validate_fixture_manifest(ROOT, ts_manifest)))

    def test_cli_reports_exact_asset_counts(self) -> None:
        result = _run([sys.executable, str(CHECKER_PATH), str(ROOT)], ROOT)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("fixtures=8 golden=8 scenarios=20 fault_injections=8", result.stdout)


if __name__ == "__main__":
    unittest.main()
