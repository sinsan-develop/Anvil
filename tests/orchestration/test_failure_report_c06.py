import copy
import re

import pytest

from packages.execution import DelegationStatus, ResultStatus
from packages.orchestration.failure_report import (
    FailureReportReasonCode,
    compute_failure_fingerprint,
    validate_failure_report,
)
from packages.orchestration.outcome_resolver import DelegationOutcomeResolver, ResolverReasonCode, StepState
from packages.orchestration.result_envelope import ResultEnvelope


HASH = "sha256:" + "a" * 64
CANONICAL_FINGERPRINT = "sha256:a658c9131e579ee8e83dc279fbeb7a943e2d7a7503e14010a950f2b4e1422b6e"


def report(**changes):
    value = {
        "schema_version": "subagent_result/v1",
        "result_id": "결과: C-06 / 1",
        "delegation_id": "위임: C-06 / α",
        "attempt_id": "시도: C-06 / 1",
        "attempt_number": 1,
        "step_lineage_id": "C-06 / 검증 단계: α",
        "status": ResultStatus.FAILURE_REPORT.value,
        "target_hash": HASH,
        "summary": "permission quota environment timeout wording is part of a code defect",
        "actions_taken": ["reproduced the failing assertion", "reviewed a second repair strategy"],
        "changed_paths": ["packages/orchestration/failure_report.py"],
        "evidence_refs": [{"evidence_id": "증거: C-06 / red", "checksum": HASH, "kind": "test"}],
        "tests": [{"command": "pytest tests/test_sample.py::test_case", "status": "FAIL", "exit_code": 1}],
        "issue_id": "결함: C-06 / assertion",
        "failure_fingerprint": CANONICAL_FINGERPRINT,
        "assumptions": [],
        "unresolved": ["repair the validator"],
        "decision_needed": "choose the bounded validator repair",
        "handoff": {
            "problem_name": "assertion mismatch",
            "failure_stage": "unit test",
            "confirmed_cause": "wrong comparison branch",
            "alternatives_considered": ["retry rejected because it repeats the same branch"],
            "normalized_error_code": "E_ASSERTION",
            "failing_test_or_gate": "pytest tests/test_sample.py::test_case",
            "relevant_stack_fingerprint": "stack:assert-equal",
            "failure_origin": "CODE_DEFECT",
        },
    }
    value.update(changes)
    return value


def with_handoff(value, **changes):
    candidate = copy.deepcopy(value)
    candidate["handoff"].update(changes)
    return candidate


def with_computed_fingerprint(value):
    candidate = copy.deepcopy(value)
    candidate["failure_fingerprint"] = compute_failure_fingerprint(ResultEnvelope.from_dict(candidate))
    return candidate


def test_c02_c05_operational_identifiers_are_accepted_raw_and_canonical():
    raw = report()
    first = validate_failure_report(raw)
    second = validate_failure_report(dict(reversed(list(raw.items()))))
    canonical = ResultEnvelope.from_dict(raw)
    third = validate_failure_report(canonical)

    assert first.valid and second == first and third == first
    projected = canonical.to_dict()
    for field in ("result_id", "delegation_id", "attempt_id", "step_lineage_id"):
        assert projected[field] == raw[field]


@pytest.mark.parametrize("field", ["result_id", "delegation_id", "attempt_id", "step_lineage_id"])
@pytest.mark.parametrize("identifier", ["", " padded", "padded ", "\ud800"])
def test_c05_invalid_operational_identifier_fails_closed(field, identifier):
    result = validate_failure_report(report(**{field: identifier}))
    assert not result.valid
    assert result.reason_codes[0] == FailureReportReasonCode.BASE_RESULT_INVALID.value


def test_fingerprint_is_canonical_hash_of_exact_three_fields_only():
    envelope = ResultEnvelope.from_dict(report())
    assert compute_failure_fingerprint(envelope) == CANONICAL_FINGERPRINT
    assert re.fullmatch(r"sha256:[0-9a-f]{64}", compute_failure_fingerprint(envelope))

    for change in (
        {"step_lineage_id": "다른 단계: β"},
        {"summary": "different summary"},
        {"issue_id": "different issue"},
        {"changed_paths": ["different/path.py"]},
        {"evidence_refs": [{"evidence_id": "different", "checksum": HASH, "kind": "test"}]},
    ):
        assert compute_failure_fingerprint(ResultEnvelope.from_dict(report(**change))) == CANONICAL_FINGERPRINT


