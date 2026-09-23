"""Canonical, credential-free provider catalog for successor MoA routing.

This module contains identifiers and configuration-key names only.  It never
reads or emits secret values and never performs provider/network I/O.
"""

from __future__ import annotations

from dataclasses import dataclass


CANONICAL_PROVIDER_IDS: tuple[str, ...] = (
    "cerebras", "groq", "mistral", "openrouter", "upstage",
    "gemini", "anthropic", "openai", "ollama",
)
PRIMARY_PROVIDER_ID = "upstage"

SUPPORTED_PROVIDERS: tuple[str, ...] = (
    "CEREBRAS", "GROQ", "MISTRAL", "OPENROUTER", "UPSTAGE",
    "GEMINI", "ANTHROPIC", "OPENAI", "OLLAMA",
)
PRIMARY_PROVIDER = "UPSTAGE"

# Names are placeholders for a later Secret Broker/config implementation.
# Values must never be placed in source, reports, logs, or browser payloads.
PROVIDER_CREDENTIAL_KEYS: dict[str, str] = {
    "CEREBRAS": "CEREBRAS_API_KEY",
    "GROQ": "GROQ_API_KEY",
    "MISTRAL": "MISTRAL_API_KEY",
    "OPENROUTER": "OPENROUTER_API_KEY",
    "UPSTAGE": "UPSTAGE_API_KEY",
    "GEMINI": "GEMINI_API_KEY",
    "ANTHROPIC": "ANTHROPIC_API_KEY",
    "OPENAI": "OPENAI_API_KEY",
    "OLLAMA": "OLLAMA_BASE_URL",
}


@dataclass(frozen=True, slots=True)
class ProviderCatalogEntry:
    provider_id: str
    credential_key: str
    configured: bool = False


@dataclass(frozen=True, slots=True)
class ProviderDefinition:
    provider_id: str
    display_name: str
    primary: bool


def provider_definitions() -> tuple[ProviderDefinition, ...]:
    """Return the public canonical provider catalog in stable display order."""
    return tuple(
        ProviderDefinition(provider_id, provider_id.upper(), provider_id == PRIMARY_PROVIDER_ID)
        for provider_id in CANONICAL_PROVIDER_IDS
    )


def catalog_entries() -> tuple[ProviderCatalogEntry, ...]:
    """Return stable display order without resolving credentials."""
    return tuple(
        ProviderCatalogEntry(provider, PROVIDER_CREDENTIAL_KEYS[provider])
        for provider in SUPPORTED_PROVIDERS
    )


def ordered_candidates(
    eligible: tuple[str, ...] | list[str],
    *,
    explicit_provider: str | None = None,
) -> tuple[str, ...]:
    """Return a deterministic route order with explicit override support.

    UPSTAGE is preferred when eligible. An explicit provider is placed first,
    but must itself be eligible; no implicit provider is forced over the
    capability/privacy/egress eligibility result supplied by the caller.
    """
    eligible_set = set(eligible)
    if not eligible_set.issubset(set(SUPPORTED_PROVIDERS)):
        raise ValueError("eligible contains unsupported provider")
    if explicit_provider is not None:
        if explicit_provider not in eligible_set:
            raise LookupError("explicit provider is not eligible")
        first = (explicit_provider,)
    elif PRIMARY_PROVIDER in eligible_set:
        first = (PRIMARY_PROVIDER,)
    else:
        first = ()
    remainder = tuple(provider for provider in SUPPORTED_PROVIDERS if provider in eligible_set and provider not in first)
    return first + remainder


__all__ = [
    "CANONICAL_PROVIDER_IDS", "PRIMARY_PROVIDER", "PRIMARY_PROVIDER_ID",
    "PROVIDER_CREDENTIAL_KEYS", "ProviderCatalogEntry", "ProviderDefinition",
    "SUPPORTED_PROVIDERS", "catalog_entries", "ordered_candidates",
    "provider_definitions",
]


# C24 adapter boundaries. Legacy catalog functions above remain compatible.
import json as _json
import re as _re
from decimal import Decimal as _Decimal
from threading import RLock as _RLock
from packages.provider_catalog.models import Snapshot as _Snapshot, clean as _clean, digest as _digest, snapshot as _snapshot
from packages.model_registry.models import utc as _utc, clean as _profile_clean


