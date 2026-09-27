"""Pinned HTTPS OIDC code exchange; only an ID token crosses this boundary."""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Mapping
from urllib.parse import urlsplit

import httpx


_MAX_RESPONSE_BYTES = 65_536
_MAX_ID_TOKEN_CHARS = 16_384
_VERIFIER = re.compile(r"[A-Za-z0-9._~-]{43,128}\Z", re.ASCII)


class OidcIssuerRejected(ValueError):
    """Stable rejection with no token, authorization code, or Secret detail."""


def _reject() -> OidcIssuerRejected:
    return OidcIssuerRejected("OIDC_ISSUER_NOT_VERIFIED")


def _canonical(value: object) -> bool:
    return type(value) is str and bool(value) and value == value.strip()


def _https_url(value: object) -> bool:
    if not _canonical(value) or any(ord(char) <= 32 or ord(char) == 127 for char in value):
        return False
    try:
        parts = urlsplit(value)
        return (parts.scheme == "https" and bool(parts.hostname)
                and parts.username is None and parts.password is None
                and not parts.query and not parts.fragment
                and parts.path.startswith("/"))
    except Exception:
        return False


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise _reject()
        result[key] = value
    return result


class OidcIssuerTransport:
    def __init__(
        self,
        *,
        issuer: str,
        token_endpoint: str,
        client_id: str,
        redirect_uri: str,
        ca_bundle: str | None = None,
        client_secret: Callable[[], str] | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        try:
            if (not _https_url(issuer) or not _https_url(token_endpoint)
                    or token_endpoint != issuer.rstrip("/") + "/protocol/openid-connect/token"
                    or not _https_url(redirect_uri) or not _canonical(client_id)
                    or (ca_bundle is not None and not _canonical(ca_bundle))
                    or (client_secret is not None and not callable(client_secret))
                    or (transport is not None and not isinstance(transport, httpx.BaseTransport))):
                raise _reject()
        except Exception:
            raise _reject() from None
        self._endpoint = token_endpoint
        self._client_id = client_id
        self._redirect_uri = redirect_uri
        self._verify: bool | str = ca_bundle if ca_bundle is not None else True
        self._secret_provider = client_secret
        self._transport = transport

    def exchange_code(
        self, code: str, code_verifier: str, redirect_uri: str, client_id: str
    ) -> Mapping[str, object]:
        try:
            if (not _canonical(code) or len(code) > 2048
                    or not _canonical(code_verifier) or _VERIFIER.fullmatch(code_verifier) is None
                    or redirect_uri != self._redirect_uri or client_id != self._client_id):
                raise _reject()
            auth = None
            if self._secret_provider is not None:
                secret = self._secret_provider()
                if not _canonical(secret):
                    raise _reject()
                auth = httpx.BasicAuth(self._client_id, secret)
            with httpx.Client(
                verify=self._verify, trust_env=False, follow_redirects=False,
                timeout=5.0, transport=self._transport,
            ) as client:
                with client.stream(
                    "POST", self._endpoint,
                    data={
                        "grant_type": "authorization_code", "code": code,
                        "code_verifier": code_verifier, "redirect_uri": self._redirect_uri,
                        "client_id": self._client_id,
                    },
                    headers={"Accept": "application/json"}, auth=auth,
                ) as response:
                    if (response.status_code != 200
                            or response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                            != "application/json"):
                        raise _reject()
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > _MAX_RESPONSE_BYTES:
                            raise _reject()
            result = json.loads(body.decode("utf-8"), object_pairs_hook=_unique_object)
            if not isinstance(result, dict):
                raise _reject()
            token = result.get("id_token")
            if (not _canonical(token) or len(token) > _MAX_ID_TOKEN_CHARS
                    or not token.isascii()):
                raise _reject()
            return {"id_token": token}
        except Exception:
            raise _reject() from None
