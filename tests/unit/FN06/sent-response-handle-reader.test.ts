import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {encodeProviderHandleCapsule} from '../../../apps/connector/runtime/provider-handle-capsule.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';
async function fixture(){
 const f=await sentResponseBasisFixture();f.fault('busy');let mode='',currents=0,reads=0,now=Date.parse(f.f.basis.fact.checkedAt);
 const buffers:Uint8Array[]=[],server:any={transport:'SYNTHETIC_ONLY',currentSentResponse:async(e:any,r:any)=>{currents++;const v:any=await f.bound(s=>s.currentSentResponse(e,r));if(mode==='REVOKED'&&currents===2)throw Error('PRIVATE_REVOKED');if(mode==='PURPOSE')v.purpose='SEND';if(mode==='PERMIT')v.permitRef={...v.permitRef,version:2};if(mode==='GRANT')v.basis.grantRef={...v.basis.grantRef,version:2};if(mode==='OWNER'&&currents===2)v.basis.fact.writerState='UNKNOWN';return v;}};
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
 const store:any={transport:'SYNTHETIC_ONLY',read:async(c:any)=>{reads++;const{protectedHandleRef:_,...input}=c,bytes=encodeProviderHandleCapsule(input,{threadId:'private-response-thread',turnId:null});buffers.push(bytes);if(mode==='DELAY'){enter();await gate;}if(mode==='EXPIRE')now+=26000;return{ciphertextHash:mode==='CIPHER'?'e'.repeat(64):'f'.repeat(64),plaintext:bytes};}};
 const selection={envelope:f.e,claim:f.claim,claimRef:f.claimRef,attemptRef:f.attempt.localAttemptRef,permitRef:f.attempt.permitRef,grantRef:f.f.scope.grantRef,preSendBindingHash:f.attempt.bindingHash,instructionContentHash:f.attempt.instructionContentHash};
 const m=await import('../../../apps/connector/runtime/sent-response-handle-reader.ts'),reader=new m.SyntheticSentResponseHandleReader(server,store,{clock:()=>now,timeoutMs:1000});
 return{f,reader,selection,buffers,server,mode:(v:string)=>mode=v,currents:()=>currents,reads:()=>reads,entered,release:()=>release()};
}
test('응답 전용 BUSY 조회는 원 THREAD capsule을 private callback에만 전달하고 평문을 소거한다',async()=>{
 const x=await fixture(),before=canonicalJson(x.f.f.state());let calls=0;
 const result=await x.reader.use(x.selection,new AbortController().signal,async h=>{calls++;assert.equal(h.threadId,'private-response-thread');assert.equal(h.turnId,null);});
 assert.equal(result,undefined);assert.equal(calls,1);assert.equal(x.currents(),2);assert.equal(x.reads(),1);assert(x.buffers.every(b=>b.every(v=>v===0)));assert.equal(canonicalJson(x.f.f.state()),before);
 await assert.rejects(x.f.bound(s=>s.current(x.f.e,x.f.claimRef)));assert(!x.f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
});

test('보호 응답 취소/timeout 뒤 늦은 평문은 소거하고 callback·후속 current 조회하지 않는다',async()=>{
 for(const cancel of [true,false]){
  const x=await fixture();x.mode('DELAY');const controller=new AbortController();let calls=0;
  const rejected=assert.rejects(x.reader.use(x.selection,controller.signal,async()=>{calls++;}),{message:'SENT_RESPONSE_HANDLE_UNAVAILABLE'});
  await x.entered;if(cancel)controller.abort();await rejected;x.release();await new Promise<void>(r=>setImmediate(r));
  assert.equal(calls,0);assert.equal(x.currents(),1);assert.equal(x.reads(),1);assert.equal(x.buffers.length,1);assert(x.buffers.every(b=>b.every(v=>v===0)));
 }
});

test('callback 오류·마지막 await 취소를 성공으로 반환하지 않고 private 오류를 숨긴다',async()=>{
 for(const cancel of [true,false]){
  const x=await fixture(),controller=new AbortController();let calls=0;
  await assert.rejects(x.reader.use(x.selection,controller.signal,async()=>{calls++;if(cancel)controller.abort();else throw Error('PRIVATE_RAW_THREAD');}),{message:'SENT_RESPONSE_HANDLE_UNAVAILABLE'});
  assert.equal(calls,1);assert(x.buffers.every(b=>b.every(v=>v===0)));
 }
});

test('응답 reader는 다른 부모 ref/세대 및 TURN 선택을 보관 조회 전 거절한다',async()=>{
 for(const mode of ['REF','GENERATION','TURN']){
  const x=await fixture();if(mode==='REF')x.selection.claimRef={...x.selection.claimRef,version:2};
  if(mode==='GENERATION'){const e:any=structuredClone(x.selection.envelope);e.context.executionGeneration++;const{envelopeHash:_,...u}=e;const {contentHash}=await import('../../../contracts/canonical.ts');e.envelopeHash=contentHash(canonicalJson(u));x.selection.envelope=e;}
  if(mode==='TURN')x.selection.claim=x.f.x.claim as any;
  let calls=0;await assert.rejects(x.reader.use(x.selection,new AbortController().signal,async()=>{calls++;}),{message:'SENT_RESPONSE_HANDLE_UNAVAILABLE'});
  assert.equal(calls,0);assert.equal(x.reads(),0);
 }
});
test('다른 purpose·permit/grant·cipher·조회중 회수/소유변경·만료는 callback 없이 거절한다',async()=>{
 for(const mode of ['PURPOSE','PERMIT','GRANT','CIPHER','REVOKED','OWNER','EXPIRE']){
  const x=await fixture();x.mode(mode);let calls=0;
  await assert.rejects(x.reader.use(x.selection,new AbortController().signal,async()=>{calls++;}),{message:'SENT_RESPONSE_HANDLE_UNAVAILABLE'});
  assert.equal(calls,0);assert(x.buffers.every(b=>b.every(v=>v===0)));
 }
});

test('응답 전용 reader가 기존 RESOLVE protocol store를 소비하고 요청/frame/평문을 모두 소거한다',async()=>{
 const x=await fixture(),{SyntheticProviderHandleProtocolStore}=await import('../../../apps/connector/runtime/provider-handle-protocol-store.ts'),{SyntheticSentResponseHandleReader}=await import('../../../apps/connector/runtime/sent-response-handle-reader.ts');
 const requests:Uint8Array[]=[],frames:Uint8Array[]=[],plain:Uint8Array[]=[];let calls=0;
 const store=new SyntheticProviderHandleProtocolStore({transport:'SYNTHETIC_ONLY',read:async r=>{assert.deepEqual(r,x.selection.claimRef);return{claimRef:r,ciphertextHash:'f'.repeat(64),parent:null};}},{transport:'SYNTHETIC_ONLY',invoke:async request=>{
  calls++;requests.push(request);const q=JSON.parse(new TextDecoder().decode(request));assert.equal(q.operation,'RESOLVE_PROVIDER_HANDLE');assert.equal(q.claimId,x.selection.claim.claimId);
  const{protectedHandleRef:_,...binding}=x.selection.claim,bytes=encodeProviderHandleCapsule(binding,{threadId:'private-protocol-thread',turnId:null});
  const frame=Buffer.from(JSON.stringify({ok:true,data:{ciphertextHash:'f'.repeat(64),plaintext:Buffer.from(bytes).toString('base64url')}}));bytes.fill(0);frames.push(frame);return frame;
 }},{clock:()=>Date.parse(x.f.f.basis.fact.checkedAt),timeoutMs:1000});
 const reader=new SyntheticSentResponseHandleReader(x.server,{transport:'SYNTHETIC_ONLY',read:async(c,s)=>{const v=await store.read(c,s);plain.push(v.plaintext);return v;}},{clock:()=>Date.parse(x.f.f.basis.fact.checkedAt),timeoutMs:1000});
 let consumed=0;await reader.use(x.selection,new AbortController().signal,async h=>{consumed++;assert.equal(h.threadId,'private-protocol-thread');});
 assert.equal(calls,1);assert.equal(consumed,1);assert.equal(x.currents(),2);assert.equal(plain.length,1);assert([...requests,...frames,...plain].every(b=>b.every(v=>v===0)));
});
