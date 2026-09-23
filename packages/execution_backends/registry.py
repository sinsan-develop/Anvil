"""Execution backend capability registry."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Mapping
from .models import AuditReceipt, BackendRejected, BackendResult

READ_OPERATIONS = frozenset({"repo.status", "repo.search", "repo.read_file", "repo.symbols", "git.diff"})

@dataclass(frozen=True, slots=True)
class BackendSpec:
    name: str
    operations: frozenset[str]
    network_allowed: bool = False
    writes_allowed: bool = False

class BackendRegistry:
    def __init__(self, specs: tuple[BackendSpec, ...] | None = None) -> None:
        self._specs: dict[str, BackendSpec] = {}
        for spec in specs or (
            BackendSpec("git-worktree", READ_OPERATIONS | {"observe-status", "observe-identity"}),
            BackendSpec("docker", READ_OPERATIONS | {"observe-container"}),
        ):
            self.register(spec)
    @property
    def names(self) -> tuple[str, ...]: return tuple(sorted(self._specs))
    @property
    def read_operations(self) -> tuple[str, ...]: return tuple(sorted(READ_OPERATIONS))
    def register(self, spec: BackendSpec) -> None:
        if not spec.name.strip() or spec.name in self._specs:
            raise BackendRejected("INVALID_BACKEND", "duplicate or empty backend")
        if spec.network_allowed or spec.writes_allowed or not spec.operations <= (READ_OPERATIONS | {"observe-status", "observe-identity", "observe-container"}):
            raise BackendRejected("UNSAFE_BACKEND", "backend exposes unsupported capability")
        self._specs[spec.name] = spec
    def require(self, backend: str, operation: str) -> BackendSpec:
        spec = self._specs.get(backend)
        if spec is None: raise BackendRejected("UNSUPPORTED_BACKEND")
        if operation not in spec.operations: raise BackendRejected("UNSUPPORTED_OPERATION")
        return spec
    def observe(self, backend: str, operation: str, repository_identity: str,
                *, inputs: Mapping[str, Any] | None = None,
                observations: Mapping[str, Any] | None = None) -> BackendResult:
        spec = self.require(backend, operation)
        return BackendResult("OBSERVED", AuditReceipt(backend, operation, repository_identity,
                             inputs or {}, observations or {}, network_allowed=spec.network_allowed,
                             writes_allowed=spec.writes_allowed))

__all__ = ["BackendRegistry", "BackendSpec", "READ_OPERATIONS"]
