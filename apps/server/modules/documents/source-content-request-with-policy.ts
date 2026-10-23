import {readSourceContentRequestRecordCandidate} from './source-content-request-record.ts';
import {readSourceContentRequestPolicyCandidate} from './source-content-request-policy.ts';
import {readSourceContentStatusV1} from '../../../../contracts/source-content-status-v1.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
/** 저장 원요청 이력과 별도 정책 판독을 조합한다. 두 SELECT의 원자성/현재 인증·허가를 보장하지 않는다. route 미등록. */
export async function readSourceContentRequestWithPolicyCandidate(db:ReadClient,installationId:string,projectId:string,requestId:string,nowMs:number) {
 const request=await readSourceContentRequestRecordCandidate(db,installationId,projectId,requestId,nowMs);
 if(request===null)return null;
 // 저장 view를 수정하지 않는다. 거절/만료도 과거 원요청 이력과 나란히 보존하고 오류는 전파한다.
 const policy=await readSourceContentRequestPolicyCandidate(db,request.view.scope,nowMs);
 return {status:'UNVERIFIED_REQUEST_WITH_POLICY_CANDIDATE' as const,request,policy,
  readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,currentAuthorityVerified:false as const,
  storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
}

/** 후보 표시용 최소 자료만 선택한다. 인증/OWNER·VIEWER 확인·route 등록을 대신하지 않으며 실제 전송하지 않는다. */
export async function readSourceContentRequestStatusCandidate(db:ReadClient,installationId:string,projectId:string,requestId:string,nowMs:number){
 const value=await readSourceContentRequestWithPolicyCandidate(db,installationId,projectId,requestId,nowMs);
 if(value===null)return null;
 const {view}=value.request;
 return readSourceContentStatusV1({schemaVersion:1,kind:'SOURCE_CONTENT_REQUEST_STATUS_CANDIDATE',projectId,
  requestRef:view.requestRef,requestState:view.state,stateRecordedAt:view.updatedAt,targetCount:view.scope.targets.length,
  policy:{status:value.policy.status,reason:value.policy.reason,ref:value.policy.policyRef},
  readConsistency:'SEPARATE_READS_NOT_ATOMIC',currentAuthorityVerified:false,storageMutationPerformed:false,executionAuthorized:false,linkAuthorized:false},
 {projectId,requestRef:view.requestRef});
}
