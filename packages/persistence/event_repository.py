"""Persistence port for append-only Run events."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from packages.events.models import StoredEvent


@runtime_checkable
class EventRepository(Protocol):
    def events_for(self, run_id: str) -> tuple[StoredEvent, ...]: ...

    def by_event_id(self, event_id: str) -> StoredEvent | None: ...

    def by_idempotency_key(self, run_id: str, key: str) -> StoredEvent | None: ...

    def append(self, event: StoredEvent) -> None: ...


class SqlAlchemyEventWriter:
    """호출자의 트랜잭션에서 append하고 DB의 실제 영수증을 반환한다."""

    def __init__(self, session):
        self.session = session

    def by_key(self, run_id: str, key: str):
        from sqlalchemy import text
        row = self.session.execute(text(
            "SELECT * FROM run_events WHERE run_id=:run AND idempotency_key=:key"
        ), {"run": run_id, "key": key}).mappings().one_or_none()
        return dict(row) if row is not None else None

    def append(self, *, run_id: str, event_type: str, actor_id: str,
               correlation_id: str, causation_id: str | None, key: str,
               expected_version: int, payload: dict):
        from datetime import datetime, timezone
        from hashlib import sha256
        import json
        from uuid import uuid4
        from sqlalchemy import text

        event_id = str(uuid4())
        serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fingerprint = "sha256:" + sha256(json.dumps({
            "id": event_id, "run": run_id, "type": event_type, "actor": actor_id,
            "correlation": correlation_id, "causation": causation_id, "key": key,
            "expected": expected_version, "payload": payload,
        }, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
        self.session.execute(text(
            "SELECT * FROM anvil_append_run_event(:id,:run,:type,'HUMAN',:actor,"
            ":correlation,:causation,:key,:expected,:hash,CAST(:payload AS json),NULL,:now)"
        ), {"id": event_id, "run": run_id, "type": event_type, "actor": actor_id,
            "correlation": correlation_id, "causation": causation_id, "key": key,
            "expected": expected_version, "hash": fingerprint, "payload": serialized,
            "now": datetime.now(timezone.utc)}).mappings().one()
        return self.by_key(run_id, key)

    @staticmethod
    def receipt(row: dict) -> dict:
        return {
            "eventId": row["event_id"], "type": row["event_type"],
            "sequence": row["sequence_no"], "timestamp": row["created_at"].isoformat(),
            "actor": {"type": row["actor_type"], "id": row["actor_id"]},
            "correlationId": row["correlation_id"], "causationId": row["causation_event_id"],
            "idempotencyKey": row["idempotency_key"],
        }
