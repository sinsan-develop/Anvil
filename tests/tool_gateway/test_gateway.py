import tempfile
import unittest
import hashlib
from pathlib import Path
import pytest
from types import SimpleNamespace
from collections.abc import Mapping
from threading import Event
import time
from concurrent.futures import ThreadPoolExecutor

from packages.execution_backends import ExecutionHandle, ExecutionReceipt
from packages.execution_backends.models import canonical_bytes
from packages.tool_gateway import (
    ReadToolGateway,
    ToolGatewayRejected,
    ToolPermissionRegistry,
    ToolRequest,
    WorkspaceGrant,
)


class GatewayTests(unittest.TestCase):
    def test_list_and_metadata_are_sorted_and_read_only(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); (root / "b.txt").write_text("b", encoding="utf-8"); (root / "a.txt").write_text("a", encoding="utf-8")
            gateway = ReadToolGateway(root)
            self.assertEqual(gateway.list_files().result, ("a.txt", "b.txt"))
            self.assertEqual(gateway.metadata("a.txt").result["size"], 1)

    def test_traversal_and_symlink_are_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); outside = Path(name).parent / (Path(name).name + "-outside"); outside.mkdir(); (outside / "secret").write_text("x")
            try:
                (root / "link").symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("symlink unavailable")
            gateway = ReadToolGateway(root)
            with self.assertRaises(ToolGatewayRejected): gateway.metadata("../secret")
            with self.assertRaises(ToolGatewayRejected): gateway.list_files("link")


class _Backend:
    backend_id = "git-worktree"
    def __init__(self): self.calls = []; self.target_scopes = ("README.md",)
    def execute(self, request):
        request.io_authorizer(lambda: None)
        self.calls.append(request)
        result = "bounded result"
        receipt = _receipt(request, "h-1", result=result, target_scopes=self.target_scopes)
        return ExecutionHandle("h-1", request.request_id, request.run_id, request.session_id,
                               request.workspace_id, request.backend_id, request.operation,
                               "SUCCEEDED", receipt.started_at, receipt.completed_at,
                               result, receipt)
    def workspace_ref(self, workspace_id):
        return SimpleNamespace(workspace_id="ws-1",run_id="run-1",session_id="session-1",
            backend_id="git-worktree",repository_id="repo-1",baseline="base-1",
            baseline_manifest_hash="a"*64,target_scopes=self.target_scopes)


def _receipt(request, handle_id, *, result="", status="SUCCEEDED", error_code=None,
             target_scopes=("README.md",)):
    return ExecutionReceipt(handle_id=handle_id, request_id=request.request_id,
        idempotency_key=request.idempotency_key, run_id=request.run_id, session_id=request.session_id,
        workspace_id=request.workspace_id, backend_id=request.backend_id, operation=request.operation,
        repository_id="repo-1", baseline="base-1", baseline_manifest_hash="a" * 64,
        target_scopes=target_scopes, requested_at=request.requested_at,
        started_at=request.requested_at, completed_at=request.requested_at,
        max_output_bytes=request.max_output_bytes, timeout_seconds=request.timeout_seconds,
        status=status, result_sha256=hashlib.sha256(canonical_bytes(result)).hexdigest(),
        error_code=error_code, path=str(request.arguments.get("path")) if "path" in request.arguments else None,
        max_traversal_files=request.max_traversal_files,
        max_traversal_bytes=request.max_traversal_bytes,
        max_traversal_rows=request.max_traversal_rows, masked_fields=tuple(request.masked_fields),
        error_sha256=hashlib.sha256(canonical_bytes(error_code)).hexdigest() if error_code else None)


def test_shared_permission_registry_is_checked_immediately_before_io_and_after_revoke():
    permissions = ToolPermissionRegistry()
    backend = _Backend()
    gateway = ReadToolGateway(
        permission_registry=permissions,
        backends={"git-worktree": backend},
        workspaces={"ws-1": WorkspaceGrant("ws-1", "run-1", "session-1", "git-worktree", "repo-1", "base-1", "a"*64, ("README.md",))},
    )
    request = ToolRequest("tr-1", "idem-1", "run-1", "session-1", "ws-1",
                          "repo.read_file", {"path": "README.md"}, 1024, 2.0)
    permissions.grant("session-1", {"repo.read_file"})
    assert gateway.dispatch(request).handle.handle_id == "h-1"
    assert len(backend.calls) == 1
    permissions.revoke("session-1")
    with pytest.raises(ToolGatewayRejected) as denied:
        gateway.dispatch(request)
    assert denied.value.code == "TOOL_PERMISSION_DENIED"
    assert len(backend.calls) == 1
    assert gateway.audits[-1].status == "DENIED"


