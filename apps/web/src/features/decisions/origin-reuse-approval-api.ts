import {ApiError} from '../../api/client.ts';
import {browserCanonical,wireHash,exact as wireExact,iso,uuid,ref as validRef} from '../control-handoff/api.ts';
import {nativeSourceScopes} from '../connections/native-boundary-preparation-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ApprovalView} from './api.ts';
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
   ||v.currentVersion!==1||v.storedStatus!=='PENDING'||v.decision!==null||v.consumption!==null||v.executionAuthorized!==false
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
  if(await wireHash(snapshot)!==v.requestRef.contentHash||new TextEncoder().encode(browserCanonical(v)).length>2*1024*1024
   ||v.expired!==(Date.parse(v.observedAt)>=Date.parse(d.expiresAt))||v.effectiveState!==(v.expired?'EXPIRED':v.basisCurrent?'PENDING':'REVOKED'))bad();
  return view;
 }catch{ return bad(); }
}

/** API 클라이언트에는 세션이 없다. 화면의 현재 소유자와 보관 원주체를 별도로 대조한다. */
export function assertOriginReuseOwner(view:ApprovalView,session:DocumentSession):void{
 if(!isOriginReuseApproval(view))return;
 if(view.request.requestedBy.userId!==session.user.id||view.request.requestedBy.clientId!==session.clientId)throw new ApiError('APPROVAL_OWNER_MISMATCH',403);
}
