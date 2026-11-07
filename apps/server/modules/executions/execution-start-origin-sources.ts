import type {PoolClient} from 'pg';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,currentProjectController,authorizeMaterial} from '../access/project-command.ts';
import {ProjectStageQueue} from '../scheduling/stage-queue.ts';
import {ProjectExecutionPreparations} from './project-execution-preparations.ts';
import {ProjectMethodologies} from '../methodologies/project-methodologies.ts';
import {readApplicationSnapshot} from '../methodologies/application-snapshot.ts';
import {ProjectLimitPolicies} from './runtime-policy.ts';
import {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import {ProjectAssignmentDrafts} from '../assignments/project-assignment-drafts.ts';
import {ResponsibleSessions} from '../assignments/responsible-sessions.ts';
import {ProjectContexts} from '../context/project-contexts.ts';
import {ProjectConnectionDefinitions} from '../connections/project-connection-definitions.ts';
import {ProjectEnvironments} from '../connections/project-environments.ts';
import {ProjectEnvironmentResources} from '../connections/project-environment-resources.ts';
import {ProjectRegistrationReads} from '../connections/project-registration-reads.ts';
import {copyStartOrigin,originSame,originActor,originFailure,readExecutionStartOriginCommand} from './execution-start-origin-input.ts';

type Ports={queue:ProjectStageQueue;preparations:ProjectExecutionPreparations;applications:ProjectMethodologies;budgets:ProjectLimitPolicies};
export type OriginLifetimeObservation={readonly observedAt:number;readonly startedAt:number;readonly until:number};
type Pin={object:object;prototype:object;name:string;fn:Function};
const method=(p:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(p,k);if(!d||!('value'in d)||typeof d.value!=='function')originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);return d.value as Function;};
const own=(p:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(p,k);if(!d||!('value'in d))originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);return d.value;};
const originals=[
 [ProjectStageQueue.prototype,['readRequest']], [ProjectExecutionPreparations.prototype,['read','readStartOriginSources']],
 [ProjectMethodologies.prototype,['readApplication']], [ProjectLimitPolicies.prototype,['read','resolveCurrent']],
 [ProjectAssignmentConfirmations.prototype,['read']], [ProjectAssignmentDrafts.prototype,['current']],
 [ResponsibleSessions.prototype,['readBinding']], [ProjectContexts.prototype,['read']],
 [ProjectConnectionDefinitions.prototype,['read']], [ProjectEnvironments.prototype,['read','history','references']],
 [ProjectEnvironmentResources.prototype,['read','host','currentHost','currentMetadata','currentSource']],
 [ProjectRegistrationReads.prototype,['read']],
] as const;
const originalMethods=originals.flatMap(([prototype,names])=>names.map(name=>({prototype,name,fn:method(prototype,name)})));

