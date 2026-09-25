"""Server-side, one-use OIDC code/PKCE transaction without network or sessions."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from hmac import compare_digest
from secrets import token_bytes
from typing import Callable, Mapping, Protocol
from urllib.parse import urlencode, urlsplit

from .oidc_identity import OidcIdTokenVerifier, OidcIdentity


_PENDING_TTL = timedelta(seconds=300)


class OidcCodeFlowRejected(ValueError):
    """Stable, redacted rejection; no code, token, state or URL is retained."""


def _reject() -> OidcCodeFlowRejected:
    return OidcCodeFlowRejected("OIDC_CODE_FLOW_NOT_VERIFIED")


def _canonical(value: object) -> bool:
    return isinstance(value, str) and bool(value) and value == value.strip()


def _https_url(value: object) -> bool:
    if not _canonical(value):
        return False
    parts = urlsplit(value)
    return (parts.scheme == "https" and bool(parts.hostname) and not parts.username
            and not parts.password and not parts.query and not parts.fragment)


def _now(clock: Callable[[], datetime]) -> datetime:
    value = clock()
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise _reject()
    return value.astimezone(timezone.utc)


def _base64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


@dataclass(frozen=True)
class OidcAuthorizationRequest:
    url: str = field(repr=False)
    browser_state: str = field(repr=False)


@dataclass(frozen=True)
class PendingOidcRequest:
    nonce: str = field(repr=False)
    code_verifier: str = field(repr=False)
    expires_at: datetime
    require_step_up: bool


class PendingAuthStore(Protocol):
    """Caller must implement atomic, one-use put/consume with no logging."""

    def put(self, state_digest: bytes, pending: PendingOidcRequest) -> None: ...

    def consume(self, state_digest: bytes) -> PendingOidcRequest | None: ...


class OidcCodeFlow:
    def __init__(
        self,
        authorization_endpoint: str,
        *,
        client_id: str,
        redirect_uri: str,
        verifier: OidcIdTokenVerifier,
        pending_store: PendingAuthStore,
        exchange_code: Callable[[str, str, str, str], Mapping[str, object]],
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        random_bytes: Callable[[int], bytes] = token_bytes,
    ) -> None:
        try:
            if (not _https_url(authorization_endpoint) or not _https_url(redirect_uri)
                    or not _canonical(client_id) or not isinstance(verifier, OidcIdTokenVerifier)
                    or not callable(pending_store.put) or not callable(pending_store.consume)
                    or not callable(exchange_code) or not callable(clock) or not callable(random_bytes)):
                raise _reject()
            _now(clock)
        except Exception:
            raise _reject() from None
        self._authorization_endpoint = authorization_endpoint
        self._client_id = client_id
        self._redirect_uri = redirect_uri
        self._verifier = verifier
        self._store = pending_store
        self._exchange = exchange_code
        self._clock = clock
        self._random_bytes = random_bytes

    def begin(self, *, require_step_up: bool = False) -> OidcAuthorizationRequest:
        try:
            if type(require_step_up) is not bool:
                raise _reject()
            random_parts = [self._random_bytes(32) for _ in range(3)]
            if any(type(part) is not bytes or len(part) != 32 for part in random_parts):
                raise _reject()
            state, nonce, code_verifier = map(_base64url, random_parts)
            if len({state, nonce, code_verifier}) != 3:
                raise _reject()
            pending = PendingOidcRequest(
                nonce=nonce, code_verifier=code_verifier,
                expires_at=_now(self._clock) + _PENDING_TTL,
                require_step_up=require_step_up,
            )
            digest = sha256(state.encode("ascii")).digest()
            self._store.put(digest, pending)
            challenge = _base64url(sha256(code_verifier.encode("ascii")).digest())
            parameters = {
                "response_type": "code", "scope": "openid", "client_id": self._client_id,
                "redirect_uri": self._redirect_uri, "state": state, "nonce": nonce,
                "code_challenge": challenge, "code_challenge_method": "S256",
            }
            if require_step_up:
                parameters["claims"] = json.dumps({
                    "id_token": {
                        "acr": {"essential": True, "values": [self._verifier.step_up_acr]},
                        "auth_time": {"essential": True},
                    }
                }, separators=(",", ":"))
                parameters["max_age"] = str(self._verifier.step_up_max_age_seconds)
            query = urlencode(parameters)
            return OidcAuthorizationRequest(self._authorization_endpoint + "?" + query, state)
        except Exception:
            raise _reject() from None

    def complete(self, *, code: str, state: str, browser_state: str) -> OidcIdentity:
        try:
            if (not _canonical(code) or not _canonical(state) or not _canonical(browser_state)
                    or len(code) > 2048 or len(state) != 43 or len(browser_state) != 43
                    or not compare_digest(state, browser_state)):
                raise _reject()
            digest = sha256(state.encode("ascii")).digest()
            pending = self._store.consume(digest)
            if (not isinstance(pending, PendingOidcRequest)
                    or _now(self._clock) >= pending.expires_at):
                raise _reject()
            response = self._exchange(
                code, pending.code_verifier, self._redirect_uri, self._client_id
            )
            if not isinstance(response, Mapping) or not _canonical(response.get("id_token")):
                raise _reject()
            identity = self._verifier.verify(
                response["id_token"], expected_nonce=pending.nonce,
                require_step_up=pending.require_step_up,
            )
            # An unsolicited high-ACR token cannot promote an ordinary request.
            return identity if pending.require_step_up else replace(identity, step_up_verified=False)
        except Exception:
            raise _reject() from None
