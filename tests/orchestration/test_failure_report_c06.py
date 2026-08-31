from packages.execution import ResultStatus
from packages.orchestration import (
    FailureReportReasonCode,
    ResultEnvelope,
    compute_failure_fingerprint,
    validate_failure_report,
)


HASH = "sha256:" + "a" * 64


def report(**changes):
    value = {
        "schema_version": "subagent_result/v1", "result_id": "res-1", "delegation_id": "del-1",
        "attempt_id": "attempt-1", "attempt_number": 1, "step_lineage_id": "C-06/validator",
        "status": ResultStatus.FAILURE_REPORT.value, "target_hash": HASH, "summary": "validator failure",
        "actions_taken": ["run tests"], "changed_paths": ["packages/x.py"],
        "evidence_refs": [{"evidence_id": "ev-1", "checksum": HASH, "kind": "test"}],
        "tests": [{"command": "pytest", "status": "FAIL", "exit_code": 1}],
        "assumptions": [], "unresolved": ["fix root cause"], "decision_needed": "choose repair",
        "failure_fingerprint": "C06-VALIDATOR-001",
        "handoff": {
            "problem_name": "validator contract",
            "failure_stage": "verification",
            "confirmed_cause": "missing guard",
            "alternatives_considered": ["retry", "repair"],
        },
    }
    value.update(changes)
    return value


def test_valid_failure_report_is_countable_and_mapping_order_does_not_matter():
    first = validate_failure_report(report())
    second = validate_failure_report(dict(reversed(list(report().items()))))
    assert first.valid and second.valid
    assert first == second


def test_required_failure_fields_are_fail_closed():
    for key in ("changed_paths", "unresolved", "decision_needed", "failure_fingerprint"):
        value = report()
        value[key] = [] if key in {"changed_paths", "unresolved"} else None
        result = validate_failure_report(value)
        assert not result.valid


def test_lineage_and_fingerprint_format_are_strict():
    for key in ("step_lineage_id", "failure_fingerprint"):
        value = report(**{key: " ../hostile "})
        result = validate_failure_report(value)
        assert not result.valid
        assert result.reason_codes[0] in {
            FailureReportReasonCode.INVALID_LINEAGE.value,
            FailureReportReasonCode.INVALID_FINGERPRINT.value,
            FailureReportReasonCode.BASE_RESULT_INVALID.value,
        }


def test_expected_fingerprint_mismatch_is_rejected():
    result = validate_failure_report(report(), expected_fingerprint="C06-OTHER")
    assert not result.valid
    assert FailureReportReasonCode.FINGERPRINT_NOT_DETERMINISTIC.value in result.reason_codes


def test_fingerprint_material_is_deterministic_and_excludes_supplied_value():
    one = ResultEnvelope.from_dict(report())
    changed = ResultEnvelope.from_dict(report(failure_fingerprint="C06-OTHER"))
    assert compute_failure_fingerprint(one) == compute_failure_fingerprint(changed)


def test_quota_permission_environment_and_tool_interruption_do_not_count():
    for marker, code in (
        ("quota exceeded", FailureReportReasonCode.QUOTA_FAILURE),
        ("permission denied", FailureReportReasonCode.PERMISSION_FAILURE),
        ("environment unavailable", FailureReportReasonCode.ENVIRONMENT_FAILURE),
        ("tool interrupted", FailureReportReasonCode.TOOL_INTERRUPTION),
    ):
        value = report(summary=marker)
        result = validate_failure_report(value)
        assert not result.valid
        assert code.value in result.reason_codes


def test_successful_test_without_failure_evidence_is_not_a_failure():
    value = report(tests=[{"command": "pytest", "status": "PASS", "exit_code": 0}])
    result = validate_failure_report(value)
    assert not result.valid
    assert FailureReportReasonCode.FAILURE_EVIDENCE_MISSING.value in result.reason_codes


def test_other_result_status_is_never_failure_report():
    value = report(status=ResultStatus.INCOMPLETE.value)
    result = validate_failure_report(value)
    assert not result.valid
    assert result.reason_codes[0] == FailureReportReasonCode.NOT_FAILURE_REPORT.value
