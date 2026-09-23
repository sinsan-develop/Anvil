from pathlib import Path
from datetime import datetime, timedelta, timezone
import subprocess
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import json
import hashlib
import os
import shutil
import time

import pytest

from packages.execution_backends import (
    BackendRejected,
    DisposalAuthorization,
    DockerExecutionBackend,
    ExecutionRequest,
    RepositoryIdentity,
    WorkspaceSpec,
    disposal_evidence_sha256,
)
from packages.execution_backends.docker import execute_read_tool_envelope

def _manifest_bytes(baseline: str) -> bytes:
    return json.dumps({"schema_version": "1.0.0", "manifest_type": "ANVIL_BASELINE_AUTHORITY",
        "repository_id": "repo-1", "approved_baseline": baseline}, sort_keys=True,
        separators=(",", ":")).encode()


def _evidence(baseline: str):
    return {("repo-1", baseline): _manifest_bytes(baseline)}


class FakeDockerRunner:
    def __init__(self, *, fail_exec=False, timeout_exec=False, entered=None, release=None):
        self.calls = []
        self.mount = None; self.state = None; self.name = None; self.image = None
        self.fail_exec=fail_exec; self.timeout_exec=timeout_exec
        self.entered=entered; self.release=release
        self.active_controls=set(); self.cancelled_controls=set()
    @staticmethod
    def _verb(argv):
        return argv[3] if argv[1] == "--host" else argv[1]
    def __call__(self, argv, **kwargs):
        self.calls.append(tuple(argv))
        verb = self._verb(argv)
        offset = 2 if argv[1] == "--host" else 0
        if verb == "create":
            self.mount = argv[argv.index("--mount") + 1]
            self.name = argv[argv.index("--name") + 1]; self.image = argv[-3]
            self.workspace_id = argv[argv.index("--label") + 1].split("=", 1)[1]
            self.state = "created"
            return {"returncode": 0, "stdout": "cid-owned\n", "stderr": ""}
        if verb == "inspect":
            return {"returncode": 0, "stdout": {"Id": "cid-owned", "Name": "/" + self.name,
                    "Config": {"Image": self.image, "Labels": {"anvil.workspace_id": self.workspace_id}},
                    "State": {"Running": self.state == "running"},
                    "HostConfig": {"NetworkMode": "none", "Privileged": False,
                                   "ReadonlyRootfs": True, "NanoCpus": 1000000000,
                                   "Memory": 536870912, "Devices": [], "Binds": [], "CapAdd": None},
                    "Mounts": [{"Source": self.mount.split(",src=", 1)[1].split(",dst=", 1)[0],
                                "Destination": "/workspace", "RW": False}]}, "stderr": ""}
        if verb == "start": self.state = "running"; return {"returncode": 0, "stdout": "", "stderr": ""}
        if verb == "stop": self.state = "stopped"; return {"returncode": 0, "stdout": "", "stderr": ""}
        if verb == "exec":
            if "anvil-read-tool-cancel" in argv:
                handle_id = argv[-1]
                if handle_id not in self.active_controls:
                    return {"returncode": 1, "stdout": "", "stderr": "unknown handle"}
                self.cancelled_controls.add(handle_id)
                return {"returncode": 0, "stdout": "cancelled", "stderr": ""}
            envelope = json.loads(argv[-1]); handle_id = envelope["control"]["handle_id"]
            self.active_controls.add(handle_id)
            if self.entered is not None: self.entered.set()
            if self.release is not None: self.release.wait(5)
            try:
                if self.timeout_exec: raise TimeoutError("driver deadline")
                if self.fail_exec: return {"returncode": 1, "stdout": "", "stderr": "bounded failure"}
                if self.state != "running": return {"returncode": 1, "stdout": "", "stderr": "not running"}
                root = Path(self.mount.split(",src=", 1)[1].split(",dst=", 1)[0])
                return {"returncode": 0, "stdout": execute_read_tool_envelope(root, envelope), "stderr": ""}
            finally:
                self.active_controls.discard(handle_id)
        if verb == "rm": self.state = "removed"
        return {"returncode": 0, "stdout": "", "stderr": ""}


