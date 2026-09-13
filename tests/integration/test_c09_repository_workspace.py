from pathlib import Path
import subprocess
from datetime import datetime, timedelta, timezone
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest

from packages.execution_backends import (DisposalAuthorization, GitWorktreeExecutionBackend,
                                         RepositoryIdentity, WorkspaceSpec,
                                         disposal_evidence_sha256)
from packages.tool_gateway import (ReadToolGateway, ToolGatewayRejected,
                                   ToolPermissionRegistry, ToolRequest, WorkspaceGrant)

def _manifest_bytes(baseline: str) -> bytes:
    return json.dumps({"schema_version": "1.0.0", "manifest_type": "ANVIL_BASELINE_AUTHORITY",
        "repository_id": "repo-1", "approved_baseline": baseline}, sort_keys=True,
        separators=(",", ":")).encode()


def _git(path: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(path), *args], check=True,
                          capture_output=True, text=True).stdout.strip()


def _repository(root: Path):
    root.mkdir()
    _git(root, "init"); _git(root, "config", "user.email", "anvil@example.invalid")
    _git(root, "config", "user.name", "Anvil Test"); _git(root, "config", "core.autocrlf", "false")
    (root / "app.py").write_text("def alpha():\n    return 'needle'\n", encoding="utf-8")
    _git(root, "add", "."); _git(root, "commit", "-m", "baseline")
    return _git(root, "rev-parse", "HEAD")


def _auth():
    now = datetime.now(timezone.utc)
    return DisposalAuthorization("auth-1", "main", "fence", "run-1", "ws-1",
        (now - timedelta(minutes=1)).isoformat(), (now + timedelta(minutes=5)).isoformat(),
        ("workspace.destroy",), disposal_evidence_sha256("run-1", "ws-1"), True, "PRESERVE")


def test_five_canonical_reads_cross_gateway_and_revoke_stops_replay_io(tmp_path):
    source = tmp_path / "source"; baseline = _repository(source)
    manifest_bytes = _manifest_bytes(baseline); manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence={("repo-1", baseline): manifest_bytes})
    workspace = backend.prepare_workspace(WorkspaceSpec(
        "run-1", "session-1", "ws-1", identity, baseline, manifest_hash, ("app.py",)
    ))
    tools = {"repo.status", "repo.search", "repo.read_file", "repo.symbols", "git.diff"}
    permissions = ToolPermissionRegistry(); permissions.grant("session-1", tools)
    gateway = ReadToolGateway(
        permission_registry=permissions, backends={"git-worktree": backend},
        workspaces={"ws-1": WorkspaceGrant("ws-1", "run-1", "session-1", "git-worktree",
                                             "repo-1", baseline, manifest_hash, ("app.py",))},
    )
    arguments = {
        "repo.status": {}, "repo.search": {"query": "needle"},
        "repo.read_file": {"path": "app.py"}, "repo.symbols": {"path": "app.py"},
        "git.diff": {},
    }
    receipts = []
    for index, tool in enumerate(sorted(tools), 1):
        receipts.append(gateway.dispatch(ToolRequest(
            f"req-{index}", f"idem-{index}", "run-1", "session-1", "ws-1",
            tool, arguments[tool], 4096, 5.0,
        )))
    assert len({receipt.handle.handle_id for receipt in receipts}) == 5
    prior_io = backend.io_dispatch_count
    permissions.revoke("session-1")
    with pytest.raises(ToolGatewayRejected) as denied:
        gateway.dispatch(ToolRequest("req-2", "idem-2", "run-1", "session-1", "ws-1",
                                     "repo.read_file", {"path": "app.py"}, 4096, 5.0))
    assert denied.value.code == "TOOL_PERMISSION_DENIED"
    assert backend.io_dispatch_count == prior_io
    assert gateway.audits[-1].status == "DENIED"
    backend.destroy_workspace("ws-1", _auth())


def test_workspace_grant_baseline_mismatch_is_denied_before_backend_io(tmp_path):
    source = tmp_path / "source"; baseline = _repository(source)
    manifest_bytes = _manifest_bytes(baseline); manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence={("repo-1", baseline): manifest_bytes})
    backend.prepare_workspace(WorkspaceSpec(
        "run-1", "session-1", "ws-1", identity, baseline, manifest_hash, ("app.py",)
    ))
    permissions = ToolPermissionRegistry(); permissions.grant("session-1", {"repo.status"})
    gateway = ReadToolGateway(
        permission_registry=permissions, backends={"git-worktree": backend},
        workspaces={"ws-1": WorkspaceGrant("ws-1", "run-1", "session-1", "git-worktree",
                                             "repo-1", "wrong", manifest_hash, ("app.py",))},
    )
    with pytest.raises(ToolGatewayRejected) as denied:
        gateway.dispatch(ToolRequest("req-1", "idem-1", "run-1", "session-1", "ws-1",
                                     "repo.status", {}, 4096, 5.0))
    assert denied.value.code == "WORKSPACE_BASELINE_MISMATCH"
    assert backend.io_dispatch_count == 0
    backend.destroy_workspace("ws-1", _auth())


def test_revoke_before_io_creates_one_failed_terminal_and_no_running_handle(tmp_path):
    source = tmp_path / "source"; baseline = _repository(source)
    manifest_bytes = _manifest_bytes(baseline); manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
    backend = GitWorktreeExecutionBackend(tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence={("repo-1", baseline): manifest_bytes})
    backend.prepare_workspace(WorkspaceSpec(
        "run-1", "session-1", "ws-1", identity, baseline, manifest_hash, ("app.py",)
    ))
    entered = Event(); release = Event()
    class PausingPermissions(ToolPermissionRegistry):
        def authorize_io(self, reservation, mark_io):
            entered.set(); release.wait(5); return super().authorize_io(reservation, mark_io)
    permissions = PausingPermissions(); permissions.grant("session-1", {"repo.read_file"})
    gateway = ReadToolGateway(permission_registry=permissions, backends={"git-worktree": backend},
        workspaces={"ws-1": WorkspaceGrant("ws-1", "run-1", "session-1", "git-worktree",
            "repo-1", baseline, manifest_hash, ("app.py",))})
    request = ToolRequest("req-revoke", "idem-revoke", "run-1", "session-1", "ws-1",
                          "repo.read_file", {"path": "app.py"}, 4096, 5)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(gateway.dispatch, request); assert entered.wait(2)
        permissions.revoke("session-1"); release.set()
        with pytest.raises(ToolGatewayRejected) as denied: future.result()
    assert denied.value.code == "TOOL_PERMISSION_DENIED"
    assert backend.io_dispatch_count == 0 and backend.active_handles(
        "ws-1", run_id="run-1", session_id="session-1", backend_id="git-worktree") == ()
    handle = next(iter(backend._handles.values()))
    assert handle.status == "FAILED" and handle.receipt.error_code == "TOOL_PERMISSION_DENIED"
    events = backend.stream_events(handle.handle_id, run_id="run-1", session_id="session-1",
        workspace_id="ws-1", backend_id="git-worktree")
    assert sum(event.terminal for event in events) == 1
    assert len(gateway.audits) == 1 and gateway.audits[0].status == "FAILED"
    backend.destroy_workspace("ws-1", _auth())
