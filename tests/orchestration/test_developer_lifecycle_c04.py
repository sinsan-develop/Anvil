import pytest

from packages.orchestration import (
    CheckpointHandoff,
    DeveloperLifecycleService,
    LifecycleStatus,
    ResumeRejected,
)
from tests.orchestration.test_delegation_packet import packet


HASH = "sha256:" + "a" * 64
OTHER = "sha256:" + "b" * 64


def started(service: DeveloperLifecycleService, session_id: str = "c04"):
    service.start(packet(), session_id=session_id, baseline_hash=HASH,
                  permission_snapshot_hash=HASH, context_snapshot_hash=HASH,
                  egress_snapshot_hash=HASH)
    return service.wait(session_id)


def test_steer_records_instruction_without_changing_identity():
    service = DeveloperLifecycleService()
    session = started(service)
    steered = service.steer("c04", "continue with the next approved step")
    assert steered.status is LifecycleStatus.RUNNING
    assert steered.session_id == session.session_id
    assert steered.delegation_id == session.delegation_id
    assert steered.packet_hash == session.packet_hash
    assert steered.next_instruction == "continue with the next approved step"


def test_pause_resume_restores_checkpoint_and_rejects_different_packet_hash():
    service = DeveloperLifecycleService()
    started(service)
    checkpoint = CheckpointHandoff("checkpoint-1", "sha256:" + "c" * 64, {"cursor": 4})
    paused = service.pause("c04", checkpoint)
    assert paused.status is LifecycleStatus.PAUSED
    assert service.handoff("c04") == checkpoint
    with pytest.raises(ResumeRejected, match="packet hash"):
        service.resume("c04", OTHER)
    resumed = service.resume("c04", packet().packet_hash)
    assert resumed.status is LifecycleStatus.RUNNING
    assert resumed.session_id == "c04"
    assert resumed.packet_hash == packet().packet_hash


def test_pause_and_resume_are_idempotent_for_same_command():
    service = DeveloperLifecycleService()
    started(service)
    checkpoint = CheckpointHandoff("checkpoint-1", "sha256:" + "c" * 64, {"cursor": 4})
    paused = service.pause("c04", checkpoint)
    assert service.pause("c04", checkpoint) == paused
    resumed = service.resume("c04", packet().packet_hash)
    assert service.resume("c04", packet().packet_hash) == resumed


def test_terminal_commands_are_idempotent_or_rejected_explicitly():
    service = DeveloperLifecycleService()
    started(service)
    service.wait("c04")
    done = service.wait("c04")
    with pytest.raises(ResumeRejected, match="terminal"):
        service.resume("c04", packet().packet_hash)
    assert service.current("c04").status is LifecycleStatus.COMPLETED
    with pytest.raises(ResumeRejected, match="terminal"):
        service.pause("c04", CheckpointHandoff("checkpoint-2", "sha256:" + "d" * 64, {}))


def test_handoff_projection_is_immutable_and_current_is_json_safe():
    service = DeveloperLifecycleService()
    started(service)
    checkpoint = CheckpointHandoff("checkpoint-1", "sha256:" + "c" * 64, {"nested": {"ok": True}})
    service.pause("c04", checkpoint)
    projection = service.current("c04")
    assert projection.to_dict()["checkpoint"]["checkpoint_id"] == "checkpoint-1"
    with pytest.raises(TypeError):
        checkpoint.state["nested"] = {}