def _repo(root: Path):
    root.mkdir(); subprocess.run(["git", "-C", str(root), "init"], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(root), "config", "user.email", "a@b.invalid"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.name", "A"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "core.autocrlf", "false"], check=True)
    (root/"README.md").write_text("needle", encoding="utf-8")
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-m", "base"], check=True, capture_output=True)
    return subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()

def _spec(root: Path, baseline: str):
    identity = RepositoryIdentity("repo-1", str(root), "SENSITIVE", "map-v1")
    return WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline,
                         hashlib.sha256(_manifest_bytes(baseline)).hexdigest(), ("README.md",))

def _auth(*, evidence=None, run_id="run-1", workspace_id="ws-1",
          issued_delta=timedelta(minutes=-1), expires_delta=timedelta(minutes=5)):
    now=datetime.now(timezone.utc)
    return DisposalAuthorization("auth-1","main","fence",run_id,workspace_id,
        (now+issued_delta).isoformat(),(now+expires_delta).isoformat(),
        ("workspace.destroy",),evidence or disposal_evidence_sha256(run_id,workspace_id),True,"PRESERVE")


def test_docker_driver_builds_locked_down_argv_and_validates_owned_container(tmp_path):
    runner = FakeDockerRunner()
    source=tmp_path/"source"; baseline=_repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
                                     daemon_endpoint="unix:///trusted/docker.sock",
                                     managed_root=tmp_path/"managed", disposal_authorities={"main":"fence"},
                                     manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline))
    create = runner.calls[0]
    joined = " ".join(create)
    assert create[:4] == ("docker", "--host", "unix:///trusted/docker.sock", "create")
    assert "--network none" in joined and "--pull never" in joined
    assert "--read-only" in create and "readonly" in joined
    assert "--privileged" not in create and "/var/run/docker.sock" not in joined
    assert workspace.container_id == "cid-owned" and runner.state == "running"
    assert str(source.resolve()) not in joined
    handle = backend.execute(ExecutionRequest(
        "req-1", "idem-1", "run-1", "session-1", "ws-1", "docker",
        "repo.search", {"query": "needle"}, 1024, 2.0,
    ))
    assert handle.status == "SUCCEEDED"
    assert any(runner._verb(call) == "exec" for call in runner.calls)
    backend.destroy_workspace("ws-1", _auth())
    verbs=[runner._verb(call) for call in runner.calls]
    assert verbs[:6] == ["create","inspect","start","inspect","inspect","exec"]
    assert verbs[-3:] == ["inspect","stop","rm"]
    assert backend.destroy_workspace("ws-1", _auth()) is False


def test_docker_rejects_mutable_image_and_unsafe_workspace_before_runner_io(tmp_path):
    runner = FakeDockerRunner()
    with pytest.raises(BackendRejected):
        DockerExecutionBackend(runner, image="anvil:latest", daemon_endpoint="trusted")
    assert runner.calls == []
    source=tmp_path/"source"; baseline=_repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
                                     daemon_endpoint="trusted", managed_root=tmp_path/"managed",
                                     disposal_authorities={"main":"fence"}, manifest_evidence=_evidence(baseline))
    unsafe = _spec(source, baseline)
    object.__setattr__(unsafe.repository, "source_root", str(Path("/" if Path("/").exists() else "C:/")))
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(unsafe)
    assert denied.value.code == "UNSAFE_MOUNT"
    assert runner.calls == []


@pytest.mark.parametrize(("runner", "status"), [
    (FakeDockerRunner(fail_exec=True), "FAILED"),
    (FakeDockerRunner(timeout_exec=True), "TIMEOUT"),
])
def test_docker_terminal_failures_have_one_terminal_and_owned_artifact(tmp_path, runner, status):
    source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source,baseline))
    handle=backend.execute(ExecutionRequest("req-1","idem-1","run-1","session-1","ws-1","docker",
        "repo.search",{"query":"needle"},1024,1))
    assert handle.status == status
    events=backend.stream_events(handle.handle_id,run_id="run-1",session_id="session-1",workspace_id="ws-1",backend_id="docker")
    assert sum(event.terminal for event in events)==1 and events[-1].event_type==status
    artifacts=backend.collect_artifacts(handle.handle_id,run_id="run-1",session_id="session-1",workspace_id="ws-1",backend_id="docker")
    assert artifacts[0].storage_kind=="INLINE"
    backend.destroy_workspace("ws-1",_auth())


