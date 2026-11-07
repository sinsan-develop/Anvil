import test from 'node:test';
import assert from 'node:assert/strict';
import {blankPlanTask,type WorkPlanBuffer} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const m=await import(new URL('../../../apps/web/src/features/design-trace/plan-task-order.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
function state():WorkPlanBuffer{return{bindingId:'binding',input:{documentRef:{id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)},designRef:null,screenReviewRefs:[],reason:'계획 이유',tasks:[{...blankPlanTask(),taskCode:'FN1',title:'첫 업무'},{...blankPlanTask(),taskCode:'FN2',startPrerequisites:['FN1'],acceptancePrerequisites:['FN1'],inputs:['원문 입력'],testCases:[{id:'TC2',kind:'NORMAL',steps:['수행'],expected:'결과',environment:'환경'}]},{...blankPlanTask(),taskCode:'FN3'}]},planRef:null,pending:null,result:null,uncertain:false,failure:null,designDocumentId:'',designVersion:'1',designIndex:null};}
test('선택 업무를 한 칸 이동하고 선행·시험·코드·원본 입력을 그대로 보존한다',()=>{
 assert.equal(typeof m?.movePlanTask,'function');const s=state(),old=structuredClone(s),after=m!.movePlanTask(s,1,-1);assert.deepEqual(after.input.tasks.map((t:any)=>t.taskCode),['FN2','FN1','FN3']);assert.deepEqual(after.input.tasks[0],old.input.tasks[1]);assert.deepEqual(after.input.tasks[1],old.input.tasks[0]);assert.deepEqual(after.input.tasks[2],old.input.tasks[2]);assert.deepEqual(s,old);assert.equal(after.input.reason,s.input.reason);assert.deepEqual(m!.movePlanTask(after,0,1).input.tasks,old.input.tasks);
});
test('경계 이동은 no-op이고 동결·잘못된 위치/방향은 원자료와 명령을 보존해 거절한다',()=>{
 assert.equal(typeof m?.movePlanTask,'function');const s=state();assert.equal(m!.movePlanTask(s,0,-1),s);assert.equal(m!.movePlanTask(s,2,1),s);
 for(const lock of ['pending','result','uncertain','sent','approval','decision','traceLink']){const v=state();(v as any)[lock]=true;const old=structuredClone(v);assert.throws(()=>m!.movePlanTask(v,1,-1),{code:'WORK_PLAN_TASK_MOVE_INVALID'});assert.deepEqual(v,old);}
 for(const [index,direction]of [[-1,1],[3,-1],[1.5,1],[NaN,1],[1,0],[1,2]]){const v=state(),old=structuredClone(v);assert.throws(()=>m!.movePlanTask(v,index,direction),{code:'WORK_PLAN_TASK_MOVE_INVALID'});assert.deepEqual(v,old);}
});
