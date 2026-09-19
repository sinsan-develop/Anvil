"""F02 uses actual D11/D06/D02 host fixture owners, never a provider client."""
from copy import deepcopy
from datetime import timedelta, tzinfo, datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import importlib
import pytest
from tests.knowledge import test_model_registry_d11 as d11

NOW=d11.NOW
H='sha256:'+'b'*64


def api(): return importlib.import_module('packages.model_registry')


def contract():
    return dict(task_graph_hash=H,permission_hash=H,evidence_hash=H,resume_hash=H,baseline_hash=H)


def owner_ready(fallback=False, fallback_price='1'):
    m=importlib.import_module('packages.knowledge.model_registry')
    repo,ctx,_,_,snaps,prompt,model,bench,candidate=d11.ready(m)
    if fallback:
        other=d11.publish_model(repo,ctx,d11.model_data(id='model2',provider='groq',upstream_provider='groq',model_id='model-b',upstream_model='model-b',
            pricing=dict(currency='USD',unit='PER_MILLION_TOKENS',input=fallback_price,output='2')))
        bd=d11.bench_data(prompt,other); bd['id']='bench-other'
        ob=d11.benchmark(repo,ctx,bd)
        data=d11.route_data(prompt,model,bench,identity='route2')
        data['routes'][0]['fallback']['targets']=[dict(prompt=d11.reference(prompt),model=d11.reference(other),benchmark=d11.reference(ob),requirements=deepcopy(data['routes'][0]['requirements']))]
        candidate=repo.create_routing(ctx,data,now=NOW)
    d11.activate(repo,ctx,candidate)
    _,ref=d11.guard(repo,ctx,snaps)
    host=api().DiscoveryRouter(repo,ctx)
    binding=host.bind_context('context1',ref,contract())
    return host,repo,ctx,ref,binding


def choose(h,ref,binding,**changes):
    args=dict(request_id='request1',snapshot_ref=ref,context=binding,role='developer',adapter_id='codex',now=NOW+timedelta(seconds=1),error_code=None)
    args.update(changes)
    return h.select(**args)


def test_discovery_reuses_actual_d11_and_detaches_input_output():
    m=importlib.import_module('packages.knowledge.model_registry'); repo,ctx,*_=d11.setup(m)
    h=api().DiscoveryRouter(repo,ctx); data=d11.model_data()
    r=h.discover(data,now=NOW)
    data['capabilities'].append('forged')
    assert r.to_dict()['data']['provider']=='openai'
    assert 'forged' not in h.catalog(now=NOW).to_dict()['models'][0]['data']['capabilities']
    assert len(repo.query(ctx,now=NOW)['models'])==1
    r.to_dict()['data']['tools'].append('delete')
    assert h.catalog(now=NOW).to_dict()['models'][0]['data']['tools']==['read']


@pytest.mark.parametrize('changes',[dict(provider='unknown'),dict(provider='OPENAI'),dict(upstream_provider='openrouter'),dict(upstream_model=''),dict(retention_days=None),dict(training_use='unknown'),dict(zdr=None),dict(context_tokens=0),dict(endpoint_ref='https://private.example.com')])
def test_invalid_discovery_never_publishes(changes):
    m=importlib.import_module('packages.knowledge.model_registry'); repo,ctx,*_=d11.setup(m)
    h=api().DiscoveryRouter(repo,ctx)
    with pytest.raises(ValueError): h.discover(d11.model_data(**changes),now=NOW)
    assert len(repo.query(ctx,now=NOW)['models'])==0


def test_route_is_exact_d11_pin_and_no_automatic_authority():
    h,repo,ctx,ref,binding=owner_ready()
    r=choose(h,ref,binding).to_dict()
    assert r['status']=='SELECTED_NOT_SENT' and r['provider']=='openai' and r['io_count']==0
    assert r['contract']==contract() and r['main_acceptance'] is False
    assert r['activation_hash']==repo.run_guard(ctx,ref,now=NOW+timedelta(seconds=1))['activation_hash']


@pytest.mark.parametrize('error',['RATE_LIMIT','TIMEOUT','TEMPORARY_5XX'])
def test_fallback_consumes_only_owner_approved_target_and_audits_origin(error):
    h,_,_,ref,binding=owner_ready(True)
    r=choose(h,ref,binding,error_code=error).to_dict()
    assert (r['origin_provider'],r['provider'],r['error_code'],r['io_count'])==('openai','groq',error,0)
    assert r['contract']==contract() and r['capability_delta']==[]
    assert h.audit().to_dict()['events'][-1]['decision_hash']==r['content_hash']


