from __future__ import annotations

from datetime import datetime, timezone
import unittest

from packages.events.models import EventCommand
from packages.events.store import DuplicateRequestConflict, InMemoryEventRepository, RunEventStore


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)


def command(**changes: object) -> EventCommand:
    values: dict[str, object] = {
        "event_id": "event-1",
        "run_id": "run-1",
        "event_type": "TASK_CONFIRMED",
        "actor_type": "user",
        "actor_id": "owner-1",
        "correlation_id": "correlation-1",
        "causation_event_id": None,
        "idempotency_key": "confirm-run-1",
        "expected_version": 0,
        "payload": {
            "artifact_type": "Task snapshot",
            "conditions_satisfied": True,
            "questions_resolved": True,
            "scope_confirmed": True,
            "design_hash_approved": True,
            "work_plan_hash_approved": True,
        },
        "created_at": NOW,
    }
    values.update(changes)
    return EventCommand(**values)  # type: ignore[arg-type]


class IdempotencyTests(unittest.TestCase):
    def test_identical_event_and_key_returns_original_receipt_without_reapply(self):
        repository = InMemoryEventRepository()
        store = RunEventStore(repository=repository)
        original = store.append(command())

        duplicate = store.append(command())

        self.assertTrue(duplicate.duplicate)
        self.assertEqual(original.event, duplicate.event)
        self.assertEqual(original.projection, duplicate.projection)
        self.assertEqual(1, len(repository.events_for("run-1")))
        self.assertEqual(1, store.projection_for("run-1").version)

    def test_identical_retry_after_store_restart_rebuilds_original_receipt(self):
        repository = InMemoryEventRepository()
        original = RunEventStore(repository=repository).append(command())

        duplicate = RunEventStore(repository=repository).append(command())

        self.assertTrue(duplicate.duplicate)
        self.assertEqual(original.event, duplicate.event)
        self.assertEqual(original.projection, duplicate.projection)
        self.assertEqual(1, len(repository.events_for("run-1")))

    def test_same_event_id_with_different_payload_conflicts_without_new_event(self):
        repository = InMemoryEventRepository()
        store = RunEventStore(repository=repository)
        store.append(command())
        changed = dict(command().payload)
        changed["scope_confirmed"] = False

        with self.assertRaises(DuplicateRequestConflict):
            store.append(command(payload=changed))

        self.assertEqual(1, len(repository.events_for("run-1")))
        self.assertEqual(1, store.projection_for("run-1").version)

    def test_same_idempotency_key_with_different_event_conflicts(self):
        repository = InMemoryEventRepository()
        store = RunEventStore(repository=repository)
        store.append(command())

        with self.assertRaises(DuplicateRequestConflict):
            store.append(command(event_id="event-2"))

        self.assertEqual(("event-1",), tuple(event.event_id for event in repository.events_for("run-1")))


if __name__ == "__main__":
    unittest.main()
