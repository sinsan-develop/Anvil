import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SyntheticSubmittedResult} from '../../../../server/modules/results/result-submission-store.ts';

export interface ResultSummary {ref:PlanRef;manifestRef:PlanRef;executionRef:PlanRef;submissionState:string;submittedByRef:PlanRef;submittedAt:string;sourceKind:'WORKER_CLAIM';evidenceProvenanceVerified:false;completionAccepted:false}
export interface AssignmentResults {projectId:string;assignmentRef:PlanRef;items:ResultSummary[];hasMore:boolean;observedAt:string}
export interface AssignmentResultPage extends AssignmentResults{nextCursor:string|null;selectionState:'NOT_SELECTED'}
export type SubmittedResultView=SyntheticSubmittedResult;
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:any):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=(v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const date=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const states=['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED'];
const fail=():never=>{throw new ApiError('RESULT_RESPONSE_INVALID');};
function summary(v:any):v is ResultSummary{return exact(v,['ref','manifestRef','executionRef','submissionState','submittedByRef','submittedAt','sourceKind','evidenceProvenanceVerified','completionAccepted'])&&[v.ref,v.manifestRef,v.executionRef,v.submittedByRef].every(ref)&&v.ref.version===1&&v.manifestRef.id===v.ref.id&&v.manifestRef.version===1&&states.includes(v.submissionState)&&date(v.submittedAt)&&v.sourceKind==='WORKER_CLAIM'&&v.evidenceProvenanceVerified===false&&v.completionAccepted===false;}
function binding(projectId:string,assignmentRef:PlanRef){if(!uuid(projectId)||!ref(assignmentRef))fail();}
async function digest(value:unknown){const bytes=new TextEncoder().encode(ordered(value));if(bytes.length>2*1024*1024)fail();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function list(v:AssignmentResults,projectId:string,a:PlanRef){if(!exact(v,['projectId','assignmentRef','items','hasMore','observedAt'])||v.projectId!==projectId||!same(v.assignmentRef,a)||!Array.isArray(v.items)||v.items.length>20||!v.items.every(summary)||new Set(v.items.map(r=>r.ref.id)).size!==v.items.length||typeof v.hasMore!=='boolean'||v.hasMore&&v.items.length!==20||!date(v.observedAt)||v.items.some(i=>Date.parse(i.submittedAt)>Date.parse(v.observedAt)))fail();}

export async function readAssignmentResults(client:ApiClient,projectId:string,assignmentRef:PlanRef,active:()=>boolean):Promise<AssignmentResults|null>{
 binding(projectId,assignmentRef);const a=structuredClone(assignmentRef);if(!active())return null;
 const v=await client.get<AssignmentResults>(`/api/v1/projects/${projectId}/assignments/${a.id}/versions/${a.version}/results`);if(!active())return null;
 list(v,projectId,a);return v;
}
export async function readAssignmentResultPage(client:ApiClient,projectId:string,assignmentRef:PlanRef,cursor:string|null,active:()=>boolean):Promise<AssignmentResultPage|null>{
 binding(projectId,assignmentRef);if(cursor!==null&&(typeof cursor!=='string'||!cursor.length||cursor.length>4096))fail();const a=structuredClone(assignmentRef);if(!active())return null;
 const v=await client.get<AssignmentResultPage>(`/api/v1/projects/${projectId}/assignments/${a.id}/versions/${a.version}/result-pages${cursor===null?'':'?cursor='+encodeURIComponent(cursor)}`);if(!active())return null;
 if(!exact(v,['projectId','assignmentRef','items','hasMore','observedAt','nextCursor','selectionState'])||v.selectionState!=='NOT_SELECTED'||!(v.hasMore?typeof v.nextCursor==='string'&&v.nextCursor.length>0&&v.nextCursor.length<=4096:v.nextCursor===null))fail();const{nextCursor:_,selectionState:__,...base}=v;list(base,projectId,a);if(v.items.some((r,i)=>i>0&&(v.items[i-1]!.submittedAt<r.submittedAt||v.items[i-1]!.submittedAt===r.submittedAt&&v.items[i-1]!.ref.id<=r.ref.id)))fail();return active()?structuredClone(v):null;
}
/** 해시/고정 참조의 대응을 확인하지만 제출된 증거 출처나 완료의 진위를 검수하지 않는다. */
export async function readAssignmentResult(client:ApiClient,projectId:string,assignmentRef:PlanRef,item:ResultSummary,active:()=>boolean):Promise<SubmittedResultView|null>{
 binding(projectId,assignmentRef);if(!summary(item))fail();const a=structuredClone(assignmentRef),selected=structuredClone(item);if(!active())return null;
 const v=await client.get<SubmittedResultView>(`/api/v1/projects/${projectId}/results/${selected.ref.id}`);if(!active())return null;
 if(!exact(v,['ref','snapshot'])||!same(v.ref,selected.ref))fail();const s=v.snapshot;
 if(!exact(s,['transport','scope','submittedByRef','authorizationReceiptRef','manifest','manifestHash','submittedAt','sourceKind','evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])||s.transport!=='SYNTHETIC_ONLY'||!exact(s.scope,['projectId','assignmentRef','executionRef'])||s.scope.projectId!==projectId||!same(s.scope.assignmentRef,a)||!same(s.scope.executionRef,selected.executionRef)||!same(s.submittedByRef,selected.submittedByRef)||!ref(s.authorizationReceiptRef)||s.submittedAt!==selected.submittedAt||s.manifestHash!==selected.manifestRef.contentHash||s.sourceKind!=='WORKER_CLAIM'||s.evidenceProvenanceVerified!==false||s.completionAccepted!==false||s.formalFailureCounted!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)fail();
 const m=s.manifest;
 if(!exact(m,['assignmentRef','executionRef','baselineRefs','submissionState','changes','commandResults','testResults','artifactRefs','unexecuted','risks','rollback','checkpointRef'])||!same(m.assignmentRef,a)||!same(m.executionRef,selected.executionRef)||m.submissionState!==selected.submissionState||!['baselineRefs','changes','commandResults','testResults','artifactRefs','unexecuted','risks'].every(k=>Array.isArray(m[k])&&m[k].length<=200)||!m.baselineRefs.every(ref)||!m.artifactRefs.every(ref)||m.checkpointRef!==null&&!ref(m.checkpointRef)||typeof m.rollback!=='string'||m.rollback.length>20000)fail();
 if(await digest(m)!==s.manifestHash||await digest(s)!==v.ref.contentHash)fail();if(!active())return null;return v;
}
