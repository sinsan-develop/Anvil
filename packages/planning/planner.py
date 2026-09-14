"""Deterministic Main Agent request analysis and execution-plan artifacts.

This module is deliberately pure: it never invokes a model, worker, tool, or
external service.  A plan is an immutable description and the scheduler only
returns a decision; execution is owned by later orchestration packages.
"""
from __future__ import annotations

from dataclasses import dataclass, field, fields, replace
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping
import unicodedata

from packages.action_policy.admission import safe_path, protected, unsafe_command

from .hashing import canonical_content_hash
from .models import IterationPlan, WorkInstruction, WorkPlan
from .approval import ApprovalType

_HASH = __import__("re").compile(r"sha256:[0-9a-f]{64}\Z")


class PlannerError(ValueError):
    pass


class StepKind(str, Enum):
    ANALYZE = "ANALYZE"
    PLAN = "PLAN"
    READ = "READ"
    WRITE = "WRITE"
    EXECUTE = "EXECUTE"


def _text(value: Any, field: str) -> str:
    if type(value) is not str or not value or value != value.strip():
        raise PlannerError(f"{field} must be a canonical non-empty string")
    return value


def _tuple_text(value: Any, field: str) -> tuple[str, ...]:
    if type(value) not in (tuple, list) or not value:
        raise PlannerError(f"{field} must be non-empty")
    result = tuple(_text(item, f"{field} item") for item in value)
    if len(result) != len(set(result)):
        raise PlannerError(f"{field} must not contain duplicates")
    return result


def _paths(values: Any, *, allow_protected: bool = False) -> tuple[str, ...]:
    try:
        result = _tuple_text(values, "allowed_paths")
    except PlannerError as error:
        raise PlannerError("PATH_INVALID") from error
    canonical = []
    for value in result:
        prefix = value[:-3] if value.endswith("/**") else value
        if unicodedata.normalize("NFKC", prefix) != prefix or not safe_path(prefix):
            raise PlannerError("PATH_INVALID")
        if not allow_protected and protected(prefix):
            raise PlannerError("PROTECTED_PATH_DENIED")
        canonical.append(prefix.casefold())
    if len(canonical) != len(set(canonical)):
        raise PlannerError("PATH_CONFLICT")
    return result


def _within(path: str, scopes: tuple[str, ...]) -> bool:
    path = path.removesuffix("/**").casefold()
    return any(path == base or path.startswith(base + "/")
               for base in (s.removesuffix("/**").casefold() for s in scopes))


@dataclass(frozen=True, slots=True)
class RequestAnalysis:
    request_id: str
    objective: str
    scope: tuple[str, ...]
    completion_conditions: tuple[str, ...]
    risk: tuple[str, ...]
    allowed_paths: tuple[str, ...]
    prohibited_actions: tuple[str, ...]
    egress_snapshot_hash: str
    baseline_hash: str
    context: tuple[tuple[str, str], ...] = ()
    prohibited_paths: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _text(self.request_id, "request_id"); _text(self.objective, "objective")
        for value, name in ((self.scope, "scope"), (self.completion_conditions, "completion_conditions"), (self.risk, "risk"), (self.allowed_paths, "allowed_paths"), (self.prohibited_actions, "prohibited_actions")):
            object.__setattr__(self, name, _tuple_text(value, name))
        object.__setattr__(self, "allowed_paths", _paths(self.allowed_paths))
        if type(self.context) not in (tuple, list): raise PlannerError("context must be pairs")
        if any(type(pair) not in (tuple, list) or len(pair) != 2 for pair in self.context):
            raise PlannerError("context must be pairs")
        context = tuple(tuple(_text(item, "context item") for item in pair) for pair in self.context)
        if len({pair[0] for pair in context}) != len(context):
            raise PlannerError("context must contain unique key/value pairs")
        object.__setattr__(self, "context", tuple(sorted(context)))
        if type(self.prohibited_paths) not in (tuple, list): raise PlannerError("PATH_INVALID")
        prohibited_paths = _paths(self.prohibited_paths, allow_protected=True) if self.prohibited_paths else ()
        object.__setattr__(self, "prohibited_paths", prohibited_paths)
        if any(_within(path, prohibited_paths) for path in self.allowed_paths) or any(
                _within(path, self.allowed_paths) for path in prohibited_paths):
            raise PlannerError("PATH_CONFLICT")
        for value, name in ((self.egress_snapshot_hash, "egress_snapshot_hash"), (self.baseline_hash, "baseline_hash")):
            _text(value, name)
            if _HASH.fullmatch(value) is None:
                raise PlannerError(f"{name} must be a sha256 hash")
        if set(self.allowed_paths) & set(self.prohibited_actions):
            raise PlannerError("allowed and prohibited path scopes conflict")

    @property
    def content_hash(self) -> str:
        return canonical_content_hash(self.to_dict())

    def to_dict(self) -> dict[str, Any]:
        return {"request_id": self.request_id, "objective": self.objective, "scope": list(self.scope), "completion_conditions": list(self.completion_conditions), "risk": list(self.risk), "allowed_paths": list(self.allowed_paths), "prohibited_actions": list(self.prohibited_actions), "prohibited_paths": list(self.prohibited_paths), "egress_snapshot_hash": self.egress_snapshot_hash, "baseline_hash": self.baseline_hash, "context": {k: v for k, v in self.context}}


