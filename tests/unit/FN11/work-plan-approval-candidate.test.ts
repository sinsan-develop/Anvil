import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import type { ApprovalDetails, ApprovalScope } from '../../../apps/server/modules/approvals/approval-input.ts';
import type { ProjectCommand } from '../../../apps/server/modules/access/project-command.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333',rid='44444444-4444-4444-8444-444444444444',key='55555555-5555-4555-8555-555555555555',serverId='66666666-6666-4666-8666-666666666666';
const ref={id:rid,version:1,contentHash:'a'.repeat(64)},actor={actorId:uid,clientId:cid,serverOwner:false,credentialGeneration:1,reauthUntil:null};
const payload=()=>({documentRef:ref,designRef:{...ref,id:pid},screenReviewRefs:[],tasks:[],reason:' 원문 공백을 보존한 초안 '});
const screenTask=()=>({taskCode:'UI01',type:'SCREEN',title:'화면',purpose:'검토',designRefs:[],screenRefs:[{kind:'SCREEN_REGION',id:key,versionRef:{...ref,id:cid},localCode:'S01',anchor:'line:1'}],ownerRole:'담당',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],testCases:[],acceptanceCriteria:[],evidenceRequirements:[],rollback:'보존',recoveryNotes:'재개'});
const scope=():ApprovalScope=>({operation:'saveWorkPlanDraft',targetRef:null,expectedVersion:0,payloadHash:contentHash(canonicalJson(payload())),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1});
const details=():ApprovalDetails=>({reason:'이 정확한 입력만 저장',risks:{data:'새 초안',security:'확인',cost:'없음',interruption:'없음',unverified:'실제DB 제외'},rollback:{method:'과거 보존',limitations:'기록 삭제 아님',evidenceRefs:[]},expiresAt:'2030-01-01T00:00:00.000Z',actionScope:scope(),candidateCommandId:key});
const command=():ProjectCommand=>({schemaVersion:1 as const,projectId:pid,commandId:rid,clientId:cid,controlGeneration:1,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:details(),candidatePayload:payload()}});
async function api(){const m=await import('../../../apps/server/modules/approvals/work-plan-approval-candidate.ts').catch(()=>null);assert.ok(m,'정확한 작업계획 승인 입력을 보존하는 실제 consumer가 필요하다');return m;}
const errorCode=(code:string)=>(error:unknown)=>(error as {message?:string})?.message===code;

