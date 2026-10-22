import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {advanceOwnershipHeadV1} from '../../../contracts/runtime/ownership-ledger-v1.ts';
import {ownershipArchiveFixture} from './ownership-archive-fixture.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-request-event.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function plan(basis:unknown){assert.equal(typeof m.planOwnershipObservationRequest,'function','원 준비를 소비하는 서버 nonce 요청 조립이 필요하다');return m.planOwnershipObservationRequest(basis);}
function rehash(record:any){record.ref.contentHash=contentHash(canonicalJson(record.snapshot));return record;}

test('서버 nonce·event ID를 새로 생성하고 원 요청 fullref/phase/최소 기한을 고정한다',async()=>{
 const f=await ownershipArchiveFixture(),b=f.requestBasis(),before=structuredClone(b),p=plan(b),q=plan(b);
 assert.equal(p.purpose,'OWNERSHIP_REQUEST_EVENT_PLAN');assert.equal(p.executionAuthorized,false);assert.equal(p.dispatchPerformed,false);
 assert.deepEqual(p.request.requestRef,p.event.ref);assert.equal('requestRef'in p.event.snapshot.payload.request,false);assert.equal(p.request.phase,'BOOTSTRAP_PREPARED');assert.equal(p.request.expectedHeadRef,null);
 assert.match(p.request.nonce,/^[A-Za-z0-9_-]{43}$/);assert.equal(Buffer.from(p.request.nonce,'base64url').length,32);assert.notEqual(p.request.nonce,q.request.nonce);assert.notEqual(p.event.ref.id,q.event.ref.id);
 assert.equal(Date.parse(p.request.expiresAt)-b.nowMs,10000);assert.deepEqual(p.request.preparationRef,b.preparation.ref);assert.deepEqual(p.candidateAnchor,b.anchor);assert.deepEqual(b,before);
 const short=plan({...b,authorityExpiresAt:new Date(b.nowMs+5).toISOString()});assert.equal(Date.parse(short.request.expiresAt),b.nowMs+5);
});

test('CURRENT는 exact 채택 head/tail·원 anchor를 유지하고 bootstrap 후보를 내보내지 않는다',async()=>{
 const f=await ownershipArchiveFixture(true),b=f.requestBasis(),p=plan(b);
 assert.equal(p.request.phase,'CURRENT');assert.deepEqual(p.request.expectedHeadRef,b.head.ref);assert.deepEqual(p.request.anchorRef,b.anchor.ref);assert.equal(p.candidateAnchor,null);
 const wrong=structuredClone(b);wrong.head.snapshot.currentEventRef=wrong.preparation.ref;rehash(wrong.head);assert.throws(()=>plan(wrong),/OWNERSHIP_REQUEST_PLAN_INVALID/);
});

test('정상 BINDING_RECORDED 뒤 CURRENT를 허용하되 exact head와 원 준비 귀속을 유지한다',async()=>{
 const f=await ownershipArchiveFixture(true),b=f.requestBasis(),tail=b.tail;
 const binding=rehash({ref:{...tail.ref,id:'30000000-0000-4000-8000-000000000071'},snapshot:{...tail.snapshot,kind:'BINDING_RECORDED',sequence:tail.snapshot.sequence+1,previousRef:tail.ref,payload:{anchorRef:b.anchor.ref,bindingRef:{id:'30000000-0000-4000-8000-000000000072',version:1,contentHash:'a'.repeat(64)},expectedHeadRef:b.head.ref},at:new Date(b.nowMs-1).toISOString()}});
 const head=advanceOwnershipHeadV1(b.head,binding,b.head.ref.id,b.nowMs),p=plan({...b,tail:binding,head});
 assert.equal(p.request.phase,'CURRENT');assert.deepEqual(p.request.preparationRef,b.preparation.ref);assert.deepEqual(p.request.anchorRef,b.anchor.ref);assert.deepEqual(p.request.expectedHeadRef,head.ref);assert.deepEqual(p.event.snapshot.previousRef,binding.ref);
 assert.throws(()=>plan({...b,tail:binding}),/OWNERSHIP_REQUEST_PLAN_INVALID/);
 const other=structuredClone(binding);other.snapshot.commandRef.id='30000000-0000-4000-8000-000000000081';other.snapshot.authorizationReceiptRef.id='30000000-0000-4000-8000-000000000082';other.snapshot.auditRef.id='30000000-0000-4000-8000-000000000083';rehash(other);
 const otherHead=advanceOwnershipHeadV1(b.head,other,b.head.ref.id,b.nowMs),continued=plan({...b,tail:other,head:otherHead});
 assert.deepEqual(continued.event.snapshot.commandRef,b.preparation.snapshot.commandRef);assert.deepEqual(continued.event.snapshot.authorizationReceiptRef,b.preparation.snapshot.authorizationReceiptRef);assert.deepEqual(continued.event.snapshot.auditRef,b.preparation.snapshot.auditRef);
});

test('원 준비/anchor 변조·수명·terminal head·nonce/phase 등 caller 주입을 거절한다',async()=>{
 const f=await ownershipArchiveFixture(),b=f.requestBasis();
 for(const change of [(v:any)=>{v.nonce='A'.repeat(43);},(v:any)=>{v.phase='CURRENT';},(v:any)=>{v.anchor.snapshot.processRef.pid++;},(v:any)=>{v.anchor.snapshot.processRef.runId='30000000-0000-4000-8000-000000000099';rehash(v.anchor);},(v:any)=>{v.anchor.snapshot.scope.projectId='30000000-0000-4000-8000-000000000099';rehash(v.anchor);},(v:any)=>{v.anchor.snapshot.expiresAt=new Date(v.nowMs+200000).toISOString();rehash(v.anchor);},(v:any)=>{v.authorityExpiresAt=new Date(v.nowMs).toISOString();},(v:any)=>{v.nowMs=NaN;},(v:any)=>{v.tail.snapshot.subject.controlGeneration=2;rehash(v.tail);}]){const changed=structuredClone(b);change(changed);assert.throws(()=>plan(changed),/OWNERSHIP_REQUEST_PLAN_INVALID/);}
 const c=await ownershipArchiveFixture(true),current=c.requestBasis();current.head.snapshot.state='REVOKED';rehash(current.head);assert.throws(()=>plan(current),/OWNERSHIP_REQUEST_PLAN_INVALID/);
});

test('생성된 원 요청과 서명 보고를 기존 인증 수용 source가 실제 소비한다',async()=>{
 for(const current of [false,true]){const f=await ownershipArchiveFixture(current),p=plan(f.requestBasis()),input=f.installRequestPlan(p),result=await f.store.acceptAuthenticated(f.access,f.authToken,f.csrf,f.scope,input,new AbortController().signal);
  assert.equal(result.executionAuthorized,false);assert.equal(f.state().observations.length,1);assert.deepEqual(f.state().observations[0].snapshot.report.requestRef,p.event.ref);assert.equal(f.sessionReads(),2);
 }
});
