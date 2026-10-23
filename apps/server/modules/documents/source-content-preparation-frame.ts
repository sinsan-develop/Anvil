import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readSourceContentLocationFrameCandidate} from './source-content-location-frame.ts';
import {readSourceContentTargetDocumentsCandidate} from './source-content-target-document.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const result=(status:'UNVERIFIED'|'UNAVAILABLE'|'DENIED',reason:string,candidate:unknown=null,failedBoundary:'LOCATION'|'DOCUMENTS'|null=null,failedTargetIndex:number|null=null)=>({status,reason,candidate,failedBoundary,failedTargetIndex,
 readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,preparationAuthorized:false as const,bodyBytesVerified:false as const,
 currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
/** 고정scope의 위치→전체문서 metadata를 순서 소비하는 닫힌 SOURCE 준비 후보.
 * 현재 인증/정책·키/서명/observer·파일/OS·실verifier 검증과 실행 준비 허가를 만들지 않는다. route 미등록. */
export async function readSourceContentPreparationFrameCandidate(db:ReadClient,value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_PREPARATION_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value),scopeDigest=contentHash(canonicalJson(scope));
 const location=await readSourceContentLocationFrameCandidate(db,scope,nowMs);
 if(location.status!=='UNVERIFIED')return result(location.status,location.reason,null,'LOCATION');
 const documents=await readSourceContentTargetDocumentsCandidate(db,scope,nowMs);
 if(documents.status!=='UNVERIFIED')return result(documents.status,documents.reason,null,'DOCUMENTS',documents.failedTargetIndex);
 return result('UNVERIFIED','PREPARATION_FRAMES_ONLY',{scopeDigest,location:location.candidate,documents:documents.candidate});
}
