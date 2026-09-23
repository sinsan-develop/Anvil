"""Immutable contracts shared by C-09 execution backends."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import math
import re
import threading
from types import MappingProxyType
from typing import Any, Callable, Mapping, Protocol, runtime_checkable

from packages.domain.identifiers import validate_operational_identifier
from packages.paths.identity import RepositoryIdentity, RepositoryPathMapping


def deep_freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        items = value.items()
        frozen = {}
        for key, item in items:
            if not isinstance(key, str):
                raise ValueError("mapping keys must be strings")
            if key in frozen:
                raise ValueError("duplicate mapping key")
            frozen[key] = deep_freeze(item)
        return MappingProxyType(frozen)
    if isinstance(value, (list, tuple)):
        return tuple(deep_freeze(v) for v in value)
    if isinstance(value, (set, frozenset)):
        return tuple(sorted((deep_freeze(v) for v in value), key=repr))
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("non-finite JSON values are rejected")
    if value is not None and not isinstance(value, (str, int, float, bool)):
        raise ValueError("value must be canonical JSON-safe")
    return value


def thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: thaw(v) for k, v in value.items()}
    if isinstance(value, tuple):
        return [thaw(v) for v in value]
    return value


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(thaw(deep_freeze(value)), ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


class BackendRejected(PermissionError):
    def __init__(self, code: str, message: str | None = None, *, details: Mapping[str, Any] | None = None):
        self.code = code
        self.details = deep_freeze(details or {})
        super().__init__(message or code)


_SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")


def resource_component(namespace: str, operational_identifier: str) -> str:
    """Derive an ASCII physical-resource key without changing the public identifier."""
    validate_operational_identifier(operational_identifier, "operational_identifier")
    digest = hashlib.sha256(canonical_bytes({
        "namespace": namespace, "operational_identifier": operational_identifier,
    })).hexdigest()
    return f"{namespace}-{digest[:32]}"


def disposal_evidence_sha256(run_id: str, workspace_id: str,
                             artifact_disposition: str = "PRESERVE") -> str:
    validate_operational_identifier(run_id, "run_id")
    validate_operational_identifier(workspace_id, "workspace_id")
    if artifact_disposition not in {"PRESERVE", "DELETE"}:
        raise ValueError("invalid artifact disposition")
    return hashlib.sha256(canonical_bytes({
        "evidence_type": "ANVIL_WORKSPACE_DISPOSAL_V1",
        "run_id": run_id,
        "workspace_id": workspace_id,
        "artifact_disposition": artifact_disposition,
    })).hexdigest()


@runtime_checkable
class ExecutionBackend(Protocol):
    __protocol_attrs__ = frozenset({"prepare_workspace", "execute", "stream_events", "cancel",
                                    "collect_artifacts", "destroy_workspace"})
    def prepare_workspace(self, spec: "WorkspaceSpec") -> "WorkspaceRef": ...
    def execute(self, request: "ExecutionRequest") -> "ExecutionHandle": ...
    def stream_events(self, handle_id: str, *, run_id: str, session_id: str,
                      workspace_id: str, backend_id: str) -> tuple["ExecutionEvent", ...]: ...
    def cancel(self, handle_id: str, *, run_id: str | None = None,
               session_id: str | None = None, workspace_id: str | None = None,
               backend_id: str | None = None) -> "ExecutionHandle": ...
    def collect_artifacts(self, handle_id: str, *, run_id: str, session_id: str,
                          workspace_id: str, backend_id: str) -> tuple["ArtifactRef", ...]: ...
    def destroy_workspace(self, workspace_id: str,
                          authorization: "DisposalAuthorization | None" = None) -> bool: ...


@dataclass(frozen=True, slots=True)
class WorkspaceSpec:
    run_id: str
    session_id: str
    workspace_id: str
    repository: RepositoryIdentity
    approved_baseline: str
    baseline_manifest_hash: str
    target_scopes: tuple[str, ...]
    retention_seconds: int = 86400
    workspace_root: str | None = None

    def __post_init__(self) -> None:
        if any(not isinstance(v, str) or not v.strip() for v in (
            self.run_id, self.session_id, self.workspace_id, self.approved_baseline,
            self.baseline_manifest_hash,
        )):
            raise ValueError("workspace identities and baseline are required")
        for field_name in ("run_id", "session_id", "workspace_id"):
            validate_operational_identifier(getattr(self, field_name), field_name)
        if not _SHA256.fullmatch(self.baseline_manifest_hash):
            raise ValueError("baseline_manifest_hash must be SHA-256")
        object.__setattr__(self, "baseline_manifest_hash", self.baseline_manifest_hash.casefold())
        scopes = tuple(self.repository.canonical_relative(p) for p in self.target_scopes)
        if not scopes:
            raise ValueError("at least one target scope is required")
        object.__setattr__(self, "target_scopes", scopes)
        if type(self.retention_seconds) is not int or self.retention_seconds < 86400:
            raise ValueError("workspace retention must be at least 24 hours")


@dataclass(frozen=True, slots=True)
class WorkspaceRef:
    workspace_id: str
    run_id: str
    session_id: str
    backend_id: str
    repository_id: str
    baseline: str
    workspace_root: str
    mapping: RepositoryPathMapping
    created_at: str
    retain_until: str
    managed_store: str | None = None
    container_id: str | None = None
    baseline_manifest_hash: str = ""
    target_scopes: tuple[str, ...] = ()
    prepare_payload_sha256: str = ""
    preservation_evidence: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "preservation_evidence", deep_freeze(self.preservation_evidence))


@dataclass(frozen=True, slots=True)
class ExecutionRequest:
    request_id: str
    idempotency_key: str
    run_id: str
    session_id: str
    workspace_id: str
    backend_id: str
    operation: str
    arguments: Mapping[str, Any]
    max_output_bytes: int = 65536
    timeout_seconds: float = 10.0
    io_authorizer: Callable[[Callable[[], None]], None] | None = field(default=None, repr=False, compare=False)
    requested_at: str | None = None
    max_traversal_files: int = 10000
    max_traversal_bytes: int | None = None
    max_traversal_rows: int = 10000
    masked_fields: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if any(not isinstance(v, str) or not v.strip() for v in (
            self.request_id, self.idempotency_key, self.run_id, self.session_id,
            self.workspace_id, self.backend_id, self.operation,
        )):
            raise ValueError("execution identity fields are required")
        for field_name in ("request_id", "idempotency_key", "run_id", "session_id", "workspace_id"):
            validate_operational_identifier(getattr(self, field_name), field_name)
        if type(self.max_output_bytes) is not int or self.max_output_bytes <= 0 or self.max_output_bytes > 1_048_576:
            raise ValueError("output limit is out of bounds")
        if (not isinstance(self.timeout_seconds, (int, float)) or isinstance(self.timeout_seconds, bool)
                or not math.isfinite(self.timeout_seconds)
                or self.timeout_seconds <= 0 or self.timeout_seconds > 60):
            raise ValueError("timeout is out of bounds")
        if type(self.max_traversal_files) is not int or self.max_traversal_files <= 0 or self.max_traversal_files > 10000:
            raise ValueError("traversal file limit is out of bounds")
        byte_limit = self.max_traversal_bytes
        if byte_limit is None:
            byte_limit = min(16_777_216, max(1_048_576, self.max_output_bytes * 64))
            object.__setattr__(self, "max_traversal_bytes", byte_limit)
        if not isinstance(byte_limit, int) or isinstance(byte_limit, bool) or byte_limit <= 0 or byte_limit > 16_777_216:
            raise ValueError("traversal byte limit is out of bounds")
        if type(self.max_traversal_rows) is not int or self.max_traversal_rows <= 0 or self.max_traversal_rows > 10000:
            raise ValueError("traversal row limit is out of bounds")
        if self.requested_at is not None and (not isinstance(self.requested_at, str) or not self.requested_at):
            raise ValueError("requested_at must be an ISO timestamp")
        if self.requested_at is not None:
            try: parsed_request_time = datetime.fromisoformat(self.requested_at.replace("Z", "+00:00"))
            except ValueError as exc: raise ValueError("requested_at must be an ISO timestamp") from exc
            if parsed_request_time.tzinfo is None:
                raise ValueError("requested_at must include a timezone")
        if any(not isinstance(item, str) or not item for item in self.masked_fields):
            raise ValueError("masked_fields must be strings")
        frozen = deep_freeze(self.arguments)
        if len(canonical_bytes(frozen)) > 4096:
            raise ValueError("input limit exceeded")
        for key in frozen:
            if any(word in key.casefold() for word in ("secret", "token", "password", "credential", "api_key")):
                raise ValueError("secret-shaped inputs are not accepted")
        object.__setattr__(self, "arguments", frozen)

    @property
    def payload_sha256(self) -> str:
        return hashlib.sha256(canonical_bytes({
            "run_id": self.run_id, "session_id": self.session_id, "workspace_id": self.workspace_id,
            "backend_id": self.backend_id, "operation": self.operation,
            "arguments": self.arguments, "max_output_bytes": self.max_output_bytes,
            "timeout_seconds": self.timeout_seconds,
            "max_traversal_files": self.max_traversal_files,
            "max_traversal_bytes": self.max_traversal_bytes,
            "max_traversal_rows": self.max_traversal_rows,
            "masked_fields": self.masked_fields,
        })).hexdigest()


@dataclass(frozen=True, slots=True)
class ExecutionHandle:
    handle_id: str
    request_id: str
    run_id: str
    session_id: str
    workspace_id: str
    backend_id: str
    operation: str
    status: str
    started_at: str
    ended_at: str | None = None
    result: Any = None
    receipt: "ExecutionReceipt | None" = None


@dataclass(frozen=True, slots=True)
class ExecutionReceipt:
    handle_id: str
    request_id: str
    idempotency_key: str
    run_id: str
    session_id: str
    workspace_id: str
    backend_id: str
    operation: str
    repository_id: str
    baseline: str
    baseline_manifest_hash: str
    target_scopes: tuple[str, ...]
    requested_at: str
    started_at: str
    completed_at: str
    max_output_bytes: int
    timeout_seconds: float
    status: str
    result_sha256: str
    error_code: str | None
    path: str | None
    max_traversal_files: int
    max_traversal_bytes: int
    max_traversal_rows: int
    masked_fields: tuple[str, ...]
    error_sha256: str | None

    @property
    def receipt_sha256(self) -> str:
        return hashlib.sha256(canonical_bytes({
            "handle_id": self.handle_id, "request_id": self.request_id,
            "idempotency_key": self.idempotency_key, "run_id": self.run_id,
            "session_id": self.session_id, "workspace_id": self.workspace_id,
            "backend_id": self.backend_id, "operation": self.operation,
            "repository_id": self.repository_id, "baseline": self.baseline,
            "baseline_manifest_hash": self.baseline_manifest_hash,
            "target_scopes": self.target_scopes, "requested_at": self.requested_at,
            "started_at": self.started_at, "completed_at": self.completed_at,
            "max_output_bytes": self.max_output_bytes, "timeout_seconds": self.timeout_seconds,
            "status": self.status, "result_sha256": self.result_sha256,
            "error_code": self.error_code, "path": self.path,
            "max_traversal_files": self.max_traversal_files,
            "max_traversal_bytes": self.max_traversal_bytes,
            "max_traversal_rows": self.max_traversal_rows,
            "masked_fields": self.masked_fields, "error_sha256": self.error_sha256,
        })).hexdigest()


@dataclass(frozen=True, slots=True)
class ExecutionEvent:
    handle_id: str
    sequence: int
    event_type: str
    payload: Mapping[str, Any]
    terminal: bool = False
    def __post_init__(self) -> None:
        object.__setattr__(self, "payload", deep_freeze(self.payload))
    @property
    def sha256(self) -> str:
        return hashlib.sha256(canonical_bytes({
            "handle_id": self.handle_id, "sequence": self.sequence,
            "event_type": self.event_type, "payload": self.payload,
            "terminal": self.terminal,
        })).hexdigest()


@dataclass(frozen=True, slots=True)
class ArtifactRef:
    artifact_id: str
    handle_id: str
    run_id: str
    workspace_id: str
    relative_path: str
    sha256: str
    size: int
    media_type: str
    storage_kind: str = "INLINE"
    receipt_sha256: str = ""


@dataclass(frozen=True, slots=True)
class DisposalAuthorization:
    authorization_id: str
    issuer: str
    authority_fence: str
    run_id: str
    workspace_id: str
    issued_at: str
    expires_at: str
    scopes: tuple[str, ...]
    evidence_sha256: str
    retention_override: bool = False
    artifact_disposition: str = "PRESERVE"

    def __post_init__(self) -> None:
        for field_name in ("authorization_id", "issuer", "authority_fence", "run_id", "workspace_id"):
            validate_operational_identifier(getattr(self, field_name), field_name)
        if self.scopes != ("workspace.destroy",):
            raise ValueError("authorization scope must be workspace.destroy")
        if not _SHA256.fullmatch(self.evidence_sha256):
            raise ValueError("authorization evidence must be SHA-256")
        if self.artifact_disposition not in {"PRESERVE", "DELETE"}:
            raise ValueError("invalid artifact disposition")
        if type(self.retention_override) is not bool:
            raise ValueError("retention_override must be boolean")


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
        object.__setattr__(self, "inputs", deep_freeze(self.inputs))
        object.__setattr__(self, "observations", deep_freeze(self.observations))
        if not self.read_only or self.network_allowed or self.writes_allowed:
            raise ValueError("execution backend receipts must be read-only and network-free")
    @property
    def receipt_sha256(self) -> str:
        return hashlib.sha256(canonical_bytes(self._unsigned_dict())).hexdigest()
    def _unsigned_dict(self) -> dict[str, Any]:
        return {"backend": self.backend, "operation": self.operation,
                "repository_identity": self.repository_identity, "inputs": self.inputs,
                "observations": self.observations, "read_only": self.read_only,
                "network_allowed": self.network_allowed, "writes_allowed": self.writes_allowed}
    def to_dict(self) -> dict[str, Any]:
        return {**thaw(self._unsigned_dict()), "receipt_sha256": self.receipt_sha256}


@dataclass(frozen=True, slots=True)
class BackendResult:
    status: str
    receipt: AuditReceipt
    error_code: str | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryReadLifecycle:
    """Thread-safe bounded read lifecycle with immutable terminal evidence."""
    def __init__(self, backend_id: str, *, clock=utc_now, id_factory=None,
                 disposal_authorities: Mapping[str, str] | None = None,
                 manifest_evidence: Mapping[tuple[str, str], bytes] | None = None) -> None:
        self.backend_id = backend_id
        self._clock = clock
        self._id_factory = id_factory or resource_component
        self._workspaces: dict[str, WorkspaceRef] = {}
        self._handles: dict[str, ExecutionHandle] = {}
        self._events: dict[str, tuple[ExecutionEvent, ...]] = {}
        self._artifacts: dict[str, tuple[ArtifactRef, ...]] = {}
        self._artifact_bytes: dict[str, bytes] = {}
        self._replays: dict[tuple[str, str], tuple[str, str]] = {}
        self._requests: dict[str, ExecutionRequest] = {}
        self._request_ids: dict[str, tuple[str, str, str]] = {}
        self._terminal_conditions: dict[str, threading.Condition] = {}
        self._execution_cancellations: dict[str, threading.Event] = {}
        self._executing_handles: set[str] = set()
        self._io_dispatch_count = 0
        self._destroyed: set[str] = set()
        self._workspace_states: dict[str, str] = {}
        self._lock = threading.RLock()
        self._disposal_authorities = dict(disposal_authorities or {})
        self._manifest_evidence = dict(manifest_evidence or {})

    @property
    def io_dispatch_count(self) -> int: return self._io_dispatch_count

    def workspace_ref(self, workspace_id: str) -> WorkspaceRef:
        with self._lock:
            workspace = self._workspaces.get(workspace_id)
            if workspace is None: raise BackendRejected("UNKNOWN_WORKSPACE")
            if self._workspace_states.get(workspace_id) != "ACTIVE":
                raise BackendRejected("WORKSPACE_NOT_ACTIVE")
            return workspace

    def _increment_io(self) -> None:
        with self._lock: self._io_dispatch_count += 1

    def _mark_io(self, request: ExecutionRequest, handle: ExecutionHandle) -> None:
        def commit_io() -> None:
            with self._lock:
                current = self._handles.get(handle.handle_id)
                if current is None or current.ended_at is not None:
                    raise BackendRejected("EXECUTION_CANCELLED")
                self._io_dispatch_count += 1
        if request.io_authorizer is None:
            commit_io()
        else:
            request.io_authorizer(commit_io)

    def _now(self) -> str:
        value = self._clock()
        return value.isoformat().replace("+00:00", "Z") if hasattr(value, "isoformat") else str(value)

    @staticmethod
    def prepare_payload_sha256(spec: WorkspaceSpec, *, backend_id: str,
                               trusted_binding: Mapping[str, Any]) -> str:
        return hashlib.sha256(canonical_bytes({
            "backend_id": backend_id, "run_id": spec.run_id, "session_id": spec.session_id,
            "workspace_id": spec.workspace_id, "repository_id": spec.repository.repository_id,
            "source_root": spec.repository.source_root, "case_policy": spec.repository.case_policy,
            "mapping_revision": spec.repository.mapping_revision,
            "approved_baseline": spec.approved_baseline,
            "baseline_manifest_hash": spec.baseline_manifest_hash,
            "target_scopes": spec.target_scopes, "retention_seconds": spec.retention_seconds,
            "workspace_root": spec.workspace_root, "trusted_binding": trusted_binding,
        })).hexdigest()

    def _register_workspace(self, workspace: WorkspaceRef) -> WorkspaceRef:
        with self._lock:
            if workspace.workspace_id in self._destroyed:
                raise BackendRejected("WORKSPACE_ID_RETIRED")
            prior = self._workspaces.get(workspace.workspace_id)
            if prior is not None:
                if prior == workspace: return prior
                raise BackendRejected("WORKSPACE_ID_CONFLICT")
            self._workspaces[workspace.workspace_id] = workspace
            self._workspace_states[workspace.workspace_id] = "ACTIVE"
            return workspace

    def _verify_manifest_evidence(self, spec: WorkspaceSpec) -> str:
        document = self._manifest_evidence.get((spec.repository.repository_id, spec.approved_baseline))
        if document is None:
            raise BackendRejected("MANIFEST_EVIDENCE_REQUIRED")
        if not isinstance(document, bytes):
            raise BackendRejected("MANIFEST_EVIDENCE_INVALID")
        if len(document) > 65536:
            raise BackendRejected("MANIFEST_EVIDENCE_INVALID")
        def unique_object(pairs):
            value = {}
            for key, item in pairs:
                if key in value: raise ValueError("duplicate manifest key")
                value[key] = item
            return value
        try:
            manifest = json.loads(
                document.decode("utf-8"), object_pairs_hook=unique_object,
                parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            raise BackendRejected("MANIFEST_EVIDENCE_INVALID") from exc
        required = {"schema_version", "manifest_type", "repository_id", "approved_baseline"}
        if (not isinstance(manifest, dict) or set(manifest) != required
            or manifest.get("schema_version") != "1.0.0"
            or manifest.get("manifest_type") != "ANVIL_BASELINE_AUTHORITY"
            or manifest.get("repository_id") != spec.repository.repository_id
            or manifest.get("approved_baseline") != spec.approved_baseline):
            raise BackendRejected("MANIFEST_EVIDENCE_INVALID")
        observed = hashlib.sha256(document).hexdigest()
        if observed != spec.baseline_manifest_hash:
            raise BackendRejected("MANIFEST_EVIDENCE_MISMATCH")
        return observed

    def _workspace_for(self, request: ExecutionRequest) -> WorkspaceRef:
        with self._lock:
            workspace = self._workspaces.get(request.workspace_id)
            if workspace is None: raise BackendRejected("UNKNOWN_WORKSPACE")
            if self._workspace_states.get(request.workspace_id) != "ACTIVE":
                raise BackendRejected("WORKSPACE_NOT_ACTIVE")
            if (workspace.run_id, workspace.session_id, workspace.backend_id) != (
                    request.run_id, request.session_id, request.backend_id):
                raise BackendRejected("WORKSPACE_IDENTITY_MISMATCH")
            return workspace

    def _replay(self, request: ExecutionRequest) -> ExecutionHandle | None:
        with self._lock:
            item = self._replays.get((request.session_id, request.idempotency_key))
            if item is None: return None
            payload_hash, handle_id = item
            if payload_hash != request.payload_sha256: raise BackendRejected("IDEMPOTENCY_CONFLICT")
            return self._handles[handle_id]

    def _admit(self, request: ExecutionRequest) -> tuple[ExecutionHandle, bool]:
        with self._lock:
            if self._workspace_states.get(request.workspace_id) != "ACTIVE":
                raise BackendRejected("WORKSPACE_NOT_ACTIVE")
            known_request = self._request_ids.get(request.request_id)
            if known_request is not None:
                payload_hash, idempotency_key, handle_id = known_request
                if payload_hash != request.payload_sha256 or idempotency_key != request.idempotency_key:
                    raise BackendRejected("REQUEST_ID_CONFLICT")
                return self._handles[handle_id], False
            replay_key = (request.session_id, request.idempotency_key)
            item = self._replays.get(replay_key)
            if item is not None:
                payload_hash, handle_id = item
                if payload_hash != request.payload_sha256:
                    raise BackendRejected("IDEMPOTENCY_CONFLICT")
                if self._handles[handle_id].request_id != request.request_id:
                    raise BackendRejected("REQUEST_ID_CONFLICT")
                return self._handles[handle_id], False
            handle_id = self._id_factory("handle", request.request_id)
            validate_operational_identifier(handle_id, "handle_id")
            if handle_id in self._handles:
                raise BackendRejected("REQUEST_ID_CONFLICT")
            started = self._now()
            handle = ExecutionHandle(handle_id, request.request_id, request.run_id, request.session_id,
                request.workspace_id, request.backend_id, request.operation, "RUNNING", started, None)
            self._handles[handle_id] = handle
            self._events[handle_id] = (ExecutionEvent(handle_id, 1, "STARTED", {"operation": request.operation}),)
            self._replays[replay_key] = (request.payload_sha256, handle_id)
            self._request_ids[request.request_id] = (request.payload_sha256, request.idempotency_key, handle_id)
            self._requests[handle_id] = request
            self._terminal_conditions[handle_id] = threading.Condition(self._lock)
            self._execution_cancellations[handle_id] = threading.Event()
            return handle, True

    def _execution_started(self, handle_id: str) -> threading.Event:
        with self._lock:
            event = self._execution_cancellations[handle_id]
            self._executing_handles.add(handle_id)
            if self._handles[handle_id].ended_at is not None:
                event.set()
            return event

    def _execution_finished(self, handle_id: str) -> None:
        with self._lock:
            self._executing_handles.discard(handle_id)
            self._execution_cancellations.pop(handle_id, None)

    def _signal_execution_cancel(self, handle_id: str) -> None:
        with self._lock:
            event = self._execution_cancellations.get(handle_id)
            if event is not None:
                event.set()

    def _begin(self, request: ExecutionRequest) -> ExecutionHandle:
        return self._admit(request)[0]

    def _await_terminal(self, handle_id: str, timeout: float) -> ExecutionHandle:
        with self._lock:
            condition = self._terminal_conditions[handle_id]
            if self._handles[handle_id].ended_at is None:
                condition.wait_for(lambda: self._handles[handle_id].ended_at is not None, timeout=timeout)
            current = self._handles[handle_id]
            if current.ended_at is None:
                raise BackendRejected("IDEMPOTENCY_IN_PROGRESS")
            return current

    def _finish(self, request: ExecutionRequest, handle: ExecutionHandle, output: Any, *,
                status: str = "SUCCEEDED", error_code: str | None = None) -> ExecutionHandle:
        if status == "SUCCEEDED" and not isinstance(output, str):
            status, error_code, output = "FAILED", "OUTPUT_SCHEMA_INVALID", ""
        if not isinstance(output, str):
            output = ""
        encoded = output.encode("utf-8")
        if len(encoded) > request.max_output_bytes:
            status, error_code, output, encoded = "FAILED", "OUTPUT_LIMIT_EXCEEDED", "", b""
        with self._lock:
            current = self._handles[handle.handle_id]
            if current.ended_at is not None: return current
            completed_at = self._now()
            workspace = self._workspaces[request.workspace_id]
            receipt = ExecutionReceipt(
                handle_id=handle.handle_id, request_id=request.request_id,
                idempotency_key=request.idempotency_key, run_id=request.run_id,
                session_id=request.session_id, workspace_id=request.workspace_id,
                backend_id=request.backend_id, operation=request.operation,
                repository_id=workspace.repository_id, baseline=workspace.baseline,
                baseline_manifest_hash=workspace.baseline_manifest_hash,
                target_scopes=tuple(workspace.target_scopes),
                requested_at=request.requested_at or current.started_at,
                started_at=current.started_at, completed_at=completed_at,
                max_output_bytes=request.max_output_bytes, timeout_seconds=request.timeout_seconds,
                status=status, result_sha256=hashlib.sha256(canonical_bytes(output)).hexdigest(),
                error_code=error_code,
                path=str(request.arguments.get("path")) if isinstance(request.arguments, Mapping) and "path" in request.arguments else None,
                max_traversal_files=request.max_traversal_files,
                max_traversal_bytes=int(request.max_traversal_bytes or 0),
                max_traversal_rows=request.max_traversal_rows,
                masked_fields=tuple(request.masked_fields),
                error_sha256=hashlib.sha256(canonical_bytes(error_code)).hexdigest() if error_code else None,
            )
            completed = ExecutionHandle(handle.handle_id, request.request_id, request.run_id, request.session_id,
                request.workspace_id, request.backend_id, request.operation, status, current.started_at,
                completed_at, output, receipt)
            self._handles[handle.handle_id] = completed
            prior = self._events[handle.handle_id]
            self._events[handle.handle_id] = prior + (
                ExecutionEvent(handle.handle_id, len(prior) + 1, "RESULT", {"output": output, "error_code": error_code}),
                ExecutionEvent(handle.handle_id, len(prior) + 2, status,
                               {"status": status, "receipt_sha256": receipt.receipt_sha256}, terminal=True),)
            artifact_id = self._id_factory("artifact", handle.handle_id)
            validate_operational_identifier(artifact_id, "artifact_id")
            self._artifacts[handle.handle_id] = (ArtifactRef(artifact_id, handle.handle_id, request.run_id,
                request.workspace_id, f"artifacts/{resource_component('result', handle.handle_id)}.txt", hashlib.sha256(encoded).hexdigest(),
                len(encoded), "text/plain; charset=utf-8", "INLINE", receipt.receipt_sha256),)
            self._artifact_bytes[artifact_id] = encoded
            self._terminal_conditions[handle.handle_id].notify_all()
            return completed

    def _complete(self, request: ExecutionRequest, output: str, *, status: str = "SUCCEEDED",
                  error_code: str | None = None) -> ExecutionHandle:
        handle, winner = self._admit(request)
        if not winner:
            return handle if handle.ended_at is not None else self._await_terminal(handle.handle_id, request.timeout_seconds)
        return self._finish(request, handle, output, status=status, error_code=error_code)

    def _failed(self, request: ExecutionRequest, handle: ExecutionHandle, exc: BaseException) -> ExecutionHandle:
        import subprocess
        timeout = isinstance(exc, (TimeoutError, subprocess.TimeoutExpired))
        return self._finish(request, handle, "", status="TIMEOUT" if timeout else "FAILED",
                            error_code="EXECUTION_TIMEOUT" if timeout else str(getattr(exc, "code", "EXECUTION_FAILED")))

    def _owned_handle(self, handle_id: str, *, run_id: str | None, session_id: str | None,
                      workspace_id: str | None, backend_id: str | None) -> ExecutionHandle:
        handle = self._handles.get(handle_id)
        if handle is None: raise BackendRejected("UNKNOWN_HANDLE")
        supplied = (run_id, session_id, workspace_id, backend_id)
        if any(value is None for value in supplied):
            raise BackendRejected("HANDLE_OWNER_IDENTITY_REQUIRED")
        if supplied != (
                handle.run_id, handle.session_id, handle.workspace_id, handle.backend_id):
            raise BackendRejected("HANDLE_OWNERSHIP_MISMATCH")
        return handle

    def _active_handles_locked(self, workspace_id: str) -> tuple[ExecutionHandle, ...]:
        return tuple(h for h in self._handles.values()
                     if h.workspace_id == workspace_id and h.ended_at is None)

    def active_handles(self, workspace_id: str, *, run_id: str, session_id: str,
                       backend_id: str) -> tuple[ExecutionHandle, ...]:
        with self._lock:
            workspace = self._workspaces.get(workspace_id)
            if workspace is None:
                raise BackendRejected("UNKNOWN_WORKSPACE")
            if (run_id, session_id, backend_id) != (
                    workspace.run_id, workspace.session_id, workspace.backend_id):
                raise BackendRejected("HANDLE_OWNERSHIP_MISMATCH")
            return self._active_handles_locked(workspace_id)

    def stream_events(self, handle_id: str, *, run_id: str, session_id: str,
                      workspace_id: str, backend_id: str | None = None) -> tuple[ExecutionEvent, ...]:
        self._owned_handle(handle_id, run_id=run_id, session_id=session_id,
                           workspace_id=workspace_id, backend_id=backend_id)
        return self._events[handle_id]

    def cancel(self, handle_id: str, *, run_id: str | None = None, session_id: str | None = None,
               workspace_id: str | None = None, backend_id: str | None = None) -> ExecutionHandle:
        with self._lock:
            handle = self._owned_handle(handle_id, run_id=run_id, session_id=session_id,
                                        workspace_id=workspace_id, backend_id=backend_id)
            if handle.ended_at is not None: return handle
            self._signal_execution_cancel(handle_id)
            request = self._requests[handle_id]
            return self._finish(request, handle, "", status="CANCELLED", error_code="EXECUTION_CANCELLED")

    def collect_artifacts(self, handle_id: str, *, run_id: str, session_id: str,
                          workspace_id: str, backend_id: str | None = None) -> tuple[ArtifactRef, ...]:
        self._owned_handle(handle_id, run_id=run_id, session_id=session_id,
                           workspace_id=workspace_id, backend_id=backend_id)
        artifacts = self._artifacts.get(handle_id, ())
        for artifact in artifacts:
            data = self._artifact_bytes.get(artifact.artifact_id)
            if data is None or len(data) != artifact.size or hashlib.sha256(data).hexdigest() != artifact.sha256:
                raise BackendRejected("ARTIFACT_INTEGRITY_MISMATCH")
        return artifacts

    def _authorize_destroy(self, workspace_id: str,
                           authorization: DisposalAuthorization | None) -> WorkspaceRef:
        with self._lock:
            workspace = self._workspaces.get(workspace_id)
            if workspace is None: raise BackendRejected("UNKNOWN_WORKSPACE")
            if self._workspace_states.get(workspace_id) not in {"ACTIVE", "RETAINED"}:
                raise BackendRejected("WORKSPACE_NOT_ACTIVE")
            executing = any(self._handles[handle_id].workspace_id == workspace_id
                            for handle_id in self._executing_handles)
            if self._active_handles_locked(workspace_id) or executing:
                raise BackendRejected("ACTIVE_HANDLE_RETAINED")
            if authorization is None: raise BackendRejected("DISPOSAL_AUTHORIZATION_REQUIRED")
            if (authorization.run_id, authorization.workspace_id) != (workspace.run_id, workspace_id):
                raise BackendRejected("DISPOSAL_AUTHORIZATION_MISMATCH")
            if self._disposal_authorities.get(authorization.issuer) != authorization.authority_fence:
                raise BackendRejected("DISPOSAL_AUTHORITY_UNTRUSTED")
            expected_evidence = disposal_evidence_sha256(
                authorization.run_id, authorization.workspace_id,
                authorization.artifact_disposition,
            )
            if authorization.evidence_sha256 != expected_evidence:
                raise BackendRejected("DISPOSAL_EVIDENCE_MISMATCH")
            try:
                issued = datetime.fromisoformat(authorization.issued_at.replace("Z", "+00:00"))
                expires = datetime.fromisoformat(authorization.expires_at.replace("Z", "+00:00"))
                retain = datetime.fromisoformat(workspace.retain_until.replace("Z", "+00:00"))
                now = self._clock()
            except (TypeError, ValueError) as exc:
                raise BackendRejected("DISPOSAL_AUTHORIZATION_INVALID") from exc
            if not (issued <= now <= expires): raise BackendRejected("DISPOSAL_AUTHORIZATION_EXPIRED")
            if now < retain and not authorization.retention_override: raise BackendRejected("RETENTION_ACTIVE")
            self._workspace_states[workspace_id] = "DISPOSING"
            return workspace

    def _abort_destroy(self, workspace_id: str) -> None:
        with self._lock:
            if self._workspace_states.get(workspace_id) == "DISPOSING":
                self._workspace_states[workspace_id] = "RETAINED"

    def _forget_workspace(self, workspace_id: str) -> None:
        with self._lock:
            self._workspaces.pop(workspace_id, None)
            self._workspace_states[workspace_id] = "DESTROYED"
            self._destroyed.add(workspace_id)

    def _dispose_artifacts(self, workspace_id: str, authorization: DisposalAuthorization) -> None:
        if authorization.artifact_disposition != "DELETE": return
        for handle_id, handle in tuple(self._handles.items()):
            if handle.workspace_id != workspace_id: continue
            for artifact in self._artifacts.pop(handle_id, ()):
                self._artifact_bytes.pop(artifact.artifact_id, None)

    def _already_destroyed(self, workspace_id: str) -> bool: return workspace_id in self._destroyed

    def _reject_retired_workspace(self, workspace_id: str) -> None:
        with self._lock:
            if workspace_id in self._destroyed:
                raise BackendRejected("WORKSPACE_ID_RETIRED")


__all__ = ["ArtifactRef", "AuditReceipt", "BackendRejected", "BackendResult",
           "DisposalAuthorization", "ExecutionBackend", "ExecutionEvent", "ExecutionHandle", "ExecutionRequest",
           "ExecutionReceipt",
           "RepositoryIdentity", "RepositoryPathMapping", "WorkspaceRef", "WorkspaceSpec",
           "InMemoryReadLifecycle", "canonical_bytes", "deep_freeze", "thaw", "utc_now",
           "disposal_evidence_sha256", "resource_component", "validate_operational_identifier"]
