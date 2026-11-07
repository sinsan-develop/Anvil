import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {ApprovalDetails,ApprovalScope} from './approval-input.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';

import {readBackupPolicyPayload,backupPolicyCandidateProjection,assertBackupPolicyStorageCapacity,type BackupPolicyPayload} from '../backups/backup-policy-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const unavailable=()=>new AuthFailure('BACKUP_POLICY_APPROVAL_INTEGRITY_FAILED',503);
export interface BackupPolicyApprovalMeta{serverCommandId:string;createdBy:string;clientId:string;controlGeneration:number;policyRef:VersionRef;details:ApprovalDetails}
export function readBackupPolicyApprovalPayload(value:unknown,expectedHash:string):BackupPolicyPayload{
 let payload:BackupPolicyPayload;try{payload=readBackupPolicyPayload(value);}catch{throw new AuthFailure('APPROVAL_INPUT_INVALID',422);}
 if(!/^[a-f0-9]{64}$/.test(expectedHash)||contentHash(canonicalJson(payload))!==expectedHash)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
 return payload;
}
/** 수동 정책 후보 보관이다. 전체 coverage/키 가용성이나 백업 실행을 승인하지 않는다. */
export class BackupPolicyApprovalCandidates{
 async assertCurrent(db:PoolClient,actor:AuthenticatedIdentity,pid:string,s:ApprovalScope,value:unknown){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);
  const payload=readBackupPolicyApprovalPayload(value,s.payloadHash);
  if(s.operation!=='saveBackupPolicy'||!same(s.targetRef,payload.previousRef)||s.expectedVersion!==(payload.previousRef?.version??0)||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  // 네 보호 참조·전체 coverage·한도·head CAS는 정책 저장의 같은 Tx에서 별도로 재검사한다.
  return payload;
 }
 async capture(db:PoolClient,actor:AuthenticatedIdentity,input:{command:ProjectCommand;requestId:string;serverCommandId:string;policyRef:VersionRef;details:ApprovalDetails;payload:unknown}){
  const {command:c,details:d}=input,payload=await this.assertCurrent(db,actor,c.projectId,d.actionScope,input.payload);
  if(c.operation!=='requestApproval'||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null||c.baselineRefs.length||c.clientId!==actor.clientId||d.actionScope.requestedSubjectRef.kind!=='HUMAN'||d.actionScope.requestedSubjectRef.userId!==actor.actorId||d.actionScope.requestedSubjectRef.clientId!==actor.clientId||d.actionScope.controlGeneration!==c.controlGeneration||!same(c.payload,{details:d,candidatePayload:payload}))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  const projection=backupPolicyCandidateProjection({projectId:c.projectId,requestId:input.requestId,requestCommandId:input.serverCommandId,candidateCommandId:d.candidateCommandId,payloadHash:d.actionScope.payloadHash,payload,createdBy:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,policyRef:input.policyRef});await assertBackupPolicyStorageCapacity(db,c.projectId,[projection]);
  try{await db.query('INSERT INTO anvil.backup_policy_approval_candidates(project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,projection_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[c.projectId,input.requestId,input.serverCommandId,d.candidateCommandId,d.actionScope.payloadHash,JSON.stringify(payload),actor.actorId,actor.clientId,c.controlGeneration,JSON.stringify(input.policyRef),JSON.stringify(projection)]);}catch{throw unavailable();}
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,meta:BackupPolicyApprovalMeta){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||meta.createdBy!==actor.actorId)throw new AuthFailure('NOT_FOUND',404);
  return this.#stored(db,pid,id,meta);
 }
 /** 정책 OWNER가 이미 보호한 과거 소비 증빙 전용이다. 공개 후보 조회의 작성자 보호는 유지한다. */
 async readPolicyHistory(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,meta:BackupPolicyApprovalMeta){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);
  return this.#stored(db,pid,id,meta);
 }
 async #stored(db:PoolClient,pid:string,id:string,meta:BackupPolicyApprovalMeta){
  try{
   const rows=(await db.query('SELECT b.*,c.command_id request_key,c.request_hash,c.operation request_operation,c.actor_id request_actor,c.client_id request_client FROM anvil.backup_policy_approval_candidates b JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.request_command_id WHERE b.project_id=$1 AND b.request_id=$2',[pid,id])).rows;
   if(rows.length!==1)throw Error();const b=rows[0],d=meta.details,s=d.actionScope,payload=readBackupPolicyApprovalPayload(b.payload_json,b.payload_hash);
   if(s.operation!=='saveBackupPolicy'||!same(s.targetRef,payload.previousRef)||s.expectedVersion!==(payload.previousRef?.version??0)||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||b.project_id!==pid||b.request_id!==id||b.request_command_id!==meta.serverCommandId||b.candidate_command_id!==d.candidateCommandId||b.payload_hash!==s.payloadHash||b.created_by!==meta.createdBy||b.client_id!==meta.clientId||Number(b.control_generation)!==meta.controlGeneration||!same(b.policy_ref,meta.policyRef)||b.request_operation!=='requestApproval'||b.request_actor!==meta.createdBy||b.request_client!==meta.clientId)throw Error();

   if(!same(b.projection_json,backupPolicyCandidateProjection({projectId:pid,requestId:id,requestCommandId:meta.serverCommandId,candidateCommandId:d.candidateCommandId,payloadHash:s.payloadHash,payload,createdBy:meta.createdBy,clientId:meta.clientId,controlGeneration:meta.controlGeneration,policyRef:meta.policyRef})))throw Error();
   const original={schemaVersion:1,projectId:pid,commandId:b.request_key,clientId:meta.clientId,controlGeneration:meta.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:d,candidatePayload:payload}};
   if(b.request_hash!==contentHash(canonicalJson(original)))throw Error();
   return{candidateCommandId:d.candidateCommandId,payloadHash:s.payloadHash,payload};
  }catch{throw unavailable();}
 }
}