def test_cross_run_workspace_and_oversize_input_are_denied_with_zero_io():
    permissions = ToolPermissionRegistry(); permissions.grant("session-1", {"repo.search"})
    backend = _Backend()
    gateway = ReadToolGateway(
        permission_registry=permissions,
        backends={"git-worktree": backend},
        workspaces={"ws-1": WorkspaceGrant("ws-1", "run-1", "session-1", "git-worktree", "repo-1", "base-1", "a"*64, ("README.md",))},
    )
    with pytest.raises(ToolGatewayRejected) as denied:
        gateway.dispatch(ToolRequest("tr-2", "idem-2", "other", "session-1", "ws-1",
                                     "repo.search", {"query": "x"}, 100, 1.0))
    assert denied.value.code == "WORKSPACE_IDENTITY_MISMATCH"
    with pytest.raises(ToolGatewayRejected) as oversized:
        gateway.dispatch(ToolRequest("tr-3", "idem-3", "run-1", "session-1", "ws-1",
                                     "repo.search", {"query": "x" * 5000}, 100, 1.0))
    assert oversized.value.code == "INPUT_LIMIT_EXCEEDED"
    assert backend.calls == []


def test_scope_and_per_tool_schema_denials_are_audited_with_io_zero():
    permissions=ToolPermissionRegistry(); permissions.grant("session-1", {"repo.read_file","repo.status"})
    backend=_Backend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend}, workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    with pytest.raises(ToolGatewayRejected) as outside:
        gateway.dispatch(ToolRequest("r1","i1","run-1","session-1","ws-1","repo.read_file",{"path":"other.txt"},100,1))
    assert outside.value.code == "SCOPE_DENIED"
    with pytest.raises(ToolGatewayRejected) as schema:
        gateway.dispatch(ToolRequest("r2","i2","run-1","session-1","ws-1","repo.status",{"unexpected":1},100,1))
    assert schema.value.code == "TOOL_SCHEMA_INVALID"
    assert backend.calls == [] and [a.status for a in gateway.audits[-2:]] == ["DENIED","DENIED"]


def test_revoke_invalidates_reserved_dispatch_before_backend_io():
    reserved=Event(); resume=Event()
    class PausingRegistry(ToolPermissionRegistry):
        def reserve(self, session_id, tool):
            value=super().reserve(session_id,tool); reserved.set(); resume.wait(5); return value
    permissions=PausingRegistry(); permissions.grant("session-1",{"repo.read_file"})
    backend=_Backend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend}, workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    request=ToolRequest("r1","i1","run-1","session-1","ws-1","repo.read_file",{"path":"README.md"},100,1)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(gateway.dispatch,request); assert reserved.wait(2)
        permissions.revoke("session-1"); resume.set()
        with pytest.raises(ToolGatewayRejected) as denied: future.result()
    assert denied.value.code == "TOOL_PERMISSION_DENIED"
    assert backend.calls == [] and gateway.audits[-1].status == "DENIED"


