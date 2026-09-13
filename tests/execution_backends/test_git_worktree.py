from pathlib import Path
import subprocess
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import os
import hashlib
import io
import json
import sys
import time

import pytest

from packages.execution_backends import (
    BackendRejected,
    DisposalAuthorization,
    ExecutionRequest,
    GitWorktreeExecutionBackend,
    RepositoryIdentity,
    WorkspaceSpec,
    disposal_evidence_sha256,
)
from packages.execution_backends.models import resource_component

def _manifest_bytes(baseline: str) -> bytes:
    return json.dumps({"schema_version": "1.0.0", "manifest_type": "ANVIL_BASELINE_AUTHORITY",
        "repository_id": "repo-1", "approved_baseline": baseline}, sort_keys=True,
        separators=(",", ":")).encode()


def _evidence(baseline: str):
    return {("repo-1", baseline): _manifest_bytes(baseline)}


def _git(path: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(path), *args], check=True, text=True,
                          capture_output=True).stdout.strip()


def _fixture(tmp_path: Path):
    source = tmp_path / "source"
    source.mkdir()
    _git(source, "init")
    _git(source, "config", "user.email", "anvil@example.invalid")
    _git(source, "config", "user.name", "Anvil Test")
    _git(source, "config", "core.autocrlf", "false")
    (source / "pkg").mkdir()
    (source / "pkg" / "a.py").write_text("def alpha():\n    return 1\n", encoding="utf-8")
    (source / "README.md").write_text("needle\n", encoding="utf-8")
    _git(source, "add", ".")
    _git(source, "commit", "-m", "baseline")
    return source, _git(source, "rev-parse", "HEAD")


def _spec(source: Path, baseline: str, scopes=("pkg/a.py",)):
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    manifest_hash = hashlib.sha256(_manifest_bytes(baseline)).hexdigest()
    return WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline,
                         manifest_hash, tuple(scopes))


def _auth(workspace_id="ws-1", *, issuer="main", fence="fence", override=True):
    now = datetime.now(timezone.utc)
    return DisposalAuthorization("auth-1", issuer, fence, "run-1", workspace_id,
        (now - timedelta(minutes=1)).isoformat(), (now + timedelta(minutes=5)).isoformat(),
        ("workspace.destroy",), disposal_evidence_sha256("run-1", workspace_id), override, "PRESERVE")


def test_git_backend_materializes_owned_store_without_source_common_dir_mutation(tmp_path):
    source, baseline = _fixture(tmp_path)
    before = _git(source, "status", "--porcelain=v1", "--untracked-files=all")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline, ("pkg/a.py", "README.md")))
    assert backend.prepare_workspace(_spec(source, baseline, ("pkg/a.py", "README.md"))) == workspace
    assert workspace.repository_id == "repo-1"
    assert Path(workspace.workspace_root).joinpath("README.md").read_text(encoding="utf-8") == "needle\n"
    assert _git(source, "status", "--porcelain=v1", "--untracked-files=all") == before
    assert not (source / ".git" / "worktrees").exists()

    handle = backend.execute(ExecutionRequest(
        "req-1", "idem-1", "run-1", "session-1", "ws-1", "git-worktree",
        "repo.read_file", {"path": "README.md"}, 4096, 5.0,
    ))
    assert handle.status == "SUCCEEDED"
    events = backend.stream_events(handle.handle_id, run_id="run-1", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
    assert events[0].event_type == "STARTED" and sum(event.terminal for event in events) == 1
    assert "needle" in events[1].payload["output"]
    artifacts = backend.collect_artifacts(handle.handle_id, run_id="run-1", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
    assert artifacts[0].storage_kind == "INLINE" and artifacts[0].sha256
    assert backend.cancel(handle.handle_id, run_id="run-1", session_id="session-1",
                          workspace_id="ws-1", backend_id="git-worktree").status == "SUCCEEDED"
    with pytest.raises(BackendRejected) as denied:
        backend.destroy_workspace("ws-1")
    assert denied.value.code == "DISPOSAL_AUTHORIZATION_REQUIRED"
    backend.destroy_workspace("ws-1", _auth())
    assert backend.destroy_workspace("ws-1", _auth()) is False
    assert not Path(workspace.workspace_root).exists()


def test_dirty_non_overlap_is_preserved_but_overlap_and_baseline_race_fail_closed(tmp_path):
    source, baseline = _fixture(tmp_path)
    (source / "notes.txt").write_text("keep", encoding="utf-8")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline, ("pkg/a.py",)))
    assert (source / "notes.txt").read_text(encoding="utf-8") == "keep"
    backend.destroy_workspace("ws-1", _auth())

    (source / "pkg" / "a.py").write_text("dirty", encoding="utf-8")
    backend2 = GitWorktreeExecutionBackend(tmp_path / "managed-2", manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected) as denied:
        backend2.prepare_workspace(_spec(source, baseline))
    assert denied.value.code == "BASELINE_CONFLICT"
    assert denied.value.details["projection"] == "USER_DECISION_REQUIRED"
    assert denied.value.details["conflicting_paths"] == ("pkg/a.py",)
    assert not (tmp_path / "managed-2" / resource_component("workspace", "ws-1")).exists()

    (source / "pkg" / "a.py").write_text("def alpha():\n    return 1\n", encoding="utf-8")
    backend3 = GitWorktreeExecutionBackend(
        tmp_path / "managed-3", before_materialize=lambda: _git(source, "commit", "--allow-empty", "-m", "race"),
        manifest_evidence=_evidence(baseline)
    )
    with pytest.raises(BackendRejected) as race:
        backend3.prepare_workspace(_spec(source, baseline))
    assert race.value.code == "BASELINE_CONFLICT"
    assert race.value.details["projection"] == "USER_DECISION_REQUIRED"


