import {AuthFailure} from '../access/repository.ts';
import type {InstallationFileIdentity,InstallationRootInspection,InstallationProbeInspection,InstallationProbeHandle,InstallationVaultRootHandle,PreparedInstallationKeySlot} from './installation-resource-catalog.ts';

/** 서버 내부 주입 포트. 이 모듈은 native 로드·실제 catalog 등록을 수행하지 않는다. */
export interface InstallationPosixBinding {slotId:string;installationId:string;purpose:'BACKUP_TARGET'|'KEY_VAULT';profileRef:{id:string;version:number;contentHash:string};expectedRootIdentity:InstallationFileIdentity;ownerUid:number}
interface NativeInspection {identity:InstallationFileIdentity;kind:string;symlink:boolean;uid:number;gid:number;mode:string}
export interface InstallationNativeRootObservation {binding:InstallationPosixBinding;generation:number;root:InstallationRootInspection;parents:NativeInspection[]}
export interface InstallationNativeFileObservation {generation:number;file:InstallationProbeInspection}
export interface InstallationResourceNativePort {
 openRoot(binding:InstallationPosixBinding):Promise<object>;
 inspectRoot(root:object):Promise<InstallationNativeRootObservation>;
 create(root:object,input:{fileId:string;bytes:Uint8Array;exclusive:true;noFollow:true;mode:number}):Promise<{capability:object;observation:InstallationNativeFileObservation}>;
 open(root:object,fileId:string,input:{noFollow:true}):Promise<{capability:object;observation:InstallationNativeFileObservation}>;
 stat(root:object,file:object):Promise<InstallationNativeFileObservation>;
 read(root:object,file:object,maxBytes:number):Promise<Uint8Array>;
 sync(root:object,file:object):Promise<void>;
 remove(root:object,file:object,expected:InstallationFileIdentity):Promise<{identity:InstallationFileIdentity;removed:true}>;
 publish(root:object,file:object,expected:InstallationFileIdentity,input:{fileId:string;exclusive:true;noFollow:true}):Promise<{identity:InstallationFileIdentity;fileId:string;exclusive:true;temporaryRemoved:true}>;
 fsyncParent(root:object):Promise<void>;
 closeFile(root:object,file:object):Promise<void>;
 closeRoot(root:object):Promise<void>;
}
const problem=(code='RESOURCE_UNVERIFIED',status=412)=>new AuthFailure(code,status);
const unknown=()=>problem('RESOURCE_STATE_UNKNOWN',503);
const input=()=>problem('INPUT_INVALID',400);
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const identity=(v:unknown):v is InstallationFileIdentity=>exact(v,['device','inode'])&&typeof v.device==='string'&&/^[0-9]{1,32}$/.test(v.device)&&typeof v.inode==='string'&&/^[0-9]{1,32}$/.test(v.inode);
const sameId=(a:InstallationFileIdentity,b:InstallationFileIdentity)=>a.device===b.device&&a.inode===b.inode;
const copy=<T>(v:T):T=>structuredClone(v);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
function readBinding(value:unknown):InstallationPosixBinding {
 if(!exact(value,['slotId','installationId','purpose','profileRef','expectedRootIdentity','ownerUid'])||!uuid(value.slotId)||!uuid(value.installationId)||!['BACKUP_TARGET','KEY_VAULT'].includes(value.purpose)||!identity(value.expectedRootIdentity)||!integer(value.ownerUid)||!exact(value.profileRef,['id','version','contentHash'])||!uuid(value.profileRef.id)||!integer(value.profileRef.version,1)||typeof value.profileRef.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(value.profileRef.contentHash))throw input();
 return freeze({slotId:value.slotId,installationId:value.installationId,purpose:value.purpose,profileRef:{id:value.profileRef.id,version:value.profileRef.version,contentHash:value.profileRef.contentHash},expectedRootIdentity:{device:value.expectedRootIdentity.device,inode:value.expectedRootIdentity.inode},ownerUid:value.ownerUid});
}
function readInspection(value:unknown,kind:'file'|'directory',owner:number,root=false):NativeInspection {
 const keys=['identity','kind','symlink','uid','gid','mode',...(root?['availableBytes','availableInodes']:kind==='file'?['bytes']:[])];
 if(!exact(value,keys)||!identity(value.identity)||value.kind!==kind||value.symlink!==false||!integer(value.uid)||!integer(value.gid)||typeof value.mode!=='string'||!/^[0-7]{3}$/.test(value.mode))throw problem();
 if(root||kind==='file'){if(value.uid!==owner||value.gid!==owner||value.mode!==(root?'700':'600'))throw problem();}
 else if(![0,owner].includes(value.uid)||(parseInt(value.mode,8)&0o022)!==0)throw problem();
 if(root&&(!integer(value.availableBytes)||!integer(value.availableInodes)||value.availableBytes<1024||value.availableInodes<1))throw problem();
 if(kind==='file'&&(!integer(value.bytes,1)||value.bytes>16384))throw problem();
 return copy(value as NativeInspection);
}
function readRoot(value:unknown,binding:InstallationPosixBinding):InstallationNativeRootObservation {
 if(!exact(value,['binding','generation','root','parents'])||!integer(value.generation,1)||!Array.isArray(value.parents)||value.parents.length<1||value.parents.length>256)throw problem();
 const got=readBinding(value.binding);if(JSON.stringify(got)!==JSON.stringify(binding))throw problem();
 readInspection(value.root,'directory',binding.ownerUid,true);if(!sameId(value.root.identity,binding.expectedRootIdentity))throw problem();
 for(const parent of value.parents)readInspection(parent,'directory',binding.ownerUid);
 return freeze(copy(value as InstallationNativeRootObservation));
}
function readFile(value:unknown,owner:number):InstallationNativeFileObservation {
 if(!exact(value,['generation','file'])||!integer(value.generation,1))throw problem();readInspection(value.file,'file',owner);return freeze(copy(value as InstallationNativeFileObservation));
}
function track<T>(set:Set<Promise<unknown>>,promise:Promise<T>):Promise<T>{set.add(promise);void promise.then(()=>set.delete(promise),()=>set.delete(promise));return promise;}
async function drain(set:Set<Promise<unknown>>){while(set.size)await Promise.allSettled([...set]);}
interface FileState {cap:object;created:boolean;observation:InstallationNativeFileObservation|null;phase:'OPEN'|'REMOVING'|'REMOVED'|'PUBLISHING'|'PUBLISHED'|'UNKNOWN';closing:boolean;active:Set<Promise<unknown>>;closePromise:Promise<void>|null;handle:InstallationProbeHandle}

