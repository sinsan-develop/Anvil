"""F05 MISTRAL host adapter contract tests; no network or credential I/O."""
from dataclasses import FrozenInstanceError
import json

import pytest

from packages.llm_gateway.contracts import GatewayRequest, ProviderAdapter, UsageProvenance
from packages.providers.mistral_adapter import MistralAdapter
from packages.providers.mistral_errors import MistralAdapterError
from packages.providers.mistral_models import TransportResponse, canonical, detached


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
    data=dict(provider='mistral',model='mistral-large-latest',input_text='hello',request_id='request-1')
    data.update(changes); return GatewayRequest(**data)


def completion(content='answer', *, identity='mistral-upstream', prompt=2, output=3):
    return {'id':identity,'object':'chat.completion','choices':[{'index':0,'message':{'role':'assistant','content':content},'finish_reason':'stop'}],
            'usage':{'prompt_tokens':prompt,'completion_tokens':output,'total_tokens':prompt+output}}


def chunk(content=None, *, finish=None, usage=None, identity='mistral-stream'):
    delta={} if content is None else {'content':content}
    body={'id':identity,'object':'chat.completion.chunk','choices':[{'index':0,'delta':delta,'finish_reason':finish}]}
    if usage is not None: body['usage']=usage
    return body


def test_generate_maps_openai_compatible_shape_and_detached_receipt():
    transport=FakeTransport(wire(completion(),headers=(('x-request-id','mistral-upstream'),)))
    adapter=MistralAdapter(transport); result=adapter.generate(request()); receipt=adapter.receipt('request-1')
    changed=receipt.to_dict(); changed['output_text']='forged'
    assert (result.request_id,result.provider,result.output_text)==('request-1','mistral','answer')
    assert result.final_usage.total_tokens==5 and result.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert receipt.to_dict()['upstream_request_id']=='mistral-upstream'
    assert adapter.receipt('request-1').to_dict()['output_text']=='answer'
    assert transport.calls==[('generate',{'model':'mistral-large-latest','messages':[{'role':'user','content':'hello'}]},'request-1',False)]
    with pytest.raises(FrozenInstanceError): receipt.content_hash='forged'


def test_provider_id_must_be_canonical_lowercase_before_transport():
    transport=FakeTransport(wire(completion())); adapter=MistralAdapter(transport)
    with pytest.raises(MistralAdapterError,match='PROVIDER_MISMATCH'):
        adapter.generate(request(provider='MISTRAL'))
    assert transport.calls==[]


def test_generate_accepts_official_additive_metadata_while_validating_required_fields():
    body=completion() | {'created':1710000000,'model':'mistral-large-latest','system_fingerprint':'fp_1'}
    body['choices'][0]['logprobs']=None
    body['choices'][0]['message']['refusal']=None
    body['usage']['queue_time']=0.01
    adapter=MistralAdapter(FakeTransport(wire(body)))
    assert adapter.generate(request()).output_text=='answer'


def test_response_header_request_id_can_differ_from_completion_id():
    adapter=MistralAdapter(FakeTransport(wire(completion(identity='cmpl-123'),headers=(('x-request-id','req-456'),))))
    result=adapter.generate(request())
    assert result.output_text=='answer'
    assert adapter.receipt('request-1').to_dict()['upstream_request_id']=='req-456'


def test_identical_histories_have_deterministic_receipts():
    a=MistralAdapter(FakeTransport(wire(completion()))); b=MistralAdapter(FakeTransport(wire(completion())))
    a.generate(request()); b.generate(request())
    assert a.receipt('request-1').content_hash==b.receipt('request-1').content_hash


def test_stream_collects_chunks_and_single_terminal_final_usage():
    usage={'prompt_tokens':4,'completion_tokens':2,'total_tokens':6}
    adapter=MistralAdapter(FakeTransport(wire([chunk('hel'),chunk('lo'),chunk(finish='stop',usage=usage)])))
    result=adapter.stream(request(request_id='stream-1'))
    assert result.chunks==('hel','lo') and result.response.output_text=='hello'
    assert result.response.final_usage.total_tokens==6
    assert result.receipt.content_hash==adapter.receipt('stream-1').content_hash


def test_stream_accepts_role_delta_and_separate_terminal_usage_frame():
    usage={'prompt_tokens':4,'completion_tokens':2,'total_tokens':6,'queue_time':0.01}
    frames=[
        {'id':'mistral-stream','object':'chat.completion.chunk','created':1710000000,
         'choices':[{'index':0,'delta':{'role':'assistant'},'finish_reason':None}],
         'usage':None},
        chunk('hello') | {'usage':None},
        chunk(finish='stop') | {'usage':None},
        {'id':'mistral-stream','object':'chat.completion.chunk','created':1710000001,
         'choices':[],'usage':usage},
    ]
    transport=FakeTransport(wire(frames)); adapter=MistralAdapter(transport)
    result=adapter.stream(request(request_id='official-stream'))
    assert result.chunks==('hello',) and result.response.final_usage.total_tokens==6
    assert transport.calls==[('stream',{
        'model':'mistral-large-latest',
        'messages':[{'role':'user','content':'hello'}],
        'stream_options':{'include_usage':True},
    },'official-stream',True)]


