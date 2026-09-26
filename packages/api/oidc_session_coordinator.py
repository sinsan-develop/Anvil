"""Bind verified OIDC code flow to current server authority and opaque sessions."""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets
from typing import Callable

from packages.api.common import SessionPrincipal
from packages.api.oidc_code_flow import OidcAuthorizationRequest, OidcCodeFlow
from packages.api.oidc_identity import OidcIdentity
from packages.api.oidc_principal import (
    OidcPrincipalPolicy, OidcPrincipalResolver, bind_oidc_principal,
)
from packages.persistence.oidc_principal_directory import OidcDirectoryRejected
from packages.persistence.oidc_session_store import (
    OidcStoredSession, OidcSessionStoreRejected, SqlAlchemyOidcSessionStore,
)


_TOKEN = re.compile(r"[A-Za-z0-9_-]{43}\Z")
_SESSION_TTL = timedelta(seconds=900)
_STEP_UP_TTL = timedelta(seconds=300)
_UNAUTHORIZED = "OIDC_SESSION_NOT_AUTHORIZED"
_UNAVAILABLE = "OIDC_SESSION_NOT_AVAILABLE"


class OidcSessionRejected(ValueError):
    """Stable failure code without OIDC, bearer, CSRF, or SQL payload."""


@dataclass(frozen=True)
class OidcIssuedSession:
    session_token: str = field(repr=False)
    csrf_token: str = field(repr=False)
    expires_at: datetime
    max_age_seconds: int = 900


def _utc(clock: Callable[[], datetime]) -> datetime:
    value = clock()
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("invalid clock")
    return value.astimezone(timezone.utc)


def _new_token(random_bytes: Callable[[int], bytes]) -> str:
    raw = random_bytes(32)
    if type(raw) is not bytes or len(raw) != 32:
        raise ValueError("invalid randomness")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _digest(token: object) -> bytes | None:
    if type(token) is not str or not _TOKEN.fullmatch(token):
        return None
    try:
        raw = base64.urlsafe_b64decode(token + "=")
        if len(raw) != 32 or base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii") != token:
            return None
    except (ValueError, UnicodeError, binascii.Error):
        return None
    return hashlib.sha256(token.encode("ascii")).digest()


class _OneBindingResolver:
    def __init__(self, binding):
        self._binding = binding

    def resolve(self, _issuer, _subject):
        return self._binding


