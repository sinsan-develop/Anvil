from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timezone, timedelta
import hashlib
import json
from threading import Event, Thread
import pytest

import packages.orchestration as orchestration
from packages.execution import ResultStatus
from packages.leases import LeaseError, LeaseService
from packages.orchestration import (
    CheckpointHandoff, DataEgressProfile, DelegationPacket, DeveloperLifecycleService, FailureLedger,
    MainAgentTakeoverService, PermissionSnapshot, TakeoverReasonCode,
)
from packages.tool_gateway import ToolGatewayRejected, ToolPermissionRegistry
from packages.orchestration.takeover import TakeoverArtifactReference, TakeoverReferenceBundle

H = "sha256:" + "a" * 64
FINGERPRINT = "sha256:a658c9131e579ee8e83dc279fbeb7a943e2d7a7503e14010a950f2b4e1422b6e"


def _canonical_hash(value) -> str:
    payload = json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _reference(kind: str, artifact_id: str, checksum: str, *, session_id: str = "run-1",
               delegation_id: str = "del-1", lineage: str = "lineage-A") -> TakeoverArtifactReference:
    payload = {
        "artifact_id": artifact_id, "kind": kind, "checksum": checksum,
        "session_id": session_id, "delegation_id": delegation_id,
        "step_lineage_id": lineage,
    }
    return TakeoverArtifactReference(
        artifact_id, kind, checksum, session_id, delegation_id, lineage,
        _canonical_hash(payload),
    )


def _reference_payload(reference: TakeoverArtifactReference) -> dict:
    return {
        "artifact_id": reference.artifact_id, "kind": reference.kind,
        "checksum": reference.checksum, "session_id": reference.session_id,
        "delegation_id": reference.delegation_id,
        "step_lineage_id": reference.step_lineage_id,
        "binding_hash": reference.binding_hash,
    }


def _bundle(lifecycle, ledger, *, work_instruction=None, diff=None, test_output=None,
            checkpoint=None, failure_reports=None) -> TakeoverReferenceBundle:
    current_checkpoint = lifecycle.handoff("run-1")
    assert current_checkpoint is not None
    work_instruction = work_instruction or _reference("WORK_INSTRUCTION", "wi-1", H)
    diff = diff or _reference("DIFF", "diff-1", "sha256:" + "b" * 64)
    test_output = test_output or _reference("TEST_OUTPUT", "test-output-1", "sha256:" + "c" * 64)
    checkpoint = checkpoint or _reference("CHECKPOINT", current_checkpoint.checkpoint_id, current_checkpoint.checkpoint_hash)
    failure_reports = failure_reports or tuple(
        _reference("FAILURE_REPORT", entry.result_id, entry.result_hash)
        for entry in ledger.entries if entry.accepted
    )
    payload = {
        "work_instruction": _reference_payload(work_instruction),
        "diff": _reference_payload(diff),
        "test_output": _reference_payload(test_output),
        "checkpoint": _reference_payload(checkpoint),
        "failure_reports": [_reference_payload(item) for item in failure_reports],
    }
    return TakeoverReferenceBundle(
        work_instruction, diff, test_output, checkpoint, tuple(failure_reports),
        _canonical_hash(payload),
    )


def _service(ledger, lifecycle, leases, tools, *, trusted_bundle=None):
    trusted_bundle = trusted_bundle or _bundle(lifecycle, ledger)
    authority = orchestration.TakeoverEvidenceAuthority()
    registry = orchestration.TakeoverEvidenceRegistry(authority)
    registry.publish(
        work_instruction=trusted_bundle.work_instruction,
        diff=trusted_bundle.diff,
        test_output=trusted_bundle.test_output,
        checkpoint=trusted_bundle.checkpoint,
        authority=authority, sequence=1,
    )
    registry.seal(authority=authority)
    return MainAgentTakeoverService(
        ledger, lifecycle, leases, tools,
        evidence_registry=registry,
    )