@dataclass(frozen=True, slots=True)
class ExecutionStep:
    step_id: str
    kind: StepKind
    objective: str
    depends_on: tuple[str, ...]
    allowed_paths: tuple[str, ...]
    completion_conditions: tuple[str, ...]
    risk: tuple[str, ...] = ()
    egress_snapshot_hash: str = "sha256:" + "0" * 64
    command: str | None = None

    def __post_init__(self) -> None:
        _text(self.step_id, "step_id"); _text(self.objective, "objective")
        if not isinstance(self.kind, StepKind): raise PlannerError("kind must be StepKind")
        for value, name in ((self.depends_on, "depends_on"), (self.allowed_paths, "allowed_paths"), (self.completion_conditions, "completion_conditions"), (self.risk, "risk")):
            if type(value) not in (tuple, list): raise PlannerError(f"{name} must be a sequence")
            object.__setattr__(self, name, _tuple_text(value, name) if value else ())
        object.__setattr__(self, "allowed_paths", _paths(self.allowed_paths))
        if not self.completion_conditions: raise PlannerError("completion_conditions required")
        if type(self.egress_snapshot_hash) is not str or not _HASH.fullmatch(self.egress_snapshot_hash):
            raise PlannerError("egress snapshot must be a canonical sha256 hash")
        if self.kind is StepKind.EXECUTE and (self.command is None or unsafe_command(self.command)):
            raise PlannerError("UNSAFE_ACTION")
        if self.kind is not StepKind.EXECUTE and self.command is not None:
            raise PlannerError("UNSAFE_ACTION")

    @property
    def write_capable(self) -> bool:
        return self.kind in (StepKind.WRITE, StepKind.EXECUTE)

    def to_dict(self) -> dict[str, Any]:
        return {"step_id": self.step_id, "kind": self.kind.value, "objective": self.objective, "depends_on": list(self.depends_on), "allowed_paths": list(self.allowed_paths), "completion_conditions": list(self.completion_conditions), "risk": list(self.risk), "egress_snapshot_hash": self.egress_snapshot_hash, "command": self.command}


