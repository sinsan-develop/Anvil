import {ApiError,type ApiClient} from '../../api/client.ts';
import {browserCanonical,wireHash,exact as wireExact,iso,uuid,ref as validRef} from '../control-handoff/api.ts';
import {nativeSourceScopes} from '../connections/native-boundary-preparation-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {sendApprovalCommand,type ApprovalView,type Decision} from './api.ts';
import type {ProjectCommand} from '../../../../server/modules/access/project-command.ts';
import type {Ref} from '../connections/api.ts';

export interface OriginReuseEvidence{
 purpose:'FN09_ORIGIN_REUSE_SYNTHETIC_START_V1';projectId:string;originRef:Ref;reservationRef:Ref;
 originCommand:{serverCommandId:string;commandId:string;requestHash:string};
 subject:{kind:'HUMAN';userId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number};
 execution:{executionId:string;executionGeneration:number};p1Ref:Ref;p2Ref:Ref;stageRequestRef:Ref;assignmentRef:Ref;roleBindingRef:Ref;sessionBindingRef:Ref;
 preparationRef:Ref;connectionRef:Ref;environmentRef:Ref;contextBundleRef:Ref;optionsRef:Ref;sourceScopes:unknown[];budgetPolicyRef:Ref;
 dependencies:{kind:string;ref:Ref}[];candidateCommandId:string;candidatePayloadHash:string;candidatePayload:Record<string,any>;
}
const exact=(v:unknown,keys:readonly string[]):v is Record<string,any>=>wireExact(v,keys);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a:unknown,b:unknown)=>browserCanonical(a)===browserCanonical(b);
const text=(v:unknown)=>typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&v.length<=20000;
const bad=():never=>{throw new ApiError('RESPONSE_INVALID');};
export const isOriginReuseApproval=(view:ApprovalView)=>view?.request?.details?.actionScope?.operation==='queueExecutionCommand';

