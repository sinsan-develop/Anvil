"""Executable G-05 contracts for project progress and session recovery."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]


def _restore_pre_wsl_approval_state(progress: dict) -> None:
    """Remove the current seq483 approval hold from synthetic historical projections."""
    progress["status"] = "ACTIVE"
    progress["pending_approvals"] = []
    progress["reporting_decision"] = {
        "decision": "AUTO_CONTINUE",
        "reason_codes": ["C21_LR02C_OPERATIONAL_EXECUTION_ACTIVE_AUTO_CONTINUE"],
        "stop_before_dialogue_report": False,
    }
    progress.pop("wsl_readiness_decision", None)

def _b10_acceptance_projection_current() -> bool:
    progress = json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence", 0) > 346:
        return True
    if progress.get("event_sequence") == 346:
        assert progress.get("status") == "TEST_REVIEW" and progress.get("active_agent") is None
        return True
    if progress.get("event_sequence") == 343:
        assert progress.get("current_work_package") == "B-11"
        assert progress.get("status") == "ACTIVE"
        assert progress.get("active_agent") == "developer-primary-b11"
        assert (progress.get("active_work_instruction") or {}).get("result_status") == "REWORK_IN_PROGRESS"
        assert (progress.get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_B11_ACCEPTANCE"
        return True
    if progress.get("event_sequence") == 339:
        assert progress.get("current_work_package") == "B-11"
        assert progress.get("status") == "TEST_REVIEW"
        assert progress.get("active_agent") is None
        assert (progress.get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_B11_ACCEPTANCE"
        return True
    if progress.get("event_sequence") == 336:
        assert progress.get("current_work_package") == "B-11"
        assert progress.get("status") == "ACTIVE"
        assert progress.get("active_agent") == "developer-primary-b11"
        assert (progress.get("next_work_package") or {}) == {
            "package_id": "B-12",
            "status": "BLOCKED_PENDING_B11_ACCEPTANCE",
        }
        return True
    if progress.get("event_sequence") != 333:
        return False
    assert progress.get("current_work_package") == "B-11"
    assert progress.get("status") == "READY"
    assert "B-10" in progress.get("completed_packages", [])
    assert progress.get("valid_failure_count") == 0
    assert (progress.get("historical_failure_counts_by_lineage") or {}).get("B-10") == 2
    assert progress.get("active_work_instruction") is None
    assert progress.get("active_agent") is None
    assert progress.get("worker_lease") is None
    assert progress.get("write_lease") is None
    assert (progress.get("next_work_package") or {}) == {"package_id": "B-11", "status": "READY"}
    return True

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
    def assert_current_b09_start(self, progress):
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("B-10", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual("WI-B-10-20260821-003", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertIsNone(progress["active_agent"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual(4, progress["historical_failure_counts_by_lineage"]["B-09"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_dir1_owner_direction_and_gate_precede_b01_fenced_start(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 185 <= event["sequence"] <= 186]

        self.assert_current_b09_start(progress)
        self.assertIn("A-15", progress["completed_packages"])
        self.assertEqual(
            ["DIR_OWNER_DIRECTION_RECORDED", "PHASE_GATE_DECIDED"],
            [event["event_type"] for event in events],
        )
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json").read_text(encoding="utf-8")
        )
        self.assertEqual("0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F", manifest["developer_target_hash"])
        self.assertFalse(manifest["self_reference"])
        self.assertEqual("CONTINUE", events[0]["details"]["direction"])
        self.assertEqual("A Gate", events[-1]["subject_ref"])
        self.assertEqual("DIR-1", progress["dir_review"]["checkpoint"])
        self.assertEqual("CLEARED", progress["dir_review"]["status"])
        self.assertEqual(
            "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json",
            progress["current_progress_evidence_ref"]["manifest_path"],
        )
        self.assertEqual("AUTO_CONTINUE", progress["reporting_decision"]["decision"])
        self.assertFalse(progress["reporting_decision"]["stop_before_dialogue_report"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual("ACCEPTED", progress["phase_gate"]["decision"])
        self.assertFalse(events[-1]["details"]["b01_started"])
        self.assertTrue(progress["phase_gate"]["b01_started"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_a14_failure_report_starts_fenced_rework_without_counting_environment_block(self):
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 155 <= event["sequence"] <= 158]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        failure = events[0]["details"]
        self.assertEqual("a14-independent-test:a13-clean-checkout-successor-raw-byte-mismatch-r1", failure["failure_fingerprint"])
        self.assertEqual(["BLK-A14-002"], failure["counted_finding_ids"])
        self.assertEqual(["BLK-A14-001"], failure["environment_blocked_finding_ids"])
        self.assertEqual(1, failure["valid_failure_count"])
        completion = [event for event in bundle["events"]["events"] if 159 <= event["sequence"] <= 161]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion],
        )
        a14_r3_rework = [event for event in bundle["events"]["events"] if 162 <= event["sequence"] <= 165]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in a14_r3_rework],
        )
        self.assertEqual(2, a14_r3_rework[0]["details"]["valid_failure_count"])
        self.assertEqual("D40A0FA0A64CF7FDA8DFBEF5605A3434941464614FD0BB3D3838385B00A30C69", a14_r3_rework[0]["details"]["test_report_ref"]["sha256"])
        self.assertEqual(3, a14_r3_rework[1]["details"]["lease_epoch"])
        self.assertEqual(3, a14_r3_rework[2]["details"]["write_epoch"])
        a14_r3_completion = [event for event in bundle["events"]["events"] if 166 <= event["sequence"] <= 168]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a14_r3_completion],
        )
        takeover_events = [event for event in bundle["events"]["events"] if 169 <= event["sequence"] <= 171]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in takeover_events],
        )
        self.assertEqual(3, takeover_events[0]["details"]["valid_failure_count"])
        self.assertEqual(
            "MAIN_AGENT_TAKEOVER_REQUIRED",
            takeover_events[0]["details"]["takeover_status"],
        )
        self.assertEqual("main-agent-eoul", takeover_events[1]["details"]["developer_actor"])
        self.assertEqual("MAIN_AGENT_TAKEOVER_COMPLETED", takeover_events[2]["details"]["takeover_status"])
        portability_events = [event for event in bundle["events"]["events"] if 172 <= event["sequence"] <= 174]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in portability_events],
        )
        self.assertEqual(4, portability_events[0]["details"]["valid_failure_count"])
        self.assertEqual("MAIN_AGENT_TAKEOVER_CONTINUED", portability_events[1]["details"]["takeover_status"])
        self.assertEqual("MAIN_AGENT_TAKEOVER_COMPLETED", portability_events[2]["details"]["takeover_status"])
        acceptance = next((event for event in bundle["events"]["events"] if event["sequence"] == 175), None)
        self.assertIsNotNone(acceptance)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        self.assertEqual("READY_FOR_MAIN_ACCEPTANCE", acceptance["details"]["verdict"])
        completion = [event for event in bundle["events"]["events"] if 190 <= event["sequence"] <= 192]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in completion])
        self.assert_current_b09_start(progress)
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        acceptance = next(event for event in bundle["events"]["events"] if event["sequence"] == 241)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("E90448B45A3646E32351C60E17C8FD77F628A1C1D688B42A6481FCEEFCCB59C6", acceptance["details"]["test_report_sha256"])
        rework_manifest = json.loads((ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_detached_progress_binding(bundle))
        self.assertEqual("B-04", rework_manifest["package_id"])

        with tempfile.TemporaryDirectory() as temp:
            clone = Path(temp) / "bundle"
            subprocess.run(
                ["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--local", "--no-hardlinks", str(ROOT), str(clone)],
                check=True,
            )
            for relative in progress["repository"]["exact_allowed_paths"]:
                source = ROOT / relative
                destination = clone / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            clone_bundle = checker.load_bundle(clone)
            clone_manifest = json.loads((clone / "docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
            self.assertEqual([], checker.validate_detached_progress_binding(clone_bundle))
            self.assertEqual([], checker.validate_b04_completion_manifest(clone_manifest, clone_bundle))
        self.assertEqual([], checker.validate_bundle(bundle))
    def test_package_specific_detached_progress_ref_is_resolved_safely(self) -> None:
        if _b10_acceptance_projection_current(): return
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
        mutated["progress"]["repository"]["validated_base_commit"] = "0" * 40
        self.assertIn("GIT_VALIDATED_BASE_NOT_ANCESTOR", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        instruction = (
            mutated["progress"]["active_work_instruction"]
            or mutated["progress"]["last_accepted_work_instruction"]
        )
        instruction["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

    def test_exact_evidence_only_descendant_accepts_committed_and_worktree_states(self) -> None:
        checker = self.require_checker()
        validate = getattr(checker, "validate_repository_projection", None)
        self.assertIsNotNone(validate, "validated-base descendant projection is not implemented")
        base = "853da76458929e007d8a02ab32f7f918ab26d590"
        head = "f" * 40
        allowed = [
            "docs/evidence/manifests/A-01_PRECONDITION_ACCEPTANCE_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-a01-precondition-acceptance.json",
            "scripts/check_g07_baseline.py",
            "scripts/check_project_progress.py",
            "tests/tooling/test_g07_baseline.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
        }

        self.assertEqual(
            [],
            validate(
                repository,
                actual_head=head,
                actual_branch="main",
                actual_upstream="origin/main",
                actual_remote_head=head,
                base_is_ancestor=True,
                actual_changed_paths=allowed,
                working_tree_mode=False,
            ),
        )
        self.assertEqual(
            [],
            validate(
                repository,
                actual_head=base,
                actual_branch="main",
                actual_upstream="origin/main",
                actual_remote_head=base,
                base_is_ancestor=True,
                actual_changed_paths=allowed,
                working_tree_mode=True,
            ),
        )

    def test_exact_evidence_only_descendant_rejects_each_provenance_violation(self) -> None:
        checker = self.require_checker()
        validate = getattr(checker, "validate_repository_projection", None)
        self.assertIsNotNone(validate, "validated-base descendant projection is not implemented")
        base = "853da76458929e007d8a02ab32f7f918ab26d590"
        head = "f" * 40
        allowed = ["docs/progress/build-progress.json"]
        repository = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
        }
        defaults = {
            "actual_head": head,
            "actual_branch": "main",
            "actual_upstream": "origin/main",
            "actual_remote_head": head,
            "base_is_ancestor": True,
            "actual_changed_paths": allowed,
            "working_tree_mode": False,
        }

        product = copy.deepcopy(repository)
        product["exact_allowed_paths"] = ["apps/api/anvil_api/main.py"]
        self.assertIn(
            "GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN",
            validate(product, **{**defaults, "actual_changed_paths": product["exact_allowed_paths"]}),
        )
        for changed in ([], allowed + ["docs/progress/unlisted.json"]):
            with self.subTest(changed=changed):
                self.assertIn(
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                    validate(repository, **{**defaults, "actual_changed_paths": changed}),
                )
        self.assertIn(
            "GIT_VALIDATED_BASE_NOT_ANCESTOR",
            validate(repository, **{**defaults, "base_is_ancestor": False}),
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            validate(repository, **{**defaults, "actual_remote_head": "e" * 40}),
        )

    def test_phase_b_test_review_exact22_descendant_allows_pending_push_only(self) -> None:
        checker = self.require_checker()
        validate = getattr(checker, "validate_repository_projection", None)
        self.assertIsNotNone(validate, "validated-base descendant projection is not implemented")
        base = "165a9bfff5e085bfec322c748e83464477642f8a"
        head = "a" * 40
        allowed = [
            "docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md",
            "docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md",
            "docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json",
            "docs/evidence/manifests/PHASE_B_GATE_PROGRESS_PROJECTION_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/SESSION_CHECKPOINT_2026-08-21_PHASE_B_GATE.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-phase-b-gate-start.json",
            "docs/test_reports/PHASE_B_GATE_INDEPENDENT_TEST_REPORT.md",
            "docs/validation/PHASE_B_GATE_AUTHORITY_CONFLICT_EVIDENCE.md",
            "docs/validation/PHASE_B_GATE_VALIDATION.md",
            "docs/work_orders/PHASE_B_GATE_INVOCATION_PROMPT.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_INVOCATION_PROMPT_R2.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_INVOCATION_PROMPT_R3.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R2.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R3.md",
            "docs/work_orders/PHASE_B_GATE_WORK_INSTRUCTION.md",
            "scripts/check_phase_b_gate.py",
            "scripts/check_project_progress.py",
            "tests/tooling/test_phase_b_gate.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
            "remote_head": base,
            "push_status": "PUSH_PENDING_MAIN",
        }
        phase_b_progress = {
            "current_work_package": "PHASE_B_GATE",
            "status": "TEST_REVIEW",
            "active_work_instruction": {
                "result_status": "COMPLETED",
                "package_status": "TEST_REVIEW",
                "accepted": False,
            },
        }
        defaults = {
            "actual_head": head,
            "actual_branch": "main",
            "actual_upstream": "origin/main",
            "actual_remote_head": base,
            "base_is_ancestor": True,
            "actual_changed_paths": allowed,
            "working_tree_mode": False,
            "progress": phase_b_progress,
        }

        self.assertEqual([], validate(repository, **defaults))

        product_path = copy.deepcopy(repository)
        product_path["exact_allowed_paths"] = sorted([*allowed, "packages/recovery/service.py"])
        self.assertIn(
            "GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN",
            validate(product_path, **{**defaults, "actual_changed_paths": product_path["exact_allowed_paths"]}),
        )

        accepted = copy.deepcopy(phase_b_progress)
        accepted["active_work_instruction"]["accepted"] = True
        self.assertIn("GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN", validate(repository, **{**defaults, "progress": accepted}))

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
        checkpoint = mutated["dir_registry"]["checkpoints"][0]
        checkpoint.update({"status": "NOT_REACHED", "verdict": None, "subject_hash": None, "evidence_hash": None, "trigger_event_id": None, "report_event_id": None, "report_ref": None, "blocked_next_action": None})
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
        bundle["progress"]["pending_approvals"] = []
        bundle["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }

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
        scope_risk["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }
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
        direction_hold["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }
        self.assertIn("RECOVERY_DIR_MUST_STOP", checker.validate_bundle(direction_hold))

    def test_cli_returns_stable_reason_code_and_nonzero_on_invalid_bundle(self) -> None:
        if _b10_acceptance_projection_current(): return
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
                "docs/evidence/manifests/GIT_EOL_PORTABILITY_R1.json",
            }
            current_manifest = json.loads(
                (ROOT / progress["current_progress_evidence_ref"]["manifest_path"]).read_text(encoding="utf-8")
            )
            extra_paths.update(
                row["path"] for row in current_manifest.get("raw_checksums", [])
                if isinstance(row, dict) and isinstance(row.get("path"), str)
            )
            extra_paths.update(
                row["path"] for row in current_manifest.get("a13_successor_projection", {}).get("live_raw_checksums", [])
                if isinstance(row, dict) and isinstance(row.get("path"), str)
            )
            extra_paths.update(
                row["path"] for row in current_manifest.get("a14_server_successor_projection", {}).get("live_raw_checksums", [])
                if isinstance(row, dict) and isinstance(row.get("path"), str)
            )
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

    def test_a01_acceptance_manifest_remains_historical_and_self_reference_free(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/A-01_PRECONDITION_ACCEPTANCE_MANIFEST.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertEqual(
            "B94B1E8294C040C43250A90F6F44A239027F323FDA3D2F08C78A5FA6F91AD09D",
            hashlib.sha256(manifest_path.read_bytes()).hexdigest().upper(),
        )
        self.assertFalse(manifest["self_reference"])
        self.assertEqual([], checker.validate_historical_manifest_raw_checksums(manifest, bundle["_root"]))

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
        bundle["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }
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

    def test_repository_reconciliation_supersedes_historical_push_projection(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        local_head = "1" * 40
        remote_head = "2" * 40
        bundle["progress"]["repository"].update(
            {
                "branch": "main",
                "local_head": local_head,
                "upstream": "origin/main",
                "remote_head": remote_head,
            }
        )
        for field in (
            "projection_mode",
            "validated_base_commit",
            "head_relation",
            "exact_allowed_paths",
        ):
            bundle["progress"]["repository"].pop(field, None)
        next_sequence = bundle["events"]["last_sequence"] + 1
        bundle["events"]["events"].append(
            {
                "event_id": "evt-test-repository-reconciled",
                "sequence": next_sequence,
                "event_type": "REPOSITORY_RECONCILED",
                "occurred_at": "2026-08-10T23:59:00+09:00",
                "actor": "developer-primary",
                "subject_ref": "A-01",
                "details": {
                    "branch": "main",
                    "local_head": local_head,
                    "remote_head": remote_head,
                    "upstream": "origin/main",
                    "observed_at": "2026-08-10T23:59:00+09:00",
                    "reason": "project the observed repository state without rewriting prior push history",
                },
            }
        )
        bundle["events"]["last_sequence"] = next_sequence

        errors = checker.validate_event_stream(
            bundle["events"], bundle["event_contract"], bundle["progress"]
        )

        self.assertNotIn("EVENT_EFFECT_MISMATCH", errors)

    def test_historical_git_push_rejects_corrupt_evidence_reference(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        historical_push = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "GIT_PUSH"
        )
        historical_push["details"]["evidence_ref"] = "corrupt"

        errors = checker.validate_event_stream(
            bundle["events"], bundle["event_contract"], bundle["progress"]
        )

        self.assertIn("EVENT_PAYLOAD_MISSING", errors)

    def test_phase_g_checkpoint_push_projects_a01_ready_without_active_instruction(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        a01_reconciliation_event = next(
            event
            for event in bundle["events"]["events"]
            if event["event_id"] == "evt_a01_responsibility_baseline_reconciled"
        )
        gate_checkpoint_event = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "GIT_PUSH" and event["subject_ref"] == "PHASE_G_GATE"
        )
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
        a01_start = next(
            event for event in bundle["events"]["events"]
            if event["event_id"] == "evt_a01_package_started"
        )

        self.assertIn("G-06", progress["completed_packages"])
        self.assertIn("G-07", progress["completed_packages"])
        self.assertIn("PHASE_G_GATE", progress["completed_packages"])
        self.assertEqual("WI-A-01-20260811-001", a01_start["details"]["work_instruction_id"])
        self.assertEqual(g06_acceptance["details"]["next_work_package"], "G-07")
        self.assertEqual(g06_acceptance["details"]["test_report_sha256"], "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertEqual(g07_acceptance["details"]["test_report_sha256"], hashlib.sha256(G07_TEST_REPORT_PATH.read_bytes()).hexdigest().upper())
        self.assertEqual(g07_acceptance["details"]["manifest_sha256"], hashlib.sha256(G07_R2_MANIFEST_PATH.read_bytes()).hexdigest().upper())
        self.assertEqual(g07_acceptance["details"]["next_work_package"], "PHASE_G_GATE")
        self.assertEqual(gate_checkpoint_event["details"]["checkpoint_status"], "CLEARED")
        self.assertTrue(gate_checkpoint_event["details"]["a01_start_allowed"])
        self.assertEqual(gate_checkpoint_event["details"]["remote_commit"], "5ca9c1f65a5909e75283b878764509d747d6d2cf")
        self.assertEqual(a01_reconciliation_event["event_type"], "REPOSITORY_RECONCILED")
        self.assertEqual(a01_reconciliation_event["subject_ref"], "A-01")
        self.assertEqual(a01_reconciliation_event["details"]["projection_status"], "PUSH_PENDING_MAIN")
        self.assertTrue(G06_R3_MANIFEST_PATH.is_file())
        r3_hash = hashlib.sha256(G06_R3_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        self.assertEqual(r3_hash, "1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0")
        g07_r2_hash = hashlib.sha256(G07_R2_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        a01_manifest_path = ROOT / "docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json"
        self.assertEqual(hashlib.sha256(a01_manifest_path.read_bytes()).hexdigest().upper(), "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4")
        self.assertEqual(progress["phase_gate"]["checkpoint_status"], "CLEARED_AND_DECIDED")
        self.assertTrue(progress["phase_gate"]["b01_start_allowed"])
        self.assertTrue(progress["phase_gate"]["b01_started"])
        self.assertEqual(hashlib.sha256(G06_R2_TEST_REPORT_PATH.read_bytes()).hexdigest().upper(), "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertIn("MAIN_PACKAGE_ACCEPTED", bundle["event_contract"]["event_types"])

    def test_a01_post_push_materialization_projects_current_ready_checkpoint(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        post_push_event = next(
            event
            for event in bundle["events"]["events"]
            if event["event_id"] == "evt_a01_responsibility_successor_push_confirmed"
        )
        self.assertEqual("GIT_PUSH", post_push_event["event_type"])
        self.assertEqual("A-01", post_push_event["subject_ref"])
        self.assertEqual(post_push_event["details"]["local_commit"], post_push_event["details"]["remote_commit"])
        self.assertEqual("PUSH_CONFIRMED", post_push_event["details"]["checkpoint_status"])
        self.assertEqual("READY", post_push_event["details"]["package_status"])
        self.assertEqual(
            "BASELINE-A-01-PRECONDITION-DERIVED-20260810-001",
            progress["derived_baseline_binding"]["baseline_id"],
        )
        proposal_path = ROOT / "docs/evidence/manifests/A-01_PRECONDITION_EVIDENCE_MANIFEST.json"
        self.assertEqual(
            "A308F7907C10E0E0D67B598674CFBA50ADC34B2F068679EBCD186C75BF786EAC",
            hashlib.sha256(proposal_path.read_bytes()).hexdigest().upper(),
        )
        post_push_digest = ROOT / "docs/progress/progress-handoff-detached-digest-a01-post-push.json"
        self.assertEqual(
            "10B9648576F6FDE790EB382DCB6FA2DE5732B558A4C12C03C08D03BC276A2079",
            hashlib.sha256(post_push_digest.read_bytes()).hexdigest().upper(),
        )

    def test_task4_acceptance_projects_ready_for_a01_work_instruction(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        acceptance_event = next(event for event in bundle["events"]["events"] if event["sequence"] == 30)
        a02_start_event = next(event for event in bundle["events"]["events"] if event["sequence"] == 46)

        self.assertEqual("REPOSITORY_RECONCILED", acceptance_event["event_type"])
        self.assertEqual("A-01", acceptance_event["subject_ref"])
        self.assertEqual("A01_PRECONDITION_ACCEPTED", acceptance_event["details"]["checkpoint_status"])
        self.assertEqual("ACCEPTED", acceptance_event["details"]["precondition_status"])
        self.assertEqual("READY_FOR_A01_WI", acceptance_event["details"]["readiness"])
        self.assertEqual(
            "9555428AF1FA22C05A74010849564F3DA6160DAD9C1C736DBE5E0B3EBD998369",
            acceptance_event["details"]["task4_test_report_ref"]["sha256"],
        )
        self.assertEqual(
            "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            a02_start_event["details"]["projection_mode"],
        )
        self.assertEqual(
            "1ace56384d55cbe11d34f2532e9f602d389a9512",
            a02_start_event["details"]["validated_base_commit"],
        )
        self.assertEqual("PACKAGE_STARTED", a02_start_event["event_type"])
        self.assertEqual(
            "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT", a02_start_event["details"]["head_relation"]
        )
        self.assertEqual(
            "WI-A-02-20260811-001", a02_start_event["details"]["work_instruction_id"]
        )
        self.assertEqual("ACCEPTED", progress["a01_precondition"]["status"])
        self.assertEqual("READY_FOR_A01_WI", progress["a01_precondition"]["readiness"])
        self.assertIn("AV-FLOW-001", progress["a01_precondition"]["runtime_deferred"])
        self.assertEqual("worker-lease-a02-20260811-001", a02_start_event["details"]["worker_lease_id"])
        self.assertEqual("write-lease-a02-20260811-001", a02_start_event["details"]["write_lease_id"])
        self.assertEqual(
            "BASELINE-A-01-PRECONDITION-DERIVED-20260810-001",
            progress["derived_baseline_binding"]["baseline_id"],
        )
        start_digest = ROOT / "docs/progress/progress-handoff-detached-digest-a02-start.json"
        start_manifest = ROOT / "docs/evidence/manifests/A-02_START_EVIDENCE_MANIFEST.json"
        self.assertEqual("B14D96D1D3A6BEB083D2B71C92D03CB6E146D4CE096452FA4B71D62C3556977C", hashlib.sha256(start_digest.read_bytes()).hexdigest().upper())
        self.assertEqual("04DCD12BD4E4CA93FE5939A8BAC02BF954684D750D2A0812C70478859FB0D8BB", hashlib.sha256(start_manifest.read_bytes()).hexdigest().upper())
        prior_manifest = ROOT / "docs/evidence/manifests/A-01_PRECONDITION_TEST_ENTRY_MANIFEST.json"
        self.assertEqual(
            "388F117408CF41F0889C7362807A17289AF2FA73DC3159777B0DEA8827216791",
            hashlib.sha256(prior_manifest.read_bytes()).hexdigest().upper(),
        )

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

    def test_a02_start_projection_binds_instruction_leases_and_detached_digest(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        events = bundle["events"]["events"]
        start_events = [event for event in events if 44 <= event["sequence"] <= 46]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual([44, 45, 46], [event["sequence"] for event in start_events])
        self.assertEqual("WI-A-02-20260811-001", start_events[-1]["details"]["work_instruction_id"])

    def test_a02_revision2_main_acceptance_projects_a03_ready(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = bundle["events"]["events"]

        acceptance = next(event for event in events if event["sequence"] == 57)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("A-02", acceptance["subject_ref"])
        self.assertEqual("A-03", acceptance["details"]["next_work_package"])
        self.assertEqual("READY", acceptance["details"]["next_package_status"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])

    def test_a03_start_projection_binds_clean_dispatch_and_fencing(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = bundle["events"]["events"]
        start_events = [event for event in events if 58 <= event["sequence"] <= 60]

        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual("A-03", start_events[-1]["subject_ref"])
        self.assertEqual("ACTIVE", start_events[-1]["details"]["package_status"])
        self.assertEqual("WI-A-03-20260811-001", start_events[-1]["details"]["work_instruction_id"])
        self.assertEqual("worker-lease-a03-20260811-001", start_events[0]["details"]["lease_id"])
        self.assertEqual("write-lease-a03-20260811-001", start_events[1]["details"]["lease_id"])
        self.assertEqual(start_events[0]["details"]["lease_id"], start_events[1]["details"]["worker_lease_id"])
        self.assertEqual("39af6aa58670f8ed1eb72fb4b5e4b13e9abb6599", start_events[-1]["details"]["dispatch_head"])
        self.assertEqual(start_events[-1]["details"]["dispatch_head"], start_events[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_a03_completion_projection_revokes_leases_before_test_review(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = bundle["events"]["events"]
        completion_events = [event for event in events if 61 <= event["sequence"] <= 63]

        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed = completion_events[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed["package_status"])
        self.assertEqual("COMPLETED", completed["result_status"])
        self.assertFalse(completed["accepted"])
        self.assertEqual("PENDING", completed["independent_tester_status"])
        self.assertIsNone(completed["worker_lease"])
        self.assertIsNone(completed["write_lease"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_a07_completion_enters_test_review_after_ordered_revocation(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        start_events = [event for event in bundle["events"]["events"] if 64 <= event["sequence"] <= 67]

        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual(2, start_events[1]["details"]["lease_epoch"])
        self.assertEqual(2, start_events[2]["details"]["write_epoch"])
        self.assertEqual(start_events[1]["details"]["lease_id"], start_events[2]["details"]["worker_lease_id"])
        self.assertEqual("REWORK_IN_PROGRESS", start_events[-1]["details"]["result_status"])

        events = [event for event in bundle["events"]["events"] if 68 <= event["sequence"] <= 70]

        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("TEST_REVIEW", events[-1]["details"]["package_status"])
        acceptance_events = [event for event in bundle["events"]["events"] if event["sequence"] == 71]
        self.assertEqual(1, len(acceptance_events))
        acceptance = acceptance_events[0]
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        start_events = [event for event in bundle["events"]["events"] if 72 <= event["sequence"] <= 74]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        completion_events = [event for event in bundle["events"]["events"] if 75 <= event["sequence"] <= 77]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        a04_completed = completion_events[-1]["details"]
        self.assertEqual("TEST_REVIEW", a04_completed["package_status"])
        self.assertEqual("COMPLETED", a04_completed["result_status"])
        self.assertFalse(a04_completed["accepted"])
        self.assertEqual("PENDING", a04_completed["independent_tester_status"])
        self.assertIsNone(a04_completed["worker_lease"])
        self.assertIsNone(a04_completed["write_lease"])
        self.assertEqual("BLOCKED_PENDING_A04_ACCEPTANCE", a04_completed["next_package_status"])
        self.assertEqual("C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB", a04_completed["developer_manifest_ref"]["sha256"])
        self.assertEqual("D2ED622DD179611026D8B396392C84EB5A373986C7733D0ADA78C897D049464E", a04_completed["developer_target_hash"])
        acceptance = next(event for event in bundle["events"]["events"] if event["sequence"] == 78)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("A-04", acceptance["subject_ref"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        self.assertEqual("A-05", acceptance["details"]["next_work_package"])
        self.assertEqual("READY", acceptance["details"]["next_package_status"])
        self.assertEqual("TEST_REVIEW", acceptance["details"]["prior_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", acceptance["details"]["canonical_l7"])
        start_events = [event for event in bundle["events"]["events"] if 79 <= event["sequence"] <= 81]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual(1, start_events[0]["details"]["lease_epoch"])
        self.assertEqual(1, start_events[1]["details"]["write_epoch"])
        self.assertEqual(start_events[0]["details"]["lease_id"], start_events[1]["details"]["worker_lease_id"])
        completion_events = [event for event in bundle["events"]["events"] if 82 <= event["sequence"] <= 84]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed_a05 = completion_events[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a05["package_status"])
        self.assertEqual("COMPLETED", completed_a05["result_status"])
        self.assertFalse(completed_a05["accepted"])
        self.assertEqual("PENDING", completed_a05["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A05_ACCEPTANCE", completed_a05["next_package_status"])
        self.assertEqual("90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1", completed_a05["developer_manifest_ref"]["sha256"])
        self.assertEqual("974045F91F01FFDD342099BAA6CC2788C525FE8D74C7C8F5D0BDD31679E22266", completed_a05["developer_target_hash"])
        accepted = next(event for event in bundle["events"]["events"] if event["sequence"] == 85)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted["event_type"])
        self.assertEqual("A-05", accepted["subject_ref"])
        self.assertEqual("ACCEPTED", accepted["details"]["decision"])
        self.assertEqual(0, accepted["details"]["blocking_findings"])
        self.assertEqual("A-06", accepted["details"]["next_work_package"])
        start_events = [event for event in bundle["events"]["events"] if 86 <= event["sequence"] <= 88]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in start_events])
        self.assertEqual(1, start_events[0]["details"]["lease_epoch"])
        self.assertEqual(1, start_events[1]["details"]["write_epoch"])
        completion_events = [event for event in bundle["events"]["events"] if 89 <= event["sequence"] <= 91]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed_a06 = completion_events[-1]["details"]
        self.assertEqual("COMPLETED", completed_a06["result_status"])
        self.assertEqual("TEST_REVIEW", completed_a06["package_status"])
        self.assertFalse(completed_a06["accepted"])
        self.assertEqual("PENDING", completed_a06["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A06_ACCEPTANCE", completed_a06["next_package_status"])
        self.assertEqual(
            "A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449",
            completed_a06["developer_manifest_ref"]["sha256"],
        )
        self.assertEqual(
            "0CCF57584738B6CF38949D959297AF0877DC084070C352F7944C85AA0AF91258",
            completed_a06["developer_target_hash"],
        )
        acceptance = next(event for event in bundle["events"]["events"] if event["sequence"] == 92)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("A-06", acceptance["subject_ref"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        self.assertEqual("A-07", acceptance["details"]["next_work_package"])
        self.assertEqual("READY", acceptance["details"]["next_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", acceptance["details"]["canonical_l7"])
        start_events = [event for event in bundle["events"]["events"] if 93 <= event["sequence"] <= 95]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual(1, start_events[0]["details"]["lease_epoch"])
        self.assertEqual(1, start_events[1]["details"]["write_epoch"])
        self.assertEqual(start_events[0]["details"]["lease_id"], start_events[1]["details"]["worker_lease_id"])
        completion_events = [event for event in bundle["events"]["events"] if 96 <= event["sequence"] <= 98]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed_a07 = completion_events[-1]["details"]
        self.assertEqual("COMPLETED", completed_a07["result_status"])
        self.assertEqual("TEST_REVIEW", completed_a07["package_status"])
        self.assertFalse(completed_a07["accepted"])
        self.assertEqual("PENDING", completed_a07["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A07_ACCEPTANCE", completed_a07["next_package_status"])
        self.assertEqual("796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7", completed_a07["developer_manifest_ref"]["sha256"])
        self.assertEqual("45633F09FF8690D56499B75C813D6F5000FF4EB0323742CB6C1AF820396ECB9B", completed_a07["developer_target_hash"])
        self.assertEqual("NOT_EXECUTED", completed_a07["dir_status"])
        accepted_a07 = next(event for event in bundle["events"]["events"] if event["sequence"] == 99)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a07["event_type"])
        self.assertEqual("A-07", accepted_a07["subject_ref"])
        self.assertEqual("ACCEPTED", accepted_a07["details"]["decision"])
        self.assertEqual(0, accepted_a07["details"]["blocking_findings"])
        self.assertEqual("A5352696B24E95FE8BD86E845AD8B4A0171C805B7521F21F3543461A8C628506", accepted_a07["details"]["test_report_sha256"])
        self.assertEqual("A-08", accepted_a07["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a07["details"]["next_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", accepted_a07["details"]["canonical_l4"])
        self.assertEqual("NOT_EXECUTED", accepted_a07["details"]["dir_status"])
        a08_start = [event for event in bundle["events"]["events"] if 100 <= event["sequence"] <= 102]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a08_start],
        )
        self.assertEqual(1, a08_start[0]["details"]["lease_epoch"])
        self.assertEqual(1, a08_start[1]["details"]["write_epoch"])
        self.assertEqual(a08_start[0]["details"]["lease_id"], a08_start[1]["details"]["worker_lease_id"])
        self.assertEqual("79495e6d0d7da3530f99bb81d5b713ad0b3aebbf", a08_start[-1]["details"]["dispatch_head"])
        self.assertEqual(a08_start[-1]["details"]["dispatch_head"], a08_start[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual("CLEAN", a08_start[-1]["details"]["dispatch_worktree_status"])
        a08_completion = [event for event in bundle["events"]["events"] if 103 <= event["sequence"] <= 105]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a08_completion],
        )
        completed_a08 = a08_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a08["package_status"])
        self.assertEqual("COMPLETED", completed_a08["result_status"])
        self.assertFalse(completed_a08["accepted"])
        self.assertEqual("PENDING", completed_a08["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A08_ACCEPTANCE", completed_a08["next_package_status"])
        self.assertEqual("73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5", completed_a08["developer_manifest_ref"]["sha256"])
        self.assertEqual("0C10A4F557B2AAF6D90B5BA8C9320CFD694B4DCBF42C9FF3495E3B5D431DE52C", completed_a08["developer_target_hash"])
        self.assertEqual("NOT_EXECUTED", completed_a08["actual_product_validation_status"])
        self.assertEqual("NOT_EXECUTED", completed_a08["actual_release_status"])
        self.assertEqual("NOT_EXECUTED", completed_a08["dir_status"])
        accepted_a08_events = [event for event in bundle["events"]["events"] if event["sequence"] == 106]
        self.assertEqual(1, len(accepted_a08_events))
        accepted_a08 = accepted_a08_events[0]
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a08["event_type"])
        self.assertEqual("A-08", accepted_a08["subject_ref"])
        self.assertEqual("ACCEPTED", accepted_a08["details"]["decision"])
        self.assertEqual(0, accepted_a08["details"]["blocking_findings"])
        self.assertEqual("74D97BB4CBA10151918EDBB49C859936FF2AB3835CAA60986BAFF5B21FFF155A", accepted_a08["details"]["test_report_sha256"])
        self.assertEqual("A-09", accepted_a08["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a08["details"]["next_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", accepted_a08["details"]["canonical_l4"])
        self.assertEqual("NOT_EXECUTED", accepted_a08["details"]["actual_product_validation_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a08["details"]["actual_release_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a08["details"]["dir_status"])
        a09_start = [event for event in bundle["events"]["events"] if 107 <= event["sequence"] <= 109]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a09_start],
        )
        self.assertEqual(1, a09_start[0]["details"]["lease_epoch"])
        self.assertEqual(1, a09_start[1]["details"]["write_epoch"])
        self.assertEqual(a09_start[0]["details"]["lease_id"], a09_start[1]["details"]["worker_lease_id"])
        self.assertEqual("1bed9e88d962bebe9e4f6ad806b67d92c027fdcf", a09_start[-1]["details"]["dispatch_head"])
        self.assertEqual(a09_start[-1]["details"]["dispatch_head"], a09_start[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual("CLEAN", a09_start[-1]["details"]["dispatch_worktree_status"])
        self.assertIn("A-03", progress["completed_packages"])
        self.assertIn("A-04", progress["completed_packages"])
        self.assertIn("A-06", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertEqual(0, progress["historical_failure_counts_by_lineage"].get("A-04", 0))
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["A-03"])
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["A-13"])
        self.assertEqual(4, progress["historical_failure_counts_by_lineage"]["A-14"])
        a09_completion = [event for event in bundle["events"]["events"] if 110 <= event["sequence"] <= 112]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a09_completion],
        )
        completed_a09 = a09_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a09["package_status"])
        self.assertEqual("COMPLETED", completed_a09["result_status"])
        self.assertFalse(completed_a09["accepted"])
        self.assertEqual("PENDING", completed_a09["independent_tester_status"])
        self.assertEqual("A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3", completed_a09["developer_manifest_ref"]["sha256"])
        self.assertEqual("915B377C6390405664E8A2685DC502A65FE6305D8F327C80A46EFF457C4D4AA3", completed_a09["developer_target_hash"])
        self.assertEqual("A-10", completed_a09["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A09_ACCEPTANCE", completed_a09["next_package_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["actual_skill_activation_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["actual_hook_activation_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["actual_runtime_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["dir_status"])
        accepted_a09 = next(event for event in bundle["events"]["events"] if event["sequence"] == 113)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a09["event_type"])
        self.assertEqual("A-09", accepted_a09["subject_ref"])
        self.assertEqual("ACCEPTED", accepted_a09["details"]["decision"])
        self.assertEqual(0, accepted_a09["details"]["blocking_findings"])
        self.assertEqual("99F0B25764286668F709D221BE294D1A1F21BA2638EDAF5F0A4D5D7909DCF98F", accepted_a09["details"]["test_report_sha256"])
        self.assertEqual("A-10", accepted_a09["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a09["details"]["next_package_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["actual_skill_activation_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["actual_hook_activation_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["actual_runtime_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["dir_status"])
        self.assertIn("A-09", progress["completed_packages"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        a10_start = [event for event in bundle["events"]["events"] if 114 <= event["sequence"] <= 116]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a10_start],
        )
        self.assertEqual(1, a10_start[0]["details"]["lease_epoch"])
        self.assertEqual(1, a10_start[1]["details"]["write_epoch"])
        self.assertEqual(a10_start[0]["details"]["lease_id"], a10_start[1]["details"]["worker_lease_id"])
        self.assertEqual("0278141b9af2f94833f21997dddec52a5102fb3e", a10_start[-1]["details"]["dispatch_head"])
        self.assertEqual(a10_start[-1]["details"]["dispatch_head"], a10_start[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual("CLEAN", a10_start[-1]["details"]["dispatch_worktree_status"])
        a10_completion = [event for event in bundle["events"]["events"] if 117 <= event["sequence"] <= 119]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a10_completion],
        )
        completed_a10 = a10_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a10["package_status"])
        self.assertEqual("COMPLETED", completed_a10["result_status"])
        self.assertFalse(completed_a10["accepted"])
        self.assertEqual("PENDING", completed_a10["independent_tester_status"])
        self.assertEqual("C9667081B8BEA555C32F8833D7F28BCF3528882324814CCE08CAAEAA27DE6A84", completed_a10["developer_manifest_ref"]["sha256"])
        self.assertEqual("C179BA2371401BB57CAA02B5148D96A58B094092BE52088E85C6BA9882CFA64A", completed_a10["developer_target_hash"])
        self.assertEqual("A-11", completed_a10["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A10_ACCEPTANCE", completed_a10["next_package_status"])
        for field in ("actual_provider_status", "actual_secret_status", "actual_egress_status", "actual_api_status", "actual_db_status", "actual_event_status", "actual_browser_status", "actual_network_status", "actual_runtime_status", "dir_status"):
            self.assertEqual("NOT_EXECUTED", completed_a10[field])
        accepted_a10 = next(event for event in bundle["events"]["events"] if event["sequence"] == 120)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a10["event_type"])
        self.assertEqual("ACCEPTED", accepted_a10["details"]["decision"])
        self.assertEqual(0, accepted_a10["details"]["blocking_findings"])
        self.assertEqual("B1B51F68561805B3C12355D6A7A939063EA1AB77EF45553C22E036F4D1682045", accepted_a10["details"]["test_report_sha256"])
        self.assertEqual("A-11", accepted_a10["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a10["details"]["next_package_status"])
        for field in ("actual_provider_status", "actual_secret_status", "actual_egress_status", "actual_api_status", "actual_db_status", "actual_event_status", "actual_browser_status", "actual_network_status", "actual_runtime_status", "dir_status"):
            self.assertEqual("NOT_EXECUTED", accepted_a10["details"][field])
        a11_start = [event for event in bundle["events"]["events"] if 121 <= event["sequence"] <= 123]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a11_start],
        )
        a11_completion = [event for event in bundle["events"]["events"] if 124 <= event["sequence"] <= 126]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in a11_completion])
        completed_a11 = a11_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a11["package_status"])
        self.assertEqual("COMPLETED", completed_a11["result_status"])
        self.assertFalse(completed_a11["accepted"])
        self.assertEqual("PENDING", completed_a11["independent_tester_status"])
        self.assertEqual("23280C4FD8EA6C3FCEF814D8D429A4BA45FA0BE940E88E8237008B60FDBADFC0", completed_a11["developer_manifest_ref"]["sha256"])
        self.assertEqual("911C537607FD64112782A6E6506EAAFF4877EBE3C37B46CE8085D0C4C9C40654", completed_a11["developer_target_hash"])
        accepted_a11 = next(event for event in bundle["events"]["events"] if event["sequence"] == 127)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a11["event_type"])
        self.assertEqual("ACCEPTED", accepted_a11["details"]["decision"])
        self.assertEqual(0, accepted_a11["details"]["blocking_findings"])
        self.assertEqual("MINOR / non-blocking evidence-accounting inconsistency", accepted_a11["details"]["path_count_note"])
        self.assertEqual("A-12", accepted_a11["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a11["details"]["next_package_status"])
        a12_start = [event for event in bundle["events"]["events"] if 128 <= event["sequence"] <= 130]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in a12_start])
        a12_completion = [event for event in bundle["events"]["events"] if 131 <= event["sequence"] <= 133]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in a12_completion])
        completed_a12 = a12_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a12["package_status"])
        self.assertEqual("COMPLETED", completed_a12["result_status"])
        self.assertFalse(completed_a12["accepted"])
        self.assertEqual("PENDING", completed_a12["independent_tester_status"])
        self.assertEqual("A-13", completed_a12["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A12_ACCEPTANCE", completed_a12["next_package_status"])
        accepted_a12_events = [event for event in bundle["events"]["events"] if event["sequence"] == 134]
        self.assertEqual(1, len(accepted_a12_events))
        accepted_a12 = accepted_a12_events[0]
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a12["event_type"])
        self.assertEqual("ACCEPTED", accepted_a12["details"]["decision"])
        self.assertEqual(0, accepted_a12["details"]["blocking_findings"])
        self.assertEqual("42BDCD1C71E6B0239E1A5313FE247D1491CF78692D5B6B6C4D815A5DEFD00583", accepted_a12["details"]["test_report_sha256"])
        self.assertEqual("A-13", accepted_a12["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a12["details"]["next_package_status"])
        a13_start = [event for event in bundle["events"]["events"] if 135 <= event["sequence"] <= 137]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in a13_start])
        a13_completion = [event for event in bundle["events"]["events"] if 138 <= event["sequence"] <= 140]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in a13_completion])
        completed_a13 = a13_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a13["package_status"])
        self.assertEqual("COMPLETED", completed_a13["result_status"])
        self.assertFalse(completed_a13["accepted"])
        self.assertEqual("PENDING", completed_a13["independent_tester_status"])
        self.assertEqual("A-14", completed_a13["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A13_ACCEPTANCE", completed_a13["next_package_status"])
        self.assertEqual("BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE", completed_a13["developer_manifest_ref"]["sha256"])
        self.assertEqual("1AEC2DC560F1AF41B234FEDA3603C25F88B62740E8FB19A83FA85B770D3BA733", completed_a13["developer_target_hash"])
        self.assertIn("A-12", progress["completed_packages"])
        failure = next(event for event in bundle["events"]["events"] if event["sequence"] == 141)
        self.assertEqual("FAILURE_REPORT_ACCEPTED", failure["event_type"])
        self.assertEqual(2, failure["details"]["blocking_defect_count"])
        self.assertEqual(1, failure["details"]["valid_failure_count"])
        rework = [event for event in bundle["events"]["events"] if 142 <= event["sequence"] <= 144]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], [event["event_type"] for event in rework])
        completion_r2 = [event for event in bundle["events"]["events"] if 145 <= event["sequence"] <= 147]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in completion_r2])
        details_r2 = completion_r2[-1]["details"]
        self.assertEqual("TEST_REVIEW", details_r2["package_status"])
        self.assertEqual("FIXED_AWAITING_INDEPENDENT_RETEST", details_r2["finding_status"])
        self.assertEqual("4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771", details_r2["developer_manifest_ref"]["sha256"])
        self.assertEqual("7629BE41F2174CEA6538B35C410A1E3DE7488A8BFD0BA166229F5C36DEB8A085", details_r2["developer_target_hash"])
        accepted_a13 = next(event for event in bundle["events"]["events"] if event["sequence"] == 148)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a13["event_type"])
        self.assertEqual("ACCEPTED", accepted_a13["details"]["decision"])
        self.assertEqual(0, accepted_a13["details"]["blocking_findings"])
        self.assertEqual("277B7F55EED69C3FDA112C6D8033674B5FC9AD63D39CDD89C2133865CBF66B86", accepted_a13["details"]["test_report_sha256"])
        self.assertEqual(["A13-TST-BLK-001", "A13-TST-BLK-002"], accepted_a13["details"]["closed_findings"])
        a14_start = [event for event in bundle["events"]["events"] if 149 <= event["sequence"] <= 151]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a14_start],
        )
        a14_completion = [event for event in bundle["events"]["events"] if 152 <= event["sequence"] <= 154]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a14_completion],
        )
        completed_a14 = a14_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a14["package_status"])
        self.assertEqual("COMPLETED", completed_a14["result_status"])
        self.assertFalse(completed_a14["accepted"])
        self.assertEqual("PENDING", completed_a14["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A14_ACCEPTANCE", completed_a14["next_package_status"])
        a14_r2_completion = [event for event in bundle["events"]["events"] if 159 <= event["sequence"] <= 161]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a14_r2_completion],
        )
        a15_start = [event for event in bundle["events"]["events"] if 176 <= event["sequence"] <= 178]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a15_start],
        )
        b01_start = [event for event in bundle["events"]["events"] if 187 <= event["sequence"] <= 189]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in b01_start],
        )
        self.assert_current_b09_start(progress)
        self.assertIn("A-13", progress["completed_packages"])
        self.assertIn("A-14", progress["completed_packages"])
        self.assertIn("A-15", progress["completed_packages"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b04_start_projection_issues_fenced_developer_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("B-04", manifest["package_id"])
        self.assert_current_b09_start(bundle["progress"])

    def test_b04_start_binds_approved_internal_runtime_boundary(self) -> None:
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        approval = ROOT / "docs/approvals/APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001.md"
        self.assertTrue(approval.is_file())
        self.assertEqual("ssh ysna-server", manifest["runtime_boundary"]["host"])
        self.assertEqual("~/deploy/anvil", manifest["runtime_boundary"]["deploy_root"])
        self.assertEqual("shared-db", manifest["runtime_boundary"]["database_container"])
        self.assertEqual("WSL_FIRST_SAME_COMMIT_REQUIRED", manifest["runtime_boundary"]["pre_deploy_validation"])
        self.assertEqual("DENIED_PENDING_SEPARATE_APPROVAL", manifest["runtime_boundary"]["public_exposure"])

    def test_b04_completion_revokes_leases_before_independent_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        terminal = [event for event in bundle["events"]["events"] if 245 <= event["sequence"] <= 247]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in terminal],
        )
        progress = bundle["progress"]
        self.assert_current_b09_start(progress)
        self.assertEqual([], checker.validate_b04_completion_manifest(manifest, bundle))

    def test_b04_main_acceptance_releases_b05_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-04_ACCEPTANCE_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 248]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-04", progress["completed_packages"])
        self.assertEqual([], checker.validate_b04_acceptance_manifest(manifest, bundle))

    def test_workplan_v16_successor_keeps_b05_ready_and_leaseless(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/WORKPLAN_V16_SUCCESSOR_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        successor = [event for event in bundle["events"]["events"] if event["sequence"] == 249]
        self.assertEqual(["EVIDENCE_MANIFEST_CREATED"], [event["event_type"] for event in successor])
        self.assert_current_b09_start(progress)
        self.assertEqual([], checker.validate_workplan_v16_successor_manifest(manifest, bundle))

    def test_b05_start_projects_fenced_execution_schema_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-05_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 250 <= event["sequence"] <= 252]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual([], checker.validate_b05_start_manifest(manifest, bundle))

    def test_b05_wi_rebind_corrects_dir_states_and_rotates_fencing(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 253 <= event["sequence"] <= 257]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-05_WI_REBIND_EVIDENCE_MANIFEST_R2.json").read_text(encoding="utf-8"))
        self.assertEqual(["DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"], manifest["canonical_design_intent_review_statuses"])
        self.assertEqual("ABSENT_REVIEW_ROW_OR_PROGRESS_PROJECTION", manifest["not_reached_representation"])
        self.assertEqual("CREATE_NEW_DIR_REVIEW_AND_EVENT", manifest["recurrent_drift_policy"])
        self.assertEqual([], checker.validate_b05_wi_rebind_manifest(manifest, bundle))

    def test_b05_completion_revokes_epoch2_and_enters_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 258 <= event["sequence"] <= 260]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual(2, progress["valid_failure_count"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-05_COMPLETION_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b05_completion_manifest(manifest, bundle))

    def test_b05_main_acceptance_releases_b06_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 261]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-05", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-05_ACCEPTANCE_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b05_acceptance_manifest(manifest, bundle))

    def test_b06_start_projects_fenced_event_store_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-06_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 262 <= event["sequence"] <= 264]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b06_start_manifest(manifest, bundle))

    def test_b06_completion_revokes_epoch1_and_enters_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-06_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 265 <= event["sequence"] <= 267]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b06_completion_manifest(manifest, bundle))

    def test_b06_main_acceptance_releases_b07_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 268]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-06", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-06_ACCEPTANCE_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b06_acceptance_manifest(manifest, bundle))

    def test_b07_start_projects_fenced_checkpoint_artifact_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-07_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 269 <= event["sequence"] <= 271]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b07_start_manifest(manifest, bundle))

    def test_b07_completion_revokes_epoch1_and_enters_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-07_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 272 <= event["sequence"] <= 274]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b07_completion_manifest(manifest, bundle))

    def test_b07_main_acceptance_releases_b08_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 275]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-07", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-07_ACCEPTANCE_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b07_acceptance_manifest(manifest, bundle))

    def test_b08_start_projects_fenced_progress_outbox_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 276 <= event["sequence"] <= 278]

        self.assert_current_b09_start(progress)
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )
        manifest_path = ROOT / "docs/evidence/manifests/B-08_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b08_start_manifest(manifest, bundle))

    def test_b08_completion_revokes_epoch1_and_waits_for_database_verification(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 279 <= event["sequence"] <= 281]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest_path = ROOT / "docs/evidence/manifests/B-08_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b08_completion_manifest(manifest, bundle))

    def test_b08_main_acceptance_releases_b09_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 282]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-08", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest_path = ROOT / "docs/evidence/manifests/B-08_ACCEPTANCE_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b08_acceptance_manifest(manifest, bundle))

    def test_b09_start_projects_fenced_queue_scheduler_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 283 <= event["sequence"] <= 285]

        self.assert_current_b09_start(progress)
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b09_authority_rebind_rotates_fencing_without_product_write(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 286 <= event["sequence"] <= 290]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest_path = ROOT / "docs/evidence/manifests/B-09_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b09_start_manifest(manifest, bundle))

    def test_b09_r4_third_valid_failure_transfers_epoch4_to_main_and_keeps_b10_blocked(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 296 <= event["sequence"] <= 301]
        lineage = progress["active_failure_lineage"]

        self.assert_current_b09_start(progress)
        self.assertEqual("B-10", lineage["step_lineage_id"])
        self.assertEqual("BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE", lineage["failure_fingerprint"])
        self.assertEqual(4, events[3]["details"]["lease_epoch"])
        self.assertEqual("b09-main-takeover-execution-fence-epoch-4-7c3382a", events[3]["details"]["execution_fencing_token"])
        self.assertEqual(4, events[4]["details"]["write_epoch"])
        self.assertEqual("b09-main-takeover-write-fence-epoch-4-7c3382a", events[4]["details"]["write_fencing_token"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_b09_main_completion_revokes_epoch4_and_waits_for_tester(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 302 <= event["sequence"] <= 304]
        self.assert_current_b09_start(progress)
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_b09_r5_rework_issues_epoch5_main_leases_for_frozen_product(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 305 <= event["sequence"] <= 308]
        self.assert_current_b09_start(progress)
        self.assertEqual(["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], [event["event_type"] for event in events])
        self.assertEqual(15, len(events[2]["details"]["paths"]))
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_b09_r5_completion_revokes_epoch5_and_waits_for_retest(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 309 <= event["sequence"] <= 311]
        self.assert_current_b09_start(progress)
        self.assertEqual("PENDING_RETEST", events[-1]["details"]["independent_tester_status"])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b09_r5_acceptance_releases_b10_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 312]
        self.assert_current_b09_start(progress)
        self.assertIn("B-09", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual(4, progress["historical_failure_counts_by_lineage"]["B-09"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assertEqual("A84E6FE92F11F987D987E7787344D8A81125ECF977168DBDA0641BD6DB4D732D", accepted[0]["details"]["test_report_sha256"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b10_start_projects_intervention_budget_fenced_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 313 <= event["sequence"] <= 315]
        self.assert_current_b09_start(progress)
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b10_completion_freezes_developer_exact15_and_waits_for_tester(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 316 <= event["sequence"] <= 318]
        manifest_path = ROOT / "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual("0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F", manifest["developer_target_hash"])
        self.assertFalse(manifest["self_reference"])

    def test_b10_rework_r2_accepts_critical_finding_and_dispatches_epoch2(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 319 <= event["sequence"] <= 322]

        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("B-10", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b10_rework_completion_projection(ROOT))

    def test_b10_rework_r2_completion_revokes_epoch2_and_waits_for_retest(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 323 <= event["sequence"] <= 325]
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual([], checker.validate_b10_rework_completion_projection(ROOT))

    def test_b10_rework_r3_accepts_second_failure_and_dispatches_epoch3(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 326 <= event["sequence"] <= 329]
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("WI-B-10-20260821-003", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual([], checker.validate_b10_r3_rework_start_projection(ROOT))

    def test_b10_rework_r3_completion_revokes_epoch3_and_waits_for_retest(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 330 <= event["sequence"] <= 332]
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual(20, len(progress["repository"]["exact_allowed_paths"]))
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual([], checker.validate_b10_r3_rework_completion_projection(ROOT))

    def test_b10_r3_main_acceptance_releases_b11_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 333]
        self.assertEqual(333, progress["event_sequence"])
        self.assertEqual("B-11", progress["current_work_package"])
        self.assertEqual("READY", progress["status"])
        self.assertIn("B-10", progress["completed_packages"])
        self.assertEqual(0, progress["valid_failure_count"])
        self.assertEqual(2, progress["historical_failure_counts_by_lineage"]["B-10"])
        self.assertIsNone(progress["active_work_instruction"])
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b11_start_projects_common_api_bff_sse_security_dispatch(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 336: return
        events = [event for event in bundle["events"]["events"] if 334 <= event["sequence"] <= 336]
        self.assertEqual([], checker.validate_b11_start_projection(ROOT))
        self.assertEqual(336, progress["event_sequence"])
        self.assertEqual("B-11", progress["current_work_package"])
        self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual("developer-primary-b11", progress["active_agent"])
        self.assertEqual("WI-B-11-20260821-001", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual(1, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(1, progress["write_lease"]["write_epoch"])
        self.assertEqual({"package_id": "B-12", "status": "BLOCKED_PENDING_B11_ACCEPTANCE"}, progress["next_work_package"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b11_completion_freezes_exact17_and_waits_for_independent_tester(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 339:
            return
        events = [event for event in bundle["events"]["events"] if 337 <= event["sequence"] <= 339]
        self.assertEqual([], checker.validate_b11_completion_projection(ROOT))
        self.assertEqual(339, progress["event_sequence"])
        self.assertEqual("B-11", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("PENDING", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual("FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5", progress["active_work_instruction"]["developer_target_hash"])
        self.assertEqual("BLOCKED_PENDING_B11_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])

    def test_b11_rework_start_accepts_scope_failure_and_issues_epoch2_leases(self) -> None:
        """Dropping the accepted failure or either epoch-2 lease must fail this projection."""
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 343: return
        events = [event for event in bundle["events"]["events"] if 340 <= event["sequence"] <= 343]
        self.assertEqual([], checker.validate_b11_rework_start_projection(ROOT))
        self.assertEqual(343, progress["event_sequence"])
        self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual("REWORK_IN_PROGRESS", progress["active_work_instruction"]["result_status"])
        self.assertEqual(1, progress["valid_failure_count"])
        self.assertEqual(2, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(2, progress["write_lease"]["write_epoch"])
        self.assertEqual("BLOCKED_PENDING_B11_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )

    def test_b11_r2_completion_revokes_epoch2_and_waits_for_retest(self) -> None:
        progress = json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
        if progress.get("event_sequence", 0) > 346: return
        checker=self.require_checker()
        self.assertEqual([],checker.validate_b11_r2_completion_projection(ROOT))

    def test_b11_main_acceptance_releases_b12_without_starting_it(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 347: return
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 347]
        self.assertEqual(347, progress["event_sequence"])
        self.assertEqual("B-12", progress["current_work_package"])
        self.assertEqual("READY", progress["status"])
        self.assertIn("B-11", progress["completed_packages"])
        self.assertEqual(0, progress["valid_failure_count"])
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["B-11"])
        self.assertEqual("B-12", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(0, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertIsNone(progress["active_work_instruction"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual({"package_id": "B-12", "status": "READY"}, progress["next_work_package"])
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b12_start_projects_recovery_dispatch_and_blocks_c01(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 350: return
        events = [event for event in bundle["events"]["events"] if 348 <= event["sequence"] <= 350]
        self.assertEqual([], checker.validate_b12_start_projection(ROOT))
        self.assertEqual(350, progress["event_sequence"])
        self.assertEqual("B-12", progress["current_work_package"])
        self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual("developer-primary-b12", progress["active_agent"])
        self.assertEqual("WI-B-12-20260821-001", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual(1, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(1, progress["write_lease"]["write_epoch"])
        self.assertEqual({"package_id": "C-01", "status": "BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE"}, progress["next_work_package"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b12_completion_freezes_exact15_and_waits_for_independent_test(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 353: return
        events = [event for event in bundle["events"]["events"] if 351 <= event["sequence"] <= 353]
        self.assertEqual([], checker.validate_b12_completion_projection(ROOT))
        self.assertEqual(353, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("PENDING", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])

    def test_b12_r2_rework_accepts_failure_and_issues_epoch2_exact10(self) -> None:
        checker = self.require_checker(); bundle = checker.load_bundle(ROOT); progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 357: return
        events = [e for e in bundle["events"]["events"] if 354 <= e["sequence"] <= 357]
        self.assertEqual([], checker.validate_b12_rework_start_projection(ROOT))
        self.assertEqual(357, progress["event_sequence"]); self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual(1, progress["valid_failure_count"]); self.assertEqual(2, progress["worker_lease"]["lease_epoch"]); self.assertEqual(2, progress["write_lease"]["write_epoch"])
        self.assertEqual(["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], [e["event_type"] for e in events])

    def test_b12_r2_completion_freezes_exact10_for_independent_retest(self) -> None:
        if json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")).get("event_sequence", 0) > 360:
            return
        checker = self.require_checker()
        self.assertEqual([], checker.validate_b12_r2_completion_projection(ROOT))

    def test_b12_acceptance_closes_failure_and_blocks_c01_pending_b_gate(self) -> None:
        checker = self.require_checker()
        if json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")).get("event_sequence", 0) > 361:
            bundle = checker.load_bundle(ROOT)
            manifest = json.loads(
                (ROOT / "docs/evidence/manifests/B-12_ACCEPTANCE_PROGRESS_MANIFEST_R2.json").read_text(encoding="utf-8")
            )
            self.assertEqual([], checker.validate_b12_acceptance_manifest(manifest, bundle))
            tampered_bundle = copy.deepcopy(bundle)
            historical_event = next(
                event for event in tampered_bundle["events"]["events"] if event["sequence"] == 361
            )
            historical_event["event_type"] = "TAMPERED"
            self.assertIn(
                "B12_ACCEPTANCE_EVENT_INVALID",
                checker.validate_b12_acceptance_manifest(manifest, tampered_bundle),
            )
            return
        self.assertEqual([], checker.validate_b12_acceptance_projection(ROOT)); self.assertEqual([], checker.validate_bundle(checker.load_bundle(ROOT)))

    def test_phase_b_gate_active_projection_preserves_b12_history_and_blocks_c01(self) -> None:
        """Removing the Phase B Gate fence or opening C-01 must fail validation."""
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_phase_b_gate_active_projection"),
            "Phase B Gate ACTIVE projection validator is required",
        )
        bundle = copy.deepcopy(checker.load_bundle(ROOT))
        progress = bundle["progress"]
        progress.update(
            {
                "event_sequence": 371,
                "current_phase": "B",
                "current_work_package": "PHASE_B_GATE",
                "status": "ACTIVE",
                "active_agent": "developer-primary-phase-b-gate",
                "active_failure_lineage": {
                    "step_lineage_id": "PHASE_B_GATE",
                    "valid_failure_count": 0,
                },
                "worker_lease": {
                    "lease_id": "worker-lease-phase-b-gate-20260821-001",
                    "agent_id": "developer-primary-phase-b-gate",
                    "work_package_id": "PHASE_B_GATE",
                    "lease_epoch": 3,
                    "execution_fencing_token": "phase-b-gate-execution-fence-epoch-3-165a9bf",
                    "status": "ACTIVE",
                },
                "write_lease": {
                    "lease_id": "write-lease-phase-b-gate-20260821-001",
                    "worker_lease_id": "worker-lease-phase-b-gate-20260821-001",
                    "agent_id": "developer-primary-phase-b-gate",
                    "work_package_id": "PHASE_B_GATE",
                    "write_epoch": 3,
                    "execution_fencing_token": "phase-b-gate-execution-fence-epoch-3-165a9bf",
                    "write_fencing_token": "phase-b-gate-write-fence-epoch-3-165a9bf",
                    "status": "ACTIVE",
                    "paths": checker.PHASE_B_GATE_ALLOWED_PATHS,
                },
                "active_work_instruction": {
                    "artifact_id": "WI-PHASE-B-GATE-REWORK-20260821-003",
                    "result_status": "IN_PROGRESS",
                    "independent_tester_status": "PENDING",
                    "assigned_verification_count": 44,
                    "direct_gate_set": "EXACT44_DEPENDENCY_SAFE",
                    "deferred_verification_ids": checker.PHASE_B_GATE_DEFERRED_IDS,
                    "undefined_verification_ids": ["AV-STAT-029"],
                },
                "next_work_package": {
                    "package_id": "C-01",
                    "status": "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE",
                },
            }
        )

        self.assertEqual([], checker.validate_phase_b_gate_active_projection(bundle))

        c01_opened = copy.deepcopy(bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "PHASE_B_GATE_C01_BOUNDARY_INVALID",
            checker.validate_phase_b_gate_active_projection(c01_opened),
        )

        missing_fence = copy.deepcopy(bundle)
        missing_fence["progress"]["write_lease"]["write_fencing_token"] = "stale"
        self.assertIn(
            "PHASE_B_GATE_FENCING_INVALID",
            checker.validate_phase_b_gate_active_projection(missing_fence),
        )

    def test_phase_b_gate_test_review_projection_releases_leases_and_blocks_c01(self) -> None:
        """The seq374 handoff is distinct from every prior ACTIVE projection."""
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_phase_b_gate_test_review_projection"),
            "Phase B Gate TEST_REVIEW projection validator is required",
        )
        review_bundle = copy.deepcopy(checker.load_bundle(ROOT))
        progress = review_bundle["progress"]
        progress.update(
            {
                "event_sequence": 374,
                "current_phase": "B",
                "current_work_package": "PHASE_B_GATE",
                "status": "TEST_REVIEW",
                "active_agent": None,
                "worker_lease": None,
                "write_lease": None,
                "active_failure_lineage": {
                    "step_lineage_id": "PHASE_B_GATE",
                    "valid_failure_count": 0,
                },
                "active_work_instruction": {
                    "artifact_id": "WI-PHASE-B-GATE-REWORK-20260821-003",
                    "result_status": "COMPLETED",
                    "package_status": "TEST_REVIEW",
                    "accepted": False,
                    "independent_tester_status": "READY_FOR_MAIN_GATE_DECISION",
                },
                "next_work_package": {
                    "package_id": "C-01",
                    "status": "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE",
                },
            }
        )

        self.assertEqual([], checker.validate_phase_b_gate_test_review_projection(review_bundle))

        c01_opened = copy.deepcopy(review_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "PHASE_B_GATE_C01_BOUNDARY_INVALID",
            checker.validate_phase_b_gate_test_review_projection(c01_opened),
        )

        lease_not_revoked = copy.deepcopy(review_bundle)
        lease_not_revoked["progress"]["active_agent"] = "developer-primary-phase-b-gate"
        self.assertIn(
            "PHASE_B_GATE_TEST_REVIEW_RELEASE_INVALID",
            checker.validate_phase_b_gate_test_review_projection(lease_not_revoked),
        )

    def test_c21_lr02a_r4_acceptance_binds_events_manifest_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_c21_lr02a_acceptance_projection"),
            "C-21/LR-02A R4 acceptance projection validator is required",
        )
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json"
            ).read_text(encoding="utf-8")
        )
        accepted_bundle = copy.deepcopy(bundle)
        accepted_progress = accepted_bundle["progress"]
        _restore_pre_wsl_approval_state(accepted_progress)
        accepted_progress.update(
            {
                "event_sequence": 424,
                "last_event_id": "evt_c21_lr02a_acceptance_repository_reconciled_r4",
                "active_agent": None,
                "active_work_instruction": None,
                "worker_lease": None,
                "write_lease": None,
                "valid_failure_count": 0,
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02a-accepted-r4.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json",
                },
                "next_successor_work_package": {
                    "package_id": "C-21/LR-02B",
                    "status": "READY_FOR_WORK_INSTRUCTION",
                },
            }
        )
        accepted_progress["repository"].update(
            {
                "validated_base_commit": "e57f008d0916953dab3c9425322a1e8942ed0379",
                "local_head": "e57f008d0916953dab3c9425322a1e8942ed0379",
                "feature_remote_head": "e57f008d0916953dab3c9425322a1e8942ed0379",
                "remote_head": "1573e0242aa718d0f81f6b6fc936c754b7c75e60",
                "head_relation": "FEATURE_CHECKPOINT_WITH_LR02A_ACCEPTED_EXACT41_WORKTREE",
                "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02A_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
                "exact_allowed_paths": [f"historical-lr02a-path-{index}" for index in range(41)],
            }
        )
        self.assertEqual([], checker.validate_c21_lr02a_acceptance_projection(manifest, accepted_bundle))

        c01_opened = copy.deepcopy(accepted_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02A_ACCEPTANCE_PROJECTION_INVALID",
            checker.validate_c21_lr02a_acceptance_projection(manifest, c01_opened),
        )

        mutated_event = copy.deepcopy(accepted_bundle)
        next(
            event
            for event in mutated_event["events"]["events"]
            if event.get("sequence") == 423
        )["details"]["decision"] = "REJECTED"
        self.assertIn(
            "C21_LR02A_ACCEPTANCE_EVENTS_INVALID",
            checker.validate_c21_lr02a_acceptance_projection(manifest, mutated_event),
        )

        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02A_ACCEPTANCE_MANIFEST_INVALID",
            checker.validate_c21_lr02a_acceptance_projection(invalid_manifest, accepted_bundle),
        )

        repository = accepted_bundle["progress"]["repository"]
        projection_paths = list(repository["exact_allowed_paths"])
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository.get("feature_remote_head"),
                base_is_ancestor=True,
                actual_changed_paths=projection_paths,
                working_tree_mode=True,
                progress=accepted_bundle["progress"],
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository.get("feature_remote_head"),
                base_is_ancestor=True,
                actual_changed_paths=projection_paths + ["outside.txt"],
                working_tree_mode=True,
                progress=bundle["progress"],
            ),
        )

    def test_c21_lr02b_start_binds_leases_events_manifest_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_c21_lr02b_start_projection"),
            "C-21/LR-02B start projection validator is required",
        )
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        start_bundle = copy.deepcopy(bundle)
        start_progress = start_bundle["progress"]
        _restore_pre_wsl_approval_state(start_progress)
        start_progress.update(
            {
                "event_sequence": 428,
                "last_event_id": "evt_c21_lr02b_package_started",
                "active_agent": "developer-primary",
                "valid_failure_count": 0,
                "active_failure_lineage": {
                    "step_lineage_id": "C-21/LR-02B",
                    "failure_fingerprint": None,
                    "valid_failure_count": 0,
                },
                "next_successor_work_package": {
                    "package_id": "C-21/LR-02B",
                    "status": "ACTIVE",
                },
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json",
                },
            }
        )
        start_progress["active_work_instruction"] = copy.deepcopy(
            start_progress["accepted_c21_lr02b_work_instruction"]
        )
        start_progress["active_work_instruction"].update(
            {"result_status": "IN_PROGRESS", "package_status": "ACTIVE"}
        )
        start_progress["worker_lease"] = copy.deepcopy(
            start_progress["completed_c21_lr02b_worker_lease"]
        )
        start_progress["worker_lease"]["status"] = "ACTIVE"
        start_progress["worker_lease"].pop("revoked_at", None)
        start_progress["write_lease"] = copy.deepcopy(
            start_progress["completed_c21_lr02b_write_lease"]
        )
        start_progress["write_lease"]["status"] = "ACTIVE"
        start_progress["write_lease"].pop("revoked_at", None)
        event425 = next(
            event for event in start_bundle["events"]["events"] if event.get("sequence") == 425
        )
        start_progress["repository"].update(
            {
                "validated_base_commit": event425["details"]["validated_base_commit"],
                "local_head": event425["details"]["local_head"],
                "feature_remote_head": event425["details"]["validated_base_commit"],
                "exact_allowed_paths": event425["details"]["exact_allowed_paths"],
                "head_relation": "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02B_EXACT20_WORKTREE",
                "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02B_ACTIVE",
            }
        )
        self.assertEqual([], checker.validate_c21_lr02b_start_projection(manifest, start_bundle))

        c01_opened = copy.deepcopy(start_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02B_START_PROJECTION_INVALID",
            checker.validate_c21_lr02b_start_projection(manifest, c01_opened),
        )

        mutated_event = copy.deepcopy(start_bundle)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 428)[
            "event_type"
        ] = "PACKAGE_COMPLETED"
        self.assertIn(
            "C21_LR02B_START_EVENTS_INVALID",
            checker.validate_c21_lr02b_start_projection(manifest, mutated_event),
        )

        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02B_START_MANIFEST_INVALID",
            checker.validate_c21_lr02b_start_projection(invalid_manifest, start_bundle),
        )

        repository = start_bundle["progress"]["repository"]
        changed_paths = [
            "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json",
            "docs/work_orders/C-21_LR-02B_INVOCATION_PROMPT.md",
            "docs/work_orders/C-21_LR-02B_WORK_INSTRUCTION.md",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths,
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths + ["outside.txt"],
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )

    def test_c21_lr02b_acceptance_binds_closed_failure_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        acceptance_bundle = copy.deepcopy(bundle)
        acceptance_progress = acceptance_bundle["progress"]
        _restore_pre_wsl_approval_state(acceptance_progress)
        event435 = next(
            event for event in acceptance_bundle["events"]["events"] if event.get("sequence") == 435
        )
        acceptance_progress.update(
            {
                "event_sequence": 435,
                "last_event_id": "evt_c21_lr02b_acceptance_repository_reconciled",
                "active_agent": None,
                "active_work_instruction": None,
                "worker_lease": None,
                "write_lease": None,
                "valid_failure_count": 0,
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02b-accepted.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json",
                },
                "next_successor_work_package": {
                    "package_id": "C-21/LR-02C",
                    "status": "READY_FOR_WORK_INSTRUCTION",
                },
            }
        )
        acceptance_progress["repository"].update(
            {
                "validated_base_commit": event435["details"]["validated_base_commit"],
                "local_head": event435["details"]["local_head"],
                "feature_remote_head": event435["details"]["feature_remote_head"],
                "head_relation": event435["details"]["head_relation"],
                "push_status": event435["details"]["push_status"],
                "exact_allowed_paths": event435["details"]["exact_allowed_paths"],
            }
        )
        self.assertEqual([], checker.validate_c21_lr02b_acceptance_projection(manifest, acceptance_bundle))

        c01_opened = copy.deepcopy(acceptance_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_PROJECTION_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(manifest, c01_opened),
        )
        lost_failure = copy.deepcopy(acceptance_bundle)
        lost_failure["progress"]["historical_failure_counts_by_lineage"]["C-21/LR-02B"] = 0
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_PROJECTION_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(manifest, lost_failure),
        )
        mutated_event = copy.deepcopy(acceptance_bundle)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 434)[
            "details"
        ]["decision"] = "REJECTED"
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_EVENTS_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(manifest, mutated_event),
        )
        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_MANIFEST_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(invalid_manifest, acceptance_bundle),
        )

    def test_c21_lr02c_start_binds_exact20_leases_events_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_c21_lr02c_start_projection"),
            "C-21/LR-02C start projection validator is required",
        )
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        start_bundle = copy.deepcopy(bundle)
        start_progress = start_bundle["progress"]
        _restore_pre_wsl_approval_state(start_progress)
        event436 = next(
            event for event in start_bundle["events"]["events"] if event.get("sequence") == 436
        )
        event438 = next(
            event for event in start_bundle["events"]["events"] if event.get("sequence") == 438
        )
        start_worker = copy.deepcopy(start_progress["completed_c21_lr02c_worker_lease"])
        start_worker["status"] = "ACTIVE"
        start_worker.pop("revoked_at", None)
        start_write = copy.deepcopy(start_progress["completed_c21_lr02c_write_lease"])
        start_write["status"] = "ACTIVE"
        start_write.pop("revoked_at", None)
        start_write["paths"] = copy.deepcopy(event438["details"]["path_scope"])
        start_instruction = copy.deepcopy(start_progress["accepted_c21_lr02c_work_instruction"])
        start_instruction.update(
            {
                "artifact_id": "WI-C-21-LR-02C-20260903-001",
                "path": "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
                "sha256": "C0F78E48718059241C868AB3891FC30095C1D3627D1E133A33178C97BA48212D",
                "invocation_path": "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
                "invocation_sha256": "3A1A5DA6A7751EE3C6253EE06C9BFC89AC9D01855F56E1896F7CD58ACC8501E7",
                "result_status": "IN_PROGRESS",
                "package_status": "ACTIVE",
                "executor": "developer-primary",
            }
        )
        start_progress.update(
            {
                "event_sequence": 439,
                "last_event_id": "evt_c21_lr02c_package_started",
                "active_agent": "developer-primary",
                "active_work_instruction": start_instruction,
                "worker_lease": start_worker,
                "write_lease": start_write,
                "valid_failure_count": 0,
                "active_failure_lineage": {"step_lineage_id": "C-21/LR-02C"},
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json",
                },
                "next_successor_work_package": {"package_id": "C-21/LR-02C", "status": "ACTIVE"},
            }
        )
        start_progress["repository"].update(
            {
                "validated_base_commit": event436["details"]["validated_base_commit"],
                "local_head": event436["details"]["local_head"],
                "feature_remote_head": event436["details"]["validated_base_commit"],
                "head_relation": event436["details"]["head_relation"],
                "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02C_ACTIVE",
                "exact_allowed_paths": event436["details"]["exact_allowed_paths"],
            }
        )
        self.assertEqual([], checker.validate_c21_lr02c_start_projection(manifest, start_bundle))

        c01_opened = copy.deepcopy(start_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02C_START_PROJECTION_INVALID",
            checker.validate_c21_lr02c_start_projection(manifest, c01_opened),
        )

        mutated_event = copy.deepcopy(start_bundle)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 439)[
            "event_type"
        ] = "PACKAGE_COMPLETED"
        self.assertIn(
            "C21_LR02C_START_EVENTS_INVALID",
            checker.validate_c21_lr02c_start_projection(manifest, mutated_event),
        )

        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02C_START_MANIFEST_INVALID",
            checker.validate_c21_lr02c_start_projection(invalid_manifest, start_bundle),
        )

        repository = start_bundle["progress"]["repository"]
        changed_paths = [
            "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json",
            "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
            "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths,
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths + ["outside.txt"],
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )

    def test_c21_lr02c_takeover_r2_binds_failure_revocation_and_main_epoch2(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        historical = copy.deepcopy(bundle)
        progress = historical["progress"]
        _restore_pre_wsl_approval_state(progress)
        progress["event_sequence"] = 445
        progress["last_event_id"] = "evt_c21_lr02c_main_takeover_resumed_r2"
        progress["valid_failure_count"] = 1
        progress["active_failure_lineage"] = {
            "step_lineage_id": "C-21/LR-02C",
            "failure_fingerprint": "C21_LR02C_TEST_SESSION_REBIND_NOT_RESTORED_OR_PRESERVATION_UNRECORDED",
            "valid_failure_count": 1,
            "internal_identical_error_count": 3,
            "internal_error_fingerprint": "WINDOWS_BACKUP_RECEIPT_MODE_HARNESS_MISMATCH",
            "takeover_status": "MAIN_TAKEOVER",
        }
        progress["active_work_instruction"] = copy.deepcopy(progress["accepted_c21_lr02c_work_instruction"])
        progress["active_work_instruction"].update({
            "artifact_id": "WI-C-21-LR-02C-20260903-001",
            "path": "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
            "sha256": "C0F78E48718059241C868AB3891FC30095C1D3627D1E133A33178C97BA48212D",
            "invocation_path": "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
            "invocation_sha256": "3A1A5DA6A7751EE3C6253EE06C9BFC89AC9D01855F56E1896F7CD58ACC8501E7",
            "package_status": "ACTIVE_REWORK_R2",
            "result_status": "DIRECT_IMPLEMENTATION",
            "executor": "main-agent-eoul",
            "failure_fingerprint": "C21_LR02C_TEST_SESSION_REBIND_NOT_RESTORED_OR_PRESERVATION_UNRECORDED",
            "valid_failure_count": 1,
            "takeover_packet_path": "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md",
            "takeover_packet_sha256": "4B049CB51B9526BDF490879B6C35C1B146A157769A4A066927A99BB6571B3735",
        })
        event444 = next(event for event in historical["events"]["events"] if event.get("sequence") == 444)
        main_worker = copy.deepcopy(progress["completed_c21_lr02c_main_worker_lease"])
        main_worker["status"] = "ACTIVE"
        main_worker.pop("revoked_at", None)
        main_write = copy.deepcopy(progress["completed_c21_lr02c_main_write_lease"])
        main_write["status"] = "ACTIVE"
        main_write.pop("revoked_at", None)
        main_write["paths"] = copy.deepcopy(event444["details"]["paths"])
        progress["active_agent"] = "main-agent-eoul"
        progress["worker_lease"] = main_worker
        progress["write_lease"] = main_write
        event445 = next(event for event in historical["events"]["events"] if event.get("sequence") == 445)
        progress["repository"].update({
            "validated_base_commit": "dd4cc43452d30511ecf1a152e48408b7122391c0",
            "local_head": "dd4cc43452d30511ecf1a152e48408b7122391c0",
            "feature_remote_head": "dd4cc43452d30511ecf1a152e48408b7122391c0",
            "remote_head": "1573e0242aa718d0f81f6b6fc936c754b7c75e60",
            "branch": "codex/c21-lifecycle-runtime",
            "upstream": "origin/main",
            "feature_remote": "origin/codex/c21-lifecycle-runtime",
            "head_relation": event445["details"]["head_relation"],
            "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02C_MAIN_TAKEOVER_ACTIVE",
            "exact_allowed_paths": event445["details"]["exact_allowed_paths"],
        })
        progress["current_progress_evidence_ref"] = {
            "package_id": "C-21",
            "path": "docs/progress/progress-handoff-detached-digest-c21-lr02c-takeover-r2.json",
            "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json",
        }
        progress["next_successor_work_package"]["status"] = "ACTIVE_REWORK_R2_MAIN_TAKEOVER"
        stored_manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json").read_text(encoding="utf-8")
        )
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_MANIFEST_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(stored_manifest, historical),
        )
        manifest = copy.deepcopy(stored_manifest)
        ledger_path = ROOT / "docs/progress/failure-ledger.json"
        ledger_row = next(row for row in manifest["raw_checksums"] if row["path"] == "docs/progress/failure-ledger.json")
        ledger_row["bytes"] = ledger_path.stat().st_size
        ledger_row["sha256"] = checker.portable_hash(ROOT, "docs/progress/failure-ledger.json")
        self.assertEqual([], checker.validate_c21_lr02c_takeover_r2_projection(manifest, historical))

        stale_developer = copy.deepcopy(historical)
        stale_developer["progress"]["active_agent"] = "developer-primary"
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_PROJECTION_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(manifest, stale_developer),
        )

        missing_restore_failure = copy.deepcopy(historical)
        missing_restore_failure["progress"]["valid_failure_count"] = 0
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_PROJECTION_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(manifest, missing_restore_failure),
        )

        mutated_event = copy.deepcopy(historical)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 445)["details"]["takeover_status"] = "DEVELOPER_ACTIVE"
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_EVENTS_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(manifest, mutated_event),
        )

    def test_c21_lr02c_rework_r3_binds_sticky_incident_and_continuous_epoch2(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        historical = copy.deepcopy(bundle)
        progress = historical["progress"]
        _restore_pre_wsl_approval_state(progress)
        event444 = next(event for event in historical["events"]["events"] if event.get("sequence") == 444)
        event447 = next(event for event in historical["events"]["events"] if event.get("sequence") == 447)
        worker = copy.deepcopy(progress["completed_c21_lr02c_main_worker_lease"])
        worker["status"] = "ACTIVE"
        worker.pop("revoked_at", None)
        worker["worker_id"] = "main-agent-eoul"
        worker["takeover_mode"] = "DIRECT_IMPLEMENTATION"
        write = copy.deepcopy(progress["completed_c21_lr02c_main_write_lease"])
        write["status"] = "ACTIVE"
        write.pop("revoked_at", None)
        write["worker_id"] = "main-agent-eoul"
        write["takeover_mode"] = "DIRECT_IMPLEMENTATION"
        write["paths"] = copy.deepcopy(event444["details"]["paths"])
        instruction = copy.deepcopy(progress["accepted_c21_lr02c_work_instruction"])
        instruction.update({
            "result_status": "DIRECT_IMPLEMENTATION", "package_status": "ACTIVE_REWORK_R3",
            "failure_fingerprint": "C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN",
            "valid_failure_count": 2, "internal_identical_error_count": 3, "takeover_status": "MAIN_TAKEOVER",
            "takeover_packet_path": "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md",
            "takeover_packet_sha256": "4B049CB51B9526BDF490879B6C35C1B146A157769A4A066927A99BB6571B3735",
        })
        progress.update({
            "event_sequence": 447, "last_event_id": "evt_c21_lr02c_main_takeover_resumed_r3",
            "active_agent": "main-agent-eoul", "active_work_instruction": instruction,
            "worker_lease": worker, "write_lease": write, "valid_failure_count": 2,
            "active_failure_lineage": {"step_lineage_id":"C-21/LR-02C","failure_fingerprint":"C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN","valid_failure_count":2,"internal_identical_error_count":3,"internal_error_fingerprint":"WINDOWS_BACKUP_RECEIPT_MODE_HARNESS_MISMATCH","takeover_status":"MAIN_TAKEOVER"},
            "current_progress_evidence_ref": {"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-rework-start-r3.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json"},
        })
        progress["next_successor_work_package"]["status"] = "ACTIVE_REWORK_R3_MAIN_TAKEOVER"
        progress["repository"].update({
            "validated_base_commit":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "local_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "feature_remote_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "remote_head":"1573e0242aa718d0f81f6b6fc936c754b7c75e60",
            "branch":"codex/c21-lifecycle-runtime","upstream":"origin/main",
            "feature_remote":"origin/codex/c21-lifecycle-runtime",
            "head_relation":event447["details"]["head_relation"],
            "push_status":event447["details"]["push_status"],
            "exact_allowed_paths":event447["details"]["exact_allowed_paths"],
        })
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json").read_text(encoding="utf-8")
        )
        ledger_path = ROOT / "docs/progress/failure-ledger.json"
        ledger_row = next(row for row in manifest["raw_checksums"] if row["path"] == "docs/progress/failure-ledger.json")
        ledger_row["bytes"] = ledger_path.stat().st_size
        ledger_row["sha256"] = checker.portable_hash(ROOT, "docs/progress/failure-ledger.json")
        self.assertEqual([], checker.validate_c21_lr02c_rework_r3_projection(manifest, historical))

        downgraded = copy.deepcopy(historical)
        downgraded["progress"]["valid_failure_count"] = 1
        self.assertIn(
            "C21_LR02C_REWORK_R3_PROJECTION_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, downgraded),
        )

        token_changed = copy.deepcopy(historical)
        token_changed["progress"]["worker_lease"]["execution_fencing_token"] = "changed"
        self.assertIn(
            "C21_LR02C_REWORK_R3_LEASE_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, token_changed),
        )

        lease_event = copy.deepcopy(historical)
        next(event for event in lease_event["events"]["events"] if event.get("sequence") == 447)["event_type"] = "WORKER_LEASE_ISSUED"
        self.assertIn(
            "C21_LR02C_REWORK_R3_EVENTS_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, lease_event),
        )

        c01_open = copy.deepcopy(historical)
        c01_open["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02C_REWORK_R3_PROJECTION_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, c01_open),
        )

        corrupted_manifest = copy.deepcopy(manifest)
        corrupted_manifest["valid_failure_count"] = 1
        self.assertIn(
            "C21_LR02C_REWORK_R3_MANIFEST_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(corrupted_manifest, historical),
        )

    def test_c21_lr02c_acceptance_r3_keeps_operations_and_c01_blocked(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json").read_text(encoding="utf-8"))
        accepted = copy.deepcopy(bundle)
        progress = accepted["progress"]
        _restore_pre_wsl_approval_state(progress)
        event453 = next(event for event in accepted["events"]["events"] if event.get("sequence") == 453)
        progress.update({
            "event_sequence":453,
            "last_event_id":"evt_c21_lr02c_r3_acceptance_exact34_repository_reconciled",
            "active_agent":None,"active_work_instruction":None,"worker_lease":None,"write_lease":None,
            "active_failure_lineage":None,"valid_failure_count":0,
            "current_progress_evidence_ref":{"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-accepted-r3.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json"},
        })
        progress["next_successor_work_package"].update({"package_id":"C-21/LR-02C","status":"BLOCKED_PENDING_ACCEPTANCE_CHECKPOINT_COMMIT_PUSH"})
        progress["repository"].update({
            "validated_base_commit":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "local_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "feature_remote_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "remote_head":"1573e0242aa718d0f81f6b6fc936c754b7c75e60",
            "branch":"codex/c21-lifecycle-runtime","upstream":"origin/main",
            "feature_remote":"origin/codex/c21-lifecycle-runtime",
            "head_relation":event453["details"]["head_relation"],
            "push_status":event453["details"]["push_status"],
            "exact_allowed_paths":event453["details"]["exact_allowed_paths"],
        })
        self.assertEqual([], checker.validate_c21_lr02c_acceptance_r3_projection(manifest, accepted))
        opened = copy.deepcopy(accepted)
        opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn("C21_LR02C_ACCEPTANCE_R3_PROJECTION_INVALID", checker.validate_c21_lr02c_acceptance_r3_projection(manifest, opened))
        active_lease = copy.deepcopy(accepted)
        active_lease["progress"]["worker_lease"] = {"status":"ACTIVE"}
        self.assertIn("C21_LR02C_ACCEPTANCE_R3_PROJECTION_INVALID", checker.validate_c21_lr02c_acceptance_r3_projection(manifest, active_lease))

    def test_c21_lr02c_operational_start_binds_release_fencing_and_c01_boundary(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json").read_text(encoding="utf-8")
        )
        started = copy.deepcopy(bundle)
        progress = started["progress"]
        _restore_pre_wsl_approval_state(progress)
        event454 = next(event for event in started["events"]["events"] if event.get("sequence") == 454)
        progress.update({
            "event_sequence":457,
            "last_event_id":"evt_c21_lr02c_ops_package_started",
            "active_agent":"main-agent-eoul",
            "valid_failure_count":0,
            "current_progress_evidence_ref":{"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json"},
        })
        progress["active_work_instruction"] = {
            "artifact_id":"WI-C-21-LR-02C-OPS-20260903-001","path":"docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md",
            "invocation_path":"docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md","release_commit":"f39471a103d35406c3744fd727119072994a0d6a",
            "result_status":"IN_PROGRESS","package_status":"ACTIVE_OPERATIONAL_VALIDATION","executor":"main-agent-eoul","external_side_effects":"NOT_EXECUTED",
        }
        progress["worker_lease"] = {
            "lease_id":"worker-lease-c21-lr02c-ops-20260903-003","agent_id":"main-agent-eoul","lease_epoch":3,
            "execution_fencing_token":"c21-lr02c-ops-execution-fence-epoch-3-f39471a","execution_mode":"OPERATIONAL_VALIDATION","status":"ACTIVE",
        }
        progress["write_lease"] = {
            "lease_id":"write-lease-c21-lr02c-ops-20260903-003","worker_lease_id":"worker-lease-c21-lr02c-ops-20260903-003","write_epoch":3,
            "execution_fencing_token":"c21-lr02c-ops-execution-fence-epoch-3-f39471a","write_fencing_token":"c21-lr02c-ops-write-fence-epoch-3-f39471a","status":"ACTIVE",
            "paths":["docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md","docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md","docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_EXECUTION_MANIFEST.json","docs/evidence/receipts/C-21_LR02C_OPERATIONAL_EXECUTION_RECEIPT.json"],
        }
        progress["repository"].update({
            "validated_base_commit":"f39471a103d35406c3744fd727119072994a0d6a","local_head":"f39471a103d35406c3744fd727119072994a0d6a",
            "remote_head":"f39471a103d35406c3744fd727119072994a0d6a","feature_remote_head":"f39471a103d35406c3744fd727119072994a0d6a",
            "branch":"codex/c21-operational-execution","upstream":"origin/codex/c21-operational-execution",
            "head_relation":"FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_OPERATIONAL_EXACT14_WORKTREE","push_status":"FEATURE_CHECKPOINT_SYNCED_LR02C_OPERATIONAL_READY",
            "exact_allowed_paths":event454["details"]["exact_allowed_paths"],
        })
        progress["next_successor_work_package"].update({"package_id":"C-21/LR-02C/OPS","status":"ACTIVE_OPERATIONAL_VALIDATION"})
        self.assertEqual(
            {"C21_LR02C_OPERATIONAL_START_MANIFEST_INVALID", "C21_LR02C_OPERATIONAL_RELEASE_MANIFEST_INVALID"},
            set(checker.validate_c21_lr02c_operational_start_projection(manifest, started)),
        )
        frozen_release = next(row for row in manifest["raw_checksums"] if row["path"] == "deploy/ysna/ReleaseManifest.json")
        self.assertEqual(3785, frozen_release["bytes"])
        self.assertEqual("715585BCB0F7F0679380186DE83B4C3C26A88ED5B0A5245F59BAD279F061F585", frozen_release["sha256"])

        opened = copy.deepcopy(started)
        opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02C_OPERATIONAL_START_PROJECTION_INVALID",
            checker.validate_c21_lr02c_operational_start_projection(manifest, opened),
        )

        widened = copy.deepcopy(started)
        widened["progress"]["write_lease"]["paths"].append("deploy/ysna/verify.sh")
        self.assertIn(
            "C21_LR02C_OPERATIONAL_START_FENCING_INVALID",
            checker.validate_c21_lr02c_operational_start_projection(manifest, widened),
        )

        release_changed = copy.deepcopy(started)
        release_changed["progress"]["active_work_instruction"]["release_commit"] = "0" * 40
        self.assertIn(
            "C21_LR02C_OPERATIONAL_START_INSTRUCTION_INVALID",
            checker.validate_c21_lr02c_operational_start_projection(manifest, release_changed),
        )

        required = [
            "deploy/ysna/ReleaseManifest.json",
            "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md",
            "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json",
            "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md",
            "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = started["progress"]["repository"]
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=required,
                working_tree_mode=True,
                progress=started["progress"],
            ),
        )

    def test_c21_backup_portability_rework_start_binds_exact2_and_c01_boundary(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json").read_text(encoding="utf-8")
        )
        started = copy.deepcopy(bundle)
        progress = started["progress"]
        _restore_pre_wsl_approval_state(progress)
        event464 = next(event for event in started["events"]["events"] if event.get("sequence") == 464)
        progress.update({
            "event_sequence": 464,
            "last_event_id": "evt_c21_lr02c_backup_portability_exact21_repository_reconciled",
            "active_agent": "developer-primary-c21-backup",
            "valid_failure_count": 1,
            "active_failure_lineage": {"step_lineage_id":"C-21/LR-02C/BACKUP-PORTABILITY","failure_fingerprint":"C21_BACKUP_HOST_PG_DUMP_UNAVAILABLE","valid_failure_count":1},
            "current_progress_evidence_ref": {"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-rework-start-r1.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json"},
        })
        progress["active_work_instruction"] = copy.deepcopy(progress["accepted_c21_backup_portability_work_instruction"])
        progress["active_work_instruction"].update({"result_status":"REWORK_IN_PROGRESS","package_status":"ACTIVE_BACKUP_PORTABILITY_REWORK"})
        progress["worker_lease"] = copy.deepcopy(progress["completed_c21_backup_portability_worker_lease"])
        progress["worker_lease"]["status"] = "ACTIVE"
        progress["worker_lease"].pop("revoked_at", None)
        progress["write_lease"] = copy.deepcopy(progress["completed_c21_backup_portability_write_lease"])
        progress["write_lease"]["status"] = "ACTIVE"
        progress["write_lease"].pop("revoked_at", None)
        progress["repository"].update(event464["details"])
        progress["repository"]["exact_allowed_paths"] = event464["details"]["exact_allowed_paths"]
        progress["next_successor_work_package"].update({"package_id":"C-21/LR-02C/BACKUP-PORTABILITY","status":"ACTIVE_BACKUP_PORTABILITY_REWORK"})
        self.assertEqual([], checker.validate_c21_backup_portability_rework_start_projection(manifest, started))
        exact_paths = started["progress"]["repository"]["exact_allowed_paths"]
        self.assertEqual(21, len(exact_paths))
        self.assertEqual(sorted(set(exact_paths)), exact_paths)
        event_tampered = copy.deepcopy(started)
        event_tampered["events"]["events"][-1]["details"]["exact_allowed_paths"] = exact_paths[:-1]
        self.assertIn(
            "EVENT_EFFECT_MISMATCH",
            checker.validate_event_stream(
                event_tampered["events"],
                event_tampered["event_contract"],
                event_tampered["progress"],
            ),
        )
        widened = copy.deepcopy(started)
        widened["progress"]["write_lease"]["paths"].append("deploy/ysna/compose.production.yml")
        self.assertIn("C21_BACKUP_PORTABILITY_REWORK_FENCING_INVALID", checker.validate_c21_backup_portability_rework_start_projection(manifest, widened))
        unblocked = copy.deepcopy(started)
        unblocked["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn("C21_BACKUP_PORTABILITY_REWORK_PROJECTION_INVALID", checker.validate_c21_backup_portability_rework_start_projection(manifest, unblocked))

    def test_c21_backup_portability_acceptance_binds_exact24_and_release_checkpoint(self) -> None:
        checker = self.require_checker()
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_R1.json").read_text(encoding="utf-8")
        )
        bundle = checker.load_bundle(ROOT)
        self.assertEqual([], checker.validate_c21_backup_portability_acceptance_projection(manifest, bundle))
        self.assertGreaterEqual(bundle["progress"]["event_sequence"], 483)
        self.assertEqual(469, manifest["event_sequence"])
        arbitrary_later = copy.deepcopy(bundle)
        arbitrary_later["progress"]["event_sequence"] = 484
        self.assertIn("C21_BACKUP_PORTABILITY_ACCEPTANCE_PROJECTION_INVALID", checker.validate_c21_backup_portability_acceptance_projection(manifest, arbitrary_later))
        release_mutated = copy.deepcopy(bundle)
        release_mutated["progress"]["accepted_c21_backup_portability_work_instruction"]["release_commit"] = "0" * 40
        self.assertIn("C21_BACKUP_PORTABILITY_ACCEPTED_WORK_OR_LEASE_INVALID", checker.validate_c21_backup_portability_acceptance_projection(manifest, release_mutated))

    def test_c21_operational_r2_rework_preserves_seq469_and_binds_epoch5(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual([], checker.validate_c21_lr02c_operational_rework_r2_projection(manifest, bundle))
        events = bundle["events"]["events"]
        frozen = checker.canonical_json_bytes(events[:469])
        self.assertEqual(
            "85EC925F60701C3127C8CE166BBAE59980704925FBD16DBFF875BE3552AC7CEB",
            hashlib.sha256(frozen).hexdigest().upper(),
        )
        self.assertEqual(
            [
                "FAILURE_REPORT_ACCEPTED",
                "WORKER_LEASE_ISSUED",
                "WRITE_LEASE_ISSUED",
                "PACKAGE_RESUMED",
                "REPOSITORY_RECONCILED",
                "PACKAGE_RESUMED",
            ],
            [event["event_type"] for event in events[469:475]],
        )
        self.assertEqual(5, events[470]["details"]["lease_epoch"])
        self.assertEqual(5, events[471]["details"]["write_epoch"])
        self.assertEqual("USER_VERIFICATION_PENDING", manifest["telegram_and_provider"])
        binding = manifest["non_semantic_revision_binding"]
        self.assertEqual("MAIN_RECONFIRMED_NON_SEMANTIC", events[474]["details"]["change_classification"])
        self.assertEqual("APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001", binding["root_human_approval_id"])
        self.assertEqual("NONE", binding["semantic_diff"])
        self.assertFalse(binding["scope_expansion"])
        self.assertEqual("E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491", binding["work_instruction_new_hash"])
        self.assertEqual("8207996858DE33B542862B4D5C6AEBC1787BC4A0612E1C0052CAC3B637263FC5", binding["invocation_new_hash"])
        rebound = events[474]["details"]
        self.assertEqual(binding["binding_id"], rebound["binding_id"])
        self.assertEqual(13, rebound["exact_allowed_path_count"])
        stale = copy.deepcopy(manifest)
        stale["non_semantic_revision_binding"]["work_instruction_new_hash"] = "0" * 64
        self.assertIn(
            "C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID",
            checker.validate_c21_lr02c_operational_rework_r2_projection(stale, bundle),
        )
        widened = copy.deepcopy(manifest)
        widened["non_semantic_revision_binding"]["scope_expansion"] = True
        self.assertIn(
            "C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID",
            checker.validate_c21_lr02c_operational_rework_r2_projection(widened, bundle),
        )
        current_bundle = checker.load_bundle(ROOT)
        current_manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_lr02c_ops_r2_release_rebind_projection(current_manifest, current_bundle))
        self.assertEqual(["RELEASE_MANIFEST_CREATED", "REPOSITORY_RECONCILED"], [event["event_type"] for event in current_bundle["events"]["events"][475:477]])
        self.assertEqual(475, current_manifest["predecessor_r2_binding"]["event_sequence"])
        predecessor_tampered = copy.deepcopy(current_manifest)
        predecessor_tampered["predecessor_r2_binding"]["event_sequence"] = 474
        self.assertIn(
            "C21_OPS_R2_RELEASE_REBIND_PREDECESSOR_INVALID",
            checker.validate_c21_lr02c_ops_r2_release_rebind_projection(predecessor_tampered, current_bundle),
        )

    def test_c21_ops_r2_post_merge_main_reconciliation_rejects_arbitrary_branch(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_MAIN_RECONCILIATION_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        # Break the historical projection's self-routing compatibility path so
        # this test exercises the original seq478 negative guards directly.
        bundle["progress"]["current_progress_evidence_ref"] = {}
        arbitrary_branch = copy.deepcopy(bundle)
        arbitrary_branch["progress"]["repository"]["branch"] = "codex/arbitrary"
        self.assertIn(
            "C21_OPS_R2_MAIN_RECONCILIATION_REPOSITORY_INVALID",
            checker.validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, arbitrary_branch),
        )
        arbitrary_sequence = copy.deepcopy(bundle)
        arbitrary_sequence["progress"]["event_sequence"] = 479
        self.assertIn(
            "C21_OPS_R2_MAIN_RECONCILIATION_PROJECTION_INVALID",
            checker.validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, arbitrary_sequence),
        )
        arbitrary_path = copy.deepcopy(bundle)
        arbitrary_path["progress"]["repository"]["exact_allowed_paths"].append("deploy/ysna/compose.production.yml")
        self.assertIn(
            "C21_OPS_R2_MAIN_RECONCILIATION_REPOSITORY_INVALID",
            checker.validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, arbitrary_path),
        )

    def test_c21_wsl_readiness_requires_explicit_scope_order_and_risk_approval(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )

        if bundle["progress"]["event_sequence"] > 483:
            self.assertEqual(
                "163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2",
                hashlib.sha256(
                    checker.canonical_json_bytes(bundle["events"]["events"][:483])
                ).hexdigest().upper(),
            )
            return

        self.assertEqual([], checker.validate_c21_wsl_readiness_decision_projection(manifest, bundle))

        approved_without_human = copy.deepcopy(bundle)
        approved_without_human["progress"]["wsl_readiness_decision"]["decision_status"] = "APPROVED"
        self.assertIn(
            "C21_WSL_READINESS_APPROVAL_BOUNDARY_INVALID",
            checker.validate_c21_wsl_readiness_decision_projection(manifest, approved_without_human),
        )

        expanded_scope = copy.deepcopy(bundle)
        expanded_scope["progress"]["wsl_readiness_decision"]["excluded_actions"] = []
        self.assertIn(
            "C21_WSL_READINESS_APPROVAL_BOUNDARY_INVALID",
            checker.validate_c21_wsl_readiness_decision_projection(manifest, expanded_scope),
        )

        arbitrary_path = copy.deepcopy(bundle)
        arbitrary_path["progress"]["repository"]["exact_allowed_paths"].append(
            "deploy/wsl/compose.yml"
        )
        self.assertIn(
            "C21_WSL_READINESS_REPOSITORY_INVALID",
            checker.validate_c21_wsl_readiness_decision_projection(manifest, arbitrary_path),
        )

        repository = bundle["progress"]["repository"]
        successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", successor_errors)
        pushed_successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head="9" * 40,
            actual_feature_remote_head="9" * 40,
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", pushed_successor_errors)
        arbitrary_pushed_successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head="9" * 40,
            actual_feature_remote_head="9" * 40,
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=False,
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH", arbitrary_pushed_successor_errors
        )
        arbitrary_successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=False,
        )
        self.assertIn("GIT_DESCENDANT_ORIGIN_MISMATCH", arbitrary_successor_errors)

    def test_c21_wsl_active_projection_is_fail_closed_for_candidate_and_repository(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        historical_commit = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
        bundle["progress"] = json.loads(
            subprocess.check_output(
                ["git", "show", f"{historical_commit}:docs/progress/build-progress.json"],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        bundle["events"] = json.loads(
            subprocess.check_output(
                ["git", "show", f"{historical_commit}:docs/progress/progress-events.json"],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        candidate = json.loads(
            subprocess.check_output(
                ["git", "show", f"{historical_commit}:deploy/wsl/CandidateReleaseManifest.json"],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        self.assertEqual([], checker.validate_c21_wsl_active_projection(candidate, bundle))

        arbitrary_candidate = copy.deepcopy(candidate)
        arbitrary_candidate["status"] = "APPROVED_FOR_STAGING_VALIDATION"
        self.assertIn(
            "C21_WSL_ACTIVE_CANDIDATE_INVALID",
            checker.validate_c21_wsl_active_projection(arbitrary_candidate, bundle),
        )
        arbitrary_paths = copy.deepcopy(bundle)
        arbitrary_paths["progress"]["repository"]["exact_allowed_paths"].append("arbitrary.txt")
        self.assertIn(
            "C21_WSL_ACTIVE_REPOSITORY_INVALID",
            checker.validate_c21_wsl_active_projection(candidate, arbitrary_paths),
        )
        repository = bundle["progress"]["repository"]
        precommit = checker.validate_repository_projection(
            repository,
            actual_head=repository["local_head"],
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", precommit)
        local_ahead = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", local_ahead)
        unrelated = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=False,
        )
        self.assertIn("GIT_DESCENDANT_ORIGIN_MISMATCH", unrelated)

    def test_c21_wsl_control_successor_binds_immutable_candidate_and_historical_prefix(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        candidate = json.loads(
            (ROOT / "deploy/wsl/CandidateReleaseManifest.json").read_text(encoding="utf-8")
        )
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        if bundle["progress"]["event_sequence"] == 486:
            self.assertEqual(
                [],
                checker.validate_c21_wsl_control_successor_projection(
                    candidate, bundle, manifest
                ),
            )
        else:
            self.assertEqual(486, manifest["event_sequence"])
            self.assertEqual("PENDING_CONTROL_SUCCESSOR_COMMIT", manifest["control_commit"])

        wrong_candidate = copy.deepcopy(candidate)
        wrong_candidate["source"]["commit"] = "9" * 40
        self.assertIn(
            "C21_WSL_CONTROL_CANDIDATE_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                wrong_candidate, bundle, manifest
            ),
        )
        wrong_binding = copy.deepcopy(candidate)
        wrong_binding["authority"]["approval_binding_sha256"] = "a" * 64
        self.assertIn(
            "C21_WSL_CONTROL_CANDIDATE_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                wrong_binding, bundle, manifest
            ),
        )
        historical_mutation = copy.deepcopy(bundle)
        historical_mutation["events"]["events"][0]["event_id"] = "tampered"
        self.assertIn(
            "C21_WSL_CONTROL_EVENTS_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                candidate, historical_mutation, manifest
            ),
        )
        path_mutation = copy.deepcopy(bundle)
        path_mutation["progress"]["repository"]["exact_allowed_paths"].append(
            "arbitrary.txt"
        )
        self.assertIn(
            "C21_WSL_CONTROL_REPOSITORY_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                candidate, path_mutation, manifest
            ),
        )

    def test_c21_wsl_approval_artifact_and_raw_historical_bytes_are_independently_bound(self) -> None:
        checker = self.require_checker()
        approval_path = (
            ROOT
            / "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
        )
        approval = approval_path.read_text(encoding="utf-8")
        self.assertEqual([], checker.validate_c21_wsl_human_approval_artifact(approval))
        self.assertIn(
            "C21_WSL_HUMAN_APPROVAL_INVALID",
            checker.validate_c21_wsl_human_approval_artifact(
                approval.replace("exact34", "exact35", 1)
            ),
        )

        candidate_raw = subprocess.check_output(
            [
                "git",
                "show",
                "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad:docs/progress/progress-events.json",
            ],
            cwd=ROOT,
        )
        current_raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
        expected = checker.raw_event_object_prefix_bytes(candidate_raw, 485)
        actual = checker.raw_event_object_prefix_bytes(current_raw, 485)
        self.assertEqual(expected, actual)
        self.assertEqual(
            "39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA",
            hashlib.sha256(actual).hexdigest().upper(),
        )
        mutated = bytearray(actual)
        whitespace = mutated.index(b" ")
        mutated[whitespace] = ord("\t")
        self.assertNotEqual(
            hashlib.sha256(expected).digest(), hashlib.sha256(mutated).digest()
        )
        first_event = checker.raw_event_object_prefix_bytes(current_raw, 1)
        original_order = (
            b'"event_id": "evt_g05_legacy_migration",\n'
            b'      "sequence": 1,'
        )
        reordered = (
            b'"sequence": 1,\n'
            b'      "event_id": "evt_g05_legacy_migration",'
        )
        key_order_mutation = first_event.replace(original_order, reordered, 1)
        self.assertNotEqual(first_event, key_order_mutation)
        self.assertEqual(
            json.loads(first_event.decode("utf-8")),
            json.loads(key_order_mutation.decode("utf-8")),
        )
        self.assertNotEqual(
            hashlib.sha256(first_event).digest(),
            hashlib.sha256(key_order_mutation).digest(),
        )

    def test_c21_wsl_control_postcommit_successor_binds_committed_control(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        if bundle["progress"]["event_sequence"] != 487:
            historical_commit = "ead1214e3f01e68e577c3163e1cf143ee5753490"
            bundle["progress"] = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{historical_commit}:docs/progress/build-progress.json",
                    ],
                    cwd=ROOT,
                    text=True,
                    encoding="utf-8",
                )
            )
            bundle["events"] = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{historical_commit}:docs/progress/progress-events.json",
                    ],
                    cwd=ROOT,
                    text=True,
                    encoding="utf-8",
                )
            )
        predecessor_manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(486, predecessor_manifest["event_sequence"])
        self.assertEqual("PENDING_CONTROL_SUCCESSOR_COMMIT", predecessor_manifest["control_commit"])
        self.assertEqual(
            [],
            checker.validate_c21_wsl_control_postcommit_projection(bundle, manifest),
        )
        repository = bundle["progress"]["repository"]
        # This is a historical seq487 contract test.  Simulate its clean
        # exact-path successor rather than mixing the current seq488 HEAD and
        # its additional runtime commit paths into the historical projection.
        actual_head = "f" * 40
        changed_paths = repository["exact_allowed_paths"]
        control_paths = repository["postcommit_successor_paths"]
        projection_args = {
            "actual_head": actual_head,
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": changed_paths,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_descendant_paths": control_paths,
            "control_is_ancestor": True,
            "worktree_is_clean": True,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **projection_args))
        wrong_branch = dict(projection_args, actual_branch="codex/arbitrary")
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_branch),
        )
        wrong_paths = dict(
            projection_args,
            actual_changed_paths=changed_paths + ["arbitrary.txt"],
            control_descendant_paths=control_paths + ["arbitrary.txt"],
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_paths),
        )
        dirty = dict(projection_args, worktree_is_clean=False)
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dirty),
        )
        nonancestor = dict(projection_args, control_is_ancestor=False)
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **nonancestor),
        )

        wrong_control = copy.deepcopy(manifest)
        wrong_control["control_commit"] = "9" * 40
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(
                bundle, wrong_control
            ),
        )
        wrong_paths = copy.deepcopy(manifest)
        wrong_paths["control_commit_paths"] = wrong_paths["control_commit_paths"][:-1]
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(bundle, wrong_paths),
        )
        wrong_approval = copy.deepcopy(manifest)
        wrong_approval["approval_artifact_sha256"] = "a" * 64
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(
                bundle, wrong_approval
            ),
        )
        wrong_raw = copy.deepcopy(manifest)
        wrong_raw["historical_raw_events_sha256"] = "b" * 64
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(bundle, wrong_raw),
        )
        wrong_digest_bundle = copy.deepcopy(bundle)
        wrong_digest_bundle["detached_digest"]["progress"]["file_sha256"] = "a" * 64
        self.assertIn(
            "DETACHED_DIGEST_MISMATCH",
            checker.validate_detached_progress_binding(wrong_digest_bundle),
        )

    def test_c21_wsl_control_runtime_successor_binds_reviewed_runtime_and_prefix(self) -> None:
        checker = self.require_checker()
        snapshot_temp = tempfile.TemporaryDirectory()
        self.addCleanup(snapshot_temp.cleanup)
        snapshot_root = Path(snapshot_temp.name) / "seq488"
        subprocess.run(
            [
                "git",
                "-c",
                "core.autocrlf=false",
                "-c",
                "core.eol=lf",
                "clone",
                "--quiet",
                "--no-checkout",
                "--no-hardlinks",
                str(ROOT),
                str(snapshot_root),
            ],
            check=True,
        )
        subprocess.run(
            [
                "git",
                "checkout",
                "--quiet",
                "326476d69a3228f9dfcf64ff1dd056577bcbcf55",
            ],
            cwd=snapshot_root,
            check=True,
        )
        bundle = checker.load_bundle(snapshot_root)
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json"
        )
        self.assertTrue(
            manifest_path.is_file(),
            "seq488 control-runtime successor manifest is missing",
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, manifest
            ),
        )

        expected_record_paths = {
            "docs/WORK_STATUS.md",
            "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        }
        self.assertEqual(
            expected_record_paths,
            checker.c21_wsl_control_runtime_successor_paths(),
        )
        self.assertEqual(
            "E02DF27FAA2FA40D28E7FFA6F263D914DCA530F97A0BBF133C0E645F6694F00B",
            hashlib.sha256(
                json.dumps(
                    sorted(expected_record_paths),
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest().upper(),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 487)
        self.assertEqual(786441, len(prefix))
        self.assertEqual(
            "A230B994745047786883CEF8F94279EAE239DB359F3A923717961F8552008C17",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "E2752DBA9CEE5989D7AF890C83A0AD82886A610965CAAEC060EE4079A076295C",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:487])
            ).hexdigest().upper(),
        )

        wrong_runtime = copy.deepcopy(manifest)
        wrong_runtime["runtime_commit"] = "9" * 40
        self.assertIn(
            "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, wrong_runtime
            ),
        )
        wrong_prefix = copy.deepcopy(manifest)
        wrong_prefix["historical_raw_events_sha256"] = "a" * 64
        self.assertIn(
            "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, wrong_prefix
            ),
        )
        for field in (
            "push",
            "deployment",
            "database",
            "volume_cleanup",
            "telegram",
            "provider",
        ):
            with self.subTest(manifest_external_boundary=field):
                wrong_external_boundary = copy.deepcopy(manifest)
                wrong_external_boundary[field] = "EXECUTED"
                self.assertIn(
                    "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
                    checker.validate_c21_wsl_control_runtime_successor_projection(
                        bundle, wrong_external_boundary
                    ),
                )
        wrong_c01_boundary = copy.deepcopy(manifest)
        wrong_c01_boundary["c01_status"] = "READY"
        self.assertIn(
            "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, wrong_c01_boundary
            ),
        )

    def test_c21_wsl_control_runtime_successor_git_projection_is_stable(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        runtime = "ead1214e3f01e68e577c3163e1cf143ee5753490"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact42 = subprocess.check_output(
            ["git", "diff", "--name-only", base, runtime],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
        ).splitlines()
        self.assertEqual(42, len(exact42))
        self.assertEqual(
            "11F56564BC0460157FDD9E99BA00FFF7EA0B5EAC0FA5E6C24BC980BBDA08AA99",
            hashlib.sha256(
                json.dumps(
                    sorted(exact42), ensure_ascii=False, separators=(",", ":")
                ).encode("utf-8")
            ).hexdigest().upper(),
        )
        record_paths = [
            "docs/WORK_STATUS.md",
            "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = copy.deepcopy(bundle["progress"]["repository"])
        repository.update(
            {
                "validated_base_commit": base,
                "head_relation": "FEATURE_WORKTREE_C21_WSL_CONTROL_RUNTIME_SUCCESSOR_ACTIVE_EXACT42",
                "branch": "codex/c21-operational-execution",
                "upstream": "origin/codex/c21-operational-execution",
                "remote_head": remote,
                "feature_remote": "origin/codex/c21-operational-execution",
                "feature_remote_head": remote,
                "local_head": runtime,
                "exact_allowed_paths": exact42,
            }
        )
        progress = {
            "event_sequence": 488,
            "last_event_id": "evt_c21_wsl_control_runtime_successor_bound",
            "wsl_early_validation": {
                "status": "ACTIVE_CONTROL_RUNTIME_SUCCESSOR_PENDING_PUSH"
            },
        }
        common = {
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": progress,
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(
            common,
            actual_head=runtime,
            actual_changed_paths=exact42,
            control_descendant_paths=record_paths,
            worktree_is_clean=False,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **precommit)
        )

        exact44 = sorted(
            set(exact42)
            | {
                "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
                "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
            }
        )
        postcommit = dict(
            common,
            actual_head="f" * 40,
            actual_changed_paths=exact44,
            control_descendant_paths=record_paths,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **postcommit)
        )

        for bad_paths in (
            record_paths[:-1],
            record_paths + ["arbitrary.txt"],
            record_paths + ["deploy/wsl/cleanup.sh"],
        ):
            invalid_precommit = dict(precommit, control_descendant_paths=bad_paths)
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(
                    repository, **invalid_precommit
                ),
            )
            invalid_paths = dict(postcommit, control_descendant_paths=bad_paths)
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **invalid_paths),
            )
        wrong_branch = dict(postcommit, actual_branch="codex/arbitrary")
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_branch),
        )
        wrong_upstream = dict(postcommit, actual_upstream="origin/arbitrary")
        self.assertIn(
            "GIT_UPSTREAM_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_upstream),
        )
        wrong_remote = dict(postcommit, actual_remote_head="0" * 40)
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_remote),
        )
        nonancestor = dict(
            postcommit,
            projected_local_head_is_ancestor=False,
            control_is_ancestor=False,
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **nonancestor),
        )
        dirty_descendant = dict(postcommit, worktree_is_clean=False)
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dirty_descendant),
        )

    def test_c21_wsl_control_runtime_postcommit_real_git_requires_one_direct_exact44_record_commit(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        bundle["progress"] = json.loads(
            subprocess.check_output(
                [
                    "git",
                    "show",
                    "326476d69a3228f9dfcf64ff1dd056577bcbcf55:docs/progress/build-progress.json",
                ],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        runtime = "ead1214e3f01e68e577c3163e1cf143ee5753490"
        runtime_parent = "5251a0b889f4e1062a5780eea9f03d8e9b9f69bb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(
            {
                "docs/WORK_STATUS.md",
                "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
                "docs/progress/BUILD_HANDOFF.md",
                "docs/progress/build-progress.json",
                "docs/progress/progress-events.json",
                "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
                "scripts/check_project_progress.py",
                "tests/tooling/test_project_progress.py",
            }
        )

        def git(repo: Path, *args: str, input_text: str | None = None) -> str:
            return subprocess.check_output(
                ["git", *args],
                cwd=repo,
                input=input_text,
                text=True,
                encoding="utf-8",
            ).strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(
                [
                    "git",
                    "-c",
                    "core.autocrlf=false",
                    "-c",
                    "core.eol=lf",
                    "clone",
                    "--quiet",
                    "--no-checkout",
                    "--no-hardlinks",
                    str(ROOT),
                    str(repo),
                ],
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "-B", branch, runtime],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True
            )
            subprocess.run(
                ["git", "config", "user.email", "anvil-test@example.invalid"],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "update-ref", f"refs/remotes/origin/{branch}", remote],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "branch", "--set-upstream-to", f"origin/{branch}", branch],
                cwd=repo,
                check=True,
                stdout=subprocess.DEVNULL,
            )
            for relative in record_paths:
                source = ROOT / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def commit_record(repo: Path, message: str) -> str:
            subprocess.run(
                ["git", "commit", "--quiet", "-m", message], cwd=repo, check=True
            )
            return git(repo, "rev-parse", "HEAD")

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)

            valid_repo = create_fixture(temp_root, "valid")
            valid_head = commit_record(valid_repo, "seq488 exact8 record")
            self.assertEqual(
                44,
                len(
                    git(
                        valid_repo, "diff", "--name-only", base, valid_head
                    ).splitlines()
                ),
            )
            self.assertEqual(
                [runtime],
                git(valid_repo, "show", "-s", "--format=%P", valid_head).split(),
            )
            self.assertEqual([], validate(valid_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(
                    ["git", "show", f"{base}:docs/progress/BUILD_HANDOFF.md"],
                    cwd=reverted_repo,
                )
            )
            subprocess.run(
                ["git", "add", "--", "docs/progress/BUILD_HANDOFF.md"],
                cwd=reverted_repo,
                check=True,
            )
            reverted_head = commit_record(reverted_repo, "seq488 record with reversion")
            self.assertEqual(
                43,
                len(
                    git(
                        reverted_repo, "diff", "--name-only", base, reverted_head
                    ).splitlines()
                ),
            )
            reverted_errors = validate(reverted_repo)

            second_repo = create_fixture(temp_root, "second-descendant")
            first_record_head = commit_record(second_repo, "seq488 exact8 record")
            with (second_repo / "docs/WORK_STATUS.md").open(
                "a", encoding="utf-8", newline="\n"
            ) as stream:
                stream.write("\nsecond descendant mutation\n")
            subprocess.run(
                ["git", "add", "--", "docs/WORK_STATUS.md"],
                cwd=second_repo,
                check=True,
            )
            second_head = commit_record(second_repo, "second exact8 descendant")
            self.assertEqual(
                44,
                len(git(second_repo, "diff", "--name-only", base, second_head).splitlines()),
            )
            self.assertEqual(
                [first_record_head],
                git(second_repo, "show", "-s", "--format=%P", second_head).split(),
            )
            second_descendant_errors = validate(second_repo)

            wrong_parent_repo = create_fixture(temp_root, "wrong-parent")
            record_tree = git(wrong_parent_repo, "write-tree")
            side_tree = git(wrong_parent_repo, "rev-parse", f"{runtime_parent}^{{tree}}")
            side_commit = git(
                wrong_parent_repo,
                "commit-tree",
                side_tree,
                "-p",
                runtime_parent,
                input_text="side parent\n",
            )
            wrong_parent_head = git(
                wrong_parent_repo,
                "commit-tree",
                record_tree,
                "-p",
                runtime,
                "-p",
                side_commit,
                input_text="seq488 wrong-parent merge\n",
            )
            subprocess.run(
                ["git", "update-ref", "HEAD", wrong_parent_head],
                cwd=wrong_parent_repo,
                check=True,
            )
            self.assertEqual(
                44,
                len(
                    git(
                        wrong_parent_repo,
                        "diff",
                        "--name-only",
                        base,
                        wrong_parent_head,
                    ).splitlines()
                ),
            )
            self.assertEqual(
                [runtime, side_commit],
                git(
                    wrong_parent_repo,
                    "show",
                    "-s",
                    "--format=%P",
                    wrong_parent_head,
                ).split(),
            )
            wrong_parent_errors = validate(wrong_parent_repo)

            for scenario, errors in (
                ("base_to_head_exact43_reversion", reverted_errors),
                ("second_descendant_commit", second_descendant_errors),
                ("wrong_parent_merge", wrong_parent_errors),
            ):
                with self.subTest(scenario=scenario):
                    self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", errors)

    def test_c21_wsl_postcommit_git_projection_rejects_every_dirty_variant(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        if bundle["progress"]["event_sequence"] != 487:
            historical_commit = "ead1214e3f01e68e577c3163e1cf143ee5753490"
            bundle["progress"] = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{historical_commit}:docs/progress/build-progress.json",
                    ],
                    cwd=ROOT,
                    text=True,
                    encoding="utf-8",
                )
            )
        repository = bundle["progress"]["repository"]
        actual_head = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        expected_upstream = "ca92b7845eda803cff3c432799642e4f9243d4d6"

        def validate_simulated(
            *,
            status: str = "",
            branch: str = "codex/c21-operational-execution",
            remote: str = expected_upstream,
            ancestor: bool = True,
        ) -> list[str]:
            with tempfile.TemporaryDirectory() as temp:
                simulated_root = Path(temp)
                (simulated_root / ".git").write_text("gitdir: simulated\n", encoding="utf-8")

                def fake_git_value(_root: Path, *args: str) -> str | None:
                    if args == ("rev-parse", "HEAD"):
                        return actual_head
                    if args == ("branch", "--show-current"):
                        return branch
                    if args == ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"):
                        return "origin/codex/c21-operational-execution"
                    if args == ("rev-parse", "@{u}"):
                        return remote
                    if args == ("rev-parse", repository["feature_remote"]):
                        return remote
                    if args[:2] == ("diff", "--name-only"):
                        revision_range = args[2]
                        if revision_range.startswith(repository["local_head"]):
                            return "\n".join(repository["postcommit_successor_paths"])
                        return "\n".join(repository["exact_allowed_paths"])
                    if args[-2:] == ("status", "--porcelain=v1") or "status" in args:
                        return status
                    return None

                simulated = copy.deepcopy(bundle)
                simulated["_root"] = simulated_root
                with mock.patch.object(checker, "_git_value", side_effect=fake_git_value), mock.patch.object(
                    checker, "_git_returncode", return_value=0 if ancestor else 1
                ):
                    return checker._validate_git_projection(simulated)

        self.assertEqual([], validate_simulated())
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status=" M docs/WORK_STATUS.md"),
        )
        current_six = repository["postcommit_successor_paths"][:6]
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status="\n".join(f" M {path}" for path in current_six)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status="?? arbitrary-untracked.txt"),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status=" M arbitrary-tracked.txt"),
        )
        self.assertIn(
            "GIT_BRANCH_MISMATCH",
            validate_simulated(branch="codex/arbitrary"),
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            validate_simulated(remote="f" * 40),
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            validate_simulated(ancestor=False),
        )

    def _historical_bundle(self, checker, commit: str):
        """Load an immutable historical projection without mixing current files."""
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        repo = Path(temp.name) / "historical"
        subprocess.run(
            [
                "git",
                "-c",
                "core.autocrlf=false",
                "-c",
                "core.eol=lf",
                "clone",
                "--quiet",
                "--no-checkout",
                "--no-hardlinks",
                str(ROOT),
                str(repo),
            ],
            check=True,
        )
        subprocess.run(["git", "checkout", "--quiet", "--detach", commit], cwd=repo, check=True)
        return checker.load_bundle(repo), repo

    def _independent_judgment_bundle(self, checker):
        """Load seq498 plus its intentionally untracked tester authority source."""
        bundle, repo = self._historical_bundle(
            checker, "4178ae78db2c48e176e8543364d09787e54bb4ad"
        )
        source = Path(".superpowers/sdd/Anvil_작업계획서_v1/seq496-c21-independent-judgment.md")
        destination = repo / source
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, destination)
        return bundle, repo

    def test_c21_wsl_fresh_clone_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        manifest_path = (
            historical_root
            / "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq489 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_fresh_clone_candidate_rebind_projection(
                bundle, manifest
            ),
        )

        current_raw = (historical_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 488)
        self.assertEqual(792116, len(prefix))
        self.assertEqual(
            "842F518F9F935402BE41BA9E873EDAFE57973D86C87A37AFFD77482F173B7A7D",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "CC651FA094FCD1873450DDB9C6E57F1EDF019A6373712756129ADC86FEA9B6C9",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:488])
            ).hexdigest().upper(),
        )

        exact44 = checker.c21_wsl_fresh_clone_candidate_committed_exact_paths()
        exact11 = checker.c21_wsl_fresh_clone_candidate_rebind_successor_paths()
        exact46 = checker.c21_wsl_fresh_clone_candidate_record_committed_exact_paths()
        self.assertEqual((44, 11, 46), (len(exact44), len(exact11), len(exact46)))
        for paths, expected in (
            (exact44, "A6D1C6AC386639995DA003F6934D9C24ACF81EE860FCCB094AAA731BD8A88E6B"),
            (exact11, "C4DDBACD49E01E710FDC93D83B6247C0BCBFA484C2FBA8317BEF83CF14C3885A"),
            (exact46, "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

        candidate_manifest = json.loads(
            (historical_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        binding = candidate_manifest["authority"]["derived_binding"]
        self.assertEqual(binding, manifest["derived_correction_binding"])
        self.assertEqual(
            candidate_manifest["authority"]["derived_binding_sha256"],
            manifest["derived_correction_binding_sha256"],
        )

    def test_c21_wsl_fresh_clone_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )

        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = (
            "refs/remotes/origin/candidates/c21-wsl-exact34"
        )
        mutations.append(("old_candidate_ref", bundle, old_ref, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("derived_binding_hash", bundle, wrong_binding, "C21_WSL_FRESH_CLONE_REBIND_BINDING_INVALID"))
        subset = copy.deepcopy(manifest)
        subset["path_contracts"]["record_successor"]["path_count"] = 10
        mutations.append(("record_subset", bundle, subset, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external_execution", bundle, external, "C21_WSL_FRESH_CLONE_REBIND_BOUNDARY_INVALID"))
        changed_event = copy.deepcopy(bundle)
        changed_event["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical_event", changed_event, manifest, "C21_WSL_FRESH_CLONE_REBIND_EVENTS_INVALID"))
        changed_current_event = copy.deepcopy(bundle)
        changed_current_event["events"]["events"][-1]["details"]["branch"] = "codex/arbitrary"
        mutations.append(("current_event_branch", changed_current_event, manifest, "C21_WSL_FRESH_CLONE_REBIND_EVENTS_INVALID"))
        wrong_record_paths = copy.deepcopy(manifest)
        wrong_record_paths["record_successor_paths"] = wrong_record_paths[
            "record_successor_paths"
        ][:-1]
        mutations.append(("record_path_list", bundle, wrong_record_paths, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))

        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_fresh_clone_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_fresh_clone_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        repository = bundle["progress"]["repository"]
        candidate = "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact44 = sorted(checker.c21_wsl_fresh_clone_candidate_committed_exact_paths())
        exact11 = sorted(checker.c21_wsl_fresh_clone_candidate_rebind_successor_paths())
        exact46 = sorted(checker.c21_wsl_fresh_clone_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(
            common,
            actual_head=candidate,
            actual_changed_paths=exact44,
            control_descendant_paths=exact11,
            worktree_is_clean=False,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **precommit)
        )
        postcommit = dict(
            common,
            actual_head="f" * 40,
            actual_changed_paths=exact46,
            control_descendant_paths=exact11,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **postcommit)
        )
        for bad_paths in (
            exact11[:-1],
            exact11 + ["arbitrary.txt"],
            exact11 + ["deploy/wsl/deploy.sh"],
        ):
            with self.subTest(bad_paths=bad_paths):
                self.assertIn(
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                    checker.validate_repository_projection(
                        repository,
                        **dict(precommit, control_descendant_paths=bad_paths),
                    ),
                )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(
                repository,
                **dict(postcommit, control_runtime_record_commit_is_direct=False),
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(
                repository, **dict(postcommit, worktree_is_clean=False)
            ),
        )

    def test_c21_wsl_fresh_clone_candidate_rebind_real_git_requires_direct_exact11_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        candidate = "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(
            checker.c21_wsl_fresh_clone_candidate_rebind_successor_paths()
        )

        def git(repo: Path, *args: str, input_text: str | None = None) -> str:
            return subprocess.check_output(
                ["git", *args],
                cwd=repo,
                input=input_text,
                text=True,
                encoding="utf-8",
            ).strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(
                [
                    "git",
                    "-c",
                    "core.autocrlf=false",
                    "-c",
                    "core.eol=lf",
                    "clone",
                    "--quiet",
                    "--no-checkout",
                    "--no-hardlinks",
                    str(ROOT),
                    str(repo),
                ],
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "-B", branch, candidate],
                cwd=repo,
                check=True,
            )
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(
                ["git", "config", "user.email", "anvil-test@example.invalid"],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "update-ref", f"refs/remotes/origin/{branch}", remote],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "branch", "--set-upstream-to", f"origin/{branch}", branch],
                cwd=repo,
                check=True,
                stdout=subprocess.DEVNULL,
            )
            for relative in record_paths:
                source = ROOT / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "seq489 exact11 record"],
                cwd=valid_repo,
                check=True,
            )
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(46, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq489 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "seq489 record"],
                cwd=merge_repo,
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "-b", "side", candidate],
                cwd=merge_repo,
                check=True,
            )
            subprocess.run(
                ["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"],
                cwd=merge_repo,
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True
            )
            subprocess.run(
                ["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"],
                cwd=merge_repo,
                check=True,
            )
            self.assertEqual(
                2,
                len(git(merge_repo, "show", "-s", "--format=%P", "HEAD").split()),
            )
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(
                    ["git", "show", f"{base}:docs/progress/BUILD_HANDOFF.md"],
                    cwd=reverted_repo,
                )
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(reverted_repo))


    def test_c21_wsl_compose_runner_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq490 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_compose_runner_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 489)
        self.assertEqual(803027, len(prefix))
        self.assertEqual(
            "8F3067777D6B906E12A9B5E225F63DE3049CD27BD32B0449C48016327E008539",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "0D7CEDE2D5A539EA321872599D45398F6A3C55629EE2F9708AA98F59A7C5B26D",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:489])
            ).hexdigest().upper(),
        )
        exact46 = checker.c21_wsl_compose_runner_candidate_committed_exact_paths()
        exact11 = checker.c21_wsl_compose_runner_candidate_rebind_successor_paths()
        exact48 = checker.c21_wsl_compose_runner_candidate_record_committed_exact_paths()
        self.assertEqual((46, 11, 48), (len(exact46), len(exact11), len(exact48)))
        for paths, expected in (
            (exact46, "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86"),
            (exact11, "E439C0A394C536E1825E7C3FCF606BB7CC14D39C0DF29E7B60E648885EB6B110"),
            (exact48, "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_compose_runner_candidate_rebind_routes_private_push_autonomously(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
        expected_action = (
            "COMPLETE_SEQ490_REVIEW_THEN_AUTONOMOUS_PRIVATE_PUSH_"
            "WITHOUT_SEPARATE_PROJECT_APPROVAL"
        )
        expected_safe_action = (
            "seq490 review 완료 후 Main이 승인된 개발·테스트 범위의 private "
            "candidate/control refs를 별도 프로젝트 승인 대기 없이 자동 push하고 "
            "append-only 결과 checkpoint를 기록한 뒤 WSL 검증으로 진행한다. "
            "C-01은 계속 차단한다."
        )
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_compose_runner_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_COMPOSE_RUNNER_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_COMPOSE_RUNNER_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_COMPOSE_RUNNER_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_compose_runner_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_compose_runner_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        repository = bundle["progress"]["repository"]
        candidate = "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact46 = sorted(checker.c21_wsl_compose_runner_candidate_committed_exact_paths())
        exact11 = sorted(checker.c21_wsl_compose_runner_candidate_rebind_successor_paths())
        exact48 = sorted(checker.c21_wsl_compose_runner_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact46, control_descendant_paths=exact11, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact48, control_descendant_paths=exact11, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact11[:-1], exact11 + ["arbitrary.txt"], exact11 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_compose_runner_candidate_rebind_real_git_requires_direct_exact11_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        candidate = "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_compose_runner_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq490 exact11 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(48, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq490 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq490 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_cold_start_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq491 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_cold_start_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 490)
        self.assertEqual(814540, len(prefix))
        self.assertEqual(
            "E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "22A0C80EDABC24894FFCFF8D4036E9B4CB09698B21FA713958D515CD7DCCEFF8",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:490])
            ).hexdigest().upper(),
        )
        exact48 = checker.c21_wsl_cold_start_candidate_committed_exact_paths()
        exact11 = checker.c21_wsl_cold_start_candidate_rebind_successor_paths()
        exact50 = checker.c21_wsl_cold_start_candidate_record_committed_exact_paths()
        self.assertEqual((48, 11, 50), (len(exact48), len(exact11), len(exact50)))
        for paths, expected in (
            (exact48, "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288"),
            (exact11, "D7016A7C101CE330EECD91A12A4FB093628969D3B19158A6950FF398401D1952"),
            (exact50, "9D28888908150BC834FC8931D12A35A9265C7D589ED2D89EAD7F2248E2D179EE"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_cold_start_candidate_rebind_routes_private_push_autonomously(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
        expected_action = (
            "COMPLETE_SEQ491_REVIEW_THEN_AUTONOMOUS_PRIVATE_PUSH_"
            "WITHOUT_SEPARATE_PROJECT_APPROVAL"
        )
        expected_safe_action = (
            "seq491 review 완료 후 Main이 승인된 개발·테스트 범위의 private "
            "candidate/control refs를 별도 프로젝트 승인 대기 없이 자동 push하고 "
            "append-only 결과 checkpoint를 기록한 뒤 WSL 검증으로 진행한다. "
            "C-01은 계속 차단한다."
        )
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_cold_start_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_COLD_START_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_COLD_START_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_COLD_START_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_COLD_START_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_COLD_START_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_COLD_START_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_cold_start_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_cold_start_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        repository = bundle["progress"]["repository"]
        candidate = "324eb169fedbce958d2e8cc29362deb7af433677"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact48 = sorted(checker.c21_wsl_cold_start_candidate_committed_exact_paths())
        exact11 = sorted(checker.c21_wsl_cold_start_candidate_rebind_successor_paths())
        exact50 = sorted(checker.c21_wsl_cold_start_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact48, control_descendant_paths=exact11, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact50, control_descendant_paths=exact11, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact11[:-1], exact11 + ["arbitrary.txt"], exact11 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_cold_start_candidate_rebind_real_git_requires_direct_exact11_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        candidate = "324eb169fedbce958d2e8cc29362deb7af433677"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_cold_start_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq491 exact11 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(50, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq491 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq491 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_ingress_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq492 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_ingress_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 491)
        self.assertEqual(827250, len(prefix))
        self.assertEqual(
            "7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:491])
            ).hexdigest().upper(),
        )
        exact51 = checker.c21_wsl_ingress_candidate_committed_exact_paths()
        exact13 = checker.c21_wsl_ingress_candidate_rebind_successor_paths()
        exact54 = checker.c21_wsl_ingress_candidate_record_committed_exact_paths()
        self.assertEqual((51, 13, 54), (len(exact51), len(exact13), len(exact54)))
        for paths, expected in (
            (exact51, "F3AD3734333F4D40E2C3AC7B00C59AB0D91F06574C2CBBFCA8AAA79B49217EF2"),
            (exact13, "F17A6B348C9A88343FCB9DE019A80429698293C62E7C2D35ADCBD9D23C049DEF"),
            (exact54, "176FB83A22359E5C2D5A4DC7180439A31318E16BF50288B154E02046415EFCF5"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_ingress_candidate_rebind_routes_private_push_autonomously(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
        expected_action = "COMPLETE_SEQ492_BINDING_REVIEW_THEN_HOLD_RUNTIME_FOR_I3_PRODUCT_SUCCESSOR"
        expected_safe_action = 'seq492 결박 검토·기록 후 I-3 rollback allowlist 제품 보완 승인과 검증을 기다린다. 새 candidate의 deploy/rollback/cleanup은 금지하며 C-01은 계속 차단한다.'
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_ingress_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_INGRESS_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_INGRESS_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_INGRESS_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_INGRESS_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_INGRESS_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_INGRESS_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_ingress_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_ingress_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        repository = bundle["progress"]["repository"]
        candidate = "ccf5109d0640bf28c461e7754ad56e0821fd77be"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact51 = sorted(checker.c21_wsl_ingress_candidate_committed_exact_paths())
        exact13 = sorted(checker.c21_wsl_ingress_candidate_rebind_successor_paths())
        exact54 = sorted(checker.c21_wsl_ingress_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact51, control_descendant_paths=exact13, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact54, control_descendant_paths=exact13, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact13[:-1], exact13 + ["arbitrary.txt"], exact13 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_ingress_candidate_rebind_real_git_requires_direct_exact13_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        candidate = "ccf5109d0640bf28c461e7754ad56e0821fd77be"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_ingress_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq492 exact13 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(54, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq492 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq492 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_ingress_runtime_hold_cannot_be_promoted_to_execution(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("BLOCKED_IMPORTANT_I3", manifest["runtime_safety_gate"])
        manifest["runtime_safety_gate"] = "ALLOWED"
        self.assertIn("C21_WSL_INGRESS_REBIND_RUNTIME_GATE_INVALID", checker.validate_c21_wsl_ingress_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_rollback_allowlist_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq493 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 492)
        self.assertEqual(841414, len(prefix))
        self.assertEqual(
            "F38EA939F8A29669377EC527384EF5EEE9E5F3DEBA1DCA3FAC448B3875C7C063",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "5A8F4B9FC0187F0D06E0CB74F5EFF059004CC0D93A624EF85FE6CBB242C3530B",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:492])
            ).hexdigest().upper(),
        )
        exact54 = checker.c21_wsl_rollback_allowlist_candidate_committed_exact_paths()
        exact12 = checker.c21_wsl_rollback_allowlist_candidate_rebind_successor_paths()
        exact56 = checker.c21_wsl_rollback_allowlist_candidate_record_committed_exact_paths()
        self.assertEqual((54, 12, 56), (len(exact54), len(exact12), len(exact56)))
        for paths, expected in (
            (exact54, "176FB83A22359E5C2D5A4DC7180439A31318E16BF50288B154E02046415EFCF5"),
            (exact12, "6A7D0BE483A2B9C119B6566FAB91D6B3D7A4377544DAAEC5D6C07E3359AAE183"),
            (exact56, "0BB4FEDFE3582C50A539182B065AAE2E6B19E313356CFCFC0DD6B9B385BC6714"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_rollback_allowlist_candidate_rebind_keeps_external_execution_outside_current_scope(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "NOT_EXECUTED_EXTERNAL_SCOPE_HOLD"
        expected_action = "COMPLETE_SEQ493_RECORD_REVIEW_THEN_HOLD_EXTERNAL_EXECUTION_OUTSIDE_CURRENT_SCOPE"
        expected_safe_action = 'seq493 내부 결박·검토를 마감한다. I-3는 로컬 제품 검증에서 보완됐으나 이번 범위에 외부 실행은 없으므로 push/배포/rollback/cleanup은 수행하지 않으며 C-01은 계속 차단한다.'
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_rollback_allowlist_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_rollback_allowlist_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        repository = bundle["progress"]["repository"]
        candidate = "5f8c301e18c332e3353092dab9efe5c32d0fda84"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact54 = sorted(checker.c21_wsl_rollback_allowlist_candidate_committed_exact_paths())
        exact12 = sorted(checker.c21_wsl_rollback_allowlist_candidate_rebind_successor_paths())
        exact56 = sorted(checker.c21_wsl_rollback_allowlist_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact54, control_descendant_paths=exact12, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact56, control_descendant_paths=exact12, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact12[:-1], exact12 + ["arbitrary.txt"], exact12 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_rollback_allowlist_candidate_rebind_real_git_requires_direct_exact12_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        candidate = "5f8c301e18c332e3353092dab9efe5c32d0fda84"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_rollback_allowlist_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq493 exact12 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(56, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq493 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq493 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_rollback_allowlist_runtime_hold_cannot_be_promoted_to_execution(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE", manifest["runtime_safety_gate"])
        manifest["runtime_safety_gate"] = "ALLOWED"
        self.assertIn("C21_WSL_ROLLBACK_ALLOWLIST_REBIND_RUNTIME_GATE_INVALID", checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_rollback_allowlist_coherent_local_evidence_cannot_claim_external_success(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        bundle = copy.deepcopy(bundle)
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(bundle, manifest))
        for document in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest):
            document["local_product_evidence"]["external_execution"] = "PASS"
        self.assertIn("C21_WSL_ROLLBACK_ALLOWLIST_REBIND_LOCAL_EVIDENCE_INVALID", checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_resume_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        manifest_path = (
            historical_root
            / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq494 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 493)
        self.assertEqual(857131, len(prefix))
        self.assertEqual(
            "CD537E3872F9AA042DBDB8028FB0310EBD7512673229A7D12F70A49D373465C7",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "854B2F3E08482698C44251D16A7D5E3D51AF0C1879DF4DCF564DFD6A7615BAF2",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:493])
            ).hexdigest().upper(),
        )
        exact56 = checker.c21_wsl_qa_resume_candidate_committed_exact_paths()
        exact12 = checker.c21_wsl_qa_resume_candidate_rebind_successor_paths()
        exact58 = checker.c21_wsl_qa_resume_candidate_record_committed_exact_paths()
        self.assertEqual((56, 12, 58), (len(exact56), len(exact12), len(exact58)))
        for paths, expected in (
            (exact56, "0BB4FEDFE3582C50A539182B065AAE2E6B19E313356CFCFC0DD6B9B385BC6714"),
            (exact12, "315FA23EA1B82C16252A749802C3CE94E611BDF3618BF55837A2FBEA187185F5"),
            (exact58, "6F3B6CFA9DD2EA91B40A277D3199084947B0FE2C74744849FC59CF2A52647BC4"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_qa_resume_candidate_rebind_separates_ready_from_actual_execution(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "NOT_EXECUTED_PENDING_LOCAL_SEQ494_COMMIT_EXTERNAL_SCOPE_RECONFIRMATION"
        expected_action = "COMPLETE_SEQ494_LOCAL_REVIEW_AND_COMMIT_THEN_RECONFIRM_EXTERNAL_SCOPE"
        expected_safe_action = 'seq494 로컬 검토·direct-child commit과 clean postcommit 검증까지만 완료한다. 최신 PMO 지시에 따라 private push·WSL·DB·rollback·cleanup 등 외부 실행은 금지하며 이후 외부 범위를 재확인한다. READY는 기술적 준비 상태일 뿐 현재 dispatch 권한이나 실제 성공이 아니다. Telegram·Provider·ysna·main 병합은 제외하고 C-01은 독립 판정까지 차단한다.'
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (historical_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (ROOT / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_qa_resume_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_QA_RESUME_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_QA_RESUME_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_QA_RESUME_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_QA_RESUME_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_QA_RESUME_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_QA_RESUME_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_qa_resume_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        repository = bundle["progress"]["repository"]
        candidate = "a342d62391a44b349733d1468ac3b180761155ab"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact56 = sorted(checker.c21_wsl_qa_resume_candidate_committed_exact_paths())
        exact12 = sorted(checker.c21_wsl_qa_resume_candidate_rebind_successor_paths())
        exact58 = sorted(checker.c21_wsl_qa_resume_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact56, control_descendant_paths=exact12, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact58, control_descendant_paths=exact12, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact12[:-1], exact12 + ["arbitrary.txt"], exact12 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_qa_resume_candidate_rebind_real_git_requires_direct_exact12_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        candidate = "a342d62391a44b349733d1468ac3b180761155ab"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_qa_resume_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(ROOT), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = ROOT / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq494 exact12 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(58, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq494 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq494 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_qa_resume_ready_gate_cannot_be_replaced_by_unrestricted_allowed(self):
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("READY_FOR_APPROVED_WSL_QA", manifest["runtime_safety_gate"])
        manifest["runtime_safety_gate"] = "ALLOWED"
        self.assertIn("C21_WSL_QA_RESUME_REBIND_RUNTIME_GATE_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_resume_coherent_local_evidence_cannot_claim_external_success(self):
        checker = self.require_checker()
        historical_bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
        bundle = copy.deepcopy(historical_bundle)
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))
        for document in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest):
            document["local_product_evidence"]["external_execution"] = "PASS"
        self.assertIn("C21_WSL_QA_RESUME_REBIND_LOCAL_EVIDENCE_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_resume_coherent_predecessor_recovery_cannot_claim_new_candidate_push(self):
        checker = self.require_checker()
        historical_bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
        bundle = copy.deepcopy(historical_bundle)
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))
        for doc in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest):
            doc["predecessor_private_recovery"]["current_candidate_push"] = "PASS"
        self.assertIn("C21_WSL_QA_RESUME_PREDECESSOR_RECOVERY_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))


    def test_c21_wsl_qa_resume_coherent_runtime_next_action_cannot_dispatch(self):
        checker = self.require_checker()
        for value in ("MAIN_DISPATCH_DEPLOY_NOW_WITHOUT_SCOPE_RECONFIRMATION", "OTHER_HOLD", " ", None):
            with self.subTest(value=value):
                historical_bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
                bundle = copy.deepcopy(historical_bundle)
                manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
                self.assertEqual([], checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))
                for doc in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest, bundle["handoff"]):
                    if value is None: doc.pop("runtime_next_action", None)
                    else: doc["runtime_next_action"] = value
                self.assertIn("C21_WSL_QA_RESUME_REBIND_RUNTIME_NEXT_ACTION_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_execution_result_projection_is_strictly_scoped(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "9a7a6144bcd0a7d38fce291610f40e9608a38309"
        )
        manifest_path = (
            historical_root
            / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_qa_execution_result_projection(bundle, manifest),
        )
        self.assertEqual("SUITABLE", manifest["product_validation"])
        self.assertEqual(
            "C-21/WSL-EARLY-VALIDATION_APPROVED_SCOPE_ONLY",
            manifest["validation_scope"],
        )
        self.assertFalse(manifest["accepted"])
        self.assertEqual("PENDING", manifest["independent_tester_status"])
        self.assertEqual(
            "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
            manifest["c01_status"],
        )
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])

    def test_c21_wsl_qa_execution_result_projection_rejects_evidence_promotion(self) -> None:
        checker = self.require_checker()
        original_bundle = checker.load_bundle(ROOT)
        original_manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations = []
        promoted = copy.deepcopy(original_manifest)
        promoted["accepted"] = True
        mutations.append(("accepted", copy.deepcopy(original_bundle), promoted, "C21_WSL_QA_RESULT_DECISION_BOUNDARY_INVALID"))
        external = copy.deepcopy(original_manifest)
        external["execution_result"]["excluded"]["provider"] = "PASS"
        mutations.append(("provider", copy.deepcopy(original_bundle), external, "C21_WSL_QA_RESULT_EXECUTION_INVALID"))
        residue = copy.deepcopy(original_manifest)
        residue["execution_result"]["cleanup"]["volumes"] = 1
        mutations.append(("residue", copy.deepcopy(original_bundle), residue, "C21_WSL_QA_RESULT_EXECUTION_INVALID"))
        product_failure = copy.deepcopy(original_manifest)
        product_failure["execution_result"]["deploy_attempts"][0]["product_valid_failure"] = True
        mutations.append(("premutation_failure", copy.deepcopy(original_bundle), product_failure, "C21_WSL_QA_RESULT_EXECUTION_INVALID"))
        history = copy.deepcopy(original_bundle)
        history["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("history", history, copy.deepcopy(original_manifest), "C21_WSL_QA_RESULT_HISTORY_INVALID"))
        for scenario, bundle, manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, manifest),
                )

    def test_c21_wsl_qa_execution_result_git_projection_is_exact(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        repository = bundle["progress"]["repository"]
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": "ca92b7845eda803cff3c432799642e4f9243d4d6",
        }
        precommit = dict(
            common,
            actual_head="772afbd5eb55791ca7b5002d58378437ea496750",
            actual_changed_paths=sorted(checker.c21_wsl_qa_execution_result_parent_paths()),
            control_descendant_paths=sorted(checker.c21_wsl_qa_execution_result_successor_paths()),
            worktree_is_clean=False,
            record_commit_is_direct=False,
        )
        self.assertEqual([], checker.validate_c21_wsl_qa_execution_result_git(repository, **precommit))
        bad = dict(precommit, control_descendant_paths=precommit["control_descendant_paths"] + ["arbitrary.txt"])
        self.assertIn("GIT_DESCENDANT_PATH_SET_MISMATCH", checker.validate_c21_wsl_qa_execution_result_git(repository, **bad))
        postcommit = dict(
            common,
            actual_head="f" * 40,
            actual_changed_paths=sorted(checker.c21_wsl_qa_execution_result_record_paths()),
            control_descendant_paths=sorted(checker.c21_wsl_qa_execution_result_successor_paths()),
            worktree_is_clean=True,
            record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_c21_wsl_qa_execution_result_git(repository, **postcommit))
        self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", checker.validate_c21_wsl_qa_execution_result_git(repository, **dict(postcommit, record_commit_is_direct=False)))

    def test_c21_wsl_qa_execution_result_rejects_coherent_evidence_mutations(self) -> None:
        checker = self.require_checker()
        original_bundle, historical_root = self._historical_bundle(
            checker, "9a7a6144bcd0a7d38fce291610f40e9608a38309"
        )
        original_manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json").read_text(encoding="utf-8")
        )

        def mutate_all(path, value):
            bundle = copy.deepcopy(original_bundle)
            manifest = copy.deepcopy(original_manifest)
            for result in (
                manifest["execution_result"],
                bundle["events"]["events"][-1]["details"]["execution_result"],
                bundle["progress"]["wsl_early_validation"]["execution_result"],
            ):
                target = result
                for part in path[:-1]:
                    target = target[part]
                target[path[-1]] = value
            return bundle, manifest

        mutations = [
            (("candidate_commit",), "0" * 40),
            (("control_commit",), "0" * 40),
            (("environment",), "PRODUCTION"),
            (("targets",), ["POSTGRESQL_15"]),
            (("deploy_attempts", 0, "reason"), "OTHER"),
            (("deploy_attempts", 1, "cleanup_trap"), "FAIL"),
            (("deploy_attempts", 2, "ssh_config"), "/tmp/config"),
            (("candidate_deploy", "return_after_rollback"), "FAIL"),
            (("verification", "migration"), "0012_run_authority"),
            (("rollback", "from"), "0" * 40),
            (("rollback_observation", "database_counts_before_after"), "2|1|1_CHANGED"),
            (("final_state", "env_content"), "CHANGED"),
            (("excluded", "telegram"), "PASS"),
            (("evidence", "rollback_observer_scratch_sha256"), "0" * 64),
        ]
        for path, value in mutations:
            with self.subTest(path=path):
                bundle, manifest = mutate_all(path, value)
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, manifest),
                    path,
                )

    def test_c21_wsl_qa_execution_result_rejects_manifest_and_recovery_mutations(self) -> None:
        checker = self.require_checker()
        original_bundle = checker.load_bundle(ROOT)
        original_manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json").read_text(encoding="utf-8")
        )
        manifest_mutations = {
            "record_parent_commit": "0" * 40,
            "candidate_commit": "0" * 40,
            "runtime_commit": "0" * 40,
            "historical_raw_event_bytes": 1,
            "historical_raw_events_sha256": "0" * 64,
            "historical_events_sha256": "0" * 64,
            "record_successor_path_count": 9,
            "record_successor_path_list_sha256": "0" * 64,
            "postcommit_exact_path_count": 60,
            "postcommit_exact_path_list_sha256": "0" * 64,
        }
        for field, value in manifest_mutations.items():
            with self.subTest(field=field):
                manifest = copy.deepcopy(original_manifest)
                manifest[field] = value
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(copy.deepcopy(original_bundle), manifest),
                    field,
                )
        recovery_mutations = {
            "candidate_push_status": "NOT_EXECUTED",
            "wsl_access": "NOT_EXECUTED",
            "postgres_15": "NOT_EXECUTED",
            "postgres_18_rc": "NOT_EXECUTED",
            "migration": "NOT_EXECUTED",
            "api": "NOT_EXECUTED",
            "authenticated_sse": "NOT_EXECUTED",
            "last_event_id": "NOT_EXECUTED",
            "same_origin": "NOT_EXECUTED",
            "backup_restore": "NOT_EXECUTED",
            "application_rollback": "NOT_EXECUTED",
            "deployment": "NOT_EXECUTED",
            "database": "NOT_EXECUTED",
            "volume_cleanup": "NOT_EXECUTED",
            "runtime_safety_gate": "READY_FOR_APPROVED_WSL_QA",
            "runtime_next_action": "DISPATCH_NOW",
        }
        for field, value in recovery_mutations.items():
            with self.subTest(field=field):
                bundle = copy.deepcopy(original_bundle)
                bundle["progress"]["wsl_early_validation"][field] = value
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, copy.deepcopy(original_manifest)),
                    field,
                )
        handoff_mutations = {
            "status": "ACTIVE",
            "repository_push_status": "NOT_EXECUTED",
            "candidate_push_status": "NOT_EXECUTED",
            "deployment_status": "NOT_EXECUTED",
            "runtime_safety_gate": "READY_FOR_APPROVED_WSL_QA",
            "runtime_next_action": "DISPATCH_NOW",
            "c01_status": "STARTED",
            "dir2_status": "TRIGGERED",
        }
        for field, value in handoff_mutations.items():
            with self.subTest(handoff_field=field):
                bundle = copy.deepcopy(original_bundle)
                bundle["handoff"][field] = value
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, copy.deepcopy(original_manifest)),
                    field,
                )

    def test_c21_wsl_qa_execution_result_fast_path_preserves_generic_repository_guards(self) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "9a7a6144bcd0a7d38fce291610f40e9608a38309"
        )
        repository = bundle["progress"]["repository"]
        common = {
            "actual_head": "772afbd5eb55791ca7b5002d58378437ea496750",
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": "ca92b7845eda803cff3c432799642e4f9243d4d6",
            "base_is_ancestor": True,
            "actual_changed_paths": sorted(checker.c21_wsl_qa_execution_result_parent_paths()),
            "working_tree_mode": True,
            "progress": bundle["progress"],
            "control_descendant_paths": sorted(checker.c21_wsl_qa_execution_result_successor_paths()),
            "worktree_is_clean": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        cases = [
            ("projection_mode", "TAMPERED", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("validated_base_commit", "0" * 40, "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("head_relation", "TAMPERED", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("branch", "other", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("upstream", "origin/other", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("remote_head", "0" * 40, "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("feature_remote_head", "0" * 40, "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("exact_allowed_paths", repository["exact_allowed_paths"][:-1], "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("qa_execution_result_successor_paths", repository["qa_execution_result_successor_paths"][:-1], "GIT_DESCENDANT_PROJECTION_INVALID"),
        ]
        for field, value, reason in cases:
            with self.subTest(field=field):
                mutated = copy.deepcopy(repository)
                mutated[field] = value
                self.assertIn(reason, checker.validate_repository_projection(mutated, **common))
        self.assertIn(
            "GIT_VALIDATED_BASE_NOT_ANCESTOR",
            checker.validate_repository_projection(repository, **dict(common, base_is_ancestor=False)),
        )
        real_git_bundle = copy.deepcopy(bundle)
        real_git_bundle["progress"]["repository"]["projection_mode"] = "TAMPERED"
        self.assertIn(
            "GIT_DESCENDANT_PROJECTION_INVALID",
            checker._validate_git_projection(real_git_bundle),
        )

    def test_c21_independent_judgment_projection_is_blocked_not_accepted(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._independent_judgment_bundle(checker)
        manifest_path = historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_independent_judgment_projection(bundle, manifest))
        self.assertEqual("TEST_REVIEW", bundle["progress"]["status"])
        self.assertEqual("BLOCKED_NOT_ACCEPTED", manifest["verdict"])
        self.assertFalse(manifest["accepted"])
        self.assertIsNone(bundle["progress"]["worker_lease"])
        self.assertIsNone(bundle["progress"]["write_lease"])
        self.assertIsNone(bundle["progress"]["active_agent"])

    def test_c21_independent_judgment_rejects_revocation_order_and_lease_mutations(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_independent_judgment_projection(original, manifest))
        mutations = []
        swapped = copy.deepcopy(original)
        swapped["events"]["events"][-3], swapped["events"]["events"][-2] = swapped["events"]["events"][-2], swapped["events"]["events"][-3]
        mutations.append(("order", swapped))
        duplicate = copy.deepcopy(original)
        duplicate["events"]["events"][-2]["event_type"] = "WRITE_LEASE_REVOKED"
        mutations.append(("duplicate", duplicate))
        lease_id = copy.deepcopy(original)
        lease_id["events"]["events"][-3]["details"]["lease_id"] = "other"
        mutations.append(("lease_id", lease_id))
        fencing = copy.deepcopy(original)
        fencing["events"]["events"][-2]["details"]["execution_fencing_token"] = "other"
        mutations.append(("fencing", fencing))
        write_active = copy.deepcopy(original)
        write_active["progress"]["write_lease"] = {"status": "ACTIVE"}
        mutations.append(("write_active", write_active))
        worker_active = copy.deepcopy(original)
        worker_active["progress"]["worker_lease"] = {"status": "ACTIVE"}
        mutations.append(("worker_active", worker_active))
        agent_active = copy.deepcopy(original)
        agent_active["progress"]["active_agent"] = "developer-primary-wsl"
        mutations.append(("agent_active", agent_active))
        stale_wi = copy.deepcopy(original)
        stale_wi["progress"]["active_work_instruction"]["result_status"] = "IN_PROGRESS"
        mutations.append(("stale_wi", stale_wi))
        for scenario, bundle in mutations:
            with self.subTest(scenario=scenario):
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, copy.deepcopy(manifest)))

    def test_c21_independent_judgment_rejects_coherent_decision_promotion(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        original_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))

        def mutate_all(field, value):
            bundle = copy.deepcopy(original)
            manifest = copy.deepcopy(original_manifest)
            docs = [manifest, bundle["events"]["events"][-1]["details"], bundle["progress"]["c21_independent_judgment"], bundle["handoff"]]
            for doc in docs:
                doc[field] = value
            return bundle, manifest

        for field, value in (
            ("verdict", "PASS"),
            ("accepted", True),
            ("c01_status", "STARTED"),
            ("dir2_status", "TRIGGERED"),
            ("runtime_next_action", "DISPATCH_NOW"),
        ):
            with self.subTest(field=field):
                bundle, manifest = mutate_all(field, value)
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, manifest))
        for criterion in ("2", "3", "4", "5"):
            with self.subTest(criterion=criterion):
                bundle = copy.deepcopy(original)
                manifest = copy.deepcopy(original_manifest)
                for doc in (manifest, bundle["events"]["events"][-1]["details"], bundle["progress"]["c21_independent_judgment"]):
                    doc["criteria"][criterion] = "PASS"
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, manifest))

    def test_c21_independent_judgment_rejects_history_hash_and_repository_mutations(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        original_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))
        history = copy.deepcopy(original)
        history["events"]["events"][0]["event_id"] += "-tampered"
        self.assertTrue(checker.validate_c21_independent_judgment_projection(history, copy.deepcopy(original_manifest)))
        for field, value in (
            ("historical_raw_event_bytes", 1),
            ("historical_raw_events_sha256", "0" * 64),
            ("historical_events_sha256", "0" * 64),
            ("record_successor_path_count", 8),
            ("record_successor_path_list_sha256", "0" * 64),
            ("postcommit_exact_path_count", 63),
            ("postcommit_exact_path_list_sha256", "0" * 64),
        ):
            with self.subTest(field=field):
                manifest = copy.deepcopy(original_manifest)
                manifest[field] = value
                self.assertTrue(checker.validate_c21_independent_judgment_projection(copy.deepcopy(original), manifest))
        for field, value in (
            ("projection_mode", "TAMPERED"),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("remote_head", "0" * 40),
            ("exact_allowed_paths", original["progress"]["repository"]["exact_allowed_paths"][:-1]),
        ):
            with self.subTest(repository_field=field):
                bundle = copy.deepcopy(original)
                bundle["progress"]["repository"][field] = value
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, copy.deepcopy(original_manifest)))

    def test_c21_independent_judgment_rejects_all_binding_event_and_digest_mutations(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        original_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))
        for field, value in (
            ("judgment_source_sha256", "0" * 64),
            ("work_instruction_sha256", "0" * 64),
            ("revocation_events", ["other"]),
            ("judgment_event_id", "other"),
        ):
            with self.subTest(manifest_field=field):
                manifest = copy.deepcopy(original_manifest)
                manifest[field] = value
                self.assertIn("C21_JUDGMENT_MANIFEST_INVALID", checker.validate_c21_independent_judgment_projection(copy.deepcopy(original), manifest))
        event_mutations = (
            (-3, "actor", "other"), (-3, "subject_ref", "other"),
            (-3, "occurred_at", "other"), (-3, "details.execution_fencing_token", "other"),
            (-3, "details.worker_lease_id", "other"), (-3, "details.reason", "other"),
            (-2, "actor", "other"), (-2, "subject_ref", "other"),
            (-2, "details.reason", "other"), (-1, "actor", "other"),
            (-1, "subject_ref", "other"), (-1, "details.judgment_source_sha256", "0" * 64),
            (-1, "details.work_instruction_sha256", "0" * 64),
            (-1, "details.evidence_ref", "other"),
            (-1, "details.write_revocation_event_id", "other"),
            (-1, "details.worker_revocation_event_id", "other"),
        )
        for index, path, value in event_mutations:
            with self.subTest(event=index, path=path):
                bundle = copy.deepcopy(original)
                target = bundle["events"]["events"][index]
                parts = path.split(".")
                for part in parts[:-1]: target = target[part]
                target[parts[-1]] = value
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, copy.deepcopy(original_manifest)))
        digest = json.loads((historical_root / "docs/progress/progress-handoff-detached-digest-c21-independent-judgment.json").read_text(encoding="utf-8"))
        for path, value in (
            (("progress", "bytes"), 1), (("progress", "canonical_json_sha256"), "0" * 64),
            (("handoff", "bytes"), 1), (("handoff", "machine_summary_canonical_sha256"), "0" * 64),
            (("scope",), "other"), (("self_reference",), True),
        ):
            with self.subTest(digest_path=path):
                mutated = copy.deepcopy(digest); target = mutated
                for part in path[:-1]: target = target[part]
                target[path[-1]] = value
                with mock.patch.object(checker, "_load_json", return_value=mutated):
                    self.assertIn("C21_JUDGMENT_DIGEST_INVALID", checker.validate_c21_independent_judgment_projection(copy.deepcopy(original), copy.deepcopy(original_manifest)))

    def test_c21_independent_judgment_real_git_fast_path_preserves_structural_guards(self) -> None:
        checker = self.require_checker()
        original, _ = self._independent_judgment_bundle(checker)
        mutations = (
            ("feature_remote", "origin/tampered"),
            ("feature_remote_head", "0" * 40),
            ("projection_mode", "TAMPERED"),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("local_head", "0" * 40),
            ("worktree_status", "TAMPERED"),
            ("exact_allowed_paths", original["progress"]["repository"]["exact_allowed_paths"][:-1]),
        )
        for field, value in mutations:
            with self.subTest(field=field):
                bundle = copy.deepcopy(original)
                bundle["progress"]["repository"][field] = value
                self.assertTrue(checker._validate_git_projection(bundle), field)

    def test_c21_independent_judgment_report_is_valid_markdown(self) -> None:
        text = (ROOT / "docs/04_test_reports/C-21_INDEPENDENT_JUDGMENT_REPORT.md").read_text(encoding="utf-8")
        self.assertIn("## 판정", text)
        self.assertIn("- 전체 C-21: `TEST_REVIEW / BLOCKED_NOT_ACCEPTED`", text)
        self.assertIn("## 근거", text)
        self.assertIn("## lease 종료와 경계", text)
        self.assertFalse(any(line.startswith("+") for line in text.splitlines()))

    def test_c21_development_qa_resume_start_projection_activates_exact_leases(self) -> None:
        checker = self.require_checker()
        manifest_path = ROOT / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json"
        self.assertTrue(manifest_path.is_file(), "development QA resume start manifest is missing")
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        self.assertEqual(501, bundle["progress"]["event_sequence"])
        self.assertEqual("ACTIVE_DEVELOPMENT_QA", bundle["progress"]["status"])
        self.assertEqual("developer-primary", bundle["progress"]["active_agent"])
        self.assertEqual(
            "worker-lease-c21-development-qa-resume-20260905-001",
            bundle["progress"]["worker_lease"]["lease_id"],
        )
        self.assertEqual(
            "write-lease-c21-development-qa-resume-20260905-001",
            bundle["progress"]["write_lease"]["lease_id"],
        )

    def test_c21_development_qa_resume_rejects_event_fencing_and_decision_mutations(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        mutations = []
        for index, path, value in (
            (-3, "event_type", "PACKAGE_RESUMED"),
            (-3, "details.execution_fencing_token", "tampered"),
            (-2, "details.write_fencing_token", "tampered"),
            (-2, "details.paths", ["other"]),
            (-1, "details.reason", "tampered"),
        ):
            mutated = copy.deepcopy(bundle)
            target = mutated["events"]["events"][index]
            parts = path.split(".")
            for part in parts[:-1]:
                target = target[part]
            target[parts[-1]] = value
            mutations.append((path, mutated, copy.deepcopy(manifest)))
        for field, value in (
            ("status", "TEST_REVIEW"),
            ("active_agent", None),
            ("worker_lease", None),
            ("write_lease", None),
        ):
            mutated = copy.deepcopy(bundle)
            mutated["progress"][field] = value
            mutations.append((field, mutated, copy.deepcopy(manifest)))
        for field, value in (
            ("accepted", True),
            ("c01_status", "STARTED"),
            ("dir2_status", "TRIGGERED"),
            ("runtime_next_action", "HOLD_USER_VALIDATION_REQUIRED"),
        ):
            mutated = copy.deepcopy(bundle)
            mutated["progress"]["development_qa_resume"][field] = value
            mutations.append((field, mutated, copy.deepcopy(manifest)))
        for scenario, mutated_bundle, mutated_manifest in mutations:
            with self.subTest(scenario=scenario):
                self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(mutated_bundle, mutated_manifest))

    def test_c21_development_qa_resume_rejects_history_manifest_and_exact_scope_mutations(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        history = copy.deepcopy(bundle)
        history["events"]["events"][0]["event_id"] += "-tampered"
        self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(history, copy.deepcopy(manifest)))
        for field, value in (
            ("historical_full_file_bytes", 1),
            ("historical_full_file_sha256", "0" * 64),
            ("historical_event_object_prefix_bytes", 1),
            ("historical_event_object_prefix_sha256", "0" * 64),
            ("historical_events_canonical_sha256", "0" * 64),
            ("start_exact_path_count", 9),
            ("start_exact_path_list_sha256", "0" * 64),
            ("developer_exact_path_count", 6),
            ("developer_exact_path_list_sha256", "0" * 64),
        ):
            mutated = copy.deepcopy(manifest)
            mutated[field] = value
            self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(copy.deepcopy(bundle), mutated), field)

    def test_c21_development_qa_resume_distinguishes_full_blob_prefix_and_execution_authority(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        self.assertNotIn("proposal_sha256", manifest)
        self.assertEqual("SCRATCH_ONLY_MAIN_REVIEW_INPUT_NOT_AUTHORITY", manifest["proposal_classification"])
        self.assertEqual(882505, manifest["historical_full_file_bytes"])
        self.assertEqual("B9C412B586999C2DCD530B7E6EDD283CE3A124BF4E98B08F8673A3184D641F78", manifest["historical_full_file_sha256"])
        self.assertEqual(882302, manifest["historical_event_object_prefix_bytes"])
        self.assertEqual("3659A9808E97F6927E983CFCCD617BF5B1740D60CCDFE16D39D8107C8780C955", manifest["historical_event_object_prefix_sha256"])
        self.assertEqual("docs/work_orders/C-21_DEVELOPMENT_QA_RESUME_WORK_INSTRUCTION.md", manifest["execution_authority_path"])
        for field, value in (
            ("proposal_classification", "APPROVED_AUTHORITY"),
            ("historical_full_file_bytes", 1),
            ("historical_full_file_sha256", "0" * 64),
            ("historical_event_object_prefix_bytes", 1),
            ("historical_event_object_prefix_sha256", "0" * 64),
            ("execution_authority_path", "other"),
            ("execution_authority_sha256", "0" * 64),
        ):
            with self.subTest(field=field):
                mutated = copy.deepcopy(manifest)
                mutated[field] = value
                self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(copy.deepcopy(bundle), mutated))

    def test_c21_development_qa_resume_public_and_real_git_paths_fail_closed(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        repository = bundle["progress"]["repository"]
        exact64 = sorted(checker.c21_independent_judgment_record_paths())
        exact10 = sorted(checker.c21_development_qa_resume_start_paths())
        common = {
            "actual_head": repository["local_head"],
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": exact64,
            "working_tree_mode": True,
            "progress": bundle["progress"],
            "control_descendant_paths": exact10,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        postcommit = dict(
            common,
            actual_head="34eb1725b47c544b6ec314a28428b364a029f3eb",
            actual_changed_paths=sorted(set(exact64) | set(exact10)),
            working_tree_mode=False,
            control_is_ancestor=True,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=False,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for field, value in (
            ("control_is_ancestor", False),
            ("actual_changed_paths", sorted(set(exact64) | set(exact10))[:-1]),
            ("control_descendant_paths", exact10[:-1]),
            ("working_tree_mode", True),
            ("worktree_is_clean", False),
        ):
            with self.subTest(postcommit_field=field):
                self.assertTrue(
                    checker.validate_repository_projection(
                        repository, **dict(postcommit, **{field: value})
                    )
                )
        for field, value in (
            ("remote_head", "0" * 40),
            ("feature_remote", "origin/tampered"),
            ("feature_remote_head", "0" * 40),
            ("branch", "other"),
            ("upstream", "origin/other"),
            ("local_head", "0" * 40),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("worktree_status", "CLEAN"),
            ("exact_allowed_paths", repository["exact_allowed_paths"][:-1]),
        ):
            with self.subTest(repository_field=field):
                mutated = copy.deepcopy(repository)
                mutated[field] = value
                self.assertTrue(checker.validate_repository_projection(mutated, **common))
                real = copy.deepcopy(bundle)
                real["progress"]["repository"][field] = value
                self.assertTrue(checker._validate_git_projection(real))
        for field, value in (
            ("actual_remote_head", "0" * 40),
            ("actual_feature_remote_head", "0" * 40),
            ("actual_changed_paths", exact64[:-1]),
            ("working_tree_mode", False),
            ("control_descendant_paths", exact10[:-1]),
            ("worktree_is_clean", True),
            ("base_is_ancestor", False),
            ("control_runtime_record_commit_is_direct", True),
        ):
            with self.subTest(actual_field=field):
                self.assertTrue(checker.validate_repository_projection(repository, **dict(common, **{field: value})))

if __name__ == "__main__":
    unittest.main()
