"""F04 GROQ host adapter contract tests; no network or credential I/O."""
from dataclasses import FrozenInstanceError
import json

import pytest

from packages.llm_gateway.contracts import GatewayRequest, ProviderAdapter, UsageProvenance
from packages.providers.groq_adapter import GroqAdapter
from packages.providers.groq_errors import GroqAdapterError
from packages.providers.groq_models import TransportResponse, canonical, detached


class FakeTransport:
    def __init__(self, *responses): self.responses=list(responses); self.calls=[]
    def request(self, *, operation, payload, request_id, stream):
        self.calls.append((operation,payload,request_id,stream))
        if not self.responses: raise AssertionError('unexpected transport call')
        return self.responses.pop(0)


class RaisingTransport:
    def request(self, *, operation, payload, request_id, stream):
        raise RuntimeError('private transport detail')


def wire(body, *, status=200, headers=()): return TransportResponse(status,tuple(headers),body)


def request(**changes):
    data=dict(provider='groq',model='llama-3.3-70b-versatile',input_text='hello',request_id='request-1')
    data.update(changes); return GatewayRequest(**data)


def completion(content='answer', *, identity='groq-upstream', prompt=2, output=3):
    return {'id':identity,'object':'chat.completion','choices':[{'index':0,'message':{'role':'assistant','content':content},'finish_reason':'stop'}],
            'usage':{'prompt_tokens':prompt,'completion_tokens':output,'total_tokens':prompt+output}}


def chunk(content=None, *, finish=None, usage=None, identity='groq-stream'):
    delta={} if content is None else {'content':content}
    body={'id':identity,'object':'chat.completion.chunk','choices':[{'index':0,'delta':delta,'finish_reason':finish}]}
    if usage is not None: body['usage']=usage
    return body


def test_generate_maps_openai_compatible_shape_and_detached_receipt():
    transport=FakeTransport(wire(completion(),headers=(('x-request-id','groq-upstream'),)))
    adapter=GroqAdapter(transport); result=adapter.generate(request()); receipt=adapter.receipt('request-1')
    changed=receipt.to_dict(); changed['output_text']='forged'
    assert (result.request_id,result.provider,result.output_text)==('request-1','groq','answer')
    assert result.final_usage.total_tokens==5 and result.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert receipt.to_dict()['upstream_request_id']=='groq-upstream'
    assert adapter.receipt('request-1').to_dict()['output_text']=='answer'
    assert transport.calls==[('generate',{'model':'llama-3.3-70b-versatile','messages':[{'role':'user','content':'hello'}]},'request-1',False)]
    with pytest.raises(FrozenInstanceError): receipt.content_hash='forged'


def test_provider_id_must_be_canonical_lowercase_before_transport():
    transport=FakeTransport(wire(completion())); adapter=GroqAdapter(transport)
    with pytest.raises(GroqAdapterError,match='PROVIDER_MISMATCH'):
        adapter.generate(request(provider='GROQ'))
    assert transport.calls==[]


def test_generate_accepts_official_additive_metadata_while_validating_required_fields():
    body=completion() | {'created':1710000000,'model':'llama-3.3-70b-versatile','system_fingerprint':'fp_1'}
    body['choices'][0]['logprobs']=None
    body['choices'][0]['message']['refusal']=None
    body['usage']['queue_time']=0.01
    adapter=GroqAdapter(FakeTransport(wire(body)))
    assert adapter.generate(request()).output_text=='answer'


def test_identical_histories_have_deterministic_receipts():
    a=GroqAdapter(FakeTransport(wire(completion()))); b=GroqAdapter(FakeTransport(wire(completion())))
    a.generate(request()); b.generate(request())
    assert a.receipt('request-1').content_hash==b.receipt('request-1').content_hash


def test_stream_collects_chunks_and_single_terminal_final_usage():
    usage={'prompt_tokens':4,'completion_tokens':2,'total_tokens':6}
    adapter=GroqAdapter(FakeTransport(wire([chunk('hel'),chunk('lo'),chunk(finish='stop',usage=usage)])))
    result=adapter.stream(request(request_id='stream-1'))
    assert result.chunks==('hel','lo') and result.response.output_text=='hello'
    assert result.response.final_usage.total_tokens==6
    assert result.receipt.content_hash==adapter.receipt('stream-1').content_hash