test('원 작업계획 입력과 hash를 보존하며 호출자가 반환값을 바꿔도 원 후보를 덮지 않는다',async()=>{
 const m=await api(),p=payload(),before=structuredClone(p),result=m.readWorkPlanApprovalPayload(p,scope().payloadHash);
 assert.deepEqual(result,before);assert.notEqual(result,p);result.reason='다른 이유';assert.deepEqual(p,before);
});
test('형식/추가필드와 같은 승인에 다른 입력을 넣는 경우를 구별해 거절한다',async()=>{
 const m=await api();
 for(const bad of [{...payload(),allow:true},{...payload(),documentRef:null},{...payload(),tasks:[{}]},{...payload(),reason:''}])assert.throws(()=>m.readWorkPlanApprovalPayload(bad,scope().payloadHash),errorCode('APPROVAL_INPUT_INVALID'));
 assert.throws(()=>m.readWorkPlanApprovalPayload({...payload(),reason:'변경된 입력'},scope().payloadHash),errorCode('APPROVAL_CANDIDATE_MISMATCH'));
});
function storage(participation='OWNER',change:Record<string,unknown>={}){
 const p=payload(),d=details(),c=command(),row={project_id:pid,request_id:rid,request_command_id:serverId,candidate_command_id:key,payload_hash:d.actionScope.payloadHash,payload_json:p,target_ref:null,created_by:uid,client_id:cid,control_generation:1,policy_ref:ref,request_key:c.commandId,request_hash:contentHash(canonicalJson(c)),request_operation:'requestApproval',request_actor:uid,request_client:cid,...change},writes:string[]=[];
 const db={query:async(sql:string,args?:unknown[])=>{assert.equal(args?.[0],pid,'모든 조회는 선택 프로젝트에 묶인다');if(sql.includes('JOIN anvil.project_members'))return{rows:[{id:pid,archived_at:null,participation}]};if(sql.startsWith('INSERT INTO anvil.work_plan_approval_candidates')){writes.push(sql);assert.deepEqual(JSON.parse(args?.[5] as string),p);return{rows:[],rowCount:1};}if(sql.includes('FROM anvil.work_plan_approval_candidates'))return{rows:[row]};throw Error('UNEXPECTED_SQL');}}as unknown as PoolClient;
 return{db,writes,p,d,c,meta:{serverCommandId:serverId,createdBy:uid,clientId:cid,controlGeneration:1,policyRef:ref,details:d}};
}
test('원 payload를 요청 영수증/정책/주체에 결박해 보관하고 고정 후보로 읽는다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),s=storage(),a=new WorkPlanApprovalCandidates();
 await a.capture(s.db,actor,{command:s.c,requestId:rid,serverCommandId:serverId,policyRef:ref,details:s.d,payload:s.p});assert.equal(s.writes.length,1);
 assert.deepEqual(await a.read(s.db,actor,pid,rid,s.meta),{candidateCommandId:key,payloadHash:scope().payloadHash,payload:payload()});
});
test('조회자나 다른 작성자에게 후보 원문을 읽어 주지 않는다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),a=new WorkPlanApprovalCandidates();
 for(const member of ['VIEWER','HANDOFF_ELIGIBLE']){const s=storage(member);await assert.rejects(a.read(s.db,actor,pid,rid,s.meta),errorCode('NOT_FOUND'));}
 const s=storage();await assert.rejects(a.read(s.db,actor,pid,rid,{...s.meta,createdBy:cid}),errorCode('NOT_FOUND'));
});
test('후보 hash/원명령 귀속 변조와 DB 오류는 원문 없는503으로 닫는다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),a=new WorkPlanApprovalCandidates();
 for(const change of [{payload_json:{...payload(),reason:'DB에서 변조'}},{request_hash:'b'.repeat(64)},{request_command_id:uid},{policy_ref:{...ref,version:2}},{request_operation:'saveWorkPlanDraft'}]){const s=storage('OWNER',change);await assert.rejects(a.read(s.db,actor,pid,rid,s.meta),errorCode('WORK_PLAN_APPROVAL_STORAGE_UNAVAILABLE'));}
 const s=storage(),db={query:async(sql:string,args:unknown[])=>{if(sql.includes('JOIN anvil.project_members'))return s.db.query(sql,args);throw Error('synthetic-private-dsn');}}as unknown as PoolClient;
 await assert.rejects(a.read(db,actor,pid,rid,s.meta),(e:unknown)=>(e as Error).message==='WORK_PLAN_APPROVAL_STORAGE_UNAVAILABLE'&&!JSON.stringify(e).includes('synthetic-private-dsn'));
});

