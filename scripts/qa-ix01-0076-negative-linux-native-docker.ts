import {createHash} from 'node:crypto';
import {spawn as spawnChild} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {closeSync,constants,fstatSync,lstatSync,openSync,readlinkSync,readSync,statSync} from 'node:fs';
import {types} from 'node:util';
import {hashV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {contentHash} from '../contracts/canonical.ts';
import {
 current0076NegativeContract,observe0076DdlFailure,
 type NegativeFailureParserCapability,
} from './qa-ix01-0076-atomicity-negative.ts';
import {verifyCurrentSchemaExecutionDelivery,type CurrentSchemaExecutionBaseline} from '../tests/integration/IX01/current-schema-installation.ts';
import {verifyCurrentSchemaSources} from '../tests/integration/IX01/current-schema-baseline.ts';
import type {
 NegativeLinuxDockerBinding,NegativeLinuxDockerCommandResult,NegativeLinuxDockerInvocation,NegativeLinuxDockerSystem,NegativeLinuxDockerToolHandoff,NegativeLinuxDockerToolPin,
} from './qa-ix01-0076-negative-linux-docker.ts';
import type {NegativeOwnedTarget} from './qa-ix01-0076-atomicity-negative.ts';

const dockerPath='/usr/bin/docker',maximumToolBytes=160*1024*1024,chunkBytes=1024*1024,maximumAttempts=256;
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f';
const containerFormat='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"user":{{json .Config.User}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"host":{{json .HostConfig}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}}}';
type CommandPhase='INFO'|'IMAGE'|'ABSENT'|'CREATE'|'CREATED_INSPECT'|'START'|'RUNNING_INSPECT'|'READY_WAIT'|'ROLE_PRISTINE'|'BOOTSTRAP'|'ROLE_INSTALLER'|'FINAL_INSPECT'|'COMPLETE';
export interface NegativeLinuxNativeDockerOwnerPorts{
 readonly recipient:object;readonly binding:Readonly<NegativeLinuxDockerBinding>;readonly materials:Readonly<NegativeLinuxNativeDockerMaterials>;
 assertCurrent(this:object,binding:Readonly<NegativeLinuxDockerBinding>):void;wall(this:object):number;monotonic(this:object):number;
}
export interface NegativeLinuxNativeDockerMaterials{readonly roleSql:string;readonly bootstrapSql:string;readonly finalServerRaw:'postgres\n';readonly priorSql:readonly Readonly<{id:string;path:string;bytes:Uint8Array}>[]}
export interface NegativeLinuxNativeDockerFileStat{
 readonly path:string;readonly realpath:string;readonly kind:'FILE';readonly dev:number;readonly ino:number;readonly uid:number;readonly gid:number;readonly mode:number;
 readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number;
}
/** spawnPinned는 동일 open handle의 실행을 입증하는 future Linux entry만 공급한다. 단순 pathname spawn은 이 계약을 충족하지 않는다. */
export interface NegativeLinuxNativeDockerSystem{
 readonly recipient:object;open(this:object,path:string):object;stat(this:object,handle:object):Readonly<NegativeLinuxNativeDockerFileStat>;
 read(this:object,handle:object,offset:number,length:number):Uint8Array;
 spawnPinned(this:object,handle:object,invocation:Readonly<NegativeLinuxDockerInvocation>):unknown;
 terminate(this:object,child:object,signal:'SIGKILL'):unknown;setTimeout(this:object,callback:()=>void,ms:number):unknown;clearTimeout(this:object,handle:unknown):void;
 close(this:object,handle:object):'CLOSED'|'UNKNOWN';
}
export interface NegativeLinuxNativeDockerSameFdSource{
 readonly recipient:object;
 open(this:object,path:string):object;stat(this:object,handle:object):Readonly<NegativeLinuxNativeDockerFileStat>;read(this:object,handle:object,offset:number,length:number):Uint8Array;
 spawn(this:object,file:'/proc/self/fd/3',args:readonly string[],options:Readonly<{argv0:'/usr/bin/docker';cwd:'/';env:Readonly<Record<string,string>>;shell:false;detached:false;stdio:readonly ['pipe','pipe','pipe',object]}>):unknown;
 childExecutable(this:object,child:object):Readonly<{dev:number;ino:number}>;terminate(this:object,child:object,signal:'SIGKILL'):unknown;
 setTimeout(this:object,callback:()=>void,ms:number):unknown;clearTimeout(this:object,handle:unknown):void;close(this:object,handle:object):'CLOSED'|'UNKNOWN';
}
export type NegativeLinuxNativeDockerOwnerCapability=object;

interface Binding{owner:NegativeLinuxNativeDockerOwnerPorts;recipient:object;binding:Readonly<NegativeLinuxDockerBinding>;materials:Readonly<NegativeLinuxNativeDockerMaterials>;prior:readonly Readonly<CurrentSchemaExecutionBaseline>[];current:NegativeLinuxNativeDockerOwnerPorts['assertCurrent'];wall:NegativeLinuxNativeDockerOwnerPorts['wall'];monotonic:NegativeLinuxNativeDockerOwnerPorts['monotonic'];created:boolean;startWall:number;startMonotonic:number;lastWall:number;lastMonotonic:number}
interface FileState{system:NegativeLinuxNativeDockerSystem;recipient:object;handle:object;stat:Readonly<NegativeLinuxNativeDockerFileStat>;pin:Readonly<NegativeLinuxDockerToolPin>|null;active:boolean;poisoned:boolean;transferred:boolean;phase:CommandPhase;containerId:string|null;finalServerAttempts:number;finalServerObserved:boolean;closeStarted:boolean;closeStatus:'OPEN'|'CLOSED'|'UNKNOWN'}
interface NativeSystemState{bound:Binding;system:Readonly<NegativeLinuxDockerSystem>;state():FileState|null;handoff:Readonly<NegativeLinuxDockerToolHandoff>|null}
type SqlOperation='INSTALL_PRIOR'|'APPEND_LEDGER'|'CREATE_SENTINEL'|'READ_CATALOG'|'NEGATIVE_0076';
interface TransferredState{bound:Binding;state:FileState;target:Readonly<NegativeOwnedTarget>;sqlCreated:boolean;sqlBlocked:boolean;installed:number;ledgered:number;pending:Readonly<CurrentSchemaExecutionBaseline>|null;catalogs:number;sentinel:boolean;negative:boolean}
export type NegativeLinuxNativeDockerTransferredOwner=object;
export type NegativeLinuxNativeDockerProtectedPriorCapability=object;
export interface NegativeLinuxNativeDockerProtectedSource{readonly id:string;readonly path:string;readonly bytes:Uint8Array}
export interface NegativeLinuxNativeDockerSqlRequest{
 readonly operation:SqlOperation;readonly argv:readonly string[];readonly stdin:Uint8Array;readonly timeoutMs:number;readonly outputLimitBytes:number;
 readonly row:Readonly<CurrentSchemaExecutionBaseline>|null;
}
export interface NegativeLinuxNativeDockerSqlResult{
 readonly status:number|null;readonly signal:string|null;readonly closed:boolean;readonly stdout:Uint8Array;readonly stderr:Uint8Array;
}
export interface NegativeLinuxNativeDockerSqlPorts{
 readonly recipient:object;readonly deadline:Readonly<{wallExpiresAt:number;monotonicExpiresAt:number}>;
 now(this:object):number;monotonic(this:object):number;assertCurrent(this:object,target:Readonly<NegativeOwnedTarget>):void;
 schedule(this:object,callback:()=>void,timeoutMs:number):()=>void;
 run(this:object,request:Readonly<NegativeLinuxNativeDockerSqlRequest>,signal:AbortSignal):Promise<Readonly<NegativeLinuxNativeDockerSqlResult>>;
 close(this:object):Promise<'CLOSED'|'UNKNOWN'>;
}
const capabilities=new WeakMap<object,Binding>(),protectedPriors=new WeakMap<object,readonly Readonly<CurrentSchemaExecutionBaseline>[]>(),issuedAttempts=new Set<string>(),pins=new WeakMap<object,FileState>(),nativeSystems=new WeakMap<object,NativeSystemState>(),nativeHandoffs=new WeakMap<object,NativeSystemState>(),transferredOwners=new WeakMap<object,TransferredState>(),retainedFiles=new Set<FileState>(),retainedChildren=new Set<object>(),retainedNativeDockerFds=new Set<number>();
const on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_NATIVE_DOCKER_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(d).length===keys.length&&keys.every(key=>!!d[key]?.enumerable&&Object.hasOwn(d[key]!,'value'));
}
function bindingShape(raw:Readonly<NegativeLinuxDockerBinding>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','approvalId','graphHash','issuedAt','expiresAt','namespace'])||!Object.isFrozen(raw)
  ||raw.schemaVersion!==1||raw.purpose!=='IX01_0076_NEGATIVE_LINUX_DOCKER_BINDING'||!uuidV1(raw.attemptId)||!uuidV1(raw.approvalId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.approvalHash,raw.graphHash].every(hashV1)||!Number.isSafeInteger(raw.issuedAt)||!Number.isSafeInteger(raw.expiresAt)||raw.issuedAt>=raw.expiresAt||raw.expiresAt-raw.issuedAt>1_800_000
  ||!exact(raw.namespace,['container','database','receipt','network'])||!Object.isFrozen(raw.namespace))invalid();
 const compact=raw.attemptId.replaceAll('-','');
 if(raw.namespace.container!=='anvil-ix01-0076-negative-'+compact||raw.namespace.database!=='ix01_0076_negative_'+compact
  ||raw.namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+raw.attemptId||raw.namespace.network!=='none')invalid();return raw;
}
function ownerShape(raw:NegativeLinuxNativeDockerOwnerPorts){
 const keys=['recipient','binding','materials','assertCurrent','wall','monotonic'];if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object,materials=d.materials!.value as Readonly<NegativeLinuxNativeDockerMaterials>;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||keys.slice(3).some(key=>typeof d[key]!.value!=='function'))invalid();
 if(!exact(materials,['roleSql','bootstrapSql','finalServerRaw','priorSql'])||!Object.isFrozen(materials)||typeof materials.roleSql!=='string'||Buffer.byteLength(materials.roleSql)<1||Buffer.byteLength(materials.roleSql)>65_536
  ||typeof materials.bootstrapSql!=='string'||Buffer.byteLength(materials.bootstrapSql)<1||Buffer.byteLength(materials.bootstrapSql)>2_097_152||materials.finalServerRaw!=='postgres\n')invalid();
 if(!Array.isArray(materials.priorSql)||!Object.isFrozen(materials.priorSql)||materials.priorSql.length!==106)invalid();let provider=0;const seen=new Set<string>();const prior=Object.freeze(materials.priorSql.map(raw=>{
  if(!exact(raw,['id','path','bytes'])||!Object.isFrozen(raw)||typeof raw.id!=='string'||!/^[0-9]{4}_[a-z0-9_]{1,100}$/.test(raw.id)||typeof raw.path!=='string'||!/^db\/migrations\/[0-9]{4}_[a-z0-9_]+\.sql(?:\.pending)?$/.test(raw.path)
   ||seen.has(raw.path)||types.isProxy(raw.bytes)||!types.isUint8Array(raw.bytes)||types.isSharedArrayBuffer(raw.bytes.buffer)||raw.bytes.byteLength<1)invalid();seen.add(raw.path);const sha256=contentHash(raw.bytes);
  if(raw.path==='db/migrations/0037_provider_session_claims.sql.pending'){provider++;if(sha256!=='eb4cc66e8d682f08225823e39bae5ad40f7af62b529d3774291e855f34536097')invalid();}
  return Object.freeze({id:raw.id,path:raw.path,sha256,bytes:raw.bytes.byteLength});
 }));if(provider!==1)invalid();
 return{recipient,binding:bindingShape(d.binding!.value as Readonly<NegativeLinuxDockerBinding>),materials,prior,current:d.assertCurrent!.value as NegativeLinuxNativeDockerOwnerPorts['assertCurrent'],wall:d.wall!.value as NegativeLinuxNativeDockerOwnerPorts['wall'],monotonic:d.monotonic!.value as NegativeLinuxNativeDockerOwnerPorts['monotonic']};
}
function systemShape(raw:NegativeLinuxNativeDockerSystem){
 const keys=['recipient','open','stat','read','spawnPinned','terminate','setTimeout','clearTimeout','close'];if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||keys.slice(1).some(key=>typeof d[key]!.value!=='function'))invalid();return{recipient};
}
function statShape(raw:Readonly<NegativeLinuxNativeDockerFileStat>){
 if(!exact(raw,['path','realpath','kind','dev','ino','uid','gid','mode','nlink','size','mtimeMs','ctimeMs'])||!Object.isFrozen(raw)||raw.path!==dockerPath||raw.realpath!==dockerPath||raw.kind!=='FILE'
  ||raw.uid!==0||raw.gid!==0||(raw.mode&0o170000)!==0o100000||(raw.mode&0o7777)!==0o755||raw.nlink!==1||![raw.dev,raw.ino,raw.mode,raw.nlink,raw.size].every(Number.isSafeInteger)
  ||raw.size<1||raw.size>maximumToolBytes||![raw.mtimeMs,raw.ctimeMs].every(Number.isFinite))invalid();return raw;
}
function sameStat(a:Readonly<NegativeLinuxNativeDockerFileStat>,b:Readonly<NegativeLinuxNativeDockerFileStat>){return a.path===b.path&&a.realpath===b.realpath&&a.kind===b.kind&&a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.gid===b.gid&&a.mode===b.mode&&a.nlink===b.nlink&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;}
function current(bound:Binding){
 if(bound.owner.recipient!==bound.recipient||bound.owner.binding!==bound.binding||bound.owner.materials!==bound.materials||bound.owner.assertCurrent!==bound.current||bound.owner.wall!==bound.wall||bound.owner.monotonic!==bound.monotonic||bound.current.call(bound.recipient,bound.binding)!==undefined)invalid();
 const wall=bound.wall.call(bound.recipient),monotonic=bound.monotonic.call(bound.recipient),duration=bound.binding.expiresAt-bound.startWall;
 if(!Number.isSafeInteger(wall)||!Number.isFinite(monotonic)||wall<bound.lastWall||monotonic<bound.lastMonotonic||wall>=bound.binding.expiresAt||monotonic-bound.startMonotonic>=duration)invalid();bound.lastWall=wall;bound.lastMonotonic=monotonic;
}
function systemCurrent(bound:Binding,state:FileState){
 current(bound);if(state.poisoned||state.closeStatus!=='OPEN'||state.system.recipient!==state.recipient)invalid();const found=statShape(state.system.stat.call(state.recipient,state.handle));if(!sameStat(found,state.stat))invalid();current(bound);
}
function targetShape(bound:Binding,state:FileState,target:Readonly<NegativeOwnedTarget>){
 if(!exact(target,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId'])||!Object.isFrozen(target)||target.schemaVersion!==1||target.purpose!=='IX01_0076_NEGATIVE_OWNED_TARGET'
  ||target.attemptId!==bound.binding.attemptId||target.sourceHead!==bound.binding.sourceHead||target.planHash!==bound.binding.planHash||target.graphHash!==bound.binding.graphHash||target.namespace!==bound.binding.namespace||target.containerId!==state.containerId)invalid();
}
function transferred(owner:NegativeLinuxNativeDockerTransferredOwner):TransferredState{return transferredOwners.get(owner)??invalid();}
/** 고정 historical TSV와 전체 130개 원 SQL을 검산한 동일 process 전용 first106 capability다. 실행 권위를 발급하지 않는다. */
export function bind0076NegativeLinuxNativeDockerProtectedPrior(historicalTsv:Uint8Array,orderedSql:readonly Readonly<NegativeLinuxNativeDockerProtectedSource>[]):NegativeLinuxNativeDockerProtectedPriorCapability{
 const verified=verifyCurrentSchemaSources(historicalTsv,orderedSql);if(verified.length!==130||verified[106]?.id!==current0076NegativeContract.sourceId)invalid();
 const capability=Object.freeze(Object.create(null)) as object;protectedPriors.set(capability,Object.freeze(verified.slice(0,106)));return capability;
}
function unknown():Readonly<NegativeLinuxDockerCommandResult>{return Object.freeze({status:null,signal:null,closed:false,stdout:'',stderr:''});}
function closeFile(state:FileState){
 if(state.closeStarted)return state.closeStatus==='CLOSED'?'CLOSED' as const:'UNKNOWN' as const;state.closeStarted=true;
 try{state.closeStatus=state.system.close.call(state.recipient,state.handle)==='CLOSED'?'CLOSED':'UNKNOWN';}catch{state.closeStatus='UNKNOWN';}
 if(state.closeStatus==='CLOSED')retainedFiles.delete(state);return state.closeStatus==='CLOSED'?'CLOSED' as const:'UNKNOWN' as const;
}
function emitter(value:unknown):value is EventEmitter{return !!value&&typeof value==='object'&&!types.isProxy(value)&&value instanceof EventEmitter;}
function retainChild(child:EventEmitter,raw:readonly unknown[]){
 const streams=[child,...raw.filter(emitter)].filter((value,index,all)=>all.indexOf(value)===index),sink=()=>{};
 const release=()=>{retainedChildren.delete(child);for(const stream of streams)try{off.call(stream,'error',sink);}catch{}try{off.call(child,'close',release);}catch{}};
 retainedChildren.add(child);for(const stream of streams)on.call(stream,'error',sink);on.call(child,'close',release);
}
function retainUnknownChild(child:object,raw:readonly unknown[]){if(emitter(child))retainChild(child,raw);else retainedChildren.add(child);}
function ownChildStreams(child:object){const descriptors=Object.getOwnPropertyDescriptors(child);return['stdin','stdout','stderr'].map(key=>descriptors[key]).filter(row=>row!==undefined&&Object.hasOwn(row,'value')).map(row=>row!.value as unknown);}
function sameArgs(found:readonly string[],expected:readonly string[]){return found.length===expected.length&&found.every((value,index)=>value===expected[index]);}
function psqlArgs(binding:Readonly<NegativeLinuxDockerBinding>,containerId:string){return['exec','-i','--user','999:999',containerId,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username=anvil_v3_bootstrap','--dbname='+binding.namespace.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'];}
function invocationShape(raw:Readonly<NegativeLinuxDockerInvocation>,bound:Binding,state:FileState){
 const binding=bound.binding;
 if(!exact(raw,['file','argv','cwd','env','input','timeoutMs','stdoutLimit','stderrLimit'])||!Object.isFrozen(raw)||raw.file!==dockerPath||raw.cwd!=='/'||!Object.isFrozen(raw.argv)||!Object.isFrozen(raw.env)
  ||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>30_000||raw.stdoutLimit!==65_536||raw.stderrLimit!==65_536||raw.argv.length<5||raw.argv.length>256
  ||raw.argv[0]!=='--config'||raw.argv[1]!==binding.namespace.receipt+'/docker-config'||raw.argv[2]!=='--host'||raw.argv[3]!=='unix:///var/run/docker.sock'
  ||raw.argv.some(value=>typeof value!=='string'||Buffer.byteLength(value)>4096||value.includes('\0')||value.includes('\n'))
  ||!exact(raw.env,['PATH','LANG','LC_ALL','HOME'])||raw.env.PATH!=='/usr/bin:/bin'||raw.env.LANG!=='C.UTF-8'||raw.env.LC_ALL!=='C.UTF-8'||raw.env.HOME!==binding.namespace.receipt
  ||raw.input!==null&&(typeof raw.input!=='string'||Buffer.byteLength(raw.input)>2_097_152))return false;
 const args=raw.argv.slice(4),compact=binding.attemptId.replaceAll('-',''),inspect=['container','inspect','--format',containerFormat,state.containerId??''];
 if(state.phase==='INFO')return raw.input===null&&sameArgs(args,['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);
 if(state.phase==='IMAGE')return raw.input===null&&sameArgs(args,['image','inspect','--format','{"id":{{json .Id}},"volumes":{{json .Config.Volumes}}}',image]);
 if(state.phase==='ABSENT')return raw.input===null&&sameArgs(args,['container','ls','-a','--filter','name=^/'+binding.namespace.container+'$','--format','{{.ID}}']);
 if(state.phase==='CREATE')return raw.input===null&&sameArgs(args,['create','--pull','never','--name',binding.namespace.container,'--network','none','--user','999:999','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--log-driver','none','--pids-limit','64','--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456,uid=999,gid=999','--tmpfs','/var/run/postgresql:rw,noexec,nosuid,size=16777216,uid=999,gid=999','--tmpfs','/tmp:rw,noexec,nosuid,size=16777216,uid=999,gid=999','--label','anvil.owner=IX01_0076_NEGATIVE','--label','anvil.instance='+compact,'--label','anvil.plan='+binding.planHash,'--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+binding.namespace.database,'--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=reject',image,'postgres','-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=fatal']);
 if(state.containerId===null)return false;
 if(state.phase==='CREATED_INSPECT'||state.phase==='RUNNING_INSPECT'||state.phase==='FINAL_INSPECT')return raw.input===null&&sameArgs(args,inspect);
 if(state.phase==='START')return raw.input===null&&sameArgs(args,['start',state.containerId]);
 if(state.phase==='READY_WAIT')return raw.input===null&&(
  state.finalServerAttempts<40&&sameArgs(args,['exec','--user','999:999',state.containerId,'cat','/proc/1/comm'])
  ||state.finalServerObserved&&sameArgs(args,['exec','--user','999:999',state.containerId,'pg_isready','--host=/var/run/postgresql','--username=anvil_v3_bootstrap','--dbname='+binding.namespace.database]));
 if(state.phase==='ROLE_PRISTINE'||state.phase==='ROLE_INSTALLER')return raw.input===bound.materials.roleSql&&sameArgs(args,psqlArgs(binding,state.containerId));
 if(state.phase==='BOOTSTRAP')return raw.input===bound.materials.bootstrapSql&&sameArgs(args,psqlArgs(binding,state.containerId));
 return false;
}
function advance(bound:Binding,state:FileState,raw:Readonly<NegativeLinuxDockerInvocation>,stdout:string){
 if(state.phase==='INFO')state.phase='IMAGE';else if(state.phase==='IMAGE')state.phase='ABSENT';else if(state.phase==='ABSENT')state.phase='CREATE';
 else if(state.phase==='CREATE'){const id=stdout.trim();if(!hashV1(id))invalid();state.containerId=id;state.phase='CREATED_INSPECT';}
 else if(state.phase==='CREATED_INSPECT')state.phase='START';else if(state.phase==='START')state.phase='RUNNING_INSPECT';else if(state.phase==='RUNNING_INSPECT')state.phase='READY_WAIT';
 else if(state.phase==='READY_WAIT'&&raw.argv.includes('/proc/1/comm')){state.finalServerAttempts++;if(stdout===bound.materials.finalServerRaw)state.finalServerObserved=true;}
 else if(state.phase==='READY_WAIT'&&raw.argv.includes('pg_isready'))state.phase='ROLE_PRISTINE';else if(state.phase==='ROLE_PRISTINE')state.phase='BOOTSTRAP';else if(state.phase==='BOOTSTRAP')state.phase='ROLE_INSTALLER';else if(state.phase==='ROLE_INSTALLER')state.phase='FINAL_INSPECT';else if(state.phase==='FINAL_INSPECT')state.phase='COMPLETE';
}

/** 원 보호 entry closure를 process-local capability로 한 번 결박한다. 승인·target·실행 권위를 새로 발급하지 않는다. */
export function bind0076NegativeLinuxNativeDockerOwner(rawOwner:NegativeLinuxNativeDockerOwnerPorts):NegativeLinuxNativeDockerOwnerCapability{
 const owner=ownerShape(rawOwner),startWall=owner.wall.call(owner.recipient),startMonotonic=owner.monotonic.call(owner.recipient);
 if(issuedAttempts.size>=maximumAttempts||issuedAttempts.has(owner.binding.attemptId)||!Number.isSafeInteger(startWall)||!Number.isFinite(startMonotonic)||startMonotonic<0||startWall<owner.binding.issuedAt||startWall>=owner.binding.expiresAt||owner.current.call(owner.recipient,owner.binding)!==undefined)invalid();
 const capability=Object.freeze(Object.create(null)) as object;issuedAttempts.add(owner.binding.attemptId);capabilities.set(capability,{owner:rawOwner,recipient:owner.recipient,binding:owner.binding,materials:owner.materials,prior:owner.prior,current:owner.current,wall:owner.wall,monotonic:owner.monotonic,created:false,startWall,startMonotonic,lastWall:startWall,lastMonotonic:startMonotonic});return capability;
}

/** 실제 system의 spawnPinned가 same open FD 실행을 증명하지 못하면 run은 fail-closed다. 현재 entry/approval graph에는 아직 연결하지 않는다. */
export function create0076NegativeLinuxNativeDocker(capability:NegativeLinuxNativeDockerOwnerCapability,rawSystem:NegativeLinuxNativeDockerSystem):Readonly<NegativeLinuxDockerSystem>{
 const foundBinding=capabilities.get(capability),system=systemShape(rawSystem);if(foundBinding===undefined)return invalid();if(foundBinding.created)return invalid();const bound:Binding=foundBinding;bound.created=true;current(bound);let pinStarted=false,state:FileState|null=null;
 const unchanged=()=>rawSystem.recipient===system.recipient;
 const pin:NegativeLinuxDockerSystem['pin']=async function(path){
  if(this!==system.recipient||path!==dockerPath||pinStarted||!unchanged())invalid();pinStarted=true;current(bound);let local:FileState|null=null;
  try{
    const handle=rawSystem.open.call(system.recipient,path);if(!handle||typeof handle!=='object'||types.isProxy(handle))invalid();local={system:rawSystem,recipient:system.recipient,handle,stat:Object.freeze({}) as never,pin:null,active:false,poisoned:false,transferred:false,phase:'INFO',containerId:null,finalServerAttempts:0,finalServerObserved:false,closeStarted:false,closeStatus:'OPEN'};retainedFiles.add(local);current(bound);
   const first=statShape(rawSystem.stat.call(system.recipient,handle)),digest=createHash('sha256');let offset=0;
   while(offset<first.size){current(bound);const length=Math.min(chunkBytes,first.size-offset),bytes=rawSystem.read.call(system.recipient,handle,offset,length);if(types.isProxy(bytes)||!types.isUint8Array(bytes)||types.isSharedArrayBuffer(bytes.buffer)||bytes.byteLength!==length)invalid();digest.update(bytes);offset+=bytes.byteLength;}
   current(bound);const after=statShape(rawSystem.stat.call(system.recipient,handle));if(!sameStat(first,after))invalid();const custody=Object.freeze(Object.create(null)),found=Object.freeze({path:first.path,realpath:first.realpath,kind:first.kind,dev:first.dev,ino:first.ino,uid:first.uid,mode:first.mode,nlink:first.nlink,size:first.size,mtimeMs:first.mtimeMs,ctimeMs:first.ctimeMs,sha256:digest.digest('hex'),custody}) satisfies Readonly<NegativeLinuxDockerToolPin>;
   local.stat=first;local.pin=found;pins.set(found,local);state=local;return found;
  }catch(error){if(local!==null)closeFile(local);throw error;}
 };
  const pinCurrent:NegativeLinuxDockerSystem['current']=function(found){if(this!==system.recipient||!unchanged())invalid();const foundState=pins.get(found);if(foundState===undefined)return invalid();const local:FileState=foundState;if(local!==state||local.pin!==found||local.transferred)invalid();systemCurrent(bound,local);};
 const run:NegativeLinuxDockerSystem['run']=async function(found,raw){
   if(this!==system.recipient||!unchanged())return unknown();const local=pins.get(found);if(local===undefined||local!==state||local.pin!==found||local.active||local.poisoned||local.transferred||!invocationShape(raw,bound,local))return unknown();
  try{systemCurrent(bound,local);}catch{return unknown();}let expired=false,timer:unknown,timerSet=false,spawnStarted=false,timeoutEffect=()=>{expired=true;},child:EventEmitter,input:EventEmitter&{end(value?:Uint8Array):void},stdout:EventEmitter,stderr:EventEmitter;
  try{timer=rawSystem.setTimeout.call(system.recipient,()=>timeoutEffect(),raw.timeoutMs);timerSet=true;systemCurrent(bound,local);if(expired){rawSystem.clearTimeout.call(system.recipient,timer);return unknown();}
   spawnStarted=true;const created=rawSystem.spawnPinned.call(system.recipient,local.handle,raw);if(!emitter(created))throw Error('IX01_0076_NEGATIVE_LINUX_NATIVE_DOCKER_INVALID');const stdinValue=Object.getOwnPropertyDescriptor(created,'stdin')?.value,stdoutValue=Object.getOwnPropertyDescriptor(created,'stdout')?.value,stderrValue=Object.getOwnPropertyDescriptor(created,'stderr')?.value;
   if(!emitter(stdinValue)||!emitter(stdoutValue)||!emitter(stderrValue)||stdinValue===stdoutValue||stdinValue===stderrValue||stdoutValue===stderrValue||typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(stdinValue),'end')?.value!=='function'&&typeof Object.getOwnPropertyDescriptor(stdinValue,'end')?.value!=='function'){
    local.poisoned=true;retainChild(created,[stdinValue,stdoutValue,stderrValue]);try{rawSystem.terminate.call(system.recipient,created,'SIGKILL');}catch{}if(timerSet)try{rawSystem.clearTimeout.call(system.recipient,timer);}catch{}return unknown();}
   child=created;input=stdinValue as EventEmitter&{end(value?:Uint8Array):void};stdout=stdoutValue;stderr=stderrValue;retainedChildren.add(child);local.active=true;
  }catch{if(spawnStarted)local.poisoned=true;if(timerSet)try{rawSystem.clearTimeout.call(system.recipient,timer);}catch{}return unknown();}
  return await new Promise<Readonly<NegativeLinuxDockerCommandResult>>(resolve=>{
   let settled=false,closed=false,stopped=false,inputFinished=false,stdoutEnded=false,stderrEnded=false,exitSeen=false,exitStatus:unknown,exitSignal:unknown;const out:Uint8Array[]=[],err:Uint8Array[]=[],listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
   const listen=(target:EventEmitter,event:string,fn:(...args:any[])=>void)=>{listeners.push({target,event,fn});on.call(target,event,fn);};
   const detach=()=>{for(const row of listeners)try{off.call(row.target,row.event,row.fn);}catch{}listeners.length=0;if(timerSet)try{rawSystem.clearTimeout.call(system.recipient,timer);}catch{}};
   const wipe=()=>{for(const row of [...out,...err])row.fill(0);out.length=0;err.length=0;};
   const finishUnknown=(stop:boolean)=>{if(settled)return;settled=true;local.poisoned=true;if(closed)local.active=false;if(stop&&!stopped&&!closed){stopped=true;try{rawSystem.terminate.call(system.recipient,child,'SIGKILL');}catch{}}detach();wipe();if(!closed)retainChild(child,[input,stdout,stderr]);resolve(unknown());};
   const collect=(sink:Uint8Array[],limit:number,ended:()=>boolean)=>(value:unknown)=>{if(settled)return;if(ended()||types.isProxy(value)||!types.isUint8Array(value)||types.isSharedArrayBuffer(value.buffer)){finishUnknown(true);return;}const part=new Uint8Array(value),total=sink.reduce((sum,row)=>sum+row.byteLength,0)+part.byteLength;if(total>limit){part.fill(0);finishUnknown(true);return;}sink.push(part);};
   listen(input,'finish',()=>{if(inputFinished){finishUnknown(true);return;}inputFinished=true;});listen(input,'error',()=>finishUnknown(true));listen(stdout,'data',collect(out,raw.stdoutLimit,()=>stdoutEnded));listen(stderr,'data',collect(err,raw.stderrLimit,()=>stderrEnded));
   listen(stdout,'end',()=>{if(stdoutEnded){finishUnknown(true);return;}stdoutEnded=true;});listen(stderr,'end',()=>{if(stderrEnded){finishUnknown(true);return;}stderrEnded=true;});listen(stdout,'error',()=>finishUnknown(true));listen(stderr,'error',()=>finishUnknown(true));listen(child,'error',()=>finishUnknown(false));
   listen(child,'exit',(status:unknown,signal:unknown)=>{if(exitSeen){finishUnknown(false);return;}exitSeen=true;exitStatus=status;exitSignal=signal;});
   listen(child,'close',(status:unknown,signal:unknown)=>{closed=true;retainedChildren.delete(child);if(settled)return;let currentOk=true;try{systemCurrent(bound,local);}catch{currentOk=false;}
    if(!currentOk||expired||!inputFinished||!stdoutEnded||!stderrEnded||!exitSeen||status!==exitStatus||signal!==exitSignal||!(status===null||Number.isSafeInteger(status))||!(signal===null||typeof signal==='string')){finishUnknown(false);return;}
    try{const decoder=new TextDecoder('utf-8',{fatal:true}),stdoutText=decoder.decode(Buffer.concat(out.map(value=>Buffer.from(value)))),stderrText=decoder.decode(Buffer.concat(err.map(value=>Buffer.from(value))));if(status===0&&signal===null)advance(bound,local,raw,stdoutText);settled=true;local.active=false;if(status!==0||signal!==null)local.poisoned=true;detach();wipe();resolve(Object.freeze({status:status as number|null,signal:signal as string|null,closed:true,stdout:stdoutText,stderr:stderrText}));}catch{finishUnknown(false);}
   });
   try{timeoutEffect=()=>finishUnknown(true);systemCurrent(bound,local);if(expired){finishUnknown(true);return;}input.end(raw.input===null?undefined:new Uint8Array(Buffer.from(raw.input,'utf8')));}catch{finishUnknown(true);}
  });
 };
  const wait:NegativeLinuxDockerSystem['wait']=async function(timeoutMs){if(this!==system.recipient||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10_000||state===null)return invalid();const local:FileState=state;if(local.transferred)invalid();systemCurrent(bound,local);await new Promise<void>((resolve,reject)=>{let handle:unknown;try{handle=rawSystem.setTimeout.call(system.recipient,()=>{try{systemCurrent(bound,local);resolve();}catch(error){reject(error);}},timeoutMs);}catch(error){reject(error);return;}void handle;});};
  const release:NegativeLinuxDockerSystem['release']=async function(found){if(this!==system.recipient||!unchanged())invalid();const local=pins.get(found);if(local===undefined||local!==state||local.pin!==found||local.transferred)return 'UNKNOWN';if(local.active){local.poisoned=true;return 'UNKNOWN';}return closeFile(local);};
  const ports=Object.freeze({recipient:system.recipient,pin,current:pinCurrent,run,wait,release});nativeSystems.set(ports,{bound,system:ports,state:()=>state,handoff:null});return ports;
}

/** 기존 prepare와 분리된 보호 호출용이다. 같은 native state의 COMPLETE pin만 opaque owner로 한 번 이전한다. */
export function create0076NegativeLinuxNativeDockerForTransfer(capability:NegativeLinuxNativeDockerOwnerCapability,rawSystem:NegativeLinuxNativeDockerSystem):Readonly<{system:Readonly<NegativeLinuxDockerSystem>;handoff:Readonly<NegativeLinuxDockerToolHandoff>} >{
 const ports=create0076NegativeLinuxNativeDocker(capability,rawSystem),owned=nativeSystems.get(ports)??invalid(),recipient=ports.recipient;
 const handoff=Object.freeze({recipient,transfer(this:object,found:Readonly<NegativeLinuxDockerToolPin>,target:Readonly<NegativeOwnedTarget>){
  if(this!==recipient)invalid();const local=owned.state()??invalid();if(local.pin!==found||local.active||local.poisoned||local.transferred||local.phase!=='COMPLETE'||local.closeStatus!=='OPEN')invalid();
  systemCurrent(owned.bound,local);targetShape(owned.bound,local,target);const owner=Object.freeze(Object.create(null)) as object;
   transferredOwners.set(owner,{bound:owned.bound,state:local,target,sqlCreated:false,sqlBlocked:false,installed:0,ledgered:0,pending:null,catalogs:0,sentinel:false,negative:false});local.transferred=true;return owner;
 }});owned.handoff=handoff;nativeHandoffs.set(handoff,owned);return Object.freeze({system:ports,handoff});
}

/**
 * 보호 entry가 선택한 비직렬 source만 고정 `/proc/self/fd/3` 실행으로 좁힌다.
 * 이 adapter 자체는 native source를 생성하거나 PROTECTED_NATIVE 기본 경로를 열지 않는다.
 */
function create0076NegativeLinuxNativeDockerSameFdSystem(rawSource:NegativeLinuxNativeDockerSameFdSource):NegativeLinuxNativeDockerSystem{
 const keys=['recipient','open','stat','read','spawn','childExecutable','terminate','setTimeout','clearTimeout','close'];
 if(!exact(rawSource,keys)||!Object.isFrozen(rawSource))invalid();const descriptors=Object.getOwnPropertyDescriptors(rawSource),sourceRecipient=descriptors.recipient!.value as object;
 if(!sourceRecipient||typeof sourceRecipient!=='object'||types.isProxy(sourceRecipient)||!Object.isFrozen(sourceRecipient)||keys.slice(1).some(key=>typeof descriptors[key]!.value!=='function'))invalid();
 const open=descriptors.open!.value as NegativeLinuxNativeDockerSameFdSource['open'],stat=descriptors.stat!.value as NegativeLinuxNativeDockerSameFdSource['stat'],read=descriptors.read!.value as NegativeLinuxNativeDockerSameFdSource['read'];
 const spawn=descriptors.spawn!.value as NegativeLinuxNativeDockerSameFdSource['spawn'],childExecutable=descriptors.childExecutable!.value as NegativeLinuxNativeDockerSameFdSource['childExecutable'];
 const terminate=descriptors.terminate!.value as NegativeLinuxNativeDockerSameFdSource['terminate'],setTimer=descriptors.setTimeout!.value as NegativeLinuxNativeDockerSameFdSource['setTimeout'];
 const clearTimer=descriptors.clearTimeout!.value as NegativeLinuxNativeDockerSameFdSource['clearTimeout'],close=descriptors.close!.value as NegativeLinuxNativeDockerSameFdSource['close'];
 const recipient=Object.freeze(Object.create(null)),handles=new WeakSet<object>(),children=new WeakMap<object,object>(),stopped=new WeakSet<object>();
 const unchanged=()=>rawSource.recipient===sourceRecipient&&rawSource.open===open&&rawSource.stat===stat&&rawSource.read===read&&rawSource.spawn===spawn&&rawSource.childExecutable===childExecutable&&rawSource.terminate===terminate&&rawSource.setTimeout===setTimer&&rawSource.clearTimeout===clearTimer&&rawSource.close===close;
 const owned=(handle:object)=>{if(!handles.has(handle)||!unchanged())invalid();return handle;};
 const stop=(child:object)=>{if(stopped.has(child))return;stopped.add(child);try{terminate.call(sourceRecipient,child,'SIGKILL');}catch{}};
 return Object.freeze({
  recipient,
  open(this:object,path:string){if(this!==recipient||path!==dockerPath||!unchanged())invalid();const handle=open.call(sourceRecipient,path);if(!handle||typeof handle!=='object'||types.isProxy(handle)||handles.has(handle))invalid();handles.add(handle);return handle;},
  stat(this:object,handle:object){if(this!==recipient)invalid();return stat.call(sourceRecipient,owned(handle));},
  read(this:object,handle:object,offset:number,length:number){if(this!==recipient)invalid();return read.call(sourceRecipient,owned(handle),offset,length);},
  spawnPinned(this:object,handle:object,invocation:Readonly<NegativeLinuxDockerInvocation>){
   if(this!==recipient)invalid();const found=owned(handle),before=statShape(stat.call(sourceRecipient,found));let child:unknown;
   try{
    const options=Object.freeze({argv0:dockerPath,cwd:'/' as const,env:invocation.env,shell:false as const,detached:false as const,stdio:Object.freeze(['pipe','pipe','pipe',found] as const)});
    child=spawn.call(sourceRecipient,'/proc/self/fd/3',invocation.argv,options);if(!child||typeof child!=='object'||types.isProxy(child))invalid();const childObject=child as object;
    const observed=childExecutable.call(sourceRecipient,childObject),after=statShape(stat.call(sourceRecipient,found));
    if(!exact(observed,['dev','ino'])||!Object.isFrozen(observed)||!Number.isSafeInteger(observed.dev)||!Number.isSafeInteger(observed.ino)||observed.dev!==before.dev||observed.ino!==before.ino||!sameStat(before,after))invalid();
    children.set(childObject,found);return childObject;
   }catch(error){if(child&&typeof child==='object'&&!types.isProxy(child)){const childObject=child as object;retainUnknownChild(childObject,ownChildStreams(childObject));stop(childObject);}throw error;}
  },
  terminate(this:object,child:object,signal:'SIGKILL'){if(this!==recipient||signal!=='SIGKILL'||!children.has(child)||!unchanged())invalid();stop(child);},
  setTimeout(this:object,callback:()=>void,ms:number){if(this!==recipient||!unchanged())invalid();return setTimer.call(sourceRecipient,callback,ms);},
  clearTimeout(this:object,handle:unknown){if(this!==recipient||!unchanged())invalid();clearTimer.call(sourceRecipient,handle);},
  close(this:object,handle:object){if(this!==recipient)invalid();const found=owned(handle),status=close.call(sourceRecipient,found);if(status==='CLOSED')handles.delete(found);return status==='CLOSED'?'CLOSED' as const:'UNKNOWN' as const;},
 });
}

/** raw same-FD system을 노출하지 않고 기존 owner/state-machine/transfer 경계에만 연결한다. */
export function create0076NegativeLinuxNativeDockerSameFdForTransfer(capability:NegativeLinuxNativeDockerOwnerCapability,rawSource:NegativeLinuxNativeDockerSameFdSource):Readonly<{system:Readonly<NegativeLinuxDockerSystem>;handoff:Readonly<NegativeLinuxDockerToolHandoff>} >{
 return create0076NegativeLinuxNativeDockerForTransfer(capability,create0076NegativeLinuxNativeDockerSameFdSystem(rawSource));
}

/** 다음 exact entry의 same-approval benign preflight와 원 intent가 같은 module 안에서 결박될 때만 선택할 private Node/Linux source다. */
function create0076NegativeLinuxNativeDockerNodeSource():NegativeLinuxNativeDockerSameFdSource{
 const recipient=Object.freeze(Object.create(null)),handles=new WeakMap<object,{fd:number;dev:number;ino:number}>(),children=new WeakSet<object>();
 const handle=(raw:object):{fd:number;dev:number;ino:number}=>{const found=handles.get(raw);if(found===undefined)return invalid();return found;};
 return Object.freeze({
  recipient,
  open(this:object,path:string){
   if(this!==recipient||path!==dockerPath)invalid();const before=lstatSync(path);if(!before.isFile()||before.uid!==0||before.gid!==0||(before.mode&0o7777)!==0o755||before.nlink!==1)invalid();let fd:number|undefined;
   try{fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);const after=fstatSync(fd),realpath=readlinkSync('/proc/self/fd/'+fd,'utf8');if(!after.isFile()||Number(after.dev)!==Number(before.dev)||Number(after.ino)!==Number(before.ino)||realpath!==dockerPath)invalid();const token=Object.freeze(Object.create(null));handles.set(token,{fd,dev:Number(after.dev),ino:Number(after.ino)});return token;}
   catch(error){if(fd!==undefined)try{closeSync(fd);}catch{retainedNativeDockerFds.add(fd);}throw error;}
  },
  stat(this:object,raw:object){
   if(this!==recipient)invalid();const found=handle(raw),value=fstatSync(found.fd),pathValue=lstatSync(dockerPath),realpath=readlinkSync('/proc/self/fd/'+found.fd,'utf8');
   if(!value.isFile()||!pathValue.isFile()||Number(value.dev)!==found.dev||Number(value.ino)!==found.ino||Number(pathValue.dev)!==found.dev||Number(pathValue.ino)!==found.ino||realpath!==dockerPath)invalid();
   return Object.freeze({path:dockerPath,realpath,kind:'FILE' as const,dev:Number(value.dev),ino:Number(value.ino),uid:value.uid,gid:value.gid,mode:value.mode,nlink:value.nlink,size:value.size,mtimeMs:value.mtimeMs,ctimeMs:value.ctimeMs});
  },
  read(this:object,raw:object,offset:number,length:number){if(this!==recipient||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>chunkBytes)invalid();const found=handle(raw),buffer=Buffer.allocUnsafe(length),readBytes=readSync(found.fd,buffer,0,length,offset);return new Uint8Array(buffer.subarray(0,readBytes));},
  spawn(this:object,file:'/proc/self/fd/3',args:readonly string[],options:Readonly<{argv0:'/usr/bin/docker';cwd:'/';env:Readonly<Record<string,string>>;shell:false;detached:false;stdio:readonly ['pipe','pipe','pipe',object]}>){
   if(this!==recipient||file!=='/proc/self/fd/3'||options.argv0!==dockerPath||options.cwd!=='/'||options.shell!==false||options.detached!==false||options.stdio.length!==4||options.stdio[0]!=='pipe'||options.stdio[1]!=='pipe'||options.stdio[2]!=='pipe')invalid();
   const found=handle(options.stdio[3]),child=spawnChild(file,[...args],{argv0:options.argv0,cwd:options.cwd,env:{...options.env},shell:false,detached:false,stdio:['pipe','pipe','pipe',found.fd],windowsHide:true});children.add(child);return child;
  },
  childExecutable(this:object,child:object){if(this!==recipient||!children.has(child))invalid();const pid=Object.getOwnPropertyDescriptor(child,'pid')?.value;if(!Number.isSafeInteger(pid)||pid<1)invalid();const value=statSync('/proc/'+pid+'/exe');if(!value.isFile())invalid();return Object.freeze({dev:Number(value.dev),ino:Number(value.ino)});},
  terminate(this:object,child:object,signal:'SIGKILL'){if(this!==recipient||signal!=='SIGKILL'||!children.has(child)||!emitter(child))invalid();const kill=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(child),'kill')?.value;if(typeof kill!=='function'||kill.call(child,signal)!==true)invalid();},
  setTimeout(this:object,callback:()=>void,ms:number){if(this!==recipient)return invalid();return globalThis.setTimeout(callback,ms);},
  clearTimeout(this:object,found:unknown){if(this!==recipient)return invalid();globalThis.clearTimeout(found as ReturnType<typeof setTimeout>);},
  close(this:object,raw:object){if(this!==recipient)invalid();const found=handle(raw);try{closeSync(found.fd);handles.delete(raw);return 'CLOSED' as const;}catch{retainedNativeDockerFds.add(found.fd);return 'UNKNOWN' as const;}},
 });
}

/** generic prepare가 임의 callback을 native handoff로 오인하지 않도록 process-local brand만 확인한다. */
export function is0076NegativeLinuxNativeDockerHandoff(system:Readonly<NegativeLinuxDockerSystem>,handoff:Readonly<NegativeLinuxDockerToolHandoff>):boolean{
 const found=nativeSystems.get(system);return found!==undefined&&found.handoff===handoff&&nativeHandoffs.get(handoff)===found;
}

export function is0076NegativeLinuxNativeDockerTransferredOwner(system:Readonly<NegativeLinuxDockerSystem>,handoff:Readonly<NegativeLinuxDockerToolHandoff>,owner:object,target:Readonly<NegativeOwnedTarget>):boolean{
 const foundSystem=nativeSystems.get(system),foundHandoff=nativeHandoffs.get(handoff),foundOwner=transferredOwners.get(owner);
 if(foundSystem===undefined||foundSystem!==foundHandoff||foundSystem.handoff!==handoff||foundOwner===undefined||foundOwner.bound!==foundSystem.bound||foundOwner.state!==foundSystem.state()||!foundOwner.state.transferred||foundOwner.target!==target)return false;
 try{systemCurrent(foundOwner.bound,foundOwner.state);return true;}catch{return false;}
}

/** raw FD를 노출하지 않고 같은 native module의 future SQL supplier가 재사용할 owner brand를 검산한다. */
export function assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent(owner:NegativeLinuxNativeDockerTransferredOwner,target:Readonly<NegativeOwnedTarget>):void{
 const found=transferred(owner);if(found.target!==target)invalid();targetShape(found.bound,found.state,target);systemCurrent(found.bound,found.state);
}

/** 만료 뒤에도 원 handle 회수를 허용하되, 다른 target·중복 close는 새 native close를 만들지 않는다. */
export async function close0076NegativeLinuxNativeDockerTransferredOwner(owner:NegativeLinuxNativeDockerTransferredOwner,target:Readonly<NegativeOwnedTarget>):Promise<'CLOSED'|'UNKNOWN'>{
 const found=transferred(owner);if(found.target!==target)invalid();targetShape(found.bound,found.state,target);if(found.state.active)return 'UNKNOWN';return closeFile(found.state);
}

function sqlRequest(raw:Readonly<NegativeLinuxNativeDockerSqlRequest>,found:TransferredState){
 if(!exact(raw,['operation','argv','stdin','timeoutMs','outputLimitBytes','row'])||!Object.isFrozen(raw)||!Object.isFrozen(raw.argv)||types.isProxy(raw.stdin)||!types.isUint8Array(raw.stdin)||types.isSharedArrayBuffer(raw.stdin.buffer)
  ||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>30_000||!Number.isSafeInteger(raw.outputLimitBytes)||raw.outputLimitBytes<1||raw.outputLimitBytes>1_048_576
  ||raw.stdin.byteLength<1||raw.stdin.byteLength>2_097_152||raw.argv.some(value=>typeof value!=='string'||value.includes('\0')||value.includes('\n')||Buffer.byteLength(value)>4096))invalid();
 const binding=found.bound.binding,state=found.state,base=['--config',binding.namespace.receipt+'/docker-config','--host','unix:///var/run/docker.sock','exec','-i','--user','999:999',state.containerId??'',
  'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username=anvil_v3_migrator','--dbname='+binding.namespace.database,
  '--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none'];
 const plain=[...base,'--file=-'],atomic=[...base,'--single-transaction','--file=-'];
 let expected=plain;
 if(raw.operation==='INSTALL_PRIOR'){
  const expectedRow=found.bound.prior[found.installed],candidate=raw.row;if(candidate===null||expectedRow===undefined||found.pending!==null||found.installed>=106)invalid();
  const row=candidate as Readonly<CurrentSchemaExecutionBaseline>,fixedExpected=expectedRow as Readonly<CurrentSchemaExecutionBaseline>;
  if(row.id!==fixedExpected.id||row.path!==fixedExpected.path||row.sha256!==fixedExpected.sha256||row.bytes!==fixedExpected.bytes)invalid();verifyCurrentSchemaExecutionDelivery(raw.stdin,row);
  if(row.path==='db/migrations/0037_provider_session_claims.sql.pending'){
   if(row.sha256!=='eb4cc66e8d682f08225823e39bae5ad40f7af62b529d3774291e855f34536097')invalid();expected=atomic;
  }
 }else if(raw.operation==='APPEND_LEDGER'){
  const candidate=raw.row,pending=found.pending;if(candidate===null||pending===null)invalid();const row=candidate as Readonly<CurrentSchemaExecutionBaseline>,fixedPending=pending as Readonly<CurrentSchemaExecutionBaseline>;if(row.id!==fixedPending.id||row.path!==fixedPending.path||row.sha256!==fixedPending.sha256||row.bytes!==fixedPending.bytes)invalid();
  const sql="INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');";if(Buffer.from(raw.stdin).toString('utf8')!==sql)invalid();
 }else if(raw.operation==='CREATE_SENTINEL'){
  if(raw.row!==null||found.installed!==106||found.ledgered!==106||found.pending!==null||found.catalogs!==1||found.sentinel||Buffer.from(raw.stdin).toString('utf8')!==current0076NegativeContract.sentinelSql)invalid();
 }else if(raw.operation==='READ_CATALOG'){
  if(raw.row!==null||found.installed!==106||found.ledgered!==106||found.pending!==null||found.catalogs>=3||found.catalogs===0&&found.sentinel||found.catalogs>0&&!found.sentinel
   ||found.catalogs===2&&!found.negative||Buffer.from(raw.stdin).toString('utf8')!==current0076NegativeContract.catalogSql)invalid();
 }else if(raw.operation==='NEGATIVE_0076'){
  if(raw.row!==null||found.installed!==106||found.ledgered!==106||!found.sentinel||found.catalogs!==2||found.negative||raw.stdin.byteLength!==current0076NegativeContract.sourceBytes||contentHash(raw.stdin)!==current0076NegativeContract.executionSha256)invalid();
 }else invalid();
 if(!sameArgs(raw.argv,expected))invalid();return new Uint8Array(raw.stdin);
}

/** transferred owner의 같은 원 handle로만 고정 migrator SQL child를 전달한다. 실제 read-only native system은 same-FD exec를 계속 거절한다. */
export function create0076NegativeLinuxNativeDockerSqlPorts(owner:NegativeLinuxNativeDockerTransferredOwner,target:Readonly<NegativeOwnedTarget>,failureParser:NegativeFailureParserCapability,protectedPrior:NegativeLinuxNativeDockerProtectedPriorCapability):Readonly<NegativeLinuxNativeDockerSqlPorts>{
 if(!failureParser||typeof failureParser!=='object'||types.isProxy(failureParser))invalid();
 const exactPrior=protectedPriors.get(protectedPrior);if(exactPrior===undefined)return invalid();
 const found=transferred(owner);if(found.target!==target||found.sqlCreated||exactPrior.length!==found.bound.prior.length||exactPrior.some((row,index)=>{const candidate=found.bound.prior[index];return candidate===undefined||row.id!==candidate.id||row.path!==candidate.path||row.sha256!==candidate.sha256||row.bytes!==candidate.bytes;}))invalid();
 targetShape(found.bound,found.state,target);systemCurrent(found.bound,found.state);found.sqlCreated=true;
 const recipient=Object.freeze(Object.create(null)),state=found.state,bound=found.bound,duration=bound.binding.expiresAt-bound.startWall;
 const deadline=Object.freeze({wallExpiresAt:bound.binding.expiresAt,monotonicExpiresAt:bound.startMonotonic+duration});
 const check=()=>{if(found.sqlBlocked)invalid();targetShape(bound,state,target);systemCurrent(bound,state);};
 const now=()=>{check();return bound.lastWall;},monotonic=()=>{check();return bound.lastMonotonic;};
 const assertCurrent=(raw:Readonly<NegativeOwnedTarget>)=>{if(raw!==target)invalid();check();};
 const schedule:NegativeLinuxNativeDockerSqlPorts['schedule']=function(callback,timeoutMs){
  if(this!==recipient||typeof callback!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30_000)invalid();check();let cancelled=false;
  const handle=state.system.setTimeout.call(state.recipient,()=>{if(cancelled)return;try{check();}catch{}callback();},timeoutMs);
  return()=>{if(cancelled)return;cancelled=true;state.system.clearTimeout.call(state.recipient,handle);};
 };
 const run:NegativeLinuxNativeDockerSqlPorts['run']=async function(raw,signal){
  if(this!==recipient||found.sqlBlocked||state.active||state.poisoned||!(signal instanceof AbortSignal)||signal.aborted)return Object.freeze({status:null,signal:null,closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});
  let input:Uint8Array;try{check();input=sqlRequest(raw,found);check();}catch{found.sqlBlocked=true;return Object.freeze({status:null,signal:null,closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});}
  const invocation=Object.freeze({file:dockerPath,argv:raw.argv,cwd:'/' as const,env:Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:bound.binding.namespace.receipt}),
   input:new TextDecoder('utf-8',{fatal:true}).decode(input),timeoutMs:raw.timeoutMs,stdoutLimit:raw.outputLimitBytes,stderrLimit:raw.outputLimitBytes}) satisfies NegativeLinuxDockerInvocation;
  let expired=false,timer:unknown,timerSet=false,child:EventEmitter,inputStream:EventEmitter&{end(value?:Uint8Array):void},stdout:EventEmitter,stderr:EventEmitter,spawnStarted=false,created:unknown,timeoutEffect=()=>{expired=true;};
  try{
   timer=state.system.setTimeout.call(state.recipient,()=>timeoutEffect(),raw.timeoutMs);timerSet=true;check();if(expired||signal.aborted)invalid();
   spawnStarted=true;created=state.system.spawnPinned.call(state.recipient,state.handle,invocation);if(!emitter(created))invalid();
   const stdinValue=Object.getOwnPropertyDescriptor(created,'stdin')?.value,stdoutValue=Object.getOwnPropertyDescriptor(created,'stdout')?.value,stderrValue=Object.getOwnPropertyDescriptor(created,'stderr')?.value;
   if(!emitter(stdinValue)||!emitter(stdoutValue)||!emitter(stderrValue)||stdinValue===stdoutValue||stdinValue===stderrValue||stdoutValue===stderrValue)invalid();
   child=created as EventEmitter;inputStream=stdinValue as EventEmitter&{end(value?:Uint8Array):void};stdout=stdoutValue;stderr=stderrValue;retainedChildren.add(child);state.active=true;
  }catch{if(spawnStarted){state.poisoned=true;if(emitter(created))retainChild(created,[]);}found.sqlBlocked=true;if(timerSet)try{state.system.clearTimeout.call(state.recipient,timer);}catch{}input.fill(0);return Object.freeze({status:null,signal:null,closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});}
  return await new Promise<Readonly<NegativeLinuxNativeDockerSqlResult>>(resolve=>{
   let settled=false,closed=false,stopped=false,inputFinished=false,stdoutEnded=false,stderrEnded=false,exitSeen=false,exitStatus:unknown,exitSignal:unknown,total=0;
   const out:Uint8Array[]=[],err:Uint8Array[]=[],listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
   const listen=(targetValue:EventEmitter,event:string,fn:(...args:any[])=>void)=>{listeners.push({target:targetValue,event,fn});on.call(targetValue,event,fn);};
   const detach=()=>{for(const row of listeners)try{off.call(row.target,row.event,row.fn);}catch{}listeners.length=0;if(timerSet)try{state.system.clearTimeout.call(state.recipient,timer);}catch{}try{signal.removeEventListener('abort',abort);}catch{}};
   const wipe=()=>{input.fill(0);for(const row of [...out,...err])row.fill(0);out.length=0;err.length=0;};
   const finishUnknown=(stop:boolean)=>{if(settled)return;settled=true;found.sqlBlocked=true;state.poisoned=true;if(closed)state.active=false;if(stop&&!stopped&&!closed){stopped=true;try{state.system.terminate.call(state.recipient,child,'SIGKILL');}catch{}}detach();wipe();if(!closed)retainChild(child,[inputStream,stdout,stderr]);resolve(Object.freeze({status:null,signal:null,closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()}));};
   const abort=()=>finishUnknown(true),collect=(sink:Uint8Array[],ended:()=>boolean)=>(value:unknown)=>{if(settled)return;if(ended()||types.isProxy(value)||!types.isUint8Array(value)||types.isSharedArrayBuffer(value.buffer)){finishUnknown(true);return;}const part=new Uint8Array(value);total+=part.byteLength;if(total>raw.outputLimitBytes){part.fill(0);finishUnknown(true);return;}sink.push(part);};
   listen(inputStream,'finish',()=>{if(inputFinished){finishUnknown(true);return;}inputFinished=true;input.fill(0);});listen(inputStream,'error',()=>finishUnknown(true));listen(stdout,'data',collect(out,()=>stdoutEnded));listen(stderr,'data',collect(err,()=>stderrEnded));
   listen(stdout,'end',()=>{if(stdoutEnded){finishUnknown(true);return;}stdoutEnded=true;});listen(stderr,'end',()=>{if(stderrEnded){finishUnknown(true);return;}stderrEnded=true;});listen(stdout,'error',()=>finishUnknown(true));listen(stderr,'error',()=>finishUnknown(true));listen(child,'error',()=>finishUnknown(false));
   listen(child,'exit',(status,foundSignal)=>{if(exitSeen){finishUnknown(false);return;}exitSeen=true;exitStatus=status;exitSignal=foundSignal;});
   listen(child,'close',(status,foundSignal)=>{closed=true;retainedChildren.delete(child);if(settled)return;let ok=true;try{check();}catch{ok=false;}
    if(!ok||expired||!inputFinished||!stdoutEnded||!stderrEnded||!exitSeen||status!==exitStatus||foundSignal!==exitSignal||!(status===null||Number.isSafeInteger(status))||!(foundSignal===null||typeof foundSignal==='string')){finishUnknown(false);return;}
    const output=new Uint8Array(Buffer.concat(out.map(value=>Buffer.from(value)))),errors=new Uint8Array(Buffer.concat(err.map(value=>Buffer.from(value))));settled=true;state.active=false;
    if(status===0&&foundSignal===null){if(raw.operation==='INSTALL_PRIOR'){found.installed++;found.pending=raw.row;}else if(raw.operation==='APPEND_LEDGER'){found.ledgered++;found.pending=null;}else if(raw.operation==='CREATE_SENTINEL')found.sentinel=true;else if(raw.operation==='READ_CATALOG')found.catalogs++;else found.sqlBlocked=true;}
    else if(raw.operation==='NEGATIVE_0076'&&status===3&&foundSignal===null){
     try{
      observe0076DdlFailure(target,current0076NegativeContract.executionSha256,Object.freeze({status,signal:foundSignal,stderr:new TextDecoder('utf-8',{fatal:true}).decode(errors)}),failureParser);
      found.negative=true;
     }catch{found.sqlBlocked=true;}
    }else found.sqlBlocked=true;
    detach();wipe();resolve(Object.freeze({status:status as number|null,signal:foundSignal as string|null,closed:true,stdout:output,stderr:errors}));
   });
   try{timeoutEffect=()=>finishUnknown(true);signal.addEventListener('abort',abort,{once:true});check();if(expired||signal.aborted){finishUnknown(true);return;}inputStream.end(input);}catch{finishUnknown(true);}
  });
 };
 const close:NegativeLinuxNativeDockerSqlPorts['close']=async function(){if(this!==recipient)return invalid();if(state.active)return'UNKNOWN';return closeFile(state);};
 return Object.freeze({recipient,deadline,now,monotonic,assertCurrent,schedule,run,close});
}

