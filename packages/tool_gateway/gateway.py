"""Single fail-closed admission for bounded repository read tools."""
from __future__ import annotations

import hashlib
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from packages.execution_backends import (BackendRejected, ExecutionHandle,
                                         ExecutionReceipt, ExecutionRequest)
from packages.execution_backends.models import canonical_bytes
from .models import (ToolAudit, ToolDispatchReceipt, ToolGatewayRejected,
                     ToolReceipt, ToolRequest, WorkspaceGrant)
from .registry import ToolDefinitionRegistry, ToolPermissionRegistry


def _inside(root: Path, target: Path) -> bool:
    try: return os.path.commonpath((os.path.realpath(root), os.path.realpath(target))) == os.path.realpath(root)
    except ValueError: return False


def _secret_keys(value: Any) -> tuple[str, ...]:
    found = []
    if isinstance(value, Mapping):
        for key, item in value.items():
            if any(word in str(key).casefold() for word in ("secret", "token", "password", "credential", "api_key")):
                found.append(str(key))
            found.extend(_secret_keys(item))
    elif isinstance(value, (tuple, list)):
        for item in value: found.extend(_secret_keys(item))
    return tuple(sorted(set(found)))


def _overlap(left: str, right: str) -> bool:
    left = left.strip("/"); right = right.strip("/")
    return right == "." or left == right or left.startswith(right + "/")


def _validate_schema(schema: Mapping[str, Any], arguments: Mapping[str, Any]) -> bool:
    if not isinstance(arguments, Mapping): return False
    properties = schema.get("properties", {})
    required = set(schema.get("required", ()))
    if set(arguments) - set(properties) or required - set(arguments): return False
    for key, value in arguments.items():
        rule = properties[key]
        if rule.get("type") == "string":
            if not isinstance(value, str): return False
            if len(value) < rule.get("minLength", 0) or len(value) > rule.get("maxLength", 2**31): return False
    return True


def _validate_output_schema(schema: Mapping[str, Any], result: Any) -> bool:
    expected = schema.get("type")
    if expected == "string": return isinstance(result, str)
    if expected == "object": return isinstance(result, Mapping)
    if expected == "array": return isinstance(result, (tuple, list))
    return False


def _terminal_receipt_matches(handle: Any, request: ExecutionRequest, workspace: Any) -> bool:
    try:
        if type(handle) is not ExecutionHandle or type(handle.receipt) is not ExecutionReceipt or handle.ended_at is None:
            return False
        receipt = handle.receipt
        expected = (
        request.request_id, request.idempotency_key, request.run_id, request.session_id,
        request.workspace_id, request.backend_id, request.operation,
        workspace.repository_id, workspace.baseline, workspace.baseline_manifest_hash,
        tuple(workspace.target_scopes),
        request.max_output_bytes, request.timeout_seconds, request.max_traversal_files,
        request.max_traversal_bytes, request.max_traversal_rows, tuple(request.masked_fields),
        str(request.arguments.get("path")) if "path" in request.arguments else None,
    )
        observed = (
        getattr(receipt, "request_id", None), getattr(receipt, "idempotency_key", None),
        getattr(receipt, "run_id", None), getattr(receipt, "session_id", None),
        getattr(receipt, "workspace_id", None), getattr(receipt, "backend_id", None),
        getattr(receipt, "operation", None), getattr(receipt, "repository_id", None),
        getattr(receipt, "baseline", None), getattr(receipt, "baseline_manifest_hash", None),
        tuple(getattr(receipt, "target_scopes", ())),
        getattr(receipt, "max_output_bytes", None), getattr(receipt, "timeout_seconds", None),
        getattr(receipt, "max_traversal_files", None), getattr(receipt, "max_traversal_bytes", None),
        getattr(receipt, "max_traversal_rows", None), tuple(getattr(receipt, "masked_fields", ())),
        getattr(receipt, "path", None),
    )
        error_code = receipt.error_code
        error_sha = hashlib.sha256(canonical_bytes(error_code)).hexdigest() if error_code else None
        requested = datetime.fromisoformat(receipt.requested_at.replace("Z", "+00:00"))
        started = datetime.fromisoformat(receipt.started_at.replace("Z", "+00:00"))
        completed = datetime.fromisoformat(receipt.completed_at.replace("Z", "+00:00"))
        timestamps_valid = (requested.tzinfo is not None and started.tzinfo is not None
                            and completed.tzinfo is not None and requested <= started <= completed)
        return bool(
        observed == expected
        and timestamps_valid
        and getattr(receipt, "handle_id", None) == handle.handle_id
        and getattr(receipt, "status", None) == handle.status
        and getattr(receipt, "started_at", None) == handle.started_at
        and getattr(receipt, "completed_at", None) == handle.ended_at
        and getattr(receipt, "result_sha256", None) == hashlib.sha256(canonical_bytes(handle.result)).hexdigest()
        and getattr(receipt, "error_sha256", None) == error_sha
        and isinstance(getattr(receipt, "receipt_sha256", None), str)
        and len(receipt.receipt_sha256) == 64
        )
    except BaseException:
        return False


