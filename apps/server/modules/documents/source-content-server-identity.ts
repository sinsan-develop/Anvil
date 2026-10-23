import {recordV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';

interface Candidate {status:'UNVERIFIED';actorId:string;clientId:string;credentialGeneration:number}
const result=(status:'UNVERIFIED'|'DENIED',reason:string,candidate:Candidate|null=null)=>({status,reason,candidate,
 currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
function data(value:unknown,keys:string[]):Record<string,any>|null{
 if(!recordV1(value,keys))return null;
 return Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(value)).map(([key,p])=>[key,p.value]));
}
/** 서버 AuthenticatedIdentity 모양의 자료를 최소 후보로만 투영한다. 인증 함수/DB/토큰을 읽거나 진위를 인증하지 않는다.
 * 이 후보는 optional authSession이 없는 과거 입력을 지원하지 않는다. 주어진 now는 실제 DB 시각의 증명이 아니다. */
export function projectSourceContentServerIdentityCandidate(value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_SERVER_IDENTITY_INPUT_INVALID');
 try{
  const v=data(value,['actorId','clientId','serverOwner','credentialGeneration','reauthUntil','authSession']);
  if(!v||!uuidV1(v.actorId)||!uuidV1(v.clientId)||typeof v.serverOwner!=='boolean'
   ||!Number.isSafeInteger(v.credentialGeneration)||v.credentialGeneration<1)return result('DENIED','SERVER_IDENTITY_SHAPE_UNAVAILABLE');
  const s=data(v.authSession,['id','idleExpiresAt','absoluteExpiresAt']);
  if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return result('DENIED','SERVER_SESSION_SHAPE_UNAVAILABLE');
  const idle=Date.parse(s.idleExpiresAt),absolute=Date.parse(s.absoluteExpiresAt);
  if(idle>absolute||nowMs>=idle||nowMs>=absolute)return result('DENIED','SERVER_SESSION_TIME_UNAVAILABLE');
  if(v.reauthUntil!==null){
   if(typeof v.reauthUntil!=='object'||Object.getPrototypeOf(v.reauthUntil)!==Date.prototype)return result('DENIED','SERVER_REAUTH_SHAPE_UNAVAILABLE');
   const reauth=Date.prototype.toISOString.call(v.reauthUntil);
   if(!isoV1(reauth)||Date.parse(reauth)>absolute)return result('DENIED','SERVER_REAUTH_SHAPE_UNAVAILABLE');
  }
  // serverOwner/reauthUntil/authSession/만료시각은 포트에 내보내거나 별도 작업 허가로 사용하지 않는다.
  return result('UNVERIFIED','SERVER_IDENTITY_SHAPE_ONLY',{status:'UNVERIFIED',actorId:v.actorId,clientId:v.clientId,credentialGeneration:v.credentialGeneration});
 }catch{return result('DENIED','SERVER_IDENTITY_SHAPE_UNAVAILABLE');}
}
/** 비활성 서버 포트의 최소 4키. 실제 인증 생산자는 제공하지 않으며 실패 원문도 반환하지 않는다. */
export function sourceContentServerIdentityPortCandidate(value:unknown,nowMs:number){
 const v=projectSourceContentServerIdentityCandidate(value,nowMs);
 return v.candidate??{status:'DENIED' as const,reason:'SERVER_IDENTITY_UNAVAILABLE'};
}
