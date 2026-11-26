import {ApiClient,ApiError} from '../../api/client.ts';
import {sessionDetailHref} from '../../shell/routes.ts';
import type {PlanRef} from './work-plan-api.ts';
import type {TraceRef} from './trace-api.ts';

export type TraceTaskEvidenceState='MATCHED'|'ASSIGNMENT_NOT_FOUND'|'ASSIGNMENT_AMBIGUOUS'|'PLAN_REFERENCE_MISMATCH';
export interface TraceTaskEvidenceView{projectId:string;planRef:PlanRef;taskCode:string;state:TraceTaskEvidenceState;assignmentRef:PlanRef|null;draftRef:PlanRef|null;observedAt:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const exact=(value:unknown,keys:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const ref=(value:any):value is PlanRef=>exact(value,['id','version','contentHash'])&&uuid.test(value.id)&&Number.isSafeInteger(value.version)&&value.version>0&&hash.test(value.contentHash);
const same=(a:PlanRef,b:PlanRef)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const states:TraceTaskEvidenceState[]=['MATCHED','ASSIGNMENT_NOT_FOUND','ASSIGNMENT_AMBIGUOUS','PLAN_REFERENCE_MISMATCH'];

export async function readTraceTaskEvidence(client:ApiClient,projectId:string,target:TraceRef,active:()=>boolean):Promise<TraceTaskEvidenceView|null>{
 if(!uuid.test(projectId)||target.kind!=='PLAN_TASK'||target.id!==target.versionRef.id||!ref(target.versionRef)||typeof target.localCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(target.localCode))throw new ApiError('CLIENT_PATH_INVALID');
 const planRef=structuredClone(target.versionRef),taskCode=target.localCode;if(!active())return null;
 const query=new URLSearchParams({planId:planRef.id,planVersion:String(planRef.version),planHash:planRef.contentHash,taskCode});
 let value:TraceTaskEvidenceView;
 try{value=await client.get<TraceTaskEvidenceView>(`/api/v1/projects/${projectId}/traces/task-evidence?${query}`);}catch(error){if(!active())return null;throw error;}
 if(!active())return null;
 if(!exact(value,['projectId','planRef','taskCode','state','assignmentRef','draftRef','observedAt'])||value.projectId!==projectId||!ref(value.planRef)||!same(value.planRef,planRef)||value.taskCode!==taskCode||!states.includes(value.state)||!Number.isFinite(Date.parse(value.observedAt))||(value.state==='MATCHED'?(!ref(value.assignmentRef)||!ref(value.draftRef)||value.assignmentRef.id!==value.draftRef.id||value.assignmentRef.version!==value.draftRef.version):value.assignmentRef!==null||value.draftRef!==null))throw new ApiError('TRACE_TASK_EVIDENCE_RESPONSE_INVALID');
 return structuredClone(value);
}

export function traceTaskEvidenceHref(value:TraceTaskEvidenceView){
 if(value.state!=='MATCHED'||!value.assignmentRef||!value.draftRef)throw new ApiError('TRACE_TASK_EVIDENCE_NOT_MATCHED');
 return sessionDetailHref(value.projectId,value.draftRef);
}
