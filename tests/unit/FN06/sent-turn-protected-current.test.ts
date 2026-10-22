import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sentResponseHandleFixture} from './sent-response-handle-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
async function fixture(){
 const x=await sentResponseHandleFixture(),e=x.f.e;if(e.operation!=='SEND_INSTRUCTION')throw Error('QA_SEND_REQUIRED');
 const at=x.f.f.basis.fact.checkedAt,ref=e.payload.instructionRef,seed:any={transport:'SYNTHETIC_ONLY',key:receiptKeyV1(e),envelopeHash:e.envelopeHash,sessionBindingRef:e.payload.sessionBindingRef,instructionRef:ref,partsRef:e.payload.partsRef,materialReceiptRef:ref,instructionContentHash:x.selection.instructionContentHash,understandingReviewRef:null,grantRef:x.selection.grantRef,ownershipRef:x.f.f.basis.fact.checks.osFence.evidenceRefs[0],turnState:'IN_PROGRESS',checkedAt:at,expiresAt:e.expiresAt};
 const pre={...structuredClone(seed),threadId:'private-response-thread',turnState:'IDLE'},input:any={envelope:e,preSendSnapshot:pre,preSendBindingHash:x.selection.preSendBindingHash,attemptRef:x.selection.attemptRef,permitRef:x.selection.permitRef,responseRef:ref,parentThreadClaimRef:x.selection.claimRef,fact:{}};
 let mode='',reads=0,now=Date.parse(at);let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
 const metadata:any={transport:'SYNTHETIC_ONLY',readCurrent:async()=>{reads++;enter();if(mode==='DELAY')await gate;const v=structuredClone(seed);if(mode==='THREAD_FIELD')v.threadId='caller-thread';if(mode==='OWNER')v.ownershipRef={...v.ownershipRef,version:2};if(mode==='HASH')v.instructionContentHash='0'.repeat(64);if(mode==='EXPIRE')now+=26000;if(mode==='PORT')metadata.transport='REAL';return v;}};
 const parent=structuredClone({claim:x.selection.claim,claimRef:x.selection.claimRef});
 const m=await import('../../../apps/connector/runtime/sent-turn-protected-current.ts'),source=new m.SyntheticSentTurnProtectedCurrent(x.reader,parent,metadata,{clock:()=>now,timeoutMs:1000});
 return{x,input,parent,source,seed,metadata,mode:(v:string)=>mode=v,reads:()=>reads,entered,release:()=>release()};
}
test('응답용 보호 THREAD에서만 private snapshot 식별자를 조립하고 metadata 식별자는 받지 않는다',async()=>{
 const f=await fixture(),v:any=await f.source.readCurrent(f.input,new AbortController().signal);
 assert.equal(v.threadId,'private-response-thread');assert.equal(v.turnState,'IN_PROGRESS');assert.equal(f.reads(),1);assert.equal(f.x.reads(),1);assert(f.x.buffers.every(b=>b.every(v=>v===0)));
 assert.equal('plaintext' in v,false);assert.equal('bytes' in v,false);
});
test('다른 원부모·보호 THREAD/metadata thread·소유·자료hash를 현재 snapshot으로 조립하지 않는다',async()=>{
 for(const mode of ['PARENT','THREAD','THREAD_FIELD','OWNER','HASH','EXPIRE','PORT']){
  const f=await fixture();f.mode(mode);if(mode==='PARENT')f.input.parentThreadClaimRef={...f.input.parentThreadClaimRef,version:2};if(mode==='THREAD')f.input.preSendSnapshot.threadId='other-thread';
  await assert.rejects(f.source.readCurrent(f.input,new AbortController().signal),{message:'SENT_TURN_PROTECTED_CURRENT_UNAVAILABLE'});assert(f.x.buffers.every(b=>b.every(v=>v===0)));
 }
});

test('metadata 대기 취소/timeout 뒤 늦은 snapshot은 수용하지 않고 보호 평문을 소거한다',async()=>{
 for(const cancel of [true,false]){
  const f=await fixture();f.mode('DELAY');const c=new AbortController();
  const rejected=assert.rejects(f.source.readCurrent(f.input,c.signal),{message:'SENT_TURN_PROTECTED_CURRENT_UNAVAILABLE'});
  await f.entered;if(cancel)c.abort();await rejected;f.release();await new Promise<void>(r=>setImmediate(r));
  assert.equal(f.reads(),1);assert.equal(f.x.reads(),1);assert(f.x.buffers.every(b=>b.every(v=>v===0)));
 }
});

