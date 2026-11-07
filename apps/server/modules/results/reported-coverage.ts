import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v)),code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
function fail():never{throw new Error('RESULT_COVERAGE_BINDING_INVALID');}
/** 제출 원문과 서버가 별도 조회한 고정 기준의 보고 coverage만 준비한다.
 * 권한/기준 활성/증거 원본·출처를 확인하지 않으며 실제 검수·실패 집계·저장은 하지 않는다.
 * sourceKind/FAIL/PASS는 원 제출의 주장이고, 별도 등록 증거를 읽기 전에는 모두 미검증이다. */
export function prepareReportedCoverage(rawResult:unknown,rawCriteria:unknown,now:string){
 const r=cloneV1(rawResult),c=cloneV1(rawCriteria);if(!isoV1(now)||!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||!recordV1(c,['ref','snapshot'])||!refV1(c.ref)||c.ref.contentHash!==hash(c.snapshot)||!recordV1(c.snapshot,['assignmentRef','baselineRefs','items']))fail();
 const result=readSubmittedResultRecord(r,r.snapshot?.scope,r.ref.id,now),scope=result.snapshot.scope,s=c.snapshot;
 if(!same(s.assignmentRef,scope.assignmentRef)||!arrayV1(s.baselineRefs,200)||!s.baselineRefs.length||!s.baselineRefs.every(refV1)||new Set(s.baselineRefs.map(canonicalJson)).size!==s.baselineRefs.length||!arrayV1(s.items,100)||!s.items.length)fail();
 const known=new Set<string>();for(const item of s.items){if(!recordV1(item,['criterionId','testId','kind','environmentRef','required'])||!code(item.criterionId)||known.has(item.criterionId)||!code(item.testId)||!['BUILD','TYPECHECK','UNIT','INTEGRATION','BROWSER','AGENT','DEPLOYMENT','SECURITY'].includes(item.kind)||!refV1(item.environmentRef)||item.required!==true)fail();known.add(item.criterionId);}
 if(Buffer.byteLength(canonicalJson({result:r,criteria:c}))>2*1024*1024)fail();const m=result.snapshot.manifest,issues:string[]=[];if(!same(m.baselineRefs,s.baselineRefs))issues.push('BASELINE_MISMATCH');
 const items=s.items.map(criterion=>{
  const reports=m.testResults.filter((v:any)=>v.criterionId===criterion.criterionId),unexecuted=m.unexecuted.filter((v:any)=>v.criterionId===criterion.criterionId),reasons:string[]=[],declaredSourceKinds=[...new Set(reports.flatMap((v:any)=>v.evidence.map((e:any)=>e.sourceKind)))];
  let state='NOT_REPORTED';if(!reports.length&&!unexecuted.length)reasons.push('RESULT_NOT_SUBMITTED');else if(unexecuted.length&&!reports.length)state='REPORTED_NOT_EXECUTED';else state='REPORTED_ONLY';
  if(reports.length||unexecuted.length)reasons.push('EVIDENCE_NOT_VERIFIED');if(reports.length+unexecuted.length>1)reasons.push('DUPLICATE_REPORTS');
  if([...reports,...unexecuted].some(v=>v.testId!==criterion.testId))reasons.push('TEST_ID_MISMATCH');
  for(const report of reports){
   if(!same(report.baselineRefs,s.baselineRefs))reasons.push('TEST_BASELINE_MISMATCH');if(report.status==='NOT_APPLICABLE')reasons.push('REQUIRED_NOT_APPLICABLE');if(report.status==='NOT_EXECUTED'&&!unexecuted.length&&reports.length===1)state='REPORTED_NOT_EXECUTED';
   for(const e of report.evidence){if(!same(e.environmentRef,criterion.environmentRef))reasons.push('DECLARED_EVIDENCE_ENVIRONMENT_MISMATCH');if(e.contentHash!==e.ref.contentHash)reasons.push('DECLARED_EVIDENCE_HASH_MISMATCH');}
  }
  if(reasons.some(reason=>reason!=='EVIDENCE_NOT_VERIFIED'&&reason!=='RESULT_NOT_SUBMITTED'))state='MISMATCH';
  return{criterionId:criterion.criterionId,testId:criterion.testId,requiredKind:criterion.kind,environmentRef:criterion.environmentRef,required:true,reportedStatus:reports.length===1?reports[0].status:null,state,reasons:[...new Set(reasons)],reports,unexecuted,declaredSourceKinds,verificationState:'NOT_VERIFIED'};
 });
 const unmapped=[...m.testResults.filter((v:any)=>!known.has(v.criterionId)).map((v:any)=>({kind:'TEST_REPORT',...v})),...m.unexecuted.filter((v:any)=>!known.has(v.criterionId)).map((v:any)=>({kind:'UNEXECUTED',...v}))];if(unmapped.length)issues.push('UNMAPPED_REPORTS');
 return cloneV1({purpose:'REPORTED_COVERAGE_ONLY',projectId:scope.projectId,assignmentRef:scope.assignmentRef,executionRef:scope.executionRef,resultRef:result.ref,criteriaRef:c.ref,submissionState:m.submissionState,items,unmapped,issues,preparedAt:now,reviewStored:false,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false});
}
