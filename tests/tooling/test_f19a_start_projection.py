"""F-19A product-start control must preserve the seq2138 predecessor."""

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from scripts import check_project_progress as checker


ROOT = Path(__file__).resolve().parents[2]


class F19AStartProjectionTests(unittest.TestCase):
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
        self.assertEqual(checker.validate_bundle(current), [])

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
                self.assertIn(code, checker.validate_bundle(forged))

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
