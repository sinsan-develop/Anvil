from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

from packages.execution import ResultStatus
from packages.leases import LeaseService
from packages.orchestration import (
    DelegationPacket, DeveloperLifecycleService, FailureLedger,
    MainAgentTakeoverService, TakeoverReasonCode,
)
from packages.tool_gateway import ToolPermissionRegistry

H = "sha256:" + "a" * 64


def _report(result_id: str):
    return {
        "schema_version": "subagent_result/v1", "result_id": result_id,
        "delegation_id": "del-1", "attempt_id": result_id, "attempt_number": 1,
        "step_lineage_id": "lineage-A", "status": ResultStatus.FAILURE_REPORT.value,
        "target_hash": H, "summary": "assertion failed", "actions_taken": ["inspect"],
        "changed_paths": ["packages/x.py"],
        "evidence_refs": [{"evidence_id": "ev-" + result_id, "checksum": H, "kind": "test"}],
        "tests": [{"command": "pytest", "status": "FAIL", "exit_code": 1}],
        "assumptions": [], "unresolved": ["repair"], "decision_needed": "repair",
        "failure_fingerprint": "failure-A",
        "handoff": {"problem_name": "assertion", "failure_stage": "test",
                     "confirmed_cause": "bad assertion", "alternatives_considered": ["retry"]},
    }


def _ready():
    packet = DelegationPacket(
        "del-1", "run-1", "main", "wi-1", 1, "step-1", "fix",
        ("packages/x.py",), ("network",), ("three failures",), H, H, H, H,
    )
    lifecycle = DeveloperLifecycleService()
    lifecycle.start(packet, session_id="run-1", baseline_hash=H,
                    permission_snapshot_hash=H, context_snapshot_hash=H, egress_snapshot_hash=H)
    lifecycle.wait("run-1")
    now = datetime.now(timezone.utc)
    leases = LeaseService(token_factory=iter(["exec", "write"]).__next__)
    worker = leases.issue_worker("run-1", "developer-primary", now, timedelta(minutes=5))
    write = leases.issue_write(worker, "packages/x.py", now, timedelta(minutes=5))
    tools = ToolPermissionRegistry()
    tools.grant("run-1", {"read_file", "list_files"})
    ledger = FailureLedger()
    receipts = [ledger.record(_report(f"r-{i}")) for i in range(1, 4)]
    return lifecycle, leases, tools, ledger, receipts, worker, write


def test_count_below_three_is_noop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = MainAgentTakeoverService(ledger, lifecycle, leases, tools)
    result = service.takeover(receipts[1], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint="failure-A", execution_fencing_token="exec")
    assert not result.accepted and TakeoverReasonCode.COUNT_BELOW_THREE.value in result.reason_codes
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_third_failure_stops_releases_and_builds_packet_in_order():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = MainAgentTakeoverService(ledger, lifecycle, leases, tools)
    result = service.takeover(receipts[2], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint="failure-A", execution_fencing_token="exec")
    assert result.accepted and result.packet and result.audit
    assert result.packet.trigger_type == "THIRD_VALID_FAILURE"
    assert lifecycle.current("run-1").status.name == "STOP_REQUESTED"
    assert leases.active_writes("run-1") == ()
    assert tools.active("run-1") == {}
    replay = service.takeover(receipts[2], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint="failure-A", execution_fencing_token="exec")
    assert replay.accepted and replay.duplicate and len(service.audits) == 1


def test_stale_lineage_and_fencing_fail_closed():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = MainAgentTakeoverService(ledger, lifecycle, leases, tools)
    bad_lineage = service.takeover(receipts[2], session_id="run-1", expected_lineage="other", expected_fingerprint="failure-A", execution_fencing_token="exec")
    assert not bad_lineage.accepted and TakeoverReasonCode.STALE_LINEAGE.value in bad_lineage.reason_codes
    bad_token = service.takeover(receipts[2], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint="failure-A", execution_fencing_token="old")
    assert not bad_token.accepted and TakeoverReasonCode.STALE_FENCING_TOKEN.value in bad_token.reason_codes
    assert leases.active_writes("run-1") == (write,)


def test_missing_fencing_token_fails_closed_without_mutation():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = MainAgentTakeoverService(ledger, lifecycle, leases, tools)
    result = service.takeover(receipts[2], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint="failure-A")
    assert not result.accepted and TakeoverReasonCode.MISSING_FENCING_TOKEN.value in result.reason_codes
    assert leases.active_writes("run-1") == (write,)
    assert lifecycle.current("run-1").status.name == "RUNNING"
    assert service.packets == () and service.audits == ()


def test_concurrent_replay_creates_one_packet_and_zero_writes():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = MainAgentTakeoverService(ledger, lifecycle, leases, tools)
    def call(_):
        return service.takeover(receipts[2], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint="failure-A", execution_fencing_token="exec")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(call, range(8)))
    assert sum(item.accepted and not item.duplicate for item in results) == 1
    assert len(service.packets) == len(service.audits) == 1
    assert leases.active_writes("run-1") == ()
