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
from unittest import mock


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
        self.assertEqual(progress["phase_gate"]["checkpoint_status"], "CLEARED")
        self.assertTrue(progress["phase_gate"]["a01_start_allowed"])
        self.assertEqual(hashlib.sha256(G06_R2_TEST_REPORT_PATH.read_bytes()).hexdigest().upper(), "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertIn("MAIN_PACKAGE_ACCEPTED", bundle["event_contract"]["event_types"])

    def test_a01_post_push_materialization_projects_current_ready_checkpoint(self) -> None:
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
        self.assertEqual(106, progress["event_sequence"])
        self.assertEqual("READY", progress["status"])
        self.assertEqual("A-09", progress["current_work_package"])
        self.assertIn("A-03", progress["completed_packages"])
        self.assertIn("A-04", progress["completed_packages"])
        self.assertIn("A-06", progress["completed_packages"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertIsNone(progress["active_work_instruction"])
        self.assertEqual(0, progress["valid_failure_count"])
        self.assertEqual("A-09", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(0, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertEqual(0, progress["historical_failure_counts_by_lineage"].get("A-04", 0))
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["A-03"])
        self.assertEqual(
            "docs/evidence/manifests/A-08_ACCEPTANCE_PROGRESS_MANIFEST.json",
            progress["current_progress_evidence_ref"]["manifest_path"],
        )
        self.assertEqual([], checker.validate_bundle(bundle))


if __name__ == "__main__":
    unittest.main()
