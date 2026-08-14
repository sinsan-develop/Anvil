from datetime import datetime, timezone
import unittest


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH_A = "sha256:" + "a" * 64
HASH_B = "sha256:" + "b" * 64


class AttemptIntegrityTests(unittest.TestCase):
    def _attempt(self, attempt_id, number, executor_kind):
        from packages.execution.models import StepAttempt

        return StepAttempt(attempt_id, "step-1", number, executor_kind, HASH_A, NOW)

    def test_only_one_unfinished_attempt_is_allowed_for_a_plan_step(self):
        from packages.execution.integrity import AttemptIntegrityService
        from packages.execution.models import Delegation, DelegationStatus, ExecutorKind, Result, ResultStatus

        service = AttemptIntegrityService()
        first = self._attempt("attempt-1", 1, ExecutorKind.SUBAGENT)
        service.register_attempt(first, delegation=Delegation("delegation-1", first.attempt_id, "developer-primary", DelegationStatus.RUNNING))

        second = self._attempt("attempt-2", 2, ExecutorKind.SUBAGENT)
        with self.assertRaisesRegex(ValueError, "active attempt"):
            service.register_attempt(second, delegation=Delegation("delegation-2", second.attempt_id, "developer-primary", DelegationStatus.STARTING))

        service.record_result(Result("result-1", first.attempt_id, ResultStatus.COMPLETED, HASH_A, HASH_B, "developer-primary", 10))
        service.register_attempt(second, delegation=Delegation("delegation-2", second.attempt_id, "developer-primary", DelegationStatus.STARTING))
        self.assertEqual("attempt-2", service.active_attempt("step-1").attempt_id)

    def test_executor_kind_enforces_exact_delegation_or_takeover_reference(self):
        from packages.execution.integrity import AttemptIntegrityService
        from packages.execution.models import Delegation, DelegationStatus, ExecutorKind

        service = AttemptIntegrityService()
        subagent = self._attempt("attempt-sub", 1, ExecutorKind.SUBAGENT)
        with self.assertRaisesRegex(ValueError, "delegation is required"):
            service.register_attempt(subagent)

        takeover = self._attempt("attempt-main", 1, ExecutorKind.MAIN_TAKEOVER)
        delegation = Delegation("delegation-main", takeover.attempt_id, "eoul", DelegationStatus.RUNNING)
        with self.assertRaisesRegex(ValueError, "must not have a delegation"):
            service.register_attempt(takeover, delegation=delegation, takeover_reference="takeover-1")
        with self.assertRaisesRegex(ValueError, "takeover reference is required"):
            service.register_attempt(takeover)

        service.register_attempt(takeover, takeover_reference="takeover-1")
        self.assertIsNone(service.delegation_for(takeover.attempt_id))

    def test_terminal_result_is_unique_and_bound_to_attempt_hash_actor_and_sequence(self):
        from packages.execution.integrity import AttemptIntegrityService
        from packages.execution.models import ExecutorKind, Result, ResultStatus

        service = AttemptIntegrityService()
        attempt = self._attempt("attempt-main", 1, ExecutorKind.MAIN_TAKEOVER)
        service.register_attempt(attempt, takeover_reference="takeover-1")

        with self.assertRaisesRegex(ValueError, "target hash"):
            service.record_result(Result("bad-hash", attempt.attempt_id, ResultStatus.COMPLETED, HASH_B, HASH_B, "eoul", 1))
        with self.assertRaises(ValueError):
            Result("bad-actor", attempt.attempt_id, ResultStatus.COMPLETED, HASH_A, HASH_B, "", 1)
        with self.assertRaises(ValueError):
            Result("bad-sequence", attempt.attempt_id, ResultStatus.COMPLETED, HASH_A, HASH_B, "eoul", 0)

        service.record_result(Result("result-1", attempt.attempt_id, ResultStatus.COMPLETED, HASH_A, HASH_B, "eoul", 1))
        with self.assertRaisesRegex(ValueError, "terminal result"):
            service.record_result(Result("result-2", attempt.attempt_id, ResultStatus.FAILURE_REPORT, HASH_A, HASH_B, "eoul", 2))


if __name__ == "__main__":
    unittest.main()
