import assert from 'node:assert/strict';
import test from 'node:test';
import {resultReviewFixture,resultReviewId,resultReviewHash} from './result-review-fixture.ts';
const mod:any=await import('../../../apps/server/modules/results/result-reviews.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function service(f:ReturnType<typeof resultReviewFixture>){assert.equal(typeof mod.SyntheticResultReviews,'function','검수판정 저장 경계 미구현');return new mod.SyntheticResultReviews(f.store);}
test('제공자가호출범위를B로바꿔일관된B원문을돌려줘도A검수로저장하지않는다',async()=>{
 const f=resultReviewFixture(resultReviewId(101)),caller={...structuredClone(f.scope),projectId:resultReviewId(1)},before=structuredClone(caller),transaction=f.store.transaction;
 f.store.transaction=async(selected:any,body:any)=>{selected.projectId=f.scope.projectId;return transaction(selected,body);};
 await assert.rejects(service(f).evaluateResult(caller,f.reviewId,f.input),/RESULT_REVIEW_CURRENT_REQUIRED/);
 assert.equal(f.appendCount,0);assert.equal(f.journal.size,0);assert.deepEqual(caller,before);
});
test('완료주장을원문/등록증거와분리해조건별누락과보완판정을보존한다',async()=>{
 const f=resultReviewFixture(),before=structuredClone(f.result),value=await service(f).evaluateResult(f.scope,f.reviewId,f.input);
 assert.equal(value.snapshot.input.outcome,'REWORK');assert.equal(value.snapshot.assessment.items[0].state,'SUPPORTED_FOR_REVIEW');assert.equal(value.snapshot.assessment.items[1].state,'MISSING');assert.deepEqual(value.snapshot.unverified,['browser']);assert.equal(value.snapshot.completionAccepted,false);assert.equal(value.snapshot.executionAuthorized,false);assert.equal(value.snapshot.formalFailureCounted,false);assert.deepEqual(f.result,before);assert.equal(f.journal.size,1);
});
test('누락/미실행·빌드근거를브라우저검수합격으로바꾸지않는다',async()=>{
 for(const alter of [(f:any)=>{},(f:any)=>{f.result.snapshot.manifest.unexecuted=[{criterionId:'browser',testId:'FLOW-1',reason:'환경 없음'}];f.rehash();},(f:any)=>{f.complete();f.evidence.browser.snapshot.kind='BUILD';f.evidence.browser.ref.contentHash=resultReviewHash(f.evidence.browser.snapshot);f.result.snapshot.manifest.testResults[1].evidence[0].ref=f.evidence.browser.ref;f.input.items[1].evidenceRefs=[f.evidence.browser.ref];f.rehash();}]){
  const f=resultReviewFixture();alter(f);f.input.outcome='ACCEPTED';f.input.items[1].outcome='ACCEPTED';await assert.rejects(service(f).evaluateResult(f.scope,f.reviewId,f.input));assert.equal(f.journal.size,0);
 }
});
test('정확등록근거와독립검수조건이모두맞아도합성판정은실제완료/실행허가가아니다',async()=>{
 const f=resultReviewFixture();f.complete();const value=await service(f).evaluateResult(f.scope,f.reviewId,f.input);assert.equal(value.snapshot.input.outcome,'ACCEPTED');assert.deepEqual(value.snapshot.unverified,[]);assert.equal(value.snapshot.transport,'SYNTHETIC_ONLY');assert.equal(value.snapshot.completionAccepted,false);assert.equal(value.snapshot.dispatchPerformed,false);
 for(const alter of [(f:any)=>f.basis.independentReviewer=false,(f:any)=>f.basis.reviewerRef=f.result.snapshot.submittedByRef]){const bad=resultReviewFixture();bad.complete();alter(bad);await assert.rejects(service(bad).evaluateResult(bad.scope,bad.reviewId,bad.input));assert.equal(bad.journal.size,0);}
});
test('다른결과/기준·조건누락/중복과조회중권한전환/만료는판정을저장하지않는다',async()=>{
 for(const alter of [(f:any)=>f.input.resultRef={...f.input.resultRef,id:resultReviewId(80)},(f:any)=>f.input.criteriaRef.contentHash='f'.repeat(64),(f:any)=>f.input.items.pop(),(f:any)=>f.input.items.push(structuredClone(f.input.items[0])),(f:any)=>f.afterRead(()=>f.basis.authorityRef={...f.basis.authorityRef,id:resultReviewId(81)}),(f:any)=>f.afterRead(()=>f.expire())]){const f=resultReviewFixture();alter(f);await assert.rejects(service(f).evaluateResult(f.scope,f.reviewId,f.input));assert.equal(f.journal.size,0);}
});
test('같은판정ID재확인은원본을반환하고내용변경·저장원문손상은덮지않는다',async()=>{
 const f=resultReviewFixture(),s=service(f),first=await s.evaluateResult(f.scope,f.reviewId,f.input);assert.deepEqual(await s.evaluateResult(f.scope,f.reviewId,f.input),first);assert.equal(f.appendCount,1);
 const changed=structuredClone(f.input);changed.reason='다른 판단';await assert.rejects(s.evaluateResult(f.scope,f.reviewId,changed),/RESULT_REVIEW_ID_CONFLICT/);assert.equal(f.appendCount,1);
 f.journal.get(f.reviewId).snapshot.input.reason='변조';await assert.rejects(s.evaluateResult(f.scope,f.reviewId,f.input),/RESULT_REVIEW_LEDGER_INVALID/);
});
test('worker의출처이름이나필수N/A선언은등록근거와기준을바꾸지못한다',async()=>{
 const f=resultReviewFixture();f.complete();f.evidence.browser.snapshot.sourceKind='WORKER_CLAIM';f.evidence.browser.ref.contentHash=resultReviewHash(f.evidence.browser.snapshot);f.result.snapshot.manifest.testResults[1].evidence[0].ref=f.evidence.browser.ref;f.input.items[1].evidenceRefs=[f.evidence.browser.ref];f.rehash();await assert.rejects(service(f).evaluateResult(f.scope,f.reviewId,f.input),/RESULT_REVIEW_ACCEPTANCE_UNSUPPORTED/);assert.equal(f.journal.size,0);
 for(const required of [true,false]){const n=resultReviewFixture();n.complete();n.basis.criteria.snapshot.items[1].required=required;n.basis.criteria.ref.contentHash=resultReviewHash(n.basis.criteria.snapshot);n.input.criteriaRef=structuredClone(n.basis.criteria.ref);n.evidence.browser.snapshot.status='NOT_APPLICABLE';n.evidence.browser.ref.contentHash=resultReviewHash(n.evidence.browser.snapshot);n.result.snapshot.manifest.testResults[1].status='NOT_APPLICABLE';n.result.snapshot.manifest.testResults[1].evidence[0].ref=n.evidence.browser.ref;n.input.items[1].outcome='NOT_APPLICABLE';n.input.items[1].evidenceRefs=[n.evidence.browser.ref];n.rehash();if(required){await assert.rejects(service(n).evaluateResult(n.scope,n.reviewId,n.input),/RESULT_REVIEW_NOT_APPLICABLE_UNSUPPORTED/);assert.equal(n.journal.size,0);}else{const r=await service(n).evaluateResult(n.scope,n.reviewId,n.input);assert.deepEqual(r.snapshot.unverified,['browser']);assert.equal(r.snapshot.completionAccepted,false);}}
});
test('journal대기중transport전환은원자본문에서거절하며commit이후오류는저장0으로단정하지않는다',async()=>{
 for(const point of ['readReview','appendReview']){const f=resultReviewFixture(),original=f.store.transaction;f.store.transaction=async(scope:any,body:any)=>original(scope,(tx:any)=>body({...tx,[point]:async(...args:any[])=>{const v=await tx[point](...args);f.store.transport='REAL';return v;}}));await assert.rejects(service(f).evaluateResult(f.scope,f.reviewId,f.input),/SYNTHETIC_RESULT_REVIEW_STORE_REQUIRED/);assert.equal(f.journal.size,0);}
 const f=resultReviewFixture(),original=f.store.transaction;f.store.transaction=async(scope:any,body:any)=>{const v=await original(scope,body);f.store.transport='REAL';return v;};await assert.rejects(service(f).evaluateResult(f.scope,f.reviewId,f.input),/SYNTHETIC_RESULT_REVIEW_STORE_REQUIRED/);assert.equal(f.journal.size,1);
});
test('개별입력이한도안이어도근거/미확인합친검수원문이2MiB를넘으면저장하지않는다',async()=>{
 const f=resultReviewFixture(),base=f.basis.criteria.snapshot.items[0];f.basis.criteria.snapshot.items=Array.from({length:100},(_,n)=>({...base,criterionId:'C'+n,testId:'T'+n}));f.basis.criteria.ref.contentHash=resultReviewHash(f.basis.criteria.snapshot);f.input.criteriaRef=structuredClone(f.basis.criteria.ref);f.result.snapshot.manifest.testResults=[];f.rehash();
 f.input.reason='a'.repeat(20000);f.input.items=f.basis.criteria.snapshot.items.map((c:any)=>({criterionId:c.criterionId,outcome:'REWORK',evidenceRefs:[],reason:'a'.repeat(20000)}));const canonical=(v:any)=>JSON.stringify(v),limit=2*1024*1024;let remaining=Math.floor((limit-1000-Buffer.byteLength(canonical(f.input)))/2);assert(remaining>0);for(const item of f.input.items){const count=Math.min(remaining,20000);item.reason='가'.repeat(count)+'a'.repeat(20000-count);remaining-=count;}
 assert(Buffer.byteLength(canonical(f.input))<limit);await assert.rejects(service(f).evaluateResult(f.scope,f.reviewId,f.input),/RESULT_REVIEW_(LEDGER_INVALID|SIZE_LIMIT)/);assert.equal(f.journal.size,0);
});
