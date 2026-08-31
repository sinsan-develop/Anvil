from datetime import datetime, timedelta, timezone
import unittest

from packages.planning.approval import ApprovalRecord, ApprovalType
from packages.planning.planner import (
    ExecutionPlan, ExecutionStep, PlannerError, StepKind, analyze_request,
    generate_work_instruction, schedule_ready_steps, validate_work_instruction,
)
from packages.planning.service import PlanningApprovalService

NOW = datetime(2026, 9, 1, tzinfo=timezone.utc)
A = "sha256:" + "a" * 64
B = "sha256:" + "b" * 64


def plan(*steps):
    return ExecutionPlan("plan-1", A, A, A, B, tuple(steps), NOW)


class C11PlannerTests(unittest.TestCase):
    def test_request_analysis_and_plan_hash_are_deterministic(self):
        a = analyze_request("req-1", "build feature", scope=("feature",), completion_conditions=("tests pass",), allowed_paths=("packages/x.py",), prohibited_actions=("network",), risk=("none",), baseline_hash=A, egress_snapshot_hash=B)
        step = ExecutionStep("s1", StepKind.READ, "inspect", (), ("packages/x.py",), ("report",), egress_snapshot_hash=B)
        p1 = plan(step)
        p2 = plan(step)
        self.assertEqual(a.content_hash, a.content_hash)
        self.assertEqual(p1.content_hash, p2.content_hash)
        self.assertEqual(p1.content_hash, generate_work_instruction(p1, "s1").iteration_plan_hash)

    def test_read_only_plan_schedules_without_approval(self):
        decision = schedule_ready_steps(plan(ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), egress_snapshot_hash=B)))
        self.assertTrue(decision.allowed)

    def test_write_plan_requires_matching_active_approval(self):
        p = plan(ExecutionStep("s1", StepKind.WRITE, "patch", (), ("src",), ("tests",), egress_snapshot_hash=B))
        self.assertFalse(schedule_ready_steps(p).allowed)
        service = PlanningApprovalService()
        service.record_approval(ApprovalRecord("ap-1", ApprovalType.APPLY, p.plan_id, p.content_hash, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        self.assertTrue(schedule_ready_steps(p, approval_guard=service, at=NOW).allowed)
        self.assertFalse(schedule_ready_steps(p, approval_guard=service, at=NOW + timedelta(hours=2)).allowed)

    def test_stale_hash_and_unsafe_conflicts_fail_closed(self):
        with self.assertRaises(PlannerError):
            plan(ExecutionStep("s1", StepKind.WRITE, "patch", (), ("src",), ("tests",), egress_snapshot_hash=A))
        with self.assertRaises(PlannerError):
            plan(ExecutionStep("s1", StepKind.READ, "inspect", ("missing",), ("src",), ("report",), egress_snapshot_hash=B))
        with self.assertRaises(PlannerError):
            plan(ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), egress_snapshot_hash=B), ExecutionStep("s2", StepKind.READ, "inspect", ("s1", "s2"), ("src",), ("report",), egress_snapshot_hash=B))

    def test_hashes_reject_uppercase_and_non_hex_values(self):
        for value in ("sha256:" + "A" * 64, "sha256:" + "g" * 64, "sha256:" + "a" * 63):
            with self.assertRaises(PlannerError):
                analyze_request("req", "objective", scope=("x",), completion_conditions=("done",), allowed_paths=("src",), prohibited_actions=("network",), risk=("low",), baseline_hash=value, egress_snapshot_hash=B)

    def test_only_steps_with_completed_dependencies_are_ready(self):
        first = ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), egress_snapshot_hash=B)
        second = ExecutionStep("s2", StepKind.READ, "summarize", ("s1",), ("src",), ("report",), egress_snapshot_hash=B)
        p = plan(first, second)
        self.assertEqual(("s1",), schedule_ready_steps(p).step_ids)
        self.assertEqual(("s2",), schedule_ready_steps(p, completed_step_ids={"s1"}).step_ids)

    def test_analysis_scope_is_carried_into_instruction(self):
        analysis = analyze_request("req-1", "build feature", scope=("feature",), completion_conditions=("tests pass",), allowed_paths=("src",), prohibited_actions=("network", "secrets"), risk=("high",), baseline_hash=A, egress_snapshot_hash=B)
        step = ExecutionStep("s1", StepKind.WRITE, "patch", (), ("src",), ("tests pass",), ("high",), B)
        p = ExecutionPlan("plan-1", analysis.content_hash, A, A, B, (step,), NOW)
        from packages.planning.planner import validate_work_instruction
        instruction = generate_work_instruction(p, "s1", analysis=analysis)
        self.assertEqual(("network", "secrets"), instruction.prohibited_actions)
        self.assertTrue(validate_work_instruction(instruction, p, "s1", analysis=analysis))

    def test_instruction_analysis_hash_is_required_even_without_analysis_argument(self):
        from dataclasses import replace
        instruction = generate_work_instruction(plan(ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), ("low",), B)), "s1")
        self.assertFalse(validate_work_instruction(replace(instruction, request_analysis_hash=B), plan(ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), ("low",), B)), "s1"))


if __name__ == "__main__":
    unittest.main()