class OidcSessionCoordinator:
    def __init__(
        self, code_flow: OidcCodeFlow, resolver: OidcPrincipalResolver,
        policy: OidcPrincipalPolicy, session_store: SqlAlchemyOidcSessionStore,
        clock: Callable[[], datetime] | None = None,
        random_bytes: Callable[[int], bytes] | None = None,
    ):
        if (not isinstance(code_flow, OidcCodeFlow)
                or not callable(getattr(resolver, "resolve", None))
                or not isinstance(policy, OidcPrincipalPolicy)
                or not isinstance(session_store, SqlAlchemyOidcSessionStore)
                or (clock is not None and not callable(clock))
                or (random_bytes is not None and not callable(random_bytes))):
            raise OidcSessionRejected(_UNAUTHORIZED)
        self._flow = code_flow
        self._resolver = resolver
        self._policy = policy
        self._store = session_store
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._random_bytes = random_bytes or secrets.token_bytes

    def begin(self, require_step_up: bool = False) -> OidcAuthorizationRequest:
        failed = False
        try:
            return self._flow.begin(require_step_up=require_step_up)
        except Exception:
            failed = True
        if failed:
            raise OidcSessionRejected(_UNAUTHORIZED)
        raise OidcSessionRejected(_UNAUTHORIZED)

    def _bind(self, identity: OidcIdentity, csrf_token: str) -> tuple[SessionPrincipal | None, str | None]:
        try:
            binding = self._resolver.resolve(identity.issuer, identity.subject)
        except OidcDirectoryRejected as error:
            return None, (_UNAVAILABLE if str(error) == "OIDC_DIRECTORY_NOT_AVAILABLE"
                          else _UNAUTHORIZED)
        except Exception:
            return None, _UNAVAILABLE
        if binding is None:
            return None, _UNAUTHORIZED
        try:
            return bind_oidc_principal(
                identity, resolver=_OneBindingResolver(binding), policy=self._policy,
                csrf_token=csrf_token,
            ), None
        except Exception:
            return None, _UNAUTHORIZED

    def complete(self, *, code: str, state: str, browser_state: str) -> OidcIssuedSession:
        failed = False
        try:
            identity = self._flow.complete(code=code, state=state,
                                           browser_state=browser_state)
            now = _utc(self._clock)
            bearer = _new_token(self._random_bytes)
            csrf = _new_token(self._random_bytes)
            if bearer == csrf:
                raise ValueError("repeated random material")
        except Exception:
            failed = True
        if failed:
            raise OidcSessionRejected(_UNAUTHORIZED)
        principal, failure = self._bind(identity, csrf)
        if principal is None:
            raise OidcSessionRejected(failure or _UNAUTHORIZED)
        expiry = now + _SESSION_TTL
        step_expiry = None
        if identity.step_up_verified:
            auth_time = identity.auth_time
            if type(auth_time) is not int:
                raise OidcSessionRejected(_UNAUTHORIZED)
            invalid_auth_time = False
            try:
                step_expiry = min(datetime.fromtimestamp(auth_time, timezone.utc) + _STEP_UP_TTL,
                                  now + _STEP_UP_TTL, expiry)
            except (OverflowError, OSError, ValueError):
                invalid_auth_time = True
            if invalid_auth_time:
                raise OidcSessionRejected(_UNAUTHORIZED)
            if step_expiry <= now:
                raise OidcSessionRejected(_UNAUTHORIZED)
        record = OidcStoredSession(identity.issuer, identity.subject, csrf, expiry,
                                   step_expiry)
        failure = None
        try:
            self._store.put(_digest(bearer), record)
        except OidcSessionStoreRejected as error:
            failure = (_UNAVAILABLE if str(error) == "OIDC_SESSION_STORE_NOT_AVAILABLE"
                       else _UNAUTHORIZED)
        except Exception:
            failure = _UNAVAILABLE
        if failure is not None:
            raise OidcSessionRejected(failure)
        return OidcIssuedSession(bearer, csrf, expiry)

    def authenticate(self, session_token: str) -> SessionPrincipal | None:
        digest = _digest(session_token)
        if digest is None:
            return None
        failed = False
        try:
            record = self._store.get(digest)
        except Exception:
            failed = True
        if failed:
            raise OidcSessionRejected(_UNAVAILABLE)
        if record is None:
            return None
        invalid_record = False
        try:
            now = _utc(self._clock)
            if record.expires_at <= now:
                return None
            if record.step_up_valid_until is not None and record.step_up_valid_until <= now:
                return None
            identity = OidcIdentity(record.subject, record.issuer, None, None,
                                    record.step_up_valid_until is not None)
        except Exception:
            invalid_record = True
        if invalid_record:
            raise OidcSessionRejected(_UNAVAILABLE)
        principal, failure = self._bind(identity, record.csrf_token)
        if failure == _UNAVAILABLE:
            raise OidcSessionRejected(_UNAVAILABLE)
        return principal

    def revoke(self, session_token: str) -> None:
        digest = _digest(session_token)
        if digest is None:
            raise OidcSessionRejected(_UNAUTHORIZED)
        failed = False
        try:
            self._store.revoke(digest)
        except Exception:
            failed = True
        if failed:
            raise OidcSessionRejected(_UNAVAILABLE)


__all__ = ["OidcIssuedSession", "OidcSessionCoordinator", "OidcSessionRejected"]
