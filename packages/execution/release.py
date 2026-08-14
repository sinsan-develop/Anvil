"""Human-only, fail-closed release decision guard."""

from __future__ import annotations

from dataclasses import dataclass

from .models import (
    Defect,
    DefectSeverity,
    DefectStatus,
    ProductValidation,
    ReleaseDecision,
    ReleaseDecisionKind,
    ValidationVerdict,
)


@dataclass(frozen=True, slots=True)
class ReleaseGuardResult:
    allowed: bool
    status: str
    reason: str


class ReleaseGuard:
    def evaluate(
        self,
        decision: ReleaseDecision,
        required_criterion_ids: frozenset[str],
        validations: tuple[ProductValidation, ...],
        defects: tuple[Defect, ...],
    ) -> ReleaseGuardResult:
        if decision.decision is not ReleaseDecisionKind.RELEASE:
            return ReleaseGuardResult(True, "DECIDED", "authenticated human non-release decision recorded")
        if not required_criterion_ids:
            return ReleaseGuardResult(False, "BLOCKED", "required ProductValidation criteria are missing")

        suitable_by_criterion: dict[str, ProductValidation] = {}
        for validation in validations:
            if validation.target_hash != decision.target_hash or validation.delivered_hash != decision.target_hash:
                continue
            if validation.verdict is ValidationVerdict.SUITABLE:
                suitable_by_criterion[validation.criterion_id] = validation
        missing = required_criterion_ids.difference(suitable_by_criterion)
        if missing:
            return ReleaseGuardResult(False, "BLOCKED", "required ProductValidation is missing, blocked, unsuitable, or hash-mismatched")

        blocking = tuple(
            defect
            for defect in defects
            if defect.target_hash == decision.target_hash
            and defect.blocking
            and defect.severity in {DefectSeverity.CRITICAL, DefectSeverity.MAJOR}
            and defect.status not in {DefectStatus.CLOSED, DefectStatus.REJECTED}
        )
        if blocking:
            return ReleaseGuardResult(False, "BLOCKED", "an open blocking defect prevents release")
        return ReleaseGuardResult(True, "ALLOWED", "human release decision matches completed validation and has no blocking defect")