def _canonical_relative(value: str, case_policy: str = "SENSITIVE") -> str:
    if (not isinstance(value, str) or not value or value.startswith(("/", "~")) or
            "\\" in value or "\x00" in value or ".." in Path(value).parts):
        raise ToolGatewayRejected("SCOPE_DENIED")
    normalized = Path(value).as_posix().strip("/") or "."
    return normalized.casefold() if case_policy == "INSENSITIVE" else normalized


class ReadToolGateway:
    """Read gateway; legacy root mode is an explicit trusted fixture adapter."""
    def __init__(self, root: str | Path | None = None, *,
                 permission_registry: ToolPermissionRegistry | None = None,
                 definitions: ToolDefinitionRegistry | None = None,
                 backends: Mapping[str, Any] | None = None,
                 workspaces: Mapping[str, WorkspaceGrant] | None = None) -> None:
        self._audits: list[ToolAudit] = []
        self._permissions = permission_registry
        self._definitions = definitions or ToolDefinitionRegistry()
        self._backends = dict(backends or {})
        self._workspaces = dict(workspaces or {})
        self.root: Path | None = None
        if root is not None:
            self.root = Path(root).resolve(strict=True)
            if not self.root.is_dir(): raise ToolGatewayRejected("INVALID_FIXTURE_ROOT")
        elif permission_registry is None:
            raise ToolGatewayRejected("PERMISSION_REGISTRY_REQUIRED")

    @property
    def audits(self) -> tuple[ToolAudit, ...]: return tuple(self._audits)

    def register_workspace(self, grant: WorkspaceGrant) -> None:
        if grant.workspace_id in self._workspaces and self._workspaces[grant.workspace_id] != grant:
            raise ToolGatewayRejected("WORKSPACE_ID_CONFLICT")
        self._workspaces[grant.workspace_id] = grant

    def _audit(self, request: ToolRequest, status: str, reason: str | None,
               backend_id: str | None, masked=(), *, workspace=None, handle=None,
               requested_at: str | None = None, trusted_terminal: bool = False) -> ToolAudit:
        completed_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        receipt = handle.receipt if trusted_terminal and type(handle) is ExecutionHandle else None
        result = handle.result if type(handle) is ExecutionHandle else None
        audit = ToolAudit(request.request_id, request.idempotency_key, request.run_id,
                          request.session_id, request.workspace_id, backend_id,
                          request.tool_name, status, reason, tuple(masked),
                          getattr(workspace, "repository_id", None), getattr(workspace, "baseline", None),
                          getattr(workspace, "baseline_manifest_hash", None),
                          tuple(getattr(workspace, "target_scopes", ())), requested_at,
                          getattr(handle, "started_at", None), getattr(handle, "ended_at", None) or completed_at,
                          request.max_output_bytes, request.timeout_seconds,
                          getattr(receipt, "result_sha256", None) or hashlib.sha256(canonical_bytes(result)).hexdigest(),
                          hashlib.sha256(canonical_bytes(reason)).hexdigest() if reason else None,
                          str(request.arguments.get("path")) if isinstance(request.arguments, Mapping) and "path" in request.arguments else None,
                          getattr(receipt, "receipt_sha256", None))
        self._audits.append(audit)
        return audit

    def _deny(self, request: ToolRequest, code: str, backend_id: str | None = None,
              masked=(), *, workspace=None, handle=None, requested_at=None) -> None:
        self._audit(request, "DENIED", code, backend_id, masked, workspace=workspace,
                    handle=handle, requested_at=requested_at)
        raise ToolGatewayRejected(code)

    def dispatch(self, request: ToolRequest) -> ToolDispatchReceipt:
        requested_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        workspace = self._workspaces.get(request.workspace_id)
        if workspace is None: self._deny(request, "UNKNOWN_WORKSPACE", requested_at=requested_at)
        assert workspace is not None
        if request.ingress_error:
            self._deny(request, request.ingress_error, workspace.backend_id,
                       workspace=workspace, requested_at=requested_at)
        if (request.run_id, request.session_id) != (workspace.run_id, workspace.session_id):
            self._deny(request, "WORKSPACE_IDENTITY_MISMATCH", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        if not isinstance(request.tool_name, str) or not request.tool_name:
            self._deny(request, "INVALID_TOOL", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        try: definition = self._definitions.require(request.tool_name, workspace.backend_id)
        except ToolGatewayRejected as exc: self._deny(request, exc.code, workspace.backend_id, workspace=workspace, requested_at=requested_at)
        try: size = len(canonical_bytes(request.arguments))
        except ValueError: self._deny(request, "INVALID_INPUT", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        if size > 4096: self._deny(request, "INPUT_LIMIT_EXCEEDED", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        secrets = _secret_keys(request.arguments)
        if secrets: self._deny(request, "SECRET_INPUT_DENIED", workspace.backend_id, secrets, workspace=workspace, requested_at=requested_at)
        if (not isinstance(request.max_output_bytes, int) or isinstance(request.max_output_bytes, bool)
                or request.max_output_bytes <= 0 or request.max_output_bytes > 1_048_576):
            self._deny(request, "OUTPUT_LIMIT_INVALID", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        if (not isinstance(request.timeout_seconds, (int, float)) or isinstance(request.timeout_seconds, bool)
                or not math.isfinite(request.timeout_seconds)
                or request.timeout_seconds <= 0 or request.timeout_seconds > 60):
            self._deny(request, "TIMEOUT_LIMIT_INVALID", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        try:
            schema_valid = _validate_schema(definition.input_schema, request.arguments)
        except Exception:
            schema_valid = False
        if not schema_valid:
            self._deny(request, "TOOL_SCHEMA_INVALID", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        if "path" in request.arguments:
            try: requested_path = _canonical_relative(request.arguments["path"], workspace.case_policy)
            except ToolGatewayRejected: self._deny(request, "SCOPE_DENIED", workspace.backend_id, workspace=workspace, requested_at=requested_at)
            if requested_path != "." and not any(_overlap(requested_path, scope) for scope in workspace.target_scopes):
                self._deny(request, "SCOPE_DENIED", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        backend = self._backends.get(workspace.backend_id)
        if backend is None: self._deny(request, "BACKEND_UNAVAILABLE", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        try: actual = backend.workspace_ref(request.workspace_id)
        except (AttributeError, BackendRejected): self._deny(request, "WORKSPACE_STATE_UNAVAILABLE", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        if (actual.run_id, actual.session_id, actual.backend_id, actual.repository_id, actual.baseline,
                actual.baseline_manifest_hash, tuple(actual.target_scopes)) != (
                workspace.run_id, workspace.session_id, workspace.backend_id,
                workspace.repository_id, workspace.baseline, workspace.baseline_manifest_hash,
                workspace.target_scopes):
            self._deny(request, "WORKSPACE_BASELINE_MISMATCH", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        try: reservation = self._permissions.reserve(request.session_id, request.tool_name)  # type: ignore[union-attr]
        except ToolGatewayRejected: self._deny(request, "TOOL_PERMISSION_DENIED", workspace.backend_id, workspace=workspace, requested_at=requested_at)
        permission_used = False
        permission_attempted = False
        def authorize(mark_io):
            nonlocal permission_used, permission_attempted
            permission_attempted = True
            self._permissions.authorize_io(reservation, mark_io)  # type: ignore[union-attr]
            permission_used = True
        execution = ExecutionRequest(request.request_id, request.idempotency_key,
            request.run_id, request.session_id, request.workspace_id, workspace.backend_id,
            request.tool_name, request.arguments, request.max_output_bytes, request.timeout_seconds,
            authorize, requested_at=requested_at)
        try:
            handle = backend.execute(execution)
        except ToolGatewayRejected as exc:
            self._deny(request, exc.code, workspace.backend_id, workspace=workspace, requested_at=requested_at)
        except BackendRejected as exc:
            self._audit(request, "FAILED", exc.code, workspace.backend_id, workspace=workspace, requested_at=requested_at)
            raise ToolGatewayRejected(exc.code) from exc
        if type(handle) is not ExecutionHandle:
            self._audit(request, "FAILED", "BACKEND_TERMINAL_INVALID", workspace.backend_id,
                        workspace=workspace, requested_at=requested_at)
            raise ToolGatewayRejected("BACKEND_TERMINAL_INVALID")
        receipt = handle.receipt if type(handle.receipt) is ExecutionReceipt else None
        permission_denied_terminal = (
            permission_attempted and handle.status == "FAILED"
            and receipt is not None and receipt.error_code == "TOOL_PERMISSION_DENIED"
        )
        if not permission_used and not permission_denied_terminal:
            self._deny(request, "BACKEND_PERMISSION_FENCE_MISSING", workspace.backend_id,
                       workspace=workspace, handle=handle, requested_at=requested_at)
        if (handle.request_id, handle.run_id, handle.session_id, handle.workspace_id,
                handle.backend_id, handle.operation) != (
                execution.request_id, execution.run_id, execution.session_id, execution.workspace_id,
                execution.backend_id, execution.operation):
            self._deny(request, "HANDLE_OWNERSHIP_MISMATCH", workspace.backend_id, workspace=workspace, handle=handle, requested_at=requested_at)
        if not _terminal_receipt_matches(handle, execution, workspace):
            self._audit(request, "FAILED", "BACKEND_TERMINAL_INVALID", workspace.backend_id,
                        workspace=workspace, requested_at=requested_at)
            raise ToolGatewayRejected("BACKEND_TERMINAL_INVALID")
        if handle.status == "SUCCEEDED" and not _validate_output_schema(definition.output_schema, handle.result):
            self._audit(request, "FAILED", "OUTPUT_SCHEMA_INVALID", workspace.backend_id,
                        workspace=workspace, handle=handle, requested_at=requested_at)
            raise ToolGatewayRejected("OUTPUT_SCHEMA_INVALID")
        if isinstance(handle.result, str) and len(handle.result.encode("utf-8")) > request.max_output_bytes:
            self._audit(request, "FAILED", "OUTPUT_LIMIT_EXCEEDED", workspace.backend_id,
                        workspace=workspace, handle=handle, requested_at=requested_at)
            raise ToolGatewayRejected("OUTPUT_LIMIT_EXCEEDED")
        if handle.status != "SUCCEEDED":
            reason = receipt.error_code if receipt is not None else handle.status
            self._audit(request, "FAILED", reason, workspace.backend_id, workspace=workspace, handle=handle,
                        requested_at=requested_at, trusted_terminal=True)
            raise ToolGatewayRejected(reason)
        audit = self._audit(request, "SUCCEEDED", None, workspace.backend_id,
                            workspace=workspace, handle=handle, requested_at=requested_at,
                            trusted_terminal=True)
        return ToolDispatchReceipt(handle, audit)

    # Explicit trusted-fixture compatibility adapter.  It is not connected to
    # agent-facing registration and cannot dispatch arbitrary operations.
    def _target(self, relative: str) -> Path:
        if self.root is None: raise ToolGatewayRejected("FIXTURE_ADAPTER_DISABLED")
        if not isinstance(relative, str) or not relative or relative.startswith(("/", "~")) or "\\" in relative or "\x00" in relative:
            raise ToolGatewayRejected("PATH_DENIED")
        parts = Path(relative).parts
        if ".." in parts: raise ToolGatewayRejected("PATH_DENIED")
        lexical = self.root.joinpath(*parts)
        cursor = lexical
        while cursor != self.root:
            if cursor.is_symlink(): raise ToolGatewayRejected("REPARSE_PATH_DENIED")
            cursor = cursor.parent
        try: target = lexical.resolve(strict=True)
        except OSError as exc: raise ToolGatewayRejected("PATH_NOT_FOUND") from exc
        if not _inside(self.root, target): raise ToolGatewayRejected("PATH_DENIED")
        return target
    def list_files(self, relative: str = ".") -> ToolReceipt:
        target = self._target(relative)
        if not target.is_dir(): raise ToolGatewayRejected("NOT_A_DIRECTORY")
        entries = []
        for item in sorted(target.iterdir(), key=lambda p: p.as_posix()):
            if item.is_symlink(): raise ToolGatewayRejected("REPARSE_PATH_DENIED")
            entries.append(item.relative_to(self.root).as_posix())
        return ToolReceipt("list-files", relative, tuple(entries))
    def metadata(self, relative: str) -> ToolReceipt:
        target = self._target(relative)
        stat = target.stat()
        return ToolReceipt("metadata", relative, {"kind": "directory" if target.is_dir() else "file",
            "size": stat.st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None})


class WorktreeMutationGateway:
    """E06 host-only bounded file tool; the C09 read contract is unchanged."""
    def __init__(self,service,permissions):
        from packages.agent_team.worktree_writes import WorktreeWriteService
        if type(service) is not WorktreeWriteService or type(permissions) is not ToolPermissionRegistry:
            raise ToolGatewayRejected('WRITE_AUTHORITY_REQUIRED')
        self._service=service;self._permissions=permissions;self._audits=[]
        self.before_dispatch=None

    @property
    def audits(self):return tuple(dict(row) for row in self._audits)

    def write(self,grant,path,data,*,request_id):
        from packages.action_policy.admission import secret_shape
        try:
            if type(data) is not bytes or secret_shape((request_id,path,data.decode('utf-8','replace'))):raise ToolGatewayRejected('SECRET_INPUT_DENIED')
            result=self._service.write(grant,path,data,request_id=request_id,permissions=self._permissions,before_dispatch=self.before_dispatch)
        except Exception as exc:
            code=getattr(exc,'code',str(exc))
            self._audits.append({'status':'DENIED','reason_code':code,'io_count':getattr(exc,'io_count',0),
                'target_restored':getattr(exc,'target_restored',False),'io_boundary':'TARGET_MUTATION'})
            raise ToolGatewayRejected(code) from exc
        self._audits.append({'status':'SUCCEEDED','reason_code':'ALLOWED','io_count':result['io_count']})
        return result


__all__ = ["ReadToolGateway", "WorktreeMutationGateway"]
