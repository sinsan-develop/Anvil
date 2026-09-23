from datetime import datetime, timedelta, timezone
import unittest

from packages.planning.approval import ApprovalRecord, ApprovalType
from packages.planning.planner import (
    ExecutionPlan, ExecutionStep, PlannerError, StepKind, analyze_request,
    generate_work_instruction, schedule_ready_steps as schedule, validate_work_instruction,
    build_execution_plan, MainResponsibility, MainAuthoritySnapshot,
)
from packages.planning.service import (PlanningApprovalService, PlanningMainAuthorityService,
    MainAuthorityRecord, MainAuthoritySource)
from packages.planning.models import IterationPlan, WorkPlan

NOW = datetime(2026, 9, 1, tzinfo=timezone.utc)
A = "sha256:" + "a" * 64
B = "sha256:" + "b" * 64
MAIN = MainResponsibility("main-agent", "plan-1", observed_at=NOW,
    expires_at=NOW + timedelta(hours=3), authority_source="CONTROL_PLANE", authority_event_hash=A,
    execution_fencing_token="fence")
AUTHORITY = PlanningMainAuthorityService()
AUTHORITY.record_observation(MainAuthorityRecord("main-agent", "plan-1", NOW,
    NOW + timedelta(hours=3), MainAuthoritySource.CONTROL_PLANE, A, "fence"))


def schedule_ready_steps(*args, **kwargs):
    kwargs.setdefault("at", NOW)
    kwargs.setdefault("main_authority", AUTHORITY)
    return schedule(*args, **kwargs)


def plan(*steps):
    request = analyze_request("req", "bounded plan", scope=("feature",),
        completion_conditions=tuple(dict.fromkeys(condition for step in steps for condition in step.completion_conditions)),
        allowed_paths=tuple(dict.fromkeys(path for step in steps for path in step.allowed_paths)),
        prohibited_actions=("network", "secret", "destructive"), risk=("low",), baseline_hash=A, egress_snapshot_hash=B)
    work = WorkPlan.create(artifact_id="work", revision=1, design_baseline_id="design",
        design_baseline_hash=A, scope=frozenset(request.scope), created_at=NOW)
    iteration = IterationPlan.create(artifact_id="iteration-1", revision=1, work_plan=work, sequence=1, created_at=NOW)
    instruction = generate_work_instruction(iteration, analysis=request, created_at=NOW,
        allowed_actions=tuple(dict.fromkeys(step.kind.value.lower() for step in steps)), validation_contract=("tests-pass",))
    return build_execution_plan(request, tuple(steps), plan_id="plan-1", permission_snapshot_hash=A,
        created_at=NOW, work_plan=work,
        source_work_instruction=instruction, source_iteration_plan=iteration)


class C11PlannerTests(unittest.TestCase):
    def test_request_analysis_and_plan_hash_are_deterministic(self):
        a = analyze_request("req-1", "build feature", scope=("feature",), completion_conditions=("tests pass",), allowed_paths=("packages/x.py",), prohibited_actions=("network",), risk=("none",), baseline_hash=A, egress_snapshot_hash=B)
        step = ExecutionStep("s1", StepKind.READ, "inspect", (), ("packages/x.py",), ("report",), egress_snapshot_hash=B)
        p1 = plan(step)
        p2 = plan(step)
        self.assertEqual(a.content_hash, a.content_hash)
        self.assertEqual(p1.content_hash, p2.content_hash)
        self.assertEqual(p1.source_iteration_plan.content_hash, p1.source_work_instruction.iteration_plan_hash)
        self.assertEqual(p1.source_work_instruction.content_hash, p1.source_work_instruction_hash)

    def test_read_only_plan_schedules_without_approval(self):
        decision = schedule_ready_steps(plan(ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), egress_snapshot_hash=B)), main=MAIN)
        self.assertTrue(decision.allowed)

    def test_write_plan_requires_matching_active_approval(self):
        p = plan(ExecutionStep("s1", StepKind.WRITE, "patch", (), ("src",), ("tests",), egress_snapshot_hash=B))
        self.assertFalse(schedule_ready_steps(p, main=MAIN).allowed)
        service = PlanningApprovalService()
        service.record_approval(ApprovalRecord("ap-1", ApprovalType.EXECUTION_PLAN, p.plan_id, p.content_hash, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        service.record_approval(ApprovalRecord("wi-1", ApprovalType.WORK_INSTRUCTION, p.source_work_instruction_id, p.source_work_instruction_hash, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        service.record_approval(ApprovalRecord("design", ApprovalType.DESIGN_SPECIFICATION, "design", A, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        service.record_approval(ApprovalRecord("work", ApprovalType.WORK_PLAN, "work", p.work_plan_hash, "sinsan", True, NOW, NOW + timedelta(hours=1)))
        self.assertTrue(schedule_ready_steps(p, main=MAIN, approval_guard=service, at=NOW).allowed)
        self.assertFalse(schedule_ready_steps(p, main=MAIN, approval_guard=service, at=NOW + timedelta(hours=2)).allowed)

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
        self.assertEqual(("s1",), schedule_ready_steps(p, main=MAIN).step_ids)
        self.assertEqual(("s2",), schedule_ready_steps(p, main=MAIN, completed_step_ids={"s1"}).step_ids)

    def test_analysis_scope_is_carried_into_instruction(self):
        analysis = analyze_request("req-1", "build feature", scope=("feature",), completion_conditions=("tests pass",), allowed_paths=("src",), prohibited_actions=("network", "secrets"), risk=("high",), baseline_hash=A, egress_snapshot_hash=B)
        step = ExecutionStep("s1", StepKind.WRITE, "patch", (), ("src",), ("tests pass",), ("high",), B)
        work = WorkPlan.create(artifact_id="work", revision=1, design_baseline_id="design",
            design_baseline_hash=A, scope=frozenset(analysis.scope), created_at=NOW)
        iteration = IterationPlan.create(artifact_id="iteration-1", revision=1, work_plan=work, sequence=1, created_at=NOW)
        instruction = generate_work_instruction(iteration, analysis=analysis, created_at=NOW,
            allowed_actions=("write",), validation_contract=("tests-pass",))
        self.assertEqual(("network", "secrets"), instruction.prohibited_actions)
        self.assertTrue(validate_work_instruction(instruction, iteration, analysis=analysis))

    def test_instruction_analysis_hash_is_required_even_without_analysis_argument(self):
        from dataclasses import replace
        target = plan(ExecutionStep("s1", StepKind.READ, "inspect", (), ("src",), ("report",), ("low",), B))
        instruction = target.source_work_instruction
        self.assertFalse(validate_work_instruction(replace(instruction, request_analysis_hash=B), target.source_iteration_plan, analysis=target.analysis))


if __name__ == "__main__":
    unittest.main()
