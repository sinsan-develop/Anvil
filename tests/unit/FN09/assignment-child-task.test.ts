import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../../apps/web/src/api/client.ts';
const api:any=await import('../../../apps/web/src/features/workspace/assignment-child-task.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)},parent={...ref,id:'22222222-2222-4222-8222-222222222222'};
const session:any={user:{id},clientId:id,csrfToken:'C'.repeat(43)};
function fixture(){
 const buffer:any={bindingId:'selection-1',projectId:id,ownerUserId:id,ownerClientId:id,controlGeneration:2,expectedDesignRef:ref,input:{baseRef:null,reason:'작성 이유 보존',definition:{taskRef:{planRef:ref,taskCode:'FN01',applicationRef:ref,nodeId:'N1'},parentAssignmentRef:parent,purpose:'작성한 목적',goal:'작성한 목표',baselineRefs:[ref],allowedScopes:[],requiredCapabilities:['FILE_READ'],environmentRef:null,budgetRef:null,recordingPolicyRef:null,outputs:['작성한 산출물']}},ref:null,pending:null,result:null,dirty:false,uncertain:false,failure:null};
 const plan:any={ref,designRef:ref,relationalProjection:'STORED',tasks:[{taskCode:'FN01',title:'부모 업무'},{taskCode:'FN02',title:'하위 업무'}]};
 return{buffer,plan,projectId:id};
}
const apply=(...args:any[])=>{assert.equal(typeof api.applyChildAssignmentTaskSelection,'function');return api.applyChildAssignmentTaskSelection(...args);};
test('같은 고정 계획의 다른 업무를 명시 선택하되 작성 내용·부모·기준과 원입력을 보존한다',()=>{
 const q=fixture(),original=structuredClone(q.buffer),before=structuredClone(q.buffer);let value=q.buffer;
 apply(q.buffer,session,{projectId:q.projectId,plan:q.plan},'FN02',(change:any)=>{value=change(value);},()=>true);
 assert.equal(value.input.definition.taskRef.taskCode,'FN02');
 const expected=structuredClone(original);expected.input.definition.taskRef.taskCode='FN02';expected.dirty=true;
 assert.deepEqual(value,expected);assert.deepEqual(q.buffer,before);
 q.plan.tasks[1].taskCode='CHANGED';assert.equal(value.input.definition.taskRef.taskCode,'FN02');
});
test('root·다른project/계획/설계·중복/없는업무·원명령 미확인·다른사용자는 입력 변경0이다',()=>{
 for(const mode of ['ROOT','PROJECT','PLAN','DESIGN','DUPLICATE','MISSING','PENDING','UNCERTAIN','SAVED','OWNER','CLIENT','PROJECTION']){
  const q=fixture();let calls=0;
  if(mode==='ROOT')q.buffer.input.definition.parentAssignmentRef=null;
  if(mode==='PROJECT')q.projectId=parent.id;
  if(mode==='PLAN')q.plan.ref={...ref,version:2};
  if(mode==='DESIGN')q.plan.designRef={...ref,contentHash:'b'.repeat(64)};
  if(mode==='DUPLICATE')q.plan.tasks.push({taskCode:'FN02',title:'중복'});
  if(mode==='MISSING')q.plan.tasks=[];
  if(mode==='PENDING')q.buffer.pending={commandId:id};
  if(mode==='UNCERTAIN')q.buffer.uncertain=true;
  if(mode==='SAVED')q.buffer.result={ref};
  if(mode==='OWNER')q.buffer.ownerUserId=parent.id;
  if(mode==='CLIENT')q.buffer.ownerClientId=parent.id;
  if(mode==='PROJECTION')q.plan.relationalProjection='UNRESOLVED';
  const before=structuredClone(q.buffer);
  assert.throws(()=>apply(q.buffer,session,{projectId:q.projectId,plan:q.plan},'FN02',()=>{calls++;},()=>true), (e:unknown)=>e instanceof ApiError&&e.code==='ASSIGNMENT_CHILD_TASK_SELECTION_INVALID',mode);
  assert.equal(calls,0);assert.deepEqual(q.buffer,before);
 }
});
test('늦은 updater는 주체/입력·부모/기준/세대/명령이 바뀌면 덮지 않고 이탈 뒤에는 적용0이다',()=>{
 for(const mode of ['INPUT','PARENT','GENERATION','COMMAND','BINDING','DESIGN','OWNER','INACTIVE']){
  const q=fixture();let change:any,active=true;
  apply(q.buffer,session,{projectId:q.projectId,plan:q.plan},'FN02',(next:any)=>{change=next;},()=>active);
  const current=structuredClone(q.buffer);
  if(mode==='INPUT')current.input.reason='새 입력';
  if(mode==='PARENT')current.input.definition.parentAssignmentRef=null;
  if(mode==='GENERATION')current.controlGeneration=3;
  if(mode==='COMMAND')current.pending={commandId:id};
  if(mode==='BINDING')current.bindingId='other';
  if(mode==='DESIGN')current.expectedDesignRef={...ref,version:2};
  if(mode==='OWNER')current.ownerUserId=parent.id;
  if(mode==='INACTIVE')active=false;
  assert.equal(change(current),current,mode);
 }
});
