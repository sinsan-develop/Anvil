"""Immutable progress snapshot model."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from packages.outbox.models import OwnerType, require_hash, require_text, require_utc


@dataclass(frozen=True, slots=True)
class ProgressSnapshot:
    snapshot_id: str
    outbox_id: str
    owner_type: OwnerType
    owner_id: str
    event_sequence: int
    payload_hash: str
    json_hash: str
    handoff_hash: str
    export_uri: str
    created_at: datetime

    def __post_init__(self) -> None:
        if not isinstance(self.owner_type, OwnerType):
            raise ValueError("owner_type must be PROJECT or RUN")
        for value, field in (
            (self.snapshot_id, "snapshot_id"),
            (self.outbox_id, "outbox_id"),
            (self.owner_id, "owner_id"),
            (self.export_uri, "export_uri"),
        ):
            require_text(value, field)
        if type(self.event_sequence) is not int or self.event_sequence < 1:
            raise ValueError("event_sequence must be a positive integer")
        for value, field in (
            (self.payload_hash, "payload_hash"),
            (self.json_hash, "json_hash"),
            (self.handoff_hash, "handoff_hash"),
        ):
            require_hash(value, field)
        require_utc(self.created_at, "created_at")
