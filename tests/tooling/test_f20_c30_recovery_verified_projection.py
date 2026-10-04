"""A verified ledger generation cannot silently accept F-20 or release."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class C30RecoveryVerifiedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from scripts import f20_c30_recovery_verified_overlay as verified
        cls.verified = verified
        cls.output = verified.project(ROOT, datetime.now(timezone.utc))

    def test_previous_2047_event_bytes_unchanged(self):
        old = subprocess.check_output(
            ["git", "show", f"{self.verified.BASE}:{self.verified.EVENTS}"], cwd=ROOT)
        new = self.output[self.verified.EVENTS]
        self.assertEqual(raw_event_object_prefix_bytes(new, 2047),
                         raw_event_object_prefix_bytes(old, 2047))
        stream = json.loads(new)
        self.assertEqual(stream["last_sequence"], 2048)
        self.assertEqual(stream["events"][-1]["event_type"], "EVENT_LEDGER_RECOVERY_VERIFIED")

    def test_incident_resolved_with_quarantine_not_package_acceptance(self):
        progress = json.loads(self.output[self.verified.PROGRESS])
        incident = progress["f20_c30_event_integrity_incident"]
        self.assertEqual(incident["status"], "RECOVERED_WITH_QUARANTINED_HISTORY")
        self.assertFalse(incident["blocking"])
        self.assertTrue(progress["c30_event_generation"]["authority_active"])
        self.assertFalse(progress["c30_event_generation"]["accepted"])
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])

    def test_false_acceptance_or_wrong_judgment_rejected(self):
        changed = dict(self.output)
        stream = json.loads(changed[self.verified.EVENTS])
        stream["events"][-1]["details"]["package_accepted"] = True
        changed[self.verified.EVENTS] = json.dumps(stream).encode()
        self.assertTrue(self.verified.validate_outputs(ROOT, changed))
        changed = dict(self.output)
        progress = json.loads(changed[self.verified.PROGRESS])
        progress["scope_revision_binding"]["release_decision"] = "GO"
        changed[self.verified.PROGRESS] = json.dumps(progress).encode()
        self.assertTrue(self.verified.validate_outputs(ROOT, changed))


if __name__ == "__main__":
    unittest.main()
