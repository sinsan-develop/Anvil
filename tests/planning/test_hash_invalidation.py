import unittest


class PlanningHashInvalidationTests(unittest.TestCase):
    def test_one_character_content_change_invalidates_the_bound_approval(self):
        try:
            from packages.planning.hashing import canonical_content_hash
        except ModuleNotFoundError as error:
            self.fail(f"planning hash contract is missing: {error}")

        approved_hash = canonical_content_hash({"goal": "preserve existing behavior"})
        changed_hash = canonical_content_hash({"goal": "preserve existing behaviours"})

        self.assertNotEqual(approved_hash, changed_hash)

    def test_hash_change_marks_the_existing_bound_approval_invalidated(self):
        try:
            from packages.planning.approval import ApprovalRecord, ApprovalStatus, ApprovalType
            from packages.planning.service import PlanningApprovalService
        except ModuleNotFoundError as error:
            self.fail(f"planning approval invalidation is missing: {error}")

        from datetime import datetime, timedelta, timezone

        now = datetime(2026, 8, 14, tzinfo=timezone.utc)
        service = PlanningApprovalService()
        service.record_approval(ApprovalRecord(
            "approval-1", ApprovalType.PLAN, "plan-1", "sha256:" + "a" * 64,
            "sinsan", True, now, now + timedelta(hours=1),
        ))
        service.execution_guard("plan-1", "sha256:" + "b" * 64, ApprovalType.PLAN, now)

        if not hasattr(service, "approval"):
            self.fail("approval invalidation state is not observable")
        self.assertEqual(ApprovalStatus.INVALIDATED, service.approval("approval-1").status)
if __name__ == "__main__":
    unittest.main()
