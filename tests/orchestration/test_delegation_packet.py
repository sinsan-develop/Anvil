import json
from dataclasses import replace

import pytest

from packages.orchestration import DelegationPacket, validate_packet


HASH = "sha256:" + "a" * 64
OTHER = "sha256:" + "b" * 64


def packet() -> DelegationPacket:
    return DelegationPacket(
        delegation_id="del-1",
        parent_run_id="run-1",
        parent_agent_id="main-1",
        work_instruction_id="wi-1",
        plan_revision=1,
        step_id="C-02",
        objective="Implement the packet contract",
        allowed_paths=("packages/orchestration/**", "tests/orchestration/**"),
        prohibited_actions=("git push", "secret read", "external network"),
        completion_conditions=("tests pass", "compileall passes"),
        baseline_hash=HASH,
        permission_snapshot_hash=HASH,
        context_snapshot_hash=HASH,
        egress_snapshot_hash=HASH,
    )


def test_packet_validates_and_round_trips_deterministically():
    value = packet()
    assert validate_packet(
        value,
        baseline_hash=HASH,
        permission_snapshot_hash=HASH,
        context_snapshot_hash=HASH,
        egress_snapshot_hash=HASH,
    ).valid
    assert DelegationPacket.from_json(value.to_json()) == value
    assert value.to_json() == DelegationPacket.from_dict(json.loads(value.to_json())).to_json()
    assert value.packet_hash.startswith("sha256:")


@pytest.mark.parametrize("field", [
    "objective", "allowed_paths", "prohibited_actions", "completion_conditions",
    "baseline_hash", "permission_snapshot_hash", "context_snapshot_hash", "egress_snapshot_hash",
])
def test_required_field_or_value_tampering_is_rejected(field):
    data = packet().to_dict()
    data.pop(field)
    result = validate_packet(
        data,
        baseline_hash=HASH,
        permission_snapshot_hash=HASH,
        context_snapshot_hash=HASH,
        egress_snapshot_hash=HASH,
    )
    assert result.valid is False
    assert result.reason_codes == ("REQUIRED_FIELD_MISSING",)


@pytest.mark.parametrize("field,reason", [
    ("baseline_hash", "BASELINE_SNAPSHOT_MISMATCH"),
    ("permission_snapshot_hash", "PERMISSION_SNAPSHOT_MISMATCH"),
    ("context_snapshot_hash", "CONTEXT_SNAPSHOT_MISMATCH"),
    ("egress_snapshot_hash", "EGRESS_SNAPSHOT_MISMATCH"),
])
def test_snapshot_mismatch_returns_deterministic_reason(field, reason):
    data = packet().to_dict()
    data[field] = OTHER
    result = validate_packet(
        data,
        baseline_hash=HASH,
        permission_snapshot_hash=HASH,
        context_snapshot_hash=HASH,
        egress_snapshot_hash=HASH,
    )
    assert result.valid is False
    assert result.reason_codes == (reason,)
    assert result.fields == (field,)


def test_hostile_paths_and_scope_conflict_are_rejected():
    data = packet().to_dict()
    data["allowed_paths"] = ["../outside"]
    result = validate_packet(
        data,
        baseline_hash=HASH,
        permission_snapshot_hash=HASH,
        context_snapshot_hash=HASH,
        egress_snapshot_hash=HASH,
    )
    assert result.reason_codes == ("PATH_NOT_CANONICAL",)

    with pytest.raises(ValueError, match="must not overlap"):
        replace(packet(), prohibited_actions=("packages/orchestration/**",))


def test_invalid_json_and_missing_packet_fail_closed():
    with pytest.raises(ValueError, match="packet JSON is invalid"):
        DelegationPacket.from_json("not-json")
    result = validate_packet(
        None,
        baseline_hash=HASH,
        permission_snapshot_hash=HASH,
        context_snapshot_hash=HASH,
        egress_snapshot_hash=HASH,
    )
    assert result.reason_codes == ("PACKET_REQUIRED",)