def _report(result_id: str):
    attempt_number = int(result_id.rsplit("-", 1)[-1])
    return {
        "schema_version": "subagent_result/v1", "result_id": result_id,
        "delegation_id": "del-1", "attempt_id": result_id, "attempt_number": attempt_number,
        "step_lineage_id": "lineage-A", "status": ResultStatus.FAILURE_REPORT.value,
        "target_hash": H, "summary": "assertion failed", "actions_taken": ["inspect"],
        "changed_paths": ["packages/x.py"],
        "evidence_refs": [{"evidence_id": "ev-" + result_id, "checksum": H, "kind": "test"}],
        "tests": [{"command": "pytest tests/test_sample.py::test_case", "status": "FAIL", "exit_code": 1}],
        "assumptions": [], "unresolved": ["repair"], "decision_needed": "repair",
        "failure_fingerprint": FINGERPRINT,
        "handoff": {
            "problem_name": "assertion",
            "failure_stage": "test",
            "confirmed_cause": "bad assertion",
            "alternatives_considered": ["retry"],
            "normalized_error_code": "E_ASSERTION",
            "failing_test_or_gate": "pytest tests/test_sample.py::test_case",
            "relevant_stack_fingerprint": "stack:assert-equal",
            "failure_origin": "CODE_DEFECT",
        },
    }


def test_takeover_reference_contract_is_public():
    assert getattr(orchestration, "TakeoverArtifactReference", None) is TakeoverArtifactReference
    assert getattr(orchestration, "TakeoverReferenceBundle", None) is TakeoverReferenceBundle
    assert orchestration.TakeoverEvidenceAuthority is not None
    assert orchestration.TakeoverEvidenceRegistry is not None
    assert orchestration.SealedTakeoverEvidence is not None


def _ready():
    permission = PermissionSnapshot(
        ("packages/x.py",), ("read", "test"), ("read_file", "pytest"),
        ("codex",), (), (), ("network",),
    )
    egress = DataEgressProfile("local_only", (), (), ())
    packet = DelegationPacket(
        delegation_id="del-1", parent_run_id="run-1", parent_agent_id="main",
        work_instruction_id="wi-1", plan_revision=1, step_id="step-1",
        workspace_id="ws-1", objective="fix", in_scope=("takeover fixture",),
        out_of_scope=("external systems",), allowed_paths=permission.allowed_paths,
        prohibited_actions=permission.prohibited_actions,
        permission_profile_id="perm-1", expected_result_schema="subagent_result/v1",
        required_evidence=("failure reports",), budget_ref="budget-1",
        completion_conditions=("three failures",), baseline_hash=H,
        context_snapshot_hash=H, permission_snapshot=permission,
        permission_snapshot_hash=permission.snapshot_hash,
        parent_permission_snapshot_hash=permission.snapshot_hash,
        data_egress_profile=egress, egress_snapshot_hash=egress.snapshot_hash,
        parent_egress_snapshot_hash=egress.snapshot_hash,
    )
    lifecycle = DeveloperLifecycleService()
    lifecycle.start(
        packet, session_id="run-1", baseline_hash=H, context_snapshot_hash=H,
        parent_permission_snapshot=permission, parent_egress_profile=egress,
    )
    lifecycle.wait("run-1")
    current = lifecycle.current("run-1")
    checkpoint = CheckpointHandoff.create(
        checkpoint_id="checkpoint-1", state={"next_action": "repair"},
        session_id="run-1", delegation_id="del-1", packet_hash=packet.packet_hash,
        baseline_hash=H, context_snapshot_hash=H, resume_epoch=0,
        delivered_commands={}, state_version=current.state_version,
    )
    lifecycle.pause("run-1", checkpoint)
    now = datetime.now(timezone.utc)
    leases = LeaseService(
        token_factory=iter(["exec", "write", "exec-2", "write-2"]).__next__,
    )
    worker = leases.issue_worker("run-1", "developer-primary", now, timedelta(minutes=5))
    write = leases.issue_write(worker, "packages/x.py", now, timedelta(minutes=5))
    tools = ToolPermissionRegistry()
    tools.grant("run-1", {"read_file", "list_files"})
    ledger = FailureLedger()
    receipts = [ledger.record(_report(f"r-{i}")) for i in range(1, 4)]
    return lifecycle, leases, tools, ledger, receipts, worker, write


