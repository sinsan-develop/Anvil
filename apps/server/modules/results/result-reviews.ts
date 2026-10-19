import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {SyntheticResultEvidence,type ResultEvidenceScope,type SyntheticResultEvidenceTransaction} from './result-evidence.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';

export interface SyntheticResultReviewTransaction extends Omit<SyntheticResultEvidenceTransaction,'current'> {
 /** 서버의 현재 검수 권한/독립성·고정 기준이다. 제출자의 선언을 사용하지 않는다. */
 current():Promise<unknown>;
 readResult(reference:RuntimeRefV1):Promise<unknown>;
 readReview(id:string):Promise<unknown>;
 appendReview(record:SyntheticResultReview):Promise<void>;
}
export interface SyntheticResultReviewStore {
 transport:'SYNTHETIC_ONLY';
 /** 같은 범위의 권한/원문/검수와 감사·ID 유일성을 원자 처리할 실제 adapter는 아직 미연결이다. */
 transaction<T>(scope:ResultEvidenceScope,body:(tx:SyntheticResultReviewTransaction)=>Promise<T>):Promise<T>;
}
type Ref=RuntimeRefV1;
type Decision='ACCEPTED'|'REWORK'|'BLOCKED'|'NOT_APPLICABLE';
interface ReviewInput {resultRef:Ref;criteriaRef:Ref;outcome:'ACCEPTED'|'REWORK'|'BLOCKED';items:{criterionId:string;outcome:Decision;evidenceRefs:Ref[];reason:string}[];reason:string}
type Assessment=Awaited<ReturnType<SyntheticResultEvidence['assess']>>;
export interface SyntheticResultReview {ref:Ref;snapshot:{transport:'SYNTHETIC_ONLY';scope:ResultEvidenceScope;input:ReviewInput;reviewerRef:Ref;authorityRef:Ref;independentReviewer:boolean;assessment:Assessment;unverified:string[];reviewedAt:string;completionAccepted:false;formalFailureCounted:false;executionAuthorized:false;dispatchPerformed:false}}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
class ResultReviewFailure extends Error{}
function fail(code:string):never{throw new ResultReviewFailure(code);}
function text(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>20000)return false;try{assertKnowledgeTextSafe(v);return true;}catch{return false;}}
function readInput(raw:unknown):ReviewInput{
 if(!recordV1(raw,['resultRef','criteriaRef','outcome','items','reason'])||!refV1(raw.resultRef)||!refV1(raw.criteriaRef)||!['ACCEPTED','REWORK','BLOCKED'].includes(raw.outcome)||!text(raw.reason)||!arrayV1(raw.items,100)||!raw.items.length)return fail('RESULT_REVIEW_INPUT_INVALID');
 const ids=new Set<string>();for(const item of raw.items){if(!recordV1(item,['criterionId','outcome','evidenceRefs','reason'])||!code(item.criterionId)||ids.has(item.criterionId)||!['ACCEPTED','REWORK','BLOCKED','NOT_APPLICABLE'].includes(item.outcome)||!text(item.reason)||!arrayV1(item.evidenceRefs,20)||!item.evidenceRefs.every(refV1)||new Set(item.evidenceRefs.map(r=>canonicalJson(r))).size!==item.evidenceRefs.length)return fail('RESULT_REVIEW_INPUT_INVALID');ids.add(item.criterionId);}
 if(Buffer.byteLength(canonicalJson(raw))>2*1024*1024)return fail('RESULT_REVIEW_INPUT_INVALID');return cloneV1(raw) as ReviewInput;
}
/** 서버 journal의 고정 검수 원문 형태/대응을 확인한다. 출처 인증이나 증거 재검수를 대신하지 않는다. */
export function readSyntheticResultReviewRecord(raw:unknown,scope:ResultEvidenceScope,reference:Ref,now:string):SyntheticResultReview{
 try{
  const v=cloneV1(raw);if(!isoV1(now)||!refV1(reference)||!recordV1(v,['ref','snapshot'])||!same(v.ref,reference)||v.ref.version!==1||v.ref.contentHash!==hash(v.snapshot)||Buffer.byteLength(canonicalJson(v))>2*1024*1024)fail('RESULT_REVIEW_LEDGER_INVALID');const s=v.snapshot;
  if(!recordV1(s,['transport','scope','input','reviewerRef','authorityRef','independentReviewer','assessment','unverified','reviewedAt','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])||s.transport!=='SYNTHETIC_ONLY'||!same(s.scope,scope)||!refV1(s.reviewerRef)||!refV1(s.authorityRef)||typeof s.independentReviewer!=='boolean'||!isoV1(s.reviewedAt)||Date.parse(s.reviewedAt)>Date.parse(now)||s.completionAccepted!==false||s.formalFailureCounted!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)fail('RESULT_REVIEW_LEDGER_INVALID');
  const input=readInput(s.input),a=s.assessment;if(!recordV1(a,['transport','scope','criteriaRef','submissionState','items','assessedAt','reviewRequired','completionAccepted','executionAuthorized','dispatchPerformed'])||a.transport!=='SYNTHETIC_ONLY'||!same(a.scope,scope)||!same(a.criteriaRef,input.criteriaRef)||!['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED'].includes(a.submissionState)||!isoV1(a.assessedAt)||Date.parse(a.assessedAt)>Date.parse(s.reviewedAt)||a.reviewRequired!==true||a.completionAccepted!==false||a.executionAuthorized!==false||a.dispatchPerformed!==false||!arrayV1(a.items,100)||a.items.length!==input.items.length||new Set(a.items.map(row=>row.criterionId)).size!==a.items.length)fail('RESULT_REVIEW_LEDGER_INVALID');
  for(const row of a.items){
   if(!recordV1(row,['criterionId','required','submittedStatus','state','reasons','evidence'])||!code(row.criterionId)||typeof row.required!=='boolean'||row.submittedStatus!==null&&!['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'].includes(row.submittedStatus)||!['MISSING','INSUFFICIENT','SUPPORTED_FOR_REVIEW','FAILED','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE_UNREVIEWED'].includes(row.state)||!arrayV1(row.reasons,100)||!row.reasons.every(code)||!arrayV1(row.evidence,20))fail('RESULT_REVIEW_LEDGER_INVALID');
   for(const e of row.evidence)if(!recordV1(e,['ref','sourceKind','status','recordedAt'])||!refV1(e.ref)||!['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].includes(e.sourceKind)||!['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'].includes(e.status)||!isoV1(e.recordedAt)||Date.parse(e.recordedAt)>Date.parse(a.assessedAt))fail('RESULT_REVIEW_LEDGER_INVALID');
   const item=input.items.find(i=>i.criterionId===row.criterionId);if(!item||item.evidenceRefs.some(r=>!row.evidence.some((e:any)=>same(e.ref,r))))fail('RESULT_REVIEW_LEDGER_INVALID');
   if(item.outcome==='ACCEPTED'&&(!s.independentReviewer||row.state!=='SUPPORTED_FOR_REVIEW'||!item.evidenceRefs.length||row.reasons.length||!row.evidence.length||row.evidence.some(e=>e.sourceKind==='WORKER_CLAIM'||e.status!=='PASS'))||item.outcome==='NOT_APPLICABLE'&&(row.required||row.state!=='NOT_APPLICABLE_UNREVIEWED'))fail('RESULT_REVIEW_LEDGER_INVALID');
  }
  if(input.outcome==='ACCEPTED'&&(!s.independentReviewer||input.items.some(i=>i.outcome!=='ACCEPTED'&&i.outcome!=='NOT_APPLICABLE'))||input.outcome==='REWORK'&&!input.items.some(i=>i.outcome==='REWORK')||input.outcome==='BLOCKED'&&!input.items.some(i=>i.outcome==='BLOCKED')||!same(s.unverified,input.items.filter(i=>i.outcome!=='ACCEPTED').map(i=>i.criterionId)))fail('RESULT_REVIEW_LEDGER_INVALID');
  return v as SyntheticResultReview;
 }catch{fail('RESULT_REVIEW_LEDGER_INVALID');}
}
/** 기존 제출/증거 수집을 소비하는 검수 journal 경계. 합성 제공자가 실제 검수 권한을 발급하지 않는다.
 * source-only이며 PG/HTTP/사용자 권한·Agent·작업 완료를 연결하거나 변경하지 않는다. */
export class SyntheticResultReviews {
 readonly store:SyntheticResultReviewStore;
 constructor(store:SyntheticResultReviewStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')fail('SYNTHETIC_RESULT_REVIEW_STORE_REQUIRED');}
 async #await<T>(body:()=>Promise<T>){this.#port();const value=await body();this.#port();return value;}
 async #current(tx:SyntheticResultReviewTransaction,scope:ResultEvidenceScope,input:ReviewInput){
  const v=cloneV1(await this.#await(()=>tx.current())),now=await this.#await(()=>tx.clock());
  if(!isoV1(now)||!recordV1(v,['transport','scope','criteria','resultRef','reviewerRef','authorityRef','independentReviewer','checkedAt','expiresAt'])||v.transport!=='SYNTHETIC_ONLY'||!same(v.scope,scope)||!same(v.resultRef,input.resultRef)||!refV1(v.reviewerRef)||!refV1(v.authorityRef)||typeof v.independentReviewer!=='boolean'||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=Date.parse(now))fail('RESULT_REVIEW_CURRENT_REQUIRED');
  const c=v.criteria;if(!recordV1(c,['ref','snapshot'])||!refV1(c.ref)||!same(c.ref,input.criteriaRef)||c.ref.contentHash!==hash(c.snapshot)||!recordV1(c.snapshot,['assignmentRef','baselineRefs','items'])||!same(c.snapshot.assignmentRef,scope.assignmentRef)||!arrayV1(c.snapshot.items,100))fail('RESULT_REVIEW_CRITERIA_INVALID');
  const {checkedAt:_,...binding}=v;return{value:v,now,binding};
 }
 async evaluateResult(rawScope:unknown,reviewId:unknown,rawInput:unknown):Promise<SyntheticResultReview>{
  if(!recordV1(rawScope,['projectId','assignmentRef','executionRef'])||!uuidV1(rawScope.projectId)||!refV1(rawScope.assignmentRef)||!refV1(rawScope.executionRef)||!uuidV1(reviewId))fail('RESULT_REVIEW_SCOPE_INVALID');
  const scope=cloneV1(rawScope) as ResultEvidenceScope,input=readInput(rawInput);
  try{
   const result=await this.#await(()=>this.store.transaction(scope,async tx=>{
    const initial=await this.#current(tx,scope,input),raw=await this.#await(()=>tx.readResult(cloneV1(input.resultRef))),submission=readSubmittedResultRecord(raw,scope,input.resultRef.id,initial.now);
    if(!same(submission.ref,input.resultRef)||!same(submission.snapshot.manifest.baselineRefs,initial.value.criteria.snapshot.baselineRefs))fail('RESULT_REVIEW_SUBMISSION_BINDING_INVALID');
    const criteria=initial.value.criteria.snapshot.items,manifest=submission.snapshot.manifest;
    if(input.items.length!==criteria.length||criteria.some((c:any)=>!input.items.some(i=>i.criterionId===c.criterionId)))fail('RESULT_REVIEW_ITEMS_INCOMPLETE');
    for(const row of [...manifest.testResults,...manifest.unexecuted]){const criterion=criteria.find((c:any)=>c.criterionId===row.criterionId);if(!criterion||row.testId!==criterion.testId||'baselineRefs'in row&&!same(row.baselineRefs,initial.value.criteria.snapshot.baselineRefs))fail('RESULT_REVIEW_SUBMISSION_BINDING_INVALID');}
    const port={transport:'SYNTHETIC_ONLY' as const,transaction:async<T>(_scope:ResultEvidenceScope,body:(e:SyntheticResultEvidenceTransaction)=>Promise<T>)=>body({clock:()=>this.#await(()=>tx.clock()),current:async()=>{const c=await this.#current(tx,scope,input);return{transport:'SYNTHETIC_ONLY',scope,criteria:c.value.criteria,authorityRef:c.value.authorityRef,checkedAt:c.value.checkedAt,expiresAt:c.value.expiresAt};},readEvidence:r=>this.#await(()=>tx.readEvidence(r)),readArtifact:r=>this.#await(()=>tx.readArtifact(r))})};
    const assessment=await this.#await(()=>new SyntheticResultEvidence(port).assess(scope,{criteriaRef:input.criteriaRef,submissionState:manifest.submissionState,testResults:manifest.testResults.map((r:any)=>({criterionId:r.criterionId,status:r.status,evidenceRefs:r.evidence.map((e:any)=>e.ref)})),unexecuted:manifest.unexecuted.map((r:any)=>({criterionId:r.criterionId,reasonCode:'WORKER_REPORTED_NOT_EXECUTED'}))}));
    const independent=initial.value.independentReviewer&&initial.value.reviewerRef.id!==submission.snapshot.submittedByRef.id;
    for(const item of input.items){const criterion=criteria.find((c:any)=>c.criterionId===item.criterionId),observed=assessment.items.find(row=>row.criterionId===item.criterionId)!;
     if(item.evidenceRefs.some(r=>!observed.evidence.some(e=>same(e.ref,r))))fail('RESULT_REVIEW_EVIDENCE_BINDING_INVALID');
     if(item.outcome==='ACCEPTED'&&(!independent||observed.state!=='SUPPORTED_FOR_REVIEW'||!item.evidenceRefs.length))fail('RESULT_REVIEW_ACCEPTANCE_UNSUPPORTED');
     if(item.outcome==='NOT_APPLICABLE'&&(criterion.required||observed.state!=='NOT_APPLICABLE_UNREVIEWED'))fail('RESULT_REVIEW_NOT_APPLICABLE_UNSUPPORTED');
    }
    if(input.outcome==='ACCEPTED'&&(!independent||input.items.some(i=>i.outcome!=='ACCEPTED'&&i.outcome!=='NOT_APPLICABLE'))||input.outcome==='REWORK'&&!input.items.some(i=>i.outcome==='REWORK')||input.outcome==='BLOCKED'&&!input.items.some(i=>i.outcome==='BLOCKED'))fail('RESULT_REVIEW_OUTCOME_INCONSISTENT');
    const current=await this.#current(tx,scope,input);if(!same(initial.binding,current.binding))fail('RESULT_REVIEW_CURRENT_CHANGED');
    const snapshot:SyntheticResultReview['snapshot']={transport:'SYNTHETIC_ONLY',scope,input,reviewerRef:cloneV1(current.value.reviewerRef),authorityRef:cloneV1(current.value.authorityRef),independentReviewer:independent,assessment,unverified:input.items.filter(i=>i.outcome!=='ACCEPTED').map(i=>i.criterionId),reviewedAt:current.now,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
    const existing=await this.#await(()=>tx.readReview(reviewId));let entry:SyntheticResultReview;
    if(existing!==null){
     const raw=cloneV1(existing);if(!recordV1(raw,['ref','snapshot']))fail('RESULT_REVIEW_LEDGER_INVALID');const old=raw.snapshot;
     if(!refV1(raw.ref)||raw.ref.id!==reviewId||raw.ref.version!==1||raw.ref.contentHash!==hash(old)||!isoV1(old?.reviewedAt)||!isoV1(old?.assessment?.assessedAt)||Date.parse(old.reviewedAt)>Date.parse(current.now)||Date.parse(old.assessment.assessedAt)>Date.parse(old.reviewedAt)||Date.parse(old.assessment.assessedAt)<Date.parse(submission.snapshot.submittedAt))fail('RESULT_REVIEW_LEDGER_INVALID');
     readSyntheticResultReviewRecord(raw,scope,raw.ref,current.now);
     const expected={...snapshot,reviewedAt:old.reviewedAt,assessment:{...assessment,assessedAt:old.assessment.assessedAt}};
     if(!same(old,expected))fail('RESULT_REVIEW_ID_CONFLICT');entry=raw as SyntheticResultReview;
    }else{
     entry=readSyntheticResultReviewRecord({ref:{id:reviewId,version:1,contentHash:hash(snapshot)},snapshot},scope,{id:reviewId,version:1,contentHash:hash(snapshot)},current.now);await this.#await(()=>tx.appendReview(cloneV1(entry)));
     if(!same(await this.#await(()=>tx.readReview(reviewId)),entry))fail('RESULT_REVIEW_WRITE_UNCONFIRMED');
    }
    const final=await this.#current(tx,scope,input);if(!same(initial.binding,final.binding))fail('RESULT_REVIEW_CURRENT_CHANGED');return cloneV1(entry);
   }));return cloneV1(result);
  }catch(error){if(error instanceof ResultReviewFailure)throw error;fail('RESULT_REVIEW_UNAVAILABLE');}
 }
}
