import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {ProjectExecutionBudget} from './execution-budget.ts';
import {readSyntheticInstructionCurrent,readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';
import {readSyntheticInstructionReservation,type SyntheticPgInstructionQueueStore} from './execution-instruction-store.ts';

type Queue=Pick<SyntheticPgInstructionQueueStore,'read'|'current'|'transport'>;
type Budgets=Pick<ProjectExecutionBudget,'checkDelivery'>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('INSTRUCTION_PERMIT_BASIS_REJECTED',412);};
/** 잠긴 기존 인증 tx의 SEND basis 조회만 연결한다. 새 연결/BEGIN/COMMIT·nonce/journal 쓰기·
 * 공용 SQL guard 교체는 하지 않는다. caller가 HUMAN/grant/current와 실행 잠금을 검증해야 한다.
 * 실제 PG·현재 source/OS 제공자 진위는 이 class의 문법 검사로 증명되지 않는다. */
export class SyntheticPgInstructionPermitBasis{
 readonly transport='SYNTHETIC_ONLY' as const;readonly queue:Queue;readonly budgets:Budgets;
 constructor(queue:Queue,budgets:Budgets){this.queue=queue;this.budgets=budgets;this.#ports();}
 #ports(){if(this.queue?.transport!=='SYNTHETIC_ONLY'||typeof this.queue.read!=='function'||typeof this.queue.current!=='function'||typeof this.budgets?.checkDelivery!=='function')reject();}
 async current(db:PoolClient,actor:AuthenticatedIdentity,rawScope:Scope,commandId:string){
  try{
   this.#ports();if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'||![rawScope.projectId,rawScope.connectorId,rawScope.executionId,commandId].every(uuidV1)||!refV1(rawScope.grantRef)||![rawScope.executionGeneration,rawScope.credentialGeneration].every(v=>Number.isSafeInteger(v)&&Number(v)>0))return reject();
   const scope=cloneV1(rawScope),execution={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration};
   const clock=async()=>{this.#ports();const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;this.#ports();if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return reject();return at.getTime();};
   const human=(at:number)=>{const s=actor.authSession;if(!s||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return reject();const end=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt));if(end<=at)return reject();return end;};
   human(await clock());
   const rows=(await db.query("SELECT id,version,content_hash FROM anvil.execution_commands WHERE project_id=$1::uuid AND execution_id=$2::uuid AND generation=$3::bigint AND snapshot_json->'envelope'->>'commandId'=$4::text AND snapshot_json->>'state'='SYNTHETIC_INSTRUCTION_QUEUED' LIMIT 2",[scope.projectId,scope.executionId,scope.executionGeneration,commandId])).rows;
   if(rows.length!==1)return reject();const row=rows[0],ref={id:row.id,version:Number(row.version),contentHash:row.content_hash};if(!refV1(ref)||ref.version!==1)return reject();
   const record=readSyntheticInstructionQueueRecord(await this.queue.read(db,actor,cloneV1(execution),ref),execution),s=record.snapshot;
   if(!same(record.ref,ref)||s.request.commandId!==commandId||!same(s.currentBinding.grantRef,scope.grantRef)||s.currentBinding.fact.registration.connectorId!==scope.connectorId)return reject();
   const read=async()=>{const value=await this.queue.current(db,actor,cloneV1(execution)),at=await clock();human(at);return readSyntheticInstructionCurrent(value,execution,s.request,actor,at);};
   const first=await read(),checked=cloneV1(await this.budgets.checkDelivery(db,actor,scope.projectId,cloneV1(s.reservationRef))),at=await clock();
   if(!recordV1(checked,['record','policyRef','checkedAt','persisted','executionAuthorized','dispatchPerformed'])||!same(checked.policyRef,s.currentBinding.fact.intent.budgetPolicyRef)||!isoV1(checked.checkedAt)||Date.parse(checked.checkedAt)>at||at-Date.parse(checked.checkedAt)>30000||checked.persisted!==false||checked.executionAuthorized!==false||checked.dispatchPerformed!==false)return reject();
   const reservation=readSyntheticInstructionReservation(checked.record,record),last=await read(),endAt=await clock();
   const binding=(c:typeof first.c)=>{const{checkedAt:_,expiresAt:__,fact:___,...outer}=c,{checkedAt:____,expires:_____,...fact}=c.fact;return{...outer,fact};};
   if(!same(binding(first.c),binding(last.c)))return reject();
   const deadline=Math.min(human(endAt),Date.parse(first.c.expiresAt),Date.parse(last.c.expiresAt),Date.parse(first.c.checkedAt)+30000,Date.parse(last.c.checkedAt)+30000,Date.parse(first.c.fact.checkedAt)+30000,Date.parse(last.c.fact.checkedAt)+30000,...Object.values(first.c.fact.expires).map(Date.parse),...Object.values(last.c.fact.expires).map(Date.parse),Date.parse(checked.checkedAt)+30000,Date.parse(s.envelope.expiresAt));
   if(deadline<=endAt)return reject();
   const fact=cloneV1(last.c.fact);fact.expires.humanSession=new Date(Math.min(deadline,Date.parse(fact.expires.humanSession))).toISOString();
   this.#ports();return{transport:'SYNTHETIC_ONLY' as const,record,reservation,fact,grantRef:cloneV1(last.c.grantRef),grantExpiresAt:last.c.grantExpiresAt,authorizationReceiptRef:cloneV1(s.envelope.context.authorizationReceiptRef),turnState:last.c.turnState};
  }catch{return reject();}
 }
}
