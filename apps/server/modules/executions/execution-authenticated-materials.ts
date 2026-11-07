import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {SyntheticExecutionMaterials,type SyntheticMaterialTransaction} from './execution-materials.ts';
import {executionTarget} from './execution-proof.ts';
type Material=Awaited<ReturnType<SyntheticExecutionMaterials['read']>>;
type Binding={target:unknown;materialRef:RuntimeRefV1;contentHash:string};
export interface SyntheticAuthenticatedMaterialStore{
 transport:'SYNTHETIC_ONLY';
 /** 현재 source/명령 잠금·proof nonce/결과·원 material binding을 한 COMMIT/rollback으로 처리한다.
  * materials.current는 proof 없는 8필드 basis만 공급한다. bytes는 binding에 중복 저장하지 않는다. */
 transaction<T>(scope:SyntheticChallengeScope,body:(tx:{challenges:SyntheticChallengeTransaction;materials:SyntheticMaterialTransaction;results:{bind(proofResultRef:RuntimeRefV1,binding:Binding):Promise<void>;read(proofResultRef:RuntimeRefV1):Promise<Binding|null>}})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const reject=():never=>{throw new AuthFailure('AUTHENTICATED_MATERIAL_REJECTED',412);};
/** P1 서명 자료 연결. 실제 원문 provider/HTTP/credential/실행 권한을 만들지 않는다. */
export class SyntheticAuthenticatedMaterials{
 readonly store:SyntheticAuthenticatedMaterialStore;
 constructor(store:SyntheticAuthenticatedMaterialStore){if(!store||store.transport!=='SYNTHETIC_ONLY'||typeof store.transaction!=='function')reject();this.store=store;}
 async read(rawScope:unknown,commandId:unknown,materialId:unknown,rawChallengeRef:unknown,rawProof:unknown,signature:unknown){return(await this.readWithDeadline(rawScope,commandId,materialId,rawChallengeRef,rawProof,signature)).result;}
 /** 내부 router에만 최단 기한을 전달한다. 기존 read 응답과 receiver 형식은 보존한다. */
 async readWithDeadline(rawScope:unknown,commandId:unknown,materialId:unknown,rawChallengeRef:unknown,rawProof:unknown,signature:unknown){
  try{
   if(this.store.transport!=='SYNTHETIC_ONLY'||!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'||!uuidV1(rawScope.projectId)||!uuidV1(rawScope.connectorId)||!uuidV1(rawScope.executionId)||!positive(rawScope.executionGeneration)||!positive(rawScope.credentialGeneration)||!refV1(rawScope.grantRef)||!uuidV1(commandId)||!uuidV1(materialId)||!refV1(rawChallengeRef)||rawChallengeRef.version!==1||typeof signature!=='string'||signature.length>128)return reject();
   const scope=cloneV1(rawScope) as unknown as SyntheticChallengeScope,challengeRef=cloneV1(rawChallengeRef) as RuntimeRefV1,proof=cloneV1(rawProof),target=executionTarget('GET','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+commandId+'/materials/'+materialId,[],null);
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const materialFor=async(resultRef:RuntimeRefV1)=>{
     const journal=await tx.challenges.read(),original=journal.events.find(e=>same(e.ref,challengeRef));if(!journal.complete||!original||original.snapshot.request.purpose!=='EXECUTION_REQUEST')return reject();
     const head=[...journal.events].reverse().find(e=>e.ref.id===challengeRef.id),current=cloneV1(await tx.challenges.current()),c:any=current.context;
     if(head?.snapshot.consumption&&!same(head.snapshot.consumption.resultRef,resultRef))return reject();
     const descriptor={kind:'SYNTHETIC_VERIFIED_REQUEST_PROOF',ref:cloneV1(resultRef),target,grantRef:cloneV1(scope.grantRef),credentialGeneration:scope.credentialGeneration,publicKeyFingerprint:c.publicKeyFingerprint,verifiedAt:head?.snapshot.consumption?.consumedAt??await tx.challenges.clock(),challengeExpiresAt:original.snapshot.publicChallenge.expiresAt};
     const materials=new SyntheticExecutionMaterials({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{if(!same(s,scope))return reject();return fn({...tx.materials,current:async(cmd,part)=>{const basis=cloneV1(await tx.materials.current(cmd,part));if(!recordV1(basis,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','material','sourceState']))return reject();return{...basis,proof:cloneV1(descriptor)};}});}});
     return materials.readWithDeadline(cloneV1(scope),commandId,materialId);
    };
    let first:Material|undefined;
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{if(!same(s,scope))return reject();return fn({...tx.challenges,recordResult:async value=>{const ref=cloneV1(await tx.challenges.recordResult(value));first=(await materialFor(ref)).material;await tx.results.bind(cloneV1(ref),{target:cloneV1(target),materialRef:cloneV1(first.materialRef),contentHash:first.contentHash});return ref;}});}});
    const before=await challenges.consume(cloneV1(scope),challengeRef,proof,signature),stored=cloneV1(await tx.results.read(cloneV1(before.resultRef)));
    // 이미 소비한 proof에 binding이 없으면 과거 결과를 사후 생성하거나 자료를 다시 읽지 않는다.
    if(!recordV1(stored,['target','materialRef','contentHash'])||!same(stored.target,target)||!refV1(stored.materialRef)||stored.materialRef.id!==materialId)return reject();
    if(first&&!same(stored,{target,materialRef:first.materialRef,contentHash:first.contentHash}))return reject();
    const final=await challenges.consume(cloneV1(scope),challengeRef,proof,signature);if(!same(before,final)||before.nonceConsumed!==true||before.credentialIssued!==false||before.executionAuthorized!==false||before.dispatchPerformed!==false)return reject();
    // 소비 proof 재조회는 과거 기한을 갱신하지 않는다. 마지막 await 뒤 current/source·최단 기한과 bytes를 다시 검증한다.
    const selected=await materialFor(before.resultRef),material=selected.material;if(!same(stored,{target,materialRef:material.materialRef,contentHash:material.contentHash}))return reject();
    return{validUntil:selected.validUntil,result:{transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(before.resultRef),material,nonceConsumed:true as const,executionAuthorized:false,dispatchPerformed:false}};
   });
  }catch{return reject();}
 }
}