def test_count_below_three_is_noop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    result = service.takeover(receipts[1], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint=FINGERPRINT, execution_fencing_token="exec")
    assert not result.accepted and TakeoverReasonCode.COUNT_BELOW_THREE.value in result.reason_codes
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_third_failure_requires_complete_reference_bundle_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
    )

    assert not result.accepted
    assert TakeoverReasonCode.MISSING_REFERENCE_BUNDLE.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")
    assert service.packets == () and service.audits == ()


def test_incomplete_reference_bundle_fails_closed_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle={"work_instruction": H},
    )

    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE_BUNDLE.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")
    assert service.packets == () and service.audits == ()


def test_reference_bundle_rejects_non_reference_members_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    malformed = TakeoverReferenceBundle(None, None, None, None, (), H)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=malformed,
    )

    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_reference_bundle_rejects_wrong_artifact_kind_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    wrong_kind = _bundle(
        lifecycle, ledger,
        work_instruction=_reference("TEST_OUTPUT", "wi-1", H),
    )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=wrong_kind,
    )

    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE_KIND.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_reference_bundle_rejects_invalid_checksum_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    invalid_checksum = _bundle(
        lifecycle, ledger,
        diff=_reference("DIFF", "diff-1", "sha256:not-a-digest"),
    )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=invalid_checksum,
    )

    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE_CHECKSUM.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_reference_bundle_rejects_reference_binding_hash_mismatch_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    tampered_reference = replace(
        _reference("DIFF", "diff-1", "sha256:" + "b" * 64),
        binding_hash=H,
    )
    tampered = _bundle(lifecycle, ledger, diff=tampered_reference)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=tampered,
    )

    assert not result.accepted
    assert TakeoverReasonCode.REFERENCE_HASH_MISMATCH.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_reference_bundle_rejects_bundle_hash_mismatch_before_stop():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    tampered = replace(_bundle(lifecycle, ledger), bundle_hash=H)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=tampered,
    )

    assert not result.accepted
    assert TakeoverReasonCode.BUNDLE_HASH_MISMATCH.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


@pytest.mark.parametrize(
    ("identity_field", "wrong_value"),
    (("session_id", "run-other"), ("delegation_id", "del-other"), ("lineage", "lineage-other")),
)
def test_reference_bundle_rejects_identity_mismatch_before_stop(identity_field, wrong_value):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    identity = {"session_id": "run-1", "delegation_id": "del-1", "lineage": "lineage-A"}
    identity[identity_field] = wrong_value
    mismatched = _bundle(
        lifecycle, ledger,
        diff=_reference("DIFF", "diff-1", "sha256:" + "b" * 64, **identity),
    )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=mismatched,
        expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert TakeoverReasonCode.REFERENCE_IDENTITY_MISMATCH.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_trusted_registry_is_authoritative_without_caller_expectation():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=_bundle(lifecycle, ledger),
    )

    assert result.accepted
    assert lifecycle.current("run-1").status.name == "STOPPED"
    assert leases.active_writes("run-1") == ()
    assert tools.active("run-1") == {}


@pytest.mark.parametrize(
    ("work_instruction_id", "work_instruction_checksum"),
    (("wi-stale", H), ("wi-1", "sha256:" + "d" * 64)),
)
def test_reference_bundle_rejects_nonlatest_work_instruction_before_stop(
    work_instruction_id, work_instruction_checksum,
):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=_bundle(lifecycle, ledger),
        expected_work_instruction_id=work_instruction_id,
        expected_work_instruction_checksum=work_instruction_checksum,
    )

    assert not result.accepted
    assert TakeoverReasonCode.WORK_INSTRUCTION_MISMATCH.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


@pytest.mark.parametrize("tamper", ("artifact_id", "checksum"))
def test_reference_bundle_rejects_noncurrent_checkpoint_before_stop(tamper):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    current_checkpoint = lifecycle.handoff("run-1")
    assert current_checkpoint is not None
    checkpoint_id = "checkpoint-stale" if tamper == "artifact_id" else current_checkpoint.checkpoint_id
    checkpoint_hash = "sha256:" + "d" * 64 if tamper == "checksum" else current_checkpoint.checkpoint_hash
    bundle = _bundle(
        lifecycle, ledger,
        checkpoint=_reference("CHECKPOINT", checkpoint_id, checkpoint_hash),
    )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert TakeoverReasonCode.CHECKPOINT_MISMATCH.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


