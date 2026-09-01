"""Same-origin Telegram webhook boundary."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hmac
import json
import logging
from typing import Any, Mapping

from packages.agent_team.telegram_adapter import TelegramAdapter, TelegramUpdate
from packages.persistence.telegram_webhook import SqlAlchemyTelegramStateStore, TelegramStateStore


logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class TelegramWebhookConfig:
    secret_token: str
    # Internal envelope signing key; it is never accepted from Telegram headers.
    hmac_secret: str = ""
    max_body_bytes: int = 64 * 1024
    rate_limit: int = 30
    rate_window_seconds: int = 60
    allowed_hosts: tuple[str, ...] = ("anvil.sinsan.kr",)

    def __post_init__(self) -> None:
        if not isinstance(self.secret_token, str) or not self.secret_token.strip():
            raise ValueError("secret_token is required")
        if not isinstance(self.hmac_secret, str) or not self.hmac_secret.strip():
            raise ValueError("internal_signing_secret is required")
        if type(self.max_body_bytes) is not int or self.max_body_bytes < 1:
            raise ValueError("max_body_bytes must be positive")
        if type(self.rate_limit) is not int or self.rate_limit < 1:
            raise ValueError("rate_limit must be positive")
        if type(self.rate_window_seconds) is not int or self.rate_window_seconds < 1:
            raise ValueError("rate_window_seconds must be positive")
        if not isinstance(self.allowed_hosts, tuple) or not self.allowed_hosts or any(
            not isinstance(host, str) or not host.strip() for host in self.allowed_hosts
        ):
            raise ValueError("allowed_hosts must be a non-empty tuple")


class TelegramWebhook:
    def __init__(self, adapter: TelegramAdapter, config: TelegramWebhookConfig, *, state_store: TelegramStateStore) -> None:
        self.adapter = adapter
        self.config = config
        if state_store is None:
            raise ValueError("durable Telegram state_store is required")
        self._state_store = state_store
        if getattr(adapter, "_state_store", None) is None:
            adapter.attach_state_store(self._state_store)

    @classmethod
    def from_session_factory(
        cls, adapter: TelegramAdapter, config: TelegramWebhookConfig, *, session_factory: Any,
    ) -> "TelegramWebhook":
        """Build the production boundary from the application's DB session factory."""
        return cls(adapter, config, state_store=SqlAlchemyTelegramStateStore(session_factory))

    def handle(self, raw_body: bytes, headers: Mapping[str, str], *, now: datetime) -> tuple[int, dict[str, Any]]:
        if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() != timezone.utc.utcoffset(now):
            return 400, {"error": "invalid clock"}
        if len(raw_body) > self.config.max_body_bytes:
            return 413, {"error": "payload too large"}
        host = headers.get("host", "").split(":", 1)[0].lower().strip()
        allowed_hosts = {value.lower().strip() for value in self.config.allowed_hosts}
        if host not in allowed_hosts:
            logger.warning(
                "telegram webhook host rejected",
                extra={
                    "received_host": host,
                    "allowed_hosts": tuple(sorted(allowed_hosts)),
                },
            )
            return 400, {"error": "invalid host"}
        if not hmac.compare_digest(headers.get("x-telegram-bot-api-secret-token", ""), self.config.secret_token):
            return 403, {"error": "webhook authentication failed"}
        try:
            payload = json.loads(raw_body.decode("utf-8"))
            update = self._decode(payload, now=now)
        except (UnicodeDecodeError, ValueError, TypeError, KeyError, AttributeError, OverflowError):
            return 400, {"error": "malformed webhook payload"}
        key = update.chat_id
        if not self._state_store.allow_rate(
            identity=key, now=now, limit=self.config.rate_limit,
            window_seconds=self.config.rate_window_seconds,
        ):
            return 429, {"error": "rate limit exceeded"}
        result = self.adapter.process(update, now=now)
        return 200, {"accepted": result.accepted, "outcome": result.outcome.value, "text": result.text, "audit_id": result.audit.audit_id}

    def _decode(self, payload: Any, *, now: datetime) -> TelegramUpdate:
        if not isinstance(payload, dict):
            raise ValueError("payload must be object")
        values = payload.get("update", payload)
        if not isinstance(values, dict):
            raise ValueError("update must be object")
        # Accept Telegram's native Update shape.  The internal command envelope
        # remains supported for trusted callers, but its signature is verified
        # by TelegramAdapter rather than by the Telegram transport header.
        if "update_id" in values or "message" in values:
            update_id = values.get("update_id")
            message = values.get("message")
            if type(update_id) is not int or not isinstance(message, dict):
                raise ValueError("invalid Telegram Update")
            chat = message.get("chat")
            sender = message.get("from")
            text = message.get("text")
            if not isinstance(chat, dict) or not isinstance(sender, dict):
                raise ValueError("Telegram message identity is required")
            if type(chat.get("id")) not in {int, str} or type(sender.get("id")) not in {int, str}:
                raise ValueError("Telegram identity is invalid")
            if not isinstance(text, str) or not text.strip() or not text.startswith("/"):
                raise ValueError("Telegram command text is required")
            command_text = text.strip().split(None, 1)[0]
            command = command_text.split("@", 1)[0]
            if not command or command == "/":
                raise ValueError("Telegram command is invalid")
            command_id = f"telegram-update-{update_id}"
            expires_at = now + timedelta(minutes=5)
            unsigned = TelegramUpdate(
                command_id, str(chat["id"]), str(sender["id"]), command,
                now, expires_at, command_id, "telegram-internal", (),
            )
            return TelegramUpdate(
                unsigned.command_id, unsigned.chat_id, unsigned.user_id, unsigned.command,
                unsigned.issued_at, unsigned.expires_at, unsigned.nonce,
                TelegramAdapter.sign(unsigned, self.config.hmac_secret), unsigned.parameters,
            )
        parameters = values.get("parameters", ())
        if isinstance(parameters, list):
            parameters = tuple(tuple(pair) for pair in parameters)
        issued_at = self._parse_utc(values.get("issued_at"), "issued_at")
        expires_at = self._parse_utc(values.get("expires_at"), "expires_at")
        return TelegramUpdate(
            values["command_id"], values["chat_id"], values["user_id"], values["command"],
            issued_at,
            expires_at,
            values["nonce"], values["signature"], parameters,
        )

    @staticmethod
    def _parse_utc(value: Any, field: str) -> datetime:
        """Parse only string ISO-8601 UTC timestamps at the ingress boundary."""
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{field} must be an ISO-8601 string")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{field} must be a valid ISO-8601 timestamp") from exc
        if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
            raise ValueError(f"{field} must be timezone-aware UTC")
        return parsed


__all__ = ["TelegramWebhook", "TelegramWebhookConfig"]
