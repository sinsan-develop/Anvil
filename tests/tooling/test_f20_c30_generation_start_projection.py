"""Generation 2 must preserve bytes and remain blocked until independent review."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import unittest

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]


class C30GenerationStartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from scripts import f20_c30_generation_start_overlay as generation
        cls.generation = generation
        cls.output = generation.project(ROOT, datetime.now(timezone.utc))

    def test_existing_2046_event_bytes_unchanged(self):
        old = subprocess.check_output(
            ["git", "show", f"{self.generation.BASE}:{self.generation.EVENTS}"], cwd=ROOT)
        new = self.output[self.generation.EVENTS]
        self.assertEqual(raw_event_object_prefix_bytes(new, 2046),
                         raw_event_object_prefix_bytes(old, 2046))
        rows = json.loads(new)["events"]
        self.assertEqual(len(rows), 2047)
        self.assertEqual(rows[-1]["event_type"], "EVENT_LEDGER_GENERATION_STARTED")

    def test_generation_is_pinned_and_non_accepting(self):
        row = json.loads(self.output[self.generation.EVENTS])["events"][-1]
        detail = row["details"]
        self.assertEqual(detail["generation"], 2)
        self.assertEqual(detail["anchor_commit"],
                         "97adc5cf7070c71b61a5d6902d31cf195329b38f")
        self.assertEqual(detail["quarantined_event_sequences"], [1689, 1714])
        self.assertEqual(detail["audit_only_event_sequences"], [1715, 2046])
        self.assertFalse(detail["accepted"])
        self.assertFalse(detail["authority_active"])
        progress = json.loads(self.output[self.generation.PROGRESS])
        self.assertEqual(progress["f20_c30_event_integrity_incident"]["status"], "OPEN_BLOCKING")
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")
        self.assertNotIn("F-20", progress["completed_packages"])

    def test_mutated_generation_or_predecessor_is_rejected(self):
        changed = dict(self.output)
        stream = json.loads(changed[self.generation.EVENTS])
        stream["events"][-1]["details"]["authority_active"] = True
        changed[self.generation.EVENTS] = json.dumps(stream).encode()
        self.assertTrue(self.generation.validate_outputs(ROOT, changed))
        changed = dict(self.output)
        changed[self.generation.EVENTS] = changed[self.generation.EVENTS].replace(
            b'"sequence": 2046', b'"sequence": 2040', 1)
        self.assertTrue(self.generation.validate_outputs(ROOT, changed))


if __name__ == "__main__":
    unittest.main()
