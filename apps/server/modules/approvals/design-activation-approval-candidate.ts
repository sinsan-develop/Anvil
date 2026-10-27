import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,type ProjectCommand} from '../access/project-command.ts';
import {readDesignActivationInput,type DesignActivationInput} from '../traceability/design-activation-input.ts';
import type {ApprovalDetails,ApprovalScope} from './approval-input.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectBaselineActivations} from '../traceability/baseline-activations.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),unavailable=()=>new AuthFailure('ACTIVATION_APPROVAL_STORAGE_UNAVAILABLE',503);
export interface DesignActivationApprovalMeta{serverCommandId:string;createdBy:string;clientId:string;controlGeneration:number;policyRef:VersionRef;details:ApprovalDetails}
export function readDesignActivationApprovalPayload(value:unknown,expectedHash:string):DesignActivationInput{
 let input:DesignActivationInput;try{canonicalJson(value);input=readDesignActivationInput(value);if(input.reason.includes('\u0000')||inspectArtifact(Buffer.from(input.reason,'utf8')).state==='SUSPECTED')throw Error();}catch{throw new AuthFailure('APPROVAL_INPUT_INVALID',422);}
 if(!/^[a-f0-9]{64}$/.test(expectedHash)||contentHash(canonicalJson(input))!==expectedHash)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);return input;
}
export class DesignActivationApprovalCandidates{
 async capture(db:PoolClient,actor:AuthenticatedIdentity,{command:c,requestId,serverCommandId,policyRef,details:d,payload:value}:{command:ProjectCommand;requestId:string;serverCommandId:string;policyRef:VersionRef;details:ApprovalDetails;payload:unknown}){
  const payload=readDesignActivationApprovalPayload(value,d.actionScope.payloadHash),m=await projectMember(db,actor,c.projectId);
  if(m.participation!=='OWNER'||m.archived_at||c.operation!=='requestApproval'||d.actionScope.operation!=='activateDesignChange'||d.actionScope.requestedSubjectRef.userId!==actor.actorId||d.actionScope.requestedSubjectRef.clientId!==actor.clientId||c.clientId!==actor.clientId)throw new AuthFailure('NOT_FOUND',404);
  if(c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!same(c.payload,{details:d,candidatePayload:payload})||!same(d.actionScope.targetRef,payload.changeRef)||d.actionScope.expectedVersion!==payload.changeRef.version||d.actionScope.controlGeneration!==c.controlGeneration)throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  try{await db.query(`INSERT INTO anvil.design_activation_approval_candidates(project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,target_ref,baseline_refs,created_by,client_id,control_generation,policy_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[c.projectId,requestId,serverCommandId,d.candidateCommandId,d.actionScope.payloadHash,JSON.stringify(payload),JSON.stringify(d.actionScope.targetRef),JSON.stringify(d.actionScope.baselineRefs),actor.actorId,actor.clientId,c.controlGeneration,JSON.stringify(policyRef)]);}catch{throw unavailable();}
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,meta:DesignActivationApprovalMeta){
  const m=await projectMember(db,actor,pid);if(m.participation!=='OWNER'||m.archived_at||meta.createdBy!==actor.actorId)throw new AuthFailure('NOT_FOUND',404);return this.readStored(db,pid,id,meta);
 }
 /** 이미 확인된 저장 귀속의 내부검사. reason 반환 권한은 read에서 별도로 확인한다. */
 async readStored(db:PoolClient,pid:string,id:string,meta:DesignActivationApprovalMeta){
  try{const rows=(await db.query(`SELECT b.*,c.command_id request_key,c.request_hash,c.operation request_operation,c.actor_id request_actor,c.client_id request_client FROM anvil.design_activation_approval_candidates b JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.request_command_id WHERE b.project_id=$1 AND b.request_id=$2`,[pid,id])).rows;if(rows.length!==1)throw Error();const r=rows[0],d=meta.details;
   if(d.actionScope.operation!=='activateDesignChange'||r.project_id!==pid||r.request_id!==id||r.request_command_id!==meta.serverCommandId||r.candidate_command_id!==d.candidateCommandId||r.payload_hash!==d.actionScope.payloadHash||!same(r.target_ref,d.actionScope.targetRef)||!same(r.baseline_refs,d.actionScope.baselineRefs)||r.created_by!==meta.createdBy||r.client_id!==meta.clientId||Number(r.control_generation)!==meta.controlGeneration||!same(r.policy_ref,meta.policyRef)||r.request_operation!=='requestApproval'||r.request_actor!==meta.createdBy||r.request_client!==meta.clientId)throw Error();
   const payload=readDesignActivationApprovalPayload(r.payload_json,r.payload_hash);if(!same(payload.changeRef,d.actionScope.targetRef))throw Error();const original={schemaVersion:1,projectId:pid,commandId:r.request_key,clientId:meta.clientId,controlGeneration:meta.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:d,candidatePayload:payload}};if(contentHash(canonicalJson(original))!==r.request_hash)throw Error();return{candidateCommandId:d.candidateCommandId,payloadHash:r.payload_hash as string,payload};
  }catch{throw unavailable();}
 }
 async assertCurrent(db:PoolClient,actor:AuthenticatedIdentity,pid:string,scope:ApprovalScope,value:unknown,documents?:ProjectDocuments){const payload=readDesignActivationApprovalPayload(value,scope.payloadHash);if(scope.operation!=='activateDesignChange')throw new AuthFailure('APPROVAL_INPUT_INVALID',422);return new ProjectBaselineActivations(documents).assertCandidateCurrent(db,actor,pid,scope,payload);}
}
