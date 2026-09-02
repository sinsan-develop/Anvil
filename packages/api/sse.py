"""Stored-event SSE replay with strict Last-Event-ID semantics."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Iterable, Mapping, Protocol

from sqlalchemy import text

from .common import ApiContractError


@dataclass(frozen=True, slots=True)
class StreamEvent:
    event_id: str
    run_id: str
    sequence_no: int
    event_type: str
    payload: Mapping[str, Any]

    def __post_init__(self) -> None:
        if not self.event_id or not self.run_id or not self.event_type or self.sequence_no <= 0:
            raise ValueError("stream event identity and positive sequence are required")


class EventStreamPort(Protocol):
    def events_after(self, run_id: str, last_event_id: str | None) -> tuple[StreamEvent, ...]: ...


class InMemoryEventJournal:
    """Deterministic local adapter; production storage is supplied via the port."""

    def __init__(self, events: Iterable[StreamEvent]) -> None:
        self._events = tuple(events)
        identities = [event.event_id for event in self._events]
        if len(identities) != len(set(identities)):
            raise ValueError("event IDs must be globally unique")
        per_run: dict[str, list[int]] = {}
        for event in self._events:
            per_run.setdefault(event.run_id, []).append(event.sequence_no)
        if any(values != sorted(values) or len(values) != len(set(values)) for values in per_run.values()):
            raise ValueError("event sequences must be unique and ordered per run")
        self.read_count = 0
        self.run_creation_count = 0

    def events_after(self, run_id: str, last_event_id: str | None) -> tuple[StreamEvent, ...]:
        self.read_count += 1
        run_events = tuple(event for event in self._events if event.run_id == run_id)
        if last_event_id is None or last_event_id == "":
            return run_events
        cursor = next((event for event in self._events if event.event_id == last_event_id), None)
        if cursor is None or cursor.run_id != run_id:
            raise ApiContractError("SSE_CURSOR_INVALID", "The event resume cursor is invalid.", 409)
        return tuple(event for event in run_events if event.sequence_no > cursor.sequence_no)


class EmptyEventStream:
    def events_after(self, run_id: str, last_event_id: str | None) -> tuple[StreamEvent, ...]:
        raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501)


class PostgresEventStream:
    """Read append-only run events from PostgreSQL without creating a new schema."""

    def __init__(self, session_factory: Any) -> None:
        if not callable(session_factory):
            raise TypeError("session_factory must be callable")
        self._session_factory = session_factory

    def events_after(self, run_id: str, last_event_id: str | None) -> tuple[StreamEvent, ...]:
        with self._session_factory() as session:
            if last_event_id:
                cursor = session.execute(
                    text("SELECT event_id, run_id, sequence_no FROM run_events WHERE event_id = :event_id"),
                    {"event_id": last_event_id},
                ).mappings().one_or_none()
                if cursor is None or cursor["run_id"] != run_id:
                    raise ApiContractError("SSE_CURSOR_INVALID", "The event resume cursor is invalid.", 409)
                minimum_sequence = int(cursor["sequence_no"])
            else:
                minimum_sequence = 0
            rows = session.execute(
                text(
                    "SELECT event_id, run_id, sequence_no, event_type, payload "
                    "FROM run_events WHERE run_id = :run_id AND sequence_no > :minimum_sequence "
                    "ORDER BY sequence_no ASC"
                ),
                {"run_id": run_id, "minimum_sequence": minimum_sequence},
            ).mappings().all()
        return tuple(
            StreamEvent(
                event_id=str(row["event_id"]),
                run_id=str(row["run_id"]),
                sequence_no=int(row["sequence_no"]),
                event_type=str(row["event_type"]),
                payload=dict(row["payload"]),
            )
            for row in rows
        )


def encode_sse(events: Iterable[StreamEvent]) -> bytes:
    chunks: list[str] = []
    for event in events:
        data = json.dumps(event.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        chunks.append(f"id: {event.event_id}\nevent: {event.event_type}\ndata: {data}\n\n")
    return "".join(chunks).encode("utf-8")
