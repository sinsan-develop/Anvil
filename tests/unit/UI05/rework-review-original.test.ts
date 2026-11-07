import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaHash as hash,criteriaId as id} from '../FN12/result-criteria-fixture.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/rework-review-original.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=reworkFixture(),p=prepareResultRework(f.sources,f.input,f.now),at='2026-10-20T00:02:00.000Z',snapshot={scope:p.scope,input:f.input,criteriaRef:p.criteriaRef,roleRef:p.roleRef,stageSessionRef:p.stageSessionRef,remainingMissingItems:p.remainingMissingItems,preservedItems:[],requestedBy:{kind:'HUMAN',userId:id(6),clientId:id(24)},requestedAt:at,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},stored={projectId:p.scope.projectId,ref:{id:id(40),version:1,contentHash:hash(snapshot)},status:'RESULT_REWORK_DRAFT_STORED',snapshot,reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};return{...f,stored};}
test('보완 원문과 exact 원검토를 두 보호 GET으로 재대조하고 선택/잔여 조건을 연결한다',async()=>{
 assert.equal(typeof mod.readReworkReviewOriginal,'function','보완 원검토 직접 조회 미구현');const f=fixture(),calls:any[]=[];
 const out=await mod.readReworkReviewOriginal(new ApiClient(async(url,init)=>{calls.push({url,method:init?.method??'GET'});return Response.json(calls.length===1?f.stored:f.sources.review);}),f.sources.assignment,f.sources.result,f.stored,()=>true);
 assert.deepEqual(out.review,f.sources.review);assert.deepEqual(out.rework,f.stored);assert.deepEqual(out.selectedItems.map((i:any)=>i.criterionId),['save']);assert.deepEqual(out.remainingItems.map((i:any)=>i.criterionId),['denied']);assert.deepEqual(calls,[{url:`/api/v1/projects/${f.stored.projectId}/result-reworks/${f.stored.ref.id}`,method:'GET'},{url:`/api/v1/projects/${f.stored.projectId}/result-reviews/${f.sources.review.ref.id}`,method:'GET'}]);
 assert.equal(out.review.completionAccepted,false);assert.equal(out.rework.executionAuthorized,false);
});
test('다른 원검토·재해시된 다른 기준·누락 조건과 읽기 권한 거절은 대체하지 않는다',async()=>{
 assert.equal(typeof mod.readReworkReviewOriginal,'function');for(const mode of ['REF','CRITERIA','MISSING','DENIED']){const f=fixture(),review=structuredClone(f.sources.review);let n=0;if(mode==='REF')review.ref.id=id(99);if(mode==='CRITERIA')review.snapshot.input.criteriaRef.id=id(99);if(mode==='MISSING')review.snapshot.input.items=review.snapshot.input.items.slice(1);if(mode!=='REF')review.ref.contentHash=hash(review.snapshot);
  await assert.rejects(mod.readReworkReviewOriginal(new ApiClient(async()=>{n++;return n===1?Response.json(f.stored):mode==='DENIED'?Response.json({code:'ACCESS_DENIED'},{status:403}):Response.json(review);}),f.sources.assignment,f.sources.result,f.stored,()=>true));assert.equal(n,2);
 }
});
test('선택 이탈은 후속 원검토 조회를 막고 이전 결과를 돌려주지 않는다',async()=>{
 assert.equal(typeof mod.readReworkReviewOriginal,'function');const f=fixture();let active=true,n=0;const out=await mod.readReworkReviewOriginal(new ApiClient(async()=>{n++;active=false;return Response.json(f.stored);}),f.sources.assignment,f.sources.result,f.stored,()=>active);assert.equal(out,null);assert.equal(n,1);
});

test('참조를 정합하게 재해시해도 다른 기준과 선택/잔여 조건 집합 불일치를 각각 거절한다',async()=>{
 for(const mode of ['CRITERIA','ITEM_SET']){const f=fixture(),review=structuredClone(f.sources.review);if(mode==='CRITERIA')review.snapshot.input.criteriaRef.id=id(99);else review.snapshot.input.items=review.snapshot.input.items.slice(0,1);
  review.ref.contentHash=hash(review.snapshot);f.stored.snapshot.input.reviewRef=structuredClone(review.ref);f.stored.ref.contentHash=hash(f.stored.snapshot);let n=0;
  await assert.rejects(mod.readReworkReviewOriginal(new ApiClient(async()=>{n++;return Response.json(n===1?f.stored:review);}),f.sources.assignment,f.sources.result,f.stored,()=>true),(e:any)=>e.code===(mode==='CRITERIA'?'RESULT_REVIEW_HISTORY_RESPONSE_INVALID':'REWORK_REVIEW_ORIGINAL_MISMATCH'));assert.equal(n,2);
 }
});

test('첫 보완 GET 중 원입력이 정합하게 바뀌어도 후속 원검토는 최초 프로젝트와 원결과에 고정된다',async()=>{
 const f=fixture(),stored=structuredClone(f.stored),review=structuredClone(f.sources.review),calls:string[]=[],pid=stored.projectId;
 let out:any,failure:unknown;try{out=await mod.readReworkReviewOriginal(new ApiClient(async url=>{
  calls.push(String(url));
  if(calls.length===1){
   f.sources.result.snapshot.scope.projectId=id(99);f.sources.result.ref.contentHash=hash(f.sources.result.snapshot);
   f.sources.assignment.projectId=id(99);f.stored.snapshot.input.reviewRef.id=id(98);
   return Response.json(stored);
  }
  return Response.json(review);
 }),f.sources.assignment,f.sources.result,f.stored,()=>true);}catch(cause){failure=cause;}
 assert.deepEqual(calls,[`/api/v1/projects/${pid}/result-reworks/${stored.ref.id}`,`/api/v1/projects/${pid}/result-reviews/${review.ref.id}`],'후속 조회가 변경된 caller 프로젝트를 사용함');if(failure)throw failure;
 assert.deepEqual(out.rework,stored);assert.deepEqual(out.review,review);assert.deepEqual(out.selectedItems.map((item:any)=>item.criterionId),['save']);
});
