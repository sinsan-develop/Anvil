import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticResultEvidence} from '../../../apps/server/modules/results/result-evidence.ts';
const mod:any=await import('../../../apps/server/modules/results/result-criteria.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const d:any={taskRef:{planRef:ref(1),taskCode:'FN12',applicationRef:ref(2),nodeId:'review'},purpose:'사용자 기준',goal:'원문 검수',baselineRefs:[ref(1),ref(2)],inputs:['원제출'],outputs:['검수'],acceptanceCriteria:['실제 저장'],verificationRequirements:['중요 거절'],included:['개발'],excluded:['운영'],allowedScopes:[],environmentRef:ref(3),requiredCapabilities:[],budgetRef:null,ownerRole:'단계책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'검수·통합'};
 const snapshot:any={draftRef:ref(4),definition:d,reviewRefs:[ref(5)],reason:'내용 확정',confirmedBy:{kind:'HUMAN',userId:id(6)},confirmedAt:'2026-10-19T10:00:00.000Z',contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},assignment:any={projectId:id(7),ref:{...ref(4),contentHash:hash(snapshot)},snapshot,observedAt:'2026-10-19T10:01:00.000Z'};
 const input:any={assignmentRef:structuredClone(assignment.ref),baseRef:null,items:[{criterionId:'save',testId:'SAVE-01',kind:'INTEGRATION',environmentRef:ref(3),sources:[{field:'acceptanceCriteria',index:0,contentHash:hash('실제 저장')}]},{criterionId:'denied',testId:'DENY-01',kind:'SECURITY',environmentRef:ref(3),sources:[{field:'verificationRequirements',index:0,contentHash:hash('중요 거절')}]}],reason:'조건별 실제 시험 계획'};
 return{assignment,input,d,rehash:()=>{assignment.ref.contentHash=hash(snapshot);input.assignmentRef=structuredClone(assignment.ref);}};
}
function prepare(f:ReturnType<typeof fixture>){assert.equal(typeof mod.prepareResultCriteria,'function','확정 조건의 명시 검수 기준 입력 미구현');return mod.prepareResultCriteria(f.assignment,f.input);}
test('명시매핑은모든확정조건과환경/기준을보존하고기존증거수집기에그대로연결된다',async()=>{
 const f=fixture(),before=structuredClone(f.input),v=prepare(f);assert.equal(v.registryStored,false);assert.equal(v.completionAccepted,false);assert.deepEqual(v.criteriaSnapshot.items.map((i:any)=>[i.criterionId,i.kind,i.required]),[['save','INTEGRATION',true],['denied','SECURITY',true]]);assert.deepEqual(v.criteriaSnapshot.baselineRefs,f.d.baselineRefs);assert.deepEqual(f.input,before);
 const scope={projectId:f.assignment.projectId,assignmentRef:f.assignment.ref,executionRef:ref(8)},criteria={ref:{...ref(9),contentHash:v.contentHash},snapshot:v.criteriaSnapshot},at='2026-10-19T10:02:00.000Z';
 const reader=new SyntheticResultEvidence({transport:'SYNTHETIC_ONLY',transaction:async(_s,body)=>body({clock:async()=>at,current:async()=>({transport:'SYNTHETIC_ONLY',scope,criteria,authorityRef:ref(10),checkedAt:at,expiresAt:'2026-10-19T10:03:00.000Z'}),readEvidence:async()=>assert.fail('누락 시험 근거 조회 금지'),readArtifact:async()=>assert.fail('누락 원문 조회 금지')})});
 const missing=await reader.assess(scope,{criteriaRef:criteria.ref,submissionState:'COMPLETED',testResults:[],unexecuted:[]});assert.deepEqual(missing.items.map(i=>i.state),['MISSING','MISSING']);assert.equal(missing.completionAccepted,false);
});
test('원조건누락/잘못된index·옛문구hash·중복ID와필수조건완화는거절한다',()=>{
 for(const alter of [(f:any)=>f.input.items.pop(),(f:any)=>f.input.items[0].sources[0].index=1,(f:any)=>f.input.items[0].sources[0].contentHash='f'.repeat(64),(f:any)=>f.input.items[1].criterionId='save',(f:any)=>f.input.items[0].required=false,(f:any)=>f.input.items[0].sources.push(structuredClone(f.input.items[0].sources[0]))]){const f=fixture();alter(f);assert.throws(()=>prepare(f),/RESULT_CRITERIA_/);}
});
test('다른확정버전/미정환경·환경불일치/위조완료와임의종류/비밀문구는등록초안이아니다',()=>{
 for(const alter of [(f:any)=>f.input.assignmentRef.version=2,(f:any)=>{f.d.environmentRef=null;f.rehash();},(f:any)=>f.input.items[0].environmentRef=ref(20),(f:any)=>{f.assignment.snapshot.executionAuthorized=true;f.rehash();},(f:any)=>f.input.items[0].kind='AUTO_INFERRED',(f:any)=>f.input.reason='api_key=not-a-real-secret-value']){const f=fixture();alter(f);assert.throws(()=>prepare(f),/RESULT_CRITERIA_/);}
});
test('확정원문손상/빈조건·빈기준은추론으로메우지않고입력과출력을분리한다',()=>{
 for(const alter of [(f:any)=>f.d.acceptanceCriteria[0]='손상',(f:any)=>{f.d.acceptanceCriteria=[''];f.rehash();},(f:any)=>{f.d.baselineRefs=[];f.rehash();}]){const f=fixture();alter(f);assert.throws(()=>prepare(f),/RESULT_CRITERIA_/);}
 const f=fixture(),v=prepare(f);v.criteriaSnapshot.items[0].environmentRef.id=id(30);v.sourceBindings[0].sources[0].index=99;assert.equal(f.input.items[0].environmentRef.id,id(3));assert.equal(f.input.items[0].sources[0].index,0);
});