def test_untracked_directory_collision_is_rejected_without_source_cleanup(tmp_path):
    source, baseline = _fixture(tmp_path)
    (source / "generated").mkdir()
    (source / "generated" / "x.txt").write_text("keep", encoding="utf-8")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(_spec(source, baseline, ("generated/x.txt",)))
    assert denied.value.code == "BASELINE_CONFLICT"
    assert (source / "generated" / "x.txt").read_text(encoding="utf-8") == "keep"


def test_c02_operational_ids_manifest_replay_and_managed_root_containment(tmp_path):
    source, baseline = _fixture(tmp_path)
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    c02_valid = WorkspaceSpec("Run C02+운영", "Session:C02@서울", "../Workspace α/β",
        identity, baseline, hashlib.sha256(_manifest_bytes(baseline)).hexdigest(), ("pkg/a.py",))
    c02_backend=GitWorktreeExecutionBackend(tmp_path/"managed-c02",disposal_authorities={"Main Owner":"Fence C02"},
        manifest_evidence=_evidence(baseline))
    projected=c02_backend.prepare_workspace(c02_valid)
    assert (projected.run_id,projected.session_id,projected.workspace_id)==(
        c02_valid.run_id,c02_valid.session_id,c02_valid.workspace_id)
    assert Path(projected.workspace_root).is_relative_to((tmp_path/"managed-c02").resolve())
    request=ExecutionRequest("Request C02/한글","Idempotency @ Seoul",c02_valid.run_id,c02_valid.session_id,
        c02_valid.workspace_id,"git-worktree","repo.read_file",{"path":"pkg/a.py"},4096,1)
    result=c02_backend.execute(request)
    assert result.request_id==request.request_id and result.receipt.workspace_id==c02_valid.workspace_id
    now=datetime.now(timezone.utc)
    c02_backend.destroy_workspace(c02_valid.workspace_id,DisposalAuthorization(
        "Auth C02","Main Owner","Fence C02",c02_valid.run_id,c02_valid.workspace_id,
        (now-timedelta(minutes=1)).isoformat(),(now+timedelta(minutes=5)).isoformat(),
        ("workspace.destroy",),disposal_evidence_sha256(c02_valid.run_id,c02_valid.workspace_id),True,"PRESERVE"))
    for invalid in ("", " leading", "trailing ", "\ud800"):
        with pytest.raises(ValueError):
            WorkspaceSpec("run-1","session-1",invalid,identity,baseline,
                hashlib.sha256(_manifest_bytes(baseline)).hexdigest(),("pkg/a.py",))
    with pytest.raises(BackendRejected) as inside:
        GitWorktreeExecutionBackend(source / "owned", manifest_evidence=_evidence(baseline)).prepare_workspace(_spec(source, baseline))
    assert inside.value.code == "MANAGED_ROOT_OVERLAP"

    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    drift = WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline, "c" * 64,
                          ("pkg/a.py",))
    with pytest.raises(BackendRejected) as conflict:
        backend.prepare_workspace(drift)
    assert conflict.value.code == "MANIFEST_EVIDENCE_MISMATCH"
    backend.destroy_workspace("ws-1", _auth())


