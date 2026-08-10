"""Executable G-05 contracts for project progress and session recovery."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts" / "check_project_progress.py"
FAILURE_FIXTURE_PATH = ROOT / "tests" / "fixtures" / "g05" / "failure-ledger.json"
ALL_EVENT_FIXTURE_PATH = ROOT / "tests" / "fixtures" / "g05" / "progress-events-all-categories.json"
MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-05_EVIDENCE_MANIFEST.json"
R2_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-05_EVIDENCE_MANIFEST_R2.json"
R2_TEST_REPORT_PATH = ROOT / "docs" / "test_reports" / "G-05_TEST_REPORT_R2.md"
G06_R3_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-06_EVIDENCE_MANIFEST_R3.json"
G06_R2_TEST_REPORT_PATH = ROOT / "docs" / "test_reports" / "G-06_TEST_REPORT_R2.md"
G07_R2_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-07_EVIDENCE_MANIFEST_R2.json"
G07_TEST_REPORT_PATH = ROOT / "docs" / "test_reports" / "G-07_TEST_REPORT.md"


def _load_checker_or_none():
    if not CHECKER_PATH.is_file():
        return None
    spec = importlib.util.spec_from_file_location("g05_progress_checker", CHECKER_PATH)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ProjectProgressContractTests(unittest.TestCase):
    def test_package_specific_detached_progress_ref_is_resolved_safely(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "resolve_detached_digest_path"),
            "package-specific detached digest resolution is not implemented",
        )
        progress = {
            "current_progress_evidence_ref": {
                "package_id": "G-06",
                "path": "docs/progress/progress-handoff-detached-digest-g06.json",
            }
        }
        self.assertEqual(
            checker.resolve_detached_digest_path(progress),
            "docs/progress/progress-handoff-detached-digest-g06.json",
        )
        progress["current_progress_evidence_ref"]["path"] = "../outside.json"
        with self.assertRaises(ValueError):
            checker.resolve_detached_digest_path(progress)

    def test_historical_manifest_validates_its_frozen_rows_not_current_mutable_files(self) -> None:
        checker = self.require_checker()
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8")
        )
        self.assertEqual(checker.validate_historical_manifest_raw_checksums(manifest, ROOT), [])

        mutated = copy.deepcopy(manifest)
        mutated["raw_checksums"][0]["sha256"] = "0" * 64
        errors = checker.validate_historical_manifest_raw_checksums(mutated, ROOT)
        self.assertTrue(any("HISTORICAL_MANIFEST_TARGET_MISMATCH" in error for error in errors))

    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_checker_or_none()

    def require_checker(self):
        if self.checker is None:
            self.skipTest("checker is not implemented yet")
        return self.checker

    def test_00_checker_exists(self) -> None:
        self.assertIsNotNone(
            self.checker,
            "G-05 RED: scripts/check_project_progress.py is not implemented",
        )

    def test_current_progress_handoff_and_registries_are_consistent(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        self.assertEqual(checker.validate_bundle(bundle), [])
        self.assertEqual(
            bundle["progress"]["snapshot_hash"],
            checker.compute_snapshot_hash(bundle["progress"]),
        )

    def test_chapter_15_minimum_fields_and_evidence_identity_are_guarded(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        for field in checker.CHAPTER_15_MINIMUM_FIELDS:
            with self.subTest(field=field):
                mutated = copy.deepcopy(bundle)
                del mutated["progress"][field]
                self.assertIn("PRG_MINIMUM_FIELD_MISSING", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["latest_evidence_refs"].append(
            {
                "path": mutated["progress"]["latest_evidence_refs"][0]["path"],
                "sha256": "F" * 64,
            }
        )
        self.assertIn("PRG_DUPLICATE_EVIDENCE_HASH", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["latest_evidence_refs"][0]["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["latest_evidence_manifest_ref"]["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

    def test_git_and_authority_bindings_are_checked_against_workspace(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["repository"]["local_head"] = "0" * 40
        self.assertIn("GIT_LOCAL_HEAD_MISMATCH", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        instruction = (
            mutated["progress"]["active_work_instruction"]
            or mutated["progress"]["last_accepted_work_instruction"]
        )
        instruction["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

    def test_event_sequence_and_complete_event_contract_are_guarded(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        mutated = copy.deepcopy(bundle)
        mutated["events"]["events"].append(
            {
                "event_id": "evt_regression",
                "sequence": 1,
                "event_type": "PACKAGE_STARTED",
                "occurred_at": "2026-08-10T16:00:00+09:00",
                "actor": "developer-primary-g05",
                "subject_ref": "G-05",
                "details": {},
            }
        )
        self.assertIn("PRG_EVENT_SEQUENCE_REGRESSION", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["event_contract"]["event_types"].remove("GIT_PUSH")
        self.assertIn("EVENT_CONTRACT_MISSING_TYPE", checker.validate_bundle(mutated))

    def test_handoff_must_match_progress_projection(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        cases = (
            ("event_sequence", 999, "HANDOFF_SEQUENCE_MISMATCH"),
            (
                "status",
                "ACTIVE" if bundle["progress"]["status"] != "ACTIVE" else "READY",
                "HANDOFF_STATUS_MISMATCH",
            ),
            ("next_safe_action", "wrong action", "HANDOFF_NEXT_ACTION_MISMATCH"),
        )
        for field, value, reason in cases:
            with self.subTest(field=field):
                mutated = copy.deepcopy(bundle)
                mutated["handoff"][field] = value
                self.assertIn(reason, checker.validate_bundle(mutated))

    def test_only_valid_failure_reports_count_and_lineage_is_part_of_key(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        fixture = json.loads(FAILURE_FIXTURE_PATH.read_text(encoding="utf-8"))

        projection = checker.failure_projection(fixture)
        self.assertEqual(projection["lineage-A|same-fingerprint"]["valid_failure_count"], 3)
        self.assertEqual(projection["lineage-A|same-fingerprint"]["takeover_status"], "MAIN_AGENT_TAKEOVER_REQUIRED")
        self.assertEqual(projection["lineage-B|same-fingerprint"]["valid_failure_count"], 1)

        mutated = copy.deepcopy(bundle)
        mutated["failure_ledger"] = copy.deepcopy(fixture)
        rejected = next(item for item in mutated["failure_ledger"]["entries"] if item["accepted"] is False)
        rejected["counts_toward_valid_failure"] = True
        self.assertIn("FAILURE_COUNT_INVALID", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["failure_ledger"] = copy.deepcopy(fixture)
        incomplete = next(item for item in mutated["failure_ledger"]["entries"] if item["result_status"] == "INCOMPLETE")
        incomplete["accepted"] = True
        incomplete["counts_toward_valid_failure"] = True
        self.assertIn("FAILURE_COUNT_INVALID", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["failure_ledger"] = copy.deepcopy(fixture)
        mutated["failure_ledger"]["entries"][-1]["step_lineage_id"] = "lineage-B"
        self.assertIn("TAKEOVER_STATE_INVALID", checker.validate_bundle(mutated))

    def test_nonsemantic_binding_cannot_invent_approval_or_expand_scope(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        cases = (
            ("root_human_approval_id", None, "NSEM_ROOT_APPROVAL_MISSING"),
            ("new_hash", bundle["nonsemantic"]["bindings"][0]["old_hash"], "NSEM_HASH_UNCHANGED"),
            ("derived_scope", ["G-01", "G-02", "G-03"], "NSEM_SCOPE_EXPANSION"),
            ("semantic_diff_classification", "REQUIREMENT_CHANGE", "NSEM_SEMANTIC_DISGUISE"),
        )
        for field, value, reason in cases:
            with self.subTest(field=field):
                mutated = copy.deepcopy(bundle)
                mutated["nonsemantic"]["bindings"][0][field] = value
                self.assertIn(reason, checker.validate_bundle(mutated))

    def test_dir_hold_and_owner_direction_guards_are_enforced(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        mutated = copy.deepcopy(bundle)
        cleared = mutated["dir_registry"]["checkpoints"][0]
        cleared.update({"status": "CLEARED", "verdict": "ALIGNED", "owner_direction_event_id": None})
        self.assertIn("DIR_DIRECTION_EVENT_REQUIRED", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        held = mutated["dir_registry"]["checkpoints"][0]
        held.update({"status": "DIR_HOLD", "lease_released": False, "blocked_next_action": "B-01"})
        mutated["progress"]["worker_lease"] = {"lease_id": "worker-1"}
        self.assertIn("DIR_HOLD_LEASE_FORBIDDEN", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["events"]["events"].append(
            {
                "event_id": "evt_a15",
                "sequence": mutated["progress"]["event_sequence"] + 1,
                "event_type": "PACKAGE_COMPLETED",
                "occurred_at": "2026-08-10T16:00:00+09:00",
                "actor": "main-agent-eoul",
                "subject_ref": "A-15",
                "details": {"package_status": "ACCEPTED"},
            }
        )
        mutated["progress"]["event_sequence"] += 1
        mutated["progress"]["last_event_id"] = "evt_a15"
        mutated["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(mutated["progress"])
        self.assertIn("DIR_TRIGGER_CHECKPOINT_MISSING", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        dir_x = next(item for item in mutated["dir_registry"]["checkpoints"] if item["checkpoint"] == "DIR-X")
        dir_x["canonical_trigger"] = "UNAPPROVED_TRIGGER"
        self.assertIn("DIRX_TRIGGER_INVALID", checker.validate_bundle(mutated))

    def test_recovery_reporting_decision_stops_only_for_scope_risk_or_dir(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        projection = checker.recovery_projection(bundle)
        self.assertEqual(projection["reporting_decision"], "AUTO_CONTINUE")
        self.assertFalse(projection["stop_before_dialogue_report"])

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["reporting_decision"] = {
            "decision": "STOP_AND_REPORT_SCOPE_RISK",
            "reason_codes": ["REQUIREMENT_CHANGE"],
            "stop_before_dialogue_report": True,
        }
        projection = checker.recovery_projection(mutated)
        self.assertEqual(projection["reporting_decision"], "STOP_AND_REPORT_SCOPE_RISK")
        self.assertTrue(projection["stop_before_dialogue_report"])

        mutated["progress"]["reporting_decision"] = {
            "decision": "STOP_AND_REPORT_DIR",
            "reason_codes": ["DIR-1_REACHED"],
            "stop_before_dialogue_report": True,
        }
        projection = checker.recovery_projection(mutated)
        self.assertEqual(projection["reporting_decision"], "STOP_AND_REPORT_DIR")
        self.assertTrue(projection["stop_before_dialogue_report"])

    def test_recovery_cannot_label_scope_risk_or_dir_state_as_routine(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        scope_risk = copy.deepcopy(bundle)
        scope_risk["progress"]["pending_approvals"] = [
            {"approval_id": "pending-risk", "change_classification": "IMPORTANT_RISK_CHANGE"}
        ]
        self.assertIn("RECOVERY_SCOPE_RISK_MUST_STOP", checker.validate_bundle(scope_risk))

        direction_hold = copy.deepcopy(bundle)
        checkpoint = direction_hold["dir_registry"]["checkpoints"][0]
        checkpoint.update(
            {
                "status": "WAITING_OWNER_DIRECTION",
                "verdict": "ALIGNED",
                "trigger_event_id": "evt_dir_1",
                "report_ref": "docs/test_reports/DIR-1_REPORT.md",
                "lease_released": True,
                "blocked_next_action": "A_GATE",
            }
        )
        direction_hold["progress"]["dir_review"]["checkpoint"] = "DIR-1"
        direction_hold["progress"]["dir_review"]["status"] = "WAITING_OWNER_DIRECTION"
        self.assertIn("RECOVERY_DIR_MUST_STOP", checker.validate_bundle(direction_hold))

    def test_cli_returns_stable_reason_code_and_nonzero_on_invalid_bundle(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            for relative in checker.BUNDLE_PATHS.values():
                source = ROOT / relative
                destination = temp_root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            progress_path = temp_root / checker.BUNDLE_PATHS["progress"]
            progress = json.loads(progress_path.read_text(encoding="utf-8"))
            extra_paths = {
                checker.resolve_detached_digest_path(progress),
                progress["current_progress_evidence_ref"]["manifest_path"],
                "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json",
            }
            for relative in extra_paths:
                source = ROOT / relative
                destination = temp_root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            del progress["next_safe_action"]
            progress_path.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8")

            result = subprocess.run(
                [sys.executable, str(CHECKER_PATH), str(temp_root)],
                capture_output=True,
                check=False,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("PRG_MINIMUM_FIELD_MISSING", result.stdout)

    def test_schema_files_are_draft_2020_12_and_registered(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        self.assertEqual(checker.validate_schema_catalog(bundle["schema_catalog"], ROOT), [])
        self.assertEqual(len(bundle["schema_catalog"]["schemas"]), 6)

    def test_detached_digest_binds_current_progress_and_handoff_into_manifest_target(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / bundle["progress"]["current_progress_evidence_ref"]["manifest_path"]
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertTrue(hasattr(checker, "validate_detached_progress_binding"))
        self.assertTrue(hasattr(checker, "validate_manifest_progress_binding"))

        self.assertEqual(checker.validate_detached_progress_binding(bundle), [])
        self.assertEqual(checker.validate_manifest_progress_binding(manifest, bundle), [])

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["next_safe_action"] = "tampered after verification"
        mutated["handoff"]["next_safe_action"] = "tampered after verification"
        mutated["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(mutated["progress"])
        self.assertIn("DETACHED_DIGEST_MISMATCH", checker.validate_bundle(mutated))

    def test_failure_evidence_is_real_and_projection_matches_progress(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        forged = copy.deepcopy(bundle)
        forged["failure_ledger"]["entries"].append(
            {
                "entry_id": "forged-failure",
                "step_lineage_id": "G-05",
                "failure_fingerprint": "forged",
                "result_status": "FAILURE_REPORT",
                "accepted": True,
                "counts_toward_valid_failure": True,
                "validator_acceptance": True,
                "evidence_refs": [
                    {"path": "docs/evidence/does-not-exist.json", "sha256": "0" * 64}
                ],
                "accepted_sequence": 1,
                "takeover_status": "NOT_REQUIRED",
            }
        )
        self.assertIn("FAILURE_EVIDENCE_MISSING", checker.validate_bundle(forged))

        mismatched = copy.deepcopy(bundle)
        mismatched["progress"]["valid_failure_count"] += 1
        mismatched["handoff"]["valid_failure_count"] += 1
        mismatched["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(mismatched["progress"])
        self.assertIn("FAILURE_PROJECTION_MISMATCH", checker.validate_bundle(mismatched))

    def test_nonsemantic_binding_uses_real_approval_subject_and_scope(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        binding = bundle["nonsemantic"]["bindings"][0]

        binding["root_human_approval_id"] = "APPROVAL-DOES-NOT-EXIST"
        binding["root_approval_subject_hash"] = "0" * 64
        binding["root_approval_scope"] = "UNBOUNDED"
        binding["derived_scope"] = ["UNBOUNDED"]

        self.assertIn("NSEM_APPROVAL_ARTIFACT_INVALID", checker.validate_bundle(bundle))

    def test_dir_cleared_requires_real_owner_direction_event_chain(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        checkpoint = bundle["dir_registry"]["checkpoints"][0]
        checkpoint.update(
            {
                "status": "CLEARED",
                "verdict": "ALIGNED",
                "subject_hash": "A" * 64,
                "trigger_event_id": "evt-does-not-exist-trigger",
                "report_event_id": "evt-does-not-exist-report",
                "report_ref": "docs/test_reports/DIR-1_REPORT.md",
                "owner_direction_event_id": "evt-does-not-exist-direction",
            }
        )

        self.assertIn("DIR_DIRECTION_EVENT_INVALID", checker.validate_bundle(bundle))

    def test_scope_expansion_required_normalizes_to_stop_and_report(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        self.assertTrue(hasattr(checker, "normalize_change_classification"))
        bundle["progress"]["pending_approvals"] = [
            {
                "approval_id": "scope-expansion",
                "change_classification": "SCOPE_EXPANSION_REQUIRED",
            }
        ]
        bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])

        self.assertEqual(
            checker.normalize_change_classification("SCOPE_EXPANSION_REQUIRED"),
            "FUNCTION_SCOPE_CHANGE",
        )
        self.assertIn("RECOVERY_SCOPE_RISK_MUST_STOP", checker.validate_bundle(bundle))

    def test_event_payload_effects_and_all_categories_fixture_are_enforced(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        self.assertTrue(hasattr(checker, "validate_event_stream"))
        self.assertTrue(
            ALL_EVENT_FIXTURE_PATH.is_file(),
            "G05-DEF-006 RED: all-category event fixture is missing",
        )
        fixture = json.loads(ALL_EVENT_FIXTURE_PATH.read_text(encoding="utf-8"))

        self.assertEqual(
            checker.validate_event_stream(fixture, bundle["event_contract"]),
            [],
        )
        self.assertEqual(
            {event["event_type"] for event in fixture["events"]},
            set(bundle["event_contract"]["event_types"]),
        )

        empty_push = copy.deepcopy(bundle)
        empty_push["events"]["events"].append(
            {
                "event_id": "evt-empty-git-push",
                "sequence": empty_push["progress"]["event_sequence"] + 1,
                "event_type": "GIT_PUSH",
                "occurred_at": "2026-08-10T17:00:00+09:00",
                "actor": "main-agent-eoul",
                "subject_ref": "main",
                "details": {},
            }
        )
        empty_push["events"]["last_sequence"] += 1
        empty_push["progress"]["event_sequence"] += 1
        empty_push["progress"]["last_event_id"] = "evt-empty-git-push"
        empty_push["handoff"]["event_sequence"] += 1
        empty_push["handoff"]["last_event_id"] = "evt-empty-git-push"
        empty_push["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(empty_push["progress"])
        self.assertIn("EVENT_PAYLOAD_MISSING", checker.validate_bundle(empty_push))

        bad_effect = copy.deepcopy(empty_push)
        bad_effect["events"]["events"][-1]["details"] = {
            "remote": "origin",
            "branch": "main",
            "local_commit": "1" * 40,
            "remote_commit": "1" * 40,
            "evidence_ref": {"path": "docs/test_reports/G-05_TEST_REPORT.md", "sha256": "CB03A995BF654964623737C5A347DCBD21ED62BF1268E5A53F5867516C32C26E"},
        }
        self.assertIn("EVENT_EFFECT_MISMATCH", checker.validate_bundle(bad_effect))

    def test_g07_acceptance_is_preserved_when_phase_g_gate_is_accepted(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        last_event = bundle["events"]["events"][-1]
        g06_acceptance = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "MAIN_PACKAGE_ACCEPTED" and event["subject_ref"] == "G-06"
        )
        g07_acceptance = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "MAIN_PACKAGE_ACCEPTED" and event["subject_ref"] == "G-07"
        )

        self.assertEqual(progress["status"], "GATE_CHECKPOINT_PENDING_PUSH")
        self.assertIsNone(progress["current_work_package"])
        self.assertIn("G-06", progress["completed_packages"])
        self.assertIn("G-07", progress["completed_packages"])
        self.assertIn("PHASE_G_GATE", progress["completed_packages"])
        self.assertIsNone(progress["active_work_instruction"])
        self.assertEqual(
            progress["last_accepted_work_instruction"]["artifact_id"],
            "WI-PHASE-G-GATE-20260810-001",
        )
        self.assertEqual(g06_acceptance["details"]["next_work_package"], "G-07")
        self.assertEqual(g06_acceptance["details"]["test_report_sha256"], "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertEqual(g07_acceptance["details"]["test_report_sha256"], hashlib.sha256(G07_TEST_REPORT_PATH.read_bytes()).hexdigest().upper())
        self.assertEqual(g07_acceptance["details"]["manifest_sha256"], hashlib.sha256(G07_R2_MANIFEST_PATH.read_bytes()).hexdigest().upper())
        self.assertEqual(g07_acceptance["details"]["next_work_package"], "PHASE_G_GATE")
        self.assertEqual(last_event["event_type"], "PHASE_GATE_DECIDED")
        self.assertEqual(last_event["subject_ref"], "G Gate")
        self.assertEqual(last_event["details"]["verdict"], "ACCEPTED")
        self.assertEqual(last_event["details"]["approval_mode"], "STANDING_AUTONOMOUS_APPROVAL_APPLIED")
        self.assertTrue(G06_R3_MANIFEST_PATH.is_file())
        r3_hash = hashlib.sha256(G06_R3_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        self.assertEqual(r3_hash, "1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0")
        g07_r2_hash = hashlib.sha256(G07_R2_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        gate_r2_path = ROOT / "docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST_R2.json"
        self.assertEqual(progress["latest_evidence_manifest_ref"], {"path": "docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST_R2.json", "sha256": hashlib.sha256(gate_r2_path.read_bytes()).hexdigest().upper()})
        self.assertEqual(hashlib.sha256(G06_R2_TEST_REPORT_PATH.read_bytes()).hexdigest().upper(), "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertIn("MAIN_PACKAGE_ACCEPTED", bundle["event_contract"]["event_types"])

    def test_g05_historical_acceptance_chain_remains_immutable(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

        self.assertTrue(R2_MANIFEST_PATH.is_file())
        r2_file_hash = hashlib.sha256(R2_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        self.assertEqual(
            r2_file_hash,
            "F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6",
        )
        self.assertEqual(manifest["supersedes_artifact_ref"]["path"], "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json")
        self.assertEqual(manifest["supersedes_artifact_ref"]["file_sha256"], r2_file_hash)
        self.assertNotEqual(
            bundle["progress"]["latest_evidence_manifest_ref"]["path"],
            "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json",
        )
        self.assertEqual(
            hashlib.sha256(R2_TEST_REPORT_PATH.read_bytes()).hexdigest().upper(),
            "ED0F03496060C84D67DE84C0758611610CD753CF8D854216F9933089F07C758C",
        )


if __name__ == "__main__":
    unittest.main()
