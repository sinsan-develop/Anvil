"""C-06 정식 ``FAILURE_REPORT`` 판정기.

이 모듈은 실패 횟수 집계나 takeover를 수행하지 않는다. C-05 ResultEnvelope의
실패 보고가 집계 가능한지에 대한 순수하고 결정론적인 판정만 제공한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import re
from typing import Any, Mapping

from packages.execution.models import ResultStatus

from .result_envelope import ResultEnvelope, validate_result


class FailureReportReasonCode(StrEnum):
    NOT_FAILURE_REPORT = "NOT_FAILURE_REPORT"
    BASE_RESULT_INVALID = "BASE_RESULT_INVALID"
    REQUIRED_FAILURE_FIELD_MISSING = "REQUIRED_FAILURE_FIELD_MISSING"
    INVALID_LINEAGE = "INVALID_LINEAGE"
    INVALID_FINGERPRINT = "INVALID_FINGERPRINT"
    FINGERPRINT_NOT_DETERMINISTIC = "FINGERPRINT_NOT_DETERMINISTIC"
    FAILURE_EVIDENCE_MISSING = "FAILURE_EVIDENCE_MISSING"
    FAILURE_STAGE_MISSING = "FAILURE_STAGE_MISSING"
    CONFIRMED_CAUSE_MISSING = "CONFIRMED_CAUSE_MISSING"
    CHANGED_PATHS_MISSING = "CHANGED_PATHS_MISSING"
    REMAINING_WORK_MISSING = "REMAINING_WORK_MISSING"
    ALTERNATIVE_REVIEW_MISSING = "ALTERNATIVE_REVIEW_MISSING"
    DECISION_REQUEST_MISSING = "DECISION_REQUEST_MISSING"
    ENVIRONMENT_FAILURE = "ENVIRONMENT_FAILURE"
    PERMISSION_FAILURE = "PERMISSION_FAILURE"
    QUOTA_FAILURE = "QUOTA_FAILURE"
    TOOL_INTERRUPTION = "TOOL_INTERRUPTION"
    UNSUBSTANTIATED_FAILURE = "UNSUBSTANTIATED_FAILURE"


# Lineage is a stable logical identifier, not a free-form report title.
_LINEAGE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{1,127}\Z")
_FINGERPRINT = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{2,127}\Z")


@dataclass(frozen=True, slots=True)
class FailureReportValidationResult:
    valid: bool
    reason_codes: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip()) and value == value.strip()


def _handoff(envelope: ResultEnvelope, *names: str) -> Any:
    for name in names:
        if name in envelope.handoff:
            return envelope.handoff[name]
    return None


def _has_text(value: Any) -> bool:
    if isinstance(value, str):
        return _text(value)
    if isinstance(value, (list, tuple)):
        return bool(value) and all(_text(item) for item in value)
    return False


def _failure_kind(envelope: ResultEnvelope) -> str | None:
    value = _handoff(envelope, "failure_kind", "failure_category", "classification", "reason_code")
    if not isinstance(value, str):
        return None
    return value.strip().upper().replace("-", "_").replace(" ", "_")


def _exclusion_reason(envelope: ResultEnvelope) -> FailureReportReasonCode | None:
    kind = _failure_kind(envelope)
    text = " ".join(
        str(value).lower()
        for value in (kind or "", envelope.summary, envelope.decision_needed or "", *_as_values(envelope.unresolved))
    )
    if any(token in text for token in ("quota", "rate_limit", "rate limit", "budget")):
        return FailureReportReasonCode.QUOTA_FAILURE
    if any(token in text for token in ("permission", "unauthorized", "forbidden", "access_denied", "access denied")):
        return FailureReportReasonCode.PERMISSION_FAILURE
    if any(token in text for token in ("environment", "dependency", "network_unavailable", "service_unavailable", "configuration")):
        return FailureReportReasonCode.ENVIRONMENT_FAILURE
    if any(token in text for token in ("tool_interruption", "tool_interrupted", "interrupted", "timeout")):
        return FailureReportReasonCode.TOOL_INTERRUPTION
    return None


def _as_values(values: tuple[str, ...]) -> tuple[str, ...]:
    return values


def compute_failure_fingerprint(envelope: ResultEnvelope) -> str:
    """Return the canonical fingerprint material for a failure report.

    The supplied fingerprint is deliberately not included in the material, so
    changing it cannot change its own expected value.  Callers may use this
    helper to create a stable report fingerprint from the logical failure
    identity and confirmed cause.
    """
    stage = _handoff(envelope, "failure_stage", "failed_stage", "stage") or ""
    cause = _handoff(envelope, "confirmed_cause", "root_cause", "cause") or ""
    problem = _handoff(envelope, "problem_name", "problem") or envelope.issue_id or envelope.summary
    return "|".join(str(value).strip() for value in (envelope.step_lineage_id, problem, stage, cause))


def validate_failure_report(
    result: ResultEnvelope | Mapping[str, Any] | None,
    *,
    expected_fingerprint: str | None = None,
) -> FailureReportValidationResult:
    """Validate a C-05 envelope as a countable, evidence-backed failure."""
    base = validate_result(result)
    if not base.valid:
        return FailureReportValidationResult(False, (FailureReportReasonCode.BASE_RESULT_INVALID.value, *base.reason_codes), base.fields)
    envelope = result if isinstance(result, ResultEnvelope) else ResultEnvelope.from_dict(result)
    if envelope.status is not ResultStatus.FAILURE_REPORT:
        return FailureReportValidationResult(False, (FailureReportReasonCode.NOT_FAILURE_REPORT.value,), ("status",))

    reasons: list[str] = []
    fields: list[str] = []
    if not _LINEAGE.fullmatch(envelope.step_lineage_id):
        reasons.append(FailureReportReasonCode.INVALID_LINEAGE.value); fields.append("step_lineage_id")
    fingerprint = envelope.failure_fingerprint
    if not _FINGERPRINT.fullmatch(fingerprint or ""):
        reasons.append(FailureReportReasonCode.INVALID_FINGERPRINT.value); fields.append("failure_fingerprint")
    if expected_fingerprint is not None and fingerprint != expected_fingerprint:
        reasons.append(FailureReportReasonCode.FINGERPRINT_NOT_DETERMINISTIC.value); fields.append("failure_fingerprint")

    problem = _handoff(envelope, "problem_name", "problem") or envelope.issue_id
    stage = _handoff(envelope, "failure_stage", "failed_stage", "stage")
    cause = _handoff(envelope, "confirmed_cause", "root_cause", "cause")
    alternatives = _handoff(envelope, "alternatives_considered", "alternatives")
    if not _has_text(problem):
        reasons.append(FailureReportReasonCode.REQUIRED_FAILURE_FIELD_MISSING.value); fields.append("problem_name/issue_id")
    if not _has_text(stage):
        reasons.append(FailureReportReasonCode.FAILURE_STAGE_MISSING.value); fields.append("handoff.failure_stage")
    if not _has_text(cause):
        reasons.append(FailureReportReasonCode.CONFIRMED_CAUSE_MISSING.value); fields.append("handoff.confirmed_cause")
    if not envelope.evidence_refs or not envelope.tests:
        reasons.append(FailureReportReasonCode.FAILURE_EVIDENCE_MISSING.value); fields.append("evidence_refs/tests")
    elif not any(test.exit_code not in (None, 0) or test.status.upper() in {"FAIL", "FAILED", "ERROR", "RED"} for test in envelope.tests):
        reasons.append(FailureReportReasonCode.FAILURE_EVIDENCE_MISSING.value); fields.append("tests")
    if not envelope.changed_paths:
        reasons.append(FailureReportReasonCode.CHANGED_PATHS_MISSING.value); fields.append("changed_paths")
    if not envelope.unresolved:
        reasons.append(FailureReportReasonCode.REMAINING_WORK_MISSING.value); fields.append("unresolved")
    if not _has_text(alternatives):
        reasons.append(FailureReportReasonCode.ALTERNATIVE_REVIEW_MISSING.value); fields.append("handoff.alternatives_considered")
    if not _text(envelope.decision_needed):
        reasons.append(FailureReportReasonCode.DECISION_REQUEST_MISSING.value); fields.append("decision_needed")

    excluded = _exclusion_reason(envelope)
    if excluded is not None:
        reasons.append(excluded.value)
    elif not reasons and not envelope.actions_taken:
        reasons.append(FailureReportReasonCode.UNSUBSTANTIATED_FAILURE.value); fields.append("actions_taken")
    return FailureReportValidationResult(not reasons, tuple(dict.fromkeys(reasons)), tuple(dict.fromkeys(fields)))


__all__ = ["FailureReportReasonCode", "FailureReportValidationResult", "compute_failure_fingerprint", "validate_failure_report"]
