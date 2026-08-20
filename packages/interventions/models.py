"""Immutable human-intervention and Run-control values."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from types import MappingProxyType
from typing import Mapping


class InterventionKind(str, Enum):
    QUERY_PROGRESS = "QUERY_PROGRESS"
    CONTEXT_SUPPLEMENT = "CONTEXT_SUPPLEMENT"
    PRIORITY_CHANGE = "PRIORITY_CHANGE"
    PLAN_CHANGE = "PLAN_CHANGE"
    STOP = "STOP"
    CANCEL = "CANCEL"
    TAKEOVER = "TAKEOVER"


class InterventionState(str, Enum):
    ACTIVE = "ACTIVE"
    WAITING_DECISION = "WAITING_DECISION"
    PAUSE_REQUESTED = "PAUSE_REQUESTED"
    PAUSED_USER = "PAUSED_USER"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"


class RunControlStatus(str, Enum):
    ACTIVE = "ACTIVE"
    WAITING_DECISION = "WAITING_DECISION"
    PAUSE_REQUESTED = "PAUSE_REQUESTED"
    PAUSED_USER = "PAUSED_USER"
    PAUSED_QUOTA = "PAUSED_QUOTA"
    INTERRUPTED = "INTERRUPTED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    CANCELLED = "CANCELLED"
    SUCCEEDED = "SUCCEEDED"
    FINISHED_WITH_FAILURES = "FINISHED_WITH_FAILURES"
    FAILED = "FAILED"
    REJECTED = "REJECTED"
    DISCARDED = "DISCARDED"


TERMINAL_RUN_STATUSES = frozenset(
    {
        RunControlStatus.CANCELLED,
        RunControlStatus.SUCCEEDED,
        RunControlStatus.FINISHED_WITH_FAILURES,
        RunControlStatus.FAILED,
        RunControlStatus.REJECTED,
        RunControlStatus.DISCARDED,
    }
)
RESUMABLE_RUN_STATUSES = frozenset(
    {RunControlStatus.PAUSED_USER, RunControlStatus.PAUSED_QUOTA, RunControlStatus.INTERRUPTED}
)


class CancelStep(str, Enum):
    EVENT_RECORDED = "EVENT_RECORDED"
    NEW_ACTIONS_STOPPED = "NEW_ACTIONS_STOPPED"
    GRACEFUL_SIGNAL_SENT = "GRACEFUL_SIGNAL_SENT"
    FORCE_POLICY_CHECKED = "FORCE_POLICY_CHECKED"
    ARTIFACTS_COLLECTED = "ARTIFACTS_COLLECTED"
    WORKSPACE_RETAINED_24H = "WORKSPACE_RETAINED_24H"
    CANCELLED = "CANCELLED"


CANCEL_SEQUENCE = tuple(CancelStep)


def _aware(value: datetime, field_name: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def _text(value: str, field_name: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field_name} must be a canonical non-empty string")


@dataclass(frozen=True, slots=True)
class HumanInterventionReceipt:
    receipt_id: str
    run_id: str
    kind: InterventionKind
    requested_at: datetime
    acknowledged_at: datetime | None = None
    new_action_blocked_at: datetime | None = None
    effective_at: datetime | None = None
    target_action_status: str | None = None
    irreversible_receipt_ref: str | None = None

    def __post_init__(self) -> None:
        _text(self.receipt_id, "receipt_id")
        _text(self.run_id, "run_id")
        if not isinstance(self.kind, InterventionKind):
            raise TypeError("kind must be InterventionKind")
        _aware(self.requested_at, "requested_at")
        previous = self.requested_at
        for value, field_name in (
            (self.acknowledged_at, "acknowledged_at"),
            (self.new_action_blocked_at, "new_action_blocked_at"),
            (self.effective_at, "effective_at"),
        ):
            if value is not None:
                _aware(value, field_name)
                if value < previous:
                    raise ValueError("intervention receipt timestamps must be monotonic")
                previous = value
        if self.effective_at is not None and (
            self.effective_at <= self.requested_at
            or self.new_action_blocked_at is None
            or self.effective_at <= self.new_action_blocked_at
        ):
            raise ValueError("effective_at must be later than request receipt and action blocking")
        for value, field_name in (
            (self.target_action_status, "target_action_status"),
            (self.irreversible_receipt_ref, "irreversible_receipt_ref"),
        ):
            if value is not None:
                _text(value, field_name)


@dataclass(frozen=True, slots=True)
class PrioritizedEvent:
    event_type: str
    run_id: str
    requested_at: datetime
    priority: int
    kind: InterventionKind | None = None
    receipt_id: str | None = None


@dataclass(frozen=True, slots=True)
class RunControlRecord:
    run_id: str
    status: RunControlStatus
    bindings: Mapping[str, str]
    prior_run_id: str | None = None
    checkpoint_refs: tuple[str, ...] = ()
    artifact_refs: tuple[str, ...] = ()
    cancel_steps: tuple[CancelStep, ...] = ()
    cancel_timestamps: tuple[datetime, ...] = ()

    def __post_init__(self) -> None:
        _text(self.run_id, "run_id")
        if not isinstance(self.status, RunControlStatus):
            raise TypeError("status must be RunControlStatus")
        if not self.bindings:
            raise ValueError("binding hashes are required")
        frozen: dict[str, str] = {}
        for key, value in self.bindings.items():
            _text(key, "binding name")
            _text(value, "binding hash")
            frozen[key] = value
        object.__setattr__(self, "bindings", MappingProxyType(frozen))
        object.__setattr__(self, "checkpoint_refs", tuple(self.checkpoint_refs))
        object.__setattr__(self, "artifact_refs", tuple(self.artifact_refs))
        object.__setattr__(self, "cancel_steps", tuple(self.cancel_steps))
        object.__setattr__(self, "cancel_timestamps", tuple(self.cancel_timestamps))
