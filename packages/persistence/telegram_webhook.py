"""Durable state port and SQLAlchemy adapter for the Telegram ingress.

The webhook is deliberately kept independent of an ORM model registry.  The
tables in this module are the canonical small persistence boundary and the
Alembic migration creates the same schema for PostgreSQL.
"""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Protocol

import sqlalchemy as sa


telegram_updates = sa.Table(
    "telegram_webhook_updates",
    sa.MetaData(),
    sa.Column("nonce", sa.String(256), primary_key=True),
    sa.Column("command_id", sa.String(256), nullable=False, unique=True),
    sa.Column("chat_id", sa.String(256), nullable=False),
    sa.Column("user_id", sa.String(256), nullable=False),
    sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
)
telegram_audits = sa.Table(
    "telegram_webhook_audits",
    sa.MetaData(),
    sa.Column("audit_id", sa.String(256), primary_key=True),
    sa.Column("command_id", sa.String(256), nullable=False),
    sa.Column("operator_id", sa.String(256), nullable=False),
    sa.Column("source", sa.String(64), nullable=False),
    sa.Column("outcome", sa.String(64), nullable=False),
    sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
)
telegram_rate_limits = sa.Table(
    "telegram_webhook_rate_limits",
    sa.MetaData(),
    sa.Column("identity", sa.String(512), primary_key=True),
    sa.Column("window_start", sa.DateTime(timezone=True), primary_key=True),
    sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
    sa.CheckConstraint("request_count >= 0", name="ck_telegram_rate_count"),
)

# A shared metadata object is useful to isolated tests and SQLAlchemy tooling.
TELEGRAM_METADATA = sa.MetaData()
for _table in (telegram_updates, telegram_audits, telegram_rate_limits):
    _table.to_metadata(TELEGRAM_METADATA)


class TelegramStateStore(Protocol):
    def claim_update(self, *, nonce: str, command_id: str, chat_id: str, user_id: str,
                     first_seen_at: datetime, expires_at: datetime) -> bool: ...

    def record_audit(self, *, audit_id: str, command_id: str, operator_id: str,
                     source: str, outcome: str, occurred_at: datetime) -> None: ...

    def allow_rate(self, *, identity: str, now: datetime, limit: int,
                   window_seconds: int) -> bool: ...


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
        raise ValueError("timestamp must be UTC")
    return value


class InMemoryTelegramStateStore:
    """Explicit test double; production must inject ``SqlAlchemyTelegramStateStore``."""

    def __init__(self) -> None:
        self._updates: set[tuple[str, str]] = set()
        self._audits: dict[str, dict[str, str]] = {}
        self._windows: dict[str, deque[datetime]] = defaultdict(deque)

    def claim_update(self, **kwargs: Any) -> bool:
        key = (kwargs["nonce"], kwargs["command_id"])
        if key in self._updates or any(key[0] == nonce or key[1] == command for nonce, command in self._updates):
            return False
        self._updates.add(key)
        return True

    def record_audit(self, **kwargs: Any) -> None:
        self._audits[kwargs["audit_id"]] = {key: str(value) for key, value in kwargs.items()}

    def allow_rate(self, *, identity: str, now: datetime, limit: int, window_seconds: int) -> bool:
        bucket = self._windows[identity]
        cutoff = now - timedelta(seconds=window_seconds)
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True


class SqlAlchemyTelegramStateStore:
    """Small session-factory backed repository; each operation is transactional."""

    def __init__(self, session_factory: Callable[[], Any]) -> None:
        self._session_factory = session_factory

    def claim_update(self, *, nonce: str, command_id: str, chat_id: str, user_id: str,
                     first_seen_at: datetime, expires_at: datetime) -> bool:
        session = self._session_factory()
        try:
            with session.begin():
                exists = session.execute(sa.select(telegram_updates.c.nonce).where(
                    sa.or_(telegram_updates.c.nonce == nonce, telegram_updates.c.command_id == command_id)
                )).first()
                if exists:
                    return False
                session.execute(telegram_updates.insert().values(
                    nonce=nonce, command_id=command_id, chat_id=chat_id, user_id=user_id,
                    first_seen_at=_utc(first_seen_at), expires_at=_utc(expires_at),
                ))
                return True
        except sa.exc.IntegrityError:
            return False
        finally:
            session.close()

    def record_audit(self, *, audit_id: str, command_id: str, operator_id: str,
                     source: str, outcome: str, occurred_at: datetime) -> None:
        session = self._session_factory()
        try:
            with session.begin():
                session.execute(telegram_audits.insert().values(
                    audit_id=audit_id, command_id=command_id, operator_id=operator_id,
                    source=source, outcome=outcome, occurred_at=_utc(occurred_at),
                ))
        except sa.exc.IntegrityError:
            # Audit IDs are deterministic and retries must not create a second row.
            pass
        finally:
            session.close()

    def allow_rate(self, *, identity: str, now: datetime, limit: int, window_seconds: int) -> bool:
        session = self._session_factory()
        normalized_now = _utc(now)
        epoch = int(normalized_now.timestamp())
        window_start = datetime.fromtimestamp(epoch - (epoch % window_seconds), tz=timezone.utc)
        try:
            with session.begin():
                session.execute(telegram_rate_limits.delete().where(
                    telegram_rate_limits.c.identity == identity,
                    telegram_rate_limits.c.window_start < window_start - timedelta(seconds=window_seconds * 2),
                ))
                row = session.execute(sa.select(telegram_rate_limits.c.request_count).where(
                    telegram_rate_limits.c.identity == identity,
                    telegram_rate_limits.c.window_start == window_start,
                ).with_for_update()).first()
                if row is None:
                    session.execute(telegram_rate_limits.insert().values(
                        identity=identity, window_start=window_start, request_count=1,
                    ))
                    return True
                if row.request_count >= limit:
                    return False
                session.execute(telegram_rate_limits.update().where(
                    telegram_rate_limits.c.identity == identity,
                    telegram_rate_limits.c.window_start == window_start,
                ).values(request_count=telegram_rate_limits.c.request_count + 1))
                return True
        finally:
            session.close()


__all__ = ["TELEGRAM_METADATA", "TelegramStateStore", "InMemoryTelegramStateStore", "SqlAlchemyTelegramStateStore"]
