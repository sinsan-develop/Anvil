from datetime import datetime, timezone
import unittest

from packages.agent_team import (
    AppendOnlyTeamLog, DependencyGraph, TeamEvent, TeamEventType,
    TeamProgressProjection, TeamSession, TeamSessionState, ThreadIdentity,
    ThreadKind, canonical_hash,
)

HASH = "sha256:" + "a" * 64
NOW = datetime(2026, 9, 1, tzinfo=timezone.utc)


class CollaborationPrimitiveTests(unittest.TestCase):
    def setUp(self):
        self.session = TeamSession("s1", "leader", frozenset({"leader", "agent"}), HASH, frozenset({"team:coordinate"}), 10, TeamSessionState.ACTIVE, 1)

    def test_thread_identity_distinguishes_user_and_peer_threads(self):
        user = ThreadIdentity("t-user", "s1", ThreadKind.USER_AGENT, "user", frozenset({"user", "leader"}), HASH, NOW)
        peer = ThreadIdentity("t-peer", "s1", ThreadKind.AGENT_AGENT, "leader", frozenset({"leader", "agent"}), HASH, NOW)
        self.assertNotEqual(user.kind, peer.kind)
        self.assertTrue(user.identity_hash.startswith("sha256:"))
        with self.assertRaises(ValueError):
            ThreadIdentity("bad", "s1", ThreadKind.USER_AGENT, "user", frozenset({"user", "leader", "agent"}), HASH, NOW)

    def test_dependency_graph_rejects_transitive_cycles_and_is_canonical(self):
        with self.assertRaisesRegex(ValueError, "cycle"):
            DependencyGraph((("a", ("b",)), ("b", ("c",)), ("c", ("a",))))
        left = DependencyGraph((("b", ("a",)), ("a", ())))
        right = DependencyGraph((("a", ()), ("b", ("a",))))
        self.assertEqual(left.hash(), right.hash())

    def test_append_only_log_rejects_stale_duplicate_and_unknown_actor(self):
        log = AppendOnlyTeamLog(self.session)
        event = TeamEvent("e1", "s1", 1, TeamEventType.PROGRESS_RECORDED, "leader", "s1", log.head_hash, {"status": "ACTIVE"}, NOW)
        log.append(event)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            log.append(event)
        stale = TeamEvent("e2", "s1", 2, TeamEventType.PROGRESS_RECORDED, "leader", "s1", HASH, {}, NOW)
        with self.assertRaisesRegex(ValueError, "stale"):
            log.append(stale)
        foreign = TeamEvent("e3", "s1", 2, TeamEventType.PROGRESS_RECORDED, "outsider", "s1", log.head_hash, {}, NOW)
        with self.assertRaisesRegex(PermissionError, "actor"):
            log.append(foreign)

    def test_event_parent_hash_and_payload_are_immutable_and_canonical(self):
        log = AppendOnlyTeamLog(self.session)
        payload = {"nested": {"items": ["a"]}}
        event = TeamEvent("e1", "s1", 1, TeamEventType.PROGRESS_RECORDED, "leader", "s1", log.head_hash, payload, NOW)
        payload["nested"]["items"].append("mutated")
        self.assertEqual(("a",), event.payload["nested"]["items"])
        with self.assertRaises(TypeError):
            event.payload["new"] = "nope"
        with self.assertRaisesRegex(ValueError, "lowercase"):
            TeamEvent("bad", "s1", 1, TeamEventType.PROGRESS_RECORDED, "leader", "s1", "sha256:" + "A" * 64, {}, NOW)

    def test_replay_rejects_foreign_actor(self):
        log = AppendOnlyTeamLog(self.session)
        event = TeamEvent("e1", "s1", 1, TeamEventType.PROGRESS_RECORDED, "leader", "s1", log.head_hash, {}, NOW)
        with self.assertRaisesRegex(PermissionError, "actor"):
            TeamProgressProjection.replay(self.session, (TeamEvent("x", "s1", 1, TeamEventType.PROGRESS_RECORDED, "outsider", "s1", log.head_hash, {}, NOW),))

    def test_legacy_model_defaults_are_explicit_utc_and_root(self):
        from packages.agent_team import TeamTask, TeamTaskStatus, TeamMailbox, DecisionRequest
        task = TeamTask("t", "s1", "task", TeamTaskStatus.PENDING, frozenset(), ("src",))
        mailbox = TeamMailbox("m", "s1", "agent", HASH, 1)
        request = DecisionRequest("d", "s1", "agent", "user", "choose", ("yes",), HASH, ("src",), ("x",), ("y",))
        for schema in (task, mailbox, request):
            self.assertIsNotNone(schema.created_at.tzinfo)
            self.assertEqual("root", schema.parent_hash)

    def test_projection_replays_events_and_rejects_history_gap(self):
        log = AppendOnlyTeamLog(self.session)
        e1 = TeamEvent("e1", "s1", 1, TeamEventType.MESSAGE_APPENDED, "leader", "m1", log.head_hash, {}, NOW)
        log.append(e1)
        e2 = TeamEvent("e2", "s1", 2, TeamEventType.TURN_APPENDED, "agent", "turn1", HASH, {}, NOW)
        with self.assertRaisesRegex(ValueError, "stale"):
            TeamProgressProjection.replay(self.session, (e1, e2))
        e2 = TeamEvent("e2", "s1", 2, TeamEventType.TURN_APPENDED, "agent", "turn1", e1.event_hash, {}, NOW)
        projection = TeamProgressProjection.replay(self.session, (e1, e2))
        self.assertEqual(("m1",), projection.delivered_message_ids)
        self.assertEqual(("turn1",), projection.conversation_turn_ids)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            TeamProgressProjection.replay(self.session, (e1, e2, TeamEvent("e3", "s1", 3, TeamEventType.MESSAGE_APPENDED, "leader", "m1", e2.event_hash, {}, NOW)))

    def test_canonical_hash_is_order_independent_for_mappings(self):
        self.assertEqual(canonical_hash({"b": 2, "a": 1}), canonical_hash({"a": 1, "b": 2}))
