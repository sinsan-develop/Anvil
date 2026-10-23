import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentRequestStatusForDeclaredContextCandidate} from './source-content-request-context.ts';
import {sourceContentServerIdentityPortCandidate} from './source-content-server-identity.ts';
import {readSourceContentProjectControlPortCandidate} from './source-content-project-control.ts';
import {readSourceContentStoredPreparationForDeclaredContextCandidate} from './source-content-stored-preparation.ts';
import {readSourceContentStoredReportProofForDeclaredContextCandidate,readSourceContentStoredReportProofWithPolicyForDeclaredContextCandidate,readSourceContentScreenForDeclaredContextCandidate,readSourceContentStoredPolicyLineageForDeclaredContextCandidate,readSourceContentStoredRevokeForDeclaredContextCandidate,readSourceContentStoredVerificationForDeclaredContextCandidate} from './source-content-request-record.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
/** 서버 보유 값 모양과 구체 판독 후보의 비활성 조합. 실제 인증 생산자/route/DB 실행은 연결하지 않는다.
 * 모든 조회는 caller가 준 db를 사용하지만 실제 transaction/현재 권위의 증명은 아니다. */
export function readSourceContentRequestStatusFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,nowMs:number){
 return readSourceContentRequestStatusFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,nowMs);
}
/** 보유 값 투영/구체 control 판독을 준비에 연결한 비활성 SOURCE. 실제 인증 함수를 호출하지 않는다. */
export function readSourceContentPreparationFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,nowMs:number){
 return readSourceContentPreparationFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,nowMs);
}
/** 보유 값/구체 control을 proof 후보에 결박하지만 실제 인증 producer는 연결하지 않는다. */
export function readSourceContentProofFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,nowMs:number){
 return readSourceContentProofFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,nowMs);
}
/** 보유 값과 구체 control의 후보를 기존 과거 proof/최신 정책 조합에만 전달한다. */
export function readSourceContentProofWithPolicyFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,nowMs:number){
 return readSourceContentProofWithPolicyFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,nowMs);
}
/** 최소 표시자료의 비활성 소비. 보유 값 투영과 구체 control 판독 외 실제 인증을 하지 않는다. */
export function readSourceContentScreenFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,nowMs:number){
 return readSourceContentScreenFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,nowMs);
}
const invalid=():never=>{throw Error('SOURCE_CONTENT_SERVER_CONTEXT_INVALID');};
/** 기존 보유 문맥/구체 control만 조합하며 actual 인증·verifier·현재 권위를 추가하지 않는다. */
export function readSourceContentVerificationFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,targetIndex:number,nowMs:number){
 return readSourceContentVerificationFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,targetIndex,nowMs);
}
/** 원보고의 조회 문맥만 전달한다. 같은 db의 분리 조회를 현재 허가·원자성으로 승격하지 않는다. */
export async function readSourceContentVerificationFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,targetIndex:number,nowMs:number){
 if(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>199)throw Error('SOURCE_CONTENT_SERVER_VERIFICATION_INPUT_INVALID');
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,requestRef:null,observationRef:null,verificationRef:null,targetIndex:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,
  storedRequestAuthenticated:false as const,signatureVerified:false as const,bodyBytesVerified:false as const,currentAuthorityVerified:false as const,
  storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentStoredVerificationForDeclaredContextCandidate(db,c,targetIndex,nowMs),close);
}
/** 실제 인증·현재 회수허가가 아닌 기존 보유문맥/구체 control의 SOURCE 조합이다. */
export function readSourceContentRevokeFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,payload:unknown,commandId:unknown,nowMs:number){
 return readSourceContentRevokeFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,payload,commandId,nowMs);
}
/** 첫 문맥 await 전 회수 입력을 고정한다. 기존 상태/proof 경로·정책/실제 쓰기는 변경하지 않는다. */
export async function readSourceContentRevokeFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,payloadValue:unknown,commandId:unknown,nowMs:number){
 let payload:Record<string,any>;
 try {
  const raw=canonicalJson(payloadValue);if(Buffer.byteLength(raw,'utf8')>1048576||!uuidV1(commandId))throw Error();
  const p:unknown=JSON.parse(raw);if(!recordV1(p,['requestRef','reason'])||!refV1(p.requestRef)||p.requestRef.version!==1)throw Error();payload=p;
 }catch{throw Error('SOURCE_CONTENT_SERVER_REVOKE_INPUT_INVALID');}
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,candidate:null,
  storedRequestAuthenticated:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentStoredRevokeForDeclaredContextCandidate(db,c,payload,commandId,nowMs),close);
}
/** 보유 값/구체 control의 비활성 조합이며 실제 인증 생산자나 관리 권위를 연결하지 않는다. */
export function readSourceContentPolicyLineageFromHeldIdentityCandidate(db:ReadClient,heldIdentity:unknown,basis:unknown,nowMs:number){
 return readSourceContentPolicyLineageFromServerContextCandidate(db,{
  readIdentityCandidate:()=>sourceContentServerIdentityPortCandidate(heldIdentity,nowMs),
  readControlCandidate:readSourceContentProjectControlPortCandidate
 },basis,nowMs);
}
/** 기존 서버 문맥을 저장계보 소비에만 결박한다. 최신 음성·분리조회·권위 false를 보존한다. */
export function readSourceContentPolicyLineageFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,requestRef:null,policyRef:null,lineage:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,
  storedRequestAuthenticated:false as const,managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,
  storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentStoredPolicyLineageForDeclaredContextCandidate(db,c,nowMs),close);
}
const closed=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,summary:null,
 declaredContextAuthenticated:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
