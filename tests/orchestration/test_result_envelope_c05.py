import copy

import pytest

from packages.execution import ResultStatus
from packages.orchestration import (
    EvidenceReference, ResultDomainReasonCode, ResultEnvelope, ResultReasonCode, ResultTest,
    canonical_hash, canonical_json, validate_result,
)


HASH = "sha256:" + "a" * 64


def payload(status="COMPLETED"):
    value = {
        "schema_version": "subagent_result/v1", "result_id": "res-1", "delegation_id": "del-1",
        "attempt_id": "attempt-1", "attempt_number": 1, "step_lineage_id": "step-1",
        "status": status, "target_hash": HASH, "summary": "completed safely",
        "actions_taken": ["inspect"], "changed_paths": ["packages/orchestration/result_envelope.py"],
        "evidence_refs": [{"evidence_id": "ev-1", "checksum": HASH, "kind": "test"}],
        "tests": [{"command": "pytest tests/orchestration/test_result_envelope_c05.py", "status": "PASS", "exit_code": 0}],
        "assumptions": [], "unresolved": [], "handoff": {"current_state": "clean"},
    }
    if status == "INCOMPLETE":
        value["reason_code"] = "RESULT_CONTRACT_INCOMPLETE"
    elif status == "BLOCKED":
        value["reason_code"] = "DECISION_REQUIRED"
        value["decision_needed"] = "owner decision"
    elif status == "CANCELLED":
        value["reason_code"] = "RUN_CANCEL_REQUESTED"
        value["unresolved"] = ["cancelled by main"]
    else:
        value["reason_code"] = None
    return value


def test_all_five_statuses_are_explicit_and_round_trip():
    for status in ResultStatus:
        value = payload(status.value)
        if status is ResultStatus.FAILURE_REPORT:
            value.update(failure_fingerprint=None, unresolved=[])
        elif status is ResultStatus.BLOCKED:
            value.update(decision_needed="owner decision")
        elif status is ResultStatus.CANCELLED:
            value.update(unresolved=["cancelled by main"])
        result = ResultEnvelope.from_dict(value)
        assert result.status is status
        assert validate_result(result).valid
        assert ResultEnvelope.from_dict(result.to_dict()).to_json() == result.to_json()


def test_canonical_json_and_hash_ignore_mapping_order():
    first = {"b": 2, "a": {"z": True, "y": 1}}
    second = {"a": {"y": 1, "z": True}, "b": 2}
    assert canonical_json(first) == canonical_json(second)
    assert canonical_hash(first) == canonical_hash(second)


def test_missing_hash_and_evidence_fail_closed():
    invalid = payload()
    invalid["target_hash"] = "sha256:" + "A" * 64
    invalid["evidence_refs"] = [{"evidence_id": "ev-1", "checksum": "bad"}]
    report = validate_result(invalid)
    assert not report.valid
    assert report.reason_codes[0] in {ResultReasonCode.INVALID_HASH, ResultReasonCode.INVALID_EVIDENCE}


def test_status_conditions_fail_closed():
    for status, field in (("COMPLETED", "tests"),
                          ("BLOCKED", "decision_needed"), ("CANCELLED", "unresolved")):
        invalid = payload(status)
        invalid[field] = [] if field in {"tests", "unresolved"} else None
        assert not validate_result(invalid).valid


def test_unknown_field_and_mutation_are_rejected():
    invalid = payload()
    invalid["hostile"] = "ignore me"
    report = validate_result(invalid)
    assert not report.valid
    assert report.reason_codes == (ResultReasonCode.UNKNOWN_FIELD,)
    result = ResultEnvelope.from_dict(payload())
    original = result.to_json()
    source = payload()
    source["handoff"]["current_state"] = "mutated"
    assert result.to_json() == original


def test_evidence_reference_requires_checksum():
    invalid = payload()
    invalid["evidence_refs"] = [{"evidence_id": "ev-1"}]
    assert not validate_result(invalid).valid


def test_evidence_reference_rejects_primitive_type_coercion():
    for field in ("evidence_id", "kind"):
        invalid = payload()
        invalid["evidence_refs"][0][field] = 123
        report = validate_result(invalid)
        assert not report.valid
        assert report.reason_codes == (ResultReasonCode.INVALID_EVIDENCE.value,)


