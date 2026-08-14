"""Framework-neutral execution and release input/error contracts."""

from dataclasses import dataclass
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: str, field: str) -> None:
    if not isinstance(value, str) or not _HASH.fullmatch(value):
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


class ExecutionErrorCode(str, Enum):
    ACTIVE_ATTEMPT_EXISTS = "ACTIVE_ATTEMPT_EXISTS"
    DELEGATION_REQUIRED = "DELEGATION_REQUIRED"
    DELEGATION_FORBIDDEN = "DELEGATION_FORBIDDEN"
    TAKEOVER_REFERENCE_REQUIRED = "TAKEOVER_REFERENCE_REQUIRED"
    TERMINAL_RESULT_EXISTS = "TERMINAL_RESULT_EXISTS"
    TARGET_HASH_MISMATCH = "TARGET_HASH_MISMATCH"
    HUMAN_RELEASE_DECISION_REQUIRED = "HUMAN_RELEASE_DECISION_REQUIRED"
    PRODUCT_VALIDATION_INCOMPLETE = "PRODUCT_VALIDATION_INCOMPLETE"
    BLOCKING_DEFECT_OPEN = "BLOCKING_DEFECT_OPEN"
    OWNER_DIRECTION_REQUIRED = "OWNER_DIRECTION_REQUIRED"
    DIR_TRANSITION_DENIED = "DIR_TRANSITION_DENIED"


@dataclass(frozen=True, slots=True)
class RecordResultRequest:
    attempt_id: str
    target_hash: str
    delivered_hash: str
    actor_id: str
    event_sequence: int

    def __post_init__(self) -> None:
        _required(self.attempt_id, "attempt_id")
        _required(self.actor_id, "actor_id")
        _hash(self.target_hash, "target_hash")
        _hash(self.delivered_hash, "delivered_hash")
        if type(self.event_sequence) is not int or self.event_sequence < 1:
            raise ValueError("event_sequence must be a positive integer")


@dataclass(frozen=True, slots=True)
class ReleaseGuardRequest:
    target_hash: str
    decision: str
    actor_id: str
    authenticated_human: bool

    def __post_init__(self) -> None:
        _hash(self.target_hash, "target_hash")
        _required(self.actor_id, "actor_id")
        if self.decision not in {"RELEASE", "REWORK", "DEFER", "REJECT"}:
            raise ValueError("decision is unsupported")
        if type(self.authenticated_human) is not bool:
            raise TypeError("authenticated_human must be bool")


@dataclass(frozen=True, slots=True)
class DIRTransitionRequest:
    review_id: str
    current_status: str
    target_status: str
    owner_direction_event_id: str | None = None

    def __post_init__(self) -> None:
        _required(self.review_id, "review_id")
        allowed = {"DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"}
        if self.current_status not in allowed or self.target_status not in allowed:
            raise ValueError("DIR status is not canonical")
