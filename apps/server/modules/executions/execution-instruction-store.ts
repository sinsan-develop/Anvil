import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import type {BudgetRecord} from './execution-budget.ts';
import {readSyntheticInstructionQueueRecord,type SyntheticInstructionQueueRecord,type SyntheticInstructionQueueStore} from './execution-instruction-queue.ts';
type Scope=Parameters<SyntheticInstructionQueueStore['append']>[1];
export interface SyntheticInstructionQueueFacts extends Pick<SyntheticInstructionQueueStore,'current'|'claim'>{readonly transport:'SYNTHETIC_ONLY'}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),integer=(v:unknown,min=0)=>Number.isSafeInteger(v)&&Number(v)>=min;
const fail=():never=>{throw new AuthFailure('INSTRUCTION_QUEUE_PG_INTEGRITY_FAILED',503);};
function scopeOf(v:Scope){if(!recordV1(v,['projectId','executionId','executionGeneration'])||!uuidV1(v.projectId)||!uuidV1(v.executionId)||!integer(v.executionGeneration,1))return fail();return cloneV1(v);}
function reservationOf(raw:BudgetRecord,record:SyntheticInstructionQueueRecord){
 const s=raw?.snapshot,c=s?.claim,d=c?.demand,r=record.snapshot,b=r.currentBinding;
 if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!same(raw.ref,r.reservationRef)||!recordV1(s,['sequence','claim','state','usage','previousRef','checkedAt','evidenceRef','executionAuthorized','dispatchPerformed'])||!integer(s.sequence,1)||s.state!=='RESERVED'||s.usage!==null||s.previousRef!==null||s.evidenceRef!==null||s.executionAuthorized!==false||s.dispatchPerformed!==false||!isoV1(s.checkedAt)||Date.parse(s.checkedAt)>Date.parse(r.queuedAt)||raw.ref.contentHash!==hash(s)||Buffer.byteLength(canonicalJson(raw))>2097152
  ||!recordV1(c,['projectId','executionId','executionGeneration','commandId','assignmentRef','stageRef','policyRef','operation','demand'])||c.projectId!==r.scope.projectId||c.executionId!==r.scope.executionId||c.executionGeneration!==r.scope.executionGeneration||c.commandId!==r.request.commandId||c.operation!=='SEND_INSTRUCTION'||!same(c.assignmentRef,b.fact.intent.assignmentRef)||!same(c.policyRef,b.fact.intent.budgetPolicyRef)||!recordV1(c.stageRef,['applicationRef','nodeId'])||!refV1(c.stageRef.applicationRef)||typeof c.stageRef.nodeId!=='string'||!c.stageRef.nodeId.trim()
  ||!recordV1(d,['attempts','calls','spoolBytes','cost','costStatus'])||d.attempts!==0||!integer(d.calls,1)||!integer(d.spoolBytes)||!(d.costStatus==='VERIFIED_NO_CHARGE'&&d.cost===null||d.costStatus==='FINITE_CAP'&&recordV1(d.cost,['amount','currency'])&&typeof d.cost.amount==='number'&&Number.isFinite(d.cost.amount)&&d.cost.amount>=0&&d.cost.amount<=Number.MAX_SAFE_INTEGER&&typeof d.cost.currency==='string'&&/^[A-Z]{3}$/.test(d.cost.currency)))return fail();
 return cloneV1(raw);
}
/** 기존 인증 tx의 계획된 새 예약·SEND 명령·보류 outbox만 함께 저장한다.
 * 호출자가 project 잠금과 현재 권한을 보유해야 하며 별도 pool/BEGIN/COMMIT·실전달은 없다.
 * SEND forward guard 없는 DB는 거절한다. 문법 검사를 실제 영수증/DB 권위로 승격하지 않는다. */
export class SyntheticPgInstructionQueueStore implements SyntheticInstructionQueueStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly facts:SyntheticInstructionQueueFacts;
 constructor(facts:SyntheticInstructionQueueFacts){this.facts=facts;this.#port();}
 #port(){if(this.facts?.transport!=='SYNTHETIC_ONLY'||typeof this.facts.current!=='function'||typeof this.facts.claim!=='function')throw new AuthFailure('SYNTHETIC_INSTRUCTION_QUEUE_FACTS_REQUIRED',412);}
 async current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope){this.#port();const result=cloneV1(await this.facts.current(db,actor,scopeOf(scope)));this.#port();return result;}
 async claim(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope,request:ProjectCommand){this.#port();const result=cloneV1(await this.facts.claim(db,actor,scopeOf(scope),cloneV1(request)));this.#port();return result;}
 async append(db:PoolClient,rawScope:Scope,rawRecord:SyntheticInstructionQueueRecord,rawReservation:BudgetRecord,createdCommandId:string){
  this.#port();const scope=scopeOf(rawScope),record=readSyntheticInstructionQueueRecord(rawRecord,scope),reservation=reservationOf(rawReservation,record),s=record.snapshot,b=s.currentBinding,e=s.envelope;if(!uuidV1(createdCommandId))return fail();
  const quota=(await db.query("SELECT count(*)::int AS count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',id,'version',version,'contentHash',content_hash),'snapshot',snapshot_json)))),0)::bigint+COALESCE((SELECT sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',u.reservation_id,'version',u.version,'contentHash',u.content_hash),'snapshot',u.snapshot_json)))) FROM anvil.usage_reservations u WHERE u.project_id=$1 AND u.snapshot_json->'claim'->>'executionId'=$2::uuid::text AND u.snapshot_json->'claim'->>'executionGeneration'=$3::bigint::text AND u.snapshot_json->'claim'->>'operation'='SEND_INSTRUCTION'),0)::bigint AS total FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->>'state'='SYNTHETIC_INSTRUCTION_QUEUED'",[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];this.#port();
  if(!quota||!integer(Number(quota.count))||Number(quota.count)>=100||!integer(Number(quota.total))||Number(quota.total)+Buffer.byteLength(canonicalJson(record))+Buffer.byteLength(canonicalJson(reservation))>2097152)return fail();
  const budget=await db.query('INSERT INTO anvil.usage_reservations(project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[scope.projectId,reservation.ref.id,1,reservation.snapshot.sequence,s.request.commandId,reservation.ref.contentHash,JSON.stringify(reservation.snapshot),createdCommandId]);if(budget.rowCount!==1)return fail();this.#port();
  const command=await db.query('INSERT INTO anvil.execution_commands(project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[scope.projectId,record.ref.id,scope.executionId,scope.executionGeneration,b.grantRef.id,b.grantRef.version,record.ref.contentHash,e.envelopeHash,JSON.stringify(s),JSON.stringify(e.context.authorizationReceiptRef),createdCommandId]);if(command.rowCount!==1)return fail();this.#port();
  const outbox=await db.query('INSERT INTO anvil.delivery_outbox(id,project_id,command_id,kind,destination_ref,payload_ref,state,scope_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),scope.projectId,createdCommandId,'EXECUTION_INSTRUCTION_SYNTHETIC_ONLY',JSON.stringify({transport:'SYNTHETIC_ONLY',registrationRef:b.fact.registration.ref,executionId:scope.executionId,generation:scope.executionGeneration,grantKind:'EXECUTION'}),JSON.stringify({commandRef:record.ref,grantRef:b.grantRef,envelopeHash:e.envelopeHash}),'HELD_SYNTHETIC_ONLY',hash({scope,commandRef:record.ref,grantRef:b.grantRef,envelopeHash:e.envelopeHash})]);if(outbox.rowCount!==1)return fail();this.#port();
 }
}