def test_stream_accepts_role_delta_and_separate_terminal_usage_frame():
    usage={'prompt_tokens':4,'completion_tokens':2,'total_tokens':6,'queue_time':0.01}
    frames=[
        {'id':'groq-stream','object':'chat.completion.chunk','created':1710000000,
         'choices':[{'index':0,'delta':{'role':'assistant'},'finish_reason':None}],
         'usage':None},
        chunk('hello') | {'usage':None},
        chunk(finish='stop') | {'usage':None},
        {'id':'groq-stream','object':'chat.completion.chunk','created':1710000001,
         'choices':[],'usage':usage},
    ]
    transport=FakeTransport(wire(frames)); adapter=GroqAdapter(transport)
    result=adapter.stream(request(request_id='official-stream'))
    assert result.chunks==('hello',) and result.response.final_usage.total_tokens==6
    assert transport.calls==[('stream',{
        'model':'llama-3.3-70b-versatile',
        'messages':[{'role':'user','content':'hello'}],
        'stream_options':{'include_usage':True},
    },'official-stream',True)]


def test_abort_before_send_has_confirmed_zero_usage_and_no_io():
    transport=FakeTransport(); adapter=GroqAdapter(transport)
    result=adapter.generate(request(request_id='abort-1',abort_signal=lambda:True))
    assert transport.calls==[] and result.abort_status=='ABORTED'
    assert result.usage_provenance is UsageProvenance.ABORT_CONFIRMED and result.final_usage.total_tokens==0
    assert adapter.receipt('abort-1').to_dict()['transport_sent'] is False


def test_abort_after_send_preserves_final_usage():
    checks=iter((False,True,True,True)); usage={'prompt_tokens':5,'completion_tokens':1,'total_tokens':6}
    adapter=GroqAdapter(FakeTransport(wire([chunk('partial'),chunk(finish='stop',usage=usage)])))
    result=adapter.stream(request(request_id='abort-stream',abort_signal=lambda:next(checks)))
    assert result.response.abort_status=='ABORT_REQUESTED_UPSTREAM_COMPLETED'
    assert result.response.final_usage.total_tokens==6
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL


def test_health_discovery_and_probe_are_detached_and_provider_neutral():
    transport=FakeTransport(wire({'status':'ok'},headers=(('x-request-id','health-up'),)),
                            wire({'object':'list','data':[{'id':'z-model','object':'model'},{'id':'a-model','object':'model'}]}))
    adapter=GroqAdapter(transport); health=adapter.health(request_id='health-1'); models=adapter.discover(request_id='discover-1')
    assert isinstance(adapter,ProviderAdapter)
    assert adapter.probe({'text_generation','streaming'}).supported
    assert adapter.probe({'image_generation'}).unsupported_reasons==('missing capability: image_generation',)
    assert health.to_dict()['status']=='AVAILABLE' and models.to_dict()['models']==['a-model','z-model']
    value=models.to_dict(); value['models'].append('forged')
    assert adapter.receipt('discover-1').to_dict()['models']==['a-model','z-model']


def test_discovery_accepts_official_model_additive_metadata():
    body={'object':'list','data':[{
        'id':'llama-3.3-70b-versatile','object':'model','created':1710000000,
        'owned_by':'Groq','active':True,'context_window':32768,
    }]}
    models=GroqAdapter(FakeTransport(wire(body))).discover(request_id='models-metadata')
    assert models.to_dict()['models']==['llama-3.3-70b-versatile']


@pytest.mark.parametrize('body',[
    {}, {'id':'x','object':'chat.completion','choices':[],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},
    {'id':'x','object':'wrong','choices':[{'index':0,'message':{'role':'assistant','content':'ok'},'finish_reason':'stop'}],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},
    {'id':'x','object':'chat.completion','choices':[{'index':0,'message':{'role':'assistant','content':1},'finish_reason':'stop'}],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},
    completion(prompt=1,output=1)|{'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':3}},
])
def test_unknown_or_malformed_success_fails_closed_without_receipt(body):
    adapter=GroqAdapter(FakeTransport(wire(body)))
    with pytest.raises(GroqAdapterError,match='RESPONSE_MALFORMED'): adapter.generate(request())
    with pytest.raises(GroqAdapterError,match='RECEIPT_NOT_FOUND'): adapter.receipt('request-1')


