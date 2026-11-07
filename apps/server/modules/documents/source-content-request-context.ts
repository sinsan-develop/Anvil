import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentRequestRecordCandidate} from './source-content-request-record.ts';
import {readSourceContentRequestPolicyCandidate} from './source-content-request-policy.ts';
import {sourceContentRequestStatusFromParts} from './source-content-request-with-policy.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const invalid=():never=>{throw Error('SOURCE_CONTENT_CONTEXT_INVALID');};
export function readSourceContentDeclaredContextCandidate(value:unknown,nowMs:number){
 try{
  if(!Number.isSafeInteger(nowMs)||!recordV1(value,['installationId','projectId','requestRef','userId','clientId','credentialGeneration','controlGeneration','basePolicyRef']))return invalid();
  const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>4096)return invalid();
  const c=JSON.parse(raw);
  if(!['installationId','projectId','userId','clientId'].every(k=>uuidV1(c[k]))||!refV1(c.requestRef)||c.requestRef.version!==1||!refV1(c.basePolicyRef)
   ||!['credentialGeneration','controlGeneration'].every(k=>Number.isSafeInteger(c[k])&&c[k]>0))return invalid();
  return c;
 }catch{return invalid();}
}
type Summary=ReturnType<typeof sourceContentRequestStatusFromParts>;
const result=(status:'UNAVAILABLE'|'DENIED'|'UNVERIFIED',reason:string,summary:Summary|null=null)=>({status,reason,summary,
 declaredContextAuthenticated:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
/** 선언 값 대조 SOURCE일 뿐 실제 session/등록·정책의 현재성을 인증하지 않는다. route·브라우저 입력에는 연결하지 않는다. */
export async function readSourceContentRequestStatusForDeclaredContextCandidate(db:ReadClient,declaredContext:unknown,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(declaredContext,nowMs);
 const request=await readSourceContentRequestRecordCandidate(db,c.installationId,c.projectId,c.requestRef.id,nowMs);
 if(request===null)return result('UNAVAILABLE','REQUEST_ABSENT');
 const {scope,requestRef}=request.view;
 if(canonicalJson(requestRef)!==canonicalJson(c.requestRef)||scope.userId!==c.userId||scope.clientId!==c.clientId
  ||scope.credentialGeneration!==c.credentialGeneration||scope.controlGeneration!==c.controlGeneration
  ||canonicalJson(scope.basePolicyRef)!==canonicalJson(c.basePolicyRef))return result('DENIED','DECLARED_CONTEXT_MISMATCH');
 const policy=await readSourceContentRequestPolicyCandidate(db,scope,nowMs);
 return result('UNVERIFIED','DECLARED_VALUES_MATCH_NOT_AUTHENTICATED',sourceContentRequestStatusFromParts(request,policy));
}