@pytest.mark.parametrize('error',['AUTH_FAILURE','QUOTA_EXHAUSTED','UNKNOWN','', 'SAFETY_DENIED'])
def test_nontransient_error_cannot_select_fallback(error):
    h,_,_,ref,binding=owner_ready(True)
    r=choose(h,ref,binding,error_code=error).to_dict()
    assert r['status']=='BLOCKED' and r['reason']=='FALLBACK_NOT_APPROVED' and r['io_count']==0


def test_no_target_fallback_and_higher_cost_are_blocked():
    h,_,_,ref,binding=owner_ready()
    assert choose(h,ref,binding,error_code='TIMEOUT').to_dict()['reason']=='FALLBACK_NOT_APPROVED'
    h,_,_,ref,binding=owner_ready(True,'2')
    assert choose(h,ref,binding,error_code='TIMEOUT').to_dict()['reason']=='FALLBACK_REAPPROVAL_REQUIRED'


@pytest.mark.parametrize('changes',[dict(model_revision='changed'),dict(region='other'),dict(retention_days=1),dict(training_use=True),dict(zdr=False),dict(context_tokens=1024),dict(capabilities=['text']),dict(tools=[]),dict(pricing=dict(currency='USD',unit='PER_MILLION_TOKENS',input='2',output='3'))])
def test_same_model_id_drift_blocks_even_existing_pin_and_retry(changes):
    h,repo,ctx,ref,binding=owner_ready(); choose(h,ref,binding)
    h.discover(d11.model_data(version=2,**changes),now=NOW+timedelta(seconds=2))
    r=choose(h,ref,binding,now=NOW+timedelta(seconds=2)).to_dict()
    assert r['status']=='BLOCKED' and r['reason']=='BLOCKED_CAPABILITY_DRIFT'
    assert r['next_action']=='REPROBE_BENCHMARK_HUMAN_APPROVAL'


def test_ttl_half_open_and_existing_run_not_silently_replaced():
    h,_,_,ref,binding=owner_ready()
    assert choose(h,ref,binding,now=NOW+timedelta(seconds=3599)).to_dict()['status']=='SELECTED_NOT_SENT'
    r=choose(h,ref,binding,now=NOW+timedelta(seconds=3600)).to_dict()
    assert r['reason']=='BLOCKED_CAPABILITY_DRIFT'


@pytest.mark.parametrize('field',['task_graph_hash','permission_hash','evidence_hash','resume_hash','baseline_hash'])
def test_missing_context_contract_cannot_be_bound(field):
    h,_,_,ref,_=owner_ready(); data=contract(); del data[field]
    with pytest.raises(ValueError): h.bind_context('missing',ref,data)


def test_adapter_replacement_preserves_graph_permission_evidence_resume():
    h,_,_,ref,binding=owner_ready()
    for adapter in ('codex','claude','local'):
        r=choose(h,ref,binding,request_id=adapter,adapter_id=adapter).to_dict()
        assert r['contract']==contract() and r['status']=='SELECTED_NOT_SENT'


def test_replay_concurrency_and_alias_safety():
    h,_,_,ref,binding=owner_ready()
    with ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(lambda _:choose(h,ref,binding),range(40)))
    assert len({r.content_hash for r in results})==1
    assert len(h.audit().to_dict()['events'])==1
    results[0].to_dict()['contract']['permission_hash']='bad'
    assert choose(h,ref,binding).to_dict()['contract']==contract()
    with pytest.raises(ValueError,match='REPLAY_CONFLICT'): choose(h,ref,binding,adapter_id='claude')


def test_foreign_context_unknown_role_and_forged_handle_fail_closed():
    h,_,_,ref,binding=owner_ready()
    assert choose(h,ref,binding,role='unregistered').to_dict()['status']=='BLOCKED'
    object.__setattr__(binding,'payload_json','{}')
    with pytest.raises(ValueError,match='CONTEXT_INVALID'): choose(h,ref,binding)


def test_hostile_inputs_run_no_callbacks_before_owner():
    calls=[]
    class Evil:
        def __str__(self): calls.append('str'); return 'x'
        def __deepcopy__(self,m): calls.append('copy'); return {}
        def __hash__(self): calls.append('hash'); return 1
    h,_,_,ref,binding=owner_ready()
    for args in (dict(role=Evil()),dict(snapshot_ref=Evil()),dict(context=Evil()),dict(error_code=Evil())):
        with pytest.raises(ValueError): choose(h,ref,binding,**args)
    assert calls==[]


def test_custom_timezone_is_rejected_without_callback():
    calls=[]
    class Zone(tzinfo):
        def utcoffset(self,dt): calls.append(1); return timedelta(0)
    h,_,_,ref,binding=owner_ready()
    with pytest.raises(ValueError): choose(h,ref,binding,now=datetime(2026,1,1,tzinfo=Zone()))
    assert calls==[]


def test_same_run_contract_cannot_rebind_under_different_context_id():
    h,_,_,ref,_=owner_ready(); changed=contract(); changed['permission_hash']='sha256:'+'c'*64
    with pytest.raises(ValueError,match='RUN_CONTRACT_IMMUTABLE'): h.bind_context('other-id',ref,changed)


