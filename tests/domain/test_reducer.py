from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
import unittest

from packages.domain.events import DomainEvent, EventType
from packages.domain.identifiers import EventId, RunId
from packages.domain.reducer import (
    ArtifactMissingError,
    ConditionNotSatisfiedError,
    SequenceConflictError,
    TransitionNotAllowedError,
    reduce_run,
)
from packages.domain.states import NORMAL_TRANSITIONS, RunPhase, RunState, RunStatus


def event(sequence, event_type, artifact, **payload):
    return DomainEvent(
        event_id=EventId(f"evt_{sequence}"), aggregate_id=RunId("run_01"), sequence=sequence,
        type=event_type, occurred_at=datetime(2026, 8, 13, tzinfo=timezone.utc),
        actor="tester", payload={"artifact_type": artifact, **payload},
    )


class ReducerTests(unittest.TestCase):
    def test_all_normal_transitions_are_table_driven_and_input_is_immutable(self):
        state = RunState.initial(RunId("run_01"))
        for sequence, spec in enumerate(NORMAL_TRANSITIONS, 1):
            before = state
            payload = {"conditions_satisfied": True, **{key: True for key in spec.required_conditions}}
            if spec.event is EventType.RELEASE_DECIDED:
                payload.update(product_validation_complete=True, blocking_defect_count=0,
                               authenticated_human_release=True, decision="RELEASE",
                               target_hash="sha256:target", validation_target_hash="sha256:target")
            state = reduce_run(state, event(sequence, spec.event, spec.required_artifact, **payload))
            self.assertEqual(spec.target, state.phase)
            self.assertEqual(sequence, state.sequence)
            self.assertEqual(spec.source, before.phase)
        self.assertEqual(RunPhase.COMPLETED, state.phase)
        self.assertEqual(RunStatus.SUCCEEDED, state.status)

    def test_duplicate_reverse_unknown_and_wrong_phase_fail_closed(self):
        initial = RunState.initial(RunId("run_01"))
        first = reduce_run(initial, event(1, EventType.TASK_CONFIRMED, "Task snapshot",
                                          conditions_satisfied=True, questions_resolved=True,
                                          scope_confirmed=True, design_hash_approved=True,
                                          work_plan_hash_approved=True))
        duplicate = event(1, EventType.ANALYSIS_COMPLETED, "Impact Map", conditions_satisfied=True)
        with self.assertRaises(SequenceConflictError):
            reduce_run(first, duplicate)
        later = RunState(first.run_id, first.phase, first.status, 2, first.artifacts)
        with self.assertRaises(SequenceConflictError):
            reduce_run(later, duplicate)
        with self.assertRaises(TransitionNotAllowedError):
            reduce_run(initial, event(1, EventType.POST_APPLY_VERIFIED, "Final report", conditions_satisfied=True))

    def test_missing_condition_or_artifact_is_rejected(self):
        initial = RunState.initial(RunId("run_01"))
        with self.assertRaises(ConditionNotSatisfiedError):
            reduce_run(initial, event(1, EventType.TASK_CONFIRMED, "Task snapshot", conditions_satisfied=False))
        with self.assertRaises(ArtifactMissingError):
            reduce_run(initial, event(1, EventType.TASK_CONFIRMED, "wrong", conditions_satisfied=True,
                                      questions_resolved=True, scope_confirmed=True,
                                      design_hash_approved=True, work_plan_hash_approved=True))

    def test_release_transition_requires_same_target_human_release_and_no_blocker(self):
        state = RunState(RunId("run_01"), RunPhase.USER_VALIDATION, RunStatus.ACTIVE, 8, ())
        base = dict(conditions_satisfied=True, product_validation_complete=True,
                    blocking_defect_count=0, authenticated_human_release=True,
                    decision="RELEASE", target_hash="sha256:a", validation_target_hash="sha256:a")
        for override in (
            {"product_validation_complete": False}, {"blocking_defect_count": 1},
            {"authenticated_human_release": False}, {"decision": "REWORK"},
            {"validation_target_hash": "sha256:b"},
        ):
            with self.subTest(override=override), self.assertRaises(ConditionNotSatisfiedError):
                reduce_run(state, event(9, EventType.RELEASE_DECIDED,
                                        "ProductValidation·DefectAssessment·ReleaseDecision", **(base | override)))

    def test_release_rejects_bool_float_zero_and_whitespace_target(self):
        state = RunState(RunId("run_01"), RunPhase.USER_VALIDATION, RunStatus.ACTIVE, 8, ())
        base = dict(conditions_satisfied=True, product_validation_complete=True,
                    blocking_defect_count=0, authenticated_human_release=True,
                    decision="RELEASE", target_hash="sha256:a", validation_target_hash="sha256:a")
        hostile = (
            {"blocking_defect_count": False},
            {"blocking_defect_count": 0.0},
            {"target_hash": "   ", "validation_target_hash": "   "},
        )
        for payload in hostile:
            with self.subTest(payload=payload), self.assertRaises(ConditionNotSatisfiedError):
                reduce_run(state, event(9, EventType.RELEASE_DECIDED,
                                        "ProductValidation·DefectAssessment·ReleaseDecision", **(base | payload)))

    def test_release_rejects_ascii_unicode_and_one_sided_target_padding(self):
        state = RunState(RunId("run_01"), RunPhase.USER_VALIDATION, RunStatus.ACTIVE, 8, ())
        base = dict(conditions_satisfied=True, product_validation_complete=True,
                    blocking_defect_count=0, authenticated_human_release=True,
                    decision="RELEASE", target_hash="sha256:a", validation_target_hash="sha256:a")
        hostile = (
            {"target_hash": " sha256:a ", "validation_target_hash": " sha256:a "},
            {"target_hash": "\u2003sha256:a\u00a0", "validation_target_hash": "\u2003sha256:a\u00a0"},
            {"target_hash": "sha256:a", "validation_target_hash": " sha256:a "},
        )
        for payload in hostile:
            with self.subTest(payload=payload), self.assertRaises(ConditionNotSatisfiedError):
                reduce_run(state, event(9, EventType.RELEASE_DECIDED,
                                        "ProductValidation·DefectAssessment·ReleaseDecision", **(base | payload)))

    def test_events_and_states_are_immutable(self):
        e = event(1, EventType.TASK_CONFIRMED, "Task snapshot", conditions_satisfied=True)
        with self.assertRaises((FrozenInstanceError, AttributeError)):
            e.sequence = 2  # type: ignore[misc]
        with self.assertRaises(TypeError):
            e.payload["artifact_type"] = "changed"  # type: ignore[index]
        source = {"artifact_type": "Task snapshot", "nested": {"items": [1]}}
        nested = DomainEvent(EventId("evt_nested"), RunId("run_01"), 1, EventType.TASK_CONFIRMED,
                             datetime(2026, 8, 13, tzinfo=timezone.utc), "tester", source)
        source["nested"]["items"].append(2)  # type: ignore[index, union-attr]
        self.assertEqual((1,), nested.payload["nested"]["items"])
        state = RunState.initial(RunId("run_01"))
        with self.assertRaises((FrozenInstanceError, AttributeError)):
            state.sequence = 2  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
