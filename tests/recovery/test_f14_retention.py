from datetime import datetime, timedelta, timezone

from packages.recovery.retention import ArtifactRetention, RollbackApproval, decide_retention, rollback_decision


NOW = datetime(2026, 9, 24, tzinfo=timezone.utc)


def test_retention_dry_run_protects_references_and_unexpired_artifacts():
    rows = (ArtifactRetention("opaque-1", NOW - timedelta(days=40), NOW - timedelta(days=1), (), "CHECKPOINT_STATE"),
            ArtifactRetention("fresh", NOW, NOW + timedelta(days=1), (), "LOG"),
            ArtifactRetention("old", NOW - timedelta(days=40), NOW - timedelta(days=1), (), "LOG"))
    result = decide_retention(rows, now=NOW)
    assert result.protected == ("opaque-1", "fresh")
    assert result.candidates == ("old",)
    assert result.deleted == ()


def test_retention_uses_metadata_not_incidental_id_substring():
    rows = (ArtifactRetention("checkpoint-named-but-log", NOW - timedelta(days=40), NOW - timedelta(days=1), (), "LOG"),
            ArtifactRetention("opaque-2", NOW - timedelta(days=40), NOW - timedelta(days=1), ("audit-7",), "LOG"),
            ArtifactRetention("opaque-3", NOW - timedelta(days=40), NOW - timedelta(days=1), (), "EVIDENCE_RAW"))
    result = decide_retention(rows, now=NOW)
    assert result.candidates == ("checkpoint-named-but-log",)
    assert result.protected == ("opaque-2", "opaque-3")


def test_data_loss_rollback_requires_bound_human_decision():
    assert rollback_decision(data_loss_possible=True, subject_hash="sha256:" + "a" * 64,
                             approval=None) == "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
    assert rollback_decision(data_loss_possible=False, subject_hash="sha256:" + "a" * 64,
                             approval=None) == "ROLLBACK_ALLOWED"
    approval = RollbackApproval("sha256:" + "a" * 64, "human:operator", NOW,
                                "APPROVED_DATA_LOSS_ROLLBACK", "sha256:" + "b" * 64)
    assert rollback_decision(data_loss_possible=True, subject_hash="sha256:" + "a" * 64,
                             approval=approval) == "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
    class Owner:
        def validate_data_loss_decision(self, subject_hash, decision):
            return subject_hash == decision.subject_hash and decision.decision_hash == "sha256:" + "b" * 64
    assert rollback_decision(data_loss_possible=True, subject_hash="sha256:" + "a" * 64,
                             approval=approval, approval_owner=Owner()) == "ROLLBACK_ALLOWED"
    invalid = RollbackApproval("sha256:" + "c" * 64, "human:operator", NOW,
                               "APPROVED_DATA_LOSS_ROLLBACK", "sha256:" + "b" * 64)
    assert rollback_decision(data_loss_possible=True, subject_hash="sha256:" + "a" * 64,
                             approval=invalid, approval_owner=Owner()) == "DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"
