from datetime import datetime, timedelta, timezone
import unittest


NOW = datetime(2026, 8, 14, tzinfo=timezone.utc)
HASH_A = "sha256:" + "a" * 64
HASH_B = "sha256:" + "b" * 64


class ApprovalGuardTests(unittest.TestCase):
    def test_wrong_type_hash_mismatch_and_expired_approval_fail_closed_or_block(self):
        try:
            from packages.planning.approval import ApprovalRecord, ApprovalType, ApprovalStatus
            from packages.planning.service import PlanningApprovalService
        except ModuleNotFoundError as error:
            self.fail(f"approval guard is missing: {error}")

        service = PlanningApprovalService()
        approval = ApprovalRecord(
            approval_id="approval-plan-1",
            approval_type=ApprovalType.PLAN,
            subject_id="plan-1",
            subject_hash=HASH_A,
            approved_by="sinsan",
            authenticated_human=True,
            approved_at=NOW,
            expires_at=NOW + timedelta(hours=1),
        )
        service.record_approval(approval)

        self.assertTrue(service.execution_guard("plan-1", HASH_A, ApprovalType.PLAN, NOW).allowed)
        self.assertFalse(service.execution_guard("plan-1", HASH_A, ApprovalType.DEPLOY, NOW).allowed)
        self.assertEqual("BLOCKED", service.execution_guard("plan-1", HASH_A, ApprovalType.PLAN, NOW + timedelta(hours=2)).status)
        self.assertEqual(ApprovalStatus.ACTIVE, approval.status)
        self.assertFalse(service.execution_guard("plan-1", HASH_B, ApprovalType.PLAN, NOW).allowed)

    def test_nonsemantic_reconfirmation_cannot_hide_scope_or_risk_expansion_without_new_human_approval(self):
        try:
            from packages.planning.approval import ApprovalRecord, ApprovalType, NonSemanticReconfirmation
            from packages.planning.service import PlanningApprovalService
        except ModuleNotFoundError as error:
            self.fail(f"nonsemantic approval guard is missing: {error}")

        service = PlanningApprovalService()
        root = ApprovalRecord("root-1", ApprovalType.PLAN, "plan-1", HASH_A, "sinsan", True, NOW, NOW + timedelta(hours=1))
        service.record_approval(root)
        invalid = NonSemanticReconfirmation(
            binding_id="binding-1",
            root_human_approval_id="root-1",
            parent_approval_id="root-1",
            old_content_hash=HASH_A,
            new_content_hash=HASH_B,
            semantic_diff="NONE",
            impact="expanded operational surface",
            reason="reconfirm",
            actor_id="eoul",
            occurred_at=NOW,
            functional_scope_changed=True,
        )

        with self.assertRaises(ValueError):
            service.reconfirm_nonsemantic(invalid)

    def test_valid_nonsemantic_reconfirmation_authorizes_only_the_new_hash(self):
        from packages.planning.approval import ApprovalRecord, ApprovalType, NonSemanticReconfirmation
        from packages.planning.service import PlanningApprovalService

        service = PlanningApprovalService()
        service.record_approval(ApprovalRecord("root-1", ApprovalType.PLAN, "plan-1", HASH_A, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        service.reconfirm_nonsemantic(NonSemanticReconfirmation("binding-1", "root-1", "root-1", HASH_A, HASH_B, "NONE", "wording only", "hash refresh", "eoul", NOW))

        self.assertTrue(service.execution_guard("plan-1", HASH_B, ApprovalType.PLAN, NOW).allowed)
        self.assertFalse(service.execution_guard("plan-1", HASH_A, ApprovalType.PLAN, NOW).allowed)

    def test_expired_or_duplicate_nonsemantic_binding_cannot_authorize_the_new_hash(self):
        from packages.planning.approval import ApprovalRecord, ApprovalType, NonSemanticReconfirmation
        from packages.planning.service import PlanningApprovalService

        service = PlanningApprovalService()
        service.record_approval(ApprovalRecord("root-1", ApprovalType.PLAN, "plan-1", HASH_A, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        valid = NonSemanticReconfirmation("binding-1", "root-1", "root-1", HASH_A, HASH_B, "NONE", "wording only", "hash refresh", "eoul", NOW)
        service.reconfirm_nonsemantic(valid)
        with self.assertRaises(ValueError):
            service.reconfirm_nonsemantic(valid)

        expired = PlanningApprovalService()
        expired.record_approval(ApprovalRecord("root-2", ApprovalType.PLAN, "plan-2", HASH_A, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        stale = NonSemanticReconfirmation("binding-2", "root-2", "root-2", HASH_A, HASH_B, "NONE", "wording only", "hash refresh", "eoul", NOW + timedelta(hours=1))
        with self.assertRaises(ValueError):
            expired.reconfirm_nonsemantic(stale)
        self.assertFalse(expired.execution_guard("plan-2", HASH_B, ApprovalType.PLAN, NOW + timedelta(hours=1)).allowed)


if __name__ == "__main__":
    unittest.main()
