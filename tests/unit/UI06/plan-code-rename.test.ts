import test from 'node:test';import assert from 'node:assert/strict';
import {blankPlanTask,type WorkPlanBuffer} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const m=await import(new URL('../../../apps/web/src/features/design-trace/plan-code-rename.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
function state():WorkPlanBuffer{return{bindingId:'binding',input:{documentRef:{id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)},designRef:null,screenReviewRefs:[],reason:'계획 이유',tasks:[{...blankPlanTask(),taskCode:'FN1',title:'원업무'},{...blankPlanTask(),taskCode:'FN2',startPrerequisites:['FN1','FN10'],acceptancePrerequisites:['FN1'],inputs:['FN1은 설명 원문'],testCases:[{id:'FN1_TEST',kind:'NORMAL',steps:['FN1 설명 보존'],expected:'결과',environment:'환경'}]},{...blankPlanTask(),taskCode:'FN10'}]},planRef:null,pending:null,result:null,uncertain:false,failure:null,designDocumentId:'',designVersion:'1',designIndex:null};}
function rename(...args:any[]){assert.equal(typeof m?.renamePlanTaskCode,'function');return m!.renamePlanTaskCode(...args);}
test('명시 확인 뒤 선택 업무 코드와 정확 일치하는 착수/검수 선행만 변경하고 설명/시험/다른 코드는 보존한다',()=>{
 const s=state(),old=structuredClone(s),after=rename(s,0,'FN_NEW',true);assert.deepEqual(after.input.tasks.map((t:any)=>t.taskCode),['FN_NEW','FN2','FN10']);assert.deepEqual(after.input.tasks[1].startPrerequisites,['FN_NEW','FN10']);assert.deepEqual(after.input.tasks[1].acceptancePrerequisites,['FN_NEW']);assert.deepEqual(after.input.tasks[1].inputs,['FN1은 설명 원문']);assert.deepEqual(after.input.tasks[1].testCases,old.input.tasks[1]!.testCases);assert.equal(after.input.reason,'계획 이유');assert.deepEqual(s,old);
});
test('미확인·동결/결과/승인보류·중복/비정상 코드·잘못된 업무는 원입력과 명령을 변경하지 않는다',()=>{
 assert.equal(typeof m?.renamePlanTaskCode,'function');
 for(const mode of ['NO_ACK','PENDING','UNCERTAIN','RESULT','SENT','APPROVAL','DUP_OLD','DUP_NEW','INVALID','INDEX']){const s=state();if(mode==='PENDING')s.pending={commandId:'원명령'} as any;if(mode==='UNCERTAIN')s.uncertain=true;if(mode==='RESULT')s.result={} as any;if(mode==='SENT')s.sent=true;if(mode==='APPROVAL')s.approval={request:{uncertain:true}} as any;if(mode==='DUP_OLD')s.input.tasks[2]!.taskCode='FN1';const old=structuredClone(s);assert.throws(()=>rename(s,mode==='INDEX'?99:0,mode==='DUP_NEW'?'FN2':mode==='INVALID'?' FN_NEW':'FN_NEW',mode!=='NO_ACK'),{code:mode==='NO_ACK'?'WORK_PLAN_CODE_RENAME_CONFIRM_REQUIRED':'WORK_PLAN_CODE_RENAME_INVALID'});assert.deepEqual(s,old);}
});
test('같은 코드 명시 적용은 원상태를 반환하고 자동 명령/검토를 만들지 않는다',()=>{
 const s=state();assert.equal(rename(s,0,'FN1',true),s);assert.equal(s.pending,null);assert.equal(s.result,null);
});
