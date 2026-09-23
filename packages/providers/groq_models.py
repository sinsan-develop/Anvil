"""Immutable, detached value objects for the F04 GROQ adapter."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any

from packages.llm_gateway.contracts import GatewayResponse


def canonical(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"),
                          ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError, RecursionError):
        raise ValueError("VALUE_NOT_PLAIN") from None


def detached(value: Any) -> Any:
    try:
        return json.loads(canonical(value))
    except (json.JSONDecodeError, ValueError):
        raise ValueError("VALUE_NOT_PLAIN") from None


def digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def canonical_text(value: object, *, field: str, maximum: int = 4096) -> str:
    if type(value) is not str or not value or value != value.strip() or len(value) > maximum:
        raise ValueError(f"{field.upper()}_INVALID")
    return value


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status_code: int
    headers: tuple[tuple[str, str], ...]
    body: object

    def __post_init__(self) -> None:
        if type(self.status_code) is not int or not 100 <= self.status_code <= 599:
            raise ValueError("STATUS_INVALID")
        if type(self.headers) is not tuple:
            raise ValueError("HEADERS_INVALID")
        normalized: list[tuple[str, str]] = []
        seen: set[str] = set()
        for item in self.headers:
            if type(item) is not tuple or len(item) != 2:
                raise ValueError("HEADERS_INVALID")
            name, value = item
            if (type(name) is not str or type(value) is not str
                    or re.fullmatch(r"[A-Za-z0-9-]+", name) is None
                    or "\r" in value or "\n" in value):
                raise ValueError("HEADERS_INVALID")
            name = name.lower()
            if name in seen:
                raise ValueError("HEADERS_INVALID")
            seen.add(name)
            normalized.append((name, value))
        object.__setattr__(self, "headers", tuple(normalized))
        object.__setattr__(self, "body", detached(self.body))

    def header(self, name: str) -> str | None:
        key = name.lower()
        return next((value for header, value in self.headers if header == key), None)


@dataclass(frozen=True, slots=True)
class AdapterReceipt:
    kind: str
    request_id: str
    content_hash: str
    payload_json: str

    def to_dict(self) -> dict[str, Any]:
        return json.loads(self.payload_json)


def receipt(kind: str, request_id: str, payload: dict[str, Any]) -> AdapterReceipt:
    canonical_text(kind, field="kind", maximum=64)
    canonical_text(request_id, field="request_id", maximum=128)
    body = detached(payload)
    if type(body) is not dict:
        raise ValueError("RECEIPT_INVALID")
    encoded = canonical(body)
    return AdapterReceipt(kind, request_id, digest(body), encoded)


@dataclass(frozen=True, slots=True)
class StreamResult:
    chunks: tuple[str, ...]
    response: GatewayResponse
    receipt: AdapterReceipt

    def __post_init__(self) -> None:
        if type(self.chunks) is not tuple or any(type(value) is not str or not value for value in self.chunks):
            raise ValueError("STREAM_CHUNKS_INVALID")
        if not isinstance(self.response, GatewayResponse) or not isinstance(self.receipt, AdapterReceipt):
            raise TypeError("STREAM_RESULT_INVALID")
