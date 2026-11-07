import {canonicalJson} from '../../../../contracts/canonical.ts';
import {hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {planSourceContentRequestTransitionV1} from './source-content-request-transition.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_CAS_INVALID');};
/** 고정 비교 조건만 작성한다. SQL 실행·현재 권위·원자 저장의 증거가 아니다. */
export function planSourceContentRequestCasV1(beforeValue:unknown,afterValue:unknown,expectedDigest:unknown,nowMs:number) {
 try {
  if(!hashV1(expectedDigest))return invalid();
  const detach=(value:unknown)=>{const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>1048576)return invalid();return JSON.parse(raw);};
  const before=detach(beforeValue),after=detach(afterValue);
  const transition=planSourceContentRequestTransitionV1(before,after,nowMs);
  return {...transition,status:'UNVERIFIED_CAS_PREDICATE_CANDIDATE' as const,
   comparison:transition.replay?null:{sql:'r.project_id=$1 AND r.id=$2 AND anvil.source_content_request_cas_digest(r)=$3',parameters:[before.scope.projectId,transition.requestRef.id,expectedDigest]}};
 }catch{return invalid();}
}
