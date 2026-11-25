import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {closeSync,constants,fstatSync,lstatSync,openSync,readlinkSync,readSync} from 'node:fs';
import {types} from 'node:util';
import {hashV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import type {
 NegativeLinuxDockerBinding,NegativeLinuxDockerCommandResult,NegativeLinuxDockerInvocation,NegativeLinuxDockerSystem,NegativeLinuxDockerToolPin,
} from './qa-ix01-0076-negative-linux-docker.ts';

const dockerPath='/usr/bin/docker',maximumToolBytes=160*1024*1024,chunkBytes=1024*1024,maximumAttempts=256;
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f';
const containerFormat='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"user":{{json .Config.User}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"host":{{json .HostConfig}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}}}';
type CommandPhase='INFO'|'IMAGE'|'ABSENT'|'CREATE'|'CREATED_INSPECT'|'START'|'RUNNING_INSPECT'|'READY_WAIT'|'ROLE_PRISTINE'|'BOOTSTRAP'|'ROLE_INSTALLER'|'FINAL_INSPECT'|'COMPLETE';
export interface NegativeLinuxNativeDockerOwnerPorts{
 readonly recipient:object;readonly binding:Readonly<NegativeLinuxDockerBinding>;readonly materials:Readonly<NegativeLinuxNativeDockerMaterials>;
 assertCurrent(this:object,binding:Readonly<NegativeLinuxDockerBinding>):void;wall(this:object):number;monotonic(this:object):number;
}
export interface NegativeLinuxNativeDockerMaterials{readonly roleSql:string;readonly bootstrapSql:string;readonly finalServerRaw:'postgres\n'}
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
export type NegativeLinuxNativeDockerOwnerCapability=object;

interface Binding{owner:NegativeLinuxNativeDockerOwnerPorts;recipient:object;binding:Readonly<NegativeLinuxDockerBinding>;materials:Readonly<NegativeLinuxNativeDockerMaterials>;current:NegativeLinuxNativeDockerOwnerPorts['assertCurrent'];wall:NegativeLinuxNativeDockerOwnerPorts['wall'];monotonic:NegativeLinuxNativeDockerOwnerPorts['monotonic'];created:boolean;startWall:number;startMonotonic:number;lastWall:number;lastMonotonic:number}
interface FileState{system:NegativeLinuxNativeDockerSystem;recipient:object;handle:object;stat:Readonly<NegativeLinuxNativeDockerFileStat>;pin:Readonly<NegativeLinuxDockerToolPin>|null;active:boolean;poisoned:boolean;phase:CommandPhase;containerId:string|null;finalServerAttempts:number;finalServerObserved:boolean;closeStarted:boolean;closeStatus:'OPEN'|'CLOSED'|'UNKNOWN'}
const capabilities=new WeakMap<object,Binding>(),issuedAttempts=new Set<string>(),pins=new WeakMap<object,FileState>(),retainedFiles=new Set<FileState>(),retainedChildren=new Set<object>();
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
 if(!exact(materials,['roleSql','bootstrapSql','finalServerRaw'])||!Object.isFrozen(materials)||typeof materials.roleSql!=='string'||Buffer.byteLength(materials.roleSql)<1||Buffer.byteLength(materials.roleSql)>65_536
  ||typeof materials.bootstrapSql!=='string'||Buffer.byteLength(materials.bootstrapSql)<1||Buffer.byteLength(materials.bootstrapSql)>2_097_152||materials.finalServerRaw!=='postgres\n')invalid();
 return{recipient,binding:bindingShape(d.binding!.value as Readonly<NegativeLinuxDockerBinding>),materials,current:d.assertCurrent!.value as NegativeLinuxNativeDockerOwnerPorts['assertCurrent'],wall:d.wall!.value as NegativeLinuxNativeDockerOwnerPorts['wall'],monotonic:d.monotonic!.value as NegativeLinuxNativeDockerOwnerPorts['monotonic']};
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
 current(bound);if(state.poisoned||state.closeStatus!=='OPEN'||state.system.recipient!==state.recipient)invalid();const found=statShape(state.system.stat.call(state.recipient,state.handle));if(!sameStat(found,state.stat))invalid();
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
 const capability=Object.freeze(Object.create(null)) as object;issuedAttempts.add(owner.binding.attemptId);capabilities.set(capability,{owner:rawOwner,recipient:owner.recipient,binding:owner.binding,materials:owner.materials,current:owner.current,wall:owner.wall,monotonic:owner.monotonic,created:false,startWall,startMonotonic,lastWall:startWall,lastMonotonic:startMonotonic});return capability;
}

