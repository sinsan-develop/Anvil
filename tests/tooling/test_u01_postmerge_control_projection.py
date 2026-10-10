"""Post-PR U-01 intake must preserve F-19A acceptance and lock product writes."""

from copy import deepcopy
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unittest
from unittest.mock import patch

from scripts import check_project_progress as checker


ROOT = Path(__file__).resolve().parents[2]
A = "a116dcd011cdfec3a0e50389976e2431e683209f"
TASK4_REPORT_A = "023369b5466466be1253d9273e7d67517f35c948"
TASK4_WSL_REPORT_A = "c3b51e2bb5c72b26b5b9bc1f852fb93918eb8280"
TASK4_REPORT_A_BLOBS = {
    "design_change.md": "9641b9b4740ef58fa239613cc53ba8fa323b231c",
    "docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md":
        "16758a3f1284b62751a9faebe1f64d3d30d0d247",
    "docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json":
        "891cd66adf260cfa7ec72c6a797b21b87e36a0ec",
}
PATHS = (
    "docs/progress/build-progress.json",
    "docs/progress/progress-events.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json",
)


class U01Task4Epoch106G05SuccessorTests(unittest.TestCase):
    """The epoch107 control route must bind the published A, not accept U-01."""

    @staticmethod
    def published_a():
        a = "1b02af90491a957efaa3c95b90631d06f88d6a61"
        files = {path: subprocess.check_output(["git", "show", f"{a}:{path}"],
            cwd=ROOT) for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(files[PATHS[0]])
        bundle["events"] = json.loads(files[PATHS[1]])
        bundle["handoff_text"] = files[PATHS[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(files[PATHS[3]])
        return bundle, files

    @staticmethod
    def checkpoint_b():
        bundle, files = U01Task4Epoch106G05SuccessorTests.published_a()
        progress = bundle["progress"]
        status = "U01_TASK4_EPOCH106_G05_CHECKPOINTED_CLOSE_READY"
        action = "U01_TASK4_EPOCH106_G05_CLOSE_ONLY"
        c = "c" * 40
        progress["u01_task4_epoch106_g05_successor_binding"].update(
            status=status, next_safe_action=action,
            a_docs_checkpoint="1b02af90491a957efaa3c95b90631d06f88d6a61",
            control_checkpoint=c)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=c, remote_head=c,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(datetime.fromisoformat(progress["updated_at"])
            + timedelta(minutes=1)).isoformat(), next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-epoch106-g05-checkpoint-seq2322")
        bundle["handoff"].update(repository_head=c, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def closed_h2(cls):
        bundle, files = cls.checkpoint_b()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_TASK4_EPOCH106_G05_COMPLETE_R6_SEPARATE_WI_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2323, "WRITE_LEASE_REVOKED", "evt_u01_2323_task4_epoch106_g05_write_lease_revoked",
             write, "write_fencing_token"),
            (2324, "WORKER_LEASE_REVOKED", "evt_u01_2324_task4_epoch106_g05_worker_lease_revoked",
             worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_TASK4_EPOCH106_G05_SUCCESSOR_CLOSE",
                "subject_ref": "U-01/TASK4-EPOCH106-G05-SUCCESSOR", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2324, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2322', '"last_sequence": 2324', 1)
        rendered = rendered.replace(
            '"last_event_id": "evt_u01_2322_task4_epoch106_g05_write_lease_issued"',
            '"last_event_id": "evt_u01_2324_task4_epoch106_g05_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_TASK4_EPOCH106_G05_CLOSED_R6_PENDING"
        action = "U01_TASK4_R6_SEPARATE_WI_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_task4_epoch106_g05_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_task4_epoch106_g05_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_task4_epoch106_g05_successor_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="b" * 40,
            event_sequence=2324)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2324,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-epoch106-g05-close-seq2324")
        progress["repository"].update(projection_mode="U01_TASK4_EPOCH106_G05_SUCCESSOR_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2324, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2324
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_published_a_validates_with_exact_new_events_and_active_lease(self):
        bundle, files = self.published_a()
        validator = getattr(checker, "_validate_u01_task4_epoch106_g05_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])

    def test_published_a_rejects_forged_event_lease_projection_and_acceptance(self):
        bundle, files = self.published_a()
        validator = getattr(checker, "_validate_u01_task4_epoch106_g05_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        for name, mutate in (
            ("event_kind", lambda b: b["events"]["events"][2320].update(
                event_type="WORK_INSTRUCTION_ISSUED")),
            ("event_previous", lambda b: b["events"]["events"][2322 - 1].update(
                previous_event_sha256="0" * 64)),
            ("event_actor", lambda b: b["events"]["events"][2319].update(actor_id="forged")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(
                execution_fencing_token="forged")),
            ("write_token", lambda b: b["progress"]["write_lease"].update(
                write_fencing_token="forged")),
            ("write_epoch", lambda b: b["progress"]["write_lease"].update(write_epoch=106)),
            ("scope", lambda b: b["progress"]["write_lease"].update(
                path_scope=["packages/api/fastapi_app.py"])),
            ("expiration", lambda b: b["progress"]["write_lease"].update(
                expires_at="2026-10-09T22:18:27+00:00")),
            ("acceptance", lambda b: b["progress"]["u01_task4_epoch106_g05_successor_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("production", lambda b: b["progress"]["u01_task4_epoch106_g05_successor_binding"].update(
                production="EXECUTED")),
            ("digest", lambda b: b["detached_digest"].update(self_reference=True)),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U02_READY")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                    forged["progress"])
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), name)

    def test_control_b_requires_exact_nonproduct_projection_and_digest(self):
        bundle, files = self.checkpoint_b()
        validator = checker._validate_u01_task4_epoch106_g05_active
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
        for name, mutate in (
            ("false_acceptance", lambda b: b["progress"]["u01_task4_epoch106_g05_successor_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("r7_a_swap", lambda b: b["progress"]["u01_task4_epoch106_g05_successor_binding"].update(
                two_pair_a_docs_checkpoint="87823219d27444c529fdeeb1625ffc04d116dafb")),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("digest", lambda b: b["detached_digest"]["progress"].update(file_sha256="0" * 64)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), name)

    def test_closed_h2_requires_ordered_revocations_and_frozen_b(self):
        bundle, files = self.closed_h2()
        validator = getattr(checker, "_validate_u01_task4_epoch106_g05_closed", None)
        self.assertIsNotNone(validator)
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
            for name, mutate in (
                ("revocation_order", lambda b: b["events"]["events"][2322].update(
                    event_type="WORKER_LEASE_REVOKED")),
                ("revocation_token", lambda b: b["events"]["events"][2322]["details"].update(
                    write_fencing_token="forged")),
                ("false_acceptance", lambda b: b["progress"]["u01_task4_epoch106_g05_successor_binding"].update(
                    vertical_acceptance="ACCEPTED")),
                ("u02_unlock", lambda b: b["progress"].update(next_safe_action="U02_READY")),
            ):
                with self.subTest(name=name):
                    forged = deepcopy(bundle)
                    mutate(forged)
                    forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                        forged["progress"])
                    self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), name)

    def test_git_control_b_and_close_require_exact_code_docs_and_remote(self):
        collector = getattr(checker, "_collect_u01_task4_epoch106_g05_successor_git", None)
        self.assertIsNotNone(collector)
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        a, c, b, h2 = "1b02af90491a957efaa3c95b90631d06f88d6a61", "c" * 40, "b" * 40, "d" * 40
        for closed, bundle in ((False, self.checkpoint_b()[0]), (True, self.closed_h2()[0])):
            head = h2 if closed else b
            legs = {(a, c): code, (c, b): docs}
            if closed:
                legs[(b, h2)] = docs | {"docs/progress/progress-events.json"}
            for scenario in ("published", "remote", "live_remote_missing",
                             "live_remote_unavailable", "live_remote_advanced",
                             "live_remote_diverged", "branch", "dirty", "missing_code",
                             "product", "merge", "diverged", "stale_control", "r7_blob"):
                with self.subTest(closed=closed, scenario=scenario):
                    def output(command, *args, **kwargs):
                        tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                            "-c", "core.quotePath=false"] else command[1:]
                        if tail == ["rev-parse", "HEAD"]:
                            return (head + "\n").encode()
                        if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                            return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                        if tail in (["ls-remote", "development", "refs/heads/codex/u01-dashboard-r2"],
                                    ["ls-remote", "--exit-code", "development",
                                     "refs/heads/codex/u01-dashboard-r2"]):
                            if scenario == "live_remote_unavailable":
                                raise subprocess.CalledProcessError(128, command)
                            if scenario == "live_remote_missing":
                                return b""
                            sha = ("e" * 40 if scenario == "live_remote_advanced" else
                                   "f" * 40 if scenario == "live_remote_diverged" else head)
                            return f"{sha}\trefs/heads/codex/u01-dashboard-r2\n".encode()
                        if tail == ["branch", "--show-current"]:
                            return ("main\n" if scenario == "branch" else
                                    "codex/u01-dashboard-r2\n").encode()
                        if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                            return b"development/codex/u01-dashboard-r2\n"
                        if tail == ["status", "--porcelain=v1", "-uall"]:
                            return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                        if tail[:3] == ["show", "-s", "--format=%P"]:
                            parents = {c: a, b: c, h2: b}
                            parent = parents[tail[-1]]
                            if scenario == "diverged" and tail[-1] == c:
                                parent = "0" * 40
                            return (parent + "\n").encode()
                        if tail[:2] == ["rev-list", "--count"]:
                            return b"1\n"
                        if tail[:2] == ["rev-list", "--min-parents=2"]:
                            return b"merge\n" if scenario == "merge" and tail[-1] == f"{a}..{c}" else b""
                        if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                            left, right = tail[-1].split("..")
                            selected = set(legs[(left, right)])
                            if scenario == "missing_code" and (left, right) == (a, c):
                                selected.remove("tests/tooling/test_u01_postmerge_control_projection.py")
                            if scenario == "product" and (left, right) == (c, b):
                                selected.add("apps/web/src/console/App.tsx")
                            return ("\n".join(sorted(selected)) + "\n").encode()
                        if tail[:2] == ["rev-parse", "87823219d27444c529fdeeb1625ffc04d116dafb:design_change.md"]:
                            return b"1" * 40 + b"\n"
                        if tail[:1] == ["rev-parse"] and ":" in tail[-1]:
                            return (("0" * 40 if scenario == "r7_blob" and tail[-1].startswith(head)
                                     else "1" * 40) + "\n").encode()
                        if tail[:1] == ["show"]:
                            for path in code:
                                if tail[-1] == f"{c}:{path}":
                                    return (b"stale" if scenario == "stale_control" else
                                            (ROOT / path).read_bytes())
                            if tail[-1] == f"{head}:docs/progress/build-progress.json":
                                return json.dumps(bundle["progress"]).encode()
                        raise AssertionError(f"unhandled git command: {tail}")
                    def run(command, *args, **kwargs):
                        if command[:3] == ["git", "diff", "--check"]:
                            return subprocess.CompletedProcess(command, 0)
                        raise AssertionError(f"unhandled git run: {command}")
                    with patch.object(subprocess, "check_output", side_effect=output), \
                            patch.object(subprocess, "run", side_effect=run):
                        result = collector(bundle)
                    self.assertEqual(bool(result), scenario != "published", result)

    def test_active_git_requires_live_private_remote(self):
        collector = checker._collect_u01_task4_epoch106_g05_active_git
        bundle, _ = self.published_a()
        expected = "1b02af90491a957efaa3c95b90631d06f88d6a61"
        original = subprocess.check_output
        for scenario in ("matching", "missing", "unavailable", "advanced", "diverged",
                         "stale_tracking"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    if command[-2:] == ["rev-parse", "HEAD"]:
                        return (expected + "\n").encode()
                    if command[-2:] == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "stale_tracking" else expected) + "\n").encode()
                    if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                        return b" M scripts/check_project_progress.py\n M tests/tooling/test_u01_postmerge_control_projection.py\n"
                    if command[:2] == ["git", "ls-remote"]:
                        if scenario == "unavailable":
                            raise subprocess.CalledProcessError(128, command)
                        if scenario == "missing":
                            return b""
                        sha = ("e" * 40 if scenario == "advanced" else
                               "f" * 40 if scenario == "diverged" else expected)
                        return f"{sha}\trefs/heads/codex/u01-dashboard-r2\n".encode()
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "matching", result)


