"""Framework-neutral request, error, identity, and pagination contracts."""

from __future__ import annotations

from dataclasses import dataclass
import base64
import hashlib
import hmac
import json
import re
from typing import Any, Mapping


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


class ApiContractError(ValueError):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.public_message = message
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class SessionPrincipal:
    actor_id: str
    actor_role: str
    csrf_token: str
    permissions: frozenset[str]
    project_ids: frozenset[str]
    environment_ids: frozenset[str]

    def __post_init__(self) -> None:
        for value, field in ((self.actor_id, "actor_id"), (self.actor_role, "actor_role"), (self.csrf_token, "csrf_token")):
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise ValueError(f"{field} must be a canonical non-empty string")


@dataclass(frozen=True, slots=True)
class ApplicationRequest:
    endpoint_key: str
    resource_id: str | None
    path_parameters: Mapping[str, str]
    body: Mapping[str, Any]
    headers: Mapping[str, str]
    principal: SessionPrincipal
    request_id: str
    expected_version: int | None
    target_hash: str | None
    reason: str | None


@dataclass(frozen=True, slots=True)
class CursorPosition:
    sort_key: str
    item_id: str


class StableCursorCodec:
    """HMAC-authenticated opaque cursor bound to one list resource."""

    def __init__(self, signing_key: bytes) -> None:
        if not isinstance(signing_key, bytes) or len(signing_key) < 24:
            raise ValueError("cursor signing key must contain at least 24 bytes")
        self._key = signing_key

    def encode(self, *, resource: str, sort_key: str, item_id: str) -> str:
        values = (resource, sort_key, item_id)
        if any(not isinstance(value, str) or not value.strip() for value in values):
            raise ValueError("cursor fields must be non-empty strings")
        payload = json.dumps(
            {"item_id": item_id, "resource": resource, "sort_key": sort_key, "version": 1},
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        signature = hmac.new(self._key, payload, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(payload + signature).rstrip(b"=").decode("ascii")

    def decode(self, token: str, *, resource: str) -> CursorPosition:
        try:
            encoded = token.encode("ascii")
            padded = encoded + b"=" * (-len(encoded) % 4)
            raw = base64.b64decode(padded, altchars=b"-_", validate=True)
            payload, signature = raw[:-32], raw[-32:]
            canonical = base64.urlsafe_b64encode(raw).rstrip(b"=")
            if canonical != encoded:
                raise ValueError("non-canonical encoding")
            expected = hmac.new(self._key, payload, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError("bad signature")
            value = json.loads(payload)
            if value.get("version") != 1 or value.get("resource") != resource:
                raise ValueError("wrong resource")
            sort_key = value["sort_key"]
            item_id = value["item_id"]
            if not isinstance(sort_key, str) or not isinstance(item_id, str):
                raise ValueError("invalid cursor fields")
            return CursorPosition(sort_key, item_id)
        except (UnicodeError, ValueError, KeyError, json.JSONDecodeError) as error:
            raise ApiContractError("INVALID_CURSOR", "The pagination cursor is invalid.") from error


def canonical_target_hash(value: str | None) -> str:
    if value is None or not _HASH.fullmatch(value):
        raise ApiContractError("TARGET_HASH_REQUIRED", "A canonical target hash is required.")
    return value
