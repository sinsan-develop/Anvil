"""Credential-safe OpenAI error classification."""
from __future__ import annotations

from dataclasses import dataclass
import re

from .openai_models import TransportResponse, canonical


@dataclass
class OpenAIAdapterError(ValueError):
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
    raise OpenAIAdapterError(code, retryable, retry_after, status)


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

    def retry_delay() -> int | None:
        raw = response.header("retry-after")
        if raw is None:
            return None
        if re.fullmatch(r"0|[1-9][0-9]{0,9}", raw) is None or int(raw) > maximum:
            reject("RETRY_AFTER_INVALID", status=status)
        return int(raw)

    error = response.body.get("error") if type(response.body) is dict else None
    code = error.get("code") if type(error) is dict else None
    if status == 429:
        if code in {"organization_spend_limit_exceeded", "project_spend_limit_exceeded"}:
            reject("SPEND_LIMIT_REACHED", status=status)
        if code == "organization_usage_limit_exceeded":
            reject("USAGE_LIMIT_REACHED", status=status)
        if code == "credit_balance_exhausted":
            reject("CREDIT_BALANCE_EXHAUSTED", status=status)
        if code in {"rate_limit_exceeded", "slow_down"}:
            reject("RATE_LIMITED", retryable=True, retry_after=retry_delay(), status=status)
        reject("PROVIDER_429_AMBIGUOUS", status=status)
    if status == 400:
        reject("INVALID_REQUEST", status=status)
    if status == 401:
        reject("AUTHENTICATION_FAILED", status=status)
    if status == 403:
        reject("AUTHORIZATION_DENIED", status=status)
    if status == 404:
        reject("MODEL_OR_PATH_NOT_FOUND", status=status)
    if status in {408, 504}:
        reject("TIMEOUT", retryable=True, retry_after=retry_delay(), status=status)
    if status == 503 and code == "server_is_overloaded":
        reject("OVERLOADED", retryable=True, retry_after=retry_delay(), status=status)
    if 500 <= status <= 599:
        reject("TEMPORARY_5XX", retryable=True, status=status)
    reject("PROVIDER_ERROR_UNMAPPED", status=status)
