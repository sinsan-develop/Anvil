import type {PoolClient} from 'pg';
import {isProxy} from 'node:util/types';
import type {AccessRepository,AuthenticatedIdentity} from '../access/repository.ts';
import {ProjectConnectionDefinitions} from './project-connection-definitions.ts';
import {ProjectEnvironments} from './project-environments.ts';
import {ProjectEnvironmentResources} from './project-environment-resources.ts';
import {ProjectRegistrationReads} from './project-registration-reads.ts';
import {ProjectSourceRoots} from './project-source-roots.ts';
import {SourceReadRecords} from './source-read-records.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readStoredDefinition} from './connection-definition-input.ts';
import {readStoredEnvironment,readStoredEnvironmentResource} from '../../../../contracts/runtime/environment-configuration-v1.ts';
type Call={signal:AbortSignal;expiresAt:string};
type Options={clock:()=>number;timeoutMs:number;expiresAt:string};
const original={definition:ProjectConnectionDefinitions.prototype.read,environment:ProjectEnvironments.prototype.read,references:ProjectEnvironments.prototype.references,resource:ProjectEnvironmentResources.prototype.read,root:ProjectSourceRoots.prototype.read,snapshot:SourceReadRecords.prototype.readSnapshot,grant:SourceReadRecords.prototype.load};
const subordinates=[
 [ProjectEnvironments.prototype,'history',ProjectEnvironments.prototype.history],
 ...(['host','currentHost','currentMetadata','currentSource'] as const).map(key=>[ProjectEnvironmentResources.prototype,key,ProjectEnvironmentResources.prototype[key]] as const),
 [ProjectRegistrationReads.prototype,'read',ProjectRegistrationReads.prototype.read]
] as const;
const fail=():never=>{throw Error('CLAUDE_PROCESS_PROFILE_UNAVAILABLE');};
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function member(v:any,k:PropertyKey):any{if(!v||typeof v!=='object'||isProxy(v))return fail();for(let n=v,d=0;n&&d<64;n=Object.getPrototypeOf(n),d++){if(isProxy(n))return fail();const p=Object.getOwnPropertyDescriptor(n,k);if(p){if(!('value'in p))return fail();return p.value;}}return fail();}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
/** 같은 보호 원문을 명시 선택하는 비권한 후보이며 실행 구성을 만들지 않는다. */
export class ClaudeProcessProfileSelector{
 #access:AccessRepository;#installation:unknown;#definitions:ProjectConnectionDefinitions;#environments:ProjectEnvironments;#resources:ProjectEnvironmentResources;#roots:ProjectSourceRoots;#observations:SourceReadRecords;#clock:()=>number;#timeout:number;#until:number;#last=-Infinity;#busy=false;
 constructor(access:AccessRepository,options:Options){
  if(!access||isProxy(access)||!options||isProxy(options)||!recordV1(options,['clock','timeoutMs','expiresAt'])||typeof options.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000||!isoV1(options.expiresAt))fail();
  this.#access=access;this.#installation=member(access,'installationId');this.#clock=options.clock;this.#timeout=options.timeoutMs;this.#until=Date.parse(options.expiresAt);this.#definitions=new ProjectConnectionDefinitions(access);this.#environments=new ProjectEnvironments(access);this.#resources=this.#environments.resources;this.#roots=this.#environments.roots;this.#observations=this.#environments.observations;this.#ports();
 }
 #ports(){
  const checks:[[any,any,string,Function],...Array<[any,any,string,Function]>]=[[this.#definitions,ProjectConnectionDefinitions,'read',original.definition],[this.#environments,ProjectEnvironments,'read',original.environment],[this.#environments,ProjectEnvironments,'references',original.references],[this.#resources,ProjectEnvironmentResources,'read',original.resource],[this.#roots,ProjectSourceRoots,'read',original.root],[this.#observations,SourceReadRecords,'readSnapshot',original.snapshot],[this.#observations,SourceReadRecords,'load',original.grant]];
  for(const [prototype,key,fn] of subordinates){const d=Object.getOwnPropertyDescriptor(prototype,key);if(!d||!('value'in d)||d.value!==fn)return fail();}
  for(const [prototype,key,fn] of subordinates){if(prototype===ProjectEnvironments.prototype&&member(this.#environments,key)!==fn||prototype===ProjectEnvironmentResources.prototype&&member(this.#resources,key)!==fn)return fail();}
  for(const [value,type,key,fn] of checks)if(isProxy(value)||Object.getPrototypeOf(value)!==type.prototype||member(value,key)!==fn||type.prototype[key]!==fn)return fail();
  if(member(this.#access,'installationId')!==this.#installation||member(this.#environments,'access')!==this.#access||member(this.#resources,'access')!==this.#access||member(this.#environments,'resources')!==this.#resources||member(this.#environments,'roots')!==this.#roots||member(this.#environments,'observations')!==this.#observations)return fail();
 }
 #now(){const now=this.#clock();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime())||now<this.#last)return fail();this.#last=now;return now;}
 #actor(actor:AuthenticatedIdentity){
  if(!actor||isProxy(actor))return fail();const names=['actorId','clientId','credentialGeneration','serverOwner','reauthUntil','authSession'],values:any={};for(const name of names){const d=Object.getOwnPropertyDescriptor(actor,name);if(d){if(!('value'in d))return fail();values[name]=d.value;}else values[name]=null;}
  if(!uuidV1(values.actorId)||!uuidV1(values.clientId)||!Number.isSafeInteger(values.credentialGeneration)||values.credentialGeneration<1)return fail();
  if(values.reauthUntil!==null){if(isProxy(values.reauthUntil))return fail();values.reauthUntil=Date.prototype.getTime.call(values.reauthUntil);if(!Number.isFinite(values.reauthUntil))return fail();}
  const session=values.authSession;if(!session||isProxy(session)||!recordV1(session,['id','idleExpiresAt','absoluteExpiresAt'])||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))return fail();values.authSession={id:session.id,idleExpiresAt:session.idleExpiresAt,absoluteExpiresAt:session.absoluteExpiresAt};return values;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,rawRefs:unknown,call:Call){
  if(this.#busy)return fail();if(!uuidV1(projectId)||!call||isProxy(call)||!recordV1(call,['signal','expiresAt']))return fail();const fixed=Object.freeze({signal:Object.getOwnPropertyDescriptor(call,'signal')!.value as AbortSignal,expiresAt:Object.getOwnPropertyDescriptor(call,'expiresAt')!.value as string});
  if(!isoV1(fixed.expiresAt)||isProxy(fixed.signal))return fail();try{Reflect.apply(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')!.get!,fixed.signal,[]);}catch{return fail();}
  if(!rawRefs||isProxy(rawRefs)||!recordV1(rawRefs,['connectionRef','environmentRef','profileRef'])||!Object.values(rawRefs).every(refV1))return fail();const refs=freeze(JSON.parse(canonicalJson(rawRefs))),actorSnapshot=this.#actor(actor),query=member(db,'query'),end=Math.min(this.#now()+this.#timeout,this.#until,Date.parse(fixed.expiresAt),Date.parse(actorSnapshot.authSession.idleExpiresAt),Date.parse(actorSnapshot.authSession.absoluteExpiresAt));if(typeof query!=='function')return fail();
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,rejectCancel!:(e:Error)=>void,externalDone=false,workDone=true;const cancel=()=>{controller.abort();rejectCancel(Error('CLAUDE_PROCESS_PROFILE_UNAVAILABLE'));};const cancelled=new Promise<never>((_,reject)=>rejectCancel=reject);void cancelled.catch(()=>{});const release=()=>{if(externalDone&&workDone)this.#busy=false;};
  const guard=()=>{const at=this.#now();this.#ports();if(controller.signal.aborted||fixed.signal.aborted||member(db,'query')!==query||!same(this.#actor(actor),actorSnapshot)||at>=end)return fail();};
  this.#busy=true;
  try{
   EventTarget.prototype.addEventListener.call(fixed.signal,'abort',cancel,{once:true});if(fixed.signal.aborted)cancel();guard();timer=setTimeout(cancel,Math.max(1,end-this.#now()));workDone=false;
   const work=Promise.resolve().then(async()=>{
    const step=async<T>(body:()=>Promise<T>)=>{guard();const result=await body();guard();return result;};
    const load=async()=>{
     const connection=await step(()=>Reflect.apply(original.definition,this.#definitions,[db,actor,projectId,refs.connectionRef.id,refs.connectionRef.version]) as ReturnType<typeof original.definition>);
     if(!connection||connection.projectId!==projectId||!same(connection.ref,refs.connectionRef)||!connection.currentStatus?.configurationCurrent||connection.currentStatus.headVersion!==refs.connectionRef.version||connection.currentStatus.executionAuthorized!==false)return fail();const definition=readStoredDefinition(connection.definition);if(definitionHash(definition)!==refs.connectionRef.contentHash||definition.adapterKind!=='CLAUDE_AGENT_SDK'||definition.toolProduct!=='Claude Code'||!same(definition.environmentRef,refs.environmentRef))return fail();
     const environment=await step(()=>Reflect.apply(original.environment,this.#environments,[db,actor,projectId,refs.environmentRef.id,refs.environmentRef.version]) as ReturnType<typeof original.environment>);
     if(environment.projectId!==projectId||environment.kind!=='ENVIRONMENT_VERSION'||!same(environment.ref,refs.environmentRef)||environment.historyVerification!=='STORED_CONFIGURATION_VERIFIED'||environment.current?.configurationCurrentness!=='MATCHED'||environment.current.headVersion!==refs.environmentRef.version||environment.executionEligible!==false||environment.dispatchPerformed!==false)return fail();const snapshot=readStoredEnvironment(environment.snapshot);if(snapshot.contentHash!==refs.environmentRef.contentHash||snapshot.commandProfileRefs.filter(p=>same(p.ref,refs.profileRef)).length!==1)return fail();
     const profile=await step(()=>Reflect.apply(original.resource,this.#resources,[db,actor,projectId,'COMMAND_PROFILE_METADATA',refs.profileRef.id,refs.profileRef.version]) as ReturnType<typeof original.resource>);
     if(profile.projectId!==projectId||profile.kind!=='COMMAND_PROFILE_METADATA'||!same(profile.ref,refs.profileRef)||profile.historyVerification!=='STORED_CONFIGURATION_VERIFIED'||profile.current?.configurationCurrentness!=='MATCHED'||profile.current.headVersion!==refs.profileRef.version||profile.executionEligible!==false||profile.dispatchPerformed!==false)return fail();const stored=readStoredEnvironmentResource('COMMAND_PROFILE_METADATA',profile.snapshot);if(hash(stored)!==refs.profileRef.contentHash||stored.status!=='DECLARED'||!stored.definition.toolRequirements.some((t:any)=>t.product===definition.toolProduct))return fail();
     return{definition,snapshot,profile:stored,issues:environment.current.issues};
    };
    const before=await load();const evidence:any[]=[];await step(()=>Reflect.apply(original.references,this.#environments,[db,actor,projectId,before.snapshot,true,evidence]));const after=await load();
    if(!same(before.definition,after.definition)||!same(before.snapshot,after.snapshot)||!same(before.profile,after.profile))return fail();const observedAt=new Date(this.#now()).toISOString();guard();return freeze({kind:'CLAUDE_PROCESS_PROFILE_DATA_CANDIDATE' as const,refs,connection:{toolProduct:after.definition.toolProduct,toolVersion:after.definition.toolVersion,adapterKind:after.definition.adapterKind},definition:after.profile.definition,environment:{executionHostRef:after.snapshot.executionHostRef,targetHostRefs:after.snapshot.targetHostRefs,sourceRoots:after.snapshot.sourceRoots,secretRefs:after.snapshot.secretRefs},issues:after.issues,observedAt,expiresAt:new Date(end).toISOString(),actualExecutionVerified:false,executionAuthorized:false,executionEligible:false,dispatchPerformed:false,workAccepted:false,ownership:'UNVERIFIED'});
   });void work.then(()=>{workDone=true;release();},()=>{workDone=true;release();});return await Promise.race([work,cancelled]);
  }catch{return fail();}finally{externalDone=true;if(timer)clearTimeout(timer);EventTarget.prototype.removeEventListener.call(fixed.signal,'abort',cancel);controller.abort();release();}
 }
}
function definitionHash(v:unknown){return hash(v);}
