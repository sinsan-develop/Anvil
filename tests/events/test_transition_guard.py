from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
import unittest

from packages.events.models import BlockedCode, EventCommand, RunProjection
from packages.events.store import InMemoryEventRepository, RunEventStore
from packages.events.transition_guard import (
    InvalidBlockedCode,
    InvalidTransition,
    OptimisticVersionConflict,
)


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
        "blocked_code": None,
    }
    values.update(changes)
    return EventCommand(**values)  # type: ignore[arg-type]


class TransitionGuardTests(unittest.TestCase):
    def test_expected_version_conflict_is_fail_closed(self):
        repository = InMemoryEventRepository()
        store = RunEventStore(repository=repository)

        with self.assertRaises(OptimisticVersionConflict):
            store.append(command(expected_version=1))

        self.assertEqual((), repository.events_for("run-1"))
        self.assertEqual(RunProjection.initial("run-1"), store.projection_for("run-1"))

    def test_invalid_phase_event_pair_is_fail_closed(self):
        repository = InMemoryEventRepository()
        store = RunEventStore(repository=repository)

        with self.assertRaises(InvalidTransition):
            store.append(command(event_type="POST_APPLY_VERIFIED"))

        self.assertEqual((), repository.events_for("run-1"))
        self.assertEqual(0, store.projection_for("run-1").version)

    def test_blocked_code_vocabulary_is_exactly_nine_and_unknown_is_rejected(self):
        self.assertEqual(
            {
                "BASELINE_CONFLICT",
                "SCOPE_EXPANSION_REQUIRED",
                "PROTECTED_PATH_DENIED",
                "TOOLCHAIN_UNAVAILABLE",
                "VERIFICATION_ENV_UNAVAILABLE",
                "LLM_PROVIDER_UNAVAILABLE",
                "BUDGET_OR_QUOTA_EXCEEDED",
                "APPROVAL_EXPIRED",
                "WORKER_INTERRUPTED",
            },
            {code.value for code in BlockedCode},
        )
        store = RunEventStore(repository=InMemoryEventRepository())
        with self.assertRaises(InvalidBlockedCode):
            store.append(command(event_type="RUN_BLOCKED", blocked_code="UNKNOWN"))
        self.assertEqual(0, store.projection_for("run-1").version)

    def test_all_canonical_normal_transitions_are_reducer_driven(self):
        store = RunEventStore(repository=InMemoryEventRepository())
        first = store.append(command())
        second = command(
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
        receipt = store.append(second)
        self.assertEqual("ANALYZING", first.projection.phase)
        self.assertEqual("EXECUTION_PLAN_REVIEW", receipt.projection.phase)
        self.assertEqual(2, receipt.projection.version)


if __name__ == "__main__":
    unittest.main()
