import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readAssignmentDraft} from '../workspace/assignment-api.ts';
import {readConfirmedAssignment} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:any)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&/^[a-f0-9]{64}$/.test(v.contentHash);
const fail=():never=>{throw new ApiError('ISSUE_ASSIGNMENT_BINDING_INVALID');};
/** 이미 조회한 선택 보고에 고정된 당시 임무를 읽는다. 현재 기준/원인·완료·실행 권한을 만들지 않는다. */
export async function readReportedIssueAssignment(client:ApiClient,original:SubmittedResultView,returnDraft:PlanRef,active:()=>boolean){
 if(!active())return null;const r=structuredClone(original),draftRef=structuredClone(returnDraft),s=r?.snapshot,pid=s?.scope?.projectId,a=s?.scope?.assignmentRef;
 if(!uuid(pid)||!ref(r?.ref)||!ref(a)||!ref(draftRef)||draftRef.id!==a.id||draftRef.version!==a.version||s.transport!=='SYNTHETIC_ONLY'||s.sourceKind!=='WORKER_CLAIM'||['evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'].some(k=>(s as any)[k]!==false))fail();
 const bytes=new TextEncoder().encode(ordered(s));if(bytes.length>2*1024*1024)fail();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==r.ref.contentHash)fail();if(!active())return null;
 const draft=await readAssignmentDraft(client,pid,draftRef);if(!active())return null;
 const assignment=await readConfirmedAssignment(client,pid,a,draft);if(!active())return null;
 return{assignment,detail:{projectId:pid,draft,confirmed:assignment},sourceCurrentness:'NOT_RECHECKED' as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
}
