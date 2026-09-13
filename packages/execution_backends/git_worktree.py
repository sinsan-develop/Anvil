"""Local-only Git worktree backend with source common-dir zero mutation."""
from __future__ import annotations

from datetime import timedelta
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import stat
import time
import threading
from typing import Callable

from packages.paths.identity import RepositoryPathMapping
from packages.repository_intelligence import ScanRequest, scan_repository

from .models import (BackendRejected, DisposalAuthorization, ExecutionHandle,
                     ExecutionRequest, InMemoryReadLifecycle, WorkspaceRef, WorkspaceSpec,
                     resource_component, utc_now)
from .registry import READ_OPERATIONS
from .safeio import (physical_identity, verify_physical_identity, verified_read,
                     verified_scandir, verified_scope_guard, verified_stat)


def _overlap(left: str, right: str) -> bool:
    left = left.strip("/"); right = right.strip("/")
    return left == "." or right == "." or left == right or left.startswith(right + "/") or right.startswith(left + "/")


class GitWorktreeExecutionBackend(InMemoryReadLifecycle):
    backend_id = "git-worktree"
    def __init__(self, managed_root: str | Path, *, clock=utc_now, id_factory=None,
                 before_materialize: Callable[[], object] | None = None,
                 disposal_authorities=None, manifest_evidence=None) -> None:
        super().__init__(self.backend_id, clock=clock, id_factory=id_factory,
                         disposal_authorities=disposal_authorities,
                         manifest_evidence=manifest_evidence)
        self.managed_root = Path(managed_root).resolve(strict=False)
        self._before_materialize = before_materialize
        self._workspace_root_identities: dict[str, tuple[str, int, int]] = {}
        self._execution_local = threading.local()

    @staticmethod
    def _run(argv: list[str], *, input_bytes: bytes | None = None,
             timeout: float = 20.0) -> subprocess.CompletedProcess:
        env = {"PATH": os.environ.get("PATH", ""), "GIT_TERMINAL_PROMPT": "0",
               "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_SYSTEM": os.devnull,
               "GIT_CONFIG_GLOBAL": os.devnull, "GIT_ATTR_NOSYSTEM": "1",
               "GIT_OPTIONAL_LOCKS": "0", "LC_ALL": "C"}
        result = subprocess.run(argv, input=input_bytes, capture_output=True, check=False,
                                timeout=timeout, env=env)
        if result.returncode != 0:
            raise BackendRejected("GIT_DRIVER_FAILED", result.stderr.decode("utf-8", "replace")[:1000])
        return result

    @staticmethod
    def _run_bounded(argv: list[str], *, maximum: int, timeout: float,
                     cancellation: threading.Event | None = None) -> bytes:
        env = {"PATH": os.environ.get("PATH", ""), "GIT_TERMINAL_PROMPT": "0",
               "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_SYSTEM": os.devnull,
               "GIT_CONFIG_GLOBAL": os.devnull, "GIT_ATTR_NOSYSTEM": "1",
               "GIT_OPTIONAL_LOCKS": "0", "LC_ALL": "C"}
        process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        output = bytearray()
        errors: list[bytes] = []
        reader_errors: list[BaseException] = []
        overflow: list[bool] = [False]
        stop = threading.Event()
        def read_stdout() -> None:
            assert process.stdout is not None
            try:
                while True:
                    remaining = maximum + 1 - len(output)
                    if remaining <= 0:
                        overflow[0] = True
                        process.kill()
                        return
                    data = process.stdout.read(min(4096, remaining))
                    if not data:
                        return
                    output.extend(data)
                    if len(output) > maximum:
                        overflow[0] = True
                        process.kill()
                        return
            except BaseException as exc:
                reader_errors.append(exc)
                stop.set()
        def read_stderr() -> None:
            assert process.stderr is not None
            captured = bytearray()
            try:
                while True:
                    data = process.stderr.read(4096)
                    if not data: break
                    if len(captured) < 1000:
                        captured.extend(data[:1000-len(captured)])
                errors.append(bytes(captured))
            except BaseException as exc:
                reader_errors.append(exc)
                stop.set()
        stdout_thread = threading.Thread(target=read_stdout, daemon=True)
        stderr_thread = threading.Thread(target=read_stderr, daemon=True)
        stdout_thread.start(); stderr_thread.start()
        try:
            deadline = time.monotonic() + timeout
            while True:
                if cancellation is not None and cancellation.is_set():
                    raise BackendRejected("EXECUTION_CANCELLED")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise subprocess.TimeoutExpired(argv[0], timeout)
                try:
                    interval = min(.05, remaining)
                    code = process.wait(timeout=interval)
                    break
                except subprocess.TimeoutExpired:
                    if time.monotonic() >= deadline:
                        raise
                    delay = min(interval, max(0.0, deadline - time.monotonic()))
                    if cancellation is None:
                        time.sleep(delay)
                    else:
                        cancellation.wait(delay)
            stdout_thread.join(timeout=1); stderr_thread.join(timeout=1)
            if stdout_thread.is_alive() or stderr_thread.is_alive():
                raise TimeoutError("repository read pipe deadline exceeded")
            if reader_errors:
                raise BackendRejected("GIT_DRIVER_PIPE_FAILED") from reader_errors[0]
            if overflow[0]:
                raise BackendRejected("OUTPUT_LIMIT_EXCEEDED")
            if code:
                raise BackendRejected("GIT_DRIVER_FAILED", (errors[0] if errors else b"").decode("utf-8", "replace")[:1000])
            return bytes(output)
        except subprocess.TimeoutExpired as exc:
            stop.set()
            if process.poll() is None: process.kill()
            process.wait(timeout=5)
            stdout_thread.join(timeout=1); stderr_thread.join(timeout=1)
            raise TimeoutError("repository read deadline exceeded") from exc
        except BaseException:
            stop.set()
            if process.poll() is None: process.kill()
            process.wait(timeout=5)
            raise

    @staticmethod
    def _remove_owned(path: Path) -> None:
        """Remove only the exact backend-owned tree, including Git read-only packs."""
        if not path.exists(): return
        for root, directories, files in os.walk(path):
            for name in (*directories, *files):
                try: os.chmod(Path(root) / name, 0o700)
                except OSError: pass
        shutil.rmtree(path, ignore_errors=False)

    def _scan(self, source: Path):
        result = scan_repository(ScanRequest(str(source), str(source), output_path=None))
        if not result.success or not result.repository:
            raise BackendRejected("SOURCE_SCAN_REJECTED", details={"errors": [e.code for e in result.errors]})
        return result

    def _conflicts(self, scan, spec: WorkspaceSpec) -> tuple[str, ...]:
        repository = scan.repository or {}
        dirty = tuple(repository.get("tracked_dirty_paths", ())) + tuple(repository.get("untracked_paths", ()))
        normalized = []
        for item in dirty:
            try: normalized.append(spec.repository.canonical_relative(item))
            except ValueError: normalized.append(item.replace("\\", "/").strip("/"))
        return tuple(sorted({item for item in normalized for scope in spec.target_scopes if _overlap(item, scope)}))

    def _baseline_conflict(self, spec: WorkspaceSpec, scan, conflicts=()) -> BackendRejected:
        proof = scan.no_write_proof
        return BackendRejected("BASELINE_CONFLICT", details={
            "projection": "USER_DECISION_REQUIRED", "run_id": spec.run_id,
            "workspace_id": spec.workspace_id, "expected_baseline": spec.approved_baseline,
            "observed_baseline": (scan.repository or {}).get("head"),
            "conflicting_paths": tuple(conflicts),
            "preservation_evidence_ref": proof.get("post_snapshot_sha256"),
        })

    def prepare_workspace(self, spec: WorkspaceSpec) -> WorkspaceRef:
        self._reject_retired_workspace(spec.workspace_id)
        source = Path(spec.repository.source_root).resolve(strict=True)
        managed = self.managed_root.resolve(strict=False)
        try:
            if os.path.commonpath((str(source), str(managed))) in {str(source), str(managed)}:
                raise BackendRejected("MANAGED_ROOT_OVERLAP")
        except ValueError as exc:
            raise BackendRejected("MANAGED_ROOT_OVERLAP") from exc
        payload_hash = self.prepare_payload_sha256(spec, backend_id=self.backend_id,
            trusted_binding={"managed_root": str(managed)})
        manifest_evidence_sha256 = self._verify_manifest_evidence(spec)
        existing = self._workspaces.get(spec.workspace_id)
        if existing is not None:
            if (self._workspace_states.get(spec.workspace_id) == "ACTIVE"
                and existing.prepare_payload_sha256 == payload_hash):
                return existing
            raise BackendRejected("PREPARE_IDEMPOTENCY_CONFLICT")
        pre = self._scan(source)
        conflicts = self._conflicts(pre, spec)
        if conflicts or (pre.repository or {}).get("head") != spec.approved_baseline:
            raise self._baseline_conflict(spec, pre, conflicts)
        if self._before_materialize is not None:
            self._before_materialize()
        checked = self._scan(source)
        if ((checked.repository or {}).get("head") != spec.approved_baseline or
                checked.no_write_proof.get("pre_snapshot_sha256") != pre.no_write_proof.get("post_snapshot_sha256")):
            raise self._baseline_conflict(spec, checked, self._conflicts(checked, spec))

        owned = self.managed_root / resource_component("workspace", spec.workspace_id)
        store = owned / "store.git"; worktree = owned / "worktree"
        if owned.exists():
            raise BackendRejected("WORKSPACE_ID_CONFLICT")
        owned.mkdir(parents=True)
        try:
            self._run(["git", "init", "--bare", str(store)])
            pack = self._run(["git", "-C", str(source), "pack-objects", "--stdout", "--revs"],
                             input_bytes=(spec.approved_baseline + "\n").encode()).stdout
            self._run(["git", "--git-dir", str(store), "index-pack", "--stdin"], input_bytes=pack)
            self._run(["git", "--git-dir", str(store), "update-ref", "refs/heads/anvil-baseline", spec.approved_baseline])
            self._run(["git", "--git-dir", str(store), "-c", "core.hooksPath=" + str(owned / "no-hooks"),
                       "worktree", "add", "--detach", str(worktree), spec.approved_baseline])
        except Exception:
            shutil.rmtree(owned, ignore_errors=True)
            raise
        post = self._scan(source)
        if post.no_write_proof.get("pre_snapshot_sha256") != checked.no_write_proof.get("post_snapshot_sha256"):
            self._remove_owned(owned)
            raise BackendRejected("SOURCE_MUTATION_DETECTED")
        created = self._clock(); retain = created + timedelta(seconds=spec.retention_seconds)
        mapping = RepositoryPathMapping(spec.repository, spec.workspace_id, self.backend_id, str(worktree))
        workspace = WorkspaceRef(spec.workspace_id, spec.run_id, spec.session_id, self.backend_id,
            spec.repository.repository_id, spec.approved_baseline, str(worktree), mapping,
            created.isoformat(), retain.isoformat(), managed_store=str(store),
            baseline_manifest_hash=spec.baseline_manifest_hash, target_scopes=spec.target_scopes,
            prepare_payload_sha256=payload_hash,
            preservation_evidence={
                "source_pre": pre.no_write_proof.get("post_snapshot_sha256"),
                "source_post": post.no_write_proof.get("pre_snapshot_sha256"),
                "source_writes": 0, "managed_store": str(store), "workspace": str(worktree),
                "manifest_evidence_sha256": manifest_evidence_sha256,
            })
        self._workspace_root_identities[spec.workspace_id] = physical_identity(worktree)
        try:
            return self._register_workspace(workspace)
        except BaseException:
            self._workspace_root_identities.pop(spec.workspace_id, None)
            raise

    def _workspace_root(self, workspace: WorkspaceRef) -> tuple[Path, tuple[str, int, int]]:
        expected = self._workspace_root_identities.get(workspace.workspace_id)
        if expected is None:
            raise BackendRejected("PHYSICAL_PATH_UNVERIFIED")
        return verify_physical_identity(Path(workspace.workspace_root), expected), expected

    def _current_cancellation(self) -> threading.Event | None:
        return getattr(self._execution_local, "cancellation", None)

    def _current_root_identity(self) -> tuple[str, int, int] | None:
        return getattr(self._execution_local, "root_identity", None)

    def _raise_if_cancelled(self) -> None:
        cancellation = self._current_cancellation()
        if cancellation is not None and cancellation.is_set():
            raise BackendRejected("EXECUTION_CANCELLED")

    def _safe_target(self, workspace: WorkspaceRef, relative: str) -> Path:
        if not isinstance(relative, str) or not relative or relative.startswith(("/", "~")) or "\\" in relative or ".." in Path(relative).parts:
            raise BackendRejected("PATH_DENIED")
        root, expected = self._workspace_root(workspace)
        target = root / relative
        cursor = root
        for part in Path(relative).parts:
            cursor = cursor / part
            try: info = os.lstat(cursor)
            except OSError as exc: raise BackendRejected("PATH_NOT_FOUND") from exc
            if stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400):
                raise BackendRejected("REPARSE_PATH_DENIED")
        verified_stat(root, target, expected_root_identity=expected)
        return target

    @staticmethod
    def _in_scope(workspace: WorkspaceRef, relative: str) -> bool:
        try:
            value = workspace.mapping.identity.canonical_relative(relative)
        except ValueError:
            return False
        return any(scope == "." or value == scope or value.startswith(scope + "/")
                   for scope in workspace.target_scopes)

    def _iter_files(self, workspace: WorkspaceRef, request: ExecutionRequest, *, suffix: str | None = None,
                    starts: tuple[Path, ...] | None = None, deadline: float | None = None):
        root, expected = self._workspace_root(workspace)
        deadline = deadline if deadline is not None else time.monotonic() + request.timeout_seconds
        seen = 0
        discovered = 0
        roots = starts or tuple(self._safe_target(workspace, scope) for scope in workspace.target_scopes)
        for start in roots:
            pending = [start]
            while pending:
                self._raise_if_cancelled()
                if time.monotonic() > deadline: raise TimeoutError("repository read deadline exceeded")
                current = pending.pop()
                info = verified_stat(root, current, expected_root_identity=expected)
                if stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400):
                    raise BackendRejected("REPARSE_PATH_DENIED")
                if current.is_dir():
                    if current.name == ".git": continue
                    children = verified_scandir(root, current,
                        max_entries=request.max_traversal_files - discovered, deadline=deadline,
                        expected_root_identity=expected)
                    discovered += len(children)
                    pending.extend(sorted(children, reverse=True))
                    continue
                seen += 1
                if seen > request.max_traversal_files: raise BackendRejected("SEARCH_FILE_LIMIT_EXCEEDED")
                if suffix is None or current.suffix == suffix: yield current

    def _read_no_follow(self, path: Path, maximum: int,
                        expected_identity: tuple[int, int] | None = None, *,
                        root: Path | None = None) -> bytes:
        return verified_read(root or path.parent, path, maximum, expected_identity,
                             expected_root_identity=self._current_root_identity())

    def _read(self, workspace: WorkspaceRef, request: ExecutionRequest) -> str:
        args = request.arguments
        if request.operation in {"repo.status", "git.diff"}:
            deadline = time.monotonic() + request.timeout_seconds
            traversed_bytes = 0
            for path in self._iter_files(workspace, request, deadline=deadline):
                traversed_bytes += verified_stat(Path(workspace.workspace_root), path,
                    expected_root_identity=self._current_root_identity()).st_size
                if traversed_bytes > int(request.max_traversal_bytes or 0):
                    raise BackendRejected("SEARCH_BYTE_LIMIT_EXCEEDED")
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("repository read deadline exceeded")
            with verified_scope_guard(Path(workspace.workspace_root), workspace.target_scopes,
                                      expected_root_identity=self._current_root_identity()):
                observed = self._run_bounded(
                    ["git", "-C", workspace.workspace_root, "status", "--porcelain=v1",
                     "--untracked-files=all", "--", *workspace.target_scopes],
                    maximum=request.max_output_bytes, timeout=remaining,
                    cancellation=self._current_cancellation(),
                )
            if len(observed.splitlines()) > request.max_traversal_rows:
                raise BackendRejected("SEARCH_ROW_LIMIT_EXCEEDED")
            # A C-09 workspace is immutable/read-only. Returning hostile working-tree
            # bytes or paths would turn status/diff into a disclosure oracle; any
            # drift is therefore a generic terminal failure with an empty result.
            if observed:
                raise BackendRejected("WORKSPACE_DRIFT")
            return ""
        if request.operation == "repo.read_file":
            target = self._safe_target(workspace, str(args.get("path", "")))
            selected = os.stat(target, follow_symlinks=False)
            expected_identity = (selected.st_dev, selected.st_ino)
            if not self._in_scope(workspace, str(args.get("path", ""))): raise BackendRejected("SCOPE_DENIED")
            if not target.is_file() or target.stat().st_size > request.max_output_bytes:
                raise BackendRejected("FILE_LIMIT_EXCEEDED")
            data = self._read_no_follow(target, request.max_output_bytes, expected_identity=expected_identity,
                                        root=Path(workspace.workspace_root))
            try: return data.decode("utf-8")
            except UnicodeDecodeError as exc: raise BackendRejected("TEXT_DECODE_FAILED") from exc
        if request.operation == "repo.search":
            query = args.get("query")
            if not isinstance(query, str) or not query or len(query) > 512:
                raise BackendRejected("INVALID_SEARCH")
            rows = []
            size = 0
            scanned = 0
            deadline = time.monotonic() + request.timeout_seconds
            for path in self._iter_files(workspace, request, deadline=deadline):
                scanned += verified_stat(Path(workspace.workspace_root), path,
                    expected_root_identity=self._current_root_identity()).st_size
                if scanned > int(request.max_traversal_bytes or 0):
                    raise BackendRejected("SEARCH_BYTE_LIMIT_EXCEEDED")
                if verified_stat(Path(workspace.workspace_root), path,
                                 expected_root_identity=self._current_root_identity()).st_size <= 1_048_576:
                    try: text = self._read_no_follow(path, 1_048_576, root=Path(workspace.workspace_root)).decode("utf-8")
                    except BackendRejected: raise
                    except (UnicodeDecodeError, OSError): continue
                    for number, line in enumerate(text.splitlines(), 1):
                        if time.monotonic() > deadline: raise TimeoutError("repository read deadline exceeded")
                        if query in line:
                            row = f"{path.relative_to(workspace.workspace_root).as_posix()}:{number}:{line}"
                            size += len((row + "\n").encode())
                            if size > request.max_output_bytes: raise BackendRejected("OUTPUT_LIMIT_EXCEEDED")
                            rows.append(row)
                            if len(rows) > request.max_traversal_rows:
                                raise BackendRejected("SEARCH_ROW_LIMIT_EXCEEDED")
            return "\n".join(rows)
        if request.operation == "repo.symbols":
            relative = str(args.get("path", "."))
            if relative != "." and not self._in_scope(workspace, relative): raise BackendRejected("SCOPE_DENIED")
            rows = []
            size = 0
            deadline = time.monotonic() + request.timeout_seconds
            if relative == ".":
                paths = self._iter_files(workspace, request, suffix=".py", deadline=deadline)
            else:
                target = self._safe_target(workspace, relative)
                paths = self._iter_files(workspace, request, suffix=".py", starts=(target,),
                                         deadline=deadline) if target.is_dir() else iter((target,))
            scanned = 0
            for path in paths:
                scanned += verified_stat(Path(workspace.workspace_root), path,
                    expected_root_identity=self._current_root_identity()).st_size
                if scanned > int(request.max_traversal_bytes or 0):
                    raise BackendRejected("SEARCH_BYTE_LIMIT_EXCEEDED")
                try: text = self._read_no_follow(path, 1_048_576, root=Path(workspace.workspace_root)).decode("utf-8")
                except BackendRejected: raise
                except OSError: continue
                for number, line in enumerate(text.splitlines(), 1):
                    if time.monotonic() > deadline: raise TimeoutError("repository read deadline exceeded")
                    match = re.match(r"\s*(?:async\s+def|def|class)\s+([A-Za-z_]\w*)", line)
                    if match:
                        row = f"{path.relative_to(workspace.workspace_root).as_posix()}:{number}:{match.group(1)}"
                        size += len((row + "\n").encode("utf-8"))
                        if size > request.max_output_bytes: raise BackendRejected("OUTPUT_LIMIT_EXCEEDED")
                        rows.append(row)
                        if len(rows) > request.max_traversal_rows:
                            raise BackendRejected("SEARCH_ROW_LIMIT_EXCEEDED")
            return "\n".join(rows)
        raise BackendRejected("UNSUPPORTED_OPERATION")

    def execute(self, request: ExecutionRequest) -> ExecutionHandle:
        if request.backend_id != self.backend_id or request.operation not in READ_OPERATIONS:
            raise BackendRejected("UNSUPPORTED_OPERATION")
        workspace = self._workspace_for(request)
        handle, winner = self._admit(request)
        if not winner:
            if request.io_authorizer is not None:
                request.io_authorizer(lambda: None)
            return handle if handle.ended_at is not None else self._await_terminal(handle.handle_id, request.timeout_seconds)
        cancellation = self._execution_started(handle.handle_id)
        self._execution_local.cancellation = cancellation
        try:
            _, root_identity = self._workspace_root(workspace)
            self._execution_local.root_identity = root_identity
            self._mark_io(request, handle)
            return self._finish(request, handle, self._read(workspace, request))
        except BaseException as exc: return self._failed(request, handle, exc)
        finally:
            self._execution_local.__dict__.clear()
            self._execution_finished(handle.handle_id)

    def destroy_workspace(self, workspace_id: str,
                          authorization: DisposalAuthorization | None = None) -> bool:
        if self._already_destroyed(workspace_id): return False
        workspace = self._authorize_destroy(workspace_id, authorization)
        try:
            owned = (Path(workspace.managed_store).parent if workspace.managed_store else
                     self.managed_root / resource_component("workspace", workspace_id))
            if (workspace.managed_store and Path(workspace.managed_store).exists()
                    and Path(workspace.workspace_root).exists()):
                self._run(["git", "--git-dir", workspace.managed_store, "worktree", "remove", "--force", workspace.workspace_root])
            self._remove_owned(owned)
            assert authorization is not None
            self._dispose_artifacts(workspace_id, authorization)
            self._workspace_root_identities.pop(workspace_id, None)
            self._forget_workspace(workspace_id)
            return True
        except BaseException:
            self._abort_destroy(workspace_id)
            raise


__all__ = ["GitWorktreeExecutionBackend"]
