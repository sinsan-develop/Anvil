"""Docker lifecycle driver exercised through an injected deterministic runner."""
from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import io
import math
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import re
import stat
import time
from typing import Any, Callable

from packages.paths.identity import RepositoryPathMapping
from packages.repository_intelligence import ScanRequest, scan_repository
from .models import (BackendRejected, DisposalAuthorization, ExecutionHandle,
                     ExecutionRequest, InMemoryReadLifecycle, WorkspaceRef, WorkspaceSpec,
                     canonical_bytes, deep_freeze, resource_component, thaw, utc_now)
from .registry import READ_OPERATIONS
from .safeio import verified_read, verified_scandir, verified_stat


def _helper_overlap(left: str, right: str, case_policy: str = "SENSITIVE") -> bool:
    left = left.strip("/"); right = right.strip("/")
    if case_policy == "INSENSITIVE":
        left = left.casefold(); right = right.casefold()
    return right == "." or left == right or left.startswith(right + "/")


def _helper_path(root: Path, relative: str, scopes: tuple[str, ...],
                 case_policy: str = "SENSITIVE", *, budget: dict[str, int] | None = None,
                 deadline: float | None = None) -> Path:
    if (not isinstance(relative, str) or not relative or relative.startswith(("/", "~"))
        or "\\" in relative or "\x00" in relative or ".." in Path(relative).parts):
        raise BackendRejected("SCOPE_DENIED")
    normalized = Path(relative).as_posix().strip("/") or "."
    if normalized != "." and not any(_helper_overlap(normalized, scope, case_policy) for scope in scopes):
        raise BackendRejected("SCOPE_DENIED")
    cursor = root
    for part in Path(normalized).parts:
        if case_policy == "INSENSITIVE":
            maximum = budget["remaining"] if budget is not None else None
            children = verified_scandir(root, cursor, max_entries=maximum, deadline=deadline)
            if budget is not None:
                budget["remaining"] -= len(children)
            matches = tuple(child for child in children
                            if child.name.casefold() == part.casefold())
            if not matches:
                raise BackendRejected("PATH_NOT_FOUND")
            if len(matches) != 1:
                raise BackendRejected("PATH_IDENTITY_AMBIGUOUS")
            cursor = matches[0]
        else:
            cursor = cursor / part
        try: info = os.lstat(cursor)
        except OSError as exc: raise BackendRejected("PATH_NOT_FOUND") from exc
        if stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400):
            raise BackendRejected("REPARSE_PATH_DENIED")
    resolved = cursor.resolve(strict=True)
    if root.resolve() not in (resolved, *resolved.parents):
        raise BackendRejected("SCOPE_DENIED")
    return resolved


