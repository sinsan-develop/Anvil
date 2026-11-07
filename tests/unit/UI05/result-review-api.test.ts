import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {resultFixture,hash} from './result-view-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/result-review-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const f=resultFixture(),definition={taskRef:{planRef:structuredClone(f.a),taskCode:'FN12',applicationRef:structuredClone(f.a),nodeId:'검수'},purpose:'원문 검수',goal:'선택 제출 검수',ownerRole:'단계책임자',integrationResponsibility:'결과 확인',baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,inputs:['제출 원문'],outputs:['검수 결과'],included:['원문 확인'],excluded:['외부 실행'],requiredCapabilities:[],acceptanceCriteria:['원문 보존'],verificationRequirements:['중요 거절']},snapshot={draftRef:structuredClone(f.a),definition,reviewRefs:[f.entry.snapshot.submittedByRef],reason:'고정 내용',confirmedBy:{kind:'HUMAN',userId:f.pid},confirmedAt:'2026-10-19T09:59:00.000Z',contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},assignment:any={projectId:f.pid,ref:{...f.a,contentHash:hash(snapshot)},snapshot,observedAt:f.page.observedAt};
 f.a.contentHash=assignment.ref.contentHash;f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);
 const value:any={projectId:f.pid,result:structuredClone(f.entry),assignment:structuredClone(assignment),criteriaState:'TEXT_ONLY_NOT_MAPPED',issues:['TYPED_CRITERIA_NOT_REGISTERED','ENVIRONMENT_NOT_DEFINED'],reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};return{...f,assignment,value};
}
function read(...args:any[]){assert.equal(typeof mod.readResultReviewSources,'function','검수 원문 화면 소비 미구현');return mod.readResultReviewSources(...args);}
test('선택제출/확정임무와일치하는원문만same-originGET로받고합격으로표시하지않는다',async()=>{
 const f=fixture(),calls:string[]=[],client=new ApiClient(async(url,options)=>{calls.push(String(url));assert.equal(options?.method,'GET');assert.equal(options?.credentials,'same-origin');return Response.json(f.value);}),v=await read(client,f.pid,f.entry,f.assignment,()=>true);
 assert.deepEqual(v.issues,['TYPED_CRITERIA_NOT_REGISTERED','ENVIRONMENT_NOT_DEFINED']);assert.equal(v.reviewStored,false);assert.deepEqual(v.assignment.snapshot.definition.acceptanceCriteria,['원문 보존']);assert.deepEqual(calls,[`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}/review-sources`]);
});
test('재해시다른원문/프로젝트·위조완료/부족사유누락·hash손상은현재검수자료가아니다',async()=>{
 for(const alter of [(f:any)=>f.value.projectId=f.a.id,(f:any)=>{f.value.assignment.snapshot.definition.acceptanceCriteria=['다른 기준'];f.value.assignment.ref.contentHash=hash(f.value.assignment.snapshot);},(f:any)=>f.value.completionAccepted=true,(f:any)=>f.value.issues=[],(f:any)=>f.value.result.snapshot.manifest.rollback='변조',(f:any)=>{f.value.assignment.ref.contentHash='f'.repeat(64);f.assignment.ref.contentHash='f'.repeat(64);}]){const f=fixture();alter(f);await assert.rejects(read(new ApiClient(async()=>Response.json(f.value)),f.pid,f.entry,f.assignment,()=>true));}
});
test('선택전환/인증실패에이전검수자료를돌려주지않고caller입력은대기중변경과분리한다',async()=>{
 const f=fixture();let active=true,calls=0;const client=new ApiClient(async()=>{calls++;active=false;return Response.json(f.value);});assert.equal(await read(client,f.pid,f.entry,f.assignment,()=>active),null);assert.equal(await read(client,f.pid,f.entry,f.assignment,()=>false),null);assert.equal(calls,1);
 await assert.rejects(read(new ApiClient(async()=>Response.json({code:'AUTH_REQUIRED'},{status:401})),f.pid,f.entry,f.assignment,()=>true),(e:any)=>e.status===401);
 const g=fixture(),c=new ApiClient(async()=>{g.entry.snapshot.manifest.rollback='대기중 caller 변경';return Response.json(g.value);});assert.equal((await read(c,g.pid,g.entry,g.assignment,()=>true)).result.snapshot.manifest.rollback,'원본 보존');
});