function targetDb(mode='NORMAL'){
 const calls:string[]=[];
 const db={query:async(sql:string,args:unknown[])=>{calls.push(sql);assert.equal(args[0],pid);if(mode==='STORAGE')throw Error('synthetic-private-dsn');
  if(sql.includes('FROM anvil.documents')){const form=args[1]===rid?'AF04':args[1]===pid?'AF02':'AF03';return{rows:[{head_version:mode==='STALE_DOC'&&form==='AF04'?2:1,content_hash:ref.contentHash,form_code:form,artifact_state:mode==='SCREEN_QUARANTINED'&&form==='AF03'?'QUARANTINED':'READY'}]};}
  if(sql.includes('FROM anvil.work_plans'))return{rows:[{head_version:mode==='STALE_PLAN'?2:1,content_hash:mode==='PLAN_HASH'?'b'.repeat(64):ref.contentHash}]};
  if(sql.includes('FROM anvil.design_items'))return{rows:[]};
  if(sql.includes('FROM anvil.screen_regions')){const data={designItemId:rid,screenCode:'S01',documentRef:{...ref,id:cid},artifactRef:{artifactId:uid,bytes:1,contentHash:ref.contentHash,mediaType:'text/plain'},anchor:'line:1'};return{rows:mode==='MISSING_TRACE'?[]:[{region_json:{id:key,...data,regionHash:contentHash(canonicalJson(data))}}]};}
  if(sql.includes('FROM anvil.content_reviews')){const old={id:serverId,criteria_version:1,outcome:'ACCEPTED',items_json:[],reviewer_subject_ref:{kind:'HUMAN',userId:uid},source_kind:'HUMAN',reason:'화면 검토',created_at:new Date('2026-10-21T00:00:00Z'),server_sequence:1};return{rows:mode==='OLD_REVIEW'?[{...old,id:key,outcome:'REWORK',server_sequence:2},old]:[old]};}
  throw Error('UNEXPECTED_SQL');}}as unknown as PoolClient;return{db,calls};
}
test('신규/개정은 원문기준과 기존 전체target hash를 잠그며 진행한head를 거절한다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),a=new WorkPlanApprovalCandidates(),normal=targetDb();
 await a.assertCurrent(normal.db,pid,scope(),payload());assert(normal.calls.every(s=>s.includes('FOR SHARE')));
 await a.assertCurrent(normal.db,pid,{...scope(),targetRef:ref,expectedVersion:1},payload());
 for(const mode of ['STALE_DOC','STALE_PLAN','PLAN_HASH']){const s=targetDb(mode);await assert.rejects(a.assertCurrent(s.db,pid,{...scope(),targetRef:ref,expectedVersion:1},payload()),errorCode('APPROVAL_TARGET_CHANGED'));}
});
test('선택한 화면 원문이 격리되면 승인 기준을 정상으로 보지 않는다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),a=new WorkPlanApprovalCandidates(),p={...payload(),tasks:[screenTask()],screenReviewRefs:[{id:serverId,targetRef:{...ref,id:cid},criteriaVersion:1,outcome:'ACCEPTED'}]},s={...scope(),payloadHash:contentHash(canonicalJson(p))};
 await a.assertCurrent(targetDb().db,pid,s,p);
 await assert.rejects(a.assertCurrent(targetDb('SCREEN_QUARANTINED').db,pid,s,p),errorCode('ARTIFACT_QUARANTINED'));
});
test('현재 기준 조회도 DB 오류 원문을 노출하지 않는다',async()=>{
 const {WorkPlanApprovalCandidates}=await api();await assert.rejects(new WorkPlanApprovalCandidates().assertCurrent(targetDb('STORAGE').db,pid,scope(),payload()),errorCode('WORK_PLAN_APPROVAL_STORAGE_UNAVAILABLE'));
});
test('고정 과거 화면 검토는 기존 초안처럼 보존하며 최신 적합으로 승격하지 않는다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),p={...payload(),tasks:[screenTask()],screenReviewRefs:[{id:serverId,targetRef:{...ref,id:cid},criteriaVersion:1,outcome:'ACCEPTED'}]};
 await new WorkPlanApprovalCandidates().assertCurrent(targetDb('OLD_REVIEW').db,pid,{...scope(),payloadHash:contentHash(canonicalJson(p))},p);
});
test('업무에 없는 화면 검토·중복 검토와 설계 index에 없는 trace는 요청 전에 거절한다',async()=>{
 const {WorkPlanApprovalCandidates}=await api(),a=new WorkPlanApprovalCandidates(),review={id:serverId,targetRef:{...ref,id:cid},criteriaVersion:1,outcome:'ACCEPTED'};
 for(const p of [{...payload(),screenReviewRefs:[review]},{...payload(),tasks:[screenTask()],screenReviewRefs:[review,review]}])
  await assert.rejects(a.assertCurrent(targetDb().db,pid,{...scope(),payloadHash:contentHash(canonicalJson(p))},p),errorCode('SCREEN_REVIEW_REFERENCE_INVALID'));
 const p={...payload(),tasks:[screenTask()]};await assert.rejects(a.assertCurrent(targetDb('MISSING_TRACE').db,pid,{...scope(),payloadHash:contentHash(canonicalJson(p))},p),errorCode('NOT_FOUND'));
});
test('문제가 있는 유니코드 선행도 초안 입력으로 보존하고 JS UTF16 기준 경고를 만든다',async()=>{
 const {analyzeWorkPlanCards}=await import('../../../apps/server/modules/traceability/work-plan-card.ts');
 const task={...screenTask(),startPrerequisites:['😀'.repeat(101)]},p={...payload(),tasks:[task]};
 const m=await api();assert.deepEqual(m.readWorkPlanApprovalPayload(p,contentHash(canonicalJson(p))),p);
 assert(analyzeWorkPlanCards([task]).issues.some(i=>i.code==='DEPENDENCY_INPUT_INVALID'&&i.location==='dependencies[0]'));
 assert(!analyzeWorkPlanCards([task]).issues.some(i=>i.code==='DEPENDENCY_TASK_NOT_FOUND'));
});
