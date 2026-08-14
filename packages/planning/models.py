"""Immutable planning artifacts bound to approved parent hashes."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: str, field: str) -> None:
    if not isinstance(value, str) or not _HASH.fullmatch(value):
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


@dataclass(frozen=True, slots=True)
class WorkPlan:
    artifact_id: str
    revision: int
    content_hash: str
    design_baseline_id: str
    design_baseline_hash: str
    scope: frozenset[str]
    created_at: datetime

    def __post_init__(self) -> None:
        _required(self.artifact_id, "artifact_id")
        _required(self.design_baseline_id, "design_baseline_id")
        if type(self.revision) is not int or self.revision < 1:
            raise ValueError("revision must be a positive integer")
        _hash(self.content_hash, "content_hash")
        _hash(self.design_baseline_hash, "design_baseline_hash")
        if not isinstance(self.scope, frozenset) or not self.scope:
            raise ValueError("scope must be a non-empty frozenset")
        for item in self.scope:
            _required(item, "scope item")
        _utc(self.created_at, "created_at")


@dataclass(frozen=True, slots=True)
class IterationPlan:
    artifact_id: str
    revision: int
    content_hash: str
    work_plan_id: str
    work_plan_hash: str
    sequence: int
    created_at: datetime

    def __post_init__(self) -> None:
        _required(self.artifact_id, "artifact_id")
        _required(self.work_plan_id, "work_plan_id")
        if type(self.revision) is not int or self.revision < 1:
            raise ValueError("revision must be a positive integer")
        if type(self.sequence) is not int or self.sequence < 1:
            raise ValueError("sequence must be a positive integer")
        _hash(self.content_hash, "content_hash")
        _hash(self.work_plan_hash, "work_plan_hash")
        _utc(self.created_at, "created_at")


@dataclass(frozen=True, slots=True)
class WorkInstruction:
    artifact_id: str
    revision: int
    content_hash: str
    iteration_plan_id: str
    iteration_plan_hash: str
    allowed_paths: tuple[str, ...]
    allowed_actions: tuple[str, ...]
    completion_conditions: tuple[str, ...]
    created_at: datetime

    def __post_init__(self) -> None:
        _required(self.artifact_id, "artifact_id")
        _required(self.iteration_plan_id, "iteration_plan_id")
        if type(self.revision) is not int or self.revision < 1:
            raise ValueError("revision must be a positive integer")
        _hash(self.content_hash, "content_hash")
        _hash(self.iteration_plan_hash, "iteration_plan_hash")
        for values, field in ((self.allowed_paths, "allowed_paths"), (self.allowed_actions, "allowed_actions"), (self.completion_conditions, "completion_conditions")):
            if not isinstance(values, tuple) or not values:
                raise ValueError(f"{field} must be a non-empty tuple")
            if len(values) != len(set(values)):
                raise ValueError(f"{field} must not contain duplicates")
            for value in values:
                _required(value, field)
        _utc(self.created_at, "created_at")