def test_parent_of_file_scope_is_not_a_readable_scope(tmp_path):
    source, baseline = _fixture(tmp_path)
    backend=GitWorktreeExecutionBackend(tmp_path/"managed",disposal_authorities={"main":"fence"},
        manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source,baseline,("pkg/a.py",)))
    handle=backend.execute(ExecutionRequest("req-parent","idem-parent","run-1","session-1","ws-1",
        "git-worktree","repo.symbols",{"path":"pkg"},4096,1))
    assert handle.status == "FAILED" and handle.receipt.error_code == "SCOPE_DENIED"
    backend.destroy_workspace("ws-1",_auth())


def test_root_scope_allows_descendant_reads(tmp_path):
    source, baseline = _fixture(tmp_path)
    backend = GitWorktreeExecutionBackend(tmp_path / "managed-root", disposal_authorities={"main": "fence"},
                                          manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline, (".",)))
    handle = backend.execute(ExecutionRequest("req-root", "idem-root", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 2))
    assert handle.status == "SUCCEEDED" and "alpha" in handle.result
    backend.destroy_workspace("ws-1", _auth())


def test_search_fails_closed_if_parent_is_replaced_by_junction_before_open(tmp_path):
    source, baseline = _fixture(tmp_path)
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "a.py").write_text("SECRET_NEEDLE\n", encoding="utf-8")
    swapped = False

    class ParentSwapBackend(GitWorktreeExecutionBackend):
        def _read_no_follow(self, path, maximum, expected_identity=None, *, root=None):
            nonlocal swapped
            if not swapped and path.name == "a.py" and path.parent.name == "pkg":
                saved = path.parent.with_name("pkg-saved")
                path.parent.rename(saved)
                if os.name == "nt":
                    made = subprocess.run(
                        ["cmd.exe", "/d", "/c", "mklink", "/J", str(path.parent), str(outside)],
                        capture_output=True, text=True, check=False,
                    )
                    if made.returncode:
                        saved.rename(path.parent)
                        pytest.skip("junction creation unavailable")
                else:
                    path.parent.symlink_to(outside, target_is_directory=True)
                swapped = True
            return super()._read_no_follow(path, maximum, expected_identity, root=root)

    backend = ParentSwapBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
                                manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline, ("pkg",)))
    try:
        handle = backend.execute(ExecutionRequest(
            "req-race", "idem-race", "run-1", "session-1", "ws-1", "git-worktree",
            "repo.search", {"query": "SECRET_NEEDLE"}, 4096, 2,
        ))
        assert handle.status == "FAILED"
        assert "SECRET_NEEDLE" not in str(handle.result)
        assert handle.receipt.error_code in {"REPARSE_PATH_DENIED", "PHYSICAL_PATH_CHANGED", "PATH_DENIED"}
    finally:
        link = Path(workspace.workspace_root) / "pkg"
        saved = link.with_name("pkg-saved")
        if swapped:
            if os.name == "nt": os.rmdir(link)
            else: link.unlink()
            saved.rename(link)
        backend.destroy_workspace("ws-1", _auth())


@pytest.mark.parametrize("operation", ["repo.status", "git.diff"])
def test_git_subprocess_reads_fail_closed_for_replaced_scope_parent(tmp_path, operation):
    source, baseline = _fixture(tmp_path)
    outside = tmp_path / "outside-subprocess"
    outside.mkdir()
    (outside / "a.py").write_text('def alpha():\n    return "SECRET_OUTSIDE_SCOPE"\n', encoding="utf-8")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
                                          manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline, ("pkg",)))
    link = Path(workspace.workspace_root) / "pkg"
    saved = link.with_name("pkg-saved")
    link.rename(saved)
    if os.name == "nt":
        made = subprocess.run(["cmd.exe", "/d", "/c", "mklink", "/J", str(link), str(outside)],
                              capture_output=True, text=True, check=False)
        if made.returncode:
            saved.rename(link)
            backend.destroy_workspace("ws-1", _auth())
            pytest.skip("junction creation unavailable")
    else:
        link.symlink_to(outside, target_is_directory=True)
    try:
        handle = backend.execute(ExecutionRequest(
            f"req-{operation}", f"idem-{operation}", "run-1", "session-1", "ws-1",
            "git-worktree", operation, {}, 8192, 2,
        ))
        assert handle.status == "FAILED"
        assert "SECRET_OUTSIDE_SCOPE" not in str(handle.result)
        assert handle.receipt.error_code in {"REPARSE_PATH_DENIED", "PHYSICAL_PATH_CHANGED", "PATH_DENIED"}
    finally:
        if os.name == "nt": os.rmdir(link)
        else: link.unlink()
        saved.rename(link)
        backend.destroy_workspace("ws-1", _auth())


