"""Strong, framework-independent domain identifiers."""

from __future__ import annotations

from dataclasses import dataclass


class IdentifierError(ValueError):
    """Raised when a domain identifier is absent or malformed."""


class IdentifierEncodingError(IdentifierError):
    """Raised when an operational identifier is not strict UTF-8 text."""


def validate_operational_identifier(value: str, field: str) -> str:
    """Canonical C-02 operational text authority; preserve valid text verbatim."""
    if not isinstance(value, str) or not value or value != value.strip():
        raise IdentifierError(f"{field} must be a canonical non-empty string")
    try:
        value.encode("utf-8", errors="strict")
    except UnicodeEncodeError as exc:
        raise IdentifierEncodingError(f"{field} must be strict UTF-8 text") from exc
    return value


@dataclass(frozen=True, slots=True)
class AggregateId:
    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self.value.strip():
            raise IdentifierError("identifier must be a non-empty string")

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True, slots=True)
class RunId(AggregateId):
    pass


@dataclass(frozen=True, slots=True)
class EventId(AggregateId):
    pass


__all__ = ["AggregateId", "EventId", "IdentifierEncodingError", "IdentifierError",
           "RunId", "validate_operational_identifier"]
