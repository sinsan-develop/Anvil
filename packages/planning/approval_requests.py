"""Task별 내부 Main의 요청 생성. 사람 승인과 실행 권위는 제공하지 않는다."""
from dataclasses import dataclass, field, fields
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

from .models import WorkPlan, IterationPlan, WorkInstruction
from .planner import ExecutionPlan, ExecutionStep, RequestAnalysis, StepKind

ACTOR = "anvil-internal-planning-main"
ROLE = "INTERNAL_MAIN"
PERMISSION = "approval-requests:create"


class ApprovalRequestRejected(ValueError):
    """원문 입력·SQL·capability를 포함하지 않는 안정 오류."""


def deny(code="REQUEST_INVALID"):
    raise ApprovalRequestRejected(code)


def identity(value):
    if type(value) is not str or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", value):
        deny()
    return value


def digest(value):
    return "sha256:" + hashlib.sha256(json.dumps(value, sort_keys=True,
        separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()


def checked_hash(value):
    if type(value) is not str or not re.fullmatch(r"sha256:[0-9a-f]{64}", value):
        deny()
    return value


def utc(value):
    if type(value) is not datetime or type(value.tzinfo) is not timezone or value.utcoffset() != timedelta(0):
        deny()
    return datetime(value.year, value.month, value.day, value.hour, value.minute,
                    value.second, value.microsecond, tzinfo=timezone.utc)


@dataclass(frozen=True, slots=True)
class ExecutionModeSnapshot:
    snapshot_id: str
    control_mode: str
    strategy: str = "single_worker"
    failure_policy: str = "stop"
    max_parallel_agents: int = 1
    approval_points: tuple[str, ...] = ("before_execute", "before_apply")
    stop_on: tuple[str, ...] = ("scope_change", "protected_path_write", "secret_exposure",
        "destructive_side_effect_unknown", "budget_hard_limit")

    def __post_init__(self):
        identity(self.snapshot_id)
        for value, allowed in ((self.control_mode, ("controlled", "standard")),
                (self.strategy, ("single_worker", "delegated", "parallel_batch")),
                (self.failure_policy, ("stop", "continue_independent", "collect_and_review"))):
            if type(value) is not str or value not in allowed: deny()
        if type(self.max_parallel_agents) is not int or not 1 <= self.max_parallel_agents <= 100: deny()
        if self.strategy == "single_worker" and self.max_parallel_agents != 1: deny()
        if (type(self.approval_points) is not tuple or self.approval_points != ("before_execute", "before_apply")
                or type(self.stop_on) is not tuple or self.stop_on != ("scope_change", "protected_path_write",
                    "secret_exposure", "destructive_side_effect_unknown", "budget_hard_limit")): deny()

    def payload(self):
        return {f.name: getattr(self, f.name) for f in fields(self)}

    @property
    def content_hash(self):
        return digest(self.payload())


@dataclass(frozen=True, slots=True)
class FinalizeExecutionPlan:
    task_id: str
    project_id: str
    environment_id: str
    plan: ExecutionPlan
    mode: ExecutionModeSnapshot
    idempotency_key: str
    run_id: str | None = None
    worker_id: str | None = None
    execution_fence: str | None = field(default=None, repr=False)


@dataclass(frozen=True, slots=True)
class TaskPlanningAuthority:
    authority_id: str
    capability: str = field(repr=False)
    epoch: int
    actor_id: str = ACTOR
    role: str = ROLE
    permission: str = PERMISSION


@dataclass(frozen=True, slots=True)
class ApprovalRequestReceipt:
    request_id: str
    task_id: str
    plan_id: str
    plan_hash: str
    run_id: str | None
    requested_at: datetime
    expires_at: datetime
    status: str = "PENDING"


_TYPES = (ExecutionPlan, ExecutionStep, RequestAnalysis, WorkPlan, IterationPlan, WorkInstruction,
          ExecutionModeSnapshot, FinalizeExecutionPlan, TaskPlanningAuthority, ApprovalRequestReceipt)


def detached(value, depth=0):
    """사용자 hook/deepcopy/property 실행 전에 builtin/정확 DTO 트리만 수용."""
    if depth > 16: deny()
    t = type(value)
    if value is None or t in (bool, int): return value
    if t is str:
        if len(value.encode("utf-8")) > 4096: deny()
        return value
    if t is datetime: return utc(value)
    if t is StepKind: return value
    if t in (tuple, frozenset):
        if len(value) > 100: deny()
        return t(detached(v, depth + 1) for v in value)
    if t not in _TYPES: deny()
    data = {f.name: detached(object.__getattribute__(value, f.name), depth + 1) for f in fields(t)}
    result = t(**{f.name: data[f.name] for f in fields(t) if f.init})
    for f in fields(t):
        if not f.init and getattr(result, f.name) != data[f.name]: deny("PLAN_HASH_MISMATCH")
    return result


def capture(command):
    if type(command) is not FinalizeExecutionPlan: deny()
    try:
        c = detached(command)
        for v in (c.task_id, c.project_id, c.environment_id, c.idempotency_key): identity(v)
        if type(c.plan) is not ExecutionPlan or type(c.mode) is not ExecutionModeSnapshot: deny()
        p = c.plan
        if any(v is None for v in (p.analysis, p.source_work_plan, p.source_iteration_plan, p.source_work_instruction)): deny()
        identity(p.plan_id)
        if c.run_id is not None:
            for v in (c.run_id, c.worker_id, c.execution_fence): identity(v)
        elif c.worker_id is not None or c.execution_fence is not None: deny()
        return c
    except ApprovalRequestRejected: raise
    except Exception: deny()


def binding(c):
    p = c.plan
    return dict(task_id=c.task_id, project_id=c.project_id, environment_id=c.environment_id,
        plan_id=p.plan_id, plan_hash=p.content_hash, wi_id=p.source_work_instruction_id,
        wi_hash=p.source_work_instruction_hash, mode_id=c.mode.snapshot_id, mode_hash=c.mode.content_hash)


class ApprovalRequestService:
    """생성 port만 소유. 권위 발급/갱신/회수 port는 보유하지 않는다."""
    def __init__(self, repository):
        from packages.persistence.approval_request_repository import ApprovalRequestRepository
        if type(repository) is not ApprovalRequestRepository: deny()
        self.__repository = repository

    def finalize_execution_plan(self, command, trusted_authority):
        return self.__repository.create_execution_plan_request(capture(command), trusted_authority)