function copy(value:unknown,keys:string[]):Record<string,any>|null{
 try{if(!recordV1(value,keys))return null;const raw=canonicalJson(value);return Buffer.byteLength(raw,'utf8')<=4096?JSON.parse(raw):null;}catch{return null;}
}
/** caller-owned 연결에 넘길 판독 접점 SOURCE. 실제 인증/프로젝트 제어 adapter는 제공하지 않는다.
 * 동일 db 객체 사용은 실제 transaction 존재·격리/원자성·현재 권위의 증명이 아니다. BEGIN/COMMIT/route 등록0. */
export function readSourceContentRequestStatusFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentRequestStatusForDeclaredContextCandidate(db,c,nowMs),closed);
}
/** 같은 서버 후보 문맥을 준비에도 결박하되 실제 인증 생산자/허가/route는 제공하지 않는다. */
export function readSourceContentPreparationFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,candidate:null,failedBoundary:'CONTEXT' as const,failedTargetIndex:null,
  readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,declaredContextAuthenticated:false as const,storedRequestAuthenticated:false as const,
  preparationAuthorized:false as const,bodyBytesVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentStoredPreparationForDeclaredContextCandidate(db,c,nowMs),close);
}
/** 기존 후보 문맥을 proof 소비에만 전달하며 현재 권위·원자성·공개 전송을 만들지 않는다. */
export function readSourceContentProofFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,candidate:null,
  storedRequestAuthenticated:false as const,signatureVerified:false as const,currentAuthorityVerified:false as const,
  storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentStoredReportProofForDeclaredContextCandidate(db,c,nowMs),close);
}
/** 동일 서버 후보 문맥을 재사용한다. 분리 정책 조회를 현재 권한·원자성·공개 전송으로 승격하지 않는다. */
export function readSourceContentProofWithPolicyFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,historicalProof:null,policy:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,
  storedRequestAuthenticated:false as const,signatureVerified:false as const,currentAuthorityVerified:false as const,
  storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentStoredReportProofWithPolicyForDeclaredContextCandidate(db,c,nowMs),close);
}
/** 같은 서버 문맥/판독 자료의 최소 화면 후보만 반환한다. 공개 전송·route 등록은 없다. */
export function readSourceContentScreenFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 const close=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,summary:null,proof:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,
  storedRequestAuthenticated:false as const,signatureVerified:false as const,currentAuthorityVerified:false as const,
  storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
 return readServerContext(db,sources,basis,nowMs,c=>readSourceContentScreenForDeclaredContextCandidate(db,c,nowMs),close);
}
async function readServerContext<T,C>(db:ReadClient,sources:unknown,basis:unknown,nowMs:number,consume:(context:Record<string,any>)=>Promise<T>,close:(status:'UNAVAILABLE'|'DENIED',reason:string)=>C){
 const b=copy(basis,['installationId','projectId','requestRef']);
 if(!Number.isSafeInteger(nowMs)||!b||!uuidV1(b.installationId)||!uuidV1(b.projectId)||!refV1(b.requestRef)||b.requestRef.version!==1)return invalid();
 if(!recordV1(sources,['readIdentityCandidate','readControlCandidate']))return close('UNAVAILABLE','SERVER_CONTEXT_READERS_UNAVAILABLE');
 const d=Object.getOwnPropertyDescriptors(sources),readIdentity=d.readIdentityCandidate!.value,readControl=d.readControlCandidate!.value;
 if(typeof readIdentity!=='function'||typeof readControl!=='function')return close('UNAVAILABLE','SERVER_CONTEXT_READERS_UNAVAILABLE');
 const identity=copy(await readIdentity(db),['status','actorId','clientId','credentialGeneration']);
 if(!identity||identity.status!=='UNVERIFIED'||!uuidV1(identity.actorId)||!uuidV1(identity.clientId)
  ||!Number.isSafeInteger(identity.credentialGeneration)||identity.credentialGeneration<1)return close('DENIED','SERVER_IDENTITY_CANDIDATE_INVALID');
 // 판독 callback에는 복사본만 준다. callback이 바꾼 identity를 이후 권위/대조 값으로 다시 읽지 않는다.
 const rawControl=await readControl(db,b.projectId,{...identity});
 const negative=copy(rawControl,['status','reason']);
 if(negative){
  // 허용된 음성 코드만 보존한다. 자유문자열·불일치 조합은 밖으로 내보내지 않는다.
  if(negative.status==='UNAVAILABLE'&&['PROJECT_ABSENT','BASE_POLICY_ABSENT'].includes(negative.reason))return close('UNAVAILABLE',negative.reason);
  if(negative.status==='DENIED'&&['PROJECT_ARCHIVED','OWNER_CONTROL_UNAVAILABLE','PROJECT_CONTROL_UNAVAILABLE','BASE_POLICY_HEAD_UNAVAILABLE','BASE_POLICY_SHAPE_UNAVAILABLE','MALFORMED_CONTROL_PROJECTION'].includes(negative.reason))return close('DENIED',negative.reason);
  return close('DENIED','PROJECT_CONTROL_CANDIDATE_INVALID');
 }
 const control=copy(rawControl,['status','projectId','actorId','clientId','controlGeneration','basePolicyRef']);
 if(!control||control.status!=='UNVERIFIED'||control.projectId!==b.projectId||control.actorId!==identity.actorId||control.clientId!==identity.clientId
  ||!Number.isSafeInteger(control.controlGeneration)||control.controlGeneration<1||!refV1(control.basePolicyRef))return close('DENIED','PROJECT_CONTROL_CANDIDATE_INVALID');
 return consume({installationId:b.installationId,projectId:b.projectId,requestRef:b.requestRef,
  userId:identity.actorId,clientId:identity.clientId,credentialGeneration:identity.credentialGeneration,
  controlGeneration:control.controlGeneration,basePolicyRef:control.basePolicyRef});
}
