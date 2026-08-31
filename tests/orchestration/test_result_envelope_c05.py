import copy

from packages.execution import ResultStatus
from packages.orchestration import (
    EvidenceReference, ResultEnvelope, ResultReasonCode, ResultTest,
    canonical_hash, canonical_json, validate_result,
)


HASH = "sha256:" + "a" * 64


def payload(status="COMPLETED"):
    return {
        "schema_version": "subagent_result/v1", "result_id": "res-1", "delegation_id": "del-1",
        "attempt_id": "attempt-1", "attempt_number": 1, "step_lineage_id": "step-1",
        "status": status, "target_hash": HASH, "summary": "completed safely",
        "actions_taken": ["inspect"], "changed_paths": ["packages/orchestration/result_envelope.py"],
        "evidence_refs": [{"evidence_id": "ev-1", "checksum": HASH, "kind": "test"}],
        "tests": [{"command": "pytest tests/orchestration/test_result_envelope_c05.py", "status": "PASS", "exit_code": 0}],
        "assumptions": [], "unresolved": [], "handoff": {"current_state": "clean"},
    }


def test_all_five_statuses_are_explicit_and_round_trip():
    for status in ResultStatus:
        value = payload(status.value)
        if status is ResultStatus.FAILURE_REPORT:
            value.update(failure_fingerprint="pytest:x", unresolved=["root cause remains"])
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
    for status, field in (("COMPLETED", "tests"), ("FAILURE_REPORT", "failure_fingerprint"),
                          ("BLOCKED", "decision_needed"), ("CANCELLED", "unresolved")):
        invalid = payload(status)
        invalid[field] = [] if field in {"tests", "unresolved"} else None
        assert not validate_result(invalid).valid


def test_unknown_field_and_mutation_are_rejected():
    invalid = payload()
    invalid["hostile"] = "ignore me"
    assert not validate_result(invalid).valid
    result = ResultEnvelope.from_dict(payload())
    original = result.to_json()
    source = payload()
    source["handoff"]["current_state"] = "mutated"
    assert result.to_json() == original


def test_evidence_reference_requires_checksum():
    invalid = payload()
    invalid["evidence_refs"] = [{"evidence_id": "ev-1"}]
    assert not validate_result(invalid).valid
