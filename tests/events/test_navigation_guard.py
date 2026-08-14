from __future__ import annotations

from datetime import datetime, timezone
import unittest

from packages.events.models import EventCommand, RunProjection
from packages.events.store import InMemoryEventRepository, RunEventStore
from packages.events.transition_guard import ReadOnlyIntentRejected


class NavigationGuardTests(unittest.TestCase):
    def test_navigation_only_intents_cannot_enter_mutation_path(self):
        for intent in ("NAVIGATE", "VIEW", "OPEN", "SELECT"):
            with self.subTest(intent=intent):
                repository = InMemoryEventRepository()
                store = RunEventStore(repository=repository)
                before = store.projection_for("run-1")
                request = EventCommand(
                    event_id=f"event-{intent.lower()}",
                    run_id="run-1",
                    event_type=intent,
                    actor_type="user",
                    actor_id="owner-1",
                    correlation_id="correlation-1",
                    causation_event_id=None,
                    idempotency_key=f"read-{intent.lower()}",
                    expected_version=0,
                    payload={},
                    created_at=datetime(2026, 8, 15, tzinfo=timezone.utc),
                )

                with self.assertRaises(ReadOnlyIntentRejected):
                    store.append(request)

                self.assertEqual((), repository.events_for("run-1"))
                self.assertEqual(before, store.projection_for("run-1"))
                self.assertEqual(RunProjection.initial("run-1"), before)


if __name__ == "__main__":
    unittest.main()