@dataclass(frozen=True, slots=True)
class ExecutionPlan:
    plan_id: str
    request_analysis_hash: str
    baseline_hash: str
    permission_snapshot_hash: str
    egress_snapshot_hash: str
    steps: tuple[ExecutionStep, ...]
    created_at: datetime
    analysis: RequestAnalysis | None = None
    design_baseline_id: str | None = None
    work_plan_id: str | None = None
    work_plan_hash: str | None = None
    design_baseline_hash: str | None = None
    source_work_instruction_id: str | None = None
    source_work_instruction_hash: str | None = None
    source_work_instruction: WorkInstruction | None = None
    source_iteration_plan: IterationPlan | None = None
    source_work_plan: WorkPlan | None = None
    content_hash: str = field(init=False)

    def __post_init__(self) -> None:
        _text(self.plan_id, "plan_id")
        for value, name in ((self.request_analysis_hash, "request_analysis_hash"), (self.baseline_hash, "baseline_hash"), (self.permission_snapshot_hash, "permission_snapshot_hash"), (self.egress_snapshot_hash, "egress_snapshot_hash")):
            _text(value, name)
            if _HASH.fullmatch(value) is None: raise PlannerError(f"{name} must be a canonical lowercase sha256 hash")
        if type(self.steps) is not tuple or not self.steps: raise PlannerError("steps must be non-empty")
        if any(type(step) is not ExecutionStep for step in self.steps): raise PlannerError("invalid step type")
        object.__setattr__(self, "steps", tuple(replace(step) for step in self.steps))
        if len({step.step_id for step in self.steps}) != len(self.steps): raise PlannerError("step_id must be unique")
        ids = {step.step_id for step in self.steps}
        if any(dep not in ids or dep == step.step_id for step in self.steps for dep in step.depends_on): raise PlannerError("dependency must reference another step")
        if any(step.egress_snapshot_hash != self.egress_snapshot_hash for step in self.steps): raise PlannerError("step egress snapshot is not bound to plan")
        if any(not step.allowed_paths for step in self.steps): raise PlannerError("every step must bind an allowed path scope")
        self._assert_acyclic()
        by_id = {step.step_id: step for step in self.steps}
        def ancestors(step):
            return set(step.depends_on).union(*(ancestors(by_id[dep]) for dep in step.depends_on))
        for index, left in enumerate(self.steps):
            for right in self.steps[index + 1:]:
                if (left.write_capable or right.write_capable) and left.step_id not in ancestors(right) and right.step_id not in ancestors(left):
                    if any(_within(path, right.allowed_paths) for path in left.allowed_paths) or any(_within(path, left.allowed_paths) for path in right.allowed_paths):
                        raise PlannerError("PATH_CONFLICT")
        if self.analysis is not None:
            if type(self.analysis) is not RequestAnalysis: raise PlannerError("ANALYSIS_REQUIRED")
            object.__setattr__(self, "analysis", replace(self.analysis))
            _bound_analysis(self, self.analysis)
        for value, name in ((self.design_baseline_id, "design_baseline_id"), (self.work_plan_id, "work_plan_id")):
            if value is not None: _text(value, name)
        if self.work_plan_hash is not None and (type(self.work_plan_hash) is not str or not _HASH.fullmatch(self.work_plan_hash)):
            raise PlannerError("work_plan_hash must be a canonical sha256 hash")
        if self.source_work_instruction is not None:
            if type(self.source_work_instruction) is not WorkInstruction or type(self.source_iteration_plan) is not IterationPlan:
                raise PlannerError("WORK_INSTRUCTION_BINDING_MISMATCH")
            object.__setattr__(self, "source_work_instruction", replace(self.source_work_instruction))
            object.__setattr__(self, "source_iteration_plan", replace(self.source_iteration_plan))
            if type(self.source_work_plan) is not WorkPlan: raise PlannerError("WORK_PLAN_BINDING_MISMATCH")
            object.__setattr__(self, "source_work_plan", replace(self.source_work_plan))
            _bound_instruction(self)
        if not isinstance(self.created_at, datetime) or self.created_at.tzinfo is None or self.created_at.utcoffset() != timezone.utc.utcoffset(self.created_at): raise PlannerError("created_at must be UTC")
        object.__setattr__(self, "content_hash", canonical_content_hash(self.to_dict(include_hash=False)))

    def _assert_acyclic(self) -> None:
        by_id = {step.step_id: step for step in self.steps}; visiting: set[str] = set(); done: set[str] = set()
        def visit(node: str) -> None:
            if node in visiting: raise PlannerError("dependency cycle")
            if node in done: return
            visiting.add(node)
            for dep in by_id[node].depends_on: visit(dep)
            visiting.remove(node); done.add(node)
        for node in by_id: visit(node)

    def to_dict(self, *, include_hash: bool = True) -> dict[str, Any]:
        value = {"plan_id": self.plan_id, "request_analysis_hash": self.request_analysis_hash, "baseline_hash": self.baseline_hash, "permission_snapshot_hash": self.permission_snapshot_hash, "egress_snapshot_hash": self.egress_snapshot_hash, "steps": [step.to_dict() for step in self.steps], "created_at": self.created_at.isoformat()}
        value.update({"analysis": self.analysis.to_dict() if self.analysis is not None else None,
            "design_baseline_id": self.design_baseline_id, "work_plan_id": self.work_plan_id,
            "work_plan_hash": self.work_plan_hash, "design_baseline_hash": self.design_baseline_hash,
            "source_work_instruction_id": self.source_work_instruction_id,
            "source_work_instruction_hash": self.source_work_instruction_hash,
            "source_work_instruction": _artifact_dict(self.source_work_instruction),
            "source_iteration_plan": _artifact_dict(self.source_iteration_plan),
            "source_work_plan": _artifact_dict(self.source_work_plan)})
        if include_hash and hasattr(self, "content_hash"): value["content_hash"] = self.content_hash
        return value


