import {AuthFailure} from '../access/repository.ts';
import {InstallationResourcePosixAdapter} from './installation-resource-posix.ts';
import type {InstallationPosixBinding,InstallationResourceNativePort} from './installation-resource-posix.ts';
import type {InstallationResourceCatalogPort,PreparedInstallationKeySlot} from './installation-resource-catalog.ts';

/** 신뢰된 설치 담당 경계에서만 주입한다. 파일 reader/native loader 및 운영 verifier는 제공하지 않는다. */
export interface InstallationCatalogProviderSlot {binding:InstallationPosixBinding;absoluteRoot:string;displayName:string;capacityBytes:number;profileVersion:number}
export interface InstallationCatalogProviderSnapshot {installationId:string;slots:InstallationCatalogProviderSlot[]}
export interface InstallationCatalogNativeSnapshot {schemaVersion:1;installationId:string;slots:Array<{binding:InstallationPosixBinding;absoluteRoot:string}>}
export interface InstallationCatalogProviderOptions {
 snapshot:InstallationCatalogProviderSnapshot;
 nativeFactory:(snapshot:InstallationCatalogNativeSnapshot)=>InstallationResourceNativePort;
 verifier:{assertCurrent(snapshot:InstallationCatalogProviderSnapshot):Promise<void>};
}
type Kind='TARGET'|'ENCRYPTION_KEY';
const problem=(code='RESOURCE_UNVERIFIED',status=412)=>new AuthFailure(code,status);
const invalid=()=>problem('INPUT_INVALID',400);
const unknown=()=>problem('RESOURCE_STATE_UNKNOWN',503);
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const number=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const identity=(v:unknown)=>exact(v,['device','inode'])&&[v.device,v.inode].every(x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(x)&&BigInt(x)<=18446744073709551615n);
const clone=<T>(v:T):T=>structuredClone(v);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function readSnapshot(value:unknown):InstallationCatalogProviderSnapshot {
 if(!exact(value,['installationId','slots'])||!uuid(value.installationId)||!Array.isArray(value.slots)||value.slots.length<1||value.slots.length>64)throw invalid();
 const ids=new Set<string>(),roots=new Set<string>(),paths:string[]=[];
 for(const s of value.slots){
  if(!exact(s,['binding','absoluteRoot','displayName','capacityBytes','profileVersion']))throw invalid();const b=s.binding;
  if(!exact(b,['slotId','installationId','purpose','profileRef','expectedRootIdentity','ownerUid'])||!uuid(b.slotId)||b.installationId!==value.installationId||!['BACKUP_TARGET','KEY_VAULT'].includes(b.purpose)||!identity(b.expectedRootIdentity)||(!number(b.ownerUid)||b.ownerUid>4294967295)||!exact(b.profileRef,['id','version','contentHash'])||!uuid(b.profileRef.id)||!number(b.profileRef.version,1)||typeof b.profileRef.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(b.profileRef.contentHash)||s.profileVersion!==b.profileRef.version)throw invalid();
  if(typeof s.displayName!=='string'||!s.displayName.trim()||s.displayName.length>120||/[\u0000-\u001f\u007f]/.test(s.displayName)||!number(s.capacityBytes,b.purpose==='KEY_VAULT'?16384:1024))throw invalid();
  const path=s.absoluteRoot;if(typeof path!=='string'||!path.startsWith('/')||path==='/'||path.includes('\u0000')||Buffer.byteLength(path,'utf8')>4095)throw invalid();
  const parts=path.slice(1).split('/');if(parts.length>256||parts.some((x:string)=>!x||x==='.'||x==='..'||Buffer.byteLength(x,'utf8')>255))throw invalid();
  const root=JSON.stringify([b.expectedRootIdentity.device,b.expectedRootIdentity.inode]);if(ids.has(b.slotId)||roots.has(root)||paths.some(p=>p===path||p.startsWith(path+'/')||path.startsWith(p+'/')))throw invalid();ids.add(b.slotId);roots.add(root);paths.push(path);
 }
 return freeze(clone(value as InstallationCatalogProviderSnapshot));
}
function readKind(value:unknown):Kind{if(value!=='TARGET'&&value!=='ENCRYPTION_KEY')throw invalid();return value;}
const purpose=(kind:Kind)=>kind==='TARGET'?'BACKUP_TARGET':'KEY_VAULT';
const portMethods=['openRoot','inspectRoot','create','open','stat','read','sync','remove','publish','fsyncParent','closeFile','closeRoot'];