def _c24_text(value, limit=2048):
    if type(value) is not str or not value.strip() or value!=value.strip() or len(value.encode('utf-8'))>limit:
        raise ValueError('INPUT_INVALID')
    _clean(value)
    return value


def _c24_hash(value):
    if type(value) is not str or _re.fullmatch(r'sha256:[0-9a-f]{64}',value) is None:
        raise ValueError('HASH_INVALID')
    return value


def _c24_read(value):
    if type(value) is not _Snapshot or any(type(v) is not str for v in
        (value.kind,value.record_id,value.content_hash,value.payload_json)):
        raise ValueError('HANDLE_INVALID')
    if len(value.payload_json.encode('utf-8'))>1048576: raise ValueError('INPUT_BOUND_EXCEEDED')
    try:data=_json.loads(value.payload_json)
    except ValueError:raise ValueError('HANDLE_INVALID') from None
    if _digest(data)!=value.content_hash:raise ValueError('HANDLE_INVALID')
    return data


class _C24Records:
    def __init__(self):self._records={};self._lock=_RLock()

    def _save(self,kind,key,data):
        _c24_text(key,128)
        receipt=_snapshot(kind,key,data);old=self._records.get((kind,key))
        if old is not None and old!=(receipt.content_hash,receipt.payload_json):raise ValueError('REPLAY_CONFLICT')
        if old is None and len(self._records)>=256:raise ValueError('RECORD_BOUND_EXCEEDED')
        self._records[(kind,key)]=(receipt.content_hash,receipt.payload_json)
        return receipt

    def _record(self,handle,kind):
        data=_c24_read(handle)
        if handle.kind!=kind or self._records.get((kind,handle.record_id))!=(handle.content_hash,handle.payload_json):
            raise ValueError('HANDLE_INVALID')
        return data


class CapabilityCatalog(_C24Records):
    """Read-only F01/F02 consumer; never publishes discovery or selects a run."""
    def __init__(self,providers,models):
        from packages.provider_catalog import ProviderCatalog
        from packages.model_registry import DiscoveryRouter
        if type(providers) is not ProviderCatalog or type(models) is not DiscoveryRouter:
            raise ValueError('CANONICAL_CATALOG_OWNER_REQUIRED')
        super().__init__();self._providers=providers;self._models=models

    def _view(self,now):
        _utc(now)
        providers=self._providers.catalog();models=self._models.catalog(now=now)
        p=_c24_read(providers);m=_c24_read(models)
        if any(row['availability_reason']!='HOST_OBSERVATION_ONLY' for row in m['models']):raise ValueError('CATALOG_STALE')
        allowed={r['provider_id'] for r in p['providers'] if r['enabled_by_product']}
        rows=m['models']
        if len(rows)>128 or any(r['data']['provider'] not in allowed for r in rows):raise ValueError('PROVIDER_DENIED')
        keys=[(r['data']['provider'],r['data']['model_id']) for r in rows]
        if len(set(keys))!=len(keys):raise ValueError('CONFLICTING_PROVENANCE')
        return dict(provider_catalog_hash=providers.content_hash,model_catalog_hash=models.content_hash,
            models=rows,io_count=0,transport_status='NOT_EXECUTED')

    def capture(self,catalog_id,*,now):
        _c24_text(catalog_id,128)
        with self._lock:
            value=self._view(now)
            if self._view(now)!=value:raise ValueError('CATALOG_DRIFT')
            return self._save('CAPABILITY_CATALOG',catalog_id,value)

    def current(self,handle,*,now):
        with self._lock:
            value=self._record(handle,'CAPABILITY_CATALOG')
            if self._view(now)!=value:raise ValueError('CATALOG_DRIFT')
            return _snapshot(handle.kind,handle.record_id,value)


