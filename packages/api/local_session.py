"""Explicitly enabled, least-privilege session boundary for operational tests.

This is not an OIDC replacement.  It exists so an operator can prove the
authenticated SSE contract with one environment-scoped identity while the
production identity provider is not yet connected.  The bootstrap credential
is never used as a session token and issued session tokens are stored only as
SHA-256 digests.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
from secrets import token_urlsafe
from threading import RLock
from typing import Callable

from .common import ApiContractError, SessionPrincipal
from .security import SESSION_MAX_AGE_SECONDS


Clock = Callable[[], datetime]
TokenFactory = Callable[[], str]
_ALLOWED_PERMISSION_SCOPES = frozenset(
    {"tasks:write", "tasks:read", "run:events:read"}
)


def _canonical(value: str, name: str) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{name} must be a canonical non-empty string")
    return value


@dataclass(frozen=True, slots=True)
class LocalTestSessionConfig:
    bootstrap_token: str = field(repr=False)
    actor_id: str
    project_id: str
    environment_id: str
    run_ids: frozenset[str]
    permission_scopes: frozenset[str] = frozenset({"run:events:read"})
    ttl_seconds: int = 900
    max_failed_attempts: int = 5
    failed_attempt_window_seconds: int = 60

    def __post_init__(self) -> None:
        _canonical(self.bootstrap_token, "bootstrap_token")
        if len(self.bootstrap_token) < 32 or len(self.bootstrap_token) > 256 or not self.bootstrap_token.isascii():
            raise ValueError("bootstrap_token must contain 32 to 256 ASCII characters")
        for value, name in (
            (self.actor_id, "actor_id"),
            (self.project_id, "project_id"),
            (self.environment_id, "environment_id"),
        ):
            _canonical(value, name)
        if not isinstance(self.run_ids, frozenset) or not self.run_ids:
            raise ValueError("run_ids must be an explicit non-empty frozenset")
        for run_id in self.run_ids:
            _canonical(run_id, "run_id")
        if (
            not isinstance(self.permission_scopes, frozenset)
            or not self.permission_scopes
            or not self.permission_scopes <= _ALLOWED_PERMISSION_SCOPES
        ):
            raise ValueError("permission_scopes must contain only supported explicit scopes")
        if type(self.ttl_seconds) is not int or not 0 < self.ttl_seconds <= SESSION_MAX_AGE_SECONDS:
            raise ValueError(f"ttl_seconds must be between 1 and {SESSION_MAX_AGE_SECONDS}")
        if type(self.max_failed_attempts) is not int or self.max_failed_attempts <= 0:
            raise ValueError("max_failed_attempts must be positive")
        if type(self.failed_attempt_window_seconds) is not int or self.failed_attempt_window_seconds <= 0:
            raise ValueError("failed_attempt_window_seconds must be positive")


@dataclass(frozen=True, slots=True)
class IssuedSession:
    session_token: str = field(repr=False)
    csrf_token: str = field(repr=False)
    expires_at: datetime
    max_age_seconds: int


@dataclass(frozen=True, slots=True)
class _StoredSession:
    principal: SessionPrincipal
    expires_at: datetime


class LocalTestSessionService:
    """Issues one short-lived opaque session for one explicit test scope."""

    def __init__(
        self,
        config: LocalTestSessionConfig,
        *,
        clock: Clock | None = None,
        token_factory: TokenFactory | None = None,
    ) -> None:
        self.config = config
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._token_factory = token_factory or (lambda: token_urlsafe(32))
        self._sessions: dict[bytes, _StoredSession] = {}
        self._failed_attempts: dict[str, list[datetime]] = {}
        self._lock = RLock()

    @staticmethod
    def _digest(token: str) -> bytes:
        return sha256(token.encode("utf-8")).digest()

    def _now(self) -> datetime:
        current = self._clock()
        if not isinstance(current, datetime) or current.tzinfo is None:
            raise RuntimeError("session clock must return an aware datetime")
        return current.astimezone(timezone.utc)

    def _new_token(self) -> str:
        token = self._token_factory()
        if not isinstance(token, str) or len(token) < 32 or len(token) > 256 or not token.isascii():
            raise RuntimeError("session token generation failed")
        return token

    def _prune(self, now: datetime) -> None:
        self._sessions = {
            digest: session
            for digest, session in self._sessions.items()
            if session.expires_at > now
        }

    def issue(self, bootstrap_credential: str, *, client_key: str) -> IssuedSession:
        with self._lock:
            now = self._now()
            self._prune(now)
            client = _canonical(client_key, "client_key")
            window_start = now - timedelta(seconds=self.config.failed_attempt_window_seconds)
            failures = [
                attempted_at
                for attempted_at in self._failed_attempts.get(client, ())
                if attempted_at > window_start
            ]
            self._failed_attempts[client] = failures
            if len(failures) >= self.config.max_failed_attempts:
                raise ApiContractError(
                    "AUTH_RATE_LIMITED",
                    "Authentication attempts are temporarily limited.",
                    429,
                )
            if (
                not isinstance(bootstrap_credential, str)
                or not bootstrap_credential.isascii()
                or len(bootstrap_credential) > 256
                or not hmac.compare_digest(bootstrap_credential, self.config.bootstrap_token)
            ):
                failures.append(now)
                raise ApiContractError(
                    "AUTHENTICATION_REQUIRED",
                    "Authentication is required.",
                    401,
                )

            self._failed_attempts.pop(client, None)
            session_token = self._new_token()
            csrf_token = self._new_token()
            if hmac.compare_digest(session_token, csrf_token):
                raise RuntimeError("session and CSRF tokens must be independent")
            expires_at = now + timedelta(seconds=self.config.ttl_seconds)
            principal = SessionPrincipal(
                actor_id=self.config.actor_id,
                actor_role="tester",
                csrf_token=csrf_token,
                permissions=self.config.permission_scopes,
                project_ids=frozenset({self.config.project_id}),
                environment_ids=frozenset({self.config.environment_id}),
            )
            # This bootstrap path intentionally permits only one live session.
            # A new successful issuance revokes the prior test session.
            self._sessions = {self._digest(session_token): _StoredSession(principal, expires_at)}
            return IssuedSession(session_token, csrf_token, expires_at, self.config.ttl_seconds)

    def authenticate(self, session_token: str) -> SessionPrincipal | None:
        if (
            not isinstance(session_token, str)
            or len(session_token) < 32
            or len(session_token) > 256
            or not session_token.isascii()
        ):
            return None
        with self._lock:
            now = self._now()
            self._prune(now)
            stored = self._sessions.get(self._digest(session_token))
            return stored.principal if stored is not None and stored.expires_at > now else None

    def allows_run(self, run_id: str | None) -> bool:
        return isinstance(run_id, str) and run_id in self.config.run_ids


__all__ = ["IssuedSession", "LocalTestSessionConfig", "LocalTestSessionService"]