def test_docker_active_cancel_is_terminal_and_retains_workspace(tmp_path):
    entered=Event(); release=Event(); runner=FakeDockerRunner(entered=entered,release=release)
    source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source,baseline))
    request=ExecutionRequest("req-c","idem-c","run-1","session-1","ws-1","docker",
        "repo.search",{"query":"needle"},1024,5)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(backend.execute,request); assert entered.wait(2)
        running=backend.active_handles("ws-1",run_id="run-1",session_id="session-1",backend_id="docker")[0]
        cancelled=backend.cancel(running.handle_id,run_id="run-1",session_id="session-1",workspace_id="ws-1",backend_id="docker")
        release.set(); result=future.result()
    assert cancelled.status==result.status=="CANCELLED"
    assert sum(e.terminal for e in backend.stream_events(result.handle_id,run_id="run-1",session_id="session-1",workspace_id="ws-1",backend_id="docker"))==1
    backend.destroy_workspace("ws-1",_auth())


@pytest.mark.parametrize("digest", ["z" * 64, "A" * 64])
def test_docker_rejects_non_hex_or_uppercase_digest_before_any_io(tmp_path, digest):
    runner = FakeDockerRunner()
    with pytest.raises(BackendRejected) as denied:
        DockerExecutionBackend(runner, image="anvil@sha256:" + digest,
                               daemon_endpoint="trusted", managed_root=tmp_path / "managed")
    assert denied.value.code == "IMMUTABLE_IMAGE_REQUIRED" and runner.calls == []


def test_docker_rejects_insensitive_dirty_scope_before_container_io(tmp_path):
    runner = FakeDockerRunner()
    source = tmp_path / "source"
    baseline = _repo(source)
    (source / "README.md").write_text("dirty", encoding="utf-8")
    identity = RepositoryIdentity("repo-1", str(source), "INSENSITIVE", "map-v1")
    spec = WorkspaceSpec("run-1", "session-1", "ws-1", identity, baseline,
                         hashlib.sha256(_manifest_bytes(baseline)).hexdigest(), ("readme.md",))
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed",
        manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(spec)
    assert denied.value.code == "BASELINE_CONFLICT"
    assert denied.value.details["conflicting_paths"] == ("readme.md",)
    assert not any(runner._verb(call) == "create" for call in runner.calls)


def test_docker_retained_cleanup_retries_after_container_was_removed(tmp_path, monkeypatch):
    class RealisticRemovedRunner(FakeDockerRunner):
        def __call__(self, argv, **kwargs):
            if self._verb(argv) == "inspect" and self.state == "removed":
                self.calls.append(tuple(argv))
                return {"returncode": 1, "stdout": "", "stderr": "not found"}
            return super().__call__(argv, **kwargs)

    runner = RealisticRemovedRunner()
    source = tmp_path / "source"
    baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed",
        disposal_authorities={"main": "fence"}, manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    original = shutil.rmtree
    failed = False

    def fail_once(path, *args, **kwargs):
        nonlocal failed
        if not failed:
            failed = True
            raise OSError("simulated host cleanup failure")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(shutil, "rmtree", fail_once)
    with pytest.raises(OSError):
        backend.destroy_workspace("ws-1", _auth())
    assert runner.state == "removed"
    assert backend.destroy_workspace("ws-1", _auth()) is True
    assert backend.destroy_workspace("ws-1", _auth()) is False


def test_docker_helper_receives_canonical_authority_envelope_for_non_path_reads(tmp_path):
    runner = FakeDockerRunner(); source = tmp_path / "source"; baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", disposal_authorities={"main":"fence"},
        manifest_evidence=_evidence(baseline))
    workspace = backend.prepare_workspace(_spec(source, baseline))
    backend.execute(ExecutionRequest("req-env", "idem-env", "run-1", "session-1", "ws-1", "docker",
        "repo.status", {}, 1024, 2))
    call = next(item for item in runner.calls if runner._verb(item) == "exec")
    envelope = json.loads(call[-1])
    assert envelope["operation"] == "repo.status" and envelope["arguments"] == {}
    assert envelope["authority"] == {"repository_id":"repo-1", "approved_baseline":baseline,
        "baseline_manifest_hash":hashlib.sha256(_manifest_bytes(baseline)).hexdigest(),
        "target_scopes":["README.md"], "case_policy":"SENSITIVE"}
    assert envelope["limits"]["max_output_bytes"] == 1024
    assert envelope["limits"]["timeout_seconds"] == 2
    assert workspace.target_scopes == ("README.md",)
    backend.destroy_workspace("ws-1", _auth())


