"""R42 close revokes exact5 writer after same-SHA WSL QA, without acceptance."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class R42CloseProjectionTests(unittest.TestCase):
    def test_ordered_revocation_and_unaccepted_state(self):
        from scripts import f20_u01_r42_close_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc))
        old = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"],
            cwd=ROOT)
        events = json.loads(output[overlay.EVENTS])
        progress = json.loads(output[overlay.PROGRESS])
        self.assertEqual(raw_event_object_prefix_bytes(output[overlay.EVENTS], overlay.START),
                         raw_event_object_prefix_bytes(old, overlay.START))
        self.assertEqual(events["last_sequence"], overlay.END)
        self.assertEqual([row["event_type"] for row in events["events"][overlay.START:]],
                         ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"])
        self.assertIsNone(progress["write_lease"])
        self.assertIsNone(progress["worker_lease"])
        self.assertEqual(progress["completed_f20_u01_r42_worker_lease"]["status"], "REVOKED")
        self.assertEqual(progress["completed_f20_u01_r42_write_lease"]["status"], "REVOKED")
        self.assertEqual(progress["repository"]["product_write_scope"], [])
        self.assertEqual(progress["repository"]["local_wsl_qa_head"], overlay.QA_HEAD)
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"],
                         "RECOVERED_WITH_QUARANTINED_HISTORY")
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")

    def test_exact_authority_and_checker_successor(self):
        from scripts import f20_u01_r42_close_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc))
        self.assertEqual(overlay.validate_outputs(ROOT, output), [])
        self.assertEqual(output[overlay.CHECKER], overlay._checker_successor(ROOT))
        self.assertTrue(overlay._authority_match(ROOT))
        self.assertTrue(set(overlay.prior.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))


if __name__ == "__main__":
    unittest.main()
