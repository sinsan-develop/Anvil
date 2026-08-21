"""Public recovery projection with sensitive references excluded."""

from __future__ import annotations

from typing import Any

from .models import RecoveryDecision


def recovery_read_model(decision: RecoveryDecision) -> dict[str, Any]:
    return {
        "run_id": decision.run_id,
        "status": decision.status.value,
        "event_sequence": decision.event_sequence,
        "target_hash": decision.target_hash,
        "evidence_hash": decision.evidence_hash,
        "last_safe_checkpoint": {
            "checkpoint_id": decision.last_safe_checkpoint_id,
            "checkpoint_hash": decision.last_safe_checkpoint_hash,
        },
        "skipped_step_ids": list(decision.skipped_step_ids),
        "resumable_step_ids": list(decision.resumable_step_ids),
        "action_reconciliation": [
            {
                "action_id": item.action_id,
                "step_id": item.step_id,
                "classification": item.classification.value,
                "retry_allowed": item.retry_allowed,
                "authoritative_receipt_ref": item.authoritative_receipt_ref,
            }
            for item in decision.action_reconciliations
        ],
        "blocked_reason": decision.blocked_reason,
        "next_action": decision.next_action,
        "observed_at": decision.observed_at.isoformat(),
    }

