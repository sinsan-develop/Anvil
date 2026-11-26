import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ProjectAssignmentConfirmations} from '../../../apps/server/modules/assignments/project-assignment-confirmations.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {readSessionDetail} from '../../../apps/web/src/features/session-detail/api.ts';
import {readAssignmentResultPage} from '../../../apps/web/src/features/session-detail/result-api.ts';

const projectId='b1000000-0000-4000-8000-000000000001';
const planRef={id:'b1000000-0000-4000-8000-000000000002',version:3,contentHash:'a'.repeat(64)};
const assignmentRef={id:'b1000000-0000-4000-8000-000000000003',version:1,contentHash:'b'.repeat(64)};
const draftRef={id:assignmentRef.id,version:assignmentRef.version,contentHash:'d'.repeat(64)};

test('고정 계획 fullref와 업무 코드의 exact confirmed assignment만 FN12 조회 화면에 연결한다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/trace-task-evidence.ts').catch(()=>({}));
 assert.equal(typeof m.readTraceTaskEvidence,'function');
 let path='';
 const client=new ApiClient(async value=>{path=String(value);return Response.json({projectId,planRef,taskCode:'UI06',state:'MATCHED',assignmentRef,draftRef,observedAt:'2026-11-26T01:00:00.000Z'});});
 const value=await m.readTraceTaskEvidence(client,projectId,{kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:'UI06'},()=>true);
 assert.deepEqual(value.assignmentRef,assignmentRef);
 assert.match(path,/planHash=a{64}/);assert.match(path,/taskCode=UI06/);
 assert.match(m.traceTaskEvidenceHref(value),/session\/assignments\/b1000000-0000-4000-8000-000000000003\/versions\/1\/d{64}$/);
});

test('0·복수·plan fullref 불일치는 이유만 보이고 근사 assignment를 선택하지 않는다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/trace-task-evidence.ts');
 for(const state of['ASSIGNMENT_NOT_FOUND','ASSIGNMENT_AMBIGUOUS','PLAN_REFERENCE_MISMATCH']){
  const body={projectId,planRef,taskCode:'UI06',state,assignmentRef:null,draftRef:null,observedAt:'2026-11-26T01:00:00.000Z'};
  const value=await m.readTraceTaskEvidence(new ApiClient(async()=>Response.json(body)),projectId,{kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:'UI06'},()=>true);
  assert.equal(value.assignmentRef,null);assert.throws(()=>m.traceTaskEvidenceHref(value));
 }
 const mismatched={projectId,planRef:{...planRef,contentHash:'f'.repeat(64)},taskCode:'UI06',state:'MATCHED',assignmentRef,draftRef,observedAt:'2026-11-26T01:00:00.000Z'};
 await assert.rejects(m.readTraceTaskEvidence(new ApiClient(async()=>Response.json(mismatched)),projectId,{kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:'UI06'},()=>true));
 const crossed={projectId,planRef,taskCode:'UI06',state:'MATCHED',assignmentRef,draftRef:{...draftRef,id:projectId},observedAt:'2026-11-26T01:00:00.000Z'};
 await assert.rejects(m.readTraceTaskEvidence(new ApiClient(async()=>Response.json(crossed)),projectId,{kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:'UI06'},()=>true));
});

test('중단·transport 교체 뒤 늦은 401/200은 선택과 인증 상실로 소비하지 않는다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/trace-task-evidence.ts');
 let active=true,resolve!:(value:Response)=>void;
 const client=new ApiClient(()=>new Promise<Response>(r=>resolve=r));
 const pending=m.readTraceTaskEvidence(client,projectId,{kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:'UI06'},()=>active);
 active=false;resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));
 assert.equal(await pending,null);
});

