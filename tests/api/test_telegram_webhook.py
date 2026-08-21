from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from packages.agent_team.telegram_adapter import TelegramAdapter, TelegramUpdate
from packages.api.fastapi_app import create_app
from packages.api.telegram_webhook import TelegramWebhook, TelegramWebhookConfig


def _adapter() -> TelegramAdapter:
    return TelegramAdapter(
        allowlisted_identities=frozenset({("chat-1", "user-1")}),
        signing_secret="update-secret",
        console_base_url="https://anvil.sinsan.kr",
    )


def _body(now: datetime, command: str = "status", command_id: str = "cmd-1", nonce: str = "nonce-1") -> bytes:
    unsigned = TelegramUpdate(
        command_id, "chat-1", "user-1", command, now,
        now + timedelta(minutes=5), nonce, "placeholder", (),
    )
    signed = TelegramUpdate(
        unsigned.command_id, unsigned.chat_id, unsigned.user_id, unsigned.command,
        unsigned.issued_at, unsigned.expires_at, unsigned.nonce,
        TelegramAdapter.sign(unsigned, "update-secret"), unsigned.parameters,
    )
    return json.dumps({
        "command_id": signed.command_id, "chat_id": signed.chat_id,
        "user_id": signed.user_id, "command": signed.command,
        "issued_at": signed.issued_at.isoformat(), "expires_at": signed.expires_at.isoformat(),
        "nonce": signed.nonce, "signature": signed.signature, "parameters": [],
    }, separators=(",", ":")).encode()


def _headers(body: bytes) -> dict[str, str]:
    return {
        "x-telegram-bot-api-secret-token": "telegram-secret",
        "x-anvil-signature": hmac.new(b"webhook-secret", body, hashlib.sha256).hexdigest(),
    }


def test_webhook_requires_both_secret_boundary_and_hmac() -> None:
    webhook = TelegramWebhook(_adapter(), TelegramWebhookConfig("telegram-secret", "webhook-secret"))
    now = datetime.now(timezone.utc)
    body = _body(now)
    assert webhook.handle(body, {}, now=now)[0] == 403
    headers = _headers(body)
    headers["x-anvil-signature"] = "0" * 64
    assert webhook.handle(body, headers, now=now)[0] == 403


def test_webhook_delegates_replay_and_high_risk_denial() -> None:
    webhook = TelegramWebhook(_adapter(), TelegramWebhookConfig("telegram-secret", "webhook-secret"))
    now = datetime.now(timezone.utc)
    body = _body(now)
    assert webhook.handle(body, _headers(body), now=now)[1]["outcome"] == "ACCEPTED"
    assert webhook.handle(body, _headers(body), now=now)[1]["outcome"] == "REPLAYED"
    deploy = _body(now, "deploy", "cmd-2", "nonce-2")
    result = webhook.handle(deploy, _headers(deploy), now=now)
    assert result[1]["outcome"] == "APPROVAL_REQUIRED"
    assert "webhook-secret" not in repr(result)


def test_webhook_rate_limit_and_same_origin_route() -> None:
    now = datetime.now(timezone.utc)
    body = _body(now)
    webhook = TelegramWebhook(_adapter(), TelegramWebhookConfig("telegram-secret", "webhook-secret", rate_limit=1))
    app = create_app(telegram_webhook=webhook)
    client = TestClient(app)
    assert client.post("/integrations/telegram/webhook", content=body, headers=_headers(body)).status_code == 200
    second = _body(now, "resume")
    assert webhook.handle(second, _headers(second), now=now)[0] == 429
