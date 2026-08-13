"""Strong, framework-independent domain identifiers."""

from __future__ import annotations

from dataclasses import dataclass


class IdentifierError(ValueError):
    """Raised when a domain identifier is absent or malformed."""


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
