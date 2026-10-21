import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readSessionDetail} from '../session-detail/api.ts';
import {listContextPreparations,readContextPreparation} from '../workspace/context-api.ts';
import {ordered} from '../knowledge/review-view.ts';
/** 기존 인증 GET만 소비한다. 현재 안전·이전·재개 허가를 합성하지 않는다. */
export async function readTransferRecords(client:ApiClient,projectId:string,assignmentRef:PlanRef,active:()=>boolean=()=>true){
 if(!active())return null;
 const detail=await readSessionDetail(client,projectId,structuredClone(assignmentRef),active);
 if(!active()||!detail)return null;
 const contexts=detail.confirmed?await listContextPreparations(client,projectId,detail.confirmed.ref):null;
 if(!active())return null;
 return{detail,contexts};
}
export async function readTransferContext(client:ApiClient,projectId:string,assignmentRef:PlanRef,contextRef:PlanRef,active:()=>boolean=()=>true){
 if(!active())return null;
 const expected=structuredClone(assignmentRef),selected=structuredClone(contextRef);
 const value=await readContextPreparation(client,projectId,selected);
 if(!active())return null;
 if(ordered(value.manifest.assignmentRef)!==ordered(expected))throw new ApiError('TRANSFER_CONTEXT_ASSIGNMENT_MISMATCH',412);
 return value;
}
