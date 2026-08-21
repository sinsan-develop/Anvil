"""Recovery reconciliation without secret reads or provider side effects."""

from __future__ import annotations

from datetime import datetime
import hashlib
import json
from typing import Callable

from packages.persistence.recovery_repository import RecoveryRepository

from .models import (
    ActionAttempt,
    ActionReconciliation,
    ActionStatus,
    ReconciliationClass,
    RecoveryAuditEvent,
    RecoveryDecision,
    RecoveryInput,
    RecoveryStatus,
    StaleRecoveryFencingToken,
)


def reconcile_action(
    action: ActionAttempt, *, authoritative_receipt_ref: str | None = None
) -> ActionReconciliation:
    receipt = authoritative_receipt_ref or action.provider_receipt_ref
    if action.status is ActionStatus.SUCCESS or receipt is not None:
        classification = ReconciliationClass.CONFIRMED_SUCCESS
    elif action.status in {ActionStatus.REQUEST_PREPARED, ActionStatus.RUNNING}:
        classification = ReconciliationClass.SAFE_RETRY
    else:
        classification = ReconciliationClass.MANUAL_REVIEW
    return ActionReconciliation(
        action.action_id,
        action.step_id,
        classification,
        classification is ReconciliationClass.SAFE_RETRY,
        receipt,
    )


class RecoveryService:
    def __init__(
        self,
        repository: RecoveryRepository,
        *,
        read_secret: Callable[[str], object] | None = None,
        call_provider: Callable[[], object] | None = None,
    ) -> None:
        self._repository = repository
        self._read_secret = read_secret
        self._call_provider = call_provider

    def inspect(self, run_id: str) -> RecoveryInput:
        """Return immutable recovery input without recording a decision or audit."""
        return self._repository.load(run_id)

    def reconcile(self, run_id: str, *, actor_id: str, observed_at: datetime) -> RecoveryDecision:
        source = self._repository.load(run_id)
        sequences = {
            source.db_event_sequence,
            source.progress_event_sequence,
            source.handoff_event_sequence,
        }
        status = RecoveryStatus.READY_TO_RESUME
        blocked_reason: str | None = None
        next_action = "RESUME_INTERRUPTED_STEPS"
        if len(sequences) != 1:
            status = RecoveryStatus.RECONCILIATION_REQUIRED
            blocked_reason = "EVENT_SEQUENCE_MISMATCH"
            next_action = "RECONCILE_DB_PROGRESS_HANDOFF"
        elif source.secret_status in {"REVOKED", "EXPIRED"}:
            status = RecoveryStatus.BLOCKED_SECRET_REVOKED
            blocked_reason = "SECRET_VERSION_REVOKED"
            next_action = "ROTATE_SECRET_AND_CREATE_NEW_RUN"
            self._repository.append_audit(
                RecoveryAuditEvent(
                    source.run_id,
                    "RECOVERY_SECRET_REVOKED",
                    actor_id,
                    observed_at,
                    source.secret_reference,
                    blocked_reason,
                )
            )
        elif (
            source.capability_snapshot_hash != source.current_capability_hash
            or not source.required_capabilities <= source.current_capabilities
        ):
            status = RecoveryStatus.BLOCKED_CAPABILITY_DRIFT
            blocked_reason = "CAPABILITY_SNAPSHOT_DRIFT"
            next_action = "CREATE_NEW_RUN_OR_REPLAN"

        actions = tuple(reconcile_action(action) for action in source.actions)
        skipped = tuple(
            dict.fromkeys(
                item.step_id
                for item in actions
                if item.classification is ReconciliationClass.CONFIRMED_SUCCESS
            )
        )
        resumable = tuple(
            dict.fromkeys(
                item.step_id
                for item in actions
                if item.classification is ReconciliationClass.SAFE_RETRY
            )
        )
        evidence = {
            "run_id": source.run_id,
            "status": status.value,
            "event_sequences": sorted(sequences),
            "checkpoint_hash": source.checkpoint_hash,
            "target_hash": source.target_hash,
            "git_head": source.git_head,
            "actions": [
                {
                    "action_id": item.action_id,
                    "classification": item.classification.value,
                    "receipt_ref": item.authoritative_receipt_ref,
                }
                for item in actions
            ],
            "blocked_reason": blocked_reason,
        }
        evidence_hash = "sha256:" + hashlib.sha256(
            json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        decision = RecoveryDecision(
            source.run_id,
            status,
            source.db_event_sequence,
            source.target_hash,
            evidence_hash,
            source.checkpoint_id,
            source.checkpoint_hash,
            skipped,
            resumable,
            actions,
            blocked_reason,
            next_action,
            observed_at,
        )
        self._repository.save_decision(decision)
        return decision


__all__ = ["RecoveryService", "StaleRecoveryFencingToken", "reconcile_action"]