test('서버 assignment query는 같은 프로젝트의 exact plan fullref+task confirmed 1건만 반환한다',async()=>{
 const actor:any={actorId:projectId,clientId:assignmentRef.id,serverOwner:false,credentialGeneration:1,reauthUntil:null};
 for(const state of['MATCHED','ASSIGNMENT_NOT_FOUND','ASSIGNMENT_AMBIGUOUS','PLAN_REFERENCE_MISMATCH']){
  const db:any={query:async(sql:string,args:any[])=>{
   if(sql.startsWith('SELECT p.id,p.archived_at,m.participation'))return{rows:[{id:projectId,archived_at:null,participation:'OWNER'}]};
   if(sql.startsWith('SELECT assignment_id,version FROM anvil.assignment_versions'))return{rows:state==='MATCHED'?[{assignment_id:assignmentRef.id,version:1}]:state==='ASSIGNMENT_AMBIGUOUS'?[{assignment_id:assignmentRef.id,version:1},{assignment_id:projectId,version:1}]:[]};
   if(sql.startsWith('SELECT 1 FROM anvil.assignment_versions'))return{rows:state==='PLAN_REFERENCE_MISMATCH'?[{exists:1}]:[]};
   throw Error('unexpected '+sql);
  }};
  const store:any=new ProjectAssignmentConfirmations({current:async()=>null,read:async()=>null} as any);
  store.readContent=async()=>({projectId,ref:assignmentRef,snapshot:{draftRef,definition:{taskRef:{planRef,taskCode:'UI06'}}}});
  const value=await store.findTaskAssignment(db,actor,projectId,planRef,'UI06');
  assert.equal(value.state,state);assert.deepEqual(value.assignmentRef,state==='MATCHED'?assignmentRef:null);assert.deepEqual(value.draftRef,state==='MATCHED'?draftRef:null);
 }
 const db:any={query:async(sql:string)=>sql.startsWith('SELECT p.id,p.archived_at,m.participation')?{rows:[{id:projectId,archived_at:null,participation:'OWNER'}]}:{rows:[{assignment_id:assignmentRef.id,version:1}]}};
 const crossed:any=new ProjectAssignmentConfirmations({current:async()=>null,read:async()=>null} as any);
 crossed.readContent=async()=>({projectId,ref:assignmentRef,snapshot:{draftRef:{...draftRef,id:projectId},definition:{taskRef:{planRef,taskCode:'UI06'}}}});
 await assert.rejects(crossed.findTaskAssignment(db,actor,projectId,planRef,'UI06'),(error:any)=>error.message==='ASSIGNMENT_CONFIRMATION_INTEGRITY_FAILED');
});

test('UI06 연결의 immutable draftRef가 실제 상세 초안→확정 원문→기존 결과 목록 순서를 연다',async()=>{
 const at='2026-11-26T01:00:00.000Z',appRef={...planRef,id:'b1000000-0000-4000-8000-000000000004'},definition={taskRef:{planRef,taskCode:'UI06',applicationRef:appRef,nodeId:'검수'},purpose:'추적 근거',goal:'정확 결과 조회',baselineRefs:[],inputs:[],outputs:[],acceptanceCriteria:[],verificationRequirements:[],included:[],excluded:[],allowedScopes:[],environmentRef:null,requiredCapabilities:[],budgetRef:null,ownerRole:'검수자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'원문 연결'};
 const draftSnapshot={definition,reason:'정확 초안',previousRef:null,basis:{planRef,applicationRef:appRef,designRef:planRef,taskCode:'UI06',nodeId:'검수',taskCardHash:'e'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},exactDraftRef={id:assignmentRef.id,version:1,contentHash:contentHash(canonicalJson(draftSnapshot))},draft={projectId,ref:exactDraftRef,snapshot:draftSnapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const confirmedSnapshot={draftRef:exactDraftRef,definition,reviewRefs:[planRef],reason:'확정',confirmedBy:{kind:'HUMAN',userId:projectId},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},exactAssignmentRef={id:exactDraftRef.id,version:1,contentHash:contentHash(canonicalJson(confirmedSnapshot))},confirmed={projectId,ref:exactAssignmentRef,snapshot:confirmedSnapshot,observedAt:at};
 const decision={projectId,draftRef:exactDraftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:exactAssignmentRef,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId,assignmentRef:exactAssignmentRef,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false},page={projectId,assignmentRef:exactAssignmentRef,items:[],hasMore:false,observedAt:at,nextCursor:null,selectionState:'NOT_SELECTED'},calls:string[]=[];
 const client=new ApiClient(async input=>{const path=String(input);calls.push(path);const root=`/api/v1/projects/${projectId}/`;
  if(path===root+`assignment-drafts/${exactDraftRef.id}/versions/1`)return Response.json(draft);
  if(path===root+`assignment-drafts/${exactDraftRef.id}/versions/1/decision`)return Response.json(decision);
  if(path===root+`assignments/${exactAssignmentRef.id}/versions/1`)return Response.json(confirmed);
  if(path===root+`assignments/${exactAssignmentRef.id}/versions/1/execution-preparation-state`)return Response.json(state);
  if(path===root+`assignments/${exactAssignmentRef.id}/versions/1/result-pages`)return Response.json(page);
  throw Error('UNEXPECTED_SESSION_CHAIN '+path);
 });
 const detail=await readSessionDetail(client,projectId,exactDraftRef);assert.deepEqual(detail?.confirmed?.ref,exactAssignmentRef);
 assert.deepEqual(await readAssignmentResultPage(client,projectId,detail!.confirmed!.ref,null,()=>true),page);
 assert.deepEqual(calls.map(path=>path.replace(`/api/v1/projects/${projectId}/`,'')),[`assignment-drafts/${exactDraftRef.id}/versions/1`,`assignment-drafts/${exactDraftRef.id}/versions/1/decision`,`assignments/${exactAssignmentRef.id}/versions/1`,`assignments/${exactAssignmentRef.id}/versions/1/execution-preparation-state`,`assignments/${exactAssignmentRef.id}/versions/1/result-pages`]);
});
