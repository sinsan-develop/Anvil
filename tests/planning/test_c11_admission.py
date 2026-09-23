"""C-11 current-baseline regressions: authority, immutable binding and IO0."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest

from packages.planning import planner as p
from packages.planning.approval import ApprovalRecord, ApprovalType
from packages.planning.service import (PlanningApprovalService, PlanningMainAuthorityService,
    MainAuthorityRecord, MainAuthoritySource, MainAuthorityStatus)
from packages.planning.models import IterationPlan, WorkPlan

NOW = datetime(2026, 9, 15, tzinfo=timezone.utc)
A, B, C = ("sha256:" + char * 64 for char in "abc")
D = "sha256:" + "d" * 64


def analysis(**changes):
    values = dict(request_id="request", objective="bounded change", scope=("feature",),
        completion_conditions=("verified",), risk=("low",), allowed_paths=("src",),
        prohibited_actions=("network", "secret", "destructive"), egress_snapshot_hash=B, baseline_hash=A)
    values.update(changes)
    return p.RequestAnalysis(**values)


def step(name="write", kind=p.StepKind.WRITE, paths=("src/file.py",), **changes):
    values = dict(step_id=name, kind=kind, objective="bounded step", depends_on=(),
        allowed_paths=paths, completion_conditions=("verified",), risk=("low",), egress_snapshot_hash=B)
    values.update(changes)
    return p.ExecutionStep(**values)


def plan(*steps, request=None):
    request = request or analysis()
    steps = steps or (step(completion_conditions=request.completion_conditions),)
    work = WorkPlan.create(artifact_id="work", revision=1, design_baseline_id="design",
        design_baseline_hash=D, scope=frozenset(request.scope), created_at=NOW)
    iteration = IterationPlan.create(artifact_id="iteration", revision=1, work_plan=work, sequence=1, created_at=NOW)
    wi = p.generate_work_instruction(iteration, analysis=request, created_at=NOW,
        allowed_actions=tuple(dict.fromkeys(item.kind.value.lower() for item in steps)),
        validation_contract=("focused-tests-pass",))
    return p.build_execution_plan(request, steps, plan_id="plan",
        permission_snapshot_hash=C, created_at=NOW,
        work_plan=work,
        source_work_instruction=wi, source_iteration_plan=iteration)


def main():
    return p.MainResponsibility("main-agent", "plan", observed_at=NOW - timedelta(hours=2),
        expires_at=NOW + timedelta(hours=2), authority_source="CONTROL_PLANE",
        authority_event_hash=C, execution_fencing_token="current-fence")


def authority(**changes):
    record = MainAuthorityRecord("main-agent", "plan", NOW - timedelta(hours=2),
        NOW + timedelta(hours=2), MainAuthoritySource.CONTROL_PLANE, C, "current-fence")
    if "status" in changes: changes["status"] = MainAuthorityStatus(changes["status"])
    service = PlanningMainAuthorityService()
    service.record_observation(replace(record, **changes))
    return service


def schedule(*args, **kwargs):
    kwargs.setdefault("main_authority", authority())
    return p.schedule_ready_steps(*args, **kwargs)


def approvals(target, *, at=NOW, include_parents=True, target_hash=None):
    service = PlanningApprovalService()
    subjects = [("plan", target_hash or target.content_hash, ApprovalType.EXECUTION_PLAN),
        (target.source_work_instruction_id, target.source_work_instruction_hash, ApprovalType.WORK_INSTRUCTION)]
    if include_parents:
        subjects += [("design", D, ApprovalType.DESIGN_SPECIFICATION), ("work", target.work_plan_hash, ApprovalType.WORK_PLAN)]
    for i, (subject, digest, kind) in enumerate(subjects):
        service.record_approval(ApprovalRecord(str(i), kind, subject, digest, "human", True, at, at + timedelta(hours=1)))
    return service


def test_av_agt_024_main_is_required_even_for_read_only():
    target = p.ExecutionPlan("plan", A, A, C, B, (step(kind=p.StepKind.READ),), NOW)
    assert not schedule(target, at=NOW).allowed


@pytest.mark.parametrize("field", ["allowed_paths", "scope", "risk", "completion_conditions"])
def test_mutable_request_collections_are_snapshotted(field):
    values = ["src"] if field == "allowed_paths" else ["original"]
    request = analysis(**{field: values})
    digest = request.content_hash
    values.append("changed")
    assert request.content_hash == digest
    assert type(getattr(request, field)) is tuple


def test_nested_context_and_step_inputs_are_frozen():
    context = [["key", "value"]]
    request = analysis(context=context)
    paths, deps = ["src/file.py"], []
    item = step(paths=paths, depends_on=deps)
    digest = request.content_hash
    context[0][1] = "changed"
    paths.append("other"); deps.append("missing")
    assert request.content_hash == digest
    assert item.allowed_paths == ("src/file.py",) and item.depends_on == ()


@pytest.mark.parametrize("path", ["../src", "src/../other", "C:/src", "//server/share", "src\\file", "src/CON", "src/%2e%2e", ".GIT/config", "src/.env.local"])
def test_path_escape_alias_and_protected_targets_are_rejected(path):
    with pytest.raises(p.PlannerError):
        step(paths=(path,))


def test_missing_analysis_cannot_generate_or_validate_self_attested_instruction():
    target = p.ExecutionPlan("plan", A, A, C, B, (step(),), NOW)
    with pytest.raises(p.PlannerError, match="ITERATION_PLAN_REQUIRED"):
        p.generate_work_instruction(target, analysis=analysis(), created_at=NOW, allowed_actions=("write",), validation_contract=("tests",))


def test_future_approval_is_not_active_before_approved_at():
    service = PlanningApprovalService()
    service.record_approval(ApprovalRecord("ap", ApprovalType.APPLY, "plan", A, "human", True, NOW, NOW + timedelta(hours=1)))
    assert not service.execution_guard("plan", A, ApprovalType.APPLY, NOW - timedelta(microseconds=1)).allowed


def test_av_safe_001_parent_approvals_and_human_guard_are_required():
    target = plan()
    no_parents = schedule(target, main=main(), approval_guard=approvals(target, include_parents=False), at=NOW)
    assert no_parents.reason_code == "DESIGN_APPROVAL_REQUIRED" and not no_parents.allowed
    fake = mock.Mock()
    fake.execution_guard.return_value.allowed = True
    blocked = schedule(target, main=main(), approval_guard=fake, at=NOW)
    assert blocked.reason_code == "HUMAN_APPROVAL_REQUIRED" and not blocked.allowed
    fake.execution_guard.assert_not_called()
    assert schedule(target, main=main(), approval_guard=approvals(target), at=NOW).step_ids == ("write",)


@pytest.mark.parametrize("state", ["TERMINATED", "PAUSED", "MISSING"])
def test_av_agt_024_inactive_main_blocks_without_consulting_approval(state):
    target = plan()
    result = schedule(target, main=replace(main(), status=state), at=NOW)
    assert result.reason_code == "MAIN_NOT_ACTIVE" and result.step_ids == ()


def test_av_agt_028_subagent_role_and_agreement_are_not_approval():
    target = plan()
    result = schedule(target, main=replace(main(), role="SUBAGENT"), at=NOW)
    assert result.reason_code == "MAIN_RESPONSIBILITY_REQUIRED" and not result.allowed
    with pytest.raises(ValueError):
        ApprovalRecord("agreement", ApprovalType.APPLY, "plan", target.content_hash, "subagent", False, NOW, NOW + timedelta(hours=1))


def test_stale_plan_hash_is_rechecked_before_scheduler_uses_approval():
    target = plan()
    service = approvals(target)
    object.__setattr__(target.steps[0], "objective", "changed after approval")
    result = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert result.reason_code == "PLAN_HASH_MISMATCH" and result.step_ids == ()


def test_read_steps_remain_ready_when_parallel_write_is_unapproved():
    target = plan(step("read", p.StepKind.READ, ("src/read.py",)), step())
    result = schedule(target, main=main(), at=NOW)
    assert result.allowed and result.step_ids == ("read",)
    assert result.blocked_step_ids == ("write",) and result.reason_code == "PARTIAL_READ_ONLY"


@pytest.mark.parametrize("actual", [("outside/file.py",), ("src2/file.py",)])
def test_av_safe_019_scope_expansion_yields_bound_approval_request(actual):
    target = plan()
    result = schedule(target, main=main(), approval_guard=approvals(target), at=NOW, actual_diff_paths=actual)
    assert result.reason_code == "SCOPE_EXPANSION_REQUIRED" and result.step_ids == ()
    assert result.scope_approval_request.plan_hash == target.content_hash
    assert result.scope_approval_request.requested_paths == actual


def test_conflicting_parallel_paths_rejected_but_ordered_write_is_valid():
    with pytest.raises(p.PlannerError, match="PATH_CONFLICT"):
        plan(step("one", paths=("src",)), step("two", paths=("SRC/file.py",)))
    ordered = plan(step("one"), step("two", depends_on=("one",)))
    assert ordered.steps[1].depends_on == ("one",)


@pytest.mark.parametrize("command", ["git reset --hard", "git clean -fd", "rm -rf src", "unknown-tool src"])
def test_unsafe_execute_is_rejected_with_c10_command_semantics(command):
    with pytest.raises(p.PlannerError, match="UNSAFE_ACTION"):
        step(kind=p.StepKind.EXECUTE, command=command)


def test_analysis_baseline_and_instruction_scope_completion_are_bound():
    request = analysis()
    target = plan(request=request)
    wi = target.source_work_instruction
    assert p.validate_work_instruction(wi, target.source_iteration_plan, analysis=request)
    for changes in ({"scope": ("expanded",)}, {"prohibited_actions": ("none",)}, {"completion_conditions": ("unchecked",)}):
        assert not p.validate_work_instruction(replace(wi, **changes), target.source_iteration_plan, analysis=request)
    with pytest.raises(p.PlannerError):
        replace(target, baseline_hash=C)


def test_receipt_determinism_and_evaluator_io0():
    target = plan(step(kind=p.StepKind.READ))
    with mock.patch("subprocess.run", side_effect=AssertionError("IO")), mock.patch("socket.socket", side_effect=AssertionError("IO")), mock.patch("builtins.open", side_effect=AssertionError("IO")):
        one = schedule(target, main=main(), at=NOW)
        two = schedule(target, main=main(), at=NOW)
    assert one.allowed and one.io_count == 0 and one.receipt_hash == two.receipt_hash
    assert one.plan_hash == target.content_hash
    with pytest.raises((AttributeError, TypeError)):
        one.reason_code = "forged"


@pytest.mark.parametrize("offset,reason", [(-1, "APPROVAL_NOT_YET_VALID"), (3600, "APPROVAL_EXPIRED")])
def test_approval_interval_is_half_open(offset, reason):
    target = plan()
    result = schedule(target, main=main(), approval_guard=approvals(target), at=NOW + timedelta(seconds=offset))
    assert not result.allowed and result.reason_code == reason


@pytest.mark.parametrize("value", [False, "", {}, "src/file.py"])
def test_invalid_diff_input_fails_closed(value):
    target = plan()
    result = schedule(target, main=main(), approval_guard=approvals(target), at=NOW, actual_diff_paths=value)
    assert not result.allowed and result.reason_code == "PATH_INVALID"


def test_prohibited_subtree_conflicts_with_broader_scope():
    with pytest.raises(p.PlannerError, match="PATH_CONFLICT"):
        analysis(prohibited_paths=("SRC/private",))


def test_context_value_may_equal_key_without_losing_data():
    assert analysis(context=[["same", "same"]]).to_dict()["context"] == {"same": "same"}


def test_inconsistent_completed_dependencies_are_not_trusted():
    target = plan(step("one", p.StepKind.READ), step("two", p.StepKind.READ, depends_on=("one",)))
    result = schedule(target, main=main(), at=NOW, completed_step_ids={"two"})
    assert result.reason_code == "COMPLETION_STATE_INVALID" and not result.allowed


@pytest.mark.parametrize("risk", [("low", "destructive"), ("unsafe",), ("secret_read",)])
def test_hard_risk_is_not_downgraded_by_low_narrative(risk):
    with pytest.raises(p.PlannerError, match="UNSAFE_ACTION"):
        plan(step(risk=risk))


def test_request_to_plan_and_instructions_are_deterministic():
    first, second = plan(), plan()
    assert first.content_hash == second.content_hash
    assert first.source_work_instruction == second.source_work_instruction
    assert plan(request=analysis(completion_conditions=("different",))).content_hash != first.content_hash


def test_wrong_target_approval_does_not_schedule():
    target = plan()
    result = schedule(target, main=main(), approval_guard=approvals(target, target_hash=A), at=NOW)
    assert result.reason_code == "PLAN_APPROVAL_REQUIRED" and not result.allowed


def test_receipt_snapshots_caller_owned_collections():
    paths, ids = ["outside/file.py"], ["read"]
    request = p.ScopeApprovalRequest(A, paths)
    receipt = p.ScheduleDecision(True, "ALLOWED", "read", ids, "PARTIAL_READ_ONLY", [], A, request)
    digest = receipt.receipt_hash
    paths.append("new"); ids.append("write")
    assert receipt.receipt_hash == digest and receipt.step_ids == ("read",)


def test_prohibited_scope_can_explicitly_include_builtin_protected_path():
    assert analysis(prohibited_paths=(".git",)).prohibited_paths == (".git",)


def test_concrete_diff_must_not_contain_scope_wildcards():
    target = plan(step(paths=("src",)))
    result = schedule(target, main=main(), approval_guard=approvals(target), at=NOW, actual_diff_paths=("src/**",))
    assert result.reason_code == "PATH_INVALID" and not result.allowed


def test_plan_revalidates_preconstructed_step_before_hashing():
    item = step()
    object.__setattr__(item, "allowed_paths", ("../outside",))
    with pytest.raises(p.PlannerError, match="PATH_INVALID"):
        p.ExecutionPlan("plan", A, A, C, B, (item,), NOW)


def test_receipt_binds_responsible_main_actor():
    target = plan(step(kind=p.StepKind.READ))
    first = schedule(target, main=main(), at=NOW)
    second = schedule(target, main=replace(main(), actor_id="other-main"), at=NOW)
    assert first.main_actor_id == "main-agent" and first.receipt_hash != second.receipt_hash


def test_orchestration_service_exports_create_bound_plan_from_analysis():
    from packages.orchestration import analyze_request, build_execution_plan
    request = analyze_request("request", "objective", scope=("feature",),
        completion_conditions=("verified",), allowed_paths=("src",), prohibited_actions=("network",),
        risk=("low",), baseline_hash=A, egress_snapshot_hash=B, prohibited_paths=(".git",))
    parent = plan(request=request)
    target = build_execution_plan(request, [step()], plan_id="plan", permission_snapshot_hash=C,
        created_at=NOW, work_plan=parent.source_work_plan, source_work_instruction=parent.source_work_instruction,
        source_iteration_plan=parent.source_iteration_plan)
    assert target.analysis.prohibited_paths == (".git",)
    assert p.validate_work_instruction(target.source_work_instruction, target.source_iteration_plan, analysis=request)


def test_receipt_rejects_mutable_hash_and_actor_fields():
    with pytest.raises(p.PlannerError):
        p.ScopeApprovalRequest([A], ("src",))
    with pytest.raises(p.PlannerError):
        p.ScheduleDecision(False, "BLOCKED", "invalid", plan_hash=[A])


def test_rework_apply_cannot_authorize_execution_scheduling():
    target = plan()
    result = schedule(target, main=main(), approval_guard=approvals(target),
        approval_type=ApprovalType.APPLY, at=NOW)
    assert not result.allowed and result.reason_code == "APPROVAL_TYPE_INVALID"


def test_rework_future_dependent_path_is_not_current_write_scope():
    target = plan(step("now", paths=("src/now.py",)),
        step("future", paths=("src/future.py",), depends_on=("now",)))
    result = schedule(target, main=main(), approval_guard=approvals(target),
        actual_diff_paths=("src/future.py",), at=NOW)
    assert not result.allowed and result.reason_code == "SCOPE_EXPANSION_REQUIRED"


@pytest.mark.parametrize("kind", [p.StepKind.READ, p.StepKind.WRITE])
def test_rework_main_self_attestation_without_authority_is_rejected(kind):
    target = plan(step(kind=kind))
    result = schedule(target, main=main(), main_authority=None, approval_guard=approvals(target), at=NOW)
    assert not result.allowed and result.reason_code == "MAIN_AUTHORITY_REQUIRED"


def test_rework_execution_plan_references_work_instruction_not_inverse():
    target = plan()
    assert target.source_work_instruction_id != target.plan_id
    assert target.source_work_instruction_hash == target.source_work_instruction.content_hash
    assert target.source_work_instruction.iteration_plan_id == target.source_iteration_plan.artifact_id
    assert target.source_work_instruction.iteration_plan_hash == target.source_iteration_plan.content_hash
    assert target.design_baseline_hash != target.analysis.baseline_hash
    assert target.source_work_instruction.validation_contract
    assert type(target.source_work_instruction.prohibited_paths) is tuple


@pytest.mark.parametrize("kind", [p.StepKind.READ, p.StepKind.WRITE])
@pytest.mark.parametrize("changes,reason", [
    ({"observed_at": NOW + timedelta(seconds=1)}, "MAIN_AUTHORITY_STALE"),
    ({"expires_at": NOW}, "MAIN_AUTHORITY_STALE"),
    ({"actor_id": "subagent"}, "MAIN_AUTHORITY_MISMATCH"),
    ({"authority_source": "agent-message"}, "MAIN_AUTHORITY_MISMATCH"),
    ({"authority_event_hash": A}, "MAIN_AUTHORITY_MISMATCH"),
    ({"execution_fencing_token": "old-fence"}, "MAIN_FENCING_MISMATCH"),
    ({"execution_fencing_token": ""}, "MAIN_FENCING_MISMATCH"),
])
def test_rework_main_authority_stale_spoof_and_fence_fail_closed(kind, changes, reason):
    target = plan(step(kind=kind))
    result = schedule(target, main=replace(main(), **changes), approval_guard=approvals(target), at=NOW)
    assert not result.allowed and result.reason_code == reason and result.io_count == 0


@pytest.mark.parametrize("kind", [p.StepKind.READ, p.StepKind.WRITE])
def test_rework_duck_typed_main_and_authority_are_not_trusted(kind):
    target = plan(step(kind=kind))
    claim = mock.Mock(wraps=main())
    trusted = mock.Mock(wraps=authority())
    first = schedule(target, main=claim, at=NOW)
    second = schedule(target, main=main(), main_authority=trusted, at=NOW)
    assert first.reason_code == "MAIN_RESPONSIBILITY_REQUIRED"
    assert second.reason_code == "MAIN_AUTHORITY_REQUIRED"
    assert not first.allowed and not second.allowed
    claim.assert_not_called(); trusted.assert_not_called()


@pytest.mark.parametrize("changes,reason", [
    ({"observed_at": NOW + timedelta(seconds=1)}, "MAIN_AUTHORITY_STALE"),
    ({"expires_at": NOW}, "MAIN_AUTHORITY_STALE"),
    ({"status": "TERMINATED"}, "MAIN_NOT_ACTIVE"),
    ({"expected_execution_fencing_token": "rotated-fence"}, "MAIN_FENCING_MISMATCH"),
])
def test_rework_current_control_state_overrides_presented_main(changes, reason):
    target = plan(step(kind=p.StepKind.READ))
    result = schedule(target, main=main(), main_authority=authority(**changes), at=NOW)
    assert not result.allowed and result.reason_code == reason


@pytest.mark.parametrize("omitted,reason", [
    (ApprovalType.WORK_INSTRUCTION, "WORK_INSTRUCTION_APPROVAL_REQUIRED"),
    (ApprovalType.EXECUTION_PLAN, "PLAN_APPROVAL_REQUIRED"),
])
def test_rework_wi_and_execution_plan_are_independent_required_approvals(omitted, reason):
    target = plan()
    service = approvals(target)
    for record in tuple(service._approvals.values()):
        if record.approval_type is omitted:
            del service._approvals[record.approval_id]
    result = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert not result.allowed and result.reason_code == reason


@pytest.mark.parametrize("kind", [ApprovalType.WORK_INSTRUCTION, ApprovalType.EXECUTION_PLAN,
                                    ApprovalType.DESIGN_SPECIFICATION, ApprovalType.WORK_PLAN])
def test_rework_newer_wrong_hash_record_does_not_fall_back_to_old_approval(kind):
    target = plan()
    service = approvals(target)
    old = next(record for record in service._approvals.values() if record.approval_type is kind)
    service.record_approval(replace(old, approval_id="newer", subject_hash=B))
    result = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert not result.allowed and result.reason_code.endswith("APPROVAL_REQUIRED")


@pytest.mark.parametrize("field,value", [("validation_contract", ("unchecked",)),
    ("prohibited_paths", ("private",)), ("iteration_plan_id", "other-iteration"),
    ("iteration_plan_hash", C), ("request_analysis_hash", B)])
def test_rework_wi_explicit_contract_and_parent_lineage_are_hash_bound(field, value):
    target = plan()
    wi = replace(target.source_work_instruction, **{field: value})
    assert not p.validate_work_instruction(wi, target.source_iteration_plan, analysis=target.analysis)
    with pytest.raises(p.PlannerError, match="WORK_INSTRUCTION_BINDING_MISMATCH"):
        replace(target, source_work_instruction=wi)


def test_rework_wi_validation_contract_input_is_immutable_and_required():
    target = plan(request=analysis(prohibited_paths=(".git",)))
    contract = ["tests-pass"]
    wi = p.generate_work_instruction(target.source_iteration_plan, analysis=target.analysis, created_at=NOW,
        allowed_actions=("write",), validation_contract=contract)
    contract.append("not-bound")
    assert wi.validation_contract == ("tests-pass",) and wi.prohibited_paths == (".git",)
    assert p.validate_work_instruction(wi, target.source_iteration_plan, analysis=target.analysis)
    with pytest.raises(p.PlannerError, match="validation_contract"):
        p.generate_work_instruction(target.source_iteration_plan, analysis=target.analysis, created_at=NOW,
            allowed_actions=("write",), validation_contract=())


def test_rework_analysis_hash_is_not_a_design_approval_hash():
    target = plan()
    service = approvals(target)
    old = next(record for record in service._approvals.values() if record.approval_type is ApprovalType.DESIGN_SPECIFICATION)
    service.record_approval(replace(old, approval_id="wrong-design", subject_hash=target.analysis.baseline_hash))
    result = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert not result.allowed and result.reason_code == "DESIGN_APPROVAL_REQUIRED"


def test_rework_work_instruction_must_be_approved_before_execution_plan_creation():
    target = plan()
    service = approvals(target)
    old = next(record for record in service._approvals.values() if record.approval_type is ApprovalType.WORK_INSTRUCTION)
    service.record_approval(replace(old, approval_id="late-wi", approved_at=NOW + timedelta(seconds=1)))
    result = schedule(target, main=main(), approval_guard=service, at=NOW + timedelta(seconds=2))
    assert not result.allowed and result.reason_code == "APPROVAL_LINEAGE_INVALID"


def test_rework_execution_plan_approval_cannot_predate_plan_creation():
    target = plan()
    service = approvals(target)
    old = next(record for record in service._approvals.values() if record.approval_type is ApprovalType.EXECUTION_PLAN)
    # A genuinely early sole record, not an older record ingested after a valid one.
    service = PlanningApprovalService()
    for record in approvals(target)._approvals.values():
        service.record_approval(replace(record, approved_at=NOW - timedelta(seconds=1))
            if record.approval_type is ApprovalType.EXECUTION_PLAN else record)
    result = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert not result.allowed and result.reason_code == "APPROVAL_LINEAGE_INVALID"


@pytest.mark.parametrize("kind", [ApprovalType.WORK_INSTRUCTION, ApprovalType.EXECUTION_PLAN])
@pytest.mark.parametrize("offset,reason", [(-1, "APPROVAL_NOT_YET_VALID"), (3600, "APPROVAL_EXPIRED")])
def test_rework_each_write_approval_has_half_open_validity(kind, offset, reason):
    target = plan()
    original = approvals(target)
    service = PlanningApprovalService()
    old = next(record for record in original._approvals.values() if record.approval_type is kind)
    boundary = NOW + timedelta(seconds=1)
    service.record_approval(replace(old, approval_id="boundary", approved_at=boundary,
        expires_at=boundary + timedelta(seconds=3600)))
    # Other required approvals remain valid while the selected edge is tested.
    for record in original._approvals.values():
        if record.approval_type is not kind:
            service.record_approval(replace(record, approval_id="wide-" + record.approval_id,
                expires_at=NOW + timedelta(hours=2)))
    result = schedule(target, main=main(), approval_guard=service, at=boundary + timedelta(seconds=offset))
    assert not result.allowed and result.reason_code == reason


def test_rework_apply_only_is_not_an_execution_plan_approval():
    target = plan()
    service = approvals(target)
    ep = next(record for record in service._approvals.values() if record.approval_type is ApprovalType.EXECUTION_PLAN)
    from packages.planning.approval import ApprovalStatus
    service.record_approval(replace(ep, approval_id="revoked-ep", status=ApprovalStatus.REVOKED))
    service.record_approval(replace(ep, approval_id="apply", approval_type=ApprovalType.APPLY))
    result = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert not result.allowed and result.reason_code == "PLAN_APPROVAL_REQUIRED"


def test_rework_blocked_authority_receipt_is_stable_and_evaluator_io0():
    target = plan()
    service = approvals(target)
    forged = replace(main(), execution_fencing_token="stale")
    with mock.patch("subprocess.run", side_effect=AssertionError("IO")), mock.patch("socket.socket", side_effect=AssertionError("IO")), mock.patch("builtins.open", side_effect=AssertionError("IO")):
        first = schedule(target, main=forged, approval_guard=service, at=NOW)
        second = schedule(target, main=forged, approval_guard=service, at=NOW)
    assert not first.allowed and first.io_count == 0
    assert first.reason_code == "MAIN_FENCING_MISMATCH" and first.receipt_hash == second.receipt_hash


def test_rework2_work_plan_artifact_binds_design_not_independent_scalars():
    target = plan()
    assert target.source_work_plan.artifact_id == target.work_plan_id
    assert target.source_work_plan.content_hash == target.source_iteration_plan.work_plan_hash
    with pytest.raises(p.PlannerError, match="WORK_PLAN_BINDING_MISMATCH"):
        replace(target, design_baseline_hash=A)


def test_rework2_completed_write_scope_is_allowed_in_cumulative_diff():
    target = plan(step("done", paths=("src/done.py",)),
        step("ready", paths=("src/ready.py",), depends_on=("done",)))
    result = schedule(target, main=main(), approval_guard=approvals(target), at=NOW,
        completed_step_ids={"done"}, actual_diff_paths=("src/done.py", "src/ready.py"))
    assert result.allowed and result.step_ids == ("ready",)


def test_rework2_wi_requires_actual_creation_time_not_iteration_time():
    target = plan()
    created = NOW + timedelta(minutes=1)
    wi = p.generate_work_instruction(target.source_iteration_plan, analysis=target.analysis,
        allowed_actions=("write",), validation_contract=("tests",), created_at=created)
    assert wi.created_at == created


@pytest.mark.parametrize("state", ["REVOKED", "SUPERSEDED"])
def test_rework2_old_active_reinsert_does_not_override_newer_record(state):
    from packages.planning.approval import ApprovalStatus
    target = plan()
    service = approvals(target)
    old = next(record for record in service._approvals.values() if record.approval_type is ApprovalType.EXECUTION_PLAN)
    service.record_approval(replace(old, approval_id="new", approved_at=NOW + timedelta(seconds=1), status=ApprovalStatus(state)))
    service.record_approval(replace(old, approval_id="reinsert-old"))
    result = schedule(target, main=main(), approval_guard=service, at=NOW + timedelta(seconds=2))
    assert not result.allowed and result.reason_code == "PLAN_APPROVAL_REQUIRED"


def test_rework2_matching_public_authority_dtos_are_not_a_trust_service():
    target = plan(step(kind=p.StepKind.READ))
    result = p.schedule_ready_steps(target, main=main(), main_authority=p.MainAuthoritySnapshot(
        "main-agent", "plan", NOW - timedelta(hours=2), NOW + timedelta(hours=2),
        "orchestration-control", C, "current-fence"), at=NOW)
    assert not result.allowed and result.reason_code == "MAIN_AUTHORITY_REQUIRED"


@pytest.mark.parametrize("field,value", [("artifact_id", "unrelated-work"),
    ("content_hash", A), ("design_baseline_id", "unrelated-design"), ("design_baseline_hash", A)])
def test_rework2_mismatched_work_plan_artifact_is_rejected(field, value):
    target = plan()
    work = replace(target.source_work_plan, **{field: value})
    with pytest.raises(p.PlannerError):
        replace(target, source_work_plan=work)


@pytest.mark.parametrize("path", ["src/future.py", "src/future/child.py"])
def test_rework2_cumulative_diff_never_admits_future_unready_write(path):
    target = plan(step("done", paths=("src/done.py",)),
        step("ready", paths=("src/ready.py",), depends_on=("done",)),
        step("future", paths=("src/future.py", "src/future"), depends_on=("ready",)))
    result = schedule(target, main=main(), approval_guard=approvals(target), at=NOW,
        completed_step_ids={"done"}, actual_diff_paths=("src/done.py", "src/ready.py", path))
    assert not result.allowed and result.reason_code == "SCOPE_EXPANSION_REQUIRED"


@pytest.mark.parametrize("created", [NOW - timedelta(microseconds=1), NOW.replace(tzinfo=None),
    NOW.astimezone(timezone(timedelta(hours=9)))])
def test_rework2_wi_creation_must_be_utc_and_after_iteration(created):
    target = plan()
    with pytest.raises(p.PlannerError, match="WI_TIME_INVALID"):
        p.generate_work_instruction(target.source_iteration_plan, analysis=target.analysis,
            allowed_actions=("write",), validation_contract=("tests",), created_at=created)


def test_rework2_actual_wi_creation_prevents_iteration_timestamp_preapproval():
    target = plan()
    wi = p.generate_work_instruction(target.source_iteration_plan, analysis=target.analysis,
        allowed_actions=("write",), validation_contract=("tests",), created_at=NOW + timedelta(seconds=10))
    newer = p.build_execution_plan(target.analysis, target.steps, plan_id="plan",
        permission_snapshot_hash=C, created_at=NOW + timedelta(seconds=20), work_plan=target.source_work_plan,
        source_work_instruction=wi, source_iteration_plan=target.source_iteration_plan)
    service = approvals(newer)
    result = schedule(newer, main=main(), approval_guard=service, at=NOW + timedelta(seconds=30))
    assert not result.allowed and result.reason_code == "APPROVAL_LINEAGE_INVALID"
    assert target.source_work_instruction.content_hash != wi.content_hash


@pytest.mark.parametrize("reverse", [False, True])
def test_rework2_same_approval_timestamp_conflict_fails_closed_in_either_order(reverse):
    from packages.planning.approval import ApprovalStatus
    active = ApprovalRecord("active", ApprovalType.EXECUTION_PLAN, "plan", A, "human", True, NOW, NOW + timedelta(hours=1))
    revoked = replace(active, approval_id="revoked", status=ApprovalStatus.REVOKED)
    service = PlanningApprovalService()
    for record in ((revoked, active) if reverse else (active, revoked)):
        service.record_approval(record)
    assert not service.exact_execution_guard("plan", A, ApprovalType.EXECUTION_PLAN, NOW).allowed


def test_rework2_newer_other_hash_wins_over_late_old_active_ingestion():
    service = PlanningApprovalService()
    old = ApprovalRecord("old", ApprovalType.EXECUTION_PLAN, "plan", A, "human", True, NOW, NOW + timedelta(hours=1))
    service.record_approval(replace(old, approval_id="new", subject_hash=B, approved_at=NOW + timedelta(seconds=1)))
    service.record_approval(old)
    assert not service.exact_execution_guard("plan", A, ApprovalType.EXECUTION_PLAN, NOW + timedelta(seconds=2)).allowed


@pytest.mark.parametrize("kind", [p.StepKind.READ, p.StepKind.WRITE])
def test_rework2_newer_terminated_control_record_cannot_be_revived_by_old_active(kind):
    target = plan(step(kind=kind))
    current = MainAuthorityRecord("main-agent", "plan", NOW - timedelta(seconds=1),
        NOW + timedelta(hours=2), MainAuthoritySource.CONTROL_PLANE, D, "current-fence", MainAuthorityStatus.TERMINATED)
    old = replace(current, observed_at=NOW - timedelta(hours=2), authority_event_hash=C, status=MainAuthorityStatus.ACTIVE)
    service = PlanningMainAuthorityService()
    service.record_observation(current); service.record_observation(old)
    result = schedule(target, main=main(), main_authority=service, approval_guard=approvals(target), at=NOW)
    assert not result.allowed and result.reason_code == "MAIN_NOT_ACTIVE"
    audit = service.audit_events()[-1]
    assert audit.authority_event_hash == D and audit.reason_code == "MAIN_NOT_ACTIVE"


@pytest.mark.parametrize("source", ["CONTROL_PLANE", "agent-message", "subagent-agreement"])
def test_rework2_control_record_rejects_raw_or_agent_message_source(source):
    with pytest.raises(ValueError, match="canonical control-plane"):
        MainAuthorityRecord("main-agent", "plan", NOW, NOW + timedelta(hours=1), source, C, "current-fence")


def test_rework2_control_service_rejects_raw_snapshot_and_empty_state():
    service = PlanningMainAuthorityService()
    with pytest.raises(ValueError, match="control-plane record"):
        service.record_observation(p.MainAuthoritySnapshot("main-agent", "plan", NOW,
            NOW + timedelta(hours=1), "CONTROL_PLANE", C, "current-fence"))
    result = schedule(plan(), main=main(), main_authority=service, at=NOW)
    assert not result.allowed and result.reason_code == "MAIN_AUTHORITY_REQUIRED"


def test_rework2_wrong_plan_control_record_cannot_grant_read():
    result = schedule(plan(step(kind=p.StepKind.READ)), main=main(), main_authority=authority(plan_id="other-plan"), at=NOW)
    assert not result.allowed and result.reason_code == "MAIN_AUTHORITY_MISMATCH"


def test_rework2_authority_same_timestamp_conflict_is_fail_closed_and_audited():
    service = authority()
    service.record_observation(MainAuthorityRecord("other-main", "plan", NOW - timedelta(hours=2),
        NOW + timedelta(hours=2), MainAuthoritySource.CONTROL_PLANE, D, "current-fence"))
    result = schedule(plan(), main=main(), main_authority=service, at=NOW)
    assert not result.allowed and result.reason_code == "MAIN_AUTHORITY_AMBIGUOUS"
    assert service.audit_events()[-1].reason_code == "MAIN_AUTHORITY_AMBIGUOUS"


def test_rework2_authority_record_is_copied_and_audit_is_immutable():
    record = MainAuthorityRecord("main-agent", "plan", NOW - timedelta(hours=2),
        NOW + timedelta(hours=2), MainAuthoritySource.CONTROL_PLANE, C, "current-fence")
    service = PlanningMainAuthorityService()
    service.record_observation(record)
    object.__setattr__(record, "status", MainAuthorityStatus.TERMINATED)
    result = schedule(plan(step(kind=p.StepKind.READ)), main=main(), main_authority=service, at=NOW)
    assert result.allowed and service.audit_events()[-1].reason_code == "MAIN_AUTHORITY_VERIFIED"
    with pytest.raises((AttributeError, TypeError)):
        service.audit_events()[-1].reason_code = "forged"


def test_rework3_same_work_hash_cannot_splice_a_different_design_parent():
    target = plan()
    forged = replace(target.source_work_plan, design_baseline_id="other-design", design_baseline_hash=A)
    with pytest.raises(p.PlannerError, match="WORK_PLAN_CONTENT_HASH_MISMATCH"):
        p.build_execution_plan(target.analysis, target.steps, plan_id="plan",
            permission_snapshot_hash=C, created_at=NOW, work_plan=forged,
            source_work_instruction=target.source_work_instruction, source_iteration_plan=target.source_iteration_plan)


@pytest.mark.parametrize("field,value", [("work_plan_id", "other-work"), ("sequence", 2)])
def test_rework3_same_iteration_hash_cannot_splice_parent_or_sequence(field, value):
    target = plan()
    forged = replace(target.source_iteration_plan, **{field: value})
    with pytest.raises(p.PlannerError, match="ITERATION_PLAN_CONTENT_HASH_MISMATCH"):
        p.generate_work_instruction(forged, analysis=target.analysis, created_at=NOW,
            allowed_actions=("write",), validation_contract=("tests",))


@pytest.mark.parametrize("field,value", [("artifact_id", "changed"), ("revision", 2),
    ("design_baseline_id", "changed-design"), ("design_baseline_hash", A),
    ("scope", frozenset({"changed-scope"})), ("created_at", NOW + timedelta(seconds=1))])
def test_rework3_work_plan_model_hash_binds_every_canonical_field(field, value):
    original = plan().source_work_plan
    with pytest.raises(ValueError, match="canonical content hash mismatch"):
        replace(original, **{field: value}).validate_content_hash()


@pytest.mark.parametrize("field,value", [("artifact_id", "changed"), ("revision", 2),
    ("work_plan_id", "changed-work"), ("work_plan_hash", A), ("sequence", 2),
    ("created_at", NOW + timedelta(seconds=1))])
def test_rework3_iteration_model_hash_binds_every_canonical_field(field, value):
    original = plan().source_iteration_plan
    with pytest.raises(ValueError, match="canonical content hash mismatch"):
        replace(original, **{field: value}).validate_content_hash()


def test_rework3_canonical_parent_factory_matches_explicit_payload_contract():
    from packages.planning.hashing import canonical_content_hash
    work = WorkPlan.create(artifact_id="work", revision=2, design_baseline_id="design",
        design_baseline_hash=D, scope=frozenset({"z", "a"}), created_at=NOW)
    assert work.content_hash == canonical_content_hash({"artifact_type": "WorkPlan",
        "artifact_id": "work", "revision": 2, "design_baseline_id": "design",
        "design_baseline_hash": D, "scope": ["a", "z"], "created_at": NOW.isoformat()})
    again = WorkPlan.create(artifact_id="work", revision=2, design_baseline_id="design",
        design_baseline_hash=D, scope=frozenset({"a", "z"}), created_at=NOW)
    assert work.content_hash == again.content_hash
    iteration = IterationPlan.create(artifact_id="iter", revision=3, work_plan=work, sequence=4, created_at=NOW)
    assert iteration.content_hash == canonical_content_hash({"artifact_type": "IterationPlan",
        "artifact_id": "iter", "revision": 3, "work_plan_id": "work", "work_plan_hash": work.content_hash,
        "sequence": 4, "created_at": NOW.isoformat()})
    work.validate_content_hash(); iteration.validate_content_hash()


def test_rework3_legacy_persistence_constructor_remains_but_c11_requires_canonical_hash():
    work = WorkPlan("legacy", 1, A, "design", D, frozenset({"feature"}), NOW)
    iteration = IterationPlan("legacy-iteration", 1, A, "legacy", A, 1, NOW)
    assert work.content_hash == A and iteration.content_hash == A
    for artifact in (work, iteration):
        with pytest.raises(ValueError, match="canonical content hash mismatch"):
            artifact.validate_content_hash()
    with pytest.raises(ValueError, match="canonical content hash mismatch"):
        IterationPlan.create(artifact_id="new", revision=1, work_plan=work, sequence=1, created_at=NOW)


@pytest.mark.parametrize("parent,field,value,reason", [
    ("source_work_plan", "design_baseline_hash", A, "WORK_PLAN_CONTENT_HASH_MISMATCH"),
    ("source_iteration_plan", "sequence", 2, "ITERATION_PLAN_CONTENT_HASH_MISMATCH")])
def test_rework3_schedule_revalidates_parent_content_even_if_outer_plan_hash_is_recomputed(parent, field, value, reason):
    from packages.planning.hashing import canonical_content_hash
    target = plan()
    object.__setattr__(getattr(target, parent), field, value)
    if parent == "source_work_plan": object.__setattr__(target, "design_baseline_hash", A)
    object.__setattr__(target, "content_hash", canonical_content_hash(target.to_dict(include_hash=False)))
    service = approvals(target)
    with mock.patch("subprocess.run", side_effect=AssertionError("IO")), mock.patch("socket.socket", side_effect=AssertionError("IO")), mock.patch("builtins.open", side_effect=AssertionError("IO")):
        first = schedule(target, main=main(), approval_guard=service, at=NOW)
        second = schedule(target, main=main(), approval_guard=service, at=NOW)
    assert not first.allowed and first.reason_code == reason and first.io_count == 0
    assert first.receipt_hash == second.receipt_hash
