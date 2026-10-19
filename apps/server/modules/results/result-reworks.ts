import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';
import {readSyntheticResultReviewRecord} from './result-reviews.ts';
import type {ResultEvidenceScope} from './result-evidence.ts';

type Ref=RuntimeRefV1;
export interface SyntheticResultReworkTransaction {clock():Promise<string>;current():Promise<unknown>;readResult(reference:Ref):Promise<unknown>;readReview(reference:Ref):Promise<unknown>;readRework(id:string):Promise<unknown>;appendRework(record:SyntheticResultRework):Promise<void>}
export interface SyntheticResultReworkStore {transport:'SYNTHETIC_ONLY';transaction<T>(scope:ResultEvidenceScope,body:(tx:SyntheticResultReworkTransaction)=>Promise<T>):Promise<T>}
interface ReworkInput {resultRef:Ref;reviewRef:Ref;missingItems:string[];sourceScopes:SourceScopeV1[];reason:string}
export interface SyntheticResultRework {ref:Ref;snapshot:{transport:'SYNTHETIC_ONLY';scope:ResultEvidenceScope;originalResultRef:Ref;reviewRef:Ref;stageSessionRef:Ref;requesterRef:Ref;authorityRef:Ref;missingItems:string[];preservedItems:string[];remainingMissingItems:string[];sourceScopes:SourceScopeV1[];reason:string;status:'REWORK_ASSIGNMENT_DRAFT';createdAt:string;completionAccepted:false;formalFailureCounted:false;executionAuthorized:false;dispatchPerformed:false}}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
class ResultReworkFailure extends Error{}
function fail(code:string):never{throw new ResultReworkFailure(code);}
function readInput(v:unknown):ReworkInput{
 if(!recordV1(v,['resultRef','reviewRef','missingItems','sourceScopes','reason'])||!refV1(v.resultRef)||!refV1(v.reviewRef)||!arrayV1(v.missingItems,100)||!v.missingItems.length||v.missingItems.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(id))||new Set(v.missingItems).size!==v.missingItems.length||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>20000)fail('RESULT_REWORK_INPUT_INVALID');
 try{assertKnowledgeTextSafe(v.reason);return{...cloneV1(v),sourceScopes:readSourceScopesV1(v.sourceScopes)} as ReworkInput;}catch{fail('RESULT_REWORK_INPUT_INVALID');}
}
function within(child:SourceScopeV1[],parent:SourceScopeV1[]){return child.every(s=>{const p=parent.find(p=>['sourceRootRef','mappingRef','observationRef','baselineRef'].every(key=>same(p[key as keyof SourceScopeV1],s[key as keyof SourceScopeV1])));return!!p&&s.targets.every(t=>p.targets.some(v=>v.relativePath===t.relativePath&&v.kind===t.kind&&v.recursive===t.recursive&&(v.access===t.access||v.access==='WRITE'&&t.access==='READ')));});}
/** 검수의 부족 항목만 같은 단계 세션에 연결하는 보완 초안 journal이다.
 * 실제 임무 배정/새 writer·실행/실패 횟수 증가/정식 저장의 기본 제공자는 없다. */
