import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {planSourceContentRequestTransitionV1} from './source-content-request-transition.ts';
import {planSourceContentRequestCasV1} from './source-content-request-cas.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_REVOKE_INPUT_INVALID');};
function copy(value:unknown){const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>1048576)return invalid();return JSON.parse(raw);}
/** 기존 exact2 회수 입력을 원전이/CAS 후보에만 연결한다. 인증·현재정책·원자 저장/route는 제공하지 않는다. */
export function planSourceContentRevokeCandidate(beforeValue:unknown,payloadValue:unknown,commandId:unknown,expectedDigest:unknown,nowMs:number){
 try {
  if(!uuidV1(commandId)||!Number.isSafeInteger(nowMs))return invalid();
  const before=copy(beforeValue),payload=copy(payloadValue);
  planSourceContentRequestTransitionV1(before,before,nowMs);
  if(!recordV1(payload,['requestRef','reason'])||!refV1(payload.requestRef)||payload.requestRef.version!==1
   ||canonicalJson(payload.requestRef)!==canonicalJson(before.requestRef)||['REVOKED','EXPIRED'].includes(before.state))return invalid();
  // 이유 문자열은 기존 content 요청의 동일 규칙으로 검사하며 원 scope를 변경하지 않는다.
  readSourceContentScopeV1({...before.scope,reason:payload.reason});
  const at=new Date(nowMs).toISOString(),after={...before,state:'REVOKED',revokedAt:at,revokeCommandId:commandId,updatedAt:at};
  const candidate=planSourceContentRequestCasV1(before,after,expectedDigest,nowMs);
  return {...candidate,status:'UNVERIFIED_REVOKE_CANDIDATE' as const,revokeCommandId:commandId,reasonDigest:contentHash(canonicalJson({reason:payload.reason}))};
 }catch{return invalid();}
}
