from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta, timezone
import unittest


NOW = datetime(2026, 8, 21, tzinfo=timezone.utc)
LATER = NOW + timedelta(seconds=1)
HASH_A = "sha256:" + "a" * 64
HASH_B = "sha256:" + "b" * 64


class AgentTeamModelTests(unittest.TestCase):
    def test_required_public_models_are_exported(self):
        import packages.agent_team as agent_team

        required = {
            "TeamDeliveryState",
            "TeamMailbox",
            "TeamMessageType",
            "TeamSessionState",
            "RequestState",
        }
        self.assertEqual(set(), required.difference(dir(agent_team)))

    def test_session_captures_governed_membership_baseline_permissions_and_budget(self):
        from packages.agent_team import TeamSession, TeamSessionState

        session = TeamSession(
            "team-1",
            "leader-1",
            frozenset({"leader-1", "teammate-1"}),
            HASH_A,
            frozenset({"repository:read", "artifact:write"}),
            10_000,
            TeamSessionState.ACTIVE,
            1,
        )
        self.assertIn(session.leader_id, session.memberships)
        with self.assertRaises(FrozenInstanceError):
            session.budget = 20_000
        with self.assertRaisesRegex(ValueError, "leader_id"):
            TeamSession("team-1", "missing", frozenset({"teammate-1"}), HASH_A, frozenset({"repository:read"}), 1, TeamSessionState.ACTIVE, 1)
        with self.assertRaisesRegex(ValueError, "sha256"):
            TeamSession("team-1", "leader-1", frozenset({"leader-1"}), "bad", frozenset({"repository:read"}), 1, TeamSessionState.ACTIVE, 1)

    def test_session_rejects_authority_bypass_and_terminal_reentry(self):
        from packages.agent_team import TeamSession, TeamSessionState

        session = TeamSession("team-1", "leader-1", frozenset({"leader-1"}), HASH_A, frozenset({"repository:read"}), 1, TeamSessionState.ACTIVE, 1)
        with self.assertRaisesRegex(ValueError, "reserved authority"):
            TeamSession("team-1", "leader-1", frozenset({"leader-1"}), HASH_A, frozenset({"deploy"}), 1, TeamSessionState.ACTIVE, 1)
        completed = session.transition(TeamSessionState.COMPLETED)
        with self.assertRaisesRegex(ValueError, "transition"):
            completed.transition(TeamSessionState.ACTIVE)

    def test_task_enforces_exact_states_dependencies_scope_and_claim_identity(self):
        from packages.agent_team import TeamTask, TeamTaskStatus

        task = TeamTask("task-2", "team-1", "Review", TeamTaskStatus.PENDING, frozenset({"task-1"}), ("packages/agent_team/models.py",))
        completed = task.claim("teammate-1").complete("teammate-1")
        self.assertEqual("teammate-1", completed.completed_by)
        self.assertEqual(
            {"PENDING", "CLAIMED", "BLOCKED", "COMPLETED", "CANCELLED"},
            {status.value for status in TeamTaskStatus},
        )
        with self.assertRaisesRegex(ValueError, "itself"):
            TeamTask("task-1", "team-1", "Bad", TeamTaskStatus.PENDING, frozenset({"task-1"}), ("models.py",))
        with self.assertRaisesRegex(PermissionError, "claiming agent"):
            task.claim("teammate-1").complete("teammate-2")

    def test_mailbox_rejects_stale_messages_and_idempotency_replays(self):
        from packages.agent_team import TeamDeliveryState, TeamMailbox, TeamMessage, TeamMessageType

        mailbox = TeamMailbox("mailbox-1", "team-1", "teammate-1", HASH_A, 3)
        message = TeamMessage("message-1", "team-1", "leader-1", "teammate-1", TeamMessageType.TASK_UPDATE, "Review", ("artifact-1",), "idem-1", HASH_A, 3, NOW)
        delivered = mailbox.deliver(message, LATER)
        self.assertEqual(TeamDeliveryState.DELIVERED, delivered.messages[0].delivery_state)
        replay = TeamMessage("message-2", "team-1", "leader-1", "teammate-1", TeamMessageType.QUESTION, "Again", (), "idem-1", HASH_A, 3, NOW)
        with self.assertRaisesRegex(ValueError, "replay"):
            delivered.deliver(replay, LATER)
        stale = TeamMessage("message-3", "team-1", "leader-1", "teammate-1", TeamMessageType.CONTEXT, "Old", (), "idem-3", HASH_A, 2, NOW)
        with self.assertRaisesRegex(ValueError, "stale"):
            mailbox.deliver(stale, LATER)

    def test_acknowledgement_requires_receiver_and_is_not_replayable(self):
        from packages.agent_team import TeamDeliveryState, TeamMailbox, TeamMessage, TeamMessageType

        message = TeamMessage("message-1", "team-1", "leader-1", "teammate-1", TeamMessageType.REVIEW, "Review", (), "idem-1", HASH_A, 1, NOW)
        delivered = TeamMailbox("mailbox-1", "team-1", "teammate-1", HASH_A, 1).deliver(message, LATER)
        with self.assertRaisesRegex(PermissionError, "owner"):
            delivered.acknowledge("message-1", "leader-1", LATER)
        acknowledged = delivered.acknowledge("message-1", "teammate-1", LATER)
        self.assertEqual(TeamDeliveryState.ACKNOWLEDGED, acknowledged.messages[0].delivery_state)
        with self.assertRaisesRegex(ValueError, "already acknowledged"):
            acknowledged.acknowledge("message-1", "teammate-1", LATER)

    def test_messages_cannot_encode_privileged_action_types(self):
        from packages.agent_team import TeamMessage, TeamMessageType

        privileged = {"APPROVE", "MERGE", "DEPLOY", "DELETE", "BYPASS_WRITE_LEASE", "BYPASS_EGRESS", "BYPASS_FENCING"}
        self.assertTrue(privileged.isdisjoint({item.value for item in TeamMessageType}))
        with self.assertRaisesRegex(TypeError, "TeamMessageType"):
            TeamMessage("message-1", "team-1", "teammate-1", "leader-1", "APPROVE", "Approve", (), "idem-1", HASH_A, 1, NOW)

    def test_conversation_turn_preserves_supported_direction_and_revision(self):
        from packages.agent_team import ConversationRole, ConversationTurn

        turn = ConversationTurn("turn-1", "team-1", "thread-1", 1, "user-1", ConversationRole.USER, "teammate-1", ConversationRole.TEAMMATE, "Revise", "revision-4", NOW)
        self.assertEqual(("thread-1", "revision-4"), (turn.thread_id, turn.revision_ref))
        with self.assertRaisesRegex(ValueError, "conversation direction"):
            ConversationTurn("turn-2", "team-1", "thread-2", 1, "user-1", ConversationRole.USER, "user-2", ConversationRole.USER, "Bad", "revision-4", NOW)

    def test_decision_request_binds_scope_and_authorized_transition(self):
        from packages.agent_team import DecisionRequest, RequestState

        request = DecisionRequest("decision-1", "team-1", "leader-1", "user-1", "Choose", ("keep", "expand"), HASH_A, ("packages/agent_team/",), ("models only",), ("API changes",))
        with self.assertRaisesRegex(PermissionError, "approver"):
            request.transition(RequestState.APPROVED, "teammate-1")
        approved = request.transition(RequestState.APPROVED, "user-1")
        self.assertEqual("user-1", approved.decided_by)
        with self.assertRaisesRegex(ValueError, "terminal"):
            approved.transition(RequestState.REJECTED, "user-1")

    def test_revision_request_rejects_change_scope_overlap(self):
        from packages.agent_team import RequestState, RevisionRequest

        request = RevisionRequest("revision-1", "team-1", "teammate-1", "user-1", "More evidence", HASH_B, ("packages/agent_team/",), ("add tests",), ("API changes",), "revision-4")
        self.assertEqual(RequestState.REJECTED, request.transition(RequestState.REJECTED, "user-1").state)
        with self.assertRaisesRegex(ValueError, "overlap"):
            RevisionRequest("revision-2", "team-1", "teammate-1", "user-1", "Conflict", HASH_B, ("packages/agent_team/",), ("same",), ("same",), "revision-4")


if __name__ == "__main__":
    unittest.main()
