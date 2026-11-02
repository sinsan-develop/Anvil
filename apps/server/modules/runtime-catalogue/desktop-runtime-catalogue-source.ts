import {types} from 'node:util';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {catalogueExact,readRuntimeCatalogueProfile,readDesktopRuntimeCatalogue,type Data} from '../../../../contracts/runtime/desktop-runtime-catalogue-v1.ts';
import type {RuntimeCatalogueReadSource} from './desktop-runtime-catalogue-routes.ts';
export interface CatalogueDeploymentPorts {
 readBuild(ref:RuntimeRefV1):Promise<{ref:RuntimeRefV1;snapshot:Data}>;
 readVerification(ref:RuntimeRefV1):Promise<{ref:RuntimeRefV1;snapshot:Data}>;
 readHelper(hash:string):Promise<Buffer>;
 readHead(profileId:string,parentReleaseId:string):Promise<Data|null>;
 compareAndSwap(profileId:string,parentReleaseId:string,previous:RuntimeRefV1|null,value:Data):Promise<void>;
}
const unavailable=():never=>{throw Error('RUNTIME_CATALOGUE_UNAVAILABLE');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function snapshot(value:unknown,depth=0):any {if(types.isProxy(value)||depth>32)return unavailable();if(value===null||typeof value!=='object')return value;if(![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(value)))return unavailable();const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);if(keys.length>128)return unavailable();const out:any=Array.isArray(value)?[]:Object.create(null);for(const key of keys){if(Array.isArray(value)&&key==='length')continue;if(typeof key!=='string')return unavailable();const d=descriptors[key];if(!d||!d.enumerable||!('value'in d))return unavailable();Object.defineProperty(out,key,{value:snapshot(d.value,depth+1),enumerable:true,writable:true,configurable:true});}return out;}

