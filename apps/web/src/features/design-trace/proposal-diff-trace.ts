import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,postDocumentCommand,type DocumentBuffer,type DocumentSession,type DocumentWrite} from './editor-api.ts';
import {readStoredProposal,type ProposalComparison} from './proposal-api.ts';
import {readWorkPlan,type PlanRef} from './work-plan-api.ts';
import type {TraceEdge,TraceRef} from './trace-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {validRef} from '../connections/api.ts';

export interface ProposalDiffTraceBuffer{
 source:{proposalId:string;baseRef:PlanRef;diffRef:ProposalComparison['proposal']['diffRef'];proposedContentRef:ProposalComparison['proposal']['proposedContentRef']};
 planRef:PlanRef|null;taskCode:string;reason:string;designRef:PlanRef|null;pending:DocumentWrite|null;result:TraceEdge|null;uncertain:boolean;failure:{code:string;status:number}|null;
}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const fail=():never=>{throw new ApiError('PROPOSAL_TRACE_INVALID');};
export function newProposalDiffTrace(c:ProposalComparison):ProposalDiffTraceBuffer{
 return{source:structuredClone({proposalId:c.proposal.id,baseRef:c.proposal.baseRef,diffRef:c.proposal.diffRef,proposedContentRef:c.proposal.proposedContentRef}),planRef:null,taskCode:'',reason:'',designRef:null,pending:null,result:null,uncertain:false,failure:null};
}
function input(buffer:DocumentBuffer,session:DocumentSession){
 const p=buffer.proposalState,t=p?.diffTrace,r=p?.restored;
 if(!p||!t||!r||p.snapshot||r.kind!=='STORED_PROPOSAL'||p.ownerUserId!==session.user.id||buffer.ownerUserId!==session.user.id||r.projectId!==buffer.projectId||r.clientId!==session.clientId||r.controlGeneration!==buffer.controlGeneration||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||!validRef(p.baseRef)||!p.comparison||!same(p.baseRef,t.source.baseRef)||!same(p.proposal?.diffRef,t.source.diffRef)||!same(p.proposal?.proposedContentRef,t.source.proposedContentRef)||r.proposalId!==t.source.proposalId||p.proposal?.id!==r.proposalId||!t.planRef||!validRef(t.planRef)||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(t.taskCode)||typeof t.reason!=='string'||!t.reason.trim()||t.reason.length>20000||!t.reason.isWellFormed()||!validRef({id:session.clientId,version:1,contentHash:'a'.repeat(64)})||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken))return fail();
 const from:TraceRef={kind:'ARTIFACT',id:t.source.diffRef.artifactId,versionRef:{id:t.source.diffRef.artifactId,version:1,contentHash:t.source.diffRef.contentHash}},to:TraceRef={kind:'PLAN_TASK',id:t.planRef.id,versionRef:structuredClone(t.planRef),localCode:t.taskCode};
 return{t,p,payload:{from,to,relation:'IMPLEMENTS' as const,reason:t.reason}};
}
function operation(client:ApiClient,session:DocumentSession,active:()=>boolean){
 const transport=client.transport,actor=structuredClone(session);return()=>{if(!active()||client.transport!==transport||session.user.id!==actor.user.id||session.clientId!==actor.clientId||session.csrfToken!==actor.csrfToken)throw new ApiError('TRACE_LINK_CONTINUATION_PAUSED');};
}
async function verify(client:ApiClient,b:DocumentBuffer,s:DocumentSession,check:()=>void){
 const value=input(b,s);check();const c=await readStoredProposal(client,b.projectId,value.t.source.proposalId,()=>{check();return true;});check();
 if(!same(newProposalDiffTrace(c).source,value.t.source))fail();
 const plan=await readWorkPlan(client,b.projectId,value.t.planRef!);check();
 if(plan.relationalProjection!=='STORED'||plan.tasks.filter(t=>t.taskCode===value.t.taskCode).length!==1)fail();
 return{...value,plan};
}
export async function prepareProposalDiffTrace(client:ApiClient,session:DocumentSession,buffer:DocumentBuffer,active:()=>boolean){
 const check=operation(client,session,active),b=structuredClone(buffer),s=structuredClone(session);const {t,payload,plan}=await verify(client,b,s,check);
 if(t.pending||t.result||t.uncertain)fail();const generation=await documentControl(client,b.projectId,s);check();if(generation!==b.controlGeneration)throw new ApiError('PROJECT_CONTROL_CHANGED',409);
 const pending:DocumentWrite={schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:generation,operation:'linkTrace',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
 return{...t,pending,designRef:structuredClone(plan.designRef),failure:null};
}
export async function sendProposalDiffTrace(client:ApiClient,session:DocumentSession,buffer:DocumentBuffer,active:()=>boolean){
 const check=operation(client,session,active),b=structuredClone(buffer),s=structuredClone(session),{t,payload}=input(b,s),c=t.pending;
 if(!c||t.result||!validRef(t.designRef)||c.schemaVersion!==1||!validRef({id:c.commandId,version:1,contentHash:'a'.repeat(64)})||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||c.operation!=='linkTrace'||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!same(c.payload,payload))return fail();
 const verified=await verify(client,b,s,check);if(!same(verified.plan.designRef,t.designRef))fail();check();
 // 서버가 원명령의 현재 권한·정책·세대를 판정한다. UNKNOWN도 원명령을 교체하지 않는다.
 const response=await postDocumentCommand(client,c,s.csrfToken);check();const edge=response.data?.edge as TraceEdge,ref=response.data?.ref;
 if(response.data?.status!=='TRACE_LINKED'||!validRef(ref)||ref.version!==1||!edge||Object.keys(edge).sort().join(',')!=='createdAt,designRefs,edgeHash,from,id,reason,relation,to'||response.targetId!==edge.id||response.version!==1||ref.id!==edge.id||ref.contentHash!==edge.edgeHash||!same(edge.from,payload.from)||!same(edge.to,payload.to)||edge.relation!=='IMPLEMENTS'||edge.reason!==payload.reason||!same(edge.designRefs,[t.designRef])||!Number.isFinite(Date.parse(edge.createdAt)))throw new ApiError('RESPONSE_INVALID');
 const{id,createdAt,edgeHash,...data}=edge,digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(data))))].map(n=>n.toString(16).padStart(2,'0')).join('');check();if(digest!==edgeHash)throw new ApiError('TRACE_INTEGRITY_FAILED');return structuredClone(edge);
}
