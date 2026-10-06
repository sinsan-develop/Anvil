"""F-20/U-01 document-only successor control validation."""

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
HISTORICAL_CLOSED67 = "afa49d2c31194c20df653273344116125bc11fda"


@lru_cache(maxsize=None)
def frozen67(path):
    from scripts import f20_u01_contract_successor_overlay as overlay
    return overlay._frozen(ROOT, path, HISTORICAL_CLOSED67)


class ContractSuccessorProjectionTests(unittest.TestCase):
    @staticmethod
    def closed67_fixture():
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = deepcopy(load_bundle(ROOT))
        bundle["progress"] = json.loads(frozen67(overlay.PROGRESS))
        bundle["events"] = json.loads(frozen67(overlay.EVENTS))
        bundle["handoff_text"] = frozen67(overlay.HANDOFF).decode("utf-8")
        bundle["handoff"] = extract_handoff_summary(bundle["handoff_text"])
        bundle["detached_digest"] = json.loads(frozen67(overlay.DIGEST))
        bundle["_detached_digest_path"] = overlay.DIGEST
        return bundle

    @staticmethod
    def validate_historical(bundle, now=None, *, event_raw=None):
        from scripts import f20_u01_contract_successor_overlay as overlay

        historical_paths = {
            overlay.PROGRESS, overlay.EVENTS, overlay.HANDOFF, overlay.DIGEST,
            overlay.CHECKER, *overlay.DOCS,
        }
        archive = {ROOT / path: frozen67(path) for path in historical_paths}
        original_read, original_stat = Path.read_bytes, Path.stat

        def read_historical(path):
            return archive.get(path, None) if path in archive else original_read(path)

        def stat_historical(path, *args, **kwargs):
            if path in archive:
                return SimpleNamespace(st_size=len(archive[path]))
            return original_stat(path, *args, **kwargs)

        with patch.object(Path, "read_bytes", read_historical), patch.object(Path, "stat", stat_historical):
            return overlay.validate_control(
                ROOT, bundle, now or datetime.now(timezone.utc), event_raw=event_raw or frozen67(overlay.EVENTS))

    @staticmethod
    @contextmanager
    def historical_git_facts():
        from scripts import f20_u01_contract_successor_overlay as overlay

        original_git = overlay._git
        fixed_delta = original_git(ROOT, "diff", "--name-only", "--no-renames",
                                   f"{overlay.DOCUMENT}..{HISTORICAL_CLOSED67}")

        def historical_git(root, *args):
            if args == ("rev-parse", "HEAD"):
                return (HISTORICAL_CLOSED67 + "\n").encode()
            if args == ("rev-parse", overlay.UPSTREAM):
                return (overlay.REMOTE_BASE + "\n").encode()
            if args == ("diff", "--name-only", "--no-renames", f"{overlay.DOCUMENT}..HEAD"):
                return fixed_delta
            return original_git(root, *args)

        with patch.object(overlay, "_git", side_effect=historical_git):
            yield

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
        rows = ContractSuccessorProjectionTests.closed67_fixture()["events"]["events"]
        return rows[2115]["details"], rows[2116]["details"]

    @staticmethod
    def active67_fixture():
        bundle = ContractSuccessorProjectionTests.closed67_fixture()
        rows = bundle["events"]["events"]
        worker, write = deepcopy(rows[2115]["details"]), deepcopy(rows[2116]["details"])
        bundle["events"]["events"] = rows[:2117]
        bundle["events"]["last_sequence"] = bundle["progress"]["event_sequence"] = 2117
        bundle["events"]["last_event_id"] = bundle["progress"]["last_event_id"] = rows[2116]["event_id"]
        bundle["progress"]["worker_lease"] = worker
        bundle["progress"]["write_lease"] = write
        return bundle

    def test_historical_closed67_validator_and_current_successor_are_distinct(self):
        historical = self.closed67_fixture()
        self.assertEqual(historical["progress"]["event_sequence"], 2120)
        self.assertEqual(self.validate_historical(historical), [])
        current = load_bundle(ROOT)
        self.assertEqual(current["progress"]["event_sequence"], 2129)
        self.assertEqual(current["progress"]["repository"]["projection_mode"],
                         "F20_U01_EPOCH67_TEST_COMPATIBILITY_SUCCESSOR")
        self.assertEqual(validate_bundle(current), [])
        for name, mutate, code in (
            ("order", lambda b: b["events"]["events"][2128].update(event_type="WORKER_LEASE_ISSUED"), "EPOCH69_EVENT_INVALID"),
            ("chain", lambda b: b["events"]["events"][2128].update(previous_event_sha256="0" * 64), "EPOCH69_EVENT_INVALID"),
            ("token", lambda b: b["events"]["events"][2128]["details"].update(write_fencing_token="forged"), "EPOCH69_LEASE_INVALID"),
            ("expiry", lambda b: b["events"]["events"][2128].update(occurred_at="2026-10-07T02:09:23+00:00"), "EPOCH69_EVENT_INVALID"),
            ("wi_hash", lambda b: b["events"]["events"][2126]["details"].update(sha256="0" * 64), "EPOCH69_WORK_INSTRUCTION_INVALID"),
            ("scope", lambda b: b["progress"]["repository"].update(product_write_scope=["packages/api/runtime.py"]), "EPOCH69_SCOPE_INVALID"),
            ("snapshot", lambda b: b["progress"].update(snapshot_hash="0" * 64), "PRG_SNAPSHOT_HASH_MISMATCH"),
        ):
            with self.subTest(name=name):
                forged = deepcopy(current)
                mutate(forged)
                self.assertIn(code, validate_bundle(forged))

        from scripts import check_project_progress as checker
        original_check_output = subprocess.check_output

        def outside_dirty(command, *args, **kwargs):
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b" M packages/api/runtime.py\n"
            return original_check_output(command, *args, **kwargs)

        with patch.object(subprocess, "check_output", side_effect=outside_dirty):
            self.assertEqual(checker._collect_epoch69_git(current), ["EPOCH69_GIT_INVALID"])

        worker = current["events"]["events"][2127]["details"]
        write = current["events"]["events"][2128]["details"]
        close_at = "2026-10-06T02:10:00+00:00"
        handoff_hash = checker._sha256(ROOT / "docs/progress/BUILD_HANDOFF.md")
        close = [
            {"event_type": "HANDOFF_RECORDED", "details": {
                "work_instruction_sha256": "AE545FE4A5854CE4926987C4EEC2497ED70A0D8B8D03CBFAB20B459ADF843653",
                "worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
                "accepted": False, "product_write_scope": [],
                "handoff_ref": "docs/progress/BUILD_HANDOFF.md", "handoff_sha256": handoff_hash,
            }},
            {"event_type": "WRITE_LEASE_REVOKED", "occurred_at": close_at, "details": {
                "lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
                "reason": "EPOCH67_TEST_COMPATIBILITY_VALIDATED_LOCAL_ONLY",
            }},
            {"event_type": "WORKER_LEASE_REVOKED", "occurred_at": close_at, "details": {
                "lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
                "reason": "EPOCH67_TEST_COMPATIBILITY_VALIDATED_LOCAL_ONLY",
            }},
        ]
        completed = {
            "completed_epoch67_test_compatibility_worker_lease": {
                **worker, "status": "REVOKED", "revoked_at": close_at},
            "completed_epoch67_test_compatibility_write_lease": {
                **write, "status": "REVOKED", "revoked_at": close_at},
        }
        close_check = getattr(checker, "_validate_epoch69_close_details", lambda *a: ["EPOCH69_CLOSE_UNVALIDATED"])
        self.assertEqual(close_check(ROOT, close, worker, write, completed), [])
        for name, index, field, forged in (
            ("handoff_hash", 0, "handoff_sha256", "0" * 64),
            ("write_token", 1, "write_fencing_token", "forged"),
            ("worker_reason", 2, "reason", "ACCEPTED"),
        ):
            with self.subTest(name=name):
                changed = deepcopy(close)
                changed[index]["details"][field] = forged
                self.assertIn("EPOCH69_CLOSE_INVALID", close_check(ROOT, changed, worker, write, completed))
        changed = deepcopy(completed)
        changed["completed_epoch67_test_compatibility_write_lease"]["path_scope"] = ["packages/api/runtime.py"]
        self.assertIn("EPOCH69_CLOSE_INVALID", close_check(ROOT, close, worker, write, changed))

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
                bundle = self.closed67_fixture()
                mutate(bundle)
                self.assertIn(code, self.validate_historical(bundle, now))
        self.assertIn(
            "SUCCESSOR_ACTIVE_LEASE_INVALID",
            self.validate_historical(self.active67_fixture(), overlay.EXPIRES67 + timedelta(seconds=1)),
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
                bundle = self.closed67_fixture()
                bundle["events"]["events"][2114]["details"][field] = forged
                self.assertIn("SUCCESSOR_WORK_INSTRUCTION_INVALID", self.validate_historical(
                    bundle, datetime.now(timezone.utc)))

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

        bundle = self.closed67_fixture()
        bundle["events"]["events"][2115]["details"]["status"] = "REVOKED"
        self.assertIn("SUCCESSOR_LEASE_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc)))

    def test_lease_issue_instant_is_bound_to_canonical_epoch(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        lease = deepcopy(self.issued66()[0])
        lease["issued_at"] = "2026-10-05T22:47:44+00:00"
        self.assertFalse(overlay._lease_valid66(lease, worker=True))

        bundle = self.closed67_fixture()
        future = overlay.EXPIRES67 - timedelta(seconds=1)
        bundle["events"]["events"][2115]["details"]["issued_at"] = future.isoformat()
        self.assertIn("SUCCESSOR_LEASE_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc)))

    def test_rejects_r48_prefix_mutation(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = self.closed67_fixture()
        raw = frozen67(overlay.EVENTS).replace(
            b'"evt_g05_legacy_migration"', b'"evt_g05_legacy_migratioX"', 1
        )
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_R48_PREFIX_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_r48_stream_header_mutation(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = self.closed67_fixture()
        raw = frozen67(overlay.EVENTS).replace(
            b'"stream_id": "anvil-build-main"', b'"stream_id": "forged-stream"', 1
        )
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_R48_PREFIX_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc), event_raw=raw))

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
                bundle = self.closed67_fixture()
                bundle["events"]["events"][2114][field] = forged
                self.assertIn("SUCCESSOR_EVENT_IDENTITY_INVALID", self.validate_historical(
                    bundle, datetime.now(timezone.utc)))

    def test_rejects_event_recorded_after_lease_expiry(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = self.closed67_fixture()
        bundle["events"]["events"][2116]["occurred_at"] = (
            overlay.EXPIRES67 + timedelta(seconds=1)).isoformat()
        self.assertIn("SUCCESSOR_EVENT_TIME_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc)))

    def test_rejects_detached_digest_pointing_outside_control_documents(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = self.closed67_fixture()
        bundle["detached_digest"]["progress"]["path"] = "packages/api/runtime.py"
        self.assertIn("SUCCESSOR_DETACHED_DIGEST_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc)))

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

        progress = self.closed67_fixture()["progress"]
        with self.historical_git_facts(), patch.object(overlay, "_dirty", return_value=set()):
            original = overlay._git
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

        progress = self.closed67_fixture()["progress"]
        original_run = overlay.subprocess.run
        observed = []

        def split_head(command, *args, **kwargs):
            if command == ["git", "merge-base", "--is-ancestor", overlay.BASE67, "HEAD"]:
                observed.append("BASE67_ONLY")
                return SimpleNamespace(returncode=1)
            return original_run(command, *args, **kwargs)

        with self.historical_git_facts(), patch.object(overlay, "_dirty", return_value=set()), \
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

        progress = self.closed67_fixture()["progress"]
        with self.historical_git_facts(), patch.object(overlay, "_dirty", return_value=set(overlay.EXACT2)):
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

        bundle = self.closed67_fixture()
        bundle["progress"]["completed_f20_u01_contract_close_test_worker_lease"]["path_scope"] = ["other"]
        self.assertIn("SUCCESSOR_HISTORICAL_LEASE_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc)))
        raw = frozen67(overlay.EVENTS).replace(
            b'"evt_f20_2114_worker_lease_revoked"', b'"evt_f20_2114_worker_lease_forged"', 1)
        bundle = self.closed67_fixture()
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_HISTORICAL_PREFIX_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_historical_successor_prefix_mutation(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        raw = frozen67(overlay.EVENTS).replace(
            b'"evt_f20_2104_worker_lease_issued"',
            b'"evt_f20_2104_worker_lease_forged"', 1,
        )
        bundle = self.closed67_fixture()
        bundle["events"] = json.loads(raw)
        self.assertIn("SUCCESSOR_HISTORICAL_PREFIX_INVALID", self.validate_historical(
            bundle, datetime.now(timezone.utc), event_raw=raw))

    def test_rejects_new_completed_lease_forgery(self):
        from scripts import f20_u01_contract_successor_overlay as overlay

        bundle = self.closed67_fixture()
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