def _c24_profile(value):
    p=_profile_clean(value)
    required={'capability','privacy_class','allowed_regions','max_retention_days','training_use','require_zdr',
        'max_input_price','max_output_price','currency','pricing_unit','minimum_context_tokens','required_tools'}
    if type(p) is not dict or set(p)!=required:raise ValueError('CAPABILITY_PROFILE_INVALID')
    for key in ('capability','privacy_class','currency','pricing_unit'):_c24_text(p[key],128)
    for key in ('allowed_regions','required_tools'):
        if type(p[key]) is not list or len(p[key])>32 or any(type(v) is not str for v in p[key]) or len(set(p[key]))!=len(p[key]):raise ValueError('CAPABILITY_PROFILE_INVALID')
        for v in p[key]:_c24_text(v,128)
        p[key]=sorted(p[key])
    if not p['allowed_regions']:raise ValueError('REGION_REQUIRED')
    for key in ('max_retention_days','minimum_context_tokens'):
        if type(p[key]) is not int or not 0<=p[key]<=10**9:raise ValueError('CAPABILITY_PROFILE_INVALID')
    if p['minimum_context_tokens']==0 or type(p['training_use']) is not bool or type(p['require_zdr']) is not bool:raise ValueError('CAPABILITY_PROFILE_INVALID')
    for key in ('max_input_price','max_output_price'):
        if type(p[key]) is not str or _re.fullmatch(r'\d{1,12}(?:\.\d{1,12})?',p[key]) is None:raise ValueError('COST_INVALID')
    return p


def _c24_route(value):
    if type(value) is not tuple or len(value)!=2:raise ValueError('ROUTE_INVALID')
    for v in value:_c24_text(v,128)
    if value[0] not in CANONICAL_PROVIDER_IDS:raise ValueError('PROVIDER_DENIED')
    return list(value)


