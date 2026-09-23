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
        measured = datetime.fromisoformat(self.measured_at.replace("Z", "+00:00"))
        if measured.tzinfo is None or measured.utcoffset() is None or measured.utcoffset() != timezone.utc.utcoffset(measured): raise ValueError("measured_at must be timezone-aware UTC")
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
            if fallback_policy.max_attempts is not None and 1 + len(fallback_policy.ordered_fallbacks)>fallback_policy.max_attempts: raise ValueError("fallback exceeds max_attempts including primary")
            total=selected.cost
            if fallback_policy.max_total_cost is not None and total>fallback_policy.max_total_cost: raise ValueError("primary exceeds total budget")
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
        probe_time = datetime.fromisoformat(e.probe_at.replace("Z", "+00:00")) if e.probe_at is not None else None
        fresh = probe_time is not None and probe_time <= now and (now-probe_time).total_seconds()<=e.probe_ttl_seconds
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


# v2.8 separates deliberation from the legacy capability scoring API above.
from .provider_catalog import _C24Records,_c24_text,_c24_hash,_utc,_snapshot,_digest,_clean,_json


class MoADeliberation(_C24Records):
    """C23 completed observations -> bounded Main synthesis, never approval.

    No model calls, prompt execution, billing or runtime retry. C23 owns timeout,
    failure/cost state and C22 current authority; this layer only consumes it.
    """
    def __init__(self,team,*,quorum,deadline):
        from .orchestration import RoleTeamOrchestrator
        if type(team) is not RoleTeamOrchestrator:raise ValueError('CANONICAL_TEAM_REQUIRED')
        if type(quorum) is not int or not 1<=quorum<=16:raise ValueError('QUORUM_INVALID')
        super().__init__();self._team=team;self._quorum=quorum;self._deadline=_utc(deadline)
        view=team.project().to_dict()
        if not view['plan_hash']:raise ValueError('TEAM_PLAN_REQUIRED')
        self._identity=(view['session'],view['target_hash'],view['plan_hash'])
        self._proposals={};self._critiques={};self._syntheses={}

    def _view(self,now):
        if _utc(now)>=self._deadline:raise ValueError('DELIBERATION_EXPIRED')
        view=self._team.project().to_dict()
        if (view['session'],view['target_hash'],view['plan_hash'])!=self._identity:raise ValueError('TEAM_TRACE_DRIFT')
        if view['status'] in ('CANCELLED','REVIEW_REQUIRED'):raise ValueError('TEAM_PARTIAL_FAILURE')
        return view

    def _participant(self,task_id,actor_id,execution_fence,now):
        for v in (task_id,actor_id,execution_fence):_c24_text(v,128)
        view=self._view(now)
        self._team.mailbox(task_id,actor_id=actor_id,execution_fence=execution_fence,now=now)
        row=view['tasks'].get(task_id)
        if row is None or row['status']!='COMPLETED' or not row['result_hash']:raise ValueError('COMPLETED_ROLE_RESULT_REQUIRED')
        return dict(task_id=task_id,actor_id=actor_id,execution_fence=execution_fence,assignment_hash=row['assignment_hash'],
            result_hash=row['result_hash'],parent_task_id=row['parent_task_id'],binding_hash=row['binding_hash'])

    @staticmethod
    def _metadata(summary,evidence_refs):
        _c24_text(summary)
        refs=_clean(evidence_refs)
        if type(refs) is not list or not 1<=len(refs)<=16:raise ValueError('EVIDENCE_REQUIRED')
        for ref in refs:_c24_hash(ref)
        if len(set(refs))!=len(refs):raise ValueError('EVIDENCE_CONFLICT')
        return sorted(refs)

    def propose(self,*,proposal_id,task_id,actor_id,execution_fence,summary,evidence_refs,now):
        _c24_text(proposal_id,128);refs=self._metadata(summary,evidence_refs)
        with self._lock:
            authority=self._participant(task_id,actor_id,execution_fence,now)
            row=dict(**authority,summary=summary,evidence_refs=refs,session_id=self._identity[0]['session_id'],
                baseline_hash=self._identity[0]['baseline_hash'],target_hash=self._identity[1],plan_hash=self._identity[2])
            receipt=self._save('MOA_PROPOSAL',proposal_id,row)
            self._proposals[proposal_id]=receipt.payload_json
            return receipt

    def critique(self,*,critique_id,proposal,task_id,actor_id,execution_fence,verdict,summary,evidence_refs,now):
        _c24_text(critique_id,128);refs=self._metadata(summary,evidence_refs);_c24_text(verdict,32)
        if verdict not in ('SUPPORT','OBJECT'):raise ValueError('VERDICT_INVALID')
        with self._lock:
            source=self._record(proposal,'MOA_PROPOSAL')
            authority=self._participant(task_id,actor_id,execution_fence,now)
            self._participant(source['task_id'],source['actor_id'],source['execution_fence'],now)
            if source['actor_id']==actor_id:raise ValueError('INDEPENDENT_CRITIQUE_REQUIRED')
            row=dict(**authority,proposal_id=proposal.record_id,proposal_hash=proposal.content_hash,verdict=verdict,
                summary=summary,evidence_refs=refs)
            for key,payload in self._critiques.items():
                prior=_json.loads(payload)
                if key!=critique_id and prior['proposal_id']==proposal.record_id and prior['actor_id']==actor_id:raise ValueError('DUPLICATE_VOTER')
            receipt=self._save('MOA_CRITIQUE',critique_id,row);self._critiques[critique_id]=receipt.payload_json
            return receipt

    def synthesize(self,*,request_id,actor_id,now):
        _c24_text(request_id,128);_c24_text(actor_id,128)
        with self._lock:
            view=self._view(now)
            if actor_id!=view['session']['leader_id']:raise ValueError('MAIN_AUTHORITY_REQUIRED')
            proposals={k:_json.loads(v) for k,v in sorted(self._proposals.items())}
            critiques={k:_json.loads(v) for k,v in sorted(self._critiques.items())}
            for row in [*proposals.values(),*critiques.values()]:
                current=self._participant(row['task_id'],row['actor_id'],row['execution_fence'],now)
                if any(current[k]!=row[k] for k in current):raise ValueError('PROVENANCE_CONFLICT')
            winners=[]
            for key in proposals:
                votes=[v for v in critiques.values() if v['proposal_id']==key]
                if any(v['verdict']=='OBJECT' for v in votes):raise ValueError('CONFLICT_UNRESOLVED')
                if len({v['actor_id'] for v in votes})>=self._quorum:winners.append(key)
            if not winners:raise ValueError('QUORUM_NOT_REACHED')
            if len(winners)!=1:raise ValueError('CONFLICT_UNRESOLVED')
            row=dict(status='SYNTHESIZED_FOR_MAIN',selected_proposal_id=winners[0],quorum=self._quorum,
                session_id=view['session']['session_id'],baseline_hash=view['session']['baseline_hash'],target_hash=view['target_hash'],
                team_projection_hash=self._team.project().content_hash,proposals=proposals,critiques=critiques,
                final_owner=actor_id,spent=view['spent'],unverified=['Provider/runtime NOT_EXECUTED'],
                io_count=0,automatic_acceptance=False,provider_selection=None)
            return self._save('MOA_SYNTHESIS',request_id,row)

    def project(self):
        with self._lock:
            return _snapshot('MOA_PROGRESS','progress',dict(proposals=[dict(id=k,**_json.loads(v)) for k,v in sorted(self._proposals.items())],
                critiques=[dict(id=k,**_json.loads(v)) for k,v in sorted(self._critiques.items())],
                quorum=self._quorum,final_owner=self._identity[0]['leader_id'],automatic_acceptance=False,io_count=0))


__all__ += ['MoADeliberation']
