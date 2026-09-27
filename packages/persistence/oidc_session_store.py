"""Persistent short-lived OIDC session records, without issuing bearer tokens."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import re
from typing import Callable

import sqlalchemy as sa


OIDC_SESSION_METADATA = sa.MetaData()
oidc_sessions = sa.Table(
    "oidc_sessions", OIDC_SESSION_METADATA,
    sa.Column("session_digest", sa.LargeBinary(32), primary_key=True),
    sa.Column("issuer", sa.String(2048), nullable=False),
    sa.Column("subject", sa.String(512), nullable=False),
    sa.Column("csrf_token", sa.String(43), nullable=False),
    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("step_up_valid_until", sa.DateTime(timezone=True), nullable=True),
    sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("length(session_digest) = 32", name="ck_oidc_session_digest_size"),
    sa.Index("ix_oidc_sessions_expires_at", "expires_at"),
)

_CSRF = re.compile(r"[A-Za-z0-9_-]{43}")
_MAX_TTL = timedelta(seconds=900)
_STEP_UP_TTL = timedelta(seconds=300)


@dataclass(frozen=True)
class OidcStoredSession:
    issuer: str
    subject: str
    csrf_token: str
    expires_at: datetime
    step_up_valid_until: datetime | None


class OidcSessionStoreRejected(ValueError):
    """Stable non-identifying input, duplicate, or availability failure."""


def _digest(value: object) -> bytes:
    if type(value) is not bytes or len(value) != 32:
        raise OidcSessionStoreRejected("OIDC_SESSION_STORE_INVALID_INPUT")
    return value


def _identity(value: object, limit: int) -> bool:
    return (type(value) is str and 0 < len(value) <= limit and value == value.strip()
            and "*" not in value and all(ord(character) >= 32 for character in value))


def _utc(value: object) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise OidcSessionStoreRejected("OIDC_SESSION_STORE_INVALID_INPUT")
    return value.astimezone(timezone.utc)


def _stored_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _db_clock(session):
    # CURRENT_TIMESTAMP is transaction-start fixed in PostgreSQL.
    if session.get_bind().dialect.name == "postgresql":
        return sa.func.clock_timestamp()
    return sa.func.current_timestamp()


def _database_utc(session) -> datetime:
    return _stored_utc(session.execute(sa.select(_db_clock(session))).scalar_one())


def _valid_record(value: object, now: datetime) -> OidcStoredSession:
    if (not isinstance(value, OidcStoredSession)
            or not _identity(value.issuer, 2048)
            or not _identity(value.subject, 512)
            or type(value.csrf_token) is not str or not _CSRF.fullmatch(value.csrf_token)):
        raise OidcSessionStoreRejected("OIDC_SESSION_STORE_INVALID_INPUT")
    expiry = _utc(value.expires_at)
    if not now < expiry <= now + _MAX_TTL:
        raise OidcSessionStoreRejected("OIDC_SESSION_STORE_INVALID_INPUT")
    if value.step_up_valid_until is not None:
        step_expiry = _utc(value.step_up_valid_until)
        if not now < step_expiry <= expiry or step_expiry > now + _STEP_UP_TTL:
            raise OidcSessionStoreRejected("OIDC_SESSION_STORE_INVALID_INPUT")
    return value


def _unique_violation(error: sa.exc.IntegrityError) -> bool:
    original = error.orig
    if getattr(original, "sqlstate", None) == "23505" or getattr(original, "pgcode", None) == "23505":
        return True
    return getattr(original, "sqlite_errorname", None) in (
        "SQLITE_CONSTRAINT_PRIMARYKEY", "SQLITE_CONSTRAINT_UNIQUE",
    )


class SqlAlchemyOidcSessionStore:
    """Each operation owns one transaction and leaves other sessions untouched."""

    def __init__(self, session_factory: Callable):
        if not callable(session_factory):
            raise OidcSessionStoreRejected("OIDC_SESSION_STORE_INVALID_INPUT")
        self._session_factory = session_factory

    def put(self, session_digest: bytes, record: OidcStoredSession) -> None:
        digest = _digest(session_digest)
        failure = None
        try:
            with self._session_factory() as session:
                with session.begin():
                    valid = _valid_record(record, _database_utc(session))
                    session.execute(oidc_sessions.insert().values(
                        session_digest=digest, issuer=valid.issuer, subject=valid.subject,
                        csrf_token=valid.csrf_token,
                        expires_at=_utc(valid.expires_at),
                        step_up_valid_until=(None if valid.step_up_valid_until is None
                                             else _utc(valid.step_up_valid_until)),
                    ))
        except OidcSessionStoreRejected:
            raise
        except sa.exc.IntegrityError as error:
            failure = ("OIDC_SESSION_STORE_DUPLICATE" if _unique_violation(error)
                       else "OIDC_SESSION_STORE_NOT_AVAILABLE")
        except Exception:
            failure = "OIDC_SESSION_STORE_NOT_AVAILABLE"
        if failure is not None:
            raise OidcSessionStoreRejected(failure)

    def get(self, session_digest: bytes) -> OidcStoredSession | None:
        digest = _digest(session_digest)
        failed = False
        try:
            with self._session_factory() as session:
                with session.begin():
                    row = session.execute(sa.select(
                        oidc_sessions.c.issuer, oidc_sessions.c.subject,
                        oidc_sessions.c.csrf_token, oidc_sessions.c.expires_at,
                        oidc_sessions.c.step_up_valid_until,
                    ).where(
                        oidc_sessions.c.session_digest == digest,
                        oidc_sessions.c.revoked_at.is_(None),
                        oidc_sessions.c.expires_at > _db_clock(session),
                    )).one_or_none()
                    if row is None:
                        return None
                    expiry = _stored_utc(row.expires_at)
                    now = _database_utc(session)
                    if expiry <= now:
                        return None
                    if expiry > now + _MAX_TTL:
                        raise ValueError("invalid stored session")
                    if (not _identity(row.issuer, 2048) or not _identity(row.subject, 512)
                            or type(row.csrf_token) is not str
                            or not _CSRF.fullmatch(row.csrf_token)):
                        raise ValueError("invalid stored session")
                    step_expiry = (None if row.step_up_valid_until is None
                                   else _stored_utc(row.step_up_valid_until))
                    if step_expiry is not None and (step_expiry > expiry
                                                    or step_expiry > now + _STEP_UP_TTL):
                        raise ValueError("invalid stored session")
                    return OidcStoredSession(row.issuer, row.subject, row.csrf_token,
                                             expiry, step_expiry)
        except Exception:
            failed = True
        if failed:
            raise OidcSessionStoreRejected("OIDC_SESSION_STORE_NOT_AVAILABLE")
        return None

    def revoke(self, session_digest: bytes) -> None:
        digest = _digest(session_digest)
        failed = False
        try:
            with self._session_factory() as session:
                with session.begin():
                    session.execute(oidc_sessions.update().where(
                        oidc_sessions.c.session_digest == digest,
                        oidc_sessions.c.revoked_at.is_(None),
                    ).values(revoked_at=_db_clock(session)))
        except Exception:
            failed = True
        if failed:
            raise OidcSessionStoreRejected("OIDC_SESSION_STORE_NOT_AVAILABLE")


__all__ = ["OIDC_SESSION_METADATA", "OidcStoredSession", "OidcSessionStoreRejected",
           "SqlAlchemyOidcSessionStore", "oidc_sessions"]
