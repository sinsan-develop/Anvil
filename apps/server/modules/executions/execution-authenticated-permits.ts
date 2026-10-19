import {canonicalJson,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {SyntheticCommandPermits,type SyntheticPermitTransaction} from './execution-permits.ts';
import {executionTarget} from './execution-proof.ts';
export interface SyntheticAuthenticatedPermitStore{
 transport:'SYNTHETIC_ONLY';
 /** 같은 실행/세대의 현재 권한·명령·proof nonce/결과·permit을 단일 tx에서 잠금/COMMIT/rollback한다.
  * permits.current는 검증 전 proof가 없는 6필드 basis만 제공한다. */
 transaction<T>(scope:SyntheticChallengeScope,body:(tx:{challenges:SyntheticChallengeTransaction;permits:SyntheticPermitTransaction})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('AUTHENTICATED_PERMIT_REJECTED',412);};
/** 필수 합성 port만 소비하는 P1 연결이다. 실제 OS permit/HTTP/credential/Agent는 제공하지 않는다. */
export class SyntheticAuthenticatedPermits{
 readonly store:SyntheticAuthenticatedPermitStore;
 constructor(store:SyntheticAuthenticatedPermitStore){if(!store||store.transport!=='SYNTHETIC_ONLY'||typeof store.transaction!=='function')reject();this.store=store;}
 /** 기존 실행기 7필드 port로만 투영하며 false 권한을 실행 허가로 승격하지 않는다. */
 async consumeForReceiver(scope:unknown,commandId:unknown,challengeRef:unknown,proof:unknown,signature:unknown,bodyRaw:unknown){
  const result=await this.consume(scope,commandId,challengeRef,proof,signature,bodyRaw),{executionAuthorized,dispatchPerformed,...permit}=result.permit;
  if(result.executionAuthorized!==false||result.dispatchPerformed!==false||executionAuthorized!==false||dispatchPerformed!==false)return reject();return permit;
 }
 async consume(rawScope:unknown,commandId:unknown,rawChallengeRef:unknown,rawProof:unknown,signature:unknown,bodyRaw:unknown){
  try{
   if(this.store.transport!=='SYNTHETIC_ONLY'||!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'
    ||!uuidV1(rawScope.projectId)||!uuidV1(rawScope.connectorId)||!uuidV1(rawScope.executionId)||!uuidV1(commandId)||!refV1(rawScope.grantRef)
    ||!Number.isSafeInteger(rawScope.executionGeneration)||Number(rawScope.executionGeneration)<1||!Number.isSafeInteger(rawScope.credentialGeneration)||Number(rawScope.credentialGeneration)<1
    ||!refV1(rawChallengeRef)||rawChallengeRef.version!==1||typeof signature!=='string'||signature.length>128||typeof bodyRaw!=='string'||Buffer.byteLength(bodyRaw)>2*1024*1024)return reject();
   const scope=cloneV1(rawScope) as unknown as SyntheticChallengeScope,challengeRef=cloneV1(rawChallengeRef) as RuntimeRefV1,proof=cloneV1(rawProof),request=parseWireJson(bodyRaw);
   const target=executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+commandId+'/permit',[],bodyRaw);
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const permitFor=async(resultRef:RuntimeRefV1,allowCreate=false)=>{
     if(!allowCreate){const saved=await tx.permits.read();if(!saved.complete||!saved.permits.some(e=>same(e.snapshot.proofRef,resultRef)))return reject();}
     const journal=await tx.challenges.read(),original=journal.events.find(e=>same(e.ref,challengeRef));
     if(!journal.complete||!original||original.snapshot.request.purpose!=='EXECUTION_REQUEST')return reject();
     const head=[...journal.events].reverse().find(e=>e.ref.id===challengeRef.id),current=cloneV1(await tx.challenges.current()),c:any=current.context;
     if(head?.snapshot.consumption&&!same(head.snapshot.consumption.resultRef,resultRef))return reject();
     const descriptor={kind:'SYNTHETIC_VERIFIED_REQUEST_PROOF',ref:cloneV1(resultRef),target,grantRef:cloneV1(scope.grantRef),credentialGeneration:scope.credentialGeneration,
      publicKeyFingerprint:c.publicKeyFingerprint,verifiedAt:head?.snapshot.consumption?.consumedAt??await tx.challenges.clock(),challengeExpiresAt:original.snapshot.publicChallenge.expiresAt};
     const permits=new SyntheticCommandPermits({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{
      if(!same(s,scope))return reject();return fn({...tx.permits,current:async id=>{
       const basis=cloneV1(await tx.permits.current(id));if(!recordV1(basis,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef']))return reject();
       return{...basis,proof:cloneV1(descriptor)};
      }});
     }});
     const permit=await permits.consume(cloneV1(scope),commandId,request),saved=await tx.permits.read(),entry=saved.permits.find(e=>same(e.ref,permit.permitRef));
     if(!saved.complete||!entry||!same(entry.snapshot.proofRef,resultRef))return reject();return permit;
    };
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{
     if(!same(s,scope))return reject();return fn({...tx.challenges,recordResult:async value=>{
      const ref=cloneV1(await tx.challenges.recordResult(value));await permitFor(ref,true);return ref;
     }});
    }});
    const before=await challenges.consume(cloneV1(scope),challengeRef,proof,signature),permit=await permitFor(before.resultRef),final=await challenges.consume(cloneV1(scope),challengeRef,proof,signature);
    if(!same(before,final)||before.nonceConsumed!==true||before.credentialIssued!==false||before.executionAuthorized!==false||before.dispatchPerformed!==false)return reject();
    return{transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(before.resultRef),permit:cloneV1(permit),nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   });
  }catch{return reject();}
 }
}
