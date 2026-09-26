"""Short lived, one-use PostgreSQL persistence for OIDC authorization requests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Callable

import sqlalchemy as sa

from packages.api.oidc_code_flow import PendingOidcRequest


OIDC_PENDING_METADATA = sa.MetaData()
oidc_pending_auth = sa.Table(
    "oidc_pending_auth", OIDC_PENDING_METADATA,
    sa.Column("state_digest", sa.LargeBinary(32), primary_key=True),
    sa.Column("nonce", sa.String(43), nullable=False),
    sa.Column("code_verifier", sa.String(43), nullable=False),
    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("require_step_up", sa.Boolean(), nullable=False),
    sa.CheckConstraint("length(state_digest) = 32", name="ck_oidc_pending_digest_size"),
    sa.Index("ix_oidc_pending_expires_at", "expires_at"),
)

_BASE64URL_32 = re.compile(r"[A-Za-z0-9_-]{43}")
_MAX_TTL = timedelta(seconds=300)


class PendingAuthStoreRejected(ValueError):
    """Stable error with no state, nonce, verifier, or database payload."""


def _digest(value: object) -> bytes:
    if type(value) is not bytes or len(value) != 32:
        raise PendingAuthStoreRejected("OIDC_PENDING_STORE_INVALID_INPUT")
    return value


def _pending(value: object, db_now: datetime) -> PendingOidcRequest:
    if (not isinstance(value, PendingOidcRequest)
            or type(value.nonce) is not str or not _BASE64URL_32.fullmatch(value.nonce)
            or type(value.code_verifier) is not str
            or not _BASE64URL_32.fullmatch(value.code_verifier)
            or type(value.require_step_up) is not bool
            or not isinstance(value.expires_at, datetime)
            or value.expires_at.tzinfo is None or value.expires_at.utcoffset() is None):
        raise PendingAuthStoreRejected("OIDC_PENDING_STORE_INVALID_INPUT")
    expiry = value.expires_at.astimezone(timezone.utc)
    if not db_now < expiry <= db_now + _MAX_TTL:
        raise PendingAuthStoreRejected("OIDC_PENDING_STORE_INVALID_INPUT")
    return value


def _db_clock(session):
    # PostgreSQL CURRENT_TIMESTAMP is fixed at transaction start, including lock waits.
    if session.get_bind().dialect.name == "postgresql":
        return sa.func.clock_timestamp()
    return sa.func.current_timestamp()


def _database_utc(session) -> datetime:
    value = session.execute(sa.select(_db_clock(session))).scalar_one()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class SqlAlchemyPendingAuthStore:
    """Each operation owns a transaction; consume uses one DELETE RETURNING."""

    def __init__(self, session_factory: Callable):
        if not callable(session_factory):
            raise PendingAuthStoreRejected("OIDC_PENDING_STORE_INVALID_INPUT")
        self._session_factory = session_factory

    def put(self, state_digest: bytes, pending: PendingOidcRequest) -> None:
        digest = _digest(state_digest)
        failure = None
        try:
            with self._session_factory() as session:
                with session.begin():
                    session.execute(oidc_pending_auth.delete().where(
                        oidc_pending_auth.c.expires_at <= _db_clock(session),
                        oidc_pending_auth.c.state_digest != digest,
                    ))
                    valid = _pending(pending, _database_utc(session))
                    session.execute(oidc_pending_auth.insert().values(
                        state_digest=digest, nonce=valid.nonce,
                        code_verifier=valid.code_verifier,
                        expires_at=valid.expires_at.astimezone(timezone.utc),
                        require_step_up=valid.require_step_up,
                    ))
        except PendingAuthStoreRejected:
            raise
        except sa.exc.IntegrityError:
            failure = "OIDC_PENDING_STORE_DUPLICATE"
        except Exception:
            failure = "OIDC_PENDING_STORE_NOT_AVAILABLE"
        if failure is not None:
            raise PendingAuthStoreRejected(failure)

    def consume(self, state_digest: bytes) -> PendingOidcRequest | None:
        digest = _digest(state_digest)
        failed = False
        try:
            with self._session_factory() as session:
                with session.begin():
                    session.execute(oidc_pending_auth.delete().where(
                        oidc_pending_auth.c.expires_at <= _db_clock(session),
                    ))
                    row = session.execute(oidc_pending_auth.delete().where(
                        oidc_pending_auth.c.state_digest == digest,
                        oidc_pending_auth.c.expires_at > _db_clock(session),
                    ).returning(
                        oidc_pending_auth.c.nonce,
                        oidc_pending_auth.c.code_verifier,
                        oidc_pending_auth.c.expires_at,
                        oidc_pending_auth.c.require_step_up,
                    )).one_or_none()
                    if row is None:
                        return None
                    expiry = row.expires_at
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    else:
                        expiry = expiry.astimezone(timezone.utc)
                    if expiry <= _database_utc(session):
                        return None
                    return PendingOidcRequest(row.nonce, row.code_verifier,
                                              expiry, row.require_step_up)
        except Exception:
            failed = True
        if failed:
            raise PendingAuthStoreRejected("OIDC_PENDING_STORE_NOT_AVAILABLE")
        return None


__all__ = ["OIDC_PENDING_METADATA", "PendingAuthStoreRejected",
           "SqlAlchemyPendingAuthStore", "oidc_pending_auth"]
