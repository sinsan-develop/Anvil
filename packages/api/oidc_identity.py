"""Offline verification of a caller-pinned OIDC ID Token, without authorization."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import urlsplit

import jwt


_SKEW_SECONDS = 30
_STEP_UP_MAX_AGE_SECONDS = 300
_PRIVATE_JWK_FIELDS = frozenset({"d", "p", "q", "dp", "dq", "qi", "oth", "k"})
_UNTRUSTED_HEADERS = frozenset({"jku", "x5u", "jwk", "x5c", "x5t", "x5t#S256", "crit"})


class OidcTokenRejected(ValueError):
    """A redacted, stable rejection of configuration or token evidence."""


def _reject() -> OidcTokenRejected:
    return OidcTokenRejected("OIDC_ID_TOKEN_NOT_VERIFIED")


def _canonical(value: object) -> bool:
    return isinstance(value, str) and bool(value) and value == value.strip()


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise _reject()
        result[key] = value
    return result


def _integer_claim(value: object) -> bool:
    return type(value) is int and value >= 0


@dataclass(frozen=True)
class OidcIdentity:
    subject: str
    issuer: str
    auth_time: int | None
    acr: str | None
    step_up_verified: bool


class OidcIdTokenVerifier:
    """Verify signed identity facts against only preconfigured, local trust."""

    def __init__(
        self,
        jwks_json: str,
        *,
        issuer: str,
        client_id: str,
        step_up_acr: str,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        try:
            parsed_issuer = urlsplit(issuer)
            if (not _canonical(issuer) or parsed_issuer.scheme != "https"
                    or not parsed_issuer.hostname or parsed_issuer.username
                    or parsed_issuer.password or parsed_issuer.query or parsed_issuer.fragment
                    or not _canonical(client_id) or not _canonical(step_up_acr)
                    or not callable(clock)):
                raise _reject()
            jwks = json.loads(jwks_json, object_pairs_hook=_unique_object)
            if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list) or not jwks["keys"]:
                raise _reject()
            keys: dict[str, object] = {}
            for item in jwks["keys"]:
                if (not isinstance(item, dict) or item.get("kty") != "RSA"
                        or item.get("use") != "sig" or item.get("alg") != "RS256"
                        or not _canonical(item.get("kid")) or item["kid"] in keys
                        or _PRIVATE_JWK_FIELDS.intersection(item)
                        or not _canonical(item.get("n")) or not _canonical(item.get("e"))):
                    raise _reject()
                keys[item["kid"]] = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(item))
        except Exception:
            raise _reject() from None
        self._keys = keys
        self._issuer = issuer
        self._client_id = client_id
        self._step_up_acr = step_up_acr
        self._clock = clock

    def verify(
        self, token: str, *, expected_nonce: str, require_step_up: bool = False
    ) -> OidcIdentity:
        try:
            if not _canonical(expected_nonce) or not isinstance(token, str):
                raise _reject()
            header = jwt.get_unverified_header(token)
            if (header.get("alg") != "RS256" or not _canonical(header.get("kid"))
                    or header["kid"] not in self._keys or _UNTRUSTED_HEADERS.intersection(header)):
                raise _reject()
            payload = jwt.decode(
                token, self._keys[header["kid"]], algorithms=["RS256"],
                audience=self._client_id, issuer=self._issuer,
                options={"require": ["iss", "aud", "sub", "exp", "iat", "nonce"],
                         "verify_exp": False, "verify_iat": False, "verify_nbf": False,
                         "strict_aud": True},
            )
            now = self._clock()
            if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
                raise _reject()
            now_ts = now.timestamp()
            if (payload.get("iss") != self._issuer or payload.get("aud") != self._client_id
                    or not _canonical(payload.get("sub")) or payload.get("nonce") != expected_nonce
                    or not _integer_claim(payload.get("exp"))
                    or not _integer_claim(payload.get("iat"))
                    or payload["exp"] <= now_ts - _SKEW_SECONDS
                    or payload["iat"] > now_ts + _SKEW_SECONDS
                    or payload["exp"] <= payload["iat"]):
                raise _reject()
            not_before = payload.get("nbf")
            if not_before is not None and (
                not _integer_claim(not_before) or not_before > now_ts + _SKEW_SECONDS
            ):
                raise _reject()
            auth_time = payload.get("auth_time")
            acr = payload.get("acr")
            if auth_time is not None and not _integer_claim(auth_time):
                raise _reject()
            if acr is not None and not _canonical(acr):
                raise _reject()
            stepped_up = (
                acr == self._step_up_acr and auth_time is not None
                and now_ts - _STEP_UP_MAX_AGE_SECONDS <= auth_time <= now_ts + _SKEW_SECONDS
            )
            if require_step_up and not stepped_up:
                raise _reject()
            return OidcIdentity(payload["sub"], self._issuer, auth_time, acr, stepped_up)
        except Exception:
            raise _reject() from None
