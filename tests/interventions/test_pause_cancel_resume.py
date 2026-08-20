from __future__ import annotations

from datetime import datetime, timezone
import unittest

try:
    from packages.interventions.models import CancelStep, RunControlStatus
    from packages.interventions.service import (
        BindingDriftRequiresReapproval,
        CancelSequenceError,
        RunControlService,
        RunTerminalImmutable,
    )
except ModuleNotFoundError:
    CancelStep = RunControlStatus = None

    class BindingDriftRequiresReapproval(ValueError):
        pass

    class CancelSequenceError(ValueError):
        pass

    class RunTerminalImmutable(ValueError):
        pass

    class RunControlService:
        def __init__(self, *args, **kwargs):
            raise NotImplementedError("run control service is not implemented")


NOW = datetime(2026, 8, 20, 2, 0, tzinfo=timezone.utc)
HASHES = {
    "plan": "sha256:" + "1" * 64,
    "baseline": "sha256:" + "2" * 64,
    "policy": "sha256:" + "3" * 64,
}


class PauseCancelResumeTests(unittest.TestCase):
    def test_resume_allowlist_and_binding_drift_require_reapproval(self):
        service = RunControlService()
        service.register_run("run-pause", RunControlStatus.ACTIVE, HASHES)
        service.request_pause("run-pause", requested_at=NOW)
        service.complete_pause("run-pause", effective_at=NOW)
        service.resume("run-pause", HASHES, reapproval_ref=None)
        self.assertEqual(RunControlStatus.ACTIVE, service.status_for("run-pause"))

        for status in (RunControlStatus.PAUSED_QUOTA, RunControlStatus.INTERRUPTED):
            run_id = f"run-{status.value.lower()}"
            service.register_run(run_id, status, HASHES)
            service.resume(run_id, HASHES, reapproval_ref=None)
            self.assertEqual(RunControlStatus.ACTIVE, service.status_for(run_id))

        service.register_run("run-not-paused", RunControlStatus.ACTIVE, HASHES)
        with self.assertRaises(RunTerminalImmutable):
            service.resume("run-not-paused", HASHES, reapproval_ref=None)

        service.register_run("run-drift", RunControlStatus.PAUSED_USER, HASHES)
        drifted = dict(HASHES, policy="sha256:" + "4" * 64)
        with self.assertRaises(BindingDriftRequiresReapproval):
            service.resume("run-drift", drifted, reapproval_ref=None)
        service.resume("run-drift", drifted, reapproval_ref="MAIN_RECONFIRMED_NON_SEMANTIC:binding-1")

    def test_cancel_enforces_seven_steps_and_cancelled_requires_new_prior_run(self):
        service = RunControlService()
        service.register_run("run-cancel", RunControlStatus.ACTIVE, HASHES)
        expected = (
            CancelStep.EVENT_RECORDED,
            CancelStep.NEW_ACTIONS_STOPPED,
            CancelStep.GRACEFUL_SIGNAL_SENT,
            CancelStep.FORCE_POLICY_CHECKED,
            CancelStep.ARTIFACTS_COLLECTED,
            CancelStep.WORKSPACE_RETAINED_24H,
            CancelStep.CANCELLED,
        )
        with self.assertRaises(CancelSequenceError):
            service.advance_cancel("run-cancel", CancelStep.NEW_ACTIONS_STOPPED, NOW)
        for step in expected:
            service.advance_cancel("run-cancel", step, NOW)

        self.assertEqual(expected, service.cancel_history("run-cancel"))
        self.assertEqual(RunControlStatus.CANCELLED, service.status_for("run-cancel"))
        self.assertFalse(service.can_schedule_new_action("run-cancel"))
        with self.assertRaises(RunTerminalImmutable):
            service.resume("run-cancel", HASHES, reapproval_ref="approval-any")
        with self.assertRaises(RunTerminalImmutable):
            service.set_status("run-cancel", RunControlStatus.ACTIVE)

        continued = service.create_continuation_run(
            "run-new",
            prior_run_id="run-cancel",
            checkpoint_refs=("checkpoint-1",),
            artifact_refs=("artifact-1",),
            bindings=HASHES,
        )
        self.assertEqual("run-cancel", continued.prior_run_id)
        self.assertEqual(RunControlStatus.ACTIVE, continued.status)


if __name__ == "__main__":
    unittest.main()
