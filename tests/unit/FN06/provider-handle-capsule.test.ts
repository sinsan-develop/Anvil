import assert from 'node:assert/strict';
import {test} from 'node:test';
import {providerBindingHash} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';

async function codec(){const m=await import('../../../apps/connector/runtime/provider-handle-capsule.ts');return m;}
async function binding(turn=false){const f=await providerTurnFixture();const {protectedHandleRef:_,...input}=turn?f.claim:f.parent;return input;}
test('보호 capsule은 exact binding과 THREAD/TURN을 canonical bytes로 연결한다',async()=>{
 const m=await codec();
 for(const turn of [false,true]){
  const input=await binding(turn),handles={threadId:'qa-thread:01',turnId:turn?'qa-turn.02':null};
  const bytes=m.encodeProviderHandleCapsule(input,handles);
  const expected='{"bindingHash":"'+providerBindingHash(input)+'","schemaVersion":1,"threadId":"qa-thread:01","turnId":'+(turn?'"qa-turn.02"':'null')+'}';
  assert.equal(new TextDecoder().decode(bytes),expected);
  assert.deepEqual(m.decodeProviderHandleCapsule(bytes,input),handles);
  assert.equal(Object.isFrozen(m.decodeProviderHandleCapsule(bytes,input)),true);
  bytes.fill(0);
 }
});
test('다른 binding·형식·중복키·비canonical·큰값·비UTF8은 raw 없는 고정 오류다',async()=>{
 const m=await codec(),input=await binding();
 const good=m.encodeProviderHandleCapsule(input,{threadId:'qa-thread',turnId:null});
 const raw=new TextDecoder().decode(good),bad=[
  new Uint8Array(),new Uint8Array(4097),new Uint8Array([0xff]),
  new TextEncoder().encode(' '+raw),
  new TextEncoder().encode(raw.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1')),
  new TextEncoder().encode(raw.replace('"turnId":null','"turnId":"PRIVATE_RAW_HANDLE"')),
  new TextEncoder().encode(raw.replace('"schemaVersion":1','"schemaVersion":2')),
  new TextEncoder().encode(raw.replace('"qa-thread"','"qa/thread"')),
  new TextEncoder().encode(raw.replace('"schemaVersion":1','"schemaVersion":1,"secret":"PRIVATE_RAW_HANDLE"')),
 ];
 for(const bytes of bad)assert.throws(()=>m.decodeProviderHandleCapsule(bytes,input),/^Error: PROVIDER_HANDLE_CAPSULE_INVALID$/);
 assert.throws(()=>m.decodeProviderHandleCapsule(good,{...input,commandId:'10000000-0000-4000-8000-000000000001'}),/^Error: PROVIDER_HANDLE_CAPSULE_INVALID$/);
 good.fill(0);
});
test('평문 생성은 추가필드·getter·원문경로·종류 불일치·512자 초과를 거절한다',async()=>{
 const m=await codec(),input=await binding(),turn=await binding(true);let getters=0;
 const accessor={get threadId(){getters++;return 'qa-thread';},turnId:null};
 for(const handles of [accessor,{threadId:'qa-thread',turnId:null,secret:'PRIVATE_RAW_HANDLE'},
  {threadId:'a'.repeat(513),turnId:null},{threadId:'qa/thread',turnId:null},
  {threadId:'qa-thread',turnId:'qa-turn'},{threadId:'',turnId:null}])
  assert.throws(()=>m.encodeProviderHandleCapsule(input,handles),/^Error: PROVIDER_HANDLE_CAPSULE_INVALID$/);
 assert.equal(getters,0);
 assert.throws(()=>m.encodeProviderHandleCapsule(turn,{threadId:'qa-thread',turnId:null}),/^Error: PROVIDER_HANDLE_CAPSULE_INVALID$/);
 const bytes=m.encodeProviderHandleCapsule(input,{threadId:'a'.repeat(512),turnId:null});
 assert.equal(m.decodeProviderHandleCapsule(bytes,input).threadId.length,512);bytes.fill(0);
});
