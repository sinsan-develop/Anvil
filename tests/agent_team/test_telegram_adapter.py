from datetime import datetime, timedelta, timezone
import unittest

from packages.agent_team.telegram_adapter import (
    TelegramAdapter, TelegramNotification, TelegramOutcome, TelegramUpdate,
    notification_text,
)


NOW = datetime(2026, 8, 21, tzinfo=timezone.utc)


class TelegramAdapterTests(unittest.TestCase):
    def setUp(self):
        self.adapter = TelegramAdapter(allowlisted_identities=frozenset({("chat-1", "user-1")}), signing_secret="secret-value", console_base_url="https://console.example")

    def update(self, command="status", **kwargs):
        update = TelegramUpdate("cmd-1", "chat-1", "user-1", command, NOW, NOW + timedelta(minutes=5), "nonce-1", "placeholder", ())
        return TelegramUpdate(update.command_id, update.chat_id, update.user_id, update.command, update.issued_at, update.expires_at, update.nonce, TelegramAdapter.sign(update, "secret-value"), update.parameters)

    def test_notification_has_deep_link_without_secret(self):
        text = notification_text(TelegramNotification("e1", "상태", "작업 완료", "/sessions/s1"), "https://console.example")
        self.assertIn("https://console.example/sessions/s1", text)
        self.assertNotIn("secret", text)

    def test_notification_and_adapter_reject_non_origin_base_urls(self):
        notification = TelegramNotification("e1", "상태", "작업 완료", "/sessions/s1")
        for base_url in ("https://console.example/", "https://console.example/path", "https://console.example?x=1", "https://console.example#fragment"):
            with self.assertRaises(ValueError):
                notification_text(notification, base_url)
            with self.assertRaises(ValueError):
                TelegramAdapter(allowlisted_identities=frozenset({("chat-1", "user-1")}), signing_secret="secret-value", console_base_url=base_url)

    def test_parameters_are_signed_and_tampering_is_rejected(self):
        original = self.update()
        original = TelegramUpdate(original.command_id, original.chat_id, original.user_id, original.command, original.issued_at, original.expires_at, original.nonce, original.signature, (("scope", "safe"),))
        tampered = TelegramUpdate(original.command_id, original.chat_id, original.user_id, original.command, original.issued_at, original.expires_at, original.nonce, original.signature, (("scope", "changed"),))
        self.assertEqual(TelegramOutcome.INVALID_SIGNATURE, self.adapter.process(tampered, now=NOW).outcome)

    def test_low_risk_accepts_and_replay_is_audited(self):
        first = self.adapter.process(self.update("pause"), now=NOW)
        second = self.adapter.process(self.update("pause"), now=NOW)
        self.assertEqual(TelegramOutcome.ACCEPTED, first.outcome)
        self.assertEqual(TelegramOutcome.REPLAYED, second.outcome)

    def test_rejects_identity_signature_expiry_and_future(self):
        bad_identity = self.update(); bad_identity = TelegramUpdate(bad_identity.command_id, "other", bad_identity.user_id, bad_identity.command, bad_identity.issued_at, bad_identity.expires_at, bad_identity.nonce, bad_identity.signature)
        self.assertEqual(TelegramOutcome.UNAUTHORIZED, self.adapter.process(bad_identity, now=NOW).outcome)
        bad_sig = self.update(); bad_sig = TelegramUpdate(bad_sig.command_id, bad_sig.chat_id, bad_sig.user_id, bad_sig.command, bad_sig.issued_at, bad_sig.expires_at, bad_sig.nonce, "0" * 64)
        self.assertEqual(TelegramOutcome.INVALID_SIGNATURE, self.adapter.process(bad_sig, now=NOW).outcome)
        expired = self.update(); self.assertEqual(TelegramOutcome.EXPIRED, self.adapter.process(expired, now=expired.expires_at).outcome)
        future = self.update(); self.assertEqual(TelegramOutcome.FUTURE_DATED, self.adapter.process(future, now=NOW - timedelta(seconds=1)).outcome)

    def test_approval_commands_never_execute(self):
        result = self.adapter.process(self.update("deploy"), now=NOW)
        self.assertFalse(result.accepted)
        self.assertEqual(TelegramOutcome.APPROVAL_REQUIRED, result.outcome)
        self.assertIsNotNone(result.approval)
        self.assertIn("Web Console", result.text)
        self.assertNotIn("secret-value", result.text)
        self.assertNotIn("secret-value", repr(result.audit))
        self.assertNotIn("secret-value", repr(result.approval))
        self.assertEqual("telegram-redacted", result.approval.command.auth_token)

    def test_malformed_and_unsupported_are_audited(self):
        self.assertEqual(TelegramOutcome.MALFORMED, self.adapter.process(object(), now=NOW).outcome)
        self.assertEqual(TelegramOutcome.UNSUPPORTED, self.adapter.process(self.update("unknown"), now=NOW).outcome)


if __name__ == "__main__":
    unittest.main()
