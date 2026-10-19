import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticResultSubmissions} from '../../../apps/server/modules/results/result-submission-store.ts';
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),at='2026-10-19T16:00:00.000Z';
async function fixture(){
 const scope={projectId:id(1),assignmentRef:ref(2),executionRef:ref(3)},submissionId=id(4),manifest={assignmentRef:scope.assignmentRef,executionRef:scope.executionRef,baselineRefs:[ref(5)],submissionState:'COMPLETED',changes:[],commandResults:[],testResults:[],artifactRefs:[],unexecuted:[],risks:[],rollback:'변경 미보고',checkpointRef:null};
 const current={transport:'SYNTHETIC_ONLY',scope,operation:'SUBMIT_RESULT',submissionId,manifestHash:contentHash(canonicalJson(manifest)),submitterRef:ref(6),authorizationReceiptRef:ref(7),checkedAt:at,expiresAt:'2026-10-19T16:01:00.000Z'},rows=new Map<string,any>();let reading=false,afterRead=()=>{},clock=at;
 const store={transport:'SYNTHETIC_ONLY' as const,transaction:async(s:any,body:any)=>{assert.deepEqual(s,scope);return body({clock:async()=>clock,current:async()=>structuredClone(current),read:async(key:string)=>{const r=structuredClone(rows.get(key)??null);if(reading)afterRead();return r;},append:async(entry:any)=>{assert(!reading,'조회는 append를 호출하면 안 된다');rows.set(entry.ref.id,structuredClone(entry));}});}};
 const service:any=new SyntheticResultSubmissions(store),original=await service.submit(scope,submissionId,manifest);reading=true;current.operation='READ_RESULT';current.submitterRef=ref(20);
 return{scope,submissionId,current,rows,store,service,original,afterRead:(fn:()=>void)=>afterRead=fn,clock:(v:string)=>clock=v};
}
async function read(f:Awaited<ReturnType<typeof fixture>>){assert.equal(typeof f.service.read,'function','FN12 원제출 조회 경계 누락');return f.service.read(f.scope,f.submissionId);}
test('현재조회주체가다르더라도정확권한아래원제출자/원문/hash를읽고출처와완료상태를승격하지않는다',async()=>{
 const f=await fixture(),before=canonicalJson([...f.rows]),value=await read(f);assert.deepEqual(value,f.original);assert.equal(value.snapshot.submittedByRef.id,id(6));assert.notEqual(value.snapshot.submittedByRef.id,f.current.submitterRef.id);assert.equal(value.snapshot.completionAccepted,false);assert.equal(value.snapshot.sourceKind,'WORKER_CLAIM');assert.equal(canonicalJson([...f.rows]),before);
 value.snapshot.manifest.rollback='로컬 조회결과 편집';assert.equal(f.rows.get(f.submissionId).snapshot.manifest.rollback,'변경 미보고');
});
test('제출허가를조회허가로재사용하거나다른ID/원문hash/실행의내용을반환하지않는다',async()=>{
 const write=await fixture();write.current.operation='SUBMIT_RESULT';await assert.rejects(read(write),/RESULT_SUBMISSION_CURRENT_REQUIRED/);
 const target=await fixture();target.current.submissionId=id(21);await assert.rejects(read(target),/RESULT_SUBMISSION_CURRENT_REQUIRED/);
 const hash=await fixture();hash.current.manifestHash='b'.repeat(64);await assert.rejects(read(hash),/RESULT_SUBMISSION_READ_BINDING_MISMATCH/);
 const scope=await fixture();scope.current.scope={...scope.scope,executionRef:ref(22)};await assert.rejects(read(scope),/RESULT_SUBMISSION_CURRENT_REQUIRED/);
});
test('없는/손상된원제출과조회중허가변경/만료에서이전본문으로대체하지않는다',async()=>{
 const missing=await fixture();missing.rows.clear();await assert.rejects(read(missing),/RESULT_SUBMISSION_NOT_FOUND/);
 const corrupt=await fixture();corrupt.rows.get(corrupt.submissionId).snapshot.manifest.rollback='변조';await assert.rejects(read(corrupt),/RESULT_SUBMISSION_LEDGER_INVALID/);
 const changed=await fixture();changed.afterRead(()=>changed.current.authorizationReceiptRef=ref(23));await assert.rejects(read(changed),/RESULT_SUBMISSION_CURRENT_CHANGED/);assert.equal(changed.rows.size,1);
 const expired=await fixture();expired.afterRead(()=>expired.clock('2026-10-19T16:01:00.000Z'));await assert.rejects(read(expired),/RESULT_SUBMISSION_CURRENT_REQUIRED/);assert.equal(expired.rows.size,1);
});
