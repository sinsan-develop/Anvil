"""Pure, fail-closed reducer for the section 27.1 Run state machine."""

from __future__ import annotations

from .events import DomainEvent, EventType
from .states import NORMAL_TRANSITIONS, RunPhase, RunState, RunStatus, TransitionSpec


class DomainTransitionError(ValueError):
    pass


class SequenceConflictError(DomainTransitionError):
    pass


class TransitionNotAllowedError(DomainTransitionError):
    pass


class ConditionNotSatisfiedError(DomainTransitionError):
    pass


class ArtifactMissingError(DomainTransitionError):
    pass


_TRANSITIONS: dict[tuple[RunPhase, EventType], TransitionSpec] = {
    (spec.source, spec.event): spec for spec in NORMAL_TRANSITIONS
}


def _release_conditions(payload: object) -> bool:
    if not hasattr(payload, "get"):
        return False
    get = payload.get  # type: ignore[union-attr]
    target = get("target_hash")
    return (
        get("product_validation_complete") is True
        and get("blocking_defect_count") == 0
        and get("authenticated_human_release") is True
        and get("decision") == "RELEASE"
        and isinstance(target, str) and bool(target)
        and get("validation_target_hash") == target
    )


def reduce_run(state: RunState, event: DomainEvent) -> RunState:
    """Return the next immutable state or reject without mutating input."""
    if event.aggregate_id != state.run_id:
        raise TransitionNotAllowedError("event aggregate does not match run")
    if event.sequence != state.sequence + 1:
        raise SequenceConflictError("event sequence must be exactly current + 1")
    spec = _TRANSITIONS.get((state.phase, event.type))
    if spec is None:
        raise TransitionNotAllowedError(f"undefined transition: {state.phase.value}/{event.type.value}")
    if event.payload.get("conditions_satisfied") is not True or any(
        event.payload.get(condition) is not True for condition in spec.required_conditions
    ):
        raise ConditionNotSatisfiedError("transition conditions are not satisfied")
    if event.payload.get("artifact_type") != spec.required_artifact:
        raise ArtifactMissingError(f"required artifact: {spec.required_artifact}")
    if event.type is EventType.RELEASE_DECIDED and not _release_conditions(event.payload):
        raise ConditionNotSatisfiedError("release decision guard failed")
    status = RunStatus.ACTIVE
    if spec.target is RunPhase.APPROVAL_PENDING:
        status = RunStatus.WAITING_APPROVAL
    elif spec.target is RunPhase.COMPLETED:
        status = RunStatus.SUCCEEDED
    return RunState(
        run_id=state.run_id,
        phase=spec.target,
        status=status,
        sequence=event.sequence,
        artifacts=state.artifacts + (spec.required_artifact,),
    )
