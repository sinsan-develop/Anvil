import {ApiClient,ApiError} from '../../api/client.ts';
import {readCandidate,type CandidateView} from '../connections/api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readAssignmentDraft,type AssignmentDraftView} from '../workspace/assignment-api.ts';
import {readAssignmentDecision,readConfirmedAssignment,type AssignmentDecisionView,type ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readResponsibleSessionState,type ResponsibleSessionState} from '../workspace/responsible-session-api.ts';

export interface SessionDetail{
 projectId:string;assignmentRef:PlanRef;draft:AssignmentDraftView;decision:AssignmentDecisionView;
 confirmed:ConfirmedAssignmentView|null;state:ResponsibleSessionState|null;
 tools:{connectionRef:PlanRef;value:CandidateView|null;error:string|null}[];
}
/** 이미 제공된 권한 검사 GET만 연결한다. 선택 변경/이탈 후 다음 요청을 시작하지 않는다.
 * 고정 원문과 현재 실행 사실은 다르며 이 조회로 실행·중지·완료를 만들지 않는다. */
export async function readSessionDetail(client:ApiClient,projectId:string,assignmentRef:PlanRef,active:()=>boolean=()=>true):Promise<SessionDetail|null>{
 if(!active())return null;const selected=structuredClone(assignmentRef);
 const draft=await readAssignmentDraft(client,projectId,selected);if(!active())return null;
 const decision=await readAssignmentDecision(client,projectId,draft);if(!active())return null;
 if(!decision.confirmedRef)return{projectId,assignmentRef:selected,draft,decision,confirmed:null,state:null,tools:[]};
 const confirmed=await readConfirmedAssignment(client,projectId,decision.confirmedRef,draft);if(!active())return null;
 const state=await readResponsibleSessionState(client,confirmed);if(!active())return null;
 const references=[...new Map(state.bindings.map(b=>{const r=b.snapshot.connectionRef as PlanRef;return[[r.id,r.version,r.contentHash].join(':'),structuredClone(r)] as const;})).values()];
 const loaded=await Promise.all(references.map(async connectionRef=>{
  if(!active())return null;
  try{const value=await readCandidate(client,projectId,connectionRef);if(!active())return null;if(value.candidate.kind!=='CONNECTION_CANDIDATE')throw new ApiError('SESSION_TOOL_KIND_INVALID',412);return{connectionRef,value,error:null};}
  catch(cause){if(!active())return null;if(cause instanceof ApiError&&cause.status===401)throw cause;const code=cause instanceof ApiError&&/^[A-Z_]{1,80}$/.test(cause.code)?cause.code:'RESPONSE_INVALID';return{connectionRef,value:null,error:code};}
 }));if(!active())return null;
 const tools=loaded.filter((v):v is NonNullable<typeof v>=>v!==null);
 return{projectId,assignmentRef:selected,draft,decision,confirmed,state,tools};
}
