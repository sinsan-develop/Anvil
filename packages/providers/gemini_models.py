"""Gemini static registry and detached host transport values."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any

from packages.llm_gateway.contracts import GatewayResponse


PROVIDER_ID = "gemini"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
FORMAT = "gemini"
EXECUTOR = "default"
AUTH_HEADER = "x-goog-api-key"  # Host injects the key; adapter never receives it.
REGISTRY_SOURCE = "OmniRoute release/v3.8.51 20f39008892b683a639063fb8aed8c07782fb0c3"
REGISTERED_MODELS = (
    "gemini-3.7-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite",
    "gemini-3-flash-preview", "gemini-3.1-flash-tts-preview", "gemini-2.5-pro",
    "gemini-2.5-flash", "gemini-2.5-flash-lite",
)
TTS_ONLY_MODELS = frozenset({"gemini-3.1-flash-tts-preview"})
HEALTH_MODEL = "gemini-2.5-flash"


def endpoint(model: str, *, stream: bool = False) -> str:
    if model not in REGISTERED_MODELS:
        raise ValueError("MODEL_NOT_REGISTERED")
    action = "streamGenerateContent?alt=sse" if stream else "generateContent"
    return f"{BASE_URL}/{model}:{action}"


def canonical(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
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


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status_code: int
    headers: tuple[tuple[str, str], ...]
    body: object
    authenticated_probe: bool = False

    def __post_init__(self) -> None:
        if (type(self.status_code) is not int or not 100 <= self.status_code <= 599
                or type(self.headers) is not tuple or type(self.authenticated_probe) is not bool):
            raise ValueError("TRANSPORT_RESPONSE_INVALID")
        normalized = []
        seen = set()
        for pair in self.headers:
            if type(pair) is not tuple or len(pair) != 2 or any(type(item) is not str for item in pair):
                raise ValueError("HEADERS_INVALID")
            name, value = pair
            if not re.fullmatch(r"[A-Za-z0-9-]+", name) or "\r" in value or "\n" in value or name.lower() in seen:
                raise ValueError("HEADERS_INVALID")
            seen.add(name.lower())
            normalized.append((name.lower(), value))
        object.__setattr__(self, "headers", tuple(normalized))
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
    return AdapterReceipt(kind, request_id, digest(payload), canonical(payload))


@dataclass(frozen=True, slots=True)
class StreamResult:
    chunks: tuple[str, ...]
    response: GatewayResponse
    receipt: AdapterReceipt