def test_docker_cancel_is_per_handle_and_new_read_keeps_workspace_running(tmp_path):
    entered=Event(); release=Event(); runner=FakeDockerRunner(entered=entered, release=release)
    source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    first=ExecutionRequest("req-a","idem-a","run-1","session-1","ws-1","docker","repo.status",{},1024,5)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(backend.execute,first); assert entered.wait(2)
        running=backend.active_handles("ws-1",run_id="run-1",session_id="session-1",backend_id="docker")[0]
        backend.cancel(running.handle_id,run_id="run-1",session_id="session-1",workspace_id="ws-1",backend_id="docker")
        release.set(); assert future.result().status == "CANCELLED"
    assert runner.state == "running"
    runner.entered = None; runner.release = None
    second=backend.execute(ExecutionRequest("req-b","idem-b","run-1","session-1","ws-1","docker",
        "repo.status",{},1024,2))
    assert second.status == "SUCCEEDED"
    assert not any(runner._verb(item) == "stop" for item in runner.calls[:-3])
    backend.destroy_workspace("ws-1",_auth())


def test_prepare_failure_exposes_immutable_public_orphan_evidence(tmp_path):
    class BadInspect(FakeDockerRunner):
        def __call__(self, argv, **kwargs):
            result = super().__call__(argv, **kwargs)
            if self._verb(argv) == "inspect" and isinstance(result.get("stdout"), dict):
                result["stdout"]["Name"] = "/forged"
            return result
    runner=BadInspect(); source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected): backend.prepare_workspace(_spec(source, baseline))
    evidence = backend.orphan_evidence("ws-1")
    assert evidence["workspace_id"] == "ws-1" and evidence["container_id"] == "cid-owned"
    assert evidence["state"] == "RETAINED_OWNERSHIP_UNCONFIRMED"
    assert len(evidence["receipt_sha256"]) == 64


def test_orphan_recovery_requires_fresh_exact_run_and_evidence_before_cleanup(tmp_path):
    class StartFailure(FakeDockerRunner):
        def __init__(self):
            super().__init__(); self.failed = False
        def __call__(self, argv, **kwargs):
            if self._verb(argv) == "inspect" and self.state == "removed":
                self.calls.append(tuple(argv))
                return {"returncode": 1, "stdout": "", "stderr": "container missing"}
            if self._verb(argv) == "start" and not self.failed:
                self.calls.append(tuple(argv)); self.failed = True
                return {"returncode": 1, "stdout": "", "stderr": "start failed"}
            return super().__call__(argv, **kwargs)
    runner=StartFailure(); source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected): backend.prepare_workspace(_spec(source,baseline))
    evidence=backend.orphan_evidence("ws-1"); before=len(runner.calls)
    hostile=(
        _auth(run_id="other-run",evidence=evidence["receipt_sha256"]),
        _auth(evidence="c"*64),
        _auth(evidence=evidence["receipt_sha256"],issued_delta=timedelta(minutes=-10),
              expires_delta=timedelta(minutes=-5)),
    )
    for authorization in hostile:
        with pytest.raises(BackendRejected): backend.recover_orphan("ws-1",authorization)
    assert not any(runner._verb(call) in {"stop","rm"} for call in runner.calls[before:])
    root=Path(evidence["expected"]["workspace_root"]).parent
    assert root.exists()
    assert backend.recover_orphan("ws-1",_auth(evidence=evidence["receipt_sha256"])) is True
    assert runner.state == "removed" and not root.exists()
    assert backend.recover_orphan("ws-1",_auth(evidence=evidence["receipt_sha256"])) is False