@pytest.mark.parametrize("tamper", ("artifact_id", "checksum", "order"))
def test_reference_bundle_rejects_noncanonical_failure_reports_before_stop(tamper):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    reports = list(_bundle(lifecycle, ledger).failure_reports)
    if tamper == "artifact_id":
        reports[0] = _reference("FAILURE_REPORT", "r-other", reports[0].checksum)
    elif tamper == "checksum":
        reports[0] = _reference("FAILURE_REPORT", reports[0].artifact_id, "sha256:" + "d" * 64)
    else:
        reports.reverse()
    bundle = _bundle(lifecycle, ledger, failure_reports=tuple(reports))

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert TakeoverReasonCode.FAILURE_REPORT_REFERENCE_MISMATCH.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_complete_reference_bundle_is_bound_to_packet_audit_and_hash():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert result.accepted and result.packet and result.audit
    packet = result.packet.to_dict()
    assert packet.get("reference_bundle") == bundle.to_dict()
    assert packet.get("reference_bundle_hash") == bundle.bundle_hash
    packet_hash = packet.pop("packet_hash")
    assert packet_hash == _canonical_hash(packet)
    audit = result.audit.to_dict()
    assert audit.get("reference_bundle_hash") == bundle.bundle_hash
    assert audit.get("packet_hash") == packet_hash
    audit_hash = audit.pop("audit_hash")
    assert audit_hash == _canonical_hash(audit)


def test_third_failure_stops_releases_and_builds_packet_in_order():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert result.accepted and result.packet and result.audit
    assert result.packet.trigger_type == "THIRD_VALID_FAILURE"
    assert lifecycle.current("run-1").status.name == "STOPPED"
    assert leases.active_writes("run-1") == ()
    assert tools.active("run-1") == {}
    replay = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert replay.accepted and replay.duplicate and len(service.audits) == 1


def test_replay_with_different_reference_bundle_fails_closed():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    first = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert first.accepted and first.packet
    changed = _bundle(
        lifecycle, ledger,
        diff=_reference("DIFF", "diff-2", "sha256:" + "d" * 64),
    )

    replay = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=changed, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not replay.accepted
    assert TakeoverReasonCode.TRUSTED_EVIDENCE_MISMATCH.value in replay.reason_codes
    assert len(service.packets) == len(service.audits) == 1
    assert service.packets[0].reference_bundle_hash == bundle.bundle_hash
    assert leases.active_writes("run-1") == ()


def test_stale_lineage_and_fencing_fail_closed():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    bad_lineage = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="other",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert not bad_lineage.accepted and TakeoverReasonCode.STALE_LINEAGE.value in bad_lineage.reason_codes
    bad_token = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="old",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert not bad_token.accepted and TakeoverReasonCode.STALE_FENCING_TOKEN.value in bad_token.reason_codes
    assert leases.active_writes("run-1") == (write,)


def test_missing_fencing_token_fails_closed_without_mutation():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    result = service.takeover(receipts[2], session_id="run-1", expected_lineage="lineage-A", expected_fingerprint=FINGERPRINT)
    assert not result.accepted and TakeoverReasonCode.MISSING_FENCING_TOKEN.value in result.reason_codes
    assert leases.active_writes("run-1") == (write,)
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert service.packets == () and service.audits == ()


def test_concurrent_replay_creates_one_packet_and_zero_writes():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    def call(_):
        return service.takeover(
            receipts[2], session_id="run-1", expected_lineage="lineage-A",
            expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
            reference_bundle=bundle, expected_work_instruction_id="wi-1",
            expected_work_instruction_checksum=H,
        )
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(call, range(8)))
    assert sum(item.accepted and not item.duplicate for item in results) == 1
    assert len(service.packets) == len(service.audits) == 1
    assert leases.active_writes("run-1") == ()