@dataclass(frozen=True, slots=True)
class MainResponsibility:
    """Presented claim; never authoritative without the control-plane seam."""
    actor_id: str
    plan_id: str
    status: str = "ACTIVE"
    role: str = "MAIN"
    observed_at: datetime | None = None
    expires_at: datetime | None = None
    authority_source: str = ""
    authority_event_hash: str = ""
    execution_fencing_token: str = ""


@dataclass(frozen=True, slots=True)
class MainAuthoritySnapshot:
    """Legacy observation DTO; never accepted as a scheduling authority."""
    actor_id: str
    plan_id: str
    observed_at: datetime
    expires_at: datetime
    authority_source: str
    authority_event_hash: str
    expected_execution_fencing_token: str
    status: str = "ACTIVE"


def _main_authority_error(main, authority, plan, now):
    from .service import PlanningMainAuthorityService
    if type(authority) is not PlanningMainAuthorityService:
        return "MAIN_AUTHORITY_REQUIRED"
    guard = authority.execution_guard(main, getattr(plan, "plan_id", None), now)
    return None if guard.allowed else guard.reason_code


@dataclass(frozen=True, slots=True)
class ScopeApprovalRequest:
    plan_hash: str
    requested_paths: tuple[str, ...]

    def __post_init__(self):
        if type(self.plan_hash) is not str or not _HASH.fullmatch(self.plan_hash):
            raise PlannerError("invalid scope receipt plan hash")
        object.__setattr__(self, "requested_paths", _paths(self.requested_paths))

    @property
    def content_hash(self) -> str:
        return canonical_content_hash({"plan_hash": self.plan_hash, "requested_paths": self.requested_paths})


