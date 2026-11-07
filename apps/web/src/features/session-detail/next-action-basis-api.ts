import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {RecordedResultReview} from './result-review-write-api.ts';
import {validateStoredResultReview} from './stored-result-reviews-api.ts';
import type {ProjectNextActionBasis} from '../../../../server/modules/scheduling/project-next-action-basis.ts';
export type NextActionBasis=Awaited<ReturnType<ProjectNextActionBasis['read']>>['basis'];
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),flags=['completionAccepted','formalFailureCounted','evidenceProvenanceVerified','executionAuthorized','dispatchPerformed'] as const;
const ref=(v:any)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&typeof v.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&/^[a-f0-9]{64}$/.test(v.contentHash);
const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const fail=():never=>{throw new ApiError('NEXT_ACTION_BASIS_INVALID');};
async function hash(v:unknown){const b=new TextEncoder().encode(ordered(v));if(b.length>2*1024*1024)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 원검수의 서버 대조만 소비한다. 완료 승인·현재 실행 상태·queue/dispatch를 만들지 않는다. */
export async function readNextActionBasis(client:ApiClient,original:SubmittedResultView,confirmed:ConfirmedAssignmentView,selected:RecordedResultReview,active:()=>boolean):Promise<NextActionBasis|null>{
 const r=structuredClone(original),a=structuredClone(confirmed),review=structuredClone(selected);if(!active())return null;
 const task=a?.snapshot?.definition?.taskRef,pid=r?.snapshot?.scope?.projectId,s=review?.snapshot;
 if(!ref(r?.ref)||!ref(a?.ref)||!ref(review?.ref)||!task||!ref(task.applicationRef)||typeof task.nodeId!=='string'||!task.nodeId.trim()||a.projectId!==pid||review.projectId!==pid||!same(r.snapshot.scope.assignmentRef,a.ref)||!same(s?.scope,r.snapshot.scope)||!same(s?.input?.resultRef,r.ref)||a.snapshot.contentConfirmed!==true||a.snapshot.ready!==false||a.snapshot.executionAuthorized!==false||a.snapshot.dispatchPerformed!==false||review.reviewStored!==true||flags.some(k=>review[k]!==false||s[k]!==false)||await hash(a.snapshot)!==a.ref.contentHash||await hash(s)!==review.ref.contentHash)fail();
 await validateStoredResultReview(r,review);if(!active())return null;
 const value=await client.get<NextActionBasis>(`/api/v1/projects/${pid}/result-reviews/${review.ref.id}/next-action-basis`);if(!active())return null;
 const keys=['projectId','resultRef','reviewRef','assignmentRef','applicationRef','nodeId','nodeName','action','reviewOutcome','sourceAssurance','resultTransport','reviewObservedAt','applicationObservedAt','reasonCodes','completionAccepted','runtimeStateVerified','automaticTransitionPerformed','executionAuthorized','dispatchPerformed'];
 if(!exact(value,keys)||value.projectId!==pid||!same(value.resultRef,r.ref)||!same(value.reviewRef,review.ref)||!same(value.assignmentRef,a.ref)||!same(value.applicationRef,task.applicationRef)||value.nodeId!==task.nodeId||typeof value.nodeName!=='string'||!value.nodeName.trim()||value.nodeName.length>200||!value.nodeName.isWellFormed()||value.reviewOutcome!==s.input.outcome||value.action!==(s.input.outcome==='REWORK'?'REVIEW_REWORK_FOR_SELECTED_STAGE':'WAIT_HUMAN_UNBLOCK_DECISION')||value.sourceAssurance!=='SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY'||value.resultTransport!==r.snapshot.transport||!date(value.reviewObservedAt)||Date.parse(value.reviewObservedAt)<Date.parse(s.reviewedAt)||!date(value.applicationObservedAt)||!same(value.reasonCodes,['COMPLETION_NOT_ACCEPTED','RUNTIME_STATE_NOT_VERIFIED','CURRENT_AUTHORITY_BUDGET_NOT_REVALIDATED'])||['completionAccepted','runtimeStateVerified','automaticTransitionPerformed','executionAuthorized','dispatchPerformed'].some(k=>value[k as keyof NextActionBasis]!==false))fail();
 return active()?structuredClone(value):null;
}
