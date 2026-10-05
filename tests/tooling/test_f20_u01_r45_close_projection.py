"""R45 close revokes the verified Queue-health writer without accepting U-01."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class R45CloseProjectionTests(unittest.TestCase):
    def test_ordered_revocation_and_unaccepted_state(self):
        from scripts import f20_u01_r45_close_overlay as overlay

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
                         list(overlay.KINDS))
        self.assertIsNone(progress["write_lease"])
        self.assertIsNone(progress["worker_lease"])
        self.assertEqual(progress["completed_f20_u01_r45_worker_lease"]["status"], "REVOKED")
        self.assertEqual(progress["completed_f20_u01_r45_write_lease"]["status"], "REVOKED")
        self.assertEqual(progress["repository"]["product_write_scope"], [])
        self.assertEqual(progress["repository"]["local_wsl_qa_head"], overlay.QA_HEAD)
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"],
                         "RECOVERED_WITH_QUARANTINED_HISTORY")
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")

    def test_authority_checker_and_exact_scope(self):
        from scripts import f20_u01_r45_close_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc))
        self.assertEqual(overlay.validate_outputs(ROOT, output), [])
        self.assertEqual(output[overlay.CHECKER], overlay._checker_successor(ROOT))
        self.assertTrue(overlay._authority_match(ROOT))
        self.assertTrue(set(overlay.prior.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))

    def test_materialize_rejects_backdated_clock_without_writes(self):
        from scripts import f20_u01_r45_close_overlay as overlay

        progress = json.loads(overlay._frozen(ROOT, overlay.PROGRESS))
        backdated = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
        before = {path: (ROOT / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF,
            overlay.DIGEST, overlay.MANIFEST, overlay.CHECKER,
        ) if (ROOT / path).exists()}
        with self.assertRaisesRegex(RuntimeError, "R45_CLOSE_CLOCK_OR_LEASE_INVALID"):
            overlay.materialize(ROOT, backdated)
        self.assertEqual(before, {path: (ROOT / path).read_bytes() for path in before})


if __name__ == "__main__":
    unittest.main()
