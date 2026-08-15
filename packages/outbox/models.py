"""Immutable transactional progress outbox models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
import json
import re
from typing import Any


_HASH = re.compile(r"^sha256:[0-9a-f]{64}$")


def require_text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def require_hash(value: str, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a lowercase sha256 digest")


def require_utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset() != timezone.utc.utcoffset(value):
        raise ValueError(f"{field} must use UTC")


class OwnerType(str, Enum):
    PROJECT = "PROJECT"
    RUN = "RUN"


class OutboxStatus(str, Enum):
    PENDING = "PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    PERSISTENCE_ERROR = "PERSISTENCE_ERROR"


@dataclass(frozen=True, slots=True)
class ProgressExportRequest:
    request_id: str
    owner_type: OwnerType
    owner_id: str
    event_id: str
    event_sequence: int
    idempotency_key: str
    payload_hash: str
    export_uri: str
    status: str
    last_event_id: str
    next_safe_action: str
    created_at: datetime

    def __post_init__(self) -> None:
        if not isinstance(self.owner_type, OwnerType):
            raise ValueError("owner_type must be PROJECT or RUN")
        for value, field in (
            (self.request_id, "request_id"),
            (self.owner_id, "owner_id"),
            (self.event_id, "event_id"),
            (self.idempotency_key, "idempotency_key"),
            (self.export_uri, "export_uri"),
            (self.status, "status"),
            (self.last_event_id, "last_event_id"),
            (self.next_safe_action, "next_safe_action"),
        ):
            require_text(value, field)
        if type(self.event_sequence) is not int or self.event_sequence < 1:
            raise ValueError("event_sequence must be a positive integer")
        require_hash(self.payload_hash, "payload_hash")
        require_utc(self.created_at, "created_at")

    @property
    def canonical_hash(self) -> str:
        payload: dict[str, Any] = {
            "created_at": self.created_at.isoformat(),
            "event_id": self.event_id,
            "event_sequence": self.event_sequence,
            "export_uri": self.export_uri,
            "idempotency_key": self.idempotency_key,
            "last_event_id": self.last_event_id,
            "next_safe_action": self.next_safe_action,
            "owner_id": self.owner_id,
            "owner_type": self.owner_type.value,
            "payload_hash": self.payload_hash,
            "request_id": self.request_id,
            "status": self.status,
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return f"sha256:{sha256(encoded).hexdigest()}"


@dataclass(frozen=True, slots=True)
class OutboxReceipt:
    outbox_id: str
    request: ProgressExportRequest
    request_hash: str
    status: OutboxStatus
    retry_count: int
    duplicate: bool = False

    def __post_init__(self) -> None:
        require_text(self.outbox_id, "outbox_id")
        require_hash(self.request_hash, "request_hash")
        if type(self.retry_count) is not int or self.retry_count < 0:
            raise ValueError("retry_count must be a non-negative integer")
