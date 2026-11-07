import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(){
 const f=await sentResponseBasisFixture();f.fault('busy');
 if(f.e.operation!=='SEND_INSTRUCTION')throw Error('QA_SEND_REQUIRED');
 const first:any=await f.bound(s=>s.currentSentResponse(f.e,f.claimRef));
 const ref=f.e.payload.instructionRef,at=f.f.basis.fact.checkedAt;
 const pre:any={transport:'SYNTHETIC_ONLY',key:receiptKeyV1(f.e),envelopeHash:f.e.envelopeHash,sessionBindingRef:f.e.payload.sessionBindingRef,instructionRef:ref,partsRef:f.e.payload.partsRef,materialReceiptRef:ref,instructionContentHash:f.attempt.instructionContentHash,understandingReviewRef:null,grantRef:f.f.scope.grantRef,ownershipRef:first.basis.fact.checks.osFence.evidenceRefs[0],threadId:'private-thread',turnState:'IDLE',checkedAt:at,expiresAt:f.e.expiresAt,contextReviewFact:first.basis.fact};
 const {checkedAt:_,expiresAt:__,...binding}=pre,{checkedAt:___,...stable}=pre.contextReviewFact;binding.contextReviewFact=stable;f.attempt.bindingHash=hash(binding);
 const input:any={envelope:f.e,preSendSnapshot:pre,preSendBindingHash:f.attempt.bindingHash,attemptRef:f.attempt.localAttemptRef,permitRef:f.attempt.permitRef,responseRef:ref,parentThreadClaimRef:f.claimRef,fact:{}};
 let mode='',reads=0,locals=0,now=Date.parse(at);let enter!:()=>void,release!:()=>void;
 const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
 const server:any={transport:'SYNTHETIC_ONLY',currentSentResponse:async()=>{reads++;const v:any=await f.bound(s=>s.currentSentResponse(f.e,f.claimRef));if(mode==='GRANT')v.basis.grantRef={...f.f.scope.grantRef,version:2};if(mode==='PARENT')v.basis.parentThreadClaimRef={...f.claimRef,version:2};if(mode==='PERMIT')v.permitRef={...v.permitRef,version:2};if(mode==='HASH')v.attemptBinding.bindingHash='0'.repeat(64);if(mode==='REVOKED'&&reads===2)throw Error('REVOKED');return v;}};
 const local:any={transport:'SYNTHETIC_ONLY',readCurrent:async()=>{locals++;enter();if(mode==='LOCAL_DELAY')await gate;const v=structuredClone(pre);v.turnState='IN_PROGRESS';if(mode==='OWNER')v.ownershipRef={...v.ownershipRef,version:2};if(mode==='THREAD')v.threadId='other';if(mode==='LOCAL_STATE')v.turnState='IDLE';if(mode==='LATE'){f.f.advance(26000);now+=26000;}return v;}};
 const m=await import('../../../apps/connector/runtime/sent-turn-current-binding.ts');
 const supplier=new m.SyntheticSentTurnCurrentBinding(server,local,{clock:()=>now,timeoutMs:1000});
 return{f,input,supplier,mode:(v:string)=>mode=v,reads:()=>reads,locals:()=>locals,entered,release:()=>release()};
}
test('서버 원 기록을 private 현재 snapshot 전후 대조하고 BUSY를 같은 IN_PROGRESS로만 결박한다',async()=>{
 const x=await fixture(),v:any=await x.supplier.readCurrent(x.input,new AbortController().signal);
 assert.equal(v.turnState,'IN_PROGRESS');assert.equal(v.threadId,'private-thread');assert.deepEqual(v.contextReviewFact,x.input.preSendSnapshot.contextReviewFact);
 assert.equal(x.reads(),2);assert.equal(x.locals(),1);assert(!x.f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
});
test('다른 부모·permit·원hash·소유·private thread·상태와 조회중 회수/만료는 조립하지 않는다',async()=>{
 for(const mode of ['GRANT','PARENT','PERMIT','HASH','OWNER','THREAD','LOCAL_STATE','REVOKED','LATE']){
  const x=await fixture();x.mode(mode);await assert.rejects(x.supplier.readCurrent(x.input,new AbortController().signal),{message:'SENT_TURN_CURRENT_BINDING_UNAVAILABLE'});
 }
});

test('private 현재조회 중 취소·timeout 뒤 늦은 결과는 두번째 서버조회 없이 버린다',async()=>{
 for(const cancel of [true,false]){
  const x=await fixture();x.mode('LOCAL_DELAY');const controller=new AbortController();
  const work=x.supplier.readCurrent(x.input,controller.signal);const rejected=assert.rejects(work,{message:'SENT_TURN_CURRENT_BINDING_UNAVAILABLE'});
  await x.entered;if(cancel)controller.abort();await rejected;
  x.release();await new Promise<void>(r=>setImmediate(r));assert.equal(x.reads(),1);assert.equal(x.locals(),1);
 }
});

test('정합하게 재해시된 다른 pre grant도 서버의 원 grant와 다르면 거절한다',async()=>{
 const x=await fixture(),pre=x.input.preSendSnapshot;pre.grantRef={...pre.grantRef,version:2};
 const{checkedAt:_,expiresAt:__,...binding}=pre,{checkedAt:___,...stable}=pre.contextReviewFact;binding.contextReviewFact=stable;
 x.input.preSendBindingHash=hash(binding);x.f.attempt.bindingHash=x.input.preSendBindingHash;
 await assert.rejects(x.supplier.readCurrent(x.input,new AbortController().signal),{message:'SENT_TURN_CURRENT_BINDING_UNAVAILABLE'});
});
