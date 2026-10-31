import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, postDocumentCommand, type DocumentSession, type DocumentWrite } from '../design-trace/editor-api.ts';
import type { PlanRef } from '../design-trace/work-plan-api.ts';
import type { ConfirmedAssignmentView } from './assignment-confirmation-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import type {ApprovalRequestWork,ApprovalView} from '../decisions/api.ts';
import {responsibleSessionCommand} from './responsible-session-approval.ts';

export type ResponsibleSessionAction='COORDINATOR'|'STAGE_OWNER'|'BIND'|'BIND_COORDINATOR';
export interface PreparationRecord {projectId:string;ref:PlanRef;snapshot:Record<string,any>}
export interface ResponsibleSessionState {projectId:string;assignmentRef:PlanRef;roles:PreparationRecord[];bindings:PreparationRecord[];preparations:PreparationRecord[];hasMorePreparations:boolean;currentness:'NOT_RECHECKED';executionAuthorized:false;dispatchPerformed:false}
export interface ResponsibleSessionBuffer {reservationKind?:'COORDINATOR'|'STAGE_OWNER';responsibleApproval?:{request:ApprovalRequestWork|null;requestId:string;commandHash:string|null};closedResponsibleApprovals?:{command:DocumentWrite;request:ApprovalRequestWork;view:ApprovalView}[];savedReceipt?:{ref:PlanRef;snapshot:Record<string,any>};bindingId:string;projectId:string;assignmentRef:PlanRef;ownerUserId:string;ownerClientId:string;controlGeneration:number;reason:string;connectionRef:PlanRef|null;pending:DocumentWrite|null;uncertain:boolean;dirty:boolean;failure:{code:string;status:number}|null}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:any):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&/^[a-f0-9]{64}$/.test(v.contentHash);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const text=(v:any)=>typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&v.length<=20000;
const date=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const person=(v:any)=>exact(v,['kind','userId'])&&v.kind==='HUMAN'&&uuid(v.userId);
const unresolved=['RESPONSIBLE_SESSION_RESERVED','CONNECTION_CANDIDATE_ONLY','ENVIRONMENT_CANDIDATE_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'];
const conditionCodes=[...unresolved,'REQUIRED_CONTEXT_MISSING','CURRENT_CONTEXT_CHANGED','UNDERSTANDING_NOT_REVIEWED'];
function scopesWithin(requested:any,allowed:any[]) {
  if(!Array.isArray(requested)||!requested.length||requested.length>200)return false;
  let count=0;return requested.every(s=>exact(s,['sourceRootRef','mappingRef','observationRef','baselineRef','targets'])&&['sourceRootRef','observationRef','baselineRef'].every(k=>ref(s[k]))&&(s.mappingRef===null||ref(s.mappingRef))
    &&Array.isArray(s.targets)&&s.targets.length>0&&s.targets.every((t:any)=>{count++;return count<=200&&exact(t,['relativePath','kind','access','recursive'])&&t.kind==='FILE'&&t.recursive===false&&['READ','WRITE'].includes(t.access)&&typeof t.relativePath==='string'&&!t.relativePath.split('/').some((p:string)=>!p||p==='.'||p==='..')&&!/[\\:\u0000]/.test(t.relativePath)
      &&allowed.some(a=>['sourceRootRef','mappingRef','observationRef','baselineRef'].every(k=>same(a[k],s[k]))&&a.targets.some((target:any)=>same(target,t)));}));
}
function confirmedBinding(confirmed:ConfirmedAssignmentView){if(!uuid(confirmed.projectId)||!ref(confirmed.ref)||confirmed.snapshot.contentConfirmed!==true||confirmed.snapshot.executionAuthorized!==false||confirmed.snapshot.dispatchPerformed!==false||confirmed.snapshot.definition?.parentAssignmentRef!=null)throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');}
async function verifyHash(snapshot:unknown,reference:PlanRef) {
  const bytes=new TextEncoder().encode(ordered(snapshot));if(bytes.length>2*1024*1024)throw new ApiError('RESPONSE_INVALID');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==reference.contentHash)throw new ApiError('RESPONSIBLE_SESSION_INTEGRITY_FAILED');
}
async function record(value:any,projectId:string) {
  if(!value||value.projectId!==projectId||!ref(value.ref)||!value.snapshot||typeof value.snapshot!=='object')throw new ApiError('RESPONSE_INVALID');
  await verifyHash(value.snapshot,value.ref);
}
export async function readResponsibleSessionState(client:ApiClient,confirmed:ConfirmedAssignmentView):Promise<ResponsibleSessionState> {
  confirmedBinding(confirmed);const pid=confirmed.projectId,a=confirmed.ref,task=confirmed.snapshot.definition.taskRef;
  const v=await client.get<ResponsibleSessionState>('/api/v1/projects/'+pid+'/assignments/'+a.id+'/versions/'+a.version+'/execution-preparation-state');
  if(!exact(v,['projectId','assignmentRef','roles','bindings','preparations','hasMorePreparations','currentness','executionAuthorized','dispatchPerformed'])||v.projectId!==pid||!same(v.assignmentRef,a)||!Array.isArray(v.roles)||v.roles.length>2||!Array.isArray(v.bindings)||v.bindings.length>2||!Array.isArray(v.preparations)||v.preparations.length>20||typeof v.hasMorePreparations!=='boolean'||v.currentness!=='NOT_RECHECKED'||v.executionAuthorized!==false||v.dispatchPerformed!==false)throw new ApiError('RESPONSE_INVALID');
  for(const role of v.roles){await record(role,pid);const s=role.snapshot;
    if(role.ref.version!==1||!exact(s,['kind','stageRef','parentRoleRef','reason','definedBy','definedAt'])||!text(s.reason)||!person(s.definedBy)||!date(s.definedAt)
      ||!(s.kind==='COORDINATOR'?s.stageRef===null&&s.parentRoleRef===null:s.kind==='STAGE_OWNER'&&exact(s.stageRef,['applicationRef','nodeId'])&&same(s.stageRef,{applicationRef:task.applicationRef,nodeId:task.nodeId})&&ref(s.parentRoleRef)))throw new ApiError('RESPONSE_INVALID');
  }
  if(new Set(v.roles.map(r=>r.snapshot.kind)).size!==v.roles.length)throw new ApiError('RESPONSE_INVALID');
  for(const r of v.roles)if(r.snapshot.kind==='STAGE_OWNER'&&!v.roles.some(p=>p.snapshot.kind==='COORDINATOR'&&same(p.ref,r.snapshot.parentRoleRef)))throw new ApiError('RESPONSE_INVALID');
  for(const binding of v.bindings){await record(binding,pid);const s=binding.snapshot;
    if(!exact(s,['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason','sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt'])
      ||![s.assignmentRef,s.roleRef,s.connectionRef,s.sessionRef].every(ref)||s.existingSessionBindingRef!==null&&!ref(s.existingSessionBindingRef)||s.generation!==binding.ref.version
      ||!v.roles.some(r=>same(r.ref,s.roleRef))||!text(s.reason)||!person(s.boundBy)||!date(s.boundAt)||s.state!=='RESERVED'||s.externalSessionHandleRef!==null||s.connectionReadiness!=='CANDIDATE_ONLY'||s.executionAuthorized!==false||s.dispatchPerformed!==false)throw new ApiError('RESPONSE_INVALID');
  }
  if(new Set(v.bindings.map(r=>r.snapshot.roleRef.id)).size!==v.bindings.length)throw new ApiError('RESPONSE_INVALID');
  for(const preparation of v.preparations){await record(preparation,pid);const s=preparation.snapshot,i=s.intent;
    if(preparation.ref.version!==1||!exact(s,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed'])
      ||!exact(i,['projectId','assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef','sourceScopes','mode','reason'])||i.projectId!==pid||!same(i.assignmentRef,a)||!['CONTEXT_REVIEW','WORK'].includes(i.mode)||!text(i.reason)||!scopesWithin(i.sourceScopes,confirmed.snapshot.definition.allowedScopes)||!['assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef'].every(k=>ref(i[k]))
      ||!Array.isArray(s.basisRefs)||s.basisRefs.length>200||!s.basisRefs.every(ref)||!Array.isArray(s.latestInstructionRefs)||s.latestInstructionRefs.length>200||s.latestInstructionRefs.some((r:any)=>!exact(r,['kind','id','contentHash'])||r.kind!=='CONVERSATION'||!uuid(r.id)||!/^[a-f0-9]{64}$/.test(r.contentHash))
      ||!Array.isArray(s.missingConditions)||s.missingConditions.length>10||new Set(s.missingConditions).size!==s.missingConditions.length||s.missingConditions.some((c:any)=>!conditionCodes.includes(c))||unresolved.some(code=>!s.missingConditions.includes(code))
      ||!date(s.checkedAt)||!person(s.preparedBy)||s.authorizationState!=='NOT_AUTHORIZED'||s.executionAuthorized!==false||s.dispatchPerformed!==false)throw new ApiError('RESPONSE_INVALID');
  }
  if(new TextEncoder().encode(ordered(v)).length>2*1024*1024)throw new ApiError('RESPONSE_INVALID');
  return v;
}
export function newResponsibleSessionBuffer(confirmed:ConfirmedAssignmentView,session:DocumentSession,generation:number):ResponsibleSessionBuffer {
  confirmedBinding(confirmed);if(!uuid(session.user.id)||!uuid(session.clientId)||!Number.isSafeInteger(generation)||generation<1)throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
  return{bindingId:crypto.randomUUID(),projectId:confirmed.projectId,assignmentRef:structuredClone(confirmed.ref),ownerUserId:session.user.id,ownerClientId:session.clientId,controlGeneration:generation,reason:'',connectionRef:null,pending:null,uncertain:false,dirty:false,failure:null};
}
export function canPrepareResponsibleSessionInput(buffer:ResponsibleSessionBuffer|null,confirmed:ConfirmedAssignmentView,session:DocumentSession) {
  return !buffer||buffer.projectId===confirmed.projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId&&!buffer.pending&&!buffer.uncertain;
}
export function assertResponsibleSessionInputCurrent(current:ResponsibleSessionBuffer|null,original:ResponsibleSessionBuffer) {
  if(!current||!same(current,original))throw new ApiError('RESPONSIBLE_SESSION_INPUT_CHANGED',409);
}
/** 승인 Editor의 각 before-request CAS는 내부 reducer가 소유한다. 바깥 경계는 원명령/주체/입력을 고정한다. */
export function updateResponsibleSessionApprovalBuffer(current:ResponsibleSessionBuffer|null,original:ResponsibleSessionBuffer,change:(b:ResponsibleSessionBuffer)=>ResponsibleSessionBuffer){
  if(!current)return current;
  const core=(b:ResponsibleSessionBuffer)=>{const {responsibleApproval,closedResponsibleApprovals,...rest}=b;return rest;};
  return same(core(current),core(original))?change(current):current;
}
/** dirty 폐기 확인은 호출 화면에서 수행한다. 여기서는 표시만 먼저 숨기며 원 입력/명령은 수정하지 않는다. */
export async function prepareResponsibleSessionInput(client:ApiClient,confirmed:ConfirmedAssignmentView,session:DocumentSession,buffer:ResponsibleSessionBuffer|null,hide:()=>void,active:()=>boolean) {
  if(!canPrepareResponsibleSessionInput(buffer,confirmed,session))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
  const selected=buffer?.reservationKind===undefined?'STAGE_OWNER':buffer.reservationKind;if(!['COORDINATOR','STAGE_OWNER'].includes(selected))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
  hide();
  const generation=await documentControl(client,confirmed.projectId,session);
  if(!active())return null;
  const state=await readResponsibleSessionState(client,confirmed);if(!active())return null;
  const next=newResponsibleSessionBuffer(confirmed,session,generation),role=state.roles.find(r=>r.snapshot.kind===selected),existing=state.bindings.find(r=>same(r.snapshot.roleRef,role?.ref??null));
  if(buffer?.reservationKind!==undefined)next.reservationKind=selected;
  if(existing)next.connectionRef=structuredClone(existing.snapshot.connectionRef);
  return{buffer:next,state};
}
export function prepareResponsibleSessionAction(b:ResponsibleSessionBuffer,s:DocumentSession,confirmed:ConfirmedAssignmentView,state:ResponsibleSessionState,action:ResponsibleSessionAction):DocumentWrite {
  confirmedBinding(confirmed);
  if(b.projectId!==confirmed.projectId||!same(b.assignmentRef,confirmed.ref)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||state.projectId!==b.projectId||!same(state.assignmentRef,b.assignmentRef)||!text(b.reason)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
  const coordinator=state.roles.find(r=>r.snapshot.kind==='COORDINATOR'),stage=state.roles.find(r=>r.snapshot.kind==='STAGE_OWNER');
  const selected=b.reservationKind===undefined?'STAGE_OWNER':b.reservationKind,bindingAction=action==='BIND'||action==='BIND_COORDINATOR',role=action==='BIND_COORDINATOR'?coordinator:stage;
  if(!['COORDINATOR','STAGE_OWNER'].includes(selected)||bindingAction&&selected!==(action==='BIND_COORDINATOR'?'COORDINATOR':'STAGE_OWNER'))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
  if(b.pending){
    responsibleSessionCommand(b,s);
    const p=b.pending;
    if(!exact(p,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
      ||p.schemaVersion!==1||p.projectId!==b.projectId||p.clientId!==s.clientId||p.controlGeneration!==b.controlGeneration||!uuid(p.commandId)||p.approvalRef!==null&&!b.responsibleApproval?.commandHash||p.baselineRefs.length
      ||p.payload.reason!==b.reason)throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
    if(bindingAction){
      const previous=p.payload.existingSessionBindingRef;
      if(previous!==null&&!ref(previous))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
      if(!role||p.operation!=='bindResponsibleSession'||!same(p.payload.roleRef,role.ref)||!same(p.payload.assignmentRef,confirmed.ref)||!same(p.payload.connectionRef,b.connectionRef)
        ||p.targetId!==(previous?.id??null)||p.expectedVersion!==(previous?.version??0))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
    }else if(p.operation!=='defineProjectRole'||p.payload.kind!==action||p.targetId!==null||p.expectedVersion!==0
      ||!same(p.payload.stageRef,action==='COORDINATOR'?null:{applicationRef:confirmed.snapshot.definition.taskRef.applicationRef,nodeId:confirmed.snapshot.definition.taskRef.nodeId})
      ||!same(p.payload.parentRoleRef,action==='COORDINATOR'?null:coordinator?.ref))throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
    return structuredClone(p);
  }
  let payload:Record<string,unknown>,operation:DocumentWrite['operation']='defineProjectRole',targetId:string|null=null,expectedVersion=0;
  if(action==='COORDINATOR')payload={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:b.reason};
  else if(action==='STAGE_OWNER'){
    if(!coordinator)throw new ApiError('ROLE_PARENT_REQUIRED');
    payload={kind:'STAGE_OWNER',stageRef:{applicationRef:confirmed.snapshot.definition.taskRef.applicationRef,nodeId:confirmed.snapshot.definition.taskRef.nodeId},parentRoleRef:coordinator.ref,reason:b.reason};
  }else if(bindingAction){
    if(!role||!ref(b.connectionRef))throw new ApiError('RESPONSIBLE_SESSION_SELECTION_REQUIRED');
    const old=state.bindings.find(v=>same(v.snapshot.roleRef,role.ref));
    if(old&&!same(old.snapshot.connectionRef,b.connectionRef))throw new ApiError('SESSION_REPLACEMENT_REQUIRED',412);
    operation='bindResponsibleSession';targetId=old?.ref.id??null;expectedVersion=old?.ref.version??0;
    payload={assignmentRef:confirmed.ref,roleRef:role.ref,connectionRef:b.connectionRef,existingSessionBindingRef:old?.ref??null,reason:b.reason};
  }else throw new ApiError('RESPONSIBLE_SESSION_INPUT_INVALID');
  return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload:structuredClone(payload)};
}
export async function sendResponsibleSessionAction(client:ApiClient,command:DocumentWrite,session:DocumentSession) {
  const approval=command.approvalRef as any;
  if(!['defineProjectRole','bindResponsibleSession'].includes(command.operation)||command.clientId!==session.clientId||approval!==null&&(!exact(approval,['requestId','decisionId','scopeDigest'])||!uuid(approval.requestId)||!uuid(approval.decisionId)||!/^[a-f0-9]{64}$/.test(approval.scopeDigest))||command.baselineRefs.length)throw new ApiError('RESPONSIBLE_SESSION_BINDING_INVALID');
  const receipt=await postDocumentCommand(client,command,session.csrfToken),data=receipt.data;
  if(!data||!ref(data.ref)||receipt.targetId!==data.ref.id||receipt.version!==data.ref.version||data.status!==(command.operation==='defineProjectRole'?'PROJECT_ROLE_DEFINED':'RESPONSIBLE_SESSION_RESERVED'))throw new ApiError('RESPONSE_INVALID');
  await verifyHash(data.snapshot,data.ref);
  const snapshot=data.snapshot,input=command.operation==='defineProjectRole'?Object.fromEntries(['kind','stageRef','parentRoleRef','reason'].map(k=>[k,snapshot[k]])):Object.fromEntries(['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason'].map(k=>[k,snapshot[k]]));
  if(command.operation==='defineProjectRole'){
    if(data.ref.version!==1||!exact(snapshot,['kind','stageRef','parentRoleRef','reason','definedBy','definedAt'])||!same(snapshot.definedBy,{kind:'HUMAN',userId:session.user.id})||!date(snapshot.definedAt))throw new ApiError('RESPONSE_INVALID');
  }else{
    if(!exact(snapshot,['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason','sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt'])
      ||data.ref.version!==command.expectedVersion+1||command.targetId!==null&&data.ref.id!==command.targetId||!ref(snapshot.sessionRef)||snapshot.sessionRef.version!==1||snapshot.generation!==data.ref.version
      ||!same(snapshot.boundBy,{kind:'HUMAN',userId:session.user.id})||!date(snapshot.boundAt)||snapshot.connectionReadiness!=='CANDIDATE_ONLY')throw new ApiError('RESPONSE_INVALID');
  }
  if(!same(input,command.payload)||command.operation==='bindResponsibleSession'&&(snapshot.state!=='RESERVED'||snapshot.externalSessionHandleRef!==null||snapshot.executionAuthorized!==false||snapshot.dispatchPerformed!==false))throw new ApiError('RESPONSE_INVALID');
  return {ref:data.ref,snapshot:data.snapshot};
}
