import assert from 'node:assert/strict';
import test from 'node:test';
import {resultReworkFixture} from './result-rework-fixture.ts';
import {resultReviewHash,resultReviewId} from './result-review-fixture.ts';
const mod:any=await import('../../../apps/server/modules/results/result-reworks.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function service(f:any){assert.equal(typeof mod.SyntheticResultReworks,'function','원결과 보완 연결 미구현');return new mod.SyntheticResultReworks(f.store);}
test('부족조건만원결과/검수/같은단계세션에연결하고합격조건은보존한다',async()=>{
 const f=await resultReworkFixture(),before=structuredClone(f.review),r=await service(f).requestRework(f.scope,f.reworkId,f.input);
 assert.deepEqual(r.snapshot.originalResultRef,f.result.ref);assert.deepEqual(r.snapshot.reviewRef,f.review.ref);assert.deepEqual(r.snapshot.missingItems,['browser']);assert.deepEqual(r.snapshot.preservedItems,['unit']);assert.deepEqual(r.snapshot.remainingMissingItems,[]);assert.deepEqual(r.snapshot.stageSessionRef,f.basis.stageSessionRef);assert.deepEqual(r.snapshot.sourceScopes,f.input.sourceScopes);assert.equal(r.snapshot.status,'REWORK_ASSIGNMENT_DRAFT');for(const flag of ['executionAuthorized','dispatchPerformed','formalFailureCounted','completionAccepted'])assert.equal(r.snapshot[flag],false);assert.deepEqual(f.review,before);assert.equal(f.journal.size,1);
});
test('합격항목재실행/범위확대·다른기준/세션입력은보완초안을만들지않는다',async()=>{
 for(const alter of [(f:any)=>f.input.missingItems=['unit'],(f:any)=>f.input.missingItems.push('browser'),(f:any)=>f.input.sourceScopes=f.basis.allowedSourceScopes,(f:any)=>f.input.sourceScopes[0].targets[0].relativePath='../outside.ts',(f:any)=>f.input.reviewRef={...f.input.reviewRef,id:resultReviewId(99)},(f:any)=>f.input.stageSessionRef=f.basis.stageSessionRef]){const f=await resultReworkFixture();alter(f);await assert.rejects(service(f).requestRework(f.scope,f.reworkId,f.input));assert.equal(f.journal.size,0);}
});
test('다른원결과/완료판정위조와현재세션·영향범위전환/만료는거절한다',async()=>{
 for(const alter of [(f:any)=>f.input.resultRef={...f.input.resultRef,id:resultReviewId(99)},(f:any)=>{f.review.snapshot.completionAccepted=true;f.review.ref.contentHash=resultReviewHash(f.review.snapshot);f.basis.reviewRef=structuredClone(f.review.ref);f.input.reviewRef=structuredClone(f.review.ref);},(f:any)=>f.afterRead(()=>f.basis.stageSessionRef={...f.basis.stageSessionRef,version:2}),(f:any)=>f.afterRead(()=>f.expire())]){const f=await resultReworkFixture();alter(f);await assert.rejects(service(f).requestRework(f.scope,f.reworkId,f.input));assert.equal(f.journal.size,0);}
});
test('보완ID재확인은같은초안이고새이유/손상원문으로기존이력을덮지않는다',async()=>{
 const f=await resultReworkFixture(),s=service(f),first=await s.requestRework(f.scope,f.reworkId,f.input);assert.deepEqual(await s.requestRework(f.scope,f.reworkId,f.input),first);assert.equal(f.appends,1);const changed=structuredClone(f.input);changed.reason='다른 보완';await assert.rejects(s.requestRework(f.scope,f.reworkId,changed),/RESULT_REWORK_ID_CONFLICT/);assert.equal(f.appends,1);f.journal.get(f.reworkId).snapshot.reason='손상';await assert.rejects(s.requestRework(f.scope,f.reworkId,f.input),/RESULT_REWORK_LEDGER_INVALID/);
});
test('보완저장대기중범위/transport전환은기존단계에writer를만들지않는다',async()=>{
 for(const point of ['readRework','appendRework']){const f=await resultReworkFixture(),original=f.store.transaction;f.store.transaction=async(scope:any,body:any)=>original(scope,(tx:any)=>body({...tx,[point]:async(...args:any[])=>{const v=await tx[point](...args);f.store.transport='REAL';return v;}}));await assert.rejects(service(f).requestRework(f.scope,f.reworkId,f.input),/SYNTHETIC_RESULT_REWORK_STORE_REQUIRED/);assert.equal(f.journal.size,0);}
 const f=await resultReworkFixture();f.afterRead(()=>f.basis.affectedSourceScopes[0].targets[0].access='READ');await assert.rejects(service(f).requestRework(f.scope,f.reworkId,f.input),/RESULT_REWORK_SCOPE_EXPANSION/);assert.equal(f.journal.size,0);
});
