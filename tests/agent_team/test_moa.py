from unittest import TestCase

from packages.agent_team.moa import (
    BenchmarkRecord, CapabilityProfile, CapabilityRouter, FallbackPolicy,
    ProviderModelCatalog, ProviderModelEntry, ProviderModelRef,
)


class MoaTests(TestCase):
    def setUp(self):
        self.catalog = ProviderModelCatalog().register(ProviderModelEntry("openai", "coder", frozenset({"coding"}), cost=2, quality=0.9, latency=1))
        self.catalog = self.catalog.register(ProviderModelEntry("anthropic", "writer", frozenset({"writing"}), cost=1, quality=0.8, latency=2))

    def test_selects_capability_route_and_provenance(self):
        profile = CapabilityProfile("coding", cost_priority=0.1, latency_priority=0.1, catalog_revision=self.catalog.revision)
        result = CapabilityRouter().route(profile, self.catalog)
        self.assertEqual(ProviderModelRef("openai", "coder"), result.selected)
        self.assertEqual(self.catalog.revision, result.catalog_revision)
        self.assertIn("quality_priority", dict(result.inputs))

    def test_rejects_unsupported_unhealthy_over_budget_and_stale(self):
        profile = CapabilityProfile("research", catalog_revision=self.catalog.revision)
        with self.assertRaises(LookupError):
            CapabilityRouter().route(profile, self.catalog)
        with self.assertRaises(ValueError):
            CapabilityRouter().route(CapabilityProfile("coding", catalog_revision=1), self.catalog)
        with self.assertRaises(LookupError):
            CapabilityRouter().route(CapabilityProfile("coding", budget=1, catalog_revision=self.catalog.revision), self.catalog)

    def test_explicit_fallback_must_be_registered_and_eligible(self):
        router = CapabilityRouter()
        policy = FallbackPolicy((ProviderModelRef("missing", "model"),))
        profile = CapabilityProfile("coding", catalog_revision=self.catalog.revision)
        with self.assertRaises(ValueError):
            router.route(profile, self.catalog, policy)
        with self.assertRaises(ValueError):
            router.route(profile, self.catalog, FallbackPolicy((ProviderModelRef("anthropic", "writer"),)))

    def test_benchmark_is_record_only(self):
        record = BenchmarkRecord("coding", ProviderModelRef("openai", "coder"), 0.91, 2, 1.2, "2026-08-21T00:00:00Z")
        self.assertEqual("coding", record.capability)


if __name__ == "__main__":
    import unittest
    unittest.main()
