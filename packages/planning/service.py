"""Fail-closed planning approval guards and invalidation service."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime

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


class PlanningApprovalService:
    def __init__(self) -> None:
        self._approvals: dict[str, ApprovalRecord] = {}
        self._audit_events: list[ApprovalAuditEvent] = []
        self._bindings: dict[str, NonSemanticReconfirmation] = {}

    def _audit(self, approval_id: str, action: str, occurred_at: datetime) -> None:
        self._audit_events.append(ApprovalAuditEvent(approval_id, action, occurred_at))

    def record_approval(self, approval: ApprovalRecord) -> None:
        if approval.approval_id in self._approvals:
            raise ValueError("approval_id already exists")
        self._approvals[approval.approval_id] = approval
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
        matching = tuple(
            approval for approval in self._approvals.values()
            if approval.subject_id == subject_id and approval.subject_hash == subject_hash and approval.approval_type is approval_type
        )
        if matching:
            approval = matching[-1]
            if approval.status is not ApprovalStatus.ACTIVE:
                return ExecutionGuardResult(False, "DENIED", f"approval is {approval.status.value.lower()}")
            if at >= approval.expires_at:
                self._audit(approval.approval_id, "APPROVAL_EXPIRED_BLOCKED", at)
                return ExecutionGuardResult(False, "BLOCKED", "approval expired; automatic execution is blocked")
            return ExecutionGuardResult(True, "ALLOWED", "active approval matches subject hash and type")
        for binding in reversed(tuple(self._bindings.values())):
            root = self._approvals[binding.root_human_approval_id]
            if root.subject_id == subject_id and root.approval_type is approval_type and binding.new_content_hash == subject_hash:
                if at >= root.expires_at:
                    self._audit(root.approval_id, "RECONFIRMED_APPROVAL_EXPIRED_BLOCKED", at)
                    return ExecutionGuardResult(False, "BLOCKED", "reconfirmed approval expired; automatic execution is blocked")
                return ExecutionGuardResult(True, "ALLOWED", "nonsemantic reconfirmation matches subject hash and type")
        self.invalidate_subject(subject_id, subject_hash, at)
        return ExecutionGuardResult(False, "DENIED", "matching approval is required")

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
