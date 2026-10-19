import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {prepareSubmittedResult} from './result-submission.ts';
import type {ResultEvidenceScope} from './result-evidence.ts';

export interface SyntheticResultSubmissionTransaction {
 clock():Promise<string>;
 /** 현재 로그인/제어·정확 제출ID/payload·허가 영수증을 같은 tx에서 검증한 서버 값이다.
  * HTTP 입력/제출자 선언으로 채우지 않는다. 실제 제공자는 미연결이다. */
 current():Promise<unknown>;
 read(submissionId:string):Promise<unknown>;
 append(record:SyntheticSubmittedResult):Promise<void>;
}
export interface SyntheticResultSubmissionStore {
 transport:'SYNTHETIC_ONLY';
 /** exact scope/id 유일성·append/영수증·감사를 원자 처리해야 한다. 합성 시험은 실제 DB/내구 증거가 아니다. */
 transaction<T>(scope:ResultEvidenceScope,body:(tx:SyntheticResultSubmissionTransaction)=>Promise<T>):Promise<T>;
}
type Prepared=ReturnType<typeof prepareSubmittedResult>;
export interface SyntheticSubmittedResult {
 ref:RuntimeRefV1;
 snapshot:{transport:'SYNTHETIC_ONLY';scope:ResultEvidenceScope;submittedByRef:RuntimeRefV1;authorizationReceiptRef:RuntimeRefV1;manifest:Prepared['manifest'];manifestHash:string;submittedAt:string;sourceKind:'WORKER_CLAIM';evidenceProvenanceVerified:false;completionAccepted:false;formalFailureCounted:false;executionAuthorized:false;dispatchPerformed:false};
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
class ResultSubmissionFailure extends Error{}
function fail(reason:string):never {throw new ResultSubmissionFailure(reason);}

/** FN12 source/합성 불변 제출 journal. 새 원문/출처를 검수 합격으로 만들지 않는다.
 * 실제 SQL/권한·감사/HTTP·Agent 기본 제공자 및 REAL fallback은 없다. */
export class SyntheticResultSubmissions {
 readonly store:SyntheticResultSubmissionStore;
 constructor(store:SyntheticResultSubmissionStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')fail('SYNTHETIC_RESULT_SUBMISSION_STORE_REQUIRED');}
 async #current(tx:SyntheticResultSubmissionTransaction,scope:ResultEvidenceScope,submissionId:string,manifestHash:string|null,operation:'SUBMIT_RESULT'|'READ_RESULT'='SUBMIT_RESULT'){
  this.#port();const value=cloneV1(await tx.current());this.#port();const now=await tx.clock();this.#port();
  if(!isoV1(now)||!recordV1(value,['transport','scope','operation','submissionId','manifestHash','submitterRef','authorizationReceiptRef','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||!same(value.scope,scope)||value.operation!==operation||value.submissionId!==submissionId||!hashV1(value.manifestHash)||manifestHash!==null&&value.manifestHash!==manifestHash||!refV1(value.submitterRef)||!refV1(value.authorizationReceiptRef)||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(value.checkedAt)>30000||Date.parse(value.expiresAt)<=Date.parse(now))fail('RESULT_SUBMISSION_CURRENT_REQUIRED');
  const {checkedAt:_,...binding}=value;return{value,now,binding};
 }
 #entry(raw:unknown,scope:ResultEvidenceScope,id:string,now:string):SyntheticSubmittedResult{
  const entry=cloneV1(raw);if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||entry.ref.id!==id||entry.ref.version!==1||entry.ref.contentHash!==hash(entry.snapshot))fail('RESULT_SUBMISSION_LEDGER_INVALID');
  const s=entry.snapshot;
  if(!recordV1(s,['transport','scope','submittedByRef','authorizationReceiptRef','manifest','manifestHash','submittedAt','sourceKind','evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])||s.transport!=='SYNTHETIC_ONLY'||!same(s.scope,scope)||!refV1(s.submittedByRef)||!refV1(s.authorizationReceiptRef)||!hashV1(s.manifestHash)||!isoV1(s.submittedAt)||Date.parse(s.submittedAt)>Date.parse(now)||s.sourceKind!=='WORKER_CLAIM'||s.evidenceProvenanceVerified!==false||s.completionAccepted!==false||s.formalFailureCounted!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||Buffer.byteLength(canonicalJson(entry))>2*1024*1024)fail('RESULT_SUBMISSION_LEDGER_INVALID');
  try{if(prepareSubmittedResult(scope,s.manifest).contentHash!==s.manifestHash)fail('RESULT_SUBMISSION_LEDGER_INVALID');}catch{fail('RESULT_SUBMISSION_LEDGER_INVALID');}
  return cloneV1(entry) as SyntheticSubmittedResult;
 }
 /** 현재 조회 권한으로 원제출을 읽는다. 제출자와 조회자를 혼동하지 않으며 append/확정을 수행하지 않는다. */
 async read(rawScope:unknown,rawId:unknown):Promise<SyntheticSubmittedResult>{
  if(!recordV1(rawScope,['projectId','assignmentRef','executionRef'])||!uuidV1(rawScope.projectId)||!refV1(rawScope.assignmentRef)||!refV1(rawScope.executionRef)||!uuidV1(rawId))fail('RESULT_SUBMISSION_READ_SCOPE_INVALID');
  const scope=cloneV1(rawScope) as ResultEvidenceScope;
  try{
   this.#port();const result=await this.store.transaction(cloneV1(scope),async tx=>{
    const before=await this.#current(tx,scope,rawId,null,'READ_RESULT'),raw=await tx.read(rawId);this.#port();
    if(raw===null)fail('RESULT_SUBMISSION_NOT_FOUND');const entry=this.#entry(raw,scope,rawId,before.now);
    if(entry.snapshot.manifestHash!==before.value.manifestHash)fail('RESULT_SUBMISSION_READ_BINDING_MISMATCH');
    const final=await this.#current(tx,scope,rawId,before.value.manifestHash,'READ_RESULT');this.#port();if(!same(before.binding,final.binding))fail('RESULT_SUBMISSION_CURRENT_CHANGED');
    return cloneV1(entry);
   });this.#port();return cloneV1(result);
  }catch(error){if(error instanceof ResultSubmissionFailure)throw error;fail('RESULT_SUBMISSION_STORAGE_UNAVAILABLE');}
 }
 async submit(rawScope:unknown,rawId:unknown,rawManifest:unknown):Promise<SyntheticSubmittedResult>{
  const prepared=prepareSubmittedResult(rawScope,rawManifest),scope=prepared.scope as ResultEvidenceScope;
  if(!uuidV1(rawId))fail('RESULT_SUBMISSION_ID_INVALID');
  try{
   this.#port();const result=await this.store.transaction(cloneV1(scope),async tx=>{
    const before=await this.#current(tx,scope,rawId,prepared.contentHash),raw=await tx.read(rawId);this.#port();let entry:SyntheticSubmittedResult;
    if(raw!==null){
     entry=this.#entry(raw,scope,rawId,before.now);
     if(entry.snapshot.manifestHash!==prepared.contentHash||!same(entry.snapshot.submittedByRef,before.value.submitterRef))fail('RESULT_SUBMISSION_ID_CONFLICT');
    }else{
     const snapshot:SyntheticSubmittedResult['snapshot']={transport:'SYNTHETIC_ONLY',scope:cloneV1(scope),submittedByRef:cloneV1(before.value.submitterRef),authorizationReceiptRef:cloneV1(before.value.authorizationReceiptRef),manifest:cloneV1(prepared.manifest),manifestHash:prepared.contentHash,submittedAt:before.now,sourceKind:'WORKER_CLAIM',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
     entry=this.#entry({ref:{id:rawId,version:1,contentHash:hash(snapshot)},snapshot},scope,rawId,before.now);
     await tx.append(cloneV1(entry));this.#port();
     const written=await tx.read(rawId);this.#port();
     if(written===null||!same(this.#entry(written,scope,rawId,before.now),entry))fail('RESULT_SUBMISSION_WRITE_UNCONFIRMED');
    }
    const final=await this.#current(tx,scope,rawId,prepared.contentHash);this.#port();if(!same(before.binding,final.binding))fail('RESULT_SUBMISSION_CURRENT_CHANGED');
    return cloneV1(entry);
   });this.#port();return cloneV1(result);
  }catch(error){if(error instanceof ResultSubmissionFailure||error instanceof Error&&/^RESULT_MANIFEST_(INVALID|SENSITIVE)$/.test(error.message))throw error;fail('RESULT_SUBMISSION_STORAGE_UNAVAILABLE');}
 }
}
