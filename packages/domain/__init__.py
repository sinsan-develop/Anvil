"""Framework-independent Anvil domain core."""

from .events import DomainEvent, EventType
from .identifiers import AggregateId, EventId, IdentifierError, RunId
from .reducer import (
    ArtifactMissingError,
    ConditionNotSatisfiedError,
    DomainTransitionError,
    SequenceConflictError,
    TransitionNotAllowedError,
    reduce_run,
)
from .states import BLOCKED_TRANSITIONS, NORMAL_TRANSITIONS, BlockedCode, RunPhase, RunState, RunStatus

__all__ = [
    "AggregateId", "ArtifactMissingError", "BLOCKED_TRANSITIONS", "BlockedCode",
    "ConditionNotSatisfiedError", "DomainEvent", "DomainTransitionError", "EventId",
    "EventType", "IdentifierError", "NORMAL_TRANSITIONS", "RunId", "RunPhase", "RunState",
    "RunStatus", "SequenceConflictError", "TransitionNotAllowedError", "reduce_run",
]