@pytest.mark.parametrize(
    "field,value",
    [
        ("normalized_error_code", "E_DIFFERENT"),
        ("failing_test_or_gate", "pytest tests/test_sample.py::other"),
        ("relevant_stack_fingerprint", "stack:different"),
    ],
)
def test_each_fingerprint_material_field_changes_hash(field, value):
    changed = with_handoff(report(), **{field: value})
    assert compute_failure_fingerprint(ResultEnvelope.from_dict(changed)) != CANONICAL_FINGERPRINT


def test_fingerprint_encoding_has_no_delimiter_collision():
    left = with_handoff(
        report(), normalized_error_code="a", failing_test_or_gate="b|c", relevant_stack_fingerprint="d"
    )
    right = with_handoff(
        report(), normalized_error_code="a|b", failing_test_or_gate="c", relevant_stack_fingerprint="d"
    )
    assert compute_failure_fingerprint(ResultEnvelope.from_dict(left)) == "sha256:3d2ec34f18bd6580cffbd10b4a29c4a204fc179c3564c681b4e9b206c53206e3"
    assert compute_failure_fingerprint(ResultEnvelope.from_dict(right)) == "sha256:9180321629c560ce9e5d33930503de03b9f6ea357e1527faab1a742ec505be94"


@pytest.mark.parametrize(
    "fingerprint",
    ["failure-abc", "sha256:" + "A" * 64, "sha256:" + "0" * 64, "plaintext"],
)
def test_supplied_fingerprint_is_always_recomputed_and_verified(fingerprint):
    result = validate_failure_report(report(failure_fingerprint=fingerprint))
    assert not result.valid
    assert FailureReportReasonCode.FINGERPRINT_NOT_DETERMINISTIC.value in result.reason_codes


def test_expected_fingerprint_is_an_additional_guard():
    result = validate_failure_report(report(), expected_fingerprint="sha256:" + "0" * 64)
    assert not result.valid
    assert FailureReportReasonCode.FINGERPRINT_NOT_DETERMINISTIC.value in result.reason_codes


def test_failing_test_or_gate_must_exactly_bind_one_failed_result_test_command():
    value = with_computed_fingerprint(with_handoff(report(), failing_test_or_gate="G2"))
    result = validate_failure_report(value)
    assert not result.valid
    assert FailureReportReasonCode.FAILURE_EVIDENCE_MISSING.value in result.reason_codes


def test_failing_test_or_gate_exact_match_is_accepted_with_c05_valid_neutral_rows():
    value = report(tests=[
        {"command": "setup", "status": "PASS", "exit_code": None},
        {"command": "pytest tests/test_sample.py::test_case", "status": "FAIL", "exit_code": None},
        {"command": "optional", "status": "SKIP", "exit_code": 0},
        {"command": "known", "status": "XFAIL", "exit_code": None},
    ])
    assert validate_failure_report(value).valid


def test_same_command_cannot_be_both_neutral_and_failed():
    value = report(tests=[
        {"command": "pytest tests/test_sample.py::test_case", "status": "PASS", "exit_code": 0},
        {"command": "pytest tests/test_sample.py::test_case", "status": "FAIL", "exit_code": 1},
    ])
    result = validate_failure_report(value)
    assert not result.valid
    assert FailureReportReasonCode.FAILURE_TEST_INVALID.value in result.reason_codes


@pytest.mark.parametrize(
    "origin,reason",
    [
        ("QUOTA_EXHAUSTED", FailureReportReasonCode.QUOTA_FAILURE.value),
        ("PERMISSION_BLOCKED", FailureReportReasonCode.PERMISSION_FAILURE.value),
        ("ENVIRONMENT_BLOCKED", FailureReportReasonCode.ENVIRONMENT_FAILURE.value),
        ("TOOL_INTERRUPTION", FailureReportReasonCode.TOOL_INTERRUPTION.value),
        ("USER_INTERRUPTION", "USER_INTERRUPTION"),
        ("INPUT_CHANGED", "INPUT_CHANGED"),
    ],
)
def test_structured_non_countable_origin_is_rejected_without_prose_inference(origin, reason):
    value = with_handoff(report(summary="ordinary failure"), failure_origin=origin)
    result = validate_failure_report(value)
    assert not result.valid
    assert reason in result.reason_codes


@pytest.mark.parametrize("origin", ["CODE_DEFECT", "TEST_DEFECT", "CONTRACT_DEFECT", "DATA_DEFECT"])
def test_structured_countable_origin_wins_over_prose_tokens(origin):
    value = with_handoff(report(), failure_origin=origin)
    assert validate_failure_report(value).valid


