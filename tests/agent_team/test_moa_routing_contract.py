from datetime import datetime, timezone, timedelta
import pytest

from packages.agent_team.moa import (
    BenchmarkRecord, CapabilityProfile, CapabilityRouter, FallbackPolicy,
    ProviderModelCatalog, ProviderModelEntry, ProviderModelRef, validate_benchmark,
)


def catalog():
    now = "2026-09-01T00:00:00Z"
    return ProviderModelCatalog((ProviderModelEntry(
        "UPSTAGE", "writer", frozenset({"writing"}), cost=1, quality=0.9,
        latency=1, privacy_classes=frozenset({"private"}), regions=frozenset({"kr"}),
        retention_days=0, zdr=True, probe_at=now, probe_ttl_seconds=60,
    ), ProviderModelEntry(
        "OPENAI", "writer", frozenset({"writing"}), cost=1, quality=0.8,
        latency=1, privacy_classes=frozenset({"private"}), regions=frozenset({"us"}),
        retention_days=30, zdr=False, probe_at=now, probe_ttl_seconds=60,
    )), revision=7)


def test_policy_and_snapshot_are_bound_deterministically():
    c = catalog()
    p = CapabilityProfile("writing", privacy_class="private", allowed_regions=frozenset({"kr"}),
                          max_retention_days=1, require_zdr=True, catalog_revision=7)
    r = CapabilityRouter().route(p, c, now=datetime(2026, 9, 1, tzinfo=timezone.utc))
    assert r.selected == ProviderModelRef("UPSTAGE", "writer")
    assert r.snapshot_hash == c.snapshot_hash
    assert CapabilityRouter().route(p, c, now=datetime(2026, 9, 1, tzinfo=timezone.utc)) == r


def test_stale_probe_and_policy_fallback_fail_closed():
    c = catalog()
    p = CapabilityProfile("writing", privacy_class="private", catalog_revision=7, require_fresh_probe=True)
    with pytest.raises(LookupError):
        CapabilityRouter().route(p, c, now=datetime(2026, 9, 1, 0, 2, tzinfo=timezone.utc))
    with pytest.raises(ValueError):
        CapabilityRouter().route(p, c, FallbackPolicy((ProviderModelRef("OPENAI", "writer"),), max_total_cost=1), now=datetime(2026, 9, 1, tzinfo=timezone.utc))


def test_benchmark_cannot_cross_snapshot_or_age_boundary():
    c = catalog()
    record = BenchmarkRecord("writing", ProviderModelRef("UPSTAGE", "writer"), .9, 1, 1,
                             "2026-09-01T00:00:00Z").bind(c)
    validate_benchmark(record, c, max_age_seconds=60,
                       now=datetime(2026, 9, 1, 0, 0, 30, tzinfo=timezone.utc))
    with pytest.raises(ValueError):
        validate_benchmark(record, c.register(ProviderModelEntry("GROQ", "x", frozenset({"writing"}))), max_age_seconds=60)
    with pytest.raises(ValueError):
        validate_benchmark(record, c, max_age_seconds=60,
                           now=datetime(2026, 9, 1, 0, 2, tzinfo=timezone.utc))


def test_adversarial_time_budget_primary_and_capability_checks_fail_closed():
    with pytest.raises(ValueError):
        ProviderModelEntry("X", "m", frozenset({"writing"}), probe_at="2026-09-01T00:00:00")
    with pytest.raises(ValueError):
        ProviderModelEntry("X", "m", frozenset({"writing"}), probe_at="2026-09-01T00:00:00+09:00")
    c = catalog()
    p = CapabilityProfile("writing", privacy_class="private", catalog_revision=7, budget=1)
    with pytest.raises(ValueError):
        CapabilityRouter().route(p, c, FallbackPolicy((ProviderModelRef("UPSTAGE", "writer"),)))
    record = BenchmarkRecord("coding", ProviderModelRef("UPSTAGE", "writer"), .9, 1, 1, "2026-09-01T00:00:00Z").bind(c)
    with pytest.raises(ValueError):
        validate_benchmark(record, c)
    future = BenchmarkRecord("writing", ProviderModelRef("UPSTAGE", "writer"), .9, 1, 1, "2026-09-02T00:00:00Z").bind(c)
    with pytest.raises(ValueError):
        validate_benchmark(future, c, max_age_seconds=60, now=datetime(2026, 9, 1, tzinfo=timezone.utc))
