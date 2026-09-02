"""Approval records and nonsemantic reconfirmation evidence."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: str, field: str) -> None:
    if not isinstance(value, str) or not _HASH.fullmatch(value):
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


class ApprovalType(str, Enum):
    DESIGN_SPECIFICATION = "DESIGN_SPECIFICATION"
    WORK_PLAN = "WORK_PLAN"
    WORK_INSTRUCTION = "WORK_INSTRUCTION"
    EXECUTION_PLAN = "EXECUTION_PLAN"
    EXECUTION_MODE = "EXECUTION_MODE"
    PLAN = "PLAN"
    SCOPE_CHANGE = "SCOPE_CHANGE"
    APPLY = "APPLY"
    DEPLOY = "DEPLOY"
    DESTRUCTIVE = "DESTRUCTIVE"


class ApprovalStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INVALIDATED = "INVALIDATED"
    REVOKED = "REVOKED"
    SUPERSEDED = "SUPERSEDED"


@dataclass(frozen=True, slots=True)
class ApprovalRecord:
    approval_id: str
    approval_type: ApprovalType
    subject_id: str
    subject_hash: str
    approved_by: str
    authenticated_human: bool
    approved_at: datetime
    expires_at: datetime
    status: ApprovalStatus = ApprovalStatus.ACTIVE

    def __post_init__(self) -> None:
        for value, field in ((self.approval_id, "approval_id"), (self.subject_id, "subject_id"), (self.approved_by, "approved_by")):
            _required(value, field)
        if not isinstance(self.approval_type, ApprovalType):
            raise TypeError("approval_type must be ApprovalType")
        _hash(self.subject_hash, "subject_hash")
        if type(self.authenticated_human) is not bool:
            raise TypeError("authenticated_human must be bool")
        if not self.authenticated_human:
            raise ValueError("authenticated human approval is required")
        _utc(self.approved_at, "approved_at")
        _utc(self.expires_at, "expires_at")
        if self.expires_at <= self.approved_at:
            raise ValueError("expires_at must be after approved_at")
        if not isinstance(self.status, ApprovalStatus):
            raise TypeError("status must be ApprovalStatus")


@dataclass(frozen=True, slots=True)
class NonSemanticReconfirmation:
    binding_id: str
    root_human_approval_id: str
    parent_approval_id: str
    old_content_hash: str
    new_content_hash: str
    semantic_diff: str
    impact: str
    reason: str
    actor_id: str
    occurred_at: datetime
    functional_scope_changed: bool = False
    requirements_changed: bool = False
    critical_risk_changed: bool = False

    def __post_init__(self) -> None:
        for value, field in ((self.binding_id, "binding_id"), (self.root_human_approval_id, "root_human_approval_id"), (self.parent_approval_id, "parent_approval_id"), (self.semantic_diff, "semantic_diff"), (self.impact, "impact"), (self.reason, "reason"), (self.actor_id, "actor_id")):
            _required(value, field)
        _hash(self.old_content_hash, "old_content_hash")
        _hash(self.new_content_hash, "new_content_hash")
        _utc(self.occurred_at, "occurred_at")
        for value in (self.functional_scope_changed, self.requirements_changed, self.critical_risk_changed):
            if type(value) is not bool:
                raise TypeError("change markers must be bool")