def test_caller_cannot_self_sign_stale_diff_and_test_output_as_current():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    stale = _bundle(
        lifecycle, ledger,
        diff=_reference("DIFF", "diff-stale", "sha256:" + "d" * 64),
        test_output=_reference("TEST_OUTPUT", "test-stale", "sha256:" + "e" * 64),
    )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=stale, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert "TRUSTED_EVIDENCE_MISMATCH" in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


def test_none_failure_reports_is_structured_rejection_not_exception():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    valid = _bundle(lifecycle, ledger)
    malformed = TakeoverReferenceBundle(
        valid.work_instruction, valid.diff, valid.test_output, valid.checkpoint,
        None, valid.bundle_hash,
    )
    service = _service(ledger, lifecycle, leases, tools)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=malformed, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE_BUNDLE.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


@pytest.mark.parametrize("reports_type", (list, type("ReportList", (list,), {})))
def test_bundle_rejects_mutable_failure_report_list_input(reports_type):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    valid = _bundle(lifecycle, ledger)
    mutable_reports = reports_type(valid.failure_reports)
    bundle = TakeoverReferenceBundle(
        valid.work_instruction, valid.diff, valid.test_output, valid.checkpoint,
        mutable_reports, valid.bundle_hash,
    )
    service = _service(ledger, lifecycle, leases, tools)
    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE_BUNDLE.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


@pytest.mark.parametrize("artifact_id", ("e\u0301", type("Text", (str,), {})("diff-1")))
def test_reference_identifiers_require_exact_nfc_str(artifact_id):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    malformed = _bundle(
        lifecycle, ledger,
        diff=_reference("DIFF", artifact_id, "sha256:" + "b" * 64),
    )
    service = _service(ledger, lifecycle, leases, tools)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=malformed, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert TakeoverReasonCode.INVALID_REFERENCE.value in result.reason_codes
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1")


class _InjectedLifecycle:
    def __init__(self, actual, mode=None):
        self.actual = actual
        self.mode = mode
        self.calls = 0

    def current(self, session_id):
        return self.actual.current(session_id)

    def handoff(self, session_id):
        return self.actual.handoff(session_id)

    def wait(self, session_id):
        return self.actual.wait(session_id)

    def stop(self, session_id):
        self.calls += 1
        if self.mode == "noop":
            return self.actual.current(session_id)
        result = self.actual.stop(session_id)
        if self.mode == "raise":
            raise RuntimeError("injected lifecycle failure")
        return result

    def takeover_snapshot(self, session_id):
        return self.actual.takeover_snapshot(session_id)

    def restore_takeover(self, snapshot):
        return self.actual.restore_takeover(snapshot)


class _InjectedLeases:
    def __init__(self, actual, mode=None):
        self.actual = actual
        self.mode = mode
        self.calls = 0

    def active_writes(self, run_id):
        return self.actual.active_writes(run_id)

    def active_worker(self, run_id):
        return self.actual.active_worker(run_id)

    def revoke_run(self, run_id, *, execution_token):
        self.calls += 1
        if self.mode == "noop":
            return None, ()
        result = self.actual.revoke_run(run_id, execution_token=execution_token)
        if self.mode == "raise":
            raise RuntimeError("injected lease failure")
        return result

    def takeover_snapshot(self, run_id, *, execution_token):
        return self.actual.takeover_snapshot(run_id, execution_token=execution_token)

    def restore_takeover(self, snapshot):
        return self.actual.restore_takeover(snapshot)


class _InjectedTools:
    def __init__(self, actual, mode=None):
        self.actual = actual
        self.mode = mode
        self.calls = 0

    def active(self, run_id):
        return self.actual.active(run_id)

    def revoke(self, run_id):
        self.calls += 1
        if self.mode == "noop":
            return frozenset()
        result = self.actual.revoke(run_id)
        if self.mode == "raise":
            raise RuntimeError("injected tool failure")
        return result

    def takeover_snapshot(self, run_id):
        return self.actual.takeover_snapshot(run_id)

    def restore_takeover(self, snapshot):
        return self.actual.restore_takeover(snapshot)