/** 실제 system의 spawnPinned가 same open FD 실행을 증명하지 못하면 run은 fail-closed다. 현재 entry/approval graph에는 아직 연결하지 않는다. */
export function create0076NegativeLinuxNativeDocker(capability:NegativeLinuxNativeDockerOwnerCapability,rawSystem:NegativeLinuxNativeDockerSystem):Readonly<NegativeLinuxDockerSystem>{
 const foundBinding=capabilities.get(capability),system=systemShape(rawSystem);if(foundBinding===undefined)return invalid();if(foundBinding.created)return invalid();const bound:Binding=foundBinding;bound.created=true;current(bound);let pinStarted=false,state:FileState|null=null;
 const unchanged=()=>rawSystem.recipient===system.recipient;
 const pin:NegativeLinuxDockerSystem['pin']=async function(path){
  if(this!==system.recipient||path!==dockerPath||pinStarted||!unchanged())invalid();pinStarted=true;current(bound);let local:FileState|null=null;
  try{
   const handle=rawSystem.open.call(system.recipient,path);if(!handle||typeof handle!=='object'||types.isProxy(handle))invalid();local={system:rawSystem,recipient:system.recipient,handle,stat:Object.freeze({}) as never,pin:null,active:false,poisoned:false,phase:'INFO',containerId:null,finalServerAttempts:0,finalServerObserved:false,closeStarted:false,closeStatus:'OPEN'};retainedFiles.add(local);current(bound);
   const first=statShape(rawSystem.stat.call(system.recipient,handle)),digest=createHash('sha256');let offset=0;
   while(offset<first.size){current(bound);const length=Math.min(chunkBytes,first.size-offset),bytes=rawSystem.read.call(system.recipient,handle,offset,length);if(types.isProxy(bytes)||!types.isUint8Array(bytes)||types.isSharedArrayBuffer(bytes.buffer)||bytes.byteLength!==length)invalid();digest.update(bytes);offset+=bytes.byteLength;}
   current(bound);const after=statShape(rawSystem.stat.call(system.recipient,handle));if(!sameStat(first,after))invalid();const custody=Object.freeze(Object.create(null)),found=Object.freeze({path:first.path,realpath:first.realpath,kind:first.kind,dev:first.dev,ino:first.ino,uid:first.uid,mode:first.mode,nlink:first.nlink,size:first.size,mtimeMs:first.mtimeMs,ctimeMs:first.ctimeMs,sha256:digest.digest('hex'),custody}) satisfies Readonly<NegativeLinuxDockerToolPin>;
   local.stat=first;local.pin=found;pins.set(found,local);state=local;return found;
  }catch(error){if(local!==null)closeFile(local);throw error;}
 };
 const pinCurrent:NegativeLinuxDockerSystem['current']=function(found){if(this!==system.recipient||!unchanged())invalid();const foundState=pins.get(found);if(foundState===undefined)return invalid();const local:FileState=foundState;if(local!==state||local.pin!==found)invalid();systemCurrent(bound,local);};
 const run:NegativeLinuxDockerSystem['run']=async function(found,raw){
  if(this!==system.recipient||!unchanged())return unknown();const local=pins.get(found);if(local===undefined||local!==state||local.pin!==found||local.active||local.poisoned||!invocationShape(raw,bound,local))return unknown();
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
    try{const decoder=new TextDecoder('utf-8',{fatal:true}),stdoutText=decoder.decode(Buffer.concat(out.map(value=>Buffer.from(value)))),stderrText=decoder.decode(Buffer.concat(err.map(value=>Buffer.from(value))));settled=true;local.active=false;if(status!==0||signal!==null)local.poisoned=true;else advance(bound,local,raw,stdoutText);detach();wipe();resolve(Object.freeze({status:status as number|null,signal:signal as string|null,closed:true,stdout:stdoutText,stderr:stderrText}));}catch{finishUnknown(false);}
   });
   try{timeoutEffect=()=>finishUnknown(true);systemCurrent(bound,local);if(expired){finishUnknown(true);return;}input.end(raw.input===null?undefined:new Uint8Array(Buffer.from(raw.input,'utf8')));}catch{finishUnknown(true);}
  });
 };
 const wait:NegativeLinuxDockerSystem['wait']=async function(timeoutMs){if(this!==system.recipient||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10_000||state===null)return invalid();const local:FileState=state;systemCurrent(bound,local);await new Promise<void>((resolve,reject)=>{let handle:unknown;try{handle=rawSystem.setTimeout.call(system.recipient,()=>{try{systemCurrent(bound,local);resolve();}catch(error){reject(error);}},timeoutMs);}catch(error){reject(error);return;}void handle;});};
 const release:NegativeLinuxDockerSystem['release']=async function(found){if(this!==system.recipient||!unchanged())invalid();const local=pins.get(found);if(local===undefined||local!==state||local.pin!==found)return 'UNKNOWN';if(local.active){local.poisoned=true;return 'UNKNOWN';}return closeFile(local);};
 return Object.freeze({recipient:system.recipient,pin,current:pinCurrent,run,wait,release});
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
