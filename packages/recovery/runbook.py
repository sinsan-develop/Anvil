"""Host-facing runbook projection; no process, DB or CLI invocation."""

from __future__ import annotations

from .disaster import BackupVerification, RestoreVerification, MigrationVerification


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
