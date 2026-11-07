import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {sentProcessEvidenceFixture} from './sent-process-evidence-fixture.ts';
async function fixture(){
 const x=await sentProcessEvidenceFixture(),s=x.selection,e=s.envelope;if(e.operation!=='SEND_INSTRUCTION')throw Error('QA_SEND_REQUIRED');
 let now=Date.parse(x.anchor.snapshot.recordedAt),mode='',reads=0;const at=new Date(now).toISOString();
 const pre:any={transport:'SYNTHETIC_ONLY',key:receiptKeyV1(e),envelopeHash:e.envelopeHash,sessionBindingRef:e.payload.sessionBindingRef,instructionRef:e.payload.instructionRef,partsRef:e.payload.partsRef,materialReceiptRef:e.payload.partsRef,instructionContentHash:s.instructionContentHash,understandingReviewRef:null,grantRef:x.grantRef,ownershipRef:s.ownershipEvidenceRef,threadId:'private-thread',turnState:'IDLE',checkedAt:at,expiresAt:e.expiresAt};
 const{checkedAt:_,expiresAt:__,...binding}=pre;s.preSendBindingHash=contentHash(canonicalJson(binding));x.setPreHash(s.preSendBindingHash);
 const{threadId:___,...metadataSeed}=structuredClone(pre);metadataSeed.turnState='IN_PROGRESS';
 const input:any={envelope:e,preSendSnapshot:pre,preSendBindingHash:s.preSendBindingHash,attemptRef:s.attemptRef,permitRef:s.permitRef,responseRef:e.payload.partsRef,parentThreadClaimRef:s.parentThreadClaimRef,fact:{}};
 let entered!:()=>void,release!:()=>void;const waiting=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const metadata:any={transport:'SYNTHETIC_ONLY',readCurrent:async()=>{reads++;if(['DELAY','LATE'].includes(mode)){entered();await gate;}if(mode==='LATE')now+=6000;const v=structuredClone(metadataSeed);if(mode==='THREAD')v.threadId='untrusted';if(mode==='AUTHORITY')v.currentAuthorityVerified=true;if(mode==='OWNER')v.ownershipRef={...v.ownershipRef,version:2};if(mode==='MATERIAL')v.instructionContentHash='0'.repeat(64);if(mode==='EXPIRED')v.expiresAt=at;if(mode==='STATE')v.turnState='OWNED';return v;}};
 const m=await import('../../../apps/connector/runtime/sent-process-metadata-gate.ts');
 const source=new m.SyntheticSentProcessMetadataGate(x.consumer,metadata,{clock:()=>now,timeoutMs:100});
 return{x,input,source,metadataSeed,mode:(v:string)=>mode=v,reads:()=>reads,waiting,release:()=>release()};
}
test('false 프로세스 증거를 응답 읽기 조건으로만 소비하고 별도 metadata를 권한 주입 없이 반환한다',async()=>{
 const f=await fixture(),v:any=await f.source.readCurrent(f.input,new AbortController().signal);
 const{expiresAt:_,...expected}=f.metadataSeed,{expiresAt:__,...actual}=v;assert.deepEqual(actual,expected);
 assert(Date.parse(v.expiresAt)<=Date.parse(f.metadataSeed.expiresAt));assert.equal(f.reads(),1);assert.equal(f.x.counts().observes,1);
 for(const k of ['purpose','state','processRef','threadId','currentAuthorityVerified','executionAuthorized','dispatchPerformed'])assert.equal(Object.hasOwn(v,k),false);
 await assert.rejects(f.source.readCurrent(f.input,new AbortController().signal),{message:'SENT_PROCESS_METADATA_UNAVAILABLE'});assert.equal(f.reads(),1);
});
test('원 pre hash·소유 증거 실패에는 metadata를 읽거나 재관측하지 않는다',async()=>{
 for(const mode of ['PRE_HASH','PARENT','OWNER','REVOKED']){
  const f=await fixture();if(mode==='PRE_HASH')f.input.preSendBindingHash='0'.repeat(64);if(mode==='PARENT')f.input.parentThreadClaimRef.version++;if(mode==='OWNER')f.input.preSendSnapshot.ownershipRef.version++;if(mode==='REVOKED')f.x.mode('REVOKED');
  await assert.rejects(f.source.readCurrent(f.input,new AbortController().signal),{message:'SENT_PROCESS_METADATA_UNAVAILABLE'});assert.equal(f.reads(),0);assert(f.x.counts().observes<=1);
 }
});
test('독립 metadata의 thread/권한필드·다른 소유/자료·상태·만료는 승격하지 않는다',async()=>{
 for(const mode of ['THREAD','AUTHORITY','OWNER','MATERIAL','EXPIRED','STATE']){
  const f=await fixture();f.mode(mode);await assert.rejects(f.source.readCurrent(f.input,new AbortController().signal),{message:'SENT_PROCESS_METADATA_UNAVAILABLE'});assert.equal(f.reads(),1);assert.equal(f.x.counts().observes,1);
 }
});
test('metadata 대기 중 취소·timeout·최종 기한 경과는 late 성공이나 재관측으로 바뀌지 않는다',async()=>{
 for(const mode of ['CANCEL','TIMEOUT','LATE']){
  const f=await fixture();f.mode(mode==='LATE'?'LATE':'DELAY');const c=new AbortController(),p=f.source.readCurrent(f.input,c.signal),rejected=assert.rejects(p,{message:'SENT_PROCESS_METADATA_UNAVAILABLE'});
  await f.waiting;if(mode==='CANCEL')c.abort();if(mode==='LATE')f.release();await rejected;f.release();await new Promise<void>(r=>setImmediate(r));assert.equal(f.reads(),1);assert.equal(f.x.counts().observes,1);
 }
});
test('await 전 복제한 pre/시도는 caller 변경으로 바뀌지 않는다',async()=>{
 const f=await fixture();f.mode('DELAY');const p=f.source.readCurrent(f.input,new AbortController().signal);await f.waiting;
 f.input.preSendSnapshot.ownershipRef.version++;f.input.permitRef.version++;f.input.preSendSnapshot.threadId='changed';f.release();const v:any=await p;assert.deepEqual(v.ownershipRef,f.metadataSeed.ownershipRef);
});
test('기존 보호 THREAD reader가 새 gate metadata를 소비해도 추가 권한/원문은 반환하지 않는다',async()=>{
 const f=await fixture(),at=Date.parse(f.x.anchor.snapshot.recordedAt),buffers:Uint8Array[]=[];
 const{encodeProviderHandleCapsule}=await import('../../../apps/connector/runtime/provider-handle-capsule.ts');
 const{SyntheticSentResponseHandleReader}=await import('../../../apps/connector/runtime/sent-response-handle-reader.ts');
 const{SyntheticSentTurnProtectedCurrent}=await import('../../../apps/connector/runtime/sent-turn-protected-current.ts');
 const store:any={transport:'SYNTHETIC_ONLY',read:async(c:any)=>{const{protectedHandleRef:_,...binding}=c,bytes=encodeProviderHandleCapsule(binding,{threadId:'private-thread',turnId:null});buffers.push(bytes);return{ciphertextHash:'f'.repeat(64),plaintext:bytes};}};
 const reader=new SyntheticSentResponseHandleReader(f.x.responseSource,store,{clock:()=>at,timeoutMs:1000});
 const current=new SyntheticSentTurnProtectedCurrent(reader,f.x.parent,f.source,{clock:()=>at,timeoutMs:1000});
 const anchor=canonicalJson(f.x.anchor),binding=canonicalJson(f.x.binding),v:any=await current.readCurrent(f.input,new AbortController().signal);
 assert.equal(v.threadId,'private-thread');assert.equal(v.turnState,'IN_PROGRESS');assert.deepEqual(v.ownershipRef,f.input.preSendSnapshot.ownershipRef);
 assert.equal(Object.hasOwn(v,'currentAuthorityVerified'),false);assert.equal(Object.hasOwn(v,'processRef'),false);assert.equal(Object.hasOwn(v,'plaintext'),false);
 assert.equal(f.reads(),1);assert.deepEqual(f.x.counts(),{serverReads:4,archiveReads:2,observes:1});assert.equal(buffers.length,1);assert(buffers.every(b=>b.every(v=>v===0)));
 assert.equal(canonicalJson(f.x.anchor),anchor);assert.equal(canonicalJson(f.x.binding),binding);
});
