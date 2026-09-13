"""Immutable C-09 read Tool Gateway contracts."""
from __future__ import annotations
from dataclasses import dataclass, field
import hashlib
from typing import Any, Mapping
from packages.execution_backends.models import (ExecutionHandle, canonical_bytes, deep_freeze, thaw,
                                                validate_operational_identifier)


class ToolGatewayRejected(PermissionError):
    def __init__(self, code: str, message: str | None = None):
        self.code = code
        super().__init__(message or code)


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    provider: str
    version: str
    input_schema: Mapping[str, Any]
    output_schema: Mapping[str, Any]
    capability: str
    side_effect: str
    risk: str
    supported_backends: tuple[str, ...]
    def __post_init__(self) -> None:
        object.__setattr__(self, "input_schema", deep_freeze(self.input_schema))
        object.__setattr__(self, "output_schema", deep_freeze(self.output_schema))


@dataclass(frozen=True, slots=True)
class WorkspaceGrant:
    workspace_id: str
    run_id: str
    session_id: str
    backend_id: str
    repository_id: str
    baseline: str
    baseline_manifest_hash: str
    target_scopes: tuple[str, ...]
    case_policy: str = "SENSITIVE"
    mapping_revision: str = "unspecified"

    def __post_init__(self) -> None:
        for field_name in ("workspace_id", "run_id", "session_id"):
            validate_operational_identifier(getattr(self, field_name), field_name)
        if self.case_policy not in {"SENSITIVE", "INSENSITIVE"}:
            raise ValueError("case_policy must be SENSITIVE or INSENSITIVE")
        validate_operational_identifier(self.mapping_revision, "mapping_revision")
        object.__setattr__(self, "target_scopes", tuple(self.target_scopes))


@dataclass(frozen=True, slots=True)
class ToolRequest:
    request_id: str
    idempotency_key: str
    run_id: str
    session_id: str
    workspace_id: str
    tool_name: str
    arguments: Any
    max_output_bytes: int = 65536
    timeout_seconds: float = 10.0
    ingress_error: str | None = field(default=None, init=False, repr=False, compare=False)
    def __post_init__(self) -> None:
        for field_name in ("request_id", "idempotency_key", "run_id", "session_id", "workspace_id"):
            try: validate_operational_identifier(getattr(self, field_name), field_name)
            except ValueError as exc: raise ToolGatewayRejected("INVALID_INPUT", str(exc)) from exc
        try:
            frozen = deep_freeze(self.arguments)
        except Exception:
            frozen = deep_freeze({})
            object.__setattr__(self, "ingress_error", "TOOL_SCHEMA_INVALID")
        object.__setattr__(self, "arguments", frozen)


@dataclass(frozen=True, slots=True)
class ToolAudit:
    request_id: str
    idempotency_key: str
    run_id: str
    session_id: str
    workspace_id: str
    backend_id: str | None
    tool_name: str
    status: str
    reason_code: str | None
    masked_fields: tuple[str, ...] = ()
    repository_id: str | None = None
    baseline: str | None = None
    baseline_manifest_hash: str | None = None
    target_scopes: tuple[str, ...] = ()
    requested_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    max_output_bytes: int | None = None
    timeout_seconds: float | None = None
    result_sha256: str | None = None
    error_sha256: str | None = None
    path: str | None = None
    terminal_receipt_sha256: str | None = None
    @property
    def sha256(self) -> str:
        return hashlib.sha256(canonical_bytes({
            "request_id": self.request_id, "idempotency_key": self.idempotency_key,
            "run_id": self.run_id, "session_id": self.session_id,
            "workspace_id": self.workspace_id, "backend_id": self.backend_id,
            "tool_name": self.tool_name, "status": self.status,
            "reason_code": self.reason_code, "masked_fields": self.masked_fields,
            "repository_id": self.repository_id, "baseline": self.baseline,
            "baseline_manifest_hash": self.baseline_manifest_hash,
            "target_scopes": self.target_scopes, "requested_at": self.requested_at,
            "started_at": self.started_at, "completed_at": self.completed_at,
            "max_output_bytes": self.max_output_bytes, "timeout_seconds": self.timeout_seconds,
            "result_sha256": self.result_sha256, "error_sha256": self.error_sha256,
            "path": self.path, "terminal_receipt_sha256": self.terminal_receipt_sha256,
        })).hexdigest()

    @property
    def canonical_receipt_sha256(self) -> str:
        return self.sha256


@dataclass(frozen=True, slots=True)
class ToolDispatchReceipt:
    handle: ExecutionHandle
    audit: ToolAudit


@dataclass(frozen=True, slots=True)
class ToolReceipt:
    operation: str
    path: str
    result: Any
    read_only: bool = True
    def to_dict(self) -> dict[str, Any]:
        return {"operation": self.operation, "path": self.path,
                "result": thaw(deep_freeze(self.result)), "read_only": self.read_only}


__all__ = ["ToolAudit", "ToolDefinition", "ToolDispatchReceipt", "ToolGatewayRejected",
           "ToolReceipt", "ToolRequest", "WorkspaceGrant"]
