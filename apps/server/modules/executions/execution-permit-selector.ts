import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {SyntheticAuthenticatedPermits} from './execution-authenticated-permits.ts';
import {readSyntheticQueuedCommandRecord} from './execution-command-record.ts';
import {readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';

type Consumer=Pick<SyntheticAuthenticatedPermits,'consume'>&{readonly transport:'SYNTHETIC_ONLY'};
export interface SyntheticPermitSelectionStore{
 readonly transport:'SYNTHETIC_ONLY';
 /** 같은 실행/세대의 저장 명령·원영수증/outbox·현재 권한과 선택 consumer의 nonce/permit을
  * 같은 잠금/transaction에서 소비한다. consumer는 새 pool/독립 COMMIT을 열지 않는다.
  * 실제 DB adapter/HTTP 등록을 제공하는 계약은 아니다. */
 transaction<T>(scope:Scope,body:(tx:{clock():Promise<string>;current(commandId:string):Promise<unknown>;start:Consumer;instruction:Consumer})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('EXECUTION_PERMIT_SELECTION_REJECTED',412);};
/** caller의 operation 추측이나 실패 fallback 없이 잠긴 저장 명령으로만 분기한다.
 * 기존 START consumer와 독립 SEND consumer를 명시 주입하며 서비스에 자동 등록하지 않는다. */
export class SyntheticExecutionPermitSelector{
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly store:SyntheticPermitSelectionStore;
 constructor(store:SyntheticPermitSelectionStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')reject();}
 async consume(rawScope:unknown,commandId:unknown,challengeRef:unknown,proof:unknown,signature:unknown,bodyRaw:unknown){
  try{
   this.#port();
   if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'||![rawScope.projectId,rawScope.connectorId,rawScope.executionId,commandId].every(uuidV1)||!refV1(rawScope.grantRef)||![rawScope.executionGeneration,rawScope.credentialGeneration].every(v=>Number.isSafeInteger(v)&&Number(v)>0)||!refV1(challengeRef)||challengeRef.version!==1||typeof signature!=='string'||signature.length>128||typeof bodyRaw!=='string'||Buffer.byteLength(bodyRaw)>2097152)return reject();
   const scope=cloneV1(rawScope) as unknown as Scope,args=[cloneV1(scope),commandId,cloneV1(challengeRef),cloneV1(proof),signature,bodyRaw] as const;
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const ports=()=>{this.#port();for(const consumer of [tx.start,tx.instruction])if(consumer?.transport!=='SYNTHETIC_ONLY'||typeof consumer.consume!=='function')reject();};
    const current=async()=>{
     ports();const value=cloneV1(await tx.current(commandId as string)),now=await tx.clock();ports();
     if(!isoV1(now)||!recordV1(value,['transport','scope','record','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||!same(value.scope,scope)||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(value.checkedAt)>30000)return reject();
     const execution={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration};
     const raw:any=value.record,kind=raw?.snapshot?.state;
     if(kind!=='SYNTHETIC_QUEUED'&&kind!=='SYNTHETIC_INSTRUCTION_QUEUED')return reject();
     const record=kind==='SYNTHETIC_QUEUED'?readSyntheticQueuedCommandRecord(raw,execution):readSyntheticInstructionQueueRecord(raw,execution),s=record.snapshot;
     const grant='currentBinding'in s?s.currentBinding.grantRef:s.grantRef;
     const envelope=readDispatchEnvelopeV1(s.envelope,Date.parse(now));
     if(!same(grant,scope.grantRef)||envelope.commandId!==commandId)return reject();
     const deadline=Math.min(Date.parse(value.checkedAt)+30000,Date.parse(value.expiresAt),Date.parse(envelope.expiresAt));
     if(deadline<=Date.parse(now))return reject();
     return{record,envelope,kind,deadline,now};
    };
    const first=await current(),consumer=first.kind==='SYNTHETIC_QUEUED'?tx.start:tx.instruction;
    const result=cloneV1(await consumer.consume(...args));
    const final=await current(),now=await tx.clock();ports();
    if(!same(first.record,final.record)||!isoV1(now)||Date.parse(now)>=Math.min(first.deadline,final.deadline)||!recordV1(result,['transport','proofResultRef','permit','nonceConsumed','executionAuthorized','dispatchPerformed'])||result.transport!=='SYNTHETIC_ONLY'||!refV1(result.proofResultRef)||result.nonceConsumed!==true||result.executionAuthorized!==false||result.dispatchPerformed!==false)return reject();
    const p=result.permit;
    if(!recordV1(p,['transport','key','envelopeHash','grantRef','permitRef','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||p.transport!=='SYNTHETIC_ONLY'||!same(p.key,receiptKeyV1(first.envelope))||p.envelopeHash!==first.envelope.envelopeHash||!same(p.grantRef,scope.grantRef)||!refV1(p.permitRef)||!isoV1(p.checkedAt)||!isoV1(p.expiresAt)||Date.parse(p.checkedAt)>Date.parse(now)||Date.parse(p.expiresAt)<=Math.max(Date.parse(now),Date.parse(p.checkedAt))||Date.parse(p.expiresAt)>Math.min(first.deadline,final.deadline)||p.executionAuthorized!==false||p.dispatchPerformed!==false)return reject();
    return result;
   });
  }catch{return reject();}
 }
}
