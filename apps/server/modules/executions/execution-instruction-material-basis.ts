import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {SyntheticPgInstructionPermitBasis} from './execution-instruction-permit-basis.ts';
import {readSyntheticInstructionQueueRecord,type SyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';
import {readSyntheticInstructionReservation} from './execution-instruction-store.ts';

export interface SyntheticRegisteredInstructionParts{
 readonly transport:'SYNTHETIC_ONLY';
 /** 같은 잠긴 db에서 exact command/material의 등록 부분·원문 접근/격리 상태만 반환한다.
  * caller의 경로/원문/proof를 채택하지 않으며 bytes는 별도 readPart 경계에서 읽는다. */
 current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope,command:SyntheticInstructionQueueRecord,materialId:string):Promise<unknown>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('INSTRUCTION_MATERIAL_BASIS_REJECTED',412);};
/** 서명 material wrapper의 기존 proof 없는 8필드 basis에 현재 SEND 승인/예약 검사를 연결한다.
 * 새 DB/연결/tx·자료읽기·HTTP/credential/Agent 기본값은 만들지 않는다. */
export class SyntheticPgInstructionMaterialBasis{
 readonly transport='SYNTHETIC_ONLY' as const;readonly basis:Pick<SyntheticPgInstructionPermitBasis,'transport'|'current'>;readonly parts:SyntheticRegisteredInstructionParts;
 constructor(basis:Pick<SyntheticPgInstructionPermitBasis,'transport'|'current'>,parts:SyntheticRegisteredInstructionParts){this.basis=basis;this.parts=parts;this.#ports();}
 #ports(){if(this.basis?.transport!=='SYNTHETIC_ONLY'||typeof this.basis.current!=='function'||this.parts?.transport!=='SYNTHETIC_ONLY'||typeof this.parts.current!=='function')reject();}
 async current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope,commandId:string,materialId:string){
  try{
   this.#ports();if(!uuidV1(materialId))return reject();
   const selectedScope=cloneV1(scope),clock=async()=>{const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return reject();return at.getTime();};
   const read=async()=>{
    this.#ports();const v=cloneV1(await this.basis.current(db,actor,cloneV1(selectedScope),commandId)),now=await clock();this.#ports();
    if(!recordV1(v,['transport','record','reservation','fact','grantRef','grantExpiresAt','authorizationReceiptRef','turnState'])||v.transport!=='SYNTHETIC_ONLY'||v.turnState!=='IDLE'||!same(v.grantRef,selectedScope.grantRef)||!isoV1(v.grantExpiresAt))return reject();
    const record=readSyntheticInstructionQueueRecord(v.record,{projectId:selectedScope.projectId,executionId:selectedScope.executionId,executionGeneration:selectedScope.executionGeneration}),reservation=readSyntheticInstructionReservation(v.reservation,record),fact=readServerExecutionFactV1(v.fact),e=record.snapshot.envelope;
    const{checkedAt:_,expires:__,...stable}=fact,{expires:___,...saved}=record.snapshot.currentBinding.fact;
    if(!same(stable,saved)||fact.writerState!=='OWNED'||!same(v.grantRef,record.snapshot.currentBinding.grantRef)||v.grantExpiresAt!==record.snapshot.currentBinding.grantExpiresAt||fact.registration.connectorId!==selectedScope.connectorId||e.commandId!==commandId||!same(v.authorizationReceiptRef,e.context.authorizationReceiptRef)||Date.parse(fact.checkedAt)>now||now-Date.parse(fact.checkedAt)>30000)return reject();
    const deadline=Math.min(Date.parse(fact.checkedAt)+30000,Date.parse(v.grantExpiresAt),Date.parse(e.expiresAt),...Object.values(fact.expires).map(Date.parse));if(deadline<=now)return reject();
    return{record,reservation,fact,grantRef:v.grantRef,grantExpiresAt:v.grantExpiresAt,authorizationReceiptRef:v.authorizationReceiptRef,deadline};
   };
   const first=await read(),part=cloneV1(await this.parts.current(db,actor,cloneV1(selectedScope),cloneV1(first.record),materialId));this.#ports();
   if(!recordV1(part,['material','sourceState'])||part.sourceState!=='AVAILABLE'||!recordV1(part.material,['ref','snapshot'])||!refV1(part.material.ref)||part.material.ref.id!==materialId||Buffer.byteLength(canonicalJson(part))>2097152)return reject();
   const last=await read(),now=await clock();this.#ports();
   if(!same(first.record,last.record)||!same(first.reservation,last.reservation)||Math.min(first.deadline,last.deadline)<=now)return reject();
   const fact=cloneV1(last.fact);fact.expires.humanSession=new Date(Math.min(first.deadline,last.deadline,Date.parse(fact.expires.humanSession))).toISOString();
   return{fact,grantRef:cloneV1(last.grantRef),grantExpiresAt:last.grantExpiresAt,commandRef:cloneV1(last.record.ref),commandSnapshot:cloneV1(last.record.snapshot),authorizationReceiptRef:cloneV1(last.authorizationReceiptRef),material:cloneV1(part.material),sourceState:'AVAILABLE' as const};
  }catch{return reject();}
 }
}
