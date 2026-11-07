import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerBindingHash,validateProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(stop=false){
 const x=await providerTurnFixture(),claim=stop?x.claim:x.parent,parent=stop?x.parent:null,claimRef=validateProviderSessionClaim(claim,parent??undefined).ref;
 const envelope:any=structuredClone(x.record.snapshot.envelope);if(stop){envelope.operation='REQUEST_STOP';envelope.payload={sessionBindingRef:claim.agentSessionRef,stopScopeRef:x.record.ref};const{envelopeHash:_,...unsigned}=envelope;envelope.envelopeHash=hash(unsigned);}
 let clock=Date.parse(x.f.basis.fact.checkedAt),reads=0,currents=0,fault='';const buffers:Uint8Array[]=[];
 const now=()=>clock,current:any={transport:'SYNTHETIC_ONLY',current:async()=>{currents++;if(fault==='revoke'&&currents===2)throw Error('PRIVATE_RAW_HANDLE');return{key:receiptKeyV1(envelope),envelopeHash:envelope.envelopeHash,claimRef,parentThreadClaimRef:claim.parentThreadClaimRef,fact:structuredClone(x.f.basis.fact),expiresAt:envelope.expiresAt};}};
 const protectedStore:any={transport:'SYNTHETIC_ONLY',read:async(c:any)=>{reads++;const{protectedHandleRef:_,...input}=c;const bytes=new TextEncoder().encode(canonicalJson({schemaVersion:1,bindingHash:providerBindingHash(input),threadId:'QA-thread',turnId:c.kind==='THREAD'?null:'QA-turn'}));buffers.push(bytes);if(fault==='expiry')clock+=26000;return{ciphertextHash:fault==='cipher'?'e'.repeat(64):'f'.repeat(64),plaintext:bytes};}};
 return{x,claim,parent,claimRef,envelope,current,protectedStore,now,buffers,reads:()=>reads,currents:()=>currents,fault:(v:string)=>fault=v,advance:()=>clock+=26000,selection:()=>({envelope,claimRef,claim,parent})};
}
async function reader(f:Awaited<ReturnType<typeof fixture>>){const m=await import('../../../apps/connector/adapters/primary/provider-handle-reader.ts');assert.equal(typeof m.SyntheticProviderHandleReader,'function');return new m.SyntheticProviderHandleReader(f.current,f.protectedStore,{clock:f.now,timeoutMs:100});}
test('SEND/STOP exact claim을 내부 callback에서만 소비하고 원 bytes를 지운다',async()=>{
 for(const stop of [false,true]){const f=await fixture(stop),r=await reader(f);let calls=0;const result=await r.use(f.selection(),async h=>{calls++;assert.equal(h.threadId,'QA-thread');assert.equal(h.turnId,stop?'QA-turn':null);});assert.equal(result,undefined);assert.equal(calls,1);assert.equal(f.currents(),2);assert.equal(f.reads(),stop?2:1);assert(f.buffers.every(b=>b.every(v=>v===0)));}
});
test('다른 claim/세대·보호 hash·만료·현재 회수는 callback0이며 오류에 원문을 넣지 않는다',async()=>{
 for(const fault of ['hash','generation','cipher','expiry','revoke']){const f=await fixture(),r=await reader(f);if(fault==='hash')f.claimRef.contentHash='e'.repeat(64);else if(fault==='generation'){f.envelope.context.executionGeneration=2;const{envelopeHash:_,...u}=f.envelope;f.envelope.envelopeHash=hash(u);}else f.fault(fault);let calls=0;await assert.rejects(r.use(f.selection(),async()=>{calls++;}),/^Error: PROVIDER_HANDLE_UNAVAILABLE$/);assert.equal(calls,0);assert(f.buffers.every(b=>b.every(v=>v===0)));}
});
test('잘못된 TURN 부모와 비합성 port를 거절하고 callback 예외도 비밀 없이 정리한다',async()=>{
 const f=await fixture(true),r=await reader(f);f.parent!.source.responsePayloadDigest='0'.repeat(64);await assert.rejects(r.use(f.selection(),async()=>{}));assert.equal(f.reads(),0);
 const g=await fixture(),s=await reader(g);await assert.rejects(s.use(g.selection(),async()=>{throw Error('PRIVATE_RAW_HANDLE');}),/^Error: PROVIDER_HANDLE_UNAVAILABLE$/);assert(g.buffers.every(b=>b.every(v=>v===0)));g.protectedStore.transport='REAL';await assert.rejects(s.use(g.selection(),async()=>{}));
});
test('늦은 보호 응답은 callback 없이 bytes를 지우며 현재 주체 전환·부모 thread 불일치도 거절한다',async()=>{
 const f=await fixture(),read=f.protectedStore.read;let release!:()=>void,arrived!:()=>void;const started=new Promise<void>(r=>arrived=r),late=new Promise<void>(r=>release=r);f.protectedStore.read=async(...args:any[])=>{arrived();await late;return read(...args);};const r=await reader(f);let calls=0;const attempt=assert.rejects(r.use(f.selection(),async()=>{calls++;}),/^Error: PROVIDER_HANDLE_UNAVAILABLE$/);await started;await attempt;release();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(calls,0);assert.equal(f.buffers.length,1);assert(f.buffers[0]!.every(v=>v===0));
 const g=await fixture(),current=g.current.current;g.current.current=async()=>{const v=await current();if(g.currents()===2)v.fact.subject.credentialGeneration++;return v;};await assert.rejects((await reader(g)).use(g.selection(),async()=>{calls++;}));
 const h=await fixture(true),get=h.protectedStore.read;h.protectedStore.read=async(c:any)=>{const v=await get(c);if(c.kind==='THREAD'){const capsule=JSON.parse(new TextDecoder().decode(v.plaintext));capsule.threadId='other-QA-thread';const bytes=new TextEncoder().encode(canonicalJson(capsule));v.plaintext.fill(0);h.buffers.push(bytes);v.plaintext=bytes;}return v;};await assert.rejects((await reader(h)).use(h.selection(),async()=>{calls++;}));assert.equal(calls,0);assert(h.buffers.every(b=>b.every(v=>v===0)));
});
test('SEND 소비는 복호 capsule의 비canonical·중복키·BOM·escape alias를 거절한다',async()=>{
 for(const mutate of [
  (text:string)=>' '+text,
  (text:string)=>text.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'),
  (text:string)=>'\uFEFF'+text,
  (text:string)=>text.replace('QA-thread','QA-\\u0074hread'),
 ]){
  const f=await fixture(),read=f.protectedStore.read;f.protectedStore.read=async(c:any)=>{
   const v=await read(c),text=new TextDecoder().decode(v.plaintext),bytes=new TextEncoder().encode(mutate(text));
   v.plaintext.fill(0);f.buffers.push(bytes);return{...v,plaintext:bytes};
  };
  let calls=0;await assert.rejects((await reader(f)).use(f.selection(),async()=>{calls++;}),/^Error: PROVIDER_HANDLE_UNAVAILABLE$/);
  assert.equal(calls,0);assert(f.buffers.every(b=>b.every(v=>v===0)));
 }
});
