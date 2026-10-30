import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,type ProjectCommand} from '../access/project-command.ts';
import {readUnderstandingReviewCommand} from '../executions/execution-understanding.ts';
import type {ApprovalDetails,ApprovalScope} from './approval-input.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),H=(v:unknown)=>contentHash(canonicalJson(v));
const fail=()=>new AuthFailure('UNDERSTANDING_APPROVAL_INTEGRITY_FAILED',503);
export interface UnderstandingApprovalMeta{serverCommandId:string;createdBy:string;clientId:string;controlGeneration:number;policyRef:VersionRef;details:ApprovalDetails}
/** 문법/비밀 보호만 검산한다. 현재 응답·6기준 검사는 원 이해검토 command가 수행한다. */
export function readUnderstandingReviewApprovalCandidate(value:unknown,expectedHash:string):ProjectCommand{
 let c:ProjectCommand;try{c=readUnderstandingReviewCommand(value);}catch{throw new AuthFailure('APPROVAL_INPUT_INVALID',422);}
 if(c.approvalRef!==null||H(c.payload)!==expectedHash)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);return c;
}
export class UnderstandingReviewApprovalCandidates{
 async assertCurrent(db:PoolClient,actor:AuthenticatedIdentity,pid:string,s:ApprovalScope,value:unknown){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);
  const c=readUnderstandingReviewApprovalCandidate(value,s.payloadHash);
  if(s.operation!=='reviewUnderstanding'||s.targetRef!==null||s.expectedVersion<1||s.expectedVersion!==c.expectedVersion||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||c.projectId!==pid||c.clientId!==actor.clientId||s.requestedSubjectRef.userId!==actor.actorId||s.requestedSubjectRef.clientId!==c.clientId||s.controlGeneration!==c.controlGeneration)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);return c;
 }
 async capture(db:PoolClient,actor:AuthenticatedIdentity,i:{command:ProjectCommand;requestId:string;serverCommandId:string;policyRef:VersionRef;details:ApprovalDetails;payload:unknown}){
  const c=i.command,d=i.details,original=await this.assertCurrent(db,actor,c.projectId,d.actionScope,i.payload);
  if(c.operation!=='requestApproval'||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null||c.baselineRefs.length||c.clientId!==actor.clientId||c.controlGeneration!==original.controlGeneration||d.candidateCommandId!==original.commandId||!same(c.payload,{details:d,candidatePayload:original}))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  await db.query('INSERT INTO anvil.understanding_review_approval_candidates(project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,command_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[c.projectId,i.requestId,i.serverCommandId,original.commandId,H(original.payload),JSON.stringify(original),actor.actorId,actor.clientId,original.controlGeneration,JSON.stringify(i.policyRef),H(original)]);
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,meta:UnderstandingApprovalMeta){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||meta.createdBy!==actor.actorId)throw new AuthFailure('NOT_FOUND',404);
  try{const rows=(await db.query('SELECT b.*,c.command_id request_key,c.request_hash,c.operation request_operation,c.actor_id request_actor,c.client_id request_client FROM anvil.understanding_review_approval_candidates b JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.request_command_id WHERE b.project_id=$1 AND b.request_id=$2',[pid,id])).rows;if(rows.length!==1)throw Error();const b=rows[0],d=meta.details,s=d.actionScope,original=readUnderstandingReviewApprovalCandidate(b.payload_json,s.payloadHash);
   if(s.operation!=='reviewUnderstanding'||s.targetRef!==null||s.expectedVersion!==original.expectedVersion||s.expectedVersion<1||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||b.project_id!==pid||b.request_id!==id||b.request_command_id!==meta.serverCommandId||b.candidate_command_id!==d.candidateCommandId||b.candidate_command_id!==original.commandId||b.payload_hash!==s.payloadHash||b.command_hash!==H(original)||original.projectId!==pid||original.clientId!==meta.clientId||original.controlGeneration!==meta.controlGeneration||b.created_by!==meta.createdBy||b.client_id!==meta.clientId||Number(b.control_generation)!==meta.controlGeneration||!same(b.policy_ref,meta.policyRef)||b.request_operation!=='requestApproval'||b.request_actor!==meta.createdBy||b.request_client!==meta.clientId||s.requestedSubjectRef.userId!==meta.createdBy||s.requestedSubjectRef.clientId!==meta.clientId||s.controlGeneration!==meta.controlGeneration)throw Error();
   const request={schemaVersion:1,projectId:pid,commandId:b.request_key,clientId:meta.clientId,controlGeneration:meta.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:d,candidatePayload:original}};if(b.request_hash!==H(request))throw Error();return{candidateCommandId:original.commandId,payloadHash:H(original.payload),originalCommandHash:H(original),command:original};
  }catch{throw fail();}
 }
}

