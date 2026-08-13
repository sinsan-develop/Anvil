from datetime import datetime, timezone
import unittest

from packages.design.lineage import LineageError, approve_baseline, derive_nonsemantic_baseline
from packages.design.models import (
    Actor,
    ArtifactEnvelope,
    ArtifactKind,
    DecisionDisposition,
    DecisionRecord,
    DesignBaseline,
    DesignSpecification,
    NonSemanticRevisionBinding,
)


NOW = datetime(2026, 8, 14, tzinfo=timezone.utc)
OLD = "sha256:" + "1" * 64
NEW = "sha256:" + "2" * 64


def envelope(identifier, kind, content_hash=OLD, actor=None):
    return ArtifactEnvelope(identifier, kind, 1, content_hash, (), actor or Actor("agent", "eoul", True), NOW)


class LineageTests(unittest.TestCase):
    def setUp(self):
        self.human = Actor("user", "sinsan", True)
        self.decision = DecisionRecord(envelope("decision-1", ArtifactKind.DECISION_RECORD, actor=self.human), "proposals-1", "option-a", DecisionDisposition.CONFIRMED, "approved")
        self.spec = DesignSpecification(envelope("spec-1", ArtifactKind.DESIGN_SPECIFICATION), ("decision-1",), frozenset({"core"}))

    def test_baseline_requires_authenticated_human_root_approval_and_matching_decisions(self):
        baseline = approve_baseline("baseline-1", self.spec, (self.decision,), "approval-1", self.human, NOW)
        self.assertEqual("approval-1", baseline.root_human_approval_id)
        for actor, decisions in ((Actor("agent", "eoul", True), (self.decision,)), (Actor("user", "sinsan", False), (self.decision,)), (self.human, ())):
            with self.subTest(actor=actor, decisions=decisions):
                with self.assertRaises(LineageError):
                    approve_baseline("bad", self.spec, decisions, "approval-1", actor, NOW)

    def test_nonsemantic_derivation_rejects_scope_risk_root_parent_and_hash_bypass(self):
        parent = approve_baseline("baseline-1", self.spec, (self.decision,), "approval-1", self.human, NOW)
        next_spec = DesignSpecification(envelope("spec-2", ArtifactKind.DESIGN_SPECIFICATION, NEW), ("decision-1",), frozenset({"core"}))
        valid = NonSemanticRevisionBinding(envelope("binding-1", ArtifactKind.NONSEMANTIC_BINDING, NEW), "baseline-1", "approval-1", OLD, NEW, "NONE", "wording only", "hash refresh", Actor("agent", "eoul", True), NOW)
        derived = derive_nonsemantic_baseline("baseline-2", parent, next_spec, valid, NOW)
        self.assertEqual("baseline-1", derived.parent_baseline_id)

        changes = {
            "scope": frozenset({"core", "extra"}),
            "semantic_diff": "REQUIREMENT_CHANGE",
            "root_human_approval_id": "approval-other",
            "parent_baseline_id": "baseline-other",
            "old_content_hash": NEW,
            "new_content_hash": OLD,
        }
        for field, value in changes.items():
            with self.subTest(field=field):
                bad_spec = DesignSpecification(next_spec.envelope, next_spec.decision_ids, value) if field == "scope" else next_spec
                values = {name: getattr(valid, name) for name in valid.__dataclass_fields__}
                if field != "scope":
                    values[field] = value
                with self.assertRaises(LineageError):
                    derive_nonsemantic_baseline("bad", parent, bad_spec, NonSemanticRevisionBinding(**values), NOW)


if __name__ == "__main__":
    unittest.main()
