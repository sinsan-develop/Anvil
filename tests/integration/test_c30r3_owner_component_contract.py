"""Task1 specification fixtures only; NOT owner restore/PG/browser evidence.

The executable schema is read from the WI. This file deliberately does not
provide or monkeypatch a production restore adapter. Task2 must test real owners.
"""
import copy
import hashlib
import json
from pathlib import Path

import pytest


WI = Path(__file__).resolve().parents[2] / "docs/work_orders/C-30R3_WORK_INSTRUCTION.md"
KINDS = ("ROLE_POLICY", "ROLE_RESULTS", "TEAM", "MOA")
FIELDS = ("component_type", "schema_version", "assignment_id", "owner_version",
          "binding", "payload", "component_hash")
BINDING = {
    "project_id": "fixture-project", "environment_id": "fixture-local",
    "session_id": "fixture-session", "assignment_id": "fixture-assignment",
    "generation": 1, "actor_id": "fixture-reader", "context_id": "fixture-context",
    "workspace_id": "fixture-workspace", "baseline_hash": "sha256:" + "a" * 64,
    "target_hash": "sha256:" + "b" * 64, "assignment_hash": "sha256:" + "c" * 64,
    "execution_fence": "fixture-execution-1", "write_fence": None,
}
STATE_KEYS = {
    "ROLE_POLICY": ["assignments", "assignment_seals", "definitions", "revoked",
        "spent", "requests", "audits", "write_leases", "write_seals",
        "write_revoked", "code_leases", "code_seals", "code_revoked"],
    "ROLE_RESULTS": ["captures", "seals", "results", "audits"],
    "TEAM": ["bindings", "tasks", "boxes", "events", "spent", "cancelled",
        "replay", "plan_hash", "last_at"],
    "MOA": ["records", "proposals", "critiques", "syntheses"],
}


def spec():
    assert WI.is_file(), "C30R3_CONTRACT_NOT_DEFINED"
    text = WI.read_text(encoding="utf-8")
    raw = text.split("<!-- C30R3_CONTRACT_BEGIN -->", 1)[1].split(
        "<!-- C30R3_CONTRACT_END -->", 1)[0]
    return json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())


def builtin(value, depth=0):
    """Specification oracle, not a product validator or hydration implementation."""
    if depth > 24:
        raise ValueError("INPUT_BOUND_EXCEEDED")
    if value is None or type(value) in (bool, int, str):
        return
    if type(value) is list:
        for item in value:
            builtin(item, depth + 1)
        return
    if type(value) is dict:
        for key, item in value.items():
            if type(key) is not str:
                raise ValueError("BUILTIN_REQUIRED")
            builtin(item, depth + 1)
        return
    raise ValueError("BUILTIN_REQUIRED")


