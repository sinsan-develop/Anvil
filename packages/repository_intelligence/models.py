"""Dependency-free request and result models for repository scans."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, ClassVar

from .errors import ScanError


@dataclass(frozen=True, slots=True)
class ScanLimits:
    """Deterministic resource limits applied before or during inventory."""

    max_entries: int = 100_000
    max_total_bytes: int = 1_073_741_824
    max_file_bytes: int = 67_108_864
    git_timeout_seconds: float = 10.0

    def __post_init__(self) -> None:
        numeric = {
            "max_entries": self.max_entries,
            "max_total_bytes": self.max_total_bytes,
            "max_file_bytes": self.max_file_bytes,
            "git_timeout_seconds": self.git_timeout_seconds,
        }
        if any(value <= 0 for value in numeric.values()):
            raise ValueError("scan limits must be positive")


@dataclass(frozen=True, slots=True)
class ScanRequest:
    """Validated inputs for one read-only repository scan."""

    repository_path: str
    allowed_root: str
    output_path: str | None = None
    temp_root: str | None = None
    limits: ScanLimits = field(default_factory=ScanLimits)
    schema_version: str = "1.0.0"

    def __post_init__(self) -> None:
        if self.schema_version != "1.0.0":
            raise ValueError("unsupported scan request schema_version")
        if not self.repository_path or not self.allowed_root:
            raise ValueError("repository_path and allowed_root are required")


@dataclass(frozen=True, slots=True)
class ScanResult:
    """JSON-safe outcome; rejected scans never masquerade as successful."""

    success: bool
    status: str
    repository: dict[str, Any] | None = None
    inventory: list[dict[str, Any]] = field(default_factory=list)
    manifests: list[dict[str, Any]] = field(default_factory=list)
    no_write_proof: dict[str, Any] = field(default_factory=dict)
    errors: tuple[ScanError, ...] = ()
    evidence_types: tuple[str, ...] = ("E-GIT", "E-DIFF")
    schema_version: str = "1.0.0"

    _FIELDS: ClassVar[tuple[str, ...]] = (
        "schema_version",
        "success",
        "status",
        "repository",
        "inventory",
        "manifests",
        "no_write_proof",
        "errors",
        "evidence_types",
    )

    @classmethod
    def schema_fields(cls) -> tuple[str, ...]:
        return cls._FIELDS

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["errors"] = [error.to_dict() for error in self.errors]
        value["evidence_types"] = list(self.evidence_types)
        return value
