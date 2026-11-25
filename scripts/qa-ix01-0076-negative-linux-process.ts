import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {contentHash} from '../contracts/canonical.ts';
import {hashV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeContract} from './qa-ix01-0076-atomicity-negative.ts';
import type {NegativePsqlInvocation,NegativePsqlProcessPorts,NegativePsqlProcessResult} from './qa-ix01-0076-negative-psql.ts';

const purpose='IX01_0076_NEGATIVE_LINUX_PROCESS_OWNER' as const;
export interface NegativeLinuxProcessExpectation{
 readonly schemaVersion:1;readonly purpose:typeof purpose;readonly attemptId:string;readonly sourceHead:string;
 readonly planHash:string;readonly approvalHash:string;readonly graphHash:string;readonly containerId:string;readonly database:string;readonly receipt:string;
}
export interface NegativeLinuxProcessOwnerPorts{
 readonly recipient:object;readonly expected:Readonly<NegativeLinuxProcessExpectation>;
 assertCurrent(this:object,expected:Readonly<NegativeLinuxProcessExpectation>):void;
}
interface SpawnOptions{readonly cwd:'/';readonly env:Readonly<Record<string,string>>;readonly stdio:readonly ['pipe','pipe','pipe'];readonly shell:false;readonly windowsHide:true}
export interface NegativeLinuxProcessSystem{
 readonly recipient:object;
 spawn(this:object,file:string,args:readonly string[],options:SpawnOptions):unknown;
 terminate(this:object,child:object,signal:'SIGKILL'):unknown;
 setTimeout(this:object,callback:()=>void,ms:number):unknown;
 clearTimeout(this:object,handle:unknown):void;
}
export type NegativeLinuxProcessOwnerCapability=object;

interface OwnerBinding{owner:NegativeLinuxProcessOwnerPorts;recipient:object;expected:Readonly<NegativeLinuxProcessExpectation>;current:NegativeLinuxProcessOwnerPorts['assertCurrent'];created:boolean}
const capabilities=new WeakMap<object,OwnerBinding>(),issuedAttempts=new Set<string>(),maximumAttempts=256,retainedChildren=new Set<object>();
const on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_PROCESS_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(d).length===keys.length&&keys.every(key=>!!d[key]?.enumerable&&Object.hasOwn(d[key]!,'value'));
}
function expectation(raw:Readonly<NegativeLinuxProcessExpectation>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','graphHash','containerId','database','receipt'])||!Object.isFrozen(raw)
  ||raw.schemaVersion!==1||raw.purpose!==purpose||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.approvalHash,raw.graphHash,raw.containerId].every(hashV1))invalid();
 const compact=raw.attemptId.replaceAll('-','');
 if(raw.database!=='ix01_0076_negative_'+compact||raw.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+raw.attemptId)invalid();return raw;
}
function ownerPorts(raw:NegativeLinuxProcessOwnerPorts){
 if(!exact(raw,['recipient','expected','assertCurrent'])||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||typeof d.assertCurrent!.value!=='function')invalid();
 return{recipient,expected:expectation(d.expected!.value as NegativeLinuxProcessExpectation),current:d.assertCurrent!.value as NegativeLinuxProcessOwnerPorts['assertCurrent']};
}
function systemPorts(raw:NegativeLinuxProcessSystem){
 const keys=['recipient','spawn','terminate','setTimeout','clearTimeout'];if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||keys.slice(1).some(key=>typeof d[key]!.value!=='function'))invalid();
 return{recipient,spawn:d.spawn!.value as NegativeLinuxProcessSystem['spawn'],terminate:d.terminate!.value as NegativeLinuxProcessSystem['terminate'],setTimeout:d.setTimeout!.value as NegativeLinuxProcessSystem['setTimeout'],clearTimeout:d.clearTimeout!.value as NegativeLinuxProcessSystem['clearTimeout']};
}
function unknown(code='UNKNOWN'):Readonly<NegativePsqlProcessResult>{return Object.freeze({status:null,signal:null,code,closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});}
function emitter(value:unknown):value is EventEmitter{return !!value&&typeof value==='object'&&!types.isProxy(value)&&value instanceof EventEmitter;}
function retainUnknownChild(child:EventEmitter,rawStreams:readonly unknown[]){
 const streams=[child,...rawStreams.filter(emitter)].filter((value,index,all)=>all.indexOf(value)===index),sink=()=>{};
 const release=()=>{retainedChildren.delete(child);for(const stream of streams)try{off.call(stream,'error',sink);}catch{}try{off.call(child,'close',release);}catch{}};
 retainedChildren.add(child);for(const stream of streams)on.call(stream,'error',sink);on.call(child,'close',release);
}
function invocation(raw:Readonly<NegativePsqlInvocation>,expected:Readonly<NegativeLinuxProcessExpectation>){
 if(!exact(raw,['executable','argv','env','cwd','stdin','timeoutMs','outputLimitBytes'])||!Object.isFrozen(raw)||raw.executable!=='/usr/bin/docker'||raw.cwd!=='/'||raw.outputLimitBytes!==16384
  ||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>30000||!Object.isFrozen(raw.argv)||!Object.isFrozen(raw.env)||types.isProxy(raw.stdin)||!types.isUint8Array(raw.stdin)||types.isSharedArrayBuffer(raw.stdin.buffer))return false;
 const argv=['--config',expected.receipt+'/docker-config','--host','unix:///var/run/docker.sock','exec','-i','--user','999:999',expected.containerId,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username=anvil_v3_migrator','--dbname='+expected.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'];
 return raw.argv.length===argv.length&&raw.argv.every((value,index)=>value===argv[index])&&exact(raw.env,['PATH','LANG','LC_ALL','HOME'])
  &&raw.env.PATH==='/usr/bin:/bin'&&raw.env.LANG==='C.UTF-8'&&raw.env.LC_ALL==='C.UTF-8'&&raw.env.HOME===expected.receipt
  &&raw.stdin.byteLength===current0076NegativeContract.sourceBytes&&contentHash(raw.stdin)===current0076NegativeContract.executionSha256;
}

