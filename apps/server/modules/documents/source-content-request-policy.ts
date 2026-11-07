import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readLatestSourceContentPolicyCandidate,type SourceContentPolicyCandidate} from './source-content-policy-head.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const denied=(reason:string):SourceContentPolicyCandidate=>({status:'DENIED',reason,policyRef:null,executionAuthorized:false,linkAuthorized:false});
/** 원 scope의 정책 ref를 최신 head에 결박하는 SOURCE 후보. 실제 scope 진위/현재 허가·정책 내용 검증·쓰기 권위는 아니다. */
export async function readSourceContentRequestPolicyCandidate(db:ReadClient,value:unknown,nowMs:number):Promise<SourceContentPolicyCandidate> {
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_POLICY_INPUT_INVALID');
 // 기존 parser가 await 전에 getter 없는 불변 복사본을 만든다. 새 정책 양식을 정의하지 않는다.
 const scope=readSourceContentScopeV1(value);
 if(nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return denied('REQUEST_OUTSIDE_ORIGINAL_LIFETIME');
 const head=await readLatestSourceContentPolicyCandidate(db,scope.projectId,scope.userId,nowMs);
 if(head.status!=='UNVERIFIED')return head;
 if(canonicalJson(head.policyRef)!==canonicalJson(scope.contentPolicyRef))return denied('CONTENT_POLICY_REF_CHANGED');
 return head; // 일치해도 CURRENT_AUTHORITY_UNAVAILABLE/false. route·저장·발급에는 연결하지 않는다.
}
