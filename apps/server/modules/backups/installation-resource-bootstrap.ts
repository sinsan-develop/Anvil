import {constants as osConstants,release} from 'node:os';
import {AuthFailure} from '../access/repository.ts';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {openProtectedInstallationFile} from './installation-resource-protected-files.ts';
import type {ProtectedFileDescriptor,ProtectedFileCapability} from './installation-resource-protected-files.ts';
import {createInstallationResourceCatalogProvider,readInstallationCatalogProviderSnapshot} from './installation-resource-catalog-provider.ts';
import type {InstallationCatalogProviderSnapshot} from './installation-resource-catalog-provider.ts';
import type {InstallationResourceCatalogPort} from './installation-resource-catalog.ts';
import type {InstallationResourceNativePort} from './installation-resource-posix.ts';

export interface InstallationBuildIdentity {sourceCommit:string;sourceSha256:string;compiler:{id:string;version:string;flags:string[]};artifactSha256:string;platform:'linux';arch:'x64';node:'24.22.1';napi:8;minimumGlibc:'2.28';minimumKernel:'4.18'}
export interface InstallationBootstrapRuntime {platform:string;arch:string;node:string;napi:string;kernel:string;glibc:string;uid:number;euid:number;pid:number}
export interface InstallationBootstrapEvidence {catalogDescriptor:ProtectedFileDescriptor;artifactDescriptor:ProtectedFileDescriptor;buildIdentity:InstallationBuildIdentity;runtimeObservation:InstallationBootstrapRuntime;snapshot:InstallationCatalogProviderSnapshot}
export interface InstallationBootstrapInput {catalogDescriptor:ProtectedFileDescriptor;artifactDescriptor:ProtectedFileDescriptor;buildIdentity:InstallationBuildIdentity;installerVerifier:{assertCurrent(evidence:InstallationBootstrapEvidence):Promise<void>}}
export interface InstallationBootstrapDependencies {openFile?:(descriptor:ProtectedFileDescriptor)=>Promise<ProtectedFileCapability>;load?:(heldFdPath:string)=>unknown;runtime?:()=>InstallationBootstrapRuntime}
const problem=(code='RESOURCE_UNVERIFIED',status=412)=>new AuthFailure(code,status),invalid=()=>problem('INPUT_INVALID',400),unknown=()=>problem('RESOURCE_STATE_UNKNOWN',503);
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const decimal=(v:unknown)=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.isWellFormed()&&Buffer.byteLength(v)>=1&&Buffer.byteLength(v)<=max&&!/[\u0000-\u001f\u007f]/.test(v);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function fixed<T>(v:T):T{try{return freeze(JSON.parse(canonicalJson(v)));}catch{throw invalid();}}
function readDescriptor(value:unknown,kind:'CATALOG'|'ARTIFACT'):ProtectedFileDescriptor {
 if(!exact(value,['absolutePath','expectedIdentity','expectedSha256','sizeBytes','kind'])||value.kind!==kind||!exact(value.expectedIdentity,['device','inode'])||!decimal(value.expectedIdentity.device)||!decimal(value.expectedIdentity.inode)||!sha(value.expectedSha256)||!integer(value.sizeBytes,1,kind==='CATALOG'?1048576:16777216))throw invalid();
 const path=value.absolutePath;if(!text(path,4095)||!path.startsWith('/')||path==='/')throw invalid();const parts=path.slice(1).split('/');if(parts.length>256||parts.some(x=>!x||x==='.'||x==='..'||Buffer.byteLength(x)>255))throw invalid();return fixed(value as ProtectedFileDescriptor);
}
function readBuild(value:unknown,artifact:ProtectedFileDescriptor):InstallationBuildIdentity {
 if(!exact(value,['sourceCommit','sourceSha256','compiler','artifactSha256','platform','arch','node','napi','minimumGlibc','minimumKernel'])||typeof value.sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(value.sourceCommit)||!sha(value.sourceSha256)||value.artifactSha256!==artifact.expectedSha256||value.platform!=='linux'||value.arch!=='x64'||value.node!=='24.22.1'||value.napi!==8||value.minimumGlibc!=='2.28'||value.minimumKernel!=='4.18'||!exact(value.compiler,['id','version','flags'])||!text(value.compiler.id,64)||!text(value.compiler.version,128)||!Array.isArray(value.compiler.flags)||value.compiler.flags.length<1||value.compiler.flags.length>32||value.compiler.flags.some((f:unknown)=>!text(f,256)))throw invalid();return fixed(value as InstallationBuildIdentity);
}
function atLeast(value:unknown,major:number,minor:number){if(!text(value,128))return false;const m=/^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})(?:\.(0|[1-9][0-9]{0,8}))?(?:[-+.][A-Za-z0-9][A-Za-z0-9._+-]*)?$/.exec(value);return !!m&&(Number(m[1])>major||Number(m[1])===major&&Number(m[2])>=minor);}
function readRuntime(value:unknown):InstallationBootstrapRuntime {
 if(!exact(value,['platform','arch','node','napi','kernel','glibc','uid','euid','pid'])||value.platform!=='linux'||value.arch!=='x64'||value.node!=='24.22.1'||typeof value.napi!=='string'||!/^\d{1,3}$/.test(value.napi)||Number(value.napi)<8||!atLeast(value.kernel,4,18)||!atLeast(value.glibc,2,28)||!integer(value.uid,1,4294967295)||value.uid!==value.euid||!integer(value.pid,1,2147483647))throw problem();try{return fixed(value as InstallationBootstrapRuntime);}catch{throw problem();}
}
const defaultRuntime=():InstallationBootstrapRuntime=>{
 // 보고서 객체/환경/경로를 저장하거나 출력하지 않고 glibc 관측값만 소비한다.
 const report=process.report.getReport(),glibc=typeof report==='object'&&report!==null?(report as any).header?.glibcVersionRuntime:undefined;
 return{platform:process.platform,arch:process.arch,node:process.versions.node,napi:process.versions.napi??'',kernel:release(),glibc:typeof glibc==='string'?glibc:'',uid:process.getuid?.()??0,euid:process.geteuid?.()??0,pid:process.pid};
};
const defaultLoad=(heldFdPath:string):unknown=>{const module={exports:{}};process.dlopen(module as any,heldFdPath,osConstants.dlopen.RTLD_NOW);return module.exports;};
// 기본 함수의 identity는 module 수명 동안 고정이다. 주입 함수는 합성 시험에만 사용한다.
const attemptedLoaders=new WeakSet<Function>();
function cap(value:unknown):ProtectedFileCapability {
 const names=['readCatalog','withArtifactFile','assertCurrent','dispose'];if(!exact(value,names)||names.some(n=>typeof Object.getOwnPropertyDescriptor(value,n)?.value!=='function'))throw problem();return value as unknown as ProtectedFileCapability;
}
function safe(error:unknown){if(error instanceof AuthFailure&&[['INPUT_INVALID',400],['RESOURCE_UNVERIFIED',412],['RESOURCE_PROCESSING',409],['RESOURCE_STATE_UNKNOWN',503]].some(([c,s])=>error.message===c&&error.statusCode===s))return problem(error.message,error.statusCode);return problem();}

