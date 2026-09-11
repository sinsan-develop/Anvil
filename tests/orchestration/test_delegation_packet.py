import json
from dataclasses import replace

import pytest

from packages.orchestration import DelegationPacket, validate_packet


HASH = "sha256:" + "a" * 64
OTHER = "sha256:" + "b" * 64


def packet() -> DelegationPacket:
    parent_permission = _permission(
        paths=("packages/**", "tests/**"),
        denied_actions=("git push", "secret read", "external network"),
    )
    child_permission = _permission(
        paths=("packages/orchestration/**", "tests/orchestration/**"),
        denied_actions=("git push", "secret read", "external network"),
    )
    parent_egress = _egress(approved=("packages/**", "tests/**"))
    child_egress = _egress(approved=child_permission.allowed_paths)
    return DelegationPacket(
        delegation_id="del-1",
        parent_run_id="run-1",
        parent_agent_id="main-1",
        work_instruction_id="wi-1",
        plan_revision=1,
        step_id="C-02",
        workspace_id="ws-1",
        objective="Implement the packet contract",
        in_scope=("delegation packet",),
        out_of_scope=("runner implementation",),
        allowed_paths=child_permission.allowed_paths,
        prohibited_actions=child_permission.prohibited_actions,
        permission_profile_id="perm-child",
        expected_result_schema="subagent_result/v1",
        required_evidence=("diff", "commands", "exit_codes", "tests"),
        budget_ref="budget-1",
        completion_conditions=("tests pass", "compileall passes"),
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        permission_snapshot=child_permission,
        permission_snapshot_hash=child_permission.snapshot_hash,
        parent_permission_snapshot_hash=parent_permission.snapshot_hash,
        data_egress_profile=child_egress,
        egress_snapshot_hash=child_egress.snapshot_hash,
        parent_egress_snapshot_hash=parent_egress.snapshot_hash,
    )


def packet_parent_permission():
    return _permission(
        paths=("packages/**", "tests/**"),
        denied_actions=("git push", "secret read", "external network"),
    )


def packet_parent_egress():
    return _egress(approved=("packages/**", "tests/**"))


