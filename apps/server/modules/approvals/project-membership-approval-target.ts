import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readMembershipCommand,readMembershipCandidate,type MembershipCandidate} from '../../../../contracts/runtime/project-membership-v1.ts';
import {copyControlData} from '../control-handoff/control-grant.ts';
import {membershipManager,membershipBase,readMembershipVersion} from '../projects/project-memberships.ts';
import {assertApprovalCandidate,type ApprovalDetails} from './approval-input.ts';
function fail():never{throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export function membershipCommandFromScope(actor:Pick<AuthenticatedIdentity,'actorId'|'clientId'>,pid:string,details:Pick<ApprovalDetails,'candidateCommandId'|'actionScope'>,payload:unknown){
 try{const d=copyControlData(details),s=d.actionScope,c=readMembershipCommand({schemaVersion:1,projectId:pid,commandId:d.candidateCommandId,clientId:actor.clientId,controlGeneration:s.controlGeneration,operation:'saveProjectMembership',targetId:s.targetRef?.id??null,expectedVersion:s.expectedVersion,baselineRefs:[],approvalRef:null,payload:copyControlData(payload)});
 if(s.operation!==c.operation||s.requestedSubjectRef.kind!=='HUMAN'||s.requestedSubjectRef.userId!==actor.actorId||s.requestedSubjectRef.clientId!==actor.clientId||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||s.payloadHash!==contentHash(canonicalJson(c.payload)))fail();return c;
 }catch{fail();}
}
export async function createMembershipApprovalCandidate(db:PoolClient,actor:AuthenticatedIdentity,pid:string,details:ApprovalDetails,payload:unknown):Promise<MembershipCandidate>{
 const command=membershipCommandFromScope(actor,pid,details,payload),prepared=await membershipBase(db,actor,command),candidate=readMembershipCandidate({schemaVersion:1,purpose:'PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE',command,baseMembership:prepared.base});
 if(!same(details.actionScope.targetRef,prepared.base.kind==='NEW'?null:prepared.base.ref))fail();return candidate;
}
/** 고정 과거 원문과 당시 version을 검산한다. 현재 head로 바꾸지 않는다. */
export async function readStoredMembershipCandidate(db:PoolClient,actor:AuthenticatedIdentity,pid:string,details:ApprovalDetails,value:unknown){
 await membershipManager(db,actor,pid);let candidate:MembershipCandidate;try{candidate=readMembershipCandidate(copyControlData(value));}catch{fail();}
 if(!same(details.actionScope.targetRef,candidate.baseMembership.kind==='NEW'?null:candidate.baseMembership.ref))fail();
 const c=candidate.command;if(c.projectId!==pid||!same(c,membershipCommandFromScope({actorId:details.actionScope.requestedSubjectRef.userId,clientId:details.actionScope.requestedSubjectRef.clientId},pid,details,c.payload)))fail();assertApprovalCandidate(details,c,details.actionScope.requestedSubjectRef.userId,pid);
 if(candidate.baseMembership.kind==='EXISTING'){const b=candidate.baseMembership,original=await readMembershipVersion(db,pid,b.ref.id,b.ref.version);if(!same(original.ref,b.ref)||original.snapshot.participation!==b.participation||original.snapshot.revokedAt!==null)fail();}
 else if(details.actionScope.targetRef!==null)fail();return candidate;
}
export async function assertCurrentMembershipCandidate(db:PoolClient,actor:AuthenticatedIdentity,pid:string,details:ApprovalDetails,value:unknown){
 const candidate=await readStoredMembershipCandidate(db,actor,pid,details,value),prepared=await membershipBase(db,actor,candidate.command);if(!same(candidate.baseMembership,prepared.base))fail();return candidate;
}

/** 과거 원문 검산 뒤, 아직 결정/소비하지 않은 후보의 현재 base만 분류한다. DB장애는 숨기지 않는다. */
export async function membershipCandidateCurrent(db:PoolClient,actor:AuthenticatedIdentity,candidate:MembershipCandidate){
 try{const current=await membershipBase(db,actor,candidate.command);return same(current.base,candidate.baseMembership);}
 catch(e){if(e instanceof AuthFailure&&['VERSION_CONFLICT','MEMBERSHIP_ALREADY_EXISTS','MEMBERSHIP_REVOKED','MEMBERSHIP_TARGET_UNAVAILABLE','CURRENT_OWNER_HANDOFF_REQUIRED','LAST_PROJECT_OWNER_REQUIRED','CONTROL_GENERATION_CONFLICT'].includes(e.message))return false;throw e;}
}

/** 요청 원문은 request hash/receipt/exact audit 물리행에서도 다시 결박한다. */
export async function verifyMembershipApprovalRequest(db:PoolClient,pid:string,row:Record<string,any>,candidate:MembershipCandidate){
 const rows=(await db.query(`SELECT c.command_id request_key,c.request_hash,c.expected_version,c.control_generation,c.operation_id,c.policy_ref,c.state,ar.command_id receipt_command,ar.subject_ref,ar.policy_ref receipt_policy,ar.scope_digest,ar.approval_decision_ref,
 (SELECT jsonb_agg(jsonb_build_object('actorRef',a.actor_ref,'clientRef',a.client_ref,'operationId',a.operation_id,'targetRef',a.target_ref,'policyRef',a.policy_ref,'approvalRef',a.approval_ref,'scopeDigest',a.scope_digest,'outcome',a.outcome,'reasonCode',a.reason_code,'sourceKind',a.source_kind)) FROM anvil.audit_events a WHERE a.project_id=c.project_id AND a.command_id=c.id) audit_rows
 FROM anvil.commands c JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id WHERE c.project_id=$1 AND c.id=$2 AND c.scope_kind='PROJECT' AND c.scope_id=c.project_id AND c.operation='requestApproval' AND c.actor_id=$3 AND c.client_id=$4`,[pid,row.command_id,row.created_by,row.client_id])).rows;
 if(rows.length!==1)throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);const r=rows[0],command={schemaVersion:1,projectId:pid,commandId:r.request_key,clientId:row.client_id,controlGeneration:row.request_json.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:row.details_json,candidatePayload:candidate.command.payload}},requestHash=contentHash(canonicalJson(command)),targetRef={id:row.id,version:1,contentHash:row.content_hash},scope=contentHash(canonicalJson({projectId:pid,actorId:row.created_by,clientId:row.client_id,controlGeneration:command.controlGeneration,requestHash,policyRef:row.policy_ref,targetRef}));
 if(r.state!=='APPLIED'||Number(r.expected_version)!==0||Number(r.control_generation)!==command.controlGeneration||r.request_hash!==requestHash||r.receipt_command!==row.command_id||!same(r.policy_ref,row.policy_ref)||!same(r.receipt_policy,row.policy_ref)||r.scope_digest!==scope||r.approval_decision_ref!==null||!same(r.subject_ref,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})||!Array.isArray(r.audit_rows)||r.audit_rows.length!==1||!same(r.audit_rows[0],{actorRef:{kind:'HUMAN',userId:row.created_by},clientRef:row.client_id,operationId:r.operation_id,targetRef,policyRef:row.policy_ref,approvalRef:null,scopeDigest:scope,outcome:'APPLIED',reasonCode:'EXPLICIT_ONE_TIME_APPROVAL_REQUEST',sourceKind:'HUMAN_COMMAND'}))throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
}
