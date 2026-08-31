from dataclasses import replace

import pytest

from packages.orchestration import (
    DeveloperLifecycleService, DeterministicFakeDeveloperRunner,
    LifecycleStatus, PacketRejected, RawResultEnvelope, ReadOnlyPolicyRejected,
)
from tests.orchestration.test_delegation_packet import packet


HASH = "sha256:" + "a" * 64
DIFFERENT = "sha256:" + "b" * 64


def service() -> DeveloperLifecycleService:
    return DeveloperLifecycleService(DeterministicFakeDeveloperRunner())


def start(svc: DeveloperLifecycleService, session_id: str = "session-1"):
    return svc.start(packet(), session_id=session_id, baseline_hash=HASH, permission_snapshot_hash=HASH, context_snapshot_hash=HASH, egress_snapshot_hash=HASH)


def test_packet_is_required_and_snapshot_mismatch_is_rejected():
    svc = service()
    with pytest.raises(PacketRejected) as error:
        svc.start(None, session_id="s", baseline_hash=HASH, permission_snapshot_hash=HASH, context_snapshot_hash=HASH, egress_snapshot_hash=HASH)
    assert error.value.validation.reason_codes == ("PACKET_REQUIRED",)
    with pytest.raises(PacketRejected) as error:
        svc.start(replace(packet(), baseline_hash=DIFFERENT), session_id="s2", baseline_hash=HASH, permission_snapshot_hash=HASH, context_snapshot_hash=HASH, egress_snapshot_hash=HASH)
    assert error.value.validation.reason_codes == ("BASELINE_SNAPSHOT_MISMATCH",)


def test_start_wait_completion_is_monotonic_and_idempotent():
    svc = service()
    first = start(svc)
    assert first.status is LifecycleStatus.PENDING
    assert svc.start(packet(), session_id="session-1", baseline_hash=HASH, permission_snapshot_hash=HASH, context_snapshot_hash=HASH, egress_snapshot_hash=HASH) == first
    assert svc.wait("session-1").status is LifecycleStatus.RUNNING
    done = svc.wait("session-1")
    assert done.status is LifecycleStatus.COMPLETED
    assert done.raw_result is not None
    assert done.raw_result.to_dict()["payload"]["runner"] == "deterministic-fake"
    assert svc.wait("session-1") == done


def test_stop_is_idempotent_and_requires_wait_to_receive_raw_result():
    svc = service()
    start(svc, "stop-1")
    assert svc.stop("stop-1").status is LifecycleStatus.STOP_REQUESTED
    assert svc.stop("stop-1").status is LifecycleStatus.STOP_REQUESTED
    stopped = svc.wait("stop-1")
    assert stopped.status is LifecycleStatus.STOPPED
    assert stopped.raw_result is not None
    assert svc.wait("stop-1") == stopped


def test_raw_result_payload_is_opaque_and_cannot_be_mutated():
    svc = service()
    start(svc, "raw-1")
    done = svc.wait("raw-1")
    done = svc.wait("raw-1")
    assert done.raw_result is not None
    with pytest.raises(TypeError):
        done.raw_result.payload["runner"] = "changed"
    assert done.raw_result.to_dict()["payload"]["runner"] == "deterministic-fake"


def test_raw_result_to_dict_thaws_nested_payload():
    result = RawResultEnvelope(
        "nested-1", LifecycleStatus.COMPLETED,
        {"nested": {"items": [{"ok": True}, {"values": ("a", "b")}]}},
    )
    assert result.to_dict() == {
        "session_id": "nested-1",
        "status": "COMPLETED",
        "payload": {"nested": {"items": [{"ok": True}, {"values": ["a", "b"]}]}},
    }


def test_read_only_policy_rejects_write_secret_and_out_of_scope_path():
    svc = service()
    start(svc, "policy-1")
    with pytest.raises(ReadOnlyPolicyRejected):
        svc.authorize("policy-1", "write", path="packages/orchestration/new.py")
    with pytest.raises(ReadOnlyPolicyRejected):
        svc.authorize("policy-1", "secret_read")
    with pytest.raises(ReadOnlyPolicyRejected):
        svc.authorize("policy-1", "read", path="private/data.txt")
    svc.authorize("policy-1", "read", path="packages/orchestration/delegation.py")


def test_terminal_stop_and_unknown_wait_are_safe():
    svc = service()
    start(svc, "terminal-1")
    svc.stop("terminal-1")
    assert svc.wait("terminal-1").status is LifecycleStatus.STOPPED
    assert svc.stop("terminal-1").status is LifecycleStatus.STOPPED
    with pytest.raises(KeyError):
        svc.wait("missing")
