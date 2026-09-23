"""Detached Ollama wire values. Native model IDs come from live /api/tags."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any

from packages.llm_gateway.contracts import GatewayResponse

PROVIDER_ID = "ollama"
FORMAT = "ollama"
EXECUTOR = "default"


def canonical(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError, RecursionError):
        raise ValueError("VALUE_NOT_PLAIN") from None


def detached(value: Any) -> Any:
    return json.loads(canonical(value))


def digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def text(value: object, maximum: int = 256) -> str:
    if type(value) is not str or not value or value != value.strip() or len(value) > maximum:
        raise ValueError("TEXT_INVALID")
    return value


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status_code: int
    headers: tuple[tuple[str, str], ...]
    body: object

    def __post_init__(self) -> None:
        if type(self.status_code) is not int or not 100 <= self.status_code <= 599 or type(self.headers) is not tuple:
            raise ValueError("TRANSPORT_RESPONSE_INVALID")
        seen: set[str] = set()
        clean = []
        for pair in self.headers:
            if type(pair) is not tuple or len(pair) != 2 or any(type(x) is not str for x in pair):
                raise ValueError("HEADERS_INVALID")
            name, value = pair
            if not re.fullmatch(r"[A-Za-z0-9-]+", name) or "\r" in value or "\n" in value or name.lower() in seen:
                raise ValueError("HEADERS_INVALID")
            seen.add(name.lower())
            clean.append((name.lower(), value))
        object.__setattr__(self, "headers", tuple(clean))
        object.__setattr__(self, "body", detached(self.body))


@dataclass(frozen=True, slots=True)
class AdapterReceipt:
    kind: str
    request_id: str
    content_hash: str
    payload_json: str

    def to_dict(self) -> dict[str, Any]:
        return json.loads(self.payload_json)


def receipt(kind: str, request_id: str, payload: dict[str, Any]) -> AdapterReceipt:
    return AdapterReceipt(kind, request_id, digest(payload), canonical(payload))


@dataclass(frozen=True, slots=True)
class StreamResult:
    chunks: tuple[str, ...]
    response: GatewayResponse
    receipt: AdapterReceipt


@dataclass(frozen=True, slots=True)
class ProbeResult:
    payload_json: str

    def to_dict(self) -> dict[str, Any]:
        return json.loads(self.payload_json)
