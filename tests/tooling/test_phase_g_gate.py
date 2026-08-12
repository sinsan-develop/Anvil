from __future__ import annotations

import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / "scripts" / "check_phase_g_gate.py"


def load_checker():
    if not CHECKER.is_file():
        raise FileNotFoundError(CHECKER)
    spec = importlib.util.spec_from_file_location("phase_g_gate_checker", CHECKER)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class PhaseGGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.checker = load_checker()

    def validate(self, *, texts=None, json_docs=None, verify_hashes=True):
        return self.checker.validate_gate(
            ROOT,
            text_overrides=texts or {},
            json_overrides=json_docs or {},
            verify_hashes=verify_hashes,
        )

    @staticmethod
    def codes(report):
        return {item["code"] for item in report["errors"]}

    def test_gate_recalculates_all_required_contracts(self):
        report = self.validate()
        self.assertEqual([], report["errors"])
        self.assertEqual([f"G-{n:02d}" for n in range(1, 8)], report["accepted_packages"])
        self.assertEqual(10, len(report["decisions"]))
        self.assertEqual("APPROVAL-20260810-INTEGRATED-BASELINE-001", report["decision_chain"]["root_approval_id"])
        self.assertEqual("evt_g05_legacy_migration", report["decision_chain"]["acceptance_event_id"])
        self.assertEqual({"package": 97, "av": 255, "reverse": 97, "scenario": 20, "sync": 7}, report["counts"])
        self.assertEqual("PASS", report["lease_dry_run"]["status"])
        self.assertEqual(8, len(report["lease_dry_run"]["results"]))
        self.assertTrue(all({"actor", "occurred_at", "path_scope", "worker_epoch"} <= set(item) for item in report["lease_dry_run"]["results"]))
        self.assertEqual("PASS", report["reconstruction"]["status"])
        required_av_fields = {"verification_id", "source_package", "test_report_ref", "test_report_sha256", "manifest_ref", "manifest_sha256", "target_hash", "result", "method_level", "reviewing_actor"}
        self.assertTrue(all(required_av_fields <= set(item) for item in report["key_verifications"].values()))
        self.assertTrue(all(item["result"] == "PASS" for item in report["key_verifications"].values()))
        self.assertEqual("DESIGN_LOCKED / NOT_EXECUTED", report["scenario_runtime_status"])

    def test_missing_acceptance_and_wrong_decision_are_rejected(self):
        progress_path = "docs/progress/build-progress.json"
        progress = json.loads((ROOT / progress_path).read_text(encoding="utf-8"))
        progress["completed_packages"].remove("G-07")
        self.assertIn("GATE_ACCEPTED_PACKAGE_MISSING", self.codes(self.validate(json_docs={progress_path: progress}, verify_hashes=False)))

        decision_path = "docs/decisions/G-02_DECISION_RECORD.md"
        text = (ROOT / decision_path).read_text(encoding="utf-8").replace("| D10 | `HUMAN_CONFIRMED` |", "| D10 | `IMPLEMENTATION_BASELINE` |", 1)
        self.assertIn("GATE_DECISION_NOT_CONFIRMED", self.codes(self.validate(texts={decision_path: text}, verify_hashes=False)))

    def test_lease_dry_run_rejects_second_writer_and_stale_worker(self):
        fixture_path = "tests/fixtures/phase_g_gate/lease-dry-run.json"
        fixture = json.loads((ROOT / fixture_path).read_text(encoding="utf-8"))
        second = copy.deepcopy(fixture)
        second["operations"][2]["expected"] = "ALLOWED"
        self.assertIn("GATE_LEASE_EXPECTATION_MISMATCH", self.codes(self.validate(json_docs={fixture_path: second}, verify_hashes=False)))

        stale = copy.deepcopy(fixture)
        stale["operations"][3]["execution_token"] = "exec-epoch-1"
        self.assertIn("GATE_STALE_TOKEN_NOT_REJECTED", self.codes(self.validate(json_docs={fixture_path: stale}, verify_hashes=False)))

    def test_work_instruction_alone_reconstructs_scope_and_exit(self):
        report = self.validate()
        self.assertEqual("TEST_REVIEW", report["reconstruction"]["exit_projection"]["status"])
        self.assertFalse(report["reconstruction"]["exit_projection"]["a01_start_allowed"])

        wi_path = "docs/work_orders/PHASE_G_GATE_WORK_INSTRUCTION.md"
        wi = (ROOT / wi_path).read_text(encoding="utf-8").replace('"document_sync_count": 7', '"document_sync_count": 6', 1)
        self.assertIn("GATE_RECONSTRUCTION_CONTRACT_MISMATCH", self.codes(self.validate(texts={wi_path: wi}, verify_hashes=False)))

    def test_reconstruction_rejects_forged_wrong_nonempty_accepted_package(self):
        wi_path = "docs/work_orders/PHASE_G_GATE_WORK_INSTRUCTION.md"
        wi = (ROOT / wi_path).read_text(encoding="utf-8").replace('"G-06", "G-07"', '"G-06", "G-99"', 1)
        self.assertIn(
            "GATE_RECONSTRUCTION_CONTRACT_MISMATCH",
            self.codes(self.validate(texts={wi_path: wi}, verify_hashes=False)),
        )

    def test_gate_checkpoint_allows_a02_active_after_fenced_start(self):
        report = self.validate()
        events = json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
        start = next(event for event in events if event["event_id"] == "evt_a02_package_started")
        self.assertEqual(46, start["sequence"])
        self.assertEqual("A-02", start["subject_ref"])
        self.assertEqual("ACTIVE", start["details"]["package_status"])
        self.assertTrue(report["progress"]["a01_start_allowed"])
        self.assertEqual("ACCEPTED", report["progress"]["g_gate_status"])
        self.assertEqual("WI-A-02-20260811-001", start["details"]["work_instruction_id"])

        decision = json.loads((ROOT / "docs/decisions/PHASE_G_GATE_DECISION_RECORD.json").read_text(encoding="utf-8"))
        self.assertEqual("STANDING_AUTONOMOUS_APPROVAL_APPLIED", decision["approval_mode"])
        self.assertEqual("APPROVAL-20260810-AUTONOMOUS-EXECUTION-001", decision["approval_ref"])
        self.assertTrue(decision["approval_scope_match"])
        self.assertEqual("NOT_REPORT_SPECIFIC", decision["owner_report_review_status"])
        self.assertEqual("main-agent-eoul", decision["decided_by"])
        self.assertEqual("ACCEPTED", decision["decision"])
        self.assertEqual("090C669F5E66A6BB67577693C7CF1601727E12F5E173E0AA98D4BAF4D96B2091", decision["evidence_target_hash"])

    def test_gate_checkpoint_allows_fenced_a02_active_start(self):
        report = self.validate()
        self.assertEqual([], report["errors"])
        events = json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
        worker = next(event for event in events if event["event_id"] == "evt_a02_worker_lease_issued")
        write = next(event for event in events if event["event_id"] == "evt_a02_write_lease_issued")
        start = next(event for event in events if event["event_id"] == "evt_a02_package_started")
        self.assertEqual([44, 45, 46], [worker["sequence"], write["sequence"], start["sequence"]])
        self.assertEqual(worker["details"]["lease_id"], write["details"]["worker_lease_id"])
        self.assertEqual(write["details"]["lease_id"], start["details"]["write_lease_id"])

    def test_gate_checkpoint_allows_a14_scoped_rework_after_failure_report(self):
        report = self.validate()
        self.assertEqual([], report["errors"])
        progress = report["progress"]
        self.assertEqual("A-14", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual("WI-A-14-20260813-003", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("R4_PENDING", progress["active_work_instruction"]["independent_tester_status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])

    def test_document_sync_and_core_av_evidence_reject_wrong_nonempty_values(self):
        design_path = "Anvil_설계서_v2.md"
        design = (ROOT / design_path).read_text(encoding="utf-8").replace("7. Developer 재온보딩 증거", "7. 임의 대체 증거", 1)
        self.assertIn("GATE_DOCUMENT_SYNC_MISMATCH", self.codes(self.validate(texts={design_path: design}, verify_hashes=False)))

        report_path = "docs/test_reports/G-07_TEST_REPORT.md"
        report = (ROOT / report_path).read_text(encoding="utf-8").replace("`AV-GATE-026`: **PASS", "`AV-GATE-026`: **SKIPPED", 1)
        self.assertIn("GATE_KEY_AV_EVIDENCE_MISSING", self.codes(self.validate(texts={report_path: report}, verify_hashes=False)))

    def test_unfenced_a02_active_is_rejected(self):
        progress_path = "docs/progress/build-progress.json"
        progress = json.loads((ROOT / progress_path).read_text(encoding="utf-8"))
        progress["status"] = "ACTIVE"
        progress["current_work_package"] = "A-02"
        progress["worker_lease"] = None
        progress["write_lease"] = None
        self.assertIn("GATE_FALSE_ADVANCEMENT", self.codes(self.validate(json_docs={progress_path: progress}, verify_hashes=False)))

    def test_gate_manifest_recomputes_actual_bytes_and_preserves_gate_boundary(self):
        self.assertEqual([], self.checker.validate_gate_manifest(ROOT))

    def test_checkpoint_manifest_preserves_frozen_rows_without_self_reference(self):
        self.assertEqual([], self.checker.validate_checkpoint_manifest(ROOT))


if __name__ == "__main__":
    unittest.main()