@pytest.mark.parametrize("stage", ("lifecycle", "lease", "tool"))
@pytest.mark.parametrize("mode", ("raise", "noop"))
def test_takeover_step_failure_restores_complete_prestate(stage, mode):
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    before_lifecycle = lifecycle.current("run-1").to_dict()
    before_writes = leases.active_writes("run-1")
    before_tools = tools.active("run-1")
    injected_lifecycle = _InjectedLifecycle(
        lifecycle, mode if stage == "lifecycle" else None,
    )
    injected_leases = _InjectedLeases(leases, mode if stage == "lease" else None)
    injected_tools = _InjectedTools(tools, mode if stage == "tool" else None)
    service = _service(
        ledger, injected_lifecycle, injected_leases, injected_tools,
        trusted_bundle=_bundle(lifecycle, ledger),
    )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=_bundle(lifecycle, ledger),
        expected_work_instruction_id="wi-1", expected_work_instruction_checksum=H,
    )

    assert not result.accepted
    assert "TAKEOVER_TRANSACTION_FAILED" in result.reason_codes
    assert {"lifecycle": injected_lifecycle, "lease": injected_leases,
            "tool": injected_tools}[stage].calls == 1
    assert lifecycle.current("run-1").to_dict() == before_lifecycle
    assert leases.active_writes("run-1") == before_writes == (write,)
    assert tools.active("run-1") == before_tools
    assert service.packets == () and service.audits == ()


def test_terminal_takeover_blocks_resurrected_write_and_tool_capabilities():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    first = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )
    assert first.accepted and first.packet
    now = datetime.now(timezone.utc)
    with pytest.raises(LeaseError, match="completed takeover"):
        leases.issue_worker("run-1", "replacement", now, timedelta(minutes=5))
    with pytest.raises(ToolGatewayRejected, match="TAKEOVER_TERMINAL"):
        tools.grant("run-1", {"read_file"})

    replay = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle, expected_work_instruction_id="wi-1",
        expected_work_instruction_checksum=H,
    )

    assert replay.accepted and replay.duplicate
    assert leases.active_writes("run-1") == ()
    assert tools.active("run-1") == {}
    assert len(service.packets) == len(service.audits) == 1


def test_registry_overwrite_after_service_creation_cannot_authorize_forged_bundle():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    trusted = _bundle(lifecycle, ledger)
    authority = orchestration.TakeoverEvidenceAuthority()
    registry = orchestration.TakeoverEvidenceRegistry(authority)
    registry.publish(
        work_instruction=trusted.work_instruction, diff=trusted.diff,
        test_output=trusted.test_output, checkpoint=trusted.checkpoint,
        authority=authority, sequence=1,
    )
    registry.seal(authority=authority)
    service = MainAgentTakeoverService(
        ledger, lifecycle, leases, tools, evidence_registry=registry,
    )
    forged = _bundle(
        lifecycle, ledger,
        work_instruction=_reference("WORK_INSTRUCTION", "wi-forged", H),
        diff=_reference("DIFF", "diff-forged", "sha256:" + "d" * 64),
        test_output=_reference("TEST_OUTPUT", "test-forged", "sha256:" + "e" * 64),
    )
    with pytest.raises(ValueError, match="sealed"):
        registry.publish(
            work_instruction=forged.work_instruction, diff=forged.diff,
            test_output=forged.test_output, checkpoint=forged.checkpoint,
            authority=authority, sequence=2,
        )

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=forged,
    )

    assert not result.accepted
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)


def test_registry_requires_bound_authority_monotonic_sequence_and_seal():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    trusted = _bundle(lifecycle, ledger)
    authority = orchestration.TakeoverEvidenceAuthority()
    wrong_authority = orchestration.TakeoverEvidenceAuthority()
    registry = orchestration.TakeoverEvidenceRegistry(authority)
    arguments = {
        "work_instruction": trusted.work_instruction,
        "diff": trusted.diff,
        "test_output": trusted.test_output,
        "checkpoint": trusted.checkpoint,
    }

    with pytest.raises(ValueError, match="authority"):
        registry.publish(**arguments, authority=wrong_authority, sequence=1)
    registry.publish(**arguments, authority=authority, sequence=1)
    with pytest.raises(ValueError, match="exactly one"):
        registry.publish(**arguments, authority=authority, sequence=1)
    with pytest.raises(ValueError, match="exactly one"):
        registry.publish(**arguments, authority=authority, sequence=3)

    snapshot = registry.seal(authority=authority)
    assert snapshot.sequence == 1
    assert snapshot.current("run-1").expectation_hash
    with pytest.raises(ValueError, match="sealed"):
        registry.publish(**arguments, authority=authority, sequence=2)


