"""Same-origin Telegram webhook boundary."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import json
from typing import Any, Mapping

from packages.agent_team.telegram_adapter import TelegramAdapter, TelegramUpdate


@dataclass(frozen=True, slots=True)
class TelegramWebhookConfig:
    secret_token: str
    hmac_secret: str
    max_body_bytes: int = 64 * 1024
    rate_limit: int = 30
    rate_window_seconds: int = 60

    def __post_init__(self) -> None:
        if not isinstance(self.secret_token, str) or not self.secret_token.strip():
            raise ValueError("secret_token is required")
        if not isinstance(self.hmac_secret, str) or not self.hmac_secret.strip():
            raise ValueError("hmac_secret is required")
        if type(self.max_body_bytes) is not int or self.max_body_bytes < 1:
            raise ValueError("max_body_bytes must be positive")
        if type(self.rate_limit) is not int or self.rate_limit < 1:
            raise ValueError("rate_limit must be positive")
        if type(self.rate_window_seconds) is not int or self.rate_window_seconds < 1:
            raise ValueError("rate_window_seconds must be positive")


class TelegramWebhook:
    def __init__(self, adapter: TelegramAdapter, config: TelegramWebhookConfig) -> None:
        self.adapter = adapter
        self.config = config
        self._requests: dict[str, deque[datetime]] = {}

    def handle(self, raw_body: bytes, headers: Mapping[str, str], *, now: datetime) -> tuple[int, dict[str, Any]]:
        if now.tzinfo is None or now.utcoffset() != timezone.utc.utcoffset(now):
            return 400, {"error": "invalid clock"}
        if len(raw_body) > self.config.max_body_bytes:
            return 413, {"error": "payload too large"}
        if not hmac.compare_digest(headers.get("x-telegram-bot-api-secret-token", ""), self.config.secret_token):
            return 403, {"error": "webhook authentication failed"}
        provided = headers.get("x-anvil-signature", "")
        expected = hmac.new(self.config.hmac_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(provided, expected):
            return 403, {"error": "webhook signature failed"}
        try:
            payload = json.loads(raw_body)
            update = self._decode(payload)
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            return 400, {"error": "malformed webhook payload"}
        key = update.chat_id
        bucket = self._requests.setdefault(key, deque())
        cutoff = now.timestamp() - self.config.rate_window_seconds
        while bucket and bucket[0].timestamp() <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.config.rate_limit:
            return 429, {"error": "rate limit exceeded"}
        bucket.append(now)
        result = self.adapter.process(update, now=now)
        return 200, {"accepted": result.accepted, "outcome": result.outcome.value, "text": result.text, "audit_id": result.audit.audit_id}

    @staticmethod
    def _decode(payload: Any) -> TelegramUpdate:
        if not isinstance(payload, dict):
            raise ValueError("payload must be object")
        values = payload.get("update", payload)
        if not isinstance(values, dict):
            raise ValueError("update must be object")
        parameters = values.get("parameters", ())
        if isinstance(parameters, list):
            parameters = tuple(tuple(pair) for pair in parameters)
        return TelegramUpdate(
            values["command_id"], values["chat_id"], values["user_id"], values["command"],
            datetime.fromisoformat(values["issued_at"].replace("Z", "+00:00")),
            datetime.fromisoformat(values["expires_at"].replace("Z", "+00:00")),
            values["nonce"], values["signature"], parameters,
        )


__all__ = ["TelegramWebhook", "TelegramWebhookConfig"]