export class SyntheticResultReworks {
 readonly store:SyntheticResultReworkStore;
 constructor(store:SyntheticResultReworkStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')fail('SYNTHETIC_RESULT_REWORK_STORE_REQUIRED');}
 async #await<T>(body:()=>Promise<T>){this.#port();const value=await body();this.#port();return value;}
 async #current(tx:SyntheticResultReworkTransaction,scope:ResultEvidenceScope,input:ReworkInput){
  const v=cloneV1(await this.#await(()=>tx.current())),now=await this.#await(()=>tx.clock());
  if(!isoV1(now)||!recordV1(v,['transport','scope','operation','resultRef','reviewRef','requesterRef','authorityRef','stageSessionRef','allowedSourceScopes','affectedSourceScopes','checkedAt','expiresAt'])||v.transport!=='SYNTHETIC_ONLY'||v.operation!=='REQUEST_REWORK'||!same(v.scope,scope)||!same(v.resultRef,input.resultRef)||!same(v.reviewRef,input.reviewRef)||!refV1(v.requesterRef)||!refV1(v.authorityRef)||!refV1(v.stageSessionRef)||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=Date.parse(now))fail('RESULT_REWORK_CURRENT_REQUIRED');
  const allowed=readSourceScopesV1(v.allowedSourceScopes),affected=readSourceScopesV1(v.affectedSourceScopes);if(!within(affected,allowed)||!within(input.sourceScopes,allowed)||!within(input.sourceScopes,affected))fail('RESULT_REWORK_SCOPE_EXPANSION');
  const {checkedAt:_,...binding}=v;return{value:v,now,binding};
 }
 async requestRework(rawScope:unknown,reworkId:unknown,rawInput:unknown):Promise<SyntheticResultRework>{
  if(!recordV1(rawScope,['projectId','assignmentRef','executionRef'])||!uuidV1(rawScope.projectId)||!refV1(rawScope.assignmentRef)||!refV1(rawScope.executionRef)||!uuidV1(reworkId))fail('RESULT_REWORK_SCOPE_INVALID');const scope=cloneV1(rawScope) as ResultEvidenceScope,input=readInput(rawInput);
  try{return await this.#await(()=>this.store.transaction(scope,async tx=>{
   const initial=await this.#current(tx,scope,input),submission=readSubmittedResultRecord(await this.#await(()=>tx.readResult(cloneV1(input.resultRef))),scope,input.resultRef.id,initial.now);if(!same(submission.ref,input.resultRef))fail('RESULT_REWORK_RESULT_MISMATCH');
   const review=readSyntheticResultReviewRecord(await this.#await(()=>tx.readReview(cloneV1(input.reviewRef))),scope,input.reviewRef,initial.now),r=review.snapshot;
   if(!same(r.input.resultRef,input.resultRef)||r.input.outcome==='ACCEPTED'||Date.parse(r.reviewedAt)<Date.parse(submission.snapshot.submittedAt))fail('RESULT_REWORK_REVIEW_MISMATCH');
   const missing=r.input.items.filter(i=>i.outcome==='REWORK'||i.outcome==='BLOCKED').map(i=>i.criterionId);if(input.missingItems.some(id=>!missing.includes(id)))fail('RESULT_REWORK_NONMISSING_ITEM');
   const current=await this.#current(tx,scope,input);if(!same(initial.binding,current.binding))fail('RESULT_REWORK_CURRENT_CHANGED');
   const snapshot:SyntheticResultRework['snapshot']={transport:'SYNTHETIC_ONLY',scope,originalResultRef:cloneV1(input.resultRef),reviewRef:cloneV1(input.reviewRef),stageSessionRef:cloneV1(current.value.stageSessionRef),requesterRef:cloneV1(current.value.requesterRef),authorityRef:cloneV1(current.value.authorityRef),missingItems:input.missingItems,preservedItems:r.input.items.filter(i=>i.outcome==='ACCEPTED'||i.outcome==='NOT_APPLICABLE').map(i=>i.criterionId),remainingMissingItems:missing.filter(id=>!input.missingItems.includes(id)),sourceScopes:input.sourceScopes,reason:input.reason,status:'REWORK_ASSIGNMENT_DRAFT',createdAt:current.now,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
   const raw=await this.#await(()=>tx.readRework(reworkId));let entry:SyntheticResultRework;
   if(raw!==null){const row=cloneV1(raw);if(!recordV1(row,['ref','snapshot'])||!refV1(row.ref)||row.ref.id!==reworkId||row.ref.version!==1||row.ref.contentHash!==hash(row.snapshot)||!isoV1(row.snapshot?.createdAt)||Date.parse(row.snapshot.createdAt)>Date.parse(current.now)||Date.parse(row.snapshot.createdAt)<Date.parse(r.reviewedAt))fail('RESULT_REWORK_LEDGER_INVALID');if(!same(row.snapshot,{...snapshot,createdAt:row.snapshot.createdAt}))fail('RESULT_REWORK_ID_CONFLICT');entry=row as SyntheticResultRework;}
   else{entry={ref:{id:reworkId,version:1,contentHash:hash(snapshot)},snapshot};await this.#await(()=>tx.appendRework(cloneV1(entry)));if(!same(await this.#await(()=>tx.readRework(reworkId)),entry))fail('RESULT_REWORK_WRITE_UNCONFIRMED');}
   const final=await this.#current(tx,scope,input);if(!same(initial.binding,final.binding))fail('RESULT_REWORK_CURRENT_CHANGED');return cloneV1(entry);
  }));}catch(error){if(error instanceof ResultReworkFailure)throw error;fail('RESULT_REWORK_UNAVAILABLE');}
 }
}
