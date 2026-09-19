"""Host-only F02 facade over D11's public registry. No provider/DB/network IO.

Discovery is an authenticated host observation, not a live probe. Context binding
consumes host-verified graph/permission/evidence/resume checksums; it does not mint
approvals or modify D11 activation, Run snapshots, queue, budgets or agent state.
"""
from datetime import datetime, timedelta
from decimal import Decimal
import json
from threading import RLock
from packages.knowledge.model_registry import ModelRegistry, ModelRegistryError, ROLES
from packages.knowledge.memory import to_primitive, _hash
from packages.provider_catalog.models import PROVIDER_IDS
from .models import (Snapshot, canonical, clean, contracts, digest, ident, provider, reject, run_ref, snapshot, utc)


def sealed(value):
    """Consume only the trusted D11 public detached result, never untrusted DTOs."""
    data=to_primitive(value)
    if type(data) is not dict or data.get('content_hash')!=_hash({k:v for k,v in data.items() if k!='content_hash'}): reject('OWNER_EVIDENCE_INVALID')
    return data


class DiscoveryRouter:
    def __init__(self,owner,context):
        if type(owner) is not ModelRegistry: reject('D11_OWNER_REQUIRED')
        self._owner=owner; self._context=context; self._lock=RLock()
        self._bindings={}; self._run_bindings={}; self._requests={}; self._audit=[]

    def discover(self,data,*,now):
        """Host-only: publication/identity/version/TTL authority remain in D11."""
        instant=utc(now); data=clean(data)
        if type(data) is not dict: reject('DISCOVERY_INVALID')
        provider(data.get('provider')); provider(data.get('upstream_provider'))
        with self._lock:
            try:
                capture=self._owner.capture_model(self._context,data,now=instant)
                result=sealed(self._owner.publish(self._context,'model',capture,now=instant))
            except ModelRegistryError as error: reject(error.reason)
            return snapshot('DISCOVERY',result['id'],result)

    def catalog(self,*,now):
        instant=utc(now)
        with self._lock:
            try: view=to_primitive(self._owner.query(self._context,now=instant))
            except ModelRegistryError as error: reject(error.reason)
            rows=[]
            for record in view['models'].values():
                r=sealed(record)
                if view['heads'].get('model:'+r['id'])!=r['content_hash']: continue
                model=r['data']; probe=model['probe']; observed=datetime.fromisoformat(probe['observed_at'])
                reason='HOST_OBSERVATION_ONLY' if observed<=instant<observed+timedelta(seconds=probe['ttl_seconds']) and probe['status']=='AVAILABLE' else 'STALE_OR_UNAVAILABLE'
                rows.append(dict(**r,availability_reason=reason,transport_status='NOT_EXECUTED'))
            rows.sort(key=lambda r:(PROVIDER_IDS.index(r['data']['provider']),r['data']['model_id'],r['id']))
            return snapshot('DISCOVERY_CATALOG','catalog',dict(models=rows,provider_ids=list(PROVIDER_IDS),io_count=0))

    def bind_context(self,context_id,snapshot_ref,contract):
        """Host-only binding, not a user-facing self-attestation API."""
        ident(context_id); data=dict(snapshot_ref=run_ref(snapshot_ref),contract=contracts(contract))
        value=snapshot('ROUTING_CONTEXT',context_id,data)
        with self._lock:
            key=tuple(data['snapshot_ref'][k] for k in ('session_id','task_id','run_id'))
            if key in self._run_bindings and self._run_bindings[key]!=value.payload_json: reject('RUN_CONTRACT_IMMUTABLE')
            old=self._bindings.get(context_id)
            if old and old!=(value.content_hash,value.payload_json): reject('CONTEXT_IMMUTABLE')
            self._run_bindings[key]=value.payload_json
            self._bindings[context_id]=(value.content_hash,value.payload_json)
            return value

    def _binding(self,value,reference):
        if type(value) is not Snapshot: reject('CONTEXT_INVALID')
        if any(type(v) is not str for v in (value.kind,value.record_id,value.content_hash,value.payload_json)): reject('CONTEXT_INVALID')
        if value.kind!='ROUTING_CONTEXT' or self._bindings.get(value.record_id)!=(value.content_hash,value.payload_json): reject('CONTEXT_INVALID')
        data=json.loads(value.payload_json)
        if data['snapshot_ref']!=reference or digest(data)!=value.content_hash: reject('CONTEXT_INVALID')
        return data

    @staticmethod
    def _entry(view,bucket,reference):
        record=view[bucket].get(reference['content_hash'])
        if record is None: reject('OWNER_EVIDENCE_INVALID')
        record=sealed(record)
        if {k:record[k] for k in ('id','version','content_hash')}!=reference: reject('OWNER_EVIDENCE_INVALID')
        return record

    def _route(self,selection,view,role,error,instant):
        if selection.get('status')!='PINNED': return 'BLOCKED_CAPABILITY_DRIFT',None,None
        activation=next((sealed(a) for a in view['activations'] if a['content_hash']==selection['activation_hash']),None)
        if activation is None or activation['routing']!=selection['routing']: return 'OWNER_EVIDENCE_INVALID',None,None
        if any(q['activation_hash']==selection['activation_hash'] for q in view['quarantine']): return 'BLOCKED_CAPABILITY_DRIFT',None,None
        route=next((r for r in selection['routing']['routes'] if r['role']==role),None)
        if route is None: return 'ROLE_NOT_APPROVED',None,None
        targets=[route,*route['fallback']['targets']]; models=[]
        for target in targets:
            model=self._entry(view,'models',target['model']); data=model['data']; probe=data['probe']
            observed=datetime.fromisoformat(probe['observed_at'])
            if view['heads'].get('model:'+model['id'])!=model['content_hash'] or probe['status']!='AVAILABLE' or not observed<=instant<observed+timedelta(seconds=probe['ttl_seconds']): return 'BLOCKED_CAPABILITY_DRIFT',None,None
            prompt=self._entry(view,'prompts',target['prompt']); bench=self._entry(view,'benchmarks',target['benchmark'])
            if (view['heads'].get('prompt:'+prompt['id'])!=prompt['content_hash'] or not bench.get('passed')
                    or bench['data']['target']!={k:target[k] for k in ('prompt','model')} or bench['data']['role']!=role): return 'OWNER_EVIDENCE_INVALID',None,None
            models.append(data)
        primary=models[0]
        if error is None: return 'SELECTED_NOT_SENT',primary,primary
        if error not in route['fallback']['on'] or error not in ('RATE_LIMIT','TIMEOUT','TEMPORARY_5XX') or len(models)<2: return 'FALLBACK_NOT_APPROVED',None,primary
        # Only the first explicitly approved target is considered; never search a weaker route.
        replacement=models[1]
        if (any(replacement[k]!=primary[k] for k in ('privacy_class','training_use','zdr','region','tools'))
                or replacement['retention_days']>primary['retention_days']
                or replacement['context_tokens']<primary['context_tokens']
                or not set(primary['capabilities'])<=set(replacement['capabilities'])
                or any(replacement['pricing'][k]!=primary['pricing'][k] for k in ('currency','unit'))
                or any(Decimal(replacement['pricing'][k])>Decimal(primary['pricing'][k]) for k in ('input','output'))):
            return 'FALLBACK_REAPPROVAL_REQUIRED',None,primary
        if role=='reviewer':
            primary_bench=self._entry(view,'benchmarks',targets[0]['benchmark'])['data']['samples']
            replacement_bench=self._entry(view,'benchmarks',targets[1]['benchmark'])['data']['samples']
            if min(Decimal(str(s['quality'])) for s in replacement_bench)<min(Decimal(str(s['quality'])) for s in primary_bench):
                return 'FALLBACK_REAPPROVAL_REQUIRED',None,primary
        return 'SELECTED_NOT_SENT',replacement,primary

    def select(self,*,request_id,snapshot_ref,context,role,adapter_id,now,error_code=None):
        ident(request_id); instant=utc(now); reference=run_ref(snapshot_ref)
        clean([role,adapter_id,error_code]); ident(role)
        if adapter_id not in ('codex','claude','local') or error_code is not None and type(error_code) is not str: reject('ROUTING_INPUT_INVALID')
        with self._lock:
            binding=self._binding(context,reference)
            request=dict(snapshot_ref=reference,context_hash=context.content_hash,role=role,adapter_id=adapter_id,error_code=error_code)
            request_hash=digest(request)
            if request_id in self._requests and self._requests[request_id][0]!=request_hash: reject('REPLAY_CONFLICT')
            selection={}; selected=None; origin=None
            try:
                raw=self._owner.run_guard(self._context,reference,now=instant)
                selection=to_primitive(raw)
                if selection.get('status')=='PINNED': selection=sealed(raw)
                view=to_primitive(self._owner.query(self._context,now=instant))
                reason,selected,origin=self._route(selection,view,role,error_code,instant)
                # All public owner calls precede a final exact authority fence.
                final_view=to_primitive(self._owner.query(self._context,now=instant))
                reason2,selected2,origin2=self._route(selection,final_view,role,error_code,instant)
                if (reason,selected,origin)!=(reason2,selected2,origin2):
                    reason,selected='BLOCKED_CAPABILITY_DRIFT',None
            except ModelRegistryError as error: reason=error.reason
            status='SELECTED_NOT_SENT' if selected is not None and reason=='SELECTED_NOT_SENT' else 'BLOCKED'
            row=dict(request_id=request_id,status=status,reason=reason,contract=binding['contract'],
                activation_hash=selection.get('activation_hash'),selection_hash=selection.get('content_hash'),
                approval_boundary='D11_HOST_APPROVED_PIN',adapter_id=adapter_id,role=role,error_code=error_code,
                origin_provider=origin['provider'] if origin else None,provider=selected['provider'] if selected else None,
                model_id=selected['model_id'] if selected else None,model_snapshot_hash=digest(selected) if selected else None,
                capability_delta=sorted(set(selected['capabilities'])-set(origin['capabilities'])) if selected and origin else [],
                next_action='REPROBE_BENCHMARK_HUMAN_APPROVAL' if reason=='BLOCKED_CAPABILITY_DRIFT' else 'NONE',
                io_count=0,main_acceptance=False,request_hash=request_hash)
            row['content_hash']=digest(row)
            response=snapshot('ROUTING_DECISION',request_id,row)
            old=self._requests.get(request_id)
            if old and old[1]==response.payload_json: return response
            audit=dict(sequence=len(self._audit)+1,request_id=request_id,decision_hash=row['content_hash'],
                status=status,reason=reason,origin_provider=row['origin_provider'],provider=row['provider'],error_code=error_code)
            encoded=canonical(audit)
            self._requests[request_id]=(request_hash,response.payload_json)
            self._audit.append(encoded)
            return response

    def audit(self,*,after=0,limit=100):
        if type(after) is not int or after<0 or type(limit) is not int or not 1<=limit<=100: reject('PAGE_INVALID')
        with self._lock:
            rows=[json.loads(v) for v in self._audit[after:after+limit]]
            return snapshot('ROUTING_AUDIT','audit',dict(events=rows,next_sequence=after+len(rows),has_more=after+len(rows)<len(self._audit)))
