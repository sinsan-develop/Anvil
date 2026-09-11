from dataclasses import replace

import pytest

from packages.orchestration import (
    DeveloperLifecycleService, DeterministicFakeDeveloperRunner,
    LifecycleStatus, PacketRejected, RawResultEnvelope, ReadOnlyPolicyRejected,
)
from tests.orchestration.test_delegation_packet import (
    _egress, _permission, complete_packet, packet,
    packet_parent_egress, packet_parent_permission,
)


HASH = "sha256:" + "a" * 64
DIFFERENT = "sha256:" + "b" * 64


def service() -> DeveloperLifecycleService:
    return DeveloperLifecycleService(DeterministicFakeDeveloperRunner())


def start(svc: DeveloperLifecycleService, session_id: str = "session-1"):
    return svc.start(
        packet(), session_id=session_id, baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )


def test_packet_is_required_and_snapshot_mismatch_is_rejected():
    svc = service()
    with pytest.raises(PacketRejected) as error:
        svc.start(None, session_id="s", baseline_hash=HASH, context_snapshot_hash=HASH,
                  parent_permission_snapshot=packet_parent_permission(),
                  parent_egress_profile=packet_parent_egress())
    assert error.value.validation.reason_codes == ("PACKET_REQUIRED",)
    with pytest.raises(PacketRejected) as error:
        svc.start(replace(packet(), baseline_hash=DIFFERENT), session_id="s2",
                  baseline_hash=HASH, context_snapshot_hash=HASH,
                  parent_permission_snapshot=packet_parent_permission(),
                  parent_egress_profile=packet_parent_egress())
    assert error.value.validation.reason_codes == ("BASELINE_SNAPSHOT_MISMATCH",)


def test_start_wait_completion_is_monotonic_and_idempotent():
    svc = service()
    first = start(svc)
    assert first.status is LifecycleStatus.PENDING
    assert svc.start(
        packet(), session_id="session-1", baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    ) == first
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


def test_expanded_child_is_rejected_before_runner_start_side_effect():
    class StartSpyRunner(DeterministicFakeDeveloperRunner):
        def __init__(self):
            super().__init__()
            self.start_calls = 0

        def start(self, session_id, delegation_packet):
            self.start_calls += 1
            super().start(session_id, delegation_packet)

    runner = StartSpyRunner()
    svc = DeveloperLifecycleService(runner)
    parent_permission = _permission(paths=("packages/**",))
    expanded = _permission(paths=("packages/orchestration/**", "private/**"))
    child = replace(
        complete_packet(), allowed_paths=expanded.allowed_paths,
        prohibited_actions=expanded.prohibited_actions,
        permission_snapshot=expanded, permission_snapshot_hash=expanded.snapshot_hash,
        parent_permission_snapshot_hash=parent_permission.snapshot_hash,
    )

    with pytest.raises(PacketRejected) as error:
        svc.start(
            child, session_id="rejected-before-runner", baseline_hash=HASH,
            context_snapshot_hash=HASH, parent_permission_snapshot=parent_permission,
            parent_egress_profile=_egress(approved=("packages/**",)),
        )

    assert error.value.validation.reason_codes == ("CHILD_PATH_SCOPE_EXPANSION",)
    assert runner.start_calls == 0


def test_nested_array_type_coercion_is_rejected_before_runner_start():
    class StartSpyRunner(DeterministicFakeDeveloperRunner):
        def __init__(self):
            super().__init__()
            self.start_calls = 0

        def start(self, session_id, delegation_packet):
            self.start_calls += 1
            super().start(session_id, delegation_packet)

    submitted = complete_packet().to_dict()
    submitted["permission_snapshot"]["allowed_tools"] = "read_file"
    runner = StartSpyRunner()

    with pytest.raises(PacketRejected) as error:
        DeveloperLifecycleService(runner).start(
            submitted, session_id="nested-array-coercion", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )

    assert error.value.validation.reason_codes == ("INVALID_FIELD_TYPE",)
    assert error.value.validation.fields == ("permission_snapshot.allowed_tools",)
    assert runner.start_calls == 0


@pytest.mark.parametrize("kind,field", [
    ("packet", "objective"),
    ("child_permission", "permission_snapshot.allowed_tools"),
    ("child_egress", "data_egress_profile.provider_allowlist"),
    ("parent_permission", "parent_permission_snapshot.allowed_tools"),
    ("parent_egress", "parent_egress_profile.provider_allowlist"),
])
def test_unicode_surrogate_is_rejected_before_runner_start(kind, field):
    class StartSpyRunner(DeterministicFakeDeveloperRunner):
        def __init__(self):
            super().__init__()
            self.start_calls = 0

        def start(self, session_id, delegation_packet):
            self.start_calls += 1
            super().start(session_id, delegation_packet)

    submitted = complete_packet().to_dict()
    parent_permission = _permission(paths=("packages/**",)).to_dict()
    parent_egress = _egress(approved=("packages/**",)).to_dict()
    if kind == "packet":
        submitted["objective"] = "\ud800"
    elif kind == "child_permission":
        submitted["permission_snapshot"]["allowed_tools"] = ["\ud800"]
    elif kind == "child_egress":
        submitted["data_egress_profile"]["provider_allowlist"] = ["\ud800"]
    elif kind == "parent_permission":
        parent_permission["allowed_tools"] = ["\ud800"]
    else:
        parent_egress["provider_allowlist"] = ["\ud800"]
    runner = StartSpyRunner()

    with pytest.raises(PacketRejected) as error:
        DeveloperLifecycleService(runner).start(
            submitted, session_id=f"surrogate-{kind}", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=parent_permission,
            parent_egress_profile=parent_egress,
        )

    assert error.value.validation.reason_codes == ("INVALID_TEXT_ENCODING",)
    assert error.value.validation.fields == (field,)
    assert runner.start_calls == 0