class CapabilityAdmissionRouter(_C24Records):
    """Host-only proposal admission. Approval capture is not human authentication.

    Fallback capture consumes an already authenticated human decision and quality
    comparison checksum; it never grants runtime/billing/egress permission.
    """
    def __init__(self,catalog,quota):
        from .provider_status import QuotaObservations
        if type(catalog) is not CapabilityCatalog or type(quota) is not QuotaObservations:raise ValueError('CANONICAL_OWNER_REQUIRED')
        super().__init__();self._catalog=catalog;self._quota=quota;self._requests={}

    @staticmethod
    def _model(data,route):
        matches=[r for r in data['models'] if [r['data']['provider'],r['data']['model_id']]==route]
        if len(matches)!=1:raise ValueError('MODEL_NOT_REGISTERED')
        return matches[0]

    @staticmethod
    def _eligible(m,p):
        if p['capability'] not in m['capabilities'] or not set(p['required_tools'])<=set(m['tools']) or m['context_tokens']<p['minimum_context_tokens']:return 'CAPABILITY_DENIED'
        if m['region'] not in p['allowed_regions']:return 'REGION_DENIED'
        if (m['privacy_class']!=p['privacy_class'] or m['training_use']!=p['training_use'] or m['retention_days']>p['max_retention_days'] or p['require_zdr'] and not m['zdr']):return 'PRIVACY_DENIED'
        if m['pricing']['currency']!=p['currency'] or m['pricing']['unit']!=p['pricing_unit'] or any(_Decimal(m['pricing'][k])>_Decimal(p['max_'+k+'_price']) for k in ('input','output')):return 'COST_DENIED'
        return None

    @staticmethod
    def _degradation(origin,target):
        delta=[]
        for key in ('privacy_class','training_use','zdr','region','benchmark_revision'):
            if origin[key]!=target[key]:delta.append(key)
        if target['retention_days']>origin['retention_days']:delta.append('retention_days')
        if target['context_tokens']<origin['context_tokens']:delta.append('context_tokens')
        for key in ('capabilities','tools'):
            if not set(origin[key])<=set(target[key]):delta.append(key)
        if any(origin['pricing'][k]!=target['pricing'][k] for k in ('currency','unit')) or any(_Decimal(target['pricing'][k])>_Decimal(origin['pricing'][k]) for k in ('input','output')):delta.append('price')
        return sorted(delta)

    def capture_fallback(self,approval_id,*,catalog,profile,primary,ordered_targets,human_approval_id,quality_evidence_hash,now,expires_at):
        _c24_text(approval_id,128);_c24_text(human_approval_id,128);_c24_hash(quality_evidence_hash)
        instant=_utc(now);expiry=_utc(expires_at);p=_c24_profile(profile);origin=_c24_route(primary)
        if not instant<expiry:raise ValueError('FALLBACK_APPROVAL_EXPIRED')
        if type(ordered_targets) is not tuple or not 1<=len(ordered_targets)<=8:raise ValueError('FALLBACK_INVALID')
        targets=[_c24_route(v) for v in ordered_targets]
        if len({tuple(v) for v in [origin,*targets]})!=1+len(targets):raise ValueError('FALLBACK_INVALID')
        with self._lock:
            data=self._catalog.current(catalog,now=now).to_dict();base=self._model(data,origin)['data']
            if self._eligible(base,p):raise ValueError('FALLBACK_REAPPROVAL_REQUIRED')
            for target in targets:
                m=self._model(data,target)['data']
                if self._eligible(m,p) or self._degradation(base,m):raise ValueError('FALLBACK_REAPPROVAL_REQUIRED')
            row=dict(catalog_hash=catalog.content_hash,profile_hash=_digest(p),primary=origin,ordered_targets=targets,
                human_approval_id=human_approval_id,quality_evidence_hash=quality_evidence_hash,issued_at=instant.isoformat(),expires_at=expiry.isoformat())
            self._catalog.current(catalog,now=now)
            return self._save('FALLBACK_APPROVAL',approval_id,row)

    def route(self,*,request_id,catalog,profile,primary,proposal_hash,prompt_contract_hash,now,error_code=None,fallback=None):
        _c24_text(request_id,128);p=_c24_profile(profile);origin=_c24_route(primary);instant=_utc(now)
        _c24_hash(proposal_hash);_c24_hash(prompt_contract_hash)
        if error_code is not None:_c24_text(error_code,128)
        with self._lock:
            approved=self._record(fallback,'FALLBACK_APPROVAL') if fallback is not None else None
            data=self._catalog.current(catalog,now=now).to_dict()
            selected=origin;reason='SELECTED_NOT_SENT';delta=[]
            base=self._model(data,origin)
            if error_code is not None:
                if approved is None or error_code not in ('TIMEOUT','RATE_LIMIT','TEMPORARY_5XX'):reason='FALLBACK_NOT_APPROVED'
                else:
                    if not approved['issued_at']<=instant.isoformat()<approved['expires_at']:raise ValueError('FALLBACK_APPROVAL_EXPIRED')
                    if (approved['catalog_hash'],approved['profile_hash'],approved['primary'])!=(catalog.content_hash,_digest(p),origin):raise ValueError('FALLBACK_APPROVAL_MISMATCH')
                    selected=approved['ordered_targets'][0]
            chosen=self._model(data,selected)
            if reason=='SELECTED_NOT_SENT':reason=self._eligible(chosen['data'],p) or reason
            if selected!=origin:
                delta=self._degradation(base['data'],chosen['data'])
                if delta:reason='FALLBACK_REAPPROVAL_REQUIRED'
            quota=self._quota.status(*selected,catalog_hash=catalog.content_hash,now=now).to_dict()
            if reason=='SELECTED_NOT_SENT' and not quota['eligible']:reason=quota['reason']
            request=dict(catalog_hash=catalog.content_hash,profile=p,primary=origin,proposal_hash=proposal_hash,
                prompt_contract_hash=prompt_contract_hash,error_code=error_code,fallback_hash=fallback.content_hash if fallback else None)
            fingerprint=_digest(request)
            if request_id in self._requests and self._requests[request_id][0]!=fingerprint:raise ValueError('REPLAY_CONFLICT')
            row=dict(status='SELECTED_NOT_SENT' if reason=='SELECTED_NOT_SENT' else 'BLOCKED',reason=reason,
                selected=selected if reason=='SELECTED_NOT_SENT' else None,catalog_hash=catalog.content_hash,profile_hash=_digest(p),
                model_hash=chosen['content_hash'],proposal_hash=proposal_hash,prompt_contract_hash=prompt_contract_hash,
                fallback_approval_hash=fallback.content_hash if fallback else None,degradation=delta,quota=quota,
                provenance=request,io_count=0,automatic_acceptance=False,runtime='NOT_EXECUTED')
            receipt=_snapshot('ROUTING_PROVENANCE',request_id,row)
            self._catalog.current(catalog,now=now)
            if self._quota.status(*selected,catalog_hash=catalog.content_hash,now=now).to_dict()!=quota:raise ValueError('QUOTA_DRIFT')
            if len(self._requests)>=256 and request_id not in self._requests:raise ValueError('RECORD_BOUND_EXCEEDED')
            self._requests[request_id]=(fingerprint,receipt.payload_json)
            return receipt


__all__ += ['CapabilityCatalog','CapabilityAdmissionRouter']