@pytest.mark.parametrize("operation", ["repo.status", "git.diff"])
def test_git_status_and_diff_never_return_aba_mutation_bytes_or_paths(tmp_path, operation):
    source, baseline = _fixture(tmp_path)

    class AbaBackend(GitWorktreeExecutionBackend):
        @staticmethod
        def _run_bounded(argv, *, maximum, timeout, cancellation=None):
            root = Path(argv[argv.index("-C") + 1])
            target = root / "pkg" / "a.py"
            original = target.read_bytes()
            injected = root / "pkg" / "SECRET_PATH_FROM_OUTSIDE.txt"
            try:
                target.write_text('def alpha():\n    return "SECRET_CHILD_OVERWRITE"\n', encoding="utf-8")
                injected.write_text("SECRET_PATH_FROM_OUTSIDE", encoding="utf-8")
                return GitWorktreeExecutionBackend._run_bounded(
                    argv, maximum=maximum, timeout=timeout, cancellation=cancellation
                )
            finally:
                target.write_bytes(original)
                if injected.exists(): injected.unlink()

    backend = AbaBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
                         manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline, ("pkg",)))
    handle = backend.execute(ExecutionRequest(
        f"req-aba-{operation}", f"idem-aba-{operation}", "run-1", "session-1", "ws-1",
        "git-worktree", operation, {}, 8192, 2,
    ))
    assert handle.status == "FAILED"
    assert handle.result == ""
    assert handle.receipt.error_code == "WORKSPACE_DRIFT"
    assert "SECRET_" not in str(handle.result)
    backend.destroy_workspace("ws-1", _auth())


def test_bounded_process_drains_large_stderr_without_deadlock():
    with pytest.raises(BackendRejected) as failed:
        GitWorktreeExecutionBackend._run_bounded(
            [sys.executable,"-c","import sys;sys.stderr.write('x'*200000);sys.exit(3)"],
            maximum=32,timeout=5)
    assert failed.value.code == "GIT_DRIVER_FAILED"


def test_bounded_process_timeout_kills_and_reaps_child(monkeypatch):
    import packages.execution_backends.git_worktree as module

    class TimedOutProcess:
        def __init__(self):
            self.stdout = io.BytesIO(b"")
            self.stderr = io.BytesIO(b"")
            self.killed = False
            self.wait_count = 0
        def wait(self, timeout=None):
            self.wait_count += 1
            if not self.killed:
                raise subprocess.TimeoutExpired("git", timeout)
            return -9
        def poll(self):
            return -9 if self.killed else None
        def kill(self):
            self.killed = True

    process = TimedOutProcess()
    monkeypatch.setattr(module.subprocess, "Popen", lambda *args, **kwargs: process)
    with pytest.raises(TimeoutError):
        GitWorktreeExecutionBackend._run_bounded(["git", "status"], maximum=32, timeout=.01)
    assert process.killed is True
    assert process.wait_count == 2
    assert process.poll() == -9