def execute_read_tool_envelope(workspace_root: str | Path, envelope: Any) -> str:
    """Execute the fixed five-tool protocol against one immutable archive root."""
    if not isinstance(envelope, dict) or set(envelope) != {"protocol", "control", "operation", "arguments", "authority", "limits"}:
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    control = envelope.get("control"); authority = envelope.get("authority"); limits = envelope.get("limits")
    if (envelope.get("protocol") != "anvil-read-tool/v1" or not isinstance(control, dict)
        or set(control) != {"handle_id", "workspace_id", "backend_id"}
        or control.get("backend_id") != "docker"
        or not isinstance(authority, dict)
        or not {"repository_id", "approved_baseline", "baseline_manifest_hash", "target_scopes"}.issubset(authority)
        or not set(authority).issubset({"repository_id", "approved_baseline", "baseline_manifest_hash", "target_scopes", "case_policy"})
        or not isinstance(authority.get("target_scopes"), list) or not authority["target_scopes"]
        or not isinstance(limits, dict)
        or set(limits) != {"max_output_bytes", "timeout_seconds", "max_traversal_files", "max_traversal_bytes", "max_traversal_rows"}):
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    for field in ("handle_id", "workspace_id"):
        try: validate = control[field];
        except KeyError as exc: raise BackendRejected("HELPER_ENVELOPE_INVALID") from exc
        if not isinstance(validate, str) or not validate:
            raise BackendRejected("HELPER_ENVELOPE_INVALID")
    scopes = tuple(authority["target_scopes"])
    case_policy = authority.get("case_policy", "SENSITIVE")
    if case_policy not in {"SENSITIVE", "INSENSITIVE"}:
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    if any(not isinstance(scope, str) or not scope or scope.startswith(("/", "~"))
           or "\\" in scope or ".." in Path(scope).parts for scope in scopes):
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    if (not isinstance(authority.get("repository_id"), str) or not authority["repository_id"]
        or not isinstance(authority.get("approved_baseline"), str) or not authority["approved_baseline"]
        or not isinstance(authority.get("baseline_manifest_hash"), str)
        or re.fullmatch(r"[0-9a-fA-F]{64}", authority["baseline_manifest_hash"]) is None):
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    if (type(limits["max_output_bytes"]) is not int
            or type(limits["max_traversal_files"]) is not int
            or type(limits["max_traversal_bytes"]) is not int
            or type(limits["max_traversal_rows"]) is not int
            or not isinstance(limits["timeout_seconds"], (int, float))
            or isinstance(limits["timeout_seconds"], bool)
            or not math.isfinite(limits["timeout_seconds"])):
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    maximum = limits["max_output_bytes"]; max_files = limits["max_traversal_files"]
    max_bytes = limits["max_traversal_bytes"]; max_rows = limits["max_traversal_rows"]
    timeout_seconds = float(limits["timeout_seconds"])
    if (maximum <= 0 or maximum > 1_048_576
            or max_files <= 0 or max_files > 10_000
            or max_bytes <= 0 or max_bytes > 16_777_216
            or max_rows <= 0 or max_rows > 10_000
            or timeout_seconds <= 0 or timeout_seconds > 60):
        raise BackendRejected("HELPER_ENVELOPE_INVALID")
    deadline = time.monotonic() + timeout_seconds
    budget = {"remaining": max_files}
    operation = envelope.get("operation"); arguments = envelope.get("arguments")
    if operation not in READ_OPERATIONS or not isinstance(arguments, dict):
        raise BackendRejected("UNSUPPORTED_OPERATION")
    root = Path(workspace_root).resolve(strict=True)
    for scope in scopes:
        _helper_path(root, scope, scopes, case_policy, budget=budget, deadline=deadline)

    def files(active_scopes: tuple[str, ...], suffix: str | None = None):
        seen = total = 0
        yielded: set[Path] = set()
        for scope in active_scopes:
            start = _helper_path(root, scope, active_scopes, case_policy,
                                 budget=budget, deadline=deadline)
            pending = [start]
            while pending:
                if time.monotonic() > deadline: raise TimeoutError("docker helper deadline exceeded")
                path = pending.pop()
                info = verified_stat(root, path)
                if stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400):
                    raise BackendRejected("REPARSE_PATH_DENIED")
                if stat.S_ISDIR(info.st_mode):
                    children = sorted(verified_scandir(root, path,
                        max_entries=budget["remaining"], deadline=deadline))
                    budget["remaining"] -= len(children)
                    pending.extend(reversed(children))
                    continue
                if not stat.S_ISREG(info.st_mode) or path in yielded:
                    continue
                yielded.add(path)
                seen += 1; total += info.st_size
                if seen > max_files: raise BackendRejected("SEARCH_FILE_LIMIT_EXCEEDED")
                if total > max_bytes: raise BackendRejected("SEARCH_BYTE_LIMIT_EXCEEDED")
                if suffix and path.suffix != suffix:
                    continue
                yield path

    if operation in {"repo.status", "git.diff"}:
        result = ""
    elif operation == "repo.read_file":
        if time.monotonic() > deadline: raise TimeoutError("docker helper deadline exceeded")
        if set(arguments) != {"path"}: raise BackendRejected("HELPER_ENVELOPE_INVALID")
        target = _helper_path(root, arguments["path"], scopes, case_policy,
                              budget=budget, deadline=deadline)
        if not target.is_file() or verified_stat(root, target).st_size > min(maximum, max_bytes):
            raise BackendRejected("FILE_LIMIT_EXCEEDED")
        try: result = verified_read(root, target, min(maximum, max_bytes)).decode("utf-8")
        except UnicodeDecodeError as exc: raise BackendRejected("TEXT_DECODE_FAILED") from exc
    elif operation == "repo.search":
        if set(arguments) != {"query"} or not isinstance(arguments.get("query"), str) or not arguments["query"]:
            raise BackendRejected("HELPER_ENVELOPE_INVALID")
        rows = []
        output_size = 0
        for path in files(scopes):
            try: text = verified_read(root, path, max_bytes).decode("utf-8")
            except UnicodeDecodeError: continue
            for number, line in enumerate(text.splitlines(), 1):
                if time.monotonic() > deadline: raise TimeoutError("docker helper deadline exceeded")
                if arguments["query"] in line:
                    row = f"{path.relative_to(root).as_posix()}:{number}:{line}"
                    output_size += len((row + "\n").encode("utf-8"))
                    if output_size > maximum: raise BackendRejected("OUTPUT_LIMIT_EXCEEDED")
                    rows.append(row)
                    if len(rows) > max_rows: raise BackendRejected("SEARCH_ROW_LIMIT_EXCEEDED")
        result = "\n".join(rows)
    else:
        if set(arguments) not in ({}, {"path"}): raise BackendRejected("HELPER_ENVELOPE_INVALID")
        relative = arguments.get("path", ".")
        selected_scopes = scopes
        if relative != ".":
            selected = _helper_path(root, relative, scopes, case_policy,
                                    budget=budget, deadline=deadline)
            selected_scopes = (selected.relative_to(root).as_posix(),)
        rows = []
        output_size = 0
        for path in files(selected_scopes, ".py"):
            try: text = verified_read(root, path, max_bytes).decode("utf-8", "strict")
            except UnicodeDecodeError: continue
            for number, line in enumerate(text.splitlines(), 1):
                if time.monotonic() > deadline: raise TimeoutError("docker helper deadline exceeded")
                match = re.match(r"\s*(?:async\s+def|def|class)\s+([A-Za-z_]\w*)", line)
                if match:
                    row = f"{path.relative_to(root).as_posix()}:{number}:{match.group(1)}"
                    output_size += len((row + "\n").encode("utf-8"))
                    if output_size > maximum: raise BackendRejected("OUTPUT_LIMIT_EXCEEDED")
                    rows.append(row)
                    if len(rows) > max_rows: raise BackendRejected("SEARCH_ROW_LIMIT_EXCEEDED")
        result = "\n".join(rows)
    if len(result.encode("utf-8")) > maximum:
        raise BackendRejected("OUTPUT_LIMIT_EXCEEDED")
    return result


