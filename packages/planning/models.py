"""Immutable planning artifacts bound to approved parent hashes."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
import re

from .hashing import canonical_content_hash


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")

def _canonical_hash(value: str, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


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

    def canonical_payload(self) -> dict:
        """C-11 content contract; legacy persistence constructors stay intact."""
        return {"artifact_type": "WorkPlan", "artifact_id": self.artifact_id,
            "revision": self.revision, "design_baseline_id": self.design_baseline_id,
            "design_baseline_hash": self.design_baseline_hash, "scope": sorted(self.scope),
            "created_at": self.created_at.isoformat()}

    def validate_content_hash(self) -> None:
        self.__post_init__()
        if self.content_hash != canonical_content_hash(self.canonical_payload()):
            raise ValueError("WorkPlan canonical content hash mismatch")

    @classmethod
    def create(cls, *, artifact_id: str, revision: int, design_baseline_id: str,
               design_baseline_hash: str, scope: frozenset[str], created_at: datetime) -> WorkPlan:
        draft = cls(artifact_id, revision, "sha256:" + "0" * 64, design_baseline_id,
            design_baseline_hash, scope, created_at)
        return replace(draft, content_hash=canonical_content_hash(draft.canonical_payload()))


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

    def canonical_payload(self) -> dict:
        return {"artifact_type": "IterationPlan", "artifact_id": self.artifact_id,
            "revision": self.revision, "work_plan_id": self.work_plan_id,
            "work_plan_hash": self.work_plan_hash, "sequence": self.sequence,
            "created_at": self.created_at.isoformat()}

    def validate_content_hash(self) -> None:
        self.__post_init__()
        if self.content_hash != canonical_content_hash(self.canonical_payload()):
            raise ValueError("IterationPlan canonical content hash mismatch")

    @classmethod
    def create(cls, *, artifact_id: str, revision: int, work_plan: WorkPlan,
               sequence: int, created_at: datetime) -> IterationPlan:
        if type(work_plan) is not WorkPlan: raise ValueError("canonical WorkPlan required")
        work_plan.validate_content_hash()
        draft = cls(artifact_id, revision, "sha256:" + "0" * 64, work_plan.artifact_id,
            work_plan.content_hash, sequence, created_at)
        if created_at < work_plan.created_at: raise ValueError("iteration cannot predate work plan")
        return replace(draft, content_hash=canonical_content_hash(draft.canonical_payload()))


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
    objective: str | None = None
    risk: tuple[str, ...] = ()
    egress_snapshot_hash: str | None = None
    prohibited_actions: tuple[str, ...] = ()
    scope: tuple[str, ...] = ()
    request_analysis_hash: str | None = None
    prohibited_paths: tuple[str, ...] = ()
    validation_contract: tuple[str, ...] = ()

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
        _required(self.objective, "objective")
        for values, field in ((self.risk, "risk"), (self.prohibited_actions, "prohibited_actions")):
            if not isinstance(values, tuple) or not values or len(values) != len(set(values)):
                raise ValueError(f"{field} must be a non-empty tuple without duplicates")
            for value in values:
                _required(value, f"{field} item")
        _canonical_hash(self.egress_snapshot_hash, "egress_snapshot_hash")
        if not isinstance(self.scope, tuple) or not self.scope or len(self.scope) != len(set(self.scope)):
            raise ValueError("scope must be a non-empty tuple without duplicates")
        for value in self.scope:
            _required(value, "scope item")
        _canonical_hash(self.request_analysis_hash, "request_analysis_hash")
        # Legacy B-04 artifacts may omit these fields; C-11 requires a nonempty
        # validation contract before deriving an executable plan.
        for name in ("prohibited_paths", "validation_contract"):
            values = getattr(self, name)
            if type(values) not in (tuple, list):
                raise ValueError(f"{name} must be a sequence")
            frozen = tuple(values)
            for value in frozen:
                _required(value, name)
            if len(set(frozen)) != len(frozen):
                raise ValueError(f"{name} must not contain duplicates")
            object.__setattr__(self, name, frozen)
