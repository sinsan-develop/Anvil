import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentRequestStatusForDeclaredContextCandidate} from './source-content-request-context.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const invalid=():never=>{throw Error('SOURCE_CONTENT_SERVER_CONTEXT_INVALID');};
const closed=(status:'UNAVAILABLE'|'DENIED',reason:string)=>({status,reason,summary:null,
 declaredContextAuthenticated:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
function copy(value:unknown,keys:string[]):Record<string,any>|null{
 try{if(!recordV1(value,keys))return null;const raw=canonicalJson(value);return Buffer.byteLength(raw,'utf8')<=4096?JSON.parse(raw):null;}catch{return null;}
}
/** caller-owned 연결에 넘길 판독 접점 SOURCE. 실제 인증/프로젝트 제어 adapter는 제공하지 않는다.
 * 동일 db 객체 사용은 실제 transaction 존재·격리/원자성·현재 권위의 증명이 아니다. BEGIN/COMMIT/route 등록0. */
export async function readSourceContentRequestStatusFromServerContextCandidate(db:ReadClient,sources:unknown,basis:unknown,nowMs:number){
 const b=copy(basis,['installationId','projectId','requestRef']);
 if(!Number.isSafeInteger(nowMs)||!b||!uuidV1(b.installationId)||!uuidV1(b.projectId)||!refV1(b.requestRef)||b.requestRef.version!==1)return invalid();
 if(!recordV1(sources,['readIdentityCandidate','readControlCandidate']))return closed('UNAVAILABLE','SERVER_CONTEXT_READERS_UNAVAILABLE');
 const d=Object.getOwnPropertyDescriptors(sources),readIdentity=d.readIdentityCandidate!.value,readControl=d.readControlCandidate!.value;
 if(typeof readIdentity!=='function'||typeof readControl!=='function')return closed('UNAVAILABLE','SERVER_CONTEXT_READERS_UNAVAILABLE');
 const identity=copy(await readIdentity(db),['status','actorId','clientId','credentialGeneration']);
 if(!identity||identity.status!=='UNVERIFIED'||!uuidV1(identity.actorId)||!uuidV1(identity.clientId)
  ||!Number.isSafeInteger(identity.credentialGeneration)||identity.credentialGeneration<1)return closed('DENIED','SERVER_IDENTITY_CANDIDATE_INVALID');
 // 판독 callback에는 복사본만 준다. callback이 바꾼 identity를 이후 권위/대조 값으로 다시 읽지 않는다.
 const control=copy(await readControl(db,b.projectId,{...identity}),['status','projectId','actorId','clientId','controlGeneration','basePolicyRef']);
 if(!control||control.status!=='UNVERIFIED'||control.projectId!==b.projectId||control.actorId!==identity.actorId||control.clientId!==identity.clientId
  ||!Number.isSafeInteger(control.controlGeneration)||control.controlGeneration<1||!refV1(control.basePolicyRef))return closed('DENIED','PROJECT_CONTROL_CANDIDATE_INVALID');
 return readSourceContentRequestStatusForDeclaredContextCandidate(db,{installationId:b.installationId,projectId:b.projectId,requestRef:b.requestRef,
  userId:identity.actorId,clientId:identity.clientId,credentialGeneration:identity.credentialGeneration,
  controlGeneration:control.controlGeneration,basePolicyRef:control.basePolicyRef},nowMs);
}
