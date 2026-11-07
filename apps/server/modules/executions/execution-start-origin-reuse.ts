import {types} from 'node:util';
import type {PoolClient,QueryResult} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentPolicy,matchesOriginReuseObservationContext,projectMember,type ProjectCommand,type ProjectPermissionRule} from '../access/project-command.ts';
import {readOriginReuseApprovalRequest} from '../approvals/approval-input.ts';
import {ProjectApprovals} from '../approvals/project-approvals.ts';
import {ProjectEnvironmentResources,environmentReadPolicy} from '../connections/project-environment-resources.ts';
import {ProjectSourceRoots} from '../connections/project-source-roots.ts';
import {SourceReadRecords} from '../connections/source-read-records.ts';
import {verifyEnvironmentRegistrationEvidence} from '../connections/environment-registration-evidence.ts';
import {ProjectEnvironments} from '../connections/project-environments.ts';
import {ProjectConnectionDefinitions} from '../connections/project-connection-definitions.ts';
import {ProjectRegistrationReads} from '../connections/project-registration-reads.ts';
import {ProjectStageQueue} from '../scheduling/stage-queue.ts';
import {ResponsibleSessions} from '../assignments/responsible-sessions.ts';
import {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import {ProjectAssignmentDrafts} from '../assignments/project-assignment-drafts.ts';
import {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectWorkPlans} from '../traceability/work-plans.ts';
import {ProjectMethodologies} from '../methodologies/project-methodologies.ts';
import {ProjectContexts} from '../context/project-contexts.ts';
import {ProjectContextSources} from '../context/context-sources.ts';
import {ProjectKnowledge} from '../knowledge/knowledge.ts';
import {ProjectConversations} from '../knowledge/conversations.ts';
import {ExecutionStartOriginStore} from './execution-start-origin-store.ts';
import {authorizeRuntimePolicy,ProjectLimitPolicies,type RuntimeAuthorizationInput} from './runtime-policy.ts';
import {compileExecutionPreparationOptions,readExecutionPreparationInput} from './preparation-input.ts';
import {matchesOriginReuseQueueIdentity,type ProjectInitialExecutionQueue} from './execution-commands.ts';
import {copyStartOrigin,originActor,originHash,originSame} from './execution-start-origin-input.ts';
import {arrayV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';

const authenticate=AccessRepository.prototype.authenticated;
const readOrigin=ExecutionStartOriginStore.prototype.read;
const readStageRequest=ProjectStageQueue.prototype.readRequest;
const resolveLimit=ProjectLimitPolicies.prototype.resolveCurrent;
const readLimitApproval=ProjectApprovals.prototype.readLimitPolicyConsumption;
const isRealResponsibleSession=ResponsibleSessions.isRealInstance;
const readBinding=ResponsibleSessions.prototype.readBinding;
const readAssignment=ProjectAssignmentConfirmations.prototype.read;
const readAssignmentDraft=ProjectAssignmentDrafts.prototype.read;
const currentAssignmentDraft=ProjectAssignmentDrafts.prototype.current;
const isProtectedPlanReader=ProjectDocuments.isProtectedPlanReader;
const protectedCurrentReader=ProjectWorkPlans.protectedCurrentReader;
const readApplication=ProjectMethodologies.prototype.readApplication;
const readContext=ProjectContexts.prototype.read;
const resolveContextSources=ProjectContextSources.prototype.resolve;
const readContextApproval=ProjectApprovals.prototype.readContextConsumption;
const readKnowledge=ProjectKnowledge.prototype.read;
const readConversation=ProjectConversations.prototype.readMessage;
const readResponsibleSessionConsumption=ProjectApprovals.prototype.readResponsibleSessionConsumption;
const requestApproval=ProjectApprovals.prototype.request,readApproval=ProjectApprovals.prototype.read;
const readEnvironment=ProjectEnvironments.prototype.history;
const readDefinition=ProjectConnectionDefinitions.prototype.read;
const readReferences=ProjectEnvironments.prototype.readOriginReuseReferences;
const observe=ProjectRegistrationReads.prototype.observeStartOriginRegistration;
const readMetadata=ProjectEnvironmentResources.prototype.readOriginReuseMetadata;
const readRoot=ProjectSourceRoots.prototype.read;
const readSnapshot=SourceReadRecords.prototype.readSnapshot;
const loadSnapshotGrant=SourceReadRecords.prototype.load;
const referenceReaders=Object.freeze({readMetadata,readRoot,readSnapshot,loadSnapshotGrant});
const reject=():never=>{throw new AuthFailure('ORIGIN_REUSE_REGISTRATION_UNAVAILABLE',412);};
type ObservedDependency=Awaited<ReturnType<typeof readReferences>>['dependencies'][number]
 |{kind:'CONNECTOR_REGISTRATION'|'CONNECTOR_STATUS';ref:RuntimeRefV1};

function assertObservedDependencies(environment:Awaited<ReturnType<typeof readEnvironment>>['snapshot'],observed:ObservedDependency[]){
 const entries=new Map<string,ObservedDependency>();
 for(const entry of observed){
  if(!refV1(entry.ref)||!['ENVIRONMENT_HOST_DECLARATION','COMMAND_PROFILE_METADATA','SECRET_REFERENCE_METADATA','SOURCE_ROOT_DECLARATION','CONNECTOR_REGISTRATION','CONNECTOR_STATUS'].includes(entry.kind))return reject();
  const key=entry.kind+':'+entry.ref.id,previous=entries.get(key);
  if(previous&&!originSame(previous.ref,entry.ref))return reject();
  if(!previous)entries.set(key,entry);
 }
 // 종류·ID가 같으면 버전/hash의 동일성까지 대조했으므로 이 정렬이 전체 참조의 정규 순서다.
 const dependencies=[...entries.keys()].sort().map(key=>entries.get(key)!);
 const seen=(kind:ObservedDependency['kind'],ref:RuntimeRefV1)=>dependencies.some(entry=>entry.kind===kind&&originSame(entry.ref,ref));
 for(const host of [environment.executionHostRef,...environment.targetHostRefs,...environment.sourceRoots.map(root=>root.registeredPathRef.hostRef)]){
  if(host.kind==='CONNECTOR_STATUS'){
   if(!seen('CONNECTOR_REGISTRATION',host.registrationRef)||!seen('CONNECTOR_STATUS',host.connectorRef))return reject();
  }else if(!seen('ENVIRONMENT_HOST_DECLARATION',host.ref))return reject();
 }
 if(!environment.commandProfileRefs.every(profile=>seen('COMMAND_PROFILE_METADATA',profile.ref))
  ||!environment.secretRefs.every(secret=>seen('SECRET_REFERENCE_METADATA',secret.ref))
  ||!environment.sourceRoots.every(root=>root.registeredPathRef.kind==='SOURCE_ROOT_DECLARATION'
   ?seen('SOURCE_ROOT_DECLARATION',root.registeredPathRef.sourceRootRef)
   :dependencies.some(entry=>entry.kind==='SOURCE_ROOT_DECLARATION'&&entry.ref.id===root.sourceRootId)))return reject();
}

function reusePurposeDeadline(rules:readonly ProjectPermissionRule[],actorId:string,projectId:string,input:RuntimeAuthorizationInput,at:number){
 const allowed:{scopes:SourceScopeV1[];deadline:number}[]=[];
 const matches=(grant:SourceScopeV1,asked:SourceScopeV1,target:SourceScopeV1['targets'][number],restrictive:boolean)=>{
  if(restrictive?grant.sourceRootRef.id!==asked.sourceRootRef.id
   :!originSame([grant.sourceRootRef,grant.mappingRef,grant.observationRef,grant.baselineRef],[asked.sourceRootRef,asked.mappingRef,asked.observationRef,asked.baselineRef]))return false;
  return grant.targets.some(t=>(restrictive?t.relativePath.toUpperCase()===target.relativePath.toUpperCase():t.relativePath===target.relativePath)
   &&t.kind===target.kind&&t.access===target.access&&t.recursive===target.recursive);
 };
 for(const rule of rules){
  if(!rule.operations.includes('reuseExecutionStartOrigin')||rule.subjectRef.kind!=='HUMAN'||rule.subjectRef.userId!==actorId)continue;
  const [target]=rule.targetScopes,deadline=Date.parse(rule.expiresAt);
  if(rule.targetScopes.length!==1||!target||!recordV1(target,['kind','projectId','executionId','executionGeneration','sourceScopes'])
   ||target.kind!=='EXECUTION'||!refV1(rule.limitPolicyRef)||!Number.isFinite(deadline))return reject();
  if(target.projectId!==projectId||target.executionId!==input.executionId||target.executionGeneration!==input.executionGeneration||deadline<=at)continue;
  let scopes:SourceScopeV1[];
  try{scopes=readSourceScopesV1(target.sourceScopes);}catch{return reject();}
  const overlaps=input.sourceScopes.some(asked=>asked.targets.some(t=>scopes.some(grant=>matches(grant,asked,t,true))));
  if(rule.disposition==='DENY'&&overlaps)return reject();
  if(!originSame(rule.limitPolicyRef,input.budgetPolicyRef))continue;
  if(rule.disposition==='REQUIRE_APPROVAL'&&overlaps)return reject();
  if(rule.disposition==='AUTO')allowed.push({scopes,deadline});
 }
 if(!input.sourceScopes.length||!allowed.length||!input.sourceScopes.every(asked=>asked.targets.every(t=>allowed.some(
  rule=>rule.scopes.some(grant=>matches(grant,asked,t,false))))))return reject();
 return Math.min(...allowed.map(rule=>rule.deadline));
}

declare const originReuseApprovalBrand:unique symbol;
export type OriginReuseApprovalCapability={readonly [originReuseApprovalBrand]:true};
type OriginReuseAssignmentReaders={drafts:ProjectAssignmentDrafts;confirmations:ProjectAssignmentConfirmations;protectedDrafts?:ProjectAssignmentDrafts;protectedContexts?:ProjectContexts};
const approvalComposers=new WeakMap<object,{access:AccessRepository;queue:ProjectInitialExecutionQueue;sessions?:ResponsibleSessions;assignments?:OriginReuseAssignmentReaders;protectedPlanDocuments?:ProjectDocuments}>();
export interface OriginReuseRequestSource {readonly evidence:Readonly<Record<string,any>>;readonly until:number;readonly transactionId:string}
const requestSources=new WeakMap<object,{access:AccessRepository;db:PoolClient;query:PoolClient['query'];actor:AuthenticatedIdentity;identity:string;requestHash:string}>();
/** 원 보호관측이 같은 인증 콜백에서 만든 출처만 인정한다. 구조적 데이터는 권위가 아니다. */
export function matchesOriginReuseRequestSource(value:unknown,db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):value is OriginReuseRequestSource {
 if(!value||typeof value!=='object')return false;
 const source=requestSources.get(value);
 return !!source&&source.db===db&&source.query===db.query&&source.actor===actor&&source.identity===originActor(actor)
  &&source.requestHash===originHash(request)&&matchesOriginReuseObservationContext(source.access,db,actor,request,(value as OriginReuseRequestSource).transactionId);
}

function originalAssignmentDrafts(sessions:ResponsibleSessions):ProjectAssignmentDrafts|undefined{
 const port=Object.getOwnPropertyDescriptor(sessions,'drafts');
 const drafts:unknown=port&&'value'in port?port.value:undefined;
 if(typeof drafts!=='object'||drafts===null||types.isProxy(drafts)||Object.getPrototypeOf(drafts)!==ProjectAssignmentDrafts.prototype
  ||Object.hasOwn(drafts,'read')||Object.hasOwn(drafts,'current')
  ||!unchangedMethod(ProjectAssignmentDrafts.prototype,'read',readAssignmentDraft)
  ||!unchangedMethod(ProjectAssignmentDrafts.prototype,'current',currentAssignmentDraft)
  ||!unchangedMethod(ProjectAssignmentConfirmations.prototype,'read',readAssignment))return undefined;
 return drafts as ProjectAssignmentDrafts;
}

function bindAssignmentReaders(sessions:ResponsibleSessions,documents?:ProjectDocuments):OriginReuseAssignmentReaders{
 const drafts=originalAssignmentDrafts(sessions);
 if(!drafts)return reject();
 // 확정 reader 내부의 this.drafts.read도 원 클래스 메서드와 같은 인스턴스로 고정한다.
 const confirmations=new ProjectAssignmentConfirmations(Object.freeze({read:readAssignmentDraft.bind(drafts),current:currentAssignmentDraft.bind(drafts)}));
 Object.freeze(confirmations);
 if(documents===undefined)return {drafts,confirmations};
 if(!matchesProtectedPlanDocuments(documents)||!unchangedMethod(ProjectWorkPlans,'protectedCurrentReader',protectedCurrentReader))return reject();
 const methods=Object.freeze({readApplication:readApplication.bind(new ProjectMethodologies())});
 const protectedDrafts=new ProjectAssignmentDrafts(protectedCurrentReader(documents),methods);
 // current 내부의 this.read만 새 전용 인스턴스의 원 메서드에 고정한다.
 Object.defineProperty(protectedDrafts,'read',{value:readAssignmentDraft.bind(protectedDrafts)});
 Object.freeze(protectedDrafts);
 const assignmentPort=Object.freeze({read:readAssignment.bind(confirmations)});
 const sources=Object.freeze(new ProjectContextSources(Object.freeze({
  confirmations:assignmentPort,drafts:Object.freeze({current:currentAssignmentDraft.bind(protectedDrafts)}),
  documents:Object.freeze({version:documents.version,originalText:documents.originalText}),
  knowledge:Object.freeze({read:readKnowledge.bind(new ProjectKnowledge(documents))}),
  conversations:Object.freeze({readMessage:readConversation.bind(new ProjectConversations(documents))}),
 })));
 const protectedContexts=new ProjectContexts(Object.freeze({resolve:resolveContextSources.bind(sources)}),assignmentPort);
 Object.freeze(protectedContexts);
 return {drafts,confirmations,protectedDrafts,protectedContexts};
}

function matchesResponsibleSessionReader(sessions:unknown):sessions is ResponsibleSessions{
 return unchangedMethod(ResponsibleSessions,'isRealInstance',isRealResponsibleSession)&&isRealResponsibleSession(sessions,readResponsibleSessionConsumption)
  &&Object.getPrototypeOf(sessions)===ResponsibleSessions.prototype&&!Object.hasOwn(sessions,'readBinding')
  &&unchangedMethod(ResponsibleSessions.prototype,'readBinding',readBinding)
  &&unchangedMethod(ProjectApprovals.prototype,'readResponsibleSessionConsumption',readResponsibleSessionConsumption);
}

function matchesProtectedPlanDocuments(documents:unknown):documents is ProjectDocuments{
 return unchangedMethod(ProjectDocuments,'isProtectedPlanReader',isProtectedPlanReader)&&isProtectedPlanReader(documents)
  &&unchangedMethod(ProjectMethodologies.prototype,'readApplication',readApplication)
  &&unchangedMethod(ProjectContexts.prototype,'read',readContext)
  &&unchangedMethod(ProjectContextSources.prototype,'resolve',resolveContextSources)
  &&unchangedMethod(ProjectApprovals.prototype,'readContextConsumption',readContextApproval)
  &&unchangedMethod(ProjectKnowledge.prototype,'read',readKnowledge)
  &&unchangedMethod(ProjectConversations.prototype,'readMessage',readConversation);
}

export function createOriginReuseApprovalCapability(access:AccessRepository,queue:ProjectInitialExecutionQueue,sessions?:ResponsibleSessions,protectedPlanDocuments?:ProjectDocuments):OriginReuseApprovalCapability{
 assertObservationAccess(access);
 if(!matchesOriginReuseQueueIdentity(queue,access)||sessions!==undefined&&!matchesResponsibleSessionReader(sessions)
  ||protectedPlanDocuments!==undefined&&sessions===undefined)return reject();
 const capability=Object.freeze(Object.create(null)) as OriginReuseApprovalCapability;
 const assignments=sessions===undefined?undefined:bindAssignmentReaders(sessions,protectedPlanDocuments);
 approvalComposers.set(capability,{access,queue,sessions,assignments,protectedPlanDocuments});
 return capability;
}

export function matchesOriginReuseApprovalCapability(capability:unknown,access:AccessRepository,queue:unknown):capability is OriginReuseApprovalCapability{
 if(!capability||typeof capability!=='object')return false;
 const composer=approvalComposers.get(capability);
 return composer!==undefined&&composer.access===access&&composer.queue===queue&&observationAccessMatches(access)&&matchesOriginReuseQueueIdentity(queue,access)
  &&(composer.sessions===undefined||matchesResponsibleSessionReader(composer.sessions)
   &&composer.assignments!==undefined&&originalAssignmentDrafts(composer.sessions)===composer.assignments.drafts)
  &&(composer.protectedPlanDocuments===undefined||matchesProtectedPlanDocuments(composer.protectedPlanDocuments));
}

function unchangedMethod(prototype:object,key:string,original:unknown){
 const descriptor=Object.getOwnPropertyDescriptor(prototype,key);
 return descriptor!==undefined&&'value'in descriptor&&descriptor.value===original;
}

function assertProtectedReaders(){
 if(!unchangedMethod(ExecutionStartOriginStore.prototype,'read',readOrigin)
  ||!unchangedMethod(ProjectEnvironments.prototype,'history',readEnvironment)
  ||!unchangedMethod(ProjectEnvironments.prototype,'readOriginReuseReferences',readReferences)
  ||!unchangedMethod(ProjectEnvironmentResources.prototype,'readOriginReuseMetadata',readMetadata)
  ||!unchangedMethod(ProjectSourceRoots.prototype,'read',readRoot)
  ||!unchangedMethod(SourceReadRecords.prototype,'readSnapshot',readSnapshot)
  ||!unchangedMethod(SourceReadRecords.prototype,'load',loadSnapshotGrant)
  ||!unchangedMethod(ProjectRegistrationReads.prototype,'observeStartOriginRegistration',observe))return reject();
}

async function observationTransaction(db:PoolClient,actor:AuthenticatedIdentity,assertBinding?:(transactionId?:string)=>void){
 const query=db.query,identity=originActor(actor),reauth=actor.reauthUntil?.getTime();
 const unchanged=()=>{
  assertBinding?.();
  if(assertBinding&&(!unchangedMethod(ProjectStageQueue.prototype,'readRequest',readStageRequest)
   ||!unchangedMethod(ProjectConnectionDefinitions.prototype,'read',readDefinition)
   ||!unchangedMethod(ProjectLimitPolicies.prototype,'resolveCurrent',resolveLimit)
   ||!unchangedMethod(ProjectApprovals.prototype,'readLimitPolicyConsumption',readLimitApproval)))return reject();
  assertProtectedReaders();
  if(db.query!==query||originActor(actor)!==identity||actor.reauthUntil?.getTime()!==reauth)return reject();
 };
 const send=async(text:string,values:unknown[]=[]):Promise<QueryResult>=>{
  unchanged();
  const result=await Reflect.apply(query,db,[text,values]);
  unchanged();
  return result;
 };
 let last=-Infinity,transactionId:string|undefined;
 const clock=async()=>{
  const rows=(await send('SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS at')).rows;
  unchanged();
  const row=rows[0],at=row?.at instanceof Date?row.at.getTime():NaN;
  if(rows.length!==1||typeof row.transaction_id!=='string'||!/^[1-9][0-9]*$/.test(row.transaction_id)
   ||transactionId!==undefined&&row.transaction_id!==transactionId||!Number.isFinite(at)||at<last)return reject();
  assertBinding?.(row.transaction_id);
  transactionId=row.transaction_id;last=at;
  return at;
 };
 await clock();
 // 하위 reader에 원 query를 다시 읽는 통로를 넘기지 않는다. 실제 호출의 this는 원 PoolClient다.
 const guarded=Object.freeze({query:async(text:string,values?:unknown[])=>{
  const before=await clock();
  const result=await send(text,values);
  const after=await clock();
  unchanged();
  if(assertBinding&&text==='SELECT clock_timestamp() AS at'){
   const sample=result.rows[0]?.at;
   if(result.rows.length!==1||!(sample instanceof Date)||!Number.isFinite(sample.getTime())||sample.getTime()<before||sample.getTime()>after)return reject();
  }
  return result;
 }}) as unknown as PoolClient;
 const step=async<T>(work:()=>Promise<T>)=>{
  await clock();
  unchanged();
  const result=await work();
  await clock();
  unchanged();
  return result;
 };
 return {guarded,clock,step,transactionId:()=>transactionId!};
}

/** 실제 인증 콜백과 저장 S/Q가 선택한 환경의 증거만 소비하는 내부 관측이다. */
export async function observeOriginReuseRegistration(access:AccessRepository,token:string,csrf:string,raw:unknown){
 if(typeof csrf!=='string'||csrf.length!==43||!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new AuthFailure('CSRF_INVALID',403);
 const input=copyStartOrigin(raw);
 if(!recordV1(input,['projectId','originRef','reservationRef','permissionPolicyRef'])
  ||!uuidV1(input.projectId)||!refV1(input.originRef)||input.originRef.version!==1||!refV1(input.reservationRef)||!refV1(input.permissionPolicyRef))return reject();
 assertObservationAccess(access);
 const {projectId,originRef,reservationRef,permissionPolicyRef}=input;
 return authenticate.call(access,token,csrf,(db:PoolClient,actor:AuthenticatedIdentity)=>
  observeOriginReuseInTransaction(access,db,actor,{projectId,originRef,reservationRef,permissionPolicyRef}));
}

/** 기존 승인 명령의 인증 콜백 안에서만 관측한다. 관측의 결과는 외부로 반환하지 않는다. */
export async function observeOriginReuseApprovalRequest(capability:OriginReuseApprovalCapability|undefined,access:AccessRepository,db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:RuntimeRefV1,previous?:unknown):Promise<unknown>{
 const closed=()=>new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
 const assertContext=(transactionId?:string)=>{if(!matchesOriginReuseObservationContext(access,db,actor,request,transactionId))throw closed();};
 assertContext();
 if(request.targetId!==null||request.expectedVersion!==0||request.approvalRef!==null||request.baselineRefs.length)throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
 const now=(await db.query('SELECT clock_timestamp() at')).rows[0]?.at;
 assertContext();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw closed();
 const {details,candidatePayload:candidate}=readOriginReuseApprovalRequest(request.payload,{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:request.controlGeneration,now},request.commandId);
 const composer=capability===undefined?undefined:approvalComposers.get(capability);
 const assertBinding=(transactionId?:string)=>{
  assertContext(transactionId);
  if(!composer||!matchesOriginReuseApprovalCapability(capability,access,composer.queue))throw closed();
 };
 assertBinding();
 const sessions=composer?.sessions,assignments=composer?.assignments;
 if(!sessions||!assignments||!originSame(policyRef,candidate.permissionPolicyRef))throw closed();
 if(previous!==undefined){
  const result=copyStartOrigin(previous) as any,ref=result?.data?.ref;
  if(!refV1(ref)||result.commandId!==request.commandId||result.projectId!==request.projectId||result.status!=='APPLIED')throw closed();
  const view=await readApproval.call(new ProjectApprovals(),db,actor,request.projectId,ref.id);
  assertBinding();
  if(!originSame(view.requestRef,ref)||view.storedStatus!=='PENDING'||view.decision!==null||view.consumption!==null
   ||!originSame(view.request,result.data.request)||!originSame(view.request.details,details)
   ||!originSame((view.request as any).originReuseEvidence?.candidatePayload,candidate))throw closed();
  return result;
 }
 const {originRef,reservationRef}=candidate.originReuse;
 let storing=false;
 try{
  const observed=await observeOriginReuseInTransaction(access,db,actor,{projectId:request.projectId,originRef,reservationRef,permissionPolicyRef:policyRef},{assertBinding,sessions,assignments,candidate,candidateCommandId:details.candidateCommandId,request,expiresAt:Date.parse(details.expiresAt)});
  const source=observed.requestSource;
  if(!source||!matchesOriginReuseRequestSource(source,db,actor,request))throw closed();
  storing=true;
  try{return await requestApproval.call(new ProjectApprovals(undefined,access),db,actor,request,policyRef,source);}
  finally{requestSources.delete(source);}
 }catch(error){if(storing||!(error instanceof AuthFailure))throw error;}
 throw closed();
}

function observationAccessMatches(access:AccessRepository){
 return Object.getPrototypeOf(access)===AccessRepository.prototype&&!Object.hasOwn(access,'authenticated')
  &&unchangedMethod(AccessRepository.prototype,'authenticated',authenticate);
}

function assertObservationAccess(access:AccessRepository){
 if(!observationAccessMatches(access))return reject();
}

type OriginReuseSelection={projectId:string;originRef:RuntimeRefV1;reservationRef:RuntimeRefV1;permissionPolicyRef:RuntimeRefV1};
type OriginReuseApprovalObservation={assertBinding:(transactionId?:string)=>void;sessions:ResponsibleSessions;assignments:OriginReuseAssignmentReaders;
 candidate:ReturnType<typeof readOriginReuseApprovalRequest>['candidatePayload'];candidateCommandId:string;request:ProjectCommand;expiresAt:number};

async function observeOriginReuseInTransaction(access:AccessRepository,db:PoolClient,actor:AuthenticatedIdentity,
 {projectId,originRef,reservationRef,permissionPolicyRef}:OriginReuseSelection,approval?:OriginReuseApprovalObservation){
 assertObservationAccess(access);
 const tx=await observationTransaction(db,actor,approval?.assertBinding),locked=tx.guarded;
 const member=await tx.step(()=>projectMember(locked,actor,projectId,true));
 if(member.participation!=='OWNER'||member.archived_at)return reject();
 const controls=(await tx.step(()=>locked.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[projectId]))).rows;
 const control=controls[0],generation=Number(control?.generation);
 if(controls.length!==1||control.revoked_at!==null||control.actor_id!==actor.actorId||control.client_id!==actor.clientId
  ||!Number.isSafeInteger(generation)||generation<1)return reject();
 const checkRequestDeadline=(at:number,until:number)=>{
  if(approval&&(!Number.isFinite(until)||!Number.isFinite(approval.expiresAt)||at>=approval.expiresAt||approval.expiresAt>until))return reject();
 };
 let approvalUntil=Infinity;
 if(approval){
  const session=actor.authSession;
  if(!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))return reject();
  const sessionUntil=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt),actor.reauthUntil?.getTime()??NaN);
  checkRequestDeadline(await tx.clock(),sessionUntil);
  const policy=await tx.step(()=>authorizeMaterial(locked,actor,approval.request,true));
  if(policy.approvalRequired||!originSame(policy.ref,permissionPolicyRef))return reject();
  const policyAt=await tx.clock();
  const rules=policy.rules.filter(rule=>rule.subjectRef.kind==='HUMAN'&&rule.subjectRef.userId===actor.actorId
   &&rule.operations.includes('requestApproval')&&rule.targetScopes.some(scope=>scope.kind==='PROJECT'&&scope.projectId===projectId)
   &&Date.parse(rule.expiresAt)>policyAt);
  if(!rules.length||rules.some(rule=>rule.disposition!=='AUTO'))return reject();
  approvalUntil=Math.min(sessionUntil,policy.validUntil,...rules.map(rule=>Date.parse(rule.expiresAt)));
  checkRequestDeadline(policyAt,approvalUntil);
 }
 const originPolicy=await tx.step(()=>authorizeMaterial(locked,actor,{schemaVersion:1,projectId,commandId:originRef.id,
  clientId:actor.clientId,controlGeneration:generation,operation:'readExecutionStartOrigins',targetId:null,expectedVersion:0,
  baselineRefs:[],approvalRef:null,payload:{}},true));
 if(originPolicy.approvalRequired||!originSame(originPolicy.ref,permissionPolicyRef))return reject();
 const stored=await tx.step(()=>readOrigin.call(new ExecutionStartOriginStore(),locked,projectId,originRef.id,originRef.version));
 const s=stored.value.snapshot,q=stored.value.reservation;
 if(!originSame(stored.value.ref,originRef)||!originSame(q.ref,reservationRef)
  ||s.subject.userId!==actor.actorId||s.subject.clientId!==actor.clientId||s.subject.humanSessionId!==actor.authSession?.id
  ||s.subject.credentialGeneration!==actor.credentialGeneration||s.subject.controlGeneration!==generation||s.observedPolicyRef.id!==permissionPolicyRef.id
  ||s.observedPolicyRef.version>=permissionPolicyRef.version)return reject();
 if(approval){
  approvalUntil=Math.min(approvalUntil,Date.parse(s.expiresAt),Date.parse(q.snapshot.expiresAt),originPolicy.validUntil);
  checkRequestDeadline(await tx.clock(),approvalUntil);
 }
 // 승인 요청의 현재성 검사다. 독립적인 역사 등록 관측 경로에는 적용하지 않는다.
 let definitionUntil=Infinity,limitUntil=Infinity,runtimeUntil=Infinity,contextMatched=false;
 if(approval){
  const {candidate}=approval;
  // Options 원문을 읽었다는 뜻이 아니다. 기존 START의 준비 전체 참조 투영만 대조한다.
  if(candidate.executionId!==s.execution.executionId||candidate.executionGeneration!==s.execution.executionGeneration
   ||!originSame(candidate.preparationRef,s.preparationRef)||!originSame(candidate.payload.contextBundleRef,s.contextBundleRef)
   ||!originSame(candidate.payload.optionsRef,s.preparationRef)||!originSame(candidate.budgetPolicyRef,s.budgetPolicyRef))return reject();
  const stage=await tx.step(()=>readStageRequest.call(new ProjectStageQueue(),locked,actor,projectId,s.stageRequestRef));
  if(stage.snapshot.state!=='WAITING'||stage.currentState!=='WAITING'
   ||!originSame(stage.ref,s.stageRequestRef)||!originSame(stage.currentRef,s.stageRequestRef)
   ||!originSame(stage.snapshot.input.budgetRef,s.budgetPolicyRef))return reject();
  const binding=await tx.step(()=>readBinding.call(approval.sessions,locked,actor,projectId,s.roleBindingRef.id,s.roleBindingRef.version));
  const reserved=binding.snapshot;
  if(!originSame(binding.ref,s.roleBindingRef)||!originSame(reserved.assignmentRef,s.assignmentRef)
   ||!originSame(reserved.connectionRef,s.connectionRef)||!originSame(reserved.sessionRef,s.sessionBindingRef)
   ||reserved.connectionKind!=='REGISTERED_DEFINITION'||reserved.state!=='RESERVED'||reserved.externalSessionHandleRef!==null)return reject();
  const heads=(await tx.step(()=>locked.query('SELECT binding_id,version,content_hash FROM anvil.role_bindings WHERE project_id=$1 AND role_id=$2 ORDER BY version DESC LIMIT 1',[projectId,reserved.roleRef.id]))).rows;
  const head=heads[0];
  if(heads.length!==1||!originSame(s.roleBindingRef,{id:head.binding_id,version:Number(head.version),contentHash:head.content_hash}))return reject();

  const assignment=await tx.step(()=>readAssignment.call(approval.assignments.confirmations,locked,actor,projectId,s.assignmentRef.id,s.assignmentRef.version));
  const {draftRef,definition,contentConfirmed}=assignment.snapshot;
  if(!originSame(assignment.ref,s.assignmentRef)||!originSame(assignment.ref,reserved.assignmentRef)||contentConfirmed!==true
   ||!refV1(draftRef)||draftRef.id!==s.assignmentRef.id||draftRef.version!==s.assignmentRef.version
   ||!originSame(definition.taskRef,s.taskRef))return reject();
  const draftHeads=(await tx.step(()=>locked.query('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE',[projectId,draftRef.id]))).rows;
  if(draftHeads.length!==1||Number(draftHeads[0]?.head_version)!==draftRef.version)return reject();
  const {protectedDrafts}=approval.assignments;
  if(protectedDrafts){
   const current=await tx.step(()=>currentAssignmentDraft.call(protectedDrafts,locked,actor,projectId,draftRef));
   if(!originSame(current.ref,draftRef)||!originSame(current.snapshot.definition,definition))return reject();
  }

  const scope={kind:'PROJECT' as const,projectId};
  const limit=await tx.step(()=>resolveLimit.call(new ProjectLimitPolicies(),locked,actor,projectId,s.budgetPolicyRef,scope));
  if(limit.projectId!==projectId||!originSame(limit.ref,s.budgetPolicyRef)||!originSame(limit.snapshot.scope,scope))return reject();
  limitUntil=Date.parse(limit.snapshot.expiresAt);
  if(!Number.isFinite(limitUntil))return reject();
  checkRequestDeadline(await tx.clock(),Math.min(approvalUntil,limitUntil));

  const runtimeInput=copyStartOrigin<RuntimeAuthorizationInput>({executionId:s.execution.executionId,executionGeneration:s.execution.executionGeneration,
   permissionPolicyRef,budgetPolicyRef:s.budgetPolicyRef,sourceScopes:s.sourceScopes});
  for(const operation of ['authorizeExecution','queueExecutionCommand']){
   const projection:ProjectCommand=Object.freeze({schemaVersion:1,projectId,commandId:approval.candidateCommandId,clientId:actor.clientId,
    controlGeneration:generation,operation,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:candidate});
   const runtime=await tx.step(()=>authorizeRuntimePolicy(locked,actor,projection,runtimeInput,
    Object.freeze({resolveCurrent:resolveLimit.bind(new ProjectLimitPolicies())})));
   if(!originSame(runtime.policyRef,permissionPolicyRef)||!originSame(runtime.budgetPolicyRef,s.budgetPolicyRef)||!Number.isFinite(runtime.validUntil))return reject();
   runtimeUntil=Math.min(runtimeUntil,runtime.validUntil);
  }
  const reusePolicy=await tx.step(()=>currentPolicy(locked,projectId));
  if(!reusePolicy||!originSame(reusePolicy.ref,permissionPolicyRef))return reject();
  const reuseAt=await tx.clock();
  runtimeUntil=Math.min(runtimeUntil,reusePurposeDeadline(reusePolicy.rules,actor.actorId,projectId,runtimeInput,reuseAt));

  const definitionPolicy=await tx.step(()=>authorizeMaterial(locked,actor,{schemaVersion:1,projectId,commandId:originRef.id,
   clientId:actor.clientId,controlGeneration:generation,operation:'readConnectionDefinition',targetId:null,expectedVersion:0,
   baselineRefs:[],approvalRef:null,payload:{}},true));
  if(definitionPolicy.approvalRequired||!originSame(definitionPolicy.ref,permissionPolicyRef))return reject();
  checkRequestDeadline(await tx.clock(),Math.min(approvalUntil,limitUntil,runtimeUntil,definitionPolicy.validUntil));
  const connection=await tx.step(()=>readDefinition.call(new ProjectConnectionDefinitions(access),locked,actor,projectId,s.connectionRef.id,s.connectionRef.version));
  if(connection.projectId!==projectId||!originSame(connection.ref,s.connectionRef)||!originSame(connection.definition.environmentRef,s.environmentRef)
   ||connection.currentStatus.headVersion!==s.connectionRef.version||!connection.currentStatus.configurationCurrent)return reject();
  const preparations=(await tx.step(()=>locked.query(
   'SELECT p.*,c.result_ref,c.operation,c.state,c.actor_id command_actor,c.client_id command_client FROM anvil.execution_preparations p JOIN anvil.commands c ON c.project_id=p.project_id AND c.id=p.command_id WHERE p.project_id=$1 AND p.id=$2 AND p.version=$3',
   [projectId,s.preparationRef.id,s.preparationRef.version]))).rows;
  const prepared=preparations[0];
  if(preparations.length!==1||prepared.project_id!==projectId||prepared.id!==s.preparationRef.id||Number(prepared.version)!==s.preparationRef.version
   ||prepared.content_hash!==s.preparationRef.contentHash||!uuidV1(prepared.created_by)||!uuidV1(prepared.client_id)
   ||prepared.command_actor!==prepared.created_by||prepared.command_client!==prepared.client_id
   ||prepared.operation!=='prepareExecution'||prepared.state!=='APPLIED')return reject();
  const snapshot=copyStartOrigin(prepared.snapshot_json),result=prepared.result_ref;
  if(!recordV1(snapshot,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed','options'])
   ||!isoV1(snapshot.checkedAt)||snapshot.authorizationState!=='NOT_AUTHORIZED'||snapshot.executionAuthorized!==false||snapshot.dispatchPerformed!==false
   ||!originSame(snapshot.preparedBy,{kind:'HUMAN',userId:prepared.created_by})||originHash(snapshot)!==s.preparationRef.contentHash
   ||result?.status!=='APPLIED'||result.projectId!==projectId||result.targetId!==s.preparationRef.id||result.version!==s.preparationRef.version
   ||result.data?.status!=='EXECUTION_PREPARED'||!originSame(result.data.ref,s.preparationRef)||!originSame(result.data.snapshot,snapshot)
   ||!originSame(snapshot.basisRefs,s.basisRefs)||!originSame(snapshot.latestInstructionRefs,s.latestInstructionRefs)
   ||!arrayV1(snapshot.missingConditions,200)||new Set(snapshot.missingConditions).size!==snapshot.missingConditions.length
   ||!originSame([...new Set(['ACTUAL_RUNTIME_NOT_OBSERVED','SDK_SESSION_NOT_CLAIMED','EXECUTION_CREDENTIAL_NOT_ISSUED',...snapshot.missingConditions])],s.unresolvedChecks))return reject();
  const intent=readExecutionPreparationInput(snapshot.intent);
  if(!('connectionKind'in intent)||intent.projectId!==projectId||!originSame(intent.assignmentRef,s.assignmentRef)
   ||!originSame(intent.roleBindingRef,s.roleBindingRef)||!originSame(intent.connectionRef,s.connectionRef)
   ||!originSame(intent.environmentRef,s.environmentRef)||!originSame(intent.contextBundleRef,s.contextBundleRef)
   ||!originSame(intent.budgetPolicyRef,s.budgetPolicyRef)||!originSame(intent.sourceScopes,s.sourceScopes))return reject();
  const options=compileExecutionPreparationOptions(connection.definition);
  if(!originSame(snapshot.options,options)
   ||!originSame(s.options,{preparationRef:s.preparationRef,format:options.format,utf8Bytes:options.utf8Bytes,contentHash:options.contentHash}))return reject();
  const {protectedContexts}=approval.assignments;
  if(protectedContexts){
   const context=await tx.step(()=>readContext.call(protectedContexts,locked,actor,projectId,s.contextBundleRef.id,s.contextBundleRef.version));
   if(context.projectId!==projectId||!originSame(context.ref,s.contextBundleRef)
    ||!originSame(context.manifest.assignmentRef,s.assignmentRef)||!originSame(context.manifest.budgetRef,s.budgetPolicyRef)
    ||context.currentCheck.state!=='MATCHED_METADATA')return reject();
   contextMatched=true;
  }
  definitionUntil=definitionPolicy.validUntil;
 }
 const environmentPolicy=await tx.step(()=>environmentReadPolicy(locked,actor,projectId,'ENVIRONMENT_VERSION'));
 if(!originSame(environmentPolicy.ref,permissionPolicyRef))return reject();
 const environments=new ProjectEnvironments(access);
 const environment=await tx.step(()=>readEnvironment.call(environments,locked,actor,projectId,s.environmentRef.id,s.environmentRef.version));
 const host=environment.snapshot.executionHostRef;
 if(!originSame(environment.ref,s.environmentRef)||environment.headVersion!==s.environmentRef.version
  ||!originSame(environment.snapshot.policyRef,s.observedPolicyRef)||host.kind!=='CONNECTOR_STATUS')return reject();
 if(environment.evidence.filter((e:{registrationRef:unknown;connectorRef:unknown})=>originSame(e.registrationRef,host.registrationRef)&&originSame(e.connectorRef,host.connectorRef)).length!==1)return reject();
 const references=await tx.step(()=>readReferences.call(environments,locked,actor,projectId,environment.snapshot,environment.evidence,permissionPolicyRef,referenceReaders));
 const dependencies:ObservedDependency[]|null=contextMatched?[...references.dependencies]:null;
 const reader=new ProjectRegistrationReads(access.installationId);
 let selected:({historyHash:string}&Awaited<ReturnType<typeof observe>>)|undefined;
 let until=Math.min(approvalUntil,Date.parse(s.expiresAt),Date.parse(q.snapshot.expiresAt),originPolicy.validUntil,definitionUntil,limitUntil,runtimeUntil,environmentPolicy.validUntil,references.validUntil);
 for(const registration of references.registrations){
  const target=registration.host;
  const live=await tx.step(()=>observe.call(reader,locked,actor,{projectId,registrationRef:target.registrationRef,connectorRef:target.connectorRef,
   originalPolicyRef:s.observedPolicyRef,permissionPolicyRef,controlGeneration:s.subject.controlGeneration}));
  until=Math.min(until,Date.parse(live.expiresAt));
  if(approval)checkRequestDeadline(await tx.clock(),until);
  const history=await tx.step(()=>verifyEnvironmentRegistrationEvidence(locked,projectId,registration.history));
  if(!originSame(history.registrationRef,live.registrationRef)||!originSame(history.connectorRef,live.connectorRef)
   ||history.registrationState!=='ISSUED'||history.scopeDigest!==live.scopeDigest||history.scopeProjection.installationId!==access.installationId
   ||!originSame(history.scopeProjection.policyRef,s.observedPolicyRef)||history.scopeProjection.expectedHostFingerprint!==live.hostPublicKeyFingerprint)return reject();
  dependencies?.push({kind:'CONNECTOR_REGISTRATION',ref:live.registrationRef},{kind:'CONNECTOR_STATUS',ref:live.connectorRef});
  if(originSame(target,host))selected={...live,historyHash:history.contentHash};
 }
 if(!selected)return reject();
 if(dependencies)assertObservedDependencies(environment.snapshot,dependencies);
 const at=await tx.clock();
 assertObservationAccess(access);
 if(!Number.isFinite(until)||at>=until)return reject();
 checkRequestDeadline(at,until);
 let requestSource:OriginReuseRequestSource|undefined;
 if(approval&&contextMatched&&dependencies){
  const unique=new Map(dependencies.map(entry=>[entry.kind+':'+entry.ref.id,entry]));
  const evidence=copyStartOrigin({purpose:'FN09_ORIGIN_REUSE_SYNTHETIC_START_V1',projectId,originRef,reservationRef,
   originCommand:{serverCommandId:stored.serverCommandId,commandId:stored.request.commandId,requestHash:originHash(stored.request)},
   subject:s.subject,execution:s.execution,p1Ref:s.observedPolicyRef,p2Ref:permissionPolicyRef,stageRequestRef:s.stageRequestRef,
   assignmentRef:s.assignmentRef,roleBindingRef:s.roleBindingRef,sessionBindingRef:s.sessionBindingRef,preparationRef:s.preparationRef,
   connectionRef:s.connectionRef,environmentRef:s.environmentRef,contextBundleRef:s.contextBundleRef,optionsRef:s.preparationRef,
   sourceScopes:s.sourceScopes,budgetPolicyRef:s.budgetPolicyRef,dependencies:[...unique.keys()].sort().map(key=>unique.get(key)!),
   candidateCommandId:approval.candidateCommandId,candidatePayloadHash:originHash(approval.candidate),candidatePayload:approval.candidate});
  const freeze=(v:any):any=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};
  requestSource=Object.freeze({evidence:freeze(evidence),until,transactionId:tx.transactionId()});
  requestSources.set(requestSource,{access,db,query:db.query,actor,identity:originActor(actor),requestHash:originHash(approval.request)});
 }
 return{...selected,observedAt:new Date(at).toISOString(),expiresAt:new Date(until).toISOString(),executionAuthorized:false as const,...(requestSource?{requestSource}:{})};
}
