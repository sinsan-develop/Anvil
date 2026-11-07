import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import {validRef} from '../connections/api.ts';
import {documentControl,postDocumentCommand,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {TraceEdge,TraceRef} from '../design-trace/trace-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {SessionDetail} from './api.ts';
import {readAssignmentPlanOriginal} from './assignment-plan-original.ts';
export type ArtifactTraceDetail=Pick<SessionDetail,'projectId'|'draft'|'confirmed'>;
export interface ArtifactTaskTraceBuffer {binding:string;selected:PlanRef|null;reason:string;pending:DocumentWrite|null;designRef:PlanRef|null;result:TraceEdge|null;uncertain:boolean;failure:{code:string;status:number}|null}
export interface ArtifactTaskTraceStorage {buffers:Record<string,ArtifactTaskTraceBuffer|null>;onChange:(key:string,change:(value:ArtifactTaskTraceBuffer|null)=>ArtifactTaskTraceBuffer|null)=>void}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),fail=():never=>{throw new ApiError('ARTIFACT_TASK_TRACE_INVALID');};
async function hash(value:unknown){const bytes=new TextEncoder().encode(ordered(value));if(bytes.length>2*1024*1024)fail();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function artifactTaskTraceKey(session:DocumentSession,detail:ArtifactTraceDetail,result:SubmittedResultView){return ordered([session.user.id,session.clientId,detail.projectId,detail.draft.ref,detail.confirmed?.ref,result.ref]);}
export function newArtifactTaskTrace(binding:string):ArtifactTaskTraceBuffer{return{binding,selected:null,reason:'',pending:null,designRef:null,result:null,uncertain:false,failure:null};}
async function source(session:DocumentSession,detail:ArtifactTraceDetail,result:SubmittedResultView,buffer:ArtifactTaskTraceBuffer){
 if(!validRef(result.ref)||!detail.confirmed||buffer.binding!==artifactTaskTraceKey(session,detail,result)||!buffer.selected||buffer.selected.version!==1||!validRef(buffer.selected)||!buffer.reason.trim()||buffer.reason.length>20000||!buffer.reason.isWellFormed()||result.snapshot.scope.projectId!==detail.projectId||!same(result.snapshot.scope.assignmentRef,detail.confirmed.ref)||await hash(result.snapshot)!==result.ref.contentHash||result.snapshot.manifest.artifactRefs.filter((r:PlanRef)=>r.id===buffer.selected!.id).length!==1||!result.snapshot.manifest.artifactRefs.some((r:PlanRef)=>same(r,buffer.selected)))return fail();
 const task=detail.confirmed.snapshot.definition.taskRef,from:TraceRef={kind:'ARTIFACT',id:buffer.selected.id,versionRef:structuredClone(buffer.selected)},to:TraceRef={kind:'PLAN_TASK',id:task.planRef.id,versionRef:structuredClone(task.planRef),localCode:task.taskCode};
 return{from,to,relation:'IMPLEMENTS' as const,reason:buffer.reason};
}
export async function prepareArtifactTaskTrace(client:ApiClient,session:DocumentSession,detail:ArtifactTraceDetail,result:SubmittedResultView,raw:ArtifactTaskTraceBuffer,active:()=>boolean){
 const buffer=structuredClone(raw),s=structuredClone(session),d=structuredClone(detail),r=structuredClone(result),transport=client.transport,current=()=>active()&&client.transport===transport;
 if(buffer.pending||buffer.result||buffer.uncertain)fail();const payload=await source(s,d,r,buffer);if(!current())return null;
 const plan=await readAssignmentPlanOriginal(client,d,current);if(!current()||!plan)return null;
 const generation=await documentControl(client,d.projectId,s);if(!current())return null;
 const pending:DocumentWrite={schemaVersion:1,projectId:d.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:generation,operation:'linkTrace',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
 return{...buffer,pending,designRef:structuredClone(plan.designRef),failure:null};
}
export async function sendArtifactTaskTrace(client:ApiClient,session:DocumentSession,detail:ArtifactTraceDetail,result:SubmittedResultView,raw:ArtifactTaskTraceBuffer,active:()=>boolean){
 const b=structuredClone(raw),s=structuredClone(session),d=structuredClone(detail),r=structuredClone(result),transport=client.transport,current=()=>active()&&client.transport===transport;
 const payload=await source(s,d,r,b),c=b.pending;if(!c||!b.designRef||!same(b.designRef,d.draft.snapshot.basis.designRef)||c.schemaVersion!==1||!validRef({id:c.commandId,version:1,contentHash:'a'.repeat(64)})||c.projectId!==d.projectId||c.clientId!==s.clientId||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||c.operation!=='linkTrace'||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!same(c.payload,payload))fail();if(!current())return null;
 const response=await postDocumentCommand(client,c!,s.csrfToken);if(!current())return null;
 const edge=response.data?.edge as TraceEdge,ref=response.data?.ref;
 if(response.data?.status!=='TRACE_LINKED'||!validRef(ref)||ref.version!==1||!edge||Object.keys(edge).sort().join(',')!=='createdAt,designRefs,edgeHash,from,id,reason,relation,to'||response.targetId!==edge.id||response.version!==1||ref.id!==edge.id||ref.contentHash!==edge.edgeHash||!same(edge.from,payload.from)||!same(edge.to,payload.to)||edge.relation!=='IMPLEMENTS'||edge.reason!==payload.reason||!Array.isArray(edge.designRefs)||!edge.designRefs.every(validRef)||!edge.designRefs.some(v=>same(v,b.designRef))||!Number.isFinite(Date.parse(edge.createdAt)))throw new ApiError('RESPONSE_INVALID');
 const{id,createdAt,edgeHash,...data}=edge;if(await hash(data)!==edgeHash)throw new ApiError('TRACE_INTEGRITY_FAILED');return current()?structuredClone(edge):null;
}
