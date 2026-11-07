import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import type {SourceContentLimitsV1} from '../../../../contracts/runtime/source-content-request-v1.ts';
import {inspectSourceContentPolicyManagementEvidenceCandidate} from './source-content-policy-management-evidence.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_POLICY_SCOPE_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const flags={managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
const denied=(reason:string)=>({status:'DENIED' as const,reason,policyRef:null,...flags});
/** 별도 제공된 관리 기록과 요청의 구조 범위만 대조한다. 최신 head/실제 관리·요청 권한을 증명하지 않는다. */
export function inspectSourceContentPolicyScopeCandidate(value:unknown,expected:unknown,requestScope:unknown,operation:unknown,nowMs:number){
 try{
  if(!Number.isSafeInteger(nowMs)||typeof operation!=='string'||!['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'].includes(operation))return invalid();
  const scope=readSourceContentScopeV1(requestScope);
  if(nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return denied('REQUEST_OUTSIDE_ORIGINAL_LIFETIME');
  const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>4194304)return invalid();
  const copy=JSON.parse(raw),proof=inspectSourceContentPolicyManagementEvidenceCandidate(copy,expected),policy=copy.policyEvent.snapshot_json;
  if(policy.disposition==='REVOKED')return denied('POLICY_REVOKED');
  if(policy.disposition==='DENY')return denied('POLICY_DENIED');
  if(nowMs<Date.parse(policy.recordedAt))return denied('POLICY_NOT_YET_EFFECTIVE');
  if(nowMs>=Date.parse(policy.expiresAt))return denied('POLICY_EXPIRED');
  if(scope.projectId!==policy.projectId||scope.userId!==policy.subjectUserId)return denied('CONTENT_POLICY_SUBJECT_MISMATCH');
  if(!same(scope.contentPolicyRef,proof.policyRef))return denied('CONTENT_POLICY_REF_CHANGED');
  if(!policy.allowedOperations.includes(operation))return denied('CONTENT_POLICY_OPERATION_DENIED');
  if(!['sourceRootRef','connectorRef','registrationRef','observerRef'].every(k=>same(scope[k as 'sourceRootRef'],policy[k])))return denied('CONTENT_POLICY_SCOPE_MISMATCH');
  const targets=(items:unknown[])=>items.map(item=>canonicalJson(item)).sort();
  if(!same(targets(scope.targets),targets(policy.targets)))return denied('CONTENT_POLICY_SCOPE_MISMATCH');
  for(const key of ['maxFiles','maxFileBytes','maxTotalBytes','maxObservationMs','maxReportBytes'] as (keyof SourceContentLimitsV1)[])if(scope.limits[key]>policy.limits[key])return denied('CONTENT_POLICY_LIMIT_EXCEEDED');
  return {status:'UNVERIFIED' as const,reason:'POLICY_SCOPE_SHAPE_ONLY' as const,policyRef:proof.policyRef,...flags};
 }catch{return invalid();}
}
