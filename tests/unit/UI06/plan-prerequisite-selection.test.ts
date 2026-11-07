import test from 'node:test';
import assert from 'node:assert/strict';
import {blankPlanTask,type WorkPlanBuffer} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const m=await import(new URL('../../../apps/web/src/features/design-trace/plan-prerequisite-selection.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
function state():WorkPlanBuffer{return{bindingId:'binding',input:{documentRef:{id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)},designRef:null,screenReviewRefs:[],reason:'계획 이유',tasks:[{...blankPlanTask(),taskCode:'FN1',title:'선행 업무'},{...blankPlanTask(),taskCode:'FN2',startPrerequisites:['MISSING'],acceptancePrerequisites:['FN1'],inputs:['원문 보존']}]},planRef:null,pending:null,result:null,uncertain:false,failure:null,designDocumentId:'',designVersion:'1',designIndex:null};}
test('착수와 검수 선행을 별도로 선택·해제하고 기존 미해결 참조와 원문을 보존한다',()=>{
 assert.equal(typeof m?.selectPlanPrerequisite,'function');const s=state(),old=structuredClone(s),next=m!.selectPlanPrerequisite(s,1,'startPrerequisites','FN1',true);
 assert.deepEqual(next.input.tasks[1].startPrerequisites,['MISSING','FN1']);assert.deepEqual(next.input.tasks[1].acceptancePrerequisites,['FN1']);assert.deepEqual(s,old);
 assert.equal(m!.selectPlanPrerequisite(next,1,'startPrerequisites','FN1',true),next);
 const removed=m!.selectPlanPrerequisite(next,1,'acceptancePrerequisites','FN1',false);assert.deepEqual(removed.input.tasks[1].acceptancePrerequisites,[]);assert.deepEqual(removed.input.tasks[1].startPrerequisites,['MISSING','FN1']);assert.deepEqual(removed.input.tasks[1].inputs,['원문 보존']);assert.deepEqual(removed.input.tasks[0],old.input.tasks[0]);assert.equal(removed.input.reason,old.input.reason);
});
test('자기·모호한 코드·없는 업무·잘못된 입력·동결 상태에서는 변경하지 않는다',()=>{
 assert.equal(typeof m?.selectPlanPrerequisite,'function');
 for(const args of [[1,'startPrerequisites','FN2',true],[1,'startPrerequisites','UNKNOWN',true],[-1,'startPrerequisites','FN1',true],[0.5,'startPrerequisites','FN1',true],[1,'bad','FN1',true],[1,'startPrerequisites','FN1','yes']]){const s=state(),old=structuredClone(s);assert.throws(()=>m!.selectPlanPrerequisite(s,...args),{code:'WORK_PLAN_PREREQUISITE_SELECTION_INVALID'});assert.deepEqual(s,old);}
 for(const key of ['pending','result','uncertain','sent','approval','decision','traceLink']){const s=state();(s as any)[key]=true;const old=structuredClone(s);assert.throws(()=>m!.selectPlanPrerequisite(s,1,'startPrerequisites','FN1',true),{code:'WORK_PLAN_PREREQUISITE_SELECTION_INVALID'});assert.deepEqual(s,old);}
 const duplicate=state();duplicate.input.tasks.push({...blankPlanTask(),taskCode:'FN1'});assert.throws(()=>m!.selectPlanPrerequisite(duplicate,1,'startPrerequisites','FN1',true),{code:'WORK_PLAN_PREREQUISITE_SELECTION_INVALID'});
 const full=state();full.input.tasks[1]!.startPrerequisites=Array.from({length:200},(_,i)=>'OLD'+i);assert.throws(()=>m!.selectPlanPrerequisite(full,1,'startPrerequisites','FN1',true),{code:'WORK_PLAN_PREREQUISITE_SELECTION_INVALID'});
});
