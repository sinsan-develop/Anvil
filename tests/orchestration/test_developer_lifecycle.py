from dataclasses import replace
import hashlib
import threading
from types import SimpleNamespace

import pytest

from packages.orchestration import (
    CheckpointHandoff, DeveloperLifecycleService, DeterministicFakeDeveloperRunner,
    InvalidLifecycleTransition, LifecycleStatus, PacketRejected,
    RawResultArtifact, RawResultEnvelope, ReadOnlyPolicy, ReadOnlyPolicyRejected,
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
    assert svc.wait("stop-1").status is LifecycleStatus.RUNNING
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
        {"nested": {"items": [{"ok": True}, {"values": ["a", "b"]}]}},
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
    assert svc.wait("terminal-1").status is LifecycleStatus.RUNNING
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


class RecordingRunner:
    def __init__(self, results=()):
        self.results = list(results)
        self.start_calls = []
        self.poll_calls = []
        self.stop_calls = []

    def start(self, session_id, delegation_packet):
        self.start_calls.append((session_id, delegation_packet.packet_hash))

    def poll(self, session_id):
        self.poll_calls.append(session_id)
        return self.results.pop(0) if self.results else None

    def stop(self, session_id):
        self.stop_calls.append(session_id)


def test_reused_session_requires_identical_packet_and_baseline_before_runner_call():
    runner = RecordingRunner()
    svc = DeveloperLifecycleService(runner)
    original = start(svc, "bound-session")

    assert start(svc, "bound-session") == original
    changed_packet = replace(packet(), objective="different objective")
    with pytest.raises(InvalidLifecycleTransition, match="session binding"):
        svc.start(
            changed_packet, session_id="bound-session", baseline_hash=HASH,
            context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )
    changed_baseline_packet = replace(packet(), baseline_hash=DIFFERENT)
    with pytest.raises(InvalidLifecycleTransition, match="session binding"):
        svc.start(
            changed_baseline_packet, session_id="bound-session",
            baseline_hash=DIFFERENT, context_snapshot_hash=HASH,
            parent_permission_snapshot=packet_parent_permission(),
            parent_egress_profile=packet_parent_egress(),
        )

    assert runner.start_calls == [("bound-session", packet().packet_hash)]
    assert svc.current("bound-session").packet_hash == packet().packet_hash


def test_runner_result_session_mismatch_is_rejected_without_state_or_result_promotion():
    runner = RecordingRunner([
        RawResultEnvelope("foreign-session", LifecycleStatus.COMPLETED, {"ok": True}),
    ])
    svc = DeveloperLifecycleService(runner)
    start(svc, "requested-session")

    with pytest.raises(InvalidLifecycleTransition, match="session_id mismatch"):
        svc.wait("requested-session")

    assert svc.current("requested-session").status is LifecycleStatus.PENDING
    assert svc.sessions[0].raw_result is None


@pytest.mark.parametrize("path", [
    "packages_evil/orchestration/file.py",
    "packages/orchestration_evil/file.py",
    "/packages/orchestration/file.py",
    "C:/packages/orchestration/file.py",
    "//server/share/file.py",
    "packages\\orchestration\\file.py",
    "packages/orchestration/../secret.py",
    "packages/orchestration/./file.py",
    "packages/orchestration//file.py",
    "",
])
def test_read_only_path_matching_rejects_prefix_absolute_and_noncanonical_aliases(path):
    policy = ReadOnlyPolicy()
    packet_scope = SimpleNamespace(
        allowed_paths=("packages/orchestration/**",),
        permission_snapshot=_permission(
            paths=("packages/orchestration/**",), actions=("read",),
        ),
        prohibited_actions=("write",),
    )
    with pytest.raises(ReadOnlyPolicyRejected):
        policy.authorize("read", path=path, packet=packet_scope)


def test_read_only_path_matching_is_segment_aware_for_exact_single_and_recursive_patterns():
    policy = ReadOnlyPolicy()
    packet_scope = SimpleNamespace(allowed_paths=(
        "README.md", "packages/orchestration/*", "tests/orchestration/**",
    ), permission_snapshot=_permission(
        paths=("README.md", "packages/**", "tests/orchestration/**"),
        actions=("read",),
    ), prohibited_actions=("write",))

    for allowed in (
        "README.md",
        "packages/orchestration/file.py",
        "tests/orchestration",
        "tests/orchestration/unit/test_file.py",
    ):
        policy.authorize("read", path=allowed, packet=packet_scope)
    for rejected in (
        "README.md/child",
        "packages/orchestration/nested/file.py",
        "packages/orchestration_evil/file.py",
        "tests/orchestration_evil/test_file.py",
    ):
        with pytest.raises(ReadOnlyPolicyRejected):
            policy.authorize("read", path=rejected, packet=packet_scope)


@pytest.mark.parametrize("payload", [
    {1: "coerced-key"},
    {"value": {"unordered"}},
    {"value": frozenset({"unordered"})},
    {"value": ("tuple",)},
    {"value": b"bytes"},
    {"value": float("nan")},
    {"value": float("inf")},
    {"value": "\ud800"},
])
def test_raw_result_rejects_non_json_or_nondeterministic_values(payload):
    with pytest.raises((TypeError, ValueError), match="raw result"):
        RawResultEnvelope("strict-json", LifecycleStatus.COMPLETED, payload)


def test_raw_result_artifact_is_canonical_content_addressed_and_detached_from_input():
    source = {"z": [1, {"unicode": "값"}], "a": True}
    first = RawResultEnvelope("artifact-1", LifecycleStatus.COMPLETED, source)
    second = RawResultEnvelope(
        "artifact-1", LifecycleStatus.COMPLETED,
        {"a": True, "z": [1, {"unicode": "값"}]},
    )
    expected = (
        '{"payload":{"a":true,"z":[1,{"unicode":"값"}]},'
        '"session_id":"artifact-1","status":"COMPLETED"}'
    ).encode("utf-8")

    assert isinstance(first.artifact, RawResultArtifact)
    assert first.artifact.content == expected
    assert first.artifact.sha256 == "sha256:" + hashlib.sha256(expected).hexdigest()
    assert second.artifact == first.artifact
    source["z"][1]["unicode"] = "변경"
    assert first.artifact.content == expected
    assert first.to_dict()["payload"]["z"][1]["unicode"] == "값"


def test_poll_timeout_stays_nonterminal_and_terminal_result_is_auto_received_once():
    runner = RecordingRunner([
        None,
        RawResultEnvelope("auto-result", LifecycleStatus.COMPLETED, {"ok": True}),
        RawResultEnvelope("auto-result", LifecycleStatus.FAILED, {"late": True}),
    ])
    svc = DeveloperLifecycleService(runner)
    start(svc, "auto-result")

    assert svc.wait("auto-result").status is LifecycleStatus.RUNNING
    completed = svc.wait("auto-result")
    assert completed.status is LifecycleStatus.COMPLETED
    assert completed.raw_result.to_dict()["payload"] == {"ok": True}
    assert svc.wait("auto-result") == completed
    assert runner.poll_calls == ["auto-result", "auto-result"]


def test_late_completion_after_stop_cannot_overwrite_stopped_state():
    runner = RecordingRunner([
        None,
        RawResultEnvelope("stopping", LifecycleStatus.COMPLETED, {"late": True}),
    ])
    svc = DeveloperLifecycleService(runner)
    start(svc, "stopping")
    assert svc.wait("stopping").status is LifecycleStatus.RUNNING
    assert svc.stop("stopping").status is LifecycleStatus.STOP_REQUESTED

    stopped = svc.wait("stopping")

    assert stopped.status is LifecycleStatus.STOPPED
    assert stopped.raw_result.status is LifecycleStatus.STOPPED
    assert svc.wait("stopping") == stopped
    assert runner.stop_calls == ["stopping"]
    assert runner.poll_calls == ["stopping", "stopping"]


@pytest.mark.parametrize("operation", ["start", "poll", "stop"])
def test_runner_exception_never_creates_false_lifecycle_state(operation):
    class RaisingRunner(RecordingRunner):
        def start(self, session_id, delegation_packet):
            if operation == "start":
                raise RuntimeError("runner start failed")
            super().start(session_id, delegation_packet)

        def poll(self, session_id):
            if operation == "poll":
                raise RuntimeError("runner poll failed")
            return super().poll(session_id)

        def stop(self, session_id):
            if operation == "stop":
                raise RuntimeError("runner stop failed")
            super().stop(session_id)

    svc = DeveloperLifecycleService(RaisingRunner())
    if operation == "start":
        with pytest.raises(RuntimeError, match="runner start failed"):
            start(svc, "runner-error")
        assert svc.sessions[0].status is LifecycleStatus.START_AMBIGUOUS
        return

    start(svc, "runner-error")
    if operation == "stop":
        assert svc.wait("runner-error").status is LifecycleStatus.RUNNING
    with pytest.raises(RuntimeError, match=f"runner {operation} failed"):
        getattr(svc, "wait" if operation == "poll" else "stop")("runner-error")
    expected = (
        LifecycleStatus.STOP_REQUESTED
        if operation == "stop" else LifecycleStatus.PENDING
    )
    assert svc.current("runner-error").status is expected
    assert svc.sessions[0].raw_result is None


def test_only_one_nonterminal_developer_session_can_run_at_a_time():
    runner = RecordingRunner()
    svc = DeveloperLifecycleService(runner)
    start(svc, "developer-primary-1")

    with pytest.raises(InvalidLifecycleTransition, match="one developer-primary"):
        start(svc, "developer-primary-2")

    assert tuple(session.session_id for session in svc.sessions) == ("developer-primary-1",)
    assert runner.start_calls == [("developer-primary-1", packet().packet_hash)]


def test_m1_ordered_lifecycle_waits_then_stops_and_auto_receives_raw_result():
    svc = service()

    assert start(svc, "m1-order").status is LifecycleStatus.PENDING
    assert svc.wait("m1-order").status is LifecycleStatus.RUNNING
    assert svc.stop("m1-order").status is LifecycleStatus.STOP_REQUESTED
    stopped = svc.wait("m1-order")

    assert stopped.status is LifecycleStatus.STOPPED
    assert stopped.raw_result.session_id == "m1-order"
    assert stopped.raw_result.artifact.media_type == "application/json"


def test_scoped_path_requires_a_packet_and_raw_result_rejects_cycles():
    with pytest.raises(ReadOnlyPolicyRejected, match="packet"):
        ReadOnlyPolicy().authorize("read", path="packages/orchestration/file.py")

    cyclic = []
    cyclic.append(cyclic)
    with pytest.raises(ValueError, match="raw result.*cycles"):
        RawResultEnvelope(
            "cyclic-result", LifecycleStatus.COMPLETED, {"value": cyclic},
        )


@pytest.mark.parametrize("session_id", [None, 7, "", "   "])
def test_raw_result_rejects_invalid_session_identity_fail_closed(session_id):
    with pytest.raises((TypeError, ValueError), match="session_id"):
        RawResultEnvelope(session_id, LifecycleStatus.COMPLETED, {"ok": True})


def test_wait_reuses_runner_frozen_nested_json_result_without_reenveloping():
    runner_result = RawResultEnvelope(
        "nested-runner", LifecycleStatus.COMPLETED,
        {"nested": [{"items": [1, 2]}, {"ok": True}]},
    )
    svc = DeveloperLifecycleService(RecordingRunner([runner_result]))
    start(svc, "nested-runner")

    completed = svc.wait("nested-runner")

    assert completed.status is LifecycleStatus.COMPLETED
    assert completed.raw_result is runner_result
    assert completed.raw_result.to_dict()["payload"] == {
        "nested": [{"items": [1, 2]}, {"ok": True}],
    }
    assert completed.raw_result.artifact == runner_result.artifact


def test_concurrent_start_reserves_single_developer_before_runner_call():
    class BlockingFirstStartRunner(RecordingRunner):
        def __init__(self):
            super().__init__()
            self.first_entered = threading.Event()
            self.release_first = threading.Event()
            self.call_lock = threading.Lock()

        def start(self, session_id, delegation_packet):
            with self.call_lock:
                self.start_calls.append((session_id, delegation_packet.packet_hash))
                call_number = len(self.start_calls)
            if call_number == 1:
                self.first_entered.set()
                assert self.release_first.wait(2)

    runner = BlockingFirstStartRunner()
    svc = DeveloperLifecycleService(runner)
    first_errors = []

    def start_first():
        try:
            start(svc, "developer-primary-1")
        except Exception as error:  # pragma: no cover - asserted below
            first_errors.append(error)

    thread = threading.Thread(target=start_first)
    thread.start()
    assert runner.first_entered.wait(2)
    try:
        with pytest.raises(InvalidLifecycleTransition, match="one developer-primary"):
            start(svc, "developer-primary-2")
    finally:
        runner.release_first.set()
        thread.join(2)

    assert not thread.is_alive()
    assert first_errors == []
    assert runner.start_calls == [("developer-primary-1", packet().packet_hash)]
    assert tuple(session.session_id for session in svc.sessions) == ("developer-primary-1",)


def test_stop_wins_over_stale_completion_from_concurrent_wait():
    runner_result = RawResultEnvelope(
        "wait-stop-race", LifecycleStatus.COMPLETED, {"result": [1, 2]},
    )

    class BlockingPollRunner(RecordingRunner):
        def __init__(self):
            super().__init__()
            self.poll_entered = threading.Event()
            self.release_poll = threading.Event()

        def poll(self, session_id):
            self.poll_calls.append(session_id)
            self.poll_entered.set()
            assert self.release_poll.wait(2)
            return runner_result

    runner = BlockingPollRunner()
    svc = DeveloperLifecycleService(runner)
    start(svc, "wait-stop-race")
    wait_errors = []

    def wait_for_result():
        try:
            svc.wait("wait-stop-race")
        except Exception as error:  # pragma: no cover - asserted below
            wait_errors.append(error)

    thread = threading.Thread(target=wait_for_result)
    thread.start()
    assert runner.poll_entered.wait(2)
    assert svc.stop("wait-stop-race").status is LifecycleStatus.STOP_REQUESTED
    runner.release_poll.set()
    thread.join(2)

    assert not thread.is_alive()
    assert wait_errors == []
    current = svc.sessions[0]
    assert current.status is LifecycleStatus.STOPPED
    assert current.raw_result.status is LifecycleStatus.STOPPED
    assert runner.stop_calls == ["wait-stop-race"]


def test_ambiguous_start_is_tracked_and_blocks_another_developer_until_stopped():
    class AmbiguousStartRunner(RecordingRunner):
        def start(self, session_id, delegation_packet):
            self.start_calls.append((session_id, delegation_packet.packet_hash))
            raise TimeoutError("runner start outcome unknown")

    runner = AmbiguousStartRunner()
    svc = DeveloperLifecycleService(runner)

    with pytest.raises(TimeoutError, match="outcome unknown"):
        start(svc, "ambiguous-start")

    assert tuple(session.session_id for session in svc.sessions) == ("ambiguous-start",)
    assert svc.sessions[0].status is LifecycleStatus.START_AMBIGUOUS
    with pytest.raises(InvalidLifecycleTransition, match="one developer-primary"):
        start(svc, "second-developer")
    assert svc.wait("ambiguous-start").status is LifecycleStatus.RUNNING
    assert svc.stop("ambiguous-start").status is LifecycleStatus.STOP_REQUESTED
    assert runner.stop_calls == ["ambiguous-start"]


def test_public_authorize_intersects_global_policy_with_child_action_snapshot():
    parent_permission = _permission(
        paths=("packages/**",), actions=("read", "test", "list", "inspect"),
    )
    child_permission = _permission(paths=("packages/orchestration/**",), actions=("read",))
    value = replace(
        complete_packet(),
        allowed_paths=child_permission.allowed_paths,
        prohibited_actions=child_permission.prohibited_actions,
        permission_snapshot=child_permission,
        permission_snapshot_hash=child_permission.snapshot_hash,
        parent_permission_snapshot_hash=parent_permission.snapshot_hash,
    )
    svc = DeveloperLifecycleService(RecordingRunner())
    svc.start(
        value, session_id="child-actions", baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    svc.authorize("child-actions", "read", path="packages/orchestration/file.py")
    for action in ("test", "list", "inspect", "READ", " read ", "write"):
        with pytest.raises(ReadOnlyPolicyRejected):
            svc.authorize(
                "child-actions", action, path="packages/orchestration/file.py",
            )


def test_public_authorize_rejects_missing_or_malformed_child_permission_snapshot():
    policy = ReadOnlyPolicy()
    for malformed in (
        SimpleNamespace(allowed_paths=("packages/**",)),
        SimpleNamespace(
            allowed_paths=("packages/**",),
            permission_snapshot=SimpleNamespace(allowed_actions=("read",)),
            prohibited_actions=(),
        ),
    ):
        with pytest.raises(ReadOnlyPolicyRejected, match="permission"):
            policy.authorize("read", path="packages/file.py", packet=malformed)


def test_c04_checkpoint_legacy_tuple_and_set_freeze_remains_compatible():
    checkpoint = CheckpointHandoff(
        "legacy-checkpoint", "sha256:" + "c" * 64,
        {"cursor": (1, 2), "labels": {"a", "b"}},
        "legacy-session", "del-1", packet().packet_hash,
    )

    thawed = checkpoint.to_dict()["state"]
    assert thawed["cursor"] == [1, 2]
    assert set(thawed["labels"]) == {"a", "b"}
    with pytest.raises(TypeError):
        checkpoint.state["cursor"] = ()


def test_pending_session_cannot_stop_before_first_wait():
    runner = RecordingRunner()
    svc = DeveloperLifecycleService(runner)
    start(svc, "pending-stop-order")

    with pytest.raises(InvalidLifecycleTransition, match="RUNNING"):
        svc.stop("pending-stop-order")

    assert svc.current("pending-stop-order").status is LifecycleStatus.PENDING
    assert runner.stop_calls == []


@pytest.mark.parametrize("intervention", ["steer", "resume", "stop"])
def test_one_shot_terminal_poll_preserves_concurrent_intervention(intervention):
    session_id = "terminal-intervention"
    result = RawResultEnvelope(session_id, LifecycleStatus.COMPLETED, {"answer": [42]})

    class BarrierPoll(RecordingRunner):
        def __init__(self):
            super().__init__([result])
            self.entered = threading.Event()
            self.release = threading.Event()

        def poll(self, session_id):
            captured = super().poll(session_id)
            self.entered.set()
            assert self.release.wait(2)
            return captured

    runner = BarrierPoll()
    svc = DeveloperLifecycleService(runner)
    start(svc, session_id)
    checkpoint = CheckpointHandoff(
        "concurrent-checkpoint", HASH, {"cursor": 7},
        session_id, "del-1", packet().packet_hash,
    )
    errors = []

    def poll():
        try:
            svc.wait(session_id)
        except Exception as error:
            errors.append(error)

    thread = threading.Thread(target=poll)
    thread.start()
    try:
        assert runner.entered.wait(2)
        svc.steer(session_id, "preserve this instruction")
        if intervention == "resume":
            svc.pause(session_id, checkpoint)
            svc.resume(session_id, packet().packet_hash)
        elif intervention == "stop":
            svc.stop(session_id)
    finally:
        runner.release.set()
        thread.join(2)

    assert not thread.is_alive()
    assert errors == []
    terminal = svc.wait(session_id)
    expected = LifecycleStatus.STOPPED if intervention == "stop" else LifecycleStatus.COMPLETED
    assert terminal.status is expected
    assert terminal.raw_result.to_dict()["payload"] == {"answer": [42]}
    assert terminal.raw_result.status is expected
    assert terminal.next_instruction == "preserve this instruction"
    assert terminal.checkpoint == (checkpoint if intervention == "resume" else None)
    assert terminal.resume_epoch == (1 if intervention == "resume" else 0)
    assert runner.poll_calls == [session_id]


def test_failed_stop_delivery_can_retry_without_false_terminal_or_duplicate_success():
    class FlakyStop(RecordingRunner):
        def __init__(self):
            super().__init__()
            self.alive = True

        def stop(self, session_id):
            super().stop(session_id)
            if len(self.stop_calls) == 1:
                raise TimeoutError("stop failed before delivery")
            self.alive = False

        def poll(self, session_id):
            if not self.alive:
                return RawResultEnvelope(session_id, LifecycleStatus.STOPPED, {"cancelled": True})
            return None

    runner = FlakyStop()
    svc = DeveloperLifecycleService(runner)
    start(svc, "retry-stop")
    svc.wait("retry-stop")
    with pytest.raises(TimeoutError, match="before delivery"):
        svc.stop("retry-stop")
    assert svc.wait("retry-stop").status is LifecycleStatus.STOP_REQUESTED
    assert svc.sessions[0].raw_result is None
    with pytest.raises(InvalidLifecycleTransition, match="one developer-primary"):
        start(svc, "other-developer")

    assert svc.stop("retry-stop").status is LifecycleStatus.STOP_REQUESTED
    assert svc.stop("retry-stop").status is LifecycleStatus.STOP_REQUESTED
    terminal = svc.wait("retry-stop")
    assert terminal.status is LifecycleStatus.STOPPED
    assert terminal.raw_result.to_dict()["payload"] == {"cancelled": True}
    assert runner.stop_calls == ["retry-stop", "retry-stop"]


@pytest.mark.parametrize("fail_after_delivery", [False, True])
def test_stop_in_flight_is_not_duplicated_and_terminal_poll_reconciles_delivery(fail_after_delivery):
    class BarrierStop(RecordingRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()
            self.delivered = False

        def stop(self, session_id):
            super().stop(session_id)
            self.entered.set()
            assert self.release.wait(2)
            self.delivered = True
            if fail_after_delivery:
                raise TimeoutError("delivery acknowledgement lost")

        def poll(self, session_id):
            if self.delivered:
                return RawResultEnvelope(session_id, LifecycleStatus.STOPPED, {"stopped": True})
            return None

    runner = BarrierStop()
    svc = DeveloperLifecycleService(runner)
    start(svc, "stop-in-flight")
    svc.wait("stop-in-flight")
    errors = []

    def stop():
        try:
            svc.stop("stop-in-flight")
        except Exception as error:
            errors.append(error)

    thread = threading.Thread(target=stop)
    thread.start()
    try:
        assert runner.entered.wait(2)
        assert svc.stop("stop-in-flight").status is LifecycleStatus.STOP_REQUESTED
        assert svc.wait("stop-in-flight").status is LifecycleStatus.STOP_REQUESTED
        assert svc.sessions[0].raw_result is None
    finally:
        runner.release.set()
        thread.join(2)

    assert not thread.is_alive()
    if fail_after_delivery:
        assert len(errors) == 1
        assert isinstance(errors[0], TimeoutError)
    else:
        assert errors == []
        assert svc.stop("stop-in-flight").status is LifecycleStatus.STOP_REQUESTED
    reconciled = svc.wait("stop-in-flight")
    assert reconciled.status is LifecycleStatus.STOPPED
    assert reconciled.raw_result.to_dict()["payload"] == {"stopped": True}
    assert svc.stop("stop-in-flight") == reconciled
    assert runner.stop_calls == ["stop-in-flight"]
