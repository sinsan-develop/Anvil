from packages.recovery.runbook import RunbookService
from packages.recovery.disaster import verify_migration_observation


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
