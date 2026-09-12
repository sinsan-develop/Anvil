"""C-06 formal ``FAILURE_REPORT`` validator.

The validator is pure: it validates one C-05 ``ResultEnvelope`` and never
updates failure counters, lifecycle state, leases, or events.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import hashlib
import json
import re
from typing import Any, Mapping

from packages.execution.models import ResultStatus

from .delegation import _text as _validate_c02_text
from .delegation import _validate_repository_path
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
    CHANGED_PATH_INVALID = "CHANGED_PATH_INVALID"
    REMAINING_WORK_MISSING = "REMAINING_WORK_MISSING"
    ALTERNATIVE_REVIEW_MISSING = "ALTERNATIVE_REVIEW_MISSING"
    DECISION_REQUEST_MISSING = "DECISION_REQUEST_MISSING"
    FAILURE_CLASSIFICATION_INVALID = "FAILURE_CLASSIFICATION_INVALID"
    FAILURE_TEST_INVALID = "FAILURE_TEST_INVALID"
    ENVIRONMENT_FAILURE = "ENVIRONMENT_FAILURE"
    PERMISSION_FAILURE = "PERMISSION_FAILURE"
    QUOTA_FAILURE = "QUOTA_FAILURE"
    TOOL_INTERRUPTION = "TOOL_INTERRUPTION"
    USER_INTERRUPTION = "USER_INTERRUPTION"
    INPUT_CHANGED = "INPUT_CHANGED"
    UNSUBSTANTIATED_FAILURE = "UNSUBSTANTIATED_FAILURE"


_FINGERPRINT = re.compile(r"sha256:[0-9a-f]{64}\Z")
_FINGERPRINT_FIELDS = (
    "normalized_error_code",
    "failing_test_or_gate",
    "relevant_stack_fingerprint",
)
_REQUIRED_HANDOFF_TEXT = ("problem_name", "failure_stage", "confirmed_cause", *_FINGERPRINT_FIELDS)
_HANDOFF_ALIASES = frozenset(
    {
        "problem",
        "failed_stage",
        "stage",
        "root_cause",
        "cause",
        "alternatives",
        "failure_kind",
        "failure_category",
        "classification",
        "reason_code",
    }
)
_COUNTABLE_ORIGINS = frozenset({"CODE_DEFECT", "TEST_DEFECT", "CONTRACT_DEFECT", "DATA_DEFECT"})
_NON_COUNTABLE_ORIGINS = {
    "QUOTA_EXHAUSTED": FailureReportReasonCode.QUOTA_FAILURE,
    "PERMISSION_BLOCKED": FailureReportReasonCode.PERMISSION_FAILURE,
    "ENVIRONMENT_BLOCKED": FailureReportReasonCode.ENVIRONMENT_FAILURE,
    "TOOL_INTERRUPTION": FailureReportReasonCode.TOOL_INTERRUPTION,
    "USER_INTERRUPTION": FailureReportReasonCode.USER_INTERRUPTION,
    "INPUT_CHANGED": FailureReportReasonCode.INPUT_CHANGED,
}
_PASS_TEST_STATUS = "PASS"
_FAIL_TEST_STATUSES = frozenset({"FAIL", "FAILED", "ERROR", "RED"})
_NEUTRAL_TEST_STATUSES = frozenset({"SKIP", "SKIPPED", "XFAIL", "NOT_RUN"})


@dataclass(frozen=True, slots=True)
class FailureReportValidationResult:
    valid: bool
    reason_codes: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()


def _canonical_text(value: Any, field: str) -> bool:
    try:
        _validate_c02_text(value, field)
    except (TypeError, ValueError, UnicodeError):
        return False
    return True


def _nonempty_text_sequence(value: Any, field: str) -> bool:
    return (
        isinstance(value, (list, tuple))
        and bool(value)
        and all(_canonical_text(item, f"{field} item") for item in value)
    )


def _canonical_changed_path(value: str) -> bool:
    try:
        _validate_repository_path(value, "changed_paths")
    except (TypeError, ValueError, UnicodeError):
        return False
    return "\x00" not in value and "*" not in value


def _fingerprint_material(envelope: ResultEnvelope) -> tuple[str, str, str]:
    values = tuple(envelope.handoff.get(field) for field in _FINGERPRINT_FIELDS)
    if not all(_canonical_text(value, field) for field, value in zip(_FINGERPRINT_FIELDS, values)):
        raise ValueError("failure fingerprint material must contain canonical text")
    return values  # type: ignore[return-value]


def compute_failure_fingerprint(envelope: ResultEnvelope) -> str:
    """Hash the three design-authoritative failure identity fields.

    A canonical JSON array keeps field boundaries unambiguous. Lineage is
    intentionally absent because the ledger combines it with this hash.
    """

    if not isinstance(envelope, ResultEnvelope):
        raise TypeError("envelope must be a ResultEnvelope")
    encoded = json.dumps(
        _fingerprint_material(envelope),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    ).encode("utf-8", errors="strict")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def _classification_reason(envelope: ResultEnvelope) -> FailureReportReasonCode | None:
    origin = envelope.handoff.get("failure_origin")
    if not _canonical_text(origin, "handoff.failure_origin"):
        return FailureReportReasonCode.FAILURE_CLASSIFICATION_INVALID
    if origin in _COUNTABLE_ORIGINS:
        return None
    return _NON_COUNTABLE_ORIGINS.get(origin, FailureReportReasonCode.FAILURE_CLASSIFICATION_INVALID)


def _test_evidence_state(envelope: ResultEnvelope) -> tuple[bool, bool]:
    if not envelope.tests:
        return False, False
    failed_commands: set[str] = set()
    neutral_commands: set[str] = set()
    for test in envelope.tests:
        if test.status == _PASS_TEST_STATUS:
            if test.exit_code not in (None, 0):
                return False, False
            if test.command in failed_commands:
                return False, False
            neutral_commands.add(test.command)
            continue
        if test.status in _FAIL_TEST_STATUSES:
            if test.exit_code is not None and (type(test.exit_code) is not int or test.exit_code == 0):
                return False, False
            if test.command in neutral_commands:
                return False, False
            failed_commands.add(test.command)
            continue
        if test.status in _NEUTRAL_TEST_STATUSES:
            if test.exit_code not in (None, 0):
                return False, False
            if test.command in failed_commands:
                return False, False
            neutral_commands.add(test.command)
            continue
        return False, False
    target = envelope.handoff.get("failing_test_or_gate")
    return bool(failed_commands), target in failed_commands


def validate_failure_report(
    result: ResultEnvelope | Mapping[str, Any] | None,
    *,
    expected_fingerprint: str | None = None,
) -> FailureReportValidationResult:
    """Validate a C-05 envelope as one countable, evidence-backed failure."""

    base = validate_result(result)
    if not base.valid:
        return FailureReportValidationResult(
            False,
            (FailureReportReasonCode.BASE_RESULT_INVALID.value, *base.reason_codes),
            base.fields,
        )
    try:
        envelope = result if isinstance(result, ResultEnvelope) else ResultEnvelope.from_dict(result)
    except Exception:
        return FailureReportValidationResult(False, (FailureReportReasonCode.BASE_RESULT_INVALID.value,), ("result",))
    if envelope.status is not ResultStatus.FAILURE_REPORT:
        return FailureReportValidationResult(False, (FailureReportReasonCode.NOT_FAILURE_REPORT.value,), ("status",))

    reasons: list[str] = []
    fields: list[str] = []

    alias_keys = sorted(set(envelope.handoff) & _HANDOFF_ALIASES)
    if alias_keys:
        reasons.append(FailureReportReasonCode.FAILURE_CLASSIFICATION_INVALID.value)
        fields.extend(f"handoff.{key}" for key in alias_keys)

    for field in _REQUIRED_HANDOFF_TEXT:
        if _canonical_text(envelope.handoff.get(field), f"handoff.{field}"):
            continue
        if field == "failure_stage":
            reason = FailureReportReasonCode.FAILURE_STAGE_MISSING
        elif field == "confirmed_cause":
            reason = FailureReportReasonCode.CONFIRMED_CAUSE_MISSING
        else:
            reason = FailureReportReasonCode.REQUIRED_FAILURE_FIELD_MISSING
        reasons.append(reason.value)
        fields.append(f"handoff.{field}")

    alternatives = envelope.handoff.get("alternatives_considered")
    if not _nonempty_text_sequence(alternatives, "handoff.alternatives_considered"):
        reasons.append(FailureReportReasonCode.ALTERNATIVE_REVIEW_MISSING.value)
        fields.append("handoff.alternatives_considered")

    fingerprint = envelope.failure_fingerprint
    if not isinstance(fingerprint, str) or _FINGERPRINT.fullmatch(fingerprint) is None:
        reasons.append(FailureReportReasonCode.INVALID_FINGERPRINT.value)
        fields.append("failure_fingerprint")
    try:
        computed_fingerprint = compute_failure_fingerprint(envelope)
    except (TypeError, ValueError, UnicodeError):
        computed_fingerprint = None
    if computed_fingerprint is not None and fingerprint != computed_fingerprint:
        reasons.append(FailureReportReasonCode.FINGERPRINT_NOT_DETERMINISTIC.value)
        fields.append("failure_fingerprint")
    if expected_fingerprint is not None and fingerprint != expected_fingerprint:
        reasons.append(FailureReportReasonCode.FINGERPRINT_NOT_DETERMINISTIC.value)
        fields.append("failure_fingerprint")

    classification = _classification_reason(envelope)
    if classification is not None:
        reasons.append(classification.value)
        fields.append("handoff.failure_origin")

    if not envelope.evidence_refs or not envelope.tests:
        reasons.append(FailureReportReasonCode.FAILURE_EVIDENCE_MISSING.value)
        fields.append("evidence_refs/tests")
    else:
        coherent, target_bound = _test_evidence_state(envelope)
        if not coherent:
            reasons.append(FailureReportReasonCode.FAILURE_TEST_INVALID.value)
            fields.append("tests")
        elif not target_bound:
            reasons.append(FailureReportReasonCode.FAILURE_EVIDENCE_MISSING.value)
            fields.append("handoff.failing_test_or_gate")

    if not envelope.changed_paths:
        reasons.append(FailureReportReasonCode.CHANGED_PATHS_MISSING.value)
        fields.append("changed_paths")
    elif not all(_canonical_changed_path(path) for path in envelope.changed_paths):
        reasons.append(FailureReportReasonCode.CHANGED_PATH_INVALID.value)
        fields.append("changed_paths")
    if not envelope.unresolved:
        reasons.append(FailureReportReasonCode.REMAINING_WORK_MISSING.value)
        fields.append("unresolved")
    if not _canonical_text(envelope.decision_needed, "decision_needed"):
        reasons.append(FailureReportReasonCode.DECISION_REQUEST_MISSING.value)
        fields.append("decision_needed")
    if not envelope.actions_taken:
        reasons.append(FailureReportReasonCode.UNSUBSTANTIATED_FAILURE.value)
        fields.append("actions_taken")

    return FailureReportValidationResult(
        not reasons,
        tuple(dict.fromkeys(reasons)),
        tuple(dict.fromkeys(fields)),
    )


__all__ = [
    "FailureReportReasonCode",
    "FailureReportValidationResult",
    "compute_failure_fingerprint",
    "validate_failure_report",
]
