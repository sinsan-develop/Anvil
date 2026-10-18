import test from 'node:test';
import assert from 'node:assert/strict';
import {Codex0161Codec} from '../../../apps/connector/adapters/primary/codec.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const frame=(value:unknown)=>Buffer.from(JSON.stringify(value)+'\n');
function refused(value:ReturnType<Codex0161Codec['encodeRequest']>,code:string){assert.equal(value.kind,'REJECTED');assert.ok(value.kind==='REJECTED');assert.equal(value.code,code);}
const thread={cliVersion:'0.161.0',createdAt:1,cwd:'C:\\synthetic',ephemeral:true,id:'thread-a',modelProvider:'synthetic',preview:'',projectId:null,sessionId:'session-a',source:'appServer',status:{type:'idle'},turns:[],updatedAt:1};
const threadResult={approvalPolicy:'untrusted',approvalsReviewer:'user',cwd:'C:\\synthetic',model:'synthetic',modelProvider:'synthetic',sandbox:{type:'readOnly'},thread};
function ready(bound=true){const c=new Codex0161Codec({maxFrameBytes:4096,maxPending:8});assert.equal(c.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}}).kind,'ENCODED');assert.equal(c.push(frame({id:'init',result:{codexHome:'C:\\synthetic-only',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}))[0]!.kind,'RPC_RESPONSE');assert.equal(c.encodeInitialized().kind,'ENCODED');assert.equal(c.encodeRequest('thread/start',1,{}).kind,'ENCODED');if(bound){assert.equal(c.push(frame({id:1,result:threadResult}))[0]!.kind,'RPC_RESPONSE');assert.equal(c.encodeRequest('turn/start',2,{threadId:'thread-a',input:[]}).kind,'ENCODED');assert.equal(c.push(frame({id:2,result:{turn:{id:'turn-a',items:[],status:'inProgress'}}}))[0]!.kind,'RPC_RESPONSE');}return c;}
const usage={inputTokens:11,cachedInputTokens:1,outputTokens:3,reasoningOutputTokens:2,totalTokens:14};
const events=[
 {method:'thread/status/changed',params:{threadId:'thread-a',status:{type:'active',activeFlags:['waitingOnApproval']}},kind:'THREAD_FACT'},
 {method:'thread/tokenUsage/updated',params:{threadId:'thread-a',turnId:'turn-a',tokenUsage:{last:usage,total:usage,modelContextWindow:4096}},kind:'ITEM_FACT'},
 {method:'turn/plan/updated',params:{threadId:'thread-a',turnId:'turn-a',explanation:'PRIVATE_EXPLANATION',plan:[{step:'PRIVATE_STEP',status:'completed'}]},kind:'ITEM_FACT'},
 {method:'turn/diff/updated',params:{threadId:'thread-a',turnId:'turn-a',diff:'PRIVATE_DIFF\n+PRIVATE_CONTENT'},kind:'ITEM_FACT'}
];
test('고정 상태·사용량·계획·diff 4종을 기존 사실/digest로만 읽고 원문/합격/허가를 만들지 않는다',()=>{
 const c=ready();for(const event of events){const value=c.push(frame({method:event.method,params:event.params}))[0]!;assert.equal(value.kind,event.kind);assert.equal(value.method,event.method);assert.equal(value.payloadDigest,contentHash(canonicalJson(event.params)));assert.equal(value.executionAuthorized,false);assert.equal(value.workAccepted,false);assert.equal(value.ownership,'UNVERIFIED');const text=JSON.stringify(value);for(const raw of ['thread-a','turn-a','PRIVATE_','waitingOnApproval','totalTokens','RECLAIMED'])assert.equal(text.includes(raw),false);assert.equal('toolStatus' in value,false);}
 assert.equal(c.encodeToolDecision('unverified',{decision:'accept'}).code,'SERVER_DECISION_VERIFIER_NOT_CONNECTED');assert.equal(c.finish()[0]!.kind,'STREAM_CLOSED');
});
test('4종의 필수필드/enum/형식·다른context는 원문없이 거절하고 sticky UNKNOWN를 유지한다',()=>{
 const invalids=[
  {method:'thread/status/changed',params:{threadId:'thread-a',status:{type:'active'}}},
  {method:'thread/status/changed',params:{threadId:'thread-a',status:{type:'imaginary'}}},
  {method:'thread/tokenUsage/updated',params:{threadId:'thread-a',turnId:'turn-a',tokenUsage:{last:{},total:usage}}},
  {method:'turn/plan/updated',params:{threadId:'thread-a',turnId:'turn-a',plan:[{step:'PRIVATE_STEP',status:'accepted'}]}},
  {method:'turn/diff/updated',params:{threadId:'thread-a',turnId:'turn-a',diff:9}}
 ];
 for(const event of invalids){const c=ready(),value=c.push(frame(event))[0]!;assert.equal(value.code,'SCHEMA_INVALID');assert.equal(JSON.stringify(value).includes('PRIVATE_'),false);refused(c.encodeRequest('turn/interrupt',3,{threadId:'thread-a',turnId:'turn-a'}),'CODEC_UNUSABLE');}
 for(const event of events){for(const params of [{...event.params,threadId:'other-thread'},...('turnId' in event.params?[{...event.params,turnId:'other-turn'}]:[])]){const c=ready(),value=c.push(frame({method:event.method,params}))[0]!;assert.equal(value.code,'CONTEXT_MISMATCH');assert.equal(value.kind,'CONTEXT_UNVERIFIED');assert.equal(JSON.stringify(value).includes('other-'),false);assert.equal(c.finish()[0]!.code,'CODEC_UNUSABLE');}}
});
test('새 thread 상태의 응답선행 통지는 임시미결박이고 정확응답만 결박하며 다른thread는 닫는다',()=>{
 const event={method:events[0]!.method,params:events[0]!.params};for(const matching of [true,false]){const c=ready(false),early=c.push(frame(event))[0]!;assert.equal(early.code,'CONTEXT_PENDING');assert.equal(early.executionAuthorized,false);assert.equal(early.workAccepted,false);refused(c.encodeRequest('thread/start',3,{}),'CONTEXT_PENDING');const response=c.push(frame({id:1,result:{...threadResult,thread:{...thread,id:matching?'thread-a':'other-thread'}}}))[0]!;if(matching){assert.equal(response.kind,'RPC_RESPONSE');assert.equal(c.push(frame(event))[0]!.kind,'THREAD_FACT');}else{assert.equal(response.code,'CONTEXT_MISMATCH');assert.equal(c.finish()[0]!.code,'CODEC_UNUSABLE');}}
});