def test_packet_validates_and_round_trips_deterministically():
    value = packet()
    assert validate_packet(
        value,
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
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
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert result.valid is False
    assert result.reason_codes == ("REQUIRED_FIELD_MISSING",)


@pytest.mark.parametrize("field,reason", [
    ("baseline_hash", "BASELINE_SNAPSHOT_MISMATCH"),
    ("context_snapshot_hash", "CONTEXT_SNAPSHOT_MISMATCH"),
])
def test_snapshot_mismatch_returns_deterministic_reason(field, reason):
    data = replace(packet(), **{field: OTHER})
    result = validate_packet(
        data,
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
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
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert result.reason_codes == ("PATH_NOT_CANONICAL",)


def test_invalid_json_and_missing_packet_fail_closed():
    with pytest.raises(ValueError, match="packet JSON is invalid"):
        DelegationPacket.from_json("not-json")
    result = validate_packet(
        None,
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
    )
    assert result.reason_codes == ("PACKET_REQUIRED",)


def test_permission_and_egress_snapshots_are_immutable_and_canonically_hashed():
    from packages.orchestration import DataEgressProfile, PermissionSnapshot

    permission = PermissionSnapshot(
        allowed_paths=("packages/orchestration/**",),
        allowed_actions=("read", "test"),
        allowed_tools=("read_file", "pytest"),
        allowed_backends=("codex",),
        prohibited_paths=("secrets/**",),
        protected_paths=("migrations/**",),
        prohibited_actions=("git push", "external network"),
    )
    egress = DataEgressProfile(
        mode="approved_paths",
        provider_allowlist=("openai",),
        approved_paths=("packages/orchestration/**",),
        excluded_paths=("secrets/**",),
    )

    assert permission.snapshot_hash == PermissionSnapshot.from_dict(permission.to_dict()).snapshot_hash
    assert egress.snapshot_hash == DataEgressProfile.from_dict(egress.to_dict()).snapshot_hash
    with pytest.raises((AttributeError, TypeError)):
        permission.allowed_paths += ("private/**",)
    with pytest.raises((AttributeError, TypeError)):
        egress.provider_allowlist += ("other",)


def _permission(*, paths=("packages/orchestration/**",), actions=("read", "test"),
                tools=("read_file", "pytest"), backends=("codex",),
                denied_paths=("secrets/**",), protected_paths=("migrations/**",),
                denied_actions=("git push", "external network")):
    from packages.orchestration import PermissionSnapshot
    return PermissionSnapshot(paths, actions, tools, backends, denied_paths,
                              protected_paths, denied_actions)


def _egress(*, mode="approved_paths", providers=("openai",),
            approved=("packages/orchestration/**",), excluded=("secrets/**",)):
    from packages.orchestration import DataEgressProfile
    return DataEgressProfile(mode, providers, approved, excluded)


def complete_packet():
    child_permission = _permission()
    child_egress = _egress()
    return DelegationPacket(
        delegation_id="del-full", parent_run_id="run-full", parent_agent_id="main-1",
        work_instruction_id="wi-full", plan_revision=2, step_id="C-02",
        workspace_id="ws-1", objective="Implement the complete packet contract",
        in_scope=("delegation validation",), out_of_scope=("runner implementation",),
        allowed_paths=child_permission.allowed_paths,
        prohibited_actions=child_permission.prohibited_actions,
        permission_profile_id="perm-child", expected_result_schema="subagent_result/v1",
        required_evidence=("diff", "commands", "exit_codes", "tests"),
        budget_ref="budget-1", completion_conditions=("tests pass",),
        baseline_hash=HASH, context_snapshot_hash=HASH,
        permission_snapshot=child_permission,
        permission_snapshot_hash=child_permission.snapshot_hash,
        parent_permission_snapshot_hash=_permission(paths=("packages/**",)).snapshot_hash,
        data_egress_profile=child_egress,
        egress_snapshot_hash=child_egress.snapshot_hash,
        parent_egress_snapshot_hash=_egress(approved=("packages/**",)).snapshot_hash,
    )


def test_complete_packet_schema_round_trips_with_canonical_packet_hash():
    value = complete_packet()
    encoded = value.to_json()
    decoded = json.loads(encoded)

    assert decoded["packet_hash"] == value.packet_hash
    assert decoded["permission_snapshot"]["allowed_tools"] == ["read_file", "pytest"]
    assert decoded["data_egress_profile"]["mode"] == "approved_paths"
    assert DelegationPacket.from_json(encoded) == value
    assert value.packet_hash == complete_packet().packet_hash


def test_validation_receipt_binds_parent_and_child_snapshot_content():
    value = complete_packet()
    parent_permission = _permission(paths=("packages/**",))
    parent_egress = _egress(approved=("packages/**",))

    receipt = validate_packet(
        value,
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=parent_egress,
    )

    assert receipt.valid is True
    assert receipt.verdict == "ACCEPT"
    assert receipt.packet_hash == value.packet_hash
    assert receipt.parent_permission_snapshot_hash == parent_permission.snapshot_hash
    assert receipt.child_permission_snapshot_hash == value.permission_snapshot.snapshot_hash
    assert receipt.parent_egress_snapshot_hash == parent_egress.snapshot_hash
    assert receipt.child_egress_snapshot_hash == value.data_egress_profile.snapshot_hash
    assert receipt.reason_codes == ()
    assert receipt.fields == ()
    assert receipt == validate_packet(
        value,
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=parent_egress,
    )


@pytest.mark.parametrize("child,reason,field", [
    (_permission(paths=("packages/orchestration/**", "private/**")),
     "CHILD_PATH_SCOPE_EXPANSION", "permission_snapshot.allowed_paths"),
    (_permission(actions=("read", "test", "write")),
     "CHILD_ACTION_SCOPE_EXPANSION", "permission_snapshot.allowed_actions"),
    (_permission(tools=("read_file", "pytest", "shell")),
     "CHILD_TOOL_SCOPE_EXPANSION", "permission_snapshot.allowed_tools"),
    (_permission(backends=("codex", "claude")),
     "CHILD_BACKEND_SCOPE_EXPANSION", "permission_snapshot.allowed_backends"),
    (_permission(denied_paths=()),
     "CHILD_PROHIBITED_PATH_RELAXATION", "permission_snapshot.prohibited_paths"),
    (_permission(protected_paths=()),
     "CHILD_PROTECTED_PATH_RELAXATION", "permission_snapshot.protected_paths"),
    (_permission(denied_actions=("external network",)),
     "CHILD_PROHIBITED_ACTION_RELAXATION", "permission_snapshot.prohibited_actions"),
])
def test_child_permission_cannot_expand_or_relax_parent(child, reason, field):
    parent = _permission(paths=("packages/**",))
    value = replace(
        complete_packet(),
        allowed_paths=child.allowed_paths,
        prohibited_actions=child.prohibited_actions,
        permission_snapshot=child,
        permission_snapshot_hash=child.snapshot_hash,
        parent_permission_snapshot_hash=parent.snapshot_hash,
    )

    receipt = validate_packet(
        value, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=parent,
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    assert receipt.valid is False
    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("child,reason,field", [
    (_egress(mode="masked_content"),
     "EGRESS_MODE_MISMATCH", "data_egress_profile.mode"),
    (_egress(providers=("openai", "other")),
     "EGRESS_PROVIDER_EXPANSION", "data_egress_profile.provider_allowlist"),
    (_egress(approved=("packages/orchestration/**", "private/**")),
     "EGRESS_APPROVED_PATH_EXPANSION", "data_egress_profile.approved_paths"),
    (_egress(excluded=()),
     "EGRESS_EXCLUDED_PATH_RELAXATION", "data_egress_profile.excluded_paths"),
])
def test_child_egress_requires_equal_mode_and_narrower_content(child, reason, field):
    parent = _egress(approved=("packages/**",))
    value = replace(
        complete_packet(), data_egress_profile=child,
        egress_snapshot_hash=child.snapshot_hash,
        parent_egress_snapshot_hash=parent.snapshot_hash,
    )

    receipt = validate_packet(
        value, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=parent,
    )

    assert receipt.valid is False
    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


def test_hostile_json_duplicate_nan_and_unknown_fields_fail_closed():
    with pytest.raises(ValueError, match="DUPLICATE_JSON_KEY:x"):
        DelegationPacket.from_json('{"x":1,"x":2}')
    with pytest.raises(ValueError, match="NON_FINITE_NUMBER:NaN"):
        DelegationPacket.from_json('{"x":NaN}')

    unknown = complete_packet().to_dict()
    unknown["surprise"] = True
    with pytest.raises(ValueError, match="UNKNOWN_FIELD:surprise"):
        DelegationPacket.from_dict(unknown)


@pytest.mark.parametrize("field,replacement,reason", [
    ("objective", None, "REQUIRED_FIELD_MISSING"),
    ("objective", "", "EMPTY_FIELD"),
    ("plan_revision", True, "INVALID_FIELD_TYPE"),
    ("baseline_hash", "SHA256:" + "A" * 64, "INVALID_HASH"),
    ("packet_hash", OTHER, "PACKET_HASH_MISMATCH"),
])
def test_invalid_packet_fields_return_exact_reason_and_field(field, replacement, reason):
    data = complete_packet().to_dict()
    if replacement is None:
        data.pop(field)
    else:
        data[field] = replacement

    receipt = validate_packet(
        data, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    assert receipt.valid is False
    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("snapshot_field,mutated_field,reason,field", [
    ("permission_snapshot", "allowed_tools", "PERMISSION_SNAPSHOT_MISMATCH",
     "permission_snapshot_hash"),
    ("data_egress_profile", "provider_allowlist", "EGRESS_SNAPSHOT_MISMATCH",
     "egress_snapshot_hash"),
])
def test_child_snapshot_content_tampering_is_rejected(snapshot_field, mutated_field, reason, field):
    data = complete_packet().to_dict()
    data[snapshot_field][mutated_field].append("tampered")

    receipt = validate_packet(
        data, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("kind,reason,field", [
    ("baseline", "BASELINE_SNAPSHOT_MISMATCH", "baseline_hash"),
    ("context", "CONTEXT_SNAPSHOT_MISMATCH", "context_snapshot_hash"),
    ("parent_permission", "PARENT_PERMISSION_SNAPSHOT_MISMATCH",
     "parent_permission_snapshot_hash"),
    ("parent_egress", "PARENT_EGRESS_SNAPSHOT_MISMATCH",
     "parent_egress_snapshot_hash"),
])
def test_stale_current_or_parent_snapshot_is_rejected(kind, reason, field):
    value = complete_packet()
    baseline = OTHER if kind == "baseline" else HASH
    context = OTHER if kind == "context" else HASH
    parent_permission = _permission(
        paths=("packages/**",),
        actions=("read", "test", "write") if kind == "parent_permission" else ("read", "test"),
    )
    parent_egress = _egress(
        approved=("packages/**",),
        providers=("openai", "other") if kind == "parent_egress" else ("openai",),
    )

    receipt = validate_packet(
        value, baseline_hash=baseline, context_snapshot_hash=context,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=parent_egress,
    )

    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("hostile", [
    "C:/repo/file.py", "//server/share", "/absolute", "dir\\file.py",
    "./file.py", "dir/../file.py", "dir//file.py", "dir/*.py", "dir/?",
])
def test_hostile_repository_paths_are_rejected_with_exact_field(hostile):
    with pytest.raises(ValueError, match="PATH_NOT_CANONICAL:allowed_paths"):
        _permission(paths=(hostile,))


def test_duplicate_and_allow_deny_overlaps_fail_closed():
    with pytest.raises(ValueError, match="DUPLICATE_VALUE:allowed_paths"):
        _permission(paths=("packages/**", "packages/**"))
    with pytest.raises(ValueError, match="ALLOW_DENY_OVERLAP:allowed_paths"):
        _permission(paths=("packages/**",), denied_paths=("packages/private/**",))
    with pytest.raises(ValueError, match="ALLOW_DENY_OVERLAP:approved_paths"):
        _egress(approved=("packages/**",), excluded=("packages/private/**",))


def test_parent_snapshot_content_is_required_for_validation():
    receipt = validate_packet(
        complete_packet(), baseline_hash=HASH, context_snapshot_hash=HASH,
    )

    assert receipt.valid is False
    assert receipt.reason_codes == ("VALIDATION_INPUT_REQUIRED",)
    assert receipt.fields == ("parent_permission_snapshot", "parent_egress_profile")


@pytest.mark.parametrize("mutation,reason,field", [
    (lambda data: data["permission_snapshot"].__setitem__("surprise", True),
     "UNKNOWN_FIELD", "permission_snapshot.surprise"),
    (lambda data: data["data_egress_profile"].pop("mode"),
     "REQUIRED_FIELD_MISSING", "data_egress_profile.mode"),
    (lambda data: data["data_egress_profile"].__setitem__("provider_allowlist", "openai"),
     "INVALID_FIELD_TYPE", "data_egress_profile.provider_allowlist"),
    (lambda data: data["permission_snapshot"]["prohibited_actions"].append("git push"),
     "DUPLICATE_VALUE", "permission_snapshot.prohibited_actions"),
    (lambda data: data.__setitem__("required_evidence", []),
     "EMPTY_FIELD", "required_evidence"),
])
def test_nested_and_sequence_schema_errors_return_exact_fields(mutation, reason, field):
    data = complete_packet().to_dict()
    mutation(data)

    receipt = validate_packet(
        data, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("parent_permission,parent_egress,reason,field", [
    ({"schema_version": "permission_snapshot/v1"}, _egress(approved=("packages/**",)),
     "REQUIRED_FIELD_MISSING", "parent_permission_snapshot.allowed_actions"),
    (_permission(paths=("packages/**",)), {
        "schema_version": "data_egress_profile/v1", "mode": "approved_paths",
        "provider_allowlist": "openai", "approved_paths": ["packages/**"],
        "excluded_paths": ["secrets/**"],
    }, "INVALID_FIELD_TYPE", "parent_egress_profile.provider_allowlist"),
])
def test_malformed_parent_validation_inputs_fail_closed(
    parent_permission, parent_egress, reason, field,
):
    receipt = validate_packet(
        complete_packet(), baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=parent_egress,
    )

    assert receipt.reason_codes == (reason,)
    assert receipt.fields[0] == field


def test_validation_receipt_has_canonical_reproducible_json():
    value = complete_packet()
    receipt = validate_packet(
        value, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=_egress(approved=("packages/**",)),
    )
    expected = {
        "schema_version": "delegation_validation_receipt/v2",
        "submitted_delegation_id": value.delegation_id,
        "submitted_packet_hash": value.packet_hash,
        "verified_packet_hash": value.packet_hash,
        "submitted_parent_permission_snapshot_hash": value.parent_permission_snapshot_hash,
        "submitted_child_permission_snapshot_hash": value.permission_snapshot_hash,
        "submitted_parent_egress_snapshot_hash": value.parent_egress_snapshot_hash,
        "submitted_child_egress_snapshot_hash": value.egress_snapshot_hash,
        "verified_parent_permission_snapshot_hash": value.parent_permission_snapshot_hash,
        "verified_child_permission_snapshot_hash": value.permission_snapshot_hash,
        "verified_parent_egress_snapshot_hash": value.parent_egress_snapshot_hash,
        "verified_child_egress_snapshot_hash": value.egress_snapshot_hash,
        "verdict": "ACCEPT", "reason_codes": [], "fields": [],
    }

    assert receipt.to_dict() == expected
    assert receipt.to_json() == json.dumps(
        expected, ensure_ascii=False, allow_nan=False,
        sort_keys=True, separators=(",", ":"),
    )


def test_early_rejection_receipt_preserves_submitted_identity_and_verified_snapshots():
    parent_permission = _permission(paths=("packages/**",))
    parent_egress = _egress(approved=("packages/**",))
    submitted = []
    for delegation_id in ("early-reject-1", "early-reject-2"):
        value = replace(complete_packet(), delegation_id=delegation_id).to_dict()
        value["objective"] = ""
        submitted.append(value)

    receipts = [
        validate_packet(
            value, baseline_hash=HASH, context_snapshot_hash=HASH,
            parent_permission_snapshot=parent_permission,
            parent_egress_profile=parent_egress,
        )
        for value in submitted
    ]

    for value, receipt in zip(submitted, receipts):
        assert receipt.reason_codes == ("EMPTY_FIELD",)
        assert receipt.fields == ("objective",)
        assert receipt.submitted_delegation_id == value["delegation_id"]
        assert receipt.submitted_packet_hash == value["packet_hash"]
        assert receipt.verified_packet_hash is None
        assert receipt.submitted_parent_permission_snapshot_hash == value["parent_permission_snapshot_hash"]
        assert receipt.submitted_child_permission_snapshot_hash == value["permission_snapshot_hash"]
        assert receipt.submitted_parent_egress_snapshot_hash == value["parent_egress_snapshot_hash"]
        assert receipt.submitted_child_egress_snapshot_hash == value["egress_snapshot_hash"]
        assert receipt.parent_permission_snapshot_hash == parent_permission.snapshot_hash
        assert receipt.child_permission_snapshot_hash == value["permission_snapshot_hash"]
        assert receipt.parent_egress_snapshot_hash == parent_egress.snapshot_hash
        assert receipt.child_egress_snapshot_hash == value["egress_snapshot_hash"]
    assert receipts[0].to_json() != receipts[1].to_json()


def test_non_positive_plan_revision_rejects_with_exact_scalar_field():
    submitted = complete_packet().to_dict()
    submitted["plan_revision"] = 0

    receipt = validate_packet(
        submitted, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    assert receipt.reason_codes == ("INVALID_FIELD_VALUE",)
    assert receipt.fields == ("plan_revision",)


_PACKET_TEXT_FIELDS = (
    "delegation_id", "parent_run_id", "parent_agent_id", "work_instruction_id",
    "step_id", "workspace_id", "objective", "permission_profile_id",
    "expected_result_schema", "budget_ref", "schema_version",
)
_PACKET_ARRAY_FIELDS = (
    "in_scope", "out_of_scope", "allowed_paths", "prohibited_actions",
    "required_evidence", "completion_conditions",
)
_PERMISSION_ARRAY_FIELDS = (
    "allowed_paths", "allowed_actions", "allowed_tools", "allowed_backends",
    "prohibited_paths", "protected_paths", "prohibited_actions",
)
_EGRESS_ARRAY_FIELDS = ("provider_allowlist", "approved_paths", "excluded_paths")


@pytest.mark.parametrize("location,field", (
    *(("packet_text", field) for field in _PACKET_TEXT_FIELDS),
    *(("packet_array", field) for field in _PACKET_ARRAY_FIELDS),
    ("child_permission_text", "schema_version"),
    *(("child_permission_array", field) for field in _PERMISSION_ARRAY_FIELDS),
    ("child_egress_text", "schema_version"), ("child_egress_text", "mode"),
    *(("child_egress_array", field) for field in _EGRESS_ARRAY_FIELDS),
    ("parent_permission_text", "schema_version"),
    *(("parent_permission_array", field) for field in _PERMISSION_ARRAY_FIELDS),
    ("parent_egress_text", "schema_version"), ("parent_egress_text", "mode"),
    *(("parent_egress_array", field) for field in _EGRESS_ARRAY_FIELDS),
))
def test_unpaired_unicode_surrogate_in_every_text_boundary_is_rejected(location, field):
    surrogate = "\ud800"
    submitted = complete_packet().to_dict()
    parent_permission = _permission(paths=("packages/**",)).to_dict()
    parent_egress = _egress(approved=("packages/**",)).to_dict()
    target_by_location = {
        "packet_text": submitted,
        "packet_array": submitted,
        "child_permission_text": submitted["permission_snapshot"],
        "child_permission_array": submitted["permission_snapshot"],
        "child_egress_text": submitted["data_egress_profile"],
        "child_egress_array": submitted["data_egress_profile"],
        "parent_permission_text": parent_permission,
        "parent_permission_array": parent_permission,
        "parent_egress_text": parent_egress,
        "parent_egress_array": parent_egress,
    }
    target = target_by_location[location]
    target[field] = [surrogate] if location.endswith("_array") else surrogate
    prefix_by_location = {
        "child_permission_text": "permission_snapshot",
        "child_permission_array": "permission_snapshot",
        "child_egress_text": "data_egress_profile",
        "child_egress_array": "data_egress_profile",
        "parent_permission_text": "parent_permission_snapshot",
        "parent_permission_array": "parent_permission_snapshot",
        "parent_egress_text": "parent_egress_profile",
        "parent_egress_array": "parent_egress_profile",
    }
    qualified = f"{prefix_by_location[location]}.{field}" if location in prefix_by_location else field

    receipt = validate_packet(
        submitted, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=parent_egress,
    )

    assert receipt.reason_codes == ("INVALID_TEXT_ENCODING",)
    assert receipt.fields == (qualified,)
    receipt.to_json().encode("utf-8")


@pytest.mark.parametrize("kind,reason,field", [
    ("packet_schema", "UNSUPPORTED_SCHEMA_VERSION", "schema_version"),
    ("child_permission_schema", "UNSUPPORTED_SCHEMA_VERSION", "permission_snapshot.schema_version"),
    ("parent_permission_schema", "UNSUPPORTED_SCHEMA_VERSION", "parent_permission_snapshot.schema_version"),
    ("child_egress_schema", "UNSUPPORTED_SCHEMA_VERSION", "data_egress_profile.schema_version"),
    ("parent_egress_schema", "UNSUPPORTED_SCHEMA_VERSION", "parent_egress_profile.schema_version"),
    ("child_egress_mode", "UNSUPPORTED_EGRESS_MODE", "data_egress_profile.mode"),
    ("parent_egress_mode", "UNSUPPORTED_EGRESS_MODE", "parent_egress_profile.mode"),
    ("child_permission_overlap", "ALLOW_DENY_OVERLAP", "permission_snapshot.prohibited_paths"),
    ("child_egress_overlap", "ALLOW_DENY_OVERLAP", "data_egress_profile.excluded_paths"),
])
def test_structured_contract_errors_preserve_exact_reason_and_field(kind, reason, field):
    submitted = complete_packet().to_dict()
    parent_permission = _permission(paths=("packages/**",)).to_dict()
    parent_egress = _egress(approved=("packages/**",)).to_dict()
    if kind == "packet_schema":
        submitted["schema_version"] = "delegation_packet/v999"
    elif kind == "child_permission_schema":
        submitted["permission_snapshot"]["schema_version"] = "permission_snapshot/v999"
    elif kind == "parent_permission_schema":
        parent_permission["schema_version"] = "permission_snapshot/v999"
    elif kind == "child_egress_schema":
        submitted["data_egress_profile"]["schema_version"] = "data_egress_profile/v999"
    elif kind == "parent_egress_schema":
        parent_egress["schema_version"] = "data_egress_profile/v999"
    elif kind == "child_egress_mode":
        submitted["data_egress_profile"]["mode"] = "unrestricted"
    elif kind == "parent_egress_mode":
        parent_egress["mode"] = "unrestricted"
    elif kind == "child_permission_overlap":
        submitted["permission_snapshot"]["prohibited_paths"] = ["packages/orchestration/private/**"]
    else:
        submitted["data_egress_profile"]["excluded_paths"] = ["packages/orchestration/private/**"]

    receipt = validate_packet(
        submitted, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=parent_permission,
        parent_egress_profile=parent_egress,
    )

    assert receipt.reason_codes == (reason,)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("location,prefix", [
    ("packet", ""),
    ("child_permission", "permission_snapshot."),
    ("child_egress", "data_egress_profile."),
    ("parent_permission", "parent_permission_snapshot."),
    ("parent_egress", "parent_egress_profile."),
])
def test_surrogate_unknown_key_has_lossless_utf8_safe_receipt_identity(location, prefix):
    hostile_key = "bad\ud800key"
    encoded_component = '<unknown_key_codepoints:' + ''.join(f'{ord(character):06x}' for character in hostile_key) + '>'
    safe_identity = f"{prefix}{encoded_component}"
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
    targets[location][hostile_key] = True

    def validate():
        return validate_packet(
            submitted, baseline_hash=HASH, context_snapshot_hash=HASH,
            parent_permission_snapshot=parent_permission,
            parent_egress_profile=parent_egress,
        )

    receipt = validate()
    encoded = receipt.to_json().encode("utf-8")

    assert receipt.reason_codes == ("UNKNOWN_FIELD",)
    assert receipt.fields == (safe_identity,)
    assert json.loads(encoded)["fields"] == [safe_identity]
    assert receipt.to_json() == validate().to_json()

    literal = complete_packet().to_dict()
    literal_parent_permission = _permission(paths=("packages/**",)).to_dict()
    literal_parent_egress = _egress(approved=("packages/**",)).to_dict()
    literal_targets = {
        "packet": literal,
        "child_permission": literal["permission_snapshot"],
        "child_egress": literal["data_egress_profile"],
        "parent_permission": literal_parent_permission,
        "parent_egress": literal_parent_egress,
    }
    literal_targets[location][encoded_component] = True
    literal_receipt = validate_packet(
        literal, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=literal_parent_permission,
        parent_egress_profile=literal_parent_egress,
    )
    assert literal_receipt.to_json().encode("utf-8") != encoded

    def receipt_for_unknown_key(key):
        value = complete_packet().to_dict()
        value_parent_permission = _permission(paths=("packages/**",)).to_dict()
        value_parent_egress = _egress(approved=("packages/**",)).to_dict()
        value_targets = {
            "packet": value,
            "child_permission": value["permission_snapshot"],
            "child_egress": value["data_egress_profile"],
            "parent_permission": value_parent_permission,
            "parent_egress": value_parent_egress,
        }
        value_targets[location][key] = True
        return validate_packet(
            value, baseline_hash=HASH, context_snapshot_hash=HASH,
            parent_permission_snapshot=value_parent_permission,
            parent_egress_profile=value_parent_egress,
        ).to_json().encode("utf-8")

    reserved = "<unknown_key_codepoints:"
    assert receipt_for_unknown_key(reserved + "\U0001f600") != receipt_for_unknown_key(reserved + "\ud83d\ude00")


@pytest.mark.parametrize("kind,field", [
    ("prohibited_path", "permission_snapshot.prohibited_paths"),
    ("protected_path", "permission_snapshot.protected_paths"),
    ("action", "permission_snapshot.allowed_actions"),
    ("egress", "data_egress_profile.excluded_paths"),
])
def test_all_child_overlap_receipts_keep_nested_prefix(kind, field):
    submitted = complete_packet().to_dict()
    if kind == "prohibited_path":
        submitted["permission_snapshot"]["prohibited_paths"] = ["packages/orchestration/private/**"]
    elif kind == "protected_path":
        submitted["permission_snapshot"]["protected_paths"] = ["packages/orchestration/private/**"]
    elif kind == "action":
        submitted["permission_snapshot"]["prohibited_actions"] = ["read"]
    else:
        submitted["data_egress_profile"]["excluded_paths"] = ["packages/orchestration/private/**"]

    receipt = validate_packet(
        submitted, baseline_hash=HASH, context_snapshot_hash=HASH,
        parent_permission_snapshot=_permission(paths=("packages/**",)),
        parent_egress_profile=_egress(approved=("packages/**",)),
    )

    assert receipt.reason_codes == ("ALLOW_DENY_OVERLAP",)
    assert receipt.fields == (field,)


@pytest.mark.parametrize("snapshot_field,array_field,tuple_value,string_value", [
    ("permission_snapshot", "allowed_tools", ("r", "e", "a", "d"), "read"),
    ("data_egress_profile", "provider_allowlist", ("o", "p", "e", "n", "a", "i"), "openai"),
])
def test_nested_json_arrays_reject_string_coercion_before_hash_validation(
    snapshot_field, array_field, tuple_value, string_value,
):
    value = complete_packet()
    if snapshot_field == "permission_snapshot":
        snapshot = replace(value.permission_snapshot, allowed_tools=tuple_value)
        value = replace(
            value, permission_snapshot=snapshot,
            permission_snapshot_hash=snapshot.snapshot_hash,
        )
    else:
        snapshot = replace(value.data_egress_profile, provider_allowlist=tuple_value)
        value = replace(
            value, data_egress_profile=snapshot,
            egress_snapshot_hash=snapshot.snapshot_hash,
        )
    data = value.to_dict()
    data[snapshot_field][array_field] = string_value

    with pytest.raises(
        TypeError, match=rf"INVALID_FIELD_TYPE:{snapshot_field}\.{array_field}",
    ):
        DelegationPacket.from_json(json.dumps(data, separators=(",", ":")))