@pytest.mark.parametrize("kind", [
    "packet", "child_permission", "child_egress", "parent_permission", "parent_egress",
])
def test_surrogate_unknown_key_receipt_is_safe_before_runner_start(kind):
    class StartSpyRunner(DeterministicFakeDeveloperRunner):
        def __init__(self):
            super().__init__()
            self.start_calls = 0

        def start(self, session_id, delegation_packet):
            self.start_calls += 1
            super().start(session_id, delegation_packet)

    submitted = complete_packet().to_dict()
    parent_permission = _permission(paths=("packages/**",)).to_dict()
    parent_egress = _egress(approved=("packages/**",)).to_dict()
    targets = {
        "packet": submitted,
        "child_permission": submitted["permission_snapshot"],
        "child_egress": submitted["data_egress_profile"],
        "parent_permission": parent_permission,
        "parent_egress": parent_egress,
    }
    targets[kind]["bad\ud800key"] = True
    runner = StartSpyRunner()

    with pytest.raises(PacketRejected) as error:
        DeveloperLifecycleService(runner).start(
            submitted, session_id=f"surrogate-key-{kind}", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=parent_permission,
            parent_egress_profile=parent_egress,
        )

    assert error.value.validation.reason_codes == ("UNKNOWN_FIELD",)
    hostile_receipt = error.value.validation.to_json().encode("utf-8")
    assert runner.start_calls == 0

    literal_key = '<unknown_key_codepoints:00006200006100006400d80000006b000065000079>'
    literal_submitted = complete_packet().to_dict()
    literal_parent_permission = _permission(paths=("packages/**",)).to_dict()
    literal_parent_egress = _egress(approved=("packages/**",)).to_dict()
    literal_targets = {
        "packet": literal_submitted,
        "child_permission": literal_submitted["permission_snapshot"],
        "child_egress": literal_submitted["data_egress_profile"],
        "parent_permission": literal_parent_permission,
        "parent_egress": literal_parent_egress,
    }
    literal_targets[kind][literal_key] = True
    literal_runner = StartSpyRunner()
    with pytest.raises(PacketRejected) as literal_error:
        DeveloperLifecycleService(literal_runner).start(
            literal_submitted, session_id=f"literal-key-{kind}", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=literal_parent_permission,
            parent_egress_profile=literal_parent_egress,
        )
    assert literal_error.value.validation.to_json().encode("utf-8") != hostile_receipt
    assert literal_runner.start_calls == 0


@pytest.mark.parametrize("kind,reason,field", [
    ("permission_schema_empty", "EMPTY_FIELD", "parent_permission_snapshot.schema_version"),
    ("egress_mode_list", "INVALID_FIELD_TYPE", "parent_egress_profile.mode"),
    ("permission_integer", "INVALID_FIELD_TYPE", "parent_permission_snapshot"),
    ("permission_overlap", "ALLOW_DENY_OVERLAP", "parent_permission_snapshot.allowed_paths"),
    ("permission_mixed_key", "UNKNOWN_FIELD", "parent_permission_snapshot.<non_string_key>"),
])
def test_malformed_parent_never_escapes_or_starts_runner(kind, reason, field):
    class StartSpyRunner(DeterministicFakeDeveloperRunner):
        def __init__(self):
            super().__init__()
            self.start_calls = 0

        def start(self, session_id, delegation_packet):
            self.start_calls += 1
            super().start(session_id, delegation_packet)

    parent_permission = _permission(paths=("packages/**",)).to_dict()
    parent_egress = _egress(approved=("packages/**",)).to_dict()
    if kind == "permission_schema_empty":
        parent_permission["schema_version"] = ""
    elif kind == "egress_mode_list":
        parent_egress["mode"] = ["approved_paths"]
    elif kind == "permission_integer":
        parent_permission = 7
    elif kind == "permission_overlap":
        parent_permission["prohibited_paths"] = ["packages/private/**"]
    else:
        parent_permission[7] = True
    runner = StartSpyRunner()
    svc = DeveloperLifecycleService(runner)

    with pytest.raises(PacketRejected) as error:
        svc.start(
            complete_packet(), session_id=f"hostile-parent-{kind}",
            baseline_hash=HASH, context_snapshot_hash=HASH,
            parent_permission_snapshot=parent_permission,
            parent_egress_profile=parent_egress,
        )

    assert error.value.validation.reason_codes == (reason,)
    assert error.value.validation.fields == (field,)
    assert runner.start_calls == 0