def test_domain_reason_codes_are_first_class_status_scoped_and_canonical():
    expected = {
        "INCOMPLETE": (
            "RESULT_CONTRACT_INCOMPLETE", "TRANSIENT_EXECUTION_ERROR",
            "CHECKPOINTED_INTERRUPTION",
        ),
        "BLOCKED": (
            "DECISION_REQUIRED", "POLICY_BLOCKED", "ENVIRONMENT_BLOCKED",
            "PERMISSION_BLOCKED",
        ),
        "CANCELLED": ("DELEGATION_REASSIGN", "RUN_CANCEL_REQUESTED"),
    }
    for status, reason_codes in expected.items():
        for reason_code in reason_codes:
            value = payload(status)
            value["reason_code"] = reason_code
            if reason_code == "CHECKPOINTED_INTERRUPTION":
                value["checkpoint_ref"] = "checkpoint:C-05/α 1"
            result = ResultEnvelope.from_dict(value)
            assert result.reason_code is ResultDomainReasonCode(reason_code)
            assert result.to_dict()["reason_code"] == reason_code
            assert validate_result(result).valid

    for status in ("COMPLETED", "FAILURE_REPORT"):
        value = payload(status)
        value.pop("reason_code")
        omitted = ResultEnvelope.from_dict(value)
        assert omitted.to_dict()["reason_code"] is None
        value["reason_code"] = None
        explicit = ResultEnvelope.from_dict(value)
        assert explicit.to_dict()["reason_code"] is None
        assert omitted.to_json() == explicit.to_json()
        assert omitted.canonical_hash == explicit.canonical_hash


@pytest.mark.parametrize("status", ["INCOMPLETE", "BLOCKED", "CANCELLED"])
def test_status_requiring_reason_code_rejects_omission_and_null(status):
    for marker in ("omit", None):
        value = payload(status)
        if marker == "omit":
            value.pop("reason_code")
        else:
            value["reason_code"] = None
        report = validate_result(value)
        assert not report.valid
        assert report.fields == ("reason_code",)


@pytest.mark.parametrize("status", ["COMPLETED", "FAILURE_REPORT"])
def test_completed_and_failure_report_reject_domain_reason_code(status):
    value = payload(status)
    value["reason_code"] = "RESULT_CONTRACT_INCOMPLETE"
    report = validate_result(value)
    assert not report.valid
    assert report.fields == ("reason_code",)


@pytest.mark.parametrize("status,reason_code", [
    ("INCOMPLETE", "DECISION_REQUIRED"),
    ("BLOCKED", "RUN_CANCEL_REQUESTED"),
    ("CANCELLED", "TRANSIENT_EXECUTION_ERROR"),
])
def test_cross_status_reason_codes_are_rejected(status, reason_code):
    value = payload(status)
    value["reason_code"] = reason_code
    assert not validate_result(value).valid


@pytest.mark.parametrize("reason_code", ["UNKNOWN", 7, True, " RESULT_CONTRACT_INCOMPLETE "])
def test_unknown_wrong_type_and_noncanonical_reason_codes_are_rejected(reason_code):
    value = payload("INCOMPLETE")
    value["reason_code"] = reason_code
    report = validate_result(value)
    assert not report.valid
    assert report.fields == ("reason_code",)


def test_checkpointed_interruption_requires_canonical_checkpoint_reference():
    for checkpoint_ref in (None, "", " ", " checkpoint ", 3, "\ud800"):
        value = payload("INCOMPLETE")
        value.update(reason_code="CHECKPOINTED_INTERRUPTION", checkpoint_ref=checkpoint_ref)
        report = validate_result(value)
        assert not report.valid
        assert "checkpoint_ref" in report.fields


def test_failure_report_base_contract_does_not_require_c06_fields():
    value = payload("FAILURE_REPORT")
    value.update(failure_fingerprint=None, unresolved=[])
    assert validate_result(value).valid


@pytest.mark.parametrize("field", [
    "actions_taken", "changed_paths", "evidence_refs", "tests", "assumptions", "unresolved",
])
@pytest.mark.parametrize("hostile", [(), {"x"}, "x", {"x": 1}, 1, object()])
def test_mapping_array_fields_require_actual_lists_without_coercion(field, hostile):
    value = payload()
    value[field] = hostile
    assert not validate_result(value).valid


def test_direct_typed_constructor_preserves_tuple_compatibility():
    source = ResultEnvelope.from_dict(payload())
    direct = ResultEnvelope(
        source.schema_version, source.result_id, source.delegation_id,
        source.attempt_id, source.attempt_number, source.step_lineage_id,
        source.status, source.target_hash, source.summary,
        source.actions_taken, source.changed_paths, source.evidence_refs,
        source.tests, source.issue_id, source.failure_fingerprint,
        source.assumptions, source.unresolved, source.decision_needed,
        source.checkpoint_ref, source.handoff,
    )
    assert direct.to_dict() == source.to_dict()


@pytest.mark.parametrize("field", ["command", "status"])
def test_result_test_rejects_missing_unknown_and_wrong_primitive_fields(field):
    missing = payload()
    missing["tests"][0].pop(field)
    assert not validate_result(missing).valid
    unknown = payload()
    unknown["tests"][0]["unknown"] = "x"
    assert not validate_result(unknown).valid
    wrong = payload()
    wrong["tests"][0][field] = 7
    assert not validate_result(wrong).valid


def test_nested_objects_reject_non_string_keys_and_bool_exit_code():
    for field in ("evidence_refs", "tests"):
        value = payload()
        value[field][0][1] = "hostile"
        assert not validate_result(value).valid
    value = payload()
    value["tests"][0]["exit_code"] = True
    assert not validate_result(value).valid


