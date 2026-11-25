import {constants} from 'node:fs';
import {types} from 'node:util';
import {uuidV1} from '../contracts/runtime/validation-v1.ts';
import type {NegativeLinuxFdProofInvocation,NegativeLinuxFdProofStat,NegativeLinuxFdProofSystem} from './qa-ix01-0076-negative-linux-fd-proof.ts';

const executable='/usr/bin/sleep' as const;
const supplierPurpose='IX01_0076_NEGATIVE_LINUX_FD_PROOF_SYSTEM_SOURCE' as const;
export const current0076NegativeLinuxFdProofSystemContract=Object.freeze({purpose:supplierPurpose,attemptId:'' as string,executable,inheritedFd:3 as const,
 sourceOnly:true as const,runtimeAuthorized:false as const});

export interface NegativeLinuxFdProofNodeStat{readonly kind:'FILE'|'OTHER';readonly dev:number;readonly ino:number;readonly uid:number;readonly gid:number;readonly mode:number;readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number}
export interface NegativeLinuxFdProofNodePorts{
 readonly recipient:object;
 lstat(this:object,path:string):Readonly<NegativeLinuxFdProofNodeStat>;
 open(this:object,path:string,flags:number):number;
 fstat(this:object,fd:number):Readonly<NegativeLinuxFdProofNodeStat>;
 readlink(this:object,path:string):string;
 read(this:object,fd:number,offset:number,length:number):Uint8Array;
 spawn(this:object,file:string,args:readonly string[],options:Readonly<Record<string,unknown>>):object;
 childPid(this:object,child:object):number;
 statPath(this:object,path:string):Readonly<NegativeLinuxFdProofNodeStat>;
 on(this:object,child:object,event:'error'|'exit'|'close',listener:(...values:unknown[])=>void):void;
 off(this:object,child:object,event:'error'|'exit'|'close',listener:(...values:unknown[])=>void):void;
 kill(this:object,child:object,signal:'SIGTERM'):boolean;
 setTimer(this:object,callback:()=>void,ms:number):object;
 clearTimer(this:object,timer:object):void;
 close(this:object,fd:number):void;
}
export interface NegativeLinuxFdProofSystemSupplier{
 readonly recipient:object;readonly attemptId:string;
 assertCurrent(this:object,contract:Readonly<typeof current0076NegativeLinuxFdProofSystemContract>):void;
}

interface SupplierBinding{readonly supplier:NegativeLinuxFdProofSystemSupplier;readonly recipient:object;readonly descriptors:ReturnType<typeof Object.getOwnPropertyDescriptors>;readonly contract:Readonly<typeof current0076NegativeLinuxFdProofSystemContract>}
interface PlatformBinding{readonly ports:NegativeLinuxFdProofNodePorts;readonly recipient:object;readonly descriptors:ReturnType<typeof Object.getOwnPropertyDescriptors>}
interface FileState{readonly token:object;readonly fd:number;readonly initial:Readonly<NegativeLinuxFdProofNodeStat>;readonly supplier:SupplierBinding;readonly platform:PlatformBinding;closeStarted:boolean;closeKnown:boolean}
interface ChildOutcome{readonly ok:boolean;readonly status:unknown;readonly signal:unknown}
interface ChildState{readonly token:object;readonly child:object;readonly file:FileState;readonly supplier:SupplierBinding;readonly platform:PlatformBinding;readonly completion:Promise<Readonly<ChildOutcome>>;readonly resolve:(value:Readonly<ChildOutcome>)=>void;
 readonly listeners:Readonly<{error:(...values:unknown[])=>void;exit:(...values:unknown[])=>void;close:(...values:unknown[])=>void}>;pid:number|null;terminateStarted:boolean;invalid:boolean;exitSeen:boolean;exitStatus:unknown;exitSignal:unknown;closeSeen:boolean}