def test_backend_terminal_failure_and_forged_handle_are_never_success_audits():
    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.status"})
    class FailedBackend(_Backend):
        def execute(self, request):
            request.io_authorizer(lambda: None)
            self.calls.append(request)
            receipt = _receipt(request, "h-f", status="TIMEOUT", error_code="EXECUTION_TIMEOUT")
            return ExecutionHandle("h-f",request.request_id,request.run_id,request.session_id,
                request.workspace_id,request.backend_id,request.operation,"TIMEOUT",
                receipt.started_at,receipt.completed_at,"",receipt)
    backend=FailedBackend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    request=ToolRequest("r-f","i-f","run-1","session-1","ws-1","repo.status",{},100,1)
    with pytest.raises(ToolGatewayRejected) as failed: gateway.dispatch(request)
    assert failed.value.code=="EXECUTION_TIMEOUT" and gateway.audits[-1].status=="FAILED"

    class ForgedBackend(_Backend):
        def execute(self, request):
            request.io_authorizer(lambda: None)
            self.calls.append(request)
            return ExecutionHandle("h-x",request.request_id,"other",request.session_id,
                request.workspace_id,request.backend_id,request.operation,"SUCCEEDED","s","e","bounded result")
    forged=ForgedBackend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":forged},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    with pytest.raises(ToolGatewayRejected) as denied: gateway.dispatch(request)
    assert denied.value.code=="HANDLE_OWNERSHIP_MISMATCH" and gateway.audits[-1].status=="DENIED"


def test_non_mapping_arguments_fail_closed_with_exactly_one_audit_and_zero_io():
    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.status"})
    backend=_Backend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    request=ToolRequest("r-list","i-list","run-1","session-1","ws-1","repo.status",[],100,1)
    with pytest.raises(ToolGatewayRejected) as denied: gateway.dispatch(request)
    assert denied.value.code == "TOOL_SCHEMA_INVALID"
    assert backend.calls == [] and len(gateway.audits) == 1 and gateway.audits[0].status == "DENIED"


def test_hostile_mapping_and_validator_exceptions_are_stable_audited_denials(monkeypatch):
    class ExplodingMapping(Mapping):
        def __getitem__(self, key): raise RuntimeError("raw mapping error")
        def __iter__(self): raise RuntimeError("raw mapping error")
        def __len__(self): return 1
        def items(self): raise RuntimeError("raw mapping error")

    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.status","repo.read_file"})
    backend=_Backend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    requests = [
        ToolRequest("r-map","i-map","run-1","session-1","ws-1","repo.status",ExplodingMapping(),100,1),
        ToolRequest("r-key","i-key","run-1","session-1","ws-1","repo.read_file",{Path("path"):"README.md"},100,1),
        ToolRequest("r-collision","i-collision","run-1","session-1","ws-1","repo.status",{1:"x","1":"y"},100,1),
    ]
    for request in requests:
        before = len(gateway.audits)
        with pytest.raises(ToolGatewayRejected) as denied: gateway.dispatch(request)
        assert denied.value.code == "TOOL_SCHEMA_INVALID"
        assert len(gateway.audits) == before + 1 and gateway.audits[-1].status == "DENIED"
    import packages.tool_gateway.gateway as gateway_module
    monkeypatch.setattr(gateway_module, "_validate_schema", lambda *_: (_ for _ in ()).throw(RuntimeError("raw validator")))
    request = ToolRequest("r-validator","i-validator","run-1","session-1","ws-1","repo.status",{},100,1)
    with pytest.raises(ToolGatewayRejected) as denied: gateway.dispatch(request)
    assert denied.value.code == "TOOL_SCHEMA_INVALID"
    assert backend.calls == [] and len(gateway.audits) == 4


def test_revoking_one_session_does_not_remove_another_sessions_reservation():
    permissions = ToolPermissionRegistry()
    permissions.grant("session-a", {"repo.status"})
    permissions.grant("session-b", {"repo.status"})
    reservation = permissions.reserve("session-b", "repo.status")
    permissions.revoke("session-a")
    calls = []
    permissions.authorize_io(reservation, lambda: calls.append("B_IO"))
    assert calls == ["B_IO"]
    with pytest.raises(ToolGatewayRejected) as reused:
        permissions.authorize_io(reservation, lambda: calls.append("SECOND"))
    assert reused.value.code == "TOOL_PERMISSION_DENIED" and calls == ["B_IO"]


def test_consumed_permission_reservations_do_not_accumulate():
    permissions = ToolPermissionRegistry()
    permissions.grant("session-a", {"repo.status"})
    for _ in range(1000):
        reservation = permissions.reserve("session-a", "repo.status")
        permissions.authorize_io(reservation, lambda: None)
    assert permissions._reservations == {}