@pytest.mark.parametrize('status,body,headers,code,retryable,delay',[
    (401,{'error':{'type':'invalid_request_error','code':'invalid_api_key'}},(),'AUTHENTICATION_FAILED',False,None),
    (403,{'error':{'type':'permission_error','code':'permission_denied'}},(),'AUTHORIZATION_DENIED',False,None),
    (429,{'error':{'type':'rate_limit_error','code':'rate_limit_exceeded'}},(('retry-after','12'),),'RATE_LIMIT',True,12),
    (429,{'error':{'type':'insufficient_quota','code':'insufficient_quota'}},(),'QUOTA_EXHAUSTED',False,None),
    (503,{'error':{'type':'server_error','code':'service_unavailable'}},(('retry-after','3'),),'TEMPORARY_5XX',True,3),
])
def test_error_mapping_is_deterministic(status,body,headers,code,retryable,delay):
    adapter=GroqAdapter(FakeTransport(wire(body,status=status,headers=headers)))
    with pytest.raises(GroqAdapterError) as caught: adapter.generate(request())
    assert (caught.value.code,caught.value.retryable,caught.value.retry_after_seconds)==(code,retryable,delay)
    assert str(caught.value)==code


@pytest.mark.parametrize('body',[{'error':{}},{'error':{'type':'unknown','code':'unknown'}},{'error':'rate limit'}])
def test_quota_rate_limit_ambiguity_is_nonretryable(body):
    adapter=GroqAdapter(FakeTransport(wire(body,status=429)))
    with pytest.raises(GroqAdapterError,match='RATE_LIMIT_OR_QUOTA_AMBIGUOUS') as caught: adapter.generate(request())
    assert caught.value.retryable is False


@pytest.mark.parametrize('value',['','-1','86401','999999999999999999999999','tomorrow','1.5'])
def test_retry_after_malformed_or_overflow_fails_closed(value):
    adapter=GroqAdapter(FakeTransport(wire({'error':{'type':'rate_limit_error','code':'rate_limit_exceeded'}},status=429,headers=(('retry-after',value),))))
    with pytest.raises(GroqAdapterError,match='RETRY_AFTER_INVALID'): adapter.generate(request())


@pytest.mark.parametrize('header',['authorization','proxy-authorization','x-api-key','x-auth-token','access-token','x-client-secret'])
def test_credential_bearing_header_name_is_rejected_without_value_leak(header):
    value='innocent-looking-value'; adapter=GroqAdapter(FakeTransport(wire(completion(),headers=((header,value),))))
    with pytest.raises(GroqAdapterError,match='CREDENTIAL_MATERIAL_DETECTED') as caught: adapter.generate(request())
    assert value not in str(caught.value)


def test_credential_material_in_body_is_rejected_without_leak():
    material='Authorization: Bearer abcdefghijklmnop'
    adapter=GroqAdapter(FakeTransport(wire({'error':{'type':'bad','code':'bad','message':material}},status=400)))
    with pytest.raises(GroqAdapterError,match='CREDENTIAL_MATERIAL_DETECTED') as caught: adapter.generate(request())
    assert material not in str(caught.value)


@pytest.mark.parametrize('value',[float('nan'),float('inf'),float('-inf')])
def test_nonfinite_numbers_are_not_canonical_json(value):
    with pytest.raises(ValueError,match='VALUE_NOT_PLAIN'): canonical({'x':value})
    with pytest.raises(ValueError,match='VALUE_NOT_PLAIN'): detached([value])


def test_replay_is_stable_and_changed_input_is_rejected_before_send():
    transport=FakeTransport(wire(completion())); adapter=GroqAdapter(transport)
    first=adapter.generate(request()); second=adapter.generate(request())
    assert first==second and len(transport.calls)==1
    with pytest.raises(GroqAdapterError,match='REQUEST_ID_CONFLICT'): adapter.generate(request(input_text='changed'))
    assert len(transport.calls)==1


def test_unknown_transport_failure_is_nonretryable_and_sanitized():
    adapter=GroqAdapter(RaisingTransport())
    with pytest.raises(GroqAdapterError,match='TRANSPORT_FAILURE') as caught: adapter.generate(request())
    assert caught.value.retryable is False and 'private transport detail' not in str(caught.value)


@pytest.mark.parametrize('frames',[
    [chunk('ok'),chunk(finish='stop',usage={'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}),chunk('late')],
    [chunk('ok',usage={'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}),chunk(finish='stop')],
    [chunk('ok'),chunk(finish='stop',usage={'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}),chunk()],
    [chunk('ok'),chunk(finish='stop'),
     {'id':'groq-stream','object':'chat.completion.chunk','choices':[],
      'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},chunk('late')],
])
def test_stream_rejects_frames_outside_single_terminal_usage_frame(frames):
    adapter=GroqAdapter(FakeTransport(wire(frames)))
    with pytest.raises(GroqAdapterError,match='RESPONSE_MALFORMED'): adapter.stream(request(request_id='hostile-stream'))
    with pytest.raises(GroqAdapterError,match='RECEIPT_NOT_FOUND'): adapter.receipt('hostile-stream')
