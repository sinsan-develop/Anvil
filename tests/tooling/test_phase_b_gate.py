"""Executable contracts for the owner-approved Phase B exact-44 Gate scope."""

from __future__ import annotations

import copy
from contextlib import contextmanager
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / "scripts" / "check_phase_b_gate.py"
HISTORICAL_GATE = "355b99a1ec09cdcd6c0ac9767c3ef9c369937880"


def historical_bytes(relative: str) -> bytes:
    completed = subprocess.run(
        ["git", "show", f"{HISTORICAL_GATE}:{relative}"],
        cwd=ROOT, capture_output=True, check=True,
    )
    return completed.stdout


@contextmanager
def historical_gate_root(checker):
    manifest_raw = historical_bytes(checker.MANIFEST_PATH)
    manifest = json.loads(manifest_raw)
    paths = {checker.MANIFEST_PATH, checker.MATRIX_PATH, checker.TEST_PLAN_PATH,
             checker.WORK_INSTRUCTION_PATH, checker.APPROVAL_PATH,
             checker.VALIDATION_PATH, checker.COMPLETION_REPORT_PATH}
    paths.update(row["path"] for row in manifest["raw_checksums"])
    with tempfile.TemporaryDirectory(prefix="anvil-phase-b-gate-", dir=ROOT) as temp:
        root = Path(temp)
        for relative in sorted(paths):
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(historical_bytes(relative))
        yield root


def load_checker():
    spec = importlib.util.spec_from_file_location("phase_b_gate_checker", CHECKER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class PhaseBGateTests(unittest.TestCase):
    def test_00_checker_exists(self) -> None:
        self.assertTrue(CHECKER.is_file(), "Phase B Gate checker is required")

    def test_owner_approved_selector_is_exact_44_with_deferred_and_undefined_boundaries(self) -> None:
        checker = load_checker()
        with historical_gate_root(checker) as gate_root:
            report = checker.validate_gate(gate_root)

        self.assertEqual([], report["errors"])
        self.assertEqual(
            {"selector_slots": 51, "defined": 50, "direct": 44, "deferred": 6, "undefined": 1},
            report["counts"],
        )
        self.assertEqual(
            ["AV-STAT-021", "AV-STAT-022", "AV-STAT-023", "AV-STAT-024", "AV-STAT-025", "AV-STAT-028"],
            report["deferred_verification_ids"],
        )
        self.assertEqual(["AV-STAT-029"], report["undefined_verification_ids"])
        self.assertEqual(44, len(report["verification_map"]))

    def test_each_direct_id_has_required_evidence_and_honest_execution_boundary(self) -> None:
        checker = load_checker()
        with historical_gate_root(checker) as gate_root:
            report = checker.validate_gate(gate_root)

        required = {"verification_id", "required_evidence", "severity", "level", "owner_package", "evidence_status", "actual_execution_status"}
        self.assertTrue(all(required <= set(row) for row in report["verification_map"]))
        self.assertTrue(all(row["actual_execution_status"] == "NOT_EXECUTED" for row in report["verification_map"]))
        self.assertTrue(all(row["evidence_status"] == "REUSED_ACCEPTED_EVIDENCE_NOT_RERUN" for row in report["verification_map"]))

    def test_historical_authority_byte_tamper_is_rejected(self) -> None:
        checker = load_checker()
        with historical_gate_root(checker) as gate_root:
            authority = gate_root / checker.MATRIX_PATH
            authority.write_bytes(authority.read_bytes() + b"\n")
            self.assertIn("PHASE_B_GATE_MANIFEST_RAW_INVALID", checker.validate_gate(gate_root)["errors"])

    def test_scope_mutation_is_rejected_without_adding_a_definition_for_stat_029(self) -> None:
        checker = load_checker()
        errors = checker.validate_selector_contract(
            direct_ids=[*checker.DIRECT_VERIFICATION_IDS, "AV-STAT-029"],
            deferred_ids=checker.DEFERRED_VERIFICATION_IDS,
            undefined_ids=[],
        )
        self.assertIn("PHASE_B_GATE_SELECTOR_INVALID", errors)
        self.assertIn("PHASE_B_GATE_UNDEFINED_BOUNDARY_INVALID", errors)

    def test_documents_and_manifest_tampering_are_rejected(self) -> None:
        checker = load_checker()
        self.assertTrue(hasattr(checker, "validate_documents"), "document boundary validator is required")

        validation = (ROOT / checker.VALIDATION_PATH).read_text(encoding="utf-8")
        completion = (ROOT / checker.COMPLETION_REPORT_PATH).read_text(encoding="utf-8")
        self.assertIn(
            "PHASE_B_GATE_VALIDATION_BOUNDARY_INVALID",
            checker.validate_documents(
                validation_text=validation.replace("| 51 | 50 | 44 | 6 | 1 |", "| 51 | 50 | 43 | 6 | 1 |", 1),
                completion_text=completion,
            ),
        )
        self.assertIn(
            "PHASE_B_GATE_COMPLETION_BOUNDARY_INVALID",
            checker.validate_documents(
                validation_text=validation,
                completion_text=completion.replace("44 direct", "43 direct", 1),
            ),
        )
        self.assertIn(
            "PHASE_B_GATE_COMPLETION_BOUNDARY_INVALID",
            checker.validate_documents(
                validation_text=validation,
                completion_text=completion.replace(
                    "AV-STAT-021/022/023/024/025/028",
                    "deferred IDs omitted",
                    1,
                ),
            ),
        )

        manifest = json.loads(historical_bytes(checker.MANIFEST_PATH))
        with historical_gate_root(checker) as gate_root:
            self._assert_manifest_tampering_rejected(checker, gate_root, manifest)

    def _assert_manifest_tampering_rejected(self, checker, gate_root: Path, manifest: dict) -> None:
        escaped = copy.deepcopy(manifest)
        escaped["raw_checksums"][0]["path"] = "../outside.json"
        self.assertIn(
            "PHASE_B_GATE_MANIFEST_RAW_PATH_ESCAPE",
            checker.validate_gate(gate_root, manifest_override=escaped)["errors"],
        )
        raw_checksum_tamper = copy.deepcopy(manifest)
        raw_checksum_tamper["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "PHASE_B_GATE_MANIFEST_RAW_INVALID",
            checker.validate_gate(gate_root, manifest_override=raw_checksum_tamper)["errors"],
        )
        target_tamper = copy.deepcopy(manifest)
        target_tamper["target_hash"] = "sha256:" + "0" * 64
        self.assertIn("PHASE_B_GATE_MANIFEST_TARGET_INVALID", checker.validate_gate(gate_root, manifest_override=target_tamper)["errors"])
        content_tamper = copy.deepcopy(manifest)
        content_tamper["content_hash"] = "sha256:" + "0" * 64
        self.assertIn("PHASE_B_GATE_MANIFEST_CONTENT_HASH_INVALID", checker.validate_gate(gate_root, manifest_override=content_tamper)["errors"])
        map_tamper = copy.deepcopy(manifest)
        map_tamper["verification_map_sha256"] = "sha256:" + "0" * 64
        self.assertIn("PHASE_B_GATE_MANIFEST_SCOPE_INVALID", checker.validate_gate(gate_root, manifest_override=map_tamper)["errors"])
        promotion = copy.deepcopy(manifest)
        promotion["direct_verification_ids"].append("AV-STAT-029")
        self.assertIn("PHASE_B_GATE_MANIFEST_SCOPE_INVALID", checker.validate_gate(gate_root, manifest_override=promotion)["errors"])


if __name__ == "__main__":
    unittest.main()
