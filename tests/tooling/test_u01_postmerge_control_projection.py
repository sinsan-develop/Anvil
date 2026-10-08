"""Post-PR U-01 intake must preserve F-19A acceptance and lock product writes."""

from copy import deepcopy
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from scripts import check_project_progress as checker


ROOT = Path(__file__).resolve().parents[2]
A = "a116dcd011cdfec3a0e50389976e2431e683209f"
PATHS = (
    "docs/progress/build-progress.json",
    "docs/progress/progress-events.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json",
)


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


if __name__ == "__main__":
    unittest.main()
