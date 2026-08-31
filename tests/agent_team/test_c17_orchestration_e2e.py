from datetime import datetime, timezone
import unittest

from packages.agent_team import TeamMessageType, TeamTask, TeamTaskStatus, ConversationRole, ConversationTurn
from packages.agent_team.orchestration import (
    OrchestrationEvent, OrchestrationEventType, TeamOrchestrator,
)

HASH = "sha256:" + "a" * 64
NOW = datetime(2026, 9, 1, tzinfo=timezone.utc)


class C17OrchestrationE2E(unittest.TestCase):
    def setUp(self):
        self.team = TeamOrchestrator.create_session(
            session_id="s17", leader_id="lead", baseline_hash=HASH,
            budget=5, now=NOW,
        )
        self.team.register_teammate("lead", "dev")
        self.team.register_teammate("lead", "reviewer")
        self.team.activate("lead")

    def test_lifecycle_claim_lease_dependency_and_peer_review(self):
        self.team.add_task("lead", TeamTask("a", "s17", "A", TeamTaskStatus.PENDING, frozenset(), ("src/a",)))
        self.team.add_task("lead", TeamTask("b", "s17", "B", TeamTaskStatus.PENDING, frozenset({"a"}), ("src/b",)))
        with self.assertRaises(ValueError):
            self.team.claim_task("dev", "b", baseline_hash=HASH, revision=2)
        self.team.claim_task("dev", "a", baseline_hash=HASH, revision=2)
        lease = self.team.lease_for("a")
        self.assertEqual("dev", lease.agent_id)
        with self.assertRaises(PermissionError):
            self.team.record_peer_review("dev", "a", "PASS", "self review")
        self.team.record_peer_review("reviewer", "a", "PASS", "independent")
        self.team.complete_task("dev", "a", cost=1)
        self.assertIsNone(self.team._task_leases.get("a"))

    def test_message_stale_foreign_and_pause_resume(self):
        msg = self.team.send_message("dev", "reviewer", TeamMessageType.CONTEXT, "hello", idempotency_key="m1")
        self.assertEqual(msg.receiver_id, "reviewer")
        with self.assertRaises(ValueError):
            self.team.send_message("dev", "reviewer", TeamMessageType.CONTEXT, "replay", idempotency_key="m1")
        with self.assertRaises(PermissionError):
            self.team.send_message("outsider", "reviewer", TeamMessageType.CONTEXT, "x", idempotency_key="m2")
        with self.assertRaises(PermissionError):
            self.team.pause("dev")
        self.team.pause("lead", reason="user")
        with self.assertRaises(ValueError):
            self.team.pause("lead")
        self.team.resume("lead")
        self.assertEqual("ACTIVE", self.team.session.state.value)

    def test_cost_limit_atomic_and_event_replay_idempotent(self):
        before = self.team.spent
        with self.assertRaises(ValueError):
            self.team.record_cost("dev", 6)
        self.assertEqual(before, self.team.spent)
        events = self.team.events
        replica = TeamOrchestrator.create_session(session_id="s17", leader_id="lead", baseline_hash=HASH, budget=5, now=NOW)
        replica.register_teammate("lead", "dev")
        replica.register_teammate("lead", "reviewer")
        replica.activate("lead")
        self.assertEqual(len(events), len(replica.replay_events(events)))
        self.assertEqual(len(events), len(replica.replay_events(events + events)))
        foreign = OrchestrationEvent("x", OrchestrationEventType.COST_RECORDED, "outsider", "s17", 2, NOW, (("amount", "1"),))
        with self.assertRaises(PermissionError):
            self.team.replay_events((foreign,))

    def test_user_agent_turn_and_strict_event_binding(self):
        self.team.register_user("lead", "user")
        turn = ConversationTurn("turn-1", "s17", "thread-1", 1, "user", ConversationRole.USER, "lead", ConversationRole.LEADER, "design", "rev-1", NOW)
        self.team.append_conversation_turn(turn)
        self.assertEqual((turn,), self.team.conversation_turns)
        with self.assertRaises(ValueError):
            OrchestrationEvent("bad", OrchestrationEventType.MESSAGE_SENT, "lead", "s17", 1, NOW, (), "sha256:" + "A" * 64)
        foreign = OrchestrationEvent("foreign", OrchestrationEventType.MESSAGE_SENT, "lead", "s17", 1, NOW, (), "root", "", "other")
        with self.assertRaises(ValueError):
            self.team.replay_events((foreign,))


if __name__ == "__main__":
    unittest.main()
