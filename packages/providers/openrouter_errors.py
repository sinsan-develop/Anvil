"""Stable, secret-free OpenRouter errors and model versus connection scope."""
from __future__ import annotations

from dataclasses import dataclass
import re

from .openrouter_models import TransportResponse, canonical


@dataclass(slots=True)
class OpenRouterAdapterError(ValueError):
    code: str
    scope: str = "request"
    retryable: bool = False
    retry_after_seconds: int | None = None
    status_code: int | None = None

    def __post_init__(self) -> None:
        ValueError.__init__(self, self.code)

    def __str__(self) -> str:
        return self.code


def reject(code: str, *, scope: str = "request", retryable: bool = False,
           retry_after: int | None = None, status: int | None = None) -> None:
    raise OpenRouterAdapterError(code, scope, retryable, retry_after, status)


_CREDENTIAL = re.compile(r"(?i)(authorization\s*:\s*(?:bearer|basic)\s+\S+|(?:api[_-]?key|access[_-]?token|secret)\s*[=:]\s*\S+)")


def guard_material(value: object) -> None:
    try:
        encoded = canonical(value)
    except ValueError:
        reject("RESPONSE_MALFORMED")
    if _CREDENTIAL.search(encoded):
        reject("CREDENTIAL_MATERIAL_DETECTED")
    def inspect(item: object) -> None:
        if type(item) is dict:
            for key, member in item.items():
                compact = re.sub(r"[^a-z0-9]", "", str(key).lower())
                if compact.endswith(("authorization", "apikey", "accesstoken", "secret")) and member is not None:
                    reject("CREDENTIAL_MATERIAL_DETECTED")
                inspect(member)
        elif type(item) in {list, tuple}:
            for member in item:
                inspect(member)
    inspect(value)


def guard_headers(headers: tuple[tuple[str, str], ...]) -> None:
    for name, _ in headers:
        if re.sub(r"[^a-z0-9]", "", name).endswith(("authorization", "apikey", "token", "secret")):
            reject("CREDENTIAL_MATERIAL_DETECTED")


def map_error(status: int, body: object, *, retry_after: str | None = None,
              maximum: int = 86400, model_operation: bool = True) -> None:
    delay = None
    if retry_after is not None:
        if not re.fullmatch(r"0|[1-9][0-9]{0,9}", retry_after) or int(retry_after) > maximum:
            reject("RETRY_AFTER_INVALID", status=status)
        delay = int(retry_after)
    code = body.get("error", {}).get("code") if type(body) is dict and type(body.get("error")) is dict else None
    if status == 402:
        reject("QUOTA_EXHAUSTED", scope="connection", status=status)
    if status == 404:
        if model_operation:
            reject("MODEL_UNAVAILABLE", scope="model", status=status)
        reject("PROVIDER_ERROR_UNMAPPED", status=status)
    if status == 401:
        reject("AUTHENTICATION_FAILED", scope="connection", status=status)
    if status == 403:
        reject("AUTHORIZATION_DENIED", scope="connection", status=status)
    if status == 429 or code == 429:
        reject("RATE_LIMIT", retryable=True, retry_after=delay, status=status)
    if status in {408, 504}:
        reject("TIMEOUT", retryable=True, retry_after=delay, status=status)
    if 500 <= status <= 599:
        reject("TEMPORARY_5XX", retryable=True, retry_after=delay, status=status)
    if status == 400:
        reject("INVALID_REQUEST", status=status)
    reject("PROVIDER_ERROR_UNMAPPED", status=status)
