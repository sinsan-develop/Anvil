import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {newAssignmentDraft,prepareAssignmentWrite} from '../../../apps/web/src/features/workspace/assignment-api.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
const m:any=await import('../../../apps/web/src/features/workspace/assignment-budget-selection.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',s={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)};
const plan:any={ref,designRef:{...ref,id:pid},tasks:[{taskCode:'FN01',purpose:'개발 주도권 소유',title:'기능 개발',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['동작'],included:['개발'],excluded:['운영'],testCases:[{expected:'저장됨'}],ownerRole:'책임자'}]};
const make=()=>newAssignmentDraft(pid,s,2,plan,'FN01',{...ref,id:uid},'N1');
function policy(){const snapshot={scope:{kind:'PROJECT',projectId:pid},limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1073741824,maxOfflineMs:300000},reason:'유한 정책',policyBaseVersion:0,state:'APPLIED',previousRef:null,decidedBy:{kind:'HUMAN',userId:uid},decidedAt:'2026-10-20T00:00:00.000Z',expiresAt:'2026-10-20T02:00:00.000Z',executionAuthorized:false,dispatchPerformed:false};return{projectId:pid,ref:{id,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};}
const apply=(...args:any[])=>{assert.equal(typeof m.applyAssignmentBudgetSelection,'function');return m.applyAssignmentBudgetSelection(...args);};
test('정확 보관 정책만 초안에 복사하고 다른 조건·BUDGET_UNVERIFIED·실행 false를 유지한다',async()=>{
 const b=make(),p=policy(),before=structuredClone(b);let current=b;
 await apply(b,s,p,()=>true,(change:any)=>{current=change(current);});
 assert.deepEqual(current.input.definition.budgetRef,p.ref);assert.deepEqual(b,before);p.ref.contentHash='0'.repeat(64);assert.notEqual(current.input.definition.budgetRef?.contentHash,p.ref.contentHash);
 assert.equal(current.input.definition.goal,b.input.definition.goal);current.input.reason='예산 고정 선택 저장';const parsed=readAssignmentDraftInput(prepareAssignmentWrite(current,s).payload);
 assert.ok(parsed.readinessIssues.some(i=>i.code==='BUDGET_UNVERIFIED'));assert.equal(parsed.executionAuthorized,false);assert.equal(parsed.dispatchPerformed,false);
});
test('잘못된 hash·회수본·다른 회원/client·동결은 반영하지 않는다',async()=>{
 for(const mode of ['HASH','REVOKED','CLIENT','FROZEN']){
  const b=make(),p=policy();if(mode==='HASH')p.ref.contentHash='0'.repeat(64);if(mode==='REVOKED'){(p.snapshot as any).previousRef={...p.ref};p.snapshot.state='REVOKED';p.snapshot.policyBaseVersion=1;p.ref.version=2;p.ref.contentHash=contentHash(canonicalJson(p.snapshot));}if(mode==='CLIENT')b.ownerClientId=id;if(mode==='FROZEN')b.pending={} as any;
  let writes=0;const attempt=apply(b,s,p,()=>true,()=>{writes++;});if(mode==='REVOKED')await assert.rejects(attempt,{code:'ASSIGNMENT_BUDGET_REVOKED'});else await assert.rejects(attempt);assert.equal(writes,0);
 }
});
test('지연 중 이탈·입력/바인딩 변경은 새 초안을 덮지 않는다',async()=>{
 const b=make(),p=policy();let writes=0;await apply(b,s,p,()=>false,()=>{writes++;});assert.equal(writes,0);
 for(const mutate of [(b:any)=>b.bindingId=id,(b:any)=>b.input.definition.goal='새 목표',(b:any)=>b.uncertain=true,(b:any)=>b.pending={}]){let current=structuredClone(b);mutate(current);const before=structuredClone(current);await apply(b,s,p,()=>true,(change:any)=>{current=change(current);});assert.deepEqual(current,before);}
});