class BoundCatalog implements InstallationResourceCatalogPort {
 readonly #snapshot:InstallationCatalogProviderSnapshot;readonly #adapter:InstallationResourcePosixAdapter;readonly #assert:(snapshot:InstallationCatalogProviderSnapshot)=>Promise<void>;
 readonly #active=new Set<Promise<unknown>>();#closing=false;#invalidated=false;#disposed:Promise<void>|null=null;#adapterClose:Promise<void>|null=null;
 constructor(snapshot:InstallationCatalogProviderSnapshot,port:InstallationResourceNativePort,assertCurrent:(snapshot:InstallationCatalogProviderSnapshot)=>Promise<void>){this.#snapshot=snapshot;this.#adapter=new InstallationResourcePosixAdapter(port);this.#assert=assertCurrent;}
 #guard(){if(this.#closing)throw problem();}
 #closeAdapter(){if(!this.#adapterClose){this.#adapterClose=this.#adapter.dispose();void this.#adapterClose.catch(()=>{});}return this.#adapterClose;}
 async #current(){
  this.#guard();if(this.#invalidated)throw problem();
  try{if(await this.#assert(this.#snapshot)!==undefined)throw problem();}catch{this.#invalidated=true;this.#closeAdapter();throw problem();}
  this.#guard();if(this.#invalidated)throw problem();
 }
 #run<T>(body:()=>Promise<T>):Promise<T>{
  try{this.#guard();if(this.#active.size>=32)throw problem('RESOURCE_PROCESSING',409);}catch(e){return Promise.reject(e);}
  const task=Promise.resolve().then(body);this.#active.add(task);void task.then(()=>this.#active.delete(task),()=>this.#active.delete(task));return task;
 }
 #item(slot:InstallationCatalogProviderSlot,verified:boolean){return{slotId:slot.binding.slotId,displayName:slot.displayName,purpose:slot.binding.purpose,profileRef:clone(slot.binding.profileRef),state:verified?'VERIFIED':'UNVERIFIED',reasonCodes:verified?[]:['RESOURCE_UNVERIFIED']};}
 async #slot(slot:InstallationCatalogProviderSlot):Promise<PreparedInstallationKeySlot>{
  const prepared=await this.#adapter.prepareSlot(slot.binding),current=await prepared.rootHandle.inspect(),b=slot.binding;
  if(prepared.slotId!==b.slotId||prepared.installationId!==b.installationId||(prepared.profileRef.id!==b.profileRef.id||prepared.profileRef.version!==b.profileRef.version||prepared.profileRef.contentHash!==b.profileRef.contentHash)||current.identity.device!==b.expectedRootIdentity.device||current.identity.inode!==b.expectedRootIdentity.inode||current.availableBytes<(b.purpose==='KEY_VAULT'?16384:1024)||current.availableInodes<1)throw problem();return prepared;
 }
 list(value:unknown){
  let kind:Kind;try{kind=readKind(value);}catch(e){return Promise.reject(e);}
  return this.#run(async()=>{
   const slots=this.#snapshot.slots.filter(s=>s.binding.purpose===purpose(kind));
   const unavailable=()=>({state:'UNVERIFIED',items:slots.map(s=>this.#item(s,false))});
   try{await this.#current();}catch{this.#guard();return unavailable();}
   const items=[];for(const slot of slots){let verified=false;try{await this.#slot(slot);verified=true;}catch{/* 해당 slot만 사용불가. 원 오류는 보호 DTO에 포함하지 않는다. */}this.#guard();items.push(this.#item(slot,verified));}
   try{await this.#current();}catch{this.#guard();return unavailable();}
   return{state:'CONFIGURED',items};
  });
 }
 prepareSlot(slotId:string,value:unknown):Promise<PreparedInstallationKeySlot>{
  let kind:Kind;try{kind=readKind(value);}catch(e){return Promise.reject(e);}
  return this.#run(async()=>{await this.#current();const slot=this.#snapshot.slots.find(s=>s.binding.slotId===slotId&&s.binding.purpose===purpose(kind));if(!slot)throw problem();let prepared:PreparedInstallationKeySlot;try{prepared=await this.#slot(slot);}catch{throw problem();}await this.#current();return prepared;});
 }
 dispose():Promise<void>{
  if(this.#disposed)return this.#disposed;this.#closing=true;
  this.#disposed=(async()=>{while(this.#active.size)await Promise.allSettled([...this.#active]);try{await this.#closeAdapter();}catch{throw unknown();}})();return this.#disposed;
 }
}

/** 실제 설치 보호 검증/로드를 대신하지 않는 내부 조합. 기본 catalog에는 자동 등록하지 않는다. */
export async function createInstallationResourceCatalogProvider(options:InstallationCatalogProviderOptions):Promise<InstallationResourceCatalogPort>{
 if(!object(options))throw invalid();const snapshot=readSnapshot(options.snapshot);
 if(!object(options.verifier)||typeof options.verifier.assertCurrent!=='function')throw problem();
 if(Object.keys(options).some(k=>!['snapshot','nativeFactory','verifier'].includes(k))||!exact(options.verifier,['assertCurrent'])||typeof options.nativeFactory!=='function')throw invalid();
 const assertCurrent=options.verifier.assertCurrent.bind(options.verifier);
 try{if(await assertCurrent(snapshot)!==undefined)throw problem();}catch{throw problem();}
 const nativeSnapshot=freeze({schemaVersion:1 as const,installationId:snapshot.installationId,slots:snapshot.slots.map(s=>({binding:clone(s.binding),absoluteRoot:s.absoluteRoot}))});
 let port:InstallationResourceNativePort;try{port=options.nativeFactory(nativeSnapshot);if(!object(port)||portMethods.some(k=>typeof (port as any)[k]!=='function'))throw unknown();}catch{throw unknown();}
 return new BoundCatalog(snapshot,port,assertCurrent);
}
