import test from 'node:test';
import assert from 'node:assert/strict';
import {newAssignmentDraft,prepareAssignmentWrite} from '../../../apps/web/src/features/workspace/assignment-api.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
const module:any=await import('../../../apps/web/src/features/workspace/assignment-scope-reduction.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)};
const plan:any={ref,designRef:{...ref,id:pid},tasks:[{taskCode:'FN01',purpose:'안전한 범위',title:'구현',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['확인'],included:['개발'],excluded:['운영'],testCases:[{expected:'저장'}],ownerRole:'책임자'}]};
function make(){const b=newAssignmentDraft(pid,session,2,plan,'FN01',{...ref,id:uid},'N1');b.input.reason='범위 축소';b.input.definition.allowedScopes=[{sourceRootRef:ref,mappingRef:null,observationRef:{...ref,id:pid},baselineRef:{...ref,id:uid},targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false},{relativePath:'src/b.ts',kind:'FILE',access:'READ',recursive:false}]},{sourceRootRef:{...ref,id:uid},mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'README.md',kind:'FILE',access:'READ',recursive:false}]}];return b;}
function reduce(...args:any[]){assert.equal(typeof module.reduceAssignmentSourceScope,'function');return module.reduceAssignmentSourceScope(...args);}
test('선택 파일만 제거하고 다른 root/READ·WRITE·고정참조와 원입력을 보존해 기존 저장 계약으로 전달한다',()=>{
 const b=make(),before=structuredClone(b);let current=b;reduce(b,session,0,0,(f:any)=>{current=f(current);});
 assert.deepEqual(current.input.definition.allowedScopes[0]!.targets,[{relativePath:'src/b.ts',kind:'FILE',access:'READ',recursive:false}]);assert.deepEqual(current.input.definition.allowedScopes[1],before.input.definition.allowedScopes[1]);
 const expected=structuredClone(before);expected.input.definition.allowedScopes[0]!.targets.splice(0,1);expected.dirty=true;expected.failure=null;assert.deepEqual(current,expected);assert.deepEqual(b,before);
 const parsed=readAssignmentDraftInput(prepareAssignmentWrite(current,session).payload);assert.ok(parsed.readinessIssues.some(x=>x.code==='SOURCE_SCOPE_UNVERIFIED'));assert.equal(parsed.executionAuthorized,false);assert.equal(parsed.dispatchPerformed,false);
});
test('root 전체 또는 마지막 파일 제거는 빈 root를 남기지 않고 빈 전체 범위도 허가로 승격하지 않는다',()=>{
 let current=make();reduce(current,session,0,null,(f:any)=>{current=f(current);});assert.equal(current.input.definition.allowedScopes.length,1);assert.equal(current.input.definition.allowedScopes[0]!.sourceRootRef.id,uid);
 reduce(current,session,0,0,(f:any)=>{current=f(current);});assert.deepEqual(current.input.definition.allowedScopes,[]);
 const parsed=readAssignmentDraftInput(prepareAssignmentWrite(current,session).payload);assert.ok(parsed.readinessIssues.some(x=>x.code==='SOURCE_SCOPE_MISSING'));assert.equal(parsed.ready,false);
});
test('다른 주체·동결·저장 결과·미확인 및 범위 밖 index는 변경하지 않는다',()=>{
 for(const mutate of [(b:any)=>b.ownerUserId=id,(b:any)=>b.ownerClientId=id,(b:any)=>b.pending={},(b:any)=>b.result={},(b:any)=>b.uncertain=true]){const b=make();mutate(b);assert.throws(()=>reduce(b,session,0,0,()=>assert.fail('UPDATE')),e=>(e as any).code==='ASSIGNMENT_SCOPE_REDUCTION_INVALID');}
 for(const [scope,target]of [[-1,0],[2,0],[0,2],[0,-1],[0,0.5],[0,undefined]])assert.throws(()=>reduce(make(),session,scope,target,()=>assert.fail('UPDATE')),e=>(e as any).code==='ASSIGNMENT_SCOPE_REDUCTION_INVALID');
});
test('지연 updater가 다른 입력/대상/기준/세대/동결을 만나면 덮지 않고 오류도 발생시키지 않는다',()=>{
 for(const mutate of [(b:any)=>b.input.definition.goal='새 목표',(b:any)=>b.projectId=uid,(b:any)=>b.bindingId=id,(b:any)=>b.controlGeneration=3,(b:any)=>b.expectedDesignRef.contentHash='b'.repeat(64),(b:any)=>b.ref=ref,(b:any)=>b.uncertain=true,(b:any)=>b.pending={},(b:any)=>b.result={},(b:any)=>b.ownerClientId=id]){
  const b=make();let apply:any;reduce(b,session,0,0,(f:any)=>{apply=f;});const current=structuredClone(b);mutate(current);const before=structuredClone(current);assert.strictEqual(apply(current),current);assert.deepEqual(current,before);
 }
});
