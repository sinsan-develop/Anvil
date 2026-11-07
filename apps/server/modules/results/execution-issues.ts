import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const reportKinds=['RUNNING','TOOL_ERROR','EXPLICIT_REFUSAL','APPROVAL_WAIT','INPUT_WAIT','QUOTA','TRANSPORT_LOSS','UNVERIFIED_CAUSE'];
const states=['MISSING','INSUFFICIENT','SUPPORTED_FOR_REVIEW','FAILED','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE_UNREVIEWED'];
const statuses=['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'];
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
function fail(reason:string):never {throw new Error(reason);}
function validScope(v:unknown){return recordV1(v,['projectId','assignmentRef','executionRef'])&&uuidV1(v.projectId)&&refV1(v.assignmentRef)&&refV1(v.executionRef);}
function readResult(raw:unknown,scope:unknown,asOf:string){
 if(raw===null)return null;
 if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.contentHash!==hash(raw.snapshot))fail('ISSUE_RESULT_INVALID');
 const s=raw.snapshot;
 if(!recordV1(s,['transport','scope','criteriaRef','submissionState','items','assessedAt','reviewRequired','completionAccepted','executionAuthorized','dispatchPerformed'])||s.transport!=='SYNTHETIC_ONLY'||!same(s.scope,scope)||!refV1(s.criteriaRef)||!['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED'].includes(s.submissionState)||!arrayV1(s.items,100)||!s.items.length||!isoV1(s.assessedAt)||Date.parse(s.assessedAt)>Date.parse(asOf)||s.reviewRequired!==true||s.completionAccepted!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)fail('ISSUE_RESULT_INVALID');
 const seen=new Set<string>();
 for(const i of s.items){
  if(!recordV1(i,['criterionId','required','submittedStatus','state','reasons','evidence'])||!code(i.criterionId)||seen.has(i.criterionId)||typeof i.required!=='boolean'||i.submittedStatus!==null&&!statuses.includes(i.submittedStatus)||!states.includes(i.state)||!arrayV1(i.reasons,100)||!i.reasons.every(code)||!arrayV1(i.evidence,20))fail('ISSUE_RESULT_INVALID');
  seen.add(i.criterionId);
  for(const e of i.evidence)if(!recordV1(e,['ref','sourceKind','status','recordedAt'])||!refV1(e.ref)||!['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].includes(e.sourceKind)||!statuses.includes(e.status)||!isoV1(e.recordedAt)||Date.parse(e.recordedAt)>Date.parse(s.assessedAt))fail('ISSUE_RESULT_INVALID');
 }
 return cloneV1(raw);
}

/** FN12 내부 분류 계산. 인자는 서버에서 권한/출처를 대조한 고정 facts로만 조립해야 한다.
 * hash는 내용 결박이지 출처 인증이 아니다. 현재 FN08의 PROVIDER_CLAIM_ONLY를 이 함수의
 * CONNECTOR_OBSERVED/SERVER_DECISION으로 바꾸는 어댑터는 없으며 실제 provider는 미연결이다.
 * null은 이 facts에서 현재 문제 분류가 없다는 뜻일 뿐 완료·정상 가동·재개 허가가 아니다.
 * 결과 저장/상태 전이·자동 retry/kill·실패 횟수 누적·새 writer/비용은 이 함수가 수행하지 않는다. */
export function classifyExecutionIssue(raw:unknown){
 try{
  if(!recordV1(raw,['transport','scope','asOf','reports','observationGaps','resultAssessment'])||raw.transport!=='SYNTHETIC_ONLY'||!validScope(raw.scope)||!isoV1(raw.asOf)||!arrayV1(raw.reports,100)||!arrayV1(raw.observationGaps,100)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)fail('ISSUE_FACTS_INVALID');
  const input=cloneV1(raw),knownFacts:{ref:RuntimeRefV1;kind:string;sourceKind:string;observedAt:string;current:boolean}[]=[],references:RuntimeRefV1[]=[],unknowns=new Set<string>(['UNDERLYING_CAUSE_NOT_ESTABLISHED','ACTUAL_PROVIDER_NOT_VALIDATED']);
  const current:any[]=[],seen=new Set<string>();let stale=false,claim=false;
  for(const record of input.reports){
   if(!recordV1(record,['ref','snapshot'])||!refV1(record.ref)||record.ref.contentHash!==hash(record.snapshot)||seen.has(record.ref.id))fail('ISSUE_REPORT_INVALID');
   seen.add(record.ref.id);const s=record.snapshot;
   if(!recordV1(s,['scope','kind','sourceKind','observedAt','validUntil','requiresHumanDecision'])||!same(s.scope,input.scope)||!reportKinds.includes(s.kind)||!['WORKER_CLAIM','CONNECTOR_OBSERVED','SERVER_DECISION'].includes(s.sourceKind)||!isoV1(s.observedAt)||!isoV1(s.validUntil)||Date.parse(s.observedAt)>Date.parse(input.asOf)||Date.parse(s.validUntil)<=Date.parse(s.observedAt)||typeof s.requiresHumanDecision!=='boolean'||s.sourceKind==='SERVER_DECISION'&&!['APPROVAL_WAIT','INPUT_WAIT','QUOTA','UNVERIFIED_CAUSE'].includes(s.kind))fail('ISSUE_REPORT_INVALID');
   const fresh=Date.parse(s.validUntil)>Date.parse(input.asOf);
   knownFacts.push({ref:record.ref,kind:s.kind,sourceKind:s.sourceKind,observedAt:s.observedAt,current:fresh});references.push(record.ref);
   if(!fresh){stale=true;unknowns.add('OBSERVATION_EXPIRED');}
   if(s.sourceKind==='WORKER_CLAIM'){claim=true;unknowns.add('PROVIDER_CLAIM_NOT_DIRECT_OBSERVATION');}
   else if(fresh)current.push(s);
  }
  let previousTo=0;
  for(const gap of input.observationGaps){
   if(!recordV1(gap,['from','to','evidenceRef'])||!Number.isSafeInteger(gap.from)||!Number.isSafeInteger(gap.to)||gap.from<=0||gap.to<gap.from||gap.from<=previousTo||!refV1(gap.evidenceRef))fail('ISSUE_FACTS_INVALID');
   previousTo=gap.to;references.push(gap.evidenceRef);unknowns.add('OBSERVATION_SEQUENCE_GAP');
  }
  const result=readResult(input.resultAssessment,input.scope,input.asOf),missingCriteria:string[]=result?.snapshot.submissionState==='COMPLETED'?result.snapshot.items.filter((i:any)=>i.required&&i.state!=='SUPPORTED_FOR_REVIEW').map((i:any)=>i.criterionId):[];
  if(result)references.push(result.ref);
  const kinds=new Set(current.map(v=>v.kind)),requiresHumanDecision=current.some(s=>s.requiresHumanDecision);
  if(kinds.size>1)unknowns.add('CONFLICTING_CURRENT_REPORTS');
  if(!current.length)unknowns.add('NO_CURRENT_OBSERVATION');
  let kind:string;
  if(input.observationGaps.length)kind='OBSERVATION_GAP';
  else if(missingCriteria.length)kind='INSUFFICIENT_COMPLETION_EVIDENCE';
  else if(stale||kinds.size>1||!current.length)kind='UNVERIFIED_CAUSE';
  else{
   const only=current[0]!.kind;
   if(only==='RUNNING'){
    if(!claim&&!requiresHumanDecision)return null;
    if(requiresHumanDecision)unknowns.add('HUMAN_DECISION_REASON_UNSPECIFIED');
    kind='UNVERIFIED_CAUSE';
   }else kind=only;
  }
  const choices:Record<string,string[]>={TOOL_ERROR:['INSPECT_TOOL_EVIDENCE'],EXPLICIT_REFUSAL:['INSPECT_EXPLICIT_REFUSAL','CONSIDER_TOOL_TRANSFER'],APPROVAL_WAIT:['OPEN_EXACT_APPROVAL'],INPUT_WAIT:['OPEN_REQUIRED_INPUT'],QUOTA:['INSPECT_USAGE_LIMIT','CONSIDER_TOOL_TRANSFER'],TRANSPORT_LOSS:['RECONNECT_AND_RECONCILE'],OBSERVATION_GAP:['RECONCILE_MISSING_SEQUENCES'],UNVERIFIED_CAUSE:['INSPECT_EVIDENCE_WITHOUT_GUESSING'],INSUFFICIENT_COMPLETION_EVIDENCE:['REQUEST_ONLY_MISSING_EVIDENCE']};
  const evidenceRefs=[...new Map(references.map(r=>[canonicalJson(r),r])).values()];
  return{transport:'SYNTHETIC_ONLY' as const,scope:input.scope,kind,evidenceRefs,knownFacts,unknowns:[...unknowns],missingCriteria,impact:'NO_AUTOMATIC_STATE_CHANGE',nextChoices:[...choices[kind]!,...(missingCriteria.length&&kind!=='INSUFFICIENT_COMPLETION_EVIDENCE'?['REQUEST_ONLY_MISSING_EVIDENCE']:[])],requiresHumanDecision,completionAccepted:false as const,formalFailureCounted:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch(error){if(error instanceof Error&&/^ISSUE_(FACTS|REPORT|RESULT)_INVALID$/.test(error.message))throw error;return fail('ISSUE_FACTS_INVALID');}
}