def test_root_scope_dirty_is_rejected_before_docker_io(tmp_path):
    runner = FakeDockerRunner(); source = tmp_path / "source"; baseline = _repo(source)
    dirty = source / "pkg" / "a.py"; dirty.parent.mkdir(); dirty.write_text("USER DIRTY\n", encoding="utf-8")
    base = _spec(source, baseline)
    root_spec = WorkspaceSpec(base.run_id, base.session_id, base.workspace_id, base.repository,
                              base.approved_baseline, base.baseline_manifest_hash, (".",))
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(root_spec)
    assert denied.value.code == "BASELINE_CONFLICT"
    assert denied.value.details["conflicting_paths"] == ("pkg/a.py",)
    assert runner.calls == [] and dirty.read_text(encoding="utf-8") == "USER DIRTY\n"


def test_docker_non_string_stdout_is_output_schema_failure(tmp_path):
    class MalformedOutput(FakeDockerRunner):
        def __call__(self, argv, **kwargs):
            if self._verb(argv) == "exec" and "anvil-read-tool" in argv:
                self.calls.append(tuple(argv))
                return {"returncode": 0, "stdout": {"not": "text"}, "stderr": ""}
            return super().__call__(argv, **kwargs)
    runner = MalformedOutput(); source = tmp_path / "source"; baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    handle = backend.execute(ExecutionRequest("req-malformed", "idem-malformed", "run-1", "session-1",
        "ws-1", "docker", "repo.status", {}, 1024, 2))
    assert handle.status == "FAILED" and handle.receipt.error_code == "OUTPUT_SCHEMA_INVALID"
    assert handle.result == ""
    backend.destroy_workspace("ws-1", _auth())


def test_orphan_local_cleanup_can_retry_after_container_was_removed(tmp_path, monkeypatch):
    class StartFailure(FakeDockerRunner):
        def __init__(self): super().__init__(); self.failed = False
        def __call__(self, argv, **kwargs):
            if self._verb(argv) == "start" and not self.failed:
                self.calls.append(tuple(argv)); self.failed = True
                return {"returncode": 1, "stdout": "", "stderr": "start failed"}
            return super().__call__(argv, **kwargs)
    runner = StartFailure(); source = tmp_path / "source"; baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected): backend.prepare_workspace(_spec(source, baseline))
    evidence = backend.orphan_evidence("ws-1")
    import packages.execution_backends.docker as docker_module
    original = docker_module.shutil.rmtree; attempts = []
    def fail_once(path, *args, **kwargs):
        attempts.append(Path(path))
        if len(attempts) == 1: raise OSError("local cleanup failed")
        return original(path, *args, **kwargs)
    monkeypatch.setattr(docker_module.shutil, "rmtree", fail_once)
    authorization = _auth(evidence=evidence["receipt_sha256"])
    with pytest.raises(OSError): backend.recover_orphan("ws-1", authorization)
    assert runner.state == "removed" and attempts[0].exists()
    assert backend.recover_orphan("ws-1", authorization) is True
    assert not attempts[0].exists()


def test_docker_cancel_control_failure_is_terminal_and_retains_inflight_workspace(tmp_path):
    class CancelFailure(FakeDockerRunner):
        def __call__(self, argv, **kwargs):
            if self._verb(argv) == "exec" and "anvil-read-tool-cancel" in argv:
                self.calls.append(tuple(argv))
                return {"returncode": 1, "stdout": "", "stderr": "cancel failed"}
            return super().__call__(argv, **kwargs)
    entered = Event(); release = Event(); runner = CancelFailure(entered=entered, release=release)
    source = tmp_path / "source"; baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline))
    request = ExecutionRequest("req-cancel-fail", "idem-cancel-fail", "run-1", "session-1", "ws-1",
        "docker", "repo.status", {}, 1024, 5)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(backend.execute, request); assert entered.wait(2)
        running = backend.active_handles("ws-1", run_id="run-1", session_id="session-1", backend_id="docker")[0]
        failed = backend.cancel(running.handle_id, run_id="run-1", session_id="session-1",
            workspace_id="ws-1", backend_id="docker")
        assert failed.status == "FAILED" and failed.receipt.error_code == "DOCKER_DRIVER_FAILED"
        with pytest.raises(BackendRejected) as retained:
            backend.destroy_workspace("ws-1", _auth())
        assert retained.value.code == "ACTIVE_HANDLE_RETAINED"
        release.set(); assert future.result().status == "FAILED"
    backend.destroy_workspace("ws-1", _auth())


