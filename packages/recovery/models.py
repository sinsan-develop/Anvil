"""Immutable values used to reconcile a terminated Run."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
import re
from typing import Any


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: str, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a canonical sha256 hash")


class ActionStatus(StrEnum):
    SUCCESS = "SUCCESS"
    RUNNING = "RUNNING"
    REQUEST_PREPARED = "REQUEST_PREPARED"
    REQUEST_SENT = "REQUEST_SENT"


class ReconciliationClass(StrEnum):
    CONFIRMED_SUCCESS = "confirmed_success"
    SAFE_RETRY = "safe_retry"
    MANUAL_REVIEW = "manual_review"


class RecoveryStatus(StrEnum):
    READY_TO_RESUME = "READY_TO_RESUME"
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"
    BLOCKED_SECRET_REVOKED = "BLOCKED_SECRET_REVOKED"
    BLOCKED_CAPABILITY_DRIFT = "BLOCKED_CAPABILITY_DRIFT"


class StaleRecoveryFencingToken(ValueError):
    code = "STALE_FENCING_TOKEN"


@dataclass(frozen=True, slots=True)
class ActionAttempt:
    action_id: str
    step_id: str
    status: ActionStatus
    idempotency_key: str
    provider_receipt_ref: str | None = None

    def __post_init__(self) -> None:
        for value, field in (
            (self.action_id, "action_id"),
            (self.step_id, "step_id"),
            (self.idempotency_key, "idempotency_key"),
        ):
            _text(value, field)
        if not isinstance(self.status, ActionStatus):
            raise ValueError("status must be an ActionStatus")
        if self.provider_receipt_ref is not None:
            _text(self.provider_receipt_ref, "provider_receipt_ref")


@dataclass(frozen=True, slots=True)
class ActionReconciliation:
    action_id: str
    step_id: str
    classification: ReconciliationClass
    retry_allowed: bool
    authoritative_receipt_ref: str | None


@dataclass(frozen=True, slots=True)
class RecoveryInput:
    run_id: str
    project_id: str
    environment_id: str
    db_event_sequence: int
    progress_event_sequence: int
    handoff_event_sequence: int
    checkpoint_id: str
    checkpoint_hash: str
    target_hash: str
    git_head: str
    actions: tuple[ActionAttempt, ...]
    secret_reference: str
    secret_status: str
    capability_snapshot_hash: str
    current_capability_hash: str
    required_capabilities: frozenset[str]
    current_capabilities: frozenset[str]

    def __post_init__(self) -> None:
        for value, field in (
            (self.run_id, "run_id"),
            (self.project_id, "project_id"),
            (self.environment_id, "environment_id"),
            (self.checkpoint_id, "checkpoint_id"),
            (self.git_head, "git_head"),
        ):
            _text(value, field)
        for value, field in (
            (self.checkpoint_hash, "checkpoint_hash"),
            (self.target_hash, "target_hash"),
            (self.capability_snapshot_hash, "capability_snapshot_hash"),
            (self.current_capability_hash, "current_capability_hash"),
        ):
            _hash(value, field)
        for value, field in (
            (self.db_event_sequence, "db_event_sequence"),
            (self.progress_event_sequence, "progress_event_sequence"),
            (self.handoff_event_sequence, "handoff_event_sequence"),
        ):
            if type(value) is not int or value < 0:
                raise ValueError(f"{field} must be a non-negative integer")
        object.__setattr__(self, "actions", tuple(self.actions))
        if any(not isinstance(action, ActionAttempt) for action in self.actions):
            raise ValueError("actions must contain ActionAttempt values")
        if not self.secret_reference.startswith("secret://") or any(
            marker in self.secret_reference.lower() for marker in ("password=", "token=", "value=")
        ):
            raise ValueError("secret_reference must be a reference-only URI")
        if self.secret_status not in {"ACTIVE", "ROTATING", "REVOKED", "EXPIRED"}:
            raise ValueError("secret_status is invalid")
        for values, field in (
            (self.required_capabilities, "required_capabilities"),
            (self.current_capabilities, "current_capabilities"),
        ):
            frozen = frozenset(values)
            if any(not isinstance(value, str) or not value.strip() for value in frozen):
                raise ValueError(f"{field} must contain canonical strings")
            object.__setattr__(self, field, frozen)


@dataclass(frozen=True, slots=True)
class RecoveryDecision:
    run_id: str
    status: RecoveryStatus
    event_sequence: int
    target_hash: str
    evidence_hash: str
    last_safe_checkpoint_id: str
    last_safe_checkpoint_hash: str
    skipped_step_ids: tuple[str, ...]
    resumable_step_ids: tuple[str, ...]
    action_reconciliations: tuple[ActionReconciliation, ...]
    blocked_reason: str | None
    next_action: str
    observed_at: datetime


@dataclass(frozen=True, slots=True)
class RecoveryAuditEvent:
    run_id: str
    event_type: str
    actor_id: str
    occurred_at: datetime
    secret_reference: str | None = None
    reason: str | None = None

    def as_public_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "event_type": self.event_type,
            "actor_id": self.actor_id,
            "occurred_at": self.occurred_at.isoformat(),
            "secret_reference": self.secret_reference,
            "reason": self.reason,
        }


@dataclass(frozen=True, slots=True)
class ResumeLease:
    run_id: str
    worker_epoch: int
    execution_fencing_token: str
    write_epoch: int
    write_fencing_token: str

    def __post_init__(self) -> None:
        _text(self.run_id, "run_id")
        if type(self.worker_epoch) is not int or self.worker_epoch < 1:
            raise ValueError("worker epoch must be a positive integer")
        if type(self.write_epoch) is not int or self.write_epoch < 1:
            raise ValueError("write epoch must be a positive integer")
        for value in (self.execution_fencing_token, self.write_fencing_token):
            if not isinstance(value, str) or re.fullmatch(r"[A-Za-z0-9_-]{32,}", value) is None:
                raise ValueError("fencing token must contain at least 32 safe characters")


@dataclass(frozen=True, slots=True)
class ResumeReceipt:
    run_id: str
    resume_epoch: int
    checkpoint_id: str
