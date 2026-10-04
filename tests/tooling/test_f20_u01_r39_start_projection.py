"""R39 grants a single writer only the Artifact Store source-gap correction."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]


class R39StartProjectionTests(unittest.TestCase):
    def test_exact_lease_and_unchanged_event_prefix(self):
        from scripts import f20_u01_r39_start_overlay as overlay

        result = overlay.project(ROOT, datetime.now(timezone.utc), "r39gap1004")
        previous = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"],
            cwd=ROOT)
        old = json.loads(previous)
        events = json.loads(result[overlay.EVENTS])
        progress = json.loads(result[overlay.PROGRESS])
        self.assertEqual(events["events"][:overlay.START], old["events"])
        self.assertEqual(events["last_sequence"], overlay.END)
        self.assertEqual([row["event_type"] for row in events["events"][overlay.START:]],
                         list(overlay.KINDS))
        self.assertEqual(progress["worker_lease"]["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["write_lease"]["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["worker_lease"]["lease_epoch"], 56)
        self.assertEqual(progress["write_lease"]["write_epoch"], 56)
        self.assertFalse(progress["f20_c30_event_integrity_incident"]["blocking"])
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"],
                         "RECOVERED_WITH_QUARANTINED_HISTORY")
        self.assertFalse(progress["c30_event_generation"]["accepted"])
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")

    def test_scope_and_predecessor_are_frozen(self):
        from scripts import f20_u01_r39_start_overlay as overlay

        self.assertEqual(overlay.SCOPE, [
            "packages/observability/projection.py",
            "tests/observability/test_f13_operations.py",
            "tests/api/test_f20_u01_r10_dashboard_api.py",
            "docs/04_test_reports/F-20_U01_R39_ARTIFACT_HEALTH_GAP_RESULT.md",
        ])
        self.assertTrue(set(overlay.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))
        self.assertFalse(set(overlay.FROZEN_PRIOR) & overlay.CONTROL_SCOPE)
        self.assertEqual(overlay.validate_outputs(
            ROOT, overlay.project(ROOT, datetime.now(timezone.utc), "r39gap1004")), [])


if __name__ == "__main__":
    unittest.main()
