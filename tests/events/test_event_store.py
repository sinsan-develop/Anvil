from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
import unittest

from packages.persistence.event_repository import EventRepository
from packages.api.event_contracts import (
    EventApplicationService,
    EventConflict,
    EventConflictCode,
    EventMutationRequest,
)
from packages.events.models import EventCommand, RunProjection
from packages.events.reducer import EventHistoryGap, EventReducer
from packages.events.store import InMemoryEventRepository, RunEventStore


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)


def command(*, event_id: str = "event-1", expected_version: int = 0) -> EventCommand:
    return EventCommand(
        event_id=event_id,
        run_id="run-1",
        event_type="TASK_CONFIRMED",
        actor_type="user",
        actor_id="owner-1",
        correlation_id="correlation-1",
        causation_event_id=None,
        idempotency_key="confirm-run-1",
        expected_version=expected_version,
        payload={
            "artifact_type": "Task snapshot",
            "conditions_satisfied": True,
            "questions_resolved": True,
            "scope_confirmed": True,
            "design_hash_approved": True,
            "work_plan_hash_approved": True,
        },
        created_at=NOW,
    )


class RecordingReducer(EventReducer):
    def __init__(self, repository: InMemoryEventRepository) -> None:
        self.repository = repository
        self.observed_event_counts: list[int] = []

    def reduce(self, projection, event):
        self.observed_event_counts.append(len(self.repository.events_for(event.run_id)))
        return super().reduce(projection, event)


class EventStoreTests(unittest.TestCase):
    def test_event_is_appended_before_projection_is_reduced(self):
        repository = InMemoryEventRepository()
        reducer = RecordingReducer(repository)
        store = RunEventStore(repository=repository, reducer=reducer)

        receipt = store.append(command())

        self.assertEqual([1], reducer.observed_event_counts)
        self.assertEqual(1, receipt.event.sequence_no)
        self.assertEqual(1, receipt.projection.version)
        self.assertEqual("ANALYZING", receipt.projection.phase)
        self.assertFalse(receipt.duplicate)

    def test_repository_port_and_framework_neutral_application_contract(self):
        repository = InMemoryEventRepository()
        self.assertIsInstance(repository, EventRepository)
        service = EventApplicationService(RunEventStore(repository=repository))
        request = EventMutationRequest.from_command(command())

        result = service.mutate(request)

        self.assertEqual("event-1", result.event_id)
        self.assertEqual(1, result.sequence_no)
        self.assertEqual(1, result.version)
        self.assertEqual("ANALYZING", result.phase)
        self.assertFalse(result.duplicate)

    def test_application_exposes_framework_neutral_optimistic_conflict(self):
        service = EventApplicationService(RunEventStore(repository=InMemoryEventRepository()))
        with self.assertRaises(EventConflict) as caught:
            service.mutate(EventMutationRequest.from_command(command(expected_version=1)))
        self.assertEqual(EventConflictCode.OPTIMISTIC_VERSION_CONFLICT, caught.exception.code)
        self.assertFalse(hasattr(caught.exception, "http_status"))

    def test_replay_is_deterministic_and_rejects_missing_event_sequence(self):
        repository = InMemoryEventRepository()
        store = RunEventStore(repository=repository)
        store.append(command())
        second = replace(
            command(),
            event_id="event-2",
            event_type="ANALYSIS_COMPLETED",
            idempotency_key="analyze-run-1",
            expected_version=1,
            payload={
                "artifact_type": "Impact Map",
                "conditions_satisfied": True,
                "baseline_analysis_succeeded": True,
                "impact_analysis_succeeded": True,
            },
        )
        expected = store.append(second).projection
        events = repository.events_for("run-1")
        self.assertEqual(expected, EventReducer().replay("run-1", events))
        gap = (events[0], replace(events[1], sequence_no=3, applied_version=3))
        with self.assertRaises(EventHistoryGap):
            EventReducer().replay("run-1", gap)

    def test_models_freeze_payload_and_projection_is_immutable(self):
        source = command().payload
        nested_source = {"items": ["one"]}
        mutable = dict(source)
        mutable["nested"] = nested_source
        frozen = replace(command(), payload=mutable)
        nested_source["items"].append("two")
        self.assertEqual(("one",), frozen.payload["nested"]["items"])
        with self.assertRaises(TypeError):
            frozen.payload["new"] = True  # type: ignore[index]
        projection = RunProjection.initial("run-1")
        with self.assertRaises((AttributeError, TypeError)):
            projection.version = 1  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