def test_abort_before_send_has_confirmed_zero_usage_and_no_io():
    transport=FakeTransport(); adapter=MistralAdapter(transport)
    result=adapter.generate(request(request_id='abort-1',abort_signal=lambda:True))
    assert transport.calls==[] and result.abort_status=='ABORTED'
    assert result.usage_provenance is UsageProvenance.ABORT_CONFIRMED and result.final_usage.total_tokens==0
    assert adapter.receipt('abort-1').to_dict()['transport_sent'] is False


def test_abort_after_send_preserves_final_usage():
    checks=iter((False,True,True,True)); usage={'prompt_tokens':5,'completion_tokens':1,'total_tokens':6}
    adapter=MistralAdapter(FakeTransport(wire([chunk('partial'),chunk(finish='stop',usage=usage)])))
    result=adapter.stream(request(request_id='abort-stream',abort_signal=lambda:next(checks)))
    assert result.response.abort_status=='ABORT_REQUESTED_UPSTREAM_COMPLETED'
    assert result.response.final_usage.total_tokens==6
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL


def test_abort_after_role_only_frame_keeps_arriving_content_and_final_usage():
    checks=iter((False,True,True,True))
    usage={'prompt_tokens':5,'completion_tokens':1,'total_tokens':6}
    frames=[
        {'id':'mistral-stream','object':'chat.completion.chunk',
         'choices':[{'index':0,'delta':{'role':'assistant'},'finish_reason':None}]},
        chunk('discarded'),
        chunk(finish='stop'),
        {'id':'mistral-stream','object':'chat.completion.chunk','choices':[],'usage':usage},
    ]
    transport=FakeTransport(wire(frames)); adapter=MistralAdapter(transport)
    wanted=request(request_id='abort-role-only',abort_signal=lambda:next(checks,True))
    result=adapter.stream(wanted)
    assert result.chunks==('discarded',) and result.response.output_text=='discarded'
    assert result.response.abort_status=='ABORT_REQUESTED_UPSTREAM_COMPLETED'
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert result.response.final_usage.total_tokens==6
    assert result.receipt.to_dict()['transport_sent'] is True
    assert result.receipt.to_dict()['abort_status']=='ABORT_REQUESTED_UPSTREAM_COMPLETED'
    assert adapter.receipt('abort-role-only')==result.receipt
    assert len(transport.calls)==1


def test_abort_after_send_without_any_content_is_valid_with_provider_final_usage():
    checks=iter((False,True,True,True))
    usage={'prompt_tokens':5,'completion_tokens':0,'total_tokens':5}
    frames=[
        {'id':'mistral-stream','object':'chat.completion.chunk',
         'choices':[{'index':0,'delta':{'role':'assistant'},'finish_reason':None}]},
        chunk(finish='stop'),
        {'id':'mistral-stream','object':'chat.completion.chunk','choices':[],'usage':usage},
    ]
    adapter=MistralAdapter(FakeTransport(wire(frames)))
    result=adapter.stream(request(request_id='abort-no-content',abort_signal=lambda:next(checks,True)))
    assert result.response.output_text=='' and result.chunks==()
    assert result.response.abort_status=='ABORTED'
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert result.response.final_usage.total_tokens==5
    assert result.receipt.to_dict()['transport_sent'] is True


def test_generate_abort_during_transport_keeps_provider_usage_and_marks_abort_request():
    state={'aborted':False}
    class AbortingTransport(FakeTransport):
        def request(self, *, operation, payload, request_id, stream):
            state['aborted']=True
            return super().request(operation=operation,payload=payload,request_id=request_id,stream=stream)
    adapter=MistralAdapter(AbortingTransport(wire(completion(prompt=5,output=2))))
    result=adapter.generate(request(request_id='generate-abort-during-send',
                                    abort_signal=lambda:state['aborted']))
    assert result.output_text=='answer'
    assert result.abort_status=='ABORT_REQUESTED_UPSTREAM_COMPLETED'
    assert result.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert result.final_usage.total_tokens==7
    assert adapter.receipt('generate-abort-during-send').to_dict()['abort_status']==result.abort_status


