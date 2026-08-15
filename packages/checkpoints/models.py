"""Immutable Checkpoint models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Mapping

from packages.artifacts.models import require_hash, require_text, require_utc


@dataclass(frozen=True, slots=True)
class CheckpointRequest:
    checkpoint_id: str
    run_id: str
    thread_id: str
    graph_version: str
    state_schema_version: int
    source_event_sequence: int
    next_nodes: tuple[str, ...]
    pending_writes: tuple[str, ...]
    state_artifact_id: str
    state_artifact_hash: str
    binding_hashes: Mapping[str, str]
    actor_id: str
    created_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "next_nodes", tuple(self.next_nodes))
        object.__setattr__(self, "pending_writes", tuple(self.pending_writes))
        for value, field in (
            (self.checkpoint_id, "checkpoint_id"),
            (self.run_id, "run_id"),
            (self.thread_id, "thread_id"),
            (self.graph_version, "graph_version"),
            (self.state_artifact_id, "state_artifact_id"),
            (self.actor_id, "actor_id"),
        ):
            require_text(value, field)
        for value, field in (
            (self.state_schema_version, "state_schema_version"),
            (self.source_event_sequence, "source_event_sequence"),
        ):
            if type(value) is not int or value < 1:
                raise ValueError(f"{field} must be a positive integer")
        require_hash(self.state_artifact_hash, "state_artifact_hash")
        for value in self.next_nodes:
            require_text(value, "next_node")
        for value in self.pending_writes:
            require_text(value, "pending_write")
        frozen: dict[str, str] = {}
        for key, value in self.binding_hashes.items():
            require_text(key, "binding name")
            require_hash(value, "binding hash")
            frozen[key] = value
        if not frozen:
            raise ValueError("binding_hashes must not be empty")
        object.__setattr__(self, "binding_hashes", MappingProxyType(frozen))
        require_utc(self.created_at, "created_at")


@dataclass(frozen=True, slots=True)
class Checkpoint:
    checkpoint_id: str
    run_id: str
    thread_id: str
    graph_version: str
    state_schema_version: int
    source_event_sequence: int
    next_nodes: tuple[str, ...]
    pending_writes: tuple[str, ...]
    state_artifact_id: str
    state_artifact_hash: str
    binding_hashes: Mapping[str, str]
    actor_id: str
    created_at: datetime

    def __post_init__(self) -> None:
        validated = CheckpointRequest(
            self.checkpoint_id,
            self.run_id,
            self.thread_id,
            self.graph_version,
            self.state_schema_version,
            self.source_event_sequence,
            self.next_nodes,
            self.pending_writes,
            self.state_artifact_id,
            self.state_artifact_hash,
            self.binding_hashes,
            self.actor_id,
            self.created_at,
        )
        object.__setattr__(self, "next_nodes", validated.next_nodes)
        object.__setattr__(self, "pending_writes", validated.pending_writes)
        object.__setattr__(self, "binding_hashes", validated.binding_hashes)

    @classmethod
    def from_request(cls, request: CheckpointRequest) -> "Checkpoint":
        return cls(
            request.checkpoint_id,
            request.run_id,
            request.thread_id,
            request.graph_version,
            request.state_schema_version,
            request.source_event_sequence,
            request.next_nodes,
            request.pending_writes,
            request.state_artifact_id,
            request.state_artifact_hash,
            request.binding_hashes,
            request.actor_id,
            request.created_at,
        )
