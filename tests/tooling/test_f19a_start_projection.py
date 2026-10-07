"""F-19A product-start control must preserve the seq2138 predecessor."""

from copy import deepcopy
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import re
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts import check_project_progress as checker


ROOT = Path(__file__).resolve().parents[2]


class F19AStartProjectionTests(unittest.TestCase):
    SYNTHETIC_CHECKPOINT = "a" * 40
    TASK1_ACTIVE_COMMIT = "e7d7976b6a2d8bfd7a71162796feaf0635e294e9"

    @classmethod
    def task1_active_bundle(cls):
        bundle, archive = cls.historical_bundle(cls.TASK1_ACTIVE_COMMIT)
        bundle["_task1_active_raw"] = archive[ROOT / "docs/progress/progress-events.json"]
        bundle["_task1_active_archive"] = archive
        return bundle

    @staticmethod
    def validate_task1_active(bundle, *, now):
        archive = bundle["_task1_active_archive"]
        original_stat, original_sha = Path.stat, checker._sha256

        def historical_stat(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def historical_sha(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        with patch.object(Path, "stat", historical_stat), patch.object(checker, "_sha256", side_effect=historical_sha):
            return checker._validate_f19a_task1_store(bundle,
                event_raw=bundle["_task1_active_raw"], now=now)

    @staticmethod
    def historical_bundle(commit="0149ab1a079bc8c2ccae944e13c2e2a626ebf62b"):
        bundle = checker.load_bundle(ROOT)
        paths = ("docs/progress/build-progress.json", "docs/progress/progress-events.json",
                 "docs/progress/BUILD_HANDOFF.md",
                 "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        archive = {ROOT / path: subprocess.check_output(
            ["git", "show", f"{commit}:{path}"], cwd=ROOT) for path in paths}
        bundle["progress"] = json.loads(archive[ROOT / paths[0]])
        bundle["events"] = json.loads(archive[ROOT / paths[1]])
        bundle["handoff_text"] = archive[ROOT / paths[2]].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive[ROOT / paths[3]])
        for path, data in archive.items():
            bundle["_file_hashes"][path.relative_to(ROOT).as_posix()] = hashlib.sha256(data).hexdigest().upper()
        return bundle, archive

    @staticmethod
    def rework_active_bundle(live=None):
        live = live or checker.load_bundle(ROOT)
        if live["progress"]["event_sequence"] == 2146:
            return live, {}
        checkpoint = live["progress"]["f19a_task0_postclose_fixture_binding"]["control_checkpoint"]
        active, archive = F19AStartProjectionTests.historical_bundle(checkpoint)
        assert active["progress"]["event_sequence"] == 2146
        return active, archive

    @staticmethod
    @contextmanager
    def synthetic_checkpoint_git(checkpoint, *, changed_paths=None, stale_blob=False):
        original_output, original_run = subprocess.check_output, subprocess.run
        base = "abeab9f4e71387dcd6fed97b7061d6f50a73bbce"
        old = "0149ab1a079bc8c2ccae944e13c2e2a626ebf62b"
        exact2 = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = exact2 if changed_paths is None else changed_paths
        committed = original_output(["git", "diff", "--name-only", "--no-renames", f"{base}..{old}"],
                                    cwd=ROOT)

        def git_output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"] or tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return (checkpoint + "\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return b""
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                return committed
            if tail == ["diff", "--name-only", "--no-renames", f"{old}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in exact2:
                    data = (ROOT / path).read_bytes()
                    return b"stale" if stale_blob and path == exact2[0] else data
            return original_output(command, *args, **kwargs)

        def git_run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=git_output), \
                patch.object(subprocess, "run", side_effect=git_run):
            yield

    @staticmethod
    @contextmanager
    def synthetic_rework_checkpoint_git(checkpoint, *, changed_paths=None, stale_blob=False,
                                        dirty=b"", head=None, remote=None):
        original_output, original_run = subprocess.check_output, subprocess.run
        _, active_archive = F19AStartProjectionTests.rework_active_bundle()
        base = "a5c39b1863647a10e5ce8cf70a6d9e10cc3a6f51"
        exact2 = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = exact2 if changed_paths is None else changed_paths
        actual_head = head or checkpoint

        def git_output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in exact2:
                    data = (ROOT / path).read_bytes()
                    return b"stale" if stale_blob and path == exact2[0] else data
                if path in {"docs/progress/progress-events.json", "docs/progress/build-progress.json",
                            "docs/progress/BUILD_HANDOFF.md",
                            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"}:
                    return active_archive.get(ROOT / path) or (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def git_run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=git_output), \
                patch.object(subprocess, "run", side_effect=git_run):
            yield

    @staticmethod
    @contextmanager
    def clean_git_status():
        original = subprocess.check_output

        def clean_status(command, *args, **kwargs):
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b""
            return original(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=clean_status):
            yield

    @classmethod
    def validate_active_clean(cls, bundle, archive):
        original_read, original_stat, original_sha = Path.read_bytes, Path.stat, checker._sha256

        def historical_read(path):
            return archive[path] if path in archive else original_read(path)

        def historical_stat(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def historical_sha(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        with patch.object(Path, "read_bytes", historical_read), patch.object(Path, "stat", historical_stat), \
                patch.object(checker, "_sha256", side_effect=historical_sha), \
                patch.object(checker, "_collect_f19a_start_git", return_value=[]):
            return checker.validate_bundle(bundle)

    @staticmethod
    def closed_fixture(checkpoint=None):
        current, _ = F19AStartProjectionTests.historical_bundle()
        closed = deepcopy(current)
        progress, stream = closed["progress"], closed["events"]
        checkpoint = checkpoint or subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip()
        at = (datetime.fromisoformat(stream["events"][2140]["occurred_at"])
              + timedelta(minutes=30)).isoformat()
        worker, write = stream["events"][2139]["details"], stream["events"][2140]["details"]
        reason = "F19A_TASK0_CONTROL_VALIDATED_LOCAL_ONLY_PRODUCT_NOT_STARTED"
        close = (
            (2142, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2143, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        )
        for sequence, kind, details in close:
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_{kind.lower()}", "event_type": kind,
                "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                "project_id": "anvil", "work_package_id": "F-19A", "run_id": None,
                "step_id": "F19A_TASK0_CONTROL_CLOSE", "subject_ref": "F-19A/MINIMAL-PAIR-AUTH",
                "occurred_at": at, "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2143
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        original_events = subprocess.check_output(["git", "show",
            "0149ab1a079bc8c2ccae944e13c2e2a626ebf62b:docs/progress/progress-events.json"],
            cwd=ROOT).decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2141_write_lease_issued"\n}'
        assert original_events.endswith(footer + "\n")
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (original_events[:-len(footer + "\n")] + ",\n"
                      + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2143_worker_lease_revoked"\n}\n')
        event_text = event_text.replace('"last_sequence": 2141', '"last_sequence": 2143', 1)
        event_raw = event_text.encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task0_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task0_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        progress["f19a_minimal_pair_auth_binding"].update(
            status="TASK0_CONTROL_CLOSED_NOT_PRODUCT_ACCEPTED", control_checkpoint=checkpoint,
            event_sequence=2143)
        progress["active_work_instruction"]["result_status"] = "TASK0_CONTROL_CLOSED_PRODUCT_LEASE_PENDING"
        progress["snapshot_id"] = "snapshot-f19a-task0-close-seq2143"
        progress["updated_at"] = at
        progress["active_agent"] = None
        progress["status"] = "ACTIVE"
        progress["next_safe_action"] = progress["runtime_next_action"] = "F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1"
        progress["next_work_package"] = {"package_id": "F-19A", "status": "PRODUCT_DUAL_LEASE_PENDING"}
        progress["repository"].update(projection_mode="F19A_TASK0_CLOSED", local_head=checkpoint,
            remote_head=checkpoint, head_relation="F19A_TASK0_CLOSED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK0_CLOSED_PRODUCT_WRITE_LOCKED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        summary = deepcopy(current["handoff"])
        summary.update(event_sequence=2143, last_event_id=stream["last_event_id"], status="ACTIVE",
            active_agent=None, worker_lease=None, write_lease=None, repository_head=checkpoint,
            next_safe_action=progress["next_safe_action"])
        handoff_text = re.sub(r"```json anvil-recovery-summary\s*\{.*?\}\s*```",
            "```json anvil-recovery-summary\n" + json.dumps(summary, ensure_ascii=False, indent=2) + "\n```",
            current["handoff_text"], count=1, flags=re.DOTALL)
        closed["handoff_text"] = handoff_text
        closed["handoff"] = checker.extract_handoff_summary(handoff_text)
        progress_raw = (json.dumps(progress, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        handoff_raw = handoff_text.encode("utf-8")
        digest_path = "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"
        digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 2143,
            "self_reference": False,
            "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                         "file_sha256": hashlib.sha256(progress_raw).hexdigest().upper()},
            "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                        "file_sha256": hashlib.sha256(handoff_raw).hexdigest().upper()}}
        archive = {ROOT / "docs/progress/progress-events.json": event_raw,
                   ROOT / "docs/progress/build-progress.json": progress_raw,
                   ROOT / "docs/progress/BUILD_HANDOFF.md": handoff_raw,
                   ROOT / digest_path: (json.dumps(digest, indent=2) + "\n").encode("utf-8")}
        closed["detached_digest"] = digest
        for path, data in archive.items():
            closed["_file_hashes"][path.relative_to(ROOT).as_posix()] = hashlib.sha256(data).hexdigest().upper()
        return closed, archive, event_raw

    @staticmethod
    def rework_closed_fixture(checkpoint=None):
        active, active_archive = F19AStartProjectionTests.rework_active_bundle()
        closed = deepcopy(active)
        closed["_rework_active_event_raw"] = (active_archive.get(ROOT / "docs/progress/progress-events.json")
                                               or (ROOT / "docs/progress/progress-events.json").read_bytes())
        progress, stream = closed["progress"], closed["events"]
        checkpoint = checkpoint or F19AStartProjectionTests.SYNTHETIC_CHECKPOINT
        at = (datetime.fromisoformat(stream["events"][2145]["occurred_at"])
              + timedelta(minutes=30)).isoformat()
        worker, write = stream["events"][2144]["details"], stream["events"][2145]["details"]
        reason = "F19A_TASK0_TEST_REVALIDATED_LOCAL_ONLY_PRODUCT_NOT_STARTED"
        for sequence, kind, details in (
            (2147, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2148, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_{kind.lower()}", "event_type": kind,
                "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                "project_id": "anvil", "work_package_id": "F-19A", "run_id": None,
                "step_id": "F19A_TASK0_POSTCLOSE_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK0-POSTCLOSE-FIXTURE",
                "occurred_at": at, "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2148
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        original_events = (active_archive.get(ROOT / "docs/progress/progress-events.json")
                           or (ROOT / "docs/progress/progress-events.json").read_bytes()).decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2146_write_lease_issued"\n}'
        assert original_events.endswith(footer + "\n")
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (original_events[:-len(footer + "\n")] + ",\n"
                      + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2148_worker_lease_revoked"\n}\n')
        event_text = event_text.replace('"last_sequence": 2146', '"last_sequence": 2148', 1)
        event_raw = event_text.encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task0_rework_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task0_rework_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        progress["f19a_task0_postclose_fixture_binding"].update(
            status="TEST_REVALIDATION_CLOSED_NOT_PRODUCT_ACCEPTED", control_checkpoint=checkpoint,
            next_safe_action="F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1", event_sequence=2148)
        progress["active_work_instruction"]["result_status"] = "TASK0_FIXTURE_REWORK_CLOSED_PRODUCT_LEASE_PENDING"
        progress["snapshot_id"] = "snapshot-f19a-task0-fixture-rework-close-seq2148"
        progress["updated_at"] = at
        progress["active_agent"] = None
        progress["next_safe_action"] = progress["runtime_next_action"] = "F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1"
        progress["next_work_package"] = {"package_id": "F-19A", "status": "PRODUCT_DUAL_LEASE_PENDING"}
        progress["repository"].update(projection_mode="F19A_TASK0_FIXTURE_REWORK_CLOSED",
            local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK0_FIXTURE_REWORK_CLOSED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK0_FIXTURE_REWORK_CLOSED_PRODUCT_WRITE_LOCKED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        summary = deepcopy(active["handoff"])
        summary.update(event_sequence=2148, last_event_id=stream["last_event_id"], status="ACTIVE",
            active_agent=None, worker_lease=None, write_lease=None, repository_head=checkpoint,
            next_safe_action=progress["next_safe_action"])
        handoff_text = re.sub(r"```json anvil-recovery-summary\s*\{.*?\}\s*```",
            "```json anvil-recovery-summary\n" + json.dumps(summary, ensure_ascii=False, indent=2) + "\n```",
            active["handoff_text"], count=1, flags=re.DOTALL)
        closed["handoff_text"] = handoff_text
        closed["handoff"] = checker.extract_handoff_summary(handoff_text)
        progress_raw = (json.dumps(progress, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        handoff_raw = handoff_text.encode("utf-8")
        digest_path = "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"
        digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 2148,
            "self_reference": False,
            "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                         "file_sha256": hashlib.sha256(progress_raw).hexdigest().upper()},
            "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                        "file_sha256": hashlib.sha256(handoff_raw).hexdigest().upper()}}
        archive = {ROOT / "docs/progress/progress-events.json": event_raw,
                   ROOT / "docs/progress/build-progress.json": progress_raw,
                   ROOT / "docs/progress/BUILD_HANDOFF.md": handoff_raw,
                   ROOT / digest_path: (json.dumps(digest, indent=2) + "\n").encode("utf-8")}
        closed["detached_digest"] = digest
        for path, data in archive.items():
            closed["_file_hashes"][path.relative_to(ROOT).as_posix()] = hashlib.sha256(data).hexdigest().upper()
        return closed, archive, event_raw

    @staticmethod
    def validate_closed(bundle, archive, event_raw, *, route=False):
        original_read, original_stat, original_sha = Path.read_bytes, Path.stat, checker._sha256

        def read_historical(path):
            return archive[path] if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def sha_historical(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical), \
                patch.object(checker, "_sha256", side_effect=sha_historical):
            return checker.validate_bundle(bundle) if route else checker._validate_f19a_start(
                bundle, event_raw=event_raw)

    @staticmethod
    def validate_rework_closed(bundle, archive, event_raw, *, route=False):
        original_read, original_stat, original_sha = Path.read_bytes, Path.stat, checker._sha256
        original_git = subprocess.check_output

        def read_historical(path):
            return archive[path] if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def sha_historical(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        def checkpoint_git(command, *args, **kwargs):
            checkpoint = bundle["progress"]["f19a_task0_postclose_fixture_binding"].get("control_checkpoint")
            if command == ["git", "show", f"{checkpoint}:docs/progress/progress-events.json"] \
                    and checkpoint == F19AStartProjectionTests.SYNTHETIC_CHECKPOINT:
                return bundle["_rework_active_event_raw"]
            return original_git(command, *args, **kwargs)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical), \
                patch.object(checker, "_sha256", side_effect=sha_historical), \
                patch.object(subprocess, "check_output", side_effect=checkpoint_git):
            observed = (datetime.fromisoformat(bundle["events"]["events"][2147]["occurred_at"])
                        + timedelta(minutes=1) if len(bundle["events"]["events"]) >= 2148
                        else datetime.now(timezone.utc))
            return checker.validate_bundle(bundle) if route else checker._validate_f19a_task0_rework(
                bundle, event_raw=event_raw, now=observed)

    def test_closed_task0_projection_and_forgery_guards(self):
        closed, archive, event_raw = self.closed_fixture(self.SYNTHETIC_CHECKPOINT)
        self.assertEqual(self.validate_closed(closed, archive, event_raw), [])
        with self.synthetic_checkpoint_git(self.SYNTHETIC_CHECKPOINT):
            self.assertEqual(checker._collect_f19a_start_git(closed), [])
            self.assertEqual(self.validate_closed(closed, archive, event_raw, route=True), [])

        cases = (
            ("revoke_order", lambda b: b["events"]["events"][2141].update(event_type="WORKER_LEASE_REVOKED"), "F19A_EVENT_INVALID"),
            ("revoke_chain", lambda b: b["events"]["events"][2142].update(previous_event_sha256="0" * 64), "F19A_EVENT_INVALID"),
            ("revoke_token", lambda b: b["events"]["events"][2141]["details"].update(write_fencing_token="forged"), "F19A_CLOSE_INVALID"),
            ("revoke_reason", lambda b: b["events"]["events"][2142]["details"].update(reason="ACCEPTED"), "F19A_CLOSE_INVALID"),
            ("revoke_expiry", lambda b: b["events"]["events"][2142].update(occurred_at="2026-10-07T19:03:48+00:00"), "F19A_CLOSE_INVALID"),
            ("completed_scope", lambda b: b["progress"]["completed_f19a_task0_write_lease"].update(path_scope=["packages/api/fastapi_app.py"]), "F19A_CLOSE_INVALID"),
            ("active_replay", lambda b: b["progress"].update(write_lease=b["events"]["events"][2140]["details"]), "F19A_CLOSE_INVALID"),
            ("product_scope", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/fastapi_app.py"]), "F19A_SCOPE_INVALID"),
            ("handoff_head", lambda b: b["handoff"].update(repository_head="0" * 40), "F19A_HANDOFF_INVALID"),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged"), "F19A_SCOPE_INVALID"),
            ("package_status", lambda b: b["progress"].update(status="CLOSED"), "F19A_SCOPE_INVALID"),
        )
        for name, mutate, expected in cases:
            with self.subTest(name=name):
                forged = deepcopy(closed)
                mutate(forged)
                self.assertIn(expected, self.validate_closed(forged, archive, event_raw))

        forged_raw = event_raw.replace(b'"evt_f19a_2141_write_lease_issued"',
                                       b'"evt_f19a_2141_write_lease_forged"', 1)
        self.assertNotEqual(forged_raw, event_raw)
        self.assertIn("F19A_FROZEN_PREFIX_INVALID", self.validate_closed(closed, archive, forged_raw))
        changed_archive = dict(archive)
        changed_archive[ROOT / "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"] = b"{}"
        self.assertIn("F19A_DIGEST_INVALID", self.validate_closed(closed, changed_archive, event_raw))

        old_checkpoint = "0149ab1a079bc8c2ccae944e13c2e2a626ebf62b"
        forged = deepcopy(closed)
        forged["progress"]["f19a_minimal_pair_auth_binding"]["control_checkpoint"] = old_checkpoint
        forged["progress"]["repository"].update(local_head=old_checkpoint, remote_head=old_checkpoint)
        forged["handoff"]["repository_head"] = old_checkpoint
        self.assertEqual(self.validate_closed(forged, archive, event_raw), [])
        with self.synthetic_checkpoint_git(self.SYNTHETIC_CHECKPOINT):
            self.assertEqual(checker._collect_f19a_start_git(forged), ["F19A_GIT_INVALID"])

        old_closed, _, _ = self.closed_fixture(old_checkpoint)
        with self.synthetic_checkpoint_git(self.SYNTHETIC_CHECKPOINT):
            self.assertEqual(checker._collect_f19a_start_git(old_closed), ["F19A_GIT_INVALID"])
        with self.synthetic_checkpoint_git(self.SYNTHETIC_CHECKPOINT, changed_paths=("scripts/check_project_progress.py",)):
            self.assertEqual(checker._collect_f19a_start_git(closed), ["F19A_GIT_INVALID"])
        with self.synthetic_checkpoint_git(self.SYNTHETIC_CHECKPOINT, stale_blob=True):
            self.assertEqual(checker._collect_f19a_start_git(closed), ["F19A_GIT_INVALID"])

        original_git = subprocess.check_output

        def outside_dirty(command, *args, **kwargs):
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b" M packages/api/fastapi_app.py\n"
            return original_git(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=outside_dirty):
            self.assertEqual(checker._collect_f19a_start_git(closed), ["F19A_GIT_INVALID"])

    def test_frozen_stream_header_rejects_consistent_rehash(self):
        current, archive = self.historical_bundle()
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        self.assertEqual(self.validate_closed(current, archive, raw), [])
        for name, old, new in (
            ("stream_id", b'"stream_id": "anvil-build-main"', b'"stream_id": "forged"'),
            ("schema_version", b'"schema_version": "1.0.0"', b'"schema_version": "9.9.9"'),
        ):
            with self.subTest(name=name):
                forged_raw = raw.replace(old, new, 1)
                self.assertNotEqual(forged_raw, raw)
                forged = deepcopy(current)
                forged["events"] = json.loads(forged_raw)
                forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
                    forged_raw).hexdigest().upper()
                self.assertIn("F19A_FROZEN_PREFIX_INVALID", checker._validate_f19a_start(forged, event_raw=forged_raw))

    def test_lease_rejects_consistent_25_hour_window(self):
        current, archive = self.historical_bundle()
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        self.assertEqual(self.validate_closed(current, archive, raw), [])
        forged_raw = raw.replace(b"2026-10-06T19:03:48+00:00", b"2026-10-06T18:03:48+00:00")
        self.assertNotEqual(forged_raw, raw)
        for index in (2139, 2140):
            rows = json.loads(forged_raw)["events"]
            old_hash = rows[index]["previous_event_sha256"].encode()
            new_hash = hashlib.sha256(checker.canonical_json_bytes(rows[index - 1])).hexdigest().upper().encode()
            forged_raw = forged_raw.replace(old_hash, new_hash, 1)
        forged = deepcopy(current)
        forged["events"] = json.loads(forged_raw)
        forged["progress"]["worker_lease"] = forged["events"]["events"][2139]["details"]
        forged["progress"]["write_lease"] = forged["events"]["events"][2140]["details"]
        forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
            forged_raw).hexdigest().upper()
        self.assertIn("F19A_LEASE_INVALID", checker._validate_f19a_start(forged, event_raw=forged_raw))

    def test_current_snapshot_identity_and_evidence_are_fixed(self):
        current, archive = self.historical_bundle()
        self.assertEqual(self.validate_closed(current, archive,
            archive[ROOT / "docs/progress/progress-events.json"]), [])
        for name, mutate in (
            ("snapshot_id", lambda p: p.update(snapshot_id="snapshot-forged")),
            ("updated_at", lambda p: p.update(updated_at="2026-10-07T05:03:48+09:00")),
            ("evidence_ref", lambda p: p["current_progress_evidence_ref"].update(package_id="F-20")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(current)
                mutate(forged["progress"])
                self.assertIn("F19A_SCOPE_INVALID", checker._validate_f19a_start(forged))

    def test_active_projection_and_history_guards(self):
        current, archive = self.historical_bundle()
        self.assertEqual(current["progress"]["event_sequence"], 2141)
        self.assertEqual(self.validate_active_clean(current, archive), [])

        for name, edit, code in (
            ("old_completed_lease", lambda b: b["progress"]["completed_epoch70_postclose_fixture_worker_lease"].update(path_scope=["packages/api/fastapi_app.py"]), "F19A_FROZEN_PROJECTION_INVALID"),
            ("old_acceptance", lambda b: b["progress"]["f20_invalidated_acceptance"].update(invalidation_event_id="forged"), "F19A_FROZEN_PROJECTION_INVALID"),
            ("old_registry", lambda b: b["progress"]["registry_refs"]["failure_ledger"].update(sha256="0" * 64), "F19A_FROZEN_PROJECTION_INVALID"),
            ("old_repository", lambda b: b["progress"]["repository"].update(local_wsl_qa_head="forged"), "F19A_FROZEN_PROJECTION_INVALID"),
            ("event_identity", lambda b: b["events"]["events"][2138].update(work_package_id="F-20"), "F19A_EVENT_INVALID"),
            ("event_type", lambda b: b["events"]["events"][2138].update(event_type="PACKAGE_STARTED"), "F19A_EVENT_INVALID"),
            ("event_chain", lambda b: b["events"]["events"][2139].update(previous_event_sha256="0" * 64), "F19A_EVENT_INVALID"),
            ("wi_hash", lambda b: b["events"]["events"][2138]["details"].update(sha256="0" * 64), "F19A_WORK_INSTRUCTION_INVALID"),
            ("approval", lambda b: b["events"]["events"][2138]["details"].update(approval_sha256="0" * 64), "F19A_WORK_INSTRUCTION_INVALID"),
            ("lease_token", lambda b: b["events"]["events"][2140]["details"].update(write_fencing_token="forged"), "F19A_LEASE_INVALID"),
            ("lease_effect", lambda b: b["progress"].update(write_lease=None), "F19A_LEASE_INVALID"),
            ("binding_scope", lambda b: b["progress"]["f19a_minimal_pair_auth_binding"].update(developer_exact_paths=["scripts/check_project_progress.py"]), "F19A_SCOPE_INVALID"),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64), "PRG_SNAPSHOT_HASH_MISMATCH"),
        ):
            with self.subTest(name=name):
                forged = deepcopy(current)
                edit(forged)
                self.assertIn(code, self.validate_active_clean(forged, archive))

    def test_frozen_raw_prefix_and_expiry(self):
        current, archive = self.historical_bundle()
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        self.assertEqual(self.validate_closed(current, archive, raw), [])
        changed = raw.replace(b'"evt_f20_2138_worker_lease_revoked"',
                              b'"evt_f20_2138_worker_lease_forged"', 1)
        self.assertNotEqual(changed, raw)
        validate = getattr(checker, "_validate_f19a_start", lambda *a, **k: ["F19A_START_ROUTE_MISSING"])
        self.assertIn("F19A_FROZEN_PREFIX_INVALID", validate(current, event_raw=changed))
        self.assertIn("F19A_LEASE_INVALID", validate(
            current, now=datetime(2026, 10, 7, 19, 3, 48, tzinfo=timezone.utc)))

    def test_git_scope_starts_valid_then_rejects_unrelated_dirty(self):
        current, _ = self.historical_bundle()
        collect = getattr(checker, "_collect_f19a_start_git", lambda *a: ["F19A_GIT_ROUTE_MISSING"])
        with self.synthetic_checkpoint_git("0149ab1a079bc8c2ccae944e13c2e2a626ebf62b"):
            with self.clean_git_status():
                self.assertEqual(collect(current), [])
            original = subprocess.check_output

            def outside_dirty(command, *args, **kwargs):
                if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                    return b" M packages/api/not-in-scope.py\n"
                return original(command, *args, **kwargs)

            with patch.object(subprocess, "check_output", side_effect=outside_dirty):
                self.assertEqual(collect(current), ["F19A_GIT_INVALID"])

    def test_clean_task0_checkpoint_descendant_only(self):
        current, _ = self.historical_bundle()
        checkpoint = "a" * 40
        remote_head = [checkpoint]
        ancestor_valid = [True]
        delta = [
            "docs/WORK_STATUS.md",
            "docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md",
            "docs/architecture/f19a/F19A_MINIMAL_PAIR_AUTH_CONTRACT.md",
            "docs/work_orders/F-19A_MINIMAL_PAIR_AUTH_IMPLEMENTATION_PLAN.md",
            "docs/work_orders/F-19A_MINIMAL_PAIR_AUTH_WORK_INSTRUCTION.md",
            "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json",
            "scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py",
        ]
        original_check_output = subprocess.check_output

        def git_result(command, *args, **kwargs):
            tail = command[5:]
            if tail == ["rev-parse", "HEAD"]:
                return (checkpoint + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return (remote_head[0] + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames",
                        "abeab9f4e71387dcd6fed97b7061d6f50a73bbce..HEAD"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return b""
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            return original_check_output(command, *args, **kwargs)

        def ancestry(command, *args, **kwargs):
            return subprocess.CompletedProcess(command, 0 if ancestor_valid[0] else 1)

        with patch.object(subprocess, "check_output", side_effect=git_result), patch.object(
                subprocess, "run", side_effect=ancestry):
            self.assertEqual(checker._collect_f19a_start_git(current), [])
            delta.append("packages/api/unrelated.py")
            self.assertEqual(checker._collect_f19a_start_git(current), ["F19A_GIT_INVALID"])
            delta.pop()
            remote_head[0] = "b" * 40
            self.assertEqual(checker._collect_f19a_start_git(current), ["F19A_GIT_INVALID"])
            remote_head[0] = checkpoint
            ancestor_valid[0] = False
            self.assertEqual(checker._collect_f19a_start_git(current), ["F19A_GIT_INVALID"])

    def test_epoch72_current_successor_is_valid_and_product_locked(self):
        closed, archive = self.historical_bundle("a5c39b1863647a10e5ce8cf70a6d9e10cc3a6f51")
        self.assertEqual(closed["progress"]["event_sequence"], 2143)
        self.assertIsNone(closed["progress"]["worker_lease"])
        self.assertIsNone(closed["progress"]["write_lease"])
        self.assertEqual(self.validate_closed(closed, archive,
            archive[ROOT / "docs/progress/progress-events.json"]), [])
        current, active_archive = self.rework_active_bundle()
        active_raw = active_archive.get(ROOT / "docs/progress/progress-events.json") or (
            ROOT / "docs/progress/progress-events.json").read_bytes()
        self.assertEqual(current["progress"]["event_sequence"], 2146)
        self.assertEqual(current["progress"]["repository"]["projection_mode"],
                         "F19A_TASK0_FIXTURE_REWORK_ACTIVE")
        checkpoint = checker.load_bundle(ROOT)["progress"]["f19a_task0_postclose_fixture_binding"]["control_checkpoint"]
        with self.synthetic_rework_checkpoint_git(checkpoint):
            self.assertEqual(self.validate_rework_closed(current, active_archive, active_raw, route=True), [])
        for name, change, expected in (
            ("product_scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["packages/api/fastapi_app.py"]), "F19A_REWORK_LEASE_INVALID"),
            ("next_action", lambda b: b["progress"].update(
                next_safe_action="F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1"), "F19A_REWORK_SCOPE_INVALID"),
            ("event_token", lambda b: b["events"]["events"][2145]["details"].update(
                write_fencing_token="forged"), "F19A_REWORK_LEASE_INVALID"),
            ("old_completed", lambda b: b["progress"]["completed_f19a_task0_write_lease"].update(
                status="ACTIVE"), "F19A_REWORK_FROZEN_INVALID"),
        ):
            with self.subTest(name=name):
                forged = deepcopy(current)
                change(forged)
                self.assertIn(expected, self.validate_rework_closed(
                    forged, active_archive, active_raw, route=True))

    def test_epoch72_rejects_frozen_stream_and_successor_forgery(self):
        current, active_archive = self.rework_active_bundle()
        raw = active_archive.get(ROOT / "docs/progress/progress-events.json") or (
            ROOT / "docs/progress/progress-events.json").read_bytes()
        self.assertEqual(self.validate_rework_closed(current, active_archive, raw), [])
        for name, old, new in (
            ("stream_header", b'"stream_id": "anvil-build-main"', b'"stream_id": "forged"'),
            ("frozen_event", b'"evt_f19a_2143_worker_lease_revoked"',
             b'"evt_f19a_2143_worker_lease_forger"'),
        ):
            with self.subTest(name=name):
                forged_raw = raw.replace(old, new, 1)
                self.assertNotEqual(forged_raw, raw)
                forged = deepcopy(current)
                forged["events"] = json.loads(forged_raw)
                forged["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
                    forged_raw).hexdigest().upper()
                self.assertIn("F19A_REWORK_FROZEN_INVALID",
                              self.validate_rework_closed(forged, active_archive, forged_raw))

        cases = (
            ("event_order", lambda b: b["events"]["events"][2144].update(
                event_type="WRITE_LEASE_ISSUED"), "F19A_REWORK_EVENT_INVALID"),
            ("wi_hash", lambda b: b["events"]["events"][2143]["details"].update(
                sha256="0" * 64), "F19A_REWORK_INSTRUCTION_INVALID"),
            ("worker_expiry", lambda b: b["events"]["events"][2144]["details"].update(
                expires_at="2026-10-07T22:07:37+00:00"), "F19A_REWORK_LEASE_INVALID"),
            ("separate_tokens", lambda b: b["events"]["events"][2145]["details"].update(
                write_fencing_token=b["events"]["events"][2144]["details"]["fencing_token"]),
             "F19A_REWORK_LEASE_INVALID"),
            ("old_approval", lambda b: b["progress"]["f19a_minimal_pair_auth_binding"].update(
                approval_sha256="0" * 64), "F19A_REWORK_FROZEN_INVALID"),
            ("repository_relation", lambda b: b["progress"]["repository"].update(
                head_relation="FORGED"), "F19A_REWORK_SCOPE_INVALID"),
            ("handoff_action", lambda b: b["handoff"].update(
                next_safe_action="F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1"), "F19A_REWORK_HANDOFF_INVALID"),
            ("snapshot_hash", lambda b: b["progress"].update(
                snapshot_hash="0" * 64), "PRG_SNAPSHOT_HASH_MISMATCH"),
        )
        for name, change, expected in cases:
            with self.subTest(name=name):
                forged = deepcopy(current)
                change(forged)
                self.assertIn(expected, self.validate_rework_closed(
                    forged, active_archive, raw, route=True))

    def test_epoch72_git_scope_is_valid_then_rejects_outside_dirty_and_remote(self):
        current, _ = self.rework_active_bundle()
        checkpoint = checker.load_bundle(ROOT)["progress"]["f19a_task0_postclose_fixture_binding"]["control_checkpoint"]
        with self.synthetic_rework_checkpoint_git(checkpoint):
            self.assertEqual(checker._collect_f19a_task0_rework_git(current), [])
            self.assertEqual(checker._collect_f19a_start_git(current), [])
            original = subprocess.check_output

            def outside_dirty(command, *args, **kwargs):
                if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                    return b" M packages/api/fastapi_app.py\n"
                return original(command, *args, **kwargs)

            with patch.object(subprocess, "check_output", side_effect=outside_dirty):
                self.assertEqual(checker._collect_f19a_task0_rework_git(current), ["F19A_REWORK_GIT_INVALID"])
                self.assertEqual(checker._collect_f19a_start_git(current), ["F19A_GIT_INVALID"])

            def remote_divergence(command, *args, **kwargs):
                if command[-2:] == ["rev-parse", "development/codex/f18-wsl-ops"]:
                    return b"0000000000000000000000000000000000000000\n"
                return original(command, *args, **kwargs)

            with patch.object(subprocess, "check_output", side_effect=remote_divergence):
                self.assertEqual(checker._collect_f19a_task0_rework_git(current), ["F19A_REWORK_GIT_INVALID"])

    def test_epoch72_post_checkpoint_requires_clean_tree_even_for_allowed_paths(self):
        current, _ = self.rework_active_bundle()
        checkpoint = checker.load_bundle(ROOT)["progress"]["f19a_task0_postclose_fixture_binding"]["control_checkpoint"]
        with self.synthetic_rework_checkpoint_git(checkpoint):
            self.assertEqual(checker._collect_f19a_task0_rework_git(current), [])
        fake_head = "b" * 40
        original_output, original_run = subprocess.check_output, subprocess.run

        def post_checkpoint(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail in (["rev-parse", "HEAD"],
                        ["rev-parse", "development/codex/f18-wsl-ops"]):
                return (fake_head + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames",
                        "a5c39b1863647a10e5ce8cf70a6d9e10cc3a6f51..HEAD"]:
                return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return b" M scripts/check_project_progress.py\n"
            return original_output(command, *args, **kwargs)

        def descendant(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=post_checkpoint), \
                patch.object(subprocess, "run", side_effect=descendant):
            self.assertEqual(checker._collect_f19a_task0_rework_git(current), ["F19A_REWORK_GIT_INVALID"])
            self.assertEqual(checker._collect_f19a_start_git(current), ["F19A_GIT_INVALID"])

    def test_epoch72_closed_projection_preserves_issued_scope_and_rejects_forgery(self):
        closed, archive, event_raw = self.rework_closed_fixture()
        self.assertEqual(closed["progress"]["event_sequence"], 2148)
        self.assertEqual(self.validate_rework_closed(closed, archive, event_raw), [])
        for name, change, expected in (
            ("revoke_order", lambda b: b["events"]["events"][2146].update(
                event_type="WORKER_LEASE_REVOKED"), "F19A_REWORK_EVENT_INVALID"),
            ("revoke_token", lambda b: b["events"]["events"][2146]["details"].update(
                write_fencing_token="forged"), "F19A_REWORK_CLOSE_INVALID"),
            ("revoke_reason", lambda b: b["events"]["events"][2147]["details"].update(
                reason="PRODUCT_ACCEPTED"), "F19A_REWORK_CLOSE_INVALID"),
            ("revoke_expiry", lambda b: b["events"]["events"][2147].update(
                occurred_at="2026-10-07T21:07:37+00:00"), "F19A_REWORK_CLOSE_INVALID"),
            ("completed_scope", lambda b: b["progress"]["completed_f19a_task0_rework_write_lease"].update(
                path_scope=["packages/api/fastapi_app.py"]), "F19A_REWORK_CLOSE_INVALID"),
            ("active_replay", lambda b: b["progress"].update(
                write_lease=b["events"]["events"][2145]["details"]), "F19A_REWORK_CLOSE_INVALID"),
            ("product_scope", lambda b: b["progress"]["repository"].update(
                product_write_scope=["packages/api/fastapi_app.py"]), "F19A_REWORK_FROZEN_INVALID"),
            ("checkpoint", lambda b: b["progress"]["f19a_task0_postclose_fixture_binding"].update(
                control_checkpoint="0" * 40), "F19A_REWORK_CONTROL_MISSING"),
            ("handoff", lambda b: b["handoff"].update(
                repository_head="0" * 40), "F19A_REWORK_HANDOFF_INVALID"),
        ):
            with self.subTest(name=name):
                forged = deepcopy(closed)
                change(forged)
                self.assertIn(expected, self.validate_rework_closed(forged, archive, event_raw))

    def test_epoch72_closed_git_requires_fresh_code_checkpoint_and_clean_descendant(self):
        checkpoint = self.SYNTHETIC_CHECKPOINT
        closed, archive, event_raw = self.rework_closed_fixture(checkpoint)
        with self.synthetic_rework_checkpoint_git(checkpoint):
            self.assertEqual(checker._collect_f19a_task0_rework_git(closed), [])
            self.assertEqual(self.validate_rework_closed(closed, archive, event_raw, route=True), [])
        with self.synthetic_rework_checkpoint_git(checkpoint, changed_paths=(
                "scripts/check_project_progress.py",)):
            self.assertEqual(checker._collect_f19a_task0_rework_git(closed), ["F19A_REWORK_GIT_INVALID"])
        with self.synthetic_rework_checkpoint_git(checkpoint, stale_blob=True):
            self.assertEqual(checker._collect_f19a_task0_rework_git(closed), ["F19A_REWORK_GIT_INVALID"])
        with self.synthetic_rework_checkpoint_git(checkpoint, dirty=b" M scripts/check_project_progress.py\n"):
            self.assertEqual(checker._collect_f19a_task0_rework_git(closed), ["F19A_REWORK_GIT_INVALID"])
        stale, _, _ = self.rework_closed_fixture("a5c39b1863647a10e5ce8cf70a6d9e10cc3a6f51")
        with self.synthetic_rework_checkpoint_git(checkpoint):
            self.assertEqual(checker._collect_f19a_task0_rework_git(stale), ["F19A_REWORK_GIT_INVALID"])

    def test_epoch72_active_fixture_is_recoverable_after_closed_projection(self):
        checkpoint = self.SYNTHETIC_CHECKPOINT
        closed, _, _ = self.rework_closed_fixture(checkpoint)
        with self.synthetic_rework_checkpoint_git(checkpoint):
            active, archive = self.rework_active_bundle(closed)
            self.assertEqual(active["progress"]["event_sequence"], 2146)
            self.assertEqual(active["progress"]["write_lease"]["product_write_scope"], [])
            self.assertEqual(self.validate_rework_closed(active, archive,
                archive[ROOT / "docs/progress/progress-events.json"], route=True), [])

    def test_epoch72_close_pending_checkpoint_allows_only_control_projection_dirty(self):
        checkpoint = self.SYNTHETIC_CHECKPOINT
        closed, archive, event_raw = self.rework_closed_fixture(checkpoint)
        control_dirty = (b" M docs/WORK_STATUS.md\n M docs/progress/BUILD_HANDOFF.md\n"
                         b" M docs/progress/build-progress.json\n M docs/progress/progress-events.json\n"
                         b" M docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json\n")
        with self.synthetic_rework_checkpoint_git(checkpoint, dirty=control_dirty):
            self.assertEqual(self.validate_rework_closed(closed, archive, event_raw, route=True), [])
        published_close = "b" * 40
        with self.synthetic_rework_checkpoint_git(checkpoint, head=published_close):
            self.assertEqual(self.validate_rework_closed(closed, archive, event_raw, route=True), [])
        for name, kwargs in (
            ("code_dirty", {"dirty": control_dirty + b" M scripts/check_project_progress.py\n"}),
            ("unrelated_dirty", {"dirty": control_dirty + b" M packages/api/runtime.py\n"}),
            ("missing_checkpoint", {"dirty": control_dirty, "head": "b" * 40}),
            ("unpublished_head", {"dirty": control_dirty, "remote": "b" * 40}),
            ("postcommit_prepush", {"head": published_close, "remote": checkpoint}),
        ):
            with self.subTest(name=name), self.synthetic_rework_checkpoint_git(checkpoint, **kwargs):
                self.assertIn("F19A_REWORK_GIT_INVALID",
                              self.validate_rework_closed(closed, archive, event_raw, route=True))

    def test_epoch73_active_projection_fails_closed_on_control_forgery(self):
        current, archive = self.r2_active_bundle()
        raw = archive.get(ROOT / "docs/progress/progress-events.json") or (
            ROOT / "docs/progress/progress-events.json").read_bytes()
        self.assertEqual(current["progress"]["event_sequence"], 2151)
        self.assertEqual(self.validate_r2_active(current, archive, raw), [])
        for name, change in (
            ("old_prefix", lambda b: b["events"]["events"][2147].update(event_id="forged")),
            ("issued_token", lambda b: b["events"]["events"][2150]["details"].update(
                write_fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(
                product_write_scope=["packages/api/runtime.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(current)
                change(forged)
                self.assertTrue(self.validate_r2_active(forged, archive, raw))

    @staticmethod
    def r2_active_bundle():
        live = checker.load_bundle(ROOT)
        if live["progress"]["event_sequence"] == 2151:
            return live, {}
        checkpoint = live["progress"]["f19a_task0_git_fixture_r2_binding"]["control_checkpoint"]
        return F19AStartProjectionTests.historical_bundle(checkpoint)

    @staticmethod
    def validate_r2_active(bundle, archive, event_raw):
        original_read, original_stat, original_sha = Path.read_bytes, Path.stat, checker._sha256

        def read_historical(path):
            return archive[path] if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def sha_historical(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical), \
                patch.object(checker, "_sha256", side_effect=sha_historical):
            observed = datetime.fromisoformat(bundle["events"]["events"][2150]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_git_fixture_r2(bundle, event_raw=event_raw, now=observed)

    @staticmethod
    def r2_closed_fixture(checkpoint=None):
        active, active_archive = F19AStartProjectionTests.r2_active_bundle()
        closed = deepcopy(active)
        checkpoint = checkpoint or F19AStartProjectionTests.SYNTHETIC_CHECKPOINT
        progress, stream = closed["progress"], closed["events"]
        active_raw = (active_archive.get(ROOT / "docs/progress/progress-events.json")
                      or (ROOT / "docs/progress/progress-events.json").read_bytes())
        closed["_r2_active_event_raw"] = active_raw
        at = (datetime.fromisoformat(stream["events"][2150]["occurred_at"])
              + timedelta(minutes=1)).isoformat()
        worker, write = stream["events"][2149]["details"], stream["events"][2150]["details"]
        reason = "F19A_TASK0_GIT_FIXTURE_R2_VALIDATED_LOCAL_ONLY_PRODUCT_NOT_STARTED"
        for sequence, kind, details in (
            (2152, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2153, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_{kind.lower()}", "event_type": kind,
                "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                "project_id": "anvil", "work_package_id": "F-19A", "run_id": None,
                "step_id": "F19A_TASK0_GIT_FIXTURE_R2_CLOSE", "subject_ref": "F-19A/TASK0-GIT-FIXTURE-R2",
                "occurred_at": at, "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2153
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        original = active_raw.decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2151_write_lease_issued"\n}'
        assert original.endswith(footer + "\n")
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (original[:-len(footer + "\n")] + ",\n"
                      + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2153_worker_lease_revoked"\n}\n')
        event_text = event_text.replace('"last_sequence": 2151', '"last_sequence": 2153', 1)
        event_raw = event_text.encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task0_git_fixture_r2_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task0_git_fixture_r2_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        progress["f19a_task0_git_fixture_r2_binding"].update(
            status="GIT_FIXTURE_R2_CLOSED_NOT_PRODUCT_ACCEPTED", control_checkpoint=checkpoint,
            next_safe_action="F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1", event_sequence=2153)
        progress["active_work_instruction"]["result_status"] = "TASK0_GIT_FIXTURE_R2_CLOSED_PRODUCT_LEASE_PENDING"
        progress["snapshot_id"] = "snapshot-f19a-task0-git-fixture-r2-close-seq2153"
        progress["updated_at"] = at
        progress["active_agent"] = None
        progress["next_safe_action"] = progress["runtime_next_action"] = "F19A_ISSUE_PRODUCT_DUAL_LEASE_TASK1"
        progress["next_work_package"] = {"package_id": "F-19A", "status": "PRODUCT_DUAL_LEASE_PENDING"}
        progress["repository"].update(projection_mode="F19A_TASK0_GIT_FIXTURE_R2_CLOSED",
            local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK0_GIT_FIXTURE_R2_CLOSED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK0_GIT_FIXTURE_R2_CLOSED_PRODUCT_WRITE_LOCKED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        summary = deepcopy(active["handoff"])
        summary.update(event_sequence=2153, last_event_id=stream["last_event_id"], status="ACTIVE",
            active_agent=None, worker_lease=None, write_lease=None, repository_head=checkpoint,
            next_safe_action=progress["next_safe_action"])
        handoff_text = re.sub(r"```json anvil-recovery-summary\s*\{.*?\}\s*```",
            "```json anvil-recovery-summary\n" + json.dumps(summary, ensure_ascii=False, indent=2) + "\n```",
            active["handoff_text"], count=1, flags=re.DOTALL)
        closed["handoff_text"] = handoff_text
        closed["handoff"] = checker.extract_handoff_summary(handoff_text)
        progress_raw = (json.dumps(progress, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        handoff_raw = handoff_text.encode("utf-8")
        digest_path = "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"
        digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 2153,
            "self_reference": False,
            "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                         "file_sha256": hashlib.sha256(progress_raw).hexdigest().upper()},
            "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                        "file_sha256": hashlib.sha256(handoff_raw).hexdigest().upper()}}
        archive = {ROOT / "docs/progress/progress-events.json": event_raw,
                   ROOT / "docs/progress/build-progress.json": progress_raw,
                   ROOT / "docs/progress/BUILD_HANDOFF.md": handoff_raw,
                   ROOT / digest_path: (json.dumps(digest, indent=2) + "\n").encode("utf-8")}
        closed["detached_digest"] = digest
        for path, data in archive.items():
            closed["_file_hashes"][path.relative_to(ROOT).as_posix()] = hashlib.sha256(data).hexdigest().upper()
        return closed, archive, event_raw

    @staticmethod
    def validate_r2_closed(bundle, archive, event_raw, *, route=False):
        original_read, original_stat, original_sha = Path.read_bytes, Path.stat, checker._sha256
        original_git = subprocess.check_output

        def read_historical(path):
            return archive[path] if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def sha_historical(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        def checkpoint_git(command, *args, **kwargs):
            checkpoint = bundle["progress"]["f19a_task0_git_fixture_r2_binding"].get("control_checkpoint")
            if command == ["git", "show", f"{checkpoint}:docs/progress/progress-events.json"] \
                    and checkpoint == F19AStartProjectionTests.SYNTHETIC_CHECKPOINT:
                return bundle["_r2_active_event_raw"]
            return original_git(command, *args, **kwargs)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical), \
                patch.object(checker, "_sha256", side_effect=sha_historical), \
                patch.object(subprocess, "check_output", side_effect=checkpoint_git):
            observed = datetime.fromisoformat(bundle["events"]["events"][2152]["occurred_at"]) + timedelta(minutes=1)
            return checker.validate_bundle(bundle) if route else checker._validate_f19a_git_fixture_r2(
                bundle, event_raw=event_raw, now=observed)

    def test_epoch73_closed_projection_and_forgery(self):
        closed, archive, event_raw = self.r2_closed_fixture()
        self.assertEqual(self.validate_r2_closed(closed, archive, event_raw), [])
        for name, change in (
            ("revoke_order", lambda b: b["events"]["events"][2151].update(event_type="WORKER_LEASE_REVOKED")),
            ("revoke_token", lambda b: b["events"]["events"][2151]["details"].update(write_fencing_token="forged")),
            ("revoke_reason", lambda b: b["events"]["events"][2152]["details"].update(reason="PRODUCT_ACCEPTED")),
            ("revoke_expiry", lambda b: b["events"]["events"][2152].update(
                occurred_at="2026-10-07T22:41:47+00:00")),
            ("completed_scope", lambda b: b["progress"]["completed_f19a_task0_git_fixture_r2_write_lease"].update(
                product_write_scope=["packages/api/runtime.py"])),
            ("product_scope", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/runtime.py"])),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(closed)
                change(forged)
                self.assertTrue(self.validate_r2_closed(forged, archive, event_raw))

    @staticmethod
    @contextmanager
    def synthetic_r2_checkpoint_git(checkpoint, *, changed_paths=None, stale_blob=False,
                                    dirty=b"", head=None, remote=None):
        original_output, original_run = subprocess.check_output, subprocess.run
        base = "67d20aaf334679929cd8f929b1821ac307fcbebd"
        exact2 = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = exact2 if changed_paths is None else changed_paths
        actual_head = head or checkpoint
        active_raw = (ROOT / "docs/progress/progress-events.json").read_bytes()

        def git_output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["show", f"{checkpoint}:docs/progress/progress-events.json"]:
                return active_raw
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in exact2:
                    data = (ROOT / path).read_bytes()
                    return b"stale" if stale_blob and path == exact2[0] else data
            return original_output(command, *args, **kwargs)

        def git_run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=git_output), \
                patch.object(subprocess, "run", side_effect=git_run):
            yield

    def test_epoch73_closed_git_requires_code_checkpoint_and_publication(self):
        checkpoint = self.SYNTHETIC_CHECKPOINT
        closed, archive, event_raw = self.r2_closed_fixture(checkpoint)
        control_dirty = (b" M docs/WORK_STATUS.md\n M docs/progress/BUILD_HANDOFF.md\n"
                         b" M docs/progress/build-progress.json\n M docs/progress/progress-events.json\n"
                         b" M docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json\n")
        for dirty in (b"", control_dirty):
            with self.synthetic_r2_checkpoint_git(checkpoint, dirty=dirty):
                self.assertEqual(self.validate_r2_closed(closed, archive, event_raw, route=True), [])
        for name, kwargs in (
            ("unrelated_dirty", {"dirty": control_dirty + b" M packages/api/runtime.py\n"}),
            ("code_dirty", {"dirty": control_dirty + b" M scripts/check_project_progress.py\n"}),
            ("missing_code", {"changed_paths": ("scripts/check_project_progress.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("unpublished", {"remote": "b" * 40}),
            ("postcommit_prepush", {"head": "b" * 40, "remote": checkpoint}),
        ):
            with self.subTest(name=name), self.synthetic_r2_checkpoint_git(checkpoint, **kwargs):
                self.assertIn("F19A_R2_GIT_INVALID",
                              self.validate_r2_closed(closed, archive, event_raw, route=True))

    def test_epoch74_task1_control_projection_and_forgery(self):
        current = self.task1_active_bundle()
        self.assertEqual(current["progress"]["event_sequence"], 2156)
        raw = current["_task1_active_raw"]
        observed = datetime.fromisoformat(current["events"]["events"][2155]["occurred_at"]) + timedelta(minutes=1)
        self.assertEqual(self.validate_task1_active(current, now=observed), [])
        for name, change in (
            ("frozen_event", lambda b: b["events"]["events"][2152].update(event_id="forged")),
            ("work_instruction", lambda b: b["events"]["events"][2153]["details"].update(sha256="forged")),
            ("worker_token", lambda b: b["events"]["events"][2154]["details"].update(fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(current)
                change(forged)
                self.assertTrue(self.validate_task1_active(forged, now=observed))

    def test_epoch74_task1_git_rejects_unpublished_or_unrelated_change(self):
        current = self.task1_checkpoint_bundle()
        with self.synthetic_task1_checkpoint_git(self.SYNTHETIC_CHECKPOINT):
            self.assertEqual(checker._collect_f19a_task1_store_git(current), [])
        forged = deepcopy(current)
        forged["progress"]["repository"]["remote_head"] = "0" * 40
        with self.synthetic_task1_checkpoint_git(self.SYNTHETIC_CHECKPOINT):
            self.assertIn("F19A_TASK1_GIT_INVALID", checker._collect_f19a_task1_store_git(forged))

    @staticmethod
    def task1_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task1_active_bundle()
        checkpoint = F19AStartProjectionTests.SYNTHETIC_CHECKPOINT
        progress = bundle["progress"]
        action = "F19A_TASK1_PRODUCT_RED_TESTS_ONLY"
        progress["f19a_task1_registration_store_binding"].update(
            status="CONTROL_CHECKPOINTED_PRODUCT_RED_READY", control_checkpoint=checkpoint,
            next_safe_action=action)
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["active_work_instruction"]["result_status"] = "TASK1_PRODUCT_RED_READY"
        progress["next_work_package"]["status"] = "TASK1_PRODUCT_RED_READY"
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_CONTROL_CHECKPOINTED_PRODUCT_RED_READY",
            worktree_status="F19A_TASK1_CONTROL_CHECKPOINTED_PRODUCT_RED_READY")
        progress["snapshot_id"] = "snapshot-f19a-task1-registration-store-control-seq2156"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        bundle["detached_digest"]["progress"]["bytes"] = 123
        bundle["detached_digest"]["progress"]["file_sha256"] = "A" * 64
        bundle["detached_digest"]["handoff"]["bytes"] = 456
        bundle["detached_digest"]["handoff"]["file_sha256"] = "B" * 64
        return bundle

    @staticmethod
    def validate_task1_checkpoint(bundle):
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"

        def stat_checkpoint(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_checkpoint(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        with patch.object(Path, "stat", stat_checkpoint), patch.object(checker, "_sha256", side_effect=sha_checkpoint):
            observed = datetime.fromisoformat(bundle["events"]["events"][2155]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_store(bundle,
                event_raw=bundle["_task1_active_raw"], now=observed)

    @staticmethod
    @contextmanager
    def synthetic_task1_checkpoint_git(checkpoint, *, changed_paths=None, dirty=b"", remote=None,
                                       head=None, stale_blob=False):
        original_output, original_run = subprocess.check_output, subprocess.run
        base = "29dc2071be8f5cae4ba68a727c5e89d4ad8a12d4"
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = control if changed_paths is None else changed_paths
        actual_head = head or checkpoint

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..HEAD"]:
                return b""
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control:
                    return b"stale" if stale_blob and path == control[0] else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch74_task1_checkpoint_projection_and_git_fails_closed(self):
        checkpoint = self.SYNTHETIC_CHECKPOINT
        bundle = self.task1_checkpoint_bundle()
        self.assertEqual(self.validate_task1_checkpoint(bundle), [])
        for name, change in (
            ("checkpoint", lambda b: b["progress"]["f19a_task1_registration_store_binding"].update(
                control_checkpoint="0" * 40)),
            ("action", lambda b: b["progress"].update(next_safe_action="PRODUCT_ACCEPTED")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task1_checkpoint(forged))
        with self.synthetic_task1_checkpoint_git(checkpoint):
            self.assertEqual(checker._collect_f19a_task1_store_git(bundle), [])
        for name, kwargs in (
            ("missing_control", {"changed_paths": ("scripts/check_project_progress.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("unpublished", {"remote": "0" * 40}),
            ("unrelated_dirty", {"dirty": b" M packages/api/runtime.py\n"}),
            ("control_dirty", {"dirty": b" M scripts/check_project_progress.py\n"}),
        ):
            with self.subTest(name=name), self.synthetic_task1_checkpoint_git(checkpoint, **kwargs):
                self.assertIn("F19A_TASK1_GIT_INVALID", checker._collect_f19a_task1_store_git(bundle))

    @staticmethod
    def task1_closed_bundle():
        bundle = F19AStartProjectionTests.task1_checkpoint_bundle()
        active_raw = bundle["_task1_active_raw"]
        bundle["_task1_active_raw"] = active_raw
        bundle["_task1_active_progress"] = (json.dumps(bundle["progress"], ensure_ascii=False) + "\n").encode()
        stream, progress = bundle["events"], bundle["progress"]
        worker, write = stream["events"][2154]["details"], stream["events"][2155]["details"]
        at = (datetime.fromisoformat(stream["events"][2155]["occurred_at"]) + timedelta(minutes=2)).isoformat()
        reason = "F19A_TASK1_REGISTRATION_STORE_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2157, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2158, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task1_{kind.lower()}", "event_type": kind,
                "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                "project_id": "anvil", "work_package_id": "F-19A", "run_id": None,
                "step_id": "F19A_TASK1_REGISTRATION_STORE_CLOSE", "subject_ref": "F-19A/TASK1-REGISTRATION-STORE",
                "occurred_at": at, "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2158
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = active_raw.decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2156_task1_write_lease_issued"\n}'
        assert prefix.endswith(footer + "\n")
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (prefix[:-len(footer + "\n")] + ",\n"
                      + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2158_task1_worker_lease_revoked"\n}\n')
        event_text = event_text.replace('"last_sequence": 2156', '"last_sequence": 2158', 1)
        event_raw = event_text.encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task1_registration_store_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task1_registration_store_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK2_API_DUAL_LEASE_PENDING"
        progress["f19a_task1_registration_store_binding"].update(
            status="TASK1_STORE_CLOSED_NOT_F19A_ACCEPTED", product_checkpoint="d" * 40,
            next_safe_action=action, event_sequence=2158)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                                                     "status": "TASK2_API_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task1-registration-store-close-seq2158")
        progress["repository"].update(projection_mode="F19A_TASK1_REGISTRATION_STORE_CLOSED",
            local_head="d" * 40, remote_head="d" * 40,
            head_relation="F19A_TASK1_STORE_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK1_STORE_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2158, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head="d" * 40,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2158
        return bundle, event_raw

    @staticmethod
    def validate_task1_closed(bundle, event_raw):
        original_stat, original_sha, original_git = Path.stat, checker._sha256, subprocess.check_output
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"

        def stat_closed(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_closed(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        def git_closed(command, *args, **kwargs):
            if command == ["git", "show", "d" * 40 + ":docs/progress/progress-events.json"]:
                return bundle["_task1_active_raw"]
            if command == ["git", "show", "d" * 40 + ":docs/progress/build-progress.json"]:
                return bundle["_task1_active_progress"]
            return original_git(command, *args, **kwargs)

        with patch.object(Path, "stat", stat_closed), patch.object(checker, "_sha256", side_effect=sha_closed), \
                patch.object(subprocess, "check_output", side_effect=git_closed):
            observed = datetime.fromisoformat(bundle["events"]["events"][2157]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_store_closed(bundle, event_raw=event_raw, now=observed)

    def test_epoch74_task1_closed_projection_is_only_task1_and_fails_closed(self):
        bundle, event_raw = self.task1_closed_bundle()
        self.assertEqual(self.validate_task1_closed(bundle, event_raw), [])
        for name, change in (
            ("revoke_order", lambda b: b["events"]["events"][2156].update(event_type="WORKER_LEASE_REVOKED")),
            ("revoke_token", lambda b: b["events"]["events"][2156]["details"].update(
                write_fencing_token="forged")),
            ("revoke_expiry", lambda b: b["events"]["events"][2157].update(
                occurred_at="2026-10-08T00:05:27+00:00")),
            ("completed_scope", lambda b: b["progress"]["completed_f19a_task1_registration_store_write_lease"].update(
                product_write_scope=[])),
            ("false_acceptance", lambda b: b["progress"].update(status="ACCEPTED")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task1_closed(forged, event_raw))

    @staticmethod
    @contextmanager
    def synthetic_task1_closed_git(*, missing_product=False, dirty=b"", stale_blob=False,
                                   remote=None):
        original_output, original_run = subprocess.check_output, subprocess.run
        original_read = Path.read_bytes
        base, control, product = "29dc2071be8f5cae4ba68a727c5e89d4ad8a12d4", "a" * 40, "d" * 40
        control_paths = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        product_paths = ("migrations/versions/0020_f19a_registration_pair_grants.py",
                         "packages/persistence/f19a_registration_repository.py",
                         "tests/persistence/test_f19a_registration_repository.py",
                         "tests/integration/test_f19a_registration_pg15.py")

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (product + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or product) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                return ("\n".join(control_paths) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{control}..{product}"]:
                paths = product_paths[:3] if missing_product else product_paths
                return ("\n".join(paths) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{product}..HEAD"]:
                return b""
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(product + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control_paths + product_paths:
                    return b"stale" if stale_blob and path == control_paths[0] else read_checkpoint(ROOT / path)
            return original_output(command, *args, **kwargs)

        def read_checkpoint(path):
            return b"fixture" if path.relative_to(ROOT).as_posix() in product_paths else original_read(path)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run), \
                patch.object(Path, "read_bytes", read_checkpoint):
            yield

    def test_epoch74_task1_closed_git_requires_product_checkpoint_and_clean_publication(self):
        bundle, _ = self.task1_closed_bundle()
        with self.synthetic_task1_closed_git():
            self.assertEqual(checker._collect_f19a_task1_store_closed_git(bundle), [])
        for name, kwargs in (
            ("missing_product", {"missing_product": True}),
            ("stale_blob", {"stale_blob": True}),
            ("unpublished", {"remote": "0" * 40}),
            ("product_dirty", {"dirty": b" M packages/persistence/f19a_registration_repository.py\n"}),
            ("unrelated_dirty", {"dirty": b" M packages/api/runtime.py\n"}),
        ):
            with self.subTest(name=name), self.synthetic_task1_closed_git(**kwargs):
                self.assertIn("F19A_TASK1_CLOSE_GIT_INVALID",
                              checker._collect_f19a_task1_store_closed_git(bundle))

    @staticmethod
    def epoch75_archived_bundle():
        bundle = deepcopy(checker.load_bundle(ROOT))
        checkpoint = "bba2a0afb94fbec3be8f8a715fbb446c3ac98d33"

        def archive(path):
            return subprocess.check_output(["git", "show", f"{checkpoint}:{path}"],
                                           cwd=ROOT, stderr=subprocess.DEVNULL)

        bundle["progress"] = json.loads(archive("docs/progress/build-progress.json"))
        bundle["_epoch75_active_raw"] = archive("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_epoch75_active_raw"])
        bundle["handoff_text"] = archive("docs/progress/BUILD_HANDOFF.md").decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"))
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle

    def test_epoch75_postclose_active_binds_frozen_events_lease_and_scope(self):
        bundle = self.epoch75_archived_bundle()
        self.assertEqual(bundle["progress"]["event_sequence"], 2161)
        raw = bundle["_epoch75_active_raw"]
        observed = datetime.fromisoformat(bundle["events"]["events"][2160]["occurred_at"]) + timedelta(minutes=1)
        self.assertEqual(self.validate_epoch75_checkpoint(bundle), [])
        for name, change in (
            ("frozen_event", lambda b: b["events"]["events"][2157].update(event_id="forged")),
            ("instruction_hash", lambda b: b["events"]["events"][2158]["details"].update(sha256="forged")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("write_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["packages/api/runtime.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
            ("digest", lambda b: b["detached_digest"].update(event_sequence=2158)),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="F19A_TASK2_API_DUAL_LEASE_PENDING")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch75_checkpoint(forged))

    def test_epoch75_postclose_active_git_rejects_remote_and_unrelated_dirty(self):
        bundle = checker.load_bundle(ROOT)
        bundle["progress"] = json.loads(subprocess.check_output(
            ["git", "show", "1e656cc7ccf7ab5e61872b88b5d66c21fb6ebe80:docs/progress/build-progress.json"],
            cwd=ROOT, stderr=subprocess.DEVNULL))
        self.assertEqual(bundle["progress"]["f19a_task1_postclose_fixture_binding"]["status"],
                         "POSTCLOSE_FIXTURE_ACTIVE_PRODUCT_WRITE_LOCKED")
        original = subprocess.check_output
        base = "5d1e1788ee84bb10715f497414864ff589bb76c0"

        def frozen_active_git(command, *args, **kwargs):
            if command[-2:] in (["rev-parse", "HEAD"],
                                ["rev-parse", "development/codex/f18-wsl-ops"]):
                return (base + "\n").encode()
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b""
            return original(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=frozen_active_git):
            self.assertEqual(checker._collect_f19a_task1_postclose_fixture_git(bundle), [])
            forged = deepcopy(bundle)
            forged["progress"]["repository"]["remote_head"] = "0" * 40
            self.assertIn("F19A_TASK1_POSTCLOSE_GIT_INVALID",
                          checker._collect_f19a_task1_postclose_fixture_git(forged))

        def unrelated_dirty(command, *args, **kwargs):
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b" M packages/api/runtime.py\n"
            return frozen_active_git(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=unrelated_dirty):
            self.assertIn("F19A_TASK1_POSTCLOSE_GIT_INVALID",
                          checker._collect_f19a_task1_postclose_fixture_git(bundle))

    @staticmethod
    def epoch75_checkpoint_bundle(checkpoint="c" * 40):
        bundle = F19AStartProjectionTests.epoch75_archived_bundle()
        progress = bundle["progress"]
        progress["f19a_task1_postclose_fixture_binding"].update(
            status="POSTCLOSE_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            code_checkpoint=checkpoint)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_POSTCLOSE_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK1_POSTCLOSE_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED")
        progress["snapshot_id"] = "snapshot-f19a-task1-postclose-fixture-checkpoint-seq2161"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"]["repository_head"] = checkpoint
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle

    @staticmethod
    def validate_epoch75_checkpoint(bundle):
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"

        def stat_checkpoint(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_checkpoint(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        with patch.object(Path, "stat", stat_checkpoint), patch.object(checker, "_sha256", side_effect=sha_checkpoint):
            observed = datetime.fromisoformat(bundle["events"]["events"][2160]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_postclose_fixture(bundle,
                event_raw=bundle["_epoch75_active_raw"], now=observed)

    def test_epoch75_checkpoint_active_preserves_lease_and_rejects_projection_forgery(self):
        bundle = self.epoch75_checkpoint_bundle()
        self.assertEqual(self.validate_epoch75_checkpoint(bundle), [])
        for name, change in (
            ("checkpoint", lambda b: b["progress"]["f19a_task1_postclose_fixture_binding"].update(code_checkpoint="0" * 40)),
            ("status", lambda b: b["progress"]["f19a_task1_postclose_fixture_binding"].update(status="ACCEPTED")),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
            ("product_scope", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/runtime.py"])),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch75_checkpoint(forged))

    @staticmethod
    @contextmanager
    def synthetic_epoch75_checkpoint_git(checkpoint="c" * 40, *, changed_paths=None, dirty=b"",
                                         remote=None, head=None, stale_blob=False, descendant_paths=()):
        original_output, original_run = subprocess.check_output, subprocess.run
        base = "5d1e1788ee84bb10715f497414864ff589bb76c0"
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = control if changed_paths is None else changed_paths
        actual_head = head or checkpoint

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..HEAD"]:
                return ("\n".join(descendant_paths) + ("\n" if descendant_paths else "")).encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control:
                    return b"stale" if stale_blob and path == control[0] else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch75_checkpoint_git_requires_exact_published_code_and_only_control_descendants(self):
        bundle = self.epoch75_checkpoint_bundle()
        with self.synthetic_epoch75_checkpoint_git():
            self.assertEqual(checker._collect_f19a_task1_postclose_fixture_git(bundle), [])
        with self.synthetic_epoch75_checkpoint_git(head="d" * 40,
                descendant_paths=("docs/progress/build-progress.json",), dirty=b" M docs/WORK_STATUS.md\n"):
            self.assertEqual(checker._collect_f19a_task1_postclose_fixture_git(bundle), [])
        for name, kwargs in (
            ("missing_code", {"changed_paths": ("scripts/check_project_progress.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("unpublished", {"remote": "0" * 40}),
            ("code_dirty", {"dirty": b" M scripts/check_project_progress.py\n"}),
            ("product_dirty", {"dirty": b" M packages/persistence/f19a_registration_repository.py\n"}),
            ("unrelated_dirty", {"dirty": b" M packages/api/runtime.py\n"}),
            ("product_descendant", {"head": "d" * 40, "descendant_paths": ("packages/api/runtime.py",)}),
        ):
            with self.subTest(name=name), self.synthetic_epoch75_checkpoint_git(**kwargs):
                self.assertIn("F19A_TASK1_POSTCLOSE_GIT_INVALID",
                              checker._collect_f19a_task1_postclose_fixture_git(bundle))

    @staticmethod
    def epoch75_closed_bundle(checkpoint="c" * 40, active_checkpoint="d" * 40):
        bundle = F19AStartProjectionTests.epoch75_archived_bundle()
        active_raw = bundle["_epoch75_active_raw"]
        bundle["_epoch75_active_raw"] = active_raw
        stream, progress = bundle["events"], bundle["progress"]
        active = deepcopy(progress)
        active["f19a_task1_postclose_fixture_binding"].update(
            status="POSTCLOSE_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            code_checkpoint=checkpoint)
        active["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_POSTCLOSE_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK1_POSTCLOSE_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED")
        active["snapshot_id"] = "snapshot-f19a-task1-postclose-fixture-checkpoint-seq2161"
        active["snapshot_hash"] = checker.compute_snapshot_hash(active)
        bundle["_epoch75_active_progress"] = (json.dumps(active, ensure_ascii=False) + "\n").encode()
        worker, write = stream["events"][2159]["details"], stream["events"][2160]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK1_POSTCLOSE_FIXTURE_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2162, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2163, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task1_postclose_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK1_POSTCLOSE_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK1-POSTCLOSE-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2163
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2161_task1_postclose_fixture_write_lease_issued"\n}\n'
        prefix = active_raw.decode("utf-8")
        assert prefix.endswith(footer)
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2163_task1_postclose_fixture_worker_lease_revoked"\n}\n')
        event_raw = event_text.replace('"last_sequence": 2161', '"last_sequence": 2163', 1).encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task1_postclose_fixture_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task1_postclose_fixture_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK2_API_DUAL_LEASE_PENDING"
        progress["f19a_task1_postclose_fixture_binding"].update(
            status="POSTCLOSE_FIXTURE_CLOSED_NOT_F19A_ACCEPTED", code_checkpoint=checkpoint,
            active_projection_checkpoint=active_checkpoint,
            next_safe_action=action, event_sequence=2163)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                                                     "status": "TASK2_API_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task1-postclose-fixture-close-seq2163")
        progress["repository"].update(projection_mode="F19A_TASK1_POSTCLOSE_FIXTURE_CLOSED",
            local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_POSTCLOSE_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK1_POSTCLOSE_FIXTURE_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2163, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head=checkpoint,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2163
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle, event_raw

    @staticmethod
    def validate_epoch75_closed(bundle, event_raw):
        original_stat, original_sha, original_output = Path.stat, checker._sha256, subprocess.check_output
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        checkpoint = bundle["progress"]["f19a_task1_postclose_fixture_binding"].get(
            "active_projection_checkpoint", "d" * 40)

        def stat_closed(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_closed(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        def git_closed(command, *args, **kwargs):
            if command == ["git", "show", checkpoint + ":docs/progress/progress-events.json"]:
                return bundle["_epoch75_active_raw"]
            if command == ["git", "show", checkpoint + ":docs/progress/build-progress.json"]:
                return bundle["_epoch75_active_progress"]
            return original_output(command, *args, **kwargs)

        with patch.object(Path, "stat", stat_closed), patch.object(checker, "_sha256", side_effect=sha_closed), \
                patch.object(subprocess, "check_output", side_effect=git_closed):
            observed = datetime.fromisoformat(bundle["events"]["events"][2162]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_postclose_fixture_closed(bundle, event_raw=event_raw, now=observed)

    def test_epoch75_postclose_closed_requires_ordered_revocation_and_preserves_history(self):
        bundle, event_raw = self.epoch75_closed_bundle()
        self.assertEqual(self.validate_epoch75_closed(bundle, event_raw), [])
        for name, change in (
            ("revoke_order", lambda b: b["events"]["events"][2161].update(event_type="WORKER_LEASE_REVOKED")),
            ("revoke_token", lambda b: b["events"]["events"][2161]["details"].update(write_fencing_token="forged")),
            ("completed_scope", lambda b: b["progress"]["completed_f19a_task1_postclose_fixture_write_lease"].update(
                product_write_scope=["packages/api/runtime.py"])),
            ("false_acceptance", lambda b: b["progress"].update(status="ACCEPTED")),
            ("handoff", lambda b: b["handoff"].update(repository_head="0" * 40)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch75_closed(forged, event_raw))

    def test_epoch75_closed_rejects_consistently_rehashed_frozen_event_envelope(self):
        bundle, _ = self.epoch75_closed_bundle()
        rows = bundle["events"]["events"]
        rows[2159]["actor_id"] = "forged-agent"
        for index in range(2160, 2163):
            rows[index]["previous_event_sha256"] = hashlib.sha256(
                checker.canonical_json_bytes(rows[index - 1])).hexdigest().upper()
        original_active = bundle["_epoch75_active_raw"].decode("utf-8")
        prefix = original_active.split('  {\n    "sequence": 2159,', 1)[0]
        self.assertNotEqual(prefix, original_active)

        def render(row):
            return "\n".join("  " + line for line in json.dumps(
                row, ensure_ascii=False, indent=2).splitlines())

        def reencoded(last_sequence, last_id):
            text = (prefix + ",\n".join(render(row) for row in rows[2158:last_sequence])
                    + '\n  ],\n  "last_event_id": "' + last_id + '"\n}\n')
            return text.replace('"last_sequence": 2161', f'"last_sequence": {last_sequence}', 1).encode("utf-8")

        active_raw = reencoded(2161, rows[2160]["event_id"])
        closed_raw = reencoded(2163, rows[2162]["event_id"])
        self.assertEqual(json.loads(active_raw)["events"][2159]["actor_id"], "forged-agent")
        self.assertEqual(json.loads(closed_raw), bundle["events"])
        active_progress = json.loads(bundle["_epoch75_active_progress"])
        active_progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(active_raw).hexdigest().upper()
        active_progress["snapshot_hash"] = checker.compute_snapshot_hash(active_progress)
        bundle["_epoch75_active_raw"] = active_raw
        bundle["_epoch75_active_progress"] = (json.dumps(active_progress, ensure_ascii=False) + "\n").encode()
        bundle["progress"]["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(closed_raw).hexdigest().upper()
        bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])
        self.assertIn("F19A_TASK1_POSTCLOSE_FROZEN_INVALID",
                      self.validate_epoch75_closed(bundle, closed_raw))

    def test_epoch75_closed_rejects_self_consistent_forged_active_binding(self):
        bundle, event_raw = self.epoch75_closed_bundle()
        active_progress = json.loads(bundle["_epoch75_active_progress"])
        forbidden = "packages/api/runtime.py"
        active_progress["f19a_task1_postclose_fixture_binding"]["developer_exact_paths"].append(forbidden)
        active_progress["snapshot_hash"] = checker.compute_snapshot_hash(active_progress)
        bundle["_epoch75_active_progress"] = (json.dumps(active_progress, ensure_ascii=False) + "\n").encode()
        bundle["progress"]["f19a_task1_postclose_fixture_binding"]["developer_exact_paths"].append(forbidden)
        bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])
        self.assertIn("F19A_TASK1_POSTCLOSE_FROZEN_INVALID",
                      self.validate_epoch75_closed(bundle, event_raw))

    def test_epoch75_closed_requires_published_b_projection_not_a_or_forged_p(self):
        bundle, event_raw = self.epoch75_closed_bundle()
        self.assertEqual(self.validate_epoch75_closed(bundle, event_raw), [])
        missing_p = deepcopy(bundle)
        missing_p["progress"]["f19a_task1_postclose_fixture_binding"].pop("active_projection_checkpoint")
        self.assertTrue(self.validate_epoch75_closed(missing_p, event_raw))
        forged_p = deepcopy(bundle)
        forged_p["progress"]["f19a_task1_postclose_fixture_binding"].update(
            active_projection_checkpoint="0" * 40)
        with self.synthetic_epoch75_closed_git():
            self.assertIn("F19A_TASK1_POSTCLOSE_CLOSE_GIT_INVALID",
                          checker._collect_f19a_task1_postclose_fixture_closed_git(forged_p))
        frozen_a = deepcopy(bundle)
        frozen = json.loads(frozen_a["_epoch75_active_progress"])
        frozen["f19a_task1_postclose_fixture_binding"].pop("code_checkpoint")
        frozen["f19a_task1_postclose_fixture_binding"]["status"] = "POSTCLOSE_FIXTURE_ACTIVE_PRODUCT_WRITE_LOCKED"
        frozen["repository"].update(local_head="5d1e1788ee84bb10715f497414864ff589bb76c0",
            remote_head="5d1e1788ee84bb10715f497414864ff589bb76c0")
        frozen["snapshot_id"] = "snapshot-f19a-task1-postclose-fixture-start-seq2161"
        frozen["snapshot_hash"] = checker.compute_snapshot_hash(frozen)
        frozen_a["_epoch75_active_progress"] = (json.dumps(frozen, ensure_ascii=False) + "\n").encode()
        self.assertIn("F19A_TASK1_POSTCLOSE_FROZEN_INVALID",
                      self.validate_epoch75_closed(frozen_a, event_raw))

    @staticmethod
    @contextmanager
    def synthetic_epoch75_closed_git(*, changed_paths=None, dirty=b"", remote=None, head=None,
                                     stale_blob=False, active_paths=("docs/progress/build-progress.json",),
                                     descendant_paths=(), active_ancestor=True):
        original_output, original_run = subprocess.check_output, subprocess.run
        base, checkpoint, active_checkpoint = "5d1e1788ee84bb10715f497414864ff589bb76c0", "c" * 40, "d" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = control if changed_paths is None else changed_paths
        actual_head = head or active_checkpoint

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..{active_checkpoint}"]:
                return ("\n".join(active_paths) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{active_checkpoint}..HEAD"]:
                return ("\n".join(descendant_paths) + ("\n" if descendant_paths else "")).encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control:
                    return b"stale" if stale_blob and path == control[0] else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                if command[-2:] == [checkpoint, active_checkpoint] and not active_ancestor:
                    return subprocess.CompletedProcess(command, 1)
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch75_postclose_closed_git_requires_exact_checkpoint_and_publication(self):
        bundle, _ = self.epoch75_closed_bundle()
        for dirty in (b"", b" M docs/WORK_STATUS.md\n M docs/progress/build-progress.json\n"):
            with self.synthetic_epoch75_closed_git(dirty=dirty):
                self.assertEqual(checker._collect_f19a_task1_postclose_fixture_closed_git(bundle), [])
        for name, kwargs in (
            ("missing_control", {"changed_paths": ("scripts/check_project_progress.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("remote", {"remote": "0" * 40}),
            ("unrelated_dirty", {"dirty": b" M packages/api/runtime.py\n"}),
            ("code_dirty", {"dirty": b" M scripts/check_project_progress.py\n"}),
            ("unpublished", {"head": "d" * 40, "remote": "c" * 40}),
            ("unpublished_active", {"head": "c" * 40, "remote": "c" * 40, "active_ancestor": False}),
            ("product_between", {"active_paths": ("packages/api/runtime.py",)}),
            ("unrelated_after", {"head": "e" * 40, "descendant_paths": ("packages/api/runtime.py",)}),
        ):
            with self.subTest(name=name), self.synthetic_epoch75_closed_git(**kwargs):
                self.assertIn("F19A_TASK1_POSTCLOSE_CLOSE_GIT_INVALID",
                              checker._collect_f19a_task1_postclose_fixture_closed_git(bundle))

    @staticmethod
    def epoch76_archived_bundle():
        bundle = deepcopy(checker.load_bundle(ROOT))
        checkpoint = "7903b200e30fb0dc4b3a7cc287576b350df3f019"

        def archive(path):
            return subprocess.check_output(["git", "show", f"{checkpoint}:{path}"],
                                           cwd=ROOT, stderr=subprocess.DEVNULL)

        bundle["progress"] = json.loads(archive("docs/progress/build-progress.json"))
        bundle["_epoch76_active_raw"] = archive("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_epoch76_active_raw"])
        bundle["handoff_text"] = archive("docs/progress/BUILD_HANDOFF.md").decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"))
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle

    @staticmethod
    def validate_epoch76_active(bundle):
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"

        def stat_archive(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_archive(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        with patch.object(Path, "stat", stat_archive), patch.object(checker, "_sha256", side_effect=sha_archive):
            observed = datetime.fromisoformat(bundle["events"]["events"][2165]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_postclose_closed_fixture(bundle,
                event_raw=bundle["_epoch76_active_raw"], now=observed)

    def test_epoch76_closed_fixture_active_binds_frozen_parent_and_dual_lease(self):
        bundle = self.epoch76_archived_bundle()
        self.assertEqual(bundle["progress"]["event_sequence"], 2166)
        self.assertEqual(self.validate_epoch76_active(bundle), [])
        for name, change in (
            ("parent_event", lambda b: b["events"]["events"][2162].update(event_id="forged")),
            ("new_event", lambda b: b["events"]["events"][2163].update(event_type="ACCEPTED")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["packages/api/runtime.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
            ("digest", lambda b: b["detached_digest"].update(event_sequence=2163)),
            ("accepted_predecessor", lambda b: (
                b["progress"]["f19a_task1_postclose_fixture_binding"].update(status="ACCEPTED"),
                b["progress"].update(snapshot_hash=checker.compute_snapshot_hash(b["progress"])))),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch76_active(forged))

    @staticmethod
    @contextmanager
    def synthetic_epoch76_active_git(*, changed=None, dirty=b"", remote=None, head=None,
                                     stale_blob=False, descendants=()):
        original_output, original_run = subprocess.check_output, subprocess.run
        base, checkpoint = "cd5f6984757fe30f769b391f3a65ff14b048e0d5", "c" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        delta = control if changed is None else changed
        actual_head = head or checkpoint

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..HEAD"]:
                return ("\n".join(descendants) + ("\n" if descendants else "")).encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control:
                    return b"stale" if stale_blob and path == control[0] else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch76_closed_fixture_active_git_rejects_unpublished_or_product_code(self):
        bundle = self.epoch76_archived_bundle()
        checkpoint = "c" * 40
        bundle["progress"]["f19a_task1_postclose_closed_fixture_binding"].update(
            status="POSTCLOSE_CLOSED_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            code_checkpoint=checkpoint)
        bundle["progress"]["repository"].update(local_head=checkpoint, remote_head=checkpoint)
        with self.synthetic_epoch76_active_git():
            self.assertEqual(checker._collect_f19a_task1_postclose_closed_fixture_git(bundle), [])
        for name, kwargs in (
            ("missing_code", {"changed": ("scripts/check_project_progress.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("remote", {"remote": "0" * 40}),
            ("product_dirty", {"dirty": b" M packages/api/runtime.py\n"}),
            ("code_dirty", {"dirty": b" M scripts/check_project_progress.py\n"}),
            ("unrelated_successor", {"head": "d" * 40, "descendants": ("packages/api/runtime.py",)}),
        ):
            with self.subTest(name=name), self.synthetic_epoch76_active_git(**kwargs):
                self.assertIn("F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_GIT_INVALID",
                              checker._collect_f19a_task1_postclose_closed_fixture_git(bundle))

    @staticmethod
    def epoch76_closed_bundle(checkpoint="c" * 40, active_checkpoint="d" * 40):
        bundle = F19AStartProjectionTests.epoch76_archived_bundle()
        stream, progress = bundle["events"], bundle["progress"]
        active_raw = bundle["_epoch76_active_raw"]
        active = deepcopy(progress)
        active["f19a_task1_postclose_closed_fixture_binding"].update(
            status="POSTCLOSE_CLOSED_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            code_checkpoint=checkpoint)
        active["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED")
        active["snapshot_id"] = "snapshot-f19a-task1-postclose-closed-fixture-checkpoint-seq2166"
        active["snapshot_hash"] = checker.compute_snapshot_hash(active)
        bundle["_epoch76_active_raw"] = active_raw
        bundle["_epoch76_active_progress"] = (json.dumps(active, ensure_ascii=False) + "\n").encode()
        worker, write = stream["events"][2164]["details"], stream["events"][2165]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2167, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2168, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task1_postclose_closed_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK1-POSTCLOSE-CLOSED-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2168
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2166_task1_postclose_closed_fixture_write_lease_issued"\n}\n'
        prefix = active_raw.decode("utf-8")
        assert prefix.endswith(footer)
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2168_task1_postclose_closed_fixture_worker_lease_revoked"\n}\n')
        event_raw = event_text.replace('"last_sequence": 2166', '"last_sequence": 2168', 1).encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task1_postclose_closed_fixture_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task1_postclose_closed_fixture_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK2_API_DUAL_LEASE_PENDING"
        progress["f19a_task1_postclose_closed_fixture_binding"].update(
            status="POSTCLOSE_CLOSED_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            code_checkpoint=checkpoint, active_projection_checkpoint=active_checkpoint,
            next_safe_action=action, event_sequence=2168)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK2_API_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task1-postclose-closed-fixture-close-seq2168")
        progress["repository"].update(projection_mode="F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CLOSED",
            local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2168, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head=checkpoint,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2168
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle, event_raw

    def test_epoch76_closed_fixture_checkpoint_active_keeps_product_locked(self):
        closed, _ = self.epoch76_closed_bundle()
        bundle = self.epoch76_archived_bundle()
        bundle["progress"] = json.loads(closed["_epoch76_active_progress"])
        bundle["handoff"]["repository_head"] = "c" * 40
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"

        def stat_checkpoint(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_checkpoint(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        def validate(candidate):
            with patch.object(Path, "stat", stat_checkpoint), patch.object(checker, "_sha256", side_effect=sha_checkpoint):
                observed = datetime.fromisoformat(candidate["events"]["events"][2165]["occurred_at"]) + timedelta(minutes=1)
                return checker._validate_f19a_task1_postclose_closed_fixture(candidate,
                    event_raw=closed["_epoch76_active_raw"], now=observed)

        self.assertEqual(validate(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["repository"]["product_write_scope"] = ["packages/api/runtime.py"]
        forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
        self.assertTrue(validate(forged))

    @staticmethod
    def validate_epoch76_closed(bundle, event_raw):
        original_stat, original_sha, original_output = Path.stat, checker._sha256, subprocess.check_output
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        checkpoint = bundle["progress"]["f19a_task1_postclose_closed_fixture_binding"].get(
            "active_projection_checkpoint", "d" * 40)

        def stat_closed(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_closed(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        def git_closed(command, *args, **kwargs):
            if command == ["git", "show", checkpoint + ":docs/progress/progress-events.json"]:
                return bundle["_epoch76_active_raw"]
            if command == ["git", "show", checkpoint + ":docs/progress/build-progress.json"]:
                return bundle["_epoch76_active_progress"]
            return original_output(command, *args, **kwargs)

        with patch.object(Path, "stat", stat_closed), patch.object(checker, "_sha256", side_effect=sha_closed), \
                patch.object(subprocess, "check_output", side_effect=git_closed):
            observed = datetime.fromisoformat(bundle["events"]["events"][2167]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_postclose_closed_fixture_closed(bundle,
                event_raw=event_raw, now=observed)

    def test_epoch76_closed_fixture_closed_requires_ordered_revoke_and_b_anchor(self):
        bundle, raw = self.epoch76_closed_bundle()
        self.assertEqual(self.validate_epoch76_closed(bundle, raw), [])
        for name, change in (
            ("revoke_order", lambda b: b["events"]["events"][2166].update(event_type="WORKER_LEASE_REVOKED")),
            ("token", lambda b: b["events"]["events"][2166]["details"].update(write_fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["completed_f19a_task1_postclose_closed_fixture_write_lease"].update(
                product_write_scope=["packages/api/runtime.py"])),
            ("missing_p2", lambda b: b["progress"]["f19a_task1_postclose_closed_fixture_binding"].pop(
                "active_projection_checkpoint")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch76_closed(forged, raw))

    def test_epoch76_closed_fixture_rejects_self_consistent_forged_parent_state(self):
        bundle, raw = self.epoch76_closed_bundle()
        active = json.loads(bundle["_epoch76_active_progress"])
        active["f19a_task1_postclose_fixture_binding"]["status"] = "ACCEPTED"
        active["snapshot_hash"] = checker.compute_snapshot_hash(active)
        bundle["_epoch76_active_progress"] = (json.dumps(active, ensure_ascii=False) + "\n").encode()
        bundle["progress"]["f19a_task1_postclose_fixture_binding"]["status"] = "ACCEPTED"
        bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])
        self.assertIn("F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_FROZEN_INVALID",
                      self.validate_epoch76_closed(bundle, raw))
        forged, raw = self.epoch76_closed_bundle()
        active = json.loads(forged["_epoch76_active_progress"])
        active["next_work_package"]["status"] = "ACCEPTED"
        active["snapshot_hash"] = checker.compute_snapshot_hash(active)
        forged["_epoch76_active_progress"] = (json.dumps(active, ensure_ascii=False) + "\n").encode()
        self.assertIn("F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_FROZEN_INVALID",
                      self.validate_epoch76_closed(forged, raw))

    @staticmethod
    @contextmanager
    def synthetic_epoch76_closed_git(*, delta=None, active_delta=("docs/progress/build-progress.json",),
                                     successor_delta=(), dirty=b"", remote=None, head=None, stale_blob=False,
                                     active_ancestor=True):
        original_output, original_run = subprocess.check_output, subprocess.run
        base, checkpoint, active_checkpoint = "cd5f6984757fe30f769b391f3a65ff14b048e0d5", "c" * 40, "d" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        changed = control if delta is None else delta
        actual_head = head or active_checkpoint

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (actual_head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or actual_head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(changed) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..{active_checkpoint}"]:
                return ("\n".join(active_delta) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{active_checkpoint}..HEAD"]:
                return ("\n".join(successor_delta) + ("\n" if successor_delta else "")).encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control:
                    return b"stale" if stale_blob and path == control[0] else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                if command[-2:] == [checkpoint, active_checkpoint] and not active_ancestor:
                    return subprocess.CompletedProcess(command, 1)
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch76_closed_fixture_git_requires_published_c_p2_and_control_only(self):
        bundle, _ = self.epoch76_closed_bundle()
        with self.synthetic_epoch76_closed_git():
            self.assertEqual(checker._collect_f19a_task1_postclose_closed_fixture_closed_git(bundle), [])
        for name, kwargs in (
            ("missing_code", {"delta": ("scripts/check_project_progress.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("remote", {"remote": "0" * 40}),
            ("unpublished_p2", {"active_ancestor": False}),
            ("product_between", {"active_delta": ("packages/api/runtime.py",)}),
            ("unrelated_after", {"head": "e" * 40, "successor_delta": ("packages/api/runtime.py",)}),
            ("code_dirty", {"dirty": b" M scripts/check_project_progress.py\n"}),
        ):
            with self.subTest(name=name), self.synthetic_epoch76_closed_git(**kwargs):
                self.assertIn("F19A_TASK1_POSTCLOSE_CLOSED_FIXTURE_CLOSE_GIT_INVALID",
                              checker._collect_f19a_task1_postclose_closed_fixture_closed_git(bundle))

    @staticmethod
    def epoch77_archived_bundle():
        bundle = deepcopy(checker.load_bundle(ROOT))
        checkpoint = "d5fca401181f6854a3e52d2d48688d74f239b912"

        def archive(path):
            return subprocess.check_output(["git", "show", f"{checkpoint}:{path}"],
                                           cwd=ROOT, stderr=subprocess.DEVNULL)

        bundle["progress"] = json.loads(archive("docs/progress/build-progress.json"))
        bundle["_epoch77_active_raw"] = archive("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_epoch77_active_raw"])
        bundle["handoff_text"] = archive("docs/progress/BUILD_HANDOFF.md").decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archive(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"))
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle

    @staticmethod
    def validate_epoch77_active(bundle):
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"

        def stat_archive(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_archive(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        with patch.object(Path, "stat", stat_archive), patch.object(checker, "_sha256", side_effect=sha_archive):
            observed = datetime.fromisoformat(bundle["events"]["events"][2170]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_closed_history_fixture(bundle,
                event_raw=bundle["_epoch77_active_raw"], now=observed)

    def test_epoch77_history_fixture_active_uses_immutable_publication(self):
        bundle = self.epoch77_archived_bundle()
        self.assertEqual(bundle["progress"]["event_sequence"], 2171)
        self.assertEqual(self.validate_epoch77_active(bundle), [])
        for name, change in (
            ("parent_event", lambda b: b["events"]["events"][2167].update(event_id="forged")),
            ("issued_event", lambda b: b["events"]["events"][2168].update(event_type="ACCEPTED")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["packages/api/runtime.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
            ("digest", lambda b: b["detached_digest"].update(event_sequence=2168)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch77_active(forged))

    @contextmanager
    def synthetic_epoch77_active_git(self, *, remote=None, dirty=b""):
        """Keep the seq2171 A publication fixed after a later code checkpoint."""
        head = "d5fca401181f6854a3e52d2d48688d74f239b912"
        base = "16857dbeef47180159a42352bb297ae6303dbcad"
        original_output, original_run = subprocess.check_output, subprocess.run

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                return b"docs/progress/build-progress.json\n"
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch77_history_fixture_git_rejects_remote_and_product_dirty(self):
        bundle = self.epoch77_archived_bundle()
        with self.synthetic_epoch77_active_git():
            self.assertEqual(checker._collect_f19a_task1_closed_history_fixture_git(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["repository"]["remote_head"] = "0" * 40
        with self.synthetic_epoch77_active_git():
            self.assertTrue(checker._collect_f19a_task1_closed_history_fixture_git(forged))
        with self.synthetic_epoch77_active_git(remote="0" * 40):
            self.assertTrue(checker._collect_f19a_task1_closed_history_fixture_git(bundle))
        with self.synthetic_epoch77_active_git(dirty=b" M packages/api/runtime.py\n"):
            self.assertTrue(checker._collect_f19a_task1_closed_history_fixture_git(bundle))

    @staticmethod
    def epoch77_closed_bundle(checkpoint="c" * 40, active_checkpoint="d" * 40):
        bundle = F19AStartProjectionTests.epoch77_archived_bundle()
        stream, progress = bundle["events"], bundle["progress"]
        active_raw = bundle["_epoch77_active_raw"]
        active = deepcopy(progress)
        active["f19a_task1_closed_history_fixture_binding"].update(
            status="CLOSED_HISTORY_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            code_checkpoint=checkpoint)
        active["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_CLOSED_HISTORY_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED",
            worktree_status="F19A_TASK1_CLOSED_HISTORY_FIXTURE_CODE_CHECKPOINTED_PRODUCT_WRITE_LOCKED")
        active["snapshot_id"] = "snapshot-f19a-task1-closed-history-fixture-checkpoint-seq2171"
        active["snapshot_hash"] = checker.compute_snapshot_hash(active)
        bundle["_epoch77_active_progress"] = (json.dumps(active, ensure_ascii=False) + "\n").encode()
        worker, write = stream["events"][2169]["details"], stream["events"][2170]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK1_CLOSED_HISTORY_FIXTURE_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2172, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2173, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task1_closed_history_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK1_CLOSED_HISTORY_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK1-CLOSED-HISTORY-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2173
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2171_task1_closed_history_fixture_write_lease_issued"\n}\n'
        prefix = active_raw.decode("utf-8")
        assert prefix.endswith(footer)
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        event_text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
                      + '\n  ],\n  "last_event_id": "evt_f19a_2173_task1_closed_history_fixture_worker_lease_revoked"\n}\n')
        event_raw = event_text.replace('"last_sequence": 2171', '"last_sequence": 2173', 1).encode("utf-8")
        assert json.loads(event_raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(event_raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task1_closed_history_fixture_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task1_closed_history_fixture_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK2_API_DUAL_LEASE_PENDING"
        progress["f19a_task1_closed_history_fixture_binding"].update(
            status="CLOSED_HISTORY_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            code_checkpoint=checkpoint, active_projection_checkpoint=active_checkpoint,
            next_safe_action=action, event_sequence=2173)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK2_API_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task1-closed-history-fixture-close-seq2173")
        progress["repository"].update(projection_mode="F19A_TASK1_CLOSED_HISTORY_FIXTURE_CLOSED",
            local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK1_CLOSED_HISTORY_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK1_CLOSED_HISTORY_FIXTURE_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2173, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head=checkpoint,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2173
        return bundle, event_raw

    @staticmethod
    def validate_epoch77_closed(bundle, event_raw):
        original_stat, original_sha, original_output = Path.stat, checker._sha256, subprocess.check_output
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        checkpoint = bundle["progress"]["f19a_task1_closed_history_fixture_binding"].get(
            "active_projection_checkpoint", "d" * 40)

        def stat_closed(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha_closed(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        def git_closed(command, *args, **kwargs):
            if command == ["git", "show", checkpoint + ":docs/progress/progress-events.json"]:
                return bundle["_epoch77_active_raw"]
            if command == ["git", "show", checkpoint + ":docs/progress/build-progress.json"]:
                return bundle["_epoch77_active_progress"]
            return original_output(command, *args, **kwargs)

        with patch.object(Path, "stat", stat_closed), patch.object(checker, "_sha256", side_effect=sha_closed), \
                patch.object(subprocess, "check_output", side_effect=git_closed):
            observed = datetime.fromisoformat(bundle["events"]["events"][2172]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task1_closed_history_fixture_closed(bundle,
                event_raw=event_raw, now=observed)

    def test_epoch77_history_fixture_closed_uses_published_active_not_live(self):
        bundle, raw = self.epoch77_closed_bundle()
        self.assertEqual(self.validate_epoch77_closed(bundle, raw), [])
        for name, change in (
            ("order", lambda b: b["events"]["events"][2171].update(event_type="WORKER_LEASE_REVOKED")),
            ("token", lambda b: b["events"]["events"][2171]["details"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["completed_f19a_task1_closed_history_fixture_write_lease"].update(
                product_write_scope=["packages/api/runtime.py"])),
            ("missing_p3", lambda b: b["progress"]["f19a_task1_closed_history_fixture_binding"].pop(
                "active_projection_checkpoint")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch77_closed(forged, raw))

    @contextmanager
    def synthetic_epoch77_closed_git(self, *, remote=None, dirty=b"", active_delta=(),
                                     successor_delta=(), stale_blob=False, published=True):
        base = "16857dbeef47180159a42352bb297ae6303dbcad"
        checkpoint, active_checkpoint, head = "c" * 40, "d" * 40, "e" * 40
        control = {"scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py"}
        original_output, original_run = subprocess.check_output, subprocess.run

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (head + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or head) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                return ("\n".join(control) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..{active_checkpoint}"]:
                return ("\n".join(active_delta) + ("\n" if active_delta else "")).encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{active_checkpoint}..HEAD"]:
                return ("\n".join(successor_delta) + ("\n" if successor_delta else "")).encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                path = tail[1].split(":", 1)[1]
                if path in control:
                    return b"stale" if stale_blob and path == "scripts/check_project_progress.py" else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                if command[-2:] == [active_checkpoint, head] and not published:
                    return subprocess.CompletedProcess(command, 1)
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_epoch77_history_fixture_closed_git_requires_published_exact_scope(self):
        bundle, _ = self.epoch77_closed_bundle()
        with self.synthetic_epoch77_closed_git():
            self.assertEqual(checker._collect_f19a_task1_closed_history_fixture_closed_git(bundle), [])
        for name, kwargs in (
            ("remote", {"remote": "0" * 40}),
            ("product_dirty", {"dirty": b" M packages/api/runtime.py\n"}),
            ("product_between", {"active_delta": ("packages/api/runtime.py",)}),
            ("unrelated_successor", {"successor_delta": ("packages/api/runtime.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("unpublished", {"published": False}),
        ):
            with self.subTest(name=name), self.synthetic_epoch77_closed_git(**kwargs):
                self.assertTrue(checker._collect_f19a_task1_closed_history_fixture_closed_git(bundle))


if __name__ == "__main__":
    unittest.main()
