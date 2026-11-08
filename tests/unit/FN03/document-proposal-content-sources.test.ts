// 출처: FN13/project-storage-quota-writers.test.ts의 MemoryAccess/WriterAccess/MemoryFiles 및 diffFixture.
// 인증·SQL·물리 FS 포트는 메모리 모형이며 실제 RLS/SQL 함수/COMMIT/키 검증이 아니다.
import {createCheckpointRecord} from '../../../apps/server/modules/checkpoints/checkpoint-record.ts';
import {checkpointFixture} from '../FN13/checkpoint-fixture.ts';
import {ProjectCheckpoints} from '../../../apps/server/modules/checkpoints/project-checkpoints.ts';
import {ProjectCheckpointPreparation} from '../../../apps/server/modules/checkpoints/project-checkpoint-preparation.ts';
import fs,{constants as fsConstants} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {dirname,join} from 'node:path';
import {draftArtifactFixture,draftId} from '../../support/draft-artifact-fixture.ts';
import {DraftArtifacts} from '../../../apps/server/modules/projects/draft-artifacts.ts';
import {ProjectsRepository} from '../../../apps/server/modules/projects/repository.ts';
import {registerProjectRoutes} from '../../../apps/server/modules/projects/routes.ts';
import type {TestContext} from 'node:test';
import Fastify from 'fastify';
import {resolve} from 'node:path';
import {ArtifactStore} from '../../../apps/server/storage/artifact-store.ts';
import {registerProjectFileRoutes} from '../../../apps/server/modules/documents/project-files.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {ProjectStorageQuota,quotaBytes,type QuotaPart} from '../../../apps/server/modules/projects/project-storage-quota.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
const h=(v:unknown)=>contentHash(canonicalJson(v));
const request=():ProjectCommand=>({schemaVersion:1,projectId:id(1),commandId:id(2),clientId:id(3),controlGeneration:1,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{bytes:5,contentHash:h('body'),mediaType:'application/octet-stream'}});
const part=():QuotaPart=>({key:'body',kind:'ARTIFACT',id:id(4),bytes:'5',contentHash:h('body'),reservedBytes:'10',settledBytes:'5'});
const actor:AuthenticatedIdentity={actorId:id(5),clientId:id(3),serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(6),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
const policyRef={id:id(7),version:1,contentHash:''};
const rules=[{ruleId:'storage',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['uploadArtifact','proposeDocumentChange','saveCheckpoint','saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:id(1)}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
const policy={rules,reason:'합성 정책',reviewRefs:[]};policyRef.contentHash=h(policy);
type Row=Record<string,any>;
/** 실제 인증은 대역이다. BEGIN/COMMIT/ROLLBACK 상태와 COMMIT 응답 유실을 별도로 모사한다. */
class MemoryAccess extends AccessRepository{
 state:{account:Row|null;rows:Row[];proof:Row|null}={account:{coverage_state:'VERIFIED',generation:'1',used_bytes:'0',held_bytes:'0'},rows:[],proof:null};
 identity=structuredClone(actor);lostOn:string|null=null;checkpoint:Row|null=null;commits=0;expireAfterReserve=false;lostCommit=false;deny=false;now=new Date('2026-10-31T00:00:00.000Z');trace:string[]=[];serial:Promise<unknown>=Promise.resolve();
 constructor(){super({} as never,{installationId:id(9),key:Buffer.alloc(32)});}
 override async authenticated<T>(_token:string,_csrf:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>):Promise<T>{
  const previous=this.serial;let done!:()=>void;this.serial=new Promise<void>(r=>done=r);await previous;
  const before=structuredClone(this.state);this.trace.push('BEGIN');
  try{const v=await body(this.db(),this.identity);this.commits++;this.trace.push('COMMIT');if(this.lostCommit){this.lostCommit=false;throw Error('COMMIT_REPLY_LOST');}return v;}
  catch(e){if(this.trace.at(-1)!=='COMMIT')this.state=before;this.trace.push('ROLLBACK');throw e;}finally{done();}
 }
 db(){return {query:async(sql:string,args:unknown[]=[])=>{this.trace.push(sql);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return {rows:this.deny?[]:[{id:id(1),archived_at:null,participation:'OWNER'}]};
  if(sql.includes('FROM anvil.project_control'))return {rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies p JOIN'))return {rows:[{id:policyRef.id,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:new Date('2026-01-01Z')}]};
  if(sql.includes('clock_timestamp()'))return {rows:[{at:new Date(this.now)}]};
  if(sql.includes('FROM anvil.commands WHERE scope_kind'))return {rows:[]};
  if(sql.includes('FROM anvil.checkpoint_records'))return {rows:this.checkpoint?[structuredClone(this.checkpoint)]:[]};
  if(sql.includes('quota_existing')){const q=JSON.parse(args[4] as string),r=this.state.rows.find(r=>r.external_command_id===q.commandId&&r.actor_id===actor.actorId);if(!r)return {rows:[{value:null}]};if(r.command_hash!==h(q)||r.client_id!==q.clientId)throw new AuthFailure('IDEMPOTENCY_CONFLICT',409);if(r.phase!=='RESERVED')throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);return {rows:[{value:structuredClone(r.plan_json)}]};}
  if(sql.includes('quota_account'))return {rows:this.state.account?[structuredClone(this.state.account)]:[]};
  if(sql.includes('quota_reserve')){
   const p=JSON.parse(args[4] as string),a=this.state.account;if(!a||a.coverage_state!=='VERIFIED')throw new AuthFailure('PROJECT_STORAGE_QUOTA_UNVERIFIED',412);
   const found=this.state.rows.filter(r=>r.external_command_id===p.request.commandId&&r.actor_id===actor.actorId);
   if(found.length){if(found[0]!.command_hash!==p.commandHash||found[0]!.plan_hash!==p.planHash||found[0]!.client_id!==p.request.clientId)throw new AuthFailure('IDEMPOTENCY_CONFLICT',409);return {rows:[{value:structuredClone(found)}]};}
   const total=p.parts.reduce((v:bigint,x:QuotaPart)=>v+BigInt(x.reservedBytes),0n);if(BigInt(a.used_bytes)+BigInt(a.held_bytes)+total>10737418240n)throw new AuthFailure('PROJECT_STORAGE_LIMIT_EXCEEDED',429);
   const rows=p.parts.map((x:QuotaPart,i:number)=>({id:id(100+this.state.rows.length+i),project_id:p.request.projectId,actor_id:actor.actorId,client_id:actor.clientId,external_command_id:p.request.commandId,operation:p.request.operation,command_hash:p.commandHash,part_key:x.key,part_kind:x.kind,plan_json:p,plan_hash:p.planHash,reserved_bytes:x.reservedBytes,settled_bytes:'0',phase:'RESERVED',start_fence:'0',generation:a.generation,authorized_until:p.authorizedUntil}));
   a.held_bytes=(BigInt(a.held_bytes)+total).toString();this.state.rows.push(...rows);if(this.expireAfterReserve)this.now=new Date('2100-01-01Z');return {rows:[{value:structuredClone(rows)}]};
  }
  if(sql.includes('quota_start')){const p=JSON.parse(args[4] as string);const rows=this.state.rows.filter(r=>p.ids.includes(r.id));if(rows.length!==p.ids.length||rows.some(r=>r.phase!=='RESERVED'||r.generation!==this.state.account?.generation))throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);for(const r of rows){r.phase='IO_STARTED';r.start_fence='1';}return {rows:[{value:structuredClone(rows)}]};}
  if(sql.includes('quota_require_started')){const p=JSON.parse(args[4] as string),rs=this.state.rows.filter(r=>p.ids.includes(r.id));if(rs.length!==p.ids.length||rs.some(r=>r.phase!=='IO_STARTED'||r.start_fence!=='1'||r.generation!==this.state.account?.generation))throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);return {rows:[{value:true}]};}
  if(sql.includes('quota_reserve')&&this.lostOn==='RESERVE'||sql.includes('quota_start')&&this.lostOn==='START'){this.lostCommit=true;this.lostOn=null;}
  if(sql.includes('quota_settle')){const p=JSON.parse(args[4] as string);if(!this.state.proof||h(p.facts)!==h(this.state.proof))throw new AuthFailure('PROJECT_STORAGE_QUOTA_INTEGRITY_FAILED',503);const a=this.state.account!;for(const r of this.state.rows.filter(r=>p.ids.includes(r.id))){const x=r.plan_json.parts.find((x:QuotaPart)=>x.key===r.part_key);a.held_bytes=(BigInt(a.held_bytes)-BigInt(r.reserved_bytes)).toString();a.used_bytes=(BigInt(a.used_bytes)+BigInt(x.settledBytes)).toString();r.phase='SETTLED';r.settled_bytes=x.settledBytes;}return {rows:[{value:true}]};}
  throw Error('UNMODELED_QUERY:'+sql);
 }} as unknown as PoolClient;}
}

/** 인증/SQL/물리파일은 메모리 대역, handler·원 receipt producer·quota class는 실제 구현을 호출한다. */
class WriterAccess extends MemoryAccess{
 replayGapHook:(()=>void)|null=null;replayGapArmed=false;replayGapMutations=0;onExisting:(()=>void)|null=null;requireApproval=false;requests:Row[]=[];decisions:Row[]=[];consumptions:Row[]=[];checkpointRows:Row[]=[];headVersion=1;afterStartCommit:(()=>void|Promise<void>)|null=null;documentRow:Row|null=null;form:Row|null=null;commands:Row[]=[];receipts:Row[]=[];audits:Row[]=[];artifacts:Row[]=[];proposals:Row[]=[];failArtifactInsert=false;failSettle=false;
 override async authenticated<T>(token:string,csrf:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){
  if(this.replayGapArmed){this.replayGapArmed=false;this.replayGapMutations++;this.replayGapHook?.();}
  const before=structuredClone({commands:this.commands,receipts:this.receipts,audits:this.audits,artifacts:this.artifacts,proposals:this.proposals,requests:this.requests,decisions:this.decisions,consumptions:this.consumptions,checkpointRows:this.checkpointRows}),n=this.commits;
  try{const traceAt=this.trace.length;const value=await super.authenticated(token,csrf,body);if(this.replayGapHook&&this.trace.slice(traceAt).some(q=>q.startsWith('SELECT * FROM anvil.document_proposals')))this.replayGapArmed=true;if(this.trace.slice(traceAt).some(q=>q.includes('quota_start'))){const hook=this.afterStartCommit;this.afterStartCommit=null;await hook?.();}return value;}catch(e){if(n===this.commits)Object.assign(this,before);throw e;}
 }
 seedApproval(c:ProjectCommand){
  this.requireApproval=true;const at=new Date(this.now),currentRules=rules.map(r=>({...r,disposition:'REQUIRE_APPROVAL'})),pRef={...policyRef,contentHash:h({...policy,rules:currentRules})};
  const scope={operation:c.operation,targetRef:c.targetId===null?null:c.payload.baseRef,expectedVersion:c.expectedVersion,payloadHash:h(c.payload),baselineRefs:c.baselineRefs,environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1};
  const details={reason:'정확 원명령 승인',risks:{data:'자료',security:'권한',cost:'한도',interruption:'중단',unverified:'미검증'},rollback:{method:'보존',limitations:'실제 원복 미검증',evidenceRefs:[]},expiresAt:'2098-01-01T00:00:00.000Z',actionScope:scope,candidateCommandId:c.commandId};
  const snapshot={projectId:c.projectId,details,scopeDigest:h(scope),requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef:pRef,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1},requestRef={id:id(70),version:1,contentHash:h(snapshot)},requestJson={id:requestRef.id,version:1,status:'PENDING',...snapshot,createdAt:at.toISOString()};
  const decisionBody={requestId:requestRef.id,requestVersion:1,requestRef,scopeDigest:h(scope),decision:'APPROVE',reason:'별도 명시 승인',decidedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1,policyRef:pRef},decisionRef={id:id(71),version:1,contentHash:h(decisionBody)},decisionJson={id:decisionRef.id,...decisionBody,decidedAt:at.toISOString()};
  const seed=(sid:string,original:ProjectCommand,ref:Row,data:Row)=>{const receiptId=sid===id(72)?id(74):id(75),operationId=sid===id(72)?id(76):id(77),digest=h({projectId:c.projectId,actorId:actor.actorId,clientId:actor.clientId,controlGeneration:1,requestHash:h(original),policyRef:pRef,targetRef:ref}),result={operationId,commandId:original.commandId,projectId:c.projectId,status:'APPLIED',targetId:ref.id,version:1,data:{ref,...data},evidenceRefs:[],warnings:[],serverReceivedAt:at.toISOString()};this.commands.push({id:sid,project_id:c.projectId,actor_id:actor.actorId,client_id:actor.clientId,operation:original.operation,command_id:original.commandId,request_hash:h(original),operation_id:operationId,state:'APPLIED',authorization_receipt_id:receiptId,approval_consumption_id:null,expected_version:original.expectedVersion,control_generation:1,policy_ref:pRef,payload_ref:null,result_ref:result});this.receipts.push({id:receiptId,project_id:c.projectId,command_id:sid,subject_ref:snapshot.requestedBy,policy_ref:pRef,scope_digest:digest,approval_decision_ref:null});this.audits.push({project_id:c.projectId,command_id:sid,operation_id:operationId,target_ref:ref,scope_digest:digest,source_kind:'HUMAN_COMMAND',outcome:'APPLIED',actor_ref:{kind:'HUMAN',userId:actor.actorId},client_ref:actor.clientId,policy_ref:pRef});};
  seed(id(72),{...c,commandId:id(78),operation:'requestApproval',targetId:null,expectedVersion:0,approvalRef:null,payload:{details}},requestRef,{status:'APPROVAL_REQUESTED',request:requestJson});
  seed(id(73),{...c,commandId:id(79),operation:'decideApproval',targetId:requestRef.id,expectedVersion:1,approvalRef:null,payload:{requestId:requestRef.id,expectedVersion:1,scopeDigest:h(scope),decision:'APPROVE',reason:decisionBody.reason}},decisionRef,{status:'APPROVAL_DECIDED',decision:decisionJson});
  this.requests.push({id:requestRef.id,project_id:c.projectId,version:2,candidate_command_id:c.commandId,action_scope_json:scope,scope_digest:h(scope),details_json:details,required_decider_ref:snapshot.requiredDecider,status:'APPROVED',expires_at:new Date(details.expiresAt),created_by:actor.actorId,client_id:actor.clientId,command_id:id(72),policy_ref:pRef,content_hash:requestRef.contentHash,request_json:requestJson,created_at:at});
  this.decisions.push({id:decisionRef.id,project_id:c.projectId,request_id:requestRef.id,request_version:1,scope_digest:h(scope),decision:'APPROVE',reason:decisionBody.reason,decided_by:actor.actorId,client_id:actor.clientId,control_generation:1,decided_at:at,command_id:id(73),content_hash:decisionRef.contentHash,decision_json:decisionJson});
  return {requestId:requestRef.id,decisionId:decisionRef.id,scopeDigest:h(scope)};
 }
 override db(){const base=super.db();return {query:async(sql:string,args:unknown[]=[])=>{
  if(sql==='SELECT id FROM anvil.projects WHERE id=$1 FOR UPDATE')return {rows:[{id:args[0]}]};
  if(sql.startsWith('SELECT v.id,v.content_hash FROM anvil.checkpoint_records'))return {rows:this.checkpointRows.filter(r=>r.project_id===args[0]&&r.assignment_id===args[1]&&r.assignment_version===args[2]&&r.assignment_hash===args[3]).slice(-1).map(r=>({id:r.id,content_hash:r.content_hash}))};
  if(sql.startsWith('SELECT count(*)::text AS count'))return {rows:[{count:String(this.checkpointRows.length),bytes:String(this.checkpointRows.reduce((n,r)=>n+Buffer.byteLength(canonicalJson(r.snapshot_json))+Buffer.byteLength(r.record_text),0))}]};
  if(sql.startsWith('INSERT INTO anvil.checkpoint_records')){this.checkpointRows.push({project_id:args[0],id:args[1],assignment_id:args[2],assignment_version:args[3],assignment_hash:args[4],previous_id:args[5],previous_hash:args[6],content_hash:args[7],snapshot_json:JSON.parse(args[8] as string),record_text:args[9],created_by:args[10],client_id:args[11],command_id:args[12],created_at:new Date(args[13] as string)});if(this.lostOn==='OPERATE'){this.lostCommit=true;this.lostOn=null;}return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT id,content_hash,snapshot_json,record_text FROM anvil.checkpoint_records'))return {rows:this.checkpointRows.filter(r=>r.project_id===args[0]&&r.command_id===args[1])};
  if(sql.includes('FROM anvil.checkpoint_records v')&&sql.includes('WHERE v.project_id=$1 AND v.id=$2'))return {rows:this.checkpointRows.filter(r=>r.project_id===args[0]&&r.id===args[1]).map(r=>{const c=this.commands.find(c=>c.id===r.command_id),a=this.receipts.find(a=>a.id===c?.authorization_receipt_id),audit=this.audits.filter(a=>a.command_id===c?.id&&a.scope_digest===this.receipts.find(a=>a.id===c?.authorization_receipt_id)?.scope_digest);return {...structuredClone(r),actor_id:c?.actor_id,command_client_id:c?.client_id,original_command_id:c?.command_id,source_operation_id:c?.operation_id,operation:c?.operation,state:c?.state,expected_version:c?.expected_version,control_generation:c?.control_generation,request_hash:c?.request_hash,policy_ref:c?.policy_ref,authorization_receipt_id:c?.authorization_receipt_id,result_ref:c?.result_ref,receipt_subject:a?.subject_ref,receipt_policy_ref:a?.policy_ref,scope_digest:a?.scope_digest,approval_decision_ref:a?.approval_decision_ref,audit_count:audit.length,server_sequence:String(this.audits.indexOf(audit[0]!)+1),chain_count:this.checkpointRows.filter(x=>x.assignment_id===r.assignment_id&&x.previous_id===r.previous_id).length};})};
  if(this.requireApproval&&sql.includes('FROM anvil.permission_policies p JOIN')){const currentRules=rules.map(r=>({...r,disposition:'REQUIRE_APPROVAL'}));return {rows:[{id:policyRef.id,head_version:1,rules_json:currentRules,content_hash:h({...policy,rules:currentRules}),reason:policy.reason,review_refs:[],created_at:new Date('2026-01-01Z')}]};}
  if(sql.includes('FROM anvil.approval_requests r JOIN anvil.commands'))return {rows:this.requests.filter(r=>r.project_id===args[0]&&r.id===args[1]).map(r=>{const c=this.commands.find(c=>c.id===r.command_id)!;return {...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,result_ref:c.result_ref};})};
  if(sql.includes('FROM anvil.approval_decisions d JOIN anvil.commands'))return {rows:this.decisions.filter(r=>r.project_id===args[0]&&r.request_id===args[1]).map(r=>{const c=this.commands.find(c=>c.id===r.command_id)!;return {...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,expected_version:c.expected_version,result_ref:c.result_ref};})};
  if(sql.includes('FROM anvil.approval_consumptions ac JOIN anvil.commands'))return {rows:this.consumptions.filter(r=>r.project_id===args[0]&&r.decision_id===args[1]).map(r=>{const c=this.commands.find(c=>c.id===r.command_id)!,a=this.receipts.find(a=>a.id===c.authorization_receipt_id)!;return {...r,candidate_command_id:c.command_id,request_hash:c.request_hash,actor_id:c.actor_id,client_id:c.client_id,control_generation:c.control_generation,policy_ref:c.policy_ref,payload_ref:c.payload_ref,state:c.state,result_ref:c.result_ref,operation:c.operation,expected_version:c.expected_version,approval_consumption_id:c.approval_consumption_id,approval_decision_ref:a.approval_decision_ref};})};
  if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){this.trace.push(sql);assert(!this.consumptions.some(r=>r.decision_id===args[2]));this.consumptions.push({id:args[0],project_id:args[1],decision_id:args[2],command_id:args[3],scope_digest:args[4],policy_id:args[5],policy_version:args[6],consumed_at:new Date(this.now)});return {rows:[],rowCount:1};}
  if(sql.startsWith("UPDATE anvil.approval_requests SET status='CONSUMED'")){const r=this.requests.find(r=>r.project_id===args[0]&&r.id===args[1]&&r.status==='APPROVED'&&r.version===2);if(!r)return {rows:[],rowCount:0};r.status='CONSUMED';r.version=3;return {rows:[],rowCount:1};}
  if(sql.includes('quota_existing')){
   const hook=this.onExisting;this.onExisting=null;hook?.();
   const q=JSON.parse(args[4] as string),cmd=this.commands.find(c=>c.project_id===args[3]&&c.actor_id===args[1]&&c.command_id===q.commandId);
   if(cmd){const rs=this.state.rows.filter(r=>r.external_command_id===q.commandId&&r.actor_id===args[1]);if(!rs.length&&this.state.account?.coverage_state!=='VERIFIED')return {rows:[{value:null}]};const r=rs[0],p=r?.plan_json.parts[0],ar=this.receipts.find(a=>a.id===cmd.authorization_receipt_id),b=p?.kind==='CHECKPOINT'?this.checkpointRows.find(b=>b.id===p?.id&&b.command_id===cmd.id):this.artifacts.find(b=>b.id===p?.id&&b.command_id===cmd.id);const {planHash,...body}=r?.plan_json??{};
    if(rs.length!==1||!r||r.phase!=='SETTLED'||r.command_hash!==h(q)||cmd.request_hash!==h(q)||r.server_command_id!==cmd.id||!ar||ar.scope_digest!==r.scope_digest||!b||(p.kind==='CHECKPOINT'?b.snapshot_json.preparedHash!==p.contentHash||b.content_hash!==h(b.snapshot_json)||String(Buffer.byteLength(canonicalJson(b.snapshot_json))+Buffer.byteLength(b.record_text))!==p.bytes:b.content_hash!==p.contentHash||String(b.bytes)!==p.bytes)||r.plan_hash!==h(body)||planHash!==r.plan_hash||h(cmd.policy_ref)!==h(r.plan_json.policyRef)||r.reserved_bytes!==p.reservedBytes||r.settled_bytes!==p.settledBytes)throw new AuthFailure('PROJECT_STORAGE_QUOTA_INTEGRITY_FAILED',503);
    return {rows:[{value:{replay:true}}]};
   }
  }
  if(sql.startsWith('SELECT * FROM anvil.document_proposals')){this.trace.push(sql);return {rows:this.proposals.filter(r=>r.project_id===args[0]&&r.id===args[1])};}
  if(sql.includes('FROM anvil.document_proposal_selections'))return {rows:[]};
  if(sql.includes('FROM anvil.document_versions v JOIN anvil.documents'))return {rows:this.documentRow?[structuredClone(this.documentRow)]:[]};
  if(sql.includes('SELECT head_version FROM anvil.documents'))return {rows:this.documentRow?[{head_version:this.headVersion}]:[]};
  if(sql.includes('SELECT definition_json FROM anvil.form_versions'))return {rows:this.form?[{definition_json:structuredClone(this.form)}]:[]};
  if(sql.includes('FROM anvil.content_reviews')||sql.includes('FROM anvil.document_version_events')||sql.includes('FROM anvil.document_import_selections')||sql.includes('SELECT p.id FROM anvil.document_proposals'))return {rows:[]};
  if(sql.startsWith('INSERT INTO anvil.document_proposals')){this.proposals.push({id:args[0],project_id:args[1],document_id:args[2],base_version:args[3],base_hash:args[4],body_artifact_id:args[5],diff_artifact_id:args[6],content_json:JSON.parse(args[7] as string),proposal_json:JSON.parse(args[8] as string),content_hash:args[9],reason:args[10],created_by:args[11],client_id:args[12],command_id:args[13],created_at:new Date(this.now)});return {rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.commands WHERE scope_kind')){this.trace.push(sql);return {rows:this.commands.filter(r=>r.project_id===args[0]&&r.actor_id===args[1]&&r.command_id===args[2]).map(r=>({operation:r.operation,request_hash:r.request_hash,result_ref:r.result_ref}))};}
  if(sql.startsWith('INSERT INTO anvil.commands')){this.trace.push(sql);this.commands.push({id:args[0],project_id:args[1],actor_id:args[2],client_id:args[3],operation:args[4],command_id:args[5],request_hash:args[6],operation_id:args[7],state:'APPLIED',authorization_receipt_id:args[8],approval_consumption_id:args[9],expected_version:args[10],control_generation:args[11],policy_ref:args[12]===null?null:JSON.parse(args[12] as string),payload_ref:args[13]===null?null:JSON.parse(args[13] as string),result_ref:JSON.parse(args[14] as string)});return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){this.trace.push(sql);this.receipts.push({id:args[0],project_id:args[1],command_id:args[2],subject_ref:JSON.parse(args[3] as string),policy_ref:JSON.parse(args[4] as string),scope_digest:args[5],approval_decision_ref:args[6]});return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){this.audits.push({project_id:args[0],event_id:args[1],actor_ref:JSON.parse(args[2] as string),client_ref:args[3],target_ref:JSON.parse(args[4] as string),outcome:'DENIED',source_kind:'SERVER_DENIAL',reason_code:args[5]});return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){this.trace.push(sql);this.audits.push({project_id:args[0],actor_ref:JSON.parse(args[2] as string),client_ref:args[3],command_id:args[4],operation_id:args[5],target_ref:JSON.parse(args[6] as string),policy_ref:JSON.parse(args[7] as string),scope_digest:args[10],source_kind:'HUMAN_COMMAND',outcome:'APPLIED'});return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.artifacts')){this.trace.push(sql);if(this.failArtifactInsert)throw Error('SIMULATED_DB_WRITE_FAILURE');if(this.lostOn==='OPERATE'){this.lostCommit=true;this.lostOn=null;}const upload=sql.includes('inspection_json');this.artifacts.push({id:args[0],project_id:args[1],bytes:args[2],content_hash:args[3],media_type:args[4],storage_key:args[5],state:upload?args[6]:'READY',created_by:args[upload?7:6],client_id:args[upload?8:7],command_id:args[upload?9:8],inspection_json:upload?JSON.parse(args[10] as string):null});return {rows:[],rowCount:1};}
  if(sql.includes('SELECT * FROM anvil.artifacts WHERE id=')){this.trace.push(sql);return {rows:this.artifacts.filter(r=>r.id===args[0]&&r.project_id===args[1]&&(args.length===2||r.content_hash===args[2]&&Number(r.bytes)===args[3]&&r.media_type===args[4]))};}
  if(sql.includes('transaction_timestamp()')){this.trace.push(sql);return {rows:[{at:new Date(this.now)}]};}
  if(sql.includes('set_config(')){this.trace.push(sql);return {rows:[]};}
  if(sql.includes('quota_reserve')&&this.lostOn==='RESERVE'||sql.includes('quota_start')&&this.lostOn==='START'){this.lostCommit=true;this.lostOn=null;}
  if(sql.includes('quota_settle')){
   if(this.failSettle)throw Error('SIMULATED_SETTLE_FAILURE');const payload=JSON.parse(args[4] as string),facts=payload.facts,c=this.commands.find(r=>r.id===facts.serverCommandId),receipt=this.receipts.find(r=>r.id===facts.authorizationReceiptId&&r.command_id===c?.id),reservation=this.state.rows.find(r=>payload.ids.includes(r.id)),part=reservation?.plan_json.parts[0],artifact=part?.kind==='CHECKPOINT'?this.checkpointRows.find(r=>r.id===part?.id&&r.command_id===c?.id):this.artifacts.find(r=>r.id===part?.id&&r.command_id===c?.id);
   assert(c&&receipt&&reservation&&artifact,'원 명령/receipt/자료 모두 필요');assert.equal(c.request_hash,reservation.command_hash);assert.equal(receipt.scope_digest,facts.scopeDigest);if(part.kind==='CHECKPOINT'){assert.equal(artifact.snapshot_json.preparedHash,part.contentHash);assert.equal(artifact.content_hash,h(artifact.snapshot_json));assert.equal(String(Buffer.byteLength(canonicalJson(artifact.snapshot_json))+Buffer.byteLength(artifact.record_text)),part.bytes);}else{assert.equal(artifact.content_hash,part.contentHash);assert.equal(String(artifact.bytes),part.bytes);}assert.equal(this.audits.filter(r=>r.command_id===c.id&&r.scope_digest===receipt.scope_digest).length,1);this.state.proof=facts;reservation.server_command_id=facts.serverCommandId;reservation.authorization_receipt_id=facts.authorizationReceiptId;reservation.scope_digest=facts.scopeDigest;
  }
  return base.query(sql,args);
 }} as unknown as PoolClient;}
}
class MemoryFiles{
 bodies=new Map<string,Buffer>();staging=new Map<string,Buffer>();putCount=0;readCount=0;verifyCount=0;failClose=false;failReclaim=false;afterPut:(()=>void)|null=null;trace:string[];
 readonly access:WriterAccess;constructor(access:WriterAccess){this.access=access;this.trace=access.trace;}
 async put(pid:string,aid:string,bytes:Buffer){this.putCount++;this.trace.push('FS_PUT');this.staging.set(aid,Buffer.from(bytes));this.bodies.set(aid,Buffer.from(bytes));if(this.failClose)throw Error('CLOSE_UNKNOWN');if(!this.failReclaim)this.staging.delete(aid);this.afterPut?.();return `blobs/${pid}/${aid}`;}
 async read(_pid:string,aid:string,expected:{bytes:number;contentHash:string}){this.readCount++;const b=this.bodies.get(aid);assert(b);assert.equal(b.length,expected.bytes);assert.equal(contentHash(b),expected.contentHash);return Buffer.from(b);}
 async verifyPublished(pid:string,aid:string,expected:{bytes:number;contentHash:string}){this.verifyCount++;await this.read(pid,aid,expected);if(this.staging.has(aid))throw Error('STAGING_REMAINS');}
}
async function uploadFixture(t:TestContext){
 const access=new SourceWriterAccess(),files=new MemoryFiles(access);t.mock.method(ArtifactStore.prototype,'put',files.put.bind(files));t.mock.method(ArtifactStore.prototype,'read',files.read.bind(files));
 if('verifyPublished' in ArtifactStore.prototype)t.mock.method(ArtifactStore.prototype,'verifyPublished' as 'read',files.verifyPublished.bind(files) as never);
 const app=Fastify();let captured:unknown;app.addHook('preHandler',async req=>{captured=req.body;});registerProjectRoutes(app,{repository:access,origin:'https://anvil.synthetic.invalid',artifactRoot:resolve('never-created-memory-store')});registerProjectFileRoutes(app,{repository:access,origin:'https://anvil.synthetic.invalid',artifactRoot:resolve('never-created-memory-store')});await app.ready();
 t.after(async()=>{await app.close();});
 const upload=async(bytes=Buffer.from('정상 원문'),commandId=id(2),approvalRef:unknown=null)=>{
  const c=request();c.commandId=commandId;c.approvalRef=approvalRef;c.payload={bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'};
  return app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/files`,headers:{host:'anvil.synthetic.invalid',origin:'https://anvil.synthetic.invalid','content-type':'application/octet-stream','x-anvil-command':canonicalJson(c),'x-anvil-csrf':'c'.repeat(43),cookie:'__Host-anvil.sid='+'t'.repeat(43)},payload:bytes});
 };return {app,access,files,upload,mutateCaptured:(fn:(body:any)=>void)=>fn(captured),getCaptured:()=>captured};
}
async function diffFixture(t:TestContext){
 const f=await uploadFixture(t),before=await f.upload(Buffer.from('기존 문서\n'),id(11)),after=await f.upload(Buffer.from('변경 문서\n'),id(12));assert.equal(before.statusCode,201,before.body);assert.equal(after.statusCode,201,after.body);
 const oldRef=before.json().data.artifactRef,newRef=after.json().data.artifactRef;
 const form={formCode:'SYNTHETIC',name:'합성 양식',purpose:'검증',scope:'SYSTEM',authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'확정자',requiredInputs:[],items:[],authoringStandardRef:{id:id(50),version:1,contentHash:h('표준')}};
 f.access.form=form;const formRef={id:id(51),version:1,contentHash:h(form)},content={body:oldRef,attachments:[],sections:[],sourceRefs:[]},documentId=id(52),baseHash=h({title:'원문',formRef,stageNodeRef:null,content});
 f.access.documentRow={document_id:documentId,version:1,title:'원문',form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,content_json:content,content_hash:baseHash,stage_ref_json:null,source_refs_json:[],author_ref_json:{kind:'HUMAN',userId:actor.actorId},created_at:new Date('2026-01-01Z'),confirmed_version:null,validation_json:{}};
 const c=request();c.commandId=id(53);c.operation='proposeDocumentChange';c.targetId=documentId;c.expectedVersion=1;c.payload={baseRef:{id:documentId,version:1,contentHash:baseHash},proposedContent:{body:newRef,attachments:[],sections:[],sourceRefs:[]},reason:'실제 diff 생성',sourceRefs:[]};
 const propose=()=>f.app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/commands`,headers:{host:'anvil.synthetic.invalid',origin:'https://anvil.synthetic.invalid','content-type':'application/json','x-anvil-csrf':'c'.repeat(43),cookie:'__Host-anvil.sid='+'t'.repeat(43)},payload:c});return {...f,c,propose};
}

class SourceWriterAccess extends WriterAccess{
 sourceDocuments=new Map<string,Row>();sourceMessages=new Map<string,Row>();selections:Row[]=[];
 override async authenticated<T>(token:string,csrf:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){
  const before=structuredClone({documents:[...this.sourceDocuments],messages:[...this.sourceMessages],selections:this.selections,head:this.headVersion}),commits=this.commits;
  try{return await super.authenticated(token,csrf,body);}catch(e){if(this.commits===commits){this.sourceDocuments=new Map(before.documents);this.sourceMessages=new Map(before.messages);this.selections=before.selections;this.headVersion=before.head;}throw e;}
 }
 override db(){const parent=super.db();return {query:async(sql:string,args:unknown[]=[])=>{
  if(sql.startsWith('SELECT v.definition_json,v.content_hash FROM anvil.form_definitions')){assert.deepEqual(args,[this.documentRow!.form_definition_id,1,actor.actorId]);return {rows:[{definition_json:this.form,content_hash:this.documentRow!.form_hash}]};}
  if(sql.startsWith('SELECT v.*,d.confirmed_version')){assert.equal(args.length,3);assert.equal(args[0],id(1));const row=this.sourceDocuments.get(String(args[1])+':'+args[2])??(args[1]===this.documentRow?.document_id&&Number(args[2])===Number(this.documentRow?.version)?this.documentRow:null);return {rows:row&&row.project_id===args[0]?[structuredClone(row)]:[]};}
  if(sql==="SELECT bytes,media_type,content_hash FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND state='READY'"){assert.equal(args.length,2);const row=this.artifacts.find(r=>r.id===args[1]&&r.project_id===args[0]&&r.state==='READY');this.trace.push(sql);return {rows:row?[structuredClone(row)]:[]};}
  if(sql==='SELECT conversation_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2'){assert.equal(args.length,2);const row=this.sourceMessages.get(String(args[1]));this.trace.push(sql);return {rows:row&&row.project_id===args[0]?[{conversation_id:row.conversation_id}]:[]};}
  if(sql==='SELECT * FROM anvil.conversation_messages WHERE project_id=$1 AND conversation_id=$2 AND id=$3'){assert.equal(args.length,3);const row=this.sourceMessages.get(String(args[2]));this.trace.push(sql);return {rows:row&&row.project_id===args[0]&&row.conversation_id===args[1]?[structuredClone(row)]:[]};}
  if(sql==='SELECT * FROM anvil.documents WHERE id=$1 AND project_id=$2 FOR UPDATE'){assert.deepEqual(args,[this.documentRow!.document_id,id(1)]);return {rows:[{head_version:this.headVersion}]};}
  if(sql.startsWith('SELECT title,form_definition_id,form_version,form_hash,content_hash,stage_ref_json FROM anvil.document_versions')){assert.deepEqual(args,[id(1),this.documentRow!.document_id,1]);return {rows:[structuredClone(this.documentRow)]};}
  if(sql.startsWith('INSERT INTO anvil.document_versions(')){
   assert.equal(args.length,18);assert.equal(args[0],id(1));this.trace.push(sql);const content=JSON.parse(args[9] as string);this.sourceDocuments.set(String(args[1])+':'+args[2],{project_id:args[0],document_id:args[1],version:args[2],form_definition_id:args[3],form_version:args[4],form_hash:args[5],title:args[7],source_refs_json:JSON.parse(args[8] as string),content_json:content,content_hash:args[10],sections_json:JSON.parse(args[11] as string),author_ref_json:JSON.parse(args[12] as string),validation_json:JSON.parse(args[13] as string),stage_ref_json:args[17]===null?null:JSON.parse(args[17] as string),created_at:new Date(this.now),confirmed_version:null});return {rows:[],rowCount:1};
  }
  if(sql.startsWith('UPDATE anvil.documents SET title=')){this.headVersion=Number(args[2]);this.trace.push(sql);return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.document_artifact_links')||sql.startsWith('INSERT INTO anvil.document_version_events')){assert.equal(args[sql.includes('document_version_events')?1:0],id(1));this.trace.push(sql);return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.document_proposal_selections')){assert.equal(args.length,8);this.selections.push({project_id:args[1],proposal_id:args[2],document_id:args[3],version:args[4],created_by:args[5],created_at:new Date(this.now)});this.trace.push(sql);return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT document_id,version,created_at,created_by FROM anvil.document_proposal_selections')){assert.equal(args.length,2);return {rows:this.selections.filter(r=>r.project_id===args[0]&&r.proposal_id===args[1]).map(r=>structuredClone(r))};}
  return parent.query(sql,args);
 }} as unknown as PoolClient;}
}
async function sourceFixture(t:TestContext){
 const f=await diffFixture(t),row=f.access.documentRow!;row.project_id=id(1);
 const oldRef=row.content_json.body,sourceRow=structuredClone(row);sourceRow.document_id=id(61);sourceRow.title='정확 과거 출처';sourceRow.content_hash=h({title:sourceRow.title,formRef:{id:row.form_definition_id,version:1,contentHash:row.form_hash},stageNodeRef:null,content:sourceRow.content_json});f.access.sourceDocuments.set(id(61)+':1',sourceRow);
 const message=(n:number,kind:string)=>{const snapshot={conversationId:id(62),targetRoleRef:null,message:{kind,bodyRef:oldRef,attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:id(1),stageRefs:[],taskRefs:[]}},sourceRefs:[],serverSequence:n,authorRef:{kind:'HUMAN',userId:actor.actorId}},hash=h(snapshot);
  f.access.sourceMessages.set(id(n),{project_id:id(1),conversation_id:id(62),sequence:n,message_json:snapshot,author_ref:snapshot.authorRef,kind,body_artifact_id:oldRef.artifactId,reply_to:null,supersedes_instruction_id:null,effective_scope:snapshot.message.effectiveScope,source_refs:[],content_hash:hash,redaction_state:'NOT_REDACTED',recorded_at:new Date(f.access.now)});return {kind:kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION',id:id(n),contentHash:hash};};
 const refs=[{kind:'DOCUMENT_VERSION',id:id(61),version:1,contentHash:sourceRow.content_hash},{kind:'ARTIFACT',id:oldRef.artifactId,contentHash:oldRef.contentHash},message(63,'USER_MESSAGE'),message(64,'USER_INSTRUCTION')];
 (f.c.payload.proposedContent as Row).sourceRefs=structuredClone(refs);
 const get=(path:string)=>f.app.inject({method:'GET',url:`/api/v1/projects/${id(1)}/${path}`,headers:{host:'anvil.synthetic.invalid',cookie:'__Host-anvil.sid='+'t'.repeat(43)}});
 return {...f,refs,get};
}
test('실 quota/private plan을 거친 4종 제안은 실제 diff/저장행/보호 GET에 출처를 보존한다',async t=>{
 const f=await sourceFixture(t),before=f.access.state.rows.length,puts=f.files.putCount;
 const response=await f.propose();assert.equal(response.statusCode,200,response.body);const p=response.json().data.proposal;
 assert.equal(f.access.state.rows.length,before+1);const r=f.access.state.rows.at(-1)!;assert.equal(r.phase,'SETTLED');assert.equal(f.files.putCount,puts+1);
 const bytes=f.files.bodies.get(p.diffRef.artifactId)!;assert.equal(r.reserved_bytes,String(bytes.length*2));assert.equal(r.settled_bytes,String(bytes.length));assert.deepEqual(JSON.parse(bytes.toString()).afterContent.sourceRefs,f.refs);
 const read=await f.get('proposals/'+p.id);assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().proposedContent.sourceRefs,f.refs);assert.deepEqual(f.access.proposals[0]!.content_json.sourceRefs,f.refs);
});

const headers={host:'anvil.synthetic.invalid',origin:'https://anvil.synthetic.invalid','content-type':'application/json','x-anvil-csrf':'c'.repeat(43),cookie:'__Host-anvil.sid='+'t'.repeat(43)};
function application(f:Awaited<ReturnType<typeof sourceFixture>>,proposalId:string,content:Row):ProjectCommand{
 const row=f.access.documentRow!;return {...f.c,commandId:id(54),operation:'saveDocumentDraft',payload:{title:row.title,formRef:{id:row.form_definition_id,version:1,contentHash:row.form_hash},stageNodeRef:null,content:structuredClone(content),importCandidateRef:null,proposalRef:proposalId,reason:'정확 제안 명시 반영'}};
}
test('제안 명시선택은 sourceRefs exact content를 저장하고 고정 문서 GET/원 replay를 보존한다',async t=>{
 const f=await sourceFixture(t),first=await f.propose();assert.equal(first.statusCode,200,first.body);const p=first.json().data.proposal,detail=await f.get('proposals/'+p.id);assert.equal(detail.statusCode,200,detail.body);
 const before={r:f.access.state.rows.length,put:f.files.putCount,used:f.access.state.account!.used_bytes},again=await f.propose();assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),first.json());assert.deepEqual({r:f.access.state.rows.length,put:f.files.putCount,used:f.access.state.account!.used_bytes},before);
 const c=application(f,p.id,detail.json().proposedContent);
 const missing=structuredClone(c);(missing.payload.content as Row).sourceRefs=[];
 const denied=await f.app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/commands`,headers,payload:missing});assert.equal(denied.statusCode,409,denied.body);assert.equal(f.access.selections.length,0);
 const saved=await f.app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/commands`,headers,payload:c});assert.equal(saved.statusCode,200,saved.body);const ref=saved.json().data.ref;
 assert.equal(ref.version,2);const read=await f.get(`documents/${ref.id}/versions/2`);assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().content.sourceRefs,f.refs);assert.deepEqual(read.json().sourceRefs,f.refs);assert.equal(read.json().contentHash,ref.contentHash);assert.equal(f.access.selections.length,1);
 const replay=await f.app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/commands`,headers,payload:c});assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),saved.json());assert.equal(f.access.selections.length,1);assert.deepEqual({r:f.access.state.rows.length,put:f.files.putCount,used:f.access.state.account!.used_bytes},before);
 const duplicate=structuredClone(c);duplicate.commandId=id(92);const second=await f.app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/commands`,headers,payload:duplicate});assert.equal(second.statusCode,409,second.body);assert.equal(f.access.selections.length,1);
 const stale=structuredClone(f.c);stale.commandId=id(93);const oldBase=await f.app.inject({method:'POST',url:`/api/v1/projects/${id(1)}/commands`,headers,payload:stale});assert.equal(oldBase.statusCode,409,oldBase.body);assert.deepEqual({r:f.access.state.rows.length,put:f.files.putCount,used:f.access.state.account!.used_bytes},before);
});
test('원문은 같고 proposed 출처만 달라도 실제 diff/기존2B/B로 보존한다',async t=>{
 const f=await sourceFixture(t);(f.c.payload.proposedContent as Row).body=structuredClone(f.access.documentRow!.content_json.body);
 const before=BigInt(f.access.state.account!.used_bytes),result=await f.propose();assert.equal(result.statusCode,200,result.body);const r=f.access.state.rows.at(-1)!,p=result.json().data.proposal,bytes=f.files.bodies.get(p.diffRef.artifactId)!;
 assert.deepEqual(JSON.parse(bytes.toString()).before,[]);assert.deepEqual(JSON.parse(bytes.toString()).after,[]);assert.deepEqual(JSON.parse(bytes.toString()).afterContent.sourceRefs,f.refs);
 assert.equal(r.reserved_bytes,String(bytes.length*2));assert.equal(r.settled_bytes,String(bytes.length));assert.equal(BigInt(f.access.state.account!.used_bytes)-before,BigInt(bytes.length));
});
test('최상위 출처412·잘못된 proposed형상·주체/지시/귀속/hash·격리는 예약/put0이다',async t=>{
 for(const mode of ['top','shape','kind','project','hash','quarantine'] as const){
  const f=await sourceFixture(t),before=f.access.state.rows.length,puts=f.files.putCount;
  if(mode==='top')f.c.payload.sourceRefs=structuredClone(f.refs);
  if(mode==='shape')(f.c.payload.proposedContent as Row).sourceRefs=[{...f.refs[0],verified:true}];
  if(mode==='kind'){const r=f.access.sourceMessages.get(id(64))!;r.kind=r.message_json.message.kind='USER_MESSAGE';r.content_hash=h(r.message_json);(f.c.payload.proposedContent as Row).sourceRefs=[{kind:'USER_INSTRUCTION',id:id(64),contentHash:r.content_hash}];}
  if(mode==='project')f.access.sourceMessages.get(id(64))!.project_id=id(999);
  if(mode==='hash')(f.c.payload.proposedContent as Row).sourceRefs=[{...f.refs[0],contentHash:'f'.repeat(64)}];
  if(mode==='quarantine')f.access.artifacts.find(r=>r.id===(f.refs[1] as Row).id)!.state='QUARANTINED';
  const r=await f.propose();assert.equal(r.statusCode,{top:412,shape:422,kind:422,project:404,hash:409,quarantine:412}[mode],r.body);assert.equal(f.access.state.rows.length,before);assert.equal(f.files.putCount,puts);assert.equal(f.access.proposals.length,0);
 }
});
test('start 뒤 proposed 출처회수는 publish0·원R 보존이며 정산실패는 원장/도메인 rollback이다',async t=>{
 for(const mode of ['source','settle'] as const){const f=await sourceFixture(t),puts=f.files.putCount,commands=f.access.commands.length;
  if(mode==='source')f.access.afterStartCommit=()=>{f.access.sourceMessages.get(id(64))!.redaction_state='REDACTED';};else f.access.failSettle=true;
  const r=await f.propose();assert.equal(r.statusCode,503,r.body);assert.equal(f.access.proposals.length,0);assert.equal(f.access.commands.length,commands);assert.equal(f.access.state.rows.at(-1)!.phase,'IO_STARTED');assert.equal(f.files.putCount,puts+(mode==='settle'?1:0));assert.equal(f.access.state.account!.held_bytes,f.access.state.rows.at(-1)!.reserved_bytes);
 }
});
test('proposal GET은 저장 refs형상/원출처손상을 다시 읽고 위조 writing계획은 quota를 우회하지 못한다',async t=>{
 const f=await sourceFixture(t),made=await f.propose();assert.equal(made.statusCode,200,made.body);const p=made.json().data.proposal;
 f.access.sourceMessages.get(id(64))!.redaction_state='REDACTED';const denied=await f.get('proposals/'+p.id);assert.equal(denied.statusCode,503,denied.body);
 f.access.sourceMessages.get(id(64))!.redaction_state='NOT_REDACTED';const row=f.access.proposals[0]!;row.content_json.sourceRefs=[{kind:'ARTIFACT',id:id(100)}];row.content_hash=h({proposal:row.proposal_json,content:row.content_json,reason:row.reason});const bad=await f.get('proposals/'+p.id);assert.equal(bad.statusCode,503,bad.body);
 const docs=new ProjectDocuments(resolve('never-created-memory-store'));await assert.rejects(docs.propose(f.access.db(),actor,f.c,policyRef),{message:'PROJECT_STORAGE_QUOTA_UNVERIFIED',statusCode:412});
});