@pytest.mark.parametrize("mutation", ["missing", "unknown", "alias", "conflict"])
def test_missing_unknown_or_aliased_failure_origin_fails_closed(mutation):
    value = report()
    if mutation == "missing":
        del value["handoff"]["failure_origin"]
    elif mutation == "unknown":
        value["handoff"]["failure_origin"] = "MAYBE_FAILURE"
    elif mutation == "alias":
        del value["handoff"]["failure_origin"]
        value["handoff"]["failure_kind"] = "CODE_DEFECT"
    else:
        value["handoff"]["failure_kind"] = "QUOTA_EXHAUSTED"
    result = validate_failure_report(value)
    assert not result.valid
    assert "FAILURE_CLASSIFICATION_INVALID" in result.reason_codes


@pytest.mark.parametrize(
    "field",
    ["actions_taken", "changed_paths", "evidence_refs", "tests", "unresolved", "decision_needed"],
)
def test_required_top_level_failure_fields_are_enforced(field):
    empty = None if field == "decision_needed" else []
    result = validate_failure_report(report(**{field: empty}))
    assert not result.valid


@pytest.mark.parametrize(
    "field",
    [
        "problem_name",
        "failure_stage",
        "confirmed_cause",
        "alternatives_considered",
        "normalized_error_code",
        "failing_test_or_gate",
        "relevant_stack_fingerprint",
    ],
)
def test_required_canonical_handoff_fields_are_enforced(field):
    value = report()
    del value["handoff"][field]
    result = validate_failure_report(value)
    assert not result.valid


@pytest.mark.parametrize(
    "path",
    ["../hostile.py", "/absolute.py", "C:/drive.py", r"dir\file.py", "./file.py", "dir/./file.py", "dir//file.py", "dir/../file.py", "file.py/"],
)
def test_changed_paths_must_be_canonical_repository_relative_posix_paths(path):
    result = validate_failure_report(report(changed_paths=[path]))
    assert not result.valid
    assert "CHANGED_PATH_INVALID" in result.reason_codes


@pytest.mark.parametrize(
    "test",
    [
        {"command": "pytest", "status": "PASS", "exit_code": 1},
        {"command": "pytest", "status": "FAIL", "exit_code": 0},
        {"command": "pytest", "status": "UNKNOWN", "exit_code": 1},
        {"command": "pytest", "status": "SKIP", "exit_code": 1},
    ],
)
def test_test_status_and_exit_code_must_be_coherent(test):
    result = validate_failure_report(report(tests=[test]))
    assert not result.valid
    assert "FAILURE_TEST_INVALID" in result.reason_codes


@pytest.mark.parametrize("failure_status", ["FAIL", "FAILED", "ERROR", "RED"])
@pytest.mark.parametrize("exit_code", [None, 1, -1])
def test_c05_valid_failure_status_matrix_is_accepted(failure_status, exit_code):
    value = report(tests=[{
        "command": "pytest tests/test_sample.py::test_case",
        "status": failure_status,
        "exit_code": exit_code,
    }])
    assert validate_failure_report(value).valid


@pytest.mark.parametrize("neutral_status", ["PASS", "SKIP", "SKIPPED", "XFAIL", "NOT_RUN"])
@pytest.mark.parametrize("exit_code", [None, 0])
def test_c05_valid_neutral_rows_are_allowed_beside_bound_failure(neutral_status, exit_code):
    value = report(tests=[
        {"command": "pytest tests/test_sample.py::test_case", "status": "FAIL", "exit_code": 1},
        {"command": "auxiliary", "status": neutral_status, "exit_code": exit_code},
    ])
    assert validate_failure_report(value).valid


def test_invalid_failure_report_does_not_mutate_resolver_state_or_events():
    service = DelegationOutcomeResolver(execution_fencing_token="exec", write_fencing_token="write")
    lineage = report()["step_lineage_id"]
    delegation = report()["delegation_id"]
    service.register_step(lineage, StepState.RUNNING)
    service.register_delegation(delegation, lineage, DelegationStatus.RUNNING)
    before = service.snapshot()
    candidate = ResultEnvelope.from_dict(report(failure_fingerprint="sha256:" + "0" * 64))

    receipt = service.resolve(candidate, execution_fencing_token="exec", write_fencing_token="write")

    assert not receipt.accepted
    assert receipt.reason_codes[0] == ResolverReasonCode.INVALID_RESULT.value
    assert service.snapshot() == before
    assert service.events == ()


def test_other_result_status_is_never_failure_report():
    value = report(status=ResultStatus.INCOMPLETE.value, failure_fingerprint=None, unresolved=[], reason_code="RESULT_CONTRACT_INCOMPLETE")
    value["handoff"] = {}
    result = validate_failure_report(value)
    assert not result.valid
    assert result.reason_codes[0] == FailureReportReasonCode.NOT_FAILURE_REPORT.value
