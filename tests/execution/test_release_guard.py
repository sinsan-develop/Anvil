from datetime import datetime, timezone
import unittest


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH_A = "sha256:" + "a" * 64
HASH_B = "sha256:" + "b" * 64


class ReleaseGuardTests(unittest.TestCase):
    def _decision(self, authenticated_human=True):
        from packages.execution.models import ReleaseDecision, ReleaseDecisionKind

        return ReleaseDecision("decision-1", HASH_A, ReleaseDecisionKind.RELEASE, "sinsan", authenticated_human, NOW)

    def _validation(self, criterion_id="criterion-1", verdict_name="SUITABLE", target_hash=HASH_A, delivered_hash=HASH_A):
        from packages.execution.models import ProductValidation, ValidationVerdict

        return ProductValidation("validation-1", criterion_id, target_hash, delivered_hash, ValidationVerdict[verdict_name], "tester", NOW)

    def test_every_release_decision_requires_an_authenticated_human_actor(self):
        with self.assertRaisesRegex(ValueError, "authenticated human"):
            self._decision(authenticated_human=False)

    def test_release_fails_closed_for_missing_blocked_or_hash_mismatched_validation(self):
        from packages.execution.release import ReleaseGuard

        guard = ReleaseGuard()
        decision = self._decision()
        for validations in (
            (),
            (self._validation(verdict_name="BLOCKED"),),
            (self._validation(target_hash=HASH_B),),
            (self._validation(delivered_hash=HASH_B),),
        ):
            result = guard.evaluate(decision, frozenset({"criterion-1"}), validations, ())
            self.assertFalse(result.allowed)
            self.assertEqual("BLOCKED", result.status)

    def test_open_blocking_critical_or_major_defect_blocks_release(self):
        from packages.execution.models import Defect, DefectSeverity, DefectStatus
        from packages.execution.release import ReleaseGuard

        guard = ReleaseGuard()
        validation = self._validation()
        for severity in (DefectSeverity.CRITICAL, DefectSeverity.MAJOR):
            defect = Defect("defect-1", HASH_A, severity, True, DefectStatus.OPEN, "developer-primary")
            result = guard.evaluate(self._decision(), frozenset({"criterion-1"}), (validation,), (defect,))
            self.assertFalse(result.allowed)
            self.assertIn("blocking defect", result.reason)

        closed = Defect("defect-closed", HASH_A, DefectSeverity.MAJOR, True, DefectStatus.CLOSED, "developer-primary")
        result = guard.evaluate(self._decision(), frozenset({"criterion-1"}), (validation,), (closed,))
        self.assertTrue(result.allowed)


if __name__ == "__main__":
    unittest.main()