class ManagedRoot implements InstallationVaultRootHandle {
 readonly binding:InstallationPosixBinding;
 readonly #port:InstallationResourceNativePort;readonly #cap:object;readonly #adapter:InstallationResourcePosixAdapter;
 readonly #files=new Map<InstallationProbeHandle,FileState>();readonly #active=new Set<Promise<unknown>>();
 #baseline:InstallationNativeRootObservation|null=null;#poison=false;#closing=false;#closed=false;#closePromise:Promise<void>|null=null;
 constructor(adapter:InstallationResourcePosixAdapter,port:InstallationResourceNativePort,cap:object,binding:InstallationPosixBinding){this.#adapter=adapter;this.#port=port;this.#cap=cap;this.binding=binding;}
 async initialize(){this.#baseline=readRoot(await this.#native(()=>this.#port.inspectRoot(this.#cap)),this.binding);}
 #guard(){if(this.#closing||this.#closed||this.#adapter.closing)throw problem();if(this.#poison)throw unknown();}
 #sanitize(error:unknown){if(error instanceof AuthFailure&&['INPUT_INVALID','RESOURCE_UNVERIFIED','RESOURCE_STATE_UNKNOWN','RESOURCE_PROCESSING'].includes(error.message)){if(error.message==='RESOURCE_STATE_UNKNOWN')this.#poison=true;return problem(error.message,error.statusCode);}this.#poison=true;return unknown();}
 async #native<T>(body:()=>Promise<T>):Promise<T>{try{return await body();}catch{this.#poison=true;throw unknown();}}
 #run<T>(body:()=>Promise<T>,file?:FileState):Promise<T>{
  try{this.#guard();}catch(e){return Promise.reject(e);}
  const task=(async()=>{try{return await body();}catch(e){throw this.#sanitize(e);}})();track(this.#active,task);if(file)track(file.active,task);return task;
 }
 async #current(){if(this.#poison)throw unknown();const now=readRoot(await this.#native(()=>this.#port.inspectRoot(this.#cap)),this.binding),before=this.#baseline;if(!before||now.generation!==before.generation||JSON.stringify(now.parents)!==JSON.stringify(before.parents))throw problem();return now;}
 async inspect(){return this.#run(async()=>copy((await this.#current()).root));}
 #file(handle:InstallationProbeHandle,mutable=false):FileState {const f=this.#files.get(handle);if(!f||f.closing)throw problem();if(f.phase==='UNKNOWN'||this.#poison)throw unknown();if(['REMOVING','REMOVED','PUBLISHING'].includes(f.phase)||mutable&&(!f.created||f.phase!=='OPEN'))throw problem();return f;}
 async #stat(f:FileState){const current=readFile(await this.#native(()=>this.#port.stat(this.#cap,f.cap)),this.binding.ownerUid);if(!f.observation||JSON.stringify(current)!==JSON.stringify(f.observation))throw problem();return current;}
 #io<T>(f:FileState,body:()=>Promise<T>):Promise<T>{try{this.#file(f.handle);}catch(e){return Promise.reject(e);}return this.#run(async()=>{await this.#current();await this.#stat(f);const result=await body();await this.#stat(f);await this.#current();return result;},f);}
 async #adopt(reply:unknown,created:boolean):Promise<InstallationProbeHandle>{
  if(!exact(reply,['capability','observation'])||!object(reply.capability))throw unknown();
  this.#adapter.claimCapability(reply.capability);
  const f:FileState={cap:reply.capability,created,observation:null,phase:'OPEN',closing:false,active:new Set(),closePromise:null,handle:null!};
  f.handle=Object.freeze({
   sync:()=>this.#io(f,async()=>{try{await this.#native(()=>this.#port.sync(this.#cap,f.cap));}catch{this.#poison=true;f.phase='UNKNOWN';throw unknown();}}),
   stat:()=>this.#io(f,async()=>copy(f.observation!.file)),
   read:(max:number)=>{if(!integer(max,1)||max>16385)return Promise.reject(input());return this.#io(f,async()=>{const data=await this.#native(()=>this.#port.read(this.#cap,f.cap,max));if(!(data instanceof Uint8Array)||data.byteLength>max||data.byteLength!==Math.min(f.observation!.file.bytes,max))throw unknown();return Uint8Array.from(data);});},
   close:()=>this.#closeFile(f)
  });this.#files.set(f.handle,f);
  try{f.observation=readFile(reply.observation,this.binding.ownerUid);}catch{f.phase='UNKNOWN';this.#poison=true;try{await this.#closeFile(f);}catch{}throw unknown();}
  return f.handle;
 }
 create(value:{fileId:string;bytes:Uint8Array;exclusive:true;noFollow:true;mode:number}):Promise<InstallationProbeHandle>{
  if(!exact(value,['fileId','bytes','exclusive','noFollow','mode'])||!uuid(value.fileId)||!(value.bytes instanceof Uint8Array)||value.bytes.byteLength<1||value.bytes.byteLength>16384||value.exclusive!==true||value.noFollow!==true||value.mode!==0o600)return Promise.reject(input());
  const bytes=Uint8Array.from(value.bytes),fileId=value.fileId;
  const task=this.#run(async()=>{let effect=false,h:InstallationProbeHandle|undefined;try{const current=await this.#current();if(current.root.availableBytes<bytes.length)throw problem();effect=true;h=await this.#adopt(await this.#native(()=>this.#port.create(this.#cap,{fileId,bytes,exclusive:true,noFollow:true,mode:0o600})),true);await this.#current();return h;}catch(e){if(h)try{await this.#closeFile(this.#files.get(h)!);}catch{}if(effect){this.#poison=true;throw unknown();}throw e;}});
  return task.finally(()=>bytes.fill(0));
 }
 open(fileId:string,flags:{noFollow:true}):Promise<InstallationProbeHandle>{
  if(!uuid(fileId)||!exact(flags,['noFollow'])||flags.noFollow!==true)return Promise.reject(input());
  return this.#run(async()=>{let h:InstallationProbeHandle|undefined;await this.#current();try{h=await this.#adopt(await this.#native(()=>this.#port.open(this.#cap,fileId,{noFollow:true})),false);await this.#current();return h;}catch{if(h)try{await this.#closeFile(this.#files.get(h)!);}catch{}this.#poison=true;throw unknown();}});
 }
 #terminal(handle:InstallationProbeHandle,expected:InstallationFileIdentity,kind:'REMOVE'|'PUBLISH',destination?:string):Promise<void>{
  let f:FileState;try{this.#guard();f=this.#file(handle,true);if(!identity(expected)||!f.observation||!sameId(expected,f.observation.file.identity))throw problem();if(f.active.size)throw problem('RESOURCE_PROCESSING',409);}catch(e){return Promise.reject(e);}
  const fixed=copy(expected);f.phase=kind==='REMOVE'?'REMOVING':'PUBLISHING';
  return this.#run(async()=>{try{
   await this.#current();await this.#stat(f);
   if(kind==='REMOVE'){const result=await this.#native(()=>this.#port.remove(this.#cap,f.cap,copy(fixed)));if(!exact(result,['identity','removed'])||!identity(result.identity)||!sameId(result.identity,fixed)||result.removed!==true)throw unknown();f.phase='REMOVED';}
   else{const result=await this.#native(()=>this.#port.publish(this.#cap,f.cap,copy(fixed),{fileId:destination!,exclusive:true,noFollow:true}));if(!exact(result,['identity','fileId','exclusive','temporaryRemoved'])||!identity(result.identity)||!sameId(result.identity,fixed)||result.fileId!==destination||result.exclusive!==true||result.temporaryRemoved!==true)throw unknown();f.phase='PUBLISHED';}
   await this.#current();
  }catch{f.phase='UNKNOWN';this.#poison=true;throw unknown();}},f);
 }
 remove(handle:InstallationProbeHandle,expected:InstallationFileIdentity){return this.#terminal(handle,expected,'REMOVE');}
 publish(handle:InstallationProbeHandle,expected:InstallationFileIdentity,value:{fileId:string;exclusive:true;noFollow:true}){if(this.binding.purpose!=='KEY_VAULT')return Promise.reject(problem());if(!exact(value,['fileId','exclusive','noFollow'])||!uuid(value.fileId)||value.exclusive!==true||value.noFollow!==true)return Promise.reject(input());return this.#terminal(handle,expected,'PUBLISH',value.fileId);}
 fsyncParent(){return this.#run(async()=>{try{await this.#current();await this.#native(()=>this.#port.fsyncParent(this.#cap));await this.#current();}catch{this.#poison=true;throw unknown();}});}
 #closeFile(f:FileState):Promise<void>{
  if(f.closePromise)return f.closePromise;f.closing=true;
  f.closePromise=track(this.#active,(async()=>{await drain(f.active);try{await this.#port.closeFile(this.#cap,f.cap);}catch{f.phase='UNKNOWN';this.#poison=true;throw unknown();}})());return f.closePromise;
 }
 dispose():Promise<void>{
  if(this.#closePromise)return this.#closePromise;this.#closing=true;
  this.#closePromise=(async()=>{await drain(this.#active);let failed=false;for(const f of this.#files.values())try{await this.#closeFile(f);}catch{failed=true;}
   try{await this.#port.closeRoot(this.#cap);}catch{failed=true;}this.#closed=true;if(failed)throw unknown();})();return this.#closePromise;
 }
}

/** 내부 port 검증용이며 실제 catalog에 자동 등록하거나 native를 로드하지 않는다. */
export class InstallationResourcePosixAdapter {
 readonly #port:InstallationResourceNativePort;readonly #slots=new Map<string,{binding:InstallationPosixBinding;promise:Promise<PreparedInstallationKeySlot>}>();
 readonly #rootOwners=new Map<string,string>();readonly #capabilities=new WeakSet<object>();readonly #roots=new Set<ManagedRoot>();readonly #preparing=new Set<Promise<unknown>>();
 #closing=false;#disposed:Promise<void>|null=null;
 constructor(port:InstallationResourceNativePort){this.#port=port;}
 get closing(){return this.#closing;}
 claimCapability(cap:object){if(this.#capabilities.has(cap))throw unknown();this.#capabilities.add(cap);}
 prepareSlot(value:InstallationPosixBinding):Promise<PreparedInstallationKeySlot>{
  if(this.#closing)return Promise.reject(problem());let binding:InstallationPosixBinding;try{binding=readBinding(value);}catch(e){return Promise.reject(e);}
  const key=JSON.stringify([binding.installationId,binding.slotId]),previous=this.#slots.get(key);
  if(previous)return JSON.stringify(previous.binding)===JSON.stringify(binding)?previous.promise:Promise.reject(problem());
  const rootKey=JSON.stringify([binding.expectedRootIdentity.device,binding.expectedRootIdentity.inode]),owner=this.#rootOwners.get(rootKey);if(owner&&owner!==key)return Promise.reject(problem());this.#rootOwners.set(rootKey,key);
  const pending=(async()=>{let managed:ManagedRoot|undefined;try{let cap:object;try{cap=await this.#port.openRoot(copy(binding));}catch{throw unknown();}if(!object(cap))throw unknown();this.claimCapability(cap);managed=new ManagedRoot(this,this.#port,cap,binding);this.#roots.add(managed);await managed.initialize();return freeze({slotId:binding.slotId,installationId:binding.installationId,profileRef:copy(binding.profileRef),expectedRootIdentity:copy(binding.expectedRootIdentity),ownerUid:binding.ownerUid,rootHandle:managed});}
   catch(e){if(managed)try{await managed.dispose();}catch{throw unknown();}if(e instanceof AuthFailure&&e.message==='RESOURCE_UNVERIFIED')throw problem();throw unknown();}})();
  this.#slots.set(key,{binding,promise:pending});return track(this.#preparing,pending);
 }
 dispose():Promise<void>{if(this.#disposed)return this.#disposed;this.#closing=true;this.#disposed=(async()=>{await drain(this.#preparing);let failed=false;for(const root of this.#roots)try{await root.dispose();}catch{failed=true;}if(failed)throw unknown();})();return this.#disposed;}
}
