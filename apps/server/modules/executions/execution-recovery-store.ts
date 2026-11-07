import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {readSyntheticRecoveryRecord,type SyntheticRecoveryRecord,type SyntheticRecoveryStore} from './execution-recovery.ts';
type Scope=Parameters<SyntheticRecoveryStore['append']>[1];
export interface SyntheticRecoveryFacts extends Pick<SyntheticRecoveryStore,'current'>{readonly transport:'SYNTHETIC_ONLY'}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=():never=>{throw new AuthFailure('RECOVERY_PG_INTEGRITY_FAILED',503);};
function scopeOf(raw:Scope){if(!recordV1(raw,['projectId','executionId','executionGeneration'])||!uuidV1(raw.projectId)||!uuidV1(raw.executionId)||!Number.isSafeInteger(raw.executionGeneration)||raw.executionGeneration<1)return fail();return cloneV1(raw);}
/** 기존 인증 transaction의 같은 PoolClient만 소비한다. 새 pool/BEGIN/COMMIT·키/credential 발급은 없다.
 * RECOVERY forward guard가 준비·적용되지 않은 DB에서는 INSERT가 거절된다. EXECUTION guard를 우회하지 않는다.
 * host/OS/원grant 상태의 현재성은 필수 합성 facts 제공자이며 이 adapter의 실제 권위 보장이 아니다. */
export class SyntheticPgRecoveryStore implements SyntheticRecoveryStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly facts:SyntheticRecoveryFacts;
 constructor(facts:SyntheticRecoveryFacts){this.facts=facts;this.#port();}
 #port(){if(this.facts?.transport!=='SYNTHETIC_ONLY'||typeof this.facts.current!=='function')throw new AuthFailure('SYNTHETIC_RECOVERY_FACTS_REQUIRED',412);}
 async current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope){this.#port();return cloneV1(await this.facts.current(db,actor,scopeOf(scope)));}
 async append(db:PoolClient,rawScope:Scope,rawRecord:SyntheticRecoveryRecord,createdCommandId:string){
  this.#port();const scope=scopeOf(rawScope),record=readSyntheticRecoveryRecord(rawRecord,scope);if(!uuidV1(createdCommandId))return fail();
  const quota=(await db.query("SELECT count(*)::int AS count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',id,'version',version,'contentHash',content_hash),'snapshot',snapshot_json)))),0)::bigint AS total FROM anvil.execution_grants WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->>'kind'='RECOVERY'",[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
  if(!quota||!Number.isSafeInteger(Number(quota.count))||Number(quota.count)<0||Number(quota.count)>=100||!Number.isSafeInteger(Number(quota.total))||Number(quota.total)<0||Number(quota.total)+Buffer.byteLength(canonicalJson(record))>2097152)return fail();
  const s=record.snapshot,result=await db.query('INSERT INTO anvil.execution_grants(project_id,id,version,execution_id,generation,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[scope.projectId,record.ref.id,1,scope.executionId,scope.executionGeneration,record.ref.contentHash,JSON.stringify(s),s.reviewer.userId,s.reviewer.clientId,createdCommandId]);if(result.rowCount!==1)return fail();
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,rawScope:Scope,ref:Ref):Promise<SyntheticRecoveryRecord>{
  this.#port();const scope=scopeOf(rawScope);if(!refV1(ref)||ref.version!==1)return fail();await projectMember(db,actor,scope.projectId);
  const rows=(await db.query("SELECT g.*,c.actor_id command_actor,c.client_id command_client,c.command_id command_key,c.operation,c.state,c.request_hash,c.policy_ref,c.result_ref,ar.subject_ref authorization_subject,ar.policy_ref authorization_policy,ar.scope_digest authorization_scope,a.scope_digest audit_scope,a.outcome audit_outcome,a.source_kind audit_source FROM anvil.execution_grants g JOIN anvil.commands c ON c.project_id=g.project_id AND c.id=g.command_id AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.approval_decision_ref IS NULL JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id WHERE g.project_id=$1 AND g.execution_id=$2 AND g.generation=$3 AND g.id=$4 AND g.version=$5 AND g.content_hash=$6 AND g.snapshot_json->>'kind'='RECOVERY' LIMIT 2",[scope.projectId,scope.executionId,scope.executionGeneration,ref.id,ref.version,ref.contentHash])).rows;
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);if(rows.length!==1)return fail();const row=rows[0],record=readSyntheticRecoveryRecord({ref:{id:row.id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json},scope),s=record.snapshot,r=s.reviewer,p=s.binding.permissionPolicyRef;
  const digest=hash({projectId:scope.projectId,actorId:r.userId,clientId:r.clientId,controlGeneration:r.controlGeneration,requestHash:s.requestHash,policyRef:p,targetRef:record.ref});
  if(!same(ref,record.ref)||row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.created_by!==r.userId||row.client_id!==r.clientId||row.command_actor!==r.userId||row.command_client!==r.clientId||row.command_key!==s.request.commandId||row.operation!=='authorizeExecutionRecovery'||row.state!=='APPLIED'||row.request_hash!==s.requestHash||!same(row.policy_ref,p)||!same(row.authorization_subject,{kind:'HUMAN',userId:r.userId,clientId:r.clientId})||!same(row.authorization_policy,p)||row.authorization_scope!==digest||row.audit_scope!==digest||row.audit_outcome!=='APPLIED'||row.audit_source!=='HUMAN_COMMAND'||row.result_ref?.projectId!==scope.projectId||row.result_ref?.status!=='APPLIED'||row.result_ref?.targetId!==record.ref.id||row.result_ref?.version!==1||row.result_ref?.data?.status!=='SYNTHETIC_RECOVERY_STORED'||!same(row.result_ref.data.ref,record.ref)||!same(row.result_ref.data.snapshot,s))return fail();return record;
 }
}