function seedBudgetSources(f:Awaited<ReturnType<typeof sourceFixture>>){
 // 이미 보관된 자료의 메모리 SQL/FS 행이다. 과거 upload producer 실행을 주장하지 않는다.
 const old=f.access.documentRow!.content_json.body,stored=f.access.artifacts.find(a=>a.id===old.artifactId)!,bytes=f.files.bodies.get(old.artifactId)!;
 return Array.from({length:200},(_,n)=>{const aid=id(1000+n);f.access.artifacts.push({...stored,id:aid,storage_key:`blobs/${id(1)}/${aid}`});f.files.bodies.set(aid,Buffer.from(bytes));f.access.state.account!.used_bytes=(BigInt(f.access.state.account!.used_bytes)+BigInt(bytes.length)).toString();return {kind:'ARTIFACT',id:aid,contentHash:old.contentHash};});
}
test('base200과 proposed200은 phase당400으로 독립 검산하며 proposed 전이201은 예약0이다',async t=>{
 const good=await sourceFixture(t),refs=seedBudgetSources(good),row=good.access.documentRow!;
 row.content_json.sourceRefs=structuredClone(refs);row.source_refs_json=structuredClone(refs);row.content_hash=h({title:row.title,formRef:{id:row.form_definition_id,version:1,contentHash:row.form_hash},stageNodeRef:null,content:row.content_json});(good.c.payload.baseRef as Row).contentHash=row.content_hash;(good.c.payload.proposedContent as Row).sourceRefs=structuredClone(refs);
 const start=good.access.trace.length,result=await good.propose();assert.equal(result.statusCode,200,result.body);
 const reads=good.access.trace.slice(start).filter(q=>q==="SELECT bytes,media_type,content_hash FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND state='READY'").length;
 assert.equal(reads,800,'두 phase에서 각각 base200/proposed200을 실제 다시 읽는다');
 const bad=await sourceFixture(t),many=seedBudgetSources(bad),child=bad.access.sourceDocuments.get(id(61)+':1')!;
 child.content_json.sourceRefs=many;child.source_refs_json=many;child.content_hash=h({title:child.title,formRef:{id:child.form_definition_id,version:1,contentHash:child.form_hash},stageNodeRef:null,content:child.content_json});(bad.c.payload.proposedContent as Row).sourceRefs=[{kind:'DOCUMENT_VERSION',id:id(61),version:1,contentHash:child.content_hash}];
 const reservations=bad.access.state.rows.length,puts=bad.files.putCount,denied=await bad.propose();assert.equal(denied.statusCode,422,denied.body);assert.match(denied.body,/DOCUMENT_SOURCE_BUDGET_EXCEEDED/);assert.equal(bad.access.state.rows.length,reservations);assert.equal(bad.files.putCount,puts);
});
test('await 중 원입력변이는 원 sources/hash를 바꾸지 않고 reserve 응답불명은 같은packet으로만 재개한다',async t=>{
 const f=await sourceFixture(t),expected=structuredClone(f.refs);
 f.access.onExisting=()=>f.mutateCaptured((body:ProjectCommand)=>{(body.payload.proposedContent as Row).sourceRefs=[];});
 const r=await f.propose();assert.equal(r.statusCode,200,r.body);assert.deepEqual(f.access.proposals[0]!.content_json.sourceRefs,expected);assert.equal(f.access.commands.find(c=>c.command_id===f.c.commandId)!.request_hash,h(f.c));
 const lost=await sourceFixture(t),puts=lost.files.putCount;lost.access.lostOn='RESERVE';const first=await lost.propose();assert.equal(first.statusCode,503,first.body);assert.equal(lost.files.putCount,puts);const reservation=structuredClone(lost.access.state.rows.at(-1));assert.ok(reservation);assert.equal(reservation.phase,'RESERVED');
 const second=await lost.propose();assert.equal(second.statusCode,200,second.body);assert.equal(lost.access.state.rows.at(-1)!.id,reservation.id);assert.equal(lost.access.state.rows.at(-1)!.plan_hash,reservation.plan_hash);assert.equal(lost.access.state.rows.at(-1)!.authorized_until,reservation.authorized_until);assert.equal(lost.files.putCount,puts+1);
});