def test_destroyed_docker_workspace_id_cannot_be_reused(tmp_path):
    runner = FakeDockerRunner(); source = tmp_path / "source"; baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline)); backend.destroy_workspace("ws-1", _auth())
    before = len(runner.calls)
    with pytest.raises(BackendRejected) as denied:
        backend.prepare_workspace(_spec(source, baseline))
    assert denied.value.code == "WORKSPACE_ID_RETIRED" and len(runner.calls) == before


def test_insensitive_helper_resolves_actual_archive_spelling(tmp_path):
    root = tmp_path / "workspace"; actual = root / "MixedCase" / "ReadMe.MD"
    actual.parent.mkdir(parents=True); actual.write_text("needle\n", encoding="utf-8")
    envelope = {"protocol": "anvil-read-tool/v1",
        "control": {"handle_id": "handle-case", "workspace_id": "ws-1", "backend_id": "docker"},
        "operation": "repo.read_file", "arguments": {"path": "MIXEDCASE/README.MD"},
        "authority": {"repository_id": "repo-1", "approved_baseline": "a" * 40,
            "baseline_manifest_hash": "b" * 64, "target_scopes": ["mixedcase/readme.md"],
            "case_policy": "INSENSITIVE"},
        "limits": {"max_output_bytes": 4096, "timeout_seconds": 2,
            "max_traversal_files": 10, "max_traversal_bytes": 4096, "max_traversal_rows": 10}}
    assert execute_read_tool_envelope(root, envelope) == actual.read_bytes().decode("utf-8")


def test_insensitive_helper_lookup_consumes_the_request_entry_budget(tmp_path):
    root = tmp_path / "workspace"; actual = root / "MixedCase" / "ReadMe.MD"
    actual.parent.mkdir(parents=True); actual.write_text("needle\n", encoding="utf-8")
    (root / "another-entry").mkdir()
    envelope = {"protocol": "anvil-read-tool/v1",
        "control": {"handle_id": "handle-case-bound", "workspace_id": "ws-1", "backend_id": "docker"},
        "operation": "repo.read_file", "arguments": {"path": "mixedcase/readme.md"},
        "authority": {"repository_id": "repo-1", "approved_baseline": "a" * 40,
            "baseline_manifest_hash": "b" * 64, "target_scopes": ["mixedcase/readme.md"],
            "case_policy": "INSENSITIVE"},
        "limits": {"max_output_bytes": 4096, "timeout_seconds": 2,
            "max_traversal_files": 1, "max_traversal_bytes": 4096, "max_traversal_rows": 10}}
    with pytest.raises(BackendRejected) as denied:
        execute_read_tool_envelope(root, envelope)
    assert denied.value.code == "SEARCH_FILE_LIMIT_EXCEEDED"


def test_cancel_during_inspect_terminalizes_failure_and_prevents_helper_dispatch(tmp_path):
    entered = Event(); release = Event()
    class InspectBoundary(FakeDockerRunner):
        def __init__(self):
            super().__init__(); self.block_next_inspect = False; self.fail_next_inspect = False
        def __call__(self, argv, **kwargs):
            if self._verb(argv) == "inspect" and self.block_next_inspect:
                self.block_next_inspect = False; entered.set(); release.wait(5)
            elif self._verb(argv) == "inspect" and self.fail_next_inspect:
                self.fail_next_inspect = False; self.calls.append(tuple(argv))
                return {"returncode": 1, "stdout": "", "stderr": "inspect failed"}
            return super().__call__(argv, **kwargs)
    runner = InspectBoundary(); source = tmp_path / "source"; baseline = _repo(source)
    backend = DockerExecutionBackend(runner, image="anvil@sha256:" + "a" * 64,
        daemon_endpoint="trusted", managed_root=tmp_path / "managed", disposal_authorities={"main": "fence"},
        manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source, baseline)); runner.block_next_inspect = True
    request = ExecutionRequest("req-inspect-cancel", "idem-inspect-cancel", "run-1", "session-1",
        "ws-1", "docker", "repo.status", {}, 1024, 5)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(backend.execute, request); assert entered.wait(2)
        running = backend.active_handles("ws-1", run_id="run-1", session_id="session-1", backend_id="docker")[0]
        runner.fail_next_inspect = True
        failed = backend.cancel(running.handle_id, run_id="run-1", session_id="session-1",
            workspace_id="ws-1", backend_id="docker")
        assert failed.status == "FAILED" and failed.receipt.error_code == "DOCKER_DRIVER_FAILED"
        with pytest.raises(BackendRejected) as retained:
            backend.destroy_workspace("ws-1", _auth())
        assert retained.value.code == "ACTIVE_HANDLE_RETAINED"
        release.set(); assert future.result().status == "FAILED"
    read_execs = [call for call in runner.calls if runner._verb(call) == "exec" and "anvil-read-tool-cancel" not in call]
    assert read_execs == []
    backend.destroy_workspace("ws-1", _auth())


