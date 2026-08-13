"""Immutable design-artifact aggregates and approval lineage values."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    if value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be UTC")


class ArtifactKind(str, Enum):
    INTENT = "INTENT"
    PROPOSAL_SET = "PROPOSAL_SET"
    DECISION_RECORD = "DECISION_RECORD"
    DESIGN_SPECIFICATION = "DESIGN_SPECIFICATION"
    DESIGN_BASELINE = "DESIGN_BASELINE"
    NONSEMANTIC_BINDING = "NONSEMANTIC_BINDING"
    CARRYOVER_ITEM = "CARRYOVER_ITEM"


class DecisionDisposition(str, Enum):
    CONFIRMED = "CONFIRMED"
    DEFERRED = "DEFERRED"
    FOLLOW_UP_EXTENSION = "FOLLOW_UP_EXTENSION"


@dataclass(frozen=True, slots=True)
class Actor:
    actor_type: str
    actor_id: str
    authenticated: bool

    def __post_init__(self) -> None:
        if self.actor_type not in {"user", "agent", "system"}:
            raise ValueError("unsupported actor type")
        _required(self.actor_id, "actor_id")
        if type(self.authenticated) is not bool:
            raise TypeError("authenticated must be bool")


@dataclass(frozen=True, slots=True)
class ArtifactEnvelope:
    artifact_id: str
    artifact_type: ArtifactKind
    revision: int
    content_hash: str
    source_artifact_ids: tuple[str, ...]
    actor: Actor
    created_at: datetime

    def __post_init__(self) -> None:
        _required(self.artifact_id, "artifact_id")
        if not isinstance(self.artifact_type, ArtifactKind):
            raise TypeError("artifact_type must be ArtifactKind")
        if type(self.revision) is not int or self.revision < 1:
            raise ValueError("revision must be a positive integer")
        if not isinstance(self.content_hash, str) or not _HASH.fullmatch(self.content_hash):
            raise ValueError("content_hash must be canonical lowercase sha256")
        if not isinstance(self.source_artifact_ids, tuple):
            raise TypeError("source_artifact_ids must be tuple")
        for source_id in self.source_artifact_ids:
            _required(source_id, "source_artifact_id")
        _utc(self.created_at, "created_at")


@dataclass(frozen=True, slots=True)
class Intent:
    envelope: ArtifactEnvelope
    statement: str
    ambiguous: bool


@dataclass(frozen=True, slots=True)
class ProposalSet:
    envelope: ArtifactEnvelope
    intent_id: str
    proposals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DecisionRecord:
    envelope: ArtifactEnvelope
    proposal_set_id: str
    selected_proposal_id: str | None
    disposition: DecisionDisposition
    reason: str
    target_iteration_id: str | None = None

    def __post_init__(self) -> None:
        _required(self.proposal_set_id, "proposal_set_id")
        _required(self.reason, "reason")
        if not isinstance(self.disposition, DecisionDisposition):
            raise TypeError("disposition must be DecisionDisposition")
        if self.disposition is DecisionDisposition.CONFIRMED:
            if self.selected_proposal_id is None:
                raise ValueError("confirmed decision requires selected proposal")
            _required(self.selected_proposal_id, "selected_proposal_id")
        elif self.target_iteration_id is None:
            raise ValueError("carryover decision requires target")
        if self.target_iteration_id is not None:
            _required(self.target_iteration_id, "target_iteration_id")


@dataclass(frozen=True, slots=True)
class DesignSpecification:
    envelope: ArtifactEnvelope
    decision_ids: tuple[str, ...]
    scope: frozenset[str]

    def __post_init__(self) -> None:
        if not isinstance(self.scope, frozenset) or not self.scope:
            raise ValueError("scope must be a non-empty frozenset")
        for item in self.scope:
            _required(item, "scope item")


@dataclass(frozen=True, slots=True)
class DesignBaseline:
    envelope: ArtifactEnvelope
    specification_id: str
    decision_ids: tuple[str, ...]
    scope: frozenset[str]
    root_human_approval_id: str
    parent_baseline_id: str | None = None
    approval_mode: str = "HUMAN_APPROVED"


@dataclass(frozen=True, slots=True)
class NonSemanticRevisionBinding:
    envelope: ArtifactEnvelope
    parent_baseline_id: str
    root_human_approval_id: str
    old_content_hash: str
    new_content_hash: str
    semantic_diff: str
    impact: str
    reason: str
    reconfirmed_by: Actor
    reconfirmed_at: datetime
    functional_scope_changed: bool = False
    requirements_changed: bool = False
    critical_risk_changed: bool = False

    def __post_init__(self) -> None:
        for value, field in ((self.parent_baseline_id, "parent_baseline_id"), (self.root_human_approval_id, "root_human_approval_id"), (self.impact, "impact"), (self.reason, "reason")):
            _required(value, field)
        for value in (self.old_content_hash, self.new_content_hash):
            if not _HASH.fullmatch(value):
                raise ValueError("binding hashes must be canonical sha256")
        _required(self.semantic_diff, "semantic_diff")
        _utc(self.reconfirmed_at, "reconfirmed_at")


@dataclass(frozen=True, slots=True)
class CarryoverItem:
    envelope: ArtifactEnvelope
    source_decision_id: str
    target_id: str
    disposition: DecisionDisposition


@dataclass(frozen=True, slots=True)
class LineageAuditEvent:
    sequence: int
    artifact_id: str
    action: str
    actor: Actor
    occurred_at: datetime

    def __post_init__(self) -> None:
        if type(self.sequence) is not int or self.sequence < 1:
            raise ValueError("sequence must be a positive integer")
        _required(self.artifact_id, "artifact_id")
        _required(self.action, "action")
        _utc(self.occurred_at, "occurred_at")
