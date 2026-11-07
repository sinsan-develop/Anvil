import test from 'node:test';import assert from 'node:assert/strict';
import {newAssignmentDraft,prepareAssignmentWrite} from '../../../apps/web/src/features/workspace/assignment-api.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
const m:any=await import('../../../apps/web/src/features/workspace/assignment-selection-clear.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',s={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)};
const plan:any={ref,designRef:{...ref,id:pid},tasks:[{taskCode:'FN01',purpose:'개발 주도권 소유',title:'기능 개발',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['동작'],included:['개발'],excluded:['운영'],testCases:[{expected:'저장됨'}],ownerRole:'책임자'}]};
const make=()=>{const b=newAssignmentDraft(pid,s,2,plan,'FN01',{...ref,id:uid},'N1');b.input.definition.budgetRef={...ref};b.input.definition.environmentRef={...ref,id:uid};b.input.reason='명시 선택 해제';return b;};
const clear=(...args:any[])=>{assert.equal(typeof m.clearAssignmentSelection,'function');return m.clearAssignmentSelection(...args);};
test('예산·환경 중 선택 필드만 null로 바꾸고 다른 조건과 부족·실행false를 보존한다',()=>{
 for(const field of ['budgetRef','environmentRef']){const b=make(),before=structuredClone(b);let current=b;clear(b,s,field,(f:any)=>{current=f(current);},()=>true);const expected=structuredClone(before);(expected.input.definition as any)[field]=null;expected.dirty=true;expected.failure=null;assert.deepEqual(current,expected);assert.deepEqual(b,before);const parsed=readAssignmentDraftInput(prepareAssignmentWrite(current,s).payload);assert.equal(parsed.executionAuthorized,false);assert.equal(parsed.dispatchPerformed,false);assert.ok(parsed.readinessIssues.some(i=>i.code===(field==='budgetRef'?'BUDGET_UNVERIFIED':'ENVIRONMENT_UNVERIFIED')));}
});
test('다른 필드·다른 소유/client·동결은 거절하고 이탈·이미 빈선택은 업데이트0이다',()=>{
 for(const mutate of [(b:any)=>b.ownerUserId=id,(b:any)=>b.ownerClientId=id,(b:any)=>b.pending={},(b:any)=>b.result={},(b:any)=>b.uncertain=true]){const b=make();mutate(b);assert.throws(()=>clear(b,s,'budgetRef',()=>assert.fail('UPDATE'),()=>true));}
 assert.throws(()=>clear(make(),s,'recordingPolicyRef',()=>assert.fail('UPDATE'),()=>true));clear(make(),s,'budgetRef',()=>assert.fail('UPDATE'),()=>false);const b=make();b.input.definition.budgetRef=null;clear(b,s,'budgetRef',()=>assert.fail('UPDATE'),()=>true);
});
test('지연 updater는 새 입력·프로젝트·세대·고정참조·동결·이탈을 덮지 않는다',()=>{
 for(const mutate of [(b:any)=>b.input.reason='새 이유',(b:any)=>b.bindingId=id,(b:any)=>b.projectId=uid,(b:any)=>b.controlGeneration=3,(b:any)=>b.expectedDesignRef.contentHash='b'.repeat(64),(b:any)=>b.ref={...ref},(b:any)=>b.pending={},(b:any)=>b.result={},(b:any)=>b.uncertain=true,(b:any)=>b.ownerClientId=id]){const b=make();let current=structuredClone(b);mutate(current);const before=structuredClone(current);clear(b,s,'environmentRef',(f:any)=>{current=f(current);},()=>true);assert.deepEqual(current,before);}
 let active=true;const b=make();clear(b,s,'budgetRef',(f:any)=>{active=false;assert.equal(f(b),b);},()=>active);
});
