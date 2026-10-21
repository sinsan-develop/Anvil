import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readWorkspaceMethodology} from '../workspace/api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {RecordedResultReview} from './result-review-write-api.ts';
import {readStoredResultReview,type StoredReviewSummary} from './stored-result-reviews-api.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),flags=['completionAccepted','formalFailureCounted','evidenceProvenanceVerified','executionAuthorized','dispatchPerformed'] as const;
const ref=(v:any)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&typeof v.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&/^[a-f0-9]{64}$/.test(v.contentHash);
const fail=():never=>{throw new ApiError('NEXT_ACTION_BASIS_INVALID');};
async function hash(v:unknown){const b=new TextEncoder().encode(ordered(v));if(b.length>2*1024*1024)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 선택 보관 검수와 현재 적용본만 대조한다. 실제 실행 상태·완료 판정 제공자가 아니다. */
export async function readNextActionBasis(client:ApiClient,original:SubmittedResultView,confirmed:ConfirmedAssignmentView,selected:RecordedResultReview,active:()=>boolean){
 const r=structuredClone(original),a=structuredClone(confirmed),review=structuredClone(selected);if(!active())return null;
 const task=a?.snapshot?.definition?.taskRef,pid=r?.snapshot?.scope?.projectId,s=review?.snapshot;
 if(!ref(r?.ref)||!ref(a?.ref)||!ref(review?.ref)||!task||!ref(task.applicationRef)||typeof task.nodeId!=='string'||!task.nodeId.trim()||a.projectId!==pid||review.projectId!==pid||!same(r.snapshot.scope.assignmentRef,a.ref)||!same(s?.scope,r.snapshot.scope)||!same(s?.input?.resultRef,r.ref)||a.snapshot.contentConfirmed!==true||a.snapshot.ready!==false||a.snapshot.executionAuthorized!==false||a.snapshot.dispatchPerformed!==false||review.reviewStored!==true||flags.some(k=>review[k]!==false||s[k]!==false)||await hash(a.snapshot)!==a.ref.contentHash||await hash(s)!==review.ref.contentHash)fail();
 const item:StoredReviewSummary={ref:review.ref,criteriaRef:s.input.criteriaRef,outcome:s.input.outcome,reviewedBy:s.reviewedBy,sameAsSubmitter:s.sameAsSubmitter,reviewedAt:s.reviewedAt,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const freshReview=await readStoredResultReview(client,r,item,active);if(!freshReview||!active())return null;
 if(!same(freshReview.snapshot,s))fail();
 const application=await readWorkspaceMethodology(client,pid,task.applicationRef);if(!active())return null;
 const nodes=application.snapshot?.graph.nodes.filter(n=>n.nodeId===task.nodeId);if(!nodes||nodes.length!==1)return fail();const node=nodes[0]!;
 return{projectId:pid,resultRef:r.ref,reviewRef:review.ref,assignmentRef:a.ref,applicationRef:application.applicationRef!,nodeId:node.nodeId,nodeName:node.name,action:s.input.outcome==='REWORK'?'REVIEW_REWORK_FOR_SELECTED_STAGE' as const:'WAIT_HUMAN_UNBLOCK_DECISION' as const,reviewOutcome:s.input.outcome,sourceAssurance:'STORED_REVIEW_WITH_CURRENT_METHODOLOGY' as const,resultTransport:r.snapshot.transport,reviewObservedAt:freshReview.observedAt,applicationObservedAt:application.observedAt,reasonCodes:['COMPLETION_NOT_ACCEPTED','RUNTIME_STATE_NOT_VERIFIED','CURRENT_AUTHORITY_BUDGET_NOT_REVALIDATED'],completionAccepted:false as const,runtimeStateVerified:false as const,automaticTransitionPerformed:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
}
export type NextActionBasis=NonNullable<Awaited<ReturnType<typeof readNextActionBasis>>>;
