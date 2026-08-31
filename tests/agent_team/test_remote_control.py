from datetime import datetime, timedelta, timezone
from unittest import TestCase

from packages.agent_team.remote_control import (
    ApprovalRequired, AgentStatusSnapshot, CommandKind, OfflineQueue,
    ArtifactReference, CommandState, ConversationMessage, OperatorCommand,
    ProgressEvent, RemoteControlPlane, RemoteSession,
)


UTC = timezone.utc
NOW = datetime(2026, 8, 21, tzinfo=UTC)


def command(kind=CommandKind.PAUSE, *, token="secret", key="k1"):
    return OperatorCommand("cmd-1", "op-1", kind, NOW, NOW + timedelta(minutes=5), key, token)


class RemoteControlTests(TestCase):
    def setUp(self):
        self.plane = RemoteControlPlane(queue_limit=2)
        self.plane.register_operator("op-1", "secret", NOW + timedelta(hours=1))
        self.plane.open_session(RemoteSession("rs-1", "op-1", NOW + timedelta(minutes=30), NOW), auth_token="secret", now=NOW)

    def test_snapshot_and_event_replay_are_monotonic_and_idempotent(self):
        self.plane.publish_snapshot(AgentStatusSnapshot("a-1", "RUNNING", 1, "1", NOW))
        self.plane.publish_event(ProgressEvent("e1", "started", 1, "1", "event-key", NOW))
        self.assertEqual(("e1",), tuple(e.event_id for e in self.plane.replay(cursor="0")))
        with self.assertRaises(ValueError):
            self.plane.publish_event(ProgressEvent("e2", "duplicate", 2, "2", "event-key", NOW))
        with self.assertRaises(ValueError):
            self.plane.publish_snapshot(AgentStatusSnapshot("a-1", "OLD", 1, "1", NOW))

    def test_low_risk_command_auth_expiry_dedupe_and_audit(self):
        audit = self.plane.execute(command(), session_id="rs-1", now=NOW + timedelta(seconds=1))
        self.assertEqual("ACCEPTED", audit.outcome)
        with self.assertRaises(ValueError):
            self.plane.execute(command(), session_id="rs-1", now=NOW + timedelta(seconds=1))
        with self.assertRaises(PermissionError):
            self.plane.execute(command(token="wrong", key="k2"), session_id="rs-1", now=NOW + timedelta(seconds=1))
        self.assertEqual(("AUTH_FAILED",), tuple(a.outcome for a in self.plane.audits if a.outcome == "AUTH_FAILED"))

    def test_approval_commands_are_rejected_and_materialized(self):
        with self.assertRaises(ApprovalRequired) as caught:
            self.plane.execute(OperatorCommand("cmd-deploy", "op-1", CommandKind.DEPLOY, NOW, NOW + timedelta(minutes=5), "deploy", "secret", (("content_hash", "0" * 64),)), session_id="rs-1", now=NOW)
        self.assertEqual(CommandKind.DEPLOY, caught.exception.request.command.kind)
        self.assertEqual(1, len(self.plane.approvals))
        self.assertEqual("APPROVAL_REQUIRED", self.plane.audits[-1].outcome)

    def test_offline_queue_is_ordered_bounded_and_drops_stale_or_seen(self):
        queue = OfflineQueue(2)
        queue.enqueue(command(key="first")); queue.enqueue(command(key="second"))
        with self.assertRaises(OverflowError): queue.enqueue(command(key="third"))
        drained = queue.drain(now=NOW + timedelta(seconds=1), seen_keys=frozenset({"first"}))
        self.assertEqual(("second",), tuple(c.idempotency_key for c in drained))
        self.assertEqual((("first", "DUPLICATE"), ("second", "READY")), queue.last_drain_outcomes)
        queue.enqueue(command(key="expired"))
        self.assertEqual((), queue.drain(now=NOW + timedelta(minutes=6)))
        self.assertEqual((("expired", "STALE"),), queue.last_drain_outcomes)

    def test_cursor_and_future_issue_are_rejected(self):
        with self.assertRaises(ValueError):
            ProgressEvent("e1", "started", 1, "c1", "event-key", NOW)
        self.plane.publish_event(ProgressEvent("e1", "started", 1, "1", "event-key", NOW))
        with self.assertRaises(ValueError):
            self.plane.replay(cursor="9")
        with self.assertRaises(ValueError):
            self.plane.replay(cursor="01")
        future = OperatorCommand("future", "op-1", CommandKind.PAUSE, NOW + timedelta(seconds=1), NOW + timedelta(minutes=5), "future", "secret")
        with self.assertRaises(ValueError):
            self.plane.execute(future, session_id="rs-1", now=NOW)
        self.assertEqual("FUTURE_ISSUED_AT", self.plane.audits[-1].outcome)

    def test_last_event_id_and_idempotent_replay(self):
        event = ProgressEvent("e1", "started", 1, "1", "event-key", NOW)
        self.assertIs(self.plane.publish_event(event), event)
        self.assertEqual((), self.plane.replay(last_event_id="e1"))
        with self.assertRaises(ValueError):
            self.plane.replay(last_event_id="missing")
        with self.assertRaises(ValueError):
            self.plane.publish_event(ProgressEvent("e1", "changed", 1, "1", "other", NOW))

    def test_fencing_and_offline_pending_state(self):
        self.plane.rotate_fencing_token("op-1", "f-2")
        with self.assertRaises(PermissionError):
            self.plane.execute(command(key="stale"), session_id="rs-1", now=NOW)
        queued = OperatorCommand("cmd-2", "op-1", CommandKind.PAUSE, NOW, NOW + timedelta(minutes=5), "offline", "secret", fencing_token="f-2")
        queue = OfflineQueue(1)
        queue.enqueue(queued)
        self.assertEqual(CommandState.PENDING_REMOTE, queue.state("offline"))

    def test_artifact_reference_is_relative_and_conversation_is_immutable(self):
        ref = ArtifactReference("a-1", "0123456789abcdef" * 4, "docs/report.md", "diff")
        message = ConversationMessage("m-1", "agent-1", "검토 완료", 1, NOW, (ref,))
        self.assertEqual("docs/report.md", message.artifact_refs[0].path)
        with self.assertRaises(ValueError):
            ArtifactReference("a-2", "not-a-hash", "report.md")
        with self.assertRaises(ValueError):
            ArtifactReference("a-3", "0123456789abcdef" * 4, "https://example.invalid/report")

    def test_approval_hash_and_explicit_immutable_decision(self):
        cmd = OperatorCommand("cmd-deploy-2", "op-1", CommandKind.DEPLOY, NOW, NOW + timedelta(minutes=5), "deploy-2", "secret", (("content_hash", "a" * 64),))
        with self.assertRaises(ApprovalRequired):
            self.plane.execute(cmd, session_id="rs-1", now=NOW)
        request = self.plane.approvals[0]
        approved = self.plane.approve(request.request_id, actor_id="leader-1", now=NOW)
        self.assertEqual("a" * 64, approved.target_content_hash)
        self.assertEqual("leader-1", approved.decided_by)
        with self.assertRaises(ValueError):
            self.plane.reject(request.request_id, actor_id="leader-2", now=NOW)


if __name__ == "__main__":
    import unittest
    unittest.main()
