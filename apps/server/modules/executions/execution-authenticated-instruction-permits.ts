import {canonicalJson,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {SyntheticInstructionPermits,type SyntheticInstructionPermitTransaction} from './execution-instruction-permits.ts';
import {executionTarget} from './execution-proof.ts';
export interface SyntheticAuthenticatedInstructionPermitStore{
 readonly transport:'SYNTHETIC_ONLY';
 /** 같은 실행/세대의 proof nonce/원결과·SEND permit을 단일 잠금/tx로 묶는다.
  * permits.current는 검증된 proof를 포함하지 않는 8필드 현재 basis만 제공한다. */
 transaction<T>(scope:SyntheticChallengeScope,body:(tx:{challenges:SyntheticChallengeTransaction;permits:SyntheticInstructionPermitTransaction})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),reject=():never=>{throw new AuthFailure('AUTHENTICATED_INSTRUCTION_PERMIT_REJECTED',412);};
/** P1 합성 SEND의 독립 서명/nonce 연결. 기존 START/STOP consumer·SQL/HTTP 활성화·실행 credential/Agent를 바꾸지 않는다. */
export class SyntheticAuthenticatedInstructionPermits{
 readonly transport='SYNTHETIC_ONLY' as const;readonly store:SyntheticAuthenticatedInstructionPermitStore;
 constructor(store:SyntheticAuthenticatedInstructionPermitStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')reject();}
 async consume(rawScope:unknown,commandId:unknown,rawChallengeRef:unknown,rawProof:unknown,signature:unknown,bodyRaw:unknown){
  try{this.#port();if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'||![rawScope.projectId,rawScope.connectorId,rawScope.executionId,commandId].every(uuidV1)||!refV1(rawScope.grantRef)||!Number.isSafeInteger(rawScope.executionGeneration)||Number(rawScope.executionGeneration)<1||!Number.isSafeInteger(rawScope.credentialGeneration)||Number(rawScope.credentialGeneration)<1||!refV1(rawChallengeRef)||rawChallengeRef.version!==1||typeof signature!=='string'||signature.length>128||typeof bodyRaw!=='string'||Buffer.byteLength(bodyRaw)>2097152)return reject();
   const scope=cloneV1(rawScope) as unknown as SyntheticChallengeScope,challengeRef=cloneV1(rawChallengeRef) as Ref,proof=cloneV1(rawProof),request=parseWireJson(bodyRaw),target=executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+commandId+'/permit',[],bodyRaw);
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const permitFor=async(resultRef:Ref,allowCreate=false)=>{
     this.#port();if(!allowCreate){const saved=await tx.permits.read();if(!saved.complete||!saved.permits.some(record=>same(record.snapshot.proofRef,resultRef)))return reject();}
     const journal=await tx.challenges.read(),original=journal.events.find(event=>same(event.ref,challengeRef));if(!journal.complete||!original||original.snapshot.request.purpose!=='EXECUTION_REQUEST')return reject();
     const head=[...journal.events].reverse().find(event=>event.ref.id===challengeRef.id),current=cloneV1(await tx.challenges.current()),context:any=current.context;if(head?.snapshot.consumption&&!same(head.snapshot.consumption.resultRef,resultRef))return reject();
     const descriptor={kind:'SYNTHETIC_VERIFIED_REQUEST_PROOF',ref:cloneV1(resultRef),target,grantRef:cloneV1(scope.grantRef),credentialGeneration:scope.credentialGeneration,publicKeyFingerprint:context.publicKeyFingerprint,verifiedAt:head?.snapshot.consumption?.consumedAt??await tx.challenges.clock(),challengeExpiresAt:original.snapshot.publicChallenge.expiresAt};
     const permits=new SyntheticInstructionPermits({transport:'SYNTHETIC_ONLY',transaction:async(s,body)=>{if(!same(s,scope))return reject();return body({...tx.permits,current:async id=>{const basis=cloneV1(await tx.permits.current(id));if(!recordV1(basis,['transport','record','reservation','fact','grantRef','grantExpiresAt','authorizationReceiptRef','turnState'])||basis.transport!=='SYNTHETIC_ONLY')return reject();return{...basis,proof:cloneV1(descriptor)};}});}});
     const permit=await permits.consume(cloneV1(scope),commandId as string,request),saved=await tx.permits.read(),entry=saved.permits.find(record=>same(record.ref,permit.permitRef));this.#port();if(!saved.complete||!entry||!same(entry.snapshot.proofRef,resultRef))return reject();return permit;
    };
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,body)=>{if(!same(s,scope))return reject();return body({...tx.challenges,recordResult:async value=>{this.#port();const ref=cloneV1(await tx.challenges.recordResult(value));await permitFor(ref,true);return ref;}});}});
    const first=await challenges.consume(cloneV1(scope),challengeRef,proof,signature),permit=await permitFor(first.resultRef),final=await challenges.consume(cloneV1(scope),challengeRef,proof,signature),lastPermit=await permitFor(first.resultRef),endedAt=await tx.challenges.clock();this.#port();if(!isoV1(endedAt)||Date.parse(permit.expiresAt)<=Date.parse(endedAt)||!same(permit,lastPermit)||!same(first,final)||first.nonceConsumed!==true||first.credentialIssued!==false||first.executionAuthorized!==false||first.dispatchPerformed!==false)return reject();return{transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(first.resultRef),permit:cloneV1(permit),nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   });
  }catch{return reject();}
 }
}