def test_health_discovery_and_probe_are_detached_and_provider_neutral():
    transport=FakeTransport(wire({'status':'ok'},headers=(('x-request-id','health-up'),)),
                            wire({'object':'list','data':[{'id':'z-model','object':'model'},{'id':'a-model','object':'model'}]}))
    adapter=MistralAdapter(transport); health=adapter.health(request_id='health-1'); models=adapter.discover(request_id='discover-1')
    assert isinstance(adapter,ProviderAdapter)
    assert adapter.probe({'text_generation','streaming'}).supported
    assert adapter.probe({'image_generation'}).unsupported_reasons==('missing capability: image_generation',)
    assert health.to_dict()['status']=='AVAILABLE' and models.to_dict()['models']==['a-model','z-model']
    value=models.to_dict(); value['models'].append('forged')
    assert adapter.receipt('discover-1').to_dict()['models']==['a-model','z-model']


def test_discovery_accepts_official_model_additive_metadata():
    body={'object':'list','data':[{
        'id':'mistral-large-latest','object':'model','created':1710000000,
        'owned_by':'Mistral','active':True,'context_window':32768,
    }]}
    models=MistralAdapter(FakeTransport(wire(body))).discover(request_id='models-metadata')
    assert models.to_dict()['models']==['mistral-large-latest']


@pytest.mark.parametrize('body',[
    {}, {'id':'x','object':'chat.completion','choices':[],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},
    {'id':'x','object':'wrong','choices':[{'index':0,'message':{'role':'assistant','content':'ok'},'finish_reason':'stop'}],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},
    {'id':'x','object':'chat.completion','choices':[{'index':0,'message':{'role':'assistant','content':1},'finish_reason':'stop'}],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},
    completion(prompt=1,output=1)|{'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':3}},
])
def test_unknown_or_malformed_success_fails_closed_without_receipt(body):
    adapter=MistralAdapter(FakeTransport(wire(body)))
    with pytest.raises(MistralAdapterError,match='RESPONSE_MALFORMED'): adapter.generate(request())
    with pytest.raises(MistralAdapterError,match='RECEIPT_NOT_FOUND'): adapter.receipt('request-1')


@pytest.mark.parametrize('status,body,headers,code,retryable,delay',[
    (401,{'error':{'type':'invalid_request_error','code':'invalid_api_key'}},(),'AUTHENTICATION_FAILED',False,None),
    (403,{'error':{'type':'permission_error','code':'permission_denied'}},(),'AUTHORIZATION_DENIED',False,None),
    (429,{'error':{'type':'rate_limit_error','code':'rate_limit_exceeded'}},(('retry-after','12'),),'RATE_LIMIT',True,12),
    (429,{'error':{'type':'insufficient_quota','code':'insufficient_quota'}},(),'QUOTA_EXHAUSTED',False,None),
    (503,{'error':{'type':'server_error','code':'service_unavailable'}},(('retry-after','3'),),'TEMPORARY_5XX',True,3),
])
def test_error_mapping_is_deterministic(status,body,headers,code,retryable,delay):
    adapter=MistralAdapter(FakeTransport(wire(body,status=status,headers=headers)))
    with pytest.raises(MistralAdapterError) as caught: adapter.generate(request())
    assert (caught.value.code,caught.value.retryable,caught.value.retry_after_seconds)==(code,retryable,delay)
    assert str(caught.value)==code


@pytest.mark.parametrize('body',[{'error':{}},{'error':{'type':'unknown','code':'unknown'}},{'error':'rate limit'}])
def test_quota_rate_limit_ambiguity_is_nonretryable(body):
    adapter=MistralAdapter(FakeTransport(wire(body,status=429)))
    with pytest.raises(MistralAdapterError,match='RATE_LIMIT_OR_QUOTA_AMBIGUOUS') as caught: adapter.generate(request())
    assert caught.value.retryable is False


def test_bare_mistral_401_is_auth_or_quota_ambiguous():
    adapter=MistralAdapter(FakeTransport(wire({'detail':'Unauthorized'},status=401)))
    with pytest.raises(MistralAdapterError,match='CREDENTIAL_OR_QUOTA_AMBIGUOUS') as caught:
        adapter.generate(request())
    assert caught.value.retryable is False


def test_explicit_invalid_key_401_is_authentication_failure():
    adapter=MistralAdapter(FakeTransport(wire({'detail':'Invalid API key'},status=401)))
    with pytest.raises(MistralAdapterError,match='AUTHENTICATION_FAILED') as caught:
        adapter.generate(request())
    assert caught.value.retryable is False


def test_discovery_accepts_omniroute_models_alias():
    body={'models':[{'id':'mistral-large-latest','object':'model','capabilities':{'completion_chat':True}}]}
    value=MistralAdapter(FakeTransport(wire(body))).discover(request_id='models-alias')
    assert value.to_dict()['models']==['mistral-large-latest']