function ownData(value:unknown,allowed:string[]):Record<string,unknown> {
 if(!object(value)||Object.getOwnPropertySymbols(value).length)throw invalid();const fields=Object.getOwnPropertyDescriptors(value),result:Record<string,unknown>=Object.create(null);
 for(const [key,d] of Object.entries(fields)){if(!allowed.includes(key)||!d.enumerable||!('value' in d))throw invalid();result[key]=d.value;}return result;
}
function preflight(value:unknown,dependencies:unknown){
 try{
  const input=ownData(value,['catalogDescriptor','artifactDescriptor','buildIdentity','installerVerifier']),injected=ownData(dependencies,['openFile','load','runtime']);
  // canonicalJson은 own data descriptor를 검사하므로 getter를 실행해 복사하지 않는다.
  const catalogDescriptor=readDescriptor(fixed(input.catalogDescriptor),'CATALOG'),artifactDescriptor=readDescriptor(fixed(input.artifactDescriptor),'ARTIFACT'),buildIdentity=readBuild(fixed(input.buildIdentity),artifactDescriptor);
  if(catalogDescriptor.absolutePath===artifactDescriptor.absolutePath||catalogDescriptor.expectedIdentity.device===artifactDescriptor.expectedIdentity.device&&catalogDescriptor.expectedIdentity.inode===artifactDescriptor.expectedIdentity.inode)throw invalid();
  const owner=input.installerVerifier,method=object(owner)?ownData(owner,['assertCurrent']).assertCurrent:undefined;
  const installer=typeof method==='function'?(e:InstallationBootstrapEvidence):Promise<void>=>Reflect.apply(method,owner,[e]):null;
  const openFile=injected.openFile??openProtectedInstallationFile,load=injected.load??defaultLoad,observe=injected.runtime??defaultRuntime;
  if(typeof openFile!=='function'||typeof load!=='function'||typeof observe!=='function')throw invalid();
  return{catalogDescriptor,artifactDescriptor,buildIdentity,installer,openFile:openFile as NonNullable<InstallationBootstrapDependencies['openFile']>,load:load as NonNullable<InstallationBootstrapDependencies['load']>,observe:observe as NonNullable<InstallationBootstrapDependencies['runtime']>};
 }catch{throw invalid();}
}
/** 설치 실행/등록은 하지 않는다. 신뢰된 고정 descriptor와 설치 검증기가 있어야 호출 가능하다. */
export async function bootstrapInstallationResourceCatalog(value:InstallationBootstrapInput,dependencies:InstallationBootstrapDependencies={}):Promise<InstallationResourceCatalogPort>{
 const {catalogDescriptor,artifactDescriptor,buildIdentity,installer,openFile,load,observe}=preflight(value,dependencies);if(!installer)throw problem();
 let runtimeObservation:InstallationBootstrapRuntime;try{runtimeObservation=readRuntime(observe());}catch{throw problem();}
 if(attemptedLoaders.has(load))throw unknown();
 let catalogCap:ProtectedFileCapability|null=null,artifactCap:ProtectedFileCapability|null=null,provider:InstallationResourceCatalogPort|null=null,loadStarted=false,closing=false,active:Promise<unknown>|null=null,disposed:Promise<void>|null=null;
 const closeOwned=async()=>{let failed=false;try{await provider?.dispose?.();}catch{failed=true;}const unique=new Set<ProtectedFileCapability>();for(const owned of [artifactCap,catalogCap])if(owned&&!unique.has(owned)){unique.add(owned);try{await owned.dispose();}catch{failed=true;}}if(failed)throw unknown();};
 try{
  catalogCap=cap(await openFile(catalogDescriptor));const raw=await catalogCap.readCatalog();let snapshot:InstallationCatalogProviderSnapshot;
  try{if(!(raw instanceof Uint8Array)||raw.length!==catalogDescriptor.sizeBytes||raw.length>1048576||contentHash(raw)!==catalogDescriptor.expectedSha256)throw problem();const json=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);if(json.startsWith('\uFEFF')||json.includes('\u0000'))throw problem();snapshot=readInstallationCatalogProviderSnapshot(parseWireJson(json));}catch{throw problem();}
  artifactCap=cap(await openFile(artifactDescriptor));if(artifactCap===catalogCap)throw problem();
  const evidence=freeze({catalogDescriptor,artifactDescriptor,buildIdentity,runtimeObservation,snapshot});
  const current=async(s:InstallationCatalogProviderSnapshot)=>{
   if(canonicalJson(s)!==canonicalJson(snapshot))throw problem();
   await catalogCap!.assertCurrent();await artifactCap!.assertCurrent();
   let now:InstallationBootstrapRuntime;try{now=readRuntime(observe());}catch{throw problem();}if(canonicalJson(now)!==canonicalJson(runtimeObservation))throw problem();if(await installer(evidence)!==undefined)throw problem();
  };
  await current(snapshot);
  const exports=await artifactCap.withArtifactFile(async heldFdPath=>{
   if(typeof heldFdPath!=='string'||!/^\/proc\/self\/fd\/(0|[1-9][0-9]{0,9})$/.test(heldFdPath)||Number(heldFdPath.split('/').at(-1))>2147483647)throw problem();
   if(attemptedLoaders.has(load))throw unknown();attemptedLoaders.add(load);loadStarted=true;return load(heldFdPath);
  });
  if(!exact(exports,['createInstallationResourceNativePort'])||typeof Object.getOwnPropertyDescriptor(exports,'createInstallationResourceNativePort')?.value!=='function')throw unknown();
  const nativeFactory=exports.createInstallationResourceNativePort as (snapshot:unknown)=>InstallationResourceNativePort;
  provider=await createInstallationResourceCatalogProvider({snapshot,nativeFactory,verifier:{assertCurrent:current}});
  const run=<T>(body:()=>T|Promise<T>):Promise<T>=>{
   if(closing)return Promise.reject(problem());if(active)return Promise.reject(problem('RESOURCE_PROCESSING',409));
   const task=Promise.resolve().then(async()=>{try{if(closing)throw problem();const result=await body();if(closing)throw problem();return result;}catch(e){throw safe(e);}});active=task;void task.then(()=>{if(active===task)active=null;},()=>{if(active===task)active=null;});return task;
  };
  const dispose=():Promise<void>=>{if(disposed)return disposed;closing=true;const accepted=active;disposed=(async()=>{if(accepted)try{await accepted;}catch{/* 원 요청 오류는 원 Promise에 보존한다. */}await closeOwned();})();return disposed;};
  return Object.freeze({list:(kind:'TARGET'|'ENCRYPTION_KEY')=>run(()=>provider!.list(kind)),prepareSlot:(slotId:string,kind:unknown)=>run(()=>provider!.prepareSlot(slotId,kind)),dispose});
 }catch(e){closing=true;try{await closeOwned();}catch{throw unknown();}if(loadStarted)throw unknown();throw safe(e);}
}
