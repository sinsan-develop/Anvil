"""Credential-safe Anthropic error classification."""
from __future__ import annotations

from dataclasses import dataclass
import re

from .anthropic_models import TransportResponse, canonical


@dataclass
class AnthropicAdapterError(ValueError):
    code: str
    retryable: bool = False
    retry_after_seconds: int | None = None
    status_code: int | None = None

    def __post_init__(self) -> None:
        ValueError.__init__(self, self.code)

    def __str__(self) -> str:
        return self.code


def reject(code: str, *, retryable: bool = False, retry_after: int | None = None,
           status: int | None = None) -> None:
    raise AnthropicAdapterError(code, retryable, retry_after, status)


_CREDENTIAL = re.compile(r"(?i)(authorization\s*[:=]\s*(?:bearer|basic)\s+\S+|(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S+)")


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
                normalized = re.sub(r"[^a-z0-9]", "", str(key).lower())
                if normalized.endswith(("authorization", "apikey", "accesstoken", "secret")) and member is not None:
                    reject("CREDENTIAL_MATERIAL_DETECTED")
                inspect(member)
        elif type(item) in {list, tuple}:
            for member in item:
                inspect(member)
    inspect(value)


def guard_headers(headers: tuple[tuple[str, str], ...]) -> None:
    for name, _ in headers:
        normalized = re.sub(r"[^a-z0-9]", "", name.lower())
        if normalized.endswith(("authorization", "apikey", "accesstoken", "secret")):
            reject("CREDENTIAL_MATERIAL_DETECTED")


def map_error(response: TransportResponse, *, maximum: int) -> None:
    status = response.status_code
    raw = response.header("retry-after")
    delay = None
    if raw is not None:
        if re.fullmatch(r"0|[1-9][0-9]{0,9}", raw) is None or int(raw) > maximum:
            reject("RETRY_AFTER_INVALID", status=status)
        delay = int(raw)
    error = response.body.get("error") if type(response.body) is dict else None
    kind = error.get("type") if type(error) is dict else None
    detail = error.get("details") if type(error) is dict else None
    spend_code = (type(detail) is dict and detail.get("error_code") == "enforced_spend_limit_reached")
    message = error.get("message") if type(error) is dict else None
    specified_spend = (type(message) is str and
                       (message.startswith("You have reached your specified API usage limits") or
                        message.startswith("You have reached your specified workspace API usage limits")))
    if spend_code or (specified_spend and
                      (status == 400 and kind == "invalid_request_error" or status == 429)):
        reject("SPEND_LIMIT_REACHED", status=status)
    if status == 400:
        reject("INVALID_REQUEST", status=status)
    if status == 401:
        reject("AUTHENTICATION_FAILED", status=status)
    if status == 403:
        reject("AUTHORIZATION_DENIED", status=status)
    if status == 404:
        reject("MODEL_OR_PATH_NOT_FOUND", status=status)
    if status == 429:
        # A Claude Code workspace spend cap can also carry Retry-After.
        reject("PROVIDER_429_AMBIGUOUS", status=status)
    if status in {408, 504}:
        reject("TIMEOUT", retryable=True, retry_after=delay, status=status)
    if status == 529 and kind == "overloaded_error":
        reject("OVERLOADED", retryable=True, retry_after=delay, status=status)
    if 500 <= status <= 599:
        reject("TEMPORARY_5XX", retryable=True, retry_after=delay, status=status)
    reject("PROVIDER_ERROR_UNMAPPED", status=status)