@dataclass(frozen=True, slots=True)
class ScheduleDecision:
    allowed: bool
    status: str
    reason: str
    step_ids: tuple[str, ...] = ()
    reason_code: str = ""
    blocked_step_ids: tuple[str, ...] = ()
    plan_hash: str = ""
    scope_approval_request: ScopeApprovalRequest | None = None
    io_count: int = 0
    main_actor_id: str = ""

    def __post_init__(self):
        if (type(self.allowed) is not bool or type(self.io_count) is not int or self.io_count != 0
            or any(type(value) is not str for value in (self.status, self.reason, self.reason_code,
                                                        self.plan_hash, self.main_actor_id))):
            raise PlannerError("invalid receipt scalar")
        for name in ("step_ids", "blocked_step_ids"):
            values = getattr(self, name)
            if type(values) not in (tuple, list): raise PlannerError("invalid receipt step IDs")
            object.__setattr__(self, name, _tuple_text(values, name) if values else ())
        if self.scope_approval_request is not None:
            if type(self.scope_approval_request) is not ScopeApprovalRequest: raise PlannerError("invalid scope receipt")
            object.__setattr__(self, "scope_approval_request", replace(self.scope_approval_request))

    @property
    def receipt_hash(self) -> str:
        return canonical_content_hash({"allowed": self.allowed, "status": self.status,
            "reason_code": self.reason_code, "step_ids": self.step_ids,
            "blocked_step_ids": self.blocked_step_ids, "plan_hash": self.plan_hash,
            "scope_approval_hash": self.scope_approval_request.content_hash if self.scope_approval_request else None,
            "io_count": self.io_count, "main_actor_id": self.main_actor_id})


def _bound_analysis(plan: ExecutionPlan, analysis: RequestAnalysis | None) -> RequestAnalysis:
    if type(analysis) is not RequestAnalysis:
        raise PlannerError("ANALYSIS_REQUIRED")
    if (analysis.content_hash != plan.request_analysis_hash or analysis.baseline_hash != plan.baseline_hash
        or analysis.egress_snapshot_hash != plan.egress_snapshot_hash):
        raise PlannerError("ANALYSIS_BINDING_MISMATCH")
    for step in plan.steps:
        if any(not _within(path, analysis.allowed_paths) for path in step.allowed_paths):
            raise PlannerError("SCOPE_EXPANSION_REQUIRED")
        if step.kind.value.casefold() in {action.casefold() for action in analysis.prohibited_actions}:
            raise PlannerError("UNSAFE_ACTION")
        if step.write_capable and {risk.casefold() for risk in (*step.risk, *analysis.risk)} & {
                "destructive", "unsafe", "secret_read", "protected"}:
            raise PlannerError("UNSAFE_ACTION")
    return analysis


def _verify_plan_hash(plan: ExecutionPlan) -> None:
    if type(plan) is not ExecutionPlan or plan.content_hash != canonical_content_hash(plan.to_dict(include_hash=False)):
        raise PlannerError("PLAN_HASH_MISMATCH")


def _verify_parent_content(artifact, expected_type, code) -> None:
    if type(artifact) is not expected_type: raise PlannerError(code)
    try:
        artifact.validate_content_hash()
    except (ValueError, TypeError, AttributeError) as error:
        raise PlannerError(code) from error


def build_execution_plan(analysis: RequestAnalysis, steps: tuple[ExecutionStep, ...] | list[ExecutionStep], *,
                         plan_id: str, permission_snapshot_hash: str, created_at: datetime,
                         work_plan: WorkPlan, source_work_instruction: WorkInstruction,
                         source_iteration_plan: IterationPlan) -> ExecutionPlan:
    """Main supplies analyzed steps and trusted snapshot IDs; this service does no IO."""
    if type(analysis) is not RequestAnalysis: raise PlannerError("ANALYSIS_REQUIRED")
    if type(steps) not in (tuple, list): raise PlannerError("steps must be a sequence")
    if type(work_plan) is not WorkPlan: raise PlannerError("WORK_PLAN_REQUIRED")
    work_plan = replace(work_plan)
    _verify_parent_content(work_plan, WorkPlan, "WORK_PLAN_CONTENT_HASH_MISMATCH")
    if type(source_work_instruction) is not WorkInstruction: raise PlannerError("WORK_INSTRUCTION_BINDING_MISMATCH")
    return ExecutionPlan(plan_id, analysis.content_hash, analysis.baseline_hash, permission_snapshot_hash,
        analysis.egress_snapshot_hash, tuple(steps), created_at, analysis, work_plan.design_baseline_id,
        work_plan.artifact_id, work_plan.content_hash, work_plan.design_baseline_hash,
        source_work_instruction.artifact_id, source_work_instruction.content_hash,
        source_work_instruction, source_iteration_plan, work_plan)


