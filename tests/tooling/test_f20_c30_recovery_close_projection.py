"""Closing the verifier lease may not accept F-20 or alter Event history."""

from datetime import datetime, timedelta
import json
from pathlib import Path
import subprocess
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class C30RecoveryCloseTests(unittest.TestCase):
    def _project(self):
        try:
            from scripts import f20_c30_recovery_close_overlay as close
        except ImportError:
            self.fail("C30 recovery lease close projection is not implemented")
        progress = json.loads(subprocess.check_output(
            ["git", "show", f"{close.BASE}:{close.PROGRESS}"], cwd=ROOT))
        at = datetime.fromisoformat(progress["worker_lease"]["issued_at"]) + timedelta(minutes=30)
        return close, close.project(ROOT, at)

    def test_existing_2044_event_bytes_are_unchanged(self):
        close, output = self._project()
        old = (ROOT / close.EVENTS).read_bytes()
        self.assertEqual(raw_event_object_prefix_bytes(output[close.EVENTS], 2044),
                         raw_event_object_prefix_bytes(old, 2044))
        stream = json.loads(output[close.EVENTS])
        self.assertEqual(stream["last_sequence"], 2046)
        self.assertEqual([row["event_type"] for row in stream["events"][2044:]],
                         ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"])

    def test_epoch55_leases_are_revoked_but_c30_remains_blocked(self):
        close, output = self._project()
        progress = json.loads(output[close.PROGRESS])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual(progress["completed_f20_c30_v2_worker_lease"]["status"], "REVOKED")
        self.assertEqual(progress["completed_f20_c30_v2_write_lease"]["status"], "REVOKED")
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"], "OPEN_BLOCKING")
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertNotIn("F-20", progress["completed_packages"])

    def test_modified_close_event_is_rejected(self):
        close, output = self._project()
        stream = json.loads(output[close.EVENTS])
        stream["events"][-1]["details"]["reason"] = "UNVERIFIED"
        output[close.EVENTS] = json.dumps(stream).encode()
        self.assertTrue(close.validate_outputs(ROOT, output))


if __name__ == "__main__":
    unittest.main()
