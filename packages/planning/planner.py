"""Deterministic Main Agent request analysis and execution-plan artifacts.

This module is deliberately pure: it never invokes a model, worker, tool, or
external service.  A plan is an immutable description and the scheduler only
returns a decision; execution is owned by later orchestration packages.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping

from .hashing import canonical_content_hash
from .models import WorkInstruction
from .approval import ApprovalType


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

    def __post_init__(self) -> None:
        _text(self.request_id, "request_id"); _text(self.objective, "objective")
        for value, name in ((self.scope, "scope"), (self.completion_conditions, "completion_conditions"), (self.risk, "risk"), (self.allowed_paths, "allowed_paths"), (self.prohibited_actions, "prohibited_actions")):
            _tuple_text(value, name)
        for value, name in ((self.egress_snapshot_hash, "egress_snapshot_hash"), (self.baseline_hash, "baseline_hash")):
            _text(value, name)
            if not value.startswith("sha256:") or len(value) != 71:
                raise PlannerError(f"{name} must be a sha256 hash")
        if set(self.allowed_paths) & set(self.prohibited_actions):
            raise PlannerError("allowed and prohibited path scopes conflict")

    @property
    def content_hash(self) -> str:
        return canonical_content_hash(self.to_dict())

    def to_dict(self) -> dict[str, Any]:
        return {"request_id": self.request_id, "objective": self.objective, "scope": list(self.scope), "completion_conditions": list(self.completion_conditions), "risk": list(self.risk), "allowed_paths": list(self.allowed_paths), "prohibited_actions": list(self.prohibited_actions), "egress_snapshot_hash": self.egress_snapshot_hash, "baseline_hash": self.baseline_hash, "context": {k: v for k, v in self.context}}


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

    def __post_init__(self) -> None:
        _text(self.step_id, "step_id"); _text(self.objective, "objective")
        if not isinstance(self.kind, StepKind): raise PlannerError("kind must be StepKind")
        for value, name in ((self.depends_on, "depends_on"), (self.allowed_paths, "allowed_paths"), (self.completion_conditions, "completion_conditions"), (self.risk, "risk")):
            if value: _tuple_text(value, name)
        _text(self.egress_snapshot_hash, "egress_snapshot_hash")

    @property
    def write_capable(self) -> bool:
        return self.kind in (StepKind.WRITE, StepKind.EXECUTE)

    def to_dict(self) -> dict[str, Any]:
        return {"step_id": self.step_id, "kind": self.kind.value, "objective": self.objective, "depends_on": list(self.depends_on), "allowed_paths": list(self.allowed_paths), "completion_conditions": list(self.completion_conditions), "risk": list(self.risk), "egress_snapshot_hash": self.egress_snapshot_hash}


@dataclass(frozen=True, slots=True)
class ExecutionPlan:
    plan_id: str
    request_analysis_hash: str
    baseline_hash: str
    permission_snapshot_hash: str
    egress_snapshot_hash: str
    steps: tuple[ExecutionStep, ...]
    created_at: datetime
    content_hash: str = field(init=False)

    def __post_init__(self) -> None:
        _text(self.plan_id, "plan_id")
        for value, name in ((self.request_analysis_hash, "request_analysis_hash"), (self.baseline_hash, "baseline_hash"), (self.permission_snapshot_hash, "permission_snapshot_hash"), (self.egress_snapshot_hash, "egress_snapshot_hash")):
            _text(value, name)
            if not value.startswith("sha256:") or len(value) != 71: raise PlannerError(f"{name} must be a sha256 hash")
        if type(self.steps) is not tuple or not self.steps: raise PlannerError("steps must be non-empty")
        if len({step.step_id for step in self.steps}) != len(self.steps): raise PlannerError("step_id must be unique")
        ids = {step.step_id for step in self.steps}
        if any(dep not in ids or dep == step.step_id for step in self.steps for dep in step.depends_on): raise PlannerError("dependency must reference another step")
        if any(step.egress_snapshot_hash != self.egress_snapshot_hash for step in self.steps): raise PlannerError("step egress snapshot is not bound to plan")
        if any(not step.allowed_paths for step in self.steps): raise PlannerError("every step must bind an allowed path scope")
        self._assert_acyclic()
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
        if include_hash and hasattr(self, "content_hash"): value["content_hash"] = self.content_hash
        return value


@dataclass(frozen=True, slots=True)
class ScheduleDecision:
    allowed: bool
    status: str
    reason: str
    step_ids: tuple[str, ...] = ()


def generate_work_instruction(plan: ExecutionPlan, step_id: str, *, artifact_id: str | None = None, revision: int = 1) -> WorkInstruction:
    step = next((item for item in plan.steps if item.step_id == step_id), None)
    if step is None: raise PlannerError("unknown step")
    return WorkInstruction(artifact_id or f"wi-{plan.plan_id}-{step_id}", revision, canonical_content_hash({"plan": plan.content_hash, "step": step.to_dict()}), plan.plan_id, plan.content_hash, step.allowed_paths or (".",), (step.kind.value.lower(),), step.completion_conditions or ("step result recorded",), plan.created_at)


def analyze_request(request_id: str, objective: str, *, scope: tuple[str, ...], completion_conditions: tuple[str, ...], allowed_paths: tuple[str, ...], prohibited_actions: tuple[str, ...], risk: tuple[str, ...], baseline_hash: str, egress_snapshot_hash: str) -> RequestAnalysis:
    return RequestAnalysis(request_id, objective, scope, completion_conditions, risk, allowed_paths, prohibited_actions, egress_snapshot_hash, baseline_hash)


def schedule_ready_steps(plan: ExecutionPlan, *, approval_guard: Any | None = None, at: datetime | None = None, approval_type: ApprovalType = ApprovalType.APPLY) -> ScheduleDecision:
    now = at or datetime.now(timezone.utc)
    write_steps = tuple(step for step in plan.steps if step.write_capable)
    if not write_steps: return ScheduleDecision(True, "ALLOWED", "read-only plan may be scheduled without approval", tuple(step.step_id for step in plan.steps))
    if approval_guard is None: return ScheduleDecision(False, "DENIED", "explicit approval binding is required before write scheduling")
    guard = approval_guard.execution_guard(plan.plan_id, plan.content_hash, approval_type, now)
    if not guard.allowed: return ScheduleDecision(False, guard.status, guard.reason)
    return ScheduleDecision(True, "ALLOWED", "active approval matches canonical execution plan", tuple(step.step_id for step in plan.steps))


__all__ = ["PlannerError", "StepKind", "RequestAnalysis", "ExecutionStep", "ExecutionPlan", "ScheduleDecision", "analyze_request", "generate_work_instruction", "schedule_ready_steps"]