def test_stream_without_terminal_provider_usage_fails_closed():
    adapter=MistralAdapter(FakeTransport(wire([chunk('partial'),chunk(finish='stop')])))
    with pytest.raises(MistralAdapterError,match='RESPONSE_MALFORMED'):
        adapter.stream(request(request_id='no-final-usage'))


@pytest.mark.parametrize('value',['','-1','86401','999999999999999999999999','tomorrow','1.5'])
def test_retry_after_malformed_or_overflow_fails_closed(value):
    adapter=MistralAdapter(FakeTransport(wire({'error':{'type':'rate_limit_error','code':'rate_limit_exceeded'}},status=429,headers=(('retry-after',value),))))
    with pytest.raises(MistralAdapterError,match='RETRY_AFTER_INVALID'): adapter.generate(request())


@pytest.mark.parametrize('header',['authorization','proxy-authorization','x-api-key','x-auth-token','access-token','x-client-secret'])
def test_credential_bearing_header_name_is_rejected_without_value_leak(header):
    value='innocent-looking-value'; adapter=MistralAdapter(FakeTransport(wire(completion(),headers=((header,value),))))
    with pytest.raises(MistralAdapterError,match='CREDENTIAL_MATERIAL_DETECTED') as caught: adapter.generate(request())
    assert value not in str(caught.value)


def test_credential_material_in_body_is_rejected_without_leak():
    material='Authorization: Bearer abcdefghijklmnop'
    adapter=MistralAdapter(FakeTransport(wire({'error':{'type':'bad','code':'bad','message':material}},status=400)))
    with pytest.raises(MistralAdapterError,match='CREDENTIAL_MATERIAL_DETECTED') as caught: adapter.generate(request())
    assert material not in str(caught.value)


@pytest.mark.parametrize('value',[float('nan'),float('inf'),float('-inf')])
def test_nonfinite_numbers_are_not_canonical_json(value):
    with pytest.raises(ValueError,match='VALUE_NOT_PLAIN'): canonical({'x':value})
    with pytest.raises(ValueError,match='VALUE_NOT_PLAIN'): detached([value])


def test_replay_is_stable_and_changed_input_is_rejected_before_send():
    transport=FakeTransport(wire(completion())); adapter=MistralAdapter(transport)
    first=adapter.generate(request()); second=adapter.generate(request())
    assert first==second and len(transport.calls)==1
    with pytest.raises(MistralAdapterError,match='REQUEST_ID_CONFLICT'): adapter.generate(request(input_text='changed'))
    assert len(transport.calls)==1


def test_failed_request_id_blocks_changed_input_before_retry_transport():
    transport=FakeTransport(wire({'detail':'rate limit'},status=429),wire(completion()))
    adapter=MistralAdapter(transport)
    with pytest.raises(MistralAdapterError): adapter.generate(request(request_id='failed-id'))
    with pytest.raises(MistralAdapterError,match='REQUEST_ID_CONFLICT'):
        adapter.generate(request(request_id='failed-id',input_text='changed'))
    assert len(transport.calls)==1
    result=adapter.generate(request(request_id='failed-id'))
    assert result.output_text=='answer' and len(transport.calls)==2


@pytest.mark.parametrize('operation',['generate','stream','health','discover'])
def test_oversize_request_id_is_rejected_before_transport(operation):
    transport=FakeTransport(); adapter=MistralAdapter(transport); identity='x'*129
    call=(lambda:getattr(adapter,operation)(request(request_id=identity))) if operation in {'generate','stream'} else (lambda:getattr(adapter,operation)(request_id=identity))
    with pytest.raises(MistralAdapterError,match='REQUEST_ID_INVALID'):
        call()
    assert transport.calls==[]


def test_unknown_transport_failure_is_nonretryable_and_sanitized():
    adapter=MistralAdapter(RaisingTransport())
    with pytest.raises(MistralAdapterError,match='TRANSPORT_FAILURE') as caught: adapter.generate(request())
    assert caught.value.retryable is False and 'private transport detail' not in str(caught.value)


@pytest.mark.parametrize('frames',[
    [chunk('ok'),chunk(finish='stop',usage={'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}),chunk('late')],
    [chunk('ok',usage={'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}),chunk(finish='stop')],
    [chunk('ok'),chunk(finish='stop',usage={'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}),chunk()],
    [chunk('ok'),chunk(finish='stop'),
     {'id':'mistral-stream','object':'chat.completion.chunk','choices':[],
      'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}},chunk('late')],
])
def test_stream_rejects_frames_outside_single_terminal_usage_frame(frames):
    adapter=MistralAdapter(FakeTransport(wire(frames)))
    with pytest.raises(MistralAdapterError,match='RESPONSE_MALFORMED'): adapter.stream(request(request_id='hostile-stream'))
    with pytest.raises(MistralAdapterError,match='RECEIPT_NOT_FOUND'): adapter.receipt('hostile-stream')