def test_terminal_takeover_blocks_resurrected_worker_without_write_or_tool():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    first = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle,
    )
    assert first.accepted
    with pytest.raises(LeaseError, match="completed takeover"):
        leases.issue_worker(
            "run-1", "replacement", datetime.now(timezone.utc),
            timedelta(minutes=5),
        )

    replay = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle,
    )

    assert replay.accepted and replay.duplicate
    assert leases.active_worker("run-1") is None
    assert len(service.packets) == len(service.audits) == 1


class _RegrantingToolRegistry(ToolPermissionRegistry):
    def __init__(self, leases):
        super().__init__()
        self._lease_service = leases

    def revoke(self, run_id):
        prior = super().revoke(run_id)
        worker = self._lease_service.issue_worker(
            run_id, "replacement", datetime.now(timezone.utc),
            timedelta(minutes=5),
        )
        self._lease_service.issue_write(
            worker, "packages/y.py", datetime.now(timezone.utc),
            timedelta(minutes=5),
        )
        return prior


def test_cross_service_regrant_during_tool_revoke_rolls_back_all_prestate():
    lifecycle, leases, _, ledger, receipts, worker, write = _ready()
    tools = _RegrantingToolRegistry(leases)
    tools.grant("run-1", {"read_file", "list_files"})
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    before_lifecycle = lifecycle.current("run-1").to_dict()
    before_tools = tools.active("run-1")

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle,
    )

    assert not result.accepted
    assert TakeoverReasonCode.TAKEOVER_TRANSACTION_FAILED.value in result.reason_codes
    assert lifecycle.current("run-1").to_dict() == before_lifecycle
    assert leases.active_worker("run-1") == worker
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1") == before_tools
    assert service.packets == () and service.audits == ()


class _RegrantableLeaseFake:
    def __init__(self, worker, write):
        self.worker = worker
        self.writes = (write,)

    def active_worker(self, run_id):
        return self.worker

    def active_writes(self, run_id):
        return self.writes

    def takeover_snapshot(self, run_id, *, execution_token):
        return self.worker, self.writes

    def revoke_run(self, run_id, *, execution_token):
        self.worker, self.writes = None, ()

    def restore_takeover(self, snapshot):
        self.worker, self.writes = snapshot

    def regrant(self):
        self.worker = replace(
            self._original_worker, worker_id="replacement", lease_epoch=2,
            execution_fencing_token="exec-2",
        )
        self.writes = (replace(
            self._original_write, conflict_scope_key="packages/y.py",
            write_epoch=2, write_fencing_token="write-2",
            execution_fencing_token="exec-2",
        ),)

    def preserve_originals(self):
        self._original_worker = self.worker
        self._original_write = self.writes[0]


class _CallbackToolRegistry(ToolPermissionRegistry):
    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def revoke(self, run_id):
        prior = super().revoke(run_id)
        self._callback()
        return prior


def test_final_postcondition_catches_fake_cross_service_regrant_and_rolls_back():
    lifecycle, _, _, ledger, receipts, worker, write = _ready()
    leases = _RegrantableLeaseFake(worker, write)
    leases.preserve_originals()
    tools = _CallbackToolRegistry(leases.regrant)
    tools.grant("run-1", {"read_file", "list_files"})
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    before_lifecycle = lifecycle.current("run-1").to_dict()
    before_tools = tools.active("run-1")

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle,
    )

    assert not result.accepted
    assert TakeoverReasonCode.TAKEOVER_TRANSACTION_FAILED.value in result.reason_codes
    assert lifecycle.current("run-1").to_dict() == before_lifecycle
    assert leases.active_worker("run-1") == worker
    assert leases.active_writes("run-1") == (write,)
    assert tools.active("run-1") == before_tools
    assert service.packets == () and service.audits == ()


