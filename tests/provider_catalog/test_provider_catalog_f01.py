"""F01 host-only policy tests. No secret material or network adapters exist."""
import importlib
import json
from concurrent.futures import ThreadPoolExecutor
import pytest

H = 'sha256:' + 'a'*64
IDS = ('cerebras','groq','mistral','openrouter','upstage','gemini','anthropic','openai','ollama')


def api():
    return importlib.import_module('packages.provider_catalog')


def host():
    return api().ProviderCatalog(project_id='project', environment_id='test', broker_policy_hash=H)


def profile(**changes):
    data = dict(mode='approved_paths', provider_allowlist=['openai'], approved_paths=['src/**'],
                excluded_paths=['private/**'], purpose='generate', hosts=['api.example.com'],
                retention='none', training=False, zdr=True, cost_class='standard')
    data.update(changes)
    return data


def policy(h, data=None):
    h.register_endpoint('api.example.com','https',443,['8.8.8.8'],human_approval_id='endpoint1')
    return h.register_profile('profile', profile() if data is None else data, human_approval_id='approval1')


def observation(**changes):
    data = dict(host='api.example.com', scheme='https', port=443, resolved_ips=['8.8.8.8'],
                connected_ip='8.8.8.8', redirects=[], retention='none', training=False,
                zdr=True, cost_class='standard')
    data.update(changes)
    return data


def send(h, p, **changes):
    args = dict(request_id='request', snapshot=p, provider_id='openai', purpose='generate',
                paths=['src/a.py'], content_kind='code', observation=observation())
    args.update(changes)
    return h.evaluate_egress(**args)


def secret(h):
    return h.register_secret('ref1', provider_id='openai', purpose='generate', expires_at=100, now=1)


def use(h, ref, **changes):
    args = dict(request_id='use1', reference=ref, provider_id='openai', purpose='generate', now=2, operation='injection')
    args.update(changes)
    return h.broker_decision(**args)


def test_catalog_all_nine_in_canonical_order_and_no_live_claim():
    h = host()
    rows = h.catalog().to_dict()['providers']
    assert tuple(r['provider_id'] for r in rows) == IDS
    assert all(r['connection_status'] == 'NOT_EXECUTED' and not r['ready'] for r in rows)


@pytest.mark.parametrize('provider', ['OPENAI','openai ','unknown','claude','',None,1])
def test_unknown_provider_is_never_fallback(provider):
    h = host()
    with pytest.raises(ValueError, match='PROVIDER_ID_INVALID'): send(h, policy(h), provider_id=provider)


def test_approved_egress_and_replay_are_deterministic_detached():
    h=host(); p=policy(h); r=send(h,p)
    assert r.to_dict()['reason'] == 'ALLOWED' and r.to_dict()['io_count'] == 0
    mutated=r.to_dict(); mutated['reason']='FORGED'
    assert send(h,p).content_hash == r.content_hash
    assert send(h,p).to_dict()['reason']=='ALLOWED'
    with pytest.raises(ValueError, match='REPLAY_CONFLICT'): send(h,p,paths=['src/b.py'])


@pytest.mark.parametrize('change,reason', [
    ({'paths':['private/a.py']},'PATH_DENIED'), ({'paths':['src/../private/a.py']},'PATH_INVALID'),
    ({'paths':['C:/src/a.py']},'PATH_INVALID'), ({'paths':['src/CON']},'PATH_INVALID'),
    ({'paths':['SRC/../a']},'PATH_INVALID'), ({'purpose':'embedding'},'PURPOSE_MISMATCH'),
    ({'observation':observation(host='foreign.example.com')},'HOST_DENIED'),
    ({'observation':observation(retention='unknown')},'EGRESS_DRIFT'),
    ({'observation':observation(training=True)},'EGRESS_DRIFT'),
    ({'observation':observation(zdr=False)},'EGRESS_DRIFT'),
    ({'observation':observation(cost_class='premium')},'EGRESS_DRIFT'),
    ({'observation':observation(redirects=['other.example.com'])},'REDIRECT_DENIED'),
    ({'observation':observation(connected_ip='1.1.1.1')},'DNS_REBINDING_DENIED'),
    ({'observation':observation(resolved_ips=['8.8.8.8','1.1.1.1'])},'DNS_REBINDING_DENIED'),
    ({'observation':observation(scheme='http')},'ENDPOINT_DENIED'),
    ({'observation':observation(port=80)},'ENDPOINT_DENIED'),
])
def test_egress_rejections_have_exact_reason_and_io0(change,reason):
    h=host(); r=send(h,policy(h),**change).to_dict()
    assert (r['decision'],r['reason'],r['io_count']) == ('BLOCKED',reason,0)


@pytest.mark.parametrize('ip',['127.0.0.1','169.254.169.254','10.0.0.1','::1','fe80::1','100.100.100.200'])
def test_ssrf_never_connects(ip):
    h=host(); r=send(h,policy(h),observation=observation(resolved_ips=[ip],connected_ip=ip)).to_dict()
    assert r['reason']=='ADDRESS_DENIED' and r['io_count']==0