@pytest.mark.parametrize("field,value", [
    ("max_output_bytes", True),
    ("max_output_bytes", 1.5),
    ("timeout_seconds", True),
    ("timeout_seconds", float("nan")),
])
def test_execution_request_rejects_hostile_numeric_limits(field, value):
    from packages.execution_backends import ExecutionRequest
    kwargs = {"max_output_bytes": 4096, "timeout_seconds": 1}
    kwargs[field] = value
    with pytest.raises(ValueError):
        ExecutionRequest("req-limit", "idem-limit", "run-1", "session-1", "ws-1",
                         "git-worktree", "repo.status", {}, **kwargs)


def test_slow_session_does_not_hold_global_permission_lock_for_other_session():
    entered=Event(); release=Event()
    class SlowBackend(_Backend):
        def execute(self, request):
            entered.set(); release.wait(5); return super().execute(request)
    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.status"})
    backend=SlowBackend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    request=ToolRequest("r-slow","i-slow","run-1","session-1","ws-1","repo.status",{},100,1)
    with ThreadPoolExecutor(max_workers=2) as pool:
        dispatched=pool.submit(gateway.dispatch,request); assert entered.wait(2)
        started=time.monotonic(); grant=pool.submit(permissions.grant,"session-2",{"repo.status"})
        grant.result(timeout=.5)
        assert time.monotonic()-started < .5
        release.set(); dispatched.result()


def test_malformed_backend_output_is_denied_and_terminal_audit_is_complete():
    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.status"})
    class MalformedBackend(_Backend):
        def execute(self, request):
            request.io_authorizer(lambda: None)
            self.calls.append(request)
            result={"bad":1}; receipt=_receipt(request,"h-bad",result=result)
            return ExecutionHandle("h-bad",request.request_id,request.run_id,request.session_id,
                request.workspace_id,request.backend_id,request.operation,"SUCCEEDED",
                receipt.started_at,receipt.completed_at,result=result,receipt=receipt)
    backend=MalformedBackend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    request=ToolRequest("r-bad","i-bad","run-1","session-1","ws-1","repo.status",{},100,1)
    with pytest.raises(ToolGatewayRejected) as denied: gateway.dispatch(request)
    assert denied.value.code == "OUTPUT_SCHEMA_INVALID"
    audit=gateway.audits[-1]
    assert audit.repository_id == "repo-1" and audit.baseline == "base-1"
    assert audit.target_scopes == ("README.md",) and audit.completed_at
    assert audit.max_output_bytes == 100 and audit.timeout_seconds == 1
    assert audit.result_sha256 and audit.canonical_receipt_sha256 == audit.sha256
    assert audit.status == "FAILED" and audit.terminal_receipt_sha256 is None


def test_parent_scope_and_hostile_limit_types_are_audited_before_io():
    permissions=ToolPermissionRegistry(); permissions.grant("Session C02+서울",{"repo.symbols","repo.status"})
    backend=_Backend(); backend.target_scopes=("pkg/a.py",)
    gateway=ReadToolGateway(permission_registry=permissions,backends={"git-worktree":backend},
        workspaces={"Workspace C02/α":WorkspaceGrant("Workspace C02/α","Run C02+운영","Session C02+서울",
            "git-worktree","repo-1","base-1","a"*64,("pkg/a.py",))})
    with pytest.raises(ToolGatewayRejected) as parent:
        gateway.dispatch(ToolRequest("Request Parent","Idem Parent","Run C02+운영","Session C02+서울",
            "Workspace C02/α","repo.symbols",{"path":"pkg"},100,1))
    assert parent.value.code == "SCOPE_DENIED"
    hostile=(("bad",1,"OUTPUT_LIMIT_INVALID"),(100,float("nan"),"TIMEOUT_LIMIT_INVALID"),(True,1,"OUTPUT_LIMIT_INVALID"))
    for index,(maximum,timeout,code) in enumerate(hostile):
        before=len(gateway.audits)
        with pytest.raises(ToolGatewayRejected) as denied:
            gateway.dispatch(ToolRequest(f"Request Limit {index}",f"Idem Limit {index}","Run C02+운영",
                "Session C02+서울","Workspace C02/α","repo.status",{},maximum,timeout))
        assert denied.value.code == code and len(gateway.audits) == before + 1
    assert backend.calls == []


