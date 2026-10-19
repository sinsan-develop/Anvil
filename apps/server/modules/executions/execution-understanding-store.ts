import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {readUnderstandingHistory,type SyntheticUnderstandingStore,type UnderstandingRecord} from './execution-understanding.ts';
type Scope=Parameters<SyntheticUnderstandingStore['list']>[1];
export interface SyntheticUnderstandingFacts extends Pick<SyntheticUnderstandingStore,'current'>{readonly transport:'SYNTHETIC_ONLY'}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=():never=>{throw new AuthFailure('UNDERSTANDING_PG_INTEGRITY_FAILED',503);};
function scopeOf(raw:Scope){if(!recordV1(raw,['projectId','executionId','executionGeneration'])||!uuidV1(raw.projectId)||!uuidV1(raw.executionId)||!Number.isSafeInteger(raw.executionGeneration)||raw.executionGeneration<1)return fail();return cloneV1(raw);}
/** 기존 인증 transaction의 같은 PoolClient만 소비하며 별도 pool/BEGIN/COMMIT을 만들지 않는다.
 * 실제 source/응답/수신의 현재성은 필수 합성 facts port다. SQL/이 adapter는 그 진위를 증명하지 않는다. */
export class SyntheticPgUnderstandingStore implements SyntheticUnderstandingStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly facts:SyntheticUnderstandingFacts;
 constructor(facts:SyntheticUnderstandingFacts){this.facts=facts;this.#port();}
 #port(){if(this.facts?.transport!=='SYNTHETIC_ONLY'||typeof this.facts.current!=='function')throw new AuthFailure('SYNTHETIC_UNDERSTANDING_FACTS_REQUIRED',412);}
 current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope){this.#port();return this.facts.current(db,actor,scopeOf(scope));}
 async list(db:PoolClient,raw:Scope):Promise<UnderstandingRecord[]>{
  this.#port();const scope=scopeOf(raw),rows=(await db.query("SELECT v.*,c.actor_id command_actor,c.client_id command_client,c.command_id command_key,c.operation,c.state,c.request_hash,c.policy_ref,c.result_ref,ar.subject_ref authorization_subject,ar.policy_ref authorization_policy,ar.scope_digest authorization_scope,a.scope_digest audit_scope,a.outcome audit_outcome,a.source_kind audit_source FROM anvil.understanding_reviews v JOIN anvil.commands c ON c.project_id=v.project_id AND c.id=v.command_id AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.approval_decision_ref IS NULL JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id WHERE v.project_id=$1 AND v.execution_id=$2 AND v.generation=$3 ORDER BY v.version LIMIT 1001",[scope.projectId,scope.executionId,scope.executionGeneration])).rows;
  const entries=readUnderstandingHistory(rows.map(r=>({ref:{id:r.id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json})),scope);
  for(const [i,row]of rows.entries()){const entry=entries[i]!,s=entry.snapshot,r=s.reviewer,request=s.request;
   const digest=hash({projectId:scope.projectId,actorId:r.userId,clientId:r.clientId,controlGeneration:r.controlGeneration,requestHash:s.requestHash,policyRef:s.policyRef,targetRef:entry.ref});
   if(row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.created_by!==r.userId||row.client_id!==r.clientId||row.command_actor!==r.userId||row.command_client!==r.clientId||row.command_key!==request.commandId||row.operation!=='reviewUnderstanding'||row.state!=='APPLIED'||row.request_hash!==s.requestHash||!same(row.policy_ref,s.policyRef)||!same(row.authorization_subject,{kind:'HUMAN',userId:r.userId,clientId:r.clientId})||!same(row.authorization_policy,s.policyRef)||row.authorization_scope!==digest||row.audit_scope!==digest||row.audit_outcome!=='APPLIED'||row.audit_source!=='HUMAN_COMMAND'||row.result_ref?.projectId!==scope.projectId||row.result_ref?.status!=='APPLIED'||row.result_ref?.targetId!==entry.ref.id||row.result_ref?.version!==entry.ref.version||row.result_ref?.data?.status!=='SYNTHETIC_UNDERSTANDING_REVIEWED'||!same(row.result_ref.data.ref,entry.ref)||!same(row.result_ref.data.snapshot,s))return fail();
  }return entries;
 }
 async append(db:PoolClient,rawScope:Scope,rawRecord:UnderstandingRecord,createdCommandId:string){
  this.#port();const scope=scopeOf(rawScope),record=cloneV1(rawRecord);if(!uuidV1(createdCommandId))return fail();
  readUnderstandingHistory([...await this.list(db,scope),record],scope);const s=record.snapshot;
  const result=await db.query('INSERT INTO anvil.understanding_reviews(project_id,execution_id,generation,id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[scope.projectId,scope.executionId,scope.executionGeneration,record.ref.id,record.ref.version,record.ref.contentHash,JSON.stringify(s),s.reviewer.userId,s.reviewer.clientId,createdCommandId]);
  if(result.rowCount!==1)return fail();
 }
}