class U01Task4Epoch107PostcloseFixtureTests(unittest.TestCase):
    """The epoch108 route binds frozen H2/R and never accepts U-01."""

    @staticmethod
    def issued_a():
        a = "39a4f4382d9105fbe2805b3f7440765268e2cf82"
        files = {path: subprocess.check_output(["git", "show", f"{a}:{path}"],
            cwd=ROOT) for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(files[PATHS[0]])
        bundle["events"] = json.loads(files[PATHS[1]])
        bundle["handoff_text"] = files[PATHS[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(files[PATHS[3]])
        return bundle, files

    @classmethod
    def checkpoint_b(cls):
        bundle, files = cls.issued_a()
        progress = bundle["progress"]
        status = "U01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_CHECKPOINTED_CLOSE_READY"
        action = "U01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_CLOSE_ONLY"
        c = "c" * 40
        progress["u01_task4_epoch107_postclose_fixture_binding"].update(
            status=status, next_safe_action=action,
            a_docs_checkpoint="39a4f4382d9105fbe2805b3f7440765268e2cf82",
            control_checkpoint=c)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=c, remote_head=c,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(datetime.fromisoformat(progress["updated_at"])
            + timedelta(minutes=1)).isoformat(), next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-epoch107-postclose-fixture-checkpoint-seq2327")
        bundle["handoff"].update(repository_head=c, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def closed_h3(cls):
        bundle, files = cls.checkpoint_b()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_COMPLETE_R6_SEPARATE_WI_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2328, "WRITE_LEASE_REVOKED",
             "evt_u01_2328_task4_epoch107_postclose_fixture_write_lease_revoked",
             write, "write_fencing_token"),
            (2329, "WORKER_LEASE_REVOKED",
             "evt_u01_2329_task4_epoch107_postclose_fixture_worker_lease_revoked",
             worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_CLOSE",
                "subject_ref": "U-01/TASK4-EPOCH107-POSTCLOSE-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2329, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2327', '"last_sequence": 2329', 1)
        rendered = rendered.replace(
            '"last_event_id": "evt_u01_2327_task4_epoch107_postclose_fixture_write_lease_issued"',
            '"last_event_id": "evt_u01_2329_task4_epoch107_postclose_fixture_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_CLOSED_R6_PENDING"
        action = "U01_TASK4_R6_SEPARATE_WI_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_task4_epoch107_postclose_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_task4_epoch107_postclose_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_task4_epoch107_postclose_fixture_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="b" * 40,
            event_sequence=2329)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2329,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-epoch107-postclose-fixture-close-seq2329")
        progress["repository"].update(projection_mode="U01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2329, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2329
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_active_binds_frozen_h2_r_a_and_epoch108_lease(self):
        bundle, files = self.issued_a()
        validator = getattr(checker, "_validate_u01_task4_epoch107_postclose_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])

    def test_checkpoint_b_accepts_only_exact_nonproduct_projection(self):
        bundle, files = self.checkpoint_b()
        validator = checker._validate_u01_task4_epoch107_postclose_active
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
        for name, mutate in (
            ("acceptance", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(vertical_acceptance="ACCEPTED")),
            ("h2_swap", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(h2_checkpoint="0" * 40)),
            ("digest", lambda b: b["detached_digest"]["progress"].update(file_sha256="0" * 64)),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), name)

    def test_closed_h3_requires_ordered_revocations_and_frozen_b(self):
        bundle, files = self.closed_h3()
        validator = getattr(checker, "_validate_u01_task4_epoch107_postclose_closed", None)
        self.assertIsNotNone(validator)
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
            for name, mutate in (
                ("order", lambda b: b["events"]["events"][2327].update(event_type="WORKER_LEASE_REVOKED")),
                ("token", lambda b: b["events"]["events"][2327]["details"].update(write_fencing_token="forged")),
                ("acceptance", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(vertical_acceptance="ACCEPTED")),
                ("release", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(release_decision="RELEASE")),
                ("production", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(production="EXECUTED")),
                ("u02", lambda b: b["progress"].update(next_safe_action="U02_READY")),
            ):
                with self.subTest(name=name):
                    forged = deepcopy(bundle)
                    mutate(forged)
                    forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                        forged["progress"])
                    self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), name)

    def test_postclose_git_b_and_h3_require_exact_code_docs_and_live_remote(self):
        collector = getattr(checker, "_collect_u01_task4_epoch107_postclose_successor_git", None)
        self.assertIsNotNone(collector)
        code = {"scripts/check_project_progress.py",
                "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
                "docs/progress/build-progress.json",
                "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        r_docs = {"design_change.md", "docs/WORK_STATUS.md",
                  "docs/04_test_reports/U-01_TASK4_EPOCH107_G05_WSL_CONTROL_QA_RESULT.md"}
        a_docs = {"docs/04_test_reports/U-01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_RECOVERY_PLAN.md",
                  "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
                  "docs/progress/build-progress.json", "docs/progress/progress-events.json",
                  "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json",
                  "docs/work_orders/U-01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_INVOCATION.md",
                  "docs/work_orders/U-01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_WORK_INSTRUCTION.md"}
        h2 = "d6cf8be5608eeb3ce438353a8184bb9b2e55cc20"
        r = "ee8647b2e6088e04099ab43fb38dfabd2e6048c5"
        a = "39a4f4382d9105fbe2805b3f7440765268e2cf82"
        c, b, h3 = "c" * 40, "b" * 40, "d" * 40
        for closed, bundle in ((False, self.checkpoint_b()[0]), (True, self.closed_h3()[0])):
            head = h3 if closed else b
            legs = {(h2, r): r_docs, (r, a): a_docs, (a, c): code, (c, b): docs}
            if closed:
                legs[(b, h3)] = docs | {"docs/progress/progress-events.json"}
            for scenario in ("published", "remote_missing", "remote_unavailable", "remote_advanced",
                             "remote_diverged", "stale_tracking", "branch", "dirty", "product",
                             "merge", "diverged", "stale_control", "r_blob"):
                with self.subTest(closed=closed, scenario=scenario):
                    def output(command, *args, **kwargs):
                        tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                            "-c", "core.quotePath=false"] else command[1:]
                        if tail == ["rev-parse", "HEAD"]:
                            return (head + "\n").encode()
                        if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                            return (("0" * 40 if scenario == "stale_tracking" else head) + "\n").encode()
                        if tail == ["branch", "--show-current"]:
                            return ("main\n" if scenario == "branch" else "codex/u01-dashboard-r2\n").encode()
                        if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                            return b"development/codex/u01-dashboard-r2\n"
                        if tail == ["remote", "get-url", "development"]:
                            return b"git@github-sinsan-develop:sinsan-develop/Anvil.git\n"
                        if tail == ["ls-remote", "--exit-code", "development",
                                    "refs/heads/codex/u01-dashboard-r2"]:
                            if scenario == "remote_unavailable":
                                raise subprocess.CalledProcessError(128, command)
                            if scenario == "remote_missing":
                                return b""
                            sha = ("e" * 40 if scenario == "remote_advanced" else
                                   "f" * 40 if scenario == "remote_diverged" else head)
                            return f"{sha}\trefs/heads/codex/u01-dashboard-r2\n".encode()
                        if tail == ["status", "--porcelain=v1", "-uall"]:
                            return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                        if tail[:3] == ["show", "-s", "--format=%P"]:
                            parents = {r: h2, a: r, c: a, b: c, h3: b}
                            parent = parents[tail[-1]]
                            if scenario == "diverged" and tail[-1] == c:
                                parent = "0" * 40
                            return (parent + "\n").encode()
                        if tail[:2] == ["rev-list", "--count"]:
                            return b"1\n"
                        if tail[:2] == ["rev-list", "--min-parents=2"]:
                            return b"merge\n" if scenario == "merge" and tail[-1] == f"{a}..{c}" else b""
                        if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                            left, right = tail[-1].split("..")
                            selected = set(legs[(left, right)])
                            if scenario == "product" and (left, right) == (c, b):
                                selected.add("apps/web/src/console/App.tsx")
                            return ("\n".join(sorted(selected)) + "\n").encode()
                        if tail[:1] == ["rev-parse"] and ":" in tail[-1]:
                            return (("0" * 40 if scenario == "r_blob" and tail[-1].startswith(head)
                                     else "1" * 40) + "\n").encode()
                        if tail[:1] == ["show"]:
                            for path in code:
                                if tail[-1] == f"{c}:{path}":
                                    return (b"stale" if scenario == "stale_control" else
                                            (ROOT / path).read_bytes())
                            if tail[-1] == f"{head}:docs/progress/build-progress.json":
                                return json.dumps(bundle["progress"]).encode()
                        raise AssertionError(f"unhandled git command: {tail}")
                    def run(command, *args, **kwargs):
                        if command[:3] == ["git", "diff", "--check"]:
                            return subprocess.CompletedProcess(command, 0)
                        raise AssertionError(f"unhandled git run: {command}")
                    with patch.object(subprocess, "check_output", side_effect=output), \
                            patch.object(subprocess, "run", side_effect=run):
                        result = collector(bundle)
                    self.assertEqual(bool(result), scenario != "published", (scenario, result))

    def test_g05_dispatches_b_and_h3_without_accepting_u01(self):
        b_bundle, b_files = self.checkpoint_b()
        h3_bundle, h3_files = self.closed_h3()
        active = checker._validate_u01_task4_epoch107_postclose_active
        closed = checker._validate_u01_task4_epoch107_postclose_closed
        original = subprocess.check_output
        def archived(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=archived), \
                patch.object(checker, "_collect_u01_task4_epoch107_postclose_successor_git",
                    return_value=[]):
            with patch.object(checker, "_validate_u01_task4_epoch107_postclose_active",
                    side_effect=lambda b: active(b, event_raw=b_files[PATHS[1]],
                        now=datetime.fromisoformat(b["progress"]["updated_at"]),
                        archived_files={PATHS[0]: b_files[PATHS[0]],
                                        PATHS[2]: b_files[PATHS[2]]})):
                self.assertEqual(checker.validate_bundle(b_bundle), [])
            with patch.object(checker, "_validate_u01_task4_epoch107_postclose_closed",
                    side_effect=lambda b: closed(b, event_raw=h3_files[PATHS[1]],
                        now=datetime.fromisoformat(b["progress"]["updated_at"]),
                        archived_files={PATHS[0]: h3_files[PATHS[0]],
                                        PATHS[2]: h3_files[PATHS[2]]})), \
                    patch.object(checker, "_validate_registry_refs", return_value=[]):
                self.assertEqual(checker.validate_bundle(h3_bundle), [])

    def test_active_rejects_event_lease_report_and_false_acceptance(self):
        bundle, files = self.issued_a()
        validator = getattr(checker, "_validate_u01_task4_epoch107_postclose_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2326].update(event_type="WORKER_LEASE_ISSUED")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(path_scope=["apps/web/page.tsx"])),
            ("expiry", lambda b: b["progress"]["worker_lease"].update(expires_at="2026-10-10T00:00:00Z")),
            ("report", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(report_sha256="0" * 64)),
            ("acceptance", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(vertical_acceptance="ACCEPTED")),
            ("release", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(release_decision="RELEASE")),
            ("production", lambda b: b["progress"]["u01_task4_epoch107_postclose_fixture_binding"].update(production="EXECUTED")),
            ("u02", lambda b: b["progress"].update(next_safe_action="U02_READY")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), name)

    def test_active_rejects_h2_raw_event_and_r_blob_tampering(self):
        bundle, files = self.issued_a()
        validator = checker._validate_u01_task4_epoch107_postclose_active
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        raw = files[PATHS[1]].replace(b'"event_id": "evt_',
            b'"event_id": "tampered_', 1)
        self.assertNotEqual(raw, files[PATHS[1]])
        self.assertTrue(validator(bundle, event_raw=raw, now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))
        original = subprocess.check_output
        report = "ee8647b2e6088e04099ab43fb38dfabd2e6048c5:docs/04_test_reports/U-01_TASK4_EPOCH107_G05_WSL_CONTROL_QA_RESULT.md"
        def tamper(command, *args, **kwargs):
            if command == ["git", "show", report]:
                return b"tampered report"
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=tamper):
            self.assertIn("U01_TASK4_POSTCLOSE_R_INVALID", validator(bundle,
                event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_active_git_requires_h2_r_a_and_live_private_remote(self):
        collector = getattr(checker, "_collect_u01_task4_epoch107_postclose_active_git", None)
        self.assertIsNotNone(collector)
        bundle, _ = self.issued_a()
        a = "39a4f4382d9105fbe2805b3f7440765268e2cf82"
        original = subprocess.check_output
        for scenario in ("matching", "remote_missing", "remote_unavailable", "remote_advanced",
                         "remote_diverged", "stale_tracking", "wrong_branch", "product_dirty",
                         "product_commit", "merge", "wrong_remote_url"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (a + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "stale_tracking" else a) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "wrong_branch":
                        return b"main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"] and scenario == "product_dirty":
                        return b" M packages/api/fastapi_app.py\n"
                    if tail == ["remote", "get-url", "development"] and scenario == "wrong_remote_url":
                        return b"git@example.invalid:other/Anvil.git\n"
                    if tail == ["ls-remote", "--exit-code", "development",
                                "refs/heads/codex/u01-dashboard-r2"]:
                        if scenario == "remote_unavailable":
                            raise subprocess.CalledProcessError(128, command)
                        if scenario == "remote_missing":
                            return b""
                        sha = ("e" * 40 if scenario == "remote_advanced" else
                               "f" * 40 if scenario == "remote_diverged" else a)
                        return f"{sha}\trefs/heads/codex/u01-dashboard-r2\n".encode()
                    if scenario == "product_commit" and tail == ["diff", "--name-only",
                            "--no-renames", "ee8647b2e6088e04099ab43fb38dfabd2e6048c5.." + a]:
                        return b"packages/api/fastapi_app.py\n"
                    if scenario == "merge" and tail == ["rev-list", "--min-parents=2",
                            "ee8647b2e6088e04099ab43fb38dfabd2e6048c5.." + a]:
                        return b"merge\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "matching", (scenario, result))


class U01Task4WslReportSuccessorTests(unittest.TestCase):
    @staticmethod
    def issued_a():
        archive = {path: subprocess.check_output(["git", "show", f"{TASK4_WSL_REPORT_A}:{path}"],
                    cwd=ROOT) for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(archive[PATHS[0]])
        bundle["events"] = json.loads(archive[PATHS[1]])
        bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive[PATHS[3]])
        return bundle, archive

    @classmethod
    def checkpoint_b(cls):
        bundle, files = cls.issued_a()
        progress = bundle["progress"]
        status = "U01_TASK4_WSL_REPORT_SUCCESSOR_CHECKPOINTED_CLOSE_READY"
        action = "U01_TASK4_WSL_REPORT_SUCCESSOR_CLOSE_ONLY"
        checkpoint = "c" * 40
        progress["u01_task4_wsl_report_successor_binding"].update(status=status,
            next_safe_action=action, a_docs_checkpoint=TASK4_WSL_REPORT_A,
            control_checkpoint=checkpoint)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(datetime.fromisoformat(progress["updated_at"])
            + timedelta(minutes=1)).isoformat(), next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-wsl-report-successor-checkpoint-seq2312")
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def closed_h2(cls):
        bundle, files = cls.checkpoint_b()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_TASK4_WSL_REPORT_SUCCESSOR_COMPLETE_TWO_PAIR_QA_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2313, "WRITE_LEASE_REVOKED", "evt_u01_2313_task4_wsl_report_successor_write_lease_revoked",
             write, "write_fencing_token"),
            (2314, "WORKER_LEASE_REVOKED", "evt_u01_2314_task4_wsl_report_successor_worker_lease_revoked",
             worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_TASK4_WSL_REPORT_SUCCESSOR_CLOSE",
                "subject_ref": "U-01/SCOPED-DASHBOARD-TASK4-WSL-REPORT-SUCCESSOR",
                "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2314, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2312', '"last_sequence": 2314', 1)
        rendered = rendered.replace(
            '"last_event_id": "evt_u01_2312_task4_wsl_report_successor_write_lease_issued"',
            '"last_event_id": "evt_u01_2314_task4_wsl_report_successor_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_TASK4_WSL_REPORT_SUCCESSOR_CLOSED_TWO_PAIR_QA_PENDING"
        action = "U01_SCOPED_DASHBOARD_TWO_PAIR_QA_DUAL_LEASE_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_task4_wsl_report_successor_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_task4_wsl_report_successor_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_task4_wsl_report_successor_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="b" * 40,
            event_sequence=2314)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2314,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-wsl-report-successor-close-seq2314")
        progress["repository"].update(projection_mode="U01_TASK4_WSL_REPORT_SUCCESSOR_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2314, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2314
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_closed_h2_requires_frozen_b_and_ordered_revocations(self):
        bundle, files = self.closed_h2()
        validator = getattr(checker, "_validate_u01_task4_wsl_report_successor_closed", None)
        self.assertIsNotNone(validator)
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])

    def test_closed_h2_rejects_revocation_acceptance_and_digest_forgery(self):
        bundle, files = self.closed_h2()
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        validator = checker._validate_u01_task4_wsl_report_successor_closed
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2312]["details"].update(reason="forged")),
            ("order", lambda b: b["events"]["events"][2312].update(event_type="WORKER_LEASE_REVOKED")),
            ("token", lambda b: b["progress"]["completed_u01_task4_wsl_report_successor_write_lease"].update(
                write_fencing_token="forged")),
            ("acceptance", lambda b: b["progress"]["u01_task4_wsl_report_successor_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("digest", lambda b: b["detached_digest"].update(self_reference=True)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                    forged["progress"])
                with patch.object(subprocess, "check_output", side_effect=frozen):
                    self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_closed_h2_git_requires_exact_b_and_docs_only_close(self):
        bundle, _ = self.closed_h2()
        _, b_files = self.checkpoint_b()
        collector = getattr(checker, "_collect_u01_task4_wsl_report_successor_closed_git", None)
        self.assertIsNotNone(collector)
        original, original_run = subprocess.check_output, subprocess.run
        a, c, b, h2 = TASK4_WSL_REPORT_A, "c" * 40, "b" * 40, "d" * 40
        control = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        close_docs = docs | {"docs/progress/progress-events.json"}
        frozen_head = {
            "design_change.md": "6dfa1de53640adb02b613116b91b02ebc91d3aaf",
            "docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md":
                "5de8cbcffd6dd34a5c8f04479671f57229ab56ea",
            "docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json":
                "336b0143b1774ddf99608f4eb150c0e228d55183",
        }
        for scenario in ("published", "product", "merge", "unpublished", "dirty", "stale_b"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (h2 + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "unpublished" else h2) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-parse"] and tail[-1].startswith("HEAD:"):
                        path = tail[-1].split(":", 1)[1]
                        return (frozen_head[path] + "\n").encode()
                    if tail == ["show", "-s", "--format=%P", c]:
                        return (a + "\n").encode()
                    if tail == ["show", "-s", "--format=%P", b]:
                        return (c + "\n").encode()
                    if tail == ["show", "-s", "--format=%P", h2]:
                        return (b + "\n").encode()
                    if tail in (["rev-list", "--count", f"{a}..{c}"],
                                ["rev-list", "--count", f"{c}..{b}"],
                                ["rev-list", "--count", f"{b}..{h2}"]):
                        return b"1\n"
                    if tail in (["rev-list", "--min-parents=2", f"{a}..{c}"],
                                ["rev-list", "--min-parents=2", f"{c}..{b}"],
                                ["rev-list", "--min-parents=2", f"{b}..{h2}"]):
                        return b"merge\n" if scenario == "merge" and tail[-1] == f"{b}..{h2}" else b""
                    if tail and tail[-1] in (f"{a}..{c}", f"{c}..{b}", f"{b}..{h2}") and tail[0] in ("log", "diff"):
                        selected = (control if tail[-1] == f"{a}..{c}" else
                            docs if tail[-1] == f"{c}..{b}" else close_docs)
                        selected = set(selected)
                        if scenario == "product" and tail[-1] == f"{b}..{h2}":
                            selected.add("apps/web/src/console/App.tsx")
                        return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in PATHS:
                            if tail[-1] == f"{b}:{path}":
                                return (b"{}" if scenario == "stale_b" and path == PATHS[0]
                                    else b_files[path])
                        for path in control:
                            if tail[-1] == f"{c}:{path}":
                                return (ROOT / path).read_bytes()
                        if tail[-1] == f"{h2}:docs/progress/build-progress.json":
                            return json.dumps(bundle["progress"]).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_checkpoint_b_requires_control_commit_and_exact_projection(self):
        bundle, files = self.checkpoint_b()
        validator = checker._validate_u01_task4_wsl_report_successor_active
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
        forged = deepcopy(bundle)
        forged["progress"]["updated_at"] = (datetime.fromisoformat(
            bundle["progress"]["worker_lease"]["issued_at"]) - timedelta(seconds=1)).isoformat()
        forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, deepcopy(files))
        self.assertTrue(validator(forged, event_raw=forged_files[PATHS[1]], now=now,
            archived_files={PATHS[0]: forged_files[PATHS[0]], PATHS[2]: forged_files[PATHS[2]]}))

    def test_checkpoint_b_git_rejects_product_merge_unpublished_and_dirty(self):
        bundle, _ = self.checkpoint_b()
        collector = checker._collect_u01_task4_wsl_report_successor_git
        original, original_run = subprocess.check_output, subprocess.run
        a, c, b = TASK4_WSL_REPORT_A, "c" * 40, "b" * 40
        control = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        frozen_head = {
            "design_change.md": "6dfa1de53640adb02b613116b91b02ebc91d3aaf",
            "docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md":
                "5de8cbcffd6dd34a5c8f04479671f57229ab56ea",
            "docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json":
                "336b0143b1774ddf99608f4eb150c0e228d55183",
        }
        for scenario in ("published", "product", "merge", "unpublished", "dirty"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (b + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "unpublished" else b) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-parse"] and tail[-1].startswith("HEAD:"):
                        path = tail[-1].split(":", 1)[1]
                        return (frozen_head[path] + "\n").encode()
                    if tail == ["show", "-s", "--format=%P", c]:
                        return (a + "\n").encode()
                    if tail == ["show", "-s", "--format=%P", b]:
                        return (c + "\n").encode()
                    if tail in (["rev-list", "--count", f"{a}..{c}"],
                                ["rev-list", "--count", f"{c}..{b}"]):
                        return b"1\n"
                    if tail in (["rev-list", "--min-parents=2", f"{a}..{c}"],
                                ["rev-list", "--min-parents=2", f"{c}..{b}"]):
                        return b"merge\n" if scenario == "merge" and tail[-1] == f"{c}..{b}" else b""
                    if tail and tail[-1] in (f"{a}..{c}", f"{c}..{b}") and tail[0] in ("log", "diff"):
                        selected = set(control if tail[-1] == f"{a}..{c}" else docs)
                        if scenario == "product" and tail[-1] == f"{c}..{b}":
                            selected |= {"apps/web/src/console/App.tsx"}
                        return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in control:
                            if tail[-1] == f"{c}:{path}":
                                return (ROOT / path).read_bytes()
                        if tail[-1] == f"{b}:docs/progress/build-progress.json":
                            return json.dumps(bundle["progress"]).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_issued_a_requires_frozen_h_r2_and_exact_event_lease(self):
        bundle, archive = self.issued_a()
        validator = getattr(checker, "_validate_u01_task4_wsl_report_successor_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])

    def test_issued_a_rejects_event_token_scope_hash_and_false_acceptance(self):
        bundle, archive = self.issued_a()
        validator = checker._validate_u01_task4_wsl_report_successor_active
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2311].update(actor="forged")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("expiry", lambda b: b["progress"]["worker_lease"].update(
                expires_at="2026-10-09T23:57:55+09:00")),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
            ("instruction", lambda b: b["progress"]["u01_task4_wsl_report_successor_binding"].update(
                work_instruction_sha256="0" * 64)),
            ("acceptance", lambda b: b["progress"]["u01_task4_wsl_report_successor_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("u02", lambda b: b["progress"].update(next_successor_work_package={
                "package_id": "U-02", "status": "READY"})),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                if name != "snapshot":
                    forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                        forged["progress"])
                self.assertTrue(validator(forged, event_raw=archive[PATHS[1]], now=issued,
                    archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}))

    def test_issued_a_git_requires_r2_exact_report_and_rejects_remote_dirty(self):
        bundle, _ = self.issued_a()
        collector = checker._collect_u01_task4_wsl_report_successor_git
        original = subprocess.check_output
        frozen_head = {
            "design_change.md": "6dfa1de53640adb02b613116b91b02ebc91d3aaf",
            "docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md":
                "5de8cbcffd6dd34a5c8f04479671f57229ab56ea",
            "docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json":
                "336b0143b1774ddf99608f4eb150c0e228d55183",
        }
        for scenario in ("published", "remote", "branch", "upstream", "dirty", "r2_blob"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (TASK4_WSL_REPORT_A + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else TASK4_WSL_REPORT_A) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"] and scenario == "upstream":
                        return b"origin/main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/fastapi_app.py\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b" M tests/tooling/test_u01_postmerge_control_projection.py\n")
                    if tail[:1] == ["rev-parse"] and tail[-1].startswith("HEAD:"):
                        path = tail[-1].split(":", 1)[1]
                        return (frozen_head[path] + "\n").encode()
                    if tail == ["rev-parse", "c023235e4e483e6e545ca4943c621d7df106a094:"
                                "docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md"] and scenario == "r2_blob":
                        return b"0" * 40 + b"\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")


