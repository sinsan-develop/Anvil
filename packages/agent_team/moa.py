"""Credential-free, deterministic capability based MoA routing."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math

def _text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip(): raise ValueError(f"{field} must be a canonical non-empty string")
def _texts(values: frozenset[str], field: str) -> None:
    if not isinstance(values, frozenset): raise TypeError(f"{field} must be a frozenset")
    for value in values: _text(value, field)
def _number(value: float, field: str, *, minimum: float = 0.0) -> None:
    if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or value < minimum: raise ValueError(f"{field} must be a finite number >= {minimum}")
def _iso(value: str, field: str = "timestamp") -> None:
    _text(value, field)
    try: datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc: raise ValueError(f"{field} must be ISO-8601") from exc
def _canonical(value: object) -> str: return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
def _sha(value: object) -> str: return hashlib.sha256(_canonical(value).encode()).hexdigest()

@dataclass(frozen=True, slots=True, order=True)
class ProviderModelRef:
    provider: str; model: str
    def __post_init__(self) -> None: _text(self.provider,"provider"); _text(self.model,"model")

@dataclass(frozen=True, slots=True)
class CapabilityProfile:
    capability: str; quality_priority: float = 1.0; cost_priority: float = 1.0; latency_priority: float = 1.0
    allowed_providers: frozenset[str] = frozenset(); allowed_models: frozenset[str] = frozenset(); budget: float|None = None; catalog_revision: int = 1
    privacy_class: str = "standard"; allowed_regions: frozenset[str] = frozenset(); max_retention_days: int|None = None; require_zdr: bool = False; max_latency: float|None = None; require_fresh_probe: bool = False
    def __post_init__(self) -> None:
        _text(self.capability,"capability")
        for name in ("quality_priority","cost_priority","latency_priority"): _number(getattr(self,name),name)
        _texts(self.allowed_providers,"allowed_providers"); _texts(self.allowed_models,"allowed_models"); _texts(self.allowed_regions,"allowed_regions"); _text(self.privacy_class,"privacy_class")
        if self.budget is not None: _number(self.budget,"budget")
        if self.max_latency is not None: _number(self.max_latency,"max_latency")
        if self.max_retention_days is not None and (type(self.max_retention_days) is not int or self.max_retention_days < 0): raise ValueError("max_retention_days must be non-negative")
        if type(self.require_zdr) is not bool or type(self.require_fresh_probe) is not bool: raise TypeError("boolean policy fields must be bool")
        if type(self.catalog_revision) is not int or self.catalog_revision < 1: raise ValueError("catalog_revision must be a positive integer")

@dataclass(frozen=True, slots=True)
class ProviderModelEntry:
    provider: str; model: str; capabilities: frozenset[str]; healthy: bool = True; cost: float = 0.0; quality: float = 0.0; latency: float = 0.0
    privacy_classes: frozenset[str] = frozenset({"standard"}); regions: frozenset[str] = frozenset({"global"}); retention_days: int = 0; zdr: bool = False; probe_at: str|None = None; probe_ttl_seconds: int = 3600
    def __post_init__(self) -> None:
        _text(self.provider,"provider"); _text(self.model,"model"); _texts(self.capabilities,"capabilities"); _texts(self.privacy_classes,"privacy_classes"); _texts(self.regions,"regions")
        if type(self.healthy) is not bool or type(self.zdr) is not bool: raise TypeError("healthy/zdr must be bool")
        for name in ("cost","quality","latency"): _number(getattr(self,name),name)
        if type(self.retention_days) is not int or self.retention_days < 0: raise ValueError("retention_days must be non-negative")
        if type(self.probe_ttl_seconds) is not int or self.probe_ttl_seconds <= 0: raise ValueError("probe_ttl_seconds must be positive")
        if self.probe_at is not None:
            _iso(self.probe_at,"probe_at")
            probe = datetime.fromisoformat(self.probe_at.replace("Z", "+00:00"))
            if probe.tzinfo is None or probe.utcoffset() is None or probe.utcoffset() != timezone.utc.utcoffset(probe): raise ValueError("probe_at must be timezone-aware UTC")
    @property
    def ref(self) -> ProviderModelRef: return ProviderModelRef(self.provider,self.model)
    def as_dict(self) -> dict[str,object]: return {"provider":self.provider,"model":self.model,"capabilities":sorted(self.capabilities),"healthy":self.healthy,"cost":self.cost,"quality":self.quality,"latency":self.latency,"privacy_classes":sorted(self.privacy_classes),"regions":sorted(self.regions),"retention_days":self.retention_days,"zdr":self.zdr,"probe_at":self.probe_at,"probe_ttl_seconds":self.probe_ttl_seconds}

@dataclass(frozen=True, slots=True)
class ProviderModelCatalog:
    entries: tuple[ProviderModelEntry,...] = (); revision: int = 1
    def __post_init__(self) -> None:
        if type(self.revision) is not int or self.revision < 1: raise ValueError("revision must be a positive integer")
        if not isinstance(self.entries,tuple): raise TypeError("entries must be a tuple")
        refs:set[ProviderModelRef] = set()
        for entry in self.entries:
            if not isinstance(entry,ProviderModelEntry): raise TypeError("entries must contain ProviderModelEntry")
            if entry.ref in refs: raise ValueError("provider/model must be unique")
            refs.add(entry.ref)
    @property
    def snapshot_hash(self) -> str: return _sha({"revision":self.revision,"entries":[e.as_dict() for e in sorted(self.entries,key=lambda e:(e.provider,e.model))]})
    def register(self,entry:ProviderModelEntry)->"ProviderModelCatalog":
        if not isinstance(entry,ProviderModelEntry): raise TypeError("entry must be ProviderModelEntry")
        if any(e.ref == entry.ref for e in self.entries): raise ValueError("provider/model is already registered")
        return ProviderModelCatalog(self.entries+(entry,),self.revision+1)
    def get(self,ref:ProviderModelRef)->ProviderModelEntry|None:
        if not isinstance(ref,ProviderModelRef): raise TypeError("ref must be ProviderModelRef")
        return next((e for e in self.entries if e.ref == ref),None)
    def detect_drift(self,expected_snapshot_hash:str)->None:
        _text(expected_snapshot_hash,"expected_snapshot_hash")
        if expected_snapshot_hash != self.snapshot_hash: raise ValueError("provider/model catalog drift")

@dataclass(frozen=True, slots=True)
class FallbackPolicy:
    ordered_fallbacks: tuple[ProviderModelRef,...]; max_total_cost: float|None = None; max_attempts: int|None = None
    def __post_init__(self)->None:
        if not isinstance(self.ordered_fallbacks,tuple): raise TypeError("ordered_fallbacks must be a tuple")
        if len(set(self.ordered_fallbacks)) != len(self.ordered_fallbacks): raise ValueError("fallback routes must be unique")
        if any(not isinstance(r,ProviderModelRef) for r in self.ordered_fallbacks): raise TypeError("fallback routes must contain ProviderModelRef")
        if self.max_total_cost is not None: _number(self.max_total_cost,"max_total_cost")
        if self.max_attempts is not None and (type(self.max_attempts) is not int or self.max_attempts < 1): raise ValueError("max_attempts must be positive")

@dataclass(frozen=True, slots=True)
class RoutingProvenance:
    capability: str; catalog_revision: int; selected: ProviderModelRef; score: float; rationale: str; considered: tuple[ProviderModelRef,...]; inputs: tuple[tuple[str,str],...]; snapshot_hash: str = ""; fallback: tuple[ProviderModelRef,...] = ()
    def __post_init__(self)->None:
        _text(self.capability,"capability"); _text(self.rationale,"rationale")
        if isinstance(self.score,bool) or not isinstance(self.score,(int,float)) or not math.isfinite(self.score): raise ValueError("score must be finite")
        if self.snapshot_hash: _text(self.snapshot_hash,"snapshot_hash")

@dataclass(frozen=True, slots=True)
class BenchmarkRecord:
    capability: str; route: ProviderModelRef; quality: float; cost: float; latency: float; measured_at: str; snapshot_hash: str = ""
    def __post_init__(self)->None:
        _text(self.capability,"capability")
        if not isinstance(self.route,ProviderModelRef): raise TypeError("route must be ProviderModelRef")
        _number(self.quality,"quality"); _number(self.cost,"cost"); _number(self.latency,"latency"); _iso(self.measured_at,"measured_at")
        if self.snapshot_hash: _text(self.snapshot_hash,"snapshot_hash")
    def bind(self,catalog:ProviderModelCatalog)->"BenchmarkRecord": return BenchmarkRecord(self.capability,self.route,self.quality,self.cost,self.latency,self.measured_at,catalog.snapshot_hash)

class CapabilityRouter:
    def route(self,profile:CapabilityProfile,catalog:ProviderModelCatalog,fallback_policy:FallbackPolicy|None=None,*,catalog_revision:int|None=None,budget:float|None=None,now:datetime|None=None)->RoutingProvenance:
        if not isinstance(profile,CapabilityProfile) or not isinstance(catalog,ProviderModelCatalog): raise TypeError("profile and catalog have invalid types")
        expected=profile.catalog_revision if catalog_revision is None else catalog_revision
        if expected != catalog.revision: raise ValueError("stale catalog revision")
        limit=profile.budget if budget is None else budget
        if limit is not None: _number(limit,"budget")
        current=now or datetime.now(timezone.utc)
        if current.tzinfo is None or current.utcoffset() is None or current.utcoffset() != timezone.utc.utcoffset(current): raise ValueError("now must be timezone-aware UTC")
        eligible=[e for e in catalog.entries if self._eligible(e,profile,limit,current)]
        if not eligible: raise LookupError("no eligible provider/model route")
        scored=sorted(eligible,key=lambda e:(-self._score(e,profile),e.provider,e.model)); selected=scored[0]; fallbacks=[]
        if fallback_policy:
            if fallback_policy.max_attempts is not None and len(fallback_policy.ordered_fallbacks)>fallback_policy.max_attempts: raise ValueError("fallback exceeds max_attempts")
            total=selected.cost
            for ref in fallback_policy.ordered_fallbacks:
                if ref == selected.ref: raise ValueError("fallback route duplicates primary")
                entry=catalog.get(ref)
                if entry is None or not self._eligible(entry,profile,limit,current): raise ValueError("fallback route violates policy")
                total+=entry.cost
                if (fallback_policy.max_total_cost is not None and total>fallback_policy.max_total_cost) or (limit is not None and total>limit): raise ValueError("fallback exceeds total budget")
                fallbacks.append(ref)
        considered=tuple(dict.fromkeys([e.ref for e in scored]+fallbacks))
        return RoutingProvenance(profile.capability,catalog.revision,selected.ref,self._score(selected,profile),"selected highest deterministic score among eligible routes",considered,(("quality_priority",str(profile.quality_priority)),("cost_priority",str(profile.cost_priority)),("latency_priority",str(profile.latency_priority)),("privacy_class",profile.privacy_class)),catalog.snapshot_hash,tuple(fallbacks))
    @staticmethod
    def _eligible(e:ProviderModelEntry,p:CapabilityProfile,budget:float|None,now:datetime)->bool:
        fresh=e.probe_at is not None and (now-datetime.fromisoformat(e.probe_at.replace("Z","+00:00"))).total_seconds()<=e.probe_ttl_seconds
        return p.capability in e.capabilities and e.healthy and (not p.allowed_providers or e.provider in p.allowed_providers) and (not p.allowed_models or e.model in p.allowed_models) and (not p.allowed_regions or bool(p.allowed_regions & e.regions)) and p.privacy_class in e.privacy_classes and (p.max_retention_days is None or e.retention_days<=p.max_retention_days) and (not p.require_zdr or e.zdr) and (p.max_latency is None or e.latency<=p.max_latency) and (budget is None or e.cost<=budget) and (not p.require_fresh_probe or fresh)
    @staticmethod
    def _score(e:ProviderModelEntry,p:CapabilityProfile)->float: return p.quality_priority*e.quality-p.cost_priority*e.cost-p.latency_priority*e.latency

def validate_benchmark(record:BenchmarkRecord,catalog:ProviderModelCatalog,*,max_age_seconds:int|None=None,now:datetime|None=None)->None:
    if record.snapshot_hash != catalog.snapshot_hash: raise ValueError("benchmark snapshot drift")
    entry=catalog.get(record.route)
    if entry is None: raise ValueError("benchmark route is not registered")
    if record.capability not in entry.capabilities: raise ValueError("benchmark capability does not match route")
    current=now or datetime.now(timezone.utc)
    measured=datetime.fromisoformat(record.measured_at.replace("Z","+00:00"))
    if measured.tzinfo is None or measured.utcoffset() is None or current.tzinfo is None or current.utcoffset() is None or measured > current: raise ValueError("benchmark measured_at must be timezone-aware and not future")
    if max_age_seconds is not None:
        if type(max_age_seconds) is not int or max_age_seconds<0: raise ValueError("max_age_seconds must be non-negative")
        if (current-measured).total_seconds()>max_age_seconds: raise ValueError("benchmark is stale")

__all__=["BenchmarkRecord","CapabilityProfile","CapabilityRouter","FallbackPolicy","ProviderModelCatalog","ProviderModelEntry","ProviderModelRef","RoutingProvenance","validate_benchmark"]
