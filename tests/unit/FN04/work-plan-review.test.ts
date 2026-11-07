import assert from 'node:assert/strict';
import {test} from 'node:test';
const ref={id:'a6f30000-0000-4000-8000-000000000004',version:1,contentHash:'1'.repeat(64)};
test('계획 내용검토는 전체 기준과 정확 버전·개별 이유를 요구하며 원문 검토로 대체하지 않는다',async()=>{
 const m=await import('../../../apps/server/modules/traceability/work-plan-reviews.ts').catch(()=>null);assert.ok(m,'별도 작업계획 내용검토 구현 필요');
 const p={targetKind:'WORK_PLAN',targetRef:ref,criteriaVersion:1,items:m.workPlanReviewCriteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'원문과 업무 카드에서 직접 대조'})),outcome:'ACCEPTED',reason:'합성 내용검토이며 사용자 인수가 아니다'};
 assert.deepEqual(m.readWorkPlanReviewInput(p,ref),p);
 for(const invalid of [{...p,targetKind:'DOCUMENT'},{...p,targetRef:{...ref,version:2}},{...p,items:p.items.slice(1)},{...p,items:p.items.map((i,n)=>n?i:{...i,reason:''})},{...p,items:p.items.map((i,n)=>n?i:{...i,outcome:'REWORK'})},{...p,items:p.items.map((i,n)=>n?i:{...i,evidenceRefs:[ref]})}])assert.throws(()=>m.readWorkPlanReviewInput(invalid,ref));
});
test('계획 확정은 최신 적합 검토를 정확히 선택하며 옛 적합·중복·다른 버전으로 우회하지 않는다',async()=>{
 const m=await import('../../../apps/server/modules/traceability/work-plan-reviews.ts').catch(()=>null);assert.ok(m,'최신 계획 검토 선택 검사 필요');
 const old={id:'a6f30000-0000-4000-8000-000000000005',targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'},latest={...old,id:'a6f30000-0000-4000-8000-000000000006',outcome:'REWORK'};
 assert.throws(()=>m.acceptedWorkPlanReviews(ref,[old],[{ref:latest},{ref:old}]));
 assert.deepEqual(m.acceptedWorkPlanReviews(ref,[old],[{ref:old}]),[old]);
 for(const chosen of [[],[old,old],[{...old,targetRef:{...ref,version:2}}],[{...old,extra:true}]])assert.throws(()=>m.acceptedWorkPlanReviews(ref,chosen,[{ref:old}]));
});
