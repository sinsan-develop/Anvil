import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticResultEvidence} from '../../../apps/server/modules/results/result-evidence.ts';
const mod:any=await import('../../../apps/server/modules/results/execution-issues.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v)),now='2026-10-19T13:00:00.000Z';
function fixture(){return{transport:'SYNTHETIC_ONLY',scope:{projectId:id(1),assignmentRef:ref(2),executionRef:ref(3)},asOf:now,reports:[] as any[],observationGaps:[] as any[],resultAssessment:null as any};}
function report(f:ReturnType<typeof fixture>,kind:string,sourceKind='CONNECTOR_OBSERVED',n=5){const snapshot={scope:structuredClone(f.scope),kind,sourceKind,observedAt:now,validUntil:'2026-10-19T13:01:00.000Z',requiresHumanDecision:false};return{ref:{...ref(n),contentHash:hash(snapshot)},snapshot};}
function result(f:ReturnType<typeof fixture>,state:string,submissionState='COMPLETED'){
 const snapshot={transport:'SYNTHETIC_ONLY',scope:structuredClone(f.scope),criteriaRef:ref(8),submissionState,items:[{criterionId:'browser-flow',required:true,submittedStatus:'PASS',state,reasons:state==='SUPPORTED_FOR_REVIEW'?[]:['EVIDENCE_MISSING'],evidence:[]}],assessedAt:now,reviewRequired:true,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};return{ref:{...ref(9),contentHash:hash(snapshot)},snapshot};
}
function classify(f:ReturnType<typeof fixture>){assert.equal(typeof mod.classifyExecutionIssue,'function','FN12 문제 분류 구현 누락');return mod.classifyExecutionIssue(f);}
test('실행중직접관측이유효하면장시간경과만으로idle/실패/새writer를만들지않는다',()=>{
 const f=fixture();f.reports=[report(f,'RUNNING')];assert.equal(classify(f),null);
 // 전체 작업 기간과 다른 최신 직접 관측의 유효성만 소비한다. 경과 시간 추측 필드는 받지 않는다.
 (f as any).elapsedMs=10*24*60*60*1000;assert.throws(()=>classify(f),/ISSUE_FACTS_INVALID/);
});
test('명시된오류/거부/대기/quota/단절만분류하고완료/실행/회수와자동재시도를만들지않는다',()=>{
 for(const kind of ['TOOL_ERROR','EXPLICIT_REFUSAL','APPROVAL_WAIT','INPUT_WAIT','QUOTA','TRANSPORT_LOSS']){
  const f=fixture();f.reports=[report(f,kind)];const issue=classify(f);assert.equal(issue.kind,kind);assert.equal(issue.knownFacts[0].kind,kind);assert.deepEqual(issue.evidenceRefs,[f.reports[0].ref]);assert.equal(issue.executionAuthorized,false);assert.equal(issue.dispatchPerformed,false);assert.equal(issue.formalFailureCounted,false);assert.equal(issue.writerReleaseVerified,false);assert.equal(issue.requiresHumanDecision,false);assert(issue.unknowns.includes('UNDERLYING_CAUSE_NOT_ESTABLISHED'));
 }
 const wait=fixture();wait.reports=[report(wait,'APPROVAL_WAIT','SERVER_DECISION')];wait.reports[0].snapshot.requiresHumanDecision=true;wait.reports[0].ref.contentHash=hash(wait.reports[0].snapshot);assert.equal(classify(wait).requiresHumanDecision,true);
});
test('수행자보고를직접관측으로승격하거나내부거부원인을추측하지않는다',()=>{
 const f=fixture();f.reports=[report(f,'EXPLICIT_REFUSAL','WORKER_CLAIM')];f.reports[0].snapshot.requiresHumanDecision=true;f.reports[0].ref.contentHash=hash(f.reports[0].snapshot);const issue=classify(f);assert.equal(issue.kind,'UNVERIFIED_CAUSE');assert.equal(issue.knownFacts[0].sourceKind,'WORKER_CLAIM');assert.equal(issue.requiresHumanDecision,false);assert(issue.unknowns.includes('PROVIDER_CLAIM_NOT_DIRECT_OBSERVATION'));
 const noFacts=classify(fixture());assert.equal(noFacts.kind,'UNVERIFIED_CAUSE');assert(noFacts.unknowns.includes('NO_CURRENT_OBSERVATION'));
});
test('RUNNING에명시된사람판단요구를null로소실하거나승인대기로추측하지않는다',()=>{
 const f=fixture();f.reports=[report(f,'RUNNING')];f.reports[0].snapshot.requiresHumanDecision=true;f.reports[0].ref.contentHash=hash(f.reports[0].snapshot);const issue=classify(f);assert(issue,'명시 판단 요구가 소실됨');assert.equal(issue.requiresHumanDecision,true);assert.equal(issue.kind,'UNVERIFIED_CAUSE');assert(issue.unknowns.includes('HUMAN_DECISION_REASON_UNSPECIFIED'));
});
test('관측공백과만료/상충을남기고정상관측한건으로이상기록을숨기지않는다',()=>{
 const gap=fixture();gap.reports=[report(gap,'RUNNING')];gap.observationGaps=[{from:2,to:4,evidenceRef:ref(10)}];const issue=classify(gap);assert.equal(issue.kind,'OBSERVATION_GAP');assert(issue.evidenceRefs.some((r:any)=>r.id===id(10)));assert(issue.unknowns.includes('OBSERVATION_SEQUENCE_GAP'));
 const stale=fixture();stale.reports=[report(stale,'RUNNING')];stale.asOf='2026-10-19T13:01:00.000Z';assert.equal(classify(stale).kind,'UNVERIFIED_CAUSE');
 const conflict=fixture();conflict.reports=[report(conflict,'RUNNING'),report(conflict,'EXPLICIT_REFUSAL','CONNECTOR_OBSERVED',6)];const mismatch=classify(conflict);assert.equal(mismatch.kind,'UNVERIFIED_CAUSE');assert.equal(mismatch.knownFacts.length,2);assert(mismatch.unknowns.includes('CONFLICTING_CURRENT_REPORTS'));
});
test('완료선언의필수부족/미실행만보완대상으로남기고합격증거도완료승인으로바꾸지않는다',()=>{
 for(const state of ['MISSING','NOT_EXECUTED','BLOCKED','INSUFFICIENT','FAILED']){const f=fixture();f.resultAssessment=result(f,state);const issue=classify(f);assert.equal(issue.kind,'INSUFFICIENT_COMPLETION_EVIDENCE');assert.deepEqual(issue.missingCriteria,['browser-flow']);assert.equal(issue.completionAccepted,false);}
 const supported=fixture();supported.reports=[report(supported,'RUNNING')];supported.resultAssessment=result(supported,'SUPPORTED_FOR_REVIEW');assert.equal(classify(supported),null);
 const partial=fixture();partial.reports=[report(partial,'RUNNING')];partial.resultAssessment=result(partial,'MISSING','INCOMPLETE');assert.equal(classify(partial),null);
});
test('다른프로젝트/실행과hash손상/미래시각/위조출처와상한초과는분류결과없이거절한다',()=>{
 for(const mutate of [(f:any)=>f.reports[0].snapshot.scope.projectId=id(20),(f:any)=>f.reports[0].ref.contentHash='b'.repeat(64),(f:any)=>{f.reports[0].snapshot.observedAt='2026-10-19T13:00:01.000Z';f.reports[0].ref.contentHash=hash(f.reports[0].snapshot);},(f:any)=>{f.reports[0].snapshot.sourceKind='LLM_GUESS';f.reports[0].ref.contentHash=hash(f.reports[0].snapshot);}]){const f=fixture();f.reports=[report(f,'TOOL_ERROR')];mutate(f);assert.throws(()=>classify(f),/ISSUE_REPORT_INVALID/);}
 const other=fixture();other.resultAssessment=result(other,'MISSING');other.resultAssessment.snapshot.scope.executionRef=ref(30);other.resultAssessment.ref.contentHash=hash(other.resultAssessment.snapshot);assert.throws(()=>classify(other),/ISSUE_RESULT_INVALID/);
 const oversized=fixture();oversized.reports=Array.from({length:101},(_,i)=>report(oversized,'RUNNING','CONNECTOR_OBSERVED',100+i));assert.throws(()=>classify(oversized),/ISSUE_FACTS_INVALID/);
 const real=fixture();real.transport='REAL';assert.throws(()=>classify(real),/ISSUE_FACTS_INVALID/);
});
test('기존결과수집기의실제부족계산을소비하고완료한조건전체를다시하라고요구하지않는다',async()=>{
 const f=fixture(),criteriaSnapshot={assignmentRef:f.scope.assignmentRef,baselineRefs:[ref(40)],items:[{criterionId:'browser-flow',testId:'FLOW-01',kind:'BROWSER',environmentRef:ref(41),required:true},{criterionId:'optional-device',testId:'DEVICE-01',kind:'BROWSER',environmentRef:ref(41),required:false},{criterionId:'core-unit',testId:'UNIT-01',kind:'UNIT',environmentRef:ref(41),required:true}]},criteriaRef={...ref(42),contentHash:hash(criteriaSnapshot)},basis={transport:'SYNTHETIC_ONLY',scope:f.scope,criteria:{ref:criteriaRef,snapshot:criteriaSnapshot},authorityRef:ref(43),checkedAt:now,expiresAt:'2026-10-19T13:01:00.000Z'};
 const bytes=new TextEncoder().encode('합성 단위시험 산출물'),artifactRef={...ref(45),contentHash:contentHash(bytes)},snapshot={scope:structuredClone(f.scope),sourceKind:'TEST_ARTIFACT',criterionId:'core-unit',testId:'UNIT-01',kind:'UNIT',environmentRef:ref(41),baselineRefs:[ref(40)],status:'PASS',exitCode:0,commandRef:ref(46),artifactRefs:[artifactRef],recordedAt:now},evidenceRef={...ref(47),contentHash:hash(snapshot)};
 const collector=new SyntheticResultEvidence({transport:'SYNTHETIC_ONLY',transaction:async(selected,body)=>{assert.deepEqual(selected,f.scope);return body({clock:async()=>now,current:async()=>structuredClone(basis),readEvidence:async(r)=>{assert.deepEqual(r,evidenceRef);return{ref:evidenceRef,snapshot};},readArtifact:async(r)=>{assert.deepEqual(r,artifactRef);return{ref:artifactRef,state:'AVAILABLE',bytes};}});}});
 const assessment=await collector.assess(f.scope,{criteriaRef,submissionState:'COMPLETED',testResults:[{criterionId:'core-unit',status:'PASS',evidenceRefs:[evidenceRef]}],unexecuted:[]});
 f.resultAssessment={ref:{...ref(44),contentHash:hash(assessment)},snapshot:assessment};const issue=classify(f);assert.equal(issue.kind,'INSUFFICIENT_COMPLETION_EVIDENCE');assert.deepEqual(issue.missingCriteria,['browser-flow']);assert(issue.nextChoices.includes('REQUEST_ONLY_MISSING_EVIDENCE'));assert.equal(assessment.items.length,3);assert.equal(assessment.items.find(i=>i.criterionId==='core-unit')?.state,'SUPPORTED_FOR_REVIEW');assert.equal(assessment.completionAccepted,false);
});
