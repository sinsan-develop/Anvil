"""R46 close revokes the verified scoped-quarantine writer without accepting U-01."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]
HISTORICAL_HEAD = "eb2256f27c6eb8b559f6f8bb8fac15d9caa97979"


class R46CloseProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._isolated = TemporaryDirectory(prefix="anvil-r46-close-history-")
        cls.historical_root = Path(cls._isolated.name) / "repo"
        try:
            clone = subprocess.run(
                ["git", "clone", "--shared", "--no-checkout", "--quiet",
                 str(ROOT), str(cls.historical_root)], capture_output=True, check=False,
            )
            if clone.returncode != 0:
                raise AssertionError("R46_HISTORY_CLONE_FAILED")
            checkout = subprocess.run(
                ["git", "-C", str(cls.historical_root), "checkout", "--quiet",
                 "--detach", HISTORICAL_HEAD], capture_output=True, check=False,
            )
            if checkout.returncode != 0:
                raise AssertionError("R46_HISTORY_CHECKOUT_FAILED")
            head = subprocess.check_output(
                ["git", "-C", str(cls.historical_root), "rev-parse", "HEAD"], text=True,
            ).strip()
            status = subprocess.check_output(
                ["git", "-C", str(cls.historical_root), "status", "--porcelain"], text=True,
            ).strip()
            if head != HISTORICAL_HEAD or status:
                raise AssertionError("R46_HISTORY_IDENTITY_INVALID")
        except BaseException:
            cls._isolated.cleanup()
            raise

    @classmethod
    def tearDownClass(cls):
        cls._isolated.cleanup()

    def test_ordered_revocation_and_unaccepted_state(self):
        from scripts import f20_u01_r46_close_overlay as overlay

        output = overlay.project(self.historical_root, datetime.now(timezone.utc))
        old = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"],
            cwd=self.historical_root)
        events = json.loads(output[overlay.EVENTS])
        progress = json.loads(output[overlay.PROGRESS])
        self.assertEqual(raw_event_object_prefix_bytes(output[overlay.EVENTS], overlay.START),
                         raw_event_object_prefix_bytes(old, overlay.START))
        self.assertEqual(events["last_sequence"], overlay.END)
        self.assertEqual([row["event_type"] for row in events["events"][overlay.START:]],
                         list(overlay.KINDS))
        self.assertIsNone(progress["write_lease"])
        self.assertIsNone(progress["worker_lease"])
        self.assertEqual(progress["completed_f20_u01_r46_worker_lease"]["status"], "REVOKED")
        self.assertEqual(progress["completed_f20_u01_r46_write_lease"]["status"], "REVOKED")
        self.assertEqual(progress["repository"]["product_write_scope"], [])
        self.assertEqual(progress["repository"]["local_wsl_qa_head"], overlay.QA_HEAD)
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"],
                         "RECOVERED_WITH_QUARANTINED_HISTORY")
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")

    def test_authority_checker_and_exact_scope(self):
        from scripts import f20_u01_r46_close_overlay as overlay

        output = overlay.project(self.historical_root, datetime.now(timezone.utc))
        self.assertEqual(overlay.validate_outputs(self.historical_root, output), [])
        self.assertEqual(output[overlay.CHECKER], overlay._checker_successor(self.historical_root))
        self.assertTrue(overlay._authority_match(self.historical_root))
        self.assertTrue(set(overlay.prior.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))

    def test_materialize_rejects_backdated_clock_without_writes(self):
        from scripts import f20_u01_r46_close_overlay as overlay

        progress = json.loads(overlay._frozen(self.historical_root, overlay.PROGRESS))
        backdated = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
        before = {path: (self.historical_root / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF,
            overlay.DIGEST, overlay.MANIFEST, overlay.CHECKER,
        ) if (self.historical_root / path).exists()}
        with self.assertRaisesRegex(RuntimeError, "R46_CLOSE_CLOCK_OR_LEASE_INVALID"):
            overlay.materialize(self.historical_root, backdated)
        self.assertEqual(before, {path: (self.historical_root / path).read_bytes()
                                  for path in before})


if __name__ == "__main__":
    unittest.main()
