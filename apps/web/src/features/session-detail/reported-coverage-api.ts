import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {RegisteredCriteria} from './result-criteria-api.ts';
import type {prepareReportedCoverage} from '../../../../server/modules/results/reported-coverage.ts';
export type ReportedCoverageView=ReturnType<typeof prepareReportedCoverage>;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),ref=(v:any)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
async function hash(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function fail():never{throw new ApiError('RESULT_COVERAGE_RESPONSE_INVALID');}
/** 기존 조회한 두 고정 원문에 대한 서버의 보고 coverage만 소비한다. 실제 관측/검수 권한을 만들지 않는다. */
export async function readReportedCoverage(client:ApiClient,result:SubmittedResultView,criteria:RegisteredCriteria,active:()=>boolean):Promise<ReportedCoverageView|null>{
 const r=structuredClone(result),c=structuredClone(criteria),scope=r?.snapshot?.scope;
 if(!scope||!uuid(scope.projectId)||!ref(r.ref)||!ref(scope.assignmentRef)||!ref(scope.executionRef)||!ref(c?.ref)||c.projectId!==scope.projectId||!same(c.snapshot?.assignmentRef,scope.assignmentRef)||c.registryStored!==true||c.reviewStored!==false||c.completionAccepted!==false||c.executionAuthorized!==false||c.dispatchPerformed!==false||await hash(r.snapshot)!==r.ref.contentHash||await hash(c.snapshot)!==c.ref.contentHash||new TextEncoder().encode(ordered({result:r,criteria:{ref:c.ref,snapshot:c.snapshot}})).length>2*1024*1024)fail();if(!active())return null;
 const v=await client.get<ReportedCoverageView>(`/api/v1/projects/${scope.projectId}/results/${r.ref.id}/criteria/${c.ref.id}/versions/${c.ref.version}/reported-coverage`);if(!active())return null;
 try{
  if(typeof v?.preparedAt!=='string'||!Number.isFinite(Date.parse(v.preparedAt))||new Date(v.preparedAt).toISOString()!==v.preparedAt||Date.parse(v.preparedAt)<Date.parse(r.snapshot.submittedAt))fail();
  const s=c.snapshot,m=r.snapshot.manifest,known=new Set(s.items.map(i=>i.criterionId)),issues:string[]=[];if(!same(m.baselineRefs,s.baselineRefs))issues.push('BASELINE_MISMATCH');
  const items=s.items.map(criterion=>{
const reports=m.testResults.filter((i:any)=>i.criterionId===criterion.criterionId),unexecuted=m.unexecuted.filter((i:any)=>i.criterionId===criterion.criterionId),reasons:string[]=[],declaredSourceKinds=[...new Set(reports.flatMap((i:any)=>i.evidence.map((e:any)=>e.sourceKind)))];let state='NOT_REPORTED';
   if(!reports.length&&!unexecuted.length)reasons.push('RESULT_NOT_SUBMITTED');else if(unexecuted.length&&!reports.length)state='REPORTED_NOT_EXECUTED';else state='REPORTED_ONLY';if(reports.length||unexecuted.length)reasons.push('EVIDENCE_NOT_VERIFIED');if(reports.length+unexecuted.length>1)reasons.push('DUPLICATE_REPORTS');if([...reports,...unexecuted].some(i=>i.testId!==criterion.testId))reasons.push('TEST_ID_MISMATCH');
   for(const report of reports){if(!same(report.baselineRefs,s.baselineRefs))reasons.push('TEST_BASELINE_MISMATCH');if(report.status==='NOT_APPLICABLE')reasons.push('REQUIRED_NOT_APPLICABLE');if(report.status==='NOT_EXECUTED'&&!unexecuted.length&&reports.length===1)state='REPORTED_NOT_EXECUTED';for(const e of report.evidence){if(!same(e.environmentRef,criterion.environmentRef))reasons.push('DECLARED_EVIDENCE_ENVIRONMENT_MISMATCH');if(e.contentHash!==e.ref.contentHash)reasons.push('DECLARED_EVIDENCE_HASH_MISMATCH');}}
   if(reasons.some(reason=>reason!=='EVIDENCE_NOT_VERIFIED'&&reason!=='RESULT_NOT_SUBMITTED'))state='MISMATCH';return{criterionId:criterion.criterionId,testId:criterion.testId,requiredKind:criterion.kind,environmentRef:criterion.environmentRef,required:true,reportedStatus:reports.length===1?reports[0]!.status:null,state,reasons:[...new Set(reasons)],reports,unexecuted,declaredSourceKinds,verificationState:'NOT_VERIFIED'};
  });
  const unmapped=[...m.testResults.filter((i:any)=>!known.has(i.criterionId)).map((i:any)=>({kind:'TEST_REPORT',...i})),...m.unexecuted.filter((i:any)=>!known.has(i.criterionId)).map((i:any)=>({kind:'UNEXECUTED',...i}))];if(unmapped.length)issues.push('UNMAPPED_REPORTS');
  const expected={purpose:'REPORTED_COVERAGE_ONLY',projectId:scope.projectId,assignmentRef:scope.assignmentRef,executionRef:scope.executionRef,resultRef:r.ref,criteriaRef:c.ref,submissionState:m.submissionState,items,unmapped,issues,preparedAt:v.preparedAt,reviewStored:false,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};if(!same(v,expected))fail();
 }catch(cause){if(cause instanceof ApiError)throw cause;fail();}return active()?structuredClone(v):null;
}