def _artifact_dict(artifact, *, include_hash=True):
    if artifact is None: return None
    return {item.name: (value.isoformat() if isinstance(value, datetime) else sorted(value) if type(value) is frozenset else value)
        for item in fields(artifact) if include_hash or item.name != "content_hash"
        for value in (getattr(artifact, item.name),)}


def generate_work_instruction(iteration_plan: IterationPlan, *, analysis: RequestAnalysis,
        allowed_actions: tuple[str, ...], validation_contract: tuple[str, ...],
        created_at: datetime, artifact_id: str | None = None, revision: int = 1) -> WorkInstruction:
    """Derive a WI from an actual IterationPlan, before creating ExecutionPlan."""
    if type(iteration_plan) is not IterationPlan: raise PlannerError("ITERATION_PLAN_REQUIRED")
    iteration_plan = replace(iteration_plan)
    _verify_parent_content(iteration_plan, IterationPlan, "ITERATION_PLAN_CONTENT_HASH_MISMATCH")
    if type(created_at) is not datetime or created_at.tzinfo is None or created_at.utcoffset() != timezone.utc.utcoffset(created_at):
        raise PlannerError("WI_TIME_INVALID")
    if created_at < iteration_plan.created_at: raise PlannerError("WI_TIME_INVALID")
    if type(analysis) is not RequestAnalysis: raise PlannerError("ANALYSIS_REQUIRED")
    analysis = replace(analysis)
    actions = _tuple_text(allowed_actions, "allowed_actions")
    if any(action not in {kind.value.lower() for kind in StepKind} or action in
           {item.casefold() for item in analysis.prohibited_actions} for action in actions):
        raise PlannerError("UNSAFE_ACTION")
    validation = _tuple_text(validation_contract, "validation_contract")
    instruction = WorkInstruction(artifact_id or f"wi-{iteration_plan.artifact_id}", revision,
        "sha256:" + "0" * 64, iteration_plan.artifact_id, iteration_plan.content_hash,
        analysis.allowed_paths, actions, analysis.completion_conditions, created_at,
        analysis.objective, analysis.risk, analysis.egress_snapshot_hash, analysis.prohibited_actions,
        analysis.scope, analysis.content_hash, analysis.prohibited_paths, validation)
    return replace(instruction, content_hash=canonical_content_hash(_artifact_dict(instruction, include_hash=False)))


def validate_work_instruction(instruction: WorkInstruction, iteration_plan: IterationPlan, *, analysis: RequestAnalysis) -> bool:
    if type(instruction) is not WorkInstruction or type(iteration_plan) is not IterationPlan: return False
    try:
        expected = generate_work_instruction(iteration_plan, analysis=analysis,
            allowed_actions=instruction.allowed_actions, validation_contract=instruction.validation_contract,
            created_at=instruction.created_at, artifact_id=instruction.artifact_id, revision=instruction.revision)
        return instruction == expected
    except (ValueError, TypeError, AttributeError):
        return False


