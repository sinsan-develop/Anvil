import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/results/result-evidence.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-19T12:00:00.000Z';
function fixture(){
 const scope={projectId:id(1),assignmentRef:ref(2),executionRef:ref(3)},bytes=new TextEncoder().encode('합성 test artifact'),artifactRef={...ref(4),contentHash:contentHash(bytes)},criteriaSnapshot={assignmentRef:scope.assignmentRef,baselineRefs:[ref(5)],items:[{criterionId:'browser-flow',testId:'FLOW-01',kind:'BROWSER',environmentRef:ref(6),required:true}]},criteriaRef={...ref(7),contentHash:hash(criteriaSnapshot)},basis={transport:'SYNTHETIC_ONLY',scope,criteria:{ref:criteriaRef,snapshot:criteriaSnapshot},authorityRef:ref(8),checkedAt:at,expiresAt:'2026-10-19T12:01:00.000Z'},snapshot={scope:structuredClone(scope),sourceKind:'TEST_ARTIFACT',criterionId:'browser-flow',testId:'FLOW-01',kind:'BROWSER',environmentRef:ref(6),baselineRefs:[ref(5)],status:'PASS',exitCode:0,commandRef:ref(9),artifactRefs:[artifactRef],recordedAt:at};
 let evidence:any={ref:{...ref(10),contentHash:hash(snapshot)},snapshot},clock=at,artifactState='AVAILABLE',artifactBytes=bytes;let currentCalls=0;const calls:string[]=[];
 const submission={criteriaRef,submissionState:'COMPLETED',testResults:[{criterionId:'browser-flow',status:'PASS',evidenceRefs:[evidence.ref]}],unexecuted:[] as any[]};
 let onRead=()=>{};
 const store={transport:'SYNTHETIC_ONLY',transaction:async(s:any,body:any)=>{assert.deepEqual(s,scope);return body({clock:async()=>clock,current:async()=>{currentCalls++;return structuredClone(basis);},readEvidence:async(r:any)=>{assert.deepEqual(r,evidence.ref);calls.push('evidence');onRead();return structuredClone(evidence);},readArtifact:async(r:any)=>{assert.deepEqual(r,artifactRef);calls.push('artifact');return{ref:artifactRef,state:artifactState,bytes:artifactBytes};}});}};
 return{scope,basis,submission,store,calls,get currentCalls(){return currentCalls;},change:(fn:(s:any)=>void)=>{fn(snapshot);evidence={ref:{...evidence.ref,contentHash:hash(snapshot)},snapshot};submission.testResults[0]!.evidenceRefs=[evidence.ref];},corrupt:()=>evidence.snapshot.testId='tampered',artifact:(state:string,raw=bytes)=>{artifactState=state;artifactBytes=raw;},afterRead:(fn:()=>void)=>onRead=fn,expire:()=>clock='2026-10-19T12:01:00.000Z'};
}
function reader(f:ReturnType<typeof fixture>){assert.equal(typeof mod.SyntheticResultEvidence,'function','FN12 증거 수집 구현 누락');return new mod.SyntheticResultEvidence(f.store);}
test('수행자완료주장과기록된시험출처를분리하고검수합격/실행허가를만들지않는다',async()=>{
 const f=fixture();f.change(s=>s.sourceKind='WORKER_CLAIM');const result=await reader(f).assess(f.scope,f.submission);
 assert.equal(result.submissionState,'COMPLETED');assert.equal(result.items[0].state,'INSUFFICIENT');assert(result.items[0].reasons.includes('WORKER_CLAIM_ONLY'));assert.equal(result.completionAccepted,false);assert.equal(result.reviewRequired,true);assert.equal(result.executionAuthorized,false);assert.deepEqual(f.calls,['evidence']);
 const good=fixture(),supported=await reader(good).assess(good.scope,good.submission);assert.equal(supported.items[0].state,'SUPPORTED_FOR_REVIEW');assert.equal(supported.completionAccepted,false);assert.deepEqual(good.calls,['evidence','artifact']);assert(good.currentCalls>=2);
});
test('빌드성공을브라우저성공으로승격하지않고환경/기준/종료코드차이를부족으로남긴다',async()=>{
 for(const [mutate,reason] of [[(s:any)=>s.kind='BUILD','VERIFICATION_KIND_MISMATCH'],[(s:any)=>s.environmentRef=ref(11),'ENVIRONMENT_MISMATCH'],[(s:any)=>s.baselineRefs=[ref(12)],'BASELINE_MISMATCH'],[(s:any)=>s.exitCode=1,'EXIT_NOT_SUCCESS']] as const){const f=fixture();f.change(mutate);const result=await reader(f).assess(f.scope,f.submission);assert.equal(result.items[0].state,'INSUFFICIENT');assert(result.items[0].reasons.includes(reason));}
});
test('누락/미실행/차단을PASS로바꾸지않고중복조건과모순된미실행선언을거절한다',async()=>{
 const missing=fixture();missing.submission.testResults=[];assert.equal((await reader(missing).assess(missing.scope,missing.submission)).items[0].state,'MISSING');
 const unrun=fixture();unrun.submission.testResults=[];unrun.submission.unexecuted=[{criterionId:'browser-flow',reasonCode:'ENVIRONMENT_UNAVAILABLE'}];assert.equal((await reader(unrun).assess(unrun.scope,unrun.submission)).items[0].state,'NOT_EXECUTED');
 const blocked=fixture();blocked.change(s=>s.status='BLOCKED');blocked.submission.testResults[0]!.status='BLOCKED';assert.equal((await reader(blocked).assess(blocked.scope,blocked.submission)).items[0].state,'BLOCKED');
 const contradiction=fixture();contradiction.submission.unexecuted=[{criterionId:'browser-flow',reasonCode:'ENVIRONMENT_UNAVAILABLE'}];await assert.rejects(reader(contradiction).assess(contradiction.scope,contradiction.submission),/RESULT_SUBMISSION_INVALID/);
 const duplicate=fixture();duplicate.submission.testResults.push(structuredClone(duplicate.submission.testResults[0]!));await assert.rejects(reader(duplicate).assess(duplicate.scope,duplicate.submission),/RESULT_SUBMISSION_INVALID/);
});
test('등록원문hash/다른실행위조는거절하고누락/격리/변조산출물은부족으로표시한다',async()=>{
 const corrupt=fixture();corrupt.corrupt();await assert.rejects(reader(corrupt).assess(corrupt.scope,corrupt.submission),/RESULT_EVIDENCE_INVALID/);
 const other=fixture();other.change(s=>s.scope.executionRef=ref(13));await assert.rejects(reader(other).assess(other.scope,other.submission),/RESULT_EVIDENCE_INVALID/);
 for(const [state,bytes,reason] of [['MISSING',undefined,'ARTIFACT_UNAVAILABLE'],['QUARANTINED',undefined,'ARTIFACT_UNAVAILABLE'],['AVAILABLE',new Uint8Array([0]),'ARTIFACT_HASH_MISMATCH']] as const){const f=fixture();f.artifact(state,bytes);const result=await reader(f).assess(f.scope,f.submission);assert.equal(result.items[0].state,'INSUFFICIENT');assert(result.items[0].reasons.includes(reason));}
});
test('조회중현재권한/기준전환과만료뒤에는결과를반환하지않고실제transport대체를거절한다',async()=>{
 const changed=fixture();changed.afterRead(()=>changed.basis.authorityRef=ref(15));await assert.rejects(reader(changed).assess(changed.scope,changed.submission),/RESULT_CURRENT_CHANGED/);
 const expired=fixture();expired.afterRead(()=>expired.expire());await assert.rejects(reader(expired).assess(expired.scope,expired.submission),/RESULT_CURRENT_REQUIRED/);
 const real=fixture();real.store.transport='REAL';assert.throws(()=>reader(real),/SYNTHETIC_RESULT_STORE_REQUIRED/);
});
test('근거없는실패/차단선언을직접관측상태로확정하지않고상충하는등록시험도숨기지않는다',async()=>{
 const claim=fixture();claim.submission.testResults[0]!.status='BLOCKED';claim.submission.testResults[0]!.evidenceRefs=[];const reported=await reader(claim).assess(claim.scope,claim.submission);assert.equal(reported.items[0].submittedStatus,'BLOCKED');assert.equal(reported.items[0].state,'INSUFFICIENT');
 const f=fixture(),original=f.store.transaction;
 f.store.transaction=async(s:any,body:any)=>original(s,async(tx:any)=>{
  const first=await tx.readEvidence(f.submission.testResults[0]!.evidenceRefs[0]);const snapshot={...first.snapshot,status:'FAIL',exitCode:1},second={ref:{...ref(20),contentHash:hash(snapshot)},snapshot};f.submission.testResults[0]!.evidenceRefs.push(second.ref);
  return body({...tx,readEvidence:async(r:any)=>r.id===second.ref.id?structuredClone(second):tx.readEvidence(r)});
 });
 const mixed=await reader(f).assess(f.scope,f.submission);assert.equal(mixed.items[0].evidence.length,2);assert.equal(mixed.items[0].state,'INSUFFICIENT');assert(mixed.items[0].reasons.includes('STATUS_MISMATCH'));
});
test('최종current와clock대기중합성경계가변경되면결과반환을거절한다',async()=>{
 for(const point of ['current','clock']){
  const f=fixture(),original=f.store.transaction;let count=0;
  f.store.transaction=async(s:any,body:any)=>original(s,async(tx:any)=>body({...tx,[point]:async()=>{const value=await tx[point]();if(++count===2)f.store.transport='REAL';return value;}}));
  await assert.rejects(reader(f).assess(f.scope,f.submission),/SYNTHETIC_RESULT_STORE_REQUIRED/);
 }
});
