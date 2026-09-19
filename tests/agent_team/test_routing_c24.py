from datetime import timedelta
import pytest
from packages.agent_team import provider_catalog as pc,provider_status as ps
from tests.agent_team.test_provider_catalog_c24 import ready,NOW,H


def setup(fallback=False,known=True,**changes):
    catalog,capture,d,owner,ctx=ready(fallback)
    q=ps.QuotaObservations()
    profile=dict(capability='text',privacy_class='CLOUD',allowed_regions=['region1'],max_retention_days=0,
        training_use=False,require_zdr=True,max_input_price='1',max_output_price='2',currency='USD',
        pricing_unit='PER_MILLION_TOKENS',minimum_context_tokens=4096,required_tools=['read'])
    profile.update(changes)
    router=pc.CapabilityAdmissionRouter(catalog,q)
    if known:
        for provider,model in [('openai','model-a'),('groq','model-b')]:
            q.observe(provider,provider_id=provider,model_id=model,catalog_hash=capture.content_hash,
                remaining_requests=5,evidence_hash=H,now=NOW,expires_at=NOW+timedelta(minutes=10))
    return router,capture,profile,d


def route(router,catalog,profile,**changes):
    args=dict(request_id='route1',catalog=catalog,profile=profile,primary=('openai','model-a'),
        proposal_hash=H,prompt_contract_hash=H,now=NOW)
    args.update(changes);return router.route(**args)


def test_route_binds_catalog_profile_prompt_proposal_and_no_provider_execution():
    r,c,p,_=setup();value=route(r,c,p).to_dict()
    assert value['status']=='SELECTED_NOT_SENT' and value['selected']==['openai','model-a']
    assert value['catalog_hash']==c.content_hash and value['proposal_hash']==H and value['prompt_contract_hash']==H
    assert value['io_count']==0 and value['automatic_acceptance'] is False
    assert route(r,c,p).to_dict()==value


@pytest.mark.parametrize('changes,reason',[(dict(capability='image'),'CAPABILITY_DENIED'),(dict(allowed_regions=['other']),'REGION_DENIED'),
    (dict(privacy_class='LOCAL'),'PRIVACY_DENIED'),(dict(max_input_price='0.5'),'COST_DENIED')])
def test_profile_filters_fail_closed(changes,reason):
    r,c,p,_=setup(**changes)
    assert route(r,c,p).to_dict()['reason']==reason


def test_unknown_quota_blocked_not_fake_capacity():
    r,c,p,_=setup(known=False);value=route(r,c,p).to_dict()
    assert value['status']=='BLOCKED' and value['reason']=='QUOTA_NOT_REPORTED'
    assert value['quota']['display']=='Quota not reported' and value['io_count']==0


def test_fallback_requires_exact_host_approval_and_no_quality_degradation():
    r,c,p,_=setup(True)
    assert route(r,c,p,error_code='TIMEOUT').to_dict()['reason']=='FALLBACK_NOT_APPROVED'
    approval=r.capture_fallback('approval',catalog=c,profile=p,primary=('openai','model-a'),
        ordered_targets=(('groq','model-b'),),human_approval_id='human-approved',
        quality_evidence_hash=H,now=NOW,expires_at=NOW+timedelta(minutes=5))
    v=route(r,c,p,request_id='fallback',error_code='TIMEOUT',fallback=approval).to_dict()
    assert v['selected']==['groq','model-b'] and v['fallback_approval_hash']==approval.content_hash
    assert v['degradation']==[] and not v['automatic_acceptance']
    with pytest.raises(ValueError,match='FALLBACK_APPROVAL_EXPIRED'):
        route(r,c,p,request_id='late',error_code='TIMEOUT',fallback=approval,now=NOW+timedelta(minutes=6))


def test_hostile_profile_callback_zero_and_tampered_approval_rejected():
    r,c,p,_=setup(True);calls=[]
    class Bad:
        def __deepcopy__(self,memo):calls.append(1);return 'text'
        def __str__(self):calls.append(1);return 'text'
    p['capability']=Bad()
    with pytest.raises(ValueError):route(r,c,p)
    assert calls==[]


@pytest.mark.parametrize('field',['allowed_regions','required_tools'])
def test_malformed_nested_profile_container_has_stable_domain_denial(field):
    r,c,p,_=setup();p[field]=[{}]
    with pytest.raises(ValueError,match='CAPABILITY_PROFILE_INVALID'):route(r,c,p)


@pytest.mark.parametrize('change',[dict(region='region2'),dict(retention_days=1),dict(training_use=True),dict(zdr=False),
    dict(capabilities=['tools']),dict(tools=[]),dict(model_revision='changed'),dict(pricing=dict(currency='USD',unit='PER_MILLION_TOKENS',input='2',output='2'))])
def test_existing_route_replay_never_hides_current_model_drift(change):
    from tests.knowledge.test_model_registry_d11 import model_data
    r,c,p,d=setup();route(r,c,p)
    d.discover(model_data(version=2,**change),now=NOW+timedelta(seconds=1))
    with pytest.raises(ValueError,match='CATALOG_DRIFT'):route(r,c,p,now=NOW+timedelta(seconds=1))


def test_route_replay_conflicting_prompt_or_proposal_and_foreign_catalog():
    r,c,p,_=setup();route(r,c,p)
    for key in ('proposal_hash','prompt_contract_hash'):
        with pytest.raises(ValueError,match='REPLAY_CONFLICT'):route(r,c,p,**{key:'sha256:'+'c'*64})
    other,foreign,_,_=setup()
    # Exact equivalent public snapshots are values, but registrations are owner-local.
    object.__setattr__(foreign,'record_id','foreign')
    with pytest.raises(ValueError,match='HANDLE_INVALID'):route(r,foreign,p,request_id='foreign')


def test_fallback_handle_spoof_alias_replay_and_quality_cost_reapproval():
    from tests.knowledge.test_model_registry_d11 import model_data
    r,c,p,d=setup(True)
    def approve(catalog):return r.capture_fallback('approval',catalog=catalog,profile=p,primary=('openai','model-a'),
        ordered_targets=(('groq','model-b'),),human_approval_id='human-approved',quality_evidence_hash=H,
        now=NOW,expires_at=NOW+timedelta(minutes=5))
    handle=approve(c);old=handle.payload_json
    object.__setattr__(handle,'payload_json','{}')
    with pytest.raises(ValueError,match='HANDLE_INVALID'):route(r,c,p,request_id='tampered',error_code='TIMEOUT',fallback=handle)
    assert approve(c).payload_json==old
    d.discover(model_data(id='model2',version=2,provider='groq',upstream_provider='groq',model_id='model-b',
        upstream_model='model-b',benchmark_revision='weaker'),now=NOW)
    fresh=r._catalog.capture('fresh',now=NOW)
    with pytest.raises(ValueError,match='FALLBACK_REAPPROVAL_REQUIRED'):approve(fresh)


def test_zero_quota_and_expired_observation_block_exact_replay():
    r,c,p,_=setup();route(r,c,p)
    r._quota.observe('zero',provider_id='openai',model_id='model-a',catalog_hash=c.content_hash,remaining_requests=0,
        evidence_hash=H,now=NOW+timedelta(seconds=1),expires_at=NOW+timedelta(minutes=10))
    assert route(r,c,p,now=NOW+timedelta(seconds=1)).to_dict()['reason']=='QUOTA_EXHAUSTED'
    assert route(r,c,p,now=NOW+timedelta(minutes=11)).to_dict()['reason']=='QUOTA_NOT_REPORTED'
