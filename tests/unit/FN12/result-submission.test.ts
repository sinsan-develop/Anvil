import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/results/result-submission.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),at='2026-10-19T14:00:00.000Z';
function fixture(){const scope={projectId:id(1),assignmentRef:ref(2),executionRef:ref(3)},evidence={sourceKind:'CONNECTOR_OBSERVED',ref:ref(4),contentHash:'b'.repeat(64),environmentRef:ref(5),recordedAt:at};const manifest:any={assignmentRef:scope.assignmentRef,executionRef:scope.executionRef,baselineRefs:[ref(6)],submissionState:'COMPLETED',changes:[{path:'apps/example.ts',kind:'MODIFIED',diffRef:ref(7),beforeHash:'c'.repeat(64),afterHash:'d'.repeat(64)}],commandResults:[{profileRef:ref(8),argv:['--test','example.test.ts'],cwdRef:ref(9),hostRef:ref(10),executionRef:scope.executionRef,startedAt:at,finishedAt:at,exitCode:0,outputRef:ref(11),evidence:[evidence]}],testResults:[{criterionId:'flow',testId:'FLOW-01',baselineRefs:[ref(6)],expected:'저장과 재조회',actual:'저장만 확인',status:'NOT_EXECUTED',evidence:[{...evidence,sourceKind:'REVIEWER_CONFIRMED'}]}],artifactRefs:[ref(12)],unexecuted:[{criterionId:'flow',testId:'FLOW-01',reason:'브라우저 미실행'}],risks:['연결 미검증'],rollback:'이번 변경만 일반 revert로 복구',checkpointRef:ref(13)};return{scope,manifest};}
function prepare(f:ReturnType<typeof fixture>){assert.equal(typeof mod.prepareSubmittedResult,'function','FN12 전체 결과 제출 원문 처리 누락');return mod.prepareSubmittedResult(f.scope,f.manifest);}
test('전체manifest와변경/명령/시험/미실행/위험/복구를보존하고선언출처를검증으로승격하지않는다',()=>{
 const f=fixture(),original=canonicalJson(f.manifest),result=prepare(f);assert.equal(result.manifestCanonical,original);assert.equal(result.contentHash,contentHash(original));assert.deepEqual(result.manifest,f.manifest);assert.equal(result.sourceKind,'WORKER_CLAIM');assert.deepEqual(result.declaredEvidenceSourceKinds,['CONNECTOR_OBSERVED','REVIEWER_CONFIRMED']);assert.equal(result.evidenceProvenanceVerified,false);assert.equal(result.completionAccepted,false);assert.equal(result.formalFailureCounted,false);assert.equal(result.persisted,false);assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);
 f.manifest.changes[0].path='altered.ts';assert.equal(result.manifest.changes[0].path,'apps/example.ts');assert.equal(result.manifest.testResults[0].status,'NOT_EXECUTED');
});
test('미실행과완료선언을서로합치지않고부분/실패/차단/취소제출상태를그대로보존한다',()=>{
 for(const state of ['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED']){const f=fixture();f.manifest.submissionState=state;const result=prepare(f);assert.equal(result.manifest.submissionState,state);assert.equal(result.manifest.unexecuted.length,1);assert.equal(result.manifest.testResults[0].status,'NOT_EXECUTED');assert.equal(result.completionAccepted,false);assert.equal(result.formalFailureCounted,false);}
});
test('필수구획누락/교차실행/오염된참조/미래형실행효과와크기초과는원문저장후보를만들지않는다',()=>{
 for(const key of Object.keys(fixture().manifest)){const f=fixture();delete f.manifest[key];assert.throws(()=>prepare(f),/RESULT_MANIFEST_INVALID/);}
 const other=fixture();other.manifest.executionRef=ref(20);assert.throws(()=>prepare(other),/RESULT_MANIFEST_INVALID/);
 const command=fixture();command.manifest.commandResults[0].executionRef=ref(21);assert.throws(()=>prepare(command),/RESULT_MANIFEST_INVALID/);
 const bad=fixture();bad.manifest.artifactRefs[0].version=0;assert.throws(()=>prepare(bad),/RESULT_MANIFEST_INVALID/);
 const extra=fixture();extra.manifest.executionAuthorized=true;assert.throws(()=>prepare(extra),/RESULT_MANIFEST_INVALID/);
 const huge=fixture();huge.manifest.rollback='x'.repeat(2*1024*1024);assert.throws(()=>prepare(huge),/RESULT_MANIFEST_INVALID/);
});
test('경로는실행하지않고절대/상위경로와알려진비밀인자/본문표식은거절한다',()=>{
 for(const path of ['../outside.ts','C:/private.ts','/root/private.ts']){const f=fixture();f.manifest.changes[0].path=path;assert.throws(()=>prepare(f),/RESULT_MANIFEST_INVALID/);}
 const token=fixture();token.manifest.commandResults[0].argv=['--token','synthetic-not-real'];assert.throws(()=>prepare(token),/RESULT_MANIFEST_SENSITIVE/);
 const body=fixture();body.manifest.risks=['Bearer '+'A'.repeat(24)];assert.throws(()=>prepare(body),/RESULT_MANIFEST_SENSITIVE/);
});
