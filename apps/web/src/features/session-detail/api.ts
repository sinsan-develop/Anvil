import {ApiClient} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readAssignmentDraft,type AssignmentDraftView} from '../workspace/assignment-api.ts';
import {readAssignmentDecision,readConfirmedAssignment,type AssignmentDecisionView,type ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readResponsibleSessionState,type ResponsibleSessionState} from '../workspace/responsible-session-api.ts';

export interface SessionDetail{
 projectId:string;assignmentRef:PlanRef;draft:AssignmentDraftView;decision:AssignmentDecisionView;
 confirmed:ConfirmedAssignmentView|null;state:ResponsibleSessionState|null;
}
/** 이미 제공된 권한 검사 GET만 연결한다. 선택 변경/이탈 후 다음 요청을 시작하지 않는다.
 * 고정 원문과 현재 실행 사실은 다르며 이 조회로 실행·중지·완료를 만들지 않는다. */
export async function readSessionDetail(client:ApiClient,projectId:string,assignmentRef:PlanRef,active:()=>boolean=()=>true):Promise<SessionDetail|null>{
 if(!active())return null;const selected=structuredClone(assignmentRef);
 const draft=await readAssignmentDraft(client,projectId,selected);if(!active())return null;
 const decision=await readAssignmentDecision(client,projectId,draft);if(!active())return null;
 if(!decision.confirmedRef)return{projectId,assignmentRef:selected,draft,decision,confirmed:null,state:null};
 const confirmed=await readConfirmedAssignment(client,projectId,decision.confirmedRef,draft);if(!active())return null;
 const state=await readResponsibleSessionState(client,confirmed);if(!active())return null;
 return{projectId,assignmentRef:selected,draft,decision,confirmed,state};
}
