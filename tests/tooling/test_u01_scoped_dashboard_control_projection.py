"""Epoch99 scoped Dashboard control must be an exact successor of epoch98."""

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
ISSUED = "35f564340272fa5b5eb5356a9cb115304dfaa339"
ACTIVE = "f0dbf899a0f4401967733cf43c95f2b961d98fab"
PREDECESSOR = "72836ca629ac76d0c6276f9055f7e77aa5a1668a"
CONTROL = "c" * 40
PUBLICATION = "b" * 40
CLOSED = "d" * 40
PATHS = (
    "docs/progress/build-progress.json",
    "docs/progress/progress-events.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json",
)


def archived_active():
    files = {path: subprocess.check_output(["git", "show", f"{ACTIVE}:{path}"], cwd=ROOT)
             for path in PATHS}
    bundle = deepcopy(checker.load_bundle(ROOT))
    bundle["progress"] = json.loads(files[PATHS[0]])
    bundle["events"] = json.loads(files[PATHS[1]])
    bundle["handoff_text"] = files[PATHS[2]].decode("utf-8")
    bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
    bundle["detached_digest"] = json.loads(files[PATHS[3]])
    return bundle, files


def _materialize(bundle, files):
    """Keep synthetic progress, handoff machine summary and detached bytes coherent."""
    progress = bundle["progress"]
    progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
    summary = bundle["handoff"]
    text = re.sub(r"```json anvil-recovery-summary\n.*?\n```",
        "```json anvil-recovery-summary\n" + json.dumps(summary, indent=2) + "\n```",
        bundle["handoff_text"], count=1, flags=re.DOTALL)
    bundle["handoff_text"] = text
    files[PATHS[0]] = (json.dumps(progress, ensure_ascii=False, indent=2) + "\n").encode()
    files[PATHS[2]] = text.encode()
    digest = bundle["detached_digest"]
    for section, path in (("progress", PATHS[0]), ("handoff", PATHS[2])):
        digest[section]["bytes"] = len(files[path])
        digest[section]["file_sha256"] = hashlib.sha256(files[path]).hexdigest().upper()
    files[PATHS[3]] = (json.dumps(digest, ensure_ascii=False, indent=2) + "\n").encode()
    return bundle, files


def checkpoint_bundle():
    bundle, files = archived_active()
    progress = bundle["progress"]
    issued = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
    updated = (issued + timedelta(minutes=1)).isoformat()
    status = "U01_SCOPED_DASHBOARD_CONTROL_CHECKPOINTED_REWORK_CLOSE_READY"
    action = "U01_SCOPED_DASHBOARD_CONTROL_REWORK_CLOSE_ONLY"
    progress["u01_scoped_dashboard_control_binding"].update(status=status,
        next_safe_action=action, control_checkpoint=CONTROL,
        adjacent_regression="235_PASS_1_FAIL_EXIT1")
    progress["active_work_instruction"].update(result_status=status, package_status=status)
    progress["repository"].update(local_head=CONTROL, remote_head=CONTROL,
        head_relation=status, worktree_status=status)
    progress.update(updated_at=updated, next_safe_action=action, runtime_next_action=action,
        next_work_package={"package_id": "U-01", "status": status},
        snapshot_id="snapshot-u01-scoped-dashboard-control-seq2282")
    bundle["handoff"].update(repository_head=CONTROL, next_safe_action=action)
    return _materialize(bundle, files)


