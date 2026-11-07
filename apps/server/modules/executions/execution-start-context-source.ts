import {observeOriginReuseStartEnvironment,originReuseSourceUntil,assertOriginReuseSourceFinal,originReuseSourceLeaseMatches,originReuseStartBodyMatches,type OriginReuseStartLease} from './execution-start-origin-reuse.ts';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {readServerExecutionFactV1,executionFactChecks,type ServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import {ProjectContexts} from '../context/project-contexts.ts';
import {ProjectContextSources} from '../context/context-sources.ts';
import {ProjectExecutionPreparations} from './project-execution-preparations.ts';
import {ProjectConnectionDefinitions} from '../connections/project-connection-definitions.ts';
import {ProjectEnvironments} from '../connections/project-environments.ts';
import {compileExecutionPreparationOptions} from './preparation-input.ts';
import {readMaterialScope,type MaterialScope} from './execution-material-registration-input.ts';
import {readStartMaterialDescriptor,type StartMaterialDescriptor} from './execution-start-material-registration-input.ts';
import type {SyntheticStartMaterialSource} from './execution-start-material-registration-store.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const reject=():never=>{throw new AuthFailure('START_CONTEXT_SOURCE_UNAVAILABLE',412);};
const contextRead=ProjectContexts.prototype.readStartSource,resolve=ProjectContextSources.prototype.resolve,preparationRead=ProjectExecutionPreparations.prototype.read,definitionRead=ProjectConnectionDefinitions.prototype.read,environmentRead=ProjectEnvironments.prototype.read;
const stable=(f:ServerExecutionFactV1)=>{const{checkedAt:_,expires:__,writerState:___,...s}=f;return s;};
export interface StartContextCurrent {
 readonly transport:'SYNTHETIC_ONLY';
 current(db:PoolClient,scope:MaterialScope):Promise<{actor:AuthenticatedIdentity;fact:ServerExecutionFactV1;grantExpiresAt:string}>;
}
interface Ports {contexts:ProjectContexts;preparations:ProjectExecutionPreparations;definitions:ProjectConnectionDefinitions;environments:ProjectEnvironments;current:StartContextCurrent}
/** 명시 합성 조립만 허용한다. current 권위/실제 원문 공급 기본값을 발행하지 않는다. */
export class SyntheticStartContextSource implements SyntheticStartMaterialSource {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly #ports:Ports;readonly #current:StartContextCurrent['current'];
 readonly #loans=new WeakMap<PoolClient,Map<string,{scope:MaterialScope;descriptor:StartMaterialDescriptor;until:number;reuseLease?:OriginReuseStartLease}>>();
 constructor(ports:Ports){this.#ports=ports;this.#current=ports?.current?.current;this.#assertPorts();}
 #assertPorts(){const p=this.#ports;if(!(p?.contexts instanceof ProjectContexts)||!(p.contexts.sources instanceof ProjectContextSources)||!(p.preparations instanceof ProjectExecutionPreparations)||!(p.definitions instanceof ProjectConnectionDefinitions)||!(p.environments instanceof ProjectEnvironments)||p.current?.transport!=='SYNTHETIC_ONLY'||typeof this.#current!=='function'||p.current.current!==this.#current||p.contexts.readStartSource!==contextRead||p.contexts.sources.resolve!==resolve||p.preparations.read!==preparationRead||p.definitions.read!==definitionRead||p.environments.read!==environmentRead)return reject();}
 async #start(db:PoolClient,input:MaterialScope){
  this.#assertPorts();const scope=readMaterialScope(input),query=db.query;
  const tx=async()=>{this.#assertPorts();if(db.query!==query)return reject();const rows=(await db.query('SELECT txid_current()::text AS transaction_id')).rows;if(db.query!==query||rows.length!==1||typeof rows[0]?.transaction_id!=='string'||!/^[1-9][0-9]*$/.test(rows[0].transaction_id))return reject();return rows[0].transaction_id as string;},original=await tx();
  const now=async()=>{if(db.query!==query)return reject();const rows=(await db.query('SELECT clock_timestamp() AS at')).rows;if(db.query!==query||rows.length!==1||!(rows[0]?.at instanceof Date)||!Number.isFinite(rows[0].at.getTime()))return reject();return rows[0].at.getTime() as number;};
  let first:{actor:AuthenticatedIdentity;fact:ServerExecutionFactV1;grantExpiresAt:string}|undefined,until=Number.MAX_SAFE_INTEGER,last=0;
  const check=async()=>{if(await tx()!==original)return reject();const arg=cloneV1(scope),raw=cloneV1(await this.#current.call(this.#ports.current,db,arg));if(!same(arg,scope)||!recordV1(raw,['actor','fact','grantExpiresAt'])||!isoV1(raw.grantExpiresAt))return reject();
   const fact=readServerExecutionFactV1(raw.fact);if(!['NONE','OWNED'].includes(fact.writerState)||executionFactChecks.some(k=>k!=='understanding'&&fact.checks[k].state!=='VERIFIED_CURRENT')||fact.intent.mode==='WORK'&&(fact.understandingReviewRef===null||fact.checks.understanding.state!=='VERIFIED_CURRENT'))return reject();const actor=raw.actor as unknown as AuthenticatedIdentity,a=actor?.authSession;
   if(!a||actor.actorId!==fact.subject.userId||actor.clientId!==fact.subject.clientId||actor.credentialGeneration!==fact.subject.credentialGeneration||a.id!==fact.subject.humanSessionId||!isoV1(a.idleExpiresAt)||!isoV1(a.absoluteExpiresAt)||fact.projectId!==scope.projectId||fact.executionId!==scope.executionId||fact.executionGeneration!==scope.executionGeneration||fact.registration.connectorId!==scope.connectorId||fact.subject.credentialGeneration!==scope.credentialGeneration)return reject();
   const at=await now();if(at<last||Date.parse(fact.checkedAt)>at)return reject();last=at;
   if(first&&(!same(first.actor,actor)||!same(stable(first.fact),stable(fact))||first.grantExpiresAt!==raw.grantExpiresAt))return reject();
   until=Math.min(until,Date.parse(raw.grantExpiresAt),Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt),Date.parse(fact.checkedAt)+30000,...Object.values(fact.expires).map(Date.parse));
   if(until<=at||await tx()!==original)return reject();this.#assertPorts();first??={actor:cloneV1(actor),fact,grantExpiresAt:raw.grantExpiresAt};return {actor,fact,at,until};
  };
  await check();return {scope,check,first:()=>first!,until:()=>until,now};
 }
 async #load(db:PoolClient,s:MaterialScope,descriptor?:StartMaterialDescriptor){
  const call=await this.#start(db,s),first=await call.check(),p=this.#ports,fact=first.fact;
  if(descriptor){if(!same(descriptor.scope,s)||!same(descriptor.payload,{contextBundleRef:fact.intent.contextBundleRef,optionsRef:fact.preparationRef})||!isoV1(descriptor.expiresAt))return reject();if(Date.parse(descriptor.expiresAt)<=first.at)return reject();}
  const context=await contextRead.call(p.contexts,db,first.actor,s.projectId,cloneV1(fact.intent.contextBundleRef));await call.check();
  const prep=await preparationRead.call(p.preparations,db,first.actor,s.projectId,fact.preparationRef.id,fact.preparationRef.version);await call.check();
  if(!same(prep.ref,fact.preparationRef)||prep.projectId!==s.projectId||prep.currentness!=='NOT_RECHECKED'||!recordV1(prep.snapshot,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed','options'])||hash(prep.snapshot)!==prep.ref.contentHash)return reject();
  const i=prep.snapshot.intent as Record<string,any>,{connectionKind:_,optionsFormat:__,...runtime}=i;
  if(i.connectionKind!=='REGISTERED_DEFINITION'||!same(runtime,fact.intent)||!same(prep.snapshot.basisRefs,fact.basisRefs)||!same(prep.snapshot.latestInstructionRefs,fact.latestInstructionRefs)||!same(prep.snapshot.preparedBy,{kind:'HUMAN',userId:first.actor.actorId})||prep.snapshot.authorizationState!=='NOT_AUTHORIZED'||prep.snapshot.executionAuthorized!==false||prep.snapshot.dispatchPerformed!==false)return reject();
  const definition=await definitionRead.call(p.definitions,db,first.actor,s.projectId,i.connectionRef.id,i.connectionRef.version);await call.check();
  const environment=await environmentRead.call(p.environments,db,first.actor,s.projectId,i.environmentRef.id,i.environmentRef.version);await call.check();
  const reuseLease=await observeOriginReuseStartEnvironment(db,this,s,descriptor);await call.check();
  if(!same(definition.ref,i.connectionRef)||!same(definition.definition.environmentRef,i.environmentRef)||definition.currentStatus.configurationCurrent!==true||!same(environment.ref,i.environmentRef)||environment.current.configurationCurrentness!=='MATCHED'&&!originReuseSourceLeaseMatches(reuseLease,db,this,s))return reject();
  const options=compileExecutionPreparationOptions(definition.definition);if(!same(options,prep.snapshot.options)||i.optionsFormat!==options.format)return reject();
  const m=context.manifest,r=context.prepared;
  if(!same(context.ref,fact.intent.contextBundleRef)||!same(m.assignmentRef,fact.intent.assignmentRef)||!same(m.baselineRefs,r.baselineRefs)||!same(m.constitutionRef,r.constitutionRef)||m.missingRequired.length||m.excluded.length)return reject();
  const items=m.items.map(item=>{const binding=m.sourceBindings.find(b=>b.itemId===item.itemId);if(!binding||!binding.selection||!binding.bodyRef||item.includedState!=='INCLUDED'||item.issue!==null)return reject();
   const parts=m.deliveryPlan.parts.filter(v=>v.itemId===item.itemId).map(v=>{const text=r.parts.find(t=>t.partId===v.partId&&t.itemId===item.itemId);if(!text||text.utf8Bytes!==v.utf8Bytes||text.contentHash!==v.contentHash||Buffer.byteLength(text.text,'utf8')!==v.utf8Bytes||contentHash(text.text)!==v.contentHash)return reject();return {partId:v.partId,order:v.order,byteOffset:v.byteOffset,utf8Bytes:v.utf8Bytes,contentHash:v.contentHash,text:text.text};});
   if(!parts.length)return reject();return{itemId:item.itemId,category:item.category,sourceRef:item.sourceRef,selection:binding.selection,bodyRef:binding.bodyRef,sourceState:binding.sourceState,includedState:'INCLUDED' as const,reason:item.reason,parts};});
  const body=canonicalJson({schemaVersion:1,purpose:'START_CONTEXT_BODY_V1',contextBundleRef:context.ref,assignmentRef:m.assignmentRef,budgetRef:m.budgetRef,baselineRefs:m.baselineRefs,constitutionRef:m.constitutionRef,items,ready:false,executionAuthorized:false,dispatchPerformed:false});
  const bodies=[Buffer.from(body,'utf8'),Buffer.from(options.body,'utf8')];if(bodies.some(b=>!b.length)||bodies.reduce((n,b)=>n+b.length,0)>2097152)return reject();
  // 전반 관측을 고정한 뒤 보호 원문/정의/환경을 한 번만 재대조한다. fact 재조회가 이를 대신하지 않는다.
  const finalContext=await contextRead.call(p.contexts,db,first.actor,s.projectId,cloneV1(fact.intent.contextBundleRef));await call.check();if(!same(finalContext,context))return reject();
  const finalPrep=await preparationRead.call(p.preparations,db,first.actor,s.projectId,fact.preparationRef.id,fact.preparationRef.version);await call.check();if(!same(finalPrep,prep))return reject();
  const finalDefinition=await definitionRead.call(p.definitions,db,first.actor,s.projectId,i.connectionRef.id,i.connectionRef.version);await call.check();if(!same({ref:finalDefinition.ref,definition:finalDefinition.definition,currentStatus:finalDefinition.currentStatus},{ref:definition.ref,definition:definition.definition,currentStatus:definition.currentStatus}))return reject();
  const finalEnvironment=await environmentRead.call(p.environments,db,first.actor,s.projectId,i.environmentRef.id,i.environmentRef.version);await call.check();if(reuseLease){const finalLease=await observeOriginReuseStartEnvironment(db,this,s,descriptor);if(finalLease!==reuseLease||!originReuseSourceLeaseMatches(reuseLease,db,this,s))return reject();await call.check();}if(!same({ref:finalEnvironment.ref,snapshot:finalEnvironment.snapshot,headVersion:finalEnvironment.current.headVersion,state:finalEnvironment.current.configurationCurrentness,issues:finalEnvironment.current.issues},{ref:environment.ref,snapshot:environment.snapshot,headVersion:environment.current.headVersion,state:environment.current.configurationCurrentness,issues:environment.current.issues}))return reject();
  const end=await call.check(),until=Math.min(end.until,descriptor?Date.parse(descriptor.expiresAt):end.until,reuseLease?await assertOriginReuseSourceFinal(reuseLease,db,this,s):Infinity);if(until<=end.at)return reject();return{call,context,prep,bodies,options,until,reuseLease};
 }
 async describe(db:PoolClient,actor:AuthenticatedIdentity,scope:MaterialScope,request:ProjectCommand,rawFact:unknown){
  const fact=readServerExecutionFactV1(rawFact),r=await this.#load(db,scope);if(!same(r.call.first().actor,actor)||!same(stable(r.call.first().fact),stable(fact))||request.projectId!==scope.projectId||request.clientId!==actor.clientId||request.controlGeneration!==fact.subject.controlGeneration||!same((request.payload as any)?.payload,{contextBundleRef:fact.intent.contextBundleRef,optionsRef:fact.preparationRef}))return reject();
  const refs=[r.context.ref,r.prep.ref],groups=r.bodies.map((bytes,index)=>({kind:index===0?'CONTEXT_BUNDLE':'START_OPTIONS',payloadRef:refs[index],source:{sourceRef:refs[index],bodyRef:refs[index],originRef:refs[index],contentHash:contentHash(bytes),sourceBytes:bytes.length,mediaType:'application/json'},parts:[{materialId:randomUUID(),partIndex:1,byteOffset:0,utf8Bytes:bytes.length,contentHash:contentHash(bytes)}]}));
  const result=readStartMaterialDescriptor({schemaVersion:1,purpose:'START_CONTEXT_OPTIONS_MATERIAL_V1',id:randomUUID(),sourceKind:'SYNTHETIC_REFERENCE_ONLY_V1',scope,commandId:request.commandId,payload:{contextBundleRef:refs[0],optionsRef:refs[1]},groups,expiresAt:new Date(r.until).toISOString()});await r.call.check();return result.descriptor;
 }
 async inspect(db:PoolClient,scope:MaterialScope,descriptor:StartMaterialDescriptor,basis:unknown){
  const plan=readStartMaterialDescriptor(descriptor),r=await this.#load(db,scope,plan.descriptor),f=r.call.first().fact,expected={subject:f.subject,permissionPolicyRef:f.permissionPolicyRef,basisRefs:f.basisRefs,latestInstructionRefs:f.latestInstructionRefs};if(!same(basis,expected))return reject();
  for(let n=0;n<2;n++){const g=plan.descriptor.groups[n]!,ref=n===0?r.context.ref:r.prep.ref;if(!same(g.payloadRef,ref)||![g.source.sourceRef,g.source.bodyRef,g.source.originRef].every(v=>same(v,ref))||g.source.mediaType!=='application/json'||g.source.contentHash!==contentHash(r.bodies[n]!)||g.source.sourceBytes!==r.bodies[n]!.length)return reject();for(const part of g.parts)if(contentHash(r.bodies[n]!.subarray(part.byteOffset,part.byteOffset+part.utf8Bytes))!==part.contentHash)return reject();}
  const last=await r.call.check(),until=Math.min(r.until,last.until);if(until<=last.at)return reject();let loans=this.#loans.get(db);if(!loans){loans=new Map();this.#loans.set(db,loans);}for(const [key,v]of loans)if(v.until<=last.at)loans.delete(key);loans.set(plan.manifestRef.contentHash,{scope:cloneV1(scope),descriptor:cloneV1(plan.descriptor),until,...(r.reuseLease?{reuseLease:r.reuseLease}:{})});
  return{scope:cloneV1(scope),descriptorHash:plan.manifestRef.contentHash,basis:cloneV1(expected),fact:cloneV1(last.fact),preparation:r.prep,access:'READ',quarantined:false,superseded:false,excluded:false,checkedAt:new Date(last.at).toISOString(),expiresAt:new Date(until).toISOString()};
 }
 async readBody(db:PoolClient,scope:MaterialScope,selection:unknown){
  if(!recordV1(selection,['commandRef','manifestRef','group'])||!refV1(selection.commandRef)||!refV1(selection.manifestRef))return reject();const loans=this.#loans.get(db),loan=loans?.get(selection.manifestRef.contentHash);if(!loan||!same(loan.scope,scope)||loan.descriptor.id!==selection.manifestRef.id||selection.manifestRef.version!==1)return reject();if(loan.reuseLease&&(!originReuseSourceLeaseMatches(loan.reuseLease,db,this,scope)||!originReuseStartBodyMatches(db,this,scope,selection.commandRef)))return reject();const index=loan.descriptor.groups.findIndex(g=>same(g,selection.group));if(index<0)return reject();
  const r=await this.#load(db,scope,loan.descriptor),g=loan.descriptor.groups[index]!,last=await r.call.check();const reuseUntil=loan.reuseLease?await assertOriginReuseSourceFinal(loan.reuseLease,db,this,scope):Infinity;if(Math.min(loan.until,r.until,last.until,reuseUntil)<=last.at||g.source.contentHash!==contentHash(r.bodies[index]!)||g.source.sourceBytes!==r.bodies[index]!.length)return reject();return new Uint8Array(r.bodies[index]!);
 }
}
