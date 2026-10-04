"""C30 recovery writer start must remain a blocked, byte-preserving control."""

from datetime import datetime, timezone
import json
from pathlib import Path
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]
AT = datetime(2026, 10, 4, 9, 30, tzinfo=timezone.utc)


class C30RecoveryStartTests(unittest.TestCase):
    def _projection(self):
        try:
            from scripts import f20_c30_recovery_start_overlay as overlay
        except ImportError:
            self.fail("C30 recovery start projection is not implemented")
        return overlay, overlay.project(ROOT, AT, "c30v2001")

    def test_existing_2040_event_object_bytes_are_preserved(self):
        overlay, projected = self._projection()
        previous = (ROOT / overlay.EVENTS).read_bytes()
        self.assertEqual(
            raw_event_object_prefix_bytes(projected[overlay.EVENTS], 2040),
            raw_event_object_prefix_bytes(previous, 2040),
        )
        self.assertEqual(json.loads(projected[overlay.EVENTS])["last_sequence"], 2044)

    def test_writer_has_exact_scope_and_fencing_while_incident_stays_blocking(self):
        overlay, projected = self._projection()
        progress = json.loads(projected[overlay.PROGRESS])
        worker, write = progress["worker_lease"], progress["write_lease"]
        self.assertEqual(worker["lease_epoch"], 55)
        self.assertEqual(write["write_epoch"], 55)
        self.assertEqual(write["worker_lease_id"], worker["lease_id"])
        self.assertEqual(write["execution_fencing_token"], worker["execution_fencing_token"])
        self.assertEqual(write["path_scope"], overlay.SCOPE)
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"], "OPEN_BLOCKING")
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertNotIn("F-20", progress["completed_packages"])

    def test_projection_rejects_mutated_frozen_cutover(self):
        overlay, projected = self._projection()
        rows = json.loads(projected[overlay.EVENTS])
        rows["events"][1688]["details"]["accepted"] = False
        projected[overlay.EVENTS] = json.dumps(rows).encode()
        self.assertNotEqual(projected[overlay.EVENTS], overlay.project(ROOT, AT, "c30v2001")[overlay.EVENTS])
        self.assertTrue(overlay.validate_outputs(ROOT, projected, AT))


if __name__ == "__main__":
    unittest.main()
