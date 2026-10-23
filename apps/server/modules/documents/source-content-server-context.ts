import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentRequestStatusForDeclaredContextCandidate} from './source-content-request-context.ts';
import {sourceContentServerIdentityPortCandidate} from './source-content-server-identity.ts';
import {readSourceContentProjectControlPortCandidate} from './source-content-project-control.ts';
import {readSourceContentStoredPreparationForDeclaredContextCandidate} from './source-content-stored-preparation.ts';

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
const invalid=():never=>{throw Error('SOURCE_CONTENT_SERVER_CONTEXT_INVALID');};
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
