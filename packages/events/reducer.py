"""Framework-neutral deterministic Run event reducer."""

from __future__ import annotations

from packages.domain.reducer import reduce_run

from .models import RunProjection, StoredEvent
from .transition_guard import OPERATIONAL_BUDGET_EVENTS, to_domain_event, to_domain_state


class EventHistoryGap(ValueError):
    pass


class EventReducer:
    def reduce(self, projection: RunProjection, event: StoredEvent) -> RunProjection:
        if event.event_type in OPERATIONAL_BUDGET_EVENTS:
            from dataclasses import replace
            return replace(projection, version=event.applied_version)
        if event.event_type == "RUN_BLOCKED":
            return RunProjection(
                run_id=projection.run_id,
                phase=projection.phase,
                status="BLOCKED",
                version=event.applied_version,
                blocked_code=event.blocked_code,
                artifacts=projection.artifacts,
            )
        state = reduce_run(to_domain_state(projection), to_domain_event(event, event.sequence_no))
        return RunProjection(
            run_id=projection.run_id,
            phase=state.phase.value,
            status=state.status.value,
            version=event.applied_version,
            blocked_code=None,
            artifacts=state.artifacts,
        )

    def replay(self, run_id: str, events: tuple[StoredEvent, ...]) -> RunProjection:
        projection = RunProjection.initial(run_id)
        for expected_sequence, event in enumerate(events, 1):
            if event.run_id != run_id:
                raise EventHistoryGap("event history contains a different run")
            if event.sequence_no != expected_sequence:
                raise EventHistoryGap("event history sequence must be contiguous")
            if event.expected_version != projection.version or event.applied_version != projection.version + 1:
                raise EventHistoryGap("event history version must be contiguous")
            projection = self.reduce(projection, event)
        return projection
