import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentRequestRecordCandidate} from './source-content-request-record.ts';
import {readSourceContentRequestPolicyCandidate} from './source-content-request-policy.ts';
import {readSourceContentPreparationFrameCandidate} from './source-content-preparation-frame.ts';
import {readSourceContentDeclaredContextCandidate} from './source-content-request-context.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const invalid=():never=>{throw Error('SOURCE_CONTENT_STORED_PREPARATION_INPUT_INVALID');};
const result=(status:'UNVERIFIED'|'UNAVAILABLE'|'DENIED',reason:string,candidate:unknown=null,failedBoundary:'REQUEST'|'POLICY'|'LOCATION'|'DOCUMENTS'|null=null,failedTargetIndex:number|null=null)=>({status,reason,candidate,failedBoundary,failedTargetIndex,
 readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,storedRequestAuthenticated:false as const,preparationAuthorized:false as const,
 bodyBytesVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
/** 기존 저장 reader가 검증·복사한 scope만 닫힌 준비 frame으로 전달한다.
 * 저장 구조/ref 일치는 실제 인증/현재정책·transaction/원문·OS/verifier 권위가 아니다. route/실DB 미연결. */
export async function readSourceContentStoredPreparationCandidate(db:ReadClient,value:unknown,nowMs:number){
 let basis:Record<string,any>;
 try{if(!Number.isSafeInteger(nowMs)||!recordV1(value,['installationId','projectId','requestRef']))return invalid();const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>4096)return invalid();basis=JSON.parse(raw);
  if(!uuidV1(basis.installationId)||!uuidV1(basis.projectId)||!refV1(basis.requestRef)||basis.requestRef.version!==1)return invalid();
 }catch{return invalid();}
 return readStoredPreparation(db,basis,nowMs,null);
}
/** 서버 후보에서 만든 선언 문맥을 저장scope에 결박한다. 일치는 실제 인증/현재권위를 만들지 않는다. */
export async function readSourceContentStoredPreparationForDeclaredContextCandidate(db:ReadClient,value:unknown,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 return {...await readStoredPreparation(db,c,nowMs,c),declaredContextAuthenticated:false as const};
}
async function readStoredPreparation(db:ReadClient,basis:Record<string,any>,nowMs:number,binding:Record<string,any>|null){
 const request=await readSourceContentRequestRecordCandidate(db,basis.installationId,basis.projectId,basis.requestRef.id,nowMs);
 if(request===null)return result('UNAVAILABLE','STORED_REQUEST_ABSENT',null,'REQUEST');
 if(canonicalJson(request.view.requestRef)!==canonicalJson(basis.requestRef))return result('DENIED','STORED_REQUEST_REF_CHANGED',null,'REQUEST');
 if(!['CREATED','CHALLENGED','ISSUED'].includes(request.view.state))return result('DENIED','STORED_REQUEST_NOT_OPEN',null,'REQUEST');
 const s=request.view.scope;
 if(binding!==null&&(s.userId!==binding.userId||s.clientId!==binding.clientId||s.credentialGeneration!==binding.credentialGeneration
  ||s.controlGeneration!==binding.controlGeneration||canonicalJson(s.basePolicyRef)!==canonicalJson(binding.basePolicyRef)))return result('DENIED','DECLARED_PREPARATION_CONTEXT_MISMATCH',null,'REQUEST');
 const policy=await readSourceContentRequestPolicyCandidate(db,request.view.scope,nowMs);
 if(policy.status!=='UNVERIFIED')return result(policy.status,policy.reason,null,'POLICY');
 const preparation=await readSourceContentPreparationFrameCandidate(db,request.view.scope,nowMs);
 if(preparation.status!=='UNVERIFIED')return result(preparation.status,preparation.reason,null,preparation.failedBoundary,preparation.failedTargetIndex);
 return result('UNVERIFIED','STORED_PREPARATION_FRAMES_ONLY',{requestRef:{...request.view.requestRef},policyRef:policy.policyRef,preparation:preparation.candidate});
}