/** 원 entry가 보관할 비직렬 결박이다. 이 함수는 승인 진위나 실제 실행 권위를 발급하지 않는다. */
export function bind0076NegativeLinuxProcessOwner(rawOwner:NegativeLinuxProcessOwnerPorts):NegativeLinuxProcessOwnerCapability{
 const owner=ownerPorts(rawOwner);if(issuedAttempts.size>=maximumAttempts||issuedAttempts.has(owner.expected.attemptId)||owner.current.call(owner.recipient,owner.expected)!==undefined)invalid();
 const capability=Object.freeze(Object.create(null)) as object;issuedAttempts.add(owner.expected.attemptId);capabilities.set(capability,{owner:rawOwner,recipient:owner.recipient,expected:owner.expected,current:owner.current,created:false});return capability;
}

/** 실제 child port는 보호 Linux entry가 별도로 공급해야 한다. import/factory는 spawn하지 않으며 run은 원 capability·current·exact invocation 뒤에만 시작한다. */
export function create0076NegativeLinuxProcess(capability:NegativeLinuxProcessOwnerCapability,rawSystem:NegativeLinuxProcessSystem):Readonly<NegativePsqlProcessPorts>{
 const found=capabilities.get(capability),system=systemPorts(rawSystem);if(found===undefined)throw Error('IX01_0076_NEGATIVE_LINUX_PROCESS_INVALID');const bound=found;if(bound.created)invalid();bound.created=true;let used=false;
 const unchanged=()=>bound.owner.recipient===bound.recipient&&bound.owner.expected===bound.expected&&bound.owner.assertCurrent===bound.current
  &&rawSystem.recipient===system.recipient&&rawSystem.spawn===system.spawn&&rawSystem.terminate===system.terminate&&rawSystem.setTimeout===system.setTimeout&&rawSystem.clearTimeout===system.clearTimeout;
 const current=()=>{if(!unchanged()||bound.current.call(bound.recipient,bound.expected)!==undefined)invalid();};current();
 const schedule:NegativePsqlProcessPorts['schedule']=function(callback,ms){
  if(this!==system.recipient||typeof callback!=='function'||!Number.isSafeInteger(ms)||ms<1||ms>30000)invalid();current();
  const handle=system.setTimeout.call(system.recipient,callback,ms);let cancelled=false;return()=>{if(cancelled)return;cancelled=true;system.clearTimeout.call(system.recipient,handle);};
 };
 const run:NegativePsqlProcessPorts['run']=async function(raw,signal){
  if(this!==system.recipient||used)return unknown();used=true;if(!(signal instanceof AbortSignal)||signal.aborted||!invocation(raw,bound.expected))return unknown();
  try{current();}catch{return unknown();}const input=new Uint8Array(raw.stdin);let child:EventEmitter,inputStream:EventEmitter&{end(value?:Uint8Array):void},stdout:EventEmitter,stderr:EventEmitter;
  let expired=false,timer:unknown,timerSet=false,timeoutEffect=()=>{expired=true;};
  try{
   timer=system.setTimeout.call(system.recipient,()=>timeoutEffect(),raw.timeoutMs);timerSet=true;current();
   if(expired||signal.aborted){system.clearTimeout.call(system.recipient,timer);input.fill(0);return unknown(expired?'TIMEOUT':'ABORTED');}
  }catch{if(timerSet)try{system.clearTimeout.call(system.recipient,timer);}catch{}input.fill(0);return unknown('SCHEDULE_UNKNOWN');}
  try{
   const created=system.spawn.call(system.recipient,raw.executable,raw.argv,Object.freeze({cwd:'/' as const,env:raw.env,stdio:Object.freeze(['pipe','pipe','pipe'] as const),shell:false as const,windowsHide:true as const}));
   if(!emitter(created))throw Error('IX01_0076_NEGATIVE_LINUX_PROCESS_INVALID');const ownedChild=created;if(retainedChildren.has(ownedChild))invalid();const stdinValue=Object.getOwnPropertyDescriptor(ownedChild,'stdin')?.value,stdoutValue=Object.getOwnPropertyDescriptor(ownedChild,'stdout')?.value,stderrValue=Object.getOwnPropertyDescriptor(ownedChild,'stderr')?.value;
   if(!emitter(stdinValue)||!emitter(stdoutValue)||!emitter(stderrValue)||stdinValue===stdoutValue||stdinValue===stderrValue||stdoutValue===stderrValue||typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(stdinValue),'end')?.value!=='function'&&typeof Object.getOwnPropertyDescriptor(stdinValue,'end')?.value!=='function'){
    retainUnknownChild(ownedChild,[stdinValue,stdoutValue,stderrValue]);try{system.terminate.call(system.recipient,ownedChild,'SIGKILL');}catch{}if(timerSet)try{system.clearTimeout.call(system.recipient,timer);}catch{}input.fill(0);return unknown('SPAWN_SHAPE_UNKNOWN');
   }
   child=ownedChild;inputStream=stdinValue as EventEmitter&{end(value?:Uint8Array):void};stdout=stdoutValue;stderr=stderrValue;retainedChildren.add(child);
  }catch{if(timerSet)try{system.clearTimeout.call(system.recipient,timer);}catch{}input.fill(0);return unknown('SPAWN_UNKNOWN');}
  return await new Promise<Readonly<NegativePsqlProcessResult>>(resolve=>{
   let settled=false,closed=false,stopRequested=false,inputFinished=false,stdoutEnded=false,stderrEnded=false,total=0,exitStatus:unknown=undefined,exitSignal:unknown=undefined,exitSeen=false;
   const out:Uint8Array[]=[],err:Uint8Array[]=[],listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
   const listen=(target:EventEmitter,event:string,fn:(...args:any[])=>void)=>{listeners.push({target,event,fn});on.call(target,event,fn);};
   const wipe=()=>{input.fill(0);for(const part of [...out,...err])part.fill(0);out.length=0;err.length=0;};
   const detach=()=>{for(const row of listeners)try{off.call(row.target,row.event,row.fn);}catch{}listeners.length=0;if(timerSet)try{system.clearTimeout.call(system.recipient,timer);}catch{}try{signal.removeEventListener('abort',abort);}catch{}};
   const retainUntilClose=()=>retainUnknownChild(child,[inputStream,stdout,stderr]);
   const finishUnknown=(code:string,stop:boolean)=>{if(settled)return;settled=true;if(stop&&!stopRequested&&!closed){stopRequested=true;try{system.terminate.call(system.recipient,child,'SIGKILL');}catch{}}detach();wipe();if(!closed)retainUntilClose();resolve(unknown(code));};
   const abort=()=>finishUnknown('ABORTED',true);
   const collect=(sink:Uint8Array[],ended:()=>boolean)=>(value:unknown)=>{if(settled)return;if(ended()||types.isProxy(value)||!types.isUint8Array(value)||types.isSharedArrayBuffer(value.buffer)){finishUnknown('OUTPUT_UNKNOWN',true);return;}const part=new Uint8Array(value);total+=part.byteLength;if(total>raw.outputLimitBytes){part.fill(0);finishUnknown('OUTPUT_LIMIT',true);return;}sink.push(part);};
   listen(inputStream,'finish',()=>{if(inputFinished){finishUnknown('STDIN_UNKNOWN',true);return;}inputFinished=true;input.fill(0);});listen(inputStream,'error',()=>finishUnknown('STDIN_UNKNOWN',true));
   listen(stdout,'data',collect(out,()=>stdoutEnded));listen(stderr,'data',collect(err,()=>stderrEnded));listen(stdout,'end',()=>{if(stdoutEnded){finishUnknown('STDOUT_UNKNOWN',true);return;}stdoutEnded=true;});listen(stderr,'end',()=>{if(stderrEnded){finishUnknown('STDERR_UNKNOWN',true);return;}stderrEnded=true;});
   listen(stdout,'error',()=>finishUnknown('STDOUT_UNKNOWN',true));listen(stderr,'error',()=>finishUnknown('STDERR_UNKNOWN',true));listen(child,'error',()=>finishUnknown('CHILD_UNKNOWN',false));
   listen(child,'exit',(status:unknown,foundSignal:unknown)=>{if(exitSeen){finishUnknown('EXIT_CHANGED',false);return;}exitSeen=true;exitStatus=status;exitSignal=foundSignal;});
   listen(child,'close',(status:unknown,foundSignal:unknown)=>{
    closed=true;retainedChildren.delete(child);if(settled)return;let currentOk=true;try{current();}catch{currentOk=false;}
    const validStatus=status===null||typeof status==='number'&&Number.isSafeInteger(status)&&status>=0,validSignal=foundSignal===null||typeof foundSignal==='string';
    if(!currentOk||!validStatus||!validSignal||!exitSeen||status!==exitStatus||foundSignal!==exitSignal||!inputFinished||!stdoutEnded||!stderrEnded){finishUnknown('CLOSE_UNKNOWN',false);return;}
    const output=Buffer.concat(out.map(value=>Buffer.from(value))),errors=Buffer.concat(err.map(value=>Buffer.from(value))),ioOk=inputFinished&&stdoutEnded&&stderrEnded;
    settled=true;detach();wipe();resolve(Object.freeze({status:status as number|null,signal:foundSignal as string|null,code:ioOk&&foundSignal===null?null:'IO_UNCONFIRMED',closed:true,stdout:new Uint8Array(output),stderr:new Uint8Array(errors)}));
   });
   try{
    timeoutEffect=()=>finishUnknown('TIMEOUT',true);signal.addEventListener('abort',abort,{once:true});
    try{current();}catch{finishUnknown('OWNER_UNKNOWN',true);return;}
    if(expired){timeoutEffect();return;}if(signal.aborted){abort();return;}inputStream.end(input);
   }catch{finishUnknown('START_UNKNOWN',true);}
  });
 };
 return Object.freeze({recipient:system.recipient,schedule,run});
}
