"""Deterministic G0-G3 verification and release/apply approval contracts.

The module is deliberately in-memory and side-effect free.  It is the
boundary between technical evidence and a human release decision; no result
is promoted from fixture/static evidence to an operational claim here.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import posixpath
from typing import Any, Mapping, Sequence

from packages.orchestration.result_envelope import canonical_hash, canonical_json


class GateStatus(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIPPED = "SKIPPED"
    BLOCKED = "BLOCKED"
    ERROR = "ERROR"


class GateReasonCode(StrEnum):
    INVALID_GATE = "INVALID_GATE"
    PASS_REQUIRED = "PASS_REQUIRED"
    TARGET_HASH_MISMATCH = "TARGET_HASH_MISMATCH"
    MANIFEST_HASH_MISMATCH = "MANIFEST_HASH_MISMATCH"
    DELIVERED_HASH_MISMATCH = "DELIVERED_HASH_MISMATCH"
    VERIFIED_HASH_MISMATCH = "VERIFIED_HASH_MISMATCH"
    BLOCKING_DEFECT = "BLOCKING_DEFECT"
    PRODUCT_VALIDATION_INCOMPLETE = "PRODUCT_VALIDATION_INCOMPLETE"
    PRODUCT_VALIDATION_FAILED = "PRODUCT_VALIDATION_FAILED"
    UNAUTHENTICATED_ACTOR = "UNAUTHENTICATED_ACTOR"
    INVALID_DECISION = "INVALID_DECISION"
    DECISION_NOT_RELEASE = "DECISION_NOT_RELEASE"
    STALE_APPROVAL = "STALE_APPROVAL"
    DUPLICATE_APPROVAL = "DUPLICATE_APPROVAL"
    REPLAY_CONFLICT = "REPLAY_CONFLICT"
    DIFF_OUT_OF_SCOPE = "DIFF_OUT_OF_SCOPE"
    DELETED_FILE = "DELETED_FILE"
    SECRET_PATTERN = "SECRET_PATTERN"
    TEST_MODIFIED = "TEST_MODIFIED"


_GATES = ("G0", "G1", "G2", "G3")


def _text(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: Any, field: str) -> None:
    if not isinstance(value, str) or len(value) != 71 or not value.startswith("sha256:"):
        raise ValueError(f"{field} must be a sha256 hash")
    try:
        int(value[7:], 16)
    except ValueError as exc:
        raise ValueError(f"{field} must be a sha256 hash") from exc


@dataclass(frozen=True, slots=True)
class GateResult:
    gate_code: str
    status: GateStatus
    target_hash: str
    evidence_refs: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = ()
    details: Mapping[str, Any] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.gate_code not in _GATES:
            raise ValueError("gate_code must be G0, G1, G2 or G3")
        if not isinstance(self.status, GateStatus):
            object.__setattr__(self, "status", GateStatus(self.status))
        _hash(self.target_hash, "target_hash")
        refs = tuple(self.evidence_refs)
        if any(not isinstance(item, str) or not item.strip() for item in refs):
            raise ValueError("evidence_refs must contain non-empty strings")
        if len(refs) != len(set(refs)):
            raise ValueError("evidence_refs must not contain duplicates")
        object.__setattr__(self, "evidence_refs", refs)
        object.__setattr__(self, "reason_codes", tuple(self.reason_codes))
        object.__setattr__(self, "details", dict(self.details or {}))

    @property
    def passed(self) -> bool:
        return self.status is GateStatus.PASS

    def to_dict(self) -> dict[str, Any]:
        return {"gate_code": self.gate_code, "status": self.status.value,
                "target_hash": self.target_hash, "evidence_refs": list(self.evidence_refs),
                "reason_codes": list(self.reason_codes), "details": dict(self.details)}


@dataclass(frozen=True, slots=True)
class EvidenceManifest:
    target_hash: str
    delivered_artifact_hash: str
    verified_artifact_hash: str
    environment_id: str
    evidence_refs: tuple[str, ...] = ()
    gate_results: tuple[GateResult, ...] = ()
    design_baseline_hash: str | None = None
    work_plan_hash: str | None = None
    work_instruction_hash: str | None = None
    git_head: str | None = None
    acquisition_mode: str = "fixture"
    skipped_or_blocked: tuple[str, ...] = ()
    unverified_scope: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for value, field in ((self.target_hash, "target_hash"),
                             (self.delivered_artifact_hash, "delivered_artifact_hash"),
                             (self.verified_artifact_hash, "verified_artifact_hash")):
            _hash(value, field)
        _text(self.environment_id, "environment_id")
        if self.delivered_artifact_hash != self.target_hash or self.verified_artifact_hash != self.target_hash:
            raise ValueError("delivered and verified hashes must equal target_hash")
        for field in ("design_baseline_hash", "work_plan_hash", "work_instruction_hash"):
            value = getattr(self, field)
            if value is not None:
                _hash(value, field)
        gates = tuple(self.gate_results)
        if any(not isinstance(item, GateResult) for item in gates):
            raise TypeError("gate_results must contain GateResult values")
        if len({item.gate_code for item in gates}) != len(gates):
            raise ValueError("gate_results must not contain duplicate gate codes")
        if any(item.target_hash != self.target_hash for item in gates):
            raise ValueError("every gate target_hash must equal manifest target_hash")
        object.__setattr__(self, "gate_results", gates)
        for field in ("evidence_refs", "skipped_or_blocked", "unverified_scope"):
            object.__setattr__(self, field, tuple(getattr(self, field)))

    @property
    def manifest_hash(self) -> str:
        return canonical_hash(self.to_dict(include_hash=False))

    def to_dict(self, *, include_hash: bool = True) -> dict[str, Any]:
        data = {"target_hash": self.target_hash,
                "delivered_artifact_hash": self.delivered_artifact_hash,
                "verified_artifact_hash": self.verified_artifact_hash,
                "environment_id": self.environment_id,
                "evidence_refs": list(self.evidence_refs),
                "gate_results": [item.to_dict() for item in self.gate_results],
                "design_baseline_hash": self.design_baseline_hash,
                "work_plan_hash": self.work_plan_hash,
                "work_instruction_hash": self.work_instruction_hash,
                "git_head": self.git_head, "acquisition_mode": self.acquisition_mode,
                "skipped_or_blocked": list(self.skipped_or_blocked),
                "unverified_scope": list(self.unverified_scope)}
        if include_hash:
            data["manifest_hash"] = self.manifest_hash
        return data


@dataclass(frozen=True, slots=True)
class DiffReview:
    passed: bool
    changed_paths: tuple[str, ...] = ()
    findings: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = ()


class DiffReviewService:
    """Perform deterministic change review checks before human review."""

    def review(self, *, changed_paths: Sequence[str], allowed_paths: Sequence[str],
               deleted_paths: Sequence[str] = (), modified_tests: bool = False,
               secret_patterns: Sequence[str] = (), dependency_changed: bool = False) -> DiffReview:
        def canonical(value: object) -> str | None:
            if not isinstance(value, str) or not value.strip():
                return None
            normalized = value.replace("\\", "/")
            if normalized.startswith("/") or posixpath.splitdrive(normalized)[0] or (len(normalized) >= 2 and normalized[1] == ":"):
                return None
            result = posixpath.normpath(normalized)
            if result in {".", ".."} or result.startswith("../"):
                return None
            return result

        allowed = tuple(item for item in (canonical(value) for value in allowed_paths) if item is not None)
        raw_paths = tuple(str(item) for item in changed_paths)
        paths = tuple(item for item in (canonical(value) for value in changed_paths) if item is not None)
        reasons: list[str] = []
        findings: list[str] = []
        if len(paths) != len(raw_paths):
            reasons.append(GateReasonCode.DIFF_OUT_OF_SCOPE.value)
            findings.extend(raw_paths[index] for index in range(len(raw_paths)) if canonical(raw_paths[index]) is None)
        for path in paths:
            if not any(path == root or path.startswith(root + "/") for root in allowed):
                reasons.append(GateReasonCode.DIFF_OUT_OF_SCOPE.value); findings.append(path)
        if deleted_paths:
            reasons.append(GateReasonCode.DELETED_FILE.value); findings.extend(map(str, deleted_paths))
        if modified_tests:
            reasons.append(GateReasonCode.TEST_MODIFIED.value)
        if secret_patterns:
            reasons.append(GateReasonCode.SECRET_PATTERN.value); findings.extend(map(str, secret_patterns))
        if dependency_changed:
            reasons.append("DEPENDENCY_CHANGED")
        return DiffReview(not reasons, paths, tuple(dict.fromkeys(findings)), tuple(dict.fromkeys(reasons)))


@dataclass(frozen=True, slots=True)
class ProductValidation:
    criterion_id: str
    target_hash: str
    verdict: str
    validated_by: str
    environment_id: str
    evidence_refs: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _text(self.criterion_id, "criterion_id"); _hash(self.target_hash, "target_hash")
        _text(self.validated_by, "validated_by"); _text(self.environment_id, "environment_id")
        if self.verdict not in {"SUITABLE", "NEEDS_IMPROVEMENT", "UNSUITABLE", "BLOCKED"}:
            raise ValueError("invalid product validation verdict")


@dataclass(frozen=True, slots=True)
class DefectAssessment:
    defect_id: str
    target_hash: str
    blocking: bool
    lifecycle: str = "OPEN"

    def __post_init__(self) -> None:
        _text(self.defect_id, "defect_id"); _hash(self.target_hash, "target_hash")

    @property
    def is_open_blocking(self) -> bool:
        return self.blocking and self.lifecycle not in {"CLOSED", "DEFERRED", "REJECTED"}


class ReleaseDecision(StrEnum):
    RELEASE = "RELEASE"
    REWORK = "REWORK"
    DEFER = "DEFER"
    REJECT = "REJECT"


@dataclass(frozen=True, slots=True)
class ReleaseDecisionRecord:
    decision_id: str
    target_hash: str
    decision: ReleaseDecision
    actor_id: str
    authenticated: bool
    manifest_hash: str


@dataclass(frozen=True, slots=True)
class ApprovalReceipt:
    accepted: bool
    duplicate: bool = False
    reason_codes: tuple[str, ...] = ()
    approval_id: str | None = None
    target_hash: str | None = None
    manifest_hash: str | None = None


class ReleaseApprovalService:
    """Create a human decision and bind Apply Approval to one manifest hash."""

    def __init__(self) -> None:
        self._decisions: dict[str, ReleaseDecisionRecord] = {}
        self._approvals: dict[str, ApprovalReceipt] = {}

    def decide(self, *, decision_id: str, target_hash: str, decision: ReleaseDecision | str,
               actor_id: str, authenticated: bool, manifest: EvidenceManifest,
               product_validations: Sequence[ProductValidation] = (),
               required_criteria: Sequence[str] = (), defects: Sequence[DefectAssessment] = ()) -> ReleaseDecisionRecord:
        _text(decision_id, "decision_id"); _hash(target_hash, "target_hash"); _text(actor_id, "actor_id")
        if not authenticated: raise ValueError(GateReasonCode.UNAUTHENTICATED_ACTOR.value)
        if target_hash != manifest.target_hash: raise ValueError(GateReasonCode.TARGET_HASH_MISMATCH.value)
        if not isinstance(decision, ReleaseDecision): decision = ReleaseDecision(decision)
        if decision is ReleaseDecision.RELEASE:
            self._assert_release_eligible(target_hash, manifest, product_validations, required_criteria, defects)
        record = ReleaseDecisionRecord(decision_id, target_hash, decision, actor_id, authenticated, manifest.manifest_hash)
        prior = self._decisions.get(decision_id)
        if prior is not None and prior != record: raise ValueError(GateReasonCode.REPLAY_CONFLICT.value)
        self._decisions[decision_id] = record
        return record

    def apply(self, *, approval_id: str, target_hash: str, manifest: EvidenceManifest,
              decision: ReleaseDecisionRecord) -> ApprovalReceipt:
        _text(approval_id, "approval_id"); _hash(target_hash, "target_hash")
        registered = self._decisions.get(decision.decision_id)
        if registered is not decision:
            return ApprovalReceipt(False, reason_codes=(GateReasonCode.STALE_APPROVAL.value,))
        prior = self._approvals.get(approval_id)
        if prior is not None:
            if prior.target_hash == target_hash and prior.manifest_hash == manifest.manifest_hash:
                return ApprovalReceipt(True, True, (GateReasonCode.DUPLICATE_APPROVAL.value,), approval_id, target_hash, manifest.manifest_hash)
            return ApprovalReceipt(False, False, (GateReasonCode.REPLAY_CONFLICT.value,), approval_id)
        if decision.decision is not ReleaseDecision.RELEASE:
            return ApprovalReceipt(False, reason_codes=(GateReasonCode.DECISION_NOT_RELEASE.value,))
        if decision.decision is not ReleaseDecision.RELEASE:
            return ApprovalReceipt(False, reason_codes=(GateReasonCode.DECISION_NOT_RELEASE.value,))
        gates_ok, _ = evaluate_gates(manifest.gate_results, target_hash=manifest.target_hash)
        if (not decision.authenticated or decision.target_hash != target_hash or
                manifest.target_hash != target_hash or decision.manifest_hash != manifest.manifest_hash or not gates_ok):
            return ApprovalReceipt(False, reason_codes=(GateReasonCode.STALE_APPROVAL.value,))
        receipt = ApprovalReceipt(True, approval_id=approval_id, target_hash=target_hash, manifest_hash=manifest.manifest_hash)
        self._approvals[approval_id] = receipt
        return receipt

    @staticmethod
    def _assert_release_eligible(target_hash: str, manifest: EvidenceManifest,
                                 validations: Sequence[ProductValidation], required: Sequence[str],
                                 defects: Sequence[DefectAssessment]) -> None:
        if any(item.status is not GateStatus.PASS for item in manifest.gate_results) or {item.gate_code for item in manifest.gate_results} != set(_GATES):
            raise ValueError(GateReasonCode.PASS_REQUIRED.value)
        if any(item.target_hash != target_hash for item in validations) or any(item.target_hash != target_hash for item in defects):
            raise ValueError(GateReasonCode.TARGET_HASH_MISMATCH.value)
        by_criterion = {item.criterion_id: item for item in validations}
        if any(cid not in by_criterion for cid in required):
            raise ValueError(GateReasonCode.PRODUCT_VALIDATION_INCOMPLETE.value)
        if any(by_criterion[cid].verdict != "SUITABLE" for cid in required):
            raise ValueError(GateReasonCode.PRODUCT_VALIDATION_FAILED.value)
        if any(item.is_open_blocking for item in defects):
            raise ValueError(GateReasonCode.BLOCKING_DEFECT.value)


def evaluate_gates(results: Sequence[GateResult], *, target_hash: str) -> tuple[bool, tuple[str, ...]]:
    """Return whether exactly one PASS result exists for every G0-G3."""
    _hash(target_hash, "target_hash")
    reasons: list[str] = []
    by_code: dict[str, GateResult] = {}
    for result in results:
        if result.target_hash != target_hash:
            reasons.append(GateReasonCode.TARGET_HASH_MISMATCH.value)
        if result.gate_code in by_code:
            reasons.append(GateReasonCode.INVALID_GATE.value)
        by_code[result.gate_code] = result
        if result.status is not GateStatus.PASS:
            reasons.append(GateReasonCode.PASS_REQUIRED.value)
    if set(by_code) != set(_GATES): reasons.append(GateReasonCode.INVALID_GATE.value)
    return not reasons, tuple(dict.fromkeys(reasons))


class GateEngine:
    """Small façade used by orchestration callers to evaluate a manifest."""

    def evaluate(self, results: Sequence[GateResult], *, target_hash: str) -> tuple[bool, tuple[str, ...]]:
        return evaluate_gates(results, target_hash=target_hash)

    def evaluate_manifest(self, manifest: EvidenceManifest) -> tuple[bool, tuple[str, ...]]:
        return evaluate_gates(manifest.gate_results, target_hash=manifest.target_hash)


# Names used by higher-level orchestration documents; aliases preserve one
# implementation and make the approval boundary explicit to callers.
ApplyApprovalService = ReleaseApprovalService
EvidenceManifestValidator = GateEngine


__all__ = ["GateStatus", "GateReasonCode", "GateResult", "EvidenceManifest", "DiffReview",
           "DiffReviewService", "ProductValidation", "DefectAssessment", "ReleaseDecision",
           "ReleaseDecisionRecord", "ApprovalReceipt", "ReleaseApprovalService", "ApplyApprovalService",
           "GateEngine", "EvidenceManifestValidator", "evaluate_gates"]
