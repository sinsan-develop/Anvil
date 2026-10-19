import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {resultReviewFixture,resultReviewId as id} from './result-review-fixture.ts';
const mod:any=await import('../../../apps/server/modules/results/project-result-review-sources.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const f=resultReviewFixture(),actor:any={actorId:id(70),clientId:id(71)},definition={taskRef:{planRef:ref(4),taskCode:'FN12',applicationRef:ref(72),nodeId:'review'},purpose:'사용자 소유 기준으로 검수',goal:'증거 확인',baselineRefs:[ref(4)],inputs:['원제출'],outputs:['검수'],acceptanceCriteria:['실제 저장과 원문 조회'],verificationRequirements:['정상 흐름과 중요한 거절 확인'],included:['검수 준비'],excluded:['임의 Agent 호출'],allowedScopes:[{sourceRootRef:ref(73),mappingRef:null,observationRef:ref(74),baselineRef:ref(4),targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false}]}],environmentRef:ref(5),requiredCapabilities:['읽기'],budgetRef:null,ownerRole:'단계책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'결과 검토'};
 const snapshot={draftRef:ref(2),definition,reviewRefs:[ref(75)],reason:'내용 확정',confirmedBy:{kind:'HUMAN',userId:actor.actorId},confirmedAt:'2026-10-19T13:59:00.000Z',contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},assignment:any={projectId:f.scope.projectId,ref:{...ref(2),contentHash:hash(snapshot)},snapshot,observedAt:'2026-10-19T14:00:00.000Z'};
 f.scope.assignmentRef=structuredClone(assignment.ref);f.result.snapshot.manifest.assignmentRef=structuredClone(assignment.ref);f.rehash();
 let member=true,afterRead=()=>{};const calls:string[]=[];
 const db:any={query:async(sql:string,args:any[])=>{calls.push(sql);if(sql.includes('JOIN anvil.project_members')){assert.deepEqual(args,[f.scope.projectId,actor.actorId]);return{rows:member?[{id:f.scope.projectId,participation:'OWNER',archived_at:null}]:[]};}if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date('2026-10-19T14:00:00.000Z')}]};throw Error('UNEXPECTED_QUERY:'+sql);}};
 const results={read:async(d:any,a:any,pid:string,rid:string)=>{assert.equal(d,db);assert.equal(a,actor);assert.equal(pid,f.scope.projectId);assert.equal(rid,f.result.ref.id);return structuredClone(f.result);}},assignments={read:async(d:any,a:any,pid:string,aid:string,v:number)=>{assert.equal(d,db);assert.equal(a,actor);assert.equal(pid,f.scope.projectId);assert.equal(aid,assignment.ref.id);assert.equal(v,assignment.ref.version);afterRead();return structuredClone(assignment);}};
 return{...f,actor,assignment,definition,db,calls,results,assignments,member:(v:boolean)=>member=v,afterRead:(fn:()=>void)=>afterRead=fn,rehashAssignment:()=>{assignment.ref.contentHash=hash(snapshot);f.scope.assignmentRef=structuredClone(assignment.ref);f.result.snapshot.manifest.assignmentRef=structuredClone(assignment.ref);f.rehash();}};
}
function service(f:ReturnType<typeof fixture>){assert.equal(typeof mod.ProjectResultReviewSources,'function','실제 원제출·내용확정 임무 검수 연결 미구현');return new mod.ProjectResultReviewSources(f.assignments,f.results);}
test('같은인증tx의원제출과exact내용확정임무를대조하고문구를시험합격으로추론하지않는다',async()=>{
 const f=fixture(),r=await service(f).read(f.db,f.actor,f.scope.projectId,f.result.ref.id);
 assert.deepEqual(r.result,f.result);assert.deepEqual(r.assignment,f.assignment);assert.equal(r.criteriaState,'TEXT_ONLY_NOT_MAPPED');assert.deepEqual(r.issues,['TYPED_CRITERIA_NOT_REGISTERED']);for(const flag of ['reviewStored','completionAccepted','executionAuthorized','dispatchPerformed'])assert.equal(r[flag],false);
 assert.equal(f.calls.filter(s=>s.includes('JOIN anvil.project_members')).length,2);assert(f.calls.every(s=>s.startsWith('SELECT')));r.assignment.snapshot.definition.goal='호출자 변경';assert.equal(f.definition.goal,'증거 확인');
});
test('다른프로젝트/버전·hash손상과조회중멤버회수는검수원문을반환하지않는다',async()=>{
 for(const alter of [(f:any)=>f.assignment.projectId=id(99),(f:any)=>f.assignment.ref.version=2,(f:any)=>f.assignment.snapshot.definition.goal='손상',(f:any)=>f.result.snapshot.scope.projectId=id(99),(f:any)=>f.afterRead(()=>f.member(false))]){const f=fixture();alter(f);await assert.rejects(service(f).read(f.db,f.actor,f.scope.projectId,f.result.ref.id));assert(f.calls.every(s=>s.startsWith('SELECT')));}
});
test('제출기준차이와미정환경/누락조건은원문을보존하고부족사유로분리한다',async()=>{
 const f=fixture();f.definition.environmentRef=null as any;f.definition.acceptanceCriteria=[];f.definition.verificationRequirements=[];f.rehashAssignment();f.result.snapshot.manifest.baselineRefs=[];f.rehash();const r=await service(f).read(f.db,f.actor,f.scope.projectId,f.result.ref.id);
 assert.deepEqual(r.issues,['TYPED_CRITERIA_NOT_REGISTERED','RESULT_BASELINES_MISMATCH','ENVIRONMENT_NOT_DEFINED','ACCEPTANCE_CRITERIA_MISSING','VERIFICATION_REQUIREMENTS_MISSING']);assert.deepEqual(r.result.snapshot.manifest.baselineRefs,[]);assert.equal(r.completionAccepted,false);
});
test('잘못된입력은원문을읽지않고합친원문2MiB초과는반환하지않는다',async()=>{
 const f=fixture();await assert.rejects(service(f).read(f.db,f.actor,'../project',f.result.ref.id));assert.equal(f.calls.length,0);
 f.definition.inputs=Array.from({length:50},()=> '가'.repeat(10000));f.rehashAssignment();f.result.snapshot.manifest.risks=Array.from({length:25},()=> '가'.repeat(10000));f.rehash();
 assert(Buffer.byteLength(canonicalJson(f.assignment))<2*1024*1024);assert(Buffer.byteLength(canonicalJson(f.result))<2*1024*1024);
 await assert.rejects(service(f).read(f.db,f.actor,f.scope.projectId,f.result.ref.id),/RESULT_REVIEW_SOURCES_LIMIT/);
});
