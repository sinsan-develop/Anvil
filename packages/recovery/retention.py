"""Dry-run retention and human-bound destructive rollback decisions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Protocol


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_PROTECTED = frozenset({"CHECKPOINT_STATE", "EVIDENCE_RAW", "EVIDENCE_MANIFEST", "AUDIT_EVENT"})


@dataclass(frozen=True)
class ArtifactRetention:
    artifact_id: str
    created_at: datetime
    retain_until: datetime
    references: tuple[str, ...]
    artifact_type: str


@dataclass(frozen=True)
class RetentionDecision:
    protected: tuple[str, ...]
    candidates: tuple[str, ...]
    deleted: tuple[str, ...] = ()


def decide_retention(rows: tuple[ArtifactRetention, ...], *, now: datetime) -> RetentionDecision:
    if type(now) is not datetime or now.tzinfo is None:
        raise ValueError("RETENTION_CLOCK_INVALID")
    protected, candidates = [], []
    for row in rows:
        if (type(row) is not ArtifactRetention or not row.artifact_id
                or row.created_at.tzinfo is None or row.retain_until.tzinfo is None
                or row.retain_until < row.created_at or type(row.references) is not tuple
                or type(row.artifact_type) is not str or not row.artifact_type):
            raise ValueError("RETENTION_INPUT_INVALID")
        if row.retain_until > now or row.references or row.artifact_type in _PROTECTED:
            protected.append(row.artifact_id)
        else:
            candidates.append(row.artifact_id)
    return RetentionDecision(tuple(protected), tuple(candidates))


@dataclass(frozen=True)
class RollbackApproval:
    subject_hash: str
    actor_id: str
    approved_at: datetime
    decision: str
    decision_hash: str


class RollbackApprovalOwner(Protocol):
    """Host-owned canonical approval lookup; unbound production is fail-closed."""
    def validate_data_loss_decision(self, subject_hash: str, decision: RollbackApproval) -> bool: ...


def rollback_decision(*, data_loss_possible: bool, subject_hash: str,
                      approval: RollbackApproval | None,
                      approval_owner: RollbackApprovalOwner | None = None) -> str:
    if type(subject_hash) is not str or not _HASH.fullmatch(subject_hash):
        raise ValueError("ROLLBACK_SUBJECT_INVALID")
    if not data_loss_possible:
        return "ROLLBACK_ALLOWED"
    if (type(approval) is not RollbackApproval or approval.subject_hash != subject_hash
            or not approval.actor_id or approval.approved_at.tzinfo is None
            or approval.decision != "APPROVED_DATA_LOSS_ROLLBACK"
            or type(approval.decision_hash) is not str or not _HASH.fullmatch(approval.decision_hash)
            or approval_owner is None):
        return "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
    try:
        accepted = approval_owner.validate_data_loss_decision(subject_hash, approval)
    except Exception:
        return "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
    return "ROLLBACK_ALLOWED" if accepted is True else "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
