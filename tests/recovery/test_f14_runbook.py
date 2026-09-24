from packages.recovery.runbook import RunbookService
from packages.recovery.disaster import verify_migration_observation
from packages.recovery.retention import RollbackApproval
from datetime import datetime, timezone


def test_runbook_reports_structured_blocked_state_without_running_commands():
    service = RunbookService()
    result = service.backup(backup_receipt=None)
    assert result["status"] == "BACKUP_NOT_VERIFIED"
    assert result["next_action"] == "CREATE_AND_VERIFY_BACKUP"
    assert "command" not in result
    assert service.restore(restore_receipt=None)["status"] == "RESTORE_NOT_VERIFIED"
    assert service.migration(compatibility=None)["status"] == "MIGRATION_NOT_VERIFIED"


def test_runbook_rejects_forged_receipt_dicts():
    service = RunbookService()
    assert service.backup(backup_receipt={"status": "BACKUP_VERIFIED", "sha256": "sha256:" + "a" * 64})["status"] == "BACKUP_NOT_VERIFIED"
    assert service.restore(restore_receipt={"status": "RESTORE_VERIFIED", "evidence_hash": "sha256:" + "a" * 64})["status"] == "RESTORE_NOT_VERIFIED"
    assert service.migration(compatibility={"status": "MIGRATION_COMPATIBLE"})["status"] == "MIGRATION_NOT_VERIFIED"
    assert service.migration(compatibility=18)["status"] == "MIGRATION_NOT_VERIFIED"


def test_runbook_accepts_checked_migration_evidence_only():
    service = RunbookService()
    checked = verify_migration_observation(180004, {"plpgsql", "vector"}, "vector:0.8",
                                           "sha256:" + "a" * 64, expected_major=18)
    result = service.migration(compatibility=checked)
    assert result["status"] == "MIGRATION_COMPATIBLE"
    assert result["evidence"] == checked.evidence_hash


def test_runbook_exposes_rollback_decision_and_requires_canonical_owner():
    service = RunbookService()
    subject = "sha256:" + "a" * 64
    approval = RollbackApproval(subject, "human:operator", datetime(2026, 9, 24, tzinfo=timezone.utc),
                                "APPROVED_DATA_LOSS_ROLLBACK", "sha256:" + "b" * 64)
    blocked = service.rollback(data_loss_possible=True, subject_hash=subject, approval=approval)
    assert blocked == {"status": "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED", "input": {"subject_hash": subject,
                      "data_loss_possible": True}, "evidence": None, "next_action": "OBTAIN_CANONICAL_HUMAN_DECISION"}
    class Owner:
        def validate_data_loss_decision(self, subject_hash, decision):
            return subject_hash == decision.subject_hash and decision.decision_hash == approval.decision_hash
    allowed = service.rollback(data_loss_possible=True, subject_hash=subject,
                               approval=approval, approval_owner=Owner())
    assert allowed["status"] == "ROLLBACK_ALLOWED"
    assert allowed["evidence"] == approval.decision_hash
    assert allowed["next_action"] == "REVIEW_APPROVED_ROLLBACK_PLAN"