def closed_bundle(*, at_override=None):
    bundle, files = checkpoint_bundle()
    progress, stream = bundle["progress"], bundle["events"]
    write, worker = progress["write_lease"], progress["worker_lease"]
    at = (at_override if at_override is not None else
          datetime.fromisoformat(progress["updated_at"]) + timedelta(minutes=1)).isoformat()
    reason = "U01_SCOPED_DASHBOARD_CONTROL_NON_GREEN_HISTORICAL_FIXTURE_REWORK_PENDING"
    for sequence, kind, event_id, details in (
        (2283, "WRITE_LEASE_REVOKED",
            "evt_u01_2283_scoped_dashboard_control_write_lease_revoked",
            {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
             "reason": reason}),
        (2284, "WORKER_LEASE_REVOKED",
            "evt_u01_2284_scoped_dashboard_control_worker_lease_revoked",
            {"lease_id": worker["lease_id"],
             "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
    ):
        previous = hashlib.sha256(checker.canonical_json_bytes(stream["events"][-1])).hexdigest().upper()
        stream["events"].append({"sequence": sequence, "event_id": event_id,
            "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
            "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "U-01",
            "run_id": None, "step_id": "U01_SCOPED_DASHBOARD_CONTROL_CLOSE",
            "subject_ref": "U-01/SCOPED-DASHBOARD-CONTROL", "occurred_at": at,
            "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
            "previous_event_sha256": previous, "details": details})
    stream["last_sequence"] = 2284
    stream["last_event_id"] = stream["events"][-1]["event_id"]
    original = files[PATHS[1]].decode()
    boundary = original.rfind("  ],\n")
    assert boundary >= 0
    appended = ",\n" + ",\n".join("\n".join("  " + line for line in
        json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        for row in stream["events"][-2:]) + "\n"
    rendered = original[:boundary].rstrip("\n") + appended + original[boundary:]
    rendered = rendered.replace('"last_sequence": 2282', '"last_sequence": 2284', 1)
    rendered = rendered.replace('"last_event_id": "evt_u01_2282_scoped_dashboard_control_write_lease_issued"',
        '"last_event_id": "evt_u01_2284_scoped_dashboard_control_worker_lease_revoked"', 1)
    files[PATHS[1]] = rendered.encode()
    status = "U01_SCOPED_DASHBOARD_CONTROL_CLOSED_REWORK_PENDING"
    action = "U01_SCOPED_DASHBOARD_HISTORICAL_FIXTURE_REWORK_DUAL_LEASE_PENDING"
    progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
        files[PATHS[1]]).hexdigest().upper()
    progress["completed_u01_scoped_dashboard_control_write_lease"] = {
        **write, "status": "REVOKED", "revoked_at": at}
    progress["completed_u01_scoped_dashboard_control_worker_lease"] = {
        **worker, "status": "REVOKED", "revoked_at": at}
    progress["worker_lease"] = progress["write_lease"] = None
    progress["u01_scoped_dashboard_control_binding"].update(status=status,
        next_safe_action=action, active_projection_checkpoint=PUBLICATION, event_sequence=2284)
    progress["active_work_instruction"].update(
        result_status="INCOMPLETE_HISTORICAL_FIXTURE_REWORK_REQUIRED", package_status=status)
    progress.update(active_agent=None, updated_at=at, event_sequence=2284,
        last_event_id=stream["last_event_id"], next_safe_action=action,
        runtime_next_action=action, next_work_package={"package_id": "U-01", "status": status},
        snapshot_id="snapshot-u01-scoped-dashboard-control-close-seq2284")
    progress["repository"].update(projection_mode="U01_SCOPED_DASHBOARD_CONTROL_CLOSED",
        head_relation=status, worktree_status=status)
    bundle["handoff"].update(event_sequence=2284, last_event_id=stream["last_event_id"],
        active_agent=None, worker_lease=None, write_lease=None, next_safe_action=action)
    bundle["detached_digest"]["event_sequence"] = 2284
    return _materialize(bundle, files)


class U01ScopedDashboardControlTests(unittest.TestCase):
    def test_closed_git_rejects_unpublished_dirty_or_unrelated_history(self):
        bundle, _ = closed_bundle()
        _, published = checkpoint_bundle()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_control_closed_git", None)
        self.assertIsNotNone(collector)
        original_output, original_run = subprocess.check_output, subprocess.run
        code = ("scripts/check_project_progress.py",
            "tests/tooling/test_u01_scoped_dashboard_control_projection.py")
        docs = ("docs/WORK_STATUS.md", "docs/progress/build-progress.json",
            "docs/progress/progress-events.json", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        for scenario in ("published", "remote", "dirty", "wrong_ancestry", "code_history",
                         "b_history", "h_history", "stale_blob"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (CLOSED + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else CLOSED) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b""
                    for start, end in ((ACTIVE, CONTROL), (CONTROL, PUBLICATION),
                                       (PUBLICATION, CLOSED)):
                        if tail == ["rev-list", "--count", f"{start}..{end}"]:
                            return b"1\n"
                        if tail == ["rev-list", "--min-parents=2", f"{start}..{end}"]:
                            return b""
                        if len(tail) >= 2 and tail[-1] == f"{start}..{end}" and tail[0] in ("log", "diff"):
                            changed = code if start == ACTIVE else docs
                            extra = (("apps/web/src/console/App.tsx",)
                                if ((scenario == "code_history" and start == ACTIVE)
                                    or (scenario == "b_history" and start == CONTROL)
                                    or (scenario == "h_history" and start == PUBLICATION)) else ())
                            return ("\n".join(changed + extra) + "\n").encode()
                    if len(tail) == 2 and tail[0] == "show" and tail[1].startswith(f"{CONTROL}:"):
                        path = tail[1].split(":", 1)[1]
                        return (b"stale" if scenario == "stale_blob" and path == code[0]
                            else (ROOT / path).read_bytes())
                    if len(tail) == 2 and tail[0] == "show" and tail[1].startswith(f"{PUBLICATION}:"):
                        return published[tail[1].split(":", 1)[1]]
                    return original_output(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:2] == ["git", "merge-base"]:
                        return subprocess.CompletedProcess(command,
                            1 if scenario == "wrong_ancestry" and command[-2:] ==
                                 [CONTROL, PUBLICATION] else 0)
                    return original_run(command, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                     patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_closed_projection_revokes_write_then_worker_without_accepting_u01(self):
        bundle, files = closed_bundle()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_control_closed", None)
        self.assertIsNotNone(validator)
        _, published = checkpoint_bundle()
        original = subprocess.check_output

        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and command[2].startswith(f"{PUBLICATION}:"):
                return published[command[2].split(":", 1)[1]]
            return original(command, *args, **kwargs)

        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        archived = {PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}
        with patch.object(subprocess, "check_output", side_effect=output):
            self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
                archived_files=archived), [])
            active_at = datetime.fromisoformat(json.loads(published[PATHS[0]])["updated_at"])
            early, early_files = closed_bundle(at_override=active_at - timedelta(seconds=1))
            self.assertTrue(validator(early, event_raw=early_files[PATHS[1]],
                now=active_at, archived_files={PATHS[0]: early_files[PATHS[0]],
                    PATHS[2]: early_files[PATHS[2]]}))
            for name, mutate in (
                ("event_order", lambda b: b["events"]["events"][2282].update(
                    event_type="WORKER_LEASE_REVOKED")),
                ("event_hash", lambda b: b["events"]["events"][2283].update(
                    previous_event_sha256="0" * 64)),
                ("lease", lambda b: b["progress"]["completed_u01_scoped_dashboard_control_write_lease"].update(
                    status="ACTIVE")),
                ("approval", lambda b: b["progress"]["u01_scoped_dashboard_control_binding"].update(
                    public_api_contract="AWAITING_HUMAN_DECISION")),
                ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_control_binding"].update(
                    vertical_acceptance="ACCEPTED")),
                ("publication", lambda b: b["progress"]["u01_scoped_dashboard_control_binding"].update(
                    active_projection_checkpoint="0" * 40)),
            ):
                with self.subTest(name=name):
                    forged = deepcopy(bundle)
                    mutate(forged)
                    forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                        forged["progress"])
                    self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                        archived_files=archived))

    def test_checkpoint_projection_is_non_green_and_rejects_forged_status(self):
        bundle, files = checkpoint_bundle()
        validator = checker._validate_u01_scoped_dashboard_control_active
        now = datetime.fromisoformat(bundle["progress"]["updated_at"])
        archived = {PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files=archived), [])
        for field, value in (("adjacent_regression", "236_PASS_0_FAIL_EXIT0"),
                             ("status", "U01_SCOPED_DASHBOARD_CONTROL_CHECKPOINTED_CLOSE_READY")):
            with self.subTest(field=field):
                forged = deepcopy(bundle)
                forged["progress"]["u01_scoped_dashboard_control_binding"][field] = value
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(
                    forged["progress"])
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files=archived))

    def test_archived_active_binds_closed_predecessor_and_exact_event_bytes(self):
        bundle, files = archived_active()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_control_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        self.assertEqual(validator(bundle, event_raw=files[PATHS[1]], now=now,
            archived_files={PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}), [])
        predecessor = subprocess.check_output(["git", "show", f"{PREDECESSOR}:{PATHS[1]}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(files[PATHS[1]], 2279),
            checker.raw_event_object_prefix_bytes(predecessor, 2279))

    def test_active_rejects_event_lease_approval_projection_and_digest_forgery(self):
        bundle, files = archived_active()
        validator = getattr(checker, "_validate_u01_scoped_dashboard_control_active", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        archived = {PATHS[0]: files[PATHS[0]], PATHS[2]: files[PATHS[2]]}
        for name, mutate in (
            ("event_envelope", lambda b: b["events"]["events"][2281].update(actor="forged")),
            ("event_chain", lambda b: b["events"]["events"][2281].update(
                previous_event_sha256="0" * 64)),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(
                execution_fencing_token="forged")),
            ("write_token", lambda b: b["progress"]["write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["apps/web/src/console/App.tsx"])),
            ("approval", lambda b: b["progress"]["u01_scoped_dashboard_control_binding"].update(
                approval_sha256="0" * 64)),
            ("acceptance", lambda b: b["progress"]["u01_scoped_dashboard_control_binding"].update(
                vertical_acceptance="ACCEPTED")),
            ("mode", lambda b: b["progress"]["repository"].update(
                projection_mode="U01_HISTORICAL_GIT_FIXTURE_REWORK_CLOSED")),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="FORGED")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validator(forged, event_raw=files[PATHS[1]], now=now,
                    archived_files=archived))
        self.assertTrue(validator(bundle, event_raw=files[PATHS[1]],
            now=datetime.fromisoformat(bundle["progress"]["worker_lease"]["expires_at"]),
            archived_files=archived))
        self.assertTrue(validator(bundle, event_raw=files[PATHS[1]],
            now=now - timedelta(seconds=1), archived_files=archived))

    def test_published_git_rejects_wrong_branch_remote_and_dirty_path(self):
        bundle, _ = archived_active()
        collector = getattr(checker, "_collect_u01_scoped_dashboard_control_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("published", "branch", "upstream", "remote", "dirty", "head"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "head" else ACTIVE) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else ACTIVE) + "\n").encode()
                    if tail == ["branch", "--show-current"] and scenario == "branch":
                        return b"main\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"] and scenario == "upstream":
                        return b"development/main\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M apps/web/src/console/App.tsx\n" if scenario == "dirty"
                            else b" M scripts/check_project_progress.py\n"
                                 b"?? tests/tooling/test_u01_scoped_dashboard_control_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_checkpoint_git_requires_exact_control_then_docs_publication(self):
        bundle, files = checkpoint_bundle()
        collector = checker._collect_u01_scoped_dashboard_control_git
        original_output, original_run = subprocess.check_output, subprocess.run
        code = ("scripts/check_project_progress.py",
            "tests/tooling/test_u01_scoped_dashboard_control_projection.py")
        docs = ("docs/WORK_STATUS.md", "docs/progress/build-progress.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        for scenario in ("published", "remote", "dirty", "code_history", "docs_history",
                         "stale_blob"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (PUBLICATION + "\n").encode()
                    if tail == ["rev-parse", "development/codex/u01-dashboard-r2"]:
                        return (("0" * 40 if scenario == "remote" else PUBLICATION) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M apps/web/src/console/App.tsx\n" if scenario == "dirty" else b""
                    if tail == ["rev-list", "--count", f"{ACTIVE}..{CONTROL}"]:
                        return b"1\n"
                    if tail == ["rev-list", "--count", f"{CONTROL}..{PUBLICATION}"]:
                        return b"1\n"
                    if tail in (["rev-list", "--min-parents=2", f"{ACTIVE}..{CONTROL}"],
                                ["rev-list", "--min-parents=2", f"{CONTROL}..{PUBLICATION}"]):
                        return b""
                    if len(tail) >= 2 and tail[-1] == f"{ACTIVE}..{CONTROL}" and tail[0] in ("log", "diff"):
                        return ("\n".join(code + (("apps/web/src/console/App.tsx",)
                            if scenario == "code_history" else ())) + "\n").encode()
                    if len(tail) >= 2 and tail[-1] == f"{CONTROL}..{PUBLICATION}" and tail[0] in ("log", "diff"):
                        return ("\n".join(docs + (("apps/web/src/console/App.tsx",)
                            if scenario == "docs_history" else ())) + "\n").encode()
                    if len(tail) == 2 and tail[0] == "show" and tail[1].startswith(f"{CONTROL}:"):
                        path = tail[1].split(":", 1)[1]
                        return (b"stale" if scenario == "stale_blob" and path == code[0]
                            else (ROOT / path).read_bytes())
                    if len(tail) == 2 and tail[0] == "show" and tail[1].startswith(f"{PUBLICATION}:"):
                        return files[tail[1].split(":", 1)[1]]
                    return original_output(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:2] == ["git", "merge-base"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                     patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_legacy_entrypoint_dispatches_new_mode_without_weakening_old_close(self):
        bundle, _ = archived_active()
        with patch.object(checker, "_collect_u01_scoped_dashboard_control_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_control_git",
                return_value=["U01_SCOPED_DASHBOARD_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_closed_legacy_entrypoint_dispatches_exact_successor(self):
        bundle, _ = closed_bundle()
        with patch.object(checker, "_collect_u01_scoped_dashboard_control_closed_git",
                return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_u01_scoped_dashboard_control_closed_git",
                return_value=["U01_SCOPED_DASHBOARD_CLOSE_GIT_INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])
        with patch.object(checker, "_validate_u01_scoped_dashboard_control_closed",
                return_value=[]), patch.object(checker, "_collect_u01_scoped_dashboard_control_closed_git",
                return_value=[]), patch.object(checker, "_validate_f20_common_invariants",
                return_value=[]):
            self.assertEqual(checker.validate_bundle(bundle), [])


if __name__ == "__main__":
    unittest.main()
