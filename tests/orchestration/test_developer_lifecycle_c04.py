from __future__ import annotations

from dataclasses import replace
import hashlib
import json
import threading

import pytest

from packages.orchestration import (
    CheckpointHandoff,
    DeveloperLifecycleService,
    InvalidLifecycleTransition,
    LifecycleStatus,
    PacketRejected,
    RawResultEnvelope,
    ResumeRejected,
)
from tests.orchestration.test_delegation_packet import (
    packet,
    packet_parent_egress,
    packet_parent_permission,
)


HASH = "sha256:" + "a" * 64
OTHER = "sha256:" + "b" * 64


@pytest.mark.parametrize("field,value", [
    ("baseline_hash", OTHER), ("context_snapshot_hash", OTHER),
    ("resume_epoch", 1), ("session_id", "other-session"),
    ("delegation_id", "other-delegation"), ("packet_hash", OTHER),
])
def test_r6_resume_revalidates_checkpoint_against_current_authority(field, value):
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    values = dict(
        checkpoint_id="r6-checkpoint", state={"cursor": 1}, session_id="c04",
        delegation_id=packet().delegation_id, packet_hash=packet().packet_hash,
        baseline_hash=HASH, context_snapshot_hash=HASH, resume_epoch=0,
        delivered_commands={},
    )
    checkpoint = CheckpointHandoff.create(**values)
    service.pause("c04", checkpoint)
    values[field] = value
    # Model a persisted checkpoint replaced independently of the live authority.
    service._sessions["c04"] = replace(
        service.session("c04"), checkpoint=CheckpointHandoff.create(**values),
    )
    before = service.current("c04")
    with pytest.raises(ResumeRejected):
        service.resume(
            "c04", packet().packet_hash, expected_resume_epoch=0,
            idempotency_key="r6-resume", reason="owner resume",
            target_hash=packet().packet_hash,
            expected_state_version=before.state_version,
        )
    assert service.current("c04") == before
    assert runner.resume_calls == []


def _r6_checkpoint(session_id="c04"):
    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source, session_id)
    return source.request_checkpoint(session_id, idempotency_key="r6-source")


@pytest.mark.parametrize("field", ["baseline_hash", "context_snapshot_hash", "resume_epoch"])
def test_r6_public_pause_cannot_supply_drifted_checkpoint_for_resume(field):
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    values = dict(
        checkpoint_id="r6-public-pause", state={"cursor": 1}, session_id="c04",
        delegation_id=packet().delegation_id, packet_hash=packet().packet_hash,
        baseline_hash=HASH, context_snapshot_hash=HASH, resume_epoch=0,
        delivered_commands={},
    )
    values[field] = 1 if field == "resume_epoch" else OTHER
    service.pause("c04", CheckpointHandoff.create(**values))
    with pytest.raises(ResumeRejected):
        service.resume(
            "c04", packet().packet_hash, expected_resume_epoch=0,
            idempotency_key="r6-public-resume", reason="owner resume",
            target_hash=packet().packet_hash,
            expected_state_version=service.current("c04").state_version,
        )
    assert runner.resume_calls == []


