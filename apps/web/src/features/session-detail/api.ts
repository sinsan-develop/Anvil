import {ApiClient,ApiError} from '../../api/client.ts';
import {readCandidate,type CandidateView} from '../connections/api.ts';
import {readDefinition,type DefinitionView} from '../connections/connection-definition-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readAssignmentDraft,type AssignmentDraftView} from '../workspace/assignment-api.ts';
import {readAssignmentDecision,readConfirmedAssignment,type AssignmentDecisionView,type ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readResponsibleSessionState,type ResponsibleSessionState} from '../workspace/responsible-session-api.ts';

type SessionTool=
 |{kind:'CONNECTION_CANDIDATE';connectionRef:PlanRef;value:CandidateView|null;error:string|null}
 |{kind:'REGISTERED_DEFINITION';connectionRef:PlanRef;value:DefinitionView|null;error:string|null};

export interface SessionDetail{
 projectId:string;assignmentRef:PlanRef;draft:AssignmentDraftView;decision:AssignmentDecisionView;
 confirmed:ConfirmedAssignmentView|null;state:ResponsibleSessionState|null;
 tools:SessionTool[];
}
/** 이미 제공된 권한 검사 GET만 연결한다. 선택 변경/이탈 후 다음 요청을 시작하지 않는다.
 * 고정 원문과 현재 실행 사실은 다르며 이 조회로 실행·중지·완료를 만들지 않는다. */
export async function readSessionDetail(client:ApiClient,projectId:string,assignmentRef:PlanRef,active:()=>boolean=()=>true):Promise<SessionDetail|null>{
 const transport=client.transport,current=()=>active()&&client.transport===transport;
 if(!current())return null;const selected=structuredClone(assignmentRef);
 const draft=await readAssignmentDraft(client,projectId,selected);if(!current())return null;
 const decision=await readAssignmentDecision(client,projectId,draft);if(!current())return null;
 if(!decision.confirmedRef)return{projectId,assignmentRef:selected,draft,decision,confirmed:null,state:null,tools:[]};
 const confirmed=await readConfirmedAssignment(client,projectId,decision.confirmedRef,draft);if(!current())return null;
 const state=await readResponsibleSessionState(client,confirmed);if(!current())return null;
 const references=[...new Map(state.bindings.map(b=>{
  const r=b.snapshot.connectionRef as PlanRef;
  const kind=b.snapshot.connectionKind==='REGISTERED_DEFINITION'?'REGISTERED_DEFINITION':'CONNECTION_CANDIDATE';
  return [[kind,r.id,r.version,r.contentHash].join(':'),{kind,connectionRef:structuredClone(r)}] as const;
 })).values()];
 const loaded=await Promise.all(references.map(async ({kind,connectionRef}):Promise<SessionTool|null>=>{
  if(!current())return null;
  try{
   if(kind==='REGISTERED_DEFINITION'){
    const value=await readDefinition(client,projectId,connectionRef,current);
    return current()?{kind,connectionRef,value,error:null}:null;
   }
   const value=await readCandidate(client,projectId,connectionRef);
   if(!current())return null;
   if(value.candidate.kind!=='CONNECTION_CANDIDATE')throw new ApiError('SESSION_TOOL_KIND_INVALID',412);
   return{kind,connectionRef,value,error:null};
  }
  catch(cause){
   if(!current())return null;
   if(cause instanceof ApiError&&cause.status===401)throw cause;
   const error=cause instanceof ApiError&&/^[A-Z_]{1,80}$/.test(cause.code)?cause.code:'RESPONSE_INVALID';
   return{kind,connectionRef,value:null,error};
  }
 }));if(!current())return null;
 const tools=loaded.filter((v):v is NonNullable<typeof v>=>v!==null);
 return{projectId,assignmentRef:selected,draft,decision,confirmed,state,tools};
}
