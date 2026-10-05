"""R45 secure reissue preserves revoked epoch60 and U-01 non-acceptance."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class R45ReissueProjectionTests(unittest.TestCase):
    def test_exact_scope_ordered_events_and_unaccepted_state(self):
        from scripts import f20_u01_r45_reissue_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc), "a" * 32, "b" * 32)
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
        self.assertEqual(progress["worker_lease"]["lease_epoch"], 61)
        self.assertEqual(progress["write_lease"]["write_epoch"], 61)
        self.assertNotEqual(progress["worker_lease"]["execution_fencing_token"],
                            progress["write_lease"]["write_fencing_token"])
        self.assertEqual(progress["completed_f20_u01_r45_worker_lease"]["status"], "REVOKED")
        self.assertEqual(progress["completed_f20_u01_r45_write_lease"]["status"], "REVOKED")
        self.assertEqual(progress["repository"]["product_write_scope"], overlay.SCOPE)
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"],
                         "RECOVERED_WITH_QUARANTINED_HISTORY")

    def test_projection_has_exact_checker_successor_and_no_overwrite(self):
        from scripts import f20_u01_r45_reissue_overlay as overlay

        output = overlay.project(ROOT, datetime.now(timezone.utc), "a" * 32, "b" * 32)
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

    def test_reissue_rejects_shared_or_malformed_nonce(self):
        from scripts import f20_u01_r45_reissue_overlay as overlay

        at = datetime.now(timezone.utc)
        with self.assertRaisesRegex(ValueError, "R45_REISSUE_CLOCK_OR_NONCE_INVALID"):
            overlay.project(ROOT, at, "a" * 32, "a" * 32)
        with self.assertRaisesRegex(ValueError, "R45_REISSUE_CLOCK_OR_NONCE_INVALID"):
            overlay.project(ROOT, at, "r45queue1005", "b" * 32)

    def test_materialize_rejects_backdated_clock_without_writes(self):
        from scripts import f20_u01_r45_reissue_overlay as overlay

        before = {path: (ROOT / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF,
            overlay.DIGEST, overlay.MANIFEST, overlay.CHECKER,
        ) if (ROOT / path).exists()}
        with self.assertRaisesRegex(RuntimeError, "R45_CLOCK_INVALID"):
            overlay.materialize(ROOT, datetime.now(timezone.utc) - timedelta(days=2))
        self.assertEqual(before, {path: (ROOT / path).read_bytes() for path in before})

    def test_materialize_draws_independent_random_values_and_aborts_collision(self):
        from scripts import f20_u01_r45_reissue_overlay as overlay

        current = json.loads((ROOT / overlay.PROGRESS).read_bytes())
        if current["event_sequence"] == overlay.END:
            worker = current["worker_lease"]
            write = current["write_lease"]
            execution_nonce = worker["execution_fencing_token"].removeprefix(
                "f20-u01-r45-execution-fence-epoch-61-")
            write_nonce = write["write_fencing_token"].removeprefix(
                "f20-u01-r45-write-fence-epoch-61-")
            self.assertEqual(len(execution_nonce), 32)
            self.assertEqual(len(write_nonce), 32)
            self.assertNotEqual(execution_nonce, write_nonce)
            self.assertTrue(all(char in "0123456789abcdef" for char in execution_nonce + write_nonce))
            return
        before = {path: (ROOT / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF, overlay.CHECKER)}
        with patch.object(overlay.secrets, "token_hex", side_effect=["a" * 32, "a" * 32]) as random:
            with self.assertRaisesRegex(RuntimeError, "R45_REISSUE_NONCE_COLLISION"):
                overlay.materialize(ROOT, datetime.now(timezone.utc))
        self.assertEqual(random.call_count, 2)
        self.assertEqual(before, {path: (ROOT / path).read_bytes() for path in before})
        self.assertFalse((ROOT / overlay.DIGEST).exists())
        self.assertFalse((ROOT / overlay.MANIFEST).exists())


if __name__ == "__main__":
    unittest.main()