def test_r6_successful_restore_reconciliation_releases_admission_after_tracking():
    checkpoint = _r6_checkpoint()

    class LostReceipt(CapabilityRunner):
        def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
            super().restore(session_id, delegation_packet, checkpoint, idempotency_key)
            raise TimeoutError("restore acknowledgement lost")

    runner = LostReceipt()
    service = DeveloperLifecycleService(runner)
    with pytest.raises(TimeoutError):
        _r6_restore(service, checkpoint, "r6-owner")
    kwargs = dict(
        expected_session_id="c04", checkpoint_hash=checkpoint.checkpoint_hash,
        idempotency_key="r6-owner", outcome="RESOLVED_SUCCESS",
    )
    with pytest.raises(InvalidLifecycleTransition):
        service.reconcile_restore_outcome(**kwargs, receipt={})
    with pytest.raises(InvalidLifecycleTransition):
        _start(service, "receipt-missing")
    restored = service.reconcile_restore_outcome(**kwargs, receipt={
        "operation": "RESTORE", "outcome": "DELIVERED", "session_id": "c04",
        "checkpoint_hash": checkpoint.checkpoint_hash, "idempotency_key": "r6-owner",
    })
    assert restored.status is LifecycleStatus.PAUSED
    assert len(service.sessions) == 1
    assert len(runner.restore_calls) == 1
    with pytest.raises(InvalidLifecycleTransition):
        _start(service, "while-restored-active")
    service.stop("c04", idempotency_key="r6-stop", reason="owner stop")
    runner.results.append(RawResultEnvelope("c04", LifecycleStatus.STOPPED, {}))
    assert service.wait("c04").status is LifecycleStatus.STOPPED
    started = service.start(
        replace(packet(), delegation_id="del-next"), session_id="after-restored-terminal",
        baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert started.status is LifecycleStatus.PENDING
    assert runner.started == ["after-restored-terminal"]


def test_r6_rejected_restore_before_delivery_does_not_hold_admission():
    checkpoint = _r6_checkpoint()
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    with pytest.raises(ResumeRejected):
        service.restore(
            packet(), checkpoint, expected_session_id="c04", idempotency_key="r6-invalid",
            baseline_hash=OTHER, context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )
    assert runner.restore_calls == []
    assert _start(service, "after-rejected-restore").status is LifecycleStatus.RUNNING


def _r6_restore(service, checkpoint, key):
    return service.restore(
        packet(), checkpoint, expected_session_id=checkpoint.session_id,
        idempotency_key=key, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )


@pytest.mark.parametrize("contender", ["start", "other-session", "other-checkpoint"])
def test_r6_restore_reserves_global_admission_before_delivery(contender):
    checkpoint = _r6_checkpoint()
    other = _r6_checkpoint("other-session") if contender == "other-session" else CheckpointHandoff.create(
        checkpoint_id="other-checkpoint", state={"cursor": 99}, session_id="c04",
        delegation_id=packet().delegation_id, packet_hash=packet().packet_hash,
        baseline_hash=HASH, context_snapshot_hash=HASH, resume_epoch=0,
        delivered_commands={},
    )

    class BlockingRestore(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
            super().restore(session_id, delegation_packet, checkpoint, idempotency_key)
            if idempotency_key == "r6-owner":
                self.entered.set()
                assert self.release.wait(5)

    runner = BlockingRestore()
    service = DeveloperLifecycleService(runner)
    errors = []
    owner = threading.Thread(target=lambda: _capture(
        errors, _r6_restore, service, checkpoint, "r6-owner",
    ))
    owner.start()
    try:
        assert runner.entered.wait(2)
        with pytest.raises(InvalidLifecycleTransition):
            if contender == "start":
                _start(service, "contender")
            else:
                _r6_restore(service, other, "r6-contender")
    finally:
        runner.release.set()
        owner.join(2)
    assert not owner.is_alive()
    assert errors == []
    assert runner.started == []
    assert len(runner.restore_calls) == 1
    assert runner.attached == {"c04"}
    assert [session.session_id for session in service.sessions] == ["c04"]


@pytest.mark.parametrize("contender", ["start", "other-session", "other-checkpoint"])
def test_r6_ambiguous_restore_blocks_global_admission_until_safe_retry(contender):
    checkpoint = _r6_checkpoint()
    other = _r6_checkpoint("other-session") if contender == "other-session" else CheckpointHandoff.create(
        checkpoint_id="other-checkpoint", state={"cursor": 99}, session_id="c04",
        delegation_id=packet().delegation_id, packet_hash=packet().packet_hash,
        baseline_hash=HASH, context_snapshot_hash=HASH, resume_epoch=0,
        delivered_commands={},
    )

    class AmbiguousRestore(CapabilityRunner):
        def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
            self.restore_calls.append((session_id, checkpoint.checkpoint_hash, idempotency_key))
            raise TimeoutError("restore acknowledgement lost")

    runner = AmbiguousRestore()
    service = DeveloperLifecycleService(runner)
    with pytest.raises(TimeoutError):
        _r6_restore(service, checkpoint, "r6-owner")
    with pytest.raises(InvalidLifecycleTransition):
        if contender == "start":
            _start(service, "contender")
        else:
            _r6_restore(service, other, "r6-contender")
    assert len(runner.restore_calls) == 1
    assert runner.started == []
    assert service.sessions == ()
    service.reconcile_restore_outcome(
        expected_session_id="c04", checkpoint_hash=checkpoint.checkpoint_hash,
        idempotency_key="r6-owner", outcome="SAFE_RETRY",
    )
    assert _start(service, "after-safe-retry").status is LifecycleStatus.RUNNING
    assert runner.started == ["after-safe-retry"]


def test_r6_start_reservation_rejects_restore_before_runner_attachment():
    checkpoint = _r6_checkpoint()

    class BlockingStart(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def start(self, session_id, delegation_packet):
            super().start(session_id, delegation_packet)
            self.entered.set()
            assert self.release.wait(5)

    runner = BlockingStart()
    service = DeveloperLifecycleService(runner)
    errors = []
    owner = threading.Thread(target=lambda: _capture(errors, _start, service, "start-owner"))
    owner.start()
    try:
        assert runner.entered.wait(2)
        with pytest.raises(InvalidLifecycleTransition):
            _r6_restore(service, checkpoint, "r6-restore")
    finally:
        runner.release.set()
        owner.join(2)
    assert not owner.is_alive()
    assert errors == []
    assert runner.restore_calls == []
    assert runner.attached == {"start-owner"}


class CapabilityRunner:
    def __init__(self) -> None:
        self.started: list[str] = []
        self.results: list[object] = []
        self.steer_calls: list[tuple[str, str, str]] = []
        self.checkpoint_calls: list[tuple[str, str]] = []
        self.resume_calls: list[tuple[str, str, str]] = []
        self.stop_calls: list[tuple[str, str, str | None]] = []
        self.restore_calls: list[tuple[str, str, str]] = []
        self.attached: set[str] = set()
        self.checkpoint_state: dict[str, object] = {
            "cursor": 3,
            "labels": {"z", "a"},
            "nested": {"ok": True},
        }

    def start(self, session_id, delegation_packet):
        self.started.append(session_id)
        self.attached.add(session_id)

    def poll(self, session_id):
        return self.results.pop(0) if self.results else None

    def steer(self, session_id, instruction, idempotency_key):
        self.steer_calls.append((session_id, instruction, idempotency_key))

    def request_checkpoint(self, session_id, idempotency_key):
        self.checkpoint_calls.append((session_id, idempotency_key))
        return self.checkpoint_state

    def resume(self, session_id, checkpoint, idempotency_key):
        if session_id not in self.attached:
            raise RuntimeError("runner session is not attached")
        self.resume_calls.append((session_id, checkpoint.checkpoint_hash, idempotency_key))

    def stop(self, session_id, idempotency_key, reason=None):
        self.stop_calls.append((session_id, idempotency_key, reason))

    def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
        self.attached.add(session_id)
        self.restore_calls.append((session_id, checkpoint.checkpoint_hash, idempotency_key))


def _start(service: DeveloperLifecycleService, session_id: str = "c04"):
    service.start(
        packet(),
        session_id=session_id,
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    return service.wait(session_id)


def _restore(service: DeveloperLifecycleService, checkpoint):
    return service.restore(
        packet(),
        checkpoint,
        expected_session_id="c04",
        idempotency_key=f"restore-{checkpoint.resume_epoch}",
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )


def test_runner_commands_are_delivered_once_per_idempotency_key():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)

    first_steer = service.steer("c04", "inspect the failing test", idempotency_key="steer-1")
    assert service.steer("c04", "inspect the failing test", idempotency_key="steer-1") == first_steer
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        service.steer("c04", "change scope", idempotency_key="steer-1")

    checkpoint = service.request_checkpoint("c04", idempotency_key="pause-1")
    assert service.request_checkpoint("c04", idempotency_key="pause-1") == checkpoint
    resumed = service.resume(
        "c04", packet().packet_hash, expected_resume_epoch=0, idempotency_key="resume-1"
    )
    assert service.resume(
        "c04", packet().packet_hash, expected_resume_epoch=0, idempotency_key="resume-1"
    ) == resumed
    stopped = service.stop("c04", idempotency_key="stop-1", reason="owner stop")
    assert service.stop("c04", idempotency_key="stop-1", reason="owner stop") == stopped

    assert runner.steer_calls == [("c04", "inspect the failing test", "steer-1")]
    assert runner.checkpoint_calls == [("c04", "pause-1")]
    assert runner.resume_calls == [("c04", checkpoint.checkpoint_hash, "resume-1")]
    assert runner.stop_calls == [("c04", "stop-1", "owner stop")]


def test_checkpoint_has_canonical_bound_content_and_is_detached_from_runner_state():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)

    checkpoint = service.request_checkpoint("c04", idempotency_key="pause-bound")
    payload = json.loads(checkpoint.content)

    assert payload == {
        "baseline_hash": HASH,
        "context_snapshot_hash": HASH,
        "delegation_id": packet().delegation_id,
        "delivered_commands": {"pause-bound": checkpoint.delivered_commands["pause-bound"]},
        "packet_hash": packet().packet_hash,
        "resume_epoch": 0,
        "state_version": 4,
        "session_id": "c04",
        "state": {"cursor": 3, "labels": ["a", "z"], "nested": {"ok": True}},
    }
    assert checkpoint.checkpoint_hash == "sha256:" + hashlib.sha256(checkpoint.content).hexdigest()
    assert checkpoint.verify()
    runner.checkpoint_state["cursor"] = 99
    assert checkpoint.to_dict()["state"]["cursor"] == 3
    json.dumps(checkpoint.to_dict(), sort_keys=True, allow_nan=False)

    for index, key in enumerate(("authorization", "private_key", "access_key")):
        leaking_runner = CapabilityRunner()
        leaking_runner.checkpoint_state = {key: "TOP_SECRET_VALUE"}
        leaking = DeveloperLifecycleService(leaking_runner)
        session_id = f"leaking-{index}"
        _start(leaking, session_id)
        with pytest.raises(ValueError, match="secret-shaped checkpoint key"):
            leaking.request_checkpoint(session_id, idempotency_key=f"private-checkpoint-{index}")


def test_checkpoint_restore_survives_three_fresh_service_instances_and_rejects_drift():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    checkpoint = service.request_checkpoint("c04", idempotency_key="pause-0")

    for cycle in range(1, 4):
        fresh_runner = CapabilityRunner()
        fresh = DeveloperLifecycleService(fresh_runner)
        restored = _restore(fresh, checkpoint)
        assert restored.status is LifecycleStatus.PAUSED
        assert restored.state_version == checkpoint.state_version
        resumed = fresh.resume(
            "c04",
            packet().packet_hash,
            expected_resume_epoch=cycle - 1,
            idempotency_key=f"resume-{cycle}",
        )
        assert resumed.resume_epoch == cycle
        checkpoint = fresh.request_checkpoint("c04", idempotency_key=f"pause-{cycle}")

    for changed_packet, baseline, context, message in (
        (replace(packet(), objective="different"), HASH, HASH, "identity"),
        (packet(), OTHER, HASH, "baseline"),
        (packet(), HASH, OTHER, "context"),
    ):
        with pytest.raises(ResumeRejected, match=message):
            DeveloperLifecycleService(CapabilityRunner()).restore(
                changed_packet,
                checkpoint,
                expected_session_id="c04",
                idempotency_key="restore-drift",
                baseline_hash=baseline,
                context_snapshot_hash=context,
                parent_permission_snapshot=packet_parent_permission(),
                parent_egress_profile=packet_parent_egress(),
            )

    restored = DeveloperLifecycleService(CapabilityRunner())
    _restore(restored, checkpoint)
    with pytest.raises(ResumeRejected, match="stale"):
        restored.resume(
            "c04", packet().packet_hash, expected_resume_epoch=2, idempotency_key="stale-resume"
        )
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        restored.resume(
            "c04", packet().packet_hash, expected_resume_epoch=3, idempotency_key="pause-0"
        )


def test_concurrent_terminal_observation_preserves_human_pause_and_raw_result():
    from packages.orchestration import RawResultEnvelope

    class BlockingTerminalRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.poll_count = 0
            self.entered = threading.Event()
            self.release = threading.Event()

        def poll(self, session_id):
            self.poll_count += 1
            if self.poll_count == 1:
                return None
            self.entered.set()
            assert self.release.wait(2)
            return RawResultEnvelope(session_id, LifecycleStatus.COMPLETED, {"answer": 42})

    runner = BlockingTerminalRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    errors: list[Exception] = []

    def wait_for_terminal():
        try:
            service.wait("c04")
        except Exception as error:  # pragma: no cover - asserted below
            errors.append(error)

    thread = threading.Thread(target=wait_for_terminal)
    thread.start()
    assert runner.entered.wait(2)
    checkpoint = service.request_checkpoint("c04", idempotency_key="human-pause")
    runner.release.set()
    thread.join(2)

    assert not thread.is_alive()
    assert errors == []
    current = service.session("c04")
    assert current.status is LifecycleStatus.PAUSED
    assert current.checkpoint == checkpoint
    assert current.raw_result is not None
    assert current.raw_result.status is LifecycleStatus.COMPLETED
    assert current.raw_result.to_dict()["payload"] == {"answer": 42}


def test_paused_session_can_be_stopped_and_handoff_keeps_canonical_result_reference():
    from packages.orchestration import RawResultEnvelope

    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    service.request_checkpoint("c04", idempotency_key="pause-before-stop")
    stopped = service.stop("c04", idempotency_key="stop-paused", reason="owner stop")
    assert stopped.status is LifecycleStatus.STOP_REQUESTED

    result_marker = "OPAQUE_RESULT_PAYLOAD_7c6d19"
    runner.results.append(
        RawResultEnvelope("c04", LifecycleStatus.STOPPED, {"summary": result_marker})
    )
    terminal = service.wait("c04")
    handoff = service.handoff_projection("c04").to_dict()
    assert terminal.status is LifecycleStatus.STOPPED
    assert handoff["raw_result"] == {
        "session_id": "c04",
        "status": "STOPPED",
        "artifact": {
            "sha256": terminal.raw_result.artifact.sha256,
            "media_type": "application/json",
            "size": len(terminal.raw_result.artifact.content),
        },
    }
    assert handoff["checkpoint"]["checkpoint_hash"] == terminal.checkpoint.checkpoint_hash
    assert result_marker not in json.dumps(handoff, sort_keys=True)
    json.dumps(handoff, sort_keys=True, allow_nan=False)


def test_workbench_projection_is_complete_deterministic_immutable_and_secret_free():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    service.steer("c04", "continue", idempotency_key="steer-workbench")

    first = service.workbench("c04")
    expected_fields = {
        "role",
        "objective",
        "in_scope",
        "out_of_scope",
        "permission",
        "budget",
        "cost_usage",
        "status",
        "current_action",
        "checkpoint",
        "evidence",
        "allowed_commands",
        "command_status",
        "stop_authority",
        "state_version",
    }
    assert set(first.to_dict()) == expected_fields
    assert first.to_dict() == service.workbench("c04").to_dict()
    assert first.to_dict()["objective"]["status"] == "REFERENCE_ONLY"
    assert first.to_dict()["in_scope"][0]["artifact_hash"] == packet().packet_hash
    assert first.to_dict()["in_scope"][0]["json_pointer"] == "/in_scope/0"
    assert first.to_dict()["permission"]["profile_id"] == packet().permission_profile_id
    assert first.to_dict()["permission"]["allowed_paths"] == list(
        packet().permission_snapshot.allowed_paths
    )
    assert first.to_dict()["budget"] == {
        "status": "REFERENCE_ONLY", "reference": packet().budget_ref,
    }
    assert first.to_dict()["cost_usage"] == {
        "status": "UNKNOWN",
        "cost": None,
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
    }
    assert first.to_dict()["current_action"] == "STEER"
    assert first.to_dict()["allowed_commands"] == ["STEER", "CHECKPOINT_PAUSE", "STOP"]
    assert first.to_dict()["command_status"] == {
        "status": "READY", "operations": [], "resolution": None,
    }
    assert first.to_dict()["state_version"] == 3
    assert first.to_dict()["stop_authority"] == {
        "status": "NOT_BOUND", "actor": None, "allowed": None,
    }
    encoded = json.dumps(first.to_dict(), sort_keys=True, separators=(",", ":"), allow_nan=False)
    assert "TOP_SECRET_VALUE" not in encoded
    detached = first.to_dict()
    detached["in_scope"][0]["json_pointer"] = "/evil"
    assert service.workbench("c04").to_dict()["in_scope"][0]["json_pointer"] == "/in_scope/0"


@pytest.mark.parametrize("operation", ["steer", "checkpoint", "resume", "stop"])
def test_same_key_concurrent_command_has_one_in_flight_owner(operation):
    class BarrierRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def _barrier(self, name):
            if name == operation:
                self.entered.set()
                assert self.release.wait(2)

        def steer(self, session_id, instruction, idempotency_key):
            self._barrier("steer")
            super().steer(session_id, instruction, idempotency_key)

        def request_checkpoint(self, session_id, idempotency_key):
            self._barrier("checkpoint")
            return super().request_checkpoint(session_id, idempotency_key)

        def resume(self, session_id, checkpoint, idempotency_key):
            self._barrier("resume")
            super().resume(session_id, checkpoint, idempotency_key)

        def stop(self, session_id, idempotency_key, reason=None):
            self._barrier("stop")
            super().stop(session_id, idempotency_key, reason)

    runner = BarrierRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    if operation == "resume":
        runner.entered.clear()
        service.request_checkpoint("c04", idempotency_key="setup-pause")
        runner.entered.clear()
    runner.release.clear()
    errors: list[Exception] = []

    def command():
        if operation == "steer":
            return service.steer("c04", "one", idempotency_key="same-key")
        if operation == "checkpoint":
            return service.request_checkpoint("c04", idempotency_key="same-key")
        if operation == "resume":
            return service.resume("c04", packet().packet_hash, expected_resume_epoch=0,
                                  idempotency_key="same-key")
        return service.stop("c04", idempotency_key="same-key", reason="same reason")

    def invoke():
        try:
            command()
        except Exception as error:  # pragma: no cover - asserted below
            errors.append(error)

    thread = threading.Thread(target=invoke)
    thread.start()
    assert runner.entered.wait(2)
    with pytest.raises(InvalidLifecycleTransition, match="in flight"):
        command()
    runner.release.set()
    thread.join(2)
    assert not thread.is_alive()
    assert errors == []
    calls = {
        "steer": runner.steer_calls,
        "checkpoint": runner.checkpoint_calls,
        "resume": runner.resume_calls,
        "stop": runner.stop_calls,
    }[operation]
    assert len(calls) == 1


def test_c04_mutation_requires_runner_idempotency_capability_and_ack_loss_reconcile():
    class LegacyRunner(CapabilityRunner):
        def stop(self, session_id):
            self.stop_calls.append((session_id, "legacy", None))

    legacy = DeveloperLifecycleService(LegacyRunner())
    _start(legacy)
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        legacy.stop("c04", idempotency_key="c04-stop", reason="owner stop")
    assert legacy.session("c04").status is LifecycleStatus.RUNNING
    assert legacy._runner.stop_calls == []

    class AckLossRunner(CapabilityRunner):
        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            raise TimeoutError("delivery acknowledgement lost")

    runner = AckLossRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    with pytest.raises(TimeoutError, match="acknowledgement"):
        service.steer("c04", "once", idempotency_key="ack-loss")
    with pytest.raises(InvalidLifecycleTransition, match="outcome unknown"):
        service.steer("c04", "once", idempotency_key="ack-loss")
    assert len(runner.steer_calls) == 1


def test_restore_binds_expected_session_and_attaches_runner_before_service_state():
    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source)
    checkpoint = source.request_checkpoint("c04", idempotency_key="pause-authority")
    foreign = CheckpointHandoff.create(
        checkpoint_id=checkpoint.checkpoint_id,
        state=checkpoint.state,
        session_id="foreign-session",
        delegation_id=checkpoint.delegation_id,
        packet_hash=checkpoint.packet_hash,
        baseline_hash=checkpoint.baseline_hash,
        context_snapshot_hash=checkpoint.context_snapshot_hash,
        resume_epoch=checkpoint.resume_epoch,
        delivered_commands=checkpoint.delivered_commands,
    )
    with pytest.raises(ResumeRejected, match="session authority"):
        DeveloperLifecycleService(CapabilityRunner()).restore(
            packet(), foreign, expected_session_id="c04", idempotency_key="restore-foreign",
            baseline_hash=HASH, context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )

    class NoRestoreRunner:
        def poll(self, session_id):
            return None

    missing = DeveloperLifecycleService(NoRestoreRunner())
    with pytest.raises(InvalidLifecycleTransition, match="restore capability"):
        _restore(missing, checkpoint)
    assert missing.sessions == ()

    attached_runner = CapabilityRunner()
    restored = DeveloperLifecycleService(attached_runner)
    _restore(restored, checkpoint)
    assert attached_runner.restore_calls == [
        ("c04", checkpoint.checkpoint_hash, "restore-0")
    ]
    restored.resume("c04", packet().packet_hash, expected_resume_epoch=0,
                    idempotency_key="resume-attached")


def test_explicit_c04_resume_rejects_legacy_unbound_checkpoint():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    legacy = CheckpointHandoff(
        "legacy", HASH, {"cursor": 1}, "c04", packet().delegation_id,
        packet().packet_hash,
    )
    service.pause("c04", legacy)
    with pytest.raises(ResumeRejected, match="bound checkpoint"):
        service.resume("c04", packet().packet_hash, expected_resume_epoch=0,
                       idempotency_key="c04-resume")
    assert runner.resume_calls == []


def test_barrier_races_preserve_terminal_stop_and_delivered_human_metadata():
    class RaceRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.operation: str | None = None
            self.entered = {name: threading.Event() for name in ("poll", "resume", "checkpoint", "steer")}
            self.release = {name: threading.Event() for name in ("poll", "resume", "checkpoint", "steer")}
            self.poll_result = None

        def _barrier(self, operation):
            if self.operation == operation:
                self.entered[operation].set()
                assert self.release[operation].wait(2)

        def poll(self, session_id):
            if self.poll_result is not None:
                self._barrier("poll")
                return self.poll_result
            return None

        def steer(self, session_id, instruction, idempotency_key):
            self._barrier("steer")
            super().steer(session_id, instruction, idempotency_key)

        def request_checkpoint(self, session_id, idempotency_key):
            self._barrier("checkpoint")
            if self.operation == "checkpoint":
                raise TimeoutError("checkpoint acknowledgement lost")
            return super().request_checkpoint(session_id, idempotency_key)

        def resume(self, session_id, checkpoint, idempotency_key):
            self._barrier("resume")
            super().resume(session_id, checkpoint, idempotency_key)

    # wait terminal observed while resume is delivered must not resurrect RUNNING.
    runner = RaceRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    runner.operation = "poll"
    runner.poll_result = RawResultEnvelope("c04", LifecycleStatus.COMPLETED, {"ok": True})
    waiter = threading.Thread(target=lambda: service.wait("c04"))
    waiter.start()
    assert runner.entered["poll"].wait(2)
    runner.operation = None
    checkpoint = service.request_checkpoint("c04", idempotency_key="pause-race")
    runner.operation = "resume"
    errors: list[Exception] = []
    resumer = threading.Thread(target=lambda: _capture(
        errors, service.resume, "c04", packet().packet_hash,
        expected_resume_epoch=0, idempotency_key="resume-race",
    ))
    resumer.start()
    assert runner.entered["resume"].wait(2)
    runner.release["poll"].set()
    waiter.join(2)
    assert not waiter.is_alive()
    assert service.session("c04").raw_result is not None
    runner.release["resume"].set()
    resumer.join(2)
    current = service.session("c04")
    assert current.status is LifecycleStatus.COMPLETED
    assert current.raw_result is not None
    assert current.checkpoint == checkpoint
    assert current.current_action == "RESUME"
    assert errors == []

    # failed checkpoint cannot roll back a later stop.
    runner = RaceRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    runner.operation = "checkpoint"
    checkpoint_errors: list[Exception] = []
    pauser = threading.Thread(target=lambda: _capture(
        checkpoint_errors, service.request_checkpoint, "c04",
        idempotency_key="checkpoint-fail",
    ))
    pauser.start()
    assert runner.entered["checkpoint"].wait(2)
    service.stop("c04", idempotency_key="stop-during-checkpoint", reason="owner stop")
    runner.release["checkpoint"].set()
    pauser.join(2)
    assert len(checkpoint_errors) == 1
    assert service.session("c04").status is LifecycleStatus.STOP_REQUESTED
    assert service.session("c04").current_action == "STOP"

    # delivered steer metadata remains, while later stop remains authoritative.
    runner = RaceRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    runner.operation = "steer"
    steer_errors: list[Exception] = []
    steerer = threading.Thread(target=lambda: _capture(
        steer_errors, service.steer, "c04", "preserve instruction",
        idempotency_key="steer-race",
    ))
    steerer.start()
    assert runner.entered["steer"].wait(2)
    service.stop("c04", idempotency_key="stop-after-steer", reason="owner stop")
    runner.release["steer"].set()
    steerer.join(2)
    assert steer_errors == []
    assert service.session("c04").status is LifecycleStatus.STOP_REQUESTED
    assert service.session("c04").current_action == "STOP"
    assert service.session("c04").next_instruction == "preserve instruction"


def _capture(errors, operation, *args, **kwargs):
    try:
        operation(*args, **kwargs)
    except Exception as error:  # pragma: no cover - asserted by caller
        errors.append(error)


def test_workbench_redacts_secret_shaped_objective_and_public_checkpoint_state():
    secret_packet = replace(
        packet(),
        objective="authorization=Bearer TOP_SECRET_VALUE private_key=TOP_PRIVATE_KEY",
    )
    runner = CapabilityRunner()
    checkpoint_marker = "OPAQUE_CHECKPOINT_STATE_7c6d19"
    runner.checkpoint_state = {"cursor": 9, "opaque_state": checkpoint_marker}
    service = DeveloperLifecycleService(runner)
    service.start(
        secret_packet, session_id="secret-session", baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    service.wait("secret-session")
    service.request_checkpoint("secret-session", idempotency_key="pause-secret")
    public = json.dumps(service.workbench("secret-session").to_dict(), sort_keys=True)
    handoff = json.dumps(service.handoff_projection("secret-session").to_dict(), sort_keys=True)
    for secret in ("TOP_SECRET_VALUE", "TOP_PRIVATE_KEY"):
        assert secret not in public
        assert secret not in handoff
    assert checkpoint_marker not in public
    assert checkpoint_marker not in handoff
    objective = service.workbench("secret-session").to_dict()["objective"]
    assert objective["status"] == "REFERENCE_ONLY"
    assert objective["reference"] == (
        f"delegation_packet:{secret_packet.packet_hash}#/objective"
    )


def test_rejected_checkpoint_and_resume_do_not_leave_ghost_command_records():
    service = DeveloperLifecycleService(CapabilityRunner())
    _start(service)
    with pytest.raises(ResumeRejected):
        service.resume("c04", packet().packet_hash, expected_resume_epoch=0,
                       idempotency_key="invalid-resume")
    checkpoint = service.request_checkpoint("c04", idempotency_key="valid-checkpoint")
    assert checkpoint.verify()
    with pytest.raises(ResumeRejected, match="stale"):
        service.resume("c04", packet().packet_hash, expected_resume_epoch=9,
                       idempotency_key="invalid-stale-resume")
    resumed = service.resume("c04", packet().packet_hash, expected_resume_epoch=0,
                             idempotency_key="valid-resume")
    assert resumed.status is LifecycleStatus.RUNNING

    service = DeveloperLifecycleService(CapabilityRunner())
    service.start(
        packet(), session_id="c04", baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    with pytest.raises(InvalidLifecycleTransition):
        service.request_checkpoint("c04", idempotency_key="invalid-checkpoint")
    assert service.wait("c04").status is LifecycleStatus.RUNNING
    assert service.request_checkpoint(
        "c04", idempotency_key="valid-after-invalid-checkpoint",
    ).verify()


def test_unknown_outcome_blocks_new_key_until_explicit_manual_reconciliation():
    class AckLossRunner(CapabilityRunner):
        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            raise TimeoutError("ack lost")

    service = DeveloperLifecycleService(AckLossRunner())
    _start(service)
    with pytest.raises(TimeoutError):
        service.steer("c04", "one", idempotency_key="unknown-one")
    with pytest.raises(InvalidLifecycleTransition, match="outcome unknown"):
        service.steer("c04", "two", idempotency_key="unknown-two")
    blocked = service.workbench("c04").to_dict()
    assert blocked["command_status"]["status"] == "OUTCOME_UNKNOWN"
    assert "STEER" not in blocked["allowed_commands"]
    reconciled = service.reconcile_command_outcome(
        "c04", "STEER", "unknown-one", outcome="SAFE_RETRY",
    )
    assert reconciled.state_version == 4
    with pytest.raises(TimeoutError):
        service.steer("c04", "two", idempotency_key="unknown-two")


def test_public_workbench_uses_digest_references_for_all_free_text():
    marker = "UNLABELED_SECRET_7c6d19"
    candidate = replace(
        packet(),
        objective=f"review normal token budget and {marker}",
        in_scope=(f"inspect arbitrary scope + symbols @ {marker}",),
        out_of_scope=(f"do not execute opaque action ? {marker}",),
        required_evidence=(f"show normal token accounting and {marker}",),
    )
    service = DeveloperLifecycleService(CapabilityRunner())
    service.start(
        candidate, session_id="public-text", baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    service.wait("public-text")
    projection = service.workbench("public-text").to_dict()
    serialized = json.dumps(projection, sort_keys=True)
    assert marker not in serialized
    assert "review normal token budget" not in serialized
    assert "[REDACTED]" not in serialized
    assert projection["objective"]["status"] == "REFERENCE_ONLY"
    assert projection["in_scope"][0]["status"] == "REFERENCE_ONLY"
    assert projection["out_of_scope"][0]["status"] == "REFERENCE_ONLY"
    assert projection["evidence"][0]["status"] == "REFERENCE_ONLY"


def test_same_key_different_audit_reason_conflicts_and_terminal_stop_is_fenced():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    first = service.steer("c04", "one", idempotency_key="steer-reason", reason="audit one")
    assert first.state_version == 3
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        service.steer("c04", "one", idempotency_key="steer-reason", reason="audit two")

    stopped = service.stop(
        "c04", idempotency_key="terminal-stop", reason="body one", audit_reason="audit one",
    )
    assert stopped.state_version == 5
    runner.results.append(
        RawResultEnvelope("c04", LifecycleStatus.STOPPED, {"stopped": True}),
    )
    terminal = service.wait("c04")
    assert terminal.status is LifecycleStatus.STOPPED
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        service.stop(
            "c04", idempotency_key="terminal-stop", reason="body two", audit_reason="audit one",
        )
    assert service.stop(
        "c04", idempotency_key="terminal-stop", reason="body one", audit_reason="audit one",
    ) == terminal


def test_same_resume_key_with_different_audit_reason_conflicts():
    service = DeveloperLifecycleService(CapabilityRunner())
    _start(service)
    service.request_checkpoint("c04", idempotency_key="pause-for-reason")
    service.resume(
        "c04", packet().packet_hash, expected_resume_epoch=0,
        idempotency_key="resume-reason", reason="audit one",
    )
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        service.resume(
            "c04", packet().packet_hash, expected_resume_epoch=0,
            idempotency_key="resume-reason", reason="audit two",
        )


def test_legacy_direct_stop_with_key_but_no_reason_remains_compatible():
    class KeyOnlyStopRunner(CapabilityRunner):
        def stop(self, session_id, idempotency_key):
            self.stop_calls.append((session_id, idempotency_key, None))

    service = DeveloperLifecycleService(KeyOnlyStopRunner())
    _start(service)
    stopped = service.stop("c04", idempotency_key="legacy-key")
    assert stopped.status is LifecycleStatus.STOP_REQUESTED


def test_resolved_success_applies_each_ambiguous_runner_effect_without_redelivery():
    class AckLossRunner(CapabilityRunner):
        def __init__(self, operation):
            super().__init__()
            self.operation = operation

        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            if self.operation == "STEER":
                raise TimeoutError("steer ack lost")

        def resume(self, session_id, checkpoint, idempotency_key):
            super().resume(session_id, checkpoint, idempotency_key)
            if self.operation == "RESUME":
                raise TimeoutError("resume ack lost")

        def stop(self, session_id, idempotency_key, reason=None):
            super().stop(session_id, idempotency_key, reason)
            if self.operation == "STOP":
                raise TimeoutError("stop ack lost")

    runner = AckLossRunner("STEER")
    service = DeveloperLifecycleService(runner)
    _start(service)
    with pytest.raises(TimeoutError):
        service.steer("c04", "applied instruction", idempotency_key="ambiguous-steer",
                      reason="audit steer")
    reconciled = service.reconcile_command_outcome(
        "c04", "STEER", "ambiguous-steer", outcome="RESOLVED_SUCCESS",
    )
    assert reconciled.next_instruction == "applied instruction"
    assert service.steer(
        "c04", "applied instruction", idempotency_key="ambiguous-steer",
        reason="audit steer",
    ) == reconciled
    assert len(runner.steer_calls) == 1

    runner = AckLossRunner("RESUME")
    service = DeveloperLifecycleService(runner)
    _start(service)
    checkpoint = service.request_checkpoint("c04", idempotency_key="pause-resume-effect")
    with pytest.raises(TimeoutError):
        service.resume(
            "c04", packet().packet_hash, expected_resume_epoch=0,
            idempotency_key="ambiguous-resume", reason="audit resume",
        )
    reconciled = service.reconcile_command_outcome(
        "c04", "RESUME", "ambiguous-resume", outcome="RESOLVED_SUCCESS",
    )
    assert reconciled.status is LifecycleStatus.RUNNING
    assert reconciled.resume_epoch == 1
    assert reconciled.checkpoint == checkpoint
    assert service.resume(
        "c04", packet().packet_hash, expected_resume_epoch=0,
        idempotency_key="ambiguous-resume", reason="audit resume",
    ) == reconciled
    assert len(runner.resume_calls) == 1

    runner = AckLossRunner("STOP")
    service = DeveloperLifecycleService(runner)
    _start(service)
    with pytest.raises(TimeoutError):
        service.stop(
            "c04", idempotency_key="ambiguous-stop",
            reason="stop body", audit_reason="audit stop",
        )
    reconciled = service.reconcile_command_outcome(
        "c04", "STOP", "ambiguous-stop", outcome="RESOLVED_SUCCESS",
    )
    assert reconciled.status is LifecycleStatus.STOP_REQUESTED
    assert service.stop(
        "c04", idempotency_key="ambiguous-stop",
        reason="stop body", audit_reason="audit stop",
    ) == reconciled
    assert len(runner.stop_calls) == 1


def test_checkpoint_resolved_success_requires_explicit_canonical_receipt():
    class CheckpointAckLoss(CapabilityRunner):
        def request_checkpoint(self, session_id, idempotency_key):
            super().request_checkpoint(session_id, idempotency_key)
            raise TimeoutError("checkpoint ack lost")

    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source)
    receipt = source.request_checkpoint("c04", idempotency_key="ambiguous-checkpoint")

    runner = CheckpointAckLoss()
    service = DeveloperLifecycleService(runner)
    _start(service)
    with pytest.raises(TimeoutError):
        service.request_checkpoint("c04", idempotency_key="ambiguous-checkpoint")
    with pytest.raises(InvalidLifecycleTransition, match="canonical checkpoint receipt"):
        service.reconcile_command_outcome(
            "c04", "CHECKPOINT_PAUSE", "ambiguous-checkpoint",
            outcome="RESOLVED_SUCCESS",
        )
    reconciled = service.reconcile_command_outcome(
        "c04", "CHECKPOINT_PAUSE", "ambiguous-checkpoint",
        outcome="RESOLVED_SUCCESS", checkpoint=receipt,
    )
    assert reconciled.status is LifecycleStatus.PAUSED
    assert reconciled.checkpoint is not None
    assert reconciled.checkpoint != receipt
    assert reconciled.checkpoint.to_dict()["state"] == receipt.to_dict()["state"]
    assert reconciled.checkpoint.state_version == reconciled.state_version
    assert reconciled.checkpoint.verify()
    assert service.request_checkpoint(
        "c04", idempotency_key="ambiguous-checkpoint",
    ) == reconciled.checkpoint
    assert len(runner.checkpoint_calls) == 1

    restored_runner = CapabilityRunner()
    restored = DeveloperLifecycleService(restored_runner)
    restored.restore(
        packet(), reconciled.checkpoint,
        expected_session_id="c04",
        idempotency_key="restore-reconciled-checkpoint",
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert restored.request_checkpoint(
        "c04", idempotency_key="ambiguous-checkpoint",
    ) == restored.session("c04").checkpoint
    assert restored_runner.checkpoint_calls == []


def test_checkpoint_reconciliation_rejects_receipt_without_exact_reserved_command():
    class CheckpointAckLoss(CapabilityRunner):
        def request_checkpoint(self, session_id, idempotency_key):
            super().request_checkpoint(session_id, idempotency_key)
            raise TimeoutError("checkpoint ack lost")

    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source)
    unrelated = source.request_checkpoint("c04", idempotency_key="unrelated-checkpoint")
    forged = CheckpointHandoff.create(
        checkpoint_id="forged-history",
        state=unrelated.to_dict()["state"],
        session_id=unrelated.session_id,
        delegation_id=unrelated.delegation_id,
        packet_hash=unrelated.packet_hash,
        baseline_hash=unrelated.baseline_hash,
        context_snapshot_hash=unrelated.context_snapshot_hash,
        resume_epoch=unrelated.resume_epoch,
        delivered_commands={
            **dict(unrelated.delivered_commands),
            "forged-command-key": HASH,
        },
        state_version=unrelated.state_version,
    )

    service = DeveloperLifecycleService(CheckpointAckLoss())
    _start(service)
    with pytest.raises(TimeoutError):
        service.request_checkpoint("c04", idempotency_key="ambiguous-checkpoint")
    with pytest.raises(InvalidLifecycleTransition, match="history"):
        service.reconcile_command_outcome(
            "c04", "CHECKPOINT_PAUSE", "ambiguous-checkpoint",
            outcome="RESOLVED_SUCCESS", checkpoint=forged,
        )
    assert service.session("c04").checkpoint is None


def test_state_version_covers_start_wait_result_unknown_reconcile_and_rollback():
    class PollFailureRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.fail = True

        def poll(self, session_id):
            if self.fail:
                self.fail = False
                raise RuntimeError("poll failed")
            return super().poll(session_id)

    service = DeveloperLifecycleService(PollFailureRunner())
    pending = service.start(
        packet(), session_id="c04", baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert (pending.status, pending.state_version) == (LifecycleStatus.PENDING, 1)
    with pytest.raises(RuntimeError, match="poll failed"):
        service.wait("c04")
    rolled_back = service.session("c04")
    assert (rolled_back.status, rolled_back.state_version) == (LifecycleStatus.PENDING, 3)
    running = service.wait("c04")
    assert (running.status, running.state_version) == (LifecycleStatus.RUNNING, 4)
    service._runner.results.append(
        RawResultEnvelope("c04", LifecycleStatus.COMPLETED, {"ok": True}),
    )
    terminal = service.wait("c04")
    assert (terminal.status, terminal.state_version) == (LifecycleStatus.COMPLETED, 5)

    class AckLossRunner(CapabilityRunner):
        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            raise TimeoutError("ack lost")

    service = DeveloperLifecycleService(AckLossRunner())
    _start(service)
    before = service.session("c04").state_version
    with pytest.raises(TimeoutError):
        service.steer("c04", "one", idempotency_key="version-unknown")
    unknown = service.session("c04")
    assert unknown.state_version == before + 1
    resolved = service.reconcile_command_outcome(
        "c04", "STEER", "version-unknown", outcome="RESOLVED_SUCCESS",
    )
    assert resolved.state_version == unknown.state_version + 1


def test_workbench_commands_match_unresolved_guard_and_scope_artifact_references():
    class AckLossRunner(CapabilityRunner):
        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            raise TimeoutError("ack lost")

    service = DeveloperLifecycleService(AckLossRunner())
    _start(service)
    with pytest.raises(TimeoutError):
        service.steer("c04", "one", idempotency_key="unresolved-steer")
    view = service.workbench("c04").to_dict()
    assert "STEER" not in view["allowed_commands"]
    assert "CHECKPOINT_PAUSE" not in view["allowed_commands"]
    assert "STOP" in view["allowed_commands"]
    with pytest.raises(InvalidLifecycleTransition, match="reconciliation"):
        service.request_checkpoint("c04", idempotency_key="blocked-checkpoint")

    packet_hash = packet().packet_hash
    serialized = json.dumps(view, sort_keys=True)
    for raw in (*packet().in_scope, *packet().out_of_scope, packet().objective):
        assert raw not in serialized
    for collection, values, pointer in (
        (view["in_scope"], packet().in_scope, "/in_scope"),
        (view["out_of_scope"], packet().out_of_scope, "/out_of_scope"),
    ):
        assert len(collection) == len(values)
        for index, reference in enumerate(collection):
            assert reference["artifact_hash"] == packet_hash
            assert reference["json_pointer"] == f"{pointer}/{index}"
            assert reference["index"] == index
            assert reference["status"] == "REFERENCE_ONLY"
            assert reference["lookup"] == "U02_DEFERRED"
    assert packet_hash in view["objective"]["reference"]
    assert packet_hash in view["evidence"][0]["reference"]


def test_workbench_commands_match_inflight_operation_guards():
    class BlockingRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            self.entered.set()
            assert self.release.wait(2)

    runner = BlockingRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    errors: list[Exception] = []
    owner = threading.Thread(target=lambda: _capture(
        errors, service.steer, "c04", "first", idempotency_key="inflight-owner",
    ))
    owner.start()
    assert runner.entered.wait(2)
    view = service.workbench("c04").to_dict()
    assert view["allowed_commands"] == ["STOP"]
    with pytest.raises(InvalidLifecycleTransition, match="in flight"):
        service.steer("c04", "second", idempotency_key="inflight-other")
    runner.release.set()
    owner.join(2)
    assert not owner.is_alive()
    assert errors == []

    class BlockingCheckpointRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def request_checkpoint(self, session_id, idempotency_key):
            self.checkpoint_calls.append((session_id, idempotency_key))
            self.entered.set()
            assert self.release.wait(2)
            return self.checkpoint_state

    runner = BlockingCheckpointRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    errors = []
    owner = threading.Thread(target=lambda: _capture(
        errors, service.request_checkpoint, "c04", idempotency_key="checkpoint-owner",
    ))
    owner.start()
    assert runner.entered.wait(2)
    assert service.workbench("c04").to_dict()["allowed_commands"] == ["STOP"]
    runner.release.set()
    owner.join(2)
    assert not owner.is_alive()
    assert errors == []


def test_checkpoint_failure_linearizes_terminal_poll_without_empty_pause():
    class BarrierRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.initial_poll = True
            self.checkpoint_entered = threading.Event()
            self.poll_entered = threading.Event()
            self.release_checkpoint = threading.Event()
            self.release_poll = threading.Event()

        def request_checkpoint(self, session_id, idempotency_key):
            self.checkpoint_calls.append((session_id, idempotency_key))
            self.checkpoint_entered.set()
            assert self.release_checkpoint.wait(2)
            raise TimeoutError("checkpoint acknowledgement lost")

        def poll(self, session_id):
            if self.initial_poll:
                self.initial_poll = False
                return None
            self.poll_entered.set()
            assert self.release_poll.wait(2)
            return RawResultEnvelope(
                session_id, LifecycleStatus.COMPLETED, {"terminal": True},
            )

    runner = BarrierRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    checkpoint_errors = []
    poll_errors = []
    poll_owner = threading.Thread(target=lambda: _capture(
        poll_errors, service.wait, "c04",
    ))
    poll_owner.start()
    assert runner.poll_entered.wait(2)
    checkpoint_owner = threading.Thread(target=lambda: _capture(
        checkpoint_errors, service.request_checkpoint, "c04",
        idempotency_key="checkpoint-terminal-race",
    ))
    checkpoint_owner.start()
    assert runner.checkpoint_entered.wait(2)
    runner.release_poll.set()
    poll_owner.join(2)
    runner.release_checkpoint.set()
    checkpoint_owner.join(2)

    assert poll_errors == []
    assert len(checkpoint_errors) == 1
    assert isinstance(checkpoint_errors[0], TimeoutError)
    session = service.session("c04")
    assert session.status is LifecycleStatus.COMPLETED
    assert session.raw_result is not None
    assert session.checkpoint is None
    assert service.workbench("c04").allowed_commands == ()


def test_restore_unknown_blocks_every_key_until_explicit_safe_retry():
    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source)
    checkpoint = source.request_checkpoint("c04", idempotency_key="restore-source")

    class FailOnceRestoreRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.fail = True

        def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
            self.restore_calls.append((session_id, checkpoint.checkpoint_hash, idempotency_key))
            if self.fail:
                self.fail = False
                raise TimeoutError("restore acknowledgement lost")
            self.attached.add(session_id)

    runner = FailOnceRestoreRunner()
    service = DeveloperLifecycleService(runner)
    kwargs = {
        "expected_session_id": "c04", "baseline_hash": HASH,
        "context_snapshot_hash": HASH,
        "parent_permission_snapshot": packet_parent_permission(),
        "parent_egress_profile": packet_parent_egress(),
    }
    with pytest.raises(TimeoutError):
        service.restore(packet(), checkpoint, idempotency_key="restore-unknown", **kwargs)
    with pytest.raises(InvalidLifecycleTransition, match="restore outcome unknown"):
        service.restore(packet(), checkpoint, idempotency_key="restore-other", **kwargs)
    assert len(runner.restore_calls) == 1

    assert service.reconcile_restore_outcome(
        expected_session_id="c04", checkpoint_hash=checkpoint.checkpoint_hash,
        idempotency_key="restore-unknown", outcome="SAFE_RETRY",
    ) is None
    restored = service.restore(
        packet(), checkpoint, idempotency_key="restore-after-reconcile", **kwargs,
    )
    assert restored.status is LifecycleStatus.PAUSED
    assert len(runner.restore_calls) == 2


def test_restore_inflight_blocks_a_different_key_for_the_same_authority():
    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source)
    checkpoint = source.request_checkpoint("c04", idempotency_key="inflight-source")

    class BlockingRestoreRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
            self.restore_calls.append((session_id, checkpoint.checkpoint_hash, idempotency_key))
            self.entered.set()
            assert self.release.wait(2)
            self.attached.add(session_id)

    runner = BlockingRestoreRunner()
    service = DeveloperLifecycleService(runner)
    kwargs = {
        "expected_session_id": "c04", "baseline_hash": HASH,
        "context_snapshot_hash": HASH,
        "parent_permission_snapshot": packet_parent_permission(),
        "parent_egress_profile": packet_parent_egress(),
    }
    errors = []
    owner = threading.Thread(target=lambda: _capture(
        errors, service.restore, packet(), checkpoint,
        idempotency_key="restore-owner", **kwargs,
    ))
    owner.start()
    assert runner.entered.wait(2)
    with pytest.raises(InvalidLifecycleTransition, match="restore in flight"):
        service.restore(packet(), checkpoint, idempotency_key="restore-other", **kwargs)
    runner.release.set()
    owner.join(2)
    assert errors == []
    assert len(runner.restore_calls) == 1


def test_restore_confirmed_success_receipt_installs_session_without_redelivery():
    source = DeveloperLifecycleService(CapabilityRunner())
    _start(source)
    checkpoint = source.request_checkpoint("c04", idempotency_key="receipt-source")

    class AmbiguousRestoreRunner(CapabilityRunner):
        def restore(self, session_id, delegation_packet, checkpoint, idempotency_key):
            self.restore_calls.append((session_id, checkpoint.checkpoint_hash, idempotency_key))
            raise TimeoutError("restore acknowledgement lost")

    runner = AmbiguousRestoreRunner()
    service = DeveloperLifecycleService(runner)
    with pytest.raises(TimeoutError):
        service.restore(
            packet(), checkpoint, expected_session_id="c04",
            idempotency_key="restore-receipt", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )
    restored = service.reconcile_restore_outcome(
        expected_session_id="c04", checkpoint_hash=checkpoint.checkpoint_hash,
        idempotency_key="restore-receipt", outcome="RESOLVED_SUCCESS",
        receipt={
            "operation": "RESTORE", "outcome": "DELIVERED",
            "session_id": "c04", "checkpoint_hash": checkpoint.checkpoint_hash,
            "idempotency_key": "restore-receipt",
        },
    )
    assert restored is not None
    assert restored.status is LifecycleStatus.PAUSED
    assert len(runner.restore_calls) == 1


def test_stop_delivery_is_observable_and_new_key_cannot_redeliver():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    running = _start(service)
    stopped = service.stop(
        "c04", idempotency_key="stop-delivered", reason="operator stop",
    )
    assert stopped.state_version >= running.state_version + 2
    assert service.workbench("c04").allowed_commands == ()
    assert service.stop(
        "c04", idempotency_key="stop-delivered", reason="operator stop",
    ) == stopped
    with pytest.raises(InvalidLifecycleTransition, match="stop.*delivered"):
        service.stop("c04", idempotency_key="stop-new", reason="operator stop")
    assert len(runner.stop_calls) == 1


def test_resume_delivery_advances_version_when_concurrent_stop_wins():
    class BlockingResumeRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.resume_entered = threading.Event()
            self.release_resume = threading.Event()

        def resume(self, session_id, checkpoint, idempotency_key):
            super().resume(session_id, checkpoint, idempotency_key)
            self.resume_entered.set()
            assert self.release_resume.wait(2)

    runner = BlockingResumeRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    service.request_checkpoint("c04", idempotency_key="resume-stop-checkpoint")
    resume_errors = []
    owner = threading.Thread(target=lambda: _capture(
        resume_errors, service.resume, "c04", packet().packet_hash,
        expected_resume_epoch=0, idempotency_key="resume-stop-owner",
        reason="resume before stop",
    ))
    owner.start()
    assert runner.resume_entered.wait(2)
    after_stop = service.stop(
        "c04", idempotency_key="resume-stop-command", reason="operator stop",
    )
    runner.release_resume.set()
    owner.join(2)
    assert resume_errors == []
    final = service.session("c04")
    assert final.status is LifecycleStatus.STOP_REQUESTED
    assert final.current_action == "STOP"
    assert final.state_version == after_stop.state_version + 1
    assert len(runner.resume_calls) == 1


@pytest.mark.parametrize("outcome", ["SAFE_RETRY", "RESOLVED_SUCCESS"])
@pytest.mark.parametrize("later_authority", ["STOP", "TERMINAL"])
def test_late_reconciliation_preserves_newer_authority_and_reports_audit_separately(
    outcome, later_authority,
):
    class SteerAckLoss(CapabilityRunner):
        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            raise TimeoutError("steer ack lost")

    runner = SteerAckLoss()
    service = DeveloperLifecycleService(runner)
    _start(service)
    with pytest.raises(TimeoutError):
        service.steer(
            "c04", "late reconcile", idempotency_key="late-steer",
            reason="late audit",
        )
    if later_authority == "STOP":
        authoritative = service.stop(
            "c04", idempotency_key="late-stop", reason="operator stop",
            audit_reason="stop audit",
        )
    else:
        runner.results.append(RawResultEnvelope(
            "c04", LifecycleStatus.COMPLETED, {"result": "terminal"},
        ))
        authoritative = service.wait("c04")

    reconciled = service.reconcile_command_outcome(
        "c04", "STEER", "late-steer", outcome=outcome,
    )
    assert reconciled.status is authoritative.status
    assert reconciled.current_action == authoritative.current_action
    assert reconciled.state_version == authoritative.state_version + 1
    assert service.workbench("c04").command_status == {
        "status": "RECONCILED",
        "operations": ("STEER",),
        "resolution": outcome,
    }
    assert len(runner.steer_calls) == 1


def test_c02_valid_operational_identifiers_are_projected_raw_without_extra_authority():
    child = replace(
        packet().permission_snapshot,
        allowed_paths=("Ops Folder/Case+One.py",),
        allowed_actions=("Inspect ReadOnly@V2",),
        allowed_tools=("Read.File@V2",),
        allowed_backends=("Local+Runner:V2",),
    )
    parent = replace(
        packet_parent_permission(),
        allowed_paths=child.allowed_paths,
        allowed_actions=child.allowed_actions,
        allowed_tools=child.allowed_tools,
        allowed_backends=child.allowed_backends,
    )
    value = replace(
        packet(),
        delegation_id="Delegation:C04@MixedCase",
        allowed_paths=child.allowed_paths,
        permission_profile_id="Perm=Child@V2",
        budget_ref="Budget C02+Ops@V1",
        permission_snapshot=child,
        permission_snapshot_hash=child.snapshot_hash,
        parent_permission_snapshot_hash=parent.snapshot_hash,
    )
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    service.start(
        value,
        session_id="c04",
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=parent,
        parent_egress_profile=packet_parent_egress(),
    )
    service.wait("c04")
    view = service.workbench("c04")
    assert runner.started == ["c04"]
    assert service.current("c04").to_dict()["delegation_id"] == value.delegation_id
    assert view.permission == {
        "profile_id": value.permission_profile_id,
        "allowed_paths": child.allowed_paths,
        "allowed_actions": child.allowed_actions,
        "allowed_tools": child.allowed_tools,
        "allowed_backends": child.allowed_backends,
        "prohibited_paths": child.prohibited_paths,
        "protected_paths": child.protected_paths,
        "prohibited_actions": child.prohibited_actions,
    }
    assert view.budget["reference"] == value.budget_ref
    assert view.objective["artifact_hash"] == value.packet_hash
    assert value.objective not in json.dumps(view.to_dict())

    checkpoint = service.request_checkpoint("c04", idempotency_key="mixed-pause")
    restored_runner = CapabilityRunner()
    restored = DeveloperLifecycleService(restored_runner)
    restored.restore(
        value,
        checkpoint,
        expected_session_id="c04",
        idempotency_key="mixed-restore",
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=parent,
        parent_egress_profile=packet_parent_egress(),
    )
    assert restored.current("c04").to_dict()["delegation_id"] == value.delegation_id
    assert restored.workbench("c04").permission == view.permission
    assert restored_runner.restore_calls == [
        ("c04", checkpoint.checkpoint_hash, "mixed-restore")
    ]


def test_second_session_for_same_delegation_is_rejected_before_runner_delivery():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service, "original-session")
    runner.results.append(RawResultEnvelope(
        "original-session", LifecycleStatus.COMPLETED, {"ok": True},
    ))
    service.wait("original-session")

    with pytest.raises(InvalidLifecycleTransition, match="delegation.*session"):
        service.start(
            packet(),
            session_id="duplicate-session",
            baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )
    assert runner.started == ["original-session"]


def test_terminal_steer_replay_precedes_state_guard_but_payload_conflict_does_not():
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    _start(service)
    delivered = service.steer(
        "c04", "terminal replay", idempotency_key="terminal-steer",
        reason="audit steer",
    )
    runner.results.append(RawResultEnvelope(
        "c04", LifecycleStatus.COMPLETED, {"ok": True},
    ))
    terminal = service.wait("c04")
    assert terminal.status is LifecycleStatus.COMPLETED
    assert service.steer(
        "c04", "terminal replay", idempotency_key="terminal-steer",
        reason="audit steer",
    ) == terminal
    with pytest.raises(InvalidLifecycleTransition, match="idempotency"):
        service.steer(
            "c04", "different", idempotency_key="terminal-steer",
            reason="audit steer",
        )
    assert delivered.next_instruction == "terminal replay"
    assert len(runner.steer_calls) == 1


def test_c02_invalid_packet_fails_closed_before_runner_delivery():
    submitted = packet().to_dict()
    submitted["permission_profile_id"] = " invalid surrounding whitespace "
    runner = CapabilityRunner()
    service = DeveloperLifecycleService(runner)
    with pytest.raises(PacketRejected) as error:
        service.start(
            submitted, session_id="c02-invalid", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )
    assert error.value.validation.reason_codes == ("EMPTY_FIELD",)
    assert error.value.validation.fields == ("permission_profile_id",)
    assert runner.started == []
    assert service.sessions == ()


def test_arbitrary_instruction_is_command_artifact_bound_not_public_text():
    instruction = "Investigate MixedCase + opaque payload @ step[4]?"
    service = DeveloperLifecycleService(CapabilityRunner())
    _start(service)
    service.steer("c04", instruction, idempotency_key="artifact-steer")
    reference = service.current("c04").to_dict()["next_instruction"]
    assert reference["artifact_id"].startswith("command:")
    assert reference["artifact_hash"].startswith("sha256:")
    assert reference["json_pointer"] == "/payload/instruction"
    assert instruction not in json.dumps(reference)
    assert "/runtime/next_instruction" not in json.dumps(reference)
