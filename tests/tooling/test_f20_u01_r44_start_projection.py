"""R44 single writer start preserves R43 closure and U-01 non-acceptance."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class R44StartProjectionTests(unittest.TestCase):
    def test_exact_scope_ordered_events_and_unaccepted_state(self):
        from scripts import f20_u01_r44_start_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc), "r44health1005")
        previous = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"],
            cwd=ROOT)
        events = json.loads(output[overlay.EVENTS])
        progress = json.loads(output[overlay.PROGRESS])
        self.assertEqual(raw_event_object_prefix_bytes(output[overlay.EVENTS], overlay.START),
                         raw_event_object_prefix_bytes(previous, overlay.START))
        self.assertEqual(events["last_sequence"], overlay.END)
        self.assertEqual([row["event_type"] for row in events["events"][overlay.START:]],
                         list(overlay.KINDS))
        self.assertEqual(progress["worker_lease"]["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["write_lease"]["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["worker_lease"]["lease_epoch"], 59)
        self.assertEqual(progress["write_lease"]["write_epoch"], 59)
        self.assertEqual(progress["repository"]["product_write_scope"], overlay.SCOPE)
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"],
                         "RECOVERED_WITH_QUARANTINED_HISTORY")

    def test_projection_has_exact_checker_successor_and_no_overwrite(self):
        from scripts import f20_u01_r44_start_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc), "r44health1005")
        self.assertEqual(overlay.validate_outputs(ROOT, output), [])
        self.assertEqual(output[overlay.CHECKER], overlay._checker_successor(ROOT))
        self.assertTrue(set(overlay.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))
        current = json.loads((ROOT / overlay.PROGRESS).read_bytes())["event_sequence"]
        if current == overlay.START:
            self.assertFalse((ROOT / overlay.DIGEST).exists())
            self.assertFalse((ROOT / overlay.MANIFEST).exists())
        elif current == overlay.END:
            actual = {path: (ROOT / path).read_bytes() for path in output}
            self.assertEqual(overlay.validate_outputs(ROOT, actual), [])

    def test_materialize_rejects_backdated_clock_without_writes(self):
        from scripts import f20_u01_r44_start_overlay as overlay

        before = {path: (ROOT / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF,
            overlay.DIGEST, overlay.MANIFEST, overlay.CHECKER,
        ) if (ROOT / path).exists()}
        with self.assertRaisesRegex(RuntimeError, "R44_CLOCK_INVALID"):
            overlay.materialize(ROOT, datetime.now(timezone.utc) - timedelta(days=2),
                                "r44health1005")
        self.assertEqual(before, {path: (ROOT / path).read_bytes() for path in before})


if __name__ == "__main__":
    unittest.main()
