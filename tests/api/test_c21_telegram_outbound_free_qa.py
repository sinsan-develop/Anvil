"""C-21 outbound-free Telegram acceptance, denial, replay and audit QA."""

from datetime import datetime, timezone
import json

from fastapi.testclient import TestClient
import pytest

from packages.agent_team.telegram_adapter import APPROVAL_COMMANDS, TelegramAdapter
from packages.api.fastapi_app import create_app
from packages.api.telegram_webhook import TelegramWebhook, TelegramWebhookConfig
from packages.persistence.telegram_webhook import InMemoryTelegramStateStore


WEBHOOK_SENTINEL = "qa-webhook-sentinel-not-a-real-secret"
SIGNING_SENTINEL = "qa-signing-sentinel-not-a-real-secret"


@pytest.fixture
def client_and_store():
    store = InMemoryTelegramStateStore()
    adapter = TelegramAdapter(
        allowlisted_identities=frozenset({("100", "200")}),
        signing_secret=SIGNING_SENTINEL,
        console_base_url="https://anvil.local",
        state_store=store,
    )
    webhook = TelegramWebhook(
        adapter,
        TelegramWebhookConfig(WEBHOOK_SENTINEL, SIGNING_SENTINEL, allowed_hosts=("anvil.local",)),
        state_store=store,
    )
    return TestClient(create_app(telegram_webhook=webhook), base_url="https://anvil.local"), store, adapter


def _native(update_id: int, command: str, *, chat_id: str = "100", user_id: str = "200") -> bytes:
    return json.dumps(
        {
            "update_id": update_id,
            "message": {
                "chat": {"id": chat_id},
                "from": {"id": user_id},
                "text": f"/{command}",
            },
        },
        separators=(",", ":"),
    ).encode()


def _post(client: TestClient, body: bytes):
    return client.post(
        "/integrations/telegram/webhook",
        content=body,
        headers={
            "host": "anvil.local",
            "x-telegram-bot-api-secret-token": WEBHOOK_SENTINEL,
        },
    )


def test_allowlist_replay_and_durable_audit_double_are_outbound_free(client_and_store, monkeypatch) -> None:
    import socket

    client, store, adapter = client_and_store
    monkeypatch.setattr(socket, "create_connection", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("outbound I/O")))

    accepted = _post(client, _native(1, "status"))
    replayed = _post(client, _native(1, "status"))
    unauthorized = _post(client, _native(2, "status", user_id="999"))

    assert (accepted.status_code, accepted.json()["outcome"]) == (200, "ACCEPTED")
    assert (replayed.status_code, replayed.json()["outcome"]) == (200, "REPLAYED")
    assert (unauthorized.status_code, unauthorized.json()["outcome"]) == (200, "UNAUTHORIZED")
    assert [audit.outcome for audit in adapter.audits] == ["ACCEPTED", "REPLAYED", "UNAUTHORIZED"]
    assert len(store._audits) == 3


@pytest.mark.parametrize("command", sorted(APPROVAL_COMMANDS))
def test_every_high_risk_command_is_rejected_for_web_console_approval(client_and_store, command: str) -> None:
    client, store, _adapter = client_and_store

    response = _post(client, _native(100 + sorted(APPROVAL_COMMANDS).index(command), command))

    assert response.status_code == 200
    assert response.json()["accepted"] is False
    assert response.json()["outcome"] == "APPROVAL_REQUIRED"
    assert len(store._audits) == 1


def test_webhook_and_signing_secrets_never_cross_the_response_or_audit_boundary(client_and_store) -> None:
    client, store, adapter = client_and_store

    response = _post(client, _native(50, "deploy"))
    rendered = repr((response.headers, response.json(), store._audits, adapter.audits))

    assert WEBHOOK_SENTINEL not in rendered
    assert SIGNING_SENTINEL not in rendered
