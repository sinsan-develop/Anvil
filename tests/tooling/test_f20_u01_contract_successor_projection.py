"""F-20/U-01 document-only successor control validation."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.check_project_progress import load_bundle, validate_bundle


ROOT = Path(__file__).resolve().parents[2]


class ContractSuccessorProjectionTests(unittest.TestCase):
    @staticmethod
    def historical_issued():
        _, rows = ContractSuccessorProjectionTests.closed66()
        return rows[2103]["details"], rows[2104]["details"]

    @staticmethod
    def closed66():
        from scripts import f20_u01_contract_successor_overlay as overlay
        progress = json.loads(overlay._frozen(ROOT, overlay.PROGRESS, overlay.BASE67))
        events = json.loads(overlay._frozen(ROOT, overlay.EVENTS, overlay.BASE67))["events"]
        return progress, events

    @staticmethod
    def issued66():
        _, rows = ContractSuccessorProjectionTests.closed66()
        return rows[2109]["details"], rows[2110]["details"]

    @staticmethod
    def issued67():
        rows = load_bundle(ROOT)["events"]["events"]
        return rows[2115]["details"], rows[2116]["details"]

    @staticmethod
    def active67_fixture():
        bundle = deepcopy(load_bundle(ROOT))
        rows = bundle["events"]["events"]
        worker, write = deepcopy(rows[2115]["details"]), deepcopy(rows[2116]["details"])
        bundle["events"]["events"] = rows[:2117]
        bundle["events"]["last_sequence"] = bundle["progress"]["event_sequence"] = 2117
        bundle["events"]["last_event_id"] = bundle["progress"]["last_event_id"] = rows[2116]["event_id"]
        bundle["progress"]["worker_lease"] = worker
        bundle["progress"]["write_lease"] = write
        return bundle

    def test_current_successor_routes_to_its_control_validator(self):
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
            ("order", lambda b: b["events"]["events"][2115].update(event_type="WRITE_LEASE_ISSUED"), "SUCCESSOR_EVENT_ORDER_INVALID"),
            ("token", lambda b: b["events"]["events"][2116]["details"].update(write_fencing_token="forged"), "SUCCESSOR_LEASE_INVALID"),
            ("product_scope", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/runtime.py"]), "SUCCESSOR_SCOPE_INVALID"),
            ("write_scope", lambda b: b["events"]["events"][2116]["details"]["path_scope"].append("packages/api/runtime.py"), "SUCCESSOR_LEASE_INVALID"),
            ("doc_scope", lambda b: b["events"]["events"][2114]["details"]["developer_exact_paths"].append("docs/other.md"), "SUCCESSOR_WORK_INSTRUCTION_INVALID"),
            ("wi_hash", lambda b: b["events"]["events"][2114]["details"].update(sha256="0" * 64), "SUCCESSOR_WORK_INSTRUCTION_INVALID"),
        )
        for name, mutate, code in cases:
            with self.subTest(name=name):
                bundle = deepcopy(load_bundle(ROOT))
                mutate(bundle)
                self.assertIn(code, overlay.validate_control(ROOT, bundle, now))
        self.assertIn(
            "SUCCESSOR_ACTIVE_LEASE_INVALID",
            overlay.validate_control(ROOT, self.active67_fixture(), overlay.EXPIRES67 + timedelta(seconds=1)),
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
                bundle["events"]["events"][2114]["details"][field] = forged
                self.assertIn("SUCCESSOR_WORK_INSTRUCTION_INVALID", overlay.validate_control(
                    ROOT, bundle, datetime.now(timezone.utc)))

    def test_issued_rows_require_active_status(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        for worker in (True, False):
            with self.subTest(worker=worker):
                issued = deepcopy(self.issued66()[0 if worker else 1])
                issued["status"] = "REVOKED"
                self.assertFalse(overlay._lease_valid66(issued, worker=worker))

    def test_completed_lease_matches_issued_row_and_revoke_instant(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        worker_issued, write_issued = self.historical_issued()
        progress, events = self.closed66()
        for worker in (True, False):
            with self.subTest(worker=worker):
                key = ("completed_f20_u01_contract_control_worker_lease" if worker else
                       "completed_f20_u01_contract_control_write_lease")
                issued = worker_issued if worker else write_issued
                completed = progress[key]
                revoked_at = events[2107 if worker else 2106]["occurred_at"]
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
        bundle["events"]["events"][2115]["details"]["status"] = "REVOKED"
        self.assertIn("SUCCESSOR_LEASE_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc)))

    def test_lease_issue_instant_is_bound_to_canonical_epoch(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        lease = deepcopy(self.issued66()[0])
        lease["issued_at"] = "2026-10-05T22:47:44+00:00"
        self.assertFalse(overlay._lease_valid66(lease, worker=True))

        bundle = deepcopy(load_bundle(ROOT))
        future = overlay.EXPIRES67 - timedelta(seconds=1)
        bundle["events"]["events"][2115]["details"]["issued_at"] = future.isoformat()
        self.assertIn("SUCCESSOR_LEASE_INVALID", overlay.validate_control(
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
                bundle["events"]["events"][2114][field] = forged
                self.assertIn("SUCCESSOR_EVENT_IDENTITY_INVALID", overlay.validate_control(
                    ROOT, bundle, datetime.now(timezone.utc)))

    def test_rejects_event_recorded_after_lease_expiry(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["events"]["events"][2116]["occurred_at"] = (
            overlay.EXPIRES67 + timedelta(seconds=1)).isoformat()
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
        with patch.object(overlay, "_dirty", return_value=set()):
            self.assertEqual(overlay.collect_git(ROOT, progress), [])
            for variant in ("branch", "remote", "dirty", "committed_scope"):
                with self.subTest(variant=variant), patch.object(overlay, "_git", side_effect=changed(variant)):
                    if variant == "dirty":
                        with patch.object(overlay, "_dirty", return_value={"packages/api/runtime.py"}):
                            self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])
                    else:
                        self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])

    def test_epoch67_requires_baseline_ancestor_even_when_other_git_checks_pass(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        progress = load_bundle(ROOT)["progress"]
        original_run = overlay.subprocess.run
        observed = []

        def split_head(command, *args, **kwargs):
            if command == ["git", "merge-base", "--is-ancestor", overlay.BASE67, "HEAD"]:
                observed.append("BASE67_ONLY")
                return SimpleNamespace(returncode=1)
            return original_run(command, *args, **kwargs)

        with patch.object(overlay, "_dirty", return_value=set()), \
                patch.object(overlay.subprocess, "run", side_effect=split_head):
            self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])
        self.assertEqual(observed, ["BASE67_ONLY"])

    def test_close_events_bind_handoff_and_revoke_write_before_worker(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        worker, write = self.issued66()
        handoff = {
            "work_instruction_sha256": overlay.WI66_HASH,
            "worker_lease_id": worker["lease_id"],
            "write_lease_id": write["lease_id"],
            "accepted": False,
            "product_write_scope": [],
            "handoff_ref": overlay.HANDOFF,
            "handoff_sha256": overlay._sha((ROOT / overlay.HANDOFF).read_bytes()),
        }
        reason = "CONTRACT_CLOSE_TEST_SUCCESSOR_VALIDATED_LOCAL_ONLY"
        rows = [
            {"event_type": "HANDOFF_RECORDED", "details": handoff},
            {"event_type": "WRITE_LEASE_REVOKED", "details": {
                "lease_id": write["lease_id"], "write_fencing_token": overlay.WRITE_TOKEN66,
                "reason": reason,
            }},
            {"event_type": "WORKER_LEASE_REVOKED", "details": {
                "lease_id": worker["lease_id"], "execution_fencing_token": overlay.WORKER_TOKEN66,
                "reason": reason,
            }},
        ]
        self.assertEqual(overlay.validate_close_test_events(ROOT, rows, worker, write), [])
        forged = deepcopy(rows)
        forged[0]["details"]["work_instruction_sha256"] = "0" * 64
        self.assertIn("SUCCESSOR_HANDOFF_EVENT_INVALID",
                      overlay.validate_close_test_events(ROOT, forged, worker, write))
        reordered = [rows[0], rows[2], rows[1]]
        self.assertIn("SUCCESSOR_REVOCATION_EVENT_INVALID",
                      overlay.validate_close_test_events(ROOT, reordered, worker, write))
        wrong_reason = deepcopy(rows)
        wrong_reason[1]["details"]["reason"] = "ACCEPTED"
        self.assertIn("SUCCESSOR_REVOCATION_EVENT_INVALID",
                      overlay.validate_close_test_events(ROOT, wrong_reason, worker, write))

    def test_actual_closed66_snapshot_binds_revocations_and_rejects_dirty(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        progress, rows = self.closed66()
        worker, write = self.issued66()
        self.assertEqual(overlay._sha(overlay._frozen(ROOT, overlay.EVENTS, overlay.BASE67)),
                         "11C11CFB8A2B27E15CDB298E7A9BC5D50C53A0CBD200E8C6003609D3B8BDBAF3")
        self.assertEqual(progress["event_sequence"], 2114)
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual([row["event_type"] for row in rows[2111:2114]], list(overlay.KINDS_CLOSE))
        self.assertTrue(overlay.completed_lease_matches(
            worker, progress["completed_f20_u01_contract_close_test_worker_lease"], rows[2113]["occurred_at"]))
        self.assertTrue(overlay.completed_lease_matches(
            write, progress["completed_f20_u01_contract_close_test_write_lease"], rows[2112]["occurred_at"]))
        with patch.object(overlay, "_dirty", return_value={"scripts/f20_u01_contract_successor_overlay.py"}):
            self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])

    def test_epoch67_active_dirty_is_scoped_but_closed_dirty_is_rejected(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        progress = deepcopy(load_bundle(ROOT)["progress"])
        with patch.object(overlay, "_dirty", return_value=set(overlay.EXACT2)):
            progress["event_sequence"] = 2117
            self.assertEqual(overlay.collect_git(ROOT, progress), [])
            progress["event_sequence"] = 2120
            self.assertEqual(overlay.collect_git(ROOT, progress), ["SUCCESSOR_GIT_INVALID"])

    def test_epoch67_close_events_and_completed_lease_are_exact(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        worker, write = self.issued67()
        instant = datetime.now(timezone.utc).isoformat()
        reason = "CLOSED_FIXTURE_SUCCESSOR_VALIDATED_LOCAL_ONLY"
        rows = [
            {"event_type": "HANDOFF_RECORDED", "details": {
                "work_instruction_sha256": overlay.WI67_HASH,
                "worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
                "accepted": False, "product_write_scope": [], "handoff_ref": overlay.HANDOFF,
                "handoff_sha256": overlay._sha((ROOT / overlay.HANDOFF).read_bytes()),
            }},
            {"event_type": "WRITE_LEASE_REVOKED", "details": {
                "lease_id": write["lease_id"], "write_fencing_token": overlay.WRITE_TOKEN67,
                "reason": reason,
            }},
            {"event_type": "WORKER_LEASE_REVOKED", "details": {
                "lease_id": worker["lease_id"], "execution_fencing_token": overlay.WORKER_TOKEN67,
                "reason": reason,
            }},
        ]
        self.assertEqual(overlay.validate_closed_fixture_events(ROOT, rows, worker, write), [])
        for index, field, forged, code in (
            (0, "work_instruction_sha256", "0" * 64, "SUCCESSOR_HANDOFF_EVENT_INVALID"),
            (1, "write_fencing_token", "forged", "SUCCESSOR_REVOCATION_EVENT_INVALID"),
            (2, "reason", "ACCEPTED", "SUCCESSOR_REVOCATION_EVENT_INVALID"),
        ):
            with self.subTest(index=index, field=field):
                changed = deepcopy(rows)
                changed[index]["details"][field] = forged
                self.assertIn(code, overlay.validate_closed_fixture_events(ROOT, changed, worker, write))
        self.assertTrue(overlay.completed_lease_matches(
            worker, {**worker, "status": "REVOKED", "revoked_at": instant}, instant))
        self.assertFalse(overlay.completed_lease_matches(
            write, {**write, "status": "REVOKED", "revoked_at": instant, "path_scope": ["other"]}, instant))

    def test_epoch67_rejects_forged_historical_completion_and_seq2114_prefix(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["progress"]["completed_f20_u01_contract_close_test_worker_lease"]["path_scope"] = ["other"]
        self.assertIn("SUCCESSOR_HISTORICAL_LEASE_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc)))
        raw = (ROOT / overlay.EVENTS).read_bytes().replace(
            b'"evt_f20_2114_worker_lease_revoked"', b'"evt_f20_2114_worker_lease_forged"', 1)
        bundle = deepcopy(load_bundle(ROOT))
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_HISTORICAL_PREFIX_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_historical_successor_prefix_mutation(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        raw = (ROOT / overlay.EVENTS).read_bytes().replace(
            b'"evt_f20_2104_worker_lease_issued"',
            b'"evt_f20_2104_worker_lease_forged"', 1,
        )
        bundle = deepcopy(load_bundle(ROOT))
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_HISTORICAL_PREFIX_INVALID", overlay.validate_control(
            ROOT, bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_new_completed_lease_forgery(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        worker, write = self.issued67()
        rows = bundle["events"]["events"]
        for item in ("worker", "write"):
            with self.subTest(item=item):
                issued = worker if item == "worker" else write
                completed = {**issued, "status": "REVOKED", "revoked_at": rows[2110]["occurred_at"]}
                self.assertTrue(overlay.completed_lease_matches(issued, completed, rows[2110]["occurred_at"]))
                completed["path_scope"] = ["packages/api/runtime.py"]
                self.assertFalse(overlay.completed_lease_matches(issued, completed, rows[2110]["occurred_at"]))


if __name__ == "__main__":
    unittest.main()
