import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/results/result-submission-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),at='2026-10-19T15:00:00.000Z';
function fixture(){
 const scope={projectId:id(1),assignmentRef:ref(2),executionRef:ref(3)},submissionId=id(4),manifest:any={assignmentRef:scope.assignmentRef,executionRef:scope.executionRef,baselineRefs:[ref(5)],submissionState:'INCOMPLETE',changes:[],commandResults:[],testResults:[],artifactRefs:[],unexecuted:[{criterionId:'flow',testId:'FLOW-01',reason:'시험 미실행'}],risks:[],rollback:'변경 없음',checkpointRef:null};
 const current={transport:'SYNTHETIC_ONLY',scope,operation:'SUBMIT_RESULT',submissionId,manifestHash:contentHash(canonicalJson(manifest)),submitterRef:ref(6),authorizationReceiptRef:ref(7),checkedAt:at,expiresAt:'2026-10-19T15:01:00.000Z'};let clock=at,onAppend=()=>{};
 const rows=new Map<string,any>(),store={transport:'SYNTHETIC_ONLY',transaction:async(s:any,body:any)=>{assert.deepEqual(s,scope);const before=structuredClone(rows);try{return await body({clock:async()=>clock,current:async()=>structuredClone(current),read:async(key:string)=>structuredClone(rows.get(key)??null),append:async(entry:any)=>{assert(!rows.has(entry.ref.id));rows.set(entry.ref.id,structuredClone(entry));onAppend();}});}catch(e){rows.clear();for(const [k,v]of before)rows.set(k,v);throw e;}}};
 return{scope,submissionId,manifest,current,rows,store,clock:(v:string)=>clock=v,onAppend:(fn:()=>void)=>onAppend=fn};
}
function service(f:ReturnType<typeof fixture>){assert.equal(typeof mod.SyntheticResultSubmissions,'function','FN12 원자 제출 저장 경계 누락');return new mod.SyntheticResultSubmissions(f.store);}
test('전체제출을불변claim으로한번보관하고동일id/내용재확인은원기록을그대로반환한다',async()=>{
 const f=fixture(),s=service(f),first=await s.submit(f.scope,f.submissionId,f.manifest);assert.equal(f.rows.size,1);assert.deepEqual(first.snapshot.manifest,f.manifest);assert.equal(first.snapshot.sourceKind,'WORKER_CLAIM');assert.equal(first.snapshot.evidenceProvenanceVerified,false);assert.equal(first.snapshot.completionAccepted,false);assert.equal(first.snapshot.executionAuthorized,false);assert.equal(first.snapshot.dispatchPerformed,false);
 f.clock('2026-10-19T15:00:10.000Z');const again=await s.submit(f.scope,f.submissionId,f.manifest);assert.deepEqual(again,first);assert.equal(f.rows.size,1);assert.equal(again.snapshot.submittedAt,at);
 f.manifest.risks.push('나중 입력 변경');assert.equal(first.snapshot.manifest.risks.length,0);assert.equal(f.rows.get(f.submissionId).snapshot.manifest.risks.length,0);
 f.current.manifestHash=contentHash(canonicalJson(f.manifest));f.current.authorizationReceiptRef=ref(23);await assert.rejects(s.submit(f.scope,f.submissionId,f.manifest),/RESULT_SUBMISSION_ID_CONFLICT/);assert.equal(f.rows.size,1);
});
test('append뒤현재허가변경/만료는원자제출을되돌리고미확인부분기록을성공으로반환하지않는다',async()=>{
 for(const change of [(f:any)=>f.current.authorizationReceiptRef=ref(20),(f:any)=>f.clock('2026-10-19T15:01:00.000Z')]){const f=fixture();f.onAppend(()=>change(f));await assert.rejects(service(f).submit(f.scope,f.submissionId,f.manifest),/RESULT_SUBMISSION_CURRENT_(CHANGED|REQUIRED)/);assert.equal(f.rows.size,0);}
});
test('다른현재주체/실행·원기록hash손상·비밀표식을거절하고실제transport로대체하지않는다',async()=>{
 const other=fixture();other.current.scope={...other.scope,executionRef:ref(21)};await assert.rejects(service(other).submit(other.scope,other.submissionId,other.manifest),/RESULT_SUBMISSION_CURRENT_REQUIRED/);assert.equal(other.rows.size,0);
 const payload=fixture();payload.current.manifestHash='b'.repeat(64);await assert.rejects(service(payload).submit(payload.scope,payload.submissionId,payload.manifest),/RESULT_SUBMISSION_CURRENT_REQUIRED/);assert.equal(payload.rows.size,0);
 const target=fixture();target.current.submissionId=id(24);await assert.rejects(service(target).submit(target.scope,target.submissionId,target.manifest),/RESULT_SUBMISSION_CURRENT_REQUIRED/);assert.equal(target.rows.size,0);
 const changed=fixture(),s=service(changed);await s.submit(changed.scope,changed.submissionId,changed.manifest);changed.current.submitterRef=ref(22);await assert.rejects(s.submit(changed.scope,changed.submissionId,changed.manifest),/RESULT_SUBMISSION_ID_CONFLICT/);assert.equal(changed.rows.size,1);
 const corrupt=fixture(),cs=service(corrupt);await cs.submit(corrupt.scope,corrupt.submissionId,corrupt.manifest);corrupt.rows.get(corrupt.submissionId).snapshot.manifest.rollback='변조';await assert.rejects(cs.submit(corrupt.scope,corrupt.submissionId,corrupt.manifest),/RESULT_SUBMISSION_LEDGER_INVALID/);
 const sensitive=fixture();sensitive.manifest.risks=['Bearer '+'Z'.repeat(24)];await assert.rejects(service(sensitive).submit(sensitive.scope,sensitive.submissionId,sensitive.manifest),/RESULT_MANIFEST_SENSITIVE/);assert.equal(sensitive.rows.size,0);
 const real=fixture();real.store.transport='REAL';assert.throws(()=>service(real),/SYNTHETIC_RESULT_SUBMISSION_STORE_REQUIRED/);
});
test('최종current/clock와tx반환중합성경계변경은제출결과반환을막는다',async()=>{
 for(const point of ['current','clock','transaction']){const f=fixture(),original=f.store.transaction;let count=0;
  f.store.transaction=async(s:any,body:any)=>{const value=await original(s,async(tx:any)=>point==='transaction'?body(tx):body({...tx,[point]:async()=>{const result=await tx[point]();if(++count===2)f.store.transport='REAL';return result;}}));if(point==='transaction')f.store.transport='REAL';return value;};
  await assert.rejects(service(f).submit(f.scope,f.submissionId,f.manifest),/SYNTHETIC_RESULT_SUBMISSION_STORE_REQUIRED/);
  assert.equal(f.rows.size,point==='transaction'?1:0,'tx 반환 뒤 실패는 이미 저장됐을 수 있으며 rollback으로 단정하지 않는다');
 }
});
test('append가반환되어도같은tx에서정확원문을읽지못하면저장확인으로반환하지않는다',async()=>{
 const f=fixture(),original=f.store.transaction;f.store.transaction=async(s:any,body:any)=>original(s,async(tx:any)=>body({...tx,append:async()=>{}}));
 await assert.rejects(service(f).submit(f.scope,f.submissionId,f.manifest),/RESULT_SUBMISSION_WRITE_UNCONFIRMED/);assert.equal(f.rows.size,0);
});
