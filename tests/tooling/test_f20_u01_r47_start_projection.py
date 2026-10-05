"""R47 delegated internal start preserves R46 closure and distinct fences."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class R47StartProjectionTests(unittest.TestCase):
    def _ready(self):
        from scripts import f20_u01_r47_start_overlay as overlay

        self.assertNotEqual(overlay.BASE, "PREP_COMMIT_PENDING")
        return overlay

    def test_append_only_distinct_fences_scope_and_internal_approval(self):
        overlay = self._ready()
        output = overlay.project(ROOT, datetime.now(timezone.utc), "a" * 32, "b" * 32)
        previous = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"],
            cwd=ROOT,
        )
        stream = json.loads(output[overlay.EVENTS])
        progress = json.loads(output[overlay.PROGRESS])
        self.assertEqual(raw_event_object_prefix_bytes(output[overlay.EVENTS], overlay.START),
                         raw_event_object_prefix_bytes(previous, overlay.START))
        self.assertEqual(stream["last_sequence"], overlay.END)
        self.assertEqual([row["event_type"] for row in stream["events"][overlay.START:]],
                         list(overlay.KINDS))
        issued = stream["events"][overlay.START]["details"]
        self.assertEqual(issued["classification"], "PMO_DELEGATED_INTERNAL_APPROVED")
        self.assertEqual(issued["approval_ref"],
                         "codex://threads/01a054f5-c2b4-7af0-b31a-c8148ef74642")
        self.assertEqual(progress["worker_lease"]["lease_epoch"], 63)
        self.assertEqual(progress["write_lease"]["write_epoch"], 63)
        self.assertNotEqual(progress["worker_lease"]["execution_fencing_token"],
                            progress["write_lease"]["write_fencing_token"])
        self.assertEqual(progress["worker_lease"]["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["write_lease"]["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["repository"]["product_write_scope"], overlay.SCOPE)
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertEqual(overlay.validate_outputs(ROOT, output), [])

    def test_rejects_duplicate_fence_and_backdated_clock_without_write(self):
        overlay = self._ready()
        now = datetime.now(timezone.utc)
        with self.assertRaisesRegex(ValueError, "NONCE_INVALID"):
            overlay.project(ROOT, now, "a" * 32, "a" * 32)
        tracked = [overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF, overlay.CHECKER]
        before = {path: (ROOT / path).read_bytes() for path in tracked}
        with self.assertRaisesRegex(RuntimeError, "CLOCK_INVALID"):
            overlay.materialize(ROOT, now - timedelta(days=2))
        self.assertEqual(before, {path: (ROOT / path).read_bytes() for path in tracked})

    def test_projection_control_and_product_paths_are_disjoint(self):
        overlay = self._ready()
        self.assertTrue(set(overlay.SCOPE).isdisjoint(overlay.CONTROL_SCOPE))
        self.assertEqual(len(overlay.SCOPE), 8)
        self.assertEqual(overlay.SCOPE[-1], overlay.REPORT)
        self.assertTrue(all((ROOT / path).exists() for path in overlay.FROZEN[:3]))

    def test_rejects_extra_dirty_path_before_writing(self):
        overlay = self._ready()
        tracked = [overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF, overlay.CHECKER]
        before = {path: (ROOT / path).read_bytes() for path in tracked}
        with patch.object(overlay, "_dirty", return_value={"unrelated-user-file.txt"}):
            with self.assertRaisesRegex(RuntimeError, "PREDECESSOR_INVALID"):
                overlay.materialize(ROOT, datetime.now(timezone.utc))
        self.assertEqual(before, {path: (ROOT / path).read_bytes() for path in tracked})

    def test_rejects_divergent_remote_before_writing(self):
        overlay = self._ready()
        original_git = overlay._git
        def divergent(root, *args):
            if args == ("rev-parse", "development/codex/f18-wsl-ops"):
                return b"0" * 40 + b"\n"
            return original_git(root, *args)
        with patch.object(overlay, "_git", side_effect=divergent):
            with self.assertRaisesRegex(RuntimeError, "PREDECESSOR_INVALID"):
                overlay.materialize(ROOT, datetime.now(timezone.utc))

    def test_rejects_forged_predecessor_before_writing(self):
        overlay = self._ready()
        original_frozen = overlay._frozen
        def forged(root, path):
            if path == overlay.PROGRESS:
                return original_frozen(root, path).replace(
                    b'"event_sequence": 2090', b'"event_sequence": 2089', 1)
            return original_frozen(root, path)
        with patch.object(overlay, "_frozen", side_effect=forged):
            with self.assertRaisesRegex(ValueError, "PREDECESSOR_STATE_INVALID"):
                overlay.materialize(ROOT, datetime.now(timezone.utc))


if __name__ == "__main__":
    unittest.main()
