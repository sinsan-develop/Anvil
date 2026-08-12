"""Structured repository scan errors that are safe for API serialization."""

from __future__ import annotations

from dataclasses import dataclass, field as dataclass_field
from typing import Any


@dataclass(frozen=True, slots=True)
class ScanError:
    """A stable, non-secret error envelope for a rejected scan."""

    code: str
    message: str
    field: str | None = None
    details: dict[str, Any] = dataclass_field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "field": self.field,
            "details": dict(self.details),
        }


class ScanRejected(RuntimeError):
    """Internal control-flow exception carrying a public structured error."""

    def __init__(self, error: ScanError) -> None:
        super().__init__(error.code)
        self.error = error