const capabilities=new WeakMap<object,SupplierBinding>(),issuedAttempts=new Set<string>(),consumedCapabilities=new WeakSet<object>();
const retainedFiles=new Map<object,FileState>(),closedFiles=new WeakMap<object,FileState>();
const retainedChildren=new Map<object,ChildState>(),closedChildren=new WeakMap<object,ChildState>();
const timers=new Map<object,{readonly supplier:SupplierBinding;readonly platform:PlatformBinding;cleared:boolean}>();
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_FD_PROOF_SYSTEM_INVALID');};
function defined<T>(value:T|undefined):T{if(value===undefined)return invalid();return value;}
function exact(raw:unknown,keys:readonly string[]){if(!raw||typeof raw!=='object'||types.isProxy(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))return false;const d=Object.getOwnPropertyDescriptors(raw);return Reflect.ownKeys(d).length===keys.length&&keys.every(key=>!!d[key]?.enumerable&&Object.hasOwn(d[key]!,'value'));}
function frozenRecipient(raw:unknown):raw is object{return !!raw&&typeof raw==='object'&&!types.isProxy(raw)&&Object.isFrozen(raw);}
function nodeStat(raw:unknown):raw is Readonly<NegativeLinuxFdProofNodeStat>{if(!exact(raw,['kind','dev','ino','uid','gid','mode','nlink','size','mtimeMs','ctimeMs'])||!Object.isFrozen(raw))return false;const value=raw as NegativeLinuxFdProofNodeStat;
 return ['FILE','OTHER'].includes(value.kind)&&[value.dev,value.ino,value.uid,value.gid,value.mode,value.nlink,value.size].every(Number.isSafeInteger)&&[value.mtimeMs,value.ctimeMs].every(Number.isFinite)
  &&value.dev>=0&&value.ino>0&&value.uid===0&&value.gid===0&&value.kind==='FILE'&&(value.mode&0o170000)===0o100000&&(value.mode&0o7777)===0o755&&value.nlink===1&&value.size>0&&value.size<=67108864;}
function sameStat(left:Readonly<NegativeLinuxFdProofNodeStat>,right:Readonly<NegativeLinuxFdProofNodeStat>){return(['kind','dev','ino','uid','gid','mode','nlink','size','mtimeMs','ctimeMs'] as const).every(key=>left[key]===right[key]);}
function invocationShape(raw:unknown):raw is Readonly<NegativeLinuxFdProofInvocation>{if(!exact(raw,['file','argv0','argv','inheritedFd','shell','env'])||!Object.isFrozen(raw))return false;const value=raw as NegativeLinuxFdProofInvocation;
 return value.file==='/proc/self/fd/3'&&value.argv0==='anvil-ix01-0076-fd-proof'&&Array.isArray(value.argv)&&Object.isFrozen(value.argv)&&value.argv.length===1&&value.argv[0]==='10'
  &&value.inheritedFd===3&&value.shell===false&&exact(value.env,['LANG','LC_ALL','PATH'])&&Object.isFrozen(value.env)&&value.env.LANG==='C'&&value.env.LC_ALL==='C'&&value.env.PATH==='/usr/bin:/bin';}

function bindSupplier(raw:NegativeLinuxFdProofSystemSupplier):SupplierBinding{
 if(!exact(raw,['recipient','attemptId','assertCurrent'])||!Object.isFrozen(raw)||!uuidV1(raw.attemptId))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient?.value;
 if(!frozenRecipient(recipient)||typeof descriptors.assertCurrent?.value!=='function'||issuedAttempts.has(raw.attemptId))invalid();
 const contract=Object.freeze({...current0076NegativeLinuxFdProofSystemContract,attemptId:raw.attemptId});
 const fixedRecipient=defined(recipient);if((descriptors.assertCurrent!.value as NegativeLinuxFdProofSystemSupplier['assertCurrent']).call(fixedRecipient,contract)!==undefined)invalid();
 issuedAttempts.add(raw.attemptId);return {supplier:raw,recipient:fixedRecipient,descriptors,contract};
}
function supplierCurrent(binding:SupplierBinding){const keys=['recipient','attemptId','assertCurrent'] as const;if(keys.some(key=>binding.supplier[key]!==binding.descriptors[key]!.value))invalid();
 if((binding.descriptors.assertCurrent!.value as NegativeLinuxFdProofSystemSupplier['assertCurrent']).call(binding.recipient,binding.contract)!==undefined)invalid();}
function platformShape(raw:NegativeLinuxFdProofNodePorts):PlatformBinding{const keys=['recipient','lstat','open','fstat','readlink','read','spawn','childPid','statPath','on','off','kill','setTimer','clearTimer','close'] as const;
 if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient?.value;if(!frozenRecipient(recipient))invalid();for(const key of keys.slice(1))if(typeof descriptors[key]?.value!=='function')invalid();return {ports:raw,recipient:defined(recipient),descriptors};}
function platformCurrent(binding:PlatformBinding){for(const [key,descriptor] of Object.entries(binding.descriptors))if(binding.ports[key as keyof NegativeLinuxFdProofNodePorts]!==descriptor.value)invalid();}
function callPlatform<T>(binding:PlatformBinding,key:Exclude<keyof NegativeLinuxFdProofNodePorts,'recipient'>,...values:unknown[]):T{platformCurrent(binding);return (binding.descriptors[key]!.value as (...args:unknown[])=>T).call(binding.recipient,...values);}
/** 구조 검산된 supplier에 process-local 단회 capability를 발급한다. 이 함수는 실행 승인이나 보호 entry를 대신하지 않는다. */
export function bind0076NegativeLinuxFdProofSystemSupplier(rawSupplier:NegativeLinuxFdProofSystemSupplier):object{const binding=bindSupplier(rawSupplier),capability=Object.freeze({});capabilities.set(capability,binding);return capability;}

