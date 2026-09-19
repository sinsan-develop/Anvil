"""Trusted in-memory host boundary. Never expose these registration methods as agent APIs.

The host authenticates human approval IDs and endpoint observations before registration.
F01 does not authenticate humans, resolve DNS, send payloads, fetch credentials or inject
process environments. All decisions describe reference/policy eligibility with IO0.
"""
from dataclasses import asdict
import ipaddress
import json
import re
from threading import RLock
from .models import (CatalogRejected, DataEgressProfile, PROVIDER_IDS, SecretRef, Snapshot,
                     canonical, clean, covers, digest, fail, ident, path, provider, scope, snapshot, timestamp)


class ProviderCatalog:
    def __init__(self, *, project_id, environment_id, broker_policy_hash):
        self._project=ident(project_id); self._environment=ident(environment_id)
        clean(broker_policy_hash)
        if type(broker_policy_hash) is not str or not re.fullmatch(r'sha256:[0-9a-f]{64}',broker_policy_hash): fail('POLICY_HASH_INVALID')
        self._policy=broker_policy_hash
        self._lock=RLock(); self._records={}; self._events=[]; self._requests={}
        self._secrets={}; self._pins={}; self._local=set(); self._expired=set(); self._endpoints={}

    def _publish(self,kind,key,data):
        result=snapshot(kind,key,data)
        self._records[(kind,key)]=(result.content_hash,result.payload_json)
        return result

    def _record(self,handle,kind):
        if type(handle) is not Snapshot: fail('HANDLE_INVALID')
        fields=(handle.kind,handle.record_id,handle.content_hash,handle.payload_json)
        if any(type(v) is not str for v in fields) or handle.kind!=kind: fail('HANDLE_INVALID')
        if self._records.get((kind,handle.record_id))!=(handle.content_hash,handle.payload_json): fail('HANDLE_INVALID')
        data=json.loads(handle.payload_json)
        if digest(data)!=handle.content_hash: fail('HANDLE_INVALID')
        return data

    def _audit(self,event,data):
        row=dict(sequence=len(self._events)+1,event=event,**data)
        row['content_hash']=digest(row)
        self._events.append(canonical(row))

    def audit(self, *, after=0, limit=100):
        if type(after) is not int or after<0 or type(limit) is not int or not 1<=limit<=100: fail('PAGE_INVALID')
        with self._lock:
            rows=[json.loads(v) for v in self._events[after:after+limit]]
            return snapshot('AUDIT','audit',dict(events=rows,next_sequence=after+len(rows),has_more=after+len(rows)<len(self._events)))

    def catalog(self):
        return snapshot('CATALOG','catalog-v1',dict(version=1,providers=[dict(provider_id=p,display_name=p.upper(),
            sort_order=i,provider_type='local' if p=='ollama' else 'cloud',enabled_by_product=True,
            ready=False,connection_status='NOT_EXECUTED',credential_status='NOT_OBSERVED') for i,p in enumerate(PROVIDER_IDS)]))

    def register_profile(self,profile_id,data,*,human_approval_id):
        """Host-only capture of already authenticated, exact-payload human approval."""
        ident(profile_id)
        if human_approval_id is None: fail('HUMAN_APPROVAL_REQUIRED')
        ident(human_approval_id); d=clean(data)
        expected={'mode','provider_allowlist','approved_paths','excluded_paths','purpose','hosts','retention','training','zdr','cost_class'}
        if type(d) is not dict or set(d)!=expected: fail('PROFILE_INVALID')
        for key in ('provider_allowlist','approved_paths','excluded_paths','hosts'):
            if type(d[key]) is not list or any(type(v) is not str for v in d[key]) or len(set(d[key]))!=len(d[key]): fail('PROFILE_INVALID')
        if not d['provider_allowlist'] or not d['hosts']: fail('PROFILE_INVALID')
        for p in d['provider_allowlist']: provider(p)
        for key in ('approved_paths','excluded_paths'): d[key]=sorted(scope(v) for v in d[key])
        if any(covers(a,b) or covers(b,a) for a in d['approved_paths'] for b in d['excluded_paths']): fail('PATH_OVERLAP')
        ident(d['purpose'])
        if any(not self._hostname(v) for v in d['hosts']): fail('HOST_INVALID')
        if d['retention'] not in ('none','bounded') or type(d['training']) is not bool or type(d['zdr']) is not bool or d['cost_class'] not in ('free','standard','premium'): fail('PROFILE_INVALID')
        try:
            legacy=DataEgressProfile(d['mode'],tuple(d['provider_allowlist']),tuple(d['approved_paths']),tuple(d['excluded_paths']))
        except (ValueError,TypeError): fail('PROFILE_INVALID')
        row=dict(project_id=self._project,environment_id=self._environment,profile=d,
                 data_egress_profile_hash=legacy.snapshot_hash,human_approval_id=human_approval_id)
        with self._lock:
            old=self._records.get(('PROFILE',profile_id))
            if old and old[0]!=digest(row): fail('PROFILE_IMMUTABLE')
            if not old: self._audit('PROFILE_REGISTERED',dict(profile_id=profile_id,profile_hash=digest(row),human_approval_id=human_approval_id))
            return self._publish('PROFILE',profile_id,row)

    def pin_run(self,run_id,profile):
        ident(run_id)
        with self._lock:
            self._record(profile,'PROFILE')
            if run_id in self._pins and self._pins[run_id]!=profile.content_hash: fail('RUN_SNAPSHOT_IMMUTABLE')
            self._pins[run_id]=profile.content_hash
            return snapshot('RUN_PIN',run_id,dict(run_id=run_id,profile_hash=profile.content_hash))

    @staticmethod
    def _hostname(value):
        return type(value) is str and re.fullmatch(r'[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+',value) is not None and value not in ('metadata.google.internal',) and not value.endswith('.localhost')

    def allow_local_endpoint(self,host,port,ip,*,human_approval_id):
        ident(human_approval_id); clean([host,ip,port])
        if not self._hostname(host) or type(port) is not int or not 1<=port<=65535: fail('ENDPOINT_DENIED')
        try: address=ipaddress.ip_address(ip)
        except ValueError: fail('ADDRESS_DENIED')
        if not address.is_private or address.is_loopback or address.is_link_local or address.is_unspecified or address.is_multicast: fail('ADDRESS_DENIED')
        with self._lock:
            self._local.add((host,port,str(address)))
            self._audit('LOCAL_ENDPOINT_APPROVED',dict(endpoint_hash=digest([self._environment,host,port,str(address)]),human_approval_id=human_approval_id))

    def register_endpoint(self,host,scheme,port,resolved_ips,*,human_approval_id):
        """Host-approved DNS observation only; never performs resolution or connection."""
        ident(human_approval_id); clean([host,scheme,port,resolved_ips])
        if not self._hostname(host) or scheme!='https' or type(port) is not int or port!=443: fail('ENDPOINT_DENIED')
        if type(resolved_ips) is not list or len(resolved_ips)!=1 or type(resolved_ips[0]) is not str: fail('ADDRESS_DENIED')
        try: address=ipaddress.ip_address(resolved_ips[0])
        except ValueError: fail('ADDRESS_DENIED')
        if not address.is_global or address.is_multicast: fail('ADDRESS_DENIED')
        with self._lock:
            key=(host,scheme,port); value=str(address)
            if key in self._endpoints and self._endpoints[key]!=value: fail('ENDPOINT_IMMUTABLE')
            if key not in self._endpoints:
                self._endpoints[key]=value
                self._audit('ENDPOINT_APPROVED',dict(endpoint_hash=digest([self._environment,*key,value]),human_approval_id=human_approval_id))

    def register_mask(self,mask_id,profile,*,provider_id,purpose,paths,payload_hash):
        """Host-only attestation of a separately executed masking pipeline, not masking itself."""
        ident(mask_id); provider(provider_id); ident(purpose); clean([paths,payload_hash])
        if type(paths) is not list or not paths or type(payload_hash) is not str or not re.fullmatch(r'sha256:[0-9a-f]{64}',payload_hash): fail('MASK_INVALID')
        paths=sorted(path(p) for p in paths)
        with self._lock:
            self._record(profile,'PROFILE')
            data=dict(profile_hash=profile.content_hash,provider_id=provider_id,purpose=purpose,paths=paths,payload_hash=payload_hash)
            old=self._records.get(('MASK',mask_id))
            if old and old[0]!=digest(data): fail('MASK_IMMUTABLE')
            return self._publish('MASK',mask_id,data)

    def _decision(self,request_id,request,kind,reason,extra=None):
        fingerprint=digest(request); key=(kind,request_id)
        if key in self._requests:
            old_hash,payload=self._requests[key]
            if old_hash!=fingerprint: fail('REPLAY_CONFLICT')
            return snapshot('DECISION',request_id,json.loads(payload))
        row=dict(request_id=request_id,decision='ALLOW' if reason in ('ALLOWED','REFERENCE_AUTHORIZED_NOT_INJECTED') else 'BLOCKED',
                 reason=reason,io_count=0,request_hash=fingerprint,**(extra or {}))
        self._audit(kind,dict(request_id=request_id,request_hash=fingerprint,reason=reason))
        self._requests[key]=(fingerprint,canonical(row))
        return snapshot('DECISION',request_id,row)

    def evaluate_egress(self,*,request_id,snapshot,provider_id,purpose,paths,content_kind,observation,mask_evidence=None,payload_hash=None):
        ident(request_id); provider(provider_id); ident(purpose)
        d=clean(dict(paths=paths,content_kind=content_kind,observation=observation)); clean(payload_hash)
        with self._lock:
            row=self._record(snapshot,'PROFILE'); p=row['profile']
            mask=self._record(mask_evidence,'MASK') if mask_evidence is not None else None
            request=dict(profile_hash=snapshot.content_hash,provider_id=provider_id,purpose=purpose,mask=mask,payload_hash=payload_hash,**d)
            reason=self._egress(p,provider_id,purpose,mask=mask,**d)
            if reason=='ALLOWED' and p['mode']=='masked_content':
                expected=dict(profile_hash=snapshot.content_hash,provider_id=provider_id,purpose=purpose,paths=sorted(path(v) for v in paths),payload_hash=payload_hash)
                if mask!=expected: reason='MASK_EVIDENCE_MISMATCH'
            return self._decision(request_id,request,'EGRESS_DECISION',reason)

    def _egress(self,p,provider_id,purpose,paths,content_kind,observation,mask):
        if provider_id not in p['provider_allowlist']: return 'PROVIDER_DENIED'
        if purpose!=p['purpose']: return 'PURPOSE_MISMATCH'
        if type(paths) is not list or not paths: return 'PATH_DENIED'
        try: identities=[path(v) for v in paths]
        except CatalogRejected: return 'PATH_INVALID'
        if any(any(covers(x,v) for x in p['excluded_paths']) or not any(covers(x,v) for x in p['approved_paths']) for v in identities): return 'PATH_DENIED'
        if content_kind not in ('code','metadata','masked'): return 'PROFILE_DENIED'
        if p['mode']=='local_only' and provider_id!='ollama' or p['mode']=='metadata_only' and content_kind!='metadata': return 'PROFILE_DENIED'
        if p['mode']=='masked_content':
            if content_kind!='masked': return 'PROFILE_DENIED'
            if mask is None: return 'MASK_EVIDENCE_REQUIRED'
        o=observation
        required={'host','scheme','port','resolved_ips','connected_ip','redirects','retention','training','zdr','cost_class'}
        if type(o) is not dict or set(o)!=required: return 'OBSERVATION_REQUIRED'
        if any(type(o[k]) is not str for k in ('host','scheme','connected_ip')) or type(o['port']) is not int: return 'OBSERVATION_REQUIRED'
        if o['host'] not in p['hosts']: return 'HOST_DENIED'
        if any(type(o[k]) is not type(p[k]) or o[k]!=p[k] for k in ('retention','training','zdr','cost_class')): return 'EGRESS_DRIFT'
        if type(o['redirects']) is not list or o['redirects']: return 'REDIRECT_DENIED'
        if type(o['resolved_ips']) is not list or len(o['resolved_ips'])!=1: return 'DNS_REBINDING_DENIED'
        if type(o['resolved_ips'][0]) is not str: return 'ADDRESS_DENIED'
        try:
            resolved=ipaddress.ip_address(o['resolved_ips'][0]); connected=ipaddress.ip_address(o['connected_ip'])
        except (ValueError,TypeError): return 'ADDRESS_DENIED'
        if resolved!=connected: return 'DNS_REBINDING_DENIED'
        local=provider_id=='ollama' and (o['host'],o['port'],str(resolved)) in self._local
        if not local and (not resolved.is_global or resolved.is_multicast or str(resolved)=='100.100.100.200'): return 'ADDRESS_DENIED'
        if type(o['port']) is not int or (not local and (o['scheme']!='https' or o['port']!=443)) or (local and o['scheme'] not in ('http','https')): return 'ENDPOINT_DENIED'
        if p['mode']=='local_only' and not local: return 'LOCAL_ENDPOINT_REQUIRED'
        if not local:
            expected=self._endpoints.get((o['host'],o['scheme'],o['port']))
            if expected is None: return 'ENDPOINT_APPROVAL_REQUIRED'
            if expected!=str(resolved): return 'DNS_REBINDING_DENIED'
        return 'ALLOWED'

    def register_secret(self,secret_ref_id,*,provider_id,purpose,expires_at,now):
        ident(secret_ref_id); provider(provider_id); ident(purpose); timestamp(now); timestamp(expires_at)
        if expires_at<=now: fail('SECRET_EXPIRED')
        with self._lock:
            if secret_ref_id in self._secrets: fail('SECRET_ALREADY_REGISTERED')
            ref=SecretRef(secret_ref_id,self._project,self._environment,provider_id,purpose,1,'ACTIVE',expires_at,now,self._policy)
            data=asdict(ref); self._secrets[secret_ref_id]=canonical(data)
            self._audit('SECRET_REGISTERED',dict(reference_id=secret_ref_id,version=1,purpose=purpose))
            return self._publish('SECRET',secret_ref_id+':1',data)

    def secret_reference(self,secret_ref_id):
        ident(secret_ref_id)
        with self._lock:
            if secret_ref_id not in self._secrets: fail('SECRET_UNKNOWN')
            data=json.loads(self._secrets[secret_ref_id])
            return self._publish('SECRET',secret_ref_id+':'+str(data['version']),data)

    def rotate_secret(self,reference,*,expires_at,now):
        timestamp(now); timestamp(expires_at)
        with self._lock:
            old=self._record(reference,'SECRET'); current=json.loads(self._secrets[old['secret_ref_id']])
            if old!=current or current['status']!='ACTIVE' or now<current['last_rotated_at']: fail('SECRET_VERSION_STALE')
            if now>=current['expires_at'] or (current['secret_ref_id'],current['version']) in self._expired: fail('SECRET_EXPIRED')
            if expires_at<=now: fail('SECRET_EXPIRED')
            updated=dict(current,version=current['version']+1,last_rotated_at=now,expires_at=expires_at)
            self._secrets[old['secret_ref_id']]=canonical(updated)
            self._audit('SECRET_ROTATED',dict(reference_id=old['secret_ref_id'],version=updated['version'],purpose=updated['purpose']))
            return self._publish('SECRET',old['secret_ref_id']+':'+str(updated['version']),updated)

    def revoke_secret(self,reference,*,now):
        timestamp(now)
        with self._lock:
            old=self._record(reference,'SECRET'); current=json.loads(self._secrets[old['secret_ref_id']])
            if old['version']!=current['version'] or now<current['last_rotated_at']: fail('SECRET_VERSION_STALE')
            if current['status']!='REVOKED':
                current['status']='REVOKED'; self._secrets[old['secret_ref_id']]=canonical(current)
                self._audit('SECRET_REVOKED',dict(reference_id=old['secret_ref_id'],version=current['version'],purpose=current['purpose']))
            return snapshot('REVOCATION',old['secret_ref_id'],dict(version=current['version'],status='REVOKED'))

    def broker_decision(self,*,request_id,reference,provider_id,purpose,now,operation):
        ident(request_id); provider(provider_id); ident(purpose); timestamp(now); clean(operation)
        with self._lock:
            ref=self._record(reference,'SECRET'); current=json.loads(self._secrets[ref['secret_ref_id']])
            reason='REFERENCE_AUTHORIZED_NOT_INJECTED'
            if operation!='injection': reason='AGENT_SECRET_READ_DENIED'
            elif (provider_id,purpose)!=(ref['provider_id'],ref['purpose']): reason='SECRET_SCOPE_MISMATCH'
            elif ref['version']!=current['version']: reason='SECRET_VERSION_STALE'
            elif current['status']=='REVOKED': reason='SECRET_REVOKED'
            elif now>=ref['expires_at'] or (ref['secret_ref_id'],ref['version']) in self._expired:
                self._expired.add((ref['secret_ref_id'],ref['version'])); reason='SECRET_EXPIRED'
            elif now<ref['last_rotated_at']: reason='SECRET_NOT_YET_VALID'
            request=dict(reference_hash=reference.content_hash,provider_id=provider_id,purpose=purpose,now=now,operation=operation)
            # Never replay a previously allowed decision across rotation/revocation/expiry.
            key=('BROKER_DECISION',request_id)
            if key in self._requests and reason!='REFERENCE_AUTHORIZED_NOT_INJECTED':
                if self._requests[key][0]!=digest(request): fail('REPLAY_CONFLICT')
                self._audit('BROKER_DECISION',dict(request_id=request_id,reason=reason,version=ref['version']))
                return snapshot('DECISION',request_id,dict(request_id=request_id,decision='BLOCKED',reason=reason,io_count=0))
            return self._decision(request_id,request,'BROKER_DECISION',reason,dict(version=ref['version'],status=current['status']))