def digest(value):
    builtin(value)
    return "sha256:" + hashlib.sha256(json.dumps(value, sort_keys=True,
        separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def fixture(kind):
    # Shape/hash fixture, explicitly NOT a restorable empty owner or authority.
    row = dict(component_type=kind, schema_version="owner-component/v1",
        assignment_id="fixture-assignment", owner_version=1,
        binding=dict(BINDING), payload={"constructor": {},
            "state": {key: [] for key in STATE_KEYS[kind]}})
    row["component_hash"] = digest(row)
    return row


def validate_fixture(row):
    contract = spec()
    builtin(row)  # Must precede copying, iteration of subclasses and hashing.
    if type(row) is not dict or set(row) != set(contract["payload_fields"]):
        raise ValueError("COMPONENT_SHAPE")
    if row["component_type"] not in contract["components"]:
        raise ValueError("COMPONENT_TYPE")
    if row["schema_version"] != "owner-component/v1":
        raise ValueError("COMPONENT_SCHEMA")
    if type(row["owner_version"]) is not int or row["owner_version"] < 1:
        raise ValueError("OWNER_VERSION")
    if row["binding"] != BINDING or row["assignment_id"] != BINDING["assignment_id"]:
        raise ValueError("OWNER_BINDING_MISMATCH")
    payload = row["payload"]
    if set(payload) != {"constructor", "state"} or set(payload["state"]) != set(
            contract["state_fields"][row["component_type"]]):
        raise ValueError("COMPONENT_SHAPE")
    if digest({k: v for k, v in row.items() if k != "component_hash"}) != row["component_hash"]:
        raise ValueError("COMPONENT_HASH_MISMATCH")
    return copy.deepcopy(row)


@pytest.mark.parametrize("kind", KINDS)
def test_contract_fixture_component_shape_hash_and_detachment(kind):
    row = fixture(kind)
    result = validate_fixture(row)
    result["binding"]["actor_id"] = "changed"
    assert row["binding"]["actor_id"] == "fixture-reader"
    assert tuple(row) == FIELDS


@pytest.mark.parametrize("field", tuple(BINDING))
def test_contract_fixture_resigned_foreign_binding_is_not_authority(field):
    row = fixture("ROLE_POLICY")
    row["binding"][field] = 2 if field == "generation" else "foreign"
    row["component_hash"] = digest({k: v for k, v in row.items() if k != "component_hash"})
    with pytest.raises(ValueError, match="OWNER_BINDING_MISMATCH"):
        validate_fixture(row)


@pytest.mark.parametrize("kind", KINDS)
def test_contract_fixture_nested_state_tamper_recomputes_hash(kind):
    row = fixture(kind)
    row["payload"]["state"][STATE_KEYS[kind][0]].append({"assignment_id": "foreign"})
    with pytest.raises(ValueError, match="COMPONENT_HASH_MISMATCH"):
        validate_fixture(row)


@pytest.mark.parametrize("location", ["outer", "payload", "state"])
def test_contract_fixture_unknown_fields_fail_closed(location):
    row = fixture("ROLE_POLICY")
    target = row if location == "outer" else row["payload"]
    if location == "state":
        target = target["state"]
    target["arbitrary_callback"] = "not-allowed"
    with pytest.raises(ValueError, match="COMPONENT_SHAPE"):
        validate_fixture(row)


def test_contract_fixture_custom_objects_do_not_execute_callbacks():
    calls = []
    class Hostile(dict):
        def items(self):
            calls.append("items")
            raise AssertionError("callback")
        def __deepcopy__(self, memo):
            calls.append("copy")
            raise AssertionError("callback")
    row = fixture("TEAM")
    row["payload"] = Hostile()
    with pytest.raises(ValueError, match="BUILTIN_REQUIRED"):
        validate_fixture(row)
    assert calls == []


@pytest.mark.parametrize("value", [float("nan"), float("inf"), 1.2, (1,), {1}, b"x"])
def test_contract_fixture_noncanonical_values_rejected(value):
    with pytest.raises(ValueError, match="BUILTIN_REQUIRED"):
        builtin(value)


def test_contract_fixture_canonical_json_known_vector():
    assert digest({"a": 1}) == "sha256:015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862"


def test_contract_fixture_exact_bundle_and_signatures():
    contract = spec()
    assert contract["bundle_fields"] == ["binding", "owner_version", "owner_snapshot_hash",
        "principal_mapping_hash", "component_hashes", "restored_at", "receipt_hash",
        "policy", "results", "team", "moa"]
    assert contract["methods"] == {
        "restore_owner_components": ["snapshot", "principal", "*", "session_factory", "now"],
        "export_owner_components": ["bundle"]}
    assert contract["owner_types"] == ["RolePolicyService", "RoleResultService",
        "RoleTeamOrchestrator", "MoADeliberation"]


@pytest.mark.parametrize("name, expected", [
    ("authority", "REPOSITORY_CURRENT_BEFORE_CONSTRUCTION_AND_BEFORE_PUBLICATION"),
    ("revocation", "MONOTONIC_HIGH_WATER_NO_REREGISTRATION"),
    ("fences", "EXACT_EXECUTION_AND_WRITE_OR_READONLY_NULL"),
    ("atomicity", "ALL_FOUR_OR_NONE_NO_EXTERNAL_IO"),
    ("replay", "DETERMINISTIC_IDENTITY_NO_AUTHORITY_CACHE"),
    ("export", "SERIALIZATION_ONLY_NOT_AUTHENTICATION"),
    ("release", "0013_UNCHANGED_0015_NOT_APPLIED"),
    ("evidence", "FIXTURE_ONLY_NOT_RESTORE_OR_FORMAL_ACCEPTANCE"),
])
def test_contract_fixture_security_invariants(name, expected):
    assert spec()["invariants"][name] == expected
