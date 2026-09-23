"""Stable, secret-free MISTRAL failure mapping."""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from .mistral_models import TransportResponse, canonical


@dataclass(frozen=True, slots=True)
class MistralAdapterError(ValueError):
    code: str
    retryable: bool = False
    retry_after_seconds: int | None = None
    status_code: int | None = None

    def __post_init__(self) -> None:
        ValueError.__init__(self, self.code)

    def __str__(self) -> str:
        return self.code


_CREDENTIAL = re.compile(
    r"(?i)(authorization\s*:\s*(?:bearer|basic)\s+\S+|"
    r"(?:api[_-]?key|access[_-]?token|secret)\s*[=:]\s*\S+)"
)


def reject(code: str, *, retryable: bool = False,
           retry_after: int | None = None, status: int | None = None) -> None:
    raise MistralAdapterError(code, retryable, retry_after, status)


def reject_credential_material(value: Any) -> None:
    try:
        encoded = canonical(value)
    except ValueError:
        reject("RESPONSE_MALFORMED")
    if _CREDENTIAL.search(encoded):
        reject("CREDENTIAL_MATERIAL_DETECTED")


def reject_credential_headers(headers: tuple[tuple[str, str], ...]) -> None:
    for name, _ in headers:
        compact = re.sub(r"[^a-z0-9]", "", name.lower())
        if compact.endswith(("authorization", "apikey", "token", "secret")):
            reject("CREDENTIAL_MATERIAL_DETECTED")


def retry_after(response: TransportResponse, *, maximum: int) -> int | None:
    raw = response.header("retry-after")
    if raw is None:
        return None
    if re.fullmatch(r"0|[1-9][0-9]{0,9}", raw) is None:
        reject("RETRY_AFTER_INVALID", status=response.status_code)
    value = int(raw)
    if value > maximum:
        reject("RETRY_AFTER_INVALID", status=response.status_code)
    return value


def _error_details(body: object) -> tuple[str | None, str | None]:
    if type(body) is not dict or set(body) - {"error"}:
        return None, None
    error = body.get("error")
    if type(error) is not dict:
        return None, None
    error_type = error.get("type")
    code = error.get("code")
    return (error_type if type(error_type) is str else None,
            code if type(code) is str else None)


def map_error(response: TransportResponse, *, max_retry_after: int) -> None:
    """Always raises a stable mapping; ambiguous cases never become retryable."""
    reject_credential_headers(response.headers)
    reject_credential_material([response.headers, response.body])
    status = response.status_code
    delay = retry_after(response, maximum=max_retry_after)
    error_type, code = _error_details(response.body)
    if status == 401:
        # OmniRoute records that Mistral's bare Unauthorized response is
        # indistinguishable from quota exhaustion. Only explicit key evidence
        # can be classified as an authentication failure.
        detail = response.body.get("detail") if type(response.body) is dict else None
        explicit_detail = (type(detail) is str and any(signal in detail.lower() for signal in
                           ("invalid api key", "token invalid", "revoked", "access denied")))
        if code in {"invalid_api_key", "invalid_key", "revoked_key"} or explicit_detail:
            reject("AUTHENTICATION_FAILED", status=status)
        reject("CREDENTIAL_OR_QUOTA_AMBIGUOUS", status=status)
    if status == 403:
        if error_type == "permission_error" or code == "permission_denied":
            reject("AUTHORIZATION_DENIED", status=status)
        reject("CREDENTIAL_OR_PERMISSION_AMBIGUOUS", status=status)
    if status == 429:
        if error_type == "rate_limit_error" and code in {"rate_limit_exceeded", "rate_limit"}:
            reject("RATE_LIMIT", retryable=True, retry_after=delay, status=status)
        if error_type == "insufficient_quota" and code in {"insufficient_quota", "quota_exceeded"}:
            reject("QUOTA_EXHAUSTED", status=status)
        reject("RATE_LIMIT_OR_QUOTA_AMBIGUOUS", status=status)
    if status in {408, 504}:
        reject("TIMEOUT", retryable=True, retry_after=delay, status=status)
    if 500 <= status <= 599:
        reject("TEMPORARY_5XX", retryable=True, retry_after=delay, status=status)
    if status == 400 and error_type == "invalid_request_error":
        reject("INVALID_REQUEST", status=status)
    reject("PROVIDER_ERROR_UNMAPPED", status=status)
