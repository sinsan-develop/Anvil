import type {PoolClient} from 'pg';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {refV1,recordV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
const H=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const flags={humanDecisionRecorded:true,completionAccepted:false,runtimeStateVerified:false,automaticTransitionPerformed:false,executionAuthorized:false,dispatchPerformed:false}as const;
export interface DecisionRow{project_id:string;stream_id:string;version:number;content_hash:string;snapshot_json:Record<string,any>;basis_json:Record<string,any>;basis_hash:string;server_command_id:string;recorded_at:Date;[key:string]:any}
function integrity():never{throw new AuthFailure('NODE_DECISION_INTEGRITY_FAILED',503);}
export class NodeDecisionStore{
 async head(db:PoolClient,pid:string,applicationRef:VersionRef,nodeId:string){
  const rows=(await db.query('SELECT * FROM anvil.node_decision_heads WHERE project_id=$1 AND application_ref=$2::jsonb AND node_id=$3 FOR UPDATE',[pid,canonicalJson(applicationRef),nodeId])).rows;
  if(rows.length>1)integrity();return rows[0]??null;
 }
 async insert(db:PoolClient,row:DecisionRow,previousRef:VersionRef|null){
  if(H(row.snapshot_json)!==row.content_hash||H(row.basis_json)!==row.basis_hash||!same(row.snapshot_json.previousRef,previousRef))integrity();
  await db.query('INSERT INTO anvil.node_decision_versions(project_id,stream_id,version,content_hash,snapshot_json,basis_json,basis_hash,server_command_id,recorded_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)',[row.project_id,row.stream_id,row.version,row.content_hash,canonicalJson(row.snapshot_json),canonicalJson(row.basis_json),row.basis_hash,row.server_command_id,row.recorded_at]);
  if(previousRef===null){await db.query('INSERT INTO anvil.node_decision_heads(project_id,stream_id,application_ref,node_id,head_version,head_hash,created_at,updated_at) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$7)',[row.project_id,row.stream_id,canonicalJson(row.snapshot_json.nodeRef.applicationRef),row.snapshot_json.nodeRef.nodeId,row.version,row.content_hash,row.recorded_at]);}
  else{const result=await db.query('UPDATE anvil.node_decision_heads SET head_version=$4,head_hash=$5,updated_at=$6 WHERE project_id=$1 AND stream_id=$2 AND head_version=$3 AND head_hash=$7 RETURNING stream_id',[row.project_id,row.stream_id,previousRef.version,row.version,row.content_hash,row.recorded_at,previousRef.contentHash]);if(result.rows.length!==1)throw new AuthFailure('VERSION_CONFLICT',409);}
 }
 async read(db:PoolClient,pid:string,id:string,version:number){
  const rows=(await db.query("SELECT v.*,c.result_ref,c.request_hash,c.actor_id command_actor_id,c.client_id command_client_id,c.command_id external_command_id,c.operation,c.control_generation,c.policy_ref,c.state command_state,c.authorization_receipt_id,a.subject_ref,a.scope_digest,a.command_id receipt_command_id,e.event_id,e.target_ref,e.scope_digest audit_scope_digest,e.outcome audit_outcome,r.phase reservation_state,r.plan_json FROM anvil.node_decision_versions v JOIN anvil.commands c ON c.id=v.server_command_id AND c.project_id=v.project_id JOIN anvil.authorization_receipts a ON a.id=c.authorization_receipt_id AND a.command_id=c.id AND a.scope_id=c.project_id JOIN anvil.audit_events e ON e.command_id=c.id AND e.project_id=c.project_id AND e.outcome='APPLIED' JOIN anvil.project_storage_reservations r ON r.id=c.id AND r.project_id=c.project_id WHERE v.project_id=$1 AND v.stream_id=$2 AND v.version=$3",[pid,id,version])).rows;
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);if(rows.length!==1)integrity();const row=rows[0] as DecisionRow,s=row.snapshot_json,b=row.basis_json;
  const ref={id,version,contentHash:row.content_hash};
  if(!uuidV1(id)||!Number.isSafeInteger(version)||version<1||row.project_id!==pid||row.stream_id!==id||Number(row.version)!==version||H(s)!==ref.contentHash||H(b)!==row.basis_hash||!recordV1(s,['schemaVersion','purpose','projectId','nodeRef','declarationHash','basisRef','decisionType','value','reason','sourceDocumentRefs','previousRef','status','actor','commandId','recordedAt'])||s.schemaVersion!==1||s.purpose!=='HUMAN_NODE_DECISION'||s.projectId!==pid||!refV1(s.basisRef)||s.basisRef.id!==b.id||s.basisRef.version!==1||s.basisRef.contentHash!==row.basis_hash||!same(s.actor,b.actor)||s.commandId!==b.commandId||s.recordedAt!==b.recordedAt||s.recordedAt!==new Date(row.recorded_at).toISOString()||b.projectId!==pid||b.purpose!=='HUMAN_NODE_DECISION_BASIS'||!same(s.nodeRef.applicationRef,b.applicationRef)||!['ACTIVE','REVOKED'].includes(s.status))integrity();
  if(row.command_state!=='APPLIED'||!['recordNodeDecision','revokeNodeDecision'].includes(row.operation)||row.command_actor_id!==s.actor.userId||row.command_client_id!==s.actor.clientId||row.external_command_id!==s.commandId||Number(row.control_generation)!==s.actor.controlGeneration||row.receipt_command_id!==row.server_command_id||row.subject_ref?.kind!=='HUMAN'||row.subject_ref.userId!==s.actor.userId||row.subject_ref.clientId!==s.actor.clientId||row.audit_outcome!=='APPLIED'||!same(row.target_ref,ref)||row.audit_scope_digest!==row.scope_digest||row.reservation_state!=='SETTLED')integrity();
  const digest=H({projectId:pid,actorId:s.actor.userId,clientId:s.actor.clientId,controlGeneration:s.actor.controlGeneration,requestHash:row.request_hash,policyRef:row.policy_ref,targetRef:ref});
  if(digest!==row.scope_digest||!same(row.result_ref?.data?.ref,ref)||!same(row.result_ref?.data?.snapshot,s)||!same(row.result_ref?.data?.basisSnapshot,b)||!same(row.result_ref?.data?.basisRef,s.basisRef)||Object.entries(flags).some(([k,v])=>row.result_ref?.data?.[k]!==v))integrity();
  if(version===1?s.previousRef!==null:!refV1(s.previousRef)||s.previousRef.id!==id||s.previousRef.version!==version-1)integrity();
  if(version>1){const previous=(await db.query('SELECT content_hash FROM anvil.node_decision_versions WHERE project_id=$1 AND stream_id=$2 AND version=$3',[pid,id,version-1])).rows[0];if(previous?.content_hash!==s.previousRef.contentHash)integrity();}
  return{row,ref,snapshot:s,basisRef:s.basisRef as VersionRef,basisSnapshot:b};
 }
 async view(db:PoolClient,pid:string,id:string,version:number){const value=await this.read(db,pid,id,version),heads=(await db.query('SELECT head_version,head_hash FROM anvil.node_decision_heads WHERE project_id=$1 AND stream_id=$2',[pid,id])).rows;if(heads.length!==1)integrity();const h=heads[0]!;return{projectId:pid,ref:value.ref,snapshot:value.snapshot,basisRef:value.basisRef,basisSnapshot:value.basisSnapshot,headRef:{id,version:Number(h.head_version),contentHash:h.head_hash},historyVerification:'STORED_DECISION_VERIFIED' as const,...flags};}
}
export const nodeDecisionFlags=Object.freeze(flags);