/** 실제 native port의 기본값은 없다. 보호 entry가 별도 결박한 포트만 명시적으로 주입할 수 있다. */
export function create0076NegativeLinuxFdProofSystem(rawCapability:object,rawPorts:NegativeLinuxFdProofNodePorts):NegativeLinuxFdProofSystem{
 if(!rawCapability||typeof rawCapability!=='object'||types.isProxy(rawCapability)||!Object.isFrozen(rawCapability)||consumedCapabilities.has(rawCapability))invalid();const supplier=defined(capabilities.get(rawCapability));
 supplierCurrent(supplier);const platform=platformShape(rawPorts);capabilities.delete(rawCapability);consumedCapabilities.add(rawCapability);const recipient=Object.freeze({});
 let openStarted=false,spawnStarted=false;
 const check=()=>{supplierCurrent(supplier);platformCurrent(platform);};
 const ownedFile=(raw:FileState|undefined)=>{const state=defined(raw);if(state.supplier!==supplier||state.platform!==platform)invalid();return state;};
 const ownedChild=(raw:ChildState|undefined)=>{const state=defined(raw);if(state.supplier!==supplier||state.platform!==platform)invalid();return state;};
 const recheckFile=(state:FileState)=>{const fd=callPlatform<Readonly<NegativeLinuxFdProofNodeStat>>(platform,'fstat',state.fd),path=callPlatform<Readonly<NegativeLinuxFdProofNodeStat>>(platform,'lstat',executable),link=callPlatform<string>(platform,'readlink',`/proc/self/fd/${state.fd}`);
  if(!nodeStat(fd)||!nodeStat(path)||!sameStat(fd,path)||!sameStat(fd,state.initial)||link!==executable)invalid();return fd;};
 const releaseChildListeners=(state:ChildState)=>{for(const [event,listener] of Object.entries(state.listeners))try{callPlatform<void>(platform,'off',state.child,event,listener);}catch{}};
 const system=Object.freeze<NegativeLinuxFdProofSystem>({
  recipient,
  openReadOnly(this:object,path:string){if(this!==recipient||path!==executable||openStarted)invalid();check();openStarted=true;const before=callPlatform<Readonly<NegativeLinuxFdProofNodeStat>>(platform,'lstat',path);if(!nodeStat(before))invalid();
   const fd=callPlatform<number>(platform,'open',path,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);if(!Number.isSafeInteger(fd)||fd<0)invalid();const token=Object.freeze({}),state:FileState={token,fd,initial:before,supplier,platform,closeStarted:false,closeKnown:false};retainedFiles.set(token,state);
   recheckFile(state);check();return token;},
  stat(this:object,handle:object):Readonly<NegativeLinuxFdProofStat>{if(this!==recipient)invalid();check();const state=ownedFile(retainedFiles.get(handle));if(state.closeStarted)invalid();const found=recheckFile(state);check();return Object.freeze({path:executable,realpath:executable,kind:'FILE',dev:found.dev,ino:found.ino,uid:found.uid,gid:found.gid,mode:found.mode,nlink:found.nlink,size:found.size,mtimeMs:found.mtimeMs,ctimeMs:found.ctimeMs});},
  read(this:object,handle:object,offset:number,length:number){if(this!==recipient||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>1048576)invalid();check();const state=ownedFile(retainedFiles.get(handle));if(state.closeStarted||offset+length>state.initial.size)invalid();
   const value=callPlatform<Uint8Array>(platform,'read',state.fd,offset,length);if(!types.isUint8Array(value)||types.isProxy(value)||types.isSharedArrayBuffer(value.buffer)||value.byteLength<1||value.byteLength>length)invalid();check();return value;},
  spawnFromInheritedFd(this:object,handle:object,rawInvocation:Readonly<NegativeLinuxFdProofInvocation>){if(this!==recipient||!invocationShape(rawInvocation)||spawnStarted)invalid();check();const file=ownedFile(retainedFiles.get(handle));if(file.closeStarted)invalid();recheckFile(file);spawnStarted=true;
   const options=Object.freeze({argv0:'anvil-ix01-0076-fd-proof',stdio:Object.freeze(['ignore','ignore','ignore',file.fd]),env:Object.freeze({LANG:'C',LC_ALL:'C',PATH:'/usr/bin:/bin'}),shell:false,detached:false});
   const rawChild=callPlatform<object>(platform,'spawn','/proc/self/fd/3',Object.freeze(['10']),options);if(!rawChild||typeof rawChild!=='object'||types.isProxy(rawChild))invalid();const token=Object.freeze({});let resolve!:(value:Readonly<ChildOutcome>)=>void;const completion=new Promise<Readonly<ChildOutcome>>(found=>{resolve=found;});
   const state={} as ChildState;const error=(..._values:unknown[])=>{state.invalid=true;};const exit=(status:unknown,signal:unknown)=>{if(state.exitSeen){state.invalid=true;return;}state.exitSeen=true;state.exitStatus=status;state.exitSignal=signal;};
   const close=(status:unknown,signal:unknown)=>{if(state.closeSeen){state.invalid=true;return;}state.closeSeen=true;if(!state.exitSeen||status!==state.exitStatus||signal!==state.exitSignal)state.invalid=true;let currentOk=true;try{check();}catch{currentOk=false;state.invalid=true;}
    retainedChildren.delete(token);closedChildren.set(token,state);releaseChildListeners(state);resolve(Object.freeze({ok:currentOk&&!state.invalid&&state.terminateStarted&&status===null&&signal==='SIGTERM',status,signal}));};
   Object.assign(state,{token,child:rawChild,file,supplier,platform,completion,resolve,listeners:Object.freeze({error,exit,close}),pid:null,terminateStarted:false,invalid:false,exitSeen:false,exitStatus:undefined,exitSignal:undefined,closeSeen:false});retainedChildren.set(token,state);
   try{callPlatform<void>(platform,'on',rawChild,'error',error);callPlatform<void>(platform,'on',rawChild,'exit',exit);callPlatform<void>(platform,'on',rawChild,'close',close);check();}catch{state.invalid=true;throw Error('IX01_0076_NEGATIVE_LINUX_FD_PROOF_SYSTEM_CHILD_UNKNOWN');}return token;},
  inspectChild(this:object,child:object){if(this!==recipient)invalid();check();const state=ownedChild(retainedChildren.get(child));if(state.closeSeen)invalid();const pid=callPlatform<number>(platform,'childPid',state.child);if(!Number.isSafeInteger(pid)||pid<1)invalid();state.pid=pid;
   const found=callPlatform<Readonly<NegativeLinuxFdProofNodeStat>>(platform,'statPath',`/proc/${pid}/exe`);if(!nodeStat(found))invalid();check();return Object.freeze({pid,exeDev:found.dev,exeIno:found.ino});},
  terminate(this:object,child:object){if(this!==recipient)invalid();check();const state=ownedChild(retainedChildren.get(child));if(state.closeSeen||state.terminateStarted)invalid();state.terminateStarted=true;let requested=false;try{requested=callPlatform<boolean>(platform,'kill',state.child,'SIGTERM');}catch{state.invalid=true;throw Error('IX01_0076_NEGATIVE_LINUX_FD_PROOF_SYSTEM_TERMINATE_UNKNOWN');}
   if(requested!==true){state.invalid=true;invalid();}check();return 'TERMINATION_REQUESTED';},
  async wait(this:object,child:object){if(this!==recipient)invalid();check();const state=ownedChild(retainedChildren.get(child)??closedChildren.get(child));const outcome=await state.completion;check();if(!outcome.ok)invalid();return Object.freeze({status:null,signal:'SIGTERM',closed:true});},
  setTimer(this:object,callback:()=>void,ms:number){if(this!==recipient||typeof callback!=='function'||!Number.isSafeInteger(ms)||ms<1)invalid();check();const token=callPlatform<object>(platform,'setTimer',callback,ms);if(!token||typeof token!=='object'||types.isProxy(token))invalid();timers.set(token,{supplier,platform,cleared:false});check();return token;},
  clearTimer(this:object,timer:object){if(this!==recipient)invalid();const state=defined(timers.get(timer));if(state.cleared||state.supplier!==supplier||state.platform!==platform)invalid();state.cleared=true;callPlatform<void>(platform,'clearTimer',timer);timers.delete(timer);check();},
  close(this:object,handle:object){if(this!==recipient)invalid();const state=retainedFiles.get(handle)??closedFiles.get(handle);if(!state||state.supplier!==supplier||state.platform!==platform||state.closeStarted)return 'UNKNOWN';check();recheckFile(state);state.closeStarted=true;
   try{callPlatform<void>(platform,'close',state.fd);}catch{return 'UNKNOWN';}state.closeKnown=true;retainedFiles.delete(handle);closedFiles.set(handle,state);try{check();}catch{return 'UNKNOWN';}return 'CLOSED';},
 });
 return system;
}
