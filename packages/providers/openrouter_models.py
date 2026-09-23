"""Detached transport and receipt values for the OpenRouter host adapter."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
from typing import Any

from packages.llm_gateway.contracts import GatewayResponse


def canonical(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (TypeError, ValueError, RecursionError):
        raise ValueError("VALUE_NOT_PLAIN") from None


def detached(value: Any) -> Any:
    return json.loads(canonical(value))


def digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def text(value: object, *, maximum: int = 256) -> str:
    if type(value) is not str or not value or value != value.strip() or len(value) > maximum:
        raise ValueError("TEXT_INVALID")
    return value


def usd(value: object) -> str:
    if type(value) not in {str, int, float} or type(value) is bool:
        raise ValueError("PRICE_INVALID")
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("PRICE_INVALID") from None
    if not amount.is_finite() or amount < 0:
        raise ValueError("PRICE_INVALID")
    return str(amount)


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status_code: int
    headers: tuple[tuple[str, str], ...]
    body: object

    def __post_init__(self) -> None:
        if type(self.status_code) is not int or not 100 <= self.status_code <= 599 or type(self.headers) is not tuple:
            raise ValueError("TRANSPORT_RESPONSE_INVALID")
        headers = []
        seen = set()
        for pair in self.headers:
            if type(pair) is not tuple or len(pair) != 2 or any(type(item) is not str for item in pair):
                raise ValueError("HEADERS_INVALID")
            name, value = pair
            if not re.fullmatch(r"[A-Za-z0-9-]+", name) or "\r" in value or "\n" in value or name.lower() in seen:
                raise ValueError("HEADERS_INVALID")
            seen.add(name.lower())
            headers.append((name.lower(), value))
        object.__setattr__(self, "headers", tuple(headers))
        object.__setattr__(self, "body", detached(self.body))

    def header(self, name: str) -> str | None:
        return next((value for key, value in self.headers if key == name.lower()), None)


@dataclass(frozen=True, slots=True)
class AdapterReceipt:
    kind: str
    request_id: str
    content_hash: str
    payload_json: str

    def to_dict(self) -> dict[str, Any]:
        return json.loads(self.payload_json)


def receipt(kind: str, request_id: str, payload: dict[str, Any]) -> AdapterReceipt:
    encoded = canonical(payload)
    return AdapterReceipt(kind, request_id, digest(payload), encoded)


@dataclass(frozen=True, slots=True)
class StreamResult:
    chunks: tuple[str, ...]
    response: GatewayResponse
    receipt: AdapterReceipt
