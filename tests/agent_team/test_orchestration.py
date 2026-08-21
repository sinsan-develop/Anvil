from datetime import datetime, timezone
import unittest

from packages.agent_team import TeamMessageType, TeamTask, TeamTaskStatus
from packages.agent_team.orchestration import OrchestrationEventType, TeamOrchestrator


HASH = "sha256:" + "a" * 64
NOW = datetime(2026, 8, 21, tzinfo=timezone.utc)


class OrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.team = TeamOrchestrator.create_session(session_id="s1", leader_id="leader", baseline_hash=HASH, budget=10, now=NOW)
        self.team.register_teammate("leader", "dev")
        self.team.register_teammate("leader", "reviewer")
        self.team.activate()

    def test_registration_and_reserved_capability_guard(self):
        with self.assertRaises(ValueError):
            self.team.register_teammate("leader", "bad", capabilities=frozenset({"deploy"}))
        with self.assertRaises(PermissionError):
            self.team.register_teammate("dev", "bad")

    def test_dependency_claim_and_scope_conflict(self):
        self.team.add_task("leader", TeamTask("a", "s1", "A", TeamTaskStatus.PENDING, frozenset(), ("src/a",)))
        self.team.add_task("leader", TeamTask("b", "s1", "B", TeamTaskStatus.PENDING, frozenset({"a"}), ("src/b",)))
        with self.assertRaises(ValueError):
            self.team.claim_task("dev", "b", baseline_hash=HASH, revision=2)
        self.team.claim_task("dev", "a", baseline_hash=HASH, revision=2)
        self.team.add_task("leader", TeamTask("c", "s1", "C", TeamTaskStatus.PENDING, frozenset(), ("src",)))
        with self.assertRaises(ValueError):
            self.team.claim_task("reviewer", "c", baseline_hash=HASH, revision=2)

    def test_mailbox_replay_stale_and_peer_review(self):
        self.team.add_task("leader", TeamTask("a", "s1", "A", TeamTaskStatus.PENDING, frozenset(), ("src/a",)))
        msg = self.team.send_message("dev", "reviewer", TeamMessageType.REVIEW, "please review", idempotency_key="k1")
        self.assertEqual(msg.receiver_id, "reviewer")
        with self.assertRaises(ValueError):
            self.team.send_message("dev", "reviewer", TeamMessageType.REVIEW, "replay", idempotency_key="k1")
        with self.assertRaises(ValueError):
            self.team.send_message("dev", "reviewer", TeamMessageType.CONTEXT, "stale", idempotency_key="k2", revision=1)
        review = self.team.record_peer_review("reviewer", "a", "PASS", "looks good")
        self.assertEqual("PASS", review.outcome)
        self.assertIsNotNone(msg)

    def test_block_resume_completion_hooks_cost_and_immutable_events(self):
        self.team.add_task("leader", TeamTask("a", "s1", "A", TeamTaskStatus.PENDING, frozenset(), ("src/a",)))
        self.team.claim_task("dev", "a", baseline_hash=HASH, revision=2)
        self.team.block_task("dev", "a")
        self.team.resume_task("dev", "a")
        self.team.complete_task("dev", "a", cost=3)
        self.team.idle_hook("reviewer")
        kinds = [event.event_type for event in self.team.events]
        self.assertIn(OrchestrationEventType.TASK_BLOCKED, kinds)
        self.assertIn(OrchestrationEventType.TASK_RESUMED, kinds)
        self.assertIn(OrchestrationEventType.HOOK_COMPLETED, kinds)
        self.assertIn(OrchestrationEventType.HOOK_IDLE, kinds)
        with self.assertRaises(ValueError):
            self.team.record_cost("dev", 8)


if __name__ == "__main__":
    unittest.main()
