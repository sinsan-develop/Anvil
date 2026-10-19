import {canonicalJson,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {SyntheticExecutionObservations,type ObservationScope,type SyntheticObservationTransaction} from './execution-observations.ts';
import {executionTarget} from './execution-proof.ts';

export interface SyntheticAuthenticatedObservationTransaction{challenges:SyntheticChallengeTransaction;observations:SyntheticObservationTransaction}
export interface SyntheticAuthenticatedObservationStore{
 transport:'SYNTHETIC_ONLY';
 /** 같은 실행/세대의 현재 권한 잠금·nonce/결과·관측·ACK를 단일 COMMIT/rollback으로 집행한다. */
 transaction<T>(scope:ObservationScope,body:(tx:SyntheticAuthenticatedObservationTransaction)=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('AUTHENTICATED_OBSERVATION_REJECTED',412);};
/** P1 합성 내부 연결이다. 실제 HTTP/credential/OS·Agent를 활성화하지 않는다.
 * 서명 대상은 caller 설명이 아니라 scope에서 정한 정확 POST 경로와 검증할 원본 JSON body다. */
export class SyntheticAuthenticatedObservations{
 readonly store:SyntheticAuthenticatedObservationStore;
 constructor(store:SyntheticAuthenticatedObservationStore){if(!store||store.transport!=='SYNTHETIC_ONLY'||typeof store.transaction!=='function')reject();this.store=store;}
 async ingest(rawScope:unknown,rawChallengeRef:unknown,rawProof:unknown,signature:unknown,bodyRaw:unknown){
  try{
   if(this.store.transport!=='SYNTHETIC_ONLY'||!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])
    ||!['EXECUTION','RECOVERY'].includes(rawScope.mode)||!uuidV1(rawScope.projectId)||!uuidV1(rawScope.connectorId)||!uuidV1(rawScope.executionId)
    ||!Number.isSafeInteger(rawScope.executionGeneration)||Number(rawScope.executionGeneration)<1||!Number.isSafeInteger(rawScope.credentialGeneration)||Number(rawScope.credentialGeneration)<1
    ||!refV1(rawScope.grantRef)||!refV1(rawChallengeRef)||rawChallengeRef.version!==1||typeof signature!=='string'||signature.length>128||typeof bodyRaw!=='string'||Buffer.byteLength(bodyRaw)>1024*1024)return reject();
   const scope=cloneV1(rawScope) as unknown as ObservationScope,challengeRef=cloneV1(rawChallengeRef) as RuntimeRefV1,proof=cloneV1(rawProof);
   const path='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+(scope.mode==='RECOVERY'?'/recovery':'')+'/observations';
   const target=executionTarget('POST',path,[],bodyRaw),batch=parseWireJson(bodyRaw);
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])
    ||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(cloneV1(scope),async tx=>{
    // 기존 service는 같은 tx 객체만 소비하며 nested BEGIN/새 connection을 만들지 않는다.
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{if(!same(s,scope))return reject();return fn(tx.challenges);}});
    const observations=new SyntheticExecutionObservations({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{if(!same(s,scope))return reject();return fn(tx.observations);}});
    const before=await challenges.consume(cloneV1(scope),challengeRef,proof,signature);
    const ack=await observations.ingest(cloneV1(scope),batch);
    const final=await challenges.consume(cloneV1(scope),challengeRef,proof,signature);
    if(!same(before,final)||before.nonceConsumed!==true||before.credentialIssued!==false||before.executionAuthorized!==false||before.dispatchPerformed!==false)return reject();
    return{transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(before.resultRef),ack:cloneV1(ack),nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   });
  }catch{return reject();}
 }
}
