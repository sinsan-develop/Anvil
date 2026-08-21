"""Deterministic, capability-based Mixture of Agent routing primitives.

This module only decides a route.  It never calls a provider, performs network
I/O, or aggregates model responses.
"""

from __future__ import annotations

from dataclasses import dataclass
import math


def _text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _texts(values: frozenset[str], field: str) -> None:
    if not isinstance(values, frozenset):
        raise TypeError(f"{field} must be a frozenset")
    for value in values:
        _text(value, field)


def _number(value: float, field: str, *, minimum: float = 0.0) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < minimum:
        raise ValueError(f"{field} must be a finite number >= {minimum}")


@dataclass(frozen=True, slots=True, order=True)
class ProviderModelRef:
    provider: str
    model: str

    def __post_init__(self) -> None:
        _text(self.provider, "provider")
        _text(self.model, "model")


@dataclass(frozen=True, slots=True)
class CapabilityProfile:
    capability: str
    quality_priority: float = 1.0
    cost_priority: float = 1.0
    latency_priority: float = 1.0
    allowed_providers: frozenset[str] = frozenset()
    allowed_models: frozenset[str] = frozenset()
    budget: float | None = None
    catalog_revision: int = 1

    def __post_init__(self) -> None:
        _text(self.capability, "capability")
        _number(self.quality_priority, "quality_priority")
        _number(self.cost_priority, "cost_priority")
        _number(self.latency_priority, "latency_priority")
        _texts(self.allowed_providers, "allowed_providers")
        _texts(self.allowed_models, "allowed_models")
        if self.budget is not None:
            _number(self.budget, "budget")
        if type(self.catalog_revision) is not int or self.catalog_revision < 1:
            raise ValueError("catalog_revision must be a positive integer")


@dataclass(frozen=True, slots=True)
class ProviderModelEntry:
    provider: str
    model: str
    capabilities: frozenset[str]
    healthy: bool = True
    cost: float = 0.0
    quality: float = 0.0
    latency: float = 0.0

    @property
    def ref(self) -> ProviderModelRef:
        return ProviderModelRef(self.provider, self.model)

    def __post_init__(self) -> None:
        _text(self.provider, "provider")
        _text(self.model, "model")
        _texts(self.capabilities, "capabilities")
        if type(self.healthy) is not bool:
            raise TypeError("healthy must be bool")
        _number(self.cost, "cost")
        _number(self.quality, "quality")
        _number(self.latency, "latency")


@dataclass(frozen=True, slots=True)
class ProviderModelCatalog:
    entries: tuple[ProviderModelEntry, ...] = ()
    revision: int = 1

    def __post_init__(self) -> None:
        if type(self.revision) is not int or self.revision < 1:
            raise ValueError("revision must be a positive integer")
        if not isinstance(self.entries, tuple):
            raise TypeError("entries must be a tuple")
        refs: set[ProviderModelRef] = set()
        for entry in self.entries:
            if not isinstance(entry, ProviderModelEntry):
                raise TypeError("entries must contain ProviderModelEntry")
            if entry.ref in refs:
                raise ValueError("provider/model must be unique")
            refs.add(entry.ref)

    def register(self, entry: ProviderModelEntry) -> "ProviderModelCatalog":
        if not isinstance(entry, ProviderModelEntry):
            raise TypeError("entry must be ProviderModelEntry")
        if any(existing.ref == entry.ref for existing in self.entries):
            raise ValueError("provider/model is already registered")
        return ProviderModelCatalog(self.entries + (entry,), self.revision + 1)

    def get(self, ref: ProviderModelRef) -> ProviderModelEntry | None:
        if not isinstance(ref, ProviderModelRef):
            raise TypeError("ref must be ProviderModelRef")
        return next((entry for entry in self.entries if entry.ref == ref), None)