def _bound_instruction(plan: ExecutionPlan) -> None:
    wi, iteration = plan.source_work_instruction, plan.source_iteration_plan
    _verify_parent_content(plan.source_work_plan, WorkPlan, "WORK_PLAN_CONTENT_HASH_MISMATCH")
    _verify_parent_content(iteration, IterationPlan, "ITERATION_PLAN_CONTENT_HASH_MISMATCH")
    if (not validate_work_instruction(wi, iteration, analysis=plan.analysis)
        or plan.source_work_instruction_id != wi.artifact_id
        or plan.source_work_instruction_hash != wi.content_hash
        or plan.work_plan_id != iteration.work_plan_id or plan.work_plan_hash != iteration.work_plan_hash):
        raise PlannerError("WORK_INSTRUCTION_BINDING_MISMATCH")
    if type(plan.design_baseline_hash) is not str or not _HASH.fullmatch(plan.design_baseline_hash):
        raise PlannerError("DESIGN_BINDING_REQUIRED")
    work = plan.source_work_plan
    if (type(work) is not WorkPlan or work.artifact_id != iteration.work_plan_id
        or work.content_hash != iteration.work_plan_hash
        or work.design_baseline_id != plan.design_baseline_id
        or work.design_baseline_hash != plan.design_baseline_hash
        or not set(plan.analysis.scope).issubset(work.scope)
        or work.created_at > iteration.created_at):
        raise PlannerError("WORK_PLAN_BINDING_MISMATCH")
    if type(plan.created_at) is not datetime or plan.created_at.tzinfo is None or plan.created_at < wi.created_at:
        raise PlannerError("PLAN_TIME_INVALID")
    for step in plan.steps:
        if (step.kind.value.lower() not in wi.allowed_actions
            or any(not _within(path, wi.allowed_paths) for path in step.allowed_paths)
            or not set(step.risk).issubset(wi.risk)
            or not set(step.completion_conditions).issubset(wi.completion_conditions)):
            raise PlannerError("WORK_INSTRUCTION_SCOPE_MISMATCH")


def analyze_request(request_id: str, objective: str, *, scope: tuple[str, ...], completion_conditions: tuple[str, ...], allowed_paths: tuple[str, ...], prohibited_actions: tuple[str, ...], risk: tuple[str, ...], baseline_hash: str, egress_snapshot_hash: str, prohibited_paths: tuple[str, ...] = (), context: tuple[tuple[str, str], ...] = ()) -> RequestAnalysis:
    return RequestAnalysis(request_id, objective, scope, completion_conditions, risk, allowed_paths, prohibited_actions, egress_snapshot_hash, baseline_hash, context, prohibited_paths)