/** 같은 인증 transaction의 보관 행만 검산한다. 현재 승인 적격성은 재판정하지 않는다. */
function storedAt(value:unknown,expected:unknown){
 if(typeof expected!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expected)||!Number.isFinite(Date.parse(expected))||new Date(expected).toISOString()!==expected)return false;
 if(value instanceof Date)return Number.isFinite(value.getTime())&&value.toISOString()===expected;
 if(typeof value!=='string')return false;const match=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);return !!match&&!/[1-9]/.test((match[1]??'').slice(3))&&Date.parse(value)===Date.parse(expected);
}
export function assertStoredUnderstandingApproval(row:any,entry:{ref:VersionRef;snapshot:any}){
 try{const s=entry.snapshot,c=s.request,approval=c.approvalRef;
  if(approval===null){if(row.approval_consumption_id!=null||row.payload_ref!=null||row.approval_decision_ref!=null||row.audit_approval_ref!=null||[row.approval_request_row,row.approval_decision_row,row.approval_consumption_row,row.approval_candidate_row,row.approval_request_command,row.approval_decision_command].some(v=>v!=null))throw Error();return;}
  const r=row.approval_request_row,d=row.approval_decision_row,used=row.approval_consumption_row,b=row.approval_candidate_row,rc=row.approval_request_command,dc=row.approval_decision_command;
  if(!r||!d||!used||!b||!rc||!dc||r.project_id!==row.project_id||r.id!==approval.requestId||r.status!=='CONSUMED'||Number(r.version)!==3||r.created_by!==s.reviewer.userId||r.client_id!==c.clientId||r.candidate_command_id!==c.commandId||r.scope_digest!==approval.scopeDigest||!same(r.policy_ref,s.policyRef)||!same(r.action_scope_json,r.details_json.actionScope)||H(r.action_scope_json)!==r.scope_digest)throw Error();
  const details=r.details_json,original=readUnderstandingReviewApprovalCandidate(b.payload_json,details.actionScope.payloadHash),scope=details.actionScope;
  if(scope.operation!=='reviewUnderstanding'||scope.targetRef!==null||scope.expectedVersion!==c.expectedVersion||scope.controlGeneration!==c.controlGeneration||!same(scope.requestedSubjectRef,{kind:'HUMAN',userId:s.reviewer.userId,clientId:c.clientId})||scope.baselineRefs.length||scope.environmentRef!==null||scope.sourceScopes.length||scope.limitsRef!==null||!same(original,{...c,approvalRef:null})||b.project_id!==row.project_id||b.request_id!==r.id||b.request_command_id!==r.command_id||b.candidate_command_id!==c.commandId||b.command_hash!==H(original)||b.payload_hash!==H(c.payload)||b.created_by!==s.reviewer.userId||b.client_id!==c.clientId||Number(b.control_generation)!==c.controlGeneration||!same(b.policy_ref,s.policyRef))throw Error();
  const request={schemaVersion:1,projectId:row.project_id,commandId:rc.command_id,clientId:c.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details,candidatePayload:original}},requestSnapshot={projectId:row.project_id,details,scopeDigest:r.scope_digest,requiredDecider:{kind:'HUMAN',userId:s.reviewer.userId},policyRef:s.policyRef,requestedBy:{kind:'HUMAN',userId:s.reviewer.userId,clientId:c.clientId},controlGeneration:c.controlGeneration};
  const {id:_rid,version:_version,status:_status,createdAt:_at,...savedRequest}=r.request_json;
  if(_rid!==r.id||_version!==1||_status!=='PENDING'||!storedAt(r.created_at,_at)||!same(r.required_decider_ref,{kind:'HUMAN',userId:s.reviewer.userId}))throw Error();
  if(!same(savedRequest,requestSnapshot)||H(requestSnapshot)!==r.content_hash||rc.project_id!==row.project_id||rc.id!==r.command_id||rc.operation!=='requestApproval'||rc.state!=='APPLIED'||rc.actor_id!==s.reviewer.userId||rc.client_id!==c.clientId||rc.request_hash!==H(request)||rc.result_ref?.data?.status!=='APPROVAL_REQUESTED'||!same(rc.result_ref.data.request,r.request_json))throw Error();
  const {id:_did,decidedAt:_dat,...decisionSnapshot}=d.decision_json;
  if(_did!==d.id||!storedAt(d.decided_at,_dat))throw Error();
  if(d.project_id!==row.project_id||d.id!==approval.decisionId||d.request_id!==r.id||Number(d.request_version)!==1||d.decision!=='APPROVE'||d.scope_digest!==approval.scopeDigest||d.decided_by!==s.reviewer.userId||d.client_id!==c.clientId||Number(d.control_generation)!==c.controlGeneration||d.content_hash!==H(decisionSnapshot)||!same(decisionSnapshot,{requestId:r.id,requestVersion:1,requestRef:{id:r.id,version:1,contentHash:r.content_hash},scopeDigest:approval.scopeDigest,decision:'APPROVE',reason:d.reason,decidedBy:{kind:'HUMAN',userId:s.reviewer.userId,clientId:c.clientId},controlGeneration:c.controlGeneration,policyRef:s.policyRef})||dc.id!==d.command_id||dc.project_id!==row.project_id||dc.operation!=='decideApproval'||dc.state!=='APPLIED'||dc.actor_id!==s.reviewer.userId||dc.client_id!==c.clientId||!same(dc.result_ref?.data?.decision,d.decision_json))throw Error();
  const decisionCommand={schemaVersion:1,projectId:row.project_id,commandId:dc.command_id,clientId:c.clientId,controlGeneration:c.controlGeneration,operation:'decideApproval',targetId:r.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{requestId:r.id,expectedVersion:1,scopeDigest:approval.scopeDigest,decision:'APPROVE',reason:d.reason}};
  if(dc.request_hash!==H(decisionCommand)||used.id!==row.approval_consumption_id||used.project_id!==row.project_id||used.decision_id!==approval.decisionId||used.command_id!==row.command_id||used.scope_digest!==approval.scopeDigest||used.policy_id!==s.policyRef.id||Number(used.policy_version)!==s.policyRef.version||row.approval_decision_ref!==approval.decisionId||!same(row.audit_approval_ref,approval)||!same(row.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:H(c.payload),scopeDigest:approval.scopeDigest}))throw Error();
 }catch{throw fail();}
}
