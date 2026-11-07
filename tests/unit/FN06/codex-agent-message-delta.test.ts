import test from 'node:test';
import assert from 'node:assert/strict';
import {Codex0161Codec} from '../../../apps/connector/adapters/primary/codec.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const frame=(value:unknown)=>Buffer.from(JSON.stringify(value)+'\n');
function ready(){const c=new Codex0161Codec({maxFrameBytes:4096,maxPending:8});assert.equal(c.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}}).kind,'ENCODED');assert.equal(c.push(frame({id:'init',result:{codexHome:'C:\\synthetic-only',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}))[0]!.kind,'RPC_RESPONSE');assert.equal(c.encodeInitialized().kind,'ENCODED');assert.equal(c.encodeRequest('turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'}).kind,'ENCODED');return c;}
const params={threadId:'thread-a',turnId:'turn-a',itemId:'item-a',delta:'PRIVATE_PROGRESS\n🔧 작업 중'};
test('고정schema Agent 메시지 delta를 정상 진행 fact로 읽고 본문/식별·허가/합격은 노출하지 않는다',()=>{
 const c=ready(),bytes=frame({method:'item/agentMessage/delta',params}),split=bytes.indexOf(Buffer.from('🔧'))+1;
 assert.deepEqual(c.push(bytes.subarray(0,split)),[]);const value=c.push(bytes.subarray(split))[0]!;
 assert.equal(value.kind,'OUTPUT_FACT');assert.equal(value.method,'item/agentMessage/delta');assert.equal(value.payloadDigest,contentHash(canonicalJson(params)));assert.equal(value.executionAuthorized,false);assert.equal(value.workAccepted,false);assert.equal(value.ownership,'UNVERIFIED');
 const text=JSON.stringify(value);for(const raw of ['PRIVATE_PROGRESS','thread-a','turn-a','item-a','작업 중'])assert.equal(text.includes(raw),false);
 assert.equal(c.push(frame({method:'turn/completed',params:{threadId:'thread-a',turn:{id:'turn-a',items:[],status:'completed'}}}))[0]!.kind,'TURN_FACT');assert.equal(c.push(frame({id:1,result:{}}))[0]!.kind,'INTERRUPT_RESPONSE');
});
test('진행 delta의 필수형식/다른 context/미지원 method는 기존 fail-closed로 거절한다',()=>{
 for(const value of [Object.fromEntries(Object.entries(params).filter(([key])=>key!=='delta')),{...params,delta:1},{...params,threadId:'other-thread'},{...params,turnId:'other-turn'}]){
  const c=ready(),fact=c.push(frame({method:'item/agentMessage/delta',params:value}))[0]!;assert.ok(['PROTOCOL_UNKNOWN','CONTEXT_UNVERIFIED'].includes(fact.kind));assert.ok(['SCHEMA_INVALID','CONTEXT_MISMATCH'].includes(fact.code!));assert.equal(c.encodeRequest('turn/interrupt',2,{threadId:'thread-a',turnId:'turn-a'}).kind,'REJECTED');assert.equal(JSON.stringify(fact).includes('PRIVATE_PROGRESS'),false);
 }
 const c=ready();assert.equal(c.push(frame({method:'item/invented/delta',params}))[0]!.code,'UNSUPPORTED_METHOD');
});