def test_orphan_recovery_rechecks_observed_container_ownership_before_cleanup(tmp_path):
    class BadInspect(FakeDockerRunner):
        def __call__(self, argv, **kwargs):
            result=super().__call__(argv,**kwargs)
            if self._verb(argv)=="inspect" and isinstance(result.get("stdout"),dict):
                result["stdout"]["Name"]="/forged"
            return result
    runner=BadInspect(); source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    with pytest.raises(BackendRejected): backend.prepare_workspace(_spec(source,baseline))
    evidence=backend.orphan_evidence("ws-1"); before=len(runner.calls)
    with pytest.raises(BackendRejected) as denied:
        backend.recover_orphan("ws-1",_auth(evidence=evidence["receipt_sha256"]))
    assert denied.value.code == "CONTAINER_OWNERSHIP_MISMATCH"
    assert not any(runner._verb(call) in {"stop","rm"} for call in runner.calls[before:])


def test_fixed_helper_enforces_scope_and_bounds_for_all_five_operations(tmp_path):
    root = tmp_path / "workspace"; scope = root / "scope"; scope.mkdir(parents=True)
    (scope / "a.py").write_text("def alpha():\n    return 'needle'\n", encoding="utf-8")
    (root / "OUTSIDE.txt").write_text("outside-secret", encoding="utf-8")
    def envelope(operation, arguments, **limits):
        return {"protocol":"anvil-read-tool/v1",
            "control":{"handle_id":"handle-1","workspace_id":"ws-1","backend_id":"docker"},
            "operation":operation,"arguments":arguments,
            "authority":{"repository_id":"repo-1","approved_baseline":"a"*40,
                "baseline_manifest_hash":"b"*64,"target_scopes":["scope"]},
            "limits":{"max_output_bytes":limits.get("output",4096),"timeout_seconds":2,
                "max_traversal_files":limits.get("files",10),
                "max_traversal_bytes":limits.get("bytes",4096),
                "max_traversal_rows":limits.get("rows",10)}}
    assert execute_read_tool_envelope(root,envelope("repo.status",{})) == ""
    assert execute_read_tool_envelope(root,envelope("git.diff",{})) == ""
    assert "needle" in execute_read_tool_envelope(root,envelope("repo.read_file",{"path":"scope/a.py"}))
    assert "outside-secret" not in execute_read_tool_envelope(root,envelope("repo.search",{"query":"needle"}))
    assert "alpha" in execute_read_tool_envelope(root,envelope("repo.symbols",{"path":"scope"}))
    with pytest.raises(BackendRejected) as outside:
        execute_read_tool_envelope(root,envelope("repo.read_file",{"path":"OUTSIDE.txt"}))
    assert outside.value.code == "SCOPE_DENIED"
    with pytest.raises(BackendRejected) as bounded:
        execute_read_tool_envelope(root,envelope("repo.symbols",{"path":"scope"},bytes=1))
    assert bounded.value.code == "SEARCH_BYTE_LIMIT_EXCEEDED"


