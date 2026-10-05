"""F-20/U-01 document-only successor control validation."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from scripts.check_project_progress import load_bundle, validate_bundle


ROOT = Path(__file__).resolve().parents[2]


class ContractSuccessorProjectionTests(unittest.TestCase):
    def test_active_successor_routes_to_its_control_validator(self):
        bundle = load_bundle(ROOT)
        self.assertEqual(
            bundle["progress"]["repository"]["projection_mode"],
            "F20_U01_SCOPED_FILTER_CONTRACT_DOCUMENT_SUCCESSOR",
        )
        self.assertEqual(validate_bundle(bundle), [])

    def test_rejects_forged_order_token_scope_and_expiry(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        now = datetime.now(timezone.utc)
        cases = (
            ("order", lambda b: b["events"]["events"][2103].update(event_type="WRITE_LEASE_ISSUED"), "SUCCESSOR_EVENT_ORDER_INVALID"),
            ("token", lambda b: b["events"]["events"][2104]["details"].update(write_fencing_token="forged"), "SUCCESSOR_LEASE_INVALID"),
            ("product_scope", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/runtime.py"]), "SUCCESSOR_SCOPE_INVALID"),
            ("write_scope", lambda b: b["events"]["events"][2104]["details"]["path_scope"].append("packages/api/runtime.py"), "SUCCESSOR_LEASE_INVALID"),
            ("doc_scope", lambda b: b["events"]["events"][2102]["details"]["developer_exact_paths"].append("docs/other.md"), "SUCCESSOR_WORK_INSTRUCTION_INVALID"),
            ("wi_hash", lambda b: b["events"]["events"][2102]["details"].update(sha256="0" * 64), "SUCCESSOR_WORK_INSTRUCTION_INVALID"),
        )
        for name, mutate, code in cases:
            with self.subTest(name=name):
                bundle = deepcopy(load_bundle(ROOT))
                mutate(bundle)
                self.assertIn(code, overlay.validate_control(ROOT, bundle, now))
        self.assertIn(
            "SUCCESSOR_ACTIVE_LEASE_INVALID",
            overlay.validate_control(ROOT, load_bundle(ROOT), overlay.EXPIRES + timedelta(seconds=1)),
        )

    def test_rejects_forged_work_instruction_authority(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        for field, forged in (
            ("classification", "UNAPPROVED"),
            ("approval_ref", "codex://threads/forged"),
            ("parent_work_instruction", "docs/work_orders/other.md"),
            ("revision_reason", "OTHER"),
            ("package_status", "ACCEPTED"),
        ):
            with self.subTest(field=field):
                bundle = deepcopy(load_bundle(ROOT))
                bundle["events"]["events"][2102]["details"][field] = forged
                self.assertIn("SUCCESSOR_WORK_INSTRUCTION_INVALID", overlay.validate_control(
                    ROOT, bundle, datetime.now(timezone.utc)))

    def test_issued_rows_require_active_status(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        for worker in (True, False):
            with self.subTest(worker=worker):
                key = "worker_lease" if worker else "write_lease"
                issued = deepcopy(load_bundle(ROOT)["progress"][key])
                issued["status"] = "REVOKED"
                self.assertFalse(overlay._lease_valid(issued, worker=worker))

    def test_completed_lease_matches_issued_row_and_revoke_instant(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = load_bundle(ROOT)
        for worker in (True, False):
            with self.subTest(worker=worker):
                key = "worker_lease" if worker else "write_lease"
                issued = bundle["progress"][key]
                revoked_at = "2026-10-05T19:00:00+00:00"
                completed = {**issued, "status": "REVOKED", "revoked_at": revoked_at}
                self.assertTrue(overlay.completed_lease_matches(issued, completed, revoked_at))
                changed = deepcopy(completed)
                changed["path_scope"] = ["packages/api/runtime.py"]
                self.assertFalse(overlay.completed_lease_matches(issued, changed, revoked_at))
                changed = deepcopy(completed)
                changed["revoked_at"] = "2026-10-05T19:00:01+00:00"
                self.assertFalse(overlay.completed_lease_matches(issued, changed, revoked_at))

    def test_active_lease_must_be_active_and_already_issued(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["events"]["events"][2103]["details"]["status"] = "REVOKED"
        bundle["progress"]["worker_lease"]["status"] = "REVOKED"
        self.assertIn("SUCCESSOR_ACTIVE_LEASE_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc)))

    def test_lease_issue_instant_is_bound_to_canonical_epoch(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        lease = deepcopy(load_bundle(ROOT)["progress"]["worker_lease"])
        lease["issued_at"] = "2026-10-05T17:00:09+00:00"
        self.assertFalse(overlay._lease_valid(lease, worker=True))

        bundle = deepcopy(load_bundle(ROOT))
        future = overlay.EXPIRES - timedelta(seconds=1)
        bundle["events"]["events"][2103]["details"]["issued_at"] = future.isoformat()
        bundle["progress"]["worker_lease"]["issued_at"] = future.isoformat()
        self.assertIn("SUCCESSOR_ACTIVE_LEASE_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc)))

    def test_rejects_r48_prefix_mutation(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        raw = (ROOT / overlay.EVENTS).read_bytes().replace(
            b'"evt_g05_legacy_migration"', b'"evt_g05_legacy_migratioX"', 1
        )
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_R48_PREFIX_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_r48_stream_header_mutation(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        raw = (ROOT / overlay.EVENTS).read_bytes().replace(
            b'"stream_id": "anvil-build-main"', b'"stream_id": "forged-stream"', 1
        )
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_R48_PREFIX_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_forged_successor_event_identity(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        for field, forged in (
            ("event_id", "evt_f20_2103_forged"),
            ("actor_id", "developer-primary"),
            ("actor_type", "HUMAN"),
            ("project_id", "other"),
            ("work_package_id", "C-21"),
            ("step_id", "F20_U01_R48_CRITICAL_ACK_CLOSE"),
        ):
            with self.subTest(field=field):
                bundle = deepcopy(load_bundle(ROOT))
                bundle["events"]["events"][2102][field] = forged
                self.assertIn("SUCCESSOR_EVENT_IDENTITY_INVALID", overlay.validate_control(
                    ROOT, bundle, datetime.now(timezone.utc)))

    def test_rejects_event_recorded_after_lease_expiry(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["events"]["events"][2104]["occurred_at"] = (
            overlay.EXPIRES + timedelta(seconds=1)).isoformat()
        self.assertIn("SUCCESSOR_EVENT_TIME_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc)))

    def test_rejects_detached_digest_pointing_outside_control_documents(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["detached_digest"]["progress"]["path"] = "packages/api/runtime.py"
        self.assertIn("SUCCESSOR_DETACHED_DIGEST_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc)))

    def test_rejects_git_branch_remote_and_dirty_scope(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        original = overlay._git
        def changed(*args):
            def fake(root, *command):
                if command == ("branch", "--show-current") and args[0] == "branch":
                    return b"codex/other\n"
                if command == ("rev-parse", overlay.UPSTREAM) and args[0] == "remote":
                    return b"0" * 40 + b"\n"
                if command == ("status", "--porcelain=v1", "-uall") and args[0] == "dirty":
                    return b" M packages/api/runtime.py\n"
                if command == ("diff", "--name-only", "--no-renames", f"{overlay.DOCUMENT}..HEAD") and args[0] == "committed_scope":
                    return b"packages/api/runtime.py\n"
                return original(root, *command)
            return fake

        progress = load_bundle(ROOT)["progress"]
        with patch.object(overlay, "_dirty", return_value=set(overlay.EXACT3)):
            self.assertEqual(overlay.collect_git(ROOT, progress), [])
            for variant in ("branch", "remote", "dirty", "committed_scope"):
                with self.subTest(variant=variant), patch.object(overlay, "_git", side_effect=changed(variant)):
                    if variant == "dirty":
                        with patch.object(overlay, "_dirty", return_value={"packages/api/runtime.py"}):
                            self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])
                    else:
                        self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])

    def test_close_events_bind_handoff_and_revoke_write_before_worker(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = load_bundle(ROOT)
        worker = bundle["progress"]["worker_lease"]
        write = bundle["progress"]["write_lease"]
        handoff = {
            "work_instruction_sha256": overlay.WI_HASH,
            "worker_lease_id": worker["lease_id"],
            "write_lease_id": write["lease_id"],
            "accepted": False,
            "product_write_scope": [],
            "handoff_ref": overlay.HANDOFF,
            "handoff_sha256": overlay._sha((ROOT / overlay.HANDOFF).read_bytes()),
        }
        reason = "CONTRACT_DOCUMENT_SUCCESSOR_CONTROL_VALIDATED_LOCAL_ONLY"
        rows = [
            {"event_type": "HANDOFF_RECORDED", "details": handoff},
            {"event_type": "WRITE_LEASE_REVOKED", "details": {
                "lease_id": write["lease_id"], "write_fencing_token": overlay.WRITE_TOKEN,
                "reason": reason,
            }},
            {"event_type": "WORKER_LEASE_REVOKED", "details": {
                "lease_id": worker["lease_id"], "execution_fencing_token": overlay.WORKER_TOKEN,
                "reason": reason,
            }},
        ]
        self.assertEqual(overlay.validate_close_events(ROOT, rows, worker, write), [])
        forged = deepcopy(rows)
        forged[0]["details"]["work_instruction_sha256"] = "0" * 64
        self.assertIn("SUCCESSOR_HANDOFF_EVENT_INVALID",
                      overlay.validate_close_events(ROOT, forged, worker, write))
        reordered = [rows[0], rows[2], rows[1]]
        self.assertIn("SUCCESSOR_REVOCATION_EVENT_INVALID",
                      overlay.validate_close_events(ROOT, reordered, worker, write))
        wrong_reason = deepcopy(rows)
        wrong_reason[1]["details"]["reason"] = "ACCEPTED"
        self.assertIn("SUCCESSOR_REVOCATION_EVENT_INVALID",
                      overlay.validate_close_events(ROOT, wrong_reason, worker, write))


if __name__ == "__main__":
    unittest.main()