def test_gateway_root_scope_and_insensitive_path_use_authoritative_identity():
    permissions = ToolPermissionRegistry(); permissions.grant("session-1", {"repo.read_file"})
    backend = _Backend(); backend.target_scopes = (".",)
    gateway = ReadToolGateway(permission_registry=permissions, backends={"git-worktree": backend},
        workspaces={"ws-1": WorkspaceGrant("ws-1", "run-1", "session-1", "git-worktree",
            "repo-1", "base-1", "a" * 64, (".",), "INSENSITIVE", "map-v1")})
    result = gateway.dispatch(ToolRequest("r-root", "i-root", "run-1", "session-1", "ws-1",
        "repo.read_file", {"path": "PKG/A.PY"}, 100, 1))
    assert result.handle.status == "SUCCEEDED"


def test_idempotency_replay_keeps_original_terminal_receipt_timestamp():
    class ReplayBackend(_Backend):
        cached=None
        def execute(self,request):
            if self.cached is None: self.cached=super().execute(request)
            else: request.io_authorizer(lambda: None)
            return self.cached
    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.status"})
    backend=ReplayBackend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    request=ToolRequest("r-replay","i-replay","run-1","session-1","ws-1","repo.status",{},100,1)
    first=gateway.dispatch(request); second=gateway.dispatch(request)
    assert second.handle == first.handle and second.handle.receipt.receipt_sha256 == first.handle.receipt.receipt_sha256
    assert [item.status for item in gateway.audits] == ["SUCCEEDED","SUCCEEDED"]


def test_receipt_type_hash_and_path_must_be_native_and_exact():
    permissions=ToolPermissionRegistry(); permissions.grant("session-1",{"repo.read_file"})
    class WrongPathBackend(_Backend):
        def execute(self,request):
            request.io_authorizer(lambda: None); self.calls.append(request)
            receipt=_receipt(request,"h-wrong",result="bounded result")
            object.__setattr__(receipt,"path","other.txt")
            return ExecutionHandle("h-wrong",request.request_id,request.run_id,request.session_id,
                request.workspace_id,request.backend_id,request.operation,"SUCCEEDED",
                receipt.started_at,receipt.completed_at,"bounded result",receipt)
    backend=WrongPathBackend(); gateway=ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree":backend},workspaces={"ws-1":WorkspaceGrant(
            "ws-1","run-1","session-1","git-worktree","repo-1","base-1","a"*64,("README.md",))})
    with pytest.raises(ToolGatewayRejected) as denied:
        gateway.dispatch(ToolRequest("r-wrong","i-wrong","run-1","session-1","ws-1",
            "repo.read_file",{"path":"README.md"},100,1))
    assert denied.value.code == "BACKEND_TERMINAL_INVALID" and gateway.audits[-1].status == "FAILED"


def test_hostile_receipt_properties_are_contained_and_audited_once():
    class HostileReceipt:
        def __getattribute__(self, name):
            raise RuntimeError("hostile receipt property")

    class HostileBackend(_Backend):
        def execute(self, request):
            request.io_authorizer(lambda: None)
            self.calls.append(request)
            return ExecutionHandle("h-hostile", request.request_id, request.run_id, request.session_id,
                request.workspace_id, request.backend_id, request.operation, "SUCCEEDED",
                "2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z", "bounded result", HostileReceipt())

    permissions = ToolPermissionRegistry(); permissions.grant("session-1", {"repo.status"})
    gateway = ReadToolGateway(permission_registry=permissions,
        backends={"git-worktree": HostileBackend()}, workspaces={"ws-1": WorkspaceGrant(
            "ws-1", "run-1", "session-1", "git-worktree", "repo-1", "base-1", "a" * 64,
            ("README.md",))})
    request = ToolRequest("r-hostile", "i-hostile", "run-1", "session-1", "ws-1",
                          "repo.status", {}, 100, 1)
    with pytest.raises(ToolGatewayRejected) as denied:
        gateway.dispatch(request)
    assert denied.value.code == "BACKEND_TERMINAL_INVALID"
    assert len(gateway.audits) == 1
    assert gateway.audits[0].status == "FAILED"
    assert gateway.audits[0].terminal_receipt_sha256 is None


if __name__ == "__main__":
    unittest.main()
