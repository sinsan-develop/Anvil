"""Deterministic, read-only execution backend contracts."""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
from typing import Any, Mapping


def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


@dataclass(frozen=True, slots=True)
class AuditReceipt:
    backend: str
    operation: str
    repository_identity: str
    inputs: Mapping[str, Any] = field(default_factory=dict)
    observations: Mapping[str, Any] = field(default_factory=dict)
    read_only: bool = True
    network_allowed: bool = False
    writes_allowed: bool = False

    def __post_init__(self) -> None:
        if not self.backend.strip() or not self.operation.strip() or not self.repository_identity.strip():
            raise ValueError("receipt identity fields are required")
        if not self.read_only or self.network_allowed or self.writes_allowed:
            raise ValueError("execution backend receipts must be read-only and network-free")

    @property
    def receipt_sha256(self) -> str:
        return hashlib.sha256(_canonical(self._unsigned_dict()).encode("utf-8")).hexdigest()

    def _unsigned_dict(self) -> dict[str, Any]:
        return {"backend": self.backend, "operation": self.operation,
                "repository_identity": self.repository_identity,
                "inputs": dict(self.inputs), "observations": dict(self.observations),
                "read_only": self.read_only, "network_allowed": self.network_allowed,
                "writes_allowed": self.writes_allowed}

    def to_dict(self) -> dict[str, Any]:
        return {**self._unsigned_dict(), "receipt_sha256": self.receipt_sha256}


@dataclass(frozen=True, slots=True)
class BackendResult:
    status: str
    receipt: AuditReceipt
    error_code: str | None = None


class BackendRejected(PermissionError):
    """A backend or operation was rejected fail-closed."""
