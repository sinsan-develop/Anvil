"""G-07 authority normalization and adversarial baseline tests."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts" / "check_g07_baseline.py"


def load_checker():
    spec = importlib.util.spec_from_file_location("check_g07_baseline", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load G-07 checker")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise AssertionError(f"mutation anchor must occur once: {old!r}")
    return text.replace(old, new, 1)


class G07BaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = load_checker()

    def validate(self, *, texts=None, json_docs=None, verify_hashes=True):
        return self.checker.validate_repository(
            ROOT,
            text_overrides=texts or {},
            json_overrides=json_docs or {},
            verify_hashes=verify_hashes,
            verify_git=False,
        )

    @staticmethod
    def codes(report):
        return {error["code"] for error in report["errors"]}

    def test_authoritative_repository_is_recalculated_not_assumed(self):
        report = self.validate()
        self.assertEqual([], report["errors"])
        self.assertEqual(97, report["counts"]["package_total"])
        self.assertEqual(97, report["counts"]["reverse_package_total"])
        self.assertEqual(255, report["counts"]["av_total"])
        self.assertEqual(255, report["counts"]["unique_av_total"])
        self.assertEqual(0, report["counts"]["uncovered_av_total"])
        self.assertEqual(20, report["counts"]["scenario_total"])
        self.assertEqual("A01_READY", report["g_gate"]["readiness"])
        progress = json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
        self.assertEqual(206, progress["event_sequence"])
        self.assertEqual("B-01", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("R3_PENDING", progress["active_work_instruction"]["independent_tester_status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("CLEARED", progress["dir_review"]["status"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-01", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])

    def test_authority_hash_and_version_drift_are_rejected(self):
        design = (ROOT / "Anvil_설계서_v2.md").read_text(encoding="utf-8")
        mutated = replace_once(design, "설계서 v2.6", "설계서 v2.5")
        report = self.validate(texts={"Anvil_설계서_v2.md": mutated})
        self.assertTrue({"AUTHORITY_HASH_MISMATCH", "AUTHORITY_VERSION_MISMATCH"} <= self.codes(report))

    def test_package_duplicate_unknown_dependency_and_cycle_are_rejected(self):
        path = "Anvil_작업계획서_v1.md"
        plan = (ROOT / path).read_text(encoding="utf-8")

        duplicate = replace_once(plan, "| G-01 | `[historical G-01 당시]`", "| G-02 | `[historical G-01 당시]`")
        self.assertIn("PACKAGE_DUPLICATE", self.codes(self.validate(texts={path: duplicate}, verify_hashes=False)))

        unknown = replace_once(plan, "| 없음 |\n| G-02 |", "| Z-99 |\n| G-02 |")
        self.assertIn("PACKAGE_DEPENDENCY_UNKNOWN", self.codes(self.validate(texts={path: unknown}, verify_hashes=False)))

        cycle = replace_once(plan, "| 없음 |\n| G-02 |", "| G-02 |\n| G-02 |")
        self.assertIn("PACKAGE_DEPENDENCY_CYCLE", self.codes(self.validate(texts={path: cycle}, verify_hashes=False)))

    def test_av_duplicate_uncovered_and_reverse_package_duplicate_are_rejected(self):
        path = "Anvil_통합검증매트릭스_v1.md"
        matrix = (ROOT / path).read_text(encoding="utf-8")

        duplicate = replace_once(matrix, "| AV-SAFE-002 |", "| AV-SAFE-001 |")
        self.assertIn("AV_ID_DUPLICATE", self.codes(self.validate(texts={path: duplicate}, verify_hashes=False)))

        uncovered = replace_once(matrix, "| P-04 | AV-PLG-007 |", "| P-04 | AV-PLG-006 |")
        self.assertIn("AV_ID_UNCOVERED", self.codes(self.validate(texts={path: uncovered}, verify_hashes=False)))

        reverse_duplicate = replace_once(matrix, "| P-04 | AV-PLG-007 |", "| P-03 | AV-PLG-007 |")
        self.assertIn("REVERSE_PACKAGE_DUPLICATE", self.codes(self.validate(texts={path: reverse_duplicate}, verify_hashes=False)))

    def test_a01_flow001_responsibility_is_removed_without_losing_required_owners(self):
        report = self.validate(verify_hashes=False)

        self.assertEqual(["AV-UI-005"], report["package_assignments"]["A-01"])
        self.assertIn("AV-FLOW-001", report["package_assignments"]["A-05"])
        self.assertIn("AV-FLOW-001", report["package_assignments"]["B-03"])
        self.assertIn("A Gate", report["responsibility_guard"]["AV-FLOW-001"]["gates"])

    def test_flow001_responsibility_guard_rejects_missing_required_owners(self):
        path = "Anvil_통합검증매트릭스_v1.md"
        matrix = (ROOT / path).read_text(encoding="utf-8")
        corrected = matrix

        wrong_a01 = replace_once(
            corrected,
            "| A-01 | AV-UI-005 |",
            "| A-01 | AV-UI-005, AV-FLOW-001 |",
        )
        self.assertIn(
            "A01_RESPONSIBILITY_MISMATCH",
            self.codes(self.validate(texts={path: wrong_a01}, verify_hashes=False)),
        )

        missing_a05 = replace_once(corrected, "| A-05 | AV-FLOW-001 |", "| A-05 | AV-UI-005 |")
        self.assertIn(
            "FLOW001_A05_RESPONSIBILITY_MISSING",
            self.codes(self.validate(texts={path: missing_a05}, verify_hashes=False)),
        )

        missing_b03 = replace_once(corrected, "| B-03 | AV-FLOW-001, 002 |", "| B-03 | AV-FLOW-002 |")
        self.assertIn(
            "FLOW001_B03_RESPONSIBILITY_MISSING",
            self.codes(self.validate(texts={path: missing_b03}, verify_hashes=False)),
        )

        missing_a_gate = replace_once(corrected, "AV-FLOW-001, AV-STAT", "AV-STAT")
        self.assertIn(
            "FLOW001_A_GATE_MEMBERSHIP_MISSING",
            self.codes(self.validate(texts={path: missing_a_gate}, verify_hashes=False)),
        )

    def test_scenario_wrong_nonempty_av_package_gate_and_evidence_are_rejected(self):
        scenario_path = "tests/fault/scenarios/S49-17-01.json"
        scenario = json.loads((ROOT / scenario_path).read_text(encoding="utf-8"))
        mutations = {
            "SCENARIO_AV_TRACE_MISMATCH": {"verification_id": "AV-STAT-042"},
            "SCENARIO_PACKAGE_TRACE_MISMATCH": {"responsible_package": "G-07"},
            "SCENARIO_GATE_TRACE_MISMATCH": {"gate": "F Gate"},
            "SCENARIO_EVIDENCE_TRACE_MISMATCH": {"evidence_types": ["E-FAKE"]},
        }
        for expected_code, changes in mutations.items():
            with self.subTest(expected_code=expected_code):
                candidate = copy.deepcopy(scenario)
                candidate.update(changes)
                report = self.validate(json_docs={scenario_path: candidate}, verify_hashes=False)
                self.assertIn(expected_code, self.codes(report))

    def test_not_executed_fixture_cannot_be_promoted_to_gate_pass(self):
        scenario_path = "tests/fault/scenarios/S49-17-20.json"
        scenario = json.loads((ROOT / scenario_path).read_text(encoding="utf-8"))
        scenario["execution_status"] = "PASS"
        report = self.validate(json_docs={scenario_path: scenario}, verify_hashes=False)
        self.assertIn("SCENARIO_FALSE_PASS", self.codes(report))

    def test_dir_cumulative_trigger_and_state_drift_are_rejected(self):
        path = "Anvil_테스트계획서_v1.md"
        plan = (ROOT / path).read_text(encoding="utf-8")
        cumulative = replace_once(plan, "| **DIR-1** | A-15 완료 후, A Gate 승인 **직전** | 22 / 97 |", "| **DIR-1** | A-15 완료 후, A Gate 승인 **직전** | 23 / 97 |")
        self.assertIn("DIR_CONTRACT_MISMATCH", self.codes(self.validate(texts={path: cumulative}, verify_hashes=False)))

        rules_path = "docs/governance/ANVIL_OPERATING_RULES.md"
        rules = (ROOT / rules_path).read_text(encoding="utf-8")
        states = replace_once(rules, "`DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`", "`DIR_HOLD → REPORTING → CLEARED`")
        self.assertIn("DIR_STATE_CONTRACT_MISMATCH", self.codes(self.validate(texts={rules_path: states}, verify_hashes=False)))

    def test_environment_domain_pg_and_git_only_deployment_drift_are_rejected(self):
        path = "Anvil_테스트계획서_v1.md"
        plan = (ROOT / path).read_text(encoding="utf-8")
        domain = plan.replace("envil.sinsan.kr", "anvil.invalid.example")
        self.assertIn("ENVIRONMENT_CONTRACT_MISMATCH", self.codes(self.validate(texts={path: domain}, verify_hashes=False)))

        pg = replace_once(plan, "PostgreSQL 18 호환성 Release Candidate", "PostgreSQL 17 호환성 Release Candidate")
        self.assertIn("ENVIRONMENT_CONTRACT_MISMATCH", self.codes(self.validate(texts={path: pg}, verify_hashes=False)))

        deployment = replace_once(plan, "배포는 Git 이력만 사용하며", "배포는 파일 복사도 허용하며")
        self.assertIn("DEPLOYMENT_CONTRACT_MISMATCH", self.codes(self.validate(texts={path: deployment}, verify_hashes=False)))

    def test_g01_to_g06_acceptance_provenance_is_required(self):
        progress_path = "docs/progress/build-progress.json"
        progress = json.loads((ROOT / progress_path).read_text(encoding="utf-8"))
        progress["completed_packages"].remove("G-04")
        report = self.validate(json_docs={progress_path: progress}, verify_hashes=False)
        self.assertIn("PRIOR_ACCEPTANCE_MISSING", self.codes(report))

    def test_report_contains_exact_trace_hash_and_unverified_boundaries(self):
        report = self.validate()
        self.assertRegex(report["mapping_hash"], r"^[0-9A-F]{64}$")
        self.assertEqual(20, len(report["scenario_traces"]))
        self.assertIn("runtime_scenarios_20", report["unverified"])
        self.assertIn("product_api_ui_db_wsl_production", report["unverified"])

    def test_repository_reconciliation_and_failure_lineages_are_explicit(self):
        report = self.checker.validate_repository(ROOT, verify_git=True)
        self.assertEqual([], report["errors"])
        reconciliation = report["progress_reconciliation"]
        self.assertEqual("PACKAGE_COMPLETED", reconciliation["event_type"])
        self.assertEqual(
            "10149bcd6569bce539fabc980087b0ccec0f8a01",
            reconciliation["validated_base_commit"],
        )
        self.assertEqual(
            "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT", reconciliation["head_relation"]
        )
        self.assertEqual(report["git"]["changed_paths"], reconciliation["exact_allowed_paths"])
        self.assertEqual("B-01", report["failure_counts"]["active_lineage"])
        self.assertEqual(2, report["failure_counts"]["active_lineage_valid_failure_count"])
        self.assertEqual(11, report["failure_counts"]["historical_accepted_failure_total"])
        self.assertEqual(1, report["failure_counts"]["historical_by_lineage"]["A-13"])
        self.assertEqual(4, report["failure_counts"]["historical_by_lineage"]["A-14"])
        self.assertTrue(report["g_gate"]["a01_start_allowed"])
        self.assertEqual(
            [],
            report["g_gate"]["remaining_before_a01"],
        )
        self.assertEqual("A01_READY", report["g_gate"]["readiness"])

    def test_a02_start_is_the_latest_nonretroactive_repository_projection(self):
        events = json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
        projection = next(event for event in events if event["sequence"] == 46)
        self.assertEqual("PACKAGE_STARTED", projection["event_type"])
        self.assertEqual("1ace56384d55cbe11d34f2532e9f602d389a9512", projection["details"]["validated_base_commit"])
        self.assertEqual("ACTIVE", projection["details"]["package_status"])

    def test_a03_completion_history_and_current_upstream_are_separate(self):
        report = self.checker.validate_repository(ROOT, verify_git=True)
        self.assertEqual([], report["errors"])
        events = json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
        completion = next(event for event in events if event["sequence"] == 63)["details"]
        self.assertEqual("TEST_REVIEW", completion["package_status"])
        self.assertEqual(2, report["failure_counts"]["active_lineage_valid_failure_count"])
        self.assertEqual(1, report["failure_counts"]["historical_by_lineage"]["A-03"])
        self.assertEqual(1, report["failure_counts"]["historical_by_lineage"]["A-13"])
        self.assertEqual("dc2ba63e1d923663724d1291cbcec007e4e7e7fe", completion["validated_base_commit"])
        rc, current_upstream = self.checker._git(ROOT, "rev-parse", "@{u}")
        self.assertEqual(0, rc)
        self.assertEqual(current_upstream, report["git"]["upstream_head"])
        self.assertNotEqual(completion["validated_base_commit"], current_upstream)

    def test_repository_projection_accepts_only_exact_evidence_descendant(self):
        progress_path = "docs/progress/build-progress.json"
        events_path = "docs/progress/progress-events.json"
        progress = json.loads((ROOT / progress_path).read_text(encoding="utf-8"))
        event_stream = json.loads((ROOT / events_path).read_text(encoding="utf-8"))
        base = "853da76458929e007d8a02ab32f7f918ab26d590"
        head = "f" * 40
        allowed = ["docs/progress/build-progress.json"]
        projection = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
            "remote_head": head,
            "push_status": "PUSHED",
        }
        progress["repository"] = projection
        current_projection_event = next(
            event for event in reversed(event_stream["events"])
            if event.get("details", {}).get("projection_mode")
            == "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT"
        )
        current_projection_event["details"].update(projection)

        def fake_git(_root, *arguments):
            responses = {
                ("rev-parse", "HEAD"): (0, head),
                ("rev-parse", "@{u}"): (0, head),
                ("branch", "--show-current"): (0, "main"),
                ("merge-base", "--is-ancestor", base, head): (0, ""),
                ("diff", "--name-only", f"{base}..{head}"): (0, "docs/progress/build-progress.json"),
            }
            if arguments[:2] == ("log", "--format=%H"):
                return 0, "f" * 40
            if arguments in responses:
                return responses[arguments]
            raise AssertionError(f"unexpected git arguments: {arguments}")

        with mock.patch.object(self.checker, "_git", side_effect=fake_git):
            report = self.checker.validate_repository(
                ROOT,
                json_overrides={progress_path: progress, events_path: event_stream},
                verify_git=True,
            )
        self.assertNotIn("PROGRESS_REPOSITORY_STALE", self.codes(report))
        self.assertNotIn("PROGRESS_RECONCILIATION_MISMATCH", self.codes(report))
        self.assertNotIn("GIT_PROVENANCE_MISMATCH", self.codes(report))

        with mock.patch.object(
            self.checker,
            "_git",
            side_effect=lambda root, *args: (
                (0, "apps/api/anvil_api/main.py")
                if args == ("diff", "--name-only", f"{base}..{head}")
                else fake_git(root, *args)
            ),
        ):
            rejected = self.checker.validate_repository(
                ROOT,
                json_overrides={progress_path: progress, events_path: event_stream},
                verify_git=True,
            )
        self.assertIn("GIT_DESCENDANT_PATH_SET_MISMATCH", self.codes(rejected))

    def test_latest_git_push_rejects_divergent_local_and_remote_heads(self):
        progress_path = "docs/progress/build-progress.json"
        events_path = "docs/progress/progress-events.json"
        progress = json.loads((ROOT / progress_path).read_text(encoding="utf-8"))
        event_stream = json.loads((ROOT / events_path).read_text(encoding="utf-8"))
        validated_base = progress["repository"]["validated_base_commit"]
        local_head = "1" * 40
        remote_head = "2" * 40
        progress["repository"].update(
            {"branch": "main", "local_head": local_head, "remote_head": remote_head}
        )
        event_stream["events"].append(
            {
                "event_id": "evt-test-latest-divergent-push",
                "sequence": event_stream["last_sequence"] + 1,
                "event_type": "GIT_PUSH",
                "occurred_at": "2026-08-11T00:01:00+09:00",
                "actor": "main-agent-eoul",
                "subject_ref": "main",
                "details": {
                    "remote": "origin",
                    "branch": "main",
                    "local_commit": local_head,
                    "remote_commit": remote_head,
                    "evidence_ref": {"path": "evidence.json", "sha256": "A" * 64},
                },
            }
        )

        def fake_git(_root, *arguments):
            if arguments == ("rev-parse", "HEAD"):
                return 0, local_head
            if arguments == ("rev-parse", "@{u}"):
                return 0, remote_head
            if arguments == ("branch", "--show-current"):
                return 0, "main"
            if arguments == (
                "merge-base",
                "--is-ancestor",
                validated_base,
                local_head,
            ):
                return 1, ""
            if arguments == (
                "diff",
                "--name-only",
                f"{validated_base}..{local_head}",
            ):
                return 0, "docs/progress/build-progress.json"
            if arguments[:2] == ("log", "--format=%H"):
                return 0, "f" * 40
            raise AssertionError(f"unexpected git arguments: {arguments}")

        with mock.patch.object(self.checker, "_git", side_effect=fake_git):
            report = self.checker.validate_repository(
                ROOT,
                json_overrides={progress_path: progress, events_path: event_stream},
                verify_git=True,
            )

        self.assertIn("GIT_VALIDATED_BASE_NOT_ANCESTOR", self.codes(report))

    def test_evidence_manifest_recomputes_exact_delivered_target(self):
        errors = self.checker.validate_g07_manifest(ROOT, verify_live_raw=False)
        self.assertEqual([], errors)

        manifest = json.loads((ROOT / "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("approved", manifest["artifact_status"])
        self.assertEqual("ACCEPTED", manifest["package_status"])
        self.assertEqual("NOT_DECIDED", manifest["g_gate_status"])
        self.assertFalse(manifest["a01_start_allowed"])
        self.assertEqual(
            "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json",
            manifest["supersedes_artifact_ref"]["path"],
        )


if __name__ == "__main__":
    unittest.main()
