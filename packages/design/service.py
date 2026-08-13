"""Framework-independent orchestration of the design artifact spine."""

from __future__ import annotations

from datetime import datetime
import hashlib

from .lineage import LineageError, approve_baseline
from .models import (
    Actor,
    ArtifactEnvelope,
    ArtifactKind,
    CarryoverItem,
    DecisionDisposition,
    DecisionRecord,
    DesignBaseline,
    DesignSpecification,
    Intent,
    LineageAuditEvent,
    ProposalSet,
)


class DesignServiceError(ValueError):
    """Raised when a design-flow gate is not satisfied."""


def _hash(*values: object) -> str:
    return "sha256:" + hashlib.sha256("\x1f".join(map(str, values)).encode()).hexdigest()


def _envelope(identifier: str, kind: ArtifactKind, content_hash: str, sources: tuple[str, ...], actor: Actor, at: datetime) -> ArtifactEnvelope:
    return ArtifactEnvelope(identifier, kind, 1, content_hash, sources, actor, at)


class DesignLineageService:
    def __init__(self) -> None:
        self._decisions: dict[str, DecisionRecord] = {}
        self._carryovers: list[CarryoverItem] = []
        self._specification_proposals: dict[str, str] = {}
        self._audit_events: list[LineageAuditEvent] = []

    def _audit(self, artifact_id: str, action: str, actor: Actor, at: datetime) -> None:
        self._audit_events.append(LineageAuditEvent(len(self._audit_events) + 1, artifact_id, action, actor, at))

    def record_intent(self, identifier: str, statement: str, ambiguous: bool, actor: Actor, at: datetime) -> Intent:
        if not isinstance(statement, str) or not statement.strip() or statement != statement.strip():
            raise DesignServiceError("intent statement must be canonical non-empty text")
        intent = Intent(_envelope(identifier, ArtifactKind.INTENT, _hash(statement, ambiguous), (), actor, at), statement, ambiguous)
        self._audit(identifier, "INTENT_RECORDED", actor, at)
        return intent

    def propose(self, identifier: str, intent: Intent, proposals: tuple[str, ...], actor: Actor, at: datetime) -> ProposalSet:
        if intent.ambiguous and len(proposals) < 2:
            raise DesignServiceError("ambiguous intent requires multiple proposals")
        if not proposals or any(not isinstance(item, str) or not item.strip() for item in proposals):
            raise DesignServiceError("proposals must be non-empty")
        result = ProposalSet(_envelope(identifier, ArtifactKind.PROPOSAL_SET, _hash(intent.envelope.artifact_id, *proposals), (intent.envelope.artifact_id,), actor, at), intent.envelope.artifact_id, proposals)
        self._audit(identifier, "PROPOSALS_RECORDED", actor, at)
        return result

    def decide(self, identifier: str, proposals: ProposalSet, selected: str | None, disposition: DecisionDisposition, reason: str, actor: Actor, at: datetime, target_id: str | None = None) -> DecisionRecord:
        if actor.actor_type != "user" or not actor.authenticated:
            raise DesignServiceError("authenticated human decision is required")
        if disposition is DecisionDisposition.CONFIRMED and selected not in proposals.proposals:
            raise DesignServiceError("selected proposal is not in proposal set")
        decision = DecisionRecord(_envelope(identifier, ArtifactKind.DECISION_RECORD, _hash(proposals.envelope.artifact_id, selected, disposition.value, reason, target_id), (proposals.envelope.artifact_id,), actor, at), proposals.envelope.artifact_id, selected, disposition, reason, target_id)
        self._decisions[identifier] = decision
        self._audit(identifier, "DECISION_RECORDED", actor, at)
        if disposition is not DecisionDisposition.CONFIRMED:
            carryover_id = f"carryover-{identifier}"
            carryover = CarryoverItem(_envelope(carryover_id, ArtifactKind.CARRYOVER_ITEM, _hash(identifier, target_id), (identifier,), actor, at), identifier, target_id or "", disposition)
            self._carryovers.append(carryover)
        return decision

    def specify(self, identifier: str, proposals: ProposalSet, scope: frozenset[str], actor: Actor, at: datetime) -> DesignSpecification:
        matching = tuple(item.envelope.artifact_id for item in self._decisions.values() if item.proposal_set_id == proposals.envelope.artifact_id and item.disposition is DecisionDisposition.CONFIRMED)
        specification = DesignSpecification(_envelope(identifier, ArtifactKind.DESIGN_SPECIFICATION, _hash(proposals.envelope.artifact_id, *sorted(scope)), (proposals.envelope.artifact_id, *matching), actor, at), matching, scope)
        self._specification_proposals[identifier] = proposals.envelope.artifact_id
        self._audit(identifier, "SPECIFICATION_RECORDED", actor, at)
        return specification

    def approve(self, baseline_id: str, specification: DesignSpecification, approval_id: str, actor: Actor, at: datetime) -> DesignBaseline:
        proposal_set_id = self._specification_proposals.get(specification.envelope.artifact_id)
        decisions = tuple(item for item in self._decisions.values() if item.proposal_set_id == proposal_set_id and item.disposition is DecisionDisposition.CONFIRMED)
        try:
            baseline = approve_baseline(baseline_id, specification, decisions, approval_id, actor, at)
        except LineageError as error:
            raise DesignServiceError(str(error)) from error
        self._audit(baseline_id, "BASELINE_APPROVED", actor, at)
        return baseline

    def carryovers(self) -> tuple[CarryoverItem, ...]:
        return tuple(self._carryovers)

    def audit_events(self) -> tuple[LineageAuditEvent, ...]:
        return tuple(self._audit_events)
