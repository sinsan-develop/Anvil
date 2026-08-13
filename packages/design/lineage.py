"""Fail-closed constructors for human-approved and nonsemantic baselines."""

from __future__ import annotations

from datetime import datetime

from .models import (
    Actor,
    ArtifactEnvelope,
    ArtifactKind,
    DecisionDisposition,
    DecisionRecord,
    DesignBaseline,
    DesignSpecification,
    NonSemanticRevisionBinding,
)


class LineageError(ValueError):
    """Raised when design approval lineage cannot be proven."""


def _human(actor: Actor) -> bool:
    return actor.actor_type == "user" and actor.authenticated is True


def approve_baseline(
    baseline_id: str,
    specification: DesignSpecification,
    decisions: tuple[DecisionRecord, ...],
    root_human_approval_id: str,
    approval_actor: Actor,
    approved_at: datetime,
) -> DesignBaseline:
    if not _human(approval_actor) or not root_human_approval_id.strip():
        raise LineageError("authenticated human root approval is required")
    decision_ids = tuple(item.envelope.artifact_id for item in decisions)
    if not decisions or any(item.disposition is not DecisionDisposition.CONFIRMED for item in decisions):
        raise LineageError("all baseline decisions must be confirmed")
    if specification.decision_ids and set(specification.decision_ids) != set(decision_ids):
        raise LineageError("specification decisions do not match")
    envelope = ArtifactEnvelope(
        baseline_id,
        ArtifactKind.DESIGN_BASELINE,
        specification.envelope.revision,
        specification.envelope.content_hash,
        (specification.envelope.artifact_id, *decision_ids),
        approval_actor,
        approved_at,
    )
    return DesignBaseline(envelope, specification.envelope.artifact_id, decision_ids, specification.scope, root_human_approval_id)


def derive_nonsemantic_baseline(
    baseline_id: str,
    parent: DesignBaseline,
    specification: DesignSpecification,
    binding: NonSemanticRevisionBinding,
    created_at: datetime,
) -> DesignBaseline:
    invalid = (
        binding.parent_baseline_id != parent.envelope.artifact_id
        or binding.root_human_approval_id != parent.root_human_approval_id
        or binding.old_content_hash != parent.envelope.content_hash
        or binding.new_content_hash != specification.envelope.content_hash
        or binding.semantic_diff != "NONE"
        or not specification.scope.issubset(parent.scope)
        or binding.functional_scope_changed
        or binding.requirements_changed
        or binding.critical_risk_changed
        or binding.reconfirmed_by.actor_type != "agent"
        or not binding.reconfirmed_by.authenticated
    )
    if invalid:
        raise LineageError("nonsemantic binding cannot prove a scope-preserving revision")
    envelope = ArtifactEnvelope(
        baseline_id,
        ArtifactKind.DESIGN_BASELINE,
        parent.envelope.revision + 1,
        specification.envelope.content_hash,
        (parent.envelope.artifact_id, specification.envelope.artifact_id, binding.envelope.artifact_id),
        binding.reconfirmed_by,
        created_at,
    )
    return DesignBaseline(
        envelope,
        specification.envelope.artifact_id,
        specification.decision_ids or parent.decision_ids,
        specification.scope,
        parent.root_human_approval_id,
        parent.envelope.artifact_id,
        "MAIN_RECONFIRMED_NON_SEMANTIC",
    )