@dataclass(frozen=True, slots=True)
class FallbackPolicy:
    """An explicit, ordered list of routes to try after normal selection."""

    ordered_fallbacks: tuple[ProviderModelRef, ...]

    def __post_init__(self) -> None:
        if not isinstance(self.ordered_fallbacks, tuple):
            raise TypeError("ordered_fallbacks must be a tuple")
        if len(set(self.ordered_fallbacks)) != len(self.ordered_fallbacks):
            raise ValueError("fallback routes must be unique")
        for ref in self.ordered_fallbacks:
            if not isinstance(ref, ProviderModelRef):
                raise TypeError("ordered_fallbacks must contain ProviderModelRef")


@dataclass(frozen=True, slots=True)
class RoutingProvenance:
    capability: str
    catalog_revision: int
    selected: ProviderModelRef
    score: float
    rationale: str
    considered: tuple[ProviderModelRef, ...]
    inputs: tuple[tuple[str, str], ...]


@dataclass(frozen=True, slots=True)
class BenchmarkRecord:
    capability: str
    route: ProviderModelRef
    quality: float
    cost: float
    latency: float
    measured_at: str

    def __post_init__(self) -> None:
        _text(self.capability, "capability")
        if not isinstance(self.route, ProviderModelRef):
            raise TypeError("route must be ProviderModelRef")
        _number(self.quality, "quality")
        _number(self.cost, "cost")
        _number(self.latency, "latency")
        _text(self.measured_at, "measured_at")


class CapabilityRouter:
    def route(
        self,
        profile: CapabilityProfile,
        catalog: ProviderModelCatalog,
        fallback_policy: FallbackPolicy | None = None,
        *,
        catalog_revision: int | None = None,
        budget: float | None = None,
    ) -> RoutingProvenance:
        if not isinstance(profile, CapabilityProfile) or not isinstance(catalog, ProviderModelCatalog):
            raise TypeError("profile and catalog have invalid types")
        expected = profile.catalog_revision if catalog_revision is None else catalog_revision
        if type(expected) is not int or expected < 1:
            raise ValueError("catalog_revision must be a positive integer")
        if expected != catalog.revision:
            raise ValueError("stale catalog revision")
        limit = profile.budget if budget is None else budget
        if limit is not None:
            _number(limit, "budget")
        eligible = [entry for entry in catalog.entries if self._eligible(entry, profile, limit)]
        if not eligible:
            raise LookupError("no eligible provider/model route")
        scored = sorted(eligible, key=lambda entry: (-self._score(entry, profile), entry.provider, entry.model))
        primary = scored[0]
        selected = primary
        rationale = "selected highest deterministic score among eligible routes"
        considered = [entry.ref for entry in scored]
        if fallback_policy is not None:
            for ref in fallback_policy.ordered_fallbacks:
                entry = catalog.get(ref)
                if entry is None:
                    raise ValueError("fallback route is not registered")
                if not self._eligible(entry, profile, limit):
                    raise ValueError("fallback route violates capability, health, or budget constraints")
                considered.append(ref)
        score = self._score(selected, profile)
        return RoutingProvenance(
            profile.capability, catalog.revision, selected.ref, score, rationale,
            tuple(dict.fromkeys(considered)),
            (("quality_priority", str(profile.quality_priority)), ("cost_priority", str(profile.cost_priority)), ("latency_priority", str(profile.latency_priority))),
        )

    @staticmethod
    def _eligible(entry: ProviderModelEntry, profile: CapabilityProfile, budget: float | None) -> bool:
        return (
            profile.capability in entry.capabilities
            and entry.healthy
            and (not profile.allowed_providers or entry.provider in profile.allowed_providers)
            and (not profile.allowed_models or entry.model in profile.allowed_models)
            and (budget is None or entry.cost <= budget)
        )

    @staticmethod
    def _score(entry: ProviderModelEntry, profile: CapabilityProfile) -> float:
        return profile.quality_priority * entry.quality - profile.cost_priority * entry.cost - profile.latency_priority * entry.latency
