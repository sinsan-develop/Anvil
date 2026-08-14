"""Immutable execution and human-release governance aggregates."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: str, field: str) -> None:
    if not isinstance(value, str) or not _HASH.fullmatch(value):
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _positive(value: int, field: str) -> None:
    if type(value) is not int or value < 1:
        raise ValueError(f"{field} must be a positive integer")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


class TaskStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


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
    QUEUED = "QUEUED"
    ACTIVE = "ACTIVE"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    BLOCKED = "BLOCKED"
    INTERRUPTED = "INTERRUPTED"
    PAUSED_USER = "PAUSED_USER"
    PAUSE_REQUESTED = "PAUSE_REQUESTED"
    PAUSED_QUOTA = "PAUSED_QUOTA"
    WAITING_DECISION = "WAITING_DECISION"
    AWAITING_EXCEPTION_REVIEW = "AWAITING_EXCEPTION_REVIEW"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
    SUCCEEDED = "SUCCEEDED"
    FINISHED_WITH_FAILURES = "FINISHED_WITH_FAILURES"
    REJECTED = "REJECTED"
    DISCARDED = "DISCARDED"


class ExecutorKind(str, Enum):
    SUBAGENT = "SUBAGENT"
    MAIN_TAKEOVER = "MAIN_TAKEOVER"


class DelegationStatus(str, Enum):
    PLANNED = "PLANNED"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    REPORTING = "REPORTING"
    COMPLETED = "COMPLETED"
    FAILURE_REPORT = "FAILURE_REPORT"
    INCOMPLETE = "INCOMPLETE"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"
    FAILED_TO_START = "FAILED_TO_START"


class ResultStatus(str, Enum):
    COMPLETED = "COMPLETED"
    FAILURE_REPORT = "FAILURE_REPORT"
    INCOMPLETE = "INCOMPLETE"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class ValidationVerdict(str, Enum):
    SUITABLE = "SUITABLE"
    NEEDS_IMPROVEMENT = "NEEDS_IMPROVEMENT"
    UNSUITABLE = "UNSUITABLE"
    BLOCKED = "BLOCKED"


class DefectSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"


class DefectStatus(str, Enum):
    OPEN = "OPEN"
    ACCEPTED = "ACCEPTED"
    FIXING = "FIXING"
    READY_FOR_RETEST = "READY_FOR_RETEST"
    CLOSED = "CLOSED"
    DEFERRED = "DEFERRED"
    REJECTED = "REJECTED"


class ReleaseDecisionKind(str, Enum):
    RELEASE = "RELEASE"
    REWORK = "REWORK"
    DEFER = "DEFER"
    REJECT = "REJECT"


class DIRStatus(str, Enum):
    DIR_HOLD = "DIR_HOLD"
    REPORTING = "REPORTING"
    WAITING_OWNER_DIRECTION = "WAITING_OWNER_DIRECTION"
    CLEARED = "CLEARED"


@dataclass(frozen=True, slots=True)
class Task:
    task_id: str
    project_id: str
    repository_id: str
    title: str
    objective: str
    requested_by: str
    status: TaskStatus

    def __post_init__(self) -> None:
        for value, field in ((self.task_id, "task_id"), (self.project_id, "project_id"), (self.repository_id, "repository_id"), (self.title, "title"), (self.objective, "objective"), (self.requested_by, "requested_by")):
            _required(value, field)
        if not isinstance(self.status, TaskStatus):
            raise TypeError("status must be TaskStatus")


@dataclass(frozen=True, slots=True)
class Run:
    run_id: str
    task_id: str
    baseline_id: str
    phase: RunPhase
    status: RunStatus

    def __post_init__(self) -> None:
        for value, field in ((self.run_id, "run_id"), (self.task_id, "task_id"), (self.baseline_id, "baseline_id")):
            _required(value, field)
        if not isinstance(self.phase, RunPhase):
            raise TypeError("phase must be RunPhase")
        if not isinstance(self.status, RunStatus):
            raise TypeError("status must be RunStatus")


@dataclass(frozen=True, slots=True)
class PlanStep:
    step_id: str
    run_id: str
    step_lineage_id: str
    sequence: int

    def __post_init__(self) -> None:
        for value, field in ((self.step_id, "step_id"), (self.run_id, "run_id"), (self.step_lineage_id, "step_lineage_id")):
            _required(value, field)
        _positive(self.sequence, "sequence")


@dataclass(frozen=True, slots=True)
class StepAttempt:
    attempt_id: str
    step_id: str
    attempt_number: int
    executor_kind: ExecutorKind
    target_hash: str
    started_at: datetime

    def __post_init__(self) -> None:
        _required(self.attempt_id, "attempt_id")
        _required(self.step_id, "step_id")
        _positive(self.attempt_number, "attempt_number")
        if not isinstance(self.executor_kind, ExecutorKind):
            raise TypeError("executor_kind must be ExecutorKind")
        _hash(self.target_hash, "target_hash")
        _utc(self.started_at, "started_at")


@dataclass(frozen=True, slots=True)
class Delegation:
    delegation_id: str
    attempt_id: str
    agent_id: str
    status: DelegationStatus

    def __post_init__(self) -> None:
        for value, field in ((self.delegation_id, "delegation_id"), (self.attempt_id, "attempt_id"), (self.agent_id, "agent_id")):
            _required(value, field)
        if not isinstance(self.status, DelegationStatus):
            raise TypeError("status must be DelegationStatus")


@dataclass(frozen=True, slots=True)
class Result:
    result_id: str
    attempt_id: str
    status: ResultStatus
    target_hash: str
    delivered_hash: str
    actor_id: str
    event_sequence: int

    def __post_init__(self) -> None:
        for value, field in ((self.result_id, "result_id"), (self.attempt_id, "attempt_id"), (self.actor_id, "actor_id")):
            _required(value, field)
        if not isinstance(self.status, ResultStatus):
            raise TypeError("status must be ResultStatus")
        _hash(self.target_hash, "target_hash")
        _hash(self.delivered_hash, "delivered_hash")
        _positive(self.event_sequence, "event_sequence")


@dataclass(frozen=True, slots=True)
class ProductValidation:
    validation_id: str
    criterion_id: str
    target_hash: str
    delivered_hash: str
    verdict: ValidationVerdict
    validated_by: str
    validated_at: datetime

    def __post_init__(self) -> None:
        for value, field in ((self.validation_id, "validation_id"), (self.criterion_id, "criterion_id"), (self.validated_by, "validated_by")):
            _required(value, field)
        _hash(self.target_hash, "target_hash")
        _hash(self.delivered_hash, "delivered_hash")
        if not isinstance(self.verdict, ValidationVerdict):
            raise TypeError("verdict must be ValidationVerdict")
        _utc(self.validated_at, "validated_at")


@dataclass(frozen=True, slots=True)
class Defect:
    defect_id: str
    target_hash: str
    severity: DefectSeverity
    blocking: bool
    status: DefectStatus
    owner_id: str

    def __post_init__(self) -> None:
        _required(self.defect_id, "defect_id")
        _required(self.owner_id, "owner_id")
        _hash(self.target_hash, "target_hash")
        if not isinstance(self.severity, DefectSeverity):
            raise TypeError("severity must be DefectSeverity")
        if type(self.blocking) is not bool:
            raise TypeError("blocking must be bool")
        if not isinstance(self.status, DefectStatus):
            raise TypeError("status must be DefectStatus")


@dataclass(frozen=True, slots=True)
class ReleaseDecision:
    decision_id: str
    target_hash: str
    decision: ReleaseDecisionKind
    decided_by: str
    authenticated_human: bool
    decided_at: datetime

    def __post_init__(self) -> None:
        _required(self.decision_id, "decision_id")
        _required(self.decided_by, "decided_by")
        _hash(self.target_hash, "target_hash")
        if not isinstance(self.decision, ReleaseDecisionKind):
            raise TypeError("decision must be ReleaseDecisionKind")
        if type(self.authenticated_human) is not bool:
            raise TypeError("authenticated_human must be bool")
        if not self.authenticated_human:
            raise ValueError("authenticated human actor is required for ReleaseDecision")
        _utc(self.decided_at, "decided_at")


@dataclass(frozen=True, slots=True)
class DesignIntentReview:
    review_id: str
    dir_type: str
    status: DIRStatus
    subject_hash: str
    owner_direction_event_id: str | None = None
    causation_event_id: str | None = None

    def __post_init__(self) -> None:
        _required(self.review_id, "review_id")
        _required(self.dir_type, "dir_type")
        _hash(self.subject_hash, "subject_hash")
        if not isinstance(self.status, DIRStatus):
            raise TypeError("status must be DIRStatus")
        if self.owner_direction_event_id is not None:
            _required(self.owner_direction_event_id, "owner_direction_event_id")
        if self.causation_event_id is not None:
            _required(self.causation_event_id, "causation_event_id")
        if self.status is DIRStatus.CLEARED and self.owner_direction_event_id is None:
            raise ValueError("CLEARED review requires owner direction event")
