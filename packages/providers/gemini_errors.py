"""Credential-safe Gemini error classification."""
from __future__ import annotations

from dataclasses import dataclass
import re

from .gemini_models import TransportResponse, canonical


@dataclass
class GeminiAdapterError(ValueError):
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
    raise GeminiAdapterError(code, retryable, retry_after, status)


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
        if normalized.endswith(("authorization", "apikey", "accesstoken", "token", "secret")):
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
    if type(error) is not dict:
        error = {}
    details = error.get("details")
    reasons = {detail.get("reason", "").upper() for detail in details
               if type(detail) is dict and type(detail.get("reason")) is str} if type(details) is list else set()
    if status == 400:
        if "API_KEY_INVALID" in reasons:
            reject("API_KEY_INVALID", status=status)
        reject("INVALID_REQUEST", status=status)
    if status == 401:
        reject("AUTHENTICATION_FAILED", status=status)
    if status == 402:
        reject("CREDIT_DEPLETED", status=status)
    if status == 403:
        reject("AUTHORIZATION_DENIED", status=status)
    if status == 404:
        reject("MODEL_OR_PATH_NOT_FOUND", status=status)
    if status == 429:
        if reasons & {"RATE_LIMIT_EXCEEDED", "RATE_LIMIT", "TOO_MANY_REQUESTS"}:
            reject("RATE_LIMIT", retryable=True, retry_after=delay, status=status)
        reject("PROVIDER_429_AMBIGUOUS", status=status)
    if status in {408, 504}:
        reject("TIMEOUT", retryable=True, retry_after=delay, status=status)
    if 500 <= status <= 599:
        reject("TEMPORARY_5XX", retryable=True, retry_after=delay, status=status)
    reject("PROVIDER_ERROR_UNMAPPED", status=status)