def test_helper_search_fails_closed_if_parent_is_replaced_before_open(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    scope = root / "scope"
    outside = tmp_path / "outside"
    scope.mkdir(parents=True)
    outside.mkdir()
    (scope / "a.txt").write_text("benign\n", encoding="utf-8")
    (outside / "a.txt").write_text("SECRET_DOCKER\n", encoding="utf-8")
    import packages.execution_backends.safeio as safeio
    original = safeio._open_descriptor
    swapped = False

    def swap_then_open(path):
        nonlocal swapped
        path = Path(path)
        if not swapped and path.name == "a.txt" and path.parent.name == "scope":
            saved = path.parent.with_name("scope-saved")
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
        return original(path)

    monkeypatch.setattr(safeio, "_open_descriptor", swap_then_open)
    envelope = {
        "protocol": "anvil-read-tool/v1",
        "control": {"handle_id": "handle-race", "workspace_id": "Workspace 운영", "backend_id": "docker"},
        "operation": "repo.search", "arguments": {"query": "SECRET_DOCKER"},
        "authority": {"repository_id": "repo-1", "approved_baseline": "a" * 40,
                      "baseline_manifest_hash": "b" * 64, "target_scopes": ["scope"]},
        "limits": {"max_output_bytes": 4096, "timeout_seconds": 2,
                   "max_traversal_files": 10, "max_traversal_bytes": 4096,
                   "max_traversal_rows": 10},
    }
    try:
        with pytest.raises(BackendRejected) as denied:
            execute_read_tool_envelope(root, envelope)
        assert denied.value.code in {"REPARSE_PATH_DENIED", "PHYSICAL_PATH_CHANGED", "SCOPE_DENIED", "PATH_DENIED"}
    finally:
        link = root / "scope"
        saved = root / "scope-saved"
        if swapped:
            if os.name == "nt": os.rmdir(link)
            else: link.unlink()
            saved.rename(link)


def test_helper_symbols_counts_suffix_mismatches_in_visited_file_budget(tmp_path):
    root = tmp_path / "workspace"
    scope = root / "scope"
    scope.mkdir(parents=True)
    for index in range(5):
        (scope / f"item-{index}.txt").write_text("not python", encoding="utf-8")
    envelope = {
        "protocol": "anvil-read-tool/v1",
        "control": {"handle_id": "handle-files", "workspace_id": "ws-1", "backend_id": "docker"},
        "operation": "repo.symbols", "arguments": {"path": "scope"},
        "authority": {"repository_id": "repo-1", "approved_baseline": "a" * 40,
                      "baseline_manifest_hash": "b" * 64, "target_scopes": ["scope"]},
        "limits": {"max_output_bytes": 4096, "timeout_seconds": 2,
                   "max_traversal_files": 1, "max_traversal_bytes": 4096,
                   "max_traversal_rows": 10},
    }
    with pytest.raises(BackendRejected) as denied:
        execute_read_tool_envelope(root, envelope)
    assert denied.value.code == "SEARCH_FILE_LIMIT_EXCEEDED"


def test_docker_concurrent_cancel_correlates_only_the_owned_handle(tmp_path):
    entered=Event(); release=Event(); runner=FakeDockerRunner(entered=entered,release=release)
    source=tmp_path/"source"; baseline=_repo(source)
    backend=DockerExecutionBackend(runner,image="anvil@sha256:"+"a"*64,daemon_endpoint="trusted",
        managed_root=tmp_path/"managed",disposal_authorities={"main":"fence"},manifest_evidence=_evidence(baseline))
    backend.prepare_workspace(_spec(source,baseline))
    requests=[ExecutionRequest(f"req-{name}",f"idem-{name}","run-1","session-1","ws-1","docker",
        "repo.status",{},1024,5) for name in ("a","b")]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(backend.execute,request) for request in requests]
        assert entered.wait(2)
        deadline=time.monotonic()+2
        while len(runner.active_controls)<2 and time.monotonic()<deadline: time.sleep(.01)
        assert len(runner.active_controls)==2
        handles=sorted(backend.active_handles("ws-1",run_id="run-1",session_id="session-1",backend_id="docker"),key=lambda item:item.request_id)
        cancelled=backend.cancel(handles[0].handle_id,run_id="run-1",session_id="session-1",
            workspace_id="ws-1",backend_id="docker")
        release.set(); results=[future.result() for future in futures]
    by_request={item.request_id:item for item in results}
    assert cancelled.status==by_request["req-a"].status=="CANCELLED"
    assert by_request["req-b"].status=="SUCCEEDED"
    assert runner.cancelled_controls=={cancelled.handle_id}
    runner.entered=None; runner.release=None
    assert backend.execute(ExecutionRequest("req-c","idem-c","run-1","session-1","ws-1","docker",
        "repo.status",{},1024,2)).status=="SUCCEEDED"
    backend.destroy_workspace("ws-1",_auth())
