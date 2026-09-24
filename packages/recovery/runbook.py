"""Host-facing runbook projection; no process, DB or CLI invocation."""

from __future__ import annotations

from .disaster import BackupVerification, RestoreVerification, MigrationVerification
from .retention import RollbackApproval, RollbackApprovalOwner, rollback_decision


class RunbookService:
    def backup(self, *, backup_receipt: dict | None) -> dict:
        if type(backup_receipt) is not BackupVerification:
            return {"status": "BACKUP_NOT_VERIFIED", "evidence": None,
                    "next_action": "CREATE_AND_VERIFY_BACKUP"}
        return {"status": "BACKUP_VERIFIED", "evidence": backup_receipt.digest,
                "next_action": "REPLAY_IN_ISOLATED_DATABASE"}

    def restore(self, *, restore_receipt: dict | None) -> dict:
        if type(restore_receipt) is not RestoreVerification or restore_receipt.status != "RESTORE_VERIFIED":
            return {"status": "RESTORE_NOT_VERIFIED", "evidence": None,
                    "next_action": "COMPARE_REPLAYED_LINEAGE"}
        return {"status": "RESTORE_VERIFIED", "evidence": restore_receipt.evidence_hash,
                "next_action": "REVIEW_MIGRATION"}

    def migration(self, *, compatibility: dict | None) -> dict:
        if type(compatibility) is not MigrationVerification:
            return {"status": "MIGRATION_NOT_VERIFIED", "evidence": None,
                    "next_action": "RUN_ISOLATED_MIGRATION_REHEARSAL"}
        return {"status": "MIGRATION_COMPATIBLE", "evidence": compatibility.evidence_hash,
                "next_action": "REVIEW_ROLLBACK_DECISION"}

    def rollback(self, *, data_loss_possible: bool, subject_hash: str,
                 approval: RollbackApproval | None,
                 approval_owner: RollbackApprovalOwner | None = None) -> dict:
        try:
            status = rollback_decision(data_loss_possible=data_loss_possible,
                                       subject_hash=subject_hash, approval=approval,
                                       approval_owner=approval_owner)
        except ValueError:
            status = "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
        allowed = status == "ROLLBACK_ALLOWED"
        evidence = (approval.decision_hash if data_loss_possible and type(approval) is RollbackApproval
                    else subject_hash) if allowed else None
        return {"status": status,
                "input": {"subject_hash": subject_hash, "data_loss_possible": data_loss_possible},
                "evidence": evidence,
                "next_action": "REVIEW_APPROVED_ROLLBACK_PLAN" if allowed
                               else "OBTAIN_CANONICAL_HUMAN_DECISION"}
