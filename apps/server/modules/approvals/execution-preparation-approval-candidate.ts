import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {ApprovalDetails,ApprovalScope} from './approval-input.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {ExecutionIntentV1} from '../../../../contracts/runtime/execution-intent-v1.ts';
import {readExecutionPreparationInput} from '../executions/preparation-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const unavailable=()=>new AuthFailure('EXECUTION_PREPARATION_APPROVAL_INTEGRITY_FAILED',503);
export interface ExecutionPreparationApprovalMeta{serverCommandId:string;createdBy:string;clientId:string;controlGeneration:number;policyRef:VersionRef;details:ApprovalDetails}
export function readExecutionPreparationApprovalPayload(value:unknown,expectedHash:string):ExecutionIntentV1{
 let payload:ExecutionIntentV1;try{payload=readExecutionPreparationInput(value);}catch{throw new AuthFailure('APPROVAL_INPUT_INVALID',422);}
 if(!/^[a-f0-9]{64}$/.test(expectedHash)||contentHash(canonicalJson(payload))!==expectedHash)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
 return payload;
}
/** 준비 입력 보관이며 능력·예산 검증이나 전달·실행 허가가 아니다. */
export class ExecutionPreparationApprovalCandidates{
 async assertCurrent(db:PoolClient,actor:AuthenticatedIdentity,pid:string,s:ApprovalScope,value:unknown){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);
  const payload=readExecutionPreparationApprovalPayload(value,s.payloadHash);
  if(s.operation!=='prepareExecution'||s.targetRef!==null||s.expectedVersion!==0||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||payload.projectId!==pid)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  // 임무·예약·맥락·후보·소스 현재성은 기존 저장 검사를 그대로 거친다.
  return payload;
 }
 async capture(db:PoolClient,actor:AuthenticatedIdentity,input:{command:ProjectCommand;requestId:string;serverCommandId:string;policyRef:VersionRef;details:ApprovalDetails;payload:unknown}){
  const {command:c,details:d}=input,payload=await this.assertCurrent(db,actor,c.projectId,d.actionScope,input.payload);
  if(c.operation!=='requestApproval'||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null||c.baselineRefs.length||c.clientId!==actor.clientId||d.actionScope.requestedSubjectRef.kind!=='HUMAN'||d.actionScope.requestedSubjectRef.userId!==actor.actorId||d.actionScope.requestedSubjectRef.clientId!==actor.clientId||d.actionScope.controlGeneration!==c.controlGeneration||!same(c.payload,{details:d,candidatePayload:payload}))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  try{await db.query('INSERT INTO anvil.execution_preparation_approval_candidates(project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[c.projectId,input.requestId,input.serverCommandId,d.candidateCommandId,d.actionScope.payloadHash,JSON.stringify(payload),actor.actorId,actor.clientId,c.controlGeneration,JSON.stringify(input.policyRef)]);}catch{throw unavailable();}
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,meta:ExecutionPreparationApprovalMeta){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER'||meta.createdBy!==actor.actorId)throw new AuthFailure('NOT_FOUND',404);
  try{
   const rows=(await db.query('SELECT b.*,c.command_id request_key,c.request_hash,c.operation request_operation,c.actor_id request_actor,c.client_id request_client FROM anvil.execution_preparation_approval_candidates b JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.request_command_id WHERE b.project_id=$1 AND b.request_id=$2',[pid,id])).rows;
   if(rows.length!==1)throw Error();const b=rows[0],d=meta.details,s=d.actionScope;
   if(s.operation!=='prepareExecution'||s.targetRef!==null||s.expectedVersion!==0||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||b.project_id!==pid||b.request_id!==id||b.request_command_id!==meta.serverCommandId||b.candidate_command_id!==d.candidateCommandId||b.payload_hash!==s.payloadHash||b.created_by!==meta.createdBy||b.client_id!==meta.clientId||Number(b.control_generation)!==meta.controlGeneration||!same(b.policy_ref,meta.policyRef)||b.request_operation!=='requestApproval'||b.request_actor!==meta.createdBy||b.request_client!==meta.clientId)throw Error();
   const payload=readExecutionPreparationApprovalPayload(b.payload_json,b.payload_hash);if(payload.projectId!==pid)throw Error();
   const original={schemaVersion:1,projectId:pid,commandId:b.request_key,clientId:meta.clientId,controlGeneration:meta.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:d,candidatePayload:payload}};
   if(b.request_hash!==contentHash(canonicalJson(original)))throw Error();
   return{candidateCommandId:d.candidateCommandId,payloadHash:s.payloadHash,payload};
  }catch{throw unavailable();}
 }
}
