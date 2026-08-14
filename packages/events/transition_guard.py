"""Fail-closed transition, navigation, and optimistic-version guards."""

from __future__ import annotations

from packages.domain.events import DomainEvent, EventType
from packages.domain.identifiers import EventId, RunId
from packages.domain.reducer import DomainTransitionError, reduce_run
from packages.domain.states import BlockedCode, RunPhase, RunState, RunStatus

from .models import EventCommand, RunProjection, StoredEvent


class EventGuardError(ValueError):
    pass


class OptimisticVersionConflict(EventGuardError):
    pass


class InvalidTransition(EventGuardError):
    pass


class InvalidBlockedCode(EventGuardError):
    pass


class ReadOnlyIntentRejected(EventGuardError):
    pass


READ_ONLY_INTENTS = frozenset(("NAVIGATE", "VIEW", "OPEN", "SELECT"))


def to_domain_state(projection: RunProjection) -> RunState:
    try:
        phase = RunPhase(projection.phase)
        status = RunStatus(projection.status)
    except ValueError as error:
        raise InvalidTransition("projection contains non-canonical phase or status") from error
    return RunState(RunId(projection.run_id), phase, status, projection.version, projection.artifacts)


def to_domain_event(event: EventCommand | StoredEvent, sequence: int) -> DomainEvent:
    try:
        event_type = EventType(event.event_type)
    except ValueError as error:
        raise InvalidTransition(f"unknown mutation event: {event.event_type}") from error
    return DomainEvent(
        event_id=EventId(event.event_id),
        aggregate_id=RunId(event.run_id),
        sequence=sequence,
        type=event_type,
        occurred_at=event.created_at,
        actor=event.actor_id,
        payload=event.payload,
    )


class TransitionGuard:
    def validate(self, projection: RunProjection, command: EventCommand) -> None:
        if command.event_type in READ_ONLY_INTENTS:
            raise ReadOnlyIntentRejected(f"read-only intent cannot mutate state: {command.event_type}")
        if command.expected_version != projection.version:
            raise OptimisticVersionConflict(
                f"expected version {command.expected_version}, current version {projection.version}"
            )
        if command.event_type == "RUN_BLOCKED":
            self.blocked_code(command.blocked_code)
            return
        event = to_domain_event(command, projection.version + 1)
        try:
            reduce_run(to_domain_state(projection), event)
        except DomainTransitionError as error:
            raise InvalidTransition(str(error)) from error

    @staticmethod
    def blocked_code(value: BlockedCode | str | None) -> BlockedCode:
        try:
            return value if isinstance(value, BlockedCode) else BlockedCode(value)
        except (TypeError, ValueError) as error:
            raise InvalidBlockedCode("blocked_code must be one of the canonical nine values") from error