@pytest.mark.parametrize("hostile", [float("nan"), float("inf"), "\ud800", {"x"}, ("x",), b"x", object()])
def test_handoff_rejects_non_json_values_without_exception_leakage(hostile):
    value = payload()
    value["handoff"] = {"nested": [hostile]}
    report = validate_result(value)
    assert not report.valid
    assert report.fields == ("handoff",)


def test_handoff_rejects_cycles_without_exception_leakage():
    cycle = {}
    cycle["next"] = cycle
    value = payload()
    value["handoff"] = cycle
    report = validate_result(value)
    assert not report.valid
    assert report.fields == ("handoff",)


def test_hostile_mapping_implementation_fails_closed_without_exception_leakage():
    class HostileMapping(dict):
        def items(self):
            raise RuntimeError("hostile items")

    report = validate_result(HostileMapping(payload()))
    assert not report.valid
    assert report.reason_codes == (ResultReasonCode.INVALID_FIELD.value,)


def test_stateful_handoff_mapping_is_snapshotted_once_without_toctou_raw_key_bypass():
    class FlipMapping(dict):
        def __init__(self):
            super().__init__()
            self.calls = 0

        def items(self):
            self.calls += 1
            if self.calls == 1:
                return {"safe": "summary"}.items()
            return {"stdout": "raw-secret"}.items()

    handoff = FlipMapping()
    value = payload()
    value["handoff"] = handoff
    result = ResultEnvelope.from_dict(value)
    assert handoff.calls == 1
    assert result.to_dict()["handoff"] == {"safe": "summary"}


@pytest.mark.parametrize("forbidden", [
    "transcript", "Transcripts", "std_out", "Std-Err", "raw log",
    "nestedRawLogChecksum", "raw-transcripts", "contains raw transcript value",
    "transcriptPayload", "captured_stdout_text", "last-stderr-content",
    "std\u00a0out", "std\u2003out", "raw\u00a0log", "trans\u2009cript",
])
def test_handoff_rejects_raw_execution_material_keys_at_every_depth(forbidden):
    value = payload()
    value["handoff"] = {"level": [{"deeper": {forbidden: "raw material"}}]}
    report = validate_result(value)
    assert not report.valid
    assert report.fields == ("handoff",)


@pytest.mark.parametrize("handoff", [
    {"text": "가" * 16385},
    {"items": list(range(257))},
    {"keys": {f"key-{index}": index for index in range(129)}},
])
def test_handoff_per_node_bounds_fail_closed(handoff):
    value = payload()
    value["handoff"] = handoff
    assert not validate_result(value).valid


def test_handoff_depth_and_total_canonical_size_bounds_fail_closed():
    nested = {"value": "end"}
    for _ in range(9):
        nested = {"level": nested}
    value = payload()
    value["handoff"] = nested
    assert not validate_result(value).valid
    value["handoff"] = {f"field-{index}": "x" * 1024 for index in range(70)}
    assert not validate_result(value).valid


def test_c02_operational_identifiers_round_trip_raw_without_ad_hoc_regex():
    value = payload()
    value.update(
        result_id="Result: α/β 1", delegation_id="Delegation ! #1",
        attempt_id="Attempt @ Seoul", step_lineage_id="C-05 / 검증 단계",
    )
    value["evidence_refs"][0].update(evidence_id="Evidence: 결과 #1", kind="Test 결과")
    result = ResultEnvelope.from_dict(value)
    encoded = result.to_dict()
    assert encoded["result_id"] == value["result_id"]
    assert encoded["delegation_id"] == value["delegation_id"]
    assert encoded["attempt_id"] == value["attempt_id"]
    assert encoded["step_lineage_id"] == value["step_lineage_id"]
    assert encoded["evidence_refs"][0]["evidence_id"] == value["evidence_refs"][0]["evidence_id"]
    assert validate_result(result).valid


@pytest.mark.parametrize("field", ["result_id", "delegation_id", "attempt_id", "step_lineage_id"])
@pytest.mark.parametrize("hostile", ["", " ", " trimmed ", "\ud800"])
def test_c02_invalid_operational_identifier_text_fails_closed(field, hostile):
    value = payload()
    value[field] = hostile
    assert not validate_result(value).valid


def test_handoff_remains_detached_and_c06_list_shape_round_trips():
    source = payload()
    source["handoff"] = {
        "problem_name": "contract validation",
        "alternatives_considered": ["retry", "repair"],
        "structured": {"state": ["one", "two"]},
    }
    result = ResultEnvelope.from_dict(source)
    before = result.to_dict()
    source["handoff"]["alternatives_considered"].append("mutated")
    emitted = result.to_dict()
    emitted["handoff"]["structured"]["state"].append("mutated")
    assert result.to_dict() == before
    assert result.to_dict()["handoff"]["alternatives_considered"] == ["retry", "repair"]
