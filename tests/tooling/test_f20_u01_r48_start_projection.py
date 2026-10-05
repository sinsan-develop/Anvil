"""R48 start is a bounded successor of the immutable R47 close."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]
NONCE_A = "1" * 32
NONCE_B = "2" * 32


class R48StartProjectionTests(unittest.TestCase):
    def test_frozen_event_prefix_and_distinct_active_fences(self):
        from scripts import f20_u01_r48_start_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc), NONCE_A, NONCE_B)
        previous = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"], cwd=ROOT,
        )
        events = json.loads(output[overlay.EVENTS])["events"]
        progress = json.loads(output[overlay.PROGRESS])
        self.assertEqual(raw_event_object_prefix_bytes(output[overlay.EVENTS], overlay.START),
                         raw_event_object_prefix_bytes(previous, overlay.START))
        self.assertEqual([row["event_type"] for row in events[overlay.START:]], list(overlay.KINDS))
        self.assertEqual(progress["event_sequence"], overlay.END)
        self.assertEqual(progress["worker_lease"]["lease_epoch"], 64)
        self.assertEqual(progress["write_lease"]["write_epoch"], 64)
        self.assertNotEqual(progress["worker_lease"]["execution_fencing_token"],
                            progress["write_lease"]["write_fencing_token"])
        self.assertEqual(progress["repository"]["product_write_scope"], overlay.SCOPE)
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")

    def test_exact_scope_checker_and_frozen_outputs(self):
        from scripts import f20_u01_r48_start_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc), NONCE_A, NONCE_B)
        self.assertEqual(overlay.validate_outputs(ROOT, output), [])
        self.assertEqual(overlay._checker_successor(ROOT), output[overlay.CHECKER])
        self.assertTrue(set(overlay.prior.prior.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))
        self.assertEqual(len(overlay.SCOPE), len(set(overlay.SCOPE)))

    def test_unrelated_dirty_path_is_rejected(self):
        from scripts import f20_u01_r48_start_overlay as overlay

        progress = json.loads((ROOT / overlay.PROGRESS).read_text(encoding="utf-8"))
        progress["repository"]["projection_mode"] = overlay.MODE
        with patch.object(overlay, "_dirty", return_value={"tests/tooling/unrelated.py"}):
            self.assertEqual(overlay.collect_git(ROOT, progress), ["R48_START_GIT_INVALID"])


if __name__ == "__main__":
    unittest.main()
