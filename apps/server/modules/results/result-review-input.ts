import {canonicalJson} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,recordV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {prepareReportedCoverage} from './reported-coverage.ts';
export interface ResultReviewInput{resultRef:RuntimeRefV1;criteriaRef:RuntimeRefV1;outcome:'REWORK'|'BLOCKED';items:{criterionId:string;outcome:'REWORK'|'BLOCKED';evidenceRefs:[];reason:string}[];reason:string}
function fail(code:string):never{throw new Error(code);}
function text(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>20000)return false;try{assertKnowledgeTextSafe(v);return true;}catch{return false;}}
/** 실제 증거 검증 전의 명시 보완/차단 검수 입력이다. 합격/해당없음·임의 증거는 연결하지 않는다.
 * 저장/현재 검수 권한은 제공자가 별도로 확인하며 이 준비는 권한을 발급하지 않는다. */
export function prepareResultReview(rawResult:unknown,rawCriteria:unknown,rawInput:unknown,now:string){
 const coverage=prepareReportedCoverage(rawResult,rawCriteria,now),v=cloneV1(rawInput);
 if(!recordV1(v,['resultRef','criteriaRef','outcome','items','reason'])||!refV1(v.resultRef)||!refV1(v.criteriaRef)||canonicalJson(v.resultRef)!==canonicalJson(coverage.resultRef)||canonicalJson(v.criteriaRef)!==canonicalJson(coverage.criteriaRef)||!text(v.reason)||!arrayV1(v.items,100)||!v.items.length||Buffer.byteLength(canonicalJson(v))>2*1024*1024)fail('RESULT_REVIEW_INPUT_INVALID');
 if(v.outcome==='ACCEPTED')fail('RESULT_REVIEW_EVIDENCE_VERIFICATION_REQUIRED');
 if(!['REWORK','BLOCKED'].includes(v.outcome))fail('RESULT_REVIEW_INPUT_INVALID');
 const seen=new Set<string>();
 for(const i of v.items){if(!recordV1(i,['criterionId','outcome','evidenceRefs','reason'])||typeof i.criterionId!=='string'||seen.has(i.criterionId)||!text(i.reason)||!arrayV1(i.evidenceRefs,20))fail('RESULT_REVIEW_INPUT_INVALID');
  if(i.evidenceRefs.length||['ACCEPTED','NOT_APPLICABLE'].includes(i.outcome))fail('RESULT_REVIEW_EVIDENCE_VERIFICATION_REQUIRED');if(!['REWORK','BLOCKED'].includes(i.outcome))fail('RESULT_REVIEW_INPUT_INVALID');seen.add(i.criterionId);
 }
 if(v.items.length!==coverage.items.length||coverage.items.some(i=>!seen.has(i.criterionId)))fail('RESULT_REVIEW_ITEMS_INCOMPLETE');
 if(!v.items.some(i=>i.outcome===v.outcome))fail('RESULT_REVIEW_OUTCOME_INCONSISTENT');
 return{status:'RESULT_REVIEW_DRAFT' as const,scope:{projectId:coverage.projectId,assignmentRef:cloneV1(coverage.assignmentRef),executionRef:cloneV1(coverage.executionRef)},input:v as ResultReviewInput,coverage,reviewStored:false as const,completionAccepted:false as const,formalFailureCounted:false as const,evidenceProvenanceVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
}