@pytest.mark.parametrize('field,value',[('account_ref','another-account'),('organization_ref','another-org'),('endpoint_ref','endpoint2'),('benchmark_revision','bench2'),('upstream_model','new-upstream')])
def test_identity_provenance_drift_is_not_just_same_model_name(field,value):
    h,_,_,ref,binding=owner_ready()
    h.discover(d11.model_data(version=2,**{field:value}),now=NOW+timedelta(seconds=2))
    assert choose(h,ref,binding,now=NOW+timedelta(seconds=2)).to_dict()['reason']=='BLOCKED_CAPABILITY_DRIFT'


@pytest.mark.parametrize('marker',['token=FAKE_TEST_ONLY','Authorization: Basic RkFLRQ==','api\u200b_key=FAKE_TEST_ONLY','%61pi_key=FAKE_TEST_ONLY','ａｐｉ＿ｋｅｙ=FAKE_TEST_ONLY'])
def test_sensitive_discovery_never_reaches_owner(marker):
    m=importlib.import_module('packages.knowledge.model_registry'); repo,ctx,*_=d11.setup(m)
    h=api().DiscoveryRouter(repo,ctx)
    with pytest.raises(ValueError) as error: h.discover(d11.model_data(model_id=marker),now=NOW)
    assert marker not in str(error.value) and len(repo.query(ctx,now=NOW)['models'])==0


def test_discovery_bounds_and_callback_before_owner_capture():
    calls=[]
    class Evil(dict):
        def items(self): calls.append('items'); return super().items()
    m=importlib.import_module('packages.knowledge.model_registry'); repo,ctx,*_=d11.setup(m)
    h=api().DiscoveryRouter(repo,ctx)
    with pytest.raises(ValueError): h.discover(Evil(d11.model_data()),now=NOW)
    with pytest.raises(ValueError): h.discover(d11.model_data(model_id='x'*9000),now=NOW)
    assert calls==[] and not repo.query(ctx,now=NOW)['models']


def test_host_return_publication_failure_leaves_no_facade_receipt(monkeypatch):
    h,_,_,ref,binding=owner_ready()
    module=importlib.import_module('packages.model_registry.service'); original=module.snapshot
    def fault(kind,*args):
        if kind=='ROUTING_DECISION': raise RuntimeError('synthetic-publication-fault')
        return original(kind,*args)
    monkeypatch.setattr(module,'snapshot',fault)
    with pytest.raises(RuntimeError): choose(h,ref,binding)
    assert h.audit().to_dict()['events']==[]
    monkeypatch.setattr(module,'snapshot',original)
    assert choose(h,ref,binding).to_dict()['status']=='SELECTED_NOT_SENT'
    assert len(h.audit().to_dict()['events'])==1


def test_foreign_run_and_unknown_snapshot_are_not_implicitly_created():
    h,_,_,ref,binding=owner_ready(); changed=dict(ref,run_id='foreign')
    with pytest.raises(ValueError,match='CONTEXT_INVALID'): choose(h,changed,binding)


def test_reviewer_fallback_cannot_degrade_approved_quality():
    m=importlib.import_module('packages.knowledge.model_registry'); repo,ctx,target,_,snaps=d11.setup(m,roles=('reviewer',))
    prompt=d11.publish_prompt(repo,ctx,target,role='reviewer'); first=d11.publish_model(repo,ctx)
    first_bench=d11.bench_data(prompt,first); first_bench['role']='reviewer'
    pb=d11.benchmark(repo,ctx,first_bench)
    other=d11.publish_model(repo,ctx,d11.model_data(id='model2',provider='groq',upstream_provider='groq',model_id='other',upstream_model='other'))
    second_bench=d11.bench_data(prompt,other); second_bench.update(role='reviewer',id='other-bench')
    for sample in second_bench['samples']: sample.update(quality=.9,baseline_quality=.9)
    ob=d11.benchmark(repo,ctx,second_bench)
    rd=d11.route_data(prompt,first,pb); rd['routes'][0]['role']='reviewer'
    rd['routes'][0]['fallback']['targets']=[dict(prompt=d11.reference(prompt),model=d11.reference(other),benchmark=d11.reference(ob),requirements=deepcopy(rd['routes'][0]['requirements']))]
    candidate=repo.create_routing(ctx,rd,now=NOW); d11.activate(repo,ctx,candidate)
    _,ref=d11.guard(repo,ctx,snaps); h=api().DiscoveryRouter(repo,ctx); binding=h.bind_context('review-context',ref,contract())
    assert choose(h,ref,binding,role='reviewer',error_code='TIMEOUT').to_dict()['reason']=='FALLBACK_REAPPROVAL_REQUIRED'