/** 원 보호 reader의 불변 관측을 결합한다. 이 결과는 실행 credential이나 실제 runtime 허가가 아니다. */
export class ExecutionStartOriginSources{
 readonly #ports:Ports;readonly #pins:Pin[]=[];
 constructor(ports:Ports){
  if(!ports||typeof ports!=='object'||Reflect.ownKeys(ports).length!==4)originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  this.#ports=Object.freeze({queue:own(ports,'queue'),preparations:own(ports,'preparations'),applications:own(ports,'applications'),budgets:own(ports,'budgets')});ports=this.#ports;
  const bind=(object:object,prototype:object,names:string[])=>{if(Object.getPrototypeOf(object)!==prototype)originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);for(const name of names){const fn=method(prototype,name);if(Object.hasOwn(object,name))originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);this.#pins.push({object,prototype,name,fn});}};
  bind(ports.queue,ProjectStageQueue.prototype,['readRequest']);bind(ports.preparations,ProjectExecutionPreparations.prototype,['read','readStartOriginSources']);bind(ports.applications,ProjectMethodologies.prototype,['readApplication']);bind(ports.budgets,ProjectLimitPolicies.prototype,['read','resolveCurrent']);
  const p=ports.preparations;
  bind(own(p,'assignments'),ProjectAssignmentConfirmations.prototype,['read']);bind(own(p,'drafts'),ProjectAssignmentDrafts.prototype,['current']);bind(own(p,'sessions'),ResponsibleSessions.prototype,['readBinding']);bind(own(p,'contexts'),ProjectContexts.prototype,['read']);
  this.#check();
 }
 #check(){
  for(const p of originalMethods)if(method(p.prototype,p.name)!==p.fn)originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  for(const p of this.#pins)if(Object.getPrototypeOf(p.object)!==p.prototype||Object.hasOwn(p.object,p.name)||method(p.prototype,p.name)!==p.fn)originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  const p=this.#ports.preparations;
  if(!['assignments','drafts','sessions','contexts'].every(key=>this.#pins.some(v=>v.object===own(p,key))))originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
 }
 async load(db:PoolClient,actor:AuthenticatedIdentity,raw:unknown,mode:'FRESH'|'HISTORY',guard:(observation?:OriginLifetimeObservation)=>Promise<void>){
  const request=readExecutionStartOriginCommand(raw),selection=request.payload as any,query=db.query,identity=originActor(actor),ports=this.#ports;
  if(!['FRESH','HISTORY'].includes(mode)||typeof guard!=='function')originFailure('INPUT_INVALID',422);
  let transactionId='',last=-Infinity,observedMark=0,until=Math.min(Date.parse(actor.authSession?.idleExpiresAt??''),Date.parse(actor.authSession?.absoluteExpiresAt??''));
  const sync=()=>{this.#check();if(db.query!==query||originActor(actor)!==identity)originFailure('EXECUTION_START_ORIGIN_CURRENT_REQUIRED',412);};
  const check=async()=>{sync();await guard();sync();};
  const step=async<T>(work:()=>Promise<T>,known?:(value:T)=>Promise<void>)=>{await check();const value=await work();sync();if(known)await known(value);await check();return value;};
  // 마지막 외부 guard 뒤 clock을 관측한다. 관측 뒤 caller callback을 다시 실행하지 않는다.
  const clock=async()=>{await check();const mark=Math.floor(performance.now()),result=await db.query('SELECT txid_current()::text AS transaction_id,clock_timestamp() AS observed_at');sync();const row=result.rows.length===1?result.rows[0]:null,at=row?.observed_at?.getTime();if(typeof row?.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(row.transaction_id)||transactionId&&transactionId!==row.transaction_id||!Number.isFinite(at)||at<last||!Number.isSafeInteger(mark)||mark<observedMark||!Number.isFinite(until)||at>=until)originFailure('EXECUTION_START_ORIGIN_CURRENT_REQUIRED',412);transactionId=row.transaction_id;last=at;observedMark=mark;};
  const publish=async()=>{await guard(Object.freeze({observedAt:last,startedAt:observedMark,until}));sync();};
  await clock();await publish();await step(()=>projectMember(db,actor,request.projectId,true));
  if(mode==='FRESH')await step(()=>currentProjectController(db,actor,request));
  const knowPolicy=async(value:{approvalRequired:boolean;validUntil:number})=>{if(value.approvalRequired)originFailure('EXECUTION_START_ORIGIN_APPROVAL_NOT_CONNECTED',412);until=Math.min(until,value.validUntil);await publish();};
  const policy=await step(()=>authorizeMaterial(db,actor,{...request,operation:mode==='FRESH'?request.operation:'readExecutionStartOrigins'},true),knowPolicy);
  const observe=async()=>{
   const stage=await step(()=>ports.queue.readRequest(db,actor,request.projectId,selection.stageRequestRef));
   const source=await step(()=>ports.preparations.readStartOriginSources(db,actor,request.projectId,selection.preparationRef,mode,check));
   const {preparation,assignment,binding,context}=source,input=preparation.snapshot.intent,task=assignment.snapshot.definition.taskRef,stageInput=stage.snapshot.input;
   if(!originSame(assignment.ref,selection.assignmentRef)||!originSame(binding.ref,selection.roleBindingRef)||!originSame(input.assignmentRef,selection.assignmentRef)||!originSame(input.roleBindingRef,selection.roleBindingRef)||!originSame(stageInput.methodologyApplicationRef,task.applicationRef)||!originSame(stageInput.startNodeRef,{applicationRef:task.applicationRef,nodeId:task.nodeId})||!stageInput.baselineRefs.every((v:unknown)=>assignment.snapshot.definition.baselineRefs.some((r:unknown)=>originSame(v,r))&&preparation.snapshot.basisRefs.some((r:unknown)=>originSame(v,r)))||!originSame(stageInput.budgetRef,input.budgetPolicyRef))originFailure('EXECUTION_START_ORIGIN_SOURCE_MISMATCH',409);
   if(mode==='FRESH'&&(!originSame(stage.currentRef,stage.ref)||stage.currentState!=='WAITING'))originFailure('EXECUTION_START_ORIGIN_NOT_WAITING',409);
   const application=mode==='FRESH'?await step(()=>ports.applications.readApplication(db,actor,request.projectId)):readApplicationSnapshot(request.projectId,(await step(()=>db.query('SELECT id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 AND id=$2 AND application_version=$3',[request.projectId,task.applicationRef.id,task.applicationRef.version]))).rows);
   if(!originSame(application.applicationRef,task.applicationRef))originFailure('EXECUTION_START_ORIGIN_SOURCE_MISMATCH',409);
   const budget=mode==='FRESH'?await step(()=>ports.budgets.resolveCurrent(db,actor,request.projectId,stageInput.budgetRef,{kind:'PROJECT',projectId:request.projectId}),async value=>{until=Math.min(until,Date.parse(value.snapshot.expiresAt));await publish();}):await step(()=>ports.budgets.read(db,actor,request.projectId,stageInput.budgetRef.id,stageInput.budgetRef.version));
   return{stage,preparation,assignment,binding,context,application,budget};
  };
  const before=await observe(),after=await observe();
  const seal=(v:typeof before)=>({stage:{ref:v.stage.ref,snapshot:v.stage.snapshot},preparation:{ref:v.preparation.ref,snapshot:v.preparation.snapshot},assignment:{ref:v.assignment.ref,snapshot:v.assignment.snapshot},binding:{ref:v.binding.ref,snapshot:v.binding.snapshot},context:{ref:v.context.ref,manifest:v.context.manifest},application:{applicationRef:v.application.applicationRef,snapshot:v.application.snapshot},budget:{ref:v.budget.ref,snapshot:v.budget.snapshot}});
  if(!originSame(seal(before),seal(after)))originFailure('EXECUTION_START_ORIGIN_SOURCE_CHANGED',409);
  if(mode==='FRESH')await step(()=>currentProjectController(db,actor,request));
  const finalPolicy=await step(()=>authorizeMaterial(db,actor,{...request,operation:mode==='FRESH'?request.operation:'readExecutionStartOrigins'},true),knowPolicy);if(!originSame(finalPolicy.ref,policy.ref))originFailure('EXECUTION_START_ORIGIN_SOURCE_CHANGED',409);
  await clock();return copyStartOrigin({...after,policyRef:policy.ref,validUntil:until,observedAt:new Date(last).toISOString(),transactionId,lifetime:{observedAt:last,startedAt:observedMark}});
 }
}
