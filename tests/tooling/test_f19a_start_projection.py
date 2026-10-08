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
    def setUp(self):
        # Only historical Git observations need the published F-19A branch.
        if "git" not in self._testMethodName and self._testMethodName != "test_closed_task0_projection_and_forgery_guards":
            return
        original = subprocess.check_output

        def historical_branch(command, *args, **kwargs):
            tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                "-c", "core.quotePath=false"] else command[1:]
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            return original(command, *args, **kwargs)

        patcher = patch.object(subprocess, "check_output", side_effect=historical_branch)
        patcher.start()
        self.addCleanup(patcher.stop)

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
    def synthetic_checkpoint_git(checkpoint, *, changed_paths=None, stale_blob=False,
                                 branch="codex/f18-wsl-ops", upstream="development/codex/f18-wsl-ops"):
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
            if tail == ["branch", "--show-current"]:
                return (branch + "\n").encode()
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return (upstream + "\n").encode()
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
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
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
        original_validate = checker._validate_f19a_start
        archived_now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)

        def historical_read(path):
            return archive[path] if path in archive else original_read(path)

        def historical_stat(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def historical_sha(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        with patch.object(Path, "read_bytes", historical_read), patch.object(Path, "stat", historical_stat), \
                patch.object(checker, "_sha256", side_effect=historical_sha), \
                patch.object(checker, "_validate_f19a_start",
                    side_effect=lambda candidate, **kw: original_validate(candidate, now=archived_now, **kw)), \
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
        archived_now = datetime.fromisoformat(bundle["events"]["events"][2142]["occurred_at"]) + timedelta(minutes=1) \
            if bundle["progress"]["event_sequence"] == 2143 else \
            datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)

        def read_historical(path):
            return archive[path] if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            return SimpleNamespace(st_size=len(archive[path])) if path in archive else original_stat(path, *args, **kwargs)

        def sha_historical(path):
            return hashlib.sha256(archive[path]).hexdigest().upper() if path in archive else original_sha(path)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical), \
                patch.object(checker, "_sha256", side_effect=sha_historical):
            return checker.validate_bundle(bundle) if route else checker._validate_f19a_start(
                bundle, event_raw=event_raw, now=archived_now)

    @staticmethod
    def validate_rework_closed(bundle, archive, event_raw, *, route=False):
        original_read, original_stat, original_sha = Path.read_bytes, Path.stat, checker._sha256
        original_git = subprocess.check_output
        original_validator = checker._validate_f19a_task0_rework

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
                        else datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
                        + timedelta(minutes=1))
            if route and bundle["progress"]["worker_lease"] is not None:
                def archived_active_clock(candidate, **kwargs):
                    return original_validator(candidate, event_raw=event_raw, now=observed)
                with patch.object(checker, "_validate_f19a_task0_rework", side_effect=archived_active_clock):
                    return checker.validate_bundle(bundle)
            return checker.validate_bundle(bundle) if route else original_validator(
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
        for identity in ({"branch": "codex/u01-dashboard-r2"},
                         {"upstream": "development/codex/u01-dashboard-r2"}):
            with self.subTest(identity=identity), self.synthetic_checkpoint_git(
                    "0149ab1a079bc8c2ccae944e13c2e2a626ebf62b", **identity):
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

    @staticmethod
    def task2_registration_active_bundle():
        bundle = deepcopy(checker.load_bundle(ROOT))
        publication = "214e25c5d706328310a5f81551dbadce62eb78c2"

        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                                           cwd=ROOT, stderr=subprocess.DEVNULL)

        bundle["progress"] = json.loads(archived("docs/progress/build-progress.json"))
        bundle["_task2_active_raw"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_task2_active_raw"])
        bundle["handoff_text"] = archived("docs/progress/BUILD_HANDOFF.md").decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"))
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle

    @staticmethod
    def validate_task2_registration_active(bundle):
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
            observed = datetime.fromisoformat(bundle["events"]["events"][2175]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task2_registration_api(bundle,
                event_raw=bundle["_task2_active_raw"], now=observed)

    def test_task2_registration_active_immutable_publication_and_forgery(self):
        bundle = self.task2_registration_active_bundle()
        self.assertEqual(bundle["progress"]["event_sequence"], 2176)
        self.assertEqual(self.validate_task2_registration_active(bundle), [])
        for name, change in (
            ("frozen_event", lambda b: b["events"]["events"][2172].update(event_id="forged")),
            ("issued_event", lambda b: b["events"]["events"][2173].update(event_type="ACCEPTED")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("write_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
            ("snapshot", lambda b: b["progress"].update(snapshot_id="forged")),
            ("digest", lambda b: b["detached_digest"].update(event_sequence=2175)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task2_registration_active(forged))

    @contextmanager
    def synthetic_task2_registration_active_git(self, *, remote=None, dirty=b""):
        """Evaluate archived seq2176 A against its published Git state, not current C."""
        head = "214e25c5d706328310a5f81551dbadce62eb78c2"
        base = "daeb824524e85624e17f4ef099ec3d2b1eef7ca9"
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

    def test_task2_registration_active_git_rejects_remote_and_product_dirty(self):
        bundle = self.task2_registration_active_bundle()
        with self.synthetic_task2_registration_active_git():
            self.assertEqual(checker._collect_f19a_task2_registration_api_git(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["repository"]["remote_head"] = "0" * 40
        with self.synthetic_task2_registration_active_git():
            self.assertTrue(checker._collect_f19a_task2_registration_api_git(forged))
        with self.synthetic_task2_registration_active_git(remote="0" * 40):
            self.assertTrue(checker._collect_f19a_task2_registration_api_git(bundle))
        with self.synthetic_task2_registration_active_git(dirty=b" M packages/api/f19a_registration.py\n"):
            self.assertTrue(checker._collect_f19a_task2_registration_api_git(bundle))

    @staticmethod
    def task2_registration_checkpoint_bundle(checkpoint="c" * 40):
        bundle = F19AStartProjectionTests.task2_registration_active_bundle()
        progress = bundle["progress"]
        progress["f19a_task2_registration_api_binding"].update(
            status="TASK2_REGISTRATION_API_CONTROL_CHECKPOINTED_PRODUCT_RED_READY",
            control_checkpoint=checkpoint,
            next_safe_action="F19A_TASK2_REGISTRATION_API_PRODUCT_RED_TESTS_ONLY")
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK2_REGISTRATION_API_CONTROL_CHECKPOINTED_PRODUCT_RED_READY",
            worktree_status="F19A_TASK2_REGISTRATION_API_CONTROL_CHECKPOINTED_PRODUCT_RED_READY")
        progress["active_work_instruction"].update(result_status="TASK2_REGISTRATION_API_PRODUCT_RED_READY",
            package_status="TASK2_REGISTRATION_API_PRODUCT_RED_READY")
        progress["next_work_package"]["status"] = "TASK2_REGISTRATION_API_PRODUCT_RED_READY"
        progress["next_safe_action"] = progress["runtime_next_action"] = \
            "F19A_TASK2_REGISTRATION_API_PRODUCT_RED_TESTS_ONLY"
        progress["snapshot_id"] = "snapshot-f19a-task2-registration-api-checkpoint-seq2176"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint,
            next_safe_action="F19A_TASK2_REGISTRATION_API_PRODUCT_RED_TESTS_ONLY")
        return bundle

    def test_task2_registration_checkpoint_projection_rejects_forgery(self):
        bundle = self.task2_registration_checkpoint_bundle()
        self.assertEqual(self.validate_task2_registration_active(bundle), [])
        for name, change in (
            ("checkpoint", lambda b: b["progress"]["f19a_task2_registration_api_binding"].update(
                control_checkpoint="0" * 40)),
            ("action", lambda b: b["progress"].update(next_safe_action="F19A_TASK3_START")),
            ("product_scope", lambda b: b["progress"]["repository"].update(product_write_scope=[])),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task2_registration_active(forged))

    @contextmanager
    def synthetic_task2_registration_checkpoint_git(self, *, remote=None, dirty=b"",
                                                     delta=None, successor=(), stale_blob=False):
        base, checkpoint = "daeb824524e85624e17f4ef099ec3d2b1eef7ca9", "c" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        original_output, original_run = subprocess.check_output, subprocess.run

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (checkpoint + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return ((remote or checkpoint) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return b"codex/f18-wsl-ops\n"
            if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                return b"development/codex/f18-wsl-ops\n"
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{checkpoint}"]:
                names = control if delta is None else delta
                return ("\n".join(names) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{checkpoint}..HEAD"]:
                return ("\n".join(successor) + ("\n" if successor else "")).encode()
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

    def test_task2_registration_checkpoint_git_exact_control_only(self):
        bundle = self.task2_registration_checkpoint_bundle()
        with self.synthetic_task2_registration_checkpoint_git():
            self.assertEqual(checker._collect_f19a_task2_registration_api_git(bundle), [])
        for name, kwargs in (
            ("remote", {"remote": "0" * 40}),
            ("product_dirty", {"dirty": b" M packages/api/f19a_registration.py\n"}),
            ("missing_control", {"delta": ("scripts/check_project_progress.py",)}),
            ("product_commit", {"delta": ("scripts/check_project_progress.py",
                                         "tests/tooling/test_f19a_start_projection.py",
                                         "packages/api/f19a_registration.py")}),
            ("unrelated_successor", {"successor": ("packages/api/f19a_registration.py",)}),
            ("stale_blob", {"stale_blob": True}),
        ):
            with self.subTest(name=name), self.synthetic_task2_registration_checkpoint_git(**kwargs):
                self.assertTrue(checker._collect_f19a_task2_registration_api_git(bundle))

    @staticmethod
    def task2_registration_product_checkpoint_bundle(control="c" * 40, product="d" * 40):
        bundle = F19AStartProjectionTests.task2_registration_checkpoint_bundle(control)
        progress = bundle["progress"]
        progress["f19a_task2_registration_api_binding"].update(
            status="TASK2_REGISTRATION_API_PRODUCT_CHECKPOINTED_CLOSE_READY",
            product_code_checkpoint=product,
            next_safe_action="F19A_TASK2_REGISTRATION_API_CLOSE_ONLY")
        progress["repository"].update(local_head=product, remote_head=product,
            head_relation="F19A_TASK2_REGISTRATION_API_PRODUCT_CHECKPOINTED_CLOSE_READY",
            worktree_status="F19A_TASK2_REGISTRATION_API_PRODUCT_CHECKPOINTED_CLOSE_READY")
        progress["active_work_instruction"].update(result_status="TASK2_REGISTRATION_API_PRODUCT_CHECKPOINTED_CLOSE_READY",
            package_status="TASK2_REGISTRATION_API_PRODUCT_CHECKPOINTED_CLOSE_READY")
        progress["next_work_package"]["status"] = "TASK2_REGISTRATION_API_PRODUCT_CHECKPOINTED_CLOSE_READY"
        progress["next_safe_action"] = progress["runtime_next_action"] = \
            "F19A_TASK2_REGISTRATION_API_CLOSE_ONLY"
        progress["snapshot_id"] = "snapshot-f19a-task2-registration-api-product-checkpoint-seq2176"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=product,
            next_safe_action="F19A_TASK2_REGISTRATION_API_CLOSE_ONLY")
        return bundle

    def test_task2_registration_product_checkpoint_projection_rejects_forgery(self):
        bundle = self.task2_registration_product_checkpoint_bundle()
        self.assertEqual(self.validate_task2_registration_active(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["f19a_task2_registration_api_binding"]["product_code_checkpoint"] = "0" * 40
        self.assertTrue(self.validate_task2_registration_active(forged))

    @contextmanager
    def synthetic_task2_product_git(self, *, remote=None, product_delta=None, stale_blob=False,
                                    dirty=b"", product_ancestor=True, active_checkpoint=None,
                                    close_head=None, active_delta=None, close_delta=None, active_ancestor=True):
        base, control, product, head = ("daeb824524e85624e17f4ef099ec3d2b1eef7ca9",
                                        "c" * 40, "d" * 40, close_head or "e" * 40)
        control_paths = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        product_paths = ("packages/api/registry.py", "packages/api/fastapi_app.py")
        original_output, original_run = subprocess.check_output, subprocess.run

        def output(command, *args, **kwargs):
            tail = command[5:] if command[:5] == [
                "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
            fixed = {("rev-parse", "HEAD"): head,
                ("rev-parse", "development/codex/f18-wsl-ops"): remote or head,
                ("branch", "--show-current"): "codex/f18-wsl-ops",
                ("rev-parse", "--abbrev-ref", "@{upstream}"): "development/codex/f18-wsl-ops"}
            if tuple(tail) in fixed:
                return (fixed[tuple(tail)] + "\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return dirty
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                return ("\n".join(control_paths) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{control}..{product}"]:
                names = product_paths if product_delta is None else product_delta
                return ("\n".join(names) + "\n").encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{product}..HEAD"]:
                return b"docs/progress/build-progress.json\n"
            if active_checkpoint and tail == ["diff", "--name-only", "--no-renames", f"{product}..{active_checkpoint}"]:
                names = ("docs/progress/build-progress.json",) if active_delta is None else active_delta
                return ("\n".join(names) + "\n").encode()
            if active_checkpoint and tail == ["diff", "--name-only", "--no-renames", f"{active_checkpoint}..HEAD"]:
                names = ("docs/progress/build-progress.json",) if close_delta is None else close_delta
                return ("\n".join(names) + "\n").encode()
            if tail[:1] == ["show"] and len(tail) == 2:
                revision, path = tail[1].split(":", 1)
                if revision == control and path in control_paths:
                    return (ROOT / path).read_bytes()
                if revision == product and path in product_paths:
                    return b"stale" if stale_blob and path == product_paths[0] else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                if command[-2:] == [control, product] and not product_ancestor:
                    return subprocess.CompletedProcess(command, 1)
                if active_checkpoint and command[-2:] == [product, active_checkpoint] and not active_ancestor:
                    return subprocess.CompletedProcess(command, 1)
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_task2_registration_product_git_requires_exact_published_chain(self):
        bundle = self.task2_registration_product_checkpoint_bundle()
        with self.synthetic_task2_product_git():
            self.assertEqual(checker._collect_f19a_task2_registration_api_git(bundle), [])
        for name, kwargs in (
            ("remote", {"remote": "0" * 40}),
            ("product_dirty", {"dirty": b" M packages/api/f19a_registration.py\n"}),
            ("unrelated_product", {"product_delta": ("packages/api/runtime.py",)}),
            ("stale_blob", {"stale_blob": True}),
            ("unpublished", {"product_ancestor": False}),
        ):
            with self.subTest(name=name), self.synthetic_task2_product_git(**kwargs):
                self.assertTrue(checker._collect_f19a_task2_registration_api_git(bundle))

    @staticmethod
    def task2_registration_closed_bundle(control="c" * 40, product="d" * 40,
                                         active_checkpoint="e" * 40, close_at=None):
        bundle = F19AStartProjectionTests.task2_registration_product_checkpoint_bundle(control, product)
        active = deepcopy(bundle["progress"])
        bundle["_task2_product_progress"] = (json.dumps(active, ensure_ascii=False) + "\n").encode()
        bundle["_task2_product_events"] = bundle["_task2_active_raw"]
        bundle["_task2_product_handoff"] = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        active_digest = deepcopy(bundle["detached_digest"])
        active_digest["progress"].update(bytes=len(bundle["_task2_product_progress"]),
            file_sha256=hashlib.sha256(bundle["_task2_product_progress"]).hexdigest().upper())
        active_digest["handoff"].update(bytes=len(bundle["_task2_product_handoff"]),
            file_sha256=hashlib.sha256(bundle["_task2_product_handoff"]).hexdigest().upper())
        bundle["_task2_product_digest"] = (json.dumps(active_digest, ensure_ascii=False) + "\n").encode()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = stream["events"][2174]["details"], stream["events"][2175]["details"]
        at = close_at or (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK2_REGISTRATION_API_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2177, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2178, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task2_registration_api_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK2_REGISTRATION_API_CLOSE",
                "subject_ref": "F-19A/TASK2-REGISTRATION-API", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2178
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2176_task2_registration_api_write_lease_issued"\n}\n'
        prefix = bundle["_task2_active_raw"].decode("utf-8")
        assert prefix.endswith(footer)
        render = lambda row: "\n".join("  " + line for line in json.dumps(
            row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
                + '\n  ],\n  "last_event_id": "evt_f19a_2178_task2_registration_api_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2176', '"last_sequence": 2178', 1).encode("utf-8")
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task2_registration_api_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task2_registration_api_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK3_FIXED_OPERATIONS_DUAL_LEASE_PENDING"
        progress["f19a_task2_registration_api_binding"].update(
            status="TASK2_REGISTRATION_API_CLOSED_NOT_F19A_ACCEPTED",
            active_projection_checkpoint=active_checkpoint, next_safe_action=action,
            event_sequence=2178)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK3_FIXED_OPERATIONS_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task2-registration-api-close-seq2178")
        progress["repository"].update(projection_mode="F19A_TASK2_REGISTRATION_API_CLOSED",
            head_relation="F19A_TASK2_REGISTRATION_API_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK2_REGISTRATION_API_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2178, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head=product, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2178
        return bundle, raw

    @staticmethod
    def validate_task2_registration_closed(bundle, raw, *, now_override=None):
        original_stat, original_sha, original_output = Path.stat, checker._sha256, subprocess.check_output
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        active_checkpoint = bundle["progress"]["f19a_task2_registration_api_binding"].get(
            "active_projection_checkpoint", "e" * 40)

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

        def output(command, *args, **kwargs):
            if command == ["git", "show", active_checkpoint + ":docs/progress/progress-events.json"]:
                return bundle["_task2_product_events"]
            if command == ["git", "show", active_checkpoint + ":docs/progress/build-progress.json"]:
                return bundle["_task2_product_progress"]
            if command == ["git", "show", active_checkpoint + ":docs/progress/BUILD_HANDOFF.md"]:
                return bundle["_task2_product_handoff"]
            if command == ["git", "show", active_checkpoint
                          + ":docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"]:
                return bundle["_task2_product_digest"]
            return original_output(command, *args, **kwargs)

        with patch.object(Path, "stat", stat_archive), patch.object(checker, "_sha256", side_effect=sha_archive), \
                patch.object(subprocess, "check_output", side_effect=output):
            observed = now_override or (datetime.fromisoformat(
                bundle["events"]["events"][2177]["occurred_at"]) + timedelta(minutes=1))
            return checker._validate_f19a_task2_registration_api_closed(bundle, event_raw=raw, now=observed)

    def test_task2_registration_closed_uses_immutable_active_and_rejects_forgery(self):
        bundle, raw = self.task2_registration_closed_bundle()
        self.assertEqual(self.validate_task2_registration_closed(bundle, raw), [])
        for name, change in (
            ("order", lambda b: b["events"]["events"][2176].update(event_type="WORKER_LEASE_REVOKED")),
            ("token", lambda b: b["events"]["events"][2176]["details"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["completed_f19a_task2_registration_api_write_lease"].update(
                product_write_scope=[])),
            ("missing_p", lambda b: b["progress"]["f19a_task2_registration_api_binding"].pop(
                "active_projection_checkpoint")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task2_registration_closed(forged, raw))

    def test_task2_registration_closed_rejects_forged_p_handoff_and_digest(self):
        bundle, raw = self.task2_registration_closed_bundle()
        self.assertEqual(self.validate_task2_registration_closed(bundle, raw), [])
        for name, key, replacement in (
            ("handoff", "_task2_product_handoff", b"forged handoff"),
            ("digest", "_task2_product_digest", b"{}"),
            ("missing_handoff", "_task2_product_handoff", None),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                forged[key] = replacement
                self.assertTrue(self.validate_task2_registration_closed(forged, raw))

    def test_task2_registration_closed_rejects_future_expiry_and_naive_revoke(self):
        issued = datetime.fromisoformat("2026-10-07T06:17:08+00:00")
        expiry = datetime.fromisoformat("2026-10-08T06:17:08+00:00")
        for name, at, observed in (
            ("future", (issued + timedelta(minutes=15)).isoformat(), issued + timedelta(minutes=5)),
            ("expiry_equal", expiry.isoformat(), expiry + timedelta(minutes=1)),
            ("naive", (issued + timedelta(minutes=5)).replace(tzinfo=None).isoformat(),
             issued + timedelta(minutes=10)),
        ):
            with self.subTest(name=name):
                bundle, raw = self.task2_registration_closed_bundle(close_at=at)
                self.assertTrue(self.validate_task2_registration_closed(bundle, raw, now_override=observed))

    def test_task2_registration_closed_git_requires_c_d_p_publication(self):
        bundle, _ = self.task2_registration_closed_bundle()
        defaults = {"active_checkpoint": "e" * 40, "close_head": "f" * 40}
        with self.synthetic_task2_product_git(**defaults):
            self.assertEqual(checker._collect_f19a_task2_registration_api_closed_git(bundle), [])
        for name, kwargs in (
            ("remote", {"remote": "0" * 40}),
            ("product_dirty", {"dirty": b" M packages/api/registry.py\n"}),
            ("unrelated_d_p", {"active_delta": ("packages/api/runtime.py",)}),
            ("unrelated_p_head", {"close_delta": ("packages/api/runtime.py",)}),
            ("unpublished_p", {"active_ancestor": False}),
            ("stale_product", {"stale_blob": True}),
        ):
            with self.subTest(name=name), self.synthetic_task2_product_git(**defaults, **kwargs):
                self.assertTrue(checker._collect_f19a_task2_registration_api_closed_git(bundle))

    @staticmethod
    def task3_archived_active_bundle(*, product=False):
        publication = ("45bb14f72041b4d4b3b4b0dfa6b40030edd8f1fe" if product
            else "7ffdb9b02b7be95b0ff62c1a99168a94f530ef26")
        bundle = deepcopy(checker.load_bundle(ROOT))

        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                cwd=ROOT, stderr=subprocess.DEVNULL)

        bundle["_task3_active_progress_raw"] = archived("docs/progress/build-progress.json")
        bundle["progress"] = json.loads(bundle["_task3_active_progress_raw"])
        bundle["_task3_active_raw"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_task3_active_raw"])
        bundle["_task3_active_handoff_raw"] = archived("docs/progress/BUILD_HANDOFF.md")
        bundle["handoff_text"] = bundle["_task3_active_handoff_raw"].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"))
        return bundle

    @staticmethod
    def validate_task3_archived_active(bundle):
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        archive = {progress_path: bundle["_task3_active_progress_raw"],
            handoff_path: bundle["_task3_active_handoff_raw"]}

        def stat_archive(path, *args, **kwargs):
            if path in archive:
                return SimpleNamespace(st_size=len(archive[path]))
            return original_stat(path, *args, **kwargs)

        def sha_archive(path):
            if path in archive:
                return hashlib.sha256(archive[path]).hexdigest().upper()
            return original_sha(path)

        with patch.object(Path, "stat", stat_archive), patch.object(checker, "_sha256", side_effect=sha_archive):
            observed = datetime.fromisoformat(bundle["events"]["events"][2179]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task3_fixed_operations(bundle,
                event_raw=bundle["_task3_active_raw"], now=observed)

    def test_task3_fixed_operations_active_live_and_forgery(self):
        bundle = self.task3_archived_active_bundle()
        self.assertEqual(self.validate_task3_archived_active(bundle), [])
        for name, change in (
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("write_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
            ("event_envelope", lambda b: b["events"]["events"][2180].update(actor="forged")),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("next_action", lambda b: b["progress"].update(next_safe_action="F19A_TASK4_START")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task3_archived_active(forged))

    def test_task3_fixed_operations_archived_control_git_rejects_remote_and_product_dirty(self):
        bundle = self.task3_checkpoint_bundle(product=False)
        with self.synthetic_task3_checkpoint_git(product=False):
            self.assertEqual(checker._collect_f19a_task3_fixed_operations_git(bundle), [])
        with self.synthetic_task3_checkpoint_git(product=False, remote="0" * 40):
            self.assertTrue(checker._collect_f19a_task3_fixed_operations_git(bundle))
        with self.synthetic_task3_checkpoint_git(product=False,
                dirty=b" M packages/api/operations.py\n"):
            self.assertTrue(checker._collect_f19a_task3_fixed_operations_git(bundle))

    @staticmethod
    def task3_checkpoint_bundle(*, product=False):
        bundle = F19AStartProjectionTests.task3_archived_active_bundle()
        progress = bundle["progress"]
        binding = progress["f19a_task3_fixed_operations_binding"]
        checkpoint = "c" * 40
        anchor = "d" * 40 if product else checkpoint
        binding.update(status=("TASK3_FIXED_OPERATIONS_PRODUCT_CHECKPOINTED_CLOSE_READY" if product
            else "TASK3_FIXED_OPERATIONS_CONTROL_CHECKPOINTED_PRODUCT_RED_READY"),
            control_checkpoint=checkpoint,
            next_safe_action=("F19A_TASK3_FIXED_OPERATIONS_CLOSE_ONLY" if product
                else "F19A_TASK3_FIXED_OPERATIONS_PRODUCT_RED_TESTS_ONLY"))
        if product:
            binding["product_code_checkpoint"] = anchor
        relation = ("F19A_TASK3_FIXED_OPERATIONS_PRODUCT_CHECKPOINTED_CLOSE_READY" if product
            else "F19A_TASK3_FIXED_OPERATIONS_CONTROL_CHECKPOINTED_PRODUCT_RED_READY")
        status = ("TASK3_FIXED_OPERATIONS_PRODUCT_CHECKPOINTED_CLOSE_READY" if product
            else "TASK3_FIXED_OPERATIONS_PRODUCT_RED_READY")
        progress["repository"].update(local_head=anchor, remote_head=anchor,
            head_relation=relation, worktree_status=relation)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = binding["next_safe_action"]
        progress["snapshot_id"] = ("snapshot-f19a-task3-fixed-operations-product-checkpoint-seq2181"
            if product else "snapshot-f19a-task3-fixed-operations-checkpoint-seq2181")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=anchor, next_safe_action=binding["next_safe_action"])
        return bundle

    def test_task3_control_and_product_checkpoint_projection_rejects_forgery(self):
        for product in (False, True):
            with self.subTest(product=product):
                bundle = self.task3_checkpoint_bundle(product=product)
                self.assertEqual(self.validate_task3_archived_active(bundle), [])
                forged = deepcopy(bundle)
                forged["progress"]["f19a_task3_fixed_operations_binding"]["control_checkpoint"] = "0" * 40
                self.assertTrue(self.validate_task3_archived_active(forged))

    @staticmethod
    @contextmanager
    def synthetic_task3_checkpoint_git(*, product=False, head=None, remote=None,
                                      dirty=b"", control_delta=None, product_delta=None,
                                      successor_delta=(), stale_control=False, stale_product=False,
                                      published=True):
        base, control, product_sha = "71154279a7da853acbd15706126fe4c323b7016f", "c" * 40, "d" * 40
        head = head or (product_sha if product else control)
        exact_control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        exact_product = ("packages/api/operations.py",)
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
            if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                names = exact_control if control_delta is None else control_delta
                return ("\n".join(names) + ("\n" if names else "")).encode()
            if tail == ["diff", "--name-only", "--no-renames", f"{control}..{product_sha}"]:
                names = exact_product if product_delta is None else product_delta
                return ("\n".join(names) + ("\n" if names else "")).encode()
            successor_anchor = product_sha if product else control
            if tail == ["diff", "--name-only", "--no-renames", f"{successor_anchor}..HEAD"]:
                return ("\n".join(successor_delta) + ("\n" if successor_delta else "")).encode()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(control + ":"):
                path = tail[1].split(":", 1)[1]
                if path in exact_control:
                    return b"stale" if stale_control and path == exact_control[0] else (ROOT / path).read_bytes()
            if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(product_sha + ":"):
                path = tail[1].split(":", 1)[1]
                if path in exact_product:
                    return b"stale" if stale_product else (ROOT / path).read_bytes()
            return original_output(command, *args, **kwargs)

        def run(command, *args, **kwargs):
            if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                if not published and command[-2:] == [product_sha if product else control, head]:
                    return subprocess.CompletedProcess(command, 1)
                return subprocess.CompletedProcess(command, 0)
            return original_run(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(subprocess, "run", side_effect=run):
            yield

    def test_task3_checkpoint_git_requires_exact_c_d_p_and_clean_product(self):
        for product in (False, True):
            bundle = self.task3_checkpoint_bundle(product=product)
            head = "e" * 40 if product else None
            with self.subTest(product=product), self.synthetic_task3_checkpoint_git(product=product, head=head):
                self.assertEqual(checker._collect_f19a_task3_fixed_operations_git(bundle), [])
            for name, kwargs in (
                ("remote", {"remote": "0" * 40}),
                ("product_dirty", {"dirty": b" M packages/api/operations.py\n"}),
                ("unrelated_control", {"control_delta": (*(
                    "scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py"),
                    "packages/api/runtime.py")}),
                ("stale_control", {"stale_control": True}),
                ("unrelated_successor", {"successor_delta": ("packages/api/runtime.py",)}),
                ("unpublished", {"published": False}),
            ):
                with self.subTest(product=product, name=name), self.synthetic_task3_checkpoint_git(
                        product=product, head=head, **kwargs):
                    self.assertTrue(checker._collect_f19a_task3_fixed_operations_git(bundle))
            if product:
                for name, kwargs in (("unrelated_product", {"product_delta": (
                        "packages/api/operations.py", "packages/api/runtime.py")}),
                        ("stale_product", {"stale_product": True})):
                    with self.subTest(name=name), self.synthetic_task3_checkpoint_git(
                            product=True, head=head, **kwargs):
                        self.assertTrue(checker._collect_f19a_task3_fixed_operations_git(bundle))

    @staticmethod
    def task3_closed_bundle(close_at=None):
        bundle = F19AStartProjectionTests.task3_archived_active_bundle(product=True)
        bundle["_task3_product_progress"] = bundle["_task3_active_progress_raw"]
        bundle["_task3_product_events"] = bundle["_task3_active_raw"]
        bundle["_task3_product_handoff"] = bundle["_task3_active_handoff_raw"]
        active_digest = deepcopy(bundle["detached_digest"])
        active_digest["progress"].update(bytes=len(bundle["_task3_product_progress"]),
            file_sha256=hashlib.sha256(bundle["_task3_product_progress"]).hexdigest().upper())
        active_digest["handoff"].update(bytes=len(bundle["_task3_product_handoff"]),
            file_sha256=hashlib.sha256(bundle["_task3_product_handoff"]).hexdigest().upper())
        bundle["_task3_product_digest"] = subprocess.check_output(["git", "show",
            "45bb14f72041b4d4b3b4b0dfa6b40030edd8f1fe:docs/progress/"
            "progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json"],
            cwd=ROOT, stderr=subprocess.DEVNULL)
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = stream["events"][2179]["details"], stream["events"][2180]["details"]
        at = close_at or (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK3_FIXED_OPERATIONS_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2182, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2183, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task3_fixed_operations_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK3_FIXED_OPERATIONS_CLOSE",
                "subject_ref": "F-19A/TASK3-FIXED-OPERATIONS", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2183
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2181_task3_fixed_operations_write_lease_issued"\n}\n'
        prefix = bundle["_task3_product_events"].decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(
                row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2183_task3_fixed_operations_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2181', '"last_sequence": 2183', 1).encode("utf-8")
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task3_fixed_operations_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task3_fixed_operations_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_DUAL_LEASE_PENDING"
        progress["f19a_task3_fixed_operations_binding"].update(
            status="TASK3_FIXED_OPERATIONS_CLOSED_NOT_F19A_ACCEPTED",
            active_projection_checkpoint="45bb14f72041b4d4b3b4b0dfa6b40030edd8f1fe",
            next_safe_action=action, event_sequence=2183)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task3-fixed-operations-close-seq2183")
        progress["repository"].update(projection_mode="F19A_TASK3_FIXED_OPERATIONS_CLOSED",
            head_relation="F19A_TASK3_FIXED_OPERATIONS_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK3_FIXED_OPERATIONS_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2183, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="1e40e1ad306de93d659ca76e07e587361f70d676", next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2183
        return bundle, raw

    @staticmethod
    def validate_task3_closed(bundle, raw, *, observed=None):
        original_stat, original_sha, original_output = Path.stat, checker._sha256, subprocess.check_output
        progress_path, handoff_path = ROOT / "docs/progress/build-progress.json", ROOT / "docs/progress/BUILD_HANDOFF.md"
        checkpoint = bundle["progress"]["f19a_task3_fixed_operations_binding"].get(
            "active_projection_checkpoint", "e" * 40)

        def stat(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(checkpoint + ":"):
                path = command[2].split(":", 1)[1]
                values = {"docs/progress/progress-events.json": "_task3_product_events",
                    "docs/progress/build-progress.json": "_task3_product_progress",
                    "docs/progress/BUILD_HANDOFF.md": "_task3_product_handoff",
                    "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                        "_task3_product_digest"}
                if path in values:
                    return bundle[values[path]]
            return original_output(command, *args, **kwargs)

        with patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha), \
                patch.object(subprocess, "check_output", side_effect=output):
            now = observed or datetime.fromisoformat(bundle["events"]["events"][2182]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task3_fixed_operations_closed(bundle, event_raw=raw, now=now)

    def test_task3_closed_projection_uses_published_active_and_rejects_forgery(self):
        bundle, raw = self.task3_closed_bundle()
        self.assertEqual(self.validate_task3_closed(bundle, raw), [])
        for name, change in (
            ("event_envelope", lambda b: b["events"]["events"][2181].update(actor="forged")),
            ("write_token", lambda b: b["events"]["events"][2181]["details"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["completed_f19a_task3_fixed_operations_write_lease"].update(
                product_write_scope=[])),
            ("missing_p", lambda b: b["progress"]["f19a_task3_fixed_operations_binding"].pop(
                "active_projection_checkpoint")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task3_closed(forged, raw))

    def test_task3_closed_projection_rejects_invalid_revocation_time(self):
        bundle, raw = self.task3_closed_bundle()
        lease = bundle["progress"]["completed_f19a_task3_fixed_operations_worker_lease"]
        expiry = lease["expires_at"]
        for name, observed in (("expiry_equal", datetime.fromisoformat(expiry) + timedelta(minutes=1)),
                               ("future", datetime.fromisoformat(lease["issued_at"]) + timedelta(minutes=1))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                at = expiry if name == "expiry_equal" else (observed + timedelta(minutes=1)).isoformat()
                for row in forged["events"]["events"][-2:]:
                    row["occurred_at"] = at
                for key in ("completed_f19a_task3_fixed_operations_worker_lease",
                            "completed_f19a_task3_fixed_operations_write_lease"):
                    forged["progress"][key]["revoked_at"] = at
                self.assertTrue(self.validate_task3_closed(forged, raw, observed=observed))

    def test_task3_closed_git_requires_published_c_d_p_and_clean_scope(self):
        bundle, _ = self.task3_closed_bundle()
        base, control, product, active = (
            "71154279a7da853acbd15706126fe4c323b7016f",
            "c066ecdaf998535a0b80090b44d2f17b4d1e2aae",
            "1e40e1ad306de93d659ca76e07e587361f70d676",
            "45bb14f72041b4d4b3b4b0dfa6b40030edd8f1fe")
        original_output, original_run = subprocess.check_output, subprocess.run
        original_read = Path.read_bytes
        published = {(ROOT / path): original_output(["git", "show", f"{sha}:{path}"], cwd=ROOT)
            for sha, paths in ((control, ("scripts/check_project_progress.py",
                    "tests/tooling/test_f19a_start_projection.py")),
                    (product, ("packages/api/operations.py",))) for path in paths}
        scenarios = ("positive", "remote", "product_dirty", "unrelated_close", "stale_product", "unpublished")
        for scenario in scenarios:
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (active + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else active) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/operations.py\n" if scenario == "product_dirty" else b""
                    if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                        return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                    if tail == ["diff", "--name-only", "--no-renames", f"{control}..{product}"]:
                        return b"packages/api/operations.py\n"
                    if tail == ["diff", "--name-only", "--no-renames", f"{product}..{active}"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["diff", "--name-only", "--no-renames", f"{active}..HEAD"]:
                        return b"packages/api/runtime.py\n" if scenario == "unrelated_close" else b""
                    if tail[:1] == ["show"] and len(tail) == 2:
                        sha, path = tail[1].split(":", 1)
                        if sha in (control, product):
                            return b"stale" if scenario == "stale_product" and sha == product else published[ROOT / path]
                    return original_output(command, *args, **kwargs)

                def read(path):
                    return published[path] if path in published else original_read(path)

                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "unpublished" and command[-2:] == [product, active] else 0)
                    return original_run(command, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run), \
                        patch.object(Path, "read_bytes", read):
                    errors = checker._collect_f19a_task3_fixed_operations_closed_git(bundle)
                self.assertEqual(bool(errors), scenario != "positive")

    def test_epoch80_postclose_active_live_and_forgery(self):
        bundle = self.epoch80_archived_active_bundle()
        self.assertEqual(self.validate_epoch80_active(bundle), [])
        for name, change in (
            ("event_envelope", lambda b: b["events"]["events"][2185].update(actor="forged")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[
                "packages/api/operations.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch80_active(forged))

    def test_epoch80_postclose_active_git_rejects_remote_and_product_dirty(self):
        bundle = self.epoch80_archived_active_bundle()
        base = "b44369a285a7786c23f7ed76b7a396423017dc7d"
        control = "07dfbc279a28dc18118b281b2b68876c7322b644"
        active = "cd715e5e10bee5844f9116acbac95cdaa81d71be"
        original, original_run = subprocess.check_output, subprocess.run

        def check(*, remote=None, dirty=None):
            def output(command, *args, **kwargs):
                tail = command[5:] if command[:5] == [
                    "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                if tail == ["rev-parse", "HEAD"]:
                    return (active + "\n").encode()
                if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                    return ((remote or active) + "\n").encode()
                if tail == ["branch", "--show-current"]:
                    return b"codex/f18-wsl-ops\n"
                if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                    return b"development/codex/f18-wsl-ops\n"
                if tail == ["status", "--porcelain=v1", "-uall"]:
                    return dirty or b""
                if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                    return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                if tail == ["diff", "--name-only", "--no-renames", f"{control}..HEAD"]:
                    return b"docs/progress/build-progress.json\n"
                if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(control + ":"):
                    return original(command, *args, **kwargs)
                return original(command, *args, **kwargs)

            def run(command, *args, **kwargs):
                if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                    return subprocess.CompletedProcess(command, 0)
                return original_run(command, *args, **kwargs)

            with patch.object(subprocess, "check_output", side_effect=output), \
                    patch.object(subprocess, "run", side_effect=run), \
                    patch.object(Path, "read_bytes", lambda path: original(["git", "show", f"{control}:{path.relative_to(ROOT).as_posix()}"], cwd=ROOT)
                        if path in (ROOT / "scripts/check_project_progress.py", ROOT / "tests/tooling/test_f19a_start_projection.py")
                        else Path.open(path, "rb").read()):
                return checker._collect_f19a_task3_postclose_fixture_git(bundle)

        self.assertEqual(check(), [])
        self.assertTrue(check(remote="0" * 40))
        self.assertTrue(check(dirty=b" M packages/api/operations.py\n"))

    @staticmethod
    def epoch80_archived_active_bundle():
        publication = "cd715e5e10bee5844f9116acbac95cdaa81d71be"
        bundle = deepcopy(checker.load_bundle(ROOT))
        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                cwd=ROOT, stderr=subprocess.DEVNULL)
        bundle["_epoch80_active_progress"] = archived("docs/progress/build-progress.json")
        bundle["progress"] = json.loads(bundle["_epoch80_active_progress"])
        bundle["_epoch80_active_events"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_epoch80_active_events"])
        bundle["_epoch80_active_handoff"] = archived("docs/progress/BUILD_HANDOFF.md")
        bundle["handoff_text"] = bundle["_epoch80_active_handoff"].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["_epoch80_active_digest"] = archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        bundle["detached_digest"] = json.loads(bundle["_epoch80_active_digest"])
        return bundle

    @staticmethod
    def epoch80_checkpoint_bundle():
        return F19AStartProjectionTests.epoch80_archived_active_bundle()

    @staticmethod
    def validate_epoch80_active(bundle):
        original_stat, original_sha = Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        archive = {progress_path: bundle["_epoch80_active_progress"],
            handoff_path: bundle["_epoch80_active_handoff"]}
        def stat_archive(path, *args, **kwargs):
            if path in archive:
                return SimpleNamespace(st_size=len(archive[path]))
            return original_stat(path, *args, **kwargs)
        def sha_archive(path):
            if path in archive:
                return hashlib.sha256(archive[path]).hexdigest().upper()
            return original_sha(path)
        with patch.object(Path, "stat", stat_archive), patch.object(checker, "_sha256", side_effect=sha_archive):
            observed = datetime.fromisoformat(bundle["events"]["events"][2185]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task3_postclose_fixture(bundle,
                event_raw=bundle["_epoch80_active_events"], now=observed)

    def test_epoch80_postclose_control_checkpoint_projection_rejects_forgery(self):
        bundle = self.epoch80_checkpoint_bundle()
        self.assertEqual(self.validate_epoch80_active(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["f19a_task3_postclose_fixture_binding"]["control_checkpoint"] = "0" * 40
        self.assertTrue(self.validate_epoch80_active(forged))

    @staticmethod
    def epoch80_closed_bundle():
        bundle = F19AStartProjectionTests.epoch80_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        worker, write = stream["events"][2184]["details"], stream["events"][2185]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK3_POSTCLOSE_FIXTURE_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2187, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2188, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task3_postclose_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK3_POSTCLOSE_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK3-POSTCLOSE-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2188
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2186_task3_postclose_fixture_write_lease_issued"\n}\n'
        prefix = bundle["_epoch80_active_events"].decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2188_task3_postclose_fixture_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2186', '"last_sequence": 2188', 1).encode("utf-8")
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task3_postclose_fixture_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task3_postclose_fixture_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_DUAL_LEASE_PENDING"
        progress["f19a_task3_postclose_fixture_binding"].update(
            status="TASK3_POSTCLOSE_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            active_projection_checkpoint="cd715e5e10bee5844f9116acbac95cdaa81d71be",
            next_safe_action=action, event_sequence=2188)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task3-postclose-fixture-close-seq2188")
        progress["repository"].update(projection_mode="F19A_TASK3_POSTCLOSE_FIXTURE_CLOSED",
            head_relation="F19A_TASK3_POSTCLOSE_FIXTURE_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK3_POSTCLOSE_FIXTURE_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2188, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="07dfbc279a28dc18118b281b2b68876c7322b644", next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2188
        return bundle, raw

    @staticmethod
    def validate_epoch80_closed(bundle, raw):
        original_output, original_stat, original_sha = subprocess.check_output, Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        active = bundle["progress"]["f19a_task3_postclose_fixture_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_epoch80_active_progress",
            "docs/progress/progress-events.json": "_epoch80_active_events",
            "docs/progress/BUILD_HANDOFF.md": "_epoch80_active_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_epoch80_active_digest"}

        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(active + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return bundle[values[path]]
            return original_output(command, *args, **kwargs)

        def stat(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)

        def sha(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)

        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha):
            observed = datetime.fromisoformat(bundle["events"]["events"][2187]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task3_postclose_fixture_closed(bundle, event_raw=raw, now=observed)

    def test_epoch80_closed_projection_uses_published_active_and_rejects_forgery(self):
        bundle, raw = self.epoch80_closed_bundle()
        self.assertEqual(self.validate_epoch80_closed(bundle, raw), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2186].update(actor="forged")),
            ("token", lambda b: b["progress"]["completed_f19a_task3_postclose_fixture_write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["completed_f19a_task3_postclose_fixture_write_lease"].update(
                product_write_scope=["packages/api/operations.py"])),
            ("publication", lambda b: b["progress"]["f19a_task3_postclose_fixture_binding"].update(
                active_projection_checkpoint="0" * 40)),
            ("published_handoff", lambda b: b.__setitem__("_epoch80_active_handoff", b"forged")),
            ("published_digest", lambda b: b.__setitem__("_epoch80_active_digest", b"{}")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch80_closed(forged, raw))

    def test_epoch80_closed_git_requires_published_control_and_docs_only(self):
        bundle, _ = self.epoch80_closed_bundle()
        base, control, active = ("b44369a285a7786c23f7ed76b7a396423017dc7d",
            "07dfbc279a28dc18118b281b2b68876c7322b644",
            "cd715e5e10bee5844f9116acbac95cdaa81d71be")
        original_output, original_run = subprocess.check_output, subprocess.run
        for scenario in ("positive", "remote", "product_dirty", "unrelated", "unpublished", "stale_blob"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == [
                        "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (active + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else active) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/operations.py\n" if scenario == "product_dirty" else b""
                    if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                        return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                    if tail == ["diff", "--name-only", "--no-renames", f"{control}..HEAD"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["diff", "--name-only", "--no-renames", f"{control}..{active}"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["diff", "--name-only", "--no-renames", f"{active}..HEAD"]:
                        return b"packages/api/operations.py\n" if scenario == "unrelated" else b""
                    if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(control + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" else (ROOT / path).read_bytes()
                    if tail == ["show", f"{active}:docs/progress/build-progress.json"]:
                        return bundle["_epoch80_active_progress"]
                    return original_output(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "unpublished"
                            and command[-2:] == [control, active] else 0)
                    return original_run(command, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    errors = checker._collect_f19a_task3_postclose_fixture_closed_git(bundle)
                self.assertEqual(bool(errors), scenario != "positive")

    def test_epoch80_closed_rejects_digest_header_forgery(self):
        bundle, raw = self.epoch80_closed_bundle()
        self.assertEqual(self.validate_epoch80_closed(bundle, raw), [])
        for name, value in (("schema_version", "forged"), ("algorithm", "MD5"),
                            ("self_reference", True)):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                forged["detached_digest"][name] = value
                self.assertIn("F19A_TASK3_POSTCLOSE_CLOSE_DIGEST_INVALID",
                    self.validate_epoch80_closed(forged, raw))

    def test_epoch81_r2_active_live_and_forgery(self):
        bundle = self.epoch81_archived_active_bundle()
        self.assertEqual(self.validate_epoch81_active(bundle), [])
        for name, change in (
            ("event_envelope", lambda b: b["events"]["events"][2190].update(actor="forged")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[
                "packages/api/operations.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch81_active(forged))

    @staticmethod
    def epoch81_archived_active_bundle():
        publication = "aaa926ffce8dbeff991646ff86732912a2b15afd"
        bundle = deepcopy(checker.load_bundle(ROOT))
        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                cwd=ROOT, stderr=subprocess.DEVNULL)
        bundle["_epoch81_active_progress"] = archived("docs/progress/build-progress.json")
        bundle["progress"] = json.loads(bundle["_epoch81_active_progress"])
        bundle["_epoch81_active_events"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_epoch81_active_events"])
        bundle["_epoch81_active_handoff"] = archived("docs/progress/BUILD_HANDOFF.md")
        bundle["handoff_text"] = bundle["_epoch81_active_handoff"].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["_epoch81_active_digest"] = archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        bundle["detached_digest"] = json.loads(bundle["_epoch81_active_digest"])
        return bundle

    @staticmethod
    def validate_epoch81_active(bundle):
        files = {"docs/progress/build-progress.json": bundle["_epoch81_active_progress"],
            "docs/progress/BUILD_HANDOFF.md": bundle["_epoch81_active_handoff"]}
        observed = datetime.fromisoformat(bundle["events"]["events"][2190]["occurred_at"]) + timedelta(minutes=1)
        return checker._validate_f19a_task3_postclose_fixture_r2(bundle,
            event_raw=bundle["_epoch81_active_events"], now=observed, archived_files=files)

    def test_epoch81_r2_archived_active_survives_later_live_close(self):
        bundle = self.epoch81_archived_active_bundle()
        self.assertEqual(self.validate_epoch81_active(bundle), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2190].update(actor="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["packages/api/operations.py"])),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch81_active(forged))

    @staticmethod
    def epoch81_checkpoint_bundle():
        bundle = F19AStartProjectionTests.epoch81_archived_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        binding = progress["f19a_task3_postclose_fixture_r2_binding"]
        binding.update(status="TASK3_POSTCLOSE_FIXTURE_R2_CONTROL_CHECKPOINTED_CLOSE_READY",
            control_checkpoint=checkpoint,
            next_safe_action="F19A_TASK3_POSTCLOSE_FIXTURE_R2_CLOSE_ONLY")
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK3_POSTCLOSE_FIXTURE_R2_CONTROL_CHECKPOINTED_CLOSE_READY",
            worktree_status="F19A_TASK3_POSTCLOSE_FIXTURE_R2_CONTROL_CHECKPOINTED_CLOSE_READY")
        progress["active_work_instruction"].update(
            result_status="TASK3_POSTCLOSE_FIXTURE_R2_CONTROL_CHECKPOINTED_CLOSE_READY",
            package_status="TASK3_POSTCLOSE_FIXTURE_R2_CONTROL_CHECKPOINTED_CLOSE_READY")
        progress["next_work_package"]["status"] = "TASK3_POSTCLOSE_FIXTURE_R2_CONTROL_CHECKPOINTED_CLOSE_READY"
        progress["next_safe_action"] = progress["runtime_next_action"] = binding["next_safe_action"]
        progress["snapshot_id"] = "snapshot-f19a-task3-postclose-fixture-r2-checkpoint-seq2191"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=binding["next_safe_action"])
        bundle["_epoch81_active_progress"] = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        bundle["_epoch81_active_handoff"] = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["detached_digest"]["progress"].update(bytes=len(bundle["_epoch81_active_progress"]),
            file_sha256=hashlib.sha256(bundle["_epoch81_active_progress"]).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=len(bundle["_epoch81_active_handoff"]),
            file_sha256=hashlib.sha256(bundle["_epoch81_active_handoff"]).hexdigest().upper())
        bundle["_epoch81_active_digest"] = (json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_epoch81_r2_checkpoint_projection_rejects_forgery(self):
        bundle = self.epoch81_checkpoint_bundle()
        self.assertEqual(self.validate_epoch81_active(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["f19a_task3_postclose_fixture_r2_binding"]["control_checkpoint"] = "0" * 40
        self.assertTrue(self.validate_epoch81_active(forged))

    @staticmethod
    def epoch81_closed_bundle():
        bundle = F19AStartProjectionTests.epoch81_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        worker, write = stream["events"][2189]["details"], stream["events"][2190]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK3_POSTCLOSE_FIXTURE_R2_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2192, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2193, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task3_postclose_fixture_r2_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK3_POSTCLOSE_FIXTURE_R2_CLOSE",
                "subject_ref": "F-19A/TASK3-POSTCLOSE-FIXTURE-R2", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2193
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2191_task3_postclose_fixture_r2_write_lease_issued"\n}\n'
        prefix = bundle["_epoch81_active_events"].decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2193_task3_postclose_fixture_r2_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2191', '"last_sequence": 2193', 1).encode("utf-8")
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task3_postclose_fixture_r2_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task3_postclose_fixture_r2_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_DUAL_LEASE_PENDING"
        progress["f19a_task3_postclose_fixture_r2_binding"].update(
            status="TASK3_POSTCLOSE_FIXTURE_R2_CLOSED_NOT_F19A_ACCEPTED",
            active_projection_checkpoint="e" * 40, next_safe_action=action, event_sequence=2193)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task3-postclose-fixture-r2-close-seq2193")
        progress["repository"].update(projection_mode="F19A_TASK3_POSTCLOSE_FIXTURE_R2_CLOSED",
            head_relation="F19A_TASK3_POSTCLOSE_FIXTURE_R2_CLOSED_NOT_F19A_ACCEPTED",
            worktree_status="F19A_TASK3_POSTCLOSE_FIXTURE_R2_CLOSED_NOT_F19A_ACCEPTED")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2193, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2193
        return bundle, raw

    @staticmethod
    def validate_epoch81_closed(bundle, raw):
        original_output, original_stat, original_sha = subprocess.check_output, Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        active = bundle["progress"]["f19a_task3_postclose_fixture_r2_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_epoch81_active_progress",
            "docs/progress/progress-events.json": "_epoch81_active_events",
            "docs/progress/BUILD_HANDOFF.md": "_epoch81_active_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_epoch81_active_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(active + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return bundle[values[path]]
            return original_output(command, *args, **kwargs)
        def stat(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)
        def sha(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)
        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha):
            observed = datetime.fromisoformat(bundle["events"]["events"][2192]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task3_postclose_fixture_r2_closed(bundle, event_raw=raw, now=observed)

    def test_epoch81_r2_closed_projection_uses_immutable_active_and_rejects_forgery(self):
        bundle, raw = self.epoch81_closed_bundle()
        self.assertEqual(self.validate_epoch81_closed(bundle, raw), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2190].update(actor="forged")),
            ("token", lambda b: b["progress"]["completed_f19a_task3_postclose_fixture_r2_write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["completed_f19a_task3_postclose_fixture_r2_write_lease"].update(
                product_write_scope=["packages/api/operations.py"])),
            ("publication", lambda b: b["progress"]["f19a_task3_postclose_fixture_r2_binding"].update(
                active_projection_checkpoint="0" * 40)),
            ("published_handoff", lambda b: b.__setitem__("_epoch81_active_handoff", b"forged")),
            ("published_digest", lambda b: b.__setitem__("_epoch81_active_digest", b"{}")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_epoch81_closed(forged, raw))

    def test_epoch81_r2_git_requires_remote_clean_code_and_published_active(self):
        base, control, active = "68b4b613a15a30044e91639d4837b3207b9b214b", "c" * 40, "e" * 40
        a_bundle = self.epoch81_archived_active_bundle()
        b_bundle = self.epoch81_checkpoint_bundle()
        closed_bundle, _ = self.epoch81_closed_bundle()
        original_output, original_run, original_read = subprocess.check_output, subprocess.run, Path.read_bytes
        code_paths = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        published_code = {ROOT / path: original_output(["git", "show",
            f"aaa926ffce8dbeff991646ff86732912a2b15afd:{path}"], cwd=ROOT) for path in code_paths}
        for phase, bundle in (("A", a_bundle), ("B", b_bundle), ("closed", closed_bundle)):
            for scenario in ("positive", "remote", "product_dirty", "unrelated", "unpublished",
                             "stale_blob", "later_docs", "stale_a_blob",
                             "unpublished_a", "transient_product", "merge_between",
                             "transient_control_to_p", "transient_p_to_head"):
                with self.subTest(phase=phase, scenario=scenario):
                    head = ("f" * 40 if phase == "A" and scenario == "later_docs" else
                        "f" * 40 if phase == "closed" and scenario == "transient_p_to_head" else
                        "aaa926ffce8dbeff991646ff86732912a2b15afd" if phase == "A" else active)
                    def output(command, *args, **kwargs):
                        tail = command[5:] if command[:5] == [
                            "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                        if tail == ["rev-parse", "HEAD"]:
                            return (head + "\n").encode()
                        if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                            return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                        if tail == ["branch", "--show-current"]:
                            return b"codex/f18-wsl-ops\n"
                        if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                            return b"development/codex/f18-wsl-ops\n"
                        if tail == ["status", "--porcelain=v1", "-uall"]:
                            return b" M packages/api/operations.py\n" if scenario == "product_dirty" else b""
                        if tail[:2] == ["rev-list", "--min-parents=2"]:
                            return (b"deadbeef\n" if scenario == "merge_between" and phase != "A"
                                and tail[2] == f"{control}..{head}" else b"")
                        if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                            return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{control}..HEAD"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{control}..{active}"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{active}..HEAD"]:
                            return b"packages/api/runtime.py\n" if scenario == "unrelated" else b""
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{base}..{control}"]:
                            return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"aaa926ffce8dbeff991646ff86732912a2b15afd..{control}"]:
                            return (b"packages/api/operations.py\n" if scenario == "transient_product" else
                                b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n")
                        if tail in (["log", "--format=", "--name-only", "--no-renames", f"{control}..HEAD"],
                                    ["log", "--format=", "--name-only", "--no-renames", f"{control}..{active}"],
                                    ["log", "--format=", "--name-only", "--no-renames", f"{active}..HEAD"]):
                            return (b"packages/api/operations.py\n" if scenario in (
                                "transient_product", "transient_control_to_p") else
                                b"docs/progress/build-progress.json\n")
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{active}..{active}"]:
                            return b""
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{active}..{head}"]:
                            return (b"packages/api/operations.py\n" if scenario == "transient_p_to_head"
                                else b"docs/progress/build-progress.json\n")
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{control}..{head}"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(control + ":"):
                            path = ROOT / tail[1].split(":", 1)[1]
                            return b"stale" if scenario == "stale_blob" else published_code[path]
                        if (tail[:1] == ["show"] and len(tail) == 2 and phase == "A"
                                and scenario == "stale_a_blob"
                                and tail[1].startswith("aaa926ffce8dbeff991646ff86732912a2b15afd:")):
                            return b"stale"
                        if tail == ["show", f"{active}:docs/progress/build-progress.json"]:
                            return closed_bundle["_epoch81_active_progress"]
                        return original_output(command, *args, **kwargs)
                    def run(command, *args, **kwargs):
                        if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                            return subprocess.CompletedProcess(command, 1 if (
                                scenario == "unpublished" and command[-2:] == [control, active]
                                or scenario == "unpublished_a" and command[-2:] == [
                                    "aaa926ffce8dbeff991646ff86732912a2b15afd", control]) else 0)
                        return original_run(command, *args, **kwargs)
                    def read(path):
                        return published_code[path] if path in published_code else original_read(path)
                    with patch.object(subprocess, "check_output", side_effect=output), \
                            patch.object(subprocess, "run", side_effect=run), \
                            patch.object(Path, "read_bytes", read):
                        errors = (checker._collect_f19a_task3_postclose_fixture_r2_closed_git(bundle)
                            if phase == "closed" else checker._collect_f19a_task3_postclose_fixture_r2_git(bundle))
                    expected = scenario != "positive" and not (
                        (phase == "A" and scenario in ("unrelated", "unpublished", "stale_blob",
                            "unpublished_a", "transient_product", "merge_between",
                            "transient_control_to_p", "transient_p_to_head"))
                        or (phase != "A" and scenario in ("later_docs", "stale_a_blob"))
                        or (phase == "B" and scenario in ("unrelated", "transient_p_to_head")))
                    self.assertEqual(bool(errors), expected, f"{phase}/{scenario}: {errors}")

    @staticmethod
    def task4_archived_active_bundle():
        publication = "8068ea5e1197edac6a7ee86a58fdc4eed2f339a0"
        bundle = deepcopy(checker.load_bundle(ROOT))
        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                cwd=ROOT, stderr=subprocess.DEVNULL)
        bundle["_task4_active_progress"] = archived("docs/progress/build-progress.json")
        bundle["progress"] = json.loads(bundle["_task4_active_progress"])
        bundle["_task4_active_events"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_task4_active_events"])
        bundle["_task4_active_handoff"] = archived("docs/progress/BUILD_HANDOFF.md")
        bundle["handoff_text"] = bundle["_task4_active_handoff"].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["_task4_active_digest"] = archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        bundle["detached_digest"] = json.loads(bundle["_task4_active_digest"])
        return bundle

    @staticmethod
    def validate_task4_active(bundle):
        files = {"docs/progress/build-progress.json": bundle["_task4_active_progress"],
            "docs/progress/BUILD_HANDOFF.md": bundle["_task4_active_handoff"]}
        observed = datetime.fromisoformat(bundle["events"]["events"][2195]["occurred_at"]) + timedelta(minutes=1)
        return checker._validate_f19a_task4_isolated_qa_control(bundle,
            event_raw=bundle["_task4_active_events"], now=observed, archived_files=files)

    def test_task4_active_immutable_bootstrap_and_forgery(self):
        bundle = self.task4_archived_active_bundle()
        self.assertEqual(self.validate_task4_active(bundle), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2195].update(actor="forged")),
            ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[
                "deploy/wsl/f19a_qa_bootstrap.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task4_active(forged))

    def test_task4_active_git_published_bootstrap_and_negative(self):
        bundle = self.task4_archived_active_bundle()
        publication = "8068ea5e1197edac6a7ee86a58fdc4eed2f339a0"
        base = "897b0b660b9979794cc83c7ed69240a0be8bb9cc"
        original_output = subprocess.check_output
        published = {path: original_output(["git", "show", f"{publication}:{path}"], cwd=ROOT)
            for path in ("docs/progress/build-progress.json", "docs/progress/progress-events.json",
                "docs/progress/BUILD_HANDOFF.md",
                "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")}
        for scenario in ("positive", "remote", "product_dirty", "later_docs", "stale_blob"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == [
                        "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "later_docs" else publication) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else
                            "f" * 40 if scenario == "later_docs" else publication) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "product_dirty" else b""
                    if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(publication + ":"):
                        return b"stale" if scenario == "stale_blob" else published[tail[1].split(":", 1)[1]]
                    return original_output(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
                    errors = checker._collect_f19a_task4_isolated_qa_control_git(bundle)
                self.assertEqual(bool(errors), scenario != "positive", f"{scenario}: {errors}")

    @staticmethod
    def task4_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_archived_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        binding = progress["f19a_task4_isolated_qa_binding"]
        binding.update(status="TASK4_CONTROL_CHECKPOINTED_CLOSE_READY",
            control_checkpoint=checkpoint, next_safe_action="F19A_TASK4_CONTROL_CLOSE_ONLY")
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation="F19A_TASK4_ISOLATED_QA_CONTROL_CHECKPOINTED_CLOSE_READY",
            worktree_status="F19A_TASK4_ISOLATED_QA_CONTROL_CHECKPOINTED_CLOSE_READY")
        progress["active_work_instruction"].update(result_status="TASK4_CONTROL_CHECKPOINTED_CLOSE_READY",
            package_status="TASK4_CONTROL_CHECKPOINTED_CLOSE_READY")
        progress["next_work_package"]["status"] = "TASK4_CONTROL_CHECKPOINTED_CLOSE_READY"
        progress["next_safe_action"] = progress["runtime_next_action"] = binding["next_safe_action"]
        progress["snapshot_id"] = "snapshot-f19a-task4-isolated-qa-control-checkpoint-seq2196"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=binding["next_safe_action"])
        bundle["_task4_active_progress"] = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        bundle["_task4_active_handoff"] = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["detached_digest"]["progress"].update(bytes=len(bundle["_task4_active_progress"]),
            file_sha256=hashlib.sha256(bundle["_task4_active_progress"]).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=len(bundle["_task4_active_handoff"]),
            file_sha256=hashlib.sha256(bundle["_task4_active_handoff"]).hexdigest().upper())
        bundle["_task4_active_digest"] = (json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_checkpoint_projection_rejects_forgery(self):
        bundle = self.task4_checkpoint_bundle()
        self.assertEqual(self.validate_task4_active(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["f19a_task4_isolated_qa_binding"]["control_checkpoint"] = "0" * 40
        self.assertTrue(self.validate_task4_active(forged))

    @staticmethod
    def task4_closed_bundle():
        bundle = F19AStartProjectionTests.task4_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        worker, write = stream["events"][2194]["details"], stream["events"][2195]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_CONTROL_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in (
            (2197, "WRITE_LEASE_REVOKED", {"lease_id": write["lease_id"],
                "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2198, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason}),
        ):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_isolated_qa_control_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_ISOLATED_QA_CONTROL_CLOSE",
                "subject_ref": "F-19A/TASK4-ISOLATED-QA", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2198
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2196_task4_isolated_qa_write_lease_issued"\n}\n'
        prefix = bundle["_task4_active_events"].decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2198_task4_isolated_qa_control_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2196', '"last_sequence": 2198', 1).encode("utf-8")
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_isolated_qa_control_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_isolated_qa_control_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_PRODUCT_DUAL_LEASE_PENDING"
        progress["f19a_task4_isolated_qa_binding"].update(
            status="TASK4_CONTROL_CLOSED_PRODUCT_DUAL_LEASE_PENDING",
            active_projection_checkpoint="e" * 40, next_safe_action=action, event_sequence=2198)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_PRODUCT_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task4-isolated-qa-control-close-seq2198")
        progress["repository"].update(projection_mode="F19A_TASK4_ISOLATED_QA_CONTROL_CLOSED",
            head_relation="F19A_TASK4_ISOLATED_QA_CONTROL_CLOSED_PRODUCT_DUAL_LEASE_PENDING",
            worktree_status="F19A_TASK4_ISOLATED_QA_CONTROL_CLOSED_PRODUCT_DUAL_LEASE_PENDING")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2198, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2198
        return bundle, raw

    @staticmethod
    def validate_task4_closed(bundle, raw):
        original_output, original_stat, original_sha = subprocess.check_output, Path.stat, checker._sha256
        progress_path = ROOT / "docs/progress/build-progress.json"
        handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
        active = bundle["progress"]["f19a_task4_isolated_qa_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_task4_active_progress",
            "docs/progress/progress-events.json": "_task4_active_events",
            "docs/progress/BUILD_HANDOFF.md": "_task4_active_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_task4_active_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(active + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return bundle[values[path]]
            return original_output(command, *args, **kwargs)
        def stat(path, *args, **kwargs):
            if path == progress_path:
                return SimpleNamespace(st_size=123)
            if path == handoff_path:
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)
        def sha(path):
            if path == progress_path:
                return "A" * 64
            if path == handoff_path:
                return "B" * 64
            return original_sha(path)
        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha):
            observed = datetime.fromisoformat(bundle["events"]["events"][2197]["occurred_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task4_isolated_qa_control_closed(bundle, event_raw=raw, now=observed)

    def test_task4_closed_projection_uses_immutable_active_and_rejects_forgery(self):
        bundle, raw = self.task4_closed_bundle()
        self.assertEqual(self.validate_task4_closed(bundle, raw), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2195].update(actor="forged")),
            ("token", lambda b: b["progress"]["completed_f19a_task4_isolated_qa_control_write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["completed_f19a_task4_isolated_qa_control_write_lease"].update(
                product_write_scope=["deploy/wsl/f19a_qa_bootstrap.py"])),
            ("publication", lambda b: b["progress"]["f19a_task4_isolated_qa_binding"].update(
                active_projection_checkpoint="0" * 40)),
            ("published_handoff", lambda b: b.__setitem__("_task4_active_handoff", b"forged")),
            ("published_digest", lambda b: b.__setitem__("_task4_active_digest", b"{}")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task4_closed(forged, raw))

    def test_task4_git_a_c_p_closed_rejects_forgery(self):
        base = "897b0b660b9979794cc83c7ed69240a0be8bb9cc"
        issued = "8068ea5e1197edac6a7ee86a58fdc4eed2f339a0"
        control, active = "c" * 40, "e" * 40
        bundles = (("A", self.task4_archived_active_bundle()),
            ("B", self.task4_checkpoint_bundle()), ("closed", self.task4_closed_bundle()[0]))
        original_output, original_run, original_read = subprocess.check_output, subprocess.run, Path.read_bytes
        code_paths = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        published_code = {ROOT / path: original_output(["git", "show", f"{issued}:{path}"], cwd=ROOT)
            for path in code_paths}
        scenarios = ("positive", "remote", "product_dirty", "later_docs", "stale_a_blob",
            "unpublished_a", "stale_code", "unpublished_p", "unrelated_close",
            "transient_pre_c", "transient_c_to_p", "transient_p_to_head", "merge_between")
        for phase, bundle in bundles:
            for scenario in scenarios:
                with self.subTest(phase=phase, scenario=scenario):
                    head = ("f" * 40 if phase == "A" and scenario == "later_docs" else
                        "f" * 40 if phase == "closed" and scenario == "transient_p_to_head" else
                        issued if phase == "A" else active)
                    def output(command, *args, **kwargs):
                        tail = command[5:] if command[:5] == [
                            "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                        if tail == ["rev-parse", "HEAD"]:
                            return (head + "\n").encode()
                        if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                            return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                        if tail == ["branch", "--show-current"]:
                            return b"codex/f18-wsl-ops\n"
                        if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                            return b"development/codex/f18-wsl-ops\n"
                        if tail == ["status", "--porcelain=v1", "-uall"]:
                            return b" M deploy/wsl/f19a_qa_bootstrap.py\n" if scenario == "product_dirty" else b""
                        if tail[:2] == ["rev-list", "--min-parents=2"]:
                            return (b"deadbeef\n" if scenario == "merge_between" and phase != "A"
                                and tail[2] == f"{control}..{head}" else b"")
                        if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                            return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{control}..HEAD"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{control}..{active}"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{active}..HEAD"]:
                            return b"deploy/wsl/f19a_qa_bootstrap.py\n" if scenario == "unrelated_close" else b""
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{issued}..{control}"]:
                            return (b"deploy/wsl/f19a_qa_bootstrap.py\n" if scenario == "transient_pre_c" else
                                b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n")
                        if tail in (["log", "--format=", "--name-only", "--no-renames", f"{control}..HEAD"],
                                    ["log", "--format=", "--name-only", "--no-renames", f"{control}..{active}"]):
                            return (b"deploy/wsl/f19a_qa_bootstrap.py\n" if scenario == "transient_c_to_p" else
                                b"docs/progress/build-progress.json\n")
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{active}..{active}"]:
                            return b""
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{active}..{head}"]:
                            return (b"deploy/wsl/f19a_qa_bootstrap.py\n" if scenario == "transient_p_to_head" else
                                b"docs/progress/build-progress.json\n")
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{control}..{head}"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(control + ":"):
                            path = ROOT / tail[1].split(":", 1)[1]
                            return b"stale" if scenario == "stale_code" else published_code[path]
                        if (tail[:1] == ["show"] and len(tail) == 2 and phase == "A"
                                and scenario == "stale_a_blob" and tail[1].startswith(issued + ":")):
                            return b"stale"
                        if tail == ["show", f"{active}:docs/progress/build-progress.json"]:
                            return bundles[2][1]["_task4_active_progress"]
                        return original_output(command, *args, **kwargs)
                    def run(command, *args, **kwargs):
                        if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                            return subprocess.CompletedProcess(command, 1 if (
                                scenario == "unpublished_p" and command[-2:] == [control, active]
                                or scenario == "unpublished_a" and command[-2:] == [issued, control]) else 0)
                        return original_run(command, *args, **kwargs)
                    def read(path):
                        return published_code[path] if path in published_code else original_read(path)
                    with patch.object(subprocess, "check_output", side_effect=output), \
                            patch.object(subprocess, "run", side_effect=run), \
                            patch.object(Path, "read_bytes", read):
                        errors = (checker._collect_f19a_task4_isolated_qa_control_closed_git(bundle)
                            if phase == "closed" else checker._collect_f19a_task4_isolated_qa_control_git(bundle))
                    expected = scenario != "positive" and not (
                        phase == "A" and scenario not in ("remote", "product_dirty", "later_docs", "stale_a_blob")
                        or phase != "A" and scenario in ("later_docs", "stale_a_blob")
                        or phase == "B" and scenario in ("unrelated_close", "transient_p_to_head"))
                    self.assertEqual(bool(errors), expected, f"{phase}/{scenario}: {errors}")

    @staticmethod
    def task4_postclose_archived_active_bundle():
        publication = "4c0e26dc8e5f078451a1718af3778389ea3eaf4e"
        bundle = deepcopy(checker.load_bundle(ROOT))
        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                cwd=ROOT, stderr=subprocess.DEVNULL)
        bundle["_task4_postclose_active_progress"] = archived("docs/progress/build-progress.json")
        bundle["progress"] = json.loads(bundle["_task4_postclose_active_progress"])
        bundle["_task4_postclose_active_events"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_task4_postclose_active_events"])
        bundle["_task4_postclose_active_handoff"] = archived("docs/progress/BUILD_HANDOFF.md")
        bundle["handoff_text"] = bundle["_task4_postclose_active_handoff"].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["_task4_postclose_active_digest"] = archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        bundle["detached_digest"] = json.loads(bundle["_task4_postclose_active_digest"])
        return bundle

    def test_task4_postclose_active_immutable_publication_and_forgery(self):
        bundle = self.task4_postclose_archived_active_bundle()
        validator = getattr(checker, "_validate_f19a_task4_postclose_fixture", lambda *a, **k: ["route missing"])
        def validate(b):
            observed = datetime.fromisoformat(b["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
            return validator(b, event_raw=b["_task4_postclose_active_events"], now=observed,
                archived_files={"docs/progress/build-progress.json": b["_task4_postclose_active_progress"],
                    "docs/progress/BUILD_HANDOFF.md": b["_task4_postclose_active_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2200].update(actor="forged")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["packages/api/runtime.py"])),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(validate(forged))

    @staticmethod
    def task4_postclose_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_postclose_archived_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_POSTCLOSE_FIXTURE_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_POSTCLOSE_FIXTURE_CONTROL_CLOSE_ONLY"
        relation = "F19A_TASK4_POSTCLOSE_FIXTURE_CONTROL_CHECKPOINTED_CLOSE_READY"
        progress["f19a_task4_postclose_fixture_binding"].update(
            status=status, control_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=relation, worktree_status=relation)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-postclose-fixture-control-checkpoint-seq2201"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        bundle["_task4_postclose_active_progress"] = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        bundle["_task4_postclose_active_handoff"] = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        digest = bundle["detached_digest"]
        for section, key in (("progress", "_task4_postclose_active_progress"),
                             ("handoff", "_task4_postclose_active_handoff")):
            digest[section].update(bytes=len(bundle[key]), file_sha256=hashlib.sha256(bundle[key]).hexdigest().upper())
        bundle["_task4_postclose_active_digest"] = (json.dumps(digest, ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_postclose_checkpoint_projection_and_forgery(self):
        bundle = self.task4_postclose_checkpoint_bundle()
        def validate(b):
            observed = datetime.fromisoformat(b["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task4_postclose_fixture(b,
                event_raw=b["_task4_postclose_active_events"], now=observed,
                archived_files={"docs/progress/build-progress.json": b["_task4_postclose_active_progress"],
                    "docs/progress/BUILD_HANDOFF.md": b["_task4_postclose_active_handoff"]})
        self.assertEqual(validate(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["f19a_task4_postclose_fixture_binding"]["control_checkpoint"] = "0" * 40
        self.assertTrue(validate(forged))
        forged = deepcopy(bundle)
        forged["progress"]["active_work_instruction"]["result_status"] = "FORGED_READY"
        forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
        self.assertTrue(validate(forged))
        forged = deepcopy(bundle)
        forged["progress"]["updated_at"] = "2026-10-07T12:21:32+00:00"
        forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
        self.assertTrue(validate(forged))
        for field, value in (("status", "ACCEPTED"), ("current_work_package", "U-01"),
                             ("reporting_decision", "HOLD")):
            forged = deepcopy(bundle)
            forged["handoff"][field] = value
            forged["_task4_postclose_active_handoff"] = ("```json anvil-recovery-summary\n"
                + json.dumps(forged["handoff"], ensure_ascii=False) + "\n```\n").encode()
            forged["detached_digest"]["handoff"].update(
                bytes=len(forged["_task4_postclose_active_handoff"]),
                file_sha256=hashlib.sha256(forged["_task4_postclose_active_handoff"]).hexdigest().upper())
            self.assertTrue(validate(forged), field)

    @staticmethod
    def task4_postclose_closed_bundle():
        bundle = F19AStartProjectionTests.task4_postclose_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = stream["events"][2199]["details"], stream["events"][2200]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_POSTCLOSE_FIXTURE_VALIDATED_LOCAL_ONLY_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2202, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2203, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_postclose_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_POSTCLOSE_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK4-POSTCLOSE-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2203
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2201_task4_postclose_fixture_write_lease_issued"\n}\n'
        prefix = bundle["_task4_postclose_active_events"].decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2203_task4_postclose_fixture_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2201', '"last_sequence": 2203', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_postclose_fixture_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_postclose_fixture_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_PRODUCT_DUAL_LEASE_PENDING"
        progress["f19a_task4_postclose_fixture_binding"].update(
            status="TASK4_POSTCLOSE_FIXTURE_CLOSED_PRODUCT_DUAL_LEASE_PENDING",
            active_projection_checkpoint="e" * 40, next_safe_action=action, event_sequence=2203)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_PRODUCT_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task4-postclose-fixture-close-seq2203")
        progress["repository"].update(projection_mode="F19A_TASK4_POSTCLOSE_FIXTURE_CLOSED",
            head_relation="F19A_TASK4_POSTCLOSE_FIXTURE_CLOSED_PRODUCT_DUAL_LEASE_PENDING",
            worktree_status="F19A_TASK4_POSTCLOSE_FIXTURE_CLOSED_PRODUCT_DUAL_LEASE_PENDING")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2203, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head="c" * 40,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2203
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle, raw

    @staticmethod
    def validate_task4_postclose_closed(bundle, raw):
        original_output, original_stat, original_sha = subprocess.check_output, Path.stat, checker._sha256
        active = bundle["progress"]["f19a_task4_postclose_fixture_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_task4_postclose_active_progress",
            "docs/progress/progress-events.json": "_task4_postclose_active_events",
            "docs/progress/BUILD_HANDOFF.md": "_task4_postclose_active_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_task4_postclose_active_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(active + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return bundle[values[path]]
            return original_output(command, *args, **kwargs)
        def stat(path, *args, **kwargs):
            if path == ROOT / "docs/progress/build-progress.json":
                return SimpleNamespace(st_size=123)
            if path == ROOT / "docs/progress/BUILD_HANDOFF.md":
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)
        def sha(path):
            if path == ROOT / "docs/progress/build-progress.json":
                return "A" * 64
            if path == ROOT / "docs/progress/BUILD_HANDOFF.md":
                return "B" * 64
            return original_sha(path)
        validator = getattr(checker, "_validate_f19a_task4_postclose_fixture_closed",
            lambda *a, **k: ["route missing"])
        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha):
            observed = datetime.fromisoformat(bundle["events"]["events"][2202]["occurred_at"]) + timedelta(minutes=1)
            return validator(bundle, event_raw=raw, now=observed)

    def test_task4_postclose_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_postclose_closed_bundle()
        self.assertEqual(self.validate_task4_postclose_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"]["completed_f19a_task4_postclose_fixture_write_lease"].update(
                write_fencing_token="forged")),
                ("scope", lambda b: b["progress"]["completed_f19a_task4_postclose_fixture_write_lease"].update(
                    product_write_scope=["packages/api/runtime.py"])),
                ("publication", lambda b: b["progress"]["f19a_task4_postclose_fixture_binding"].update(
                    active_projection_checkpoint="0" * 40)),
                ("handoff", lambda b: b.__setitem__("_task4_postclose_active_handoff", b"forged")),
                ("closed_handoff", lambda b: b["handoff"].update(reporting_decision="HOLD"))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(self.validate_task4_postclose_closed(forged, raw))

    def test_task4_postclose_git_checkpoint_and_closed_rejects_forgery(self):
        base = "e17afb882f6a897688237f6dd8294340b65ab249"
        issued = "4c0e26dc8e5f078451a1718af3778389ea3eaf4e"
        control, active = "c" * 40, "e" * 40
        bundles = (("B", self.task4_postclose_checkpoint_bundle()),
            ("closed", self.task4_postclose_closed_bundle()[0]))
        original_output, original_run, original_read = subprocess.check_output, subprocess.run, Path.read_bytes
        code_paths = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        published_code = {ROOT / path: original_output(["git", "show", f"{issued}:{path}"], cwd=ROOT)
            for path in code_paths}
        scenarios = ("positive", "remote", "product_dirty", "unpublished_a", "unpublished_p",
            "stale_code", "transient_pre_c", "transient_c_to_p", "transient_p_to_head", "merge_between")
        for phase, bundle in bundles:
            for scenario in scenarios:
                with self.subTest(phase=phase, scenario=scenario):
                    head = active if phase == "closed" else control
                    observed_commands = []
                    def output(command, *args, **kwargs):
                        tail = command[5:] if command[:5] == [
                            "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                        observed_commands.append(tail)
                        if tail == ["rev-parse", "HEAD"]:
                            return (head + "\n").encode()
                        if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                            return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                        if tail == ["branch", "--show-current"]:
                            return b"codex/f18-wsl-ops\n"
                        if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                            return b"development/codex/f18-wsl-ops\n"
                        if tail == ["status", "--porcelain=v1", "-uall"]:
                            return b" M packages/api/runtime.py\n" if scenario == "product_dirty" else b""
                        if tail[:2] == ["rev-list", "--min-parents=2"]:
                            return b"deadbeef\n" if scenario == "merge_between" else b""
                        if tail == ["diff", "--name-only", "--no-renames", f"{base}..{control}"]:
                            return b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{control}..HEAD"]:
                            return b"docs/progress/build-progress.json\n" if phase == "closed" else b""
                        if tail == ["diff", "--name-only", "--no-renames", f"{control}..{active}"]:
                            return b"docs/progress/build-progress.json\n"
                        if tail == ["diff", "--name-only", "--no-renames", f"{active}..HEAD"]:
                            return b""
                        if tail in (["log", "--format=", "--name-only", "--no-renames", f"{issued}..{control}"],):
                            return (b"packages/api/runtime.py\n" if scenario == "transient_pre_c" else
                                b"scripts/check_project_progress.py\ntests/tooling/test_f19a_start_projection.py\n")
                        if tail in (["log", "--format=", "--name-only", "--no-renames", f"{control}..HEAD"],
                                    ["log", "--format=", "--name-only", "--no-renames", f"{control}..{active}"]):
                            return (b"packages/api/runtime.py\n" if scenario == "transient_c_to_p" else
                                b"docs/progress/build-progress.json\n")
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{control}..{control}"]:
                            return b""
                        if tail == ["log", "--format=", "--name-only", "--no-renames", f"{active}..{head}"]:
                            return b"packages/api/runtime.py\n" if scenario == "transient_p_to_head" else b""
                        if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(control + ":"):
                            path = ROOT / tail[1].split(":", 1)[1]
                            return b"stale" if scenario == "stale_code" else published_code[path]
                        if tail == ["show", f"{active}:docs/progress/build-progress.json"]:
                            return bundles[1][1]["_task4_postclose_active_progress"]
                        return original_output(command, *args, **kwargs)
                    def run(command, *args, **kwargs):
                        if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                            bad = (scenario == "unpublished_a" and command[-2:] == [issued, control]
                                or scenario == "unpublished_p" and command[-2:] == [control, active])
                            return subprocess.CompletedProcess(command, 1 if bad else 0)
                        return original_run(command, *args, **kwargs)
                    def read(path):
                        return published_code[path] if path in published_code else original_read(path)
                    with patch.object(subprocess, "check_output", side_effect=output), \
                            patch.object(subprocess, "run", side_effect=run), \
                            patch.object(Path, "read_bytes", read):
                        collector = (getattr(checker, "_collect_f19a_task4_postclose_fixture_closed_git",
                            lambda *a: ["route missing"]) if phase == "closed" else
                            checker._collect_f19a_task4_postclose_fixture_git)
                        errors = collector(bundle)
                    expected = scenario != "positive" and not (
                        phase == "B" and scenario in ("unpublished_p", "transient_c_to_p", "transient_p_to_head"))
                    self.assertEqual(bool(errors), expected, f"{phase}/{scenario}: {errors}, commands={observed_commands}")

    def test_task4_postclose_git_bootstrap_uses_immutable_publication(self):
        bundle = self.task4_postclose_archived_active_bundle()
        base = "e17afb882f6a897688237f6dd8294340b65ab249"
        issued = "4c0e26dc8e5f078451a1718af3778389ea3eaf4e"
        paths = ("docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        original_output = subprocess.check_output
        published = {path: original_output(["git", "show", f"{issued}:{path}"], cwd=ROOT) for path in paths}
        for scenario in ("positive", "remote", "product_dirty", "later_docs", "stale_blob",
                         "transient_product", "merge_between"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == [
                        "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "later_docs" else issued) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else
                            "f" * 40 if scenario == "later_docs" else issued) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "product_dirty" else b""
                    if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["rev-list", "--min-parents=2", f"{base}..{issued}"]:
                        return b"deadbeef\n" if scenario == "merge_between" else b""
                    if tail == ["log", "--format=", "--name-only", "--no-renames", f"{base}..{issued}"]:
                        return b"packages/api/runtime.py\n" if scenario == "transient_product" else b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(issued + ":"):
                        return b"stale" if scenario == "stale_blob" else published[tail[1].split(":", 1)[1]]
                    return original_output(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
                    errors = checker._collect_f19a_task4_postclose_fixture_git(bundle)
                self.assertEqual(bool(errors), scenario != "positive", f"{scenario}: {errors}")

    @staticmethod
    def task4_product_qa_archived_active_bundle():
        publication = "4620655145f6d3307206231376d20a65c0b62612"
        bundle = deepcopy(checker.load_bundle(ROOT))
        def archived(path):
            return subprocess.check_output(["git", "show", f"{publication}:{path}"],
                cwd=ROOT, stderr=subprocess.DEVNULL)
        bundle["_task4_qa_active_progress"] = archived("docs/progress/build-progress.json")
        bundle["progress"] = json.loads(bundle["_task4_qa_active_progress"])
        bundle["_task4_qa_active_events"] = archived("docs/progress/progress-events.json")
        bundle["events"] = json.loads(bundle["_task4_qa_active_events"])
        bundle["_task4_qa_active_handoff"] = archived("docs/progress/BUILD_HANDOFF.md")
        bundle["handoff_text"] = bundle["_task4_qa_active_handoff"].decode("utf-8")
        bundle["handoff"] = checker.extract_handoff_summary(bundle["handoff_text"])
        bundle["_task4_qa_active_digest"] = archived(
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        bundle["detached_digest"] = json.loads(bundle["_task4_qa_active_digest"])
        return bundle

    def test_task4_product_qa_active_immutable_publication_and_forgery(self):
        bundle = self.task4_product_qa_archived_active_bundle()
        validator = getattr(checker, "_validate_f19a_task4_product_qa", lambda *a, **k: ["route missing"])
        def validate(b):
            observed = datetime.fromisoformat(b["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
            return validator(b, event_raw=b["_task4_qa_active_events"], now=observed,
                archived_files={"docs/progress/build-progress.json": b["_task4_qa_active_progress"],
                    "docs/progress/BUILD_HANDOFF.md": b["_task4_qa_active_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (
            ("event", lambda b: b["events"]["events"][2205].update(actor="forged")),
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64)),
            ("digest", lambda b: b["detached_digest"].update(algorithm="MD5"))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                change(forged)
                self.assertTrue(validate(forged))

    def test_task4_product_qa_git_bootstrap_immutable_and_negative(self):
        bundle = self.task4_product_qa_archived_active_bundle()
        base = "b2921c67acb40732211bad615ebee7a4e23ed622"
        issued = "4620655145f6d3307206231376d20a65c0b62612"
        paths = ("docs/progress/build-progress.json", "docs/progress/progress-events.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")
        original_output = subprocess.check_output
        published = {path: original_output(["git", "show", f"{issued}:{path}"], cwd=ROOT) for path in paths}
        for scenario in ("positive", "remote", "unrelated_dirty", "later_docs", "stale_blob",
                         "transient_product", "merge_between"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == [
                        "git", "-c", "core.excludesFile=", "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "later_docs" else issued) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else
                            "f" * 40 if scenario == "later_docs" else issued) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "unrelated_dirty" else b""
                    if tail == ["diff", "--name-only", "--no-renames", f"{base}..HEAD"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["rev-list", "--min-parents=2", f"{base}..{issued}"]:
                        return b"deadbeef\n" if scenario == "merge_between" else b""
                    if tail == ["log", "--format=", "--name-only", "--no-renames", f"{base}..{issued}"]:
                        return b"packages/api/runtime.py\n" if scenario == "transient_product" else b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(issued + ":"):
                        return b"stale" if scenario == "stale_blob" else published[tail[1].split(":", 1)[1]]
                    return original_output(command, *args, **kwargs)
                collector = getattr(checker, "_collect_f19a_task4_product_qa_git", lambda *a: ["route missing"])
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
                    errors = collector(bundle)
                self.assertEqual(bool(errors), scenario != "positive", f"{scenario}: {errors}")

    @staticmethod
    def task4_product_qa_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_product_qa_archived_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_PRODUCT_QA_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_PRODUCT_QA_CONTROL_CLOSE_ONLY"
        relation = "F19A_TASK4_PRODUCT_QA_CHECKPOINTED_CLOSE_READY"
        progress["f19a_task4_product_qa_binding"].update(
            status=status, product_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=relation, worktree_status=relation)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-product-qa-checkpoint-seq2206"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        bundle["_task4_qa_active_progress"] = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        bundle["_task4_qa_active_handoff"] = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        digest = bundle["detached_digest"]
        for section, key in (("progress", "_task4_qa_active_progress"), ("handoff", "_task4_qa_active_handoff")):
            digest[section].update(bytes=len(bundle[key]), file_sha256=hashlib.sha256(bundle[key]).hexdigest().upper())
        bundle["_task4_qa_active_digest"] = (json.dumps(digest, ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_product_qa_checkpoint_projection_and_forgery(self):
        bundle = self.task4_product_qa_checkpoint_bundle()
        def validate(b):
            observed = datetime.fromisoformat(b["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task4_product_qa(b, event_raw=b["_task4_qa_active_events"],
                now=observed, archived_files={"docs/progress/build-progress.json": b["_task4_qa_active_progress"],
                    "docs/progress/BUILD_HANDOFF.md": b["_task4_qa_active_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (
            ("checkpoint", lambda b: b["progress"]["f19a_task4_product_qa_binding"].update(
                product_checkpoint="0" * 40)),
            ("instruction", lambda b: b["progress"]["active_work_instruction"].update(result_status="FORGED")),
            ("handoff", lambda b: b["handoff"].update(reporting_decision="HOLD"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_task4_product_qa_checkpoint_git_exact_six_and_negative(self):
        bundle = self.task4_product_qa_checkpoint_bundle()
        base, issued, checkpoint, head = (
            "b2921c67acb40732211bad615ebee7a4e23ed622",
            "4620655145f6d3307206231376d20a65c0b62612", "c" * 40, "f" * 40)
        code = {"scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py",
            "deploy/wsl/f19a_qa_bootstrap.py", "tests/deploy/test_f19a_qa_bootstrap.py",
            "tests/integration/test_f19a_oidc_pg15.py", "tests/browser/f19a-pair-selection.mjs"}
        original_output = subprocess.check_output
        for scenario in ("positive", "remote", "unrelated_dirty", "transient_product",
                         "stale_code", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "unrelated_dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["diff"]:
                        return ("\n".join(sorted(code)) + "\n").encode() if tail[-1] == f"{base}..{checkpoint}" \
                            else b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["log"]:
                        if tail[-1] == f"{issued}..{checkpoint}":
                            return ("\n".join(sorted(code)) + "\n").encode()
                        return b"packages/api/runtime.py\n" if scenario == "transient_product" \
                            else b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["show"] and len(tail) == 2 and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_code" else (ROOT / path).read_bytes()
                    return original_output(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    errors = checker._collect_f19a_task4_product_qa_git(bundle)
                self.assertEqual(bool(errors), scenario != "positive", f"{scenario}: {errors}")

    @staticmethod
    def task4_product_qa_closed_bundle():
        bundle = F19AStartProjectionTests.task4_product_qa_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = stream["events"][2204]["details"], stream["events"][2205]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_PRODUCT_QA_LOCAL_VALIDATED_ISSUER_REVISION_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2207, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2208, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_product_qa_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_PRODUCT_QA_CLOSE",
                "subject_ref": "F-19A/TASK4-PRODUCT-QA", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2208
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2206_task4_product_qa_write_lease_issued"\n}\n'
        prefix = bundle["_task4_qa_active_events"].decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2208_task4_product_qa_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2206', '"last_sequence": 2208', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_product_qa_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_product_qa_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_QA_ISSUER_REVISION_PENDING"
        progress["f19a_task4_product_qa_binding"].update(
            status="TASK4_PRODUCT_QA_CLOSED_ISSUER_REVISION_PENDING", active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2208)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action,
            next_work_package={"package_id": "F-19A", "status": "TASK4_QA_ISSUER_REVISION_PENDING"},
            snapshot_id="snapshot-f19a-task4-product-qa-close-seq2208")
        progress["repository"].update(projection_mode="F19A_TASK4_PRODUCT_QA_CLOSED",
            head_relation="TASK4_PRODUCT_QA_CLOSED_ISSUER_REVISION_PENDING",
            worktree_status="TASK4_PRODUCT_QA_CLOSED_ISSUER_REVISION_PENDING")
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2208, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head="c" * 40,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2208
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle, raw

    @staticmethod
    def validate_task4_product_qa_closed(bundle, raw):
        original_output, original_stat, original_sha = subprocess.check_output, Path.stat, checker._sha256
        active = bundle["progress"]["f19a_task4_product_qa_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_task4_qa_active_progress",
            "docs/progress/progress-events.json": "_task4_qa_active_events",
            "docs/progress/BUILD_HANDOFF.md": "_task4_qa_active_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json": "_task4_qa_active_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(active + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return bundle[values[path]]
            return original_output(command, *args, **kwargs)
        def stat(path, *args, **kwargs):
            if path == ROOT / "docs/progress/build-progress.json":
                return SimpleNamespace(st_size=123)
            if path == ROOT / "docs/progress/BUILD_HANDOFF.md":
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)
        def sha(path):
            if path == ROOT / "docs/progress/build-progress.json":
                return "A" * 64
            if path == ROOT / "docs/progress/BUILD_HANDOFF.md":
                return "B" * 64
            return original_sha(path)
        validator = getattr(checker, "_validate_f19a_task4_product_qa_closed", lambda *a, **k: ["route missing"])
        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha):
            observed = datetime.fromisoformat(bundle["events"]["events"][2207]["occurred_at"]) + timedelta(minutes=1)
            return validator(bundle, event_raw=raw, now=observed)

    def test_task4_product_qa_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_product_qa_closed_bundle()
        self.assertEqual(self.validate_task4_product_qa_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"]["completed_f19a_task4_product_qa_write_lease"].update(
                write_fencing_token="forged")),
                ("scope", lambda b: b["progress"]["completed_f19a_task4_product_qa_write_lease"].update(
                    product_write_scope=[])),
                ("publication", lambda b: b["progress"]["f19a_task4_product_qa_binding"].update(
                    active_projection_checkpoint="0" * 40)),
                ("published_handoff", lambda b: b.__setitem__("_task4_qa_active_handoff", b"forged")),
                ("closed_handoff", lambda b: b["handoff"].update(reporting_decision="HOLD"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_product_qa_closed(forged, raw), name)

    def test_task4_product_qa_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_product_qa_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_PRODUCT_QA_ACTIVE"},
            "f19a_task4_product_qa_binding": {"product_checkpoint": checkpoint}}
        original_output = subprocess.check_output
        for scenario in ("positive", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        interval = tail[-1]
                        if scenario == "transient_product_cp" and interval == f"{checkpoint}..{publication}":
                            return b"packages/api/runtime.py\n"
                        if scenario == "transient_product_close" and interval == f"{publication}..{head}":
                            return b"packages/api/runtime.py\n"
                        return b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["diff"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        if scenario == "stale_publication":
                            return b"{}"
                        return json.dumps(archived).encode()
                    return original_output(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                collector = getattr(checker, "_collect_f19a_task4_product_qa_closed_git",
                    lambda *a: ["route missing"])
                with patch.object(checker, "_collect_f19a_task4_product_qa_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    errors = collector(bundle)
                self.assertEqual(bool(errors), scenario != "positive", f"{scenario}: {errors}")

    @staticmethod
    def task4_issuer_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "8ebfc2882b2bf735b8a67711a581e0900563e4cc")
        bundle["_task4_issuer_archive"] = archive
        return bundle

    def test_task4_issuer_active_publication_and_forgery(self):
        bundle = self.task4_issuer_active_bundle()
        archive = bundle["_task4_issuer_archive"]
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        validator = getattr(checker, "_validate_f19a_task4_qa_issuer", lambda *a, **k: ["route missing"])
        def validate(candidate):
            return validator(candidate, event_raw=raw, now=now,
                archived_files={path.relative_to(ROOT).as_posix(): data for path, data in archive.items()})
        self.assertEqual(validate(bundle), [])
        for name, change in (
            ("worker token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
            ("product scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="forged")),
            ("instruction", lambda b: b["progress"]["active_work_instruction"].update(sha256="0" * 64)),
        ):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(validate(forged), name)

    def test_task4_issuer_bootstrap_git_published_and_negative(self):
        bundle = self.task4_issuer_active_bundle()
        collector = getattr(checker, "_collect_f19a_task4_qa_issuer_git", lambda *a: ["route missing"])
        original = subprocess.check_output
        for scenario in ("published", "remote", "allowed_product_dirty", "unrelated_dirty"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return b"8ebfc2882b2bf735b8a67711a581e0900563e4cc\n"
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote"
                            else "8ebfc2882b2bf735b8a67711a581e0900563e4cc") + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        if scenario == "allowed_product_dirty":
                            return b" M deploy/wsl/oidc_qa_issuer.py\n"
                        if scenario == "unrelated_dirty":
                            return b" M packages/api/runtime.py\n"
                        return b""
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario not in {"published", "allowed_product_dirty"},
                    f"{scenario}: {result}")

    @staticmethod
    def task4_issuer_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_issuer_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_QA_ISSUER_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_QA_ISSUER_CONTROL_CLOSE_ONLY"
        relation = "F19A_TASK4_QA_ISSUER_CHECKPOINTED_CLOSE_READY"
        progress["f19a_task4_qa_issuer_binding"].update(
            status=status, code_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=relation, worktree_status=relation)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-qa-issuer-checkpoint-seq2211"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_task4_issuer_checkpoint_progress"] = raw_progress
        bundle["_task4_issuer_checkpoint_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_task4_issuer_checkpoint_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_issuer_checkpoint_projection_and_forgery(self):
        bundle = self.task4_issuer_checkpoint_bundle()
        def validate(candidate):
            archive = candidate["_task4_issuer_archive"]
            observed = datetime.fromisoformat(candidate["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
            return checker._validate_f19a_task4_qa_issuer(candidate,
                event_raw=archive[ROOT / "docs/progress/progress-events.json"], now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_task4_issuer_checkpoint_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_task4_issuer_checkpoint_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (("checkpoint", lambda b: b["progress"]["f19a_task4_qa_issuer_binding"].update(
                code_checkpoint="0" * 40)),
                ("instruction", lambda b: b["progress"]["active_work_instruction"].update(result_status="FORGED")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    @staticmethod
    def task4_issuer_closed_bundle():
        bundle = F19AStartProjectionTests.task4_issuer_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        archive = bundle["_task4_issuer_archive"]
        active_raw = archive[ROOT / "docs/progress/progress-events.json"]
        worker, write = stream["events"][2209]["details"], stream["events"][2210]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_QA_ISSUER_LOCAL_VALIDATED_WSL_QA_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2212, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2213, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_qa_issuer_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_QA_ISSUER_REVISION_CLOSE",
                "subject_ref": "F-19A/TASK4-QA-ISSUER-REVISION", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2213
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2211_task4_qa_issuer_write_lease_issued"\n}\n'
        prefix = active_raw.decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        text = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2213_task4_qa_issuer_worker_lease_revoked"\n}\n')
        raw = text.replace('"last_sequence": 2211', '"last_sequence": 2213', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_qa_issuer_write_lease"] = {**write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_qa_issuer_worker_lease"] = {**worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_WSL_QA_PENDING"
        status = "TASK4_QA_ISSUER_REVISION_CLOSED_WSL_PENDING"
        progress["f19a_task4_qa_issuer_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2213)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A", "status": "TASK4_WSL_QA_PENDING"},
            snapshot_id="snapshot-f19a-task4-qa-issuer-close-seq2213")
        progress["repository"].update(projection_mode="F19A_TASK4_QA_ISSUER_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2213, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head="c" * 40,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2213
        bundle["detached_digest"]["progress"].update(bytes=123, file_sha256="A" * 64)
        bundle["detached_digest"]["handoff"].update(bytes=456, file_sha256="B" * 64)
        return bundle, raw

    @staticmethod
    def validate_task4_issuer_closed(bundle, raw):
        original_output, original_stat, original_sha = subprocess.check_output, Path.stat, checker._sha256
        active = bundle["progress"]["f19a_task4_qa_issuer_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_task4_issuer_checkpoint_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_task4_issuer_checkpoint_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json": "_task4_issuer_checkpoint_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(active + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_task4_issuer_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original_output(command, *args, **kwargs)
        def stat(path, *args, **kwargs):
            if path == ROOT / "docs/progress/build-progress.json":
                return SimpleNamespace(st_size=123)
            if path == ROOT / "docs/progress/BUILD_HANDOFF.md":
                return SimpleNamespace(st_size=456)
            return original_stat(path, *args, **kwargs)
        def sha(path):
            if path == ROOT / "docs/progress/build-progress.json":
                return "A" * 64
            if path == ROOT / "docs/progress/BUILD_HANDOFF.md":
                return "B" * 64
            return original_sha(path)
        validator = getattr(checker, "_validate_f19a_task4_qa_issuer_closed", lambda *a, **k: ["route missing"])
        with patch.object(subprocess, "check_output", side_effect=output), \
                patch.object(Path, "stat", stat), patch.object(checker, "_sha256", side_effect=sha):
            observed = datetime.fromisoformat(bundle["events"]["events"][2212]["occurred_at"]) + timedelta(minutes=1)
            return validator(bundle, event_raw=raw, now=observed)

    def test_task4_issuer_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_issuer_closed_bundle()
        self.assertEqual(self.validate_task4_issuer_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"]["completed_f19a_task4_qa_issuer_write_lease"].update(
                write_fencing_token="forged")),
                ("scope", lambda b: b["progress"]["completed_f19a_task4_qa_issuer_write_lease"].update(
                    product_write_scope=[])),
                ("publication", lambda b: b["progress"]["f19a_task4_qa_issuer_binding"].update(
                    active_projection_checkpoint="0" * 40)),
                ("published digest", lambda b: b.__setitem__("_task4_issuer_checkpoint_digest", b"{}")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_issuer_closed(forged, raw), name)

    def test_task4_issuer_checkpoint_git_exact_five_and_negative(self):
        bundle = self.task4_issuer_checkpoint_bundle()
        checkpoint = "c" * 40
        exact = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py",
            "deploy/wsl/oidc_qa_issuer.py", "deploy/wsl/compose.f18.oidc.yml",
            "tests/deploy/test_f18_oidc_qa_issuer.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "stale_blob", "missing_product",
                         "transient_product", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else checkpoint) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M deploy/wsl/oidc_qa_issuer.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == f"8ebfc2882b2bf735b8a67711a581e0900563e4cc..{checkpoint}":
                        return ("\n".join(exact) + "\n" + ("packages/api/runtime.py\n"
                            if scenario == "transient_product" else "")).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == f"8ebfc2882b2bf735b8a67711a581e0900563e4cc..{checkpoint}":
                        return ("\n".join(exact[:2] if scenario == "missing_product" else exact) + "\n").encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..HEAD":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = checker._collect_f19a_task4_qa_issuer_git(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_issuer_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_issuer_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_QA_ISSUER_ACTIVE"},
            "f19a_task4_qa_issuer_binding": {"code_checkpoint": checkpoint}}
        original = subprocess.check_output
        collector = getattr(checker, "_collect_f19a_task4_qa_issuer_closed_git", lambda *a: ["route missing"])
        for scenario in ("published", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        interval = tail[-1]
                        if scenario == "transient_product_cp" and interval == f"{checkpoint}..{publication}":
                            return b"deploy/wsl/oidc_qa_issuer.py\n"
                        if scenario == "transient_product_close" and interval == f"{publication}..{head}":
                            return b"deploy/wsl/oidc_qa_issuer.py\n"
                        return b"docs/progress/build-progress.json\n"
                    if tail[:1] == ["diff"]:
                        return b"docs/progress/build-progress.json\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return b"{}" if scenario == "stale_publication" else json.dumps(archived).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                with patch.object(checker, "_collect_f19a_task4_qa_issuer_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_post_qa_report_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "53f1b1c0f5739cb3070858e57c0b7bc48b98fe8e")
        bundle["_post_qa_archive"] = archive
        return bundle

    def test_task4_post_qa_report_active_publication_and_forgery(self):
        bundle = self.task4_post_qa_report_active_bundle()
        archive = bundle["_post_qa_archive"]
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        validator = getattr(checker, "_validate_f19a_task4_post_qa_report_control",
            lambda *a, **k: ["route missing"])
        def validate(candidate):
            return validator(candidate, event_raw=raw, now=observed,
                archived_files={path.relative_to(ROOT).as_posix(): data for path, data in archive.items()})
        self.assertEqual(validate(bundle), [])
        for name, change in (("report_sha", lambda b: b["progress"]["f19a_task4_post_qa_report_control_binding"].update(
                report_sha256="0" * 64)),
                ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="forged")),
                ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["x"])),
                ("event", lambda b: b["events"]["events"][2213].update(event_type="FORGED")),
                ("handoff", lambda b: b["handoff"].update(next_safe_action="FORGED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(validate(forged), name)

    def test_task4_post_qa_report_git_publication_and_negative(self):
        bundle = self.task4_post_qa_report_active_bundle()
        collector = checker._collect_f19a_task4_post_qa_report_control_git
        original = checker.subprocess.check_output
        issued = "53f1b1c0f5739cb3070858e57c0b7bc48b98fe8e"
        for scenario in ("published", "remote", "dirty", "report_blob", "other_report", "merge"):
            def output(command, *args, **kwargs):
                tail = command[5:] if command[:2] == ["git", "-c"] else command[1:]
                if scenario == "remote" and tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                    return b"0" * 40 + b"\n"
                if scenario == "dirty" and tail[:2] == ["status", "--porcelain=v1"]:
                    return b"?? packages/api/unrelated.py\n"
                if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                    return (issued + "\n").encode()
                if tail == ["status", "--porcelain=v1", "-uall"]:
                    return b""
                if tail == ["rev-parse", "HEAD:docs/04_test_reports/F-19A_TASK4_WSL_QA_REPORT.md"]:
                    return b"103aaa7c4ebececa02caaa3341696a87230bc312\n"
                if scenario == "report_blob" and tail == ["rev-parse",
                        "1b6629fa9150eb48d9ed6ebe66a4c6e33b6db8ec:docs/04_test_reports/F-19A_TASK4_WSL_QA_REPORT.md"]:
                    return b"0" * 40 + b"\n"
                if scenario == "other_report" and tail[:2] == ["log", "--format="]:
                    return original(command, *args, **kwargs) + b"docs/04_test_reports/OTHER.md\n"
                if scenario == "merge" and tail[:2] == ["rev-list", "--min-parents=2"]:
                    return b"0" * 40 + b"\n"
                return original(command, *args, **kwargs)
            with self.subTest(scenario=scenario), patch.object(checker.subprocess, "check_output", side_effect=output):
                result = collector(bundle)
            self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_post_qa_report_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_post_qa_report_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_POST_QA_REPORT_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_POST_QA_REPORT_CONTROL_CLOSE_ONLY"
        progress["f19a_task4_post_qa_report_control_binding"].update(
            status=status, control_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-post-qa-report-control-checkpoint-seq2216"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_post_qa_checkpoint_progress"] = raw_progress
        bundle["_post_qa_checkpoint_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_post_qa_checkpoint_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_post_qa_report_checkpoint_projection_and_forgery(self):
        bundle = self.task4_post_qa_report_checkpoint_bundle()
        archive = bundle["_post_qa_archive"]
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_task4_post_qa_report_control(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_post_qa_checkpoint_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_post_qa_checkpoint_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (("checkpoint", lambda b: b["progress"][
                "f19a_task4_post_qa_report_control_binding"].update(control_checkpoint="0" * 40)),
                ("instruction", lambda b: b["progress"]["active_work_instruction"].update(result_status="FORGED")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_task4_post_qa_report_checkpoint_git_exact_two_and_negative(self):
        bundle = self.task4_post_qa_report_checkpoint_bundle()
        checkpoint = "c" * 40
        exact = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        collector = checker._collect_f19a_task4_post_qa_report_control_git
        for scenario in ("published", "remote", "dirty", "stale_blob", "missing_control",
                         "transient_product", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else checkpoint) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == (
                            "53f1b1c0f5739cb3070858e57c0b7bc48b98fe8e.." + checkpoint):
                        return ("\n".join(exact) + "\n" + ("packages/api/runtime.py\n"
                            if scenario == "transient_product" else "")).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == (
                            "53f1b1c0f5739cb3070858e57c0b7bc48b98fe8e.." + checkpoint):
                        return ("\n".join(exact[:1] if scenario == "missing_control" else exact) + "\n").encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..HEAD":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_post_qa_report_closed_bundle():
        bundle = F19AStartProjectionTests.task4_post_qa_report_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_post_qa_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = stream["events"][2214]["details"], stream["events"][2215]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_POST_QA_REPORT_CONTROL_COMPLETE_PRODUCT_REWORK_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2217, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2218, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_post_qa_report_control_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_POST_QA_REPORT_CONTROL_CLOSE",
                "subject_ref": "F-19A/TASK4-POST-QA-REPORT-CONTROL", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2218
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = ('\n  ],\n  "last_event_id": '
            '"evt_f19a_2216_task4_post_qa_report_control_write_lease_issued"\n}\n')
        prefix = active_raw.decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": '
            '"evt_f19a_2218_task4_post_qa_report_control_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2216', '"last_sequence": 2218', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_post_qa_report_control_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_post_qa_report_control_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_PRODUCT_REWORK_DUAL_LEASE_PENDING"
        status = "TASK4_POST_QA_REPORT_CONTROL_CLOSED_PRODUCT_REWORK_PENDING"
        progress["f19a_task4_post_qa_report_control_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2218)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_PRODUCT_REWORK_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task4-post-qa-report-control-close-seq2218")
        progress["repository"].update(projection_mode="F19A_TASK4_POST_QA_REPORT_CONTROL_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2218, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2218
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_post_qa_report_closed(bundle, raw):
        original_output = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_post_qa_report_control_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_post_qa_checkpoint_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_post_qa_checkpoint_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_post_qa_checkpoint_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_post_qa_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original_output(command, *args, **kwargs)
        validator = getattr(checker, "_validate_f19a_task4_post_qa_report_control_closed",
            lambda *a, **k: ["route missing"])
        observed = datetime.fromisoformat(bundle["events"]["events"][2217]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_post_qa_report_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_post_qa_report_closed_bundle()
        self.assertEqual(self.validate_task4_post_qa_report_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"][
                "completed_f19a_task4_post_qa_report_control_write_lease"].update(write_fencing_token="forged")),
                ("scope", lambda b: b["progress"][
                    "completed_f19a_task4_post_qa_report_control_write_lease"].update(product_write_scope=["x"])),
                ("publication", lambda b: b["progress"][
                    "f19a_task4_post_qa_report_control_binding"].update(active_projection_checkpoint="0" * 40)),
                ("published_digest", lambda b: b.__setitem__("_post_qa_checkpoint_digest", b"{}")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_post_qa_report_closed(forged, raw), name)

    def test_task4_post_qa_report_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_post_qa_report_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_POST_QA_REPORT_CONTROL_ACTIVE"},
            "f19a_task4_post_qa_report_control_binding": {"control_checkpoint": checkpoint}}
        original = subprocess.check_output
        collector = checker._collect_f19a_task4_post_qa_report_control_closed_git
        for scenario in ("published", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        return (b"packages/api/runtime.py\n" if (scenario == "transient_product_cp"
                            and tail[-1] == f"{checkpoint}..{publication}") or (scenario == "transient_product_close"
                            and tail[-1] == f"{publication}..{head}") else b"docs/WORK_STATUS.md\n")
                    if tail[:1] == ["diff"]:
                        return b"docs/WORK_STATUS.md\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return b"{}" if scenario == "stale_publication" else json.dumps(archived).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                with patch.object(checker, "_collect_f19a_task4_post_qa_report_control_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_runtime_head_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "1464838ba22f33e6a421ec46fcd065209bba73eb")
        bundle["_runtime_head_archive"] = archive
        return bundle

    def test_task4_runtime_head_active_binds_frozen_publication_and_forgery(self):
        bundle = self.task4_runtime_head_active_bundle()
        archive = bundle["_runtime_head_archive"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        validator = getattr(checker, "_validate_f19a_task4_runtime_head_compat", lambda *a, **k: ["route missing"])
        def validate(candidate):
            return validator(candidate,
                event_raw=archive[ROOT / "docs/progress/progress-events.json"], now=observed,
                archived_files={path.relative_to(ROOT).as_posix(): data for path, data in archive.items()})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                result_status="FORGED")),
                ("worker_token", lambda b: b["progress"]["worker_lease"].update(fencing_token="FORGED")),
                ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
                ("event_envelope", lambda b: b["events"]["events"][2218].update(actor="FORGED")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED")),
                ("digest", lambda b: b["detached_digest"].update(algorithm="MD5"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    @staticmethod
    def task4_runtime_head_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_runtime_head_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_RUNTIME_HEAD_COMPAT_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_RUNTIME_HEAD_COMPAT_CLOSE_ONLY"
        progress["f19a_task4_runtime_head_compat_binding"].update(
            status=status, code_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-runtime-head-compat-checkpoint-seq2221"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_runtime_checkpoint_progress"] = raw_progress
        bundle["_runtime_checkpoint_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_runtime_checkpoint_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_runtime_head_checkpoint_projection_and_forgery(self):
        bundle = self.task4_runtime_head_checkpoint_bundle()
        archive = bundle["_runtime_head_archive"]
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_task4_runtime_head_compat(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_runtime_checkpoint_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_runtime_checkpoint_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                package_status="FORGED")),
                ("handoff", lambda b: b["handoff"].update(next_safe_action="FORGED")),
                ("binding", lambda b: b["progress"]["f19a_task4_runtime_head_compat_binding"].update(
                    work_instruction_sha256="0" * 64))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    @staticmethod
    def task4_runtime_head_closed_bundle():
        bundle = F19AStartProjectionTests.task4_runtime_head_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_runtime_head_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_RUNTIME_HEAD_COMPAT_COMPLETE_QA_FIXTURE_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2222, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2223, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_runtime_head_compat_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_RUNTIME_HEAD_COMPAT_CLOSE",
                "subject_ref": "F-19A/TASK4-RUNTIME-HEAD-COMPAT", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2223
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = active_raw.decode("utf-8")
        # Preserve the published 1..2221 event objects byte-for-byte.
        suffix = '\n  ],\n  "last_event_id": "' + json.loads(active_raw)["last_event_id"] + '"\n}\n'
        assert prefix.endswith(suffix)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(suffix)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "' + stream["last_event_id"] + '"\n}\n')
        raw = raw.replace('"last_sequence": 2221', '"last_sequence": 2223', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_runtime_head_compat_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_runtime_head_compat_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_QA_FIXTURE_DUAL_LEASE_PENDING"
        status = "TASK4_RUNTIME_HEAD_COMPAT_CLOSED_QA_FIXTURE_PENDING"
        progress["f19a_task4_runtime_head_compat_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2223)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_QA_FIXTURE_DUAL_LEASE_PENDING"},
            snapshot_id="snapshot-f19a-task4-runtime-head-compat-close-seq2223")
        progress["repository"].update(projection_mode="F19A_TASK4_RUNTIME_HEAD_COMPAT_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2223, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2223
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_runtime_head_closed(bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_runtime_head_compat_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_runtime_checkpoint_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_runtime_checkpoint_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_runtime_checkpoint_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_runtime_head_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original(command, *args, **kwargs)
        observed = datetime.fromisoformat(bundle["events"]["events"][2222]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return checker._validate_f19a_task4_runtime_head_compat_closed(bundle,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_runtime_head_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_runtime_head_closed_bundle()
        self.assertEqual(self.validate_task4_runtime_head_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"][
                "completed_f19a_task4_runtime_head_compat_write_lease"].update(write_fencing_token="forged")),
                ("publication", lambda b: b["progress"][
                    "f19a_task4_runtime_head_compat_binding"].update(active_projection_checkpoint="0" * 40)),
                ("published_digest", lambda b: b.__setitem__("_runtime_checkpoint_digest", b"{}")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_runtime_head_closed(forged, raw), name)

    def test_task4_runtime_head_bootstrap_git_published_and_negative(self):
        bundle = self.task4_runtime_head_active_bundle()
        original = subprocess.check_output
        collector = checker._collect_f19a_task4_runtime_head_compat_git
        issued = "1464838ba22f33e6a421ec46fcd065209bba73eb"
        for scenario in ("published", "remote", "dirty", "descendant", "merge", "transient_product"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "descendant" else issued) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else issued) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and scenario == "transient_product":
                        return b"packages/api/runtime.py\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_runtime_head_checkpoint_git_exact_six_and_negative(self):
        bundle = self.task4_runtime_head_checkpoint_bundle()
        issued, checkpoint = "1464838ba22f33e6a421ec46fcd065209bba73eb", "c" * 40
        exact = tuple(bundle["progress"]["f19a_task4_runtime_head_compat_binding"]["developer_exact_paths"])
        original, original_run = subprocess.check_output, subprocess.run
        collector = checker._collect_f19a_task4_runtime_head_compat_git
        for scenario in ("published", "remote", "dirty", "stale_blob", "missing_product",
                         "transient_other", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else checkpoint) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact) + "\n" + ("packages/api/runtime.py\n"
                            if scenario == "transient_other" else "")).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact[:-1] if scenario == "missing_product" else exact) + "\n").encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_runtime_head_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_runtime_head_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_RUNTIME_HEAD_COMPAT_ACTIVE"},
            "f19a_task4_runtime_head_compat_binding": {"code_checkpoint": checkpoint}}
        original = subprocess.check_output
        collector = checker._collect_f19a_task4_runtime_head_compat_closed_git
        for scenario in ("published", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        return (b"packages/api/runtime.py\n" if (scenario == "transient_product_cp"
                            and tail[-1] == f"{checkpoint}..{publication}") or (scenario == "transient_product_close"
                            and tail[-1] == f"{publication}..{head}") else b"docs/WORK_STATUS.md\n")
                    if tail[:1] == ["diff"]:
                        return b"docs/WORK_STATUS.md\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return b"{}" if scenario == "stale_publication" else json.dumps(archived).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                with patch.object(checker, "_collect_f19a_task4_runtime_head_compat_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_runtime_head_legacy_git_entrypoint_dispatches_exact_mode(self):
        active = self.task4_runtime_head_active_bundle()
        closed, _ = self.task4_runtime_head_closed_bundle()
        for bundle, collector_name in ((active, "_collect_f19a_task4_runtime_head_compat_git"),
                                       (closed, "_collect_f19a_task4_runtime_head_compat_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector_name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector_name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    @staticmethod
    def task4_third_actor_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "86ca7cd6e24e36483d3341c9632470645f90b6df")
        bundle["_third_actor_archive"] = archive
        return bundle

    def test_task4_third_actor_active_binds_publication_and_forgery(self):
        bundle = self.task4_third_actor_active_bundle()
        archive = bundle["_third_actor_archive"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        validator = getattr(checker, "_validate_f19a_task4_third_actor_qa_fixture",
            lambda *a, **k: ["route missing"])
        def validate(candidate):
            return validator(candidate,
                event_raw=archive[ROOT / "docs/progress/progress-events.json"], now=observed,
                archived_files={path.relative_to(ROOT).as_posix(): data for path, data in archive.items()})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                result_status="FORGED")),
                ("lease", lambda b: b["progress"]["write_lease"].update(write_fencing_token="FORGED")),
                ("product_scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=[])),
                ("event_envelope", lambda b: b["events"]["events"][2223].update(actor="FORGED")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED")),
                ("digest", lambda b: b["detached_digest"].update(algorithm="MD5"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    @staticmethod
    def task4_third_actor_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_third_actor_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_THIRD_ACTOR_QA_FIXTURE_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_THIRD_ACTOR_QA_FIXTURE_CLOSE_ONLY"
        progress["f19a_task4_third_actor_qa_fixture_binding"].update(
            status=status, code_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-third-actor-qa-fixture-checkpoint-seq2226"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_third_actor_checkpoint_progress"] = raw_progress
        bundle["_third_actor_checkpoint_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_third_actor_checkpoint_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_third_actor_checkpoint_projection_and_forgery(self):
        bundle = self.task4_third_actor_checkpoint_bundle()
        raw = bundle["_third_actor_archive"][ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_task4_third_actor_qa_fixture(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_third_actor_checkpoint_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_third_actor_checkpoint_handoff"]})
        self.assertEqual(validate(bundle), [])
        forged = deepcopy(bundle)
        forged["progress"]["f19a_task4_third_actor_qa_fixture_binding"]["code_checkpoint"] = "0" * 40
        forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
        self.assertTrue(validate(forged))

    @staticmethod
    def task4_third_actor_closed_bundle():
        bundle = F19AStartProjectionTests.task4_third_actor_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_third_actor_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_THIRD_ACTOR_QA_FIXTURE_COMPLETE_WSL_QA_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2227, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2228, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_third_actor_qa_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_THIRD_ACTOR_QA_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK4-THIRD-ACTOR-QA-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2228
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = active_raw.decode("utf-8")
        suffix = '\n  ],\n  "last_event_id": "' + json.loads(active_raw)["last_event_id"] + '"\n}\n'
        assert prefix.endswith(suffix)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(suffix)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "' + stream["last_event_id"] + '"\n}\n')
        raw = raw.replace('"last_sequence": 2226', '"last_sequence": 2228', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_third_actor_qa_fixture_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_third_actor_qa_fixture_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_WSL_QA_PENDING"
        status = "TASK4_THIRD_ACTOR_QA_FIXTURE_CLOSED_WSL_QA_PENDING"
        progress["f19a_task4_third_actor_qa_fixture_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2228)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_WSL_QA_PENDING"},
            snapshot_id="snapshot-f19a-task4-third-actor-qa-fixture-close-seq2228")
        progress["repository"].update(projection_mode="F19A_TASK4_THIRD_ACTOR_QA_FIXTURE_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2228, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2228
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_third_actor_closed(bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_third_actor_qa_fixture_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_third_actor_checkpoint_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_third_actor_checkpoint_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_third_actor_checkpoint_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_third_actor_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original(command, *args, **kwargs)
        observed = datetime.fromisoformat(bundle["events"]["events"][2227]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return checker._validate_f19a_task4_third_actor_qa_fixture_closed(bundle,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_third_actor_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_third_actor_closed_bundle()
        self.assertEqual(self.validate_task4_third_actor_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"][
                "completed_f19a_task4_third_actor_qa_fixture_write_lease"].update(write_fencing_token="forged")),
                ("publication", lambda b: b["progress"][
                    "f19a_task4_third_actor_qa_fixture_binding"].update(active_projection_checkpoint="0" * 40)),
                ("published_digest", lambda b: b.__setitem__("_third_actor_checkpoint_digest", b"{}")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_third_actor_closed(forged, raw), name)

    def test_task4_third_actor_bootstrap_git_published_and_negative(self):
        bundle = self.task4_third_actor_active_bundle()
        original = subprocess.check_output
        collector = checker._collect_f19a_task4_third_actor_qa_fixture_git
        issued = "86ca7cd6e24e36483d3341c9632470645f90b6df"
        for scenario in ("published", "remote", "dirty", "descendant", "merge", "transient_product"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "descendant" else issued) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else issued) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and scenario == "transient_product":
                        return b"packages/api/runtime.py\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_third_actor_checkpoint_git_exact_eight_and_negative(self):
        bundle = self.task4_third_actor_checkpoint_bundle()
        issued, checkpoint = "86ca7cd6e24e36483d3341c9632470645f90b6df", "c" * 40
        exact = tuple(bundle["progress"]["f19a_task4_third_actor_qa_fixture_binding"]["developer_exact_paths"])
        original, original_run = subprocess.check_output, subprocess.run
        collector = checker._collect_f19a_task4_third_actor_qa_fixture_git
        for scenario in ("published", "remote", "dirty", "stale_blob", "missing_product",
                         "transient_other", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else checkpoint) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact) + "\n" + ("packages/api/runtime.py\n"
                            if scenario == "transient_other" else "")).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact[:-1] if scenario == "missing_product" else exact) + "\n").encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_third_actor_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_third_actor_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_THIRD_ACTOR_QA_FIXTURE_ACTIVE"},
            "f19a_task4_third_actor_qa_fixture_binding": {"code_checkpoint": checkpoint}}
        original = subprocess.check_output
        collector = getattr(checker, "_collect_f19a_task4_third_actor_qa_fixture_closed_git",
            lambda *a: ["route missing"])
        for scenario in ("published", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        return (b"packages/api/runtime.py\n" if (scenario == "transient_product_cp"
                            and tail[-1] == f"{checkpoint}..{publication}") or (scenario == "transient_product_close"
                            and tail[-1] == f"{publication}..{head}") else b"docs/WORK_STATUS.md\n")
                    if tail[:1] == ["diff"]:
                        return b"docs/WORK_STATUS.md\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return b"{}" if scenario == "stale_publication" else json.dumps(archived).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                with patch.object(checker, "_collect_f19a_task4_third_actor_qa_fixture_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_third_actor_legacy_git_entrypoint_dispatches_exact_mode(self):
        active = self.task4_third_actor_active_bundle()
        closed, _ = self.task4_third_actor_closed_bundle()
        for bundle, collector_name in ((active, "_collect_f19a_task4_third_actor_qa_fixture_git"),
                                       (closed, "_collect_f19a_task4_third_actor_qa_fixture_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector_name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector_name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    @staticmethod
    def task4_epoch72_clock_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "b2397061d4c309f64af5cda92b908f02e84df6fb")
        bundle["_epoch89_archive"] = archive
        return bundle

    def test_task4_epoch72_clock_active_binds_publication_and_forgery(self):
        bundle = self.task4_epoch72_clock_active_bundle()
        archive = bundle["_epoch89_archive"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        validator = getattr(checker, "_validate_f19a_task4_epoch72_clock_fixture",
            lambda *a, **k: ["route missing"])
        def validate(candidate):
            return validator(candidate,
                event_raw=archive[ROOT / "docs/progress/progress-events.json"], now=observed,
                archived_files={path.relative_to(ROOT).as_posix(): data for path, data in archive.items()})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                result_status="FORGED")),
                ("lease", lambda b: b["progress"]["write_lease"].update(write_fencing_token="FORGED")),
                ("product_scope", lambda b: b["progress"]["write_lease"].update(
                    product_write_scope=["packages/api/fastapi_app.py"])),
                ("event_envelope", lambda b: b["events"]["events"][2228].update(actor="FORGED")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED")),
                ("digest", lambda b: b["detached_digest"].update(algorithm="MD5"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_task4_epoch72_clock_archived_active_expiry_and_closed_publication(self):
        bundle, archive = self.historical_bundle("1119ab82ecd5519a54c337a81b45e900a444ee16")
        self.assertEqual(bundle["progress"]["event_sequence"], 2231)
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        files = {path.relative_to(ROOT).as_posix(): data for path, data in archive.items()}
        self.assertEqual(checker._validate_f19a_task4_epoch72_clock_fixture(bundle,
            event_raw=archive[ROOT / "docs/progress/progress-events.json"], now=observed,
            archived_files=files), [])
        expired = deepcopy(bundle)
        expired["progress"]["worker_lease"]["expires_at"] = "2026-10-07T21:07:37+00:00"
        expired["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(expired["progress"])
        self.assertIn("F19A_TASK4_EPOCH72_CLOCK_LEASE_INVALID",
            checker._validate_f19a_task4_epoch72_clock_fixture(expired,
                event_raw=archive[ROOT / "docs/progress/progress-events.json"],
                now=datetime.fromisoformat("2026-10-07T21:07:37+00:00"), archived_files=files))
        closed, closed_archive = self.historical_bundle("5605c86e42b2eb0fdc12234a846adebef56114c3")
        self.assertEqual(closed["progress"]["event_sequence"], 2233)
        self.assertEqual(checker._validate_f19a_task4_epoch72_clock_fixture_closed(closed,
            event_raw=closed_archive[ROOT / "docs/progress/progress-events.json"],
            archived_files={path.relative_to(ROOT).as_posix(): data
                for path, data in closed_archive.items()}), [])

    @staticmethod
    def task4_epoch72_clock_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_epoch72_clock_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_EPOCH72_CLOCK_FIXTURE_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_EPOCH72_CLOCK_FIXTURE_CLOSE_ONLY"
        progress["f19a_task4_epoch72_clock_fixture_binding"].update(
            status=status, code_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-epoch72-clock-fixture-checkpoint-seq2231"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_epoch89_checkpoint_progress"] = raw_progress
        bundle["_epoch89_checkpoint_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_epoch89_checkpoint_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_epoch72_clock_checkpoint_projection_and_forgery(self):
        bundle = self.task4_epoch72_clock_checkpoint_bundle()
        raw = bundle["_epoch89_archive"][ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_task4_epoch72_clock_fixture(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_epoch89_checkpoint_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_epoch89_checkpoint_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                package_status="FORGED")),
                ("handoff", lambda b: b["handoff"].update(next_safe_action="FORGED")),
                ("binding", lambda b: b["progress"]["f19a_task4_epoch72_clock_fixture_binding"].update(
                    work_instruction_sha256="0" * 64))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    @staticmethod
    def task4_epoch72_clock_closed_bundle():
        bundle = F19AStartProjectionTests.task4_epoch72_clock_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_epoch89_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_EPOCH72_CLOCK_FIXTURE_COMPLETE_WSL_QA_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2232, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2233, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_epoch72_clock_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_EPOCH72_CLOCK_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK4-EPOCH72-CLOCK-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2233
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = active_raw.decode("utf-8")
        suffix = '\n  ],\n  "last_event_id": "' + json.loads(active_raw)["last_event_id"] + '"\n}\n'
        assert prefix.endswith(suffix)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(suffix)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "' + stream["last_event_id"] + '"\n}\n')
        raw = raw.replace('"last_sequence": 2231', '"last_sequence": 2233', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_epoch72_clock_fixture_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_epoch72_clock_fixture_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_WSL_QA_PENDING"
        status = "TASK4_EPOCH72_CLOCK_FIXTURE_CLOSED_WSL_QA_PENDING"
        progress["f19a_task4_epoch72_clock_fixture_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2233)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_WSL_QA_PENDING"},
            snapshot_id="snapshot-f19a-task4-epoch72-clock-fixture-close-seq2233")
        progress["repository"].update(projection_mode="F19A_TASK4_EPOCH72_CLOCK_FIXTURE_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2233, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2233
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_epoch72_clock_closed(bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_epoch72_clock_fixture_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_epoch89_checkpoint_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_epoch89_checkpoint_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_epoch89_checkpoint_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_epoch89_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original(command, *args, **kwargs)
        observed = datetime.fromisoformat(bundle["events"]["events"][2232]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return checker._validate_f19a_task4_epoch72_clock_fixture_closed(bundle,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_epoch72_clock_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_epoch72_clock_closed_bundle()
        self.assertEqual(self.validate_task4_epoch72_clock_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"][
                "completed_f19a_task4_epoch72_clock_fixture_write_lease"].update(write_fencing_token="forged")),
                ("publication", lambda b: b["progress"][
                    "f19a_task4_epoch72_clock_fixture_binding"].update(active_projection_checkpoint="0" * 40)),
                ("published_digest", lambda b: b.__setitem__("_epoch89_checkpoint_digest", b"{}")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_epoch72_clock_closed(forged, raw), name)

    def test_task4_epoch72_clock_bootstrap_git_published_and_negative(self):
        bundle = self.task4_epoch72_clock_active_bundle()
        original = subprocess.check_output
        collector = checker._collect_f19a_task4_epoch72_clock_fixture_git
        issued = "b2397061d4c309f64af5cda92b908f02e84df6fb"
        for scenario in ("published", "remote", "dirty", "descendant", "merge", "transient_product"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "descendant" else issued) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else issued) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and scenario == "transient_product":
                        return b"packages/api/runtime.py\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_epoch72_clock_checkpoint_git_exact_two_and_negative(self):
        bundle = self.task4_epoch72_clock_checkpoint_bundle()
        issued, checkpoint = "b2397061d4c309f64af5cda92b908f02e84df6fb", "c" * 40
        exact = tuple(bundle["progress"]["f19a_task4_epoch72_clock_fixture_binding"]["developer_exact_paths"])
        original, original_run = subprocess.check_output, subprocess.run
        collector = checker._collect_f19a_task4_epoch72_clock_fixture_git
        for scenario in ("published", "remote", "dirty", "stale_blob", "missing_control",
                         "transient_other", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else checkpoint) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact) + "\n" + ("packages/api/runtime.py\n"
                            if scenario == "transient_other" else "")).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact[:-1] if scenario == "missing_control" else exact) + "\n").encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_epoch72_clock_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_epoch72_clock_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_EPOCH72_CLOCK_FIXTURE_ACTIVE"},
            "f19a_task4_epoch72_clock_fixture_binding": {"code_checkpoint": checkpoint}}
        original = subprocess.check_output
        collector = getattr(checker, "_collect_f19a_task4_epoch72_clock_fixture_closed_git",
            lambda *a: ["route missing"])
        for scenario in ("published", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        return (b"packages/api/runtime.py\n" if (scenario == "transient_product_cp"
                            and tail[-1] == f"{checkpoint}..{publication}") or (scenario == "transient_product_close"
                            and tail[-1] == f"{publication}..{head}") else b"docs/WORK_STATUS.md\n")
                    if tail[:1] == ["diff"]:
                        return b"docs/WORK_STATUS.md\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return b"{}" if scenario == "stale_publication" else json.dumps(archived).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                with patch.object(checker, "_collect_f19a_task4_epoch72_clock_fixture_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_epoch72_clock_legacy_git_entrypoint_dispatches_exact_mode(self):
        active = self.task4_epoch72_clock_active_bundle()
        closed, _ = self.task4_epoch72_clock_closed_bundle()
        for bundle, collector_name in ((active, "_collect_f19a_task4_epoch72_clock_fixture_git"),
                                       (closed, "_collect_f19a_task4_epoch72_clock_fixture_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector_name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector_name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    @staticmethod
    def task4_epoch89_postclose_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "af80c46ceb8946cc8561055272d06f1a55fb0206")
        bundle["_epoch90_archive"] = archive
        return bundle

    def test_task4_epoch89_postclose_active_binds_frozen_publication_and_lease(self):
        bundle = self.task4_epoch89_postclose_active_bundle()
        archive = bundle["_epoch90_archive"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        validator = getattr(checker, "_validate_f19a_task4_epoch89_postclose_fixture",
            lambda *args, **kwargs: ["route missing"])
        def validate(candidate):
            return validator(candidate,
                event_raw=archive[ROOT / "docs/progress/progress-events.json"], now=observed,
                archived_files={path.relative_to(ROOT).as_posix(): data for path, data in archive.items()})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                result_status="FORGED")),
                ("lease", lambda b: b["progress"]["write_lease"].update(write_fencing_token="FORGED")),
                ("product_scope", lambda b: b["progress"]["write_lease"].update(
                    product_write_scope=["packages/api/fastapi_app.py"])),
                ("event_envelope", lambda b: b["events"]["events"][2233].update(actor="FORGED")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED")),
                ("digest", lambda b: b["detached_digest"].update(algorithm="MD5"))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_task4_epoch89_postclose_bootstrap_git_publication_and_negative(self):
        bundle = self.task4_epoch89_postclose_active_bundle()
        collector = getattr(checker, "_collect_f19a_task4_epoch89_postclose_fixture_git",
            lambda *args: ["route missing"])
        issued = "af80c46ceb8946cc8561055272d06f1a55fb0206"
        original = subprocess.check_output
        for scenario in ("published", "remote", "dirty", "descendant", "merge", "transient_product"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("f" * 40 if scenario == "descendant" else issued) + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else issued) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and scenario == "transient_product":
                        return b"packages/api/runtime.py\n"
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_epoch89_postclose_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_epoch89_postclose_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_EPOCH89_POST_CLOSE_FIXTURE_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_EPOCH89_POST_CLOSE_FIXTURE_CLOSE_ONLY"
        progress["f19a_task4_epoch89_post_close_fixture_binding"].update(
            status=status, code_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-epoch89-post-close-fixture-checkpoint-seq2236"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_epoch90_checkpoint_progress"] = raw_progress
        bundle["_epoch90_checkpoint_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_epoch90_checkpoint_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_epoch89_postclose_checkpoint_projection_and_forgery(self):
        bundle = self.task4_epoch89_postclose_checkpoint_bundle()
        raw = bundle["_epoch90_archive"][ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_task4_epoch89_postclose_fixture(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_epoch90_checkpoint_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_epoch90_checkpoint_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                package_status="FORGED")),
                ("handoff", lambda b: b["handoff"].update(next_safe_action="FORGED")),
                ("binding", lambda b: b["progress"]["f19a_task4_epoch89_post_close_fixture_binding"].update(
                    work_instruction_sha256="0" * 64))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    @staticmethod
    def task4_epoch89_postclose_closed_bundle():
        bundle = F19AStartProjectionTests.task4_epoch89_postclose_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_epoch90_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_EPOCH89_POST_CLOSE_FIXTURE_COMPLETE_WSL_QA_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2237, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2238, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_epoch89_post_close_fixture_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_EPOCH89_POST_CLOSE_FIXTURE_CLOSE",
                "subject_ref": "F-19A/TASK4-EPOCH89-POST-CLOSE-FIXTURE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2238
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = active_raw.decode("utf-8")
        suffix = '\n  ],\n  "last_event_id": "' + json.loads(active_raw)["last_event_id"] + '"\n}\n'
        assert prefix.endswith(suffix)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(suffix)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "' + stream["last_event_id"] + '"\n}\n')
        raw = raw.replace('"last_sequence": 2236', '"last_sequence": 2238', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_epoch89_post_close_fixture_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_epoch89_post_close_fixture_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_WSL_QA_PENDING"
        status = "TASK4_EPOCH89_POST_CLOSE_FIXTURE_CLOSED_WSL_QA_PENDING"
        progress["f19a_task4_epoch89_post_close_fixture_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2238)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_WSL_QA_PENDING"},
            snapshot_id="snapshot-f19a-task4-epoch89-post-close-fixture-close-seq2238")
        progress["repository"].update(projection_mode="F19A_TASK4_EPOCH89_POST_CLOSE_FIXTURE_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2238, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2238
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_epoch89_postclose_closed(bundle, raw):
        validator = getattr(checker, "_validate_f19a_task4_epoch89_postclose_fixture_closed",
            lambda *args, **kwargs: ["route missing"])
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_epoch89_post_close_fixture_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_epoch90_checkpoint_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_epoch90_checkpoint_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_epoch90_checkpoint_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_epoch90_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original(command, *args, **kwargs)
        observed = datetime.fromisoformat(bundle["events"]["events"][2237]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_epoch89_postclose_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_epoch89_postclose_closed_bundle()
        self.assertEqual(self.validate_task4_epoch89_postclose_closed(bundle, raw), [])
        for name, change in (("lease", lambda b: b[
                "completed_f19a_task4_epoch89_post_close_fixture_write_lease"].update(write_fencing_token="forged")),
                ("status", lambda b: b.update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged["progress"])
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(self.validate_task4_epoch89_postclose_closed(forged, raw), name)

    def test_task4_epoch89_postclose_checkpoint_git_exact_two_and_negative(self):
        bundle = self.task4_epoch89_postclose_checkpoint_bundle()
        issued, checkpoint = "af80c46ceb8946cc8561055272d06f1a55fb0206", "c" * 40
        exact = tuple(bundle["progress"]["f19a_task4_epoch89_post_close_fixture_binding"]["developer_exact_paths"])
        original, original_run = subprocess.check_output, subprocess.run
        collector = checker._collect_f19a_task4_epoch89_postclose_fixture_git
        for scenario in ("published", "remote", "dirty", "stale_blob", "missing_control",
                         "transient_other", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else checkpoint) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact) + "\n" + ("packages/api/runtime.py\n"
                            if scenario == "transient_other" else "")).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == f"{issued}..{checkpoint}":
                        return ("\n".join(exact[:-1] if scenario == "missing_control" else exact) + "\n").encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_epoch89_postclose_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_epoch89_postclose_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        archived = {"repository": {"projection_mode": "F19A_TASK4_EPOCH89_POST_CLOSE_FIXTURE_ACTIVE"},
            "f19a_task4_epoch89_post_close_fixture_binding": {"code_checkpoint": checkpoint}}
        original, original_run = subprocess.check_output, subprocess.run
        collector = getattr(checker, "_collect_f19a_task4_epoch89_postclose_fixture_closed_git",
            lambda *args: ["route missing"])
        for scenario in ("published", "stale_publication", "transient_product_cp",
                         "transient_product_close", "merge", "ancestor", "remote", "dirty"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        return (b"packages/api/runtime.py\n" if (scenario == "transient_product_cp"
                            and tail[-1] == f"{checkpoint}..{publication}") or (scenario == "transient_product_close"
                            and tail[-1] == f"{publication}..{head}") else b"docs/WORK_STATUS.md\n")
                    if tail[:1] == ["diff"]:
                        return b"docs/WORK_STATUS.md\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return b"{}" if scenario == "stale_publication" else json.dumps(archived).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(checker, "_collect_f19a_task4_epoch89_postclose_fixture_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_epoch89_postclose_legacy_git_dispatches_active_and_closed(self):
        active = self.task4_epoch89_postclose_active_bundle()
        closed, _ = self.task4_epoch89_postclose_closed_bundle()
        for bundle, collector_name in ((active, "_collect_f19a_task4_epoch89_postclose_fixture_git"),
                                       (closed, "_collect_f19a_task4_epoch89_postclose_fixture_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector_name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector_name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])


    @staticmethod
    def task4_db_fault_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "4fb588c042586c5bce10aaa5bf6ebdf61250d19e")
        bundle["_epoch91_archive"] = archive
        return bundle

    def test_task4_db_fault_active_exact_publication_and_negative(self):
        bundle = self.task4_db_fault_active_bundle()
        validator = getattr(checker, "_validate_f19a_task4_db_fault_bounded_503", None)
        self.assertIsNotNone(validator)
        archive = bundle["_epoch91_archive"]
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])

        def validate(candidate, *, now=issued + timedelta(minutes=1)):
            return validator(candidate, event_raw=archive[ROOT / "docs/progress/progress-events.json"],
                             now=now, archived_files={path.relative_to(ROOT).as_posix(): data
                                for path, data in archive.items()})

        self.assertEqual(validate(bundle), [])
        expired = datetime.fromisoformat(bundle["progress"]["worker_lease"]["expires_at"])
        self.assertTrue(validate(bundle, now=expired))
        for mutate in (
            lambda p: p["worker_lease"].update(status="REVOKED"),
            lambda p: p["write_lease"].update(write_fencing_token="forged"),
            lambda p: p["f19a_task4_db_fault_bounded_503_binding"].update(work_instruction_sha256="0" * 64),
            lambda p: p["repository"].update(product_write_scope=[]),
        ):
            with self.subTest(mutate=mutate):
                forged = deepcopy(bundle)
                mutate(forged["progress"])
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged))

    def test_task4_db_fault_issued_git_immutable_publication_and_negative(self):
        bundle = self.task4_db_fault_active_bundle()
        collector = checker._collect_f19a_task4_db_fault_git
        issued = "4fb588c042586c5bce10aaa5bf6ebdf61250d19e"
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "descendant", "ancestor", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = ("f" * 40 if scenario == "descendant" else "0" * 40
                            if scenario == "remote" and tail[1].startswith("development/") else issued)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail[:1] == ["rev-list"] and scenario == "merge":
                        return b"merge"
                    return original(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_db_fault_control_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_db_fault_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_DB_FAULT_BOUNDED_503_CONTROL_CHECKPOINTED_PRODUCT_RED_READY"
        action = "F19A_TASK4_DB_FAULT_BOUNDED_503_PRODUCT_RED_TESTS_ONLY"
        progress["f19a_task4_db_fault_bounded_503_binding"].update(
            status=status, control_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-db-fault-bounded-503-control-seq2241"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("\x60\x60\x60json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n\x60\x60\x60\n").encode()
        bundle["_epoch91_control_progress"] = raw_progress
        bundle["_epoch91_control_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        return bundle

    def test_task4_db_fault_control_checkpoint_projection_and_forgery(self):
        bundle = self.task4_db_fault_control_checkpoint_bundle()
        raw = bundle["_epoch91_archive"][ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)

        def validate(candidate):
            return checker._validate_f19a_task4_db_fault_bounded_503(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_epoch91_control_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_epoch91_control_handoff"]})

        self.assertEqual(validate(bundle), [])
        for name, change in (("instruction", lambda b: b["progress"]["active_work_instruction"].update(
                package_status="FORGED")),
                ("handoff", lambda b: b["handoff"].update(next_safe_action="FORGED")),
                ("binding", lambda b: b["progress"]["f19a_task4_db_fault_bounded_503_binding"].update(
                    work_instruction_sha256="0" * 64))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_task4_db_fault_git_control_publication_and_negative(self):
        bundle = self.task4_db_fault_control_checkpoint_bundle()
        collector = checker._collect_f19a_task4_db_fault_git
        issued = "4fb588c042586c5bce10aaa5bf6ebdf61250d19e"
        parent = "64237af83babd15f9df876f1aaa2494c4453e1e8"
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        checkpoint, head = "c" * 40, "b" * 40
        docs = {
            "docs/progress/build-progress.json": bundle["_epoch91_control_progress"],
            "docs/progress/BUILD_HANDOFF.md": bundle["_epoch91_control_handoff"],
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                (json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode(),
        }
        original_output, original_run, original_read = subprocess.check_output, subprocess.run, Path.read_bytes
        for scenario in ("published", "remote", "dirty", "unpublished", "missing_control",
                         "transient_product", "ancestor", "merge", "stale_blob"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        value = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (value + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        changes = (["docs/WORK_STATUS.md"] if tail[-1] == f"{parent}..{issued}"
                            else list(control) if tail[-1] == f"{issued}..{checkpoint}"
                            else ["docs/WORK_STATUS.md"])
                        if scenario == "transient_product" and tail[-1] == f"{checkpoint}..{head}":
                            changes.append("packages/api/runtime.py")
                        return ("\n".join(changes) + "\n").encode()
                    if tail[:1] == ["diff"]:
                        changes = (["docs/WORK_STATUS.md"] if tail[-1] == f"{parent}..{issued}"
                            else list(control) if tail[-1] == f"{issued}..{checkpoint}"
                            else ["docs/WORK_STATUS.md"])
                        if scenario == "missing_control" and tail[-1] == f"{issued}..{checkpoint}":
                            changes.pop()
                        return ("\n".join(changes) + "\n").encode()
                    if tail[:1] == ["show"]:
                        revision, path = tail[1].split(":", 1)
                        if revision == head and path in docs:
                            return b"stale" if scenario == "unpublished" and path.endswith("build-progress.json") else docs[path]
                        if revision == checkpoint and path in control:
                            return b"stale" if scenario == "stale_blob" and path == control[0] else original_read(ROOT / path)
                    return original_output(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)

                def read(path, *args, **kwargs):
                    relative = path.relative_to(ROOT).as_posix()
                    return docs[relative] if relative in docs else original_read(path, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run), \
                        patch.object(Path, "read_bytes", read):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_db_fault_product_checkpoint_bundle():
        bundle = F19AStartProjectionTests.task4_db_fault_control_checkpoint_bundle()
        progress = bundle["progress"]
        checkpoint = "d" * 40
        status = "TASK4_DB_FAULT_BOUNDED_503_PRODUCT_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_DB_FAULT_BOUNDED_503_CLOSE_ONLY"
        progress["f19a_task4_db_fault_bounded_503_binding"].update(
            status=status, product_code_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-db-fault-bounded-503-product-seq2241"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("\x60\x60\x60json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n\x60\x60\x60\n").encode()
        bundle["_epoch91_product_progress"] = raw_progress
        bundle["_epoch91_product_handoff"] = raw_handoff
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_epoch91_product_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_db_fault_product_checkpoint_projection_and_forgery(self):
        bundle = self.task4_db_fault_product_checkpoint_bundle()
        raw = bundle["_epoch91_archive"][ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)

        def validate(candidate):
            return checker._validate_f19a_task4_db_fault_bounded_503(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_epoch91_product_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_epoch91_product_handoff"]})

        self.assertEqual(validate(bundle), [])
        for name, change in (("product_checkpoint", lambda b: b["progress"][
                "f19a_task4_db_fault_bounded_503_binding"].update(product_code_checkpoint="0" * 40)),
                ("action", lambda b: b["progress"].update(runtime_next_action="FORGED")),
                ("digest", lambda b: b["detached_digest"]["handoff"].update(file_sha256="0" * 64))):
            forged = deepcopy(bundle)
            change(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_task4_db_fault_product_git_publication_and_negative(self):
        bundle = self.task4_db_fault_product_checkpoint_bundle()
        collector = checker._collect_f19a_task4_db_fault_git
        issued, control, product, head = (
            "4fb588c042586c5bce10aaa5bf6ebdf61250d19e", "c" * 40, "d" * 40, "e" * 40)
        control_paths = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        product_paths = ("apps/api/anvil_api/oidc_process.py", "packages/api/fastapi_app.py",
            "tests/api/test_oidc_process.py", "tests/api/test_f19a_registration_api.py",
            "tests/integration/test_f19a_oidc_pg15.py")
        docs = {"docs/progress/build-progress.json": bundle["_epoch91_product_progress"],
            "docs/progress/BUILD_HANDOFF.md": bundle["_epoch91_product_handoff"],
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                bundle["_epoch91_product_digest"]}
        original, original_run, original_read = subprocess.check_output, subprocess.run, Path.read_bytes
        for scenario in ("published", "one_product", "remote", "dirty", "stale_docs",
                         "stale_product", "no_product", "transient_other", "ancestor", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        value = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (value + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return b"codex/f18-wsl-ops\n"
                    if tail == ["rev-parse", "--abbrev-ref", "@{upstream}"]:
                        return b"development/codex/f18-wsl-ops\n"
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge" if scenario == "merge" else b""
                    if tail[:1] in (["log"], ["diff"]):
                        interval = tail[-1]
                        paths = (list(control_paths) if interval == f"{issued}..{control}"
                            else list(product_paths) if interval == f"{control}..{product}"
                            else ["docs/WORK_STATUS.md"])
                        if scenario == "one_product" and interval == f"{control}..{product}":
                            paths = [product_paths[0]]
                        if scenario == "no_product" and interval == f"{control}..{product}":
                            paths = ["docs/WORK_STATUS.md"]
                        if scenario == "transient_other" and interval == f"{control}..{product}" and tail[0] == "log":
                            paths.append("packages/api/runtime.py")
                        return ("\n".join(paths) + "\n").encode()
                    if tail[:1] == ["show"]:
                        revision, path = tail[1].split(":", 1)
                        if revision == head and path in docs:
                            return b"stale" if scenario == "stale_docs" and path.endswith("build-progress.json") else docs[path]
                        if revision == control and path in control_paths:
                            return original_read(ROOT / path)
                        if revision == product and path in product_paths:
                            return b"stale" if scenario == "stale_product" and path == product_paths[0] else original_read(ROOT / path)
                    return original(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)

                def read(path, *args, **kwargs):
                    relative = path.relative_to(ROOT).as_posix()
                    return docs[relative] if relative in docs else original_read(path, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run), \
                        patch.object(Path, "read_bytes", read):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario not in {"published", "one_product"},
                                 f"{scenario}: {result}")


    @staticmethod
    def task4_db_fault_closed_bundle():
        bundle = F19AStartProjectionTests.task4_db_fault_product_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_epoch91_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = progress["worker_lease"], progress["write_lease"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_DB_FAULT_BOUNDED_503_COMPLETE_WSL_QA_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2242, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
                (2243, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                    "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            prior = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_db_fault_bounded_503_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_DB_FAULT_BOUNDED_503_CLOSE",
                "subject_ref": "F-19A/TASK4-DB-FAULT-BOUNDED-503", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(prior)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2243
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = active_raw.decode("utf-8")
        suffix = '\n  ],\n  "last_event_id": "' + json.loads(active_raw)["last_event_id"] + '"\n}\n'
        assert prefix.endswith(suffix)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(suffix)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "' + stream["last_event_id"] + '"\n}\n')
        raw = raw.replace('"last_sequence": 2241', '"last_sequence": 2243', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_db_fault_bounded_503_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_db_fault_bounded_503_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_WSL_QA_PENDING"
        status = "TASK4_DB_FAULT_BOUNDED_503_CLOSED_WSL_QA_PENDING"
        progress["f19a_task4_db_fault_bounded_503_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2243)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_WSL_QA_PENDING"},
            snapshot_id="snapshot-f19a-task4-db-fault-bounded-503-close-seq2243")
        progress["repository"].update(projection_mode="F19A_TASK4_DB_FAULT_BOUNDED_503_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2243, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="d" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2243
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_db_fault_closed(bundle, raw):
        validator = getattr(checker, "_validate_f19a_task4_db_fault_bounded_503_closed",
            lambda *args, **kwargs: ["route missing"])
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_db_fault_bounded_503_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_epoch91_product_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_epoch91_product_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_epoch91_product_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_epoch91_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original(command, *args, **kwargs)
        observed = datetime.fromisoformat(bundle["events"]["events"][2242]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_db_fault_closed_immutable_product_publication_and_forgery(self):
        bundle, raw = self.task4_db_fault_closed_bundle()
        self.assertEqual(self.validate_task4_db_fault_closed(bundle, raw), [])
        for name, mutate in (("event", lambda b: b["events"]["events"][2241].update(actor="forged")),
                             ("lease", lambda b: b["progress"].update(
                                 completed_f19a_task4_db_fault_bounded_503_worker_lease=None)),
                             ("binding", lambda b: b["progress"][
                                 "f19a_task4_db_fault_bounded_503_binding"].update(
                                     work_instruction_sha256="0" * 64)),
                             ("digest", lambda b: b["detached_digest"].update(algorithm="forged"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(self.validate_task4_db_fault_closed(forged, raw), name)

    def test_task4_db_fault_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_db_fault_closed_bundle()
        checkpoint, publication, head = "d" * 40, "e" * 40, "f" * 40
        original, original_run = subprocess.check_output, subprocess.run
        collector = checker._collect_f19a_task4_db_fault_bounded_503_closed_git
        published = {"repository": {"projection_mode": "F19A_TASK4_DB_FAULT_BOUNDED_503_ACTIVE"},
            "f19a_task4_db_fault_bounded_503_binding": {"product_code_checkpoint": checkpoint}}
        for scenario in ("published", "stale_publication", "transient_product_dp",
                         "transient_product_close", "merge", "ancestor", "remote", "dirty"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (head + "\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        return (("0" * 40 if scenario == "remote" else head) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge" if scenario == "merge" else b""
                    if tail[:1] == ["log"]:
                        changed = (scenario == "transient_product_dp" and tail[-1] == f"{checkpoint}..{publication}"
                            or scenario == "transient_product_close" and tail[-1] == f"{publication}..{head}")
                        return b"packages/api/runtime.py\n" if changed else b"docs/WORK_STATUS.md\n"
                    if tail[:1] == ["diff"]:
                        return b"docs/WORK_STATUS.md\n"
                    if tail == ["show", f"{publication}:docs/progress/build-progress.json"]:
                        return json.dumps({} if scenario == "stale_publication" else published).encode()
                    return original(command, *args, **kwargs)

                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)

                with patch.object(checker, "_collect_f19a_task4_db_fault_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_db_fault_legacy_git_dispatches_active_and_closed(self):
        active = self.task4_db_fault_active_bundle()
        closed, _ = self.task4_db_fault_closed_bundle()
        for bundle, collector_name in ((active, "_collect_f19a_task4_db_fault_git"),
                                       (closed, "_collect_f19a_task4_db_fault_bounded_503_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector_name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector_name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    @staticmethod
    def task4_final_qa_report_active_bundle():
        bundle, archive = F19AStartProjectionTests.historical_bundle(
            "5eac95292ef17749efec31b52b5e0d1f52a18134")
        return bundle, archive

    def test_task4_final_qa_report_active_issued_and_forged(self):
        bundle, archive = self.task4_final_qa_report_active_bundle()
        validator = getattr(checker, "_validate_f19a_task4_final_qa_report_control", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        files = {path.relative_to(ROOT).as_posix(): data for path, data in archive.items()}
        raw = archive[ROOT / "docs/progress/progress-events.json"]

        def validate(candidate, *, now=issued + timedelta(minutes=1)):
            return validator(candidate, event_raw=raw, now=now, archived_files=files)

        self.assertEqual(validate(bundle), [])
        self.assertTrue(validate(bundle, now=datetime.fromisoformat(
            bundle["progress"]["worker_lease"]["expires_at"])))
        for name, mutate in (
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["x"])),
            ("report", lambda b: b["progress"]["f19a_task4_final_qa_report_control_binding"].update(
                qa_report_sha256="0" * 64)),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="forged")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="SHA-1")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged))

    def test_task4_final_qa_report_issued_git_report_and_dirty_negative(self):
        bundle, _ = self.task4_final_qa_report_active_bundle()
        collector = getattr(checker, "_collect_f19a_task4_final_qa_report_control_git", None)
        self.assertIsNotNone(collector)
        issued = "5eac95292ef17749efec31b52b5e0d1f52a18134"
        original = subprocess.check_output
        for scenario in ("published", "remote", "dirty", "descendant", "report_blob", "merge"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                               else "f" * 40 if scenario == "descendant" else issued)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail == ["rev-parse", "HEAD:docs/04_test_reports/F-19A_MINIMAL_PAIR_AUTH_RESULT.md"] \
                            and scenario == "report_blob":
                        return ("0" * 40 + "\n").encode()
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    return original(command, *args, **kwargs)

                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_final_qa_report_checkpoint_bundle():
        bundle, archive = F19AStartProjectionTests.task4_final_qa_report_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "TASK4_FINAL_QA_REPORT_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_TASK4_FINAL_QA_REPORT_CONTROL_CLOSE_ONLY"
        progress["f19a_task4_final_qa_report_control_binding"].update(
            status=status, control_checkpoint=checkpoint, next_safe_action=action)
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress["next_work_package"]["status"] = status
        progress["next_safe_action"] = progress["runtime_next_action"] = action
        progress["snapshot_id"] = "snapshot-f19a-task4-final-qa-report-control-checkpoint-seq2246"
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        bundle["_final_qa_progress"] = raw_progress
        bundle["_final_qa_handoff"] = raw_handoff
        bundle["_final_qa_archive"] = archive
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(
                bytes=len(raw), file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_final_qa_digest"] = (
            json.dumps(bundle["detached_digest"], ensure_ascii=False) + "\n").encode()
        return bundle

    def test_task4_final_qa_report_checkpoint_projection_and_forgery(self):
        bundle = self.task4_final_qa_report_checkpoint_bundle()
        archive = bundle["_final_qa_archive"]
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_task4_final_qa_report_control(candidate,
                event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_final_qa_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_final_qa_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("instruction", lambda b: b["progress"]["active_work_instruction"].update(result_status="FORGED")),
            ("checkpoint", lambda b: b["progress"]["f19a_task4_final_qa_report_control_binding"].update(
                control_checkpoint="0" * 40)),
            ("handoff", lambda b: b["handoff"].update(status="ACCEPTED")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)

    def test_task4_final_qa_report_checkpoint_git_exact_two_and_negative(self):
        bundle = self.task4_final_qa_report_checkpoint_bundle()
        collector = checker._collect_f19a_task4_final_qa_report_control_git
        checkpoint = "c" * 40
        issued = "5eac95292ef17749efec31b52b5e0d1f52a18134"
        exact = ("scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "dirty_docs", "missing_control", "stale_blob",
                         "transient_product", "docs_in_control", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = ("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                               else checkpoint)
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/runtime.py\n" if scenario == "dirty" else
                            b" M docs/WORK_STATUS.md\n" if scenario == "dirty_docs" else b"")
                    if tail[:1] == ["rev-list"] and checkpoint in tail[-1]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] == f"{issued}..{checkpoint}":
                        extra = ("packages/api/runtime.py\n" if scenario == "transient_product" else
                            "docs/WORK_STATUS.md\n" if scenario == "docs_in_control" else "")
                        return ("\n".join(exact) + "\n" + extra).encode()
                    if tail[:1] == ["log"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["diff"] and tail[-1] == f"{issued}..{checkpoint}":
                        extra = "docs/WORK_STATUS.md\n" if scenario == "docs_in_control" else ""
                        return ("\n".join(exact[:1] if scenario == "missing_control" else exact)
                            + "\n" + extra).encode()
                    if tail[:1] == ["diff"] and tail[-1] == f"{checkpoint}..{checkpoint}":
                        return b""
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" and path == exact[0] else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @staticmethod
    def task4_final_qa_report_closed_bundle():
        bundle = F19AStartProjectionTests.task4_final_qa_report_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        active_raw = bundle["_final_qa_archive"][ROOT / "docs/progress/progress-events.json"]
        worker, write = stream["events"][2244]["details"], stream["events"][2245]["details"]
        at = (datetime.fromisoformat(write["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_TASK4_FINAL_QA_REPORT_CONTROL_COMPLETE_ACCEPTANCE_REVIEW_PENDING_F19A_NOT_ACCEPTED"
        for sequence, kind, details in ((2247, "WRITE_LEASE_REVOKED", {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
                "reason": reason}), (2248, "WORKER_LEASE_REVOKED", {"lease_id": worker["lease_id"],
                "execution_fencing_token": worker["execution_fencing_token"], "reason": reason})):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence,
                "event_id": f"evt_f19a_{sequence}_task4_final_qa_report_control_{kind.lower()}",
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_TASK4_FINAL_QA_REPORT_CONTROL_CLOSE",
                "subject_ref": "F-19A/TASK4-FINAL-QA-REPORT-CONTROL", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2248
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        footer = ('\n  ],\n  "last_event_id": '
            '"evt_f19a_2246_task4_final_qa_report_write_lease_issued"\n}\n')
        prefix = active_raw.decode("utf-8")
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": '
            '"evt_f19a_2248_task4_final_qa_report_control_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2246', '"last_sequence": 2248', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_task4_final_qa_report_control_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_task4_final_qa_report_control_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        action = "F19A_TASK4_ACCEPTANCE_REVIEW_PENDING"
        status = "TASK4_FINAL_QA_REPORT_CONTROL_CLOSED_ACCEPTANCE_REVIEW_PENDING"
        progress["f19a_task4_final_qa_report_control_binding"].update(
            status=status, active_projection_checkpoint="e" * 40,
            next_safe_action=action, event_sequence=2248)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A",
                "status": "TASK4_ACCEPTANCE_REVIEW_PENDING"},
            snapshot_id="snapshot-f19a-task4-final-qa-report-control-close-seq2248")
        progress["repository"].update(projection_mode="F19A_TASK4_FINAL_QA_REPORT_CONTROL_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2248, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2248
        bundle["detached_digest"]["progress"].update(bytes=123,
            file_sha256=hashlib.sha256(b"x" * 123).hexdigest().upper())
        bundle["detached_digest"]["handoff"].update(bytes=456,
            file_sha256=hashlib.sha256(b"x" * 456).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_task4_final_qa_report_closed(bundle, raw, *, now=None):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_task4_final_qa_report_control_binding"]["active_projection_checkpoint"]
        values = {"docs/progress/build-progress.json": "_final_qa_progress",
            "docs/progress/progress-events.json": None,
            "docs/progress/BUILD_HANDOFF.md": "_final_qa_handoff",
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                "_final_qa_digest"}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                path = command[2].split(":", 1)[1]
                if path in values:
                    return (bundle["_final_qa_archive"][ROOT / path] if values[path] is None
                        else bundle[values[path]])
            return original(command, *args, **kwargs)
        validator = getattr(checker, "_validate_f19a_task4_final_qa_report_control_closed",
            lambda *a, **k: ["route missing"])
        observed = now or datetime.fromisoformat(bundle["events"]["events"][2247]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_task4_final_qa_report_closed_immutable_active_and_forgery(self):
        bundle, raw = self.task4_final_qa_report_closed_bundle()
        self.assertEqual(self.validate_task4_final_qa_report_closed(bundle, raw), [])
        for name, change in (("token", lambda b: b["progress"][
                "completed_f19a_task4_final_qa_report_control_write_lease"].update(write_fencing_token="forged")),
                ("scope", lambda b: b["progress"][
                    "completed_f19a_task4_final_qa_report_control_write_lease"].update(product_write_scope=["x"])),
                ("publication", lambda b: b["progress"][
                    "f19a_task4_final_qa_report_control_binding"].update(active_projection_checkpoint="0" * 40)),
                ("published_digest", lambda b: b.__setitem__("_final_qa_digest", b"{}")),
                ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            change(forged)
            self.assertTrue(self.validate_task4_final_qa_report_closed(forged, raw), name)

    def test_task4_final_qa_report_closed_git_publication_and_history_negative(self):
        bundle, _ = self.task4_final_qa_report_closed_bundle()
        collector = getattr(checker, "_collect_f19a_task4_final_qa_report_control_closed_git", None)
        self.assertIsNotNone(collector)
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "missing_publication", "wrong_mode",
                         "transient_product", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"] and any(value in tail[-1] for value in (checkpoint, publication, head)):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] == ["log"] and tail[-1] in (f"{checkpoint}..{publication}",
                                                              f"{publication}..{head}"):
                        return b"packages/api/runtime.py\n" if scenario == "transient_product" else b""
                    if tail[:1] == ["diff"] and tail[-1] in (f"{checkpoint}..{publication}",
                                                               f"{publication}..{head}"):
                        return b""
                    if tail[:1] == ["show"] and tail[1] == f"{publication}:docs/progress/build-progress.json":
                        if scenario == "missing_publication":
                            raise subprocess.CalledProcessError(128, command)
                        active = json.loads(bundle["_final_qa_progress"])
                        if scenario == "wrong_mode":
                            active["repository"]["projection_mode"] = "FORGED"
                        return json.dumps(active).encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(checker, "_collect_f19a_task4_final_qa_report_control_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_task4_final_qa_report_legacy_git_dispatches_both_modes(self):
        active, _ = self.task4_final_qa_report_active_bundle()
        closed, _ = self.task4_final_qa_report_closed_bundle()
        for bundle, collector_name in ((active, "_collect_f19a_task4_final_qa_report_control_git"),
                                       (closed, "_collect_f19a_task4_final_qa_report_control_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, collector_name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, collector_name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    @staticmethod
    def f19a_acceptance_active_bundle():
        return F19AStartProjectionTests.historical_bundle(
            "d76dcf63b16c2526b7e078ab165d336b3d967319")

    def test_f19a_acceptance_active_issued_and_forged(self):
        bundle, archive = self.f19a_acceptance_active_bundle()
        validator = getattr(checker, "_validate_f19a_acceptance_control", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        files = {path.relative_to(ROOT).as_posix(): data for path, data in archive.items()}
        def validate(candidate, *, now=issued + timedelta(minutes=1)):
            return validator(candidate, event_raw=raw, now=now, archived_files=files)
        self.assertEqual(validate(bundle), [])
        self.assertTrue(validate(bundle, now=datetime.fromisoformat(
            bundle["progress"]["worker_lease"]["expires_at"])))
        for name, mutate in (
            ("token", lambda b: b["progress"]["write_lease"].update(write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["U-01"])),
            ("premature_acceptance", lambda b: b["progress"]["completed_packages"].append("F-19A")),
            ("r48_pass", lambda b: b["progress"]["f19a_acceptance_control_binding"].update(
                adjacent_regression="182_PASS")),
            ("report", lambda b: b["progress"]["f19a_acceptance_control_binding"].update(
                qa_report_sha256="0" * 64)),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U01_PRODUCT_WRITE")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="SHA-1")),
        ):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)

    @staticmethod
    def f19a_acceptance_checkpoint_bundle():
        bundle, archive = F19AStartProjectionTests.f19a_acceptance_active_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "F19A_ACCEPTANCE_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_ACCEPTANCE_CONTROL_CLOSE_ONLY"
        progress["f19a_acceptance_control_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=checkpoint,
            acceptance_decision="MAIN_APPROVED_PENDING_CLOSE")
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(snapshot_id="snapshot-f19a-acceptance-control-checkpoint-seq2251",
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "F-19A", "status": status})
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        raw_progress = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        raw_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        for section, raw in (("progress", raw_progress), ("handoff", raw_handoff)):
            bundle["detached_digest"][section].update(bytes=len(raw),
                file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_acceptance_archive"] = archive
        bundle["_acceptance_progress"] = raw_progress
        bundle["_acceptance_handoff"] = raw_handoff
        bundle["_acceptance_digest"] = (json.dumps(bundle["detached_digest"]) + "\n").encode()
        return bundle

    def test_f19a_acceptance_checkpoint_projection_and_forgery(self):
        bundle = self.f19a_acceptance_checkpoint_bundle()
        archive = bundle["_acceptance_archive"]
        raw = archive[ROOT / "docs/progress/progress-events.json"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_acceptance_control(candidate, event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": candidate["_acceptance_progress"],
                    "docs/progress/BUILD_HANDOFF.md": candidate["_acceptance_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (
            ("decision", lambda b: b["progress"]["f19a_acceptance_control_binding"].update(
                acceptance_decision="ACCEPTED")),
            ("premature_completed", lambda b: b["progress"]["completed_packages"].append("F-19A")),
            ("instruction", lambda b: b["progress"]["active_work_instruction"].update(result_status="ACCEPTED")),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U01_WRITE"))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)

    @staticmethod
    def f19a_acceptance_closed_bundle():
        bundle = F19AStartProjectionTests.f19a_acceptance_checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = deepcopy(progress["worker_lease"]), deepcopy(progress["write_lease"])
        at = (datetime.fromisoformat(worker["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_ACCEPTANCE_CONTROL_COMPLETE_F19A_ACCEPTED_INTEGRATION_GATE_PENDING"
        envelope = {"actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
            "project_id": "anvil", "work_package_id": "F-19A", "run_id": None,
            "step_id": "F19A_ACCEPTANCE_CONTROL_CLOSE", "subject_ref": "F-19A/ACCEPTANCE-CONTROL",
            "occurred_at": at, "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"}
        rows = ((2252, "WRITE_LEASE_REVOKED", "evt_f19a_2252_acceptance_control_write_lease_revoked",
            {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"], "reason": reason}),
            (2253, "WORKER_LEASE_REVOKED", "evt_f19a_2253_acceptance_control_worker_lease_revoked",
            {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
                "reason": reason}),
            (2254, "MAIN_PACKAGE_ACCEPTED", "evt_f19a_2254_acceptance_control_main_package_accepted",
            {"decision": "ACCEPTED_LOCAL_WSL_SCOPE_INTEGRATION_PENDING", "package_id": "F-19A",
                "test_report_ref": "docs/04_test_reports/F-19A_MINIMAL_PAIR_AUTH_RESULT.md",
                "test_report_sha256": "9838B6C39006629261D22AAF4B8621214E48445E5ABABF906E934AA2A33D133D",
                "av_ops_026": "PASS", "av_safe_034": "PASS",
                "adjacent_regression": "180_PASS_2_PREEXISTING_R48_AUTHORITY_FAIL_EXIT1",
                "next_work_package": "F19A_INTEGRATION_REQUIRED_GATES_PENDING", "blocking_findings": 0,
                "unverified": ["PHYSICAL_TCP_DROP", "ACK_COMMIT_RESPONSE_LOSS", "MAIN_MERGE", "U01", "PRODUCTION"]}))
        for sequence, kind, event_id, details in rows:
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence, "event_id": event_id, "event_type": kind,
                **envelope, "previous_event_sha256": hashlib.sha256(
                    checker.canonical_json_bytes(previous)).hexdigest().upper(), "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2254
        stream["last_event_id"] = progress["last_event_id"] = rows[-1][2]
        prefix = bundle["_acceptance_archive"][ROOT / "docs/progress/progress-events.json"].decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2251_acceptance_control_write_lease_issued"\n}\n'
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-3:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2254_acceptance_control_main_package_accepted"\n}\n')
        raw = raw.replace('"last_sequence": 2251', '"last_sequence": 2254', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_acceptance_control_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_acceptance_control_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        progress["completed_packages"].append("F-19A")
        progress["next_successor_work_package"] = {"package_id": "U-01",
            "status": "BLOCKED_PENDING_F19A_INTEGRATION_GATES"}
        status, action = "F19A_ACCEPTED_INTEGRATION_GATE_PENDING", "F19A_INTEGRATION_REQUIRED_GATES_PENDING"
        progress["f19a_acceptance_control_binding"].update(status=status, next_safe_action=action,
            acceptance_decision="ACCEPTED_LOCAL_WSL_SCOPE_INTEGRATION_PENDING",
            active_projection_checkpoint="e" * 40, event_sequence=2254)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A", "status": status},
            snapshot_id="snapshot-f19a-acceptance-control-close-seq2254")
        progress["repository"].update(projection_mode="F19A_ACCEPTANCE_CONTROL_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2254, last_event_id=rows[-1][2], active_agent=None,
            worker_lease=None, write_lease=None, repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2254
        for section, size in (("progress", 123), ("handoff", 456)):
            bundle["detached_digest"][section].update(bytes=size,
                file_sha256=hashlib.sha256(b"x" * size).hexdigest().upper())
        return bundle, raw

    @staticmethod
    def validate_f19a_acceptance_closed(bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_acceptance_control_binding"]["active_projection_checkpoint"]
        published = {"docs/progress/build-progress.json": bundle["_acceptance_progress"],
            "docs/progress/progress-events.json": bundle["_acceptance_archive"][
                ROOT / "docs/progress/progress-events.json"],
            "docs/progress/BUILD_HANDOFF.md": bundle["_acceptance_handoff"],
            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                bundle["_acceptance_digest"]}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                return published[command[2].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        validator = getattr(checker, "_validate_f19a_acceptance_control_closed", lambda *a, **k: ["missing"])
        observed = datetime.fromisoformat(bundle["events"]["events"][2253]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={"docs/progress/build-progress.json": b"x" * 123,
                    "docs/progress/BUILD_HANDOFF.md": b"x" * 456})

    def test_f19a_acceptance_closed_published_and_forged(self):
        bundle, raw = self.f19a_acceptance_closed_bundle()
        self.assertEqual(self.validate_f19a_acceptance_closed(bundle, raw), [])
        for name, mutate in (("decision", lambda b: b["progress"]["f19a_acceptance_control_binding"].update(
                acceptance_decision="MAIN_APPROVED_PENDING_CLOSE")),
            ("premature_u01", lambda b: b["progress"]["completed_packages"].append("U-01")),
            ("stale_successor", lambda b: b["progress"].update(next_successor_work_package={
                "package_id": "U-01", "status": "BLOCKED_PENDING_F19A_ACCEPTANCE"})),
            ("successor_write", lambda b: b["progress"].update(next_successor_work_package={
                "package_id": "U-01", "status": "PRODUCT_WRITE_READY"})),
            ("r48", lambda b: b["events"]["events"][2253]["details"].update(
                adjacent_regression="182_PASS")),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U01_WRITE")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="SHA-1")),
            ("published", lambda b: b.__setitem__("_acceptance_digest", b"{}"))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(self.validate_f19a_acceptance_closed(forged, raw), name)

    def test_f19a_acceptance_git_issued_and_checkpoint_negative(self):
        issued, checkpoint = "d76dcf63b16c2526b7e078ab165d336b3d967319", "c" * 40
        original, original_run = subprocess.check_output, subprocess.run
        for checkpointed in (False, True):
            bundle = (self.f19a_acceptance_checkpoint_bundle() if checkpointed
                else self.f19a_acceptance_active_bundle()[0])
            for scenario in ("published", "remote", "dirty", "docs_dirty", "descendant",
                             "merge", "transient_product", "docs_in_control", "missing_control", "stale_blob"):
                with self.subTest(checkpointed=checkpointed, scenario=scenario):
                    def output(command, *args, **kwargs):
                        tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                            "-c", "core.quotePath=false"] else command[1:]
                        if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                            sha = checkpoint if checkpointed else issued
                            if scenario == "descendant" and not checkpointed:
                                sha = checkpoint
                            if scenario == "remote" and tail[1].startswith("development/"):
                                sha = "0" * 40
                            return (sha + "\n").encode()
                        if tail == ["status", "--porcelain=v1", "-uall"]:
                            return (b" M packages/api/runtime.py\n" if scenario == "dirty" else
                                b" M docs/WORK_STATUS.md\n" if scenario == "docs_dirty" else b"")
                        if tail[:1] == ["rev-list"] and checkpoint in tail[-1]:
                            return b"merge\n" if scenario == "merge" else b""
                        if tail[:1] in (["log"], ["diff"]):
                            interval = tail[-1]
                            if interval == f"{issued}..{checkpoint}":
                                extra = ("packages/api/runtime.py\n" if scenario == "transient_product"
                                    and tail[0] == "log" else "docs/WORK_STATUS.md\n"
                                    if scenario == "docs_in_control" else "")
                                paths = ["scripts/check_project_progress.py", "tests/tooling/test_f19a_start_projection.py"]
                                if scenario == "missing_control" and tail[0] == "diff":
                                    paths.pop()
                                return ("\n".join(paths) + "\n" + extra).encode()
                            if interval == f"{checkpoint}..{checkpoint}":
                                return b""
                        if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                            path = tail[1].split(":", 1)[1]
                            return b"stale" if scenario == "stale_blob" else (ROOT / path).read_bytes()
                        return original(command, *args, **kwargs)
                    def run(command, *args, **kwargs):
                        if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                            return subprocess.CompletedProcess(command,
                                1 if scenario == "descendant" and checkpointed else 0)
                        return original_run(command, *args, **kwargs)
                    with patch.object(subprocess, "check_output", side_effect=output), \
                            patch.object(subprocess, "run", side_effect=run):
                        result = checker._collect_f19a_acceptance_control_git(bundle)
                    should_fail = scenario not in ("published",) and (checkpointed or scenario not in
                        ("merge", "transient_product", "docs_in_control", "missing_control", "stale_blob"))
                    self.assertEqual(bool(result), should_fail, f"{scenario}: {result}")

    def test_f19a_acceptance_closed_git_publication_negative(self):
        bundle, _ = self.f19a_acceptance_closed_bundle()
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "missing_publication", "wrong_mode",
                         "transient_product", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        return (("0" * 40 if scenario == "remote" and tail[1].startswith("development/")
                            else head) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"] and publication in tail[-1]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] in (
                            f"{checkpoint}..{publication}", f"{publication}..{head}"):
                        return (b"packages/api/runtime.py\n" if scenario == "transient_product"
                            and tail[0] == "log" else b"")
                    if tail[:1] == ["show"] and tail[1].startswith(publication + ":"):
                        if scenario == "missing_publication":
                            raise subprocess.CalledProcessError(128, command)
                        path = tail[1].split(":", 1)[1]
                        if path == "docs/progress/build-progress.json" and scenario == "wrong_mode":
                            published = json.loads(bundle["_acceptance_progress"])
                            published["repository"]["projection_mode"] = "FORGED"
                            return json.dumps(published).encode()
                        return {"docs/progress/build-progress.json": bundle["_acceptance_progress"],
                            "docs/progress/progress-events.json": bundle["_acceptance_archive"][
                                ROOT / "docs/progress/progress-events.json"],
                            "docs/progress/BUILD_HANDOFF.md": bundle["_acceptance_handoff"],
                            "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json":
                                bundle["_acceptance_digest"]}[path]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(checker, "_collect_f19a_acceptance_control_git", return_value=[]), \
                        patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = checker._collect_f19a_acceptance_control_closed_git(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_f19a_acceptance_legacy_git_dispatches_both_modes(self):
        for bundle, name in ((self.f19a_acceptance_active_bundle()[0],
                              "_collect_f19a_acceptance_control_git"),
                             (self.f19a_acceptance_closed_bundle()[0],
                              "_collect_f19a_acceptance_control_closed_git")):
            with self.subTest(mode=bundle["progress"]["repository"]["projection_mode"]):
                with patch.object(checker, name, return_value=[]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), [])
                with patch.object(checker, name, return_value=["INVALID"]):
                    self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])


if __name__ == "__main__":
    unittest.main()