def test_local_ollama_requires_exact_environment_allowlist_not_loopback():
    h=host(); p=policy(h,profile(mode='local_only',provider_allowlist=['ollama'],hosts=['ollama.internal']))
    obs=observation(host='ollama.internal',scheme='http',port=11434,resolved_ips=['10.0.0.2'],connected_ip='10.0.0.2')
    assert send(h,p,provider_id='ollama',observation=obs).to_dict()['reason']=='ADDRESS_DENIED'
    h.allow_local_endpoint('ollama.internal',11434,'10.0.0.2',human_approval_id='allow1')
    assert send(h,p,request_id='next',provider_id='ollama',observation=obs).to_dict()['decision']=='ALLOW'


@pytest.mark.parametrize('mode,kind,want',[('local_only','code','PROFILE_DENIED'),('metadata_only','code','PROFILE_DENIED'),('metadata_only','metadata','ALLOWED'),('masked_content','code','PROFILE_DENIED'),('masked_content','masked','MASK_EVIDENCE_REQUIRED')])
def test_profile_not_inferred_from_content_label(mode,kind,want):
    h=host(); p=policy(h,profile(mode=mode))
    assert send(h,p,content_kind=kind).to_dict()['reason']==want


def test_profile_changes_require_human_and_existing_run_snapshot_stays_fixed():
    h=host(); p=policy(h); pin=h.pin_run('run',p)
    with pytest.raises(ValueError,match='HUMAN_APPROVAL_REQUIRED'):
        h.register_profile('next',profile(approved_paths=['**']),human_approval_id=None)
    new=h.register_profile('next',profile(approved_paths=['src/**','docs/**']),human_approval_id='approval2')
    assert h.pin_run('run',p)==pin
    with pytest.raises(ValueError,match='RUN_SNAPSHOT_IMMUTABLE'): h.pin_run('run',new)
    assert p.to_dict()['profile']['approved_paths']==['src/**']


def test_secret_rotate_revoke_expiry_and_purpose_audit_without_value():
    h=host(); r=secret(h)
    assert use(h,r).to_dict()['reason']=='REFERENCE_AUTHORIZED_NOT_INJECTED'
    assert use(h,r,request_id='wrong',purpose='embedding').to_dict()['reason']=='SECRET_SCOPE_MISMATCH'
    assert use(h,r,request_id='raw',operation='read').to_dict()['reason']=='AGENT_SECRET_READ_DENIED'
    newer=h.rotate_secret(r,expires_at=200,now=3)
    assert newer.to_dict()['version']==2
    assert use(h,r,request_id='stale').to_dict()['reason']=='SECRET_VERSION_STALE'
    h.revoke_secret(newer,now=4)
    assert use(h,newer,request_id='resume',now=5).to_dict()['reason']=='SECRET_REVOKED'
    audit=h.audit().to_dict()['events']
    assert [e['sequence'] for e in audit]==list(range(1,len(audit)+1))
    assert {'SECRET_REGISTERED','SECRET_ROTATED','SECRET_REVOKED','BROKER_DECISION'} <= {e['event'] for e in audit}
    assert 'material' not in json.dumps(audit)


def test_expiry_and_alias_cannot_revive_secret():
    h=host(); r=secret(h)
    object.__setattr__(r,'payload_json','{}')
    with pytest.raises(ValueError,match='HANDLE_INVALID'): use(h,r)
    live=h.secret_reference('ref1')
    assert use(h,live,now=100).to_dict()['reason']=='SECRET_EXPIRED'
    assert use(h,live,request_id='rollback',now=2).to_dict()['reason']=='SECRET_EXPIRED'


@pytest.mark.parametrize('marker',['api_key=FAKE_TEST_ONLY','Authorization: Basic RkFLRQ==','ａｐｉ＿ｋｅｙ=FAKE_TEST_ONLY','api\u200b_key=FAKE_TEST_ONLY','postgresql://fake:FAKE_TEST_ONLY@db/app'])
def test_sensitive_metadata_rejected_without_raw_error(marker):
    h=host()
    with pytest.raises(ValueError) as e: h.register_secret(marker,provider_id='openai',purpose='generate',expires_at=100,now=1)
    assert marker not in str(e.value)
    assert h.audit().to_dict()['events']==[]


def test_hostile_objects_have_no_callback():
    calls=[]
    class Evil:
        def __str__(self): calls.append('str'); return 'openai'
        def __deepcopy__(self,m): calls.append('copy'); return 'openai'
        def __hash__(self): calls.append('hash'); return 1
    h=host()
    with pytest.raises(ValueError): h.register_profile('bad',profile(purpose=Evil()),human_approval_id='approval')
    with pytest.raises(ValueError): use(h,Evil())
    assert calls==[]


def test_concurrent_replay_publishes_one_receipt():
    h=host(); p=policy(h)
    with ThreadPoolExecutor(max_workers=8) as pool: rs=list(pool.map(lambda _:send(h,p),range(100)))
    assert len({r.content_hash for r in rs})==1
    assert sum(e['event']=='EGRESS_DECISION' for e in h.audit().to_dict()['events'])==1