test('고정 부모와 await 전에 복제한 입력은 caller의 후속 변경으로 바뀌지 않는다',async()=>{
 const f=await fixture(),expected=structuredClone(f.input.preSendSnapshot.grantRef);
 f.parent.claimRef={...f.parent.claimRef,version:2};f.parent.claim.commandId='00000000-0000-4000-8000-000000000000';
 f.mode('DELAY');const work=f.source.readCurrent(f.input,new AbortController().signal);await f.entered;
 f.input.preSendSnapshot.threadId='caller-change';f.input.preSendSnapshot.grantRef={...expected,version:99};f.input.attemptRef={...f.input.attemptRef,version:99};f.release();
 const v:any=await work;assert.deepEqual(v.grantRef,expected);assert.equal(v.threadId,'private-response-thread');assert(f.x.buffers.every(b=>b.every(v=>v===0)));
});

test('원서버·실제 수신기·보호 reader·metadata 조립을 함께 소비하고 원 자료/원장·허가를 보존한다',async()=>{
 const f=await fixture(),a=f.x.f,e=a.e;if(e.operation!=='SEND_INSTRUCTION')throw Error('QA_SEND_REQUIRED');
 const{SyntheticMaterialReceiver}=await import('../../../apps/connector/runtime/execution-material-receiver.ts'),{SyntheticSentTurnMaterialCurrent}=await import('../../../apps/connector/runtime/sent-turn-material-current.ts'),{SyntheticSentTurnCurrentBinding}=await import('../../../apps/connector/runtime/sent-turn-current-binding.ts');
 const at=a.f.basis.fact.checkedAt,bytes=Buffer.from('합성 응답 자료 연결'),ref=e.payload.instructionRef,hash=(v:unknown)=>contentHash(canonicalJson(v));
 const d={projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration,commandId:e.commandId,envelopeHash:e.envelopeHash,payloadRef:ref,sourceRef:ref,partIndex:1,partCount:1,byteOffset:0,sourceBytes:bytes.length,utf8Bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'},part={ref:{id:crypto.randomUUID(),version:1,contentHash:hash(d)},snapshot:d};
 const events:any[]=[],blobs=new Map<string,Uint8Array>();let writes=0;
 const receiver=new SyntheticMaterialReceiver({transport:'SYNTHETIC_ONLY',exclusive:async(_s,body)=>body({read:async()=>({complete:true,events:structuredClone(events)}),readPart:async r=>new Uint8Array(blobs.get(r.id)!),appendAndSync:async(r,b)=>{writes++;events.push(structuredClone(r));blobs.set(r.ref.id,new Uint8Array(b));}})},{context:e.context,executorRegistrationRef:e.executorRegistrationRef},[part],{maxBytes:65536,maxParts:1,clock:()=>Date.parse(at)});
 await receiver.record(e,{transport:'SYNTHETIC_ONLY',materialId:part.ref.id,materialRef:part.ref,sourceRef:ref,partIndex:1,partCount:1,byteOffset:0,sourceBytes:bytes.length,contentHash:d.contentHash,mediaType:'text/plain',bytes,cacheControl:'no-store',completeContextVerified:false,executionAuthorized:false,dispatchPerformed:false});
 const material=await receiver.instruction(e),basis:any=await a.bound(s=>s.currentSentResponse(e,a.claimRef));
 for(const v of[f.seed,f.input.preSendSnapshot]){v.contextReviewFact=structuredClone(basis.basis.fact);v.materialReceiptRef=material.materialReceiptRef;v.instructionContentHash=material.contentHash;}
 material.bytes.fill(0);a.attempt.instructionContentHash=material.contentHash;
 const{checkedAt:_,expiresAt:__,...binding}=f.input.preSendSnapshot,{checkedAt:___,...stable}=binding.contextReviewFact;binding.contextReviewFact=stable;
 f.input.preSendBindingHash=hash(binding);a.attempt.bindingHash=f.input.preSendBindingHash;
 const owned:Uint8Array[]=[],source={transport:'SYNTHETIC_ONLY' as const,read:async(v:any)=>{const r=await receiver.instructionSource().read(v);owned.push(r.bytes);return r;}};
 const local=new SyntheticSentTurnMaterialCurrent(source,f.source,{clock:()=>Date.parse(at),timeoutMs:1000}),current=new SyntheticSentTurnCurrentBinding(f.x.server,local,{clock:()=>Date.parse(at),timeoutMs:1000});
 const before=canonicalJson(a.f.state()),v:any=await current.readCurrent(f.input,new AbortController().signal);
 assert.equal(v.threadId,'private-response-thread');assert.equal(v.turnState,'IN_PROGRESS');assert.equal(v.instructionContentHash,contentHash(bytes));assert.deepEqual(v.materialReceiptRef,events[0].ref);
 assert.equal(writes,1);assert.equal(owned.length,2);assert([...owned,...f.x.buffers].every(b=>b.every(v=>v===0)));assert.deepEqual(Buffer.from(blobs.get(events[0].ref.id)!),bytes);assert.equal(canonicalJson(a.f.state()),before);
 assert.equal(f.x.currents(),4);assert(!a.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
});
