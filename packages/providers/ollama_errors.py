"""Sanitized local provider failures; raw host/URL/exception never escapes."""
from dataclasses import dataclass
import re

from .ollama_models import canonical


@dataclass
class OllamaAdapterError(ValueError):
    code: str
    retryable: bool = False
    status_code: int | None = None

    def __post_init__(self) -> None:
        ValueError.__init__(self, self.code)

    def __str__(self) -> str:
        return self.code


def reject(code: str, *, retryable: bool = False, status: int | None = None) -> None:
    raise OllamaAdapterError(code, retryable, status)


_SECRET = re.compile(r"(?i)(authorization\s*[:=]|(?:api[_-]?key|access[_-]?token|secret)\s*[:=])")


def guard_material(value: object) -> None:
    try:
        encoded = canonical(value)
    except ValueError:
        reject("RESPONSE_MALFORMED")
    if _SECRET.search(encoded):
        reject("CREDENTIAL_MATERIAL_DETECTED")
    def walk(item: object) -> None:
        if type(item) is dict:
            for key, member in item.items():
                if re.sub(r"[^a-z0-9]", "", str(key).lower()).endswith(
                        ("authorization", "apikey", "accesstoken", "secret")) and member is not None:
                    reject("CREDENTIAL_MATERIAL_DETECTED")
                walk(member)
        elif type(item) is list:
            for member in item:
                walk(member)
    walk(value)


def map_status(status: int) -> None:
    if 300 <= status <= 399:
        reject("REDIRECT_BLOCKED", status=status)
    if status == 404:
        reject("MODEL_OR_PATH_NOT_FOUND", status=status)
    if status in (408, 504):
        reject("TIMEOUT", retryable=True, status=status)
    if status == 429:
        reject("RATE_LIMITED", retryable=True, status=status)
    if 500 <= status <= 599:
        reject("PROVIDER_UNAVAILABLE", retryable=True, status=status)
    reject("PROVIDER_ERROR", status=status)
