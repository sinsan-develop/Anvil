from datetime import datetime, timezone
import unittest

from packages.design.models import Actor, DecisionDisposition
from packages.design.service import DesignLineageService, DesignServiceError


NOW = datetime(2026, 8, 14, tzinfo=timezone.utc)


class DesignServiceTests(unittest.TestCase):
    def test_intent_rejects_noncanonical_empty_user_input(self):
        service = DesignLineageService()
        with self.assertRaises(DesignServiceError):
            service.record_intent("intent-1", "   ", True, Actor("user", "sinsan", True), NOW)

    def test_ambiguous_intent_requires_multiple_proposals_and_human_decision_before_baseline(self):
        service = DesignLineageService()
        intent = service.record_intent("intent-1", "automate approval", ambiguous=True, actor=Actor("user", "sinsan", True), at=NOW)
        with self.assertRaises(DesignServiceError):
            service.propose("proposal-set-1", intent, ("single",), Actor("agent", "eoul", True), NOW)
        proposals = service.propose("proposal-set-1", intent, ("safe", "fast"), Actor("agent", "eoul", True), NOW)
        spec = service.specify("spec-1", proposals, frozenset({"approval"}), Actor("agent", "eoul", True), NOW)
        with self.assertRaises(DesignServiceError):
            service.approve("baseline-1", spec, "approval-1", Actor("user", "sinsan", True), NOW)
        service.decide("decision-1", proposals, "safe", DecisionDisposition.CONFIRMED, "safer", Actor("user", "sinsan", True), NOW)
        baseline = service.approve("baseline-1", spec, "approval-1", Actor("user", "sinsan", True), NOW)
        self.assertEqual("approval-1", baseline.root_human_approval_id)

    def test_deferred_and_followup_decisions_become_carryover_items(self):
        service = DesignLineageService()
        intent = service.record_intent("i", "x", True, Actor("user", "sinsan", True), NOW)
        proposals = service.propose("p", intent, ("a", "b"), Actor("agent", "eoul", True), NOW)
        service.decide("d1", proposals, None, DecisionDisposition.DEFERRED, "wait", Actor("user", "sinsan", True), NOW, "iteration-2")
        service.decide("d2", proposals, None, DecisionDisposition.FOLLOW_UP_EXTENSION, "later", Actor("user", "sinsan", True), NOW, "project-v2")
        self.assertEqual(("iteration-2", "project-v2"), tuple(item.target_id for item in service.carryovers()))

    def test_baseline_does_not_absorb_decisions_from_another_proposal_set(self):
        service = DesignLineageService()
        actor = Actor("user", "sinsan", True)
        agent = Actor("agent", "eoul", True)
        first = service.propose("p1", service.record_intent("i1", "first", True, actor, NOW), ("a", "b"), agent, NOW)
        second = service.propose("p2", service.record_intent("i2", "second", True, actor, NOW), ("c", "d"), agent, NOW)
        service.decide("d1", first, "a", DecisionDisposition.CONFIRMED, "first", actor, NOW)
        service.decide("d2", second, "c", DecisionDisposition.CONFIRMED, "second", actor, NOW)
        spec = service.specify("s1", first, frozenset({"first"}), agent, NOW)
        baseline = service.approve("b1", spec, "approval-1", actor, NOW)
        self.assertEqual(("d1",), baseline.decision_ids)

    def test_artifact_flow_emits_ordered_actor_bound_audit_lineage(self):
        service = DesignLineageService()
        actor = Actor("user", "sinsan", True)
        agent = Actor("agent", "eoul", True)
        intent = service.record_intent("i", "intent", True, actor, NOW)
        proposals = service.propose("p", intent, ("a", "b"), agent, NOW)
        service.decide("d", proposals, "a", DecisionDisposition.CONFIRMED, "chosen", actor, NOW)
        spec = service.specify("s", proposals, frozenset({"core"}), agent, NOW)
        service.approve("b", spec, "approval-1", actor, NOW)
        events = service.audit_events()
        self.assertEqual((1, 2, 3, 4, 5), tuple(event.sequence for event in events))
        self.assertEqual(("i", "p", "d", "s", "b"), tuple(event.artifact_id for event in events))
        self.assertEqual(("sinsan", "eoul", "sinsan", "eoul", "sinsan"), tuple(event.actor.actor_id for event in events))


if __name__ == "__main__":
    unittest.main()