def test_direct_self_signed_snapshot_cannot_admit_forged_evidence():
    lifecycle, leases, tools, ledger, receipts, worker, write = _ready()
    forged = _bundle(
        lifecycle, ledger,
        work_instruction=_reference("WORK_INSTRUCTION", "wi-forged", H),
        diff=_reference("DIFF", "diff-forged", "sha256:" + "d" * 64),
        test_output=_reference("TEST_OUTPUT", "test-forged", "sha256:" + "e" * 64),
    )
    expectation_payload = {
        "work_instruction": forged.work_instruction.to_dict(),
        "diff": forged.diff.to_dict(),
        "test_output": forged.test_output.to_dict(),
        "checkpoint": forged.checkpoint.to_dict(),
        "sequence": 1,
    }
    expectation = orchestration.TakeoverEvidenceExpectation(
        forged.work_instruction, forged.diff, forged.test_output,
        forged.checkpoint, 1, _canonical_hash(expectation_payload),
    )
    snapshot_payload = {
        "expectations": [{
            "session_id": "run-1", **expectation.binding_payload(),
            "expectation_hash": expectation.expectation_hash,
        }],
        "sequence": 1,
    }
    snapshot = orchestration.SealedTakeoverEvidence(
        (("run-1", expectation),), 1, _canonical_hash(snapshot_payload),
    )
    with pytest.raises(ValueError, match="direct"):
        MainAgentTakeoverService(
            ledger, lifecycle, leases, tools, evidence_snapshot=snapshot,
        )
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_writes("run-1") == (write,)


class _LateGrantAfterEmptyCheck(ToolPermissionRegistry):
    def __init__(self):
        super().__init__()
        self._armed = False
        self._injected = False

    def revoke(self, run_id):
        prior = super().revoke(run_id)
        self._armed = True
        return prior

    def active(self, run_id=None):
        result = super().active(run_id)
        if self._armed and not self._injected and not result:
            self._injected = True
            super().grant(run_id, {"late"})
        return result


def test_deterministic_late_grant_after_empty_check_cannot_escape_commit():
    lifecycle, leases, _, ledger, receipts, worker, write = _ready()
    tools = _LateGrantAfterEmptyCheck()
    tools.grant("run-1", {"read_file"})
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)

    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle,
    )

    assert not result.accepted
    assert lifecycle.current("run-1").status.name == "PAUSED"
    assert leases.active_worker("run-1") == worker
    assert leases.active_writes("run-1") == (write,)
    assert service.packets == () and service.audits == ()


class _ConcurrentLateGrantRegistry(ToolPermissionRegistry):
    def __init__(self, revoked: Event, attempted: Event):
        super().__init__()
        self._revoked = revoked
        self._attempted = attempted

    def revoke(self, run_id):
        prior = super().revoke(run_id)
        self._revoked.set()
        self._attempted.wait(timeout=0.5)
        return prior


def test_concurrent_late_grant_is_serialized_and_rejected_after_terminal_commit():
    lifecycle, leases, _, ledger, receipts, worker, write = _ready()
    revoked, attempted = Event(), Event()
    tools = _ConcurrentLateGrantRegistry(revoked, attempted)
    tools.grant("run-1", {"read_file"})
    service = _service(ledger, lifecycle, leases, tools)
    bundle = _bundle(lifecycle, ledger)
    outcome = {}

    def late_grant():
        revoked.wait(timeout=1)
        try:
            tools.grant("run-1", {"late"})
            outcome["granted"] = True
        except Exception as exc:
            outcome["error"] = exc
        finally:
            attempted.set()

    thread = Thread(target=late_grant)
    thread.start()
    result = service.takeover(
        receipts[2], session_id="run-1", expected_lineage="lineage-A",
        expected_fingerprint=FINGERPRINT, execution_fencing_token="exec",
        reference_bundle=bundle,
    )
    thread.join(timeout=2)

    assert result.accepted
    assert not thread.is_alive()
    assert "granted" not in outcome
    assert "error" in outcome
    assert tools.active("run-1") == {}
    assert leases.active_worker("run-1") is None
    assert leases.active_writes("run-1") == ()
    assert len(service.packets) == len(service.audits) == 1
