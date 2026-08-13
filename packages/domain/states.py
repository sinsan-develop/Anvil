"""Closed state vocabulary and section 27 transition catalogs."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .events import EventType
from .identifiers import RunId


class RunPhase(str, Enum):
    DRAFT = "DRAFT"
    ANALYZING = "ANALYZING"
    EXECUTION_PLAN_REVIEW = "EXECUTION_PLAN_REVIEW"
    APPROVAL_PENDING = "APPROVAL_PENDING"
    WORKSPACE_PREPARING = "WORKSPACE_PREPARING"
    IMPLEMENTING = "IMPLEMENTING"
    VERIFYING = "VERIFYING"
    RESULT_REVIEW = "RESULT_REVIEW"
    USER_VALIDATION = "USER_VALIDATION"
    APPLY_PENDING = "APPLY_PENDING"
    APPLIED = "APPLIED"
    COMPLETED = "COMPLETED"


class RunStatus(str, Enum):
    ACTIVE = "ACTIVE"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    PAUSED_QUOTA = "PAUSED_QUOTA"
    SUCCEEDED = "SUCCEEDED"
    FINISHED_WITH_FAILURES = "FINISHED_WITH_FAILURES"
    FAILED = "FAILED"


class BlockedCode(str, Enum):
    BASELINE_CONFLICT = "BASELINE_CONFLICT"
    SCOPE_EXPANSION_REQUIRED = "SCOPE_EXPANSION_REQUIRED"
    PROTECTED_PATH_DENIED = "PROTECTED_PATH_DENIED"
    TOOLCHAIN_UNAVAILABLE = "TOOLCHAIN_UNAVAILABLE"
    VERIFICATION_ENV_UNAVAILABLE = "VERIFICATION_ENV_UNAVAILABLE"
    LLM_PROVIDER_UNAVAILABLE = "LLM_PROVIDER_UNAVAILABLE"
    BUDGET_OR_QUOTA_EXCEEDED = "BUDGET_OR_QUOTA_EXCEEDED"
    APPROVAL_EXPIRED = "APPROVAL_EXPIRED"
    WORKER_INTERRUPTED = "WORKER_INTERRUPTED"


@dataclass(frozen=True, slots=True)
class TransitionSpec:
    source: RunPhase
    event: EventType
    target: RunPhase
    required_artifact: str
    required_conditions: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class BlockedTransition:
    condition: str
    code: BlockedCode
    handling: str


NORMAL_TRANSITIONS = (
    TransitionSpec(RunPhase.DRAFT, EventType.TASK_CONFIRMED, RunPhase.ANALYZING, "Task snapshot", ("questions_resolved", "scope_confirmed", "design_hash_approved", "work_plan_hash_approved")),
    TransitionSpec(RunPhase.ANALYZING, EventType.ANALYSIS_COMPLETED, RunPhase.EXECUTION_PLAN_REVIEW, "Impact Map", ("baseline_analysis_succeeded", "impact_analysis_succeeded")),
    TransitionSpec(RunPhase.EXECUTION_PLAN_REVIEW, EventType.EXECUTION_PLAN_PROPOSED, RunPhase.APPROVAL_PENDING, "ExecutionPlan artifact", ("work_plan_schema_matches",)),
    TransitionSpec(RunPhase.APPROVAL_PENDING, EventType.EXECUTION_PLAN_APPROVED, RunPhase.WORKSPACE_PREPARING, "Approval", ("execution_plan_hash_matches", "execution_mode_hash_matches", "approval_unexpired")),
    TransitionSpec(RunPhase.WORKSPACE_PREPARING, EventType.WORKSPACE_READY, RunPhase.IMPLEMENTING, "Workspace manifest", ("workspace_isolated", "baseline_confirmed")),
    TransitionSpec(RunPhase.IMPLEMENTING, EventType.IMPLEMENTATION_COMPLETED, RunPhase.VERIFYING, "Patch/Diff", ("scope_drift_absent",)),
    TransitionSpec(RunPhase.VERIFYING, EventType.REQUIRED_GATES_PASSED, RunPhase.RESULT_REVIEW, "Gate report", ("required_gates_all_passed",)),
    TransitionSpec(RunPhase.RESULT_REVIEW, EventType.REVIEW_APPROVED, RunPhase.USER_VALIDATION, "Review report", ("major_findings_absent",)),
    TransitionSpec(RunPhase.USER_VALIDATION, EventType.RELEASE_DECIDED, RunPhase.APPLY_PENDING, "ProductValidation·DefectAssessment·ReleaseDecision", ("product_validation_complete", "authenticated_human_release")),
    TransitionSpec(RunPhase.APPLY_PENDING, EventType.APPLY_APPROVED, RunPhase.APPLIED, "Apply result", ("diff_hash_matches", "release_decision_hash_matches", "apply_approval_subject_hash_matches")),
    TransitionSpec(RunPhase.APPLIED, EventType.POST_APPLY_VERIFIED, RunPhase.COMPLETED, "Final report", ("post_apply_smoke_passed",)),
)


BLOCKED_TRANSITIONS = (
    BlockedTransition("dirty repository conflicts with work", BlockedCode.BASELINE_CONFLICT, "preserve source and request user choice"),
    BlockedTransition("file outside approved scope required", BlockedCode.SCOPE_EXPANSION_REQUIRED, "new plan and scope approval"),
    BlockedTransition("protected path access", BlockedCode.PROTECTED_PATH_DENIED, "block action and review plan"),
    BlockedTransition("required tool unavailable", BlockedCode.TOOLCHAIN_UNAVAILABLE, "approve install plan or environment change"),
    BlockedTransition("test database or service unavailable", BlockedCode.VERIFICATION_ENV_UNAVAILABLE, "block gate and forbid completion"),
    BlockedTransition("provider request failed", BlockedCode.LLM_PROVIDER_UNAVAILABLE, "policy fallback or stop"),
    BlockedTransition("hard budget or provider quota exceeded", BlockedCode.BUDGET_OR_QUOTA_EXCEEDED, "checkpoint and pause quota"),
    BlockedTransition("approval expired", BlockedCode.APPROVAL_EXPIRED, "request same-hash approval"),
    BlockedTransition("worker heartbeat expired", BlockedCode.WORKER_INTERRUPTED, "forbid resume before lease recovery"),
)


@dataclass(frozen=True, slots=True)
class RunState:
    run_id: RunId
    phase: RunPhase
    status: RunStatus
    sequence: int
    artifacts: tuple[str, ...]

    @classmethod
    def initial(cls, run_id: RunId) -> "RunState":
        return cls(run_id, RunPhase.DRAFT, RunStatus.ACTIVE, 0, ())
