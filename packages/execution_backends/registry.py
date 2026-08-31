"""Allowlisted execution backend registry with no implicit external execution."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .models import AuditReceipt, BackendRejected, BackendResult


@dataclass(frozen=True, slots=True)
class BackendSpec:
    name: str
    operations: frozenset[str]
    network_allowed: bool = False
    writes_allowed: bool = False


class BackendRegistry:
    def __init__(self, specs: tuple[BackendSpec, ...] | None = None) -> None:
        self._specs = {spec.name: spec for spec in (specs or (
            BackendSpec("git-worktree", frozenset({"observe-status", "observe-identity"})),
            BackendSpec("docker", frozenset({"observe-container"})),
        ))}

    @property
    def names(self) -> tuple[str, ...]:
        return tuple(sorted(self._specs))

    def observe(self, backend: str, operation: str, repository_identity: str,
                *, inputs: Mapping[str, Any] | None = None,
                observations: Mapping[str, Any] | None = None) -> BackendResult:
        spec = self._specs.get(backend)
        if spec is None:
            raise BackendRejected("unsupported backend")
        if operation not in spec.operations:
            raise BackendRejected("unsupported or mutating operation")
        receipt = AuditReceipt(backend, operation, repository_identity,
                               inputs or {}, observations or {},
                               network_allowed=spec.network_allowed,
                               writes_allowed=spec.writes_allowed)
        return BackendResult("OBSERVED", receipt)
