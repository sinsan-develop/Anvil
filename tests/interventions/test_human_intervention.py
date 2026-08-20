from __future__ import annotations

from datetime import datetime, timedelta, timezone
import unittest

try:
    from packages.interventions.models import InterventionKind, InterventionState
    from packages.interventions.service import AmbiguousIntervention, HumanInterventionService
except ModuleNotFoundError:
    InterventionKind = InterventionState = None

    class AmbiguousIntervention(ValueError):
        pass

    class HumanInterventionService:
        def __init__(self, *args, **kwargs):
            raise NotImplementedError("human intervention service is not implemented")


NOW = datetime(2026, 8, 20, 1, 0, tzinfo=timezone.utc)


class HumanInterventionTests(unittest.TestCase):
    def test_human_input_preempts_system_events_and_ambiguous_input_waits(self):
        service = HumanInterventionService()
        service.enqueue_system_event("run-1", "TOOL_RESULT", requested_at=NOW)
        service.request("run-1", InterventionKind.QUERY_PROGRESS, requested_at=NOW + timedelta(seconds=1))

        first = service.next_event("run-1")
        self.assertEqual("HUMAN_INTERVENTION", first.event_type)
        self.assertEqual(InterventionKind.QUERY_PROGRESS, first.kind)

        with self.assertRaises(AmbiguousIntervention):
            service.request(
                "run-1",
                (InterventionKind.STOP, InterventionKind.PLAN_CHANGE),
                requested_at=NOW + timedelta(seconds=2),
            )
        self.assertEqual(InterventionState.WAITING_DECISION, service.state_for("run-1"))
        self.assertFalse(service.can_schedule_new_action("run-1"))

    def test_stop_receipt_separates_request_ack_block_and_effective_times(self):
        service = HumanInterventionService()
        requested = service.request("run-2", InterventionKind.STOP, requested_at=NOW)
        acknowledged = service.acknowledge(
            "run-2", requested.receipt_id, acknowledged_at=NOW + timedelta(seconds=1)
        )
        blocked = service.block_new_actions(
            "run-2", requested.receipt_id, blocked_at=NOW + timedelta(seconds=2)
        )

        self.assertEqual(NOW, blocked.requested_at)
        self.assertEqual(NOW + timedelta(seconds=1), blocked.acknowledged_at)
        self.assertEqual(NOW + timedelta(seconds=2), blocked.new_action_blocked_at)
        self.assertIsNone(blocked.effective_at)
        self.assertFalse(service.can_schedule_new_action("run-2"))

        effective = service.mark_effective(
            "run-2",
            requested.receipt_id,
            effective_at=NOW + timedelta(seconds=3),
            target_action_status="SAFE_POINT_REACHED",
            irreversible_receipt_ref="tool-receipt-7",
        )
        self.assertEqual(NOW + timedelta(seconds=3), effective.effective_at)
        self.assertEqual("SAFE_POINT_REACHED", effective.target_action_status)
        self.assertEqual("tool-receipt-7", effective.irreversible_receipt_ref)

    def test_effective_time_cannot_be_equal_to_request_ack_or_block_time(self):
        service = HumanInterventionService()
        requested = service.request("run-strict-time", InterventionKind.STOP, requested_at=NOW)
        service.acknowledge("run-strict-time", requested.receipt_id, acknowledged_at=NOW)
        service.block_new_actions("run-strict-time", requested.receipt_id, blocked_at=NOW)
        with self.assertRaises(ValueError):
            service.mark_effective(
                "run-strict-time",
                requested.receipt_id,
                effective_at=NOW,
                target_action_status="SAFE_POINT_REACHED",
                irreversible_receipt_ref="tool-receipt-strict",
            )


if __name__ == "__main__":
    unittest.main()
