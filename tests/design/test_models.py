from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
import unittest

from packages.design.models import (
    Actor,
    ArtifactEnvelope,
    ArtifactKind,
    DecisionDisposition,
    DecisionRecord,
    DesignSpecification,
)


NOW = datetime(2026, 8, 14, tzinfo=timezone.utc)
HASH_A = "sha256:" + "a" * 64


class DesignModelTests(unittest.TestCase):
    def test_artifacts_are_typed_immutable_and_require_canonical_hash_and_utc(self):
        envelope = ArtifactEnvelope(
            artifact_id="spec-1",
            artifact_type=ArtifactKind.DESIGN_SPECIFICATION,
            revision=1,
            content_hash=HASH_A,
            source_artifact_ids=("decision-1",),
            actor=Actor("user", "sinsan", authenticated=True),
            created_at=NOW,
        )
        with self.assertRaises(FrozenInstanceError):
            envelope.revision = 2
        for bad_hash in ("a" * 64, "sha256:ABC", "sha256:" + "g" * 64):
            with self.assertRaises(ValueError):
                ArtifactEnvelope("x", ArtifactKind.INTENT, 1, bad_hash, (), envelope.actor, NOW)
        with self.assertRaises(ValueError):
            ArtifactEnvelope("x", ArtifactKind.INTENT, 1, HASH_A, (), envelope.actor, datetime(2026, 8, 14))

    def test_decision_and_specification_preserve_scope_and_carryover(self):
        decision = DecisionRecord(
            envelope=ArtifactEnvelope("d1", ArtifactKind.DECISION_RECORD, 1, HASH_A, (), Actor("user", "sinsan", True), NOW),
            proposal_set_id="p1",
            selected_proposal_id=None,
            disposition=DecisionDisposition.FOLLOW_UP_EXTENSION,
            reason="later project version",
            target_iteration_id="iteration-2",
        )
        spec = DesignSpecification(
            envelope=ArtifactEnvelope("s1", ArtifactKind.DESIGN_SPECIFICATION, 1, HASH_A, ("d1",), Actor("agent", "eoul", True), NOW),
            decision_ids=("d1",),
            scope=frozenset({"design"}),
        )
        self.assertEqual("iteration-2", decision.target_iteration_id)
        self.assertEqual(frozenset({"design"}), spec.scope)


if __name__ == "__main__":
    unittest.main()
