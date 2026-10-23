import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readSourceContentRootHeadCandidate} from './source-content-root-head.ts';
import {readSourceContentRegistrationFrameCandidate} from './source-content-registration-frame.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const result=(status:'UNVERIFIED'|'UNAVAILABLE'|'DENIED',reason:string,candidate:unknown=null)=>({status,reason,candidate,
 readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,currentAuthorityVerified:false as const,
 storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
/** 원scope를 고정해 선언→상태전용 등록 frame을 순서 소비한다. 실제 auth/DB·키/서명·OS 검증이나 허가가 아니다.
 * 같은 caller db와 주어진 시각은 실제 transaction·현재 권위/원자성의 증명이 아니다. route 미등록. */
export async function readSourceContentLocationFrameCandidate(db:ReadClient,value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_LOCATION_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value);
 const root=await readSourceContentRootHeadCandidate(db,scope,nowMs);
 if(root.status!=='UNVERIFIED')return result(root.status,root.reason);
 const registration=await readSourceContentRegistrationFrameCandidate(db,scope,nowMs);
 if(registration.status!=='UNVERIFIED')return result(registration.status,registration.reason);
 return result('UNVERIFIED','LOCATION_FRAMES_ONLY',{sourceRootRef:{...scope.sourceRootRef},
  registrationRef:{...scope.registrationRef},connectorRef:{...scope.connectorRef}});
}