def schedule_ready_steps(plan: ExecutionPlan, *, completed_step_ids: frozenset[str] | set[str] | tuple[str, ...] = frozenset(), approval_guard: Any | None = None, at: datetime | None = None, approval_type: ApprovalType = ApprovalType.EXECUTION_PLAN, main: MainResponsibility | None = None, main_authority: Any | None = None, analysis: RequestAnalysis | None = None, actual_diff_paths: tuple[str, ...] | None = None) -> ScheduleDecision:
    from .service import PlanningApprovalService

    def decision(code, allowed=(), blocked=(), request=None):
        plan_hash = getattr(plan, "content_hash", "")
        if type(plan_hash) is not str: plan_hash = ""
        return ScheduleDecision(bool(allowed), "ALLOWED" if allowed else "BLOCKED", code,
            tuple(allowed), code, tuple(blocked), plan_hash, request,
            main_actor_id=main.actor_id if type(main) is MainResponsibility and type(main.actor_id) is str else "")

    if (type(main) is not MainResponsibility or main.role != "MAIN"
        or type(main.actor_id) is not str or not main.actor_id.strip() or main.actor_id != main.actor_id.strip()
        or main.plan_id != getattr(plan, "plan_id", None)):
        return decision("MAIN_RESPONSIBILITY_REQUIRED")
    if main.status != "ACTIVE": return decision("MAIN_NOT_ACTIVE")
    now = at if at is not None else datetime.now(timezone.utc)
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() != timezone.utc.utcoffset(now):
        return decision("TIME_INVALID")
    authority_error = _main_authority_error(main, main_authority, plan, now)
    if authority_error: return decision(authority_error)
    try:
        _verify_plan_hash(plan)
        analysis = _bound_analysis(plan, analysis if analysis is not None else plan.analysis)
        _bound_instruction(plan)
    except (ValueError, TypeError, AttributeError) as error:
        return decision(str(error) if isinstance(error, PlannerError) else "PLAN_INVALID")
    if type(completed_step_ids) not in (frozenset, set, tuple) or any(type(item) is not str for item in completed_step_ids):
        return decision("COMPLETION_STATE_INVALID")
    completed = frozenset(completed_step_ids)
    if not completed.issubset({step.step_id for step in plan.steps}): return decision("COMPLETION_STATE_INVALID")
    if any(step.step_id in completed and not set(step.depends_on).issubset(completed) for step in plan.steps):
        return decision("COMPLETION_STATE_INVALID")
    ready = tuple(step for step in plan.steps if step.step_id not in completed and all(dep in completed for dep in step.depends_on))
    if not ready: return decision("NO_READY_STEPS")
    write_steps = tuple(step.step_id for step in ready if step.write_capable)
    read_steps = tuple(step.step_id for step in ready if not step.write_capable)
    if actual_diff_paths is not None:
        if type(actual_diff_paths) not in (tuple, list): return decision("PATH_INVALID", blocked=write_steps)
        if any(type(path) is not str or "*" in path for path in actual_diff_paths):
            return decision("PATH_INVALID", blocked=write_steps)
        try:
            actual = _paths(actual_diff_paths) if actual_diff_paths else ()
        except PlannerError as error:
            return decision(str(error), blocked=write_steps)
        if any(not _within(path, analysis.allowed_paths) or not _within(path, tuple(
                item for step in plan.steps if step.write_capable and (step in ready or step.step_id in completed)
                for item in step.allowed_paths)) for path in actual):
            return decision("SCOPE_EXPANSION_REQUIRED", read_steps, write_steps,
                ScopeApprovalRequest(plan.content_hash, tuple(actual)))
    if not write_steps: return decision("READ_ONLY_READY", read_steps)
    if approval_type is not ApprovalType.EXECUTION_PLAN:
        return decision("APPROVAL_TYPE_INVALID", read_steps, write_steps)
    if type(approval_guard) is not PlanningApprovalService:
        return decision("PARTIAL_READ_ONLY" if read_steps else "HUMAN_APPROVAL_REQUIRED", read_steps, write_steps)
    bindings = ((plan.design_baseline_id, plan.design_baseline_hash, ApprovalType.DESIGN_SPECIFICATION, "DESIGN_APPROVAL_REQUIRED"),
        (plan.work_plan_id, plan.work_plan_hash, ApprovalType.WORK_PLAN, "WORK_PLAN_APPROVAL_REQUIRED"),
        (plan.source_work_instruction_id, plan.source_work_instruction_hash, ApprovalType.WORK_INSTRUCTION, "WORK_INSTRUCTION_APPROVAL_REQUIRED"),
        (plan.plan_id, plan.content_hash, approval_type, "PLAN_APPROVAL_REQUIRED"))
    for subject, digest, kind, missing in bindings:
        if not subject or not digest: return decision(missing, read_steps, write_steps)
        earliest = (plan.created_at if kind is ApprovalType.EXECUTION_PLAN else
                    plan.source_work_instruction.created_at if kind is ApprovalType.WORK_INSTRUCTION else None)
        latest = plan.created_at if kind is ApprovalType.WORK_INSTRUCTION else None
        guard = approval_guard.exact_execution_guard(subject, digest, kind, now,
            minimum_approved_at=earliest, maximum_approved_at=latest)
        if not guard.allowed:
            code = guard.reason_code if guard.reason_code in {"APPROVAL_NOT_YET_VALID", "APPROVAL_EXPIRED", "APPROVAL_LINEAGE_INVALID"} else missing
            return decision(code, read_steps, write_steps)
    return decision("APPROVED_READY", tuple(step.step_id for step in ready))


__all__ = ["PlannerError", "StepKind", "RequestAnalysis", "ExecutionStep", "ExecutionPlan", "ScheduleDecision", "MainResponsibility", "MainAuthoritySnapshot", "ScopeApprovalRequest", "build_execution_plan", "analyze_request", "generate_work_instruction", "validate_work_instruction", "schedule_ready_steps"]
