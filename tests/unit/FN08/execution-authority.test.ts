import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const contract:any=await import('../../../contracts/runtime/server-execution-fact-v1.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const grants:any=await import('../../../apps/server/modules/executions/execution-grants.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)},at='2026-10-19T08:00:00.000Z';
const scope=()=>({sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/main.ts',kind:'FILE',access:'READ',recursive:false}]});
function fact():any{return {
 schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:pid,executionId:eid,executionGeneration:1,
 subject:{userId:pid,clientId:eid,humanSessionId:eid,controlGeneration:2,credentialGeneration:3},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:4},
 registration:{ref,connectorId:pid,generation:5,hostPublicKeyFingerprint:'b'.repeat(64)},
 intent:{projectId:pid,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes:[scope()],mode:'CONTEXT_REVIEW',reason:'변경 없는 맥락 확인'},
 preparationRef:ref,permissionPolicyRef:ref,budgetReservationRef:ref,basisRefs:[ref],latestInstructionRefs:[{kind:'CONVERSATION',id:pid,contentHash:'c'.repeat(64)}],understandingReviewRef:null,
 checks:Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(name=>[name,{state:name==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:name==='understanding'?[]:[ref]}])),
 writerState:'NONE',expires:{humanSession:'2026-10-19T11:00:00.000Z',permissionPolicy:'2026-10-19T09:45:00.000Z',registration:'2026-10-19T09:30:00.000Z',budget:'2026-10-19T10:00:00.000Z',automaticScope:'2026-10-19T10:00:00.000Z'},checkedAt:at,
 executionAuthorized:false,dispatchPerformed:false
};}
function read(value:any){assert.equal(typeof contract.readServerExecutionFactV1,'function');return contract.readServerExecutionFactV1(value);}
function plan(value:any= fact(),now=at){assert.equal(typeof grants.planSyntheticExecutionGrant,'function');return grants.planSyntheticExecutionGrant(value,now);}
test('서버 fact 문법은 정확 원문을 복제할 뿐 실행 권한/Agent 전환을 만들지 않는다',()=>{
 const source=fact(),value=read(source);source.subject.controlGeneration=9;assert.equal(value.subject.controlGeneration,2);assert.equal(value.executionAuthorized,false);
 for(const patch of [{executionAuthorized:true},{dispatchPerformed:true},{transport:'CODEX'},{purpose:'CLIENT_READY'},{ready:true},{budgetReservationRef:null}])assert.throws(()=>read({...fact(),...patch}));
 let calls=0;const getter=fact();Object.defineProperty(getter,'checks',{enumerable:true,get(){calls++;return{};}});assert.throws(()=>read(getter));assert.equal(calls,0);
});
test('합성 계획은 최단 기한·정확 scope hash를 고정하고 변경·실행 허가가 아니다',()=>{
 const value=fact(),result=plan(value);assert.equal(result.snapshot.expiresAt,'2026-10-19T09:30:00.000Z');assert.equal(result.snapshot.state,'SYNTHETIC_PLAN');assert.equal(result.snapshot.executionAuthorized,false);assert.equal(result.snapshot.dispatchPerformed,false);
 assert.equal(result.snapshot.factHash,contentHash(canonicalJson(value)));assert.equal(result.ref.contentHash,contentHash(canonicalJson(result.snapshot)));
 assert.deepEqual(result.snapshot.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP']);assert.deepEqual(result.snapshot.binding.subject,value.subject);assert.deepEqual(result.snapshot.binding.registration,value.registration);
 assert.equal(typeof result.snapshot.scopeDigest,'string');
 const changed=fact();changed.subject.controlGeneration++;assert.notEqual(plan(changed).snapshot.scopeDigest,result.snapshot.scopeDigest);
 changed.registration.hostPublicKeyFingerprint='d'.repeat(64);assert.notEqual(plan(changed).snapshot.scopeDigest,plan(value).snapshot.scopeDigest);
 const long=fact();Object.keys(long.expires).forEach(key=>long.expires[key]='2026-10-19T12:00:00.000Z');assert.equal(plan(long).snapshot.expiresAt,'2026-10-19T10:00:00.000Z');
});
test('확인되지 않은 capability/OS/source/storage·writer 불명/충돌은 합성 계획도 거절한다',()=>{
 assert.equal(typeof grants.planSyntheticExecutionGrant,'function');
 for(const name of ['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage']){const value=fact();value.checks[name].state='UNVERIFIED';assert.throws(()=>plan(value),/EXECUTION_CURRENTNESS_REQUIRED/);}
 for(const writerState of ['UNKNOWN','CONFLICT','OWNED'])assert.throws(()=>plan({...fact(),writerState}),/EXECUTION_WRITER_UNAVAILABLE/);
 const future=fact();future.checkedAt='2026-10-19T08:00:00.001Z';assert.throws(()=>plan(future),/EXECUTION_FACT_TIME_INVALID/);
 assert.throws(()=>plan(fact(),'2026-10-19T08:00:30.001Z'),/EXECUTION_FACT_STALE/);
 const expired=fact();expired.expires.registration=at;assert.throws(()=>plan(expired),/EXECUTION_SOURCE_EXPIRED/);
});
test('WORK는 별도 이해 검토를 요구하며 맥락 확인에서 WRITE를 READ로 승격하지 않는다',()=>{
 assert.equal(typeof grants.planSyntheticExecutionGrant,'function');
 const write=fact();write.intent.sourceScopes[0].targets[0].access='WRITE';assert.throws(()=>plan(write),/EXECUTION_CONTEXT_READ_ONLY_REQUIRED/);
 write.intent.mode='WORK';assert.throws(()=>plan(write),/EXECUTION_UNDERSTANDING_REQUIRED/);write.understandingReviewRef=ref;assert.throws(()=>plan(write),/EXECUTION_UNDERSTANDING_REQUIRED/);write.checks.understanding={state:'VERIFIED_CURRENT',evidenceRefs:[ref]};assert.equal(plan(write).snapshot.binding.intent.mode,'WORK');
 const mismatch=fact();mismatch.intent.roleBindingRef={...ref,version:2};assert.throws(()=>read(mismatch),/SERVER_EXECUTION_FACT_INVALID/);
 const cross=fact();cross.intent.projectId=eid;assert.throws(()=>read(cross),/SERVER_EXECUTION_FACT_INVALID/);
 const noSource=fact();noSource.checks.source.evidenceRefs=[];assert.throws(()=>read(noSource),/SERVER_EXECUTION_FACT_INVALID/);
});