def test_first_observation_cannot_self_approve_dns_rebinding():
    h=host(); p=policy(h)
    assert send(h,p,observation=observation(resolved_ips=['1.1.1.1'],connected_ip='1.1.1.1')).to_dict()['reason']=='DNS_REBINDING_DENIED'


def test_unregistered_endpoint_never_authorized_and_rebind_forbidden():
    h=host(); p=h.register_profile('p',profile(),human_approval_id='human')
    assert send(h,p).to_dict()['reason']=='ENDPOINT_APPROVAL_REQUIRED'
    h.register_endpoint('api.example.com','https',443,['8.8.8.8'],human_approval_id='ep')
    with pytest.raises(ValueError,match='ENDPOINT_IMMUTABLE'):
        h.register_endpoint('api.example.com','https',443,['1.1.1.1'],human_approval_id='ep2')


@pytest.mark.parametrize('field,value',[('host',[]),('port',[]),('connected_ip',134744072),('resolved_ips',[134744072]),('scheme',[]),('training',1)])
def test_malformed_nested_observation_returns_blocked_without_exception(field,value):
    h=host(); r=send(h,policy(h),observation=observation(**{field:value})).to_dict()
    assert r['decision']=='BLOCKED' and r['io_count']==0


def test_foreign_context_handle_and_mutation_are_rejected():
    h=host(); p=policy(h); other=api().ProviderCatalog(project_id='foreign',environment_id='test',broker_policy_hash=H)
    with pytest.raises(ValueError,match='HANDLE_INVALID'): send(other,p)
    original=p.content_hash; object.__setattr__(p,'content_hash',H)
    with pytest.raises(ValueError,match='HANDLE_INVALID'): send(h,p)
    assert original!=H


def test_expired_reference_cannot_rotate_after_observed_expiry():
    h=host(); r=secret(h); use(h,r,now=100)
    with pytest.raises(ValueError,match='SECRET_EXPIRED'): h.rotate_secret(r,now=3,expires_at=200)


def test_audit_pagination_160_events_is_stable_and_alias_safe():
    h=host(); p=policy(h)
    for i in range(160): send(h,p,request_id='r'+str(i))
    first=h.audit(limit=100); second=h.audit(after=100,limit=100)
    rows=first.to_dict()['events']+second.to_dict()['events']
    assert [r['sequence'] for r in rows]==list(range(1,163))
    first.to_dict()['events'].clear()
    assert len(h.audit(limit=100).to_dict()['events'])==100
    assert second.to_dict()['has_more'] is False


def test_host_attested_mask_evidence_exact_paths_and_payload_hash_only():
    h=host(); p=policy(h,profile(mode='masked_content'))
    mask=h.register_mask('mask',p,provider_id='openai',purpose='generate',paths=['src/a.py'],payload_hash=H)
    r=send(h,p,content_kind='masked',mask_evidence=mask,payload_hash=H)
    assert r.to_dict()['reason']=='ALLOWED'
    r=send(h,p,request_id='other',paths=['src/b.py'],content_kind='masked',mask_evidence=mask,payload_hash=H)
    assert r.to_dict()['reason']=='MASK_EVIDENCE_MISMATCH'


def test_local_only_cannot_use_public_ollama_host():
    h=host(); p=policy(h,profile(mode='local_only',provider_allowlist=['ollama']))
    assert send(h,p,provider_id='ollama').to_dict()['reason']=='LOCAL_ENDPOINT_REQUIRED'


@pytest.mark.parametrize('ip',['::ffff:127.0.0.1','::ffff:169.254.169.254','127.0.0.1','::1','0.0.0.0'])
def test_local_allowlist_cannot_authorize_loopback_or_metadata(ip):
    h=host()
    with pytest.raises(ValueError,match='ADDRESS_DENIED'): h.allow_local_endpoint('local.example.com',11434,ip,human_approval_id='human')


def test_profile_input_mutation_does_not_expand_snapshot():
    h=host(); data=profile(); p=policy(h,data); data['approved_paths'].append('private/**')
    assert send(h,p,paths=['private/a']).to_dict()['reason']=='PATH_DENIED'
    assert p.to_dict()['profile']['approved_paths']==['src/**']


def test_secret_allowed_exact_replay_after_revoke_must_not_allow():
    h=host(); r=secret(h); use(h,r)
    h.revoke_secret(r,now=3)
    assert use(h,r).to_dict()['reason']=='SECRET_REVOKED'


def test_host_state_hashes_are_deterministic_across_identical_histories():
    a=host(); b=host()
    assert send(a,policy(a)).content_hash==send(b,policy(b)).content_hash
    assert a.audit().content_hash==b.audit().content_hash


@pytest.mark.parametrize('field',['purpose','hosts','retention','training','zdr','cost_class'])
def test_missing_mandatory_egress_contract_is_rejected(field):
    h=host(); data=profile(); del data[field]
    with pytest.raises(ValueError,match='PROFILE_INVALID'): h.register_profile('p',data,human_approval_id='human')