class U01Task4ReportControlTests(unittest.TestCase):
    @staticmethod
    def active_a():
        archive = {path: subprocess.check_output(["git", "show", f"{TASK4_REPORT_A}:{path}"],
                    cwd=ROOT) for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(archive[PATHS[0]])
        bundle["events"] = json.loads(archive[PATHS[1]])
        bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive[PATHS[3]])
        return bundle, archive

    def test_issued_active_a_validates_exact_published_report_successor(self):
        bundle, archive = self.active_a()
        validator = getattr(checker, "_validate_u01_task4_report_control_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])

    def test_active_a_rejects_event_lease_hash_and_false_acceptance(self):
        bundle, files = self.active_a()
        validator = checker._validate_u01_task4_report_control_active
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2306].update(actor="forged")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
            ("instruction", lambda b: b["progress"]["u01_task4_report_control_binding"].update(
                work_instruction_sha256="0" * 64)),
            ("acceptance", lambda b: b["progress"]["u01_task4_report_control_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("u02", lambda b: b["progress"].update(next_successor_work_package={
                "package_id": "U-02", "status": "READY"})),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                if name not in ("snapshot",):
                    forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                        forged["progress"])
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=issued,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_published_a_git_rejects_remote_branch_dirty_and_report_blob(self):
        bundle, _ = self.active_a()
        collector = checker._collect_u01_task4_report_control_git
        original = subprocess.check_output
        for scenario in ("published", "remote", "branch", "upstream", "dirty", "report"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (TASK4_REPORT_A + "\n").encode()
                    if (len(tail) == 2 and tail[0] == "rev-parse"
                            and tail[1].startswith("HEAD:")
                            and tail[1][5:] in TASK4_REPORT_A_BLOBS):
                        return (TASK4_REPORT_A_BLOBS[tail[1][5:]] + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else TASK4_REPORT_A) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"] and scenario == "upstream":
                        return b"origin/main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/fastapi_app.py\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b" M tests/tooling/test_u01_postmerge_control_projection.py\n")
                    if tail == ["rev-parse", "1b732d79780d2ba986530f12db5baa183c690dda:"
                                "docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md"] and scenario == "report":
                        return b"0" * 40 + b"\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_checkpoint_b_git_requires_docs_only_single_successor(self):
        bundle, _ = self.checkpoint_b()
        collector = checker._collect_u01_task4_report_control_git
        original, original_run = subprocess.check_output, subprocess.run
        a, c, b = TASK4_REPORT_A, "c" * 40, "b" * 40
        control = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        for scenario in ("published", "product", "merge", "unpublished", "dirty"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (b + "\n").encode()
                    if (len(tail) == 2 and tail[0] == "rev-parse"
                            and tail[1].startswith("HEAD:")
                            and tail[1][5:] in TASK4_REPORT_A_BLOBS):
                        return (TASK4_REPORT_A_BLOBS[tail[1][5:]] + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "unpublished" else b) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail == ["show", "-s", "--format=%P", c]:
                        return (a + "\n").encode()
                    if tail == ["show", "-s", "--format=%P", b]:
                        return (c + "\n").encode()
                    if tail in (["rev-list", "--count", f"{a}..{c}"],
                                ["rev-list", "--count", f"{c}..{b}"]):
                        return b"1\n"
                    if tail in (["rev-list", "--min-parents=2", f"{a}..{c}"],
                                ["rev-list", "--min-parents=2", f"{c}..{b}"]):
                        return b"merge\n" if scenario == "merge" and tail[-1] == f"{c}..{b}" else b""
                    if tail and tail[-1] in (f"{a}..{c}", f"{c}..{b}") and tail[0] in ("log", "diff"):
                        selected = set(control if tail[-1] == f"{a}..{c}" else docs)
                        if scenario == "product" and tail[-1] == f"{c}..{b}":
                            selected |= {"apps/web/src/console/App.tsx"}
                        return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in control:
                            if tail[-1] == f"{c}:{path}":
                                return (ROOT / path).read_bytes()
                        if tail[-1] == f"{b}:docs/progress/build-progress.json":
                            return json.dumps(bundle["progress"]).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @classmethod
    def checkpoint_b(cls):
        bundle, files = cls.active_a()
        progress = bundle["progress"]
        status = "U01_TASK4_REPORT_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "U01_TASK4_REPORT_CONTROL_CLOSE_ONLY"
        checkpoint = "c" * 40
        progress["u01_task4_report_control_binding"].update(status=status,
            next_safe_action=action, a_docs_checkpoint=TASK4_REPORT_A,
            control_checkpoint=checkpoint)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(datetime.fromisoformat(progress["updated_at"])
            + timedelta(minutes=1)).isoformat(), next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-report-control-checkpoint-seq2307")
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def closed_h(cls):
        bundle, files = cls.checkpoint_b()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_TASK4_REPORT_CONTROL_COMPLETE_WSL_QA_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2308, "WRITE_LEASE_REVOKED", "evt_u01_2308_task4_report_control_write_lease_revoked",
             write, "write_fencing_token"),
            (2309, "WORKER_LEASE_REVOKED", "evt_u01_2309_task4_report_control_worker_lease_revoked",
             worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_TASK4_REPORT_CONTROL_CLOSE",
                "subject_ref": "U-01/SCOPED-DASHBOARD-TASK4-REPORT-CONTROL", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2309, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2307', '"last_sequence": 2309', 1)
        rendered = rendered.replace(
            '"last_event_id": "evt_u01_2307_task4_report_control_write_lease_issued"',
            '"last_event_id": "evt_u01_2309_task4_report_control_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_TASK4_REPORT_CONTROL_CLOSED_WSL_RETRY_PENDING"
        action = "U01_SCOPED_DASHBOARD_TASK4_WSL_QA_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_task4_report_control_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_task4_report_control_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_task4_report_control_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="b" * 40,
            event_sequence=2309)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2309,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-task4-report-control-close-seq2309")
        progress["repository"].update(projection_mode="U01_TASK4_REPORT_CONTROL_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2309, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2309
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_closed_h_requires_frozen_b_and_ordered_revocations(self):
        bundle, files = self.closed_h()
        validator = getattr(checker, "_validate_u01_task4_report_control_closed", None)
        self.assertIsNotNone(validator)
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])

    def test_closed_h_rejects_revocation_and_acceptance_forgery(self):
        bundle, files = self.closed_h()
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        validator = checker._validate_u01_task4_report_control_closed
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2307]["details"].update(reason="forged")),
            ("order", lambda b: b["events"]["events"][2307].update(
                event_type="WORKER_LEASE_REVOKED")),
            ("lease", lambda b: b["progress"]["completed_u01_task4_report_control_write_lease"].update(
                write_fencing_token="forged")),
            ("acceptance", lambda b: b["progress"]["u01_task4_report_control_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("digest", lambda b: b["detached_digest"].update(self_reference=True)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                    forged["progress"])
                with patch.object(subprocess, "check_output", side_effect=frozen):
                    self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_closed_h_rejects_time_before_published_b_even_when_rebound(self):
        bundle, files = self.closed_h()
        _, b_files = self.checkpoint_b()
        b_at = datetime.fromisoformat(json.loads(b_files[PATHS[0]])["updated_at"])
        early = (b_at - timedelta(seconds=1)).isoformat()
        old_at = bundle["progress"]["updated_at"]
        forged = deepcopy(bundle)
        forged_files = deepcopy(files)
        for row in forged["events"]["events"][-2:]:
            row["occurred_at"] = early
        old_hash = forged["events"]["events"][2308]["previous_event_sha256"]
        new_hash = hashlib.sha256(checker.canonical_json_bytes(
            forged["events"]["events"][2307])).hexdigest().upper()
        forged["events"]["events"][2308]["previous_event_sha256"] = new_hash
        raw = forged_files[PATHS[1]].decode().replace(f'"occurred_at": "{old_at}"',
            f'"occurred_at": "{early}"').replace(old_hash, new_hash)
        forged_files[PATHS[1]] = raw.encode()
        self.assertEqual(json.loads(forged_files[PATHS[1]]), forged["events"])
        forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_files[PATHS[1]]).hexdigest().upper()
        forged["progress"]["updated_at"] = early
        for key in ("completed_u01_task4_report_control_write_lease",
                    "completed_u01_task4_report_control_worker_lease"):
            forged["progress"][key]["revoked_at"] = early
        forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, forged_files)
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertTrue(checker._validate_u01_task4_report_control_closed(forged,
                event_raw=forged_files[PATHS[1]], now=b_at,
                archived_files={PATHS[0]: forged_files[PATHS[0]],
                                PATHS[2]: forged_files[PATHS[2]]}))

    def test_closed_h_rejects_rebound_event_footer_last_id(self):
        bundle, files = self.closed_h()
        _, b_files = self.checkpoint_b()
        forged, forged_files = deepcopy(bundle), deepcopy(files)
        original_id = forged["events"]["last_event_id"]
        forged["events"]["last_event_id"] = "forged-last-id"
        raw = forged_files[PATHS[1]].decode().replace(
            f'"last_event_id": "{original_id}"', '"last_event_id": "forged-last-id"', 1)
        forged_files[PATHS[1]] = raw.encode()
        self.assertEqual(json.loads(forged_files[PATHS[1]]), forged["events"])
        forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_files[PATHS[1]]).hexdigest().upper()
        forged["progress"]["last_event_id"] = "forged-last-id"
        forged["handoff"]["last_event_id"] = "forged-last-id"
        forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, forged_files)
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for path in PATHS:
                    if command[-1] == f"{'b' * 40}:{path}":
                        return b_files[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(forged["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertTrue(checker._validate_u01_task4_report_control_closed(forged,
                event_raw=forged_files[PATHS[1]], now=now,
                archived_files={PATHS[0]: forged_files[PATHS[0]],
                                PATHS[2]: forged_files[PATHS[2]]}))

    def test_closed_h_git_requires_exact_c_b_h_publications(self):
        bundle, _ = self.closed_h()
        _, b_files = self.checkpoint_b()
        collector = getattr(checker, "_collect_u01_task4_report_control_closed_git", None)
        self.assertIsNotNone(collector)
        original, original_run = subprocess.check_output, subprocess.run
        a = TASK4_REPORT_A
        c, b, h = "c" * 40, "b" * 40, "d" * 40
        control = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        close_docs = docs | {"docs/progress/progress-events.json"}
        for scenario in ("published", "remote", "dirty", "product", "merge", "stale_b"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (h + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else h) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/u01-dashboard-r2\n"
                    if tail == ["branch", "--show-current"]:
                        return b"codex/u01-dashboard-r2\n"
                    for left, right, selected in ((a, c, control), (c, b, docs),
                                                   (b, h, close_docs)):
                        pair = f"{left}..{right}"
                        if tail == ["show", "-s", "--format=%P", right]:
                            return (left + "\n").encode()
                        if tail == ["rev-list", "--count", pair]:
                            return b"1\n"
                        if tail == ["rev-list", "--min-parents=2", pair]:
                            return b"x\n" if scenario == "merge" and left == c else b""
                        if tail and tail[-1] == pair and tail[0] in ("log", "diff"):
                            paths = selected | ({"apps/web/src/console/App.tsx"}
                                if scenario == "product" and left == b else set())
                            return ("\n".join(sorted(paths)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in PATHS:
                            if tail[-1] == f"{b}:{path}":
                                return b"stale" if scenario == "stale_b" and path == PATHS[0] else b_files[path]
                        for path in control:
                            if tail[-1] == f"{c}:{path}":
                                return (ROOT / path).read_bytes()
                        if tail[-1] == f"{h}:docs/progress/build-progress.json":
                            return json.dumps(bundle["progress"]).encode()
                    if tail[:2] == ["rev-parse", "HEAD:design_change.md"]:
                        return b"9641b9b4740ef58fa239613cc53ba8fa323b231c\n"
                    if tail[:2] == ["rev-parse", "HEAD:docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md"]:
                        return b"16758a3f1284b62751a9faebe1f64d3d30d0d247\n"
                    if tail[:2] == ["rev-parse", "HEAD:docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json"]:
                        return b"891cd66adf260cfa7ec72c6a797b21b87e36a0ec\n"
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")


def archived_a():
    archive = {path: subprocess.check_output(["git", "show", f"{A}:{path}"], cwd=ROOT)
               for path in PATHS}
    bundle = deepcopy(checker.load_bundle(ROOT))
    bundle["progress"] = json.loads(archive[PATHS[0]])
    bundle["events"] = json.loads(archive[PATHS[1]])
    bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
    bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
    bundle["detached_digest"] = json.loads(archive[PATHS[3]])
    return bundle, archive


class U01PostmergeControlTests(unittest.TestCase):
    def test_archived_a_validates_real_event_and_lease(self):
        bundle, archive = archived_a()
        validator = getattr(checker, "_validate_u01_postmerge_control_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])

    def test_published_a_git_rejects_unrelated_dirty(self):
        bundle, _ = archived_a()
        collector = getattr(checker, "_collect_u01_postmerge_control_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("published", "remote", "dirty", "main", "pr_parent"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (A + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else A) + "\n").encode()
                    if tail == ["rev-parse", "development/main"] and scenario == "main":
                        return ("0" * 40 + "\n").encode()
                    if tail == ["show", "-s", "--format=%P",
                                "0443043251d25aa77c17d23165b7c9299c8dbeb8"] and scenario == "pr_parent":
                        return ("0" * 40 + " 096e6dfd695d9c8b4c7503bde751de83aca915ff\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M apps/web/src/console/App.tsx\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b"?? tests/tooling/test_u01_postmerge_control_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_legacy_dispatch_uses_postmerge_route_not_closed_branch(self):
        bundle, _ = archived_a()
        with patch.object(checker, "_collect_u01_postmerge_control_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_postmerge_control_git",
                          return_value=["U01_POSTMERGE_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_active_rejects_token_scope_event_and_acceptance_forgeries(self):
        bundle, archive = archived_a()
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        files = {PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}
        for name, mutate in (
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["U-01"])),
            ("u01_acceptance", lambda b: b["progress"]["u01_postmerge_control_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(
                release_decision="PASS")),
            ("event", lambda b: b["events"]["events"][2271].update(actor="forged")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(checker._validate_u01_postmerge_control_active(forged,
                    event_raw=archive[PATHS[1]], now=now, archived_files=files))

    @staticmethod
    def checkpoint_bundle():
        bundle, archive = archived_a()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "U01_POSTMERGE_CONTROL_CHECKPOINTED_REWORK_CLOSE_READY"
        action = "U01_POSTMERGE_CONTROL_REWORK_CLOSE_ONLY"
        progress["u01_postmerge_control_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=checkpoint,
            adjacent_regression="187_PASS_38_FAIL_EXIT1",
            rework_reason="HISTORICAL_GIT_FIXTURE_POSTMERGE_OBSERVATION_MISMATCH")
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["active_work_instruction"].update(result_status="U01_POSTMERGE_CONTROL_REWORK_CLOSE_READY",
            package_status=status)
        progress["next_work_package"]["status"] = status
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["snapshot_id"] = "snapshot-u01-postmerge-control-checkpoint-seq2272"
        progress["updated_at"] = (datetime.fromisoformat(progress["worker_lease"]["issued_at"])
            + timedelta(minutes=1)).isoformat()
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        progress_raw = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        handoff_raw = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        for section, raw in (("progress", progress_raw), ("handoff", handoff_raw)):
            bundle["detached_digest"][section].update(bytes=len(raw),
                file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_postmerge_archive"] = archive
        bundle["_postmerge_progress"] = progress_raw
        bundle["_postmerge_handoff"] = handoff_raw
        bundle["_postmerge_digest"] = (json.dumps(bundle["detached_digest"]) + "\n").encode()
        return bundle

    def test_checkpointed_projection_preserves_product_lock(self):
        bundle = self.checkpoint_bundle()
        archive = bundle["_postmerge_archive"]
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_u01_postmerge_control_active(candidate,
                event_raw=archive[PATHS[1]], now=now,
                archived_files={PATHS[0]: candidate["_postmerge_progress"],
                    PATHS[2]: candidate["_postmerge_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("missing_checkpoint", lambda b: b["progress"]["u01_postmerge_control_binding"].update(
                control_checkpoint=None)),
            ("product_write", lambda b: b["progress"]["repository"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("vertical_acceptance", lambda b: b["progress"]["u01_postmerge_control_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("fake_green", lambda b: b["progress"]["u01_postmerge_control_binding"].update(
                adjacent_regression="225_PASS_0_FAIL_EXIT0")),
            ("missing_rework_reason", lambda b: b["progress"]["u01_postmerge_control_binding"].pop(
                "rework_reason")),
            ("approval_action", lambda b: b["progress"].update(
                next_safe_action="U01_PUBLIC_API_CONTRACT_APPROVAL_PENDING")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged))

    def test_checkpointed_updated_at_must_be_within_active_lease_and_now(self):
        bundle = self.checkpoint_bundle()
        archive = bundle["_postmerge_archive"]
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        now = issued + timedelta(minutes=1)
        for name, updated_at in (
            ("future", (now + timedelta(minutes=1)).isoformat()),
            ("before_issued", (issued - timedelta(seconds=1)).isoformat()),
            ("at_expiry", bundle["progress"]["worker_lease"]["expires_at"]),
            ("naive", issued.replace(tzinfo=None).isoformat()),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                forged["progress"]["updated_at"] = updated_at
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                    forged["progress"])
                progress_raw = (json.dumps(forged["progress"], ensure_ascii=False) + "\n").encode()
                forged["detached_digest"]["progress"].update(bytes=len(progress_raw),
                    file_sha256=hashlib.sha256(progress_raw).hexdigest().upper())
                self.assertTrue(checker._validate_u01_postmerge_control_active(forged,
                    event_raw=archive[PATHS[1]], now=now,
                    archived_files={PATHS[0]: progress_raw,
                        PATHS[2]: forged["_postmerge_handoff"]}))

    def test_checkpointed_git_requires_exact_control_then_docs_only(self):
        bundle = self.checkpoint_bundle()
        collector = checker._collect_u01_postmerge_control_git
        checkpoint, publication = "c" * 40, "e" * 40
        control = ("scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "docs_in_control",
                         "product_in_docs", "missing_control", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else publication)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{A}..{checkpoint}", f"{checkpoint}..{publication}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{A}..{checkpoint}":
                        changed = control[:1] if scenario == "missing_control" and tail[0] == "diff" else control
                        extra = "\ndocs/WORK_STATUS.md" if scenario == "docs_in_control" else ""
                        return ("\n".join(changed) + extra + "\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return (b"packages/api/fastapi_app.py\n" if scenario == "product_in_docs"
                            else b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(checkpoint + ":"):
                        return (ROOT / tail[-1].split(":", 1)[1]).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"] and command[3] in (
                            A, checkpoint):
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @classmethod
    def closed_bundle(cls):
        bundle = cls.checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = deepcopy(progress["worker_lease"]), deepcopy(progress["write_lease"])
        at = (datetime.fromisoformat(worker["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "U01_POSTMERGE_CONTROL_NON_GREEN_HISTORICAL_FIXTURE_REWORK_PENDING"
        for sequence, kind, event_id, details in (
            (2273, "WRITE_LEASE_REVOKED", "evt_u01_2273_postmerge_control_write_lease_revoked",
             {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
              "reason": reason}),
            (2274, "WORKER_LEASE_REVOKED", "evt_u01_2274_postmerge_control_worker_lease_revoked",
             {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
              "reason": reason}),
        ):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_POSTMERGE_CONTROL_CLOSE",
                "subject_ref": "U-01/POSTMERGE-INTAKE-CONTROL", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(
                    checker.canonical_json_bytes(previous)).hexdigest().upper(), "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2274
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = bundle["_postmerge_archive"][PATHS[1]].decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_u01_2272_postmerge_control_write_lease_issued"\n}\n'
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_u01_2274_postmerge_control_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2272', '"last_sequence": 2274', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_u01_postmerge_control_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_postmerge_control_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        status = "U01_POSTMERGE_CONTROL_CLOSED_REWORK_PENDING"
        action = "U01_HISTORICAL_GIT_FIXTURE_REWORK_DUAL_LEASE_PENDING"
        progress["u01_postmerge_control_binding"].update(status=status, next_safe_action=action,
            active_projection_checkpoint="e" * 40, event_sequence=2274)
        progress["active_work_instruction"].update(
            result_status="INCOMPLETE_HISTORICAL_FIXTURE_REWORK_REQUIRED",
            package_status=status)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-postmerge-control-close-seq2274")
        progress["repository"].update(projection_mode="U01_POSTMERGE_CONTROL_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2274, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head="c" * 40,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2274
        progress_raw = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        handoff_raw = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        for section, data in (("progress", progress_raw), ("handoff", handoff_raw)):
            bundle["detached_digest"][section].update(bytes=len(data),
                file_sha256=hashlib.sha256(data).hexdigest().upper())
        return bundle, raw, progress_raw, handoff_raw

    def test_closed_revokes_exact_leases_and_keeps_u01_unaccepted(self):
        bundle, raw, progress_raw, handoff_raw = self.closed_bundle()
        validator = getattr(checker, "_validate_u01_postmerge_control_closed", None)
        self.assertIsNotNone(validator)
        publication = "e" * 40
        published = {PATHS[0]: bundle["_postmerge_progress"],
            PATHS[1]: bundle["_postmerge_archive"][PATHS[1]],
            PATHS[2]: bundle["_postmerge_handoff"], PATHS[3]: bundle["_postmerge_digest"]}
        original = subprocess.check_output
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1].startswith(publication + ":"):
                return published[command[-1].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        def validate(candidate, event=raw):
            with patch.object(subprocess, "check_output", side_effect=output):
                return validator(candidate, event_raw=event, now=now,
                    archived_files={PATHS[0]: progress_raw, PATHS[2]: handoff_raw})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("vertical_acceptance", lambda b: b["progress"]["u01_postmerge_control_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("product_write", lambda b: b["progress"]["repository"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("missing_revoke", lambda b: b["progress"].update(
                completed_u01_postmerge_control_write_lease=None)),
            ("fake_green", lambda b: b["progress"]["u01_postmerge_control_binding"].update(
                adjacent_regression="225_PASS_0_FAIL_EXIT0")),
            ("accepted_wi", lambda b: b["progress"]["active_work_instruction"].update(
                result_status="ACCEPTED")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged))

    def test_closed_git_requires_published_b_and_one_docs_only_h(self):
        bundle, _, progress_raw, _ = self.closed_bundle()
        collector = getattr(checker, "_collect_u01_postmerge_control_closed_git", None)
        self.assertIsNotNone(collector)
        checkpoint, publication, close_head = "c" * 40, "e" * 40, "d" * 40
        control = ("scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py")
        published = {PATHS[0]: bundle["_postmerge_progress"],
            PATHS[1]: bundle["_postmerge_archive"][PATHS[1]],
            PATHS[2]: bundle["_postmerge_handoff"], PATHS[3]: bundle["_postmerge_digest"]}
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "product_close", "stale_b"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else close_head)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{A}..{checkpoint}", f"{checkpoint}..{close_head}",
                            f"{checkpoint}..{publication}", f"{publication}..{close_head}"):
                        return b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] == f"{publication}..{close_head}":
                        return b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{A}..{checkpoint}":
                        return ("\n".join(control) + "\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] in (
                            f"{checkpoint}..{publication}", f"{checkpoint}..{close_head}",
                            f"{publication}..{close_head}"):
                        return (b"packages/api/fastapi_app.py\n" if scenario == "product_close"
                            and tail[-1] == f"{publication}..{close_head}"
                            else b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(checkpoint + ":"):
                        return (ROOT / tail[-1].split(":", 1)[1]).read_bytes()
                    if tail[:1] == ["show"] and tail[-1].startswith(publication + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_b" and path == PATHS[0] else published[path]
                    if tail == ["show", f"{close_head}:{PATHS[0]}"]:
                        return progress_raw
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"] and command[3] in (
                            A, checkpoint, publication):
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_closed_legacy_dispatch_never_uses_old_branch_collector(self):
        bundle, _, _, _ = self.closed_bundle()
        with patch.object(checker, "_collect_u01_postmerge_control_closed_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_postmerge_control_closed_git",
                          return_value=["U01_POSTMERGE_CLOSE_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])


class U01HistoricalGitFixtureEpoch98Tests(unittest.TestCase):
    A98 = "46ef1305f21b21f90e2de69b1e76085b6327ccdb"
    CONTROL = "c" * 40
    PUBLICATION = "b" * 40

    @classmethod
    def active_a(cls):
        archive = {path: subprocess.check_output(["git", "show", f"{cls.A98}:{path}"], cwd=ROOT)
                   for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(archive[PATHS[0]])
        bundle["events"] = json.loads(archive[PATHS[1]])
        bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive[PATHS[3]])
        return bundle, archive

    def test_epoch98_active_a_requires_exact_published_event_lease_and_git(self):
        bundle, archive = self.active_a()
        validator = getattr(checker, "_validate_u01_historical_git_fixture_active", None)
        collector = getattr(checker, "_collect_u01_historical_git_fixture_git", None)
        self.assertIsNotNone(validator)
        self.assertIsNotNone(collector)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])
        # The A98 bundle must observe A98's published Git state, not today's
        # successor checkout. Keep the real current observation fail-closed.
        self.assertTrue(collector(bundle))
        original = subprocess.check_output

        def at_a98(command, *args, **kwargs):
            tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                "-c", "core.quotePath=false"] else command[1:]
            if tail in (["rev-parse", "HEAD"],
                        ["rev-parse", "development/codex/u01-dashboard-r2"]):
                return (self.A98 + "\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return b""
            return original(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=at_a98):
            self.assertEqual(collector(bundle), [])

    def test_epoch98_active_rejects_forged_scope_token_and_event(self):
        bundle, archive = self.active_a()
        validator = getattr(checker, "_validate_u01_historical_git_fixture_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        for name, mutate in (
            ("product_scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("write_token", lambda b: b["progress"]["write_lease"].update(
                write_fencing_token="forged")),
            ("accepted", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("event", lambda b: b["events"]["events"][2276].update(actor="forged")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validator(forged, event_raw=archive[PATHS[1]], now=issued,
                    archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}))

    @classmethod
    def checkpoint_b(cls):
        bundle, archive = cls.active_a()
        progress = bundle["progress"]
        status = "U01_HISTORICAL_GIT_FIXTURE_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "U01_HISTORICAL_GIT_FIXTURE_CLOSE_ONLY"
        at = (datetime.fromisoformat(progress["worker_lease"]["issued_at"])
            + timedelta(minutes=5)).isoformat()
        progress["u01_historical_git_fixture_rework_binding"].update(
            status=status, next_safe_action=action, control_checkpoint=cls.CONTROL,
            adjacent_regression="250_PASS_0_FAIL_EXIT0")
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(updated_at=at, snapshot_id="snapshot-u01-historical-git-fixture-control-seq2277",
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status})
        progress["repository"].update(local_head=cls.CONTROL, remote_head=cls.CONTROL,
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=cls.CONTROL, next_safe_action=action)
        progress_raw = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        handoff_raw = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        for section, data in (("progress", progress_raw), ("handoff", handoff_raw)):
            bundle["detached_digest"][section].update(bytes=len(data),
                file_sha256=hashlib.sha256(data).hexdigest().upper())
        return bundle, archive, progress_raw, handoff_raw

    def test_epoch98_checkpoint_b_is_exact_close_only_and_rejects_forgery(self):
        bundle, archive, progress_raw, handoff_raw = self.checkpoint_b()
        validator = getattr(checker, "_validate_u01_historical_git_fixture_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        def validate(candidate):
            return validator(candidate, event_raw=archive[PATHS[1]], now=now,
                archived_files={PATHS[0]: progress_raw, PATHS[2]: handoff_raw})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("product_scope", lambda b: b["progress"]["repository"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("api", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                public_api_contract="APPROVED")),
            ("dirty_digest", lambda b: b["detached_digest"]["progress"].update(file_sha256="0" * 64)),
            ("wrong_checkpoint", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                control_checkpoint="0" * 40)),
            ("not_green", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                adjacent_regression="187_PASS_38_FAIL_EXIT1")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged))

    def test_epoch98_checkpoint_git_requires_exact_code_then_docs_only(self):
        bundle, _, _, _ = self.checkpoint_b()
        collector = checker._collect_u01_historical_git_fixture_git
        code = tuple(bundle["progress"]["u01_historical_git_fixture_rework_binding"][
            "developer_exact_paths"])
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "product_code", "product_docs",
                         "missing_checker", "stale_blob", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else self.PUBLICATION
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{self.A98}..{self.CONTROL}", f"{self.CONTROL}..{self.PUBLICATION}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] == f"{self.CONTROL}..{self.PUBLICATION}":
                        return b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.A98}..{self.CONTROL}":
                        changed = code[1:] if scenario == "missing_checker" and tail[0] == "diff" else code
                        extra = "packages/api/runtime.py\n" if scenario == "product_code" else ""
                        return ("\n".join(changed) + "\n" + extra).encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.CONTROL}..{self.PUBLICATION}":
                        return (b"packages/api/runtime.py\n" if scenario == "product_docs"
                            else b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == code[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"] and command[3] in (
                            self.A98, self.CONTROL):
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @classmethod
    def closed_h(cls):
        bundle, archive, b_progress_raw, b_handoff_raw = cls.checkpoint_b()
        b_digest_raw = (json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        b_raw = archive[PATHS[1]]
        published = {PATHS[0]: b_progress_raw, PATHS[1]: b_raw,
            PATHS[2]: b_handoff_raw, PATHS[3]: b_digest_raw}
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = deepcopy(progress["worker_lease"]), deepcopy(progress["write_lease"])
        at = (datetime.fromisoformat(worker["issued_at"]) + timedelta(minutes=8)).isoformat()
        reason = "U01_HISTORICAL_GIT_FIXTURE_REWORK_COMPLETE_PUBLIC_API_APPROVAL_PENDING"
        for sequence, kind, event_id, details in (
            (2278, "WRITE_LEASE_REVOKED", "evt_u01_2278_historical_git_fixture_write_lease_revoked",
             {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
              "reason": reason}),
            (2279, "WORKER_LEASE_REVOKED", "evt_u01_2279_historical_git_fixture_worker_lease_revoked",
             {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
              "reason": reason}),
        ):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_HISTORICAL_GIT_FIXTURE_REWORK_CLOSE",
                "subject_ref": "U-01/HISTORICAL-GIT-FIXTURE-REWORK", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(
                    checker.canonical_json_bytes(previous)).hexdigest().upper(), "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2279
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = b_raw.decode("utf-8")
        old_id = archive[PATHS[1]] and json.loads(b_raw)["last_event_id"]
        footer = '\n  ],\n  "last_event_id": "' + old_id + '"\n}\n'
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_u01_2279_historical_git_fixture_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2277', '"last_sequence": 2279', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_u01_historical_git_fixture_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_historical_git_fixture_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        status = "U01_HISTORICAL_GIT_FIXTURE_CLOSED_PUBLIC_API_APPROVAL_PENDING"
        action = "U01_PUBLIC_API_CONTRACT_APPROVAL_PENDING"
        progress["u01_historical_git_fixture_rework_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint=cls.PUBLICATION, event_sequence=2279)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-historical-git-fixture-close-seq2279")
        progress["repository"].update(projection_mode="U01_HISTORICAL_GIT_FIXTURE_REWORK_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2279, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head=cls.CONTROL, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2279
        progress_raw = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        handoff_raw = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        for section, data in (("progress", progress_raw), ("handoff", handoff_raw)):
            bundle["detached_digest"][section].update(bytes=len(data),
                file_sha256=hashlib.sha256(data).hexdigest().upper())
        return bundle, raw, published, progress_raw, handoff_raw

    def test_epoch98_closed_requires_revocation_and_unaccepted_public_api(self):
        bundle, raw, published, progress_raw, handoff_raw = self.closed_h()
        validator = getattr(checker, "_validate_u01_historical_git_fixture_closed", None)
        self.assertIsNotNone(validator)
        original = subprocess.check_output
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1].startswith(self.PUBLICATION + ":"):
                return published[command[-1].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        def validate(candidate, event=raw):
            with patch.object(subprocess, "check_output", side_effect=output):
                return validator(candidate, event_raw=event, now=now,
                    archived_files={PATHS[0]: progress_raw, PATHS[2]: handoff_raw})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("vertical_accepted", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("api_approved", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                public_api_contract="APPROVED")),
            ("product_write", lambda b: b["progress"]["repository"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("missing_revoke", lambda b: b["progress"].update(
                completed_u01_historical_git_fixture_write_lease=None)),
            ("bad_event", lambda b: b["events"]["events"][2278].update(actor="forged")),
            ("stale_b", lambda b: b["progress"]["u01_historical_git_fixture_rework_binding"].update(
                active_projection_checkpoint="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged))

    def test_epoch98_closed_git_requires_b_and_exact_docs_only_h(self):
        bundle, _, published, progress_raw, _ = self.closed_h()
        collector = getattr(checker, "_collect_u01_historical_git_fixture_closed_git", None)
        self.assertIsNotNone(collector)
        head = "d" * 40
        code = tuple(bundle["progress"]["u01_historical_git_fixture_rework_binding"][
            "developer_exact_paths"])
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "product_code", "product_b",
                         "product_h", "stale_b", "merge", "extra_close"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{self.A98}..{self.CONTROL}", f"{self.CONTROL}..{self.PUBLICATION}",
                            f"{self.PUBLICATION}..{head}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] in (
                            f"{self.CONTROL}..{self.PUBLICATION}", f"{self.PUBLICATION}..{head}"):
                        return b"2\n" if scenario == "extra_close" and tail[-1].startswith(self.PUBLICATION) else b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.A98}..{self.CONTROL}":
                        extra = "packages/api/runtime.py\n" if scenario == "product_code" else ""
                        return ("\n".join(code) + "\n" + extra).encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] in (
                            f"{self.CONTROL}..{self.PUBLICATION}", f"{self.PUBLICATION}..{head}"):
                        return (b"packages/api/runtime.py\n" if scenario in ("product_b", "product_h")
                            and ((scenario == "product_b") == tail[-1].startswith(self.CONTROL))
                            else b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL + ":"):
                        return (ROOT / tail[-1].split(":", 1)[1]).read_bytes()
                    if tail[:1] == ["show"] and tail[-1].startswith(self.PUBLICATION + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_b" and path == PATHS[0] else published[path]
                    if tail == ["show", f"{head}:{PATHS[0]}"]:
                        return progress_raw
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"] and command[3] in (
                            self.A98, self.CONTROL, self.PUBLICATION):
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")


A100 = "da123eda8f5e22dca9dc7b4efd2fa606eaae6d6e"
H99 = "4d6cba41b5f1d9269572ba454c7165063f38d9a7"


def archived_epoch100():
    archive = {path: subprocess.check_output(["git", "show", f"{A100}:{path}"], cwd=ROOT)
               for path in PATHS}
    bundle = deepcopy(checker.load_bundle(ROOT))
    bundle["progress"] = json.loads(archive[PATHS[0]])
    bundle["events"] = json.loads(archive[PATHS[1]])
    bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
    bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
    bundle["detached_digest"] = json.loads(archive[PATHS[3]])
    return bundle, archive


class U01ScopedDashboardHistoricalFixtureEpoch100Tests(unittest.TestCase):
    CONTROL100 = "c" * 40
    PUBLICATION100 = "b" * 40

    @classmethod
    def checkpoint_b(cls):
        bundle, files = archived_epoch100()
        progress = bundle["progress"]
        issued = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
        status = "U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_CHECKPOINTED_CLOSE_READY"
        action = "U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_CLOSE_ONLY"
        progress["u01_scoped_dashboard_historical_fixture_binding"].update(
            status=status, next_safe_action=action, control_checkpoint=cls.CONTROL100,
            adjacent_regression="250_PASS_0_FAIL_EXIT0")
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.CONTROL100, remote_head=cls.CONTROL100,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(issued + timedelta(minutes=1)).isoformat(),
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-historical-fixture-control-seq2287")
        bundle["handoff"].update(repository_head=cls.CONTROL100, next_safe_action=action)
        return cls.materialize(bundle, files)

    @staticmethod
    def materialize(bundle, files):
        progress = bundle["progress"]
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff_text"] = re.sub(r"```json anvil-recovery-summary\n.*?\n```",
            "```json anvil-recovery-summary\n" + json.dumps(bundle["handoff"], indent=2)
            + "\n```", bundle["handoff_text"], count=1, flags=re.DOTALL)
        files[PATHS[0]] = (json.dumps(progress, ensure_ascii=False, indent=2) + "\n").encode()
        files[PATHS[2]] = bundle["handoff_text"].encode()
        for section, path in (("progress", PATHS[0]), ("handoff", PATHS[2])):
            bundle["detached_digest"][section].update(bytes=len(files[path]),
                file_sha256=hashlib.sha256(files[path]).hexdigest().upper())
        files[PATHS[3]] = (json.dumps(bundle["detached_digest"], ensure_ascii=False,
            indent=2) + "\n").encode()
        return bundle, files

    def test_checkpoint_b_requires_exact_nonproduct_green_projection(self):
        bundle, files = self.checkpoint_b()
        validate = checker._validate_u01_scoped_dashboard_historical_active
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        self.assertEqual(validate(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
        for name, mutate in (
            ("regression", lambda p: p["u01_scoped_dashboard_historical_fixture_binding"].update(
                adjacent_regression="235_PASS_1_FAIL_EXIT1")),
            ("product", lambda p: p["repository"].update(product_write_scope=["apps/web/src/console/App.tsx"])),
            ("api", lambda p: p["u01_scoped_dashboard_historical_fixture_binding"].update(
                public_api_contract="APPROVED")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged["progress"])
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_checkpoint_b_git_requires_exact_code_and_docs_only(self):
        bundle, files = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_historical_git
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        for scenario in ("published", "remote", "dirty", "product_code", "product_docs",
                         "stale_code", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else self.PUBLICATION100)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{A100}..{self.CONTROL100}",
                            f"{self.CONTROL100}..{self.PUBLICATION100}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] in (
                            f"{A100}..{self.CONTROL100}",
                            f"{self.CONTROL100}..{self.PUBLICATION100}"):
                        return b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{A100}..{self.CONTROL100}":
                        extra = {"apps/web/src/console/App.tsx"} if scenario == "product_code" else set()
                        return ("\n".join(sorted(code | extra)) + "\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.CONTROL100}..{self.PUBLICATION100}":
                        return (b"apps/web/src/console/App.tsx\n" if scenario == "product_docs"
                            else b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL100 + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_code" and path in code else (ROOT / path).read_bytes()
                    if tail == ["show", f"{self.PUBLICATION100}:{PATHS[0]}"]:
                        return files[PATHS[0]]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @classmethod
    def closed_h(cls):
        bundle, files = cls.checkpoint_b()
        progress, stream = bundle["progress"], bundle["events"]
        write, worker = progress["write_lease"], progress["worker_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_GREEN_CONTROL_CLOSED_PRODUCT_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2288, "WRITE_LEASE_REVOKED",
                "evt_u01_2288_scoped_dashboard_historical_fixture_write_lease_revoked",
                write, "write_fencing_token"),
            (2289, "WORKER_LEASE_REVOKED",
                "evt_u01_2289_scoped_dashboard_historical_fixture_worker_lease_revoked",
                worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_CLOSE",
                "subject_ref": "U-01/SCOPED-DASHBOARD-HISTORICAL-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2289, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2287', '"last_sequence": 2289', 1)
        rendered = rendered.replace('"last_event_id": "evt_u01_2287_scoped_dashboard_historical_fixture_write_lease_issued"',
            '"last_event_id": "evt_u01_2289_scoped_dashboard_historical_fixture_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_CLOSED_PRODUCT_DUAL_LEASE_PENDING"
        action = "U01_SCOPED_DASHBOARD_PRODUCT_DUAL_LEASE_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_scoped_dashboard_historical_fixture_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_scoped_dashboard_historical_fixture_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_scoped_dashboard_historical_fixture_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint=cls.PUBLICATION100,
            event_sequence=2289)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2289,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-historical-fixture-close-seq2289")
        progress["repository"].update(
            projection_mode="U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2289, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2289
        bundle, files = cls.materialize(bundle, files)
        return bundle, files

    def test_closed_h_requires_ordered_revocations_and_unaccepted_product(self):
        bundle, files = self.closed_h()
        _, b_files = self.checkpoint_b()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_historical_closed", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        def validate(candidate, candidate_files=files):
            with patch.object(subprocess, "check_output", side_effect=self.frozen_b_output(b_files)):
                return validator(candidate, event_raw=candidate_files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: candidate_files[PATHS[0]],
                        PATHS[2]: candidate_files[PATHS[2]]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2288].update(actor="forged")),
            ("lease", lambda b: b["progress"].update(
                completed_u01_scoped_dashboard_historical_fixture_write_lease=None)),
            ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_historical_fixture_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("product", lambda b: b["progress"]["repository"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("checkpoint", lambda b: b["progress"]["u01_scoped_dashboard_historical_fixture_binding"].update(
                active_projection_checkpoint="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)
        forged, forged_files = deepcopy(bundle), deepcopy(files)
        published_at = datetime.fromisoformat(json.loads(b_files[PATHS[0]])["updated_at"])
        early = (published_at - timedelta(seconds=1)).isoformat()
        old = forged["events"]["events"][2287]["occurred_at"]
        old_hash = forged["events"]["events"][2288]["previous_event_sha256"]
        for row in forged["events"]["events"][2287:2289]:
            row["occurred_at"] = early
        new_hash = hashlib.sha256(checker.canonical_json_bytes(
            forged["events"]["events"][2287])).hexdigest().upper()
        forged["events"]["events"][2288]["previous_event_sha256"] = new_hash
        forged_files[PATHS[1]] = forged_files[PATHS[1]].replace(
            old.encode(), early.encode()).replace(old_hash.encode(), new_hash.encode())
        self.assertEqual(json.loads(forged_files[PATHS[1]]), forged["events"])
        forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_files[PATHS[1]]).hexdigest().upper()
        forged["progress"]["updated_at"] = early
        for key in ("completed_u01_scoped_dashboard_historical_fixture_write_lease",
                    "completed_u01_scoped_dashboard_historical_fixture_worker_lease"):
            forged["progress"][key]["revoked_at"] = early
        forged, forged_files = self.materialize(forged, forged_files)
        self.assertIn("U01_SCOPED_HISTORY_CLOSE_EVENT_INVALID", validate(forged, forged_files))

    def test_closed_h_git_requires_b_then_exact_docs_only(self):
        bundle, files = self.closed_h()
        _, b_files = self.checkpoint_b()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_historical_closed_git", None)
        self.assertIsNotNone(collector)
        head = "d" * 40
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        for scenario in ("published", "remote", "dirty", "product_code", "product_b",
                         "product_h", "stale_b", "merge", "extra_close"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{A100}..{self.CONTROL100}", f"{self.CONTROL100}..{self.PUBLICATION100}",
                            f"{self.PUBLICATION100}..{head}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] in (
                            f"{A100}..{self.CONTROL100}", f"{self.CONTROL100}..{self.PUBLICATION100}",
                            f"{self.PUBLICATION100}..{head}"):
                        return b"2\n" if scenario == "extra_close" and tail[-1].startswith(self.PUBLICATION100) else b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] in (
                            f"{A100}..{self.CONTROL100}", f"{self.CONTROL100}..{self.PUBLICATION100}",
                            f"{self.PUBLICATION100}..{head}"):
                        if tail[-1].startswith(A100):
                            content = code | ({"apps/web/src/console/App.tsx"} if scenario == "product_code" else set())
                            return ("\n".join(sorted(content)) + "\n").encode()
                        bad = (scenario == "product_b" and tail[-1].startswith(self.CONTROL100)
                            or scenario == "product_h" and tail[-1].startswith(self.PUBLICATION100))
                        return b"apps/web/src/console/App.tsx\n" if bad else b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL100 + ":"):
                        return (ROOT / tail[-1].split(":", 1)[1]).read_bytes()
                    if tail[:1] == ["show"] and tail[-1].startswith(self.PUBLICATION100 + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_b" and path == PATHS[0] else b_files[path]
                    if tail == ["show", f"{head}:{PATHS[0]}"]:
                        return files[PATHS[0]]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_legacy_entrypoint_dispatches_epoch100_closed_only(self):
        bundle, _ = self.closed_h()
        with patch.object(checker, "_collect_u01_scoped_dashboard_historical_closed_git",
                return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_historical_closed_git",
                return_value=["U01_SCOPED_HISTORY_CLOSE_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])


    @classmethod
    def frozen_b_output(cls, files):
        original = subprocess.check_output
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1].startswith(cls.PUBLICATION100 + ":"):
                return files[command[-1].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        return output

    def test_legacy_entrypoint_dispatches_epoch100_active_only(self):
        bundle, _ = archived_epoch100()
        with patch.object(checker, "_collect_u01_scoped_dashboard_historical_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_historical_git",
                return_value=["U01_SCOPED_HISTORY_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])


    def test_active_git_rejects_remote_branch_and_product_dirty(self):
        bundle, _ = archived_epoch100()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_historical_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("published", "remote", "branch", "dirty", "head"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "head" else A100) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else A100) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M apps/web/src/console/App.tsx\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b" M tests/tooling/test_u01_postmerge_control_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_active_a_binds_epoch99_close_and_exact_event_lease(self):
        bundle, archive = archived_epoch100()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_historical_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])
        frozen = subprocess.check_output(["git", "show", f"{H99}:{PATHS[1]}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(archive[PATHS[1]], 2284),
            checker.raw_event_object_prefix_bytes(frozen, 2284))

    def test_active_rejects_event_token_scope_hash_and_acceptance_forgery(self):
        bundle, archive = archived_epoch100()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_historical_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        archived = {PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2286].update(actor="forged")),
            ("chain", lambda b: b["events"]["events"][2286].update(
                previous_event_sha256="0" * 64)),
            ("token", lambda b: b["progress"]["write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("approval", lambda b: b["progress"]["u01_scoped_dashboard_historical_fixture_binding"].update(
                approval_sha256="0" * 64)),
            ("accepted", lambda b: b["progress"]["u01_scoped_dashboard_historical_fixture_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validator(forged, event_raw=archive[PATHS[1]], now=issued,
                    archived_files=archived))
        expires = datetime.fromisoformat(bundle["progress"]["worker_lease"]["expires_at"])
        self.assertTrue(validator(bundle, event_raw=archive[PATHS[1]], now=expires,
            archived_files=archived))



H100 = "ba8c9c3c4e31c5334e658c40787f019925c8c5a6"
A101 = "a960e1cc3aa3cf4c27c9f784fb41b4f8f6544fac"
A2_101 = "075fceec6cb70860715b3f7e4305651624eb45f7"


def archived_task1():
    archive = {path: subprocess.check_output(["git", "show", f"{A2_101}:{path}"], cwd=ROOT)
               for path in PATHS}
    bundle = deepcopy(checker.load_bundle(ROOT))
    bundle["progress"] = json.loads(archive[PATHS[0]])
    bundle["events"] = json.loads(archive[PATHS[1]])
    bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
    bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
    bundle["detached_digest"] = json.loads(archive[PATHS[3]])
    return bundle, archive


class U01ScopedDashboardTask1Epoch101Tests(unittest.TestCase):
    CONTROL = "c" * 40
    CONTROL_PUBLICATION = "b" * 40
    PRODUCT = "d" * 40
    PRODUCT_PUBLICATION = "e" * 40

    @classmethod
    def checkpoint_b(cls):
        bundle, files = archived_task1()
        progress = bundle["progress"]
        issued = datetime.fromisoformat(progress["updated_at"])
        status = "U01_SCOPED_DASHBOARD_TASK1_CONTROL_CHECKPOINTED_PRODUCT_READY"
        action = "U01_SCOPED_DASHBOARD_TASK1_PRODUCT_RED_ONLY"
        progress["u01_scoped_dashboard_task1_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=cls.CONTROL)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.CONTROL, remote_head=cls.CONTROL,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(issued + timedelta(minutes=1)).isoformat(),
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task1-control-seq2292")
        bundle["handoff"].update(repository_head=cls.CONTROL, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def checkpoint_p(cls):
        bundle, files = cls.checkpoint_b()
        progress = bundle["progress"]
        issued = datetime.fromisoformat(progress["updated_at"])
        status = "U01_SCOPED_DASHBOARD_TASK1_PRODUCT_CHECKPOINTED_CLOSE_READY"
        action = "U01_SCOPED_DASHBOARD_TASK1_CLOSE_ONLY"
        progress["u01_scoped_dashboard_task1_binding"].update(status=status,
            next_safe_action=action, product_code_checkpoint=cls.PRODUCT,
            control_projection_checkpoint=cls.CONTROL_PUBLICATION)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.PRODUCT, remote_head=cls.PRODUCT,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(issued + timedelta(minutes=1)).isoformat(),
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task1-product-seq2292")
        bundle["handoff"].update(repository_head=cls.PRODUCT, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def closed_h(cls):
        bundle, files = cls.checkpoint_p()
        progress, stream = bundle["progress"], bundle["events"]
        write, worker = progress["write_lease"], progress["worker_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_SCOPED_DASHBOARD_TASK1_API_SHELL_VERIFIED_TASK2_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2293, "WRITE_LEASE_REVOKED", "evt_u01_2293_scoped_dashboard_task1_write_lease_revoked",
                write, "write_fencing_token"),
            (2294, "WORKER_LEASE_REVOKED", "evt_u01_2294_scoped_dashboard_task1_worker_lease_revoked",
                worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_TASK1_CLOSE",
                "subject_ref": "U-01/SCOPED-DASHBOARD-TASK1", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2294, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2292', '"last_sequence": 2294', 1)
        rendered = rendered.replace('"last_event_id": "evt_u01_2292_scoped_dashboard_task1_write_lease_issued"',
            '"last_event_id": "evt_u01_2294_scoped_dashboard_task1_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_SCOPED_DASHBOARD_TASK1_CLOSED_TASK2_PENDING"
        action = "U01_SCOPED_DASHBOARD_TASK2_DUAL_LEASE_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_scoped_dashboard_task1_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_scoped_dashboard_task1_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_scoped_dashboard_task1_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint=cls.PRODUCT_PUBLICATION,
            event_sequence=2294)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2294,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task1-close-seq2294")
        progress["repository"].update(projection_mode="U01_SCOPED_DASHBOARD_TASK1_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2294, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2294
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_closed_h_requires_ordered_revocation_and_task2_pending(self):
        bundle, files = self.closed_h()
        _, p_files = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task1_closed", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1].startswith(self.PRODUCT_PUBLICATION + ":"):
                return p_files[command[-1].split(":", 1)[1]]
            if command[:2] == ["git", "show"] and command[-1] == f"{self.CONTROL_PUBLICATION}:{PATHS[0]}":
                return b_files[PATHS[0]]
            return original(command, *args, **kwargs)
        original = subprocess.check_output
        def validate(candidate, candidate_files=files):
            with patch.object(subprocess, "check_output", side_effect=frozen):
                return validator(candidate, event_raw=candidate_files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: candidate_files[PATHS[0]],
                                    PATHS[2]: candidate_files[PATHS[2]]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2293].update(actor="forged")),
            ("revoke", lambda b: b["progress"].update(
                completed_u01_scoped_dashboard_task1_write_lease=None)),
            ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_task1_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("product", lambda b: b["progress"]["repository"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("checkpoint", lambda b: b["progress"]["u01_scoped_dashboard_task1_binding"].update(
                active_projection_checkpoint="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)
        forged, forged_files = deepcopy(bundle), deepcopy(files)
        published_at = datetime.fromisoformat(json.loads(p_files[PATHS[0]])["updated_at"])
        early = (published_at - timedelta(seconds=1)).isoformat()
        old = forged["events"]["events"][2292]["occurred_at"]
        old_hash = forged["events"]["events"][2293]["previous_event_sha256"]
        for row in forged["events"]["events"][2292:2294]:
            row["occurred_at"] = early
        new_hash = hashlib.sha256(checker.canonical_json_bytes(
            forged["events"]["events"][2292])).hexdigest().upper()
        forged["events"]["events"][2293]["previous_event_sha256"] = new_hash
        forged_files[PATHS[1]] = forged_files[PATHS[1]].replace(
            old.encode(), early.encode()).replace(old_hash.encode(), new_hash.encode())
        self.assertEqual(json.loads(forged_files[PATHS[1]]), forged["events"])
        forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_files[PATHS[1]]).hexdigest().upper()
        forged["progress"]["updated_at"] = early
        for key in ("completed_u01_scoped_dashboard_task1_write_lease",
                    "completed_u01_scoped_dashboard_task1_worker_lease"):
            forged["progress"][key]["revoked_at"] = early
        forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, forged_files)
        self.assertIn("U01_TASK1_CLOSE_EVENT_INVALID", validate(forged, forged_files))

    def test_closed_h_git_requires_exact_product_publication_and_docs_only_close(self):
        bundle, h_files = self.closed_h()
        _, b_files = self.checkpoint_b()
        _, p_files = self.checkpoint_p()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_task1_closed_git", None)
        self.assertIsNotNone(collector)
        original, original_run = subprocess.check_output, subprocess.run
        control = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        product = {"packages/api/fastapi_app.py", "tests/api/test_u01_scoped_dashboard_api.py"}
        close = "f" * 40
        legs = (f"{A2_101}..{self.CONTROL}", f"{self.CONTROL}..{self.CONTROL_PUBLICATION}",
            f"{self.CONTROL_PUBLICATION}..{self.PRODUCT}",
            f"{self.PRODUCT}..{self.PRODUCT_PUBLICATION}",
            f"{self.PRODUCT_PUBLICATION}..{close}")
        for scenario in ("published", "remote", "dirty", "product_close", "merge",
                         "extra_close", "stale_p", "product_code"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else close
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/registry.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in legs:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] in legs:
                        return b"2\n" if scenario == "extra_close" and tail[-1] == legs[-1] else b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] in legs:
                        if tail[-1] == legs[0]:
                            return ("\n".join(sorted(control)) + "\n").encode()
                        if tail[-1] == legs[2]:
                            extra = {"docs/WORK_STATUS.md"} if scenario == "product_code" else set()
                            return ("\n".join(sorted(product | extra)) + "\n").encode()
                        if tail[-1] == legs[-1] and scenario == "product_close":
                            return b"packages/api/registry.py\n"
                        return b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL + ":"):
                        return (ROOT / tail[-1].split(":", 1)[1]).read_bytes()
                    for sha, source in ((self.CONTROL_PUBLICATION, b_files),
                                        (self.PRODUCT_PUBLICATION, p_files), (close, h_files)):
                        if tail[:1] == ["show"] and tail[-1].startswith(sha + ":"):
                            path = tail[-1].split(":", 1)[1]
                            return b"stale" if scenario == "stale_p" and sha == self.PRODUCT_PUBLICATION and path == PATHS[0] else source[path]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_control_b_and_product_p_projection_are_distinct(self):
        validate = checker._validate_u01_scoped_dashboard_task1_active
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1] == f"{self.CONTROL_PUBLICATION}:{PATHS[0]}":
                return b_files[PATHS[0]]
            return original(command, *args, **kwargs)
        for phase, maker in (("B", self.checkpoint_b), ("P", self.checkpoint_p)):
            with self.subTest(phase=phase):
                bundle, files = maker()
                now = datetime.fromisoformat(bundle["progress"]["updated_at"])
                with patch.object(subprocess, "check_output", side_effect=frozen):
                    self.assertEqual(validate(bundle, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
                forged = deepcopy(bundle)
                forged["progress"]["u01_scoped_dashboard_task1_binding"].update(
                    vertical_acceptance="ACCEPTED")
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                with patch.object(subprocess, "check_output", side_effect=frozen):
                    self.assertTrue(validate(forged, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_control_b_and_product_p_reject_publication_clock_regression(self):
        a_bundle, _ = archived_task1()
        a_at = datetime.fromisoformat(a_bundle["progress"]["updated_at"])
        b_bundle, b_files = self.checkpoint_b()
        b_at = datetime.fromisoformat(b_bundle["progress"]["updated_at"])
        validate = checker._validate_u01_scoped_dashboard_task1_active
        early_b = deepcopy(b_bundle)
        early_b["progress"]["updated_at"] = (a_at - timedelta(seconds=1)).isoformat()
        early_b, early_b_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            early_b, deepcopy(b_files))
        self.assertTrue(validate(early_b, event_raw=early_b_files[PATHS[1]], now=b_at,
            archived_files={PATHS[0]: early_b_files[PATHS[0]],
                            PATHS[2]: early_b_files[PATHS[2]]}))
        p_bundle, p_files = self.checkpoint_p()
        p_at = datetime.fromisoformat(p_bundle["progress"]["updated_at"])
        early_p = deepcopy(p_bundle)
        early_p["progress"]["updated_at"] = (b_at - timedelta(seconds=1)).isoformat()
        early_p, early_p_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            early_p, deepcopy(p_files))
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1] == f"{self.CONTROL_PUBLICATION}:{PATHS[0]}":
                return b_files[PATHS[0]]
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertTrue(validate(early_p, event_raw=early_p_files[PATHS[1]], now=p_at,
                archived_files={PATHS[0]: early_p_files[PATHS[0]],
                                PATHS[2]: early_p_files[PATHS[2]]}))

    def test_control_b_git_requires_exact_code_and_published_docs(self):
        bundle, files = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_task1_git
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        for scenario in ("published", "remote", "dirty", "product_code", "product_docs",
                         "stale_code", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else self.CONTROL_PUBLICATION
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M docs/WORK_STATUS.md\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{A2_101}..{self.CONTROL}",
                            f"{self.CONTROL}..{self.CONTROL_PUBLICATION}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] in (
                            f"{A2_101}..{self.CONTROL}",
                            f"{self.CONTROL}..{self.CONTROL_PUBLICATION}"):
                        return b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{A2_101}..{self.CONTROL}":
                        extra = {"packages/api/registry.py"} if scenario == "product_code" else set()
                        return ("\n".join(sorted(code | extra)) + "\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.CONTROL}..{self.CONTROL_PUBLICATION}":
                        return (b"packages/api/registry.py\n" if scenario == "product_docs"
                            else b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_code" and path in code else (ROOT / path).read_bytes()
                    if tail == ["show", f"{self.CONTROL_PUBLICATION}:{PATHS[0]}"]:
                        return files[PATHS[0]]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_product_p_git_requires_exact_b_d_p_lineage(self):
        bundle, p_files = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_task1_git
        original, original_run = subprocess.check_output, subprocess.run
        control = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        product = {"packages/api/fastapi_app.py", "tests/api/test_u01_scoped_dashboard_api.py"}
        for scenario in ("published", "remote", "dirty", "product_code", "product_docs",
                         "stale_b", "merge", "extra_p"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else self.PRODUCT_PUBLICATION
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{A2_101}..{self.CONTROL}", f"{self.CONTROL}..{self.CONTROL_PUBLICATION}",
                            f"{self.CONTROL_PUBLICATION}..{self.PRODUCT}",
                            f"{self.PRODUCT}..{self.PRODUCT_PUBLICATION}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] in (
                            f"{A2_101}..{self.CONTROL}", f"{self.CONTROL}..{self.CONTROL_PUBLICATION}",
                            f"{self.CONTROL_PUBLICATION}..{self.PRODUCT}",
                            f"{self.PRODUCT}..{self.PRODUCT_PUBLICATION}"):
                        return b"2\n" if scenario == "extra_p" and tail[-1].startswith(self.PRODUCT) else b"1\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] in (
                            f"{A2_101}..{self.CONTROL}", f"{self.CONTROL}..{self.CONTROL_PUBLICATION}",
                            f"{self.CONTROL_PUBLICATION}..{self.PRODUCT}",
                            f"{self.PRODUCT}..{self.PRODUCT_PUBLICATION}"):
                        if tail[-1].startswith(A2_101):
                            return ("\n".join(sorted(control)) + "\n").encode()
                        if tail[-1].startswith(self.CONTROL_PUBLICATION):
                            extra = {"docs/WORK_STATUS.md"} if scenario == "product_code" else set()
                            return ("\n".join(sorted(product | extra)) + "\n").encode()
                        bad = (scenario == "product_docs" and tail[-1].startswith(self.PRODUCT))
                        return b"packages/api/registry.py\n" if bad else b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL + ":"):
                        return (ROOT / tail[-1].split(":", 1)[1]).read_bytes()
                    if tail[:1] == ["show"] and tail[-1].startswith(self.CONTROL_PUBLICATION + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_b" and path == PATHS[0] else b_files[path]
                    if tail == ["show", f"{self.PRODUCT_PUBLICATION}:{PATHS[0]}"]:
                        return p_files[PATHS[0]]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")
    def test_legacy_entrypoint_dispatches_task1_active_only(self):
        bundle, _ = archived_task1()
        with patch.object(checker, "_collect_u01_scoped_dashboard_task1_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_task1_git",
                return_value=["U01_TASK1_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_legacy_entrypoint_dispatches_task1_closed_only(self):
        bundle, _ = self.closed_h()
        with patch.object(checker, "_collect_u01_scoped_dashboard_task1_closed_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_task1_closed_git",
                return_value=["U01_TASK1_CLOSE_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_active_a2_git_rejects_remote_branch_and_product_dirty(self):
        bundle, _ = archived_task1()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_task1_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("published", "remote", "branch", "dirty", "head", "upstream"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "head" else A2_101) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else A2_101) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"] and scenario == "upstream":
                        return b"origin/main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/registry.py\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b" M tests/tooling/test_u01_postmerge_control_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_active_a2_requires_frozen_epoch100_event_lease_and_hash(self):
        bundle, archive = archived_task1()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task1_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])
        predecessor = subprocess.check_output(["git", "show", f"{H100}:{PATHS[1]}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(archive[PATHS[1]], 2289),
            checker.raw_event_object_prefix_bytes(predecessor, 2289))

    def test_active_a2_rejects_event_scope_token_and_acceptance_forgery(self):
        bundle, archive = archived_task1()
        validator = checker._validate_u01_scoped_dashboard_task1_active
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        def validate(candidate):
            return validator(candidate, event_raw=archive[PATHS[1]], now=issued,
                archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]})
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2291].update(actor="forged")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(
                path_scope=["scripts/check_project_progress.py"])),
            ("product_gate", lambda b: b["progress"]["write_lease"].update(product_gate="OPEN")),
            ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_task1_binding"].update(
                vertical_acceptance="ACCEPTED")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)

if __name__ == "__main__":
    unittest.main()


TASK3_A = "8bffe96258f411f1283ee710088c643fe5761c5e"
TASK3_A2 = "570ca31d521516d247edc4d32be21a066d883d11"


def archived_task3():
    archive = {path: subprocess.check_output(["git", "show", f"{TASK3_A2}:{path}"],
               cwd=ROOT) for path in PATHS}
    bundle = deepcopy(checker.load_bundle(ROOT))
    bundle["progress"] = json.loads(archive[PATHS[0]])
    bundle["events"] = json.loads(archive[PATHS[1]])
    bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
    bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
    bundle["detached_digest"] = json.loads(archive[PATHS[3]])
    return bundle, archive


class U01ScopedDashboardTask3Epoch103Tests(unittest.TestCase):
    CONTROL = "c" * 40
    CONTROL_PUBLICATION = "b" * 40
    PRODUCT = "d" * 40

    def test_legacy_git_dispatch_routes_task3_active_and_closed(self):
        active, _ = archived_task3()
        closed, _ = self.closed_h()
        for bundle, collector in ((active, "_collect_u01_scoped_dashboard_task3_git"),
                                  (closed, "_collect_u01_scoped_dashboard_task3_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector, return_value=["U01_TASK3_GIT_INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    @classmethod
    def checkpoint_b(cls):
        bundle, files = archived_task3()
        progress = bundle["progress"]
        status = "U01_SCOPED_DASHBOARD_TASK3_CONTROL_CHECKPOINTED_PRODUCT_READY"
        action = "U01_SCOPED_DASHBOARD_TASK3_PRODUCT_RED_ONLY"
        progress["u01_scoped_dashboard_task3_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=cls.CONTROL)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.CONTROL, remote_head=cls.CONTROL,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(datetime.fromisoformat(progress["updated_at"])
            + timedelta(minutes=1)).isoformat(), next_safe_action=action,
            runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task3-control-seq2302")
        bundle["handoff"].update(repository_head=cls.CONTROL, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def checkpoint_p(cls):
        bundle, files = cls.checkpoint_b()
        progress = bundle["progress"]
        status = "U01_SCOPED_DASHBOARD_TASK3_PRODUCT_CHECKPOINTED_CLOSE_READY"
        action = "U01_SCOPED_DASHBOARD_TASK3_CLOSE_ONLY"
        progress["u01_scoped_dashboard_task3_binding"].update(status=status,
            next_safe_action=action, product_code_checkpoint=cls.PRODUCT,
            control_projection_checkpoint=cls.CONTROL_PUBLICATION)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.PRODUCT, remote_head=cls.PRODUCT,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(datetime.fromisoformat(progress["updated_at"])
            + timedelta(minutes=1)).isoformat(), next_safe_action=action,
            runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task3-product-seq2302")
        bundle["handoff"].update(repository_head=cls.PRODUCT, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def closed_h(cls):
        bundle, files = cls.checkpoint_p()
        progress, stream = bundle["progress"], bundle["events"]
        write, worker = progress["write_lease"], progress["worker_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_SCOPED_DASHBOARD_TASK3_UI_VERIFIED_TASK4_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2303, "WRITE_LEASE_REVOKED", "evt_u01_2303_scoped_dashboard_task3_write_lease_revoked",
                write, "write_fencing_token"),
            (2304, "WORKER_LEASE_REVOKED", "evt_u01_2304_scoped_dashboard_task3_worker_lease_revoked",
                worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_TASK3_CLOSE",
                "subject_ref": "U-01/SCOPED-DASHBOARD-TASK3", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2304, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2302', '"last_sequence": 2304', 1)
        rendered = rendered.replace(
            '"last_event_id": "evt_u01_2302_scoped_dashboard_task3_write_lease_issued"',
            '"last_event_id": "evt_u01_2304_scoped_dashboard_task3_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_SCOPED_DASHBOARD_TASK3_CLOSED_TASK4_PENDING"
        action = "U01_SCOPED_DASHBOARD_TASK4_DUAL_LEASE_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_scoped_dashboard_task3_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_scoped_dashboard_task3_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_scoped_dashboard_task3_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="e" * 40,
            event_sequence=2304)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2304,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task3-close-seq2304")
        progress["repository"].update(projection_mode="U01_SCOPED_DASHBOARD_TASK3_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2304, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2304
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_closed_h_requires_ordered_revocation_and_frozen_p(self):
        bundle, files = self.closed_h()
        _, p_files = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task3_closed", None)
        self.assertIsNotNone(validator)
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for sha, archive in (("e" * 40, p_files), (self.CONTROL_PUBLICATION, b_files)):
                    for path in PATHS:
                        if command[-1] == f"{sha}:{path}":
                            return archive[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
            forged = deepcopy(bundle)
            forged["events"]["events"][2303]["details"]["reason"] = "forged"
            self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_closed_h_rejects_event_before_product_publication(self):
        bundle, files = self.closed_h()
        _, p_files = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        p_at = datetime.fromisoformat(json.loads(p_files[PATHS[0]])["updated_at"])
        early = (p_at - timedelta(seconds=1)).isoformat()
        old_at = bundle["progress"]["updated_at"]
        forged = deepcopy(bundle)
        forged_files = deepcopy(files)
        events = forged["events"]["events"]
        old_prev = events[2303]["previous_event_sha256"]
        for row in events[-2:]:
            row["occurred_at"] = early
        events[2303]["previous_event_sha256"] = hashlib.sha256(
            checker.canonical_json_bytes(events[2302])).hexdigest().upper()
        raw = forged_files[PATHS[1]].decode().replace(f'"occurred_at": "{old_at}"',
            f'"occurred_at": "{early}"').replace(f'"previous_event_sha256": "{old_prev}"',
            f'"previous_event_sha256": "{events[2303]["previous_event_sha256"]}"')
        forged_files[PATHS[1]] = raw.encode()
        self.assertEqual(json.loads(forged_files[PATHS[1]]), forged["events"])
        progress = forged["progress"]
        progress["updated_at"] = early
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_files[PATHS[1]]).hexdigest().upper()
        for key in ("completed_u01_scoped_dashboard_task3_write_lease",
                    "completed_u01_scoped_dashboard_task3_worker_lease"):
            progress[key]["revoked_at"] = early
        forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, forged_files)
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for sha, archive in (("e" * 40, p_files), (self.CONTROL_PUBLICATION, b_files)):
                    for path in PATHS:
                        if command[-1] == f"{sha}:{path}":
                            return archive[path]
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertIn("U01_TASK3_CLOSE_EVENT_INVALID",
                checker._validate_u01_scoped_dashboard_task3_closed(forged,
                    event_raw=forged_files[PATHS[1]], now=p_at,
                    archived_files={PATHS[0]: forged_files[PATHS[0]],
                                    PATHS[2]: forged_files[PATHS[2]]}))

    def test_closed_h_git_rejects_product_or_merge_in_docs_leg(self):
        bundle, _ = self.closed_h()
        _, b_files = self.checkpoint_b()
        _, p_files = self.checkpoint_p()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_task3_closed_git", None)
        self.assertIsNotNone(collector)
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        ui = {"apps/web/src/console/App.tsx", "apps/web/tests/f15-console.test.mjs"}
        legs = {(TASK3_A2, self.CONTROL): code,
            (self.CONTROL, self.CONTROL_PUBLICATION): docs,
            (self.CONTROL_PUBLICATION, self.PRODUCT): ui,
            (self.PRODUCT, "e" * 40): docs,
            ("e" * 40, "f" * 40): docs}
        for scenario in ("published", "remote", "dirty", "product_close", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else "f" * 40)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--count"]:
                        return b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return b"x\n" if scenario == "merge" and tail[-1] == f"{'e' * 40}..{'f' * 40}" else b""
                    if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                        pair = tuple(tail[-1].split(".."))
                        if pair in legs:
                            selected = set(legs[pair])
                            if scenario == "product_close" and pair == ("e" * 40, "f" * 40):
                                selected.add("apps/web/src/console/App.tsx")
                            return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for sha, archive in ((self.CONTROL_PUBLICATION, b_files), ("e" * 40, p_files)):
                            for path in PATHS:
                                if tail[-1] == f"{sha}:{path}":
                                    return archive[path]
                        if tail[-1] == f"{'f' * 40}:{PATHS[0]}":
                            return json.dumps(bundle["progress"]).encode()
                        for path in code:
                            if tail[-1] == f"{self.CONTROL}:{path}":
                                return (ROOT / path).read_bytes()
                        for path in ui:
                            if tail[-1] == f"{self.PRODUCT}:{path}":
                                return (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] in (["git", "merge-base", "--is-ancestor"],
                                       ["git", "diff", "--check"]):
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_b_p_projection_requires_frozen_control_and_monotonic_clock(self):
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if (command[:2] == ["git", "show"]
                    and command[-1] == f"{self.CONTROL_PUBLICATION}:{PATHS[0]}"):
                return b_files[PATHS[0]]
            return original(command, *args, **kwargs)
        validate = getattr(checker, "_validate_u01_scoped_dashboard_task3_active", None)
        self.assertIsNotNone(validate)
        for maker in (self.checkpoint_b, self.checkpoint_p):
            bundle, files = maker()
            now = datetime.fromisoformat(bundle["progress"]["updated_at"])
            with patch.object(subprocess, "check_output", side_effect=frozen):
                self.assertEqual(validate(bundle, event_raw=files[PATHS[1]], now=now,
                    archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
        p_bundle, p_files = self.checkpoint_p()
        b_at = datetime.fromisoformat(json.loads(b_files[PATHS[0]])["updated_at"])
        p_bundle["progress"]["updated_at"] = (b_at - timedelta(seconds=1)).isoformat()
        p_bundle, p_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            p_bundle, p_files)
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertTrue(validate(p_bundle, event_raw=p_files[PATHS[1]], now=b_at,
                archived_files={PATHS[0]: p_files[PATHS[0]], PATHS[2]: p_files[PATHS[2]]}))

    def test_b_git_requires_exact_control_and_docs_history(self):
        bundle, _ = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_task3_git
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        for scenario in ("published", "remote", "product_history", "dirty", "stale_code"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else self.CONTROL_PUBLICATION)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--count"]:
                        return b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return b""
                    if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                        pair = tuple(tail[-1].split(".."))
                        if pair == (TASK3_A2, self.CONTROL):
                            return ("\n".join(sorted(code)) + "\n").encode()
                        if pair == (self.CONTROL, self.CONTROL_PUBLICATION):
                            selected = docs | ({"packages/api/fastapi_app.py"}
                                if scenario == "product_history" else set())
                            return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in code:
                            if tail[-1] == f"{self.CONTROL}:{path}":
                                return (b"stale" if scenario == "stale_code" else (ROOT / path).read_bytes())
                        if tail[-1] == f"{self.CONTROL_PUBLICATION}:{PATHS[0]}":
                            return json.dumps(bundle["progress"]).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] in (["git", "merge-base", "--is-ancestor"],
                                       ["git", "diff", "--check"]):
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_p_git_requires_ui_implementation_and_docs_only_publication(self):
        bundle, _ = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_task3_git
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        ui = {"apps/web/src/console/App.tsx", "apps/web/tests/f15-console.test.mjs"}
        legs = {(TASK3_A2, self.CONTROL): code,
            (self.CONTROL, self.CONTROL_PUBLICATION): docs,
            (self.CONTROL_PUBLICATION, self.PRODUCT): ui,
            (self.PRODUCT, "e" * 40): docs}
        for scenario in ("published", "test_only", "unrelated_ui", "dirty", "remote"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else "e" * 40)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--count"]:
                        return b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return b""
                    if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                        pair = tuple(tail[-1].split(".."))
                        if pair in legs:
                            selected = set(legs[pair])
                            if scenario == "test_only" and pair == (self.CONTROL_PUBLICATION, self.PRODUCT):
                                selected = {"apps/web/tests/f15-console.test.mjs"}
                            if scenario == "unrelated_ui" and pair == (self.PRODUCT, "e" * 40):
                                selected.add("packages/api/fastapi_app.py")
                            return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in PATHS:
                            if tail[-1] == f"{self.CONTROL_PUBLICATION}:{path}":
                                return b_files[path]
                        if tail[-1] == f"{'e' * 40}:{PATHS[0]}":
                            return json.dumps(bundle["progress"]).encode()
                        for path in code:
                            if tail[-1] == f"{self.CONTROL}:{path}":
                                return (ROOT / path).read_bytes()
                        for path in ui:
                            if tail[-1] == f"{self.PRODUCT}:{path}":
                                return (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] in (["git", "merge-base", "--is-ancestor"],
                                       ["git", "diff", "--check"]):
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_active_a2_git_rejects_remote_and_product_dirty(self):
        archive = {path: subprocess.check_output(["git", "show", f"{TASK3_A2}:{path}"],
                   cwd=ROOT) for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(archive[PATHS[0]])
        collector = getattr(checker, "_collect_u01_scoped_dashboard_task3_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("published", "remote", "product_dirty", "head", "branch", "upstream"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "head" else TASK3_A2) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else TASK3_A2) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"] and scenario == "upstream":
                        return b"origin/main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M apps/web/src/console/App.tsx\n" if scenario == "product_dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b" M tests/tooling/test_u01_postmerge_control_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_active_a_binds_published_event_lease_and_predecessor(self):
        archive = {path: subprocess.check_output(["git", "show", f"{TASK3_A2}:{path}"],
                   cwd=ROOT) for path in PATHS}
        bundle = deepcopy(checker.load_bundle(ROOT))
        bundle["progress"] = json.loads(archive[PATHS[0]])
        bundle["events"] = json.loads(archive[PATHS[1]])
        bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive[PATHS[3]])
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task3_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])
        forged = deepcopy(bundle)
        forged["progress"]["write_lease"]["write_fencing_token"] = "forged"
        self.assertTrue(validator(forged, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}))

    def test_active_a2_rejects_rebound_event_scope_clock_hash_and_instruction(self):
        bundle, archive = archived_task3()
        validate = checker._validate_u01_scoped_dashboard_task3_active
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        raw = archive[PATHS[1]]
        old_id = b"evt_u01_2302_scoped_dashboard_task3_write_lease_issued"
        new_id = b"evt_u01_2302_scoped_dashboard_task3_write_lease_forged"
        self.assertIn(old_id, raw)
        forged_raw = raw.replace(old_id, new_id)
        forged = deepcopy(bundle)
        forged["events"] = json.loads(forged_raw)
        forged["progress"]["last_event_id"] = new_id.decode()
        forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_raw).hexdigest().upper()
        forged["handoff"].update(last_event_id=new_id.decode())
        forged, files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, {**archive, PATHS[1]: forged_raw})
        self.assertTrue(validate(forged, event_raw=forged_raw, now=issued,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))
        for name, mutate in (
            ("write_scope", lambda b: b["progress"]["write_lease"].update(path_scope=[])),
            ("expiry_24h", lambda b: b["progress"]["write_lease"].update(
                expires_at=(issued + timedelta(hours=23)).isoformat())),
            ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_task3_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("digest", lambda b: b["detached_digest"]["progress"].update(file_sha256="0" * 64)),
            ("wi_hash", lambda b: b["progress"]["u01_scoped_dashboard_task3_binding"].update(
                work_instruction_sha256="0" * 64)),
        ):
            with self.subTest(name=name):
                tampered = deepcopy(bundle)
                mutate(tampered)
                tampered["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                    tampered["progress"])
                self.assertTrue(validate(tampered, event_raw=raw, now=issued,
                    archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}))
        expires = datetime.fromisoformat(bundle["progress"]["worker_lease"]["expires_at"])
        self.assertTrue(validate(bundle, event_raw=raw, now=expires,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}))


A2_102 = "7b5c8bfc60e7db8d0147cf8bd7d82b5a674cc49d"


def archived_task2():
    archive = {path: subprocess.check_output(["git", "show", f"{A2_102}:{path}"], cwd=ROOT)
               for path in PATHS}
    bundle = deepcopy(checker.load_bundle(ROOT))
    bundle["progress"] = json.loads(archive[PATHS[0]])
    bundle["events"] = json.loads(archive[PATHS[1]])
    bundle["handoff_text"] = archive[PATHS[2]].decode("utf-8")
    bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
    bundle["detached_digest"] = json.loads(archive[PATHS[3]])
    return bundle, archive


class U01ScopedDashboardTask2Epoch102Tests(unittest.TestCase):
    CONTROL = "c" * 40
    CONTROL_PUBLICATION = "b" * 40
    PRODUCT = "d" * 40
    PRODUCT_PUBLICATION = "e" * 40

    @classmethod
    def closed_h(cls):
        bundle, files = cls.checkpoint_p()
        progress, stream = bundle["progress"], bundle["events"]
        write, worker = progress["write_lease"], progress["worker_lease"]
        at = (datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
        reason = "U01_SCOPED_DASHBOARD_TASK2_READER_VERIFIED_TASK3_PENDING"
        for sequence, kind, event_id, lease, token in (
            (2298, "WRITE_LEASE_REVOKED", "evt_u01_2298_scoped_dashboard_task2_write_lease_revoked",
                write, "write_fencing_token"),
            (2299, "WORKER_LEASE_REVOKED", "evt_u01_2299_scoped_dashboard_task2_worker_lease_revoked",
                worker, "execution_fencing_token"),
        ):
            previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
                "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_TASK2_CLOSE",
                "subject_ref": "U-01/SCOPED-DASHBOARD-TASK2", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": previous,
                "details": {"lease_id": lease["lease_id"], token: lease[token], "reason": reason}})
        stream.update(last_sequence=2299, last_event_id=stream["events"][-1]["event_id"])
        original = files[PATHS[1]].decode()
        boundary = original.rfind("  ],\n")
        assert boundary >= 0
        appended = ",\n" + ",\n".join("\n".join("  " + line for line in
            json.dumps(row, ensure_ascii=False, indent=2).splitlines())
            for row in stream["events"][-2:]) + "\n"
        rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
        rendered = rendered.replace('"last_sequence": 2297', '"last_sequence": 2299', 1)
        rendered = rendered.replace(
            '"last_event_id": "evt_u01_2297_scoped_dashboard_task2_write_lease_issued"',
            '"last_event_id": "evt_u01_2299_scoped_dashboard_task2_worker_lease_revoked"', 1)
        files[PATHS[1]] = rendered.encode()
        assert json.loads(files[PATHS[1]]) == stream
        status = "U01_SCOPED_DASHBOARD_TASK2_CLOSED_TASK3_PENDING"
        action = "U01_SCOPED_DASHBOARD_TASK3_DUAL_LEASE_PENDING"
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            files[PATHS[1]]).hexdigest().upper()
        progress["completed_u01_scoped_dashboard_task2_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_u01_scoped_dashboard_task2_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["worker_lease"] = progress["write_lease"] = None
        progress["u01_scoped_dashboard_task2_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint=cls.PRODUCT_PUBLICATION,
            event_sequence=2299)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(active_agent=None, updated_at=at, event_sequence=2299,
            last_event_id=stream["last_event_id"], next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task2-close-seq2299")
        progress["repository"].update(projection_mode="U01_SCOPED_DASHBOARD_TASK2_CLOSED",
            head_relation=status, worktree_status=status)
        bundle["handoff"].update(event_sequence=2299, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2299
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_closed_h_requires_ordered_revocation_and_task3_pending(self):
        bundle, files = self.closed_h()
        _, p_files = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task2_closed", None)
        self.assertIsNotNone(validator)
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for sha, archive in ((self.PRODUCT_PUBLICATION, p_files),
                                     (self.CONTROL_PUBLICATION, b_files)):
                    for path in PATHS:
                        if command[-1] == f"{sha}:{path}":
                            return archive[path]
            return original(command, *args, **kwargs)
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
            forged = deepcopy(bundle)
            forged["events"]["events"][2298]["details"]["reason"] = "forged"
            self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}))

    def test_closed_h_rejects_clock_before_product_publication(self):
        bundle, files = self.closed_h()
        _, p_files = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        validator = checker._validate_u01_scoped_dashboard_task2_closed
        old_at = bundle["progress"]["updated_at"]
        p_at = datetime.fromisoformat(json.loads(p_files[PATHS[0]])["updated_at"])
        early_at = (p_at - timedelta(seconds=1)).isoformat()
        forged = deepcopy(bundle)
        forged_files = deepcopy(files)
        events = forged["events"]["events"]
        old_prev = events[2298]["previous_event_sha256"]
        for row in events[-2:]:
            row["occurred_at"] = early_at
        events[2298]["previous_event_sha256"] = hashlib.sha256(
            checker.canonical_json_bytes(events[2297])).hexdigest().upper()
        raw = forged_files[PATHS[1]].decode()
        raw = raw.replace(f'"occurred_at": "{old_at}"',
            f'"occurred_at": "{early_at}"')
        raw = raw.replace(f'"previous_event_sha256": "{old_prev}"',
            f'"previous_event_sha256": "{events[2298]["previous_event_sha256"]}"')
        forged_files[PATHS[1]] = raw.encode()
        self.assertEqual(json.loads(forged_files[PATHS[1]]), forged["events"])
        progress = forged["progress"]
        progress["updated_at"] = early_at
        for key in ("completed_u01_scoped_dashboard_task2_write_lease",
                    "completed_u01_scoped_dashboard_task2_worker_lease"):
            progress[key]["revoked_at"] = early_at
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_files[PATHS[1]]).hexdigest().upper()
        forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            forged, forged_files)
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"]:
                for sha, archive in ((self.PRODUCT_PUBLICATION, p_files),
                                     (self.CONTROL_PUBLICATION, b_files)):
                    for path in PATHS:
                        if command[-1] == f"{sha}:{path}":
                            return archive[path]
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertIn("U01_TASK2_CLOSE_EVENT_INVALID", validator(forged,
                event_raw=forged_files[PATHS[1]], now=p_at,
                archived_files={PATHS[0]: forged_files[PATHS[0]],
                                PATHS[2]: forged_files[PATHS[2]]}))

    @classmethod
    def checkpoint_b(cls):
        bundle, files = archived_task2()
        progress = bundle["progress"]
        issued = datetime.fromisoformat(progress["updated_at"])
        status = "U01_SCOPED_DASHBOARD_TASK2_CONTROL_CHECKPOINTED_PRODUCT_READY"
        action = "U01_SCOPED_DASHBOARD_TASK2_PRODUCT_RED_ONLY"
        progress["u01_scoped_dashboard_task2_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=cls.CONTROL)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.CONTROL, remote_head=cls.CONTROL,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(issued + timedelta(minutes=1)).isoformat(),
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task2-control-seq2297")
        bundle["handoff"].update(repository_head=cls.CONTROL, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    @classmethod
    def checkpoint_p(cls):
        bundle, files = cls.checkpoint_b()
        progress = bundle["progress"]
        issued = datetime.fromisoformat(progress["updated_at"])
        status = "U01_SCOPED_DASHBOARD_TASK2_PRODUCT_CHECKPOINTED_CLOSE_READY"
        action = "U01_SCOPED_DASHBOARD_TASK2_CLOSE_ONLY"
        progress["u01_scoped_dashboard_task2_binding"].update(status=status,
            next_safe_action=action, product_code_checkpoint=cls.PRODUCT,
            control_projection_checkpoint=cls.CONTROL_PUBLICATION)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["repository"].update(local_head=cls.PRODUCT, remote_head=cls.PRODUCT,
            head_relation=status, worktree_status=status)
        progress.update(updated_at=(issued + timedelta(minutes=1)).isoformat(),
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "U-01", "status": status},
            snapshot_id="snapshot-u01-scoped-dashboard-task2-product-seq2297")
        bundle["handoff"].update(repository_head=cls.PRODUCT, next_safe_action=action)
        return U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(bundle, files)

    def test_b_p_monotonic_projection_and_forgery(self):
        _, b_files = self.checkpoint_b()
        original = subprocess.check_output
        def frozen(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[-1] == f"{self.CONTROL_PUBLICATION}:{PATHS[0]}":
                return b_files[PATHS[0]]
            return original(command, *args, **kwargs)
        validate = checker._validate_u01_scoped_dashboard_task2_active
        for phase, maker in (("B", self.checkpoint_b), ("P", self.checkpoint_p)):
            with self.subTest(phase=phase):
                bundle, files = maker()
                now = datetime.fromisoformat(bundle["progress"]["updated_at"])
                with patch.object(subprocess, "check_output", side_effect=frozen):
                    self.assertEqual(validate(bundle, event_raw=files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
                forged = deepcopy(bundle)
                forged["progress"]["updated_at"] = (
                    datetime.fromisoformat(archived_task2()[0]["progress"]["updated_at"])
                    - timedelta(seconds=1)).isoformat()
                forged, forged_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
                    forged, deepcopy(files))
                with patch.object(subprocess, "check_output", side_effect=frozen):
                    self.assertTrue(validate(forged, event_raw=forged_files[PATHS[1]], now=now,
                        archived_files={PATHS[0]: forged_files[PATHS[0]],
                                        PATHS[2]: forged_files[PATHS[2]]}))
        b_at = datetime.fromisoformat(json.loads(b_files[PATHS[0]])["updated_at"])
        p_bundle, p_files = self.checkpoint_p()
        early_p = deepcopy(p_bundle)
        early_p["progress"]["updated_at"] = (b_at - timedelta(seconds=1)).isoformat()
        early_p, early_files = U01ScopedDashboardHistoricalFixtureEpoch100Tests.materialize(
            early_p, deepcopy(p_files))
        with patch.object(subprocess, "check_output", side_effect=frozen):
            self.assertIn("U01_TASK2_PROJECTION_INVALID", validate(early_p,
                event_raw=early_files[PATHS[1]], now=b_at,
                archived_files={PATHS[0]: early_files[PATHS[0]], PATHS[2]: early_files[PATHS[2]]}))

    def test_active_a2_requires_exact_published_event_lease_and_hash(self):
        bundle, archive = archived_task2()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task2_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=archive[PATHS[1]], now=issued,
            archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}), [])

    def test_active_a2_rejects_event_token_scope_and_acceptance_forgery(self):
        bundle, archive = archived_task2()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_task2_active", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        for name, mutate in (
            ("event", lambda b: b["events"]["events"][2296].update(actor="forged")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
            ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_task2_binding"].update(
                vertical_acceptance="ACCEPTED")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validator(forged, event_raw=archive[PATHS[1]], now=issued,
                    archived_files={PATHS[0]: archive[PATHS[0]], PATHS[2]: archive[PATHS[2]]}))

    def test_active_a2_git_rejects_remote_branch_and_unrelated_dirty(self):
        bundle, _ = archived_task2()
        collector = checker._collect_u01_scoped_dashboard_task2_git
        original = subprocess.check_output
        for scenario in ("published", "remote", "branch", "dirty", "head", "upstream"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "head" else A2_102) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else A2_102) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"] and scenario == "upstream":
                        return b"origin/main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/fastapi_app.py\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b" M tests/tooling/test_u01_postmerge_control_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_control_b_git_requires_design_change_and_exact_code(self):
        bundle, _ = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_task2_git
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json",
            "design_change.md"}
        for scenario in ("published", "remote", "dirty", "missing_design", "product_docs",
                         "stale_code", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else self.CONTROL_PUBLICATION)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b"")
                    if tail == ["rev-list", "--count", f"{A2_102}..{self.CONTROL}"]:
                        return b"1\n"
                    if tail == ["rev-list", "--count", f"{self.CONTROL}..{self.CONTROL_PUBLICATION}"]:
                        return b"1\n"
                    if tail == ["rev-list", "--min-parents=2", f"{A2_102}..{self.CONTROL}"]:
                        return b"x\n" if scenario == "merge" else b""
                    if tail == ["rev-list", "--min-parents=2", f"{self.CONTROL}..{self.CONTROL_PUBLICATION}"]:
                        return b""
                    for argument, paths in ((f"{A2_102}..{self.CONTROL}", code),
                                            (f"{self.CONTROL}..{self.CONTROL_PUBLICATION}", docs)):
                        if tail and tail[-1] == argument and tail[0] in ("log", "diff"):
                            selected = paths
                            if scenario == "missing_design" and argument.startswith(self.CONTROL):
                                selected = paths - {"design_change.md"}
                            if scenario == "product_docs" and argument.startswith(self.CONTROL):
                                selected = paths | {"packages/api/fastapi_app.py"}
                            return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:2] == ["show", f"{self.CONTROL}:scripts/check_project_progress.py"]:
                        return (b"stale" if scenario == "stale_code"
                            else (ROOT / "scripts/check_project_progress.py").read_bytes())
                    if tail[:2] == ["show", f"{self.CONTROL}:tests/tooling/test_u01_postmerge_control_projection.py"]:
                        return (ROOT / "tests/tooling/test_u01_postmerge_control_projection.py").read_bytes()
                    if tail == ["show", f"{self.CONTROL_PUBLICATION}:docs/progress/build-progress.json"]:
                        return json.dumps(bundle["progress"]).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_product_p_git_rejects_design_change_edit_after_b(self):
        bundle, _ = self.checkpoint_p()
        _, b_files = self.checkpoint_b()
        collector = checker._collect_u01_scoped_dashboard_task2_git
        original, original_run = subprocess.check_output, subprocess.run
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        product = {"packages/api/scoped_dashboard.py",
            "tests/api/test_u01_scoped_dashboard_reader.py"}
        legs = {(A2_102, self.CONTROL): code,
            (self.CONTROL, self.CONTROL_PUBLICATION): docs | {"design_change.md"},
            (self.CONTROL_PUBLICATION, self.PRODUCT): product,
            (self.PRODUCT, self.PRODUCT_PUBLICATION): docs}
        for scenario in ("published", "p_design_change"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/u01-dashboard-r2"]):
                        return (self.PRODUCT_PUBLICATION + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b""
                    if tail[:2] == ["rev-list", "--count"]:
                        return b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return b""
                    if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                        pair = tuple(tail[-1].split(".."))
                        if pair in legs:
                            selected = set(legs[pair])
                            if scenario == "p_design_change" and pair == (self.PRODUCT, self.PRODUCT_PUBLICATION):
                                selected.add("design_change.md")
                            return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for path in PATHS:
                            if tail[-1] == f"{self.CONTROL_PUBLICATION}:{path}":
                                return b_files[path]
                        if tail[-1] == f"{self.PRODUCT_PUBLICATION}:{PATHS[0]}":
                            return json.dumps(bundle["progress"]).encode()
                        for path in code:
                            if tail[-1] == f"{self.CONTROL}:{path}":
                                return (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_closed_git_requires_exact_b_product_p_and_h(self):
        bundle, _ = self.closed_h()
        _, b_files = self.checkpoint_b()
        _, p_files = self.checkpoint_p()
        collector = checker._collect_u01_scoped_dashboard_task2_closed_git
        original, original_run = subprocess.check_output, subprocess.run
        head = "f" * 40
        code = {"scripts/check_project_progress.py",
            "tests/tooling/test_u01_postmerge_control_projection.py"}
        docs = {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}
        product = {"packages/api/scoped_dashboard.py",
            "tests/api/test_u01_scoped_dashboard_reader.py"}
        legs = {(A2_102, self.CONTROL): code,
            (self.CONTROL, self.CONTROL_PUBLICATION): docs | {"design_change.md"},
            (self.CONTROL_PUBLICATION, self.PRODUCT): product,
            (self.PRODUCT, self.PRODUCT_PUBLICATION): docs,
            (self.PRODUCT_PUBLICATION, head): docs}
        for scenario in ("published", "remote", "dirty", "mixed_b", "missing_design",
                         "product_scope", "test_only_product", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/fastapi_app.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--count"]:
                        return b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return (b"merge\n" if scenario == "merge"
                            and tail[-1] == f"{self.PRODUCT}..{self.PRODUCT_PUBLICATION}" else b"")
                    if tail and tail[0] in ("log", "diff") and ".." in tail[-1]:
                        pair = tuple(tail[-1].split(".."))
                        if pair in legs:
                            selected = set(legs[pair])
                            if scenario == "mixed_b" and pair == (self.CONTROL, self.CONTROL_PUBLICATION):
                                selected |= {"packages/api/fastapi_app.py"}
                            if scenario == "missing_design" and pair == (self.CONTROL, self.CONTROL_PUBLICATION):
                                selected -= {"design_change.md"}
                            if scenario == "product_scope" and pair == (self.CONTROL_PUBLICATION, self.PRODUCT):
                                selected |= {"apps/web/src/console/App.tsx"}
                            if scenario == "test_only_product" and pair == (self.CONTROL_PUBLICATION, self.PRODUCT):
                                selected = {"tests/api/test_u01_scoped_dashboard_reader.py"}
                            return ("\n".join(sorted(selected)) + "\n").encode()
                    if tail[:1] == ["show"]:
                        for sha, archive in ((self.CONTROL_PUBLICATION, b_files),
                                             (self.PRODUCT_PUBLICATION, p_files)):
                            for path in PATHS:
                                if tail[-1] == f"{sha}:{path}":
                                    return archive[path]
                        if tail[-1] == f"{head}:docs/progress/build-progress.json":
                            return json.dumps(bundle["progress"]).encode()
                        for path in code:
                            if tail[-1] == f"{self.CONTROL}:{path}":
                                return (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_legacy_entrypoint_dispatches_task2_active_and_closed(self):
        active, _ = archived_task2()
        closed, _ = self.closed_h()
        with patch.object(checker, "_collect_u01_scoped_dashboard_task2_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(active), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_task2_git",
                          return_value=["U01_TASK2_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(active), ["F19A_GIT_INVALID"])
        with patch.object(checker, "_collect_u01_scoped_dashboard_task2_closed_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(closed), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_task2_closed_git",
                          return_value=["U01_TASK2_CLOSE_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(closed), ["F19A_GIT_INVALID"])
