import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

export interface ResultEvidenceScope {projectId:string;assignmentRef:RuntimeRefV1;executionRef:RuntimeRefV1}
export interface SyntheticResultEvidenceTransaction {
 clock():Promise<string>;
 /** 서버 내부의 현재 조회 권한·고정 기준이다. 제출자가 제공한 출처/기준을 돌려주면 안 된다. */
 current():Promise<unknown>;
 /** 같은 조회 범위의 불변 등록 증거만 반환한다. 미등록/접근 불가는 null, 출처는 서버 등록값이다. */
 readEvidence(ref:RuntimeRefV1):Promise<unknown>;
 /** 권한/격리를 재검사한 등록 산출물이다. 실제 파일/DB 제공자는 아직 연결하지 않는다. */
 readArtifact(ref:RuntimeRefV1):Promise<unknown>;
}
export interface SyntheticResultEvidenceStore {
 transport:'SYNTHETIC_ONLY';
 transaction<T>(scope:ResultEvidenceScope,body:(tx:SyntheticResultEvidenceTransaction)=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const statuses=['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'];
const kinds=['BUILD','TYPECHECK','UNIT','INTEGRATION','BROWSER','AGENT','DEPLOYMENT','SECURITY'];
const sources=['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'];
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
const refs=(v:unknown)=>arrayV1(v,100)&&v.every(refV1)&&new Set(v.map(r=>canonicalJson(r))).size===v.length;
class ResultEvidenceFailure extends Error {}
function fail(message:string):never {throw new ResultEvidenceFailure(message);}
function scope(raw:unknown):ResultEvidenceScope {
 if(!recordV1(raw,['projectId','assignmentRef','executionRef'])||!uuidV1(raw.projectId)||!refV1(raw.assignmentRef)||!refV1(raw.executionRef))fail('RESULT_SCOPE_INVALID');
 return cloneV1(raw) as ResultEvidenceScope;
}
type Row={criterionId:string;required:boolean;submittedStatus:string|null;state:string;reasons:string[];evidence:{ref:RuntimeRefV1;sourceKind:string;status:string;recordedAt:string}[]};

/** FN12 첫 내부 수집 경계. 제출 상태/등록 증거/조건별 부족을 분리한다.
 * 결과 저장·검수 ACCEPTED·실행 허가를 만들지 않으며 합성 제공자를 실제 관측으로 승격하지 않는다.
 * 공개 HTTP·DB/파일 기본 제공자·실제 Agent fallback은 없다. */
export class SyntheticResultEvidence {
 readonly store:SyntheticResultEvidenceStore;
 constructor(store:SyntheticResultEvidenceStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')fail('SYNTHETIC_RESULT_STORE_REQUIRED');}
 async #current(tx:SyntheticResultEvidenceTransaction,selected:ResultEvidenceScope){
  this.#port();const value=cloneV1(await tx.current());this.#port();const now=await tx.clock();this.#port();
  if(!isoV1(now)||!recordV1(value,['transport','scope','criteria','authorityRef','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||!same(value.scope,selected)||!refV1(value.authorityRef)||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(value.checkedAt)>30000||Date.parse(value.expiresAt)<=Date.parse(now))fail('RESULT_CURRENT_REQUIRED');
  const c=value.criteria,s=c?.snapshot;
  if(!recordV1(c,['ref','snapshot'])||!refV1(c.ref)||c.ref.contentHash!==hash(s)||!recordV1(s,['assignmentRef','baselineRefs','items'])||!same(s.assignmentRef,selected.assignmentRef)||!refs(s.baselineRefs)||!s.baselineRefs.length||!arrayV1(s.items,100)||!s.items.length)fail('RESULT_CRITERIA_INVALID');
  const ids=new Set<string>();
  for(const item of s.items){
   if(!recordV1(item,['criterionId','testId','kind','environmentRef','required'])||!code(item.criterionId)||!code(item.testId)||!kinds.includes(item.kind)||!refV1(item.environmentRef)||typeof item.required!=='boolean'||ids.has(item.criterionId))fail('RESULT_CRITERIA_INVALID');
   ids.add(item.criterionId);
  }
  const {checkedAt:_,...binding}=value;return{value,now,binding};
 }
 #submission(raw:unknown,criteria:any){
  if(!recordV1(raw,['criteriaRef','submissionState','testResults','unexecuted'])||!same(raw.criteriaRef,criteria.ref)||!['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED'].includes(raw.submissionState)||!arrayV1(raw.testResults,100)||!arrayV1(raw.unexecuted,100)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)fail('RESULT_SUBMISSION_INVALID');
  const ids=new Set<string>(),known=new Set(criteria.snapshot.items.map((i:any)=>i.criterionId));let total=0;
  for(const item of raw.testResults){
   if(!recordV1(item,['criterionId','status','evidenceRefs'])||!known.has(item.criterionId)||ids.has(item.criterionId)||!statuses.includes(item.status)||!arrayV1(item.evidenceRefs,20)||!refs(item.evidenceRefs))fail('RESULT_SUBMISSION_INVALID');
   ids.add(item.criterionId);total+=item.evidenceRefs.length;
  }
  for(const item of raw.unexecuted){
   if(!recordV1(item,['criterionId','reasonCode'])||!known.has(item.criterionId)||ids.has(item.criterionId)||!code(item.reasonCode))fail('RESULT_SUBMISSION_INVALID');ids.add(item.criterionId);
  }
  if(total>200)fail('RESULT_SUBMISSION_INVALID');return cloneV1(raw);
 }
 async assess(rawScope:unknown,rawSubmission:unknown){
  const selected=scope(rawScope);
  try {
   this.#port();const result=await this.store.transaction(cloneV1(selected),async tx=>{
    const initial=await this.#current(tx,selected),submission=this.#submission(rawSubmission,initial.value.criteria),items:Row[]=[];
    let totalBytes=0;
    for(const criterion of initial.value.criteria.snapshot.items){
     const claim=submission.testResults.find((v:any)=>v.criterionId===criterion.criterionId),unrun=submission.unexecuted.find((v:any)=>v.criterionId===criterion.criterionId);
     const row:Row={criterionId:criterion.criterionId,required:criterion.required,submittedStatus:claim?.status??null,state:'MISSING',reasons:[],evidence:[]};items.push(row);
     if(unrun){row.state='NOT_EXECUTED';row.reasons.push(unrun.reasonCode);continue;}
     if(!claim){row.reasons.push('RESULT_NOT_SUBMITTED');continue;}
     row.state='INSUFFICIENT';
     let supported=false;
     for(const evidenceRef of claim.evidenceRefs){
      const raw=await tx.readEvidence(cloneV1(evidenceRef));this.#port();
      if(raw===null){row.reasons.push('EVIDENCE_UNAVAILABLE');continue;}
      const entry=cloneV1(raw);if(!recordV1(entry,['ref','snapshot']))fail('RESULT_EVIDENCE_INVALID');const e=entry.snapshot;
      if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||!same(entry.ref,evidenceRef)||entry.ref.contentHash!==hash(e)||!recordV1(e,['scope','sourceKind','criterionId','testId','kind','environmentRef','baselineRefs','status','exitCode','commandRef','artifactRefs','recordedAt'])||!same(e.scope,selected)||!sources.includes(e.sourceKind)||!code(e.criterionId)||!code(e.testId)||!kinds.includes(e.kind)||!refV1(e.environmentRef)||!refs(e.baselineRefs)||!statuses.includes(e.status)||e.exitCode!==null&&(!Number.isSafeInteger(e.exitCode)||e.exitCode<0)||e.commandRef!==null&&!refV1(e.commandRef)||!refs(e.artifactRefs)||!isoV1(e.recordedAt)||Date.parse(e.recordedAt)>Date.parse(initial.now))fail('RESULT_EVIDENCE_INVALID');
      row.evidence.push({ref:cloneV1(entry.ref),sourceKind:e.sourceKind,status:e.status,recordedAt:e.recordedAt});
      const reasons:string[]=[];
      if(e.sourceKind==='WORKER_CLAIM')reasons.push('WORKER_CLAIM_ONLY');
      if(e.criterionId!==criterion.criterionId||e.testId!==criterion.testId)reasons.push('TEST_ID_MISMATCH');
      if(e.kind!==criterion.kind)reasons.push('VERIFICATION_KIND_MISMATCH');
      if(!same(e.environmentRef,criterion.environmentRef))reasons.push('ENVIRONMENT_MISMATCH');
      if(!same(e.baselineRefs,initial.value.criteria.snapshot.baselineRefs))reasons.push('BASELINE_MISMATCH');
      if(e.status!==claim.status)reasons.push('STATUS_MISMATCH');
      if(claim.status==='PASS'&&(e.exitCode!==0||e.commandRef===null))reasons.push('EXIT_NOT_SUCCESS');
      if(!e.artifactRefs.length)reasons.push('ARTIFACT_MISSING');
      // 이미 부적합한 주장에 첨부된 원문은 불필요하게 읽지 않는다.
      if(!reasons.length)for(const artifactRef of e.artifactRefs){
       const artifact=await tx.readArtifact(cloneV1(artifactRef));this.#port();
       if(!recordV1(artifact,['ref','state','bytes'])||!same(artifact.ref,artifactRef)||artifact.state!=='AVAILABLE'){reasons.push('ARTIFACT_UNAVAILABLE');continue;}
       if(!(artifact.bytes instanceof Uint8Array)){reasons.push('ARTIFACT_HASH_MISMATCH');continue;}
       totalBytes+=artifact.bytes.byteLength;if(totalBytes>2*1024*1024)fail('RESULT_ARTIFACT_LIMIT');
       if(contentHash(artifact.bytes)!==artifactRef.contentHash)reasons.push('ARTIFACT_HASH_MISMATCH');
      }
      row.reasons.push(...reasons);if(!reasons.length)supported=true;
     }
     if(!claim.evidenceRefs.length)row.reasons.push('EVIDENCE_MISSING');
     row.reasons=[...new Set(row.reasons)];
     if(supported&&!row.reasons.length)row.state=claim.status==='PASS'?'SUPPORTED_FOR_REVIEW':claim.status==='FAIL'?'FAILED':claim.status==='NOT_APPLICABLE'?'NOT_APPLICABLE_UNREVIEWED':claim.status;
    }
    const final=await this.#current(tx,selected);this.#port();if(!same(initial.binding,final.binding))fail('RESULT_CURRENT_CHANGED');
    return{transport:'SYNTHETIC_ONLY' as const,scope:cloneV1(selected),criteriaRef:cloneV1(initial.value.criteria.ref),submissionState:submission.submissionState,items,assessedAt:final.now,reviewRequired:true as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   });this.#port();return result;
  }catch(error){if(error instanceof ResultEvidenceFailure)throw error;fail('RESULT_EVIDENCE_UNAVAILABLE');}
 }
}