function owned<T extends object>(v:T,key:keyof T):unknown{if(types.isProxy(v))return unavailable();const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d))return unavailable();return d.value;}
export class DesktopRuntimeCatalogueSource implements RuntimeCatalogueReadSource {
 readonly assurance='MODEL_ONLY' as const;
 #profile:Data;#ports:CatalogueDeploymentPorts|null;#functions:unknown[];#clock:()=>number;#last=-Infinity;#busy=false;#poisoned=false;
 constructor(profileInput:unknown,ports:CatalogueDeploymentPorts|null=null,now:()=>number=Date.now){this.#profile=readRuntimeCatalogueProfile(snapshot(profileInput));this.#ports=ports;this.#clock=now;this.#functions=ports?this.#names.map(k=>owned(ports,k)):[];}
 readonly #names=['readBuild','readVerification','readHelper','readHead','compareAndSwap'] as const;
 #stable(){const p=this.#ports;if(!p||this.#functions.some((f,i)=>typeof f!=='function'||owned(p,this.#names[i]!)!==f))return unavailable();const now=this.#clock();if(!Number.isSafeInteger(now)||now<this.#last)return unavailable();this.#last=now;return{p,now};}
 async #run<T>(work:(check:()=>number,call:<V>(key:keyof CatalogueDeploymentPorts,args:unknown[])=>Promise<V>,observed:()=>number)=>Promise<T>,ceiling:()=>number=()=>Infinity):Promise<T>{
 let active=true,timer:ReturnType<typeof setTimeout>|undefined,armed=Infinity;
 const firstWall=this.#stable().now,firstMono=performance.now();if(!Number.isFinite(firstMono))unavailable();
 let previousMono=firstMono,effectiveWall=firstWall,observedWall=firstWall,wallDeadline=firstWall+10000,monoDeadline=firstMono+10000;
 const control:{reject:(error:Error)=>void}={reject:error=>{throw error;}};
 const timeout=new Promise<T>((_resolve,reject)=>{control.reject=reject;});
 const check=()=>{if(!active)unavailable();const wall=this.#stable().now,mono=performance.now();if(!Number.isFinite(mono)||mono<previousMono)unavailable();effectiveWall=Math.max(wall,effectiveWall+(mono-previousMono));previousMono=mono;observedWall=wall;
  wallDeadline=Math.min(wallDeadline,ceiling());monoDeadline=Math.min(monoDeadline,mono+Math.max(0,wallDeadline-effectiveWall));
  const remaining=Math.min(monoDeadline-mono,wallDeadline-effectiveWall);if(!Number.isFinite(remaining)||remaining<1){active=false;return unavailable();}
  if(monoDeadline<armed){if(timer!==undefined)clearTimeout(timer);armed=monoDeadline;timer=setTimeout(()=>{active=false;control.reject(Error('RUNTIME_CATALOGUE_UNAVAILABLE'));},Math.max(1,Math.ceil(remaining)));}
  return Math.ceil(effectiveWall);
 };
 const call=async<V>(key:keyof CatalogueDeploymentPorts,args:unknown[])=>{check();const p=this.#ports;const value=await Reflect.apply(this.#functions[this.#names.indexOf(key)] as Function,p,args) as V;check();return value;};
 try{check();const operation=Promise.resolve().then(()=>work(check,call,()=>observedWall));return await Promise.race([operation,timeout]);}finally{active=false;if(timer!==undefined)clearTimeout(timer);}
 }
 async #proof(value:Data,check:()=>number,call:<V>(key:keyof CatalogueDeploymentPorts,args:unknown[])=>Promise<V>){
 const evidence=value.snapshot.buildEvidence;
 const buildRaw=await call<{ref:RuntimeRefV1;snapshot:Data}>('readBuild',[cloneV1(evidence.buildReceiptRef)]),verificationRaw=await call<{ref:RuntimeRefV1;snapshot:Data}>('readVerification',[cloneV1(evidence.verificationReceiptRef)]);
 const b=catalogueExact(snapshot(buildRaw),'ref,snapshot'),v=catalogueExact(snapshot(verificationRaw),'ref,snapshot');if(!same(b.ref,evidence.buildReceiptRef)||!same(v.ref,evidence.verificationReceiptRef)||!refV1(b.ref)||!refV1(v.ref)||contentHash(canonicalJson(b.snapshot))!==b.ref.contentHash||contentHash(canonicalJson(v.snapshot))!==v.ref.contentHash)unavailable();
 catalogueExact(b.snapshot,'schemaVersion,purpose,sourceCommit,sourceClosureHash,compileInputHash,toolchainHash,helperHash,parentBasisHash,parent');catalogueExact(v.snapshot,'schemaVersion,purpose,buildReceiptRef,helperHash,parentBasisHash,parent,entryPoint,resourceName');
 if(b.snapshot.schemaVersion!==1||b.snapshot.purpose!=='DESKTOP_TRUST_BUILD_RECEIPT'||v.snapshot.schemaVersion!==1||v.snapshot.purpose!=='DESKTOP_TRUST_VERIFICATION_RECEIPT'||!same(v.snapshot.buildReceiptRef,b.ref)||!same(b.snapshot.parent,value.snapshot.parent)||!same(v.snapshot.parent,value.snapshot.parent))unavailable();for(const key of ['sourceCommit','sourceClosureHash','compileInputHash','toolchainHash'])if(b.snapshot[key]!==evidence[key])unavailable();
 for(const e of value.snapshot.entries){if(e.sha256!==b.snapshot.helperHash||e.parentBasisHash!==b.snapshot.parentBasisHash||v.snapshot.helperHash!==e.sha256||v.snapshot.parentBasisHash!==e.parentBasisHash||v.snapshot.entryPoint!==e.entryPoint||v.snapshot.resourceName!==e.resourceName)unavailable();const raw=await call<Buffer>('readHelper',[e.sha256]);if(types.isProxy(raw)||!Buffer.isBuffer(raw)||Object.getPrototypeOf(raw)!==Buffer.prototype||Object.getOwnPropertyDescriptor(raw,'length')||Object.getOwnPropertyDescriptor(raw,'byteLength'))unavailable();const size=Reflect.apply(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')!.get!,raw,[]);if(size!==e.bytes||size>67108864)unavailable();const copy=Buffer.alloc(size);Reflect.apply(Uint8Array.prototype.set,copy,[raw]);try{if(contentHash(copy)!==e.sha256)unavailable();}finally{copy.fill(0);}}
 readDesktopRuntimeCatalogue(value,this.#profile,value.snapshot.parent.releaseId,check());
 }
 async publish(raw:unknown,expected:RuntimeRefV1|null):Promise<Data>{raw=snapshot(raw);expected=snapshot(expected);if(this.#busy||this.#poisoned)unavailable();this.#busy=true;let committing=false,expires=Infinity;try{return await this.#run(async(check,call)=>{const before=check(),r=readDesktopRuntimeCatalogue(raw,this.#profile,(catalogueExact(raw,'schemaVersion,purpose,profileId,sequence,previousRef,releaseRef,snapshot').snapshot as Data).parent.releaseId,before);expires=Date.parse(r.snapshot.expiresAt);check();const expectedCopy=expected===null?null:cloneV1(expected);if(expectedCopy!==null&&!refV1(expectedCopy)||!same(r.previousRef,expectedCopy))unavailable();const parent=r.snapshot.parent.releaseId,head=await call<Data|null>('readHead',[r.profileId,parent]);if(head!==null){const old=readDesktopRuntimeCatalogue(snapshot(head),this.#profile,parent,check());if(!same(old.releaseRef,expectedCopy)||r.sequence!==old.sequence+1)unavailable();if(r.snapshot.parent.releaseVersion===old.snapshot.parent.releaseVersion&&!same(r.snapshot.parent,old.snapshot.parent))unavailable();}else if(expectedCopy!==null||r.sequence!==1)unavailable();await this.#proof(r,check,call);committing=true;await call<void>('compareAndSwap',[r.profileId,parent,expectedCopy,cloneV1(r)]);const saved=await call<Data|null>('readHead',[r.profileId,parent]);if(!same(saved,r))unavailable();readDesktopRuntimeCatalogue(saved,this.#profile,parent,check());return cloneV1(r);},()=>expires);}catch(error){if(committing)this.#poisoned=true;throw error;}finally{this.#busy=false;}}
 async read(profileId:string,parentReleaseId:string):Promise<{profile:Data;value:Data;observedAt:number}>{if(this.#poisoned)unavailable();let expires=Infinity;return this.#run(async(check,call,observed)=>{if(this.#poisoned||profileId!==this.#profile.profileId)unavailable();const raw=await call<Data|null>('readHead',[profileId,parentReleaseId]);if(raw===null)unavailable();const value=readDesktopRuntimeCatalogue(snapshot(raw),this.#profile,parentReleaseId,check());expires=Date.parse(value.snapshot.expiresAt);check();await this.#proof(value,check,call);const current=await call<Data|null>('readHead',[profileId,parentReleaseId]);check();if(this.#poisoned||!same(snapshot(current),value))unavailable();readDesktopRuntimeCatalogue(value,this.#profile,parentReleaseId,check());return{profile:cloneV1(this.#profile),value,observedAt:observed()};},()=>expires);}
}
