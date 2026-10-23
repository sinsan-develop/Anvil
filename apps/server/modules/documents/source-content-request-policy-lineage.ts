import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readLatestSourceContentPolicyLineageCandidate} from './source-content-policy-lineage-reader.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const denied=(reason:string)=>({status:'DENIED' as const,reason,policyRef:null,lineage:null,
 managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
/** 원 scope/ref와 인접 정책계보의 비활성 결박. fullscope/targets·관리근거/current 권위를 증명하지 않는다. */
export async function readSourceContentRequestPolicyLineageCandidate(db:ReadClient,value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_POLICY_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value); // 첫 await 전에 caller 원자료를 복사한다.
 if(nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return denied('REQUEST_OUTSIDE_ORIGINAL_LIFETIME');
 const head=await readLatestSourceContentPolicyLineageCandidate(db,scope.projectId,scope.userId,nowMs);
 if(head.status!=='UNVERIFIED')return head;
 if(canonicalJson(head.policyRef)!==canonicalJson(scope.contentPolicyRef))return denied('CONTENT_POLICY_REF_CHANGED');
 return head; // 일치해도 구조 후보/false뿐이며 기존 정책 reader·허가/route에는 연결하지 않는다.
}
