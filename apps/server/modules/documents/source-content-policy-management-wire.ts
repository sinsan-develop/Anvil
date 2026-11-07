import {parseWireJson} from '../../../../contracts/canonical.ts';
import {inspectSourceContentPolicyManagementEvidenceCandidate} from './source-content-policy-management-evidence.ts';
import {inspectSourceContentPolicyScopeCandidate} from './source-content-policy-scope.ts';

/** 별도 관리 JSON 원문의 구문·구조만 소비한다. 보호 원문 생산자/저장·현재 권위·route는 제공하지 않는다. */
export function inspectSourceContentPolicyManagementWireCandidate(raw:unknown,expected:unknown){
 try{
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4194304)throw Error();
  return inspectSourceContentPolicyManagementEvidenceCandidate(parseWireJson(raw),expected);
 }catch{throw Error('SOURCE_CONTENT_POLICY_MANAGEMENT_WIRE_INVALID');}
}
/** 원문 파싱 뒤 기존 원scope 검사를 직접 소비한다. 실제 보호 원문 조회·현재 허가를 추가하지 않는다. */
export function inspectSourceContentPolicyScopeWireCandidate(raw:unknown,expected:unknown,requestScope:unknown,operation:unknown,nowMs:number){
 try{
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4194304)throw Error();
  return inspectSourceContentPolicyScopeCandidate(parseWireJson(raw),expected,requestScope,operation,nowMs);
 }catch{throw Error('SOURCE_CONTENT_POLICY_SCOPE_WIRE_INVALID');}
}
