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
    def clean_git_status():
        original = subprocess.check_output

        def clean_status(command, *args, **kwargs):
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b""
            return original(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=clean_status):
            yield

    @classmethod
    def validate_active_clean(cls, bundle):
        with cls.clean_git_status():
            return checker.validate_bundle(bundle)

    @staticmethod
    def closed_fixture(checkpoint=None):
        current = checker.load_bundle(ROOT)
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
        original_events = (ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")
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
        current = checker.load_bundle(ROOT)
        raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
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
        current = checker.load_bundle(ROOT)
        raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
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
        current = checker.load_bundle(ROOT)
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
        current = checker.load_bundle(ROOT)
        self.assertEqual(current["progress"]["event_sequence"], 2141)
        self.assertEqual(self.validate_active_clean(current), [])

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
                self.assertIn(code, self.validate_active_clean(forged))

    def test_frozen_raw_prefix_and_expiry(self):
        current = checker.load_bundle(ROOT)
        raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
        changed = raw.replace(b'"evt_f20_2138_worker_lease_revoked"',
                              b'"evt_f20_2138_worker_lease_forged"', 1)
        self.assertNotEqual(changed, raw)
        validate = getattr(checker, "_validate_f19a_start", lambda *a, **k: ["F19A_START_ROUTE_MISSING"])
        self.assertIn("F19A_FROZEN_PREFIX_INVALID", validate(current, event_raw=changed))
        self.assertIn("F19A_LEASE_INVALID", validate(
            current, now=datetime(2026, 10, 7, 19, 3, 48, tzinfo=timezone.utc)))

    def test_git_scope_starts_valid_then_rejects_unrelated_dirty(self):
        current = checker.load_bundle(ROOT)
        collect = getattr(checker, "_collect_f19a_start_git", lambda *a: ["F19A_GIT_ROUTE_MISSING"])
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
        current = checker.load_bundle(ROOT)
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


if __name__ == "__main__":
    unittest.main()
