"""Fail-closed planning approval guards and invalidation service."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import Enum

from .approval import ApprovalRecord, ApprovalStatus, ApprovalType, NonSemanticReconfirmation


@dataclass(frozen=True, slots=True)
class ApprovalAuditEvent:
    approval_id: str
    action: str
    occurred_at: datetime


@dataclass(frozen=True, slots=True)
class ExecutionGuardResult:
    allowed: bool
    status: str
    reason: str
    reason_code: str = "APPROVAL_REQUIRED"


class MainAuthoritySource(str, Enum):
    CONTROL_PLANE = "CONTROL_PLANE"


class MainAuthorityStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    TERMINATED = "TERMINATED"
    MISSING = "MISSING"


@dataclass(frozen=True, slots=True)
class MainAuthorityRecord:
    actor_id: str
    plan_id: str
    observed_at: datetime
    expires_at: datetime
    authority_source: MainAuthoritySource
    authority_event_hash: str
    expected_execution_fencing_token: str
    status: MainAuthorityStatus = MainAuthorityStatus.ACTIVE

    def __post_init__(self):
        from .models import _required, _canonical_hash, _utc
        for name in ("actor_id", "plan_id", "expected_execution_fencing_token"):
            value = getattr(self, name)
            if type(value) is not str: raise ValueError("invalid authority text")
            _required(value, name)
        if type(self.authority_source) is not MainAuthoritySource or type(self.status) is not MainAuthorityStatus:
            raise ValueError("canonical control-plane authority required")
        _canonical_hash(self.authority_event_hash, "authority_event_hash")
        _utc(self.observed_at, "observed_at"); _utc(self.expires_at, "expires_at")
        if self.expires_at <= self.observed_at: raise ValueError("invalid authority interval")


@dataclass(frozen=True, slots=True)
class MainAuthorityAuditEvent:
    plan_id: str
    actor_id: str
    authority_event_hash: str | None
    reason_code: str
    occurred_at: datetime


class PlanningMainAuthorityService:
    """In-memory host control-plane adapter, not an agent-supplied DTO.

    As with B-04 approval admission, only the trusted embedding host may call
    record_observation. The host authenticates event provenance externally;
    this adapter owns current-record selection, validation and local audit.
    No network, worker execution, or process-liveness IO occurs here.
    """
    def __init__(self):
        self._records: dict[str, MainAuthorityRecord] = {}
        self._audit_events: list[MainAuthorityAuditEvent] = []

    def record_observation(self, record: MainAuthorityRecord) -> None:
        if type(record) is not MainAuthorityRecord: raise ValueError("control-plane record required")
        record = replace(record)
        if record.authority_event_hash in self._records: raise ValueError("authority event already recorded")
        self._records[record.authority_event_hash] = record
        self._audit_events.append(MainAuthorityAuditEvent(record.plan_id, record.actor_id,
            record.authority_event_hash, "MAIN_AUTHORITY_RECORDED", record.observed_at))

    def execution_guard(self, claim, plan_id: str, at: datetime) -> ExecutionGuardResult:
        from .models import _utc
        from .planner import MainResponsibility
        current = None

        def result(code, allowed=False):
            self._audit_events.append(MainAuthorityAuditEvent(
                plan_id if type(plan_id) is str else "", current.actor_id if current else "",
                current.authority_event_hash if current else None, code, at))
            return ExecutionGuardResult(allowed, "ALLOWED" if allowed else "BLOCKED", code, code)

        try:
            _utc(at, "at")
            if type(claim) is not MainResponsibility: return result("MAIN_RESPONSIBILITY_REQUIRED")
            if not self._records: return result("MAIN_AUTHORITY_REQUIRED")
            observed = max(item.observed_at for item in self._records.values())
            latest = tuple(item for item in self._records.values() if item.observed_at == observed)
            if len(latest) != 1: return result("MAIN_AUTHORITY_AMBIGUOUS")
            current = latest[0]
            current.__post_init__()
            if current.status is not MainAuthorityStatus.ACTIVE: return result("MAIN_NOT_ACTIVE")
            if claim.role != "MAIN" or claim.status != "ACTIVE": return result("MAIN_NOT_ACTIVE")
            _utc(claim.observed_at, "observed_at"); _utc(claim.expires_at, "expires_at")
            if not current.observed_at <= at < current.expires_at or not claim.observed_at <= at < claim.expires_at:
                return result("MAIN_AUTHORITY_STALE")
            if type(claim.execution_fencing_token) is not str or claim.execution_fencing_token != current.expected_execution_fencing_token:
                return result("MAIN_FENCING_MISMATCH")
            if (claim.plan_id != plan_id or current.plan_id != plan_id or claim.actor_id != current.actor_id
                or type(claim.authority_source) is not str or claim.authority_source != current.authority_source.value
                or claim.authority_event_hash != current.authority_event_hash
                or claim.observed_at != current.observed_at or claim.expires_at != current.expires_at):
                return result("MAIN_AUTHORITY_MISMATCH")
            return result("MAIN_AUTHORITY_VERIFIED", True)
        except (ValueError, TypeError, AttributeError):
            return result("MAIN_AUTHORITY_INVALID")

    def audit_events(self) -> tuple[MainAuthorityAuditEvent, ...]:
        return tuple(self._audit_events)


class PlanningApprovalService:
    def __init__(self) -> None:
        self._approvals: dict[str, ApprovalRecord] = {}
        self._audit_events: list[ApprovalAuditEvent] = []
        self._bindings: dict[str, NonSemanticReconfirmation] = {}

    def _audit(self, approval_id: str, action: str, occurred_at: datetime) -> None:
        self._audit_events.append(ApprovalAuditEvent(approval_id, action, occurred_at))

    def record_approval(self, approval: ApprovalRecord) -> None:
        if type(approval) is not ApprovalRecord:
            raise ValueError("authenticated human approval record required")
        approval.__post_init__()
        if approval.approval_id in self._approvals:
            raise ValueError("approval_id already exists")
        self._approvals[approval.approval_id] = replace(approval)
        self._audit(approval.approval_id, "APPROVAL_RECORDED", approval.approved_at)

    def invalidate_subject(self, subject_id: str, current_hash: str, occurred_at: datetime) -> tuple[ApprovalRecord, ...]:
        changed: list[ApprovalRecord] = []
        for approval_id, approval in tuple(self._approvals.items()):
            if approval.subject_id == subject_id and approval.subject_hash != current_hash and approval.status is ApprovalStatus.ACTIVE:
                invalidated = replace(approval, status=ApprovalStatus.INVALIDATED)
                self._approvals[approval_id] = invalidated
                changed.append(invalidated)
                self._audit(approval_id, "APPROVAL_INVALIDATED_HASH_CHANGED", occurred_at)
        return tuple(changed)

    def execution_guard(self, subject_id: str, subject_hash: str, approval_type: ApprovalType, at: datetime) -> ExecutionGuardResult:
        from .approval import _utc
        try:
            _utc(at, "at")
        except ValueError:
            return ExecutionGuardResult(False, "BLOCKED", "invalid evaluation time", "TIME_INVALID")
        matching = tuple(
            approval for approval in self._approvals.values()
            if approval.subject_id == subject_id and approval.subject_hash == subject_hash and approval.approval_type is approval_type
        )
        if matching:
            approval = matching[-1]
            if approval.status is not ApprovalStatus.ACTIVE:
                return ExecutionGuardResult(False, "DENIED", f"approval is {approval.status.value.lower()}")
            if at < approval.approved_at:
                return ExecutionGuardResult(False, "BLOCKED", "approval is not yet valid", "APPROVAL_NOT_YET_VALID")
            if at >= approval.expires_at:
                self._audit(approval.approval_id, "APPROVAL_EXPIRED_BLOCKED", at)
                return ExecutionGuardResult(False, "BLOCKED", "approval expired; automatic execution is blocked", "APPROVAL_EXPIRED")
            return ExecutionGuardResult(True, "ALLOWED", "active approval matches subject hash and type")
        for binding in reversed(tuple(self._bindings.values())):
            root = self._approvals[binding.root_human_approval_id]
            if root.subject_id == subject_id and root.approval_type is approval_type and binding.new_content_hash == subject_hash:
                if at < max(root.approved_at, binding.occurred_at):
                    return ExecutionGuardResult(False, "BLOCKED", "reconfirmation is not yet valid", "APPROVAL_NOT_YET_VALID")
                if at >= root.expires_at:
                    self._audit(root.approval_id, "RECONFIRMED_APPROVAL_EXPIRED_BLOCKED", at)
                    return ExecutionGuardResult(False, "BLOCKED", "reconfirmed approval expired; automatic execution is blocked", "APPROVAL_EXPIRED")
                return ExecutionGuardResult(True, "ALLOWED", "nonsemantic reconfirmation matches subject hash and type")
        self.invalidate_subject(subject_id, subject_hash, at)
        return ExecutionGuardResult(False, "DENIED", "matching approval is required")

    def exact_execution_guard(self, subject_id: str, subject_hash: str,
                              approval_type: ApprovalType, at: datetime, *,
                              minimum_approved_at: datetime | None = None,
                              maximum_approved_at: datetime | None = None) -> ExecutionGuardResult:
        """C-11: current exact human record only; no derived agreement fallback.

        Record admission remains the existing B-04 trusted host boundary. This
        read-only check neither authenticates users nor contacts an authority.
        A newer record for this subject/type supersedes an older matching hash.
        """
        from .approval import _utc
        denied = ExecutionGuardResult(False, "BLOCKED", "current exact approval required")
        try:
            _utc(at, "at")
            records = tuple(record for record in self._approvals.values()
                if record.subject_id == subject_id and record.approval_type is approval_type)
            if not records: return denied
            # Ingestion order is not authority. Ambiguous equal-time records
            # fail closed, including a same-time revoke or different hash.
            latest_at = max(record.approved_at for record in records)
            current = tuple(record for record in records if record.approved_at == latest_at)
            if len(current) != 1: return denied
            record = current[0]
            if type(record) is not ApprovalRecord: return denied
            record.__post_init__()
            if record.subject_hash != subject_hash or record.status is not ApprovalStatus.ACTIVE:
                return denied
            if at < record.approved_at:
                return ExecutionGuardResult(False, "BLOCKED", "not yet valid", "APPROVAL_NOT_YET_VALID")
            if at >= record.expires_at:
                return ExecutionGuardResult(False, "BLOCKED", "expired", "APPROVAL_EXPIRED")
            for bound in (minimum_approved_at, maximum_approved_at):
                if bound is not None: _utc(bound, "approval lineage boundary")
            if ((minimum_approved_at is not None and record.approved_at < minimum_approved_at)
                or (maximum_approved_at is not None and record.approved_at > maximum_approved_at)):
                return ExecutionGuardResult(False, "BLOCKED", "approval chronology violates artifact lineage", "APPROVAL_LINEAGE_INVALID")
            return ExecutionGuardResult(True, "ALLOWED", "current exact human approval", "APPROVED")
        except (ValueError, TypeError, AttributeError):
            return denied

    def reconfirm_nonsemantic(self, binding: NonSemanticReconfirmation) -> None:
        root = self._approvals.get(binding.root_human_approval_id)
        parent = self._approvals.get(binding.parent_approval_id)
        invalid = (
            binding.binding_id in self._bindings
            or binding.old_content_hash == binding.new_content_hash
            or root is None
            or parent is None
            or root is not parent
            or not root.authenticated_human
            or root.status is not ApprovalStatus.ACTIVE
            or root.subject_hash != binding.old_content_hash
            or binding.occurred_at < root.approved_at
            or binding.occurred_at >= root.expires_at
            or binding.semantic_diff != "NONE"
            or binding.functional_scope_changed
            or binding.requirements_changed
            or binding.critical_risk_changed
        )
        if invalid:
            raise ValueError("nonsemantic reconfirmation cannot replace required human approval")
        self._approvals[root.approval_id] = replace(root, status=ApprovalStatus.SUPERSEDED)
        self._bindings[binding.binding_id] = binding
        self._audit(binding.root_human_approval_id, "MAIN_RECONFIRMED_NON_SEMANTIC", binding.occurred_at)

    def approval(self, approval_id: str) -> ApprovalRecord | None:
        return self._approvals.get(approval_id)

    def audit_events(self) -> tuple[ApprovalAuditEvent, ...]:
        return tuple(self._audit_events)
