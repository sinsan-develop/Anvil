"""Executable A-01 static journey contract tests."""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts" / "check_a01_journey.py"
CATALOG_PATH = ROOT / "docs" / "architecture" / "a01" / "A-01_PATH_CATALOG.json"
MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "A-01_EVIDENCE_MANIFEST_R2.json"
PREDECESSOR_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "A-01_EVIDENCE_MANIFEST.json"
VALIDATION_PATH = ROOT / "docs" / "validation" / "A-01_JOURNEY_VALIDATION.md"
COMPLETION_PATH = ROOT / "docs" / "completion_reports" / "A-01_COMPLETION_REPORT.md"
FIXTURE_CONTRACT = ROOT / "tests" / "fixtures" / "a01" / "canonical-contract.json"
MUTATION_CATALOG = ROOT / "tests" / "fixtures" / "a01" / "mutation-catalog.json"
REQUIRED_DOCUMENTS = (
    "A-01_USER_JOURNEY.md",
    "A-01_SCREEN_MAP.md",
    "A-01_PHASE_RAIL.md",
    "A-01_DECISION_APPROVAL_MAP.md",
)


def _load_checker():
    if not CHECKER_PATH.is_file():
        raise AssertionError("A-01 journey checker is not implemented")
    spec = importlib.util.spec_from_file_location("a01_journey_checker", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("A-01 journey checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


class A01JourneyPresenceTests(unittest.TestCase):
    def test_checker_and_required_static_artifacts_exist(self) -> None:
        self.assertTrue(CHECKER_PATH.is_file(), "A-01 journey checker is not implemented")
        self.assertTrue(CATALOG_PATH.is_file(), "A-01 path catalog is not implemented")
        for name in REQUIRED_DOCUMENTS:
            with self.subTest(document=name):
                path = ROOT / "docs" / "architecture" / "a01" / name
                self.assertTrue(path.is_file(), f"missing static journey artifact: {name}")


class A01JourneyContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_checker()
        cls.canonical = _catalog()

    def test_canonical_bundle_has_fourteen_steps_and_five_connected_paths(self) -> None:
        self.assertEqual(self.checker.validate_bundle(ROOT), [])
        self.assertEqual(len(self.canonical["steps"]), 14)
        self.assertEqual(
            {path["path_id"] for path in self.canonical["paths"]},
            {"PATH-NORMAL", "PATH-REJECT", "PATH-REVISE", "PATH-STOP", "PATH-RESUME"},
        )

    def test_each_edge_has_complete_machine_readable_contract(self) -> None:
        required = {
            "edge_id",
            "source_step_id",
            "target_step_id",
            "source_screen_id",
            "target_screen_id",
            "trigger",
            "guard",
            "result",
            "runtime_status",
        }
        for edge in self.canonical["edges"]:
            with self.subTest(edge=edge.get("edge_id")):
                self.assertTrue(required.issubset(edge))
                self.assertTrue(all(edge[field] for field in required))

    def test_mutations_are_rejected_with_specific_contract_errors(self) -> None:
        cases = []

        missing_path = copy.deepcopy(self.canonical)
        missing_path["paths"] = [p for p in missing_path["paths"] if p["path_id"] != "PATH-STOP"]
        cases.append((missing_path, "PATH_SET_MISMATCH"))

        broken_edge = copy.deepcopy(self.canonical)
        broken_edge["edges"][0]["target_step_id"] = "STEP-UNKNOWN"
        cases.append((broken_edge, "EDGE_TARGET_UNKNOWN"))

        approval_bypass = copy.deepcopy(self.canonical)
        approval_bypass["edges"].append(
            {
                "edge_id": "EDGE-MUTATION-BYPASS",
                "source_step_id": "STEP-05",
                "target_step_id": "STEP-07",
                "source_screen_id": "SCREEN-PLAN",
                "target_screen_id": "SCREEN-EXECUTION",
                "trigger": "auto",
                "guard": "none",
                "result": "execute_without_approval",
                "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED",
            }
        )
        cases.append((approval_bypass, "EXECUTION_APPROVAL_BYPASS"))

        stale_rework = copy.deepcopy(self.canonical)
        revise = next(path for path in stale_rework["paths"] if path["path_id"] == "PATH-REVISE")
        revise["revision_policy"]["old_hash_reusable"] = True
        cases.append((stale_rework, "REWORK_OLD_HASH_REUSE"))

        stop_without_checkpoint = copy.deepcopy(self.canonical)
        stop = next(path for path in stop_without_checkpoint["paths"] if path["path_id"] == "PATH-STOP")
        stop["stop_contract"]["checkpoint_required"] = False
        cases.append((stop_without_checkpoint, "STOP_CHECKPOINT_REQUIRED"))

        duplicate_resume = copy.deepcopy(self.canonical)
        resume = next(path for path in duplicate_resume["paths"] if path["path_id"] == "PATH-RESUME")
        resume["resume_contract"]["duplicate_execution_allowed"] = True
        cases.append((duplicate_resume, "RESUME_DUPLICATE_EXECUTION_FORBIDDEN"))

        status_promotion = copy.deepcopy(self.canonical)
        status_promotion["separation_contract"]["technical_pass_implies_product_validation"] = True
        cases.append((status_promotion, "TECHNICAL_PASS_PROMOTION"))

        false_pass = copy.deepcopy(self.canonical)
        false_pass["status_policy"]["non_pass_statuses"] = []
        cases.append((false_pass, "NON_PASS_STATUS_POLICY_MISMATCH"))

        flow_reinserted = copy.deepcopy(self.canonical)
        flow_reinserted["verification_contract"]["assigned_verification_ids"].append("AV-FLOW-001")
        cases.append((flow_reinserted, "A01_RESPONSIBILITY_MISMATCH"))

        human_missing = copy.deepcopy(self.canonical)
        human_missing["decisions"][0]["actor"] = ""
        cases.append((human_missing, "DECISION_ACTOR_MISSING"))

        for mutated, expected in cases:
            with self.subTest(expected=expected):
                self.assertIn(expected, self.checker.validate_catalog(mutated))

    def test_documents_and_catalog_share_steps_screens_decisions_and_runtime_boundary(self) -> None:
        self.assertEqual(self.checker.validate_document_alignment(ROOT, self.canonical), [])
        self.assertEqual(
            self.canonical["verification_contract"]["assigned_verification_ids"],
            ["AV-UI-005"],
        )
        self.assertEqual(
            self.canonical["verification_contract"]["runtime_deferred_verification_ids"],
            ["AV-FLOW-001"],
        )
        self.assertEqual(
            self.canonical["verification_contract"]["runtime_status"],
            "RUNTIME_DEFERRED / NOT_EXECUTED",
        )

    def test_approval_boundary_rejects_missing_or_narrowed_important_risk_guard(self) -> None:
        mutated = copy.deepcopy(self.canonical)
        mutated["approval_boundary"]["human_approval_required_for"] = []
        self.assertIn("APPROVAL_BOUNDARY_MISMATCH", self.checker.validate_catalog(mutated))

        narrowed = copy.deepcopy(self.canonical)
        narrowed["approval_boundary"]["human_approval_required_for"] = [
            "FUNCTION_SCOPE_CHANGE",
            "REQUIREMENT_CHANGE",
            "CRITICAL_RISK_CHANGE",
        ]
        self.assertIn("APPROVAL_BOUNDARY_MISMATCH", self.checker.validate_catalog(narrowed))

    def test_decision_revise_target_must_exist_and_match_canonical_contract(self) -> None:
        mutated = copy.deepcopy(self.canonical)
        concept = next(item for item in mutated["decisions"] if item["decision_id"] == "DEC-CONCEPT")
        concept["revise_result"] = "TERMINAL-NONEXISTENT"
        errors = self.checker.validate_catalog(mutated)
        self.assertIn("DECISION_TARGET_UNKNOWN", errors)
        self.assertIn("DECISION_CONTRACT_MISMATCH", errors)

    def test_release_reject_requires_its_machine_readable_edge_and_path_binding(self) -> None:
        mutated = copy.deepcopy(self.canonical)
        mutated["edges"] = [edge for edge in mutated["edges"] if edge["edge_id"] != "EDGE-12-REJECT"]
        errors = self.checker.validate_catalog(mutated)
        self.assertIn("DECISION_EDGE_MISSING", errors)
        self.assertIn("DECISION_PATH_BINDING_MISSING", errors)

    def test_decision_allowed_results_are_exact_not_merely_nonempty(self) -> None:
        mutated = copy.deepcopy(self.canonical)
        concept = next(item for item in mutated["decisions"] if item["decision_id"] == "DEC-CONCEPT")
        concept["allowed_results"] = ["SELECT"]
        self.assertIn("DECISION_CONTRACT_MISMATCH", self.checker.validate_catalog(mutated))

    def test_fixture_contract_declares_canonical_and_adversarial_sets(self) -> None:
        contract = json.loads(FIXTURE_CONTRACT.read_text(encoding="utf-8"))
        mutations = json.loads(MUTATION_CATALOG.read_text(encoding="utf-8"))
        self.assertEqual(contract["fixture_id"], "A01-JOURNEY-CANONICAL")
        self.assertEqual(contract["step_count"], 14)
        self.assertEqual(set(contract["path_ids"]), {p["path_id"] for p in self.canonical["paths"]})
        self.assertEqual(mutations["fixture_id"], "A01-JOURNEY-MUTATIONS")
        self.assertGreaterEqual(len(mutations["mutations"]), 16)
        self.assertTrue(all(item["expected_error_code"] for item in mutations["mutations"]))

    def test_manifest_binds_every_delivered_raw_artifact_and_static_qualifier(self) -> None:
        self.assertTrue(VALIDATION_PATH.is_file())
        self.assertTrue(COMPLETION_PATH.is_file())
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual(self.checker.validate_evidence_manifest(ROOT, manifest), [])
        self.assertEqual(manifest["assigned_verification_ids"], ["AV-UI-005"])
        self.assertEqual(manifest["runtime_deferred_verification_ids"], ["AV-FLOW-001"])
        self.assertEqual(manifest["evidence_qualifier"], "E-SHOT_STATIC_NOT_RUNTIME_UI")
        self.assertEqual(
            manifest["work_instruction_sha256"],
            "F7F9F1F37320B3A75DB48FBB5DD230D9D2774BB79498DDCA2FF2DB0416CBDF60",
        )
        self.assertEqual(
            manifest["supersedes_artifact_ref"],
            {
                "path": "docs/evidence/manifests/A-01_EVIDENCE_MANIFEST.json",
                "sha256": "11C7321DF2657879E8B46FE95A2E8B86ADA573BF91C0CD76C115B55ADEF2301B",
                "mutation": "FORBIDDEN_HISTORICAL_EVIDENCE",
            },
        )
        self.assertEqual(
            self.checker._sha256(PREDECESSOR_MANIFEST_PATH),
            "11C7321DF2657879E8B46FE95A2E8B86ADA573BF91C0CD76C115B55ADEF2301B",
        )

        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn(
            "EVIDENCE_RAW_HASH_MISMATCH",
            self.checker.validate_evidence_manifest(ROOT, mutated),
        )


if __name__ == "__main__":
    unittest.main()
