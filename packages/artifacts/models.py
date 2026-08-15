"""Immutable metadata for external artifact content."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def require_text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def require_hash(value: str, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def require_utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


@dataclass(frozen=True, slots=True)
class ArtifactWriteRequest:
    artifact_id: str
    artifact_type: str
    expected_content_hash: str
    expected_byte_size: int
    media_type: str
    project_id: str
    run_id: str | None
    step_id: str | None
    actor_id: str
    created_at: datetime
    source_artifact_ids: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "source_artifact_ids", tuple(self.source_artifact_ids))
        for value, field in (
            (self.artifact_id, "artifact_id"),
            (self.artifact_type, "artifact_type"),
            (self.media_type, "media_type"),
            (self.project_id, "project_id"),
            (self.actor_id, "actor_id"),
        ):
            require_text(value, field)
        require_hash(self.expected_content_hash, "expected_content_hash")
        if type(self.expected_byte_size) is not int or self.expected_byte_size < 0:
            raise ValueError("expected_byte_size must be a non-negative integer")
        for value, field in ((self.run_id, "run_id"), (self.step_id, "step_id")):
            if value is not None:
                require_text(value, field)
        for source in self.source_artifact_ids:
            require_text(source, "source_artifact_id")
        require_utc(self.created_at, "created_at")


@dataclass(frozen=True, slots=True)
class ArtifactMetadata:
    artifact_id: str
    artifact_type: str
    content_hash: str
    byte_size: int
    media_type: str
    storage_ref: str
    project_id: str
    run_id: str | None
    step_id: str | None
    actor_id: str
    created_at: datetime
    source_artifact_ids: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "source_artifact_ids", tuple(self.source_artifact_ids))
        for value, field in (
            (self.artifact_id, "artifact_id"),
            (self.artifact_type, "artifact_type"),
            (self.media_type, "media_type"),
            (self.storage_ref, "storage_ref"),
            (self.project_id, "project_id"),
            (self.actor_id, "actor_id"),
        ):
            require_text(value, field)
        require_hash(self.content_hash, "content_hash")
        if type(self.byte_size) is not int or self.byte_size < 0:
            raise ValueError("byte_size must be a non-negative integer")
        for value, field in ((self.run_id, "run_id"), (self.step_id, "step_id")):
            if value is not None:
                require_text(value, field)
        for source in self.source_artifact_ids:
            require_text(source, "source_artifact_id")
        require_utc(self.created_at, "created_at")