def test_timeout_has_single_terminal_evidence_and_active_cancel_is_idempotent(tmp_path):
    source, baseline = _fixture(tmp_path)
    class TimeoutBackend(GitWorktreeExecutionBackend):
        def _read(self, workspace, request): raise TimeoutError("late")
    timeout = TimeoutBackend(tmp_path / "managed-timeout", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    timeout.prepare_workspace(_spec(source, baseline))
    handle = timeout.execute(ExecutionRequest("req-t", "idem-t", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, .1))
    assert handle.status == "TIMEOUT"
    events = timeout.stream_events(handle.handle_id, run_id="run-1", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
    assert sum(event.terminal for event in events) == 1 and events[-1].event_type == "TIMEOUT"
    timeout.destroy_workspace("ws-1", _auth())

    started = Event(); release = Event()
    class PausingBackend(GitWorktreeExecutionBackend):
        def _read(self, workspace, request):
            started.set(); release.wait(5); return "late result"
    active = PausingBackend(tmp_path / "managed-active", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    active.prepare_workspace(_spec(source, baseline))
    request = ExecutionRequest("req-c", "idem-c", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 5)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(active.execute, request); assert started.wait(2)
        running = active.active_handles("ws-1", run_id="run-1", session_id="session-1", backend_id="git-worktree")[0]
        cancelled = active.cancel(running.handle_id, run_id="run-1", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
        with pytest.raises(BackendRejected) as retained:
            active.destroy_workspace("ws-1", _auth())
        assert retained.value.code == "ACTIVE_HANDLE_RETAINED"
        release.set(); result = future.result()
    assert cancelled.status == result.status == "CANCELLED"
    events = active.stream_events(result.handle_id, run_id="run-1", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
    assert sum(event.terminal for event in events) == 1
    active.destroy_workspace("ws-1", _auth())


def test_root_scope_dirty_is_a_baseline_conflict_and_source_is_preserved(tmp_path):
    source, baseline = _fixture(tmp_path)
    dirty = source / "pkg" / "a.py"
    dirty.write_text("USER DIRTY\n", encoding="utf-8")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(_spec(source, baseline, (".",)))
    assert denied.value.code == "BASELINE_CONFLICT"
    assert denied.value.details["conflicting_paths"] == ("pkg/a.py",)
    assert dirty.read_text(encoding="utf-8") == "USER DIRTY\n"


def test_workspace_root_replacement_is_zero_disclosure_failure(tmp_path):
    source, baseline = _fixture(tmp_path)
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
                                          manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline))
    root = Path(workspace.workspace_root)
    saved = root.with_name(root.name + "-saved")
    root.rename(saved)
    root.mkdir()
    (root / "pkg").mkdir()
    (root / "pkg" / "a.py").write_text("SECRET REPLACEMENT\n", encoding="utf-8")
    try:
        handle = backend.execute(ExecutionRequest("req-root-swap", "idem-root-swap", "run-1", "session-1",
            "ws-1", "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 2))
        assert handle.status == "FAILED"
        assert handle.receipt.error_code == "PHYSICAL_PATH_CHANGED"
        assert handle.result == ""
    finally:
        for child in (root / "pkg").glob("*"):
            child.unlink()
        (root / "pkg").rmdir()
        root.rmdir()
        saved.rename(root)
    backend.destroy_workspace("ws-1", _auth())


def test_destroyed_workspace_id_cannot_be_reused(tmp_path):
    source, baseline = _fixture(tmp_path)
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
                                          manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    backend.destroy_workspace("ws-1", _auth())
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(_spec(source, baseline))
    assert denied.value.code == "WORKSPACE_ID_RETIRED"


def test_verified_scandir_stops_consuming_at_the_cumulative_entry_bound(tmp_path, monkeypatch):
    import packages.execution_backends.safeio as safeio

    consumed = []
    class Entry:
        def __init__(self, path): self.path = str(path)
    class Entries:
        def __iter__(self): return self
        def __next__(self):
            consumed.append(len(consumed))
            if len(consumed) > 10: raise StopIteration
            return Entry(tmp_path / f"item-{len(consumed)}")
        def close(self): pass

    monkeypatch.setattr(safeio.os, "scandir", lambda _path: Entries())
    with pytest.raises(BackendRejected) as denied:
        safeio.verified_scandir(tmp_path, tmp_path, max_entries=2)
    assert denied.value.code == "SEARCH_FILE_LIMIT_EXCEEDED"
    assert len(consumed) == 3


def test_bounded_git_process_cancel_kills_and_reaps_child(monkeypatch):
    import packages.execution_backends.git_worktree as module

    started = Event(); cancelled = Event()
    class Process:
        def __init__(self):
            self.stdout = io.BytesIO(b"")
            self.stderr = io.BytesIO(b"")
            self.killed = False
            self.wait_count = 0
        def wait(self, timeout=None):
            self.wait_count += 1; started.set()
            if self.killed: return -9
            time.sleep(min(float(timeout or .01), .01))
            raise subprocess.TimeoutExpired("git", timeout)
        def poll(self): return -9 if self.killed else None
        def kill(self): self.killed = True

    process = Process()
    monkeypatch.setattr(module.subprocess, "Popen", lambda *args, **kwargs: process)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(GitWorktreeExecutionBackend._run_bounded,
                             ["git", "status"], maximum=32, timeout=2, cancellation=cancelled)
        assert started.wait(1)
        cancelled.set()
        with pytest.raises(BackendRejected) as denied:
            future.result(timeout=1)
    assert denied.value.code == "EXECUTION_CANCELLED"
    assert process.killed is True and process.poll() == -9


def test_bounded_git_process_drains_stdout_after_normal_exit(monkeypatch):
    import packages.execution_backends.git_worktree as module

    class Process:
        stdout = io.BytesIO(b" M pkg/a.py\n")
        stderr = io.BytesIO(b"")
        def wait(self, timeout=None): return 0
        def poll(self): return 0
        def kill(self): raise AssertionError("normal process must not be killed")
    class DeferredThread:
        def __init__(self, target, daemon=True): self.target = target; self.ran = False
        def start(self): pass
        def join(self, timeout=None):
            if not self.ran: self.ran = True; self.target()
        def is_alive(self): return False

    monkeypatch.setattr(module.subprocess, "Popen", lambda *args, **kwargs: Process())
    monkeypatch.setattr(module.threading, "Thread", DeferredThread)
    output = GitWorktreeExecutionBackend._run_bounded(["git", "status"], maximum=32, timeout=1)
    assert output == b" M pkg/a.py\n"


def test_destroy_requires_trusted_authority_retention_and_handle_ownership(tmp_path):
    source, baseline = _fixture(tmp_path)
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    handle = backend.execute(ExecutionRequest("req-1", "idem-1", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1))
    with pytest.raises(BackendRejected) as ownership:
        backend.stream_events(handle.handle_id, run_id="other", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
    assert ownership.value.code == "HANDLE_OWNERSHIP_MISMATCH"
    with pytest.raises(BackendRejected) as untrusted:
        backend.destroy_workspace("ws-1", _auth(fence="forged"))
    assert untrusted.value.code == "DISPOSAL_AUTHORITY_UNTRUSTED"
    with pytest.raises(BackendRejected) as retained:
        backend.destroy_workspace("ws-1", _auth(override=False))
    assert retained.value.code == "RETENTION_ACTIVE"
    backend.destroy_workspace("ws-1", _auth())


def test_nested_reparse_is_denied_after_workspace_materialization(tmp_path):
    source, baseline = _fixture(tmp_path)
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline, ("linked/secret.txt",)))
    outside = tmp_path / "outside"; outside.mkdir(); (outside / "secret.txt").write_text("secret")
    link = Path(workspace.workspace_root) / "linked"
    if os.name == "nt":
        created = subprocess.run(["cmd.exe", "/d", "/c", "mklink", "/J", str(link), str(outside)],
                                 capture_output=True, text=True, check=False)
        if created.returncode: pytest.skip("junction creation unavailable")
    else: link.symlink_to(outside, target_is_directory=True)
    try:
        handle = backend.execute(ExecutionRequest("req-j", "idem-j", "run-1", "session-1", "ws-1",
            "git-worktree", "repo.read_file", {"path": "linked/secret.txt"}, 4096, 1))
        assert handle.status == "FAILED"
        events = backend.stream_events(handle.handle_id, run_id="run-1", session_id="session-1", workspace_id="ws-1", backend_id="git-worktree")
        assert events[1].payload["error_code"] == "REPARSE_PATH_DENIED"
    finally:
        if link.exists(): os.rmdir(link)
    backend.destroy_workspace("ws-1", _auth())


def test_concurrent_identical_idempotency_dispatches_io_once_and_replays_receipt(tmp_path):
    source, baseline = _fixture(tmp_path)
    entered = Event(); release = Event()
    class PausingBackend(GitWorktreeExecutionBackend):
        def _read(self, workspace, request):
            entered.set(); release.wait(5); return "one"
    backend = PausingBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    request = ExecutionRequest("req-one", "idem-one", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 5)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(backend.execute, request)
        assert entered.wait(2)
        second = pool.submit(backend.execute, request)
        time.sleep(.05); release.set()
        left, right = first.result(), second.result()
    assert backend.io_dispatch_count == 1
    assert left == right and left.receipt is not None
    assert left.receipt.receipt_sha256 == right.receipt.receipt_sha256
    backend.destroy_workspace("ws-1", _auth())


@pytest.mark.parametrize(("kwargs", "code"), [
    ({}, "HANDLE_OWNER_IDENTITY_REQUIRED"),
    ({"run_id": "attacker"}, "HANDLE_OWNER_IDENTITY_REQUIRED"),
    ({"run_id": "attacker", "session_id": "session-1", "workspace_id": "ws-1"},
     "HANDLE_OWNER_IDENTITY_REQUIRED"),
    ({"run_id": "attacker", "session_id": "session-1", "workspace_id": "ws-1",
      "backend_id": "git-worktree"},
     "HANDLE_OWNERSHIP_MISMATCH"),
    ({"run_id": "run-1", "session_id": "session-1", "workspace_id": "ws-1",
      "backend_id": "docker"}, "HANDLE_OWNERSHIP_MISMATCH"),
])
def test_cancel_requires_complete_exact_owner_identity(tmp_path, kwargs, code):
    source, baseline = _fixture(tmp_path)
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    handle = backend.execute(ExecutionRequest("req-owner", "idem-owner", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1))
    with pytest.raises(BackendRejected) as denied:
        backend.cancel(handle.handle_id, **kwargs)
    assert denied.value.code == code
    backend.destroy_workspace("ws-1", _auth())


def test_destroy_transitions_workspace_before_new_execution_can_start(tmp_path):
    source, baseline = _fixture(tmp_path)
    authorized = Event(); release = Event()
    class PausingDestroyBackend(GitWorktreeExecutionBackend):
        def _authorize_destroy(self, workspace_id, authorization):
            value = super()._authorize_destroy(workspace_id, authorization)
            authorized.set(); release.wait(5); return value
    backend = PausingDestroyBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(backend.destroy_workspace, "ws-1", _auth())
        assert authorized.wait(2)
        with pytest.raises(BackendRejected) as denied:
            backend.execute(ExecutionRequest("req-race", "idem-race", "run-1", "session-1", "ws-1",
                "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1))
        release.set(); assert future.result() is True
    assert denied.value.code == "WORKSPACE_NOT_ACTIVE"
    assert backend.io_dispatch_count == 0


def test_manifest_must_come_from_backend_public_evidence_not_workspace_self_assertion(tmp_path):
    source, baseline = _fixture(tmp_path)
    manifest_bytes = _manifest_bytes(baseline)
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    spec = WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline,
                         manifest_hash, ("pkg/a.py",))
    without_authority = GitWorktreeExecutionBackend(tmp_path / "untrusted")
    with pytest.raises(BackendRejected) as denied:
        without_authority.prepare_workspace(spec)
    assert denied.value.code == "MANIFEST_EVIDENCE_REQUIRED"
    backend = GitWorktreeExecutionBackend(
        tmp_path / "managed", manifest_evidence={("repo-1", baseline): manifest_bytes},
        disposal_authorities={"main": "fence"})
    workspace = backend.prepare_workspace(spec)
    assert workspace.preservation_evidence["manifest_evidence_sha256"] == manifest_hash
    backend.destroy_workspace("ws-1", _auth())


@pytest.mark.parametrize("document", [
    b"not-json",
    b"[]",
    b'{"schema_version":"1.0.0","manifest_type":"ANVIL_BASELINE_AUTHORITY","repository_id":"repo-1"}',
    b'{"schema_version":"9.9.9","manifest_type":"ANVIL_BASELINE_AUTHORITY","repository_id":"repo-1","approved_baseline":"wrong"}',
    b'{"schema_version":"1.0.0","manifest_type":"ANVIL_BASELINE_AUTHORITY","repository_id":"other","approved_baseline":"wrong"}',
    b'{"schema_version":"1.0.0","schema_version":"1.0.0","manifest_type":"ANVIL_BASELINE_AUTHORITY","repository_id":"repo-1","approved_baseline":"wrong"}',
])
def test_manifest_evidence_is_strict_semantic_authority_and_revalidated_on_replay(tmp_path, document):
    source, baseline = _fixture(tmp_path)
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    spec = WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline,
                         hashlib.sha256(document).hexdigest(), ("pkg/a.py",))
    backend = GitWorktreeExecutionBackend(tmp_path / "managed",
        manifest_evidence={("repo-1", baseline): document})
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(spec)
    assert denied.value.code == "MANIFEST_EVIDENCE_INVALID"

    valid = _manifest_bytes(baseline)
    valid_spec = WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline,
                               hashlib.sha256(valid).hexdigest(), ("pkg/a.py",))
    trusted = GitWorktreeExecutionBackend(tmp_path / "trusted",
        manifest_evidence={("repo-1", baseline): valid})
    trusted.prepare_workspace(valid_spec)
    trusted._manifest_evidence[("repo-1", baseline)] = b"drift"
    with pytest.raises(BackendRejected) as replay_denied:
        trusted.prepare_workspace(valid_spec)
    assert replay_denied.value.code == "MANIFEST_EVIDENCE_INVALID"


def test_request_id_uniqueness_is_independent_from_handle_factory(tmp_path):
    source, baseline = _fixture(tmp_path)
    serial = iter(("handle-a", "artifact-a", "handle-b", "artifact-b"))
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", id_factory=lambda _prefix, _value: next(serial),
        disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    first = backend.execute(ExecutionRequest("same-request", "idem-a", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1))
    with pytest.raises(BackendRejected) as denied:
        backend.execute(ExecutionRequest("same-request", "idem-b", "run-1", "session-1", "ws-1",
            "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1))
    assert denied.value.code == "REQUEST_ID_CONFLICT" and backend.io_dispatch_count == 1
    assert backend.execute(ExecutionRequest("same-request", "idem-a", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1)) == first
    backend.destroy_workspace("ws-1", _auth())


def test_cancel_winning_before_io_prevents_read_and_keeps_single_terminal(tmp_path):
    source, baseline = _fixture(tmp_path); admitted = Event(); release = Event(); reads = []
    class CountingBackend(GitWorktreeExecutionBackend):
        def _read(self, workspace, request): reads.append(request.request_id); return "unexpected"
    backend = CountingBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
                              manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    def authorize(mark_io):
        admitted.set(); release.wait(5); mark_io()
    request = ExecutionRequest("req-cancel-early", "idem-cancel-early", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 5, authorize)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(backend.execute, request); assert admitted.wait(2)
        running = backend.active_handles("ws-1", run_id="run-1", session_id="session-1", backend_id="git-worktree")[0]
        cancelled = backend.cancel(running.handle_id, run_id="run-1", session_id="session-1",
                                   workspace_id="ws-1", backend_id="git-worktree")
        release.set(); result = future.result()
    assert cancelled.status == result.status == "CANCELLED"
    assert reads == [] and backend.io_dispatch_count == 0
    events = backend.stream_events(result.handle_id, run_id="run-1", session_id="session-1",
        workspace_id="ws-1", backend_id="git-worktree")
    assert sum(event.terminal for event in events) == 1
    backend.destroy_workspace("ws-1", _auth())


def test_cleanup_failure_retains_workspace_and_blocks_new_io(tmp_path):
    source, baseline = _fixture(tmp_path)
    class FailingCleanup(GitWorktreeExecutionBackend):
        @staticmethod
        def _remove_owned(path): raise OSError("cleanup failed")
    backend = FailingCleanup(tmp_path / "managed", disposal_authorities={"main": "fence"},
                             manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    with pytest.raises(OSError): backend.destroy_workspace("ws-1", _auth())
    with pytest.raises(BackendRejected) as state: backend.workspace_ref("ws-1")
    assert state.value.code == "WORKSPACE_NOT_ACTIVE"
    with pytest.raises(BackendRejected) as denied:
        backend.execute(ExecutionRequest("req-retained", "idem-retained", "run-1", "session-1", "ws-1",
            "git-worktree", "repo.read_file", {"path": "pkg/a.py"}, 4096, 1))
    assert denied.value.code == "WORKSPACE_NOT_ACTIVE" and backend.io_dispatch_count == 0


def test_retained_cleanup_can_retry_with_fresh_authorization(tmp_path):
    source, baseline = _fixture(tmp_path)
    class FailsOnce(GitWorktreeExecutionBackend):
        attempts = 0
        @classmethod
        def _remove_owned(cls, path):
            cls.attempts += 1
            if cls.attempts == 1: raise OSError("cleanup failed once")
            return super()._remove_owned(path)
    backend = FailsOnce(tmp_path / "managed", disposal_authorities={"main":"fence"},
                        manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source,baseline))
    with pytest.raises(OSError): backend.destroy_workspace("ws-1",_auth())
    assert backend.destroy_workspace("ws-1",_auth()) is True
    assert backend.destroy_workspace("ws-1",_auth()) is False


def test_symbols_stops_incrementally_at_output_cap(tmp_path, monkeypatch):
    source, baseline = _fixture(tmp_path)
    (source / "pkg" / "a.py").write_text("\n".join(f"def symbol_{i}(): pass" for i in range(5000)), encoding="utf-8")
    _git(source, "add", "."); _git(source, "commit", "-m", "symbols")
    baseline = _git(source, "rev-parse", "HEAD")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    import packages.execution_backends.git_worktree as module
    original = module.re.match; calls = 0
    def counted(*args, **kwargs):
        nonlocal calls; calls += 1; return original(*args, **kwargs)
    monkeypatch.setattr(module.re, "match", counted)
    handle = backend.execute(ExecutionRequest("req-cap", "idem-cap", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.symbols", {"path": "pkg/a.py"}, 32, 5))
    assert handle.status == "FAILED" and handle.receipt.error_code == "OUTPUT_LIMIT_EXCEEDED"
    assert calls < 100
    backend.destroy_workspace("ws-1", _auth())


def test_read_file_revalidates_identity_after_safe_path_selection(tmp_path):
    source, baseline = _fixture(tmp_path)
    class ReplacingBackend(GitWorktreeExecutionBackend):
        def _read_no_follow(self, path, maximum, expected_identity=None, *, root=None):
            replacement = path.with_name(path.name + ".replacement")
            replacement.write_text("attacker", encoding="utf-8")
            os.replace(replacement, path)
            return super()._read_no_follow(path, maximum, expected_identity=expected_identity, root=root)
    backend = ReplacingBackend(tmp_path / "managed", disposal_authorities={"main":"fence"},
                               manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    handle = backend.execute(ExecutionRequest("req-race", "idem-race", "run-1", "session-1", "ws-1",
        "git-worktree", "repo.read_file", {"path":"pkg/a.py"}, 4096, 2))
    assert handle.status == "FAILED" and handle.receipt.error_code == "PHYSICAL_PATH_CHANGED"
    backend.destroy_workspace("ws-1", _auth())
