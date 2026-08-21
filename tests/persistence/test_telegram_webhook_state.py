from datetime import datetime, timedelta, timezone
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

from packages.persistence.telegram_webhook import (
    TELEGRAM_METADATA,
    SqlAlchemyTelegramStateStore,
)


def test_sqlalchemy_state_store_persists_replay_audit_and_rate_window() -> None:
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    TELEGRAM_METADATA.create_all(engine)
    Session = sessionmaker(bind=engine)
    store = SqlAlchemyTelegramStateStore(Session)
    now = datetime(2026, 8, 22, tzinfo=timezone.utc)

    assert store.claim_update(
        nonce="n-1", command_id="c-1", chat_id="chat-1", user_id="user-1",
        first_seen_at=now, expires_at=now + timedelta(minutes=5),
    ) is True
    assert store.claim_update(
        nonce="n-1", command_id="c-2", chat_id="chat-1", user_id="user-1",
        first_seen_at=now, expires_at=now + timedelta(minutes=5),
    ) is False
    assert store.claim_update(
        nonce="n-2", command_id="c-1", chat_id="chat-1", user_id="user-1",
        first_seen_at=now, expires_at=now + timedelta(minutes=5),
    ) is False
    store.record_audit(
        audit_id="a-1", command_id="c-1", operator_id="user-1", source="telegram",
        outcome="ACCEPTED", occurred_at=now,
    )
    store.record_audit(
        audit_id="a-1", command_id="c-1", operator_id="user-1", source="telegram",
        outcome="ACCEPTED", occurred_at=now,
    )
    assert store.allow_rate(identity="chat-1", now=now, limit=2, window_seconds=60)
    assert store.allow_rate(identity="chat-1", now=now, limit=2, window_seconds=60)
    assert not store.allow_rate(identity="chat-1", now=now, limit=2, window_seconds=60)


def test_migration_has_reversible_durable_tables() -> None:
    text = (Path(__file__).resolve().parents[2] / "migrations/versions/0011_telegram_webhook_state.py").read_text()
    assert 'revision = "0011_telegram_webhook_state"' in text
    assert 'down_revision = "0010_recovery"' in text
    for name in ("telegram_webhook_updates", "telegram_webhook_audits", "telegram_webhook_rate_limits"):
        assert name in text
    assert "def upgrade" in text and "def downgrade" in text
