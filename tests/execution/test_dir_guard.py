import unittest


HASH_A = "sha256:" + "a" * 64
HASH_B = "sha256:" + "b" * 64


class DirGuardTests(unittest.TestCase):
    def test_only_canonical_design_intent_review_states_exist(self):
        from packages.execution.models import DIRStatus

        self.assertEqual(
            {"DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"},
            {status.value for status in DIRStatus},
        )
        self.assertNotIn("NOT_REACHED", DIRStatus.__members__)
        self.assertNotIn("REOPENED", DIRStatus.__members__)

    def test_clear_requires_authenticated_owner_direction_event(self):
        from packages.execution.dir_guard import DIRGuard
        from packages.execution.models import DIRStatus, DesignIntentReview

        guard = DIRGuard()
        review = DesignIntentReview("dir-1", "DIR-1", DIRStatus.WAITING_OWNER_DIRECTION, HASH_A)
        with self.assertRaisesRegex(ValueError, "owner direction"):
            guard.transition(review, DIRStatus.CLEARED)
        with self.assertRaisesRegex(ValueError, "authenticated owner"):
            guard.transition(review, DIRStatus.CLEARED, owner_direction_event_id="event-1", authenticated_owner=False)

        cleared = guard.transition(review, DIRStatus.CLEARED, owner_direction_event_id="event-1", authenticated_owner=True)
        self.assertEqual(DIRStatus.CLEARED, cleared.status)
        self.assertEqual("event-1", cleared.owner_direction_event_id)

    def test_recurrent_drift_creates_a_new_review_starting_at_dir_hold(self):
        from packages.execution.dir_guard import DIRGuard
        from packages.execution.models import DIRStatus, DesignIntentReview

        guard = DIRGuard()
        cleared = DesignIntentReview("dir-1", "DIR-1", DIRStatus.CLEARED, HASH_A, "event-owner-1")
        reopened = guard.recurrent_drift(cleared, "dir-2", HASH_B, "event-drift-2")

        self.assertEqual("dir-2", reopened.review_id)
        self.assertEqual(DIRStatus.DIR_HOLD, reopened.status)
        self.assertEqual(HASH_B, reopened.subject_hash)
        self.assertEqual("event-drift-2", reopened.causation_event_id)
        self.assertEqual(DIRStatus.CLEARED, cleared.status)


if __name__ == "__main__":
    unittest.main()