/** 고정 Docker 파일의 read-only same-FD 관측만 제공한다. same-FD exec는 미검증이므로 spawnPinned는 항상 닫혀 있다. */
export function create0076NegativeLinuxReadOnlyDockerSystem():NegativeLinuxNativeDockerSystem{
 const recipient=Object.freeze(Object.create(null)),handles=new WeakMap<object,{fd:number;dev:number;ino:number}>(),retainedUnknownFds=new Set<number>();
 const handle=(raw:object)=>{const found=handles.get(raw);if(found===undefined)return invalid();return found;};
 return Object.freeze({
  recipient,
  open(this:object,path:string){
   if(this!==recipient||path!==dockerPath)invalid();const before=lstatSync(path);
   if(!before.isFile()||before.uid!==0||before.gid!==0||(before.mode&0o7777)!==0o755||before.nlink!==1)invalid();let fd:number|undefined;
   try{
    fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);const after=fstatSync(fd),realpath=readlinkSync('/proc/self/fd/'+fd,'utf8');
    if(!after.isFile()||Number(after.dev)!==Number(before.dev)||Number(after.ino)!==Number(before.ino)||realpath!==dockerPath)invalid();
    const token=Object.freeze(Object.create(null));handles.set(token,{fd,dev:Number(after.dev),ino:Number(after.ino)});return token;
   }catch(error){if(fd!==undefined)try{closeSync(fd);}catch{retainedUnknownFds.add(fd);}throw error;}
  },
  stat(this:object,raw:object){
   if(this!==recipient)invalid();const found=handle(raw),value=fstatSync(found.fd),pathValue=lstatSync(dockerPath),realpath=readlinkSync('/proc/self/fd/'+found.fd,'utf8');
   if(!value.isFile()||!pathValue.isFile()||Number(value.dev)!==found.dev||Number(value.ino)!==found.ino||Number(pathValue.dev)!==found.dev||Number(pathValue.ino)!==found.ino||realpath!==dockerPath)invalid();
   return Object.freeze({path:dockerPath,realpath,kind:'FILE' as const,dev:Number(value.dev),ino:Number(value.ino),uid:value.uid,gid:value.gid,mode:value.mode,nlink:value.nlink,size:value.size,mtimeMs:value.mtimeMs,ctimeMs:value.ctimeMs});
  },
  read(this:object,raw:object,offset:number,length:number){if(this!==recipient||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>chunkBytes)invalid();const found=handle(raw),buffer=Buffer.allocUnsafe(length),read=readSync(found.fd,buffer,0,length,offset);return new Uint8Array(buffer.subarray(0,read));},
  spawnPinned(){throw Error('IX01_0076_NEGATIVE_LINUX_SAME_FD_EXEC_UNVERIFIED');},terminate(){throw Error('IX01_0076_NEGATIVE_LINUX_SAME_FD_EXEC_UNVERIFIED');},
  setTimeout(this:object,callback:()=>void,ms:number){if(this!==recipient)return invalid();return globalThis.setTimeout(callback,ms);},
  clearTimeout(this:object,found:unknown){if(this!==recipient)return invalid();globalThis.clearTimeout(found as ReturnType<typeof setTimeout>);},
  close(this:object,raw:object){if(this!==recipient)invalid();const found=handle(raw);try{closeSync(found.fd);handles.delete(raw);return 'CLOSED' as const;}catch{return 'UNKNOWN' as const;}}
 });
}