/** 보관된 봉인과 관계만 검산한다. 현재 서버 권한·실행 허가를 만들지 않는다. */
export async function validateOriginReuseApproval(view:ApprovalView,pid:string,id:string):Promise<ApprovalView>{
 try{
  if(!exact(view,['request','requestRef','currentVersion','storedStatus','effectiveState','decision','consumption','expired','basisCurrent','executionAuthorized','observedAt']))bad();
  const v:any=view,r=v.request;
  if(!uuid(pid)||!uuid(id)||!exact(r,['id','version','status','projectId','details','scopeDigest','requiredDecider','policyRef','requestedBy','controlGeneration','originReuseEvidence','createdAt'])
   ||r.id!==id||r.projectId!==pid||r.version!==1||r.status!=='PENDING'||!validRef(v.requestRef)||v.requestRef.id!==id||v.requestRef.version!==1
   ||![1,2].includes(v.currentVersion)||v.consumption!==null||v.executionAuthorized!==false
   ||typeof v.expired!=='boolean'||typeof v.basisCurrent!=='boolean'||!iso(v.observedAt)||!iso(r.createdAt)||Date.parse(r.createdAt)>Date.parse(v.observedAt)
   ||!validRef(r.policyRef)||!positive(r.controlGeneration)||!exact(r.requestedBy,['kind','userId','clientId'])||r.requestedBy.kind!=='HUMAN'||!uuid(r.requestedBy.userId)||!uuid(r.requestedBy.clientId)
   ||!exact(r.requiredDecider,['kind','userId'])||r.requiredDecider.kind!=='HUMAN'||r.requiredDecider.userId!==r.requestedBy.userId)bad();
  const d=r.details,a=d?.actionScope;
  if(!exact(d,['reason','risks','rollback','expiresAt','actionScope','candidateCommandId'])||!text(d.reason)||!uuid(d.candidateCommandId)||!iso(d.expiresAt)||Date.parse(r.createdAt)>=Date.parse(d.expiresAt)
   ||!exact(d.risks,['data','security','cost','interruption','unverified'])||!Object.values(d.risks).every(text)
   ||!exact(d.rollback,['method','limitations','evidenceRefs'])||!text(d.rollback.method)||!text(d.rollback.limitations)||!Array.isArray(d.rollback.evidenceRefs)||d.rollback.evidenceRefs.length
   ||!exact(a,['operation','targetRef','expectedVersion','payloadHash','baselineRefs','environmentRef','sourceScopes','limitsRef','requestedSubjectRef','controlGeneration'])
   ||a.operation!=='queueExecutionCommand'||a.targetRef!==null||a.expectedVersion!==0||!hash(a.payloadHash)||!Array.isArray(a.baselineRefs)||a.baselineRefs.length||a.environmentRef!==null||!Array.isArray(a.sourceScopes)||a.sourceScopes.length||a.limitsRef!==null
   ||!same(a.requestedSubjectRef,r.requestedBy)||a.controlGeneration!==r.controlGeneration||!hash(r.scopeDigest)||await wireHash(a)!==r.scopeDigest)bad();
  const e=r.originReuseEvidence;
  if(!exact(e,['purpose','projectId','originRef','reservationRef','originCommand','subject','execution','p1Ref','p2Ref','stageRequestRef','assignmentRef','roleBindingRef','sessionBindingRef','preparationRef','connectionRef','environmentRef','contextBundleRef','optionsRef','sourceScopes','budgetPolicyRef','dependencies','candidateCommandId','candidatePayloadHash','candidatePayload'])
   ||e.purpose!=='FN09_ORIGIN_REUSE_SYNTHETIC_START_V1'||e.projectId!==pid
   ||['originRef','reservationRef','p1Ref','p2Ref','stageRequestRef','assignmentRef','roleBindingRef','sessionBindingRef','preparationRef','connectionRef','environmentRef','contextBundleRef','optionsRef','budgetPolicyRef'].some(k=>!validRef(e[k]))
   ||!exact(e.originCommand,['serverCommandId','commandId','requestHash'])||!uuid(e.originCommand.serverCommandId)||!uuid(e.originCommand.commandId)||!hash(e.originCommand.requestHash)
   ||!exact(e.subject,['kind','userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||e.subject.kind!=='HUMAN'||e.subject.userId!==r.requestedBy.userId||e.subject.clientId!==r.requestedBy.clientId||!uuid(e.subject.humanSessionId)||!positive(e.subject.credentialGeneration)||e.subject.controlGeneration!==r.controlGeneration
   ||!exact(e.execution,['executionId','executionGeneration'])||!uuid(e.execution.executionId)||!positive(e.execution.executionGeneration)
   ||!same(e.p2Ref,r.policyRef)||e.p1Ref.id!==e.p2Ref.id||e.p1Ref.version>=e.p2Ref.version||!same(e.optionsRef,e.preparationRef)
   ||e.candidateCommandId!==d.candidateCommandId||e.candidatePayloadHash!==a.payloadHash)bad();
  nativeSourceScopes(e.sourceScopes);
  const c=e.candidatePayload;
  if(!exact(c,['preparationRef','executionId','executionGeneration','permissionPolicyRef','budgetPolicyRef','operation','payload','originReuse'])||c.operation!=='START_SESSION'
   ||c.executionId!==e.execution.executionId||c.executionGeneration!==e.execution.executionGeneration||!same(c.preparationRef,e.preparationRef)||!same(c.permissionPolicyRef,e.p2Ref)||!same(c.budgetPolicyRef,e.budgetPolicyRef)
   ||!exact(c.payload,['contextBundleRef','optionsRef'])||!same(c.payload.contextBundleRef,e.contextBundleRef)||!same(c.payload.optionsRef,e.optionsRef)
   ||!exact(c.originReuse,['originRef','reservationRef'])||!same(c.originReuse.originRef,e.originRef)||!same(c.originReuse.reservationRef,e.reservationRef)||await wireHash(c)!==e.candidatePayloadHash)bad();
  const kinds=['ENVIRONMENT_HOST_DECLARATION','COMMAND_PROFILE_METADATA','SECRET_REFERENCE_METADATA','SOURCE_ROOT_DECLARATION','CONNECTOR_REGISTRATION','CONNECTOR_STATUS'];
  if(!Array.isArray(e.dependencies))bad();let prior='';
  for(const entry of e.dependencies){if(!exact(entry,['kind','ref'])||typeof entry.kind!=='string'||!kinds.includes(entry.kind)||!validRef(entry.ref))bad();const key=entry.kind+':'+entry.ref.id;if(key<=prior)bad();prior=key;}
  const {id:ignoredId,version,status,createdAt,...snapshot}=r;
  let storedStatus='PENDING';
  if(v.decision===null){if(v.currentVersion!==1)bad();}
  else{if(v.currentVersion!==2||!exact(v.decision,['ref','id','requestId','requestVersion','requestRef','scopeDigest','decision','reason','decidedBy','controlGeneration','policyRef','decidedAt']))bad();
   const {ref:decisionRef,...decision}=v.decision;await validateOriginDecision(decision,decisionRef,view);if(Date.parse(decision.decidedAt)>Date.parse(v.observedAt))bad();storedStatus=decisionStatus(decision.decision);}
  const effective=['PENDING','APPROVED'].includes(storedStatus)?v.expired?'EXPIRED':v.basisCurrent?storedStatus:'REVOKED':storedStatus;
  if(v.storedStatus!==storedStatus||await wireHash(snapshot)!==v.requestRef.contentHash||new TextEncoder().encode(browserCanonical(v)).length>2*1024*1024
   ||v.expired!==(Date.parse(v.observedAt)>=Date.parse(d.expiresAt))||v.effectiveState!==effective)bad();
  return view;
 }catch{ return bad(); }
}

/** API 클라이언트에는 세션이 없다. 화면의 현재 소유자와 보관 원주체를 별도로 대조한다. */
export function assertOriginReuseOwner(view:ApprovalView,session:DocumentSession):void{
 if(!isOriginReuseApproval(view))return;
 if(view.request.requestedBy.userId!==session.user.id||view.request.requestedBy.clientId!==session.clientId)throw new ApiError('APPROVAL_OWNER_MISMATCH',403);
}

const decisionStatus=(choice:unknown)=>choice==='APPROVE'?'APPROVED':choice==='REJECT'?'REJECTED':choice==='REQUEST_CHANGE'?'CHANGE_REQUESTED':bad();
async function validateOriginDecision(d:any,ref:unknown,view:ApprovalView):Promise<void>{
 const r=view.request;
 if(!validRef(ref))throw new ApiError('RESPONSE_INVALID');
 if(!exact(d,['id','requestId','requestVersion','requestRef','scopeDigest','decision','reason','decidedBy','controlGeneration','policyRef','decidedAt'])||ref.version!==1||ref.id!==d.id
  ||d.requestId!==r.id||d.requestVersion!==1||!same(d.requestRef,view.requestRef)||d.scopeDigest!==r.scopeDigest||!['APPROVE','REJECT','REQUEST_CHANGE'].includes(d.decision)||!text(d.reason)
  ||!same(d.decidedBy,r.requestedBy)||d.controlGeneration!==r.controlGeneration||!same(d.policyRef,r.policyRef)||!iso(d.decidedAt)||Date.parse(d.decidedAt)<Date.parse(r.createdAt)||Date.parse(d.decidedAt)>=Date.parse(r.details.expiresAt))bad();
 const{id,decidedAt,...snapshot}=d;if(await wireHash(snapshot)!==ref.contentHash)bad();
}
function ownerCheck(session:DocumentSession){
 const owner={userId:session.user.id,clientId:session.clientId,csrf:session.csrfToken};
 if(!uuid(owner.userId)||!uuid(owner.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(owner.csrf))throw new ApiError('APPROVAL_BINDING_INVALID');
 return()=>{if(session.user.id!==owner.userId||session.clientId!==owner.clientId||session.csrfToken!==owner.csrf)throw new ApiError('APPROVAL_CONTEXT_CHANGED',412);};
}
/** 현재 보호 조회의 원 요청에 대한 명시 결정 명령만 준비한다. 전송·소비하지 않는다. */
export async function prepareOriginReuseDecision(pid:string,raw:ApprovalView,choice:Decision,reason:string,session:DocumentSession,generation:number):Promise<ProjectCommand>{
 const check=ownerCheck(session),v=structuredClone(raw);await validateOriginReuseApproval(v,pid,v.request.id);check();assertOriginReuseOwner(v,session);
 if(v.currentVersion!==1||v.effectiveState!=='PENDING'||v.decision!==null||v.expired||!v.basisCurrent||!(Date.now()<Date.parse(v.request.details.expiresAt)))throw new ApiError('APPROVAL_NOT_PENDING',412);
 if(generation!==v.request.controlGeneration)throw new ApiError('APPROVAL_DECIDER_DENIED',403);
 if(!['APPROVE','REJECT','REQUEST_CHANGE'].includes(choice)||!text(reason))throw new ApiError('APPROVAL_INPUT_INVALID');
 return{schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:generation,operation:'decideApproval',targetId:v.request.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{requestId:v.request.id,expectedVersion:1,scopeDigest:v.request.scopeDigest,decision:choice,reason}};
}
/** 범용 sender의 원 결과에 더해 부모 요청·P2·제어·정확 원명령까지 검산한다. */
export async function sendOriginReuseDecision(client:ApiClient,raw:ApprovalView,rawCommand:ProjectCommand,session:DocumentSession,active:()=>boolean):Promise<any>{
 const view=structuredClone(raw),command=structuredClone(rawCommand),transport=client.transport,owner=ownerCheck(session);
 const check=()=>{owner();if(!active()||client.transport!==transport)throw new ApiError('APPROVAL_CONTEXT_CHANGED',412);};check();
 await validateOriginReuseApproval(view,command.projectId,view.request.id);check();assertOriginReuseOwner(view,session);
 const p=command.payload;
 if(!exact(command,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||command.schemaVersion!==1||!uuid(command.commandId)||command.projectId!==view.request.projectId||command.clientId!==session.clientId||command.controlGeneration!==view.request.controlGeneration||command.operation!=='decideApproval'||command.targetId!==view.request.id||command.expectedVersion!==1||command.approvalRef!==null||!Array.isArray(command.baselineRefs)||command.baselineRefs.length
  ||!exact(p,['requestId','expectedVersion','scopeDigest','decision','reason'])||p.requestId!==view.request.id||p.expectedVersion!==1||p.scopeDigest!==view.request.scopeDigest||!['APPROVE','REJECT','REQUEST_CHANGE'].includes(String(p.decision))||!text(p.reason))throw new ApiError('APPROVAL_CANDIDATE_MISMATCH',409);
 // hash 대기 중 caller가 원 packet을 바꿔도 전송되는 원문은 고정한다.
 const freeze=(v:any):void=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}};freeze(command);
 const result=await sendApprovalCommand(client,command,session,()=>{check();return true;});check();
 if(!exact(result,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||!exact(result.data,['ref','status','decision'])||result.data.status!=='APPROVAL_DECIDED'||!Array.isArray(result.evidenceRefs)||result.evidenceRefs.length||!Array.isArray(result.warnings)||result.warnings.length||result.serverReceivedAt!==result.data.decision?.decidedAt)bad();
 await validateOriginDecision(result.data.decision,result.data.ref,view);check();
 if(result.data.decision.decision!==p.decision||result.data.decision.reason!==p.reason||view.decision!==null&&!same(view.decision.ref,result.data.ref))bad();
 return result;
}
