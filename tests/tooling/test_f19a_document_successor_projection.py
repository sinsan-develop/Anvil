"""F-19A document-only successor projection guard."""

from copy import deepcopy
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import json
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.check_project_progress import extract_handoff_summary, load_bundle, validate_bundle


ROOT = Path(__file__).resolve().parents[2]
HISTORICAL_F19A = "76d71374a80792fd5ffc1150b2fa8c4c1293f5e9"


@lru_cache(maxsize=None)
def frozen_f19a(path):
    return subprocess.check_output(["git", "show", f"{HISTORICAL_F19A}:{path}"],
                                   cwd=ROOT, stderr=subprocess.DEVNULL)


class F19ADocumentSuccessorTests(unittest.TestCase):
    @staticmethod
    def historical_bundle():
        from scripts import f19a_document_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["progress"] = json.loads(frozen_f19a(overlay.PROGRESS))
        bundle["events"] = json.loads(frozen_f19a(overlay.EVENTS))
        bundle["handoff_text"] = frozen_f19a(overlay.HANDOFF).decode("utf-8")
        bundle["handoff"] = extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(frozen_f19a(overlay.DIGEST))
        bundle["_detached_digest_path"] = overlay.DIGEST
        return bundle

    @staticmethod
    def validate_historical(bundle, now=None, *, event_raw=None):
        from scripts import f19a_document_successor_overlay as overlay

        archive = {ROOT / path: frozen_f19a(path)
                   for path in (overlay.PROGRESS, overlay.EVENTS, overlay.HANDOFF, overlay.DIGEST)}
        original_read, original_stat = Path.read_bytes, Path.stat

        def read_historical(path):
            return archive[path] if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            if path in archive:
                return SimpleNamespace(st_size=len(archive[path]))
            return original_stat(path, *args, **kwargs)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical):
            return overlay.validate_control(ROOT, bundle, now or datetime.now(timezone.utc),
                                            event_raw=event_raw or frozen_f19a(overlay.EVENTS))

    @staticmethod
    @contextmanager
    def historical_git_facts():
        from scripts import f19a_document_successor_overlay as overlay

        original = overlay._git
        delta = original(ROOT, "diff", "--name-only", "--no-renames", f"{overlay.BASE}..{HISTORICAL_F19A}")

        def historical(root, *args):
            if args == ("rev-parse", "HEAD"):
                return (HISTORICAL_F19A + "\n").encode()
            if args == ("rev-parse", overlay.UPSTREAM):
                return (overlay.BASE + "\n").encode()
            if args == ("diff", "--name-only", "--no-renames", f"{overlay.BASE}..HEAD"):
                return delta
            return original(root, *args)

        with patch.object(overlay, "_git", side_effect=historical):
            yield

    def test_rejects_forged_progress_snapshot_even_with_valid_successor_binding(self):
        bundle = deepcopy(load_bundle(ROOT))
        bundle["progress"]["snapshot_hash"] = "0" * 64
        bundle["progress"]["completed_packages"].append("F-20")
        self.assertIn("PRG_SNAPSHOT_HASH_MISMATCH", validate_bundle(bundle))

    def test_rejects_unrelated_reference_hash_and_handoff_action_forgery(self):
        bundle = deepcopy(load_bundle(ROOT))
        bundle["progress"]["latest_evidence_refs"].append({
            "path": "AGENTS.md", "sha256": "0" * 64,
        })
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", validate_bundle(bundle))

        bundle = deepcopy(load_bundle(ROOT))
        bundle["handoff"]["next_safe_action"] = "FORGED_ACTION"
        self.assertIn("HANDOFF_NEXT_ACTION_MISMATCH", validate_bundle(bundle))

    def test_historical_f19a_and_current_successor_are_distinct(self):
        historical = self.historical_bundle()
        self.assertEqual(historical["progress"]["event_sequence"], 2126)
        self.assertEqual(self.validate_historical(historical), [])
        current = load_bundle(ROOT)
        self.assertEqual(current["progress"]["event_sequence"], 2129)
        self.assertEqual(validate_bundle(current), [])

    def test_rejects_forged_event_order_token_and_expiry(self):
        from scripts import f19a_document_successor_overlay as overlay

        cases = (
            ("order", lambda b: b["events"]["events"][2121].update(event_type="WRITE_LEASE_ISSUED"), "F19A_EVENT_ORDER_INVALID"),
            ("worker_token", lambda b: b["events"]["events"][2121]["details"].update(fencing_token="forged"), "F19A_LEASE_INVALID"),
            ("write_token", lambda b: b["events"]["events"][2122]["details"].update(write_fencing_token="forged"), "F19A_LEASE_INVALID"),
            ("expiry", lambda b: b["events"]["events"][2122].update(occurred_at=(overlay.EXPIRES + timedelta(seconds=1)).isoformat()), "F19A_EVENT_TIME_INVALID"),
        )
        for name, mutate, code in cases:
            with self.subTest(name=name):
                bundle = self.historical_bundle()
                mutate(bundle)
                self.assertIn(code, self.validate_historical(bundle, datetime.now(timezone.utc)))

    def test_rejects_work_instruction_and_document_binding_forgery(self):
        from scripts import f19a_document_successor_overlay as overlay

        cases = (
            ("wi_hash", lambda b: b["events"]["events"][2120]["details"].update(sha256="0" * 64), "F19A_WORK_INSTRUCTION_INVALID"),
            ("approval", lambda b: b["events"]["events"][2120]["details"].update(approval_ref="codex://threads/forged"), "F19A_WORK_INSTRUCTION_INVALID"),
            ("doc_hash", lambda b: b["progress"]["f19a_document_successor_binding"]["new_artifact_sha256"].update({overlay.DOCS[0]: "0" * 64}), "F19A_DOCUMENT_BINDING_INVALID"),
            ("old_approval", lambda b: b["progress"]["scope_revision_binding"].update(approval_id="forged"), "F19A_OLD_BINDING_INVALID"),
            ("old_evidence_ref", lambda b: b["progress"]["current_progress_evidence_ref"].update(path="docs/progress/progress-handoff-detached-digest-forged.json"), "F19A_OLD_BINDING_INVALID"),
            ("package_count", lambda b: b["progress"]["f19a_document_successor_binding"].update(package_count=123), "F19A_DOCUMENT_BINDING_INVALID"),
        )
        for name, mutate, code in cases:
            with self.subTest(name=name):
                bundle = self.historical_bundle()
                mutate(bundle)
                self.assertIn(code, self.validate_historical(bundle, datetime.now(timezone.utc)))

    def test_rejects_frozen_old_event_prefix_and_scope(self):
        from scripts import f19a_document_successor_overlay as overlay

        raw = frozen_f19a(overlay.EVENTS).replace(
            b'"evt_f20_2120_worker_lease_revoked"', b'"evt_f20_2120_worker_lease_forged"', 1)
        bundle = self.historical_bundle()
        bundle["events"] = json.loads(raw)
        self.assertIn("F19A_FROZEN_PREFIX_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc), event_raw=raw))
        bundle = self.historical_bundle()
        bundle["events"]["events"][2122]["details"]["path_scope"].append("packages/api/runtime.py")
        self.assertIn("F19A_LEASE_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc)))

    def test_rejects_forged_new_event_identity_chain_and_product_scope(self):
        from scripts import f19a_document_successor_overlay as overlay

        for name, mutate, code in (
            ("identity", lambda b: b["events"]["events"][2120].update(actor_id="forged"), "F19A_EVENT_IDENTITY_INVALID"),
            ("chain", lambda b: b["events"]["events"][2122].update(previous_event_sha256="0" * 64), "F19A_EVENT_CHAIN_INVALID"),
            ("product", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/runtime.py"]), "F19A_SCOPE_INVALID"),
        ):
            with self.subTest(name=name):
                bundle = self.historical_bundle()
                mutate(bundle)
                self.assertIn(code, self.validate_historical(bundle, datetime.now(timezone.utc)))

    def test_rejects_detached_digest_forgery(self):
        from scripts import f19a_document_successor_overlay as overlay

        bundle = self.historical_bundle()
        with patch.object(overlay, "_load_digest", return_value={"progress": {"path": "packages/api/runtime.py"}}):
            self.assertIn("F19A_DIGEST_INVALID", self.validate_historical(
                bundle, datetime.now(timezone.utc)))

    def test_git_rejects_dirty_outside_scope_branch_and_divergent_base(self):
        from scripts import f19a_document_successor_overlay as overlay

        progress = self.historical_bundle()["progress"]
        with self.historical_git_facts(), patch.object(overlay, "_dirty", return_value=set()):
            self.assertEqual(overlay.collect_git(ROOT, progress), [])
            original_git = overlay._git
            with patch.object(overlay, "_dirty", return_value={"packages/api/runtime.py"}):
                self.assertEqual(overlay.collect_git(ROOT, progress), ["F19A_GIT_INVALID"])
            def wrong_branch(root, *args):
                return b"codex/forged\n" if args == ("branch", "--show-current") else original_git(root, *args)

            with patch.object(overlay, "_git", side_effect=wrong_branch):
                self.assertEqual(overlay.collect_git(ROOT, progress), ["F19A_GIT_INVALID"])

            def wrong_remote(root, *args):
                return b"0" * 40 + b"\n" if args == ("rev-parse", overlay.UPSTREAM) else original_git(root, *args)

            with patch.object(overlay, "_git", side_effect=wrong_remote):
                self.assertEqual(overlay.collect_git(ROOT, progress), ["F19A_GIT_INVALID"])
        original_run = overlay.subprocess.run
        seen = []

        def divergent(command, *args, **kwargs):
            if command == ["git", "merge-base", "--is-ancestor", overlay.BASE, "HEAD"]:
                seen.append("BASE_ONLY")
                return SimpleNamespace(returncode=1)
            return original_run(command, *args, **kwargs)

        with self.historical_git_facts(), patch.object(overlay, "_dirty", return_value=set()), \
                patch.object(overlay.subprocess, "run", side_effect=divergent):
            self.assertEqual(overlay.collect_git(ROOT, progress), ["F19A_GIT_INVALID"])
        self.assertEqual(seen, ["BASE_ONLY"])

    def test_closed_control_requires_exact_handoff_and_revocation(self):
        from scripts import f19a_document_successor_overlay as overlay

        rows = self.historical_bundle()["events"]["events"]
        worker, write = rows[2121]["details"], rows[2122]["details"]
        occurred_at = datetime.now(timezone.utc).isoformat()
        close = [
            {"event_type": "HANDOFF_RECORDED", "details": {
                "work_instruction_sha256": overlay.WI_HASH,
                "worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
                "accepted": False, "product_write_scope": [], "handoff_ref": overlay.HANDOFF,
                "handoff_sha256": overlay._sha((ROOT / overlay.HANDOFF).read_bytes()),
            }},
            {"event_type": "WRITE_LEASE_REVOKED", "details": {
                "lease_id": write["lease_id"], "write_fencing_token": overlay.WRITE_TOKEN,
                "reason": overlay.REASON,
            }},
            {"event_type": "WORKER_LEASE_REVOKED", "details": {
                "lease_id": worker["lease_id"], "execution_fencing_token": overlay.WORKER_TOKEN,
                "reason": overlay.REASON,
            }},
        ]
        self.assertEqual(overlay._close_valid(ROOT, close, worker, write), [])
        forged = deepcopy(close)
        forged[0]["details"]["handoff_sha256"] = "0" * 64
        self.assertIn("F19A_HANDOFF_EVENT_INVALID", overlay._close_valid(ROOT, forged, worker, write))
        self.assertIn("F19A_REVOCATION_EVENT_INVALID", overlay._close_valid(
            ROOT, [close[0], close[2], close[1]], worker, write))
        self.assertTrue(overlay._completed(worker, {
            **worker, "status": "REVOKED", "revoked_at": occurred_at}, occurred_at))
        self.assertFalse(overlay._completed(write, {
            **write, "status": "REVOKED", "revoked_at": occurred_at,
            "path_scope": ["packages/api/runtime.py"]}, occurred_at))
        progress = self.historical_bundle()["progress"]
        progress["event_sequence"] = 2126
        with patch.object(overlay, "_dirty", return_value={overlay.CHECKER}):
            self.assertEqual(overlay.collect_git(ROOT, progress), ["F19A_GIT_INVALID"])

    def test_checker_changes_only_new_mode_route_and_predecessor_code_is_frozen(self):
        from scripts import f19a_document_successor_overlay as overlay

        before = frozen_f19a(overlay.CHECKER)
        after = (ROOT / overlay.CHECKER).read_bytes()
        route = b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F19A_DOCUMENT_SUCCESSOR":'
        next_route = b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_SCOPED_FILTER_CONTRACT_DOCUMENT_SUCCESSOR":'
        self.assertEqual(after[after.index(route):after.index(next_route, after.index(route))],
                         before[before.index(route):before.index(next_route, before.index(route))])
        for path in ("scripts/f20_u01_contract_successor_overlay.py", "scripts/f20_u01_r48_close_overlay.py"):
            self.assertEqual((ROOT / path).read_bytes(), overlay._frozen(ROOT, path))


if __name__ == "__main__":
    unittest.main()
