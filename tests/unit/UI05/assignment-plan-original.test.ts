import assert from 'node:assert/strict';import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {assignmentPlanFixture,planProject as pid,planId} from './assignment-plan-original-fixture.ts';
const module:any=await import('../../../apps/web/src/features/session-detail/assignment-plan-original.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const reader=()=>{assert.equal(typeof module.readAssignmentPlanOriginal,'function');return module.readAssignmentPlanOriginal;};
test('확정 임무의 원초안 basis에 고정된 과거 계획·업무카드를 exact GET/hash로 읽는다',async()=>{
 const read=reader(),f=assignmentPlanFixture(),before=structuredClone(f.detail),calls:unknown[]=[];
 const value=await read(new ApiClient(async(url,init)=>{calls.push([url,init?.method]);return Response.json(f.plan);}),f.detail);
 assert.deepEqual(value,f.plan);assert.deepEqual(calls,[[`/api/v1/projects/${pid}/work-plans/${planId}/versions/2`,'GET']]);assert.deepEqual(f.detail,before);
});
test('확정/초안 결박 불일치·고유 업무 부재/중복·다른 설계·카드 hash는 채택하지 않는다',async()=>{
 const read=reader();
 for(const mode of ['PAIR','CONFIRMED_REF','DEFINITION','TASK_CODE','BASIS','MISSING','DUPLICATE','DESIGN','CARD']){const f=assignmentPlanFixture();
  if(mode==='PAIR')f.detail.confirmed!.snapshot.draftRef={...f.detail.draft.ref,contentHash:'0'.repeat(64)};
  if(mode==='CONFIRMED_REF')f.detail.confirmed!.ref={...f.detail.confirmed!.ref,id:pid};
  if(mode==='DEFINITION')f.detail.confirmed!.snapshot.definition=structuredClone(f.detail.confirmed!.snapshot.definition),f.detail.confirmed!.snapshot.definition.goal='다른 임무';
  if(mode==='TASK_CODE')f.detail.draft.snapshot.basis.taskCode='OTHER';if(mode==='BASIS')f.detail.draft.snapshot.basis.taskCardHash='0'.repeat(64);
  if(mode==='MISSING')f.plan.tasks=[];if(mode==='DUPLICATE')f.plan.tasks.push(structuredClone(f.task));if(mode==='DESIGN')f.plan.designRef={...f.plan.designRef,contentHash:'d'.repeat(64)};if(mode==='CARD')f.plan.tasks[0]!.purpose='다른 카드';
  if(['MISSING','DUPLICATE','DESIGN','CARD'].includes(mode)){const {ref,status,executionEvidence,observedAt,...snapshot}=f.plan;f.plan.ref={...ref,contentHash:contentHash(canonicalJson(snapshot))};f.detail.draft.snapshot.definition.taskRef.planRef=f.plan.ref;f.detail.draft.snapshot.basis.planRef=f.plan.ref;}
  let calls=0;await assert.rejects(read(new ApiClient(async()=>{calls++;return Response.json(f.plan);}),f.detail));if(['PAIR','CONFIRMED_REF','DEFINITION','TASK_CODE'].includes(mode))assert.equal(calls,0);
 }
});
test('접근거절·이탈과 지연 응답은 카드 원문으로 사용하지 않는다',async()=>{
 const read=reader(),f=assignmentPlanFixture();await assert.rejects(read(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),f.detail));
 let active=true;assert.equal(await read(new ApiClient(async()=>{active=false;return Response.json(f.plan);}),f.detail,()=>active),null);
});