class DockerExecutionBackend(InMemoryReadLifecycle):
    backend_id = "docker"
    def __init__(self, runner: Callable[..., Any], *, image: str, daemon_endpoint: str,
                 managed_root: str | Path | None = None, disposal_authorities=None,
                 clock=utc_now, id_factory=None, cpus: str = "1.0", memory: str = "512m",
                 manifest_evidence=None) -> None:
        super().__init__(self.backend_id, clock=clock, id_factory=id_factory,
                         disposal_authorities=disposal_authorities,
                         manifest_evidence=manifest_evidence)
        digest = image.rsplit("@sha256:", 1)[1] if "@sha256:" in image else ""
        if len(digest) != 64 or digest != digest.lower() or any(ch not in "0123456789abcdef" for ch in digest):
            raise BackendRejected("IMMUTABLE_IMAGE_REQUIRED")
        if not callable(runner) or not daemon_endpoint.strip():
            raise BackendRejected("INVALID_DOCKER_CONFIG")
        if managed_root is None: raise BackendRejected("MANAGED_ROOT_REQUIRED")
        if cpus != "1.0" or memory != "512m": raise BackendRejected("UNTRUSTED_RESOURCE_LIMIT")
        self._runner = runner; self.image = image; self.daemon_endpoint = daemon_endpoint
        self.cpus = cpus; self.memory = memory
        self.managed_root = Path(managed_root).resolve(strict=False)
        self._owned_containers: dict[str, str] = {}
        self._removed_containers: set[str] = set()
        self._orphaned_containers: dict[str, dict[str, Any]] = {}
        self._removed_orphan_containers: set[str] = set()
        self._handle_controls: dict[str, str] = {}

    @staticmethod
    def _result(value: Any) -> tuple[int, Any, str]:
        if isinstance(value, dict):
            return int(value.get("returncode", 1)), value.get("stdout", ""), str(value.get("stderr", ""))
        return int(value.returncode), value.stdout, str(value.stderr)

    def _call(self, argv: list[str], *, timeout: float = 20.0) -> Any:
        code, stdout, stderr = self._result(self._runner(argv, timeout=timeout))
        if code != 0: raise BackendRejected("DOCKER_DRIVER_FAILED", stderr[:1000])
        return stdout

    def _docker(self, *args: str, timeout: float = 20.0) -> Any:
        return self._call(["docker", "--host", self.daemon_endpoint, *args], timeout=timeout)

    @staticmethod
    def _materialize_baseline(source: Path, baseline: str, target: Path) -> None:
        result = subprocess.run(["git", "-C", str(source), "archive", "--format=tar", baseline],
                                check=False, capture_output=True, timeout=20,
                                env={"PATH": os.environ.get("PATH", ""), "GIT_CONFIG_NOSYSTEM": "1",
                                     "GIT_CONFIG_SYSTEM": os.devnull, "GIT_CONFIG_GLOBAL": os.devnull,
                                     "GIT_TERMINAL_PROMPT": "0"})
        if result.returncode: raise BackendRejected("BASELINE_ARCHIVE_FAILED")
        target.mkdir(parents=True, exist_ok=False)
        try:
            with tarfile.open(fileobj=io.BytesIO(result.stdout), mode="r:") as archive:
                for member in archive.getmembers():
                    destination = (target / member.name).resolve()
                    if target.resolve() not in (destination, *destination.parents) or member.issym() or member.islnk():
                        raise BackendRejected("BASELINE_ARCHIVE_UNSAFE")
                archive.extractall(target, filter="data")
        except Exception:
            shutil.rmtree(target.parent, ignore_errors=True)
            raise

    def _verify_container(self, container_id: str, name: str, root: Path, *,
                          workspace_id: str, running: bool | None) -> bool:
        inspected = self._docker("inspect", container_id)
        if not isinstance(inspected, dict): raise BackendRejected("CONTAINER_INSPECT_INVALID")
        host = inspected.get("HostConfig", {}); config = inspected.get("Config", {})
        mounts = inspected.get("Mounts", ())
        mount_ok = len(mounts) == 1 and mounts[0].get("Source") == str(root.resolve()) and \
            mounts[0].get("Destination") == "/workspace" and mounts[0].get("RW") is False
        resources_ok = (host.get("NanoCpus") == 1_000_000_000 and host.get("Memory") == 536_870_912 and
                        not host.get("Devices") and not host.get("Binds") and not host.get("CapAdd"))
        if (inspected.get("Id") != container_id or inspected.get("Name") != "/" + name or
                config.get("Image") != self.image or config.get("Labels", {}).get("anvil.workspace_id") != workspace_id or
                host.get("NetworkMode") != "none" or bool(host.get("Privileged")) or
                host.get("ReadonlyRootfs") is not True or not resources_ok or not mount_ok or
                (running is not None and bool(inspected.get("State", {}).get("Running")) is not running)):
            raise BackendRejected("CONTAINER_OWNERSHIP_MISMATCH")
        return bool(inspected.get("State", {}).get("Running"))

    def prepare_workspace(self, spec: WorkspaceSpec) -> WorkspaceRef:
        self._reject_retired_workspace(spec.workspace_id)
        source = Path(spec.repository.source_root).resolve(strict=True)
        if source == Path(source.anchor): raise BackendRejected("UNSAFE_MOUNT")
        managed = self.managed_root.resolve(strict=False)
        try:
            if os.path.commonpath((str(source), str(managed))) in {str(source), str(managed)}:
                raise BackendRejected("MANAGED_ROOT_OVERLAP")
        except ValueError as exc: raise BackendRejected("MANAGED_ROOT_OVERLAP") from exc
        payload_hash = self.prepare_payload_sha256(spec, backend_id=self.backend_id,
            trusted_binding={"managed_root": str(managed), "image": self.image,
                             "daemon_endpoint": self.daemon_endpoint, "cpus": self.cpus, "memory": self.memory})
        manifest_evidence_sha256 = self._verify_manifest_evidence(spec)
        existing = self._workspaces.get(spec.workspace_id)
        if existing is not None:
            if (self._workspace_states.get(spec.workspace_id) == "ACTIVE"
                and existing.prepare_payload_sha256 == payload_hash): return existing
            raise BackendRejected("PREPARE_IDEMPOTENCY_CONFLICT")
        scan = scan_repository(ScanRequest(str(source), str(source), output_path=None))
        if not scan.success or not scan.repository: raise BackendRejected("SOURCE_SCAN_REJECTED")
        dirty = tuple(scan.repository.get("tracked_dirty_paths", ())) + tuple(scan.repository.get("untracked_paths", ()))
        canonical_dirty = tuple(spec.repository.canonical_relative(item.replace("\\", "/").strip("/")) for item in dirty)
        conflicts = tuple(sorted({item for item in canonical_dirty
            for scope in spec.target_scopes if scope == "." or item == scope or item.startswith(scope + "/") or scope.startswith(item + "/")}))
        if scan.repository.get("head") != spec.approved_baseline or conflicts:
            raise BackendRejected("BASELINE_CONFLICT", details={"projection": "USER_DECISION_REQUIRED",
                "expected_baseline": spec.approved_baseline, "observed_baseline": scan.repository.get("head"),
                "conflicting_paths": conflicts, "preservation_evidence_ref": scan.no_write_proof.get("post_snapshot_sha256")})
        root = managed / resource_component("workspace", spec.workspace_id) / "workspace"
        owned = root.parent
        if owned.exists(): raise BackendRejected("WORKSPACE_ID_CONFLICT")
        self._materialize_baseline(source, spec.approved_baseline, root)
        checked = scan_repository(ScanRequest(str(source), str(source), output_path=None))
        if (not checked.success or not checked.repository or checked.repository.get("head") != spec.approved_baseline or
                checked.no_write_proof.get("pre_snapshot_sha256") != scan.no_write_proof.get("post_snapshot_sha256")):
            shutil.rmtree(owned, ignore_errors=True)
            raise BackendRejected("BASELINE_CONFLICT", details={"projection": "USER_DECISION_REQUIRED",
                "expected_baseline": spec.approved_baseline,
                "observed_baseline": (checked.repository or {}).get("head") if checked.repository else None})
        name = "anvil-" + resource_component("workspace", spec.workspace_id)
        if any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-" for ch in name):
            raise BackendRejected("INVALID_WORKSPACE_ID")
        mount = f"type=bind,src={root.resolve()},dst=/workspace,readonly"
        argv = ["docker", "--host", self.daemon_endpoint, "create", "--name", name,
                "--label", f"anvil.workspace_id={spec.workspace_id}", "--network", "none", "--pull", "never",
                "--read-only", "--cpus", self.cpus, "--memory", self.memory,
                "--mount", mount, self.image, "sleep", "infinity"]
        joined = " ".join(argv).casefold()
        if any(token in joined for token in ("--privileged", "/var/run/docker.sock", "--device", "type=volume")):
            raise BackendRejected("UNSAFE_DOCKER_ARGUMENT")
        container_id = ""
        try:
            container_id = str(self._call(argv)).strip()
            if not container_id: raise BackendRejected("CONTAINER_ID_MISSING")
            self._verify_container(container_id, name, root, workspace_id=spec.workspace_id, running=False)
            self._docker("start", container_id)
            self._verify_container(container_id, name, root, workspace_id=spec.workspace_id, running=True)
        except Exception as exc:
            if container_id:
                observed = {}
                try:
                    inspected = self._docker("inspect", container_id)
                    if isinstance(inspected, dict):
                        observed = {"container_id": inspected.get("Id"), "name": inspected.get("Name"),
                            "image": (inspected.get("Config") or {}).get("Image"),
                            "labels": dict((inspected.get("Config") or {}).get("Labels") or {}),
                            "running": bool((inspected.get("State") or {}).get("Running")),
                            "mount_count": len(inspected.get("Mounts") or ())}
                except Exception as inspect_exc:
                    observed = {"inspect_error_code": str(getattr(inspect_exc, "code", "DOCKER_INSPECT_FAILED"))}
                evidence = {
                    "workspace_id": spec.workspace_id, "run_id": spec.run_id,
                    "session_id": spec.session_id, "container_id": container_id,
                    "expected": {"name": name, "image": self.image,
                                 "labels": {"anvil.workspace_id": spec.workspace_id},
                                 "workspace_root": str(root.resolve())},
                    "observed_inspect": observed,
                    "daemon_endpoint_sha256": hashlib.sha256(self.daemon_endpoint.encode("utf-8")).hexdigest(),
                    "state": "RETAINED_OWNERSHIP_UNCONFIRMED",
                    "error_code": str(getattr(exc, "code", "DOCKER_PREPARE_FAILED")),
                    "cleanup_attempt": "NOT_ATTEMPTED",
                    "cleanup_result": "NOT_EXECUTED_OWNERSHIP_UNCONFIRMED",
                    "residue": {"container": "PRESENT_OR_UNKNOWN", "workspace_root": "PRESERVED"},
                }
                evidence["receipt_sha256"] = hashlib.sha256(canonical_bytes(evidence)).hexdigest()
                self._orphaned_containers[spec.workspace_id] = evidence
            else:
                shutil.rmtree(owned, ignore_errors=True)
            raise
        created = self._clock(); retain = created + timedelta(seconds=spec.retention_seconds)
        mapping = RepositoryPathMapping(spec.repository, spec.workspace_id, self.backend_id,
                                        str(root.resolve()), "/workspace")
        workspace = WorkspaceRef(spec.workspace_id, spec.run_id, spec.session_id, self.backend_id,
            spec.repository.repository_id, spec.approved_baseline, str(root.resolve()), mapping,
            created.isoformat(), retain.isoformat(), container_id=container_id,
            baseline_manifest_hash=spec.baseline_manifest_hash, target_scopes=spec.target_scopes,
            prepare_payload_sha256=payload_hash,
             preservation_evidence={"network": "none", "pull": "never", "read_only_mount": True,
                                   "daemon_endpoint_masked": True,
                                   "manifest_evidence_sha256": manifest_evidence_sha256})
        self._owned_containers[spec.workspace_id] = container_id
        return self._register_workspace(workspace)

    def execute(self, request: ExecutionRequest) -> ExecutionHandle:
        if request.backend_id != self.backend_id or request.operation not in READ_OPERATIONS:
            raise BackendRejected("UNSUPPORTED_OPERATION")
        workspace = self._workspace_for(request)
        container_id = self._owned_containers.get(request.workspace_id)
        if not container_id or container_id != workspace.container_id:
            raise BackendRejected("CONTAINER_OWNERSHIP_MISMATCH")
        handle, winner = self._admit(request)
        if not winner:
            if request.io_authorizer is not None:
                request.io_authorizer(lambda: None)
            return handle if handle.ended_at is not None else self._await_terminal(handle.handle_id, request.timeout_seconds)
        # The executable and operation are fixed by the driver; arguments are one
        # canonical JSON value, never a shell string or caller-selected argv.
        import json
        envelope = {
            "protocol": "anvil-read-tool/v1",
            "control": {"handle_id": handle.handle_id, "workspace_id": request.workspace_id,
                        "backend_id": self.backend_id},
            "operation": request.operation,
            "arguments": thaw(request.arguments),
            "authority": {
                "repository_id": workspace.repository_id,
                "approved_baseline": workspace.baseline,
                "baseline_manifest_hash": workspace.baseline_manifest_hash,
                "target_scopes": list(workspace.target_scopes),
                "case_policy": workspace.mapping.identity.case_policy,
            },
            "limits": {"max_output_bytes": request.max_output_bytes,
                       "timeout_seconds": request.timeout_seconds,
                       "max_traversal_files": request.max_traversal_files,
                       "max_traversal_bytes": request.max_traversal_bytes,
                       "max_traversal_rows": request.max_traversal_rows},
        }
        payload = json.dumps(envelope, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False)
        with self._lock:
            self._handle_controls[handle.handle_id] = container_id
        cancellation = self._execution_started(handle.handle_id)
        try:
            self._mark_io(request, handle)
            if cancellation.is_set():
                raise BackendRejected("EXECUTION_CANCELLED")
            self._verify_container(container_id, "anvil-" + resource_component("workspace", request.workspace_id),
                                   Path(workspace.workspace_root), workspace_id=request.workspace_id, running=True)
            if cancellation.is_set():
                raise BackendRejected("EXECUTION_CANCELLED")
            output = self._docker("exec", container_id, "anvil-read-tool", payload,
                                  timeout=request.timeout_seconds)
            return self._finish(request, handle, output)
        except BaseException as exc: return self._failed(request, handle, exc)
        finally:
            with self._lock:
                self._handle_controls.pop(handle.handle_id, None)
            self._execution_finished(handle.handle_id)

    def cancel(self, handle_id: str, *, run_id: str | None = None, session_id: str | None = None,
               workspace_id: str | None = None, backend_id: str | None = None) -> ExecutionHandle:
        handle = self._owned_handle(handle_id, run_id=run_id, session_id=session_id,
                                    workspace_id=workspace_id, backend_id=backend_id)
        if handle.ended_at is None:
            self._signal_execution_cancel(handle_id)
            try:
                workspace = self.workspace_ref(handle.workspace_id)
                container_id = self._owned_containers.get(handle.workspace_id)
                if not container_id: raise BackendRejected("CONTAINER_OWNERSHIP_MISMATCH")
                control_container = self._handle_controls.get(handle.handle_id)
                if control_container is not None and control_container != container_id:
                    raise BackendRejected("HANDLE_CONTROL_MISMATCH")
                self._verify_container(container_id, "anvil-" + resource_component("workspace", handle.workspace_id),
                                       Path(workspace.workspace_root), workspace_id=handle.workspace_id, running=True)
                if control_container is not None:
                    self._docker("exec", container_id, "anvil-read-tool-cancel", handle.handle_id, timeout=1.0)
            except BaseException as exc:
                return self._failed(self._requests[handle_id], handle, exc)
        return super().cancel(handle_id, run_id=run_id, session_id=session_id,
                              workspace_id=workspace_id, backend_id=backend_id)

    def orphan_evidence(self, workspace_id: str):
        evidence = self._orphaned_containers.get(workspace_id)
        if evidence is None: raise BackendRejected("UNKNOWN_ORPHAN")
        return deep_freeze(evidence)

    def recover_orphan(self, workspace_id: str,
                       authorization: DisposalAuthorization | None = None) -> bool:
        evidence = self._orphaned_containers.get(workspace_id)
        if evidence is None: return False
        if authorization is None:
            raise BackendRejected("DISPOSAL_AUTHORIZATION_REQUIRED")
        if (authorization.workspace_id != workspace_id or authorization.run_id != evidence.get("run_id") or
                self._disposal_authorities.get(authorization.issuer) != authorization.authority_fence):
            raise BackendRejected("DISPOSAL_AUTHORITY_UNTRUSTED")
        try:
            issued = datetime.fromisoformat(authorization.issued_at.replace("Z", "+00:00"))
            expires = datetime.fromisoformat(authorization.expires_at.replace("Z", "+00:00"))
            now = self._clock()
        except (TypeError, ValueError) as exc:
            raise BackendRejected("DISPOSAL_AUTHORIZATION_INVALID") from exc
        if not (issued <= now <= expires):
            raise BackendRejected("DISPOSAL_AUTHORIZATION_EXPIRED")
        if authorization.evidence_sha256 != evidence.get("receipt_sha256"):
            raise BackendRejected("DISPOSAL_EVIDENCE_MISMATCH")
        container_id = str(evidence["container_id"])
        root = self.managed_root / resource_component("workspace", workspace_id) / "workspace"
        if workspace_id not in self._removed_orphan_containers:
            running = self._verify_container(container_id, str(evidence["expected"]["name"]), root,
                                             workspace_id=workspace_id, running=None)
            if running: self._docker("stop", container_id)
            self._docker("rm", container_id)
            self._removed_orphan_containers.add(workspace_id)
        if root.parent.exists(): shutil.rmtree(root.parent, ignore_errors=False)
        self._orphaned_containers.pop(workspace_id, None)
        self._removed_orphan_containers.discard(workspace_id)
        return True

    def destroy_workspace(self, workspace_id: str,
                          authorization: DisposalAuthorization | None = None) -> bool:
        if self._already_destroyed(workspace_id): return False
        workspace = self._authorize_destroy(workspace_id, authorization)
        try:
            container_id = self._owned_containers.get(workspace_id)
            if not container_id or container_id != workspace.container_id:
                raise BackendRejected("CONTAINER_OWNERSHIP_MISMATCH")
            root = Path(workspace.workspace_root)
            if workspace_id not in self._removed_containers:
                running = self._verify_container(container_id, "anvil-" + resource_component("workspace", workspace_id),
                                                 root, workspace_id=workspace_id, running=None)
                if running: self._docker("stop", container_id)
                self._docker("rm", container_id)
                self._removed_containers.add(workspace_id)
            if root.parent.exists():
                shutil.rmtree(root.parent, ignore_errors=False)
            self._owned_containers.pop(workspace_id, None)
            self._removed_containers.discard(workspace_id)
            assert authorization is not None
            self._dispose_artifacts(workspace_id, authorization)
            self._forget_workspace(workspace_id)
            return True
        except BaseException:
            self._abort_destroy(workspace_id)
            raise


__all__ = ["DockerExecutionBackend", "execute_read_tool_envelope"]
