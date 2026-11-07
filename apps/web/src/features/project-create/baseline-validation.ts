import { ApiError } from '../../api/client.ts';
import { ordered } from '../knowledge/review-view.ts';
import type { BaselineDraftInput, BaselineEvidenceRef } from '../../../../server/modules/projects/baseline-input.ts';
import type { BaselineContentReview, BaselineConfirmation } from '../../../../server/modules/projects/baseline-decision-input.ts';
export type { BaselineDraftInput, BaselineEvidenceRef, BaselineItem, BaselineFeatureState } from '../../../../server/modules/projects/baseline-input.ts';
export type { BaselineContentReview, BaselineConfirmation, BaselineCoreEvidence, BaselineReviewOutcome } from '../../../../server/modules/projects/baseline-decision-input.ts';
export type Ref = { id: string; version: number; contentHash: string };
export const featureLabels = { IMPLEMENTED_CORE_CHECKED:'구현 완료·핵심 동작 확인', IMPLEMENTED_UNCHECKED:'구현했지만 동작 미확인', PARTIAL:'부분 구현', NOT_IMPLEMENTED:'미구현' } as const;
export const exact = (v:any,keys:string[]) => !!v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export const uuid = (v:unknown):v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export const hash = (v:unknown):v is string => typeof v==='string' && /^[0-9a-f]{64}$/.test(v);
export const reference = (v:any):v is Ref => exact(v,['id','version','contentHash']) && uuid(v.id) && Number.isSafeInteger(v.version) && v.version>0 && hash(v.contentHash);
const nullable = (v:any)=> v===null || reference(v);
export const text = (v:unknown,max=20000):v is string => typeof v==='string' && v.isWellFormed() && !!v.trim() && v.length<=max;
export const timestamp = (v:unknown):v is string => typeof v==='string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v;
export const same = (a:unknown,b:unknown)=>ordered(a)===ordered(b);
export const artifact = (v:any):v is BaselineEvidenceRef => exact(v,['artifactId','bytes','contentHash','mediaType']) && uuid(v.artifactId) && Number.isSafeInteger(v.bytes) && v.bytes>=0 && v.bytes<=20*1024*1024 && hash(v.contentHash) && text(v.mediaType,200) && !/[\u0000-\u001f\u007f]/.test(v.mediaType);
const evidence = (v:any):v is BaselineEvidenceRef[] => Array.isArray(v) && v.length<=200 && v.every(artifact) && new Set(v.map(a=>a.artifactId)).size===v.length;
const outcome = (v:unknown)=> typeof v==='string' && ['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'].includes(v);
const state = (v:unknown)=> typeof v==='string' && Object.hasOwn(featureLabels,v);
const bad = ():never=>{throw new ApiError('BASELINE_INPUT_INVALID');};
// Browser input checks do not replace protected server/policy/byte checks or HUMAN content review.
function safe(value:unknown,seen=new Set<object>(),depth=0):void {
 if(depth>30)bad();
 if(typeof value==='string') { if(!value.isWellFormed())bad(); return; }
 if(value===null || typeof value==='boolean' || typeof value==='number' && Number.isFinite(value))return;
 if(!value || typeof value!=='object')return bad();
 if(seen.has(value) || !Array.isArray(value) && Object.getPrototypeOf(value)!==Object.prototype)return bad();
 seen.add(value);
 for(const key of Object.keys(value)) { const d=Object.getOwnPropertyDescriptor(value,key);if(!d || !('value' in d))return bad();safe(d.value,seen,depth+1); }
 seen.delete(value);
}
export function safeJson(value:unknown):void { safe(value); if(new TextEncoder().encode(ordered(value)).length>2*1024*1024)bad(); }
export function validateBaselineInput(v:any):asserts v is BaselineDraftInput {
 safeJson(v);
 if(!exact(v,['baseRef','source','items','coverageReason','reason']) || !nullable(v.baseRef) || !text(v.coverageReason) || !text(v.reason))bad();
 const s=v.source;
 if(!exact(s,['kind','declarationRef','sourceRootRef','snapshotRef','grantRef','unverifiedReason']) || !text(s.unverifiedReason))bad();
 if(s.kind==='NONE_SELECTED' ? ![s.declarationRef,s.sourceRootRef,s.snapshotRef,s.grantRef].every(r=>r===null) : s.kind==='DECLARATION_ONLY' ? !reference(s.declarationRef) || ![s.sourceRootRef,s.snapshotRef,s.grantRef].every(r=>r===null) : s.kind!=='ATTRIBUTE_REPORT' || !nullable(s.declarationRef) || !reference(s.sourceRootRef) || !reference(s.snapshotRef) || s.snapshotRef.version!==1 || !reference(s.grantRef) || s.grantRef.version!==1)bad();
 if(!Array.isArray(v.items) || !v.items.length || v.items.length>200 || new Set(v.items.map((i:any)=>i?.itemId)).size!==v.items.length)bad();
 let count=0;
 for(const i of v.items)if(!exact(i,['itemId','title','designRef','featureState','evidenceRefs','limitations','reason']) || !text(i.itemId,200) || /[\u0000-\u001f\u007f]/.test(i.itemId) || !text(i.title,200) || !nullable(i.designRef) || !state(i.featureState) || !evidence(i.evidenceRefs) || (count+=i.evidenceRefs.length)>200 || i.featureState==='IMPLEMENTED_CORE_CHECKED' && !i.evidenceRefs.length || !text(i.limitations) || !text(i.reason))bad();
}
export function validateBaselineReview(v:any):asserts v is BaselineContentReview {
 safeJson(v);
 if(!exact(v,['draftRef','criteriaVersion','reviewerKind','items','coverage','outcome','reason']) || !reference(v.draftRef) || v.criteriaVersion!==1 || v.reviewerKind!=='HUMAN' || !outcome(v.outcome) || !text(v.reason) || !exact(v.coverage,['outcome','reason']) || !outcome(v.coverage.outcome) || !text(v.coverage.reason) || !Array.isArray(v.items) || !v.items.length || v.items.length>200 || new Set(v.items.map((i:any)=>i?.itemId)).size!==v.items.length)bad();
 let count=0;
 for(const i of v.items) {
  if(!exact(i,['itemId','featureState','outcome','reason','evidenceRefs','coreEvidence']) || !text(i.itemId,200) || !state(i.featureState) || !outcome(i.outcome) || !text(i.reason) || !evidence(i.evidenceRefs) || (count+=i.evidenceRefs.length)>200)bad();
  const c=i.coreEvidence;
  if(c!==null && (!exact(c,['basis','environment','checkedAt','normalFlow','storageRead','importantFailure']) || typeof c.basis!=='string' || !['ACTUAL','MOCK','STATIC','NOT_EXECUTED','UNKNOWN'].includes(c.basis) || !text(c.environment) || !timestamp(c.checkedAt) || !evidence(c.normalFlow) || !evidence(c.storageRead) || !evidence(c.importantFailure) || [...c.normalFlow,...c.storageRead,...c.importantFailure].some(r=>!i.evidenceRefs.some((e:any)=>same(e,r)))))bad();
  if(i.featureState==='IMPLEMENTED_CORE_CHECKED' && i.outcome==='ACCEPTED' && (!c || c.basis!=='ACTUAL' || !c.normalFlow.length || !c.storageRead.length || !c.importantFailure.length))bad();
 }
 if(v.outcome==='ACCEPTED' && (v.coverage.outcome!=='ACCEPTED' || v.items.some((i:any)=>i.outcome!=='ACCEPTED')))bad();
}
export function validateBaselineConfirmation(v:any):asserts v is BaselineConfirmation {
 safeJson(v);
 if(!exact(v,['draftRef','reviewRefs','reason','acknowledged']) || !reference(v.draftRef) || !Array.isArray(v.reviewRefs) || !v.reviewRefs.length || v.reviewRefs.length>200 || !v.reviewRefs.every(reference) || new Set(v.reviewRefs.map(ordered)).size!==v.reviewRefs.length || !text(v.reason) || v.acknowledged!==true)bad();
}
export async function digestBytes(bytes:Uint8Array<ArrayBuffer>):Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''); }
export async function snapshotHash(snapshot:unknown,ref:Ref):Promise<void> { safeJson(snapshot);if(!reference(ref) || await digestBytes(new TextEncoder().encode(ordered(snapshot)))!==ref.contentHash)throw new ApiError('BASELINE_INTEGRITY_FAILED'); }
export const flagKeys=['sourceAuthorizationVerified','coverageVerified','executionAuthorized','dispatchPerformed'];
export const flagsFalse=(v:any)=>flagKeys.every(k=>v?.[k]===false);
export function checkCurrent(v:any):void { if(!exact(v,['state','issues']) || !['MATCHED_METADATA','CHANGED','UNAVAILABLE'].includes(v.state) || !Array.isArray(v.issues) || v.issues.length>1000 || v.issues.some((i:any)=>typeof i!=='string' || !/^[A-Z_]{1,100}$/.test(i)))throw new ApiError('RESPONSE_INVALID'); }
export function checkSourceBinding(s:any,input:BaselineDraftInput):void {
 if(!exact(s,['kind','declaration','observation','declarationReportRelation']) || s.kind!==input.source.kind || s.declarationReportRelation!=='UNVERIFIED')bad();
 if(input.source.declarationRef===null ? s.declaration!==null : !exact(s.declaration,['ref','authority','readiness']) || !same(s.declaration.ref,input.source.declarationRef) || s.declaration.authority!=='USER_DECLARED' || s.declaration.readiness!=='UNVERIFIED')bad();
 const o=s.observation;
 if(input.source.kind!=='ATTRIBUTE_REPORT') { if(o!==null)bad();return; }
 if(!exact(o,['snapshotRef','grantRef','sourceRootRef','connectorRef','observedSummary','observedAt','finishedAt','receivedAt','evidenceClass','osVerification','executionAuthorized']) || !same(o.snapshotRef,input.source.snapshotRef) || !same(o.grantRef,input.source.grantRef) || !same(o.sourceRootRef,input.source.sourceRootRef) || !reference(o.connectorRef) || o.evidenceClass!=='CONNECTOR_REPORTED' || o.osVerification!=='UNVERIFIED' || o.executionAuthorized!==false || !['observedAt','finishedAt','receivedAt'].every(k=>timestamp(o[k])))bad();
 const n=o.observedSummary;if(!exact(n,['rootState','total','observed','missing','denied','changed','unverified']) || typeof n.rootState!=='string' || !['total','observed','missing','denied','changed','unverified'].every(k=>Number.isSafeInteger(n[k]) && n[k]>=0))bad();
}
