'use strict';
const {readDesktopTrustCompilerProduct}=require('./desktop-trust-key-host-compiler.cjs');
const {readRuntimeCatalogueProfile,readDesktopRuntimeCatalogue,canonicalJson,contentHash,catalogueExact}=require('../src/runtime-catalogue-profile.cjs');
const {types}=require('node:util');
/** @type {WeakMap<object,{profile:any,value:any,build:any,verification:any,helper:Buffer}>} */const publications=new WeakMap();
/** @returns {never} */function unavailable(){throw Error('RUNTIME_CATALOGUE_UNAVAILABLE');}
/** @param {any} v @param {string} k */function own(v,k){if(!v||typeof v!=='object'||types.isProxy(v))return unavailable();const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))return unavailable();return d.value;}
/** @param {any} v */function clone(v){return JSON.parse(canonicalJson(v));}
/** @param {any} v */function freeze(v){if(v&&typeof v==='object'){for(const key of Object.keys(v))freeze(v[key]);Object.freeze(v);}return v;}
/** 원 발급 객체만 deployment 보호 포트로 전달한다. 재시작 뒤 원행은 보호 store가 복원한다.
 * @param {unknown} publication
 */
function readDesktopRuntimePublication(publication){if(!publication||typeof publication!=='object')return unavailable();const value=publications.get(publication);if(!value)return unavailable();return{profile:clone(value.profile),value:clone(value.value),build:clone(value.build),verification:clone(value.verification),helper:Buffer.from(value.helper)};}
/** 보호 build/deployment의 명시 조립이다. 공개 write API와 기본 등록은 없다.
 * @param {any} profileInput @param {any} parentInput @param {any} ports
 */
function createDesktopRuntimeCataloguePublisher(profileInput,parentInput,ports){const profile=readRuntimeCatalogueProfile(profileInput),parent=clone(catalogueExact(parentInput,'releaseId,releaseVersion,exeName,exeHash,asarPath,asarHash,headerHash'));const names=['readHead','readHistorical','commit','readCommitted','now'];const functions=names.map(n=>own(ports,n));if(functions.some(f=>typeof f!=='function'))return unavailable();let busy=false,poisoned=false,last=-Infinity;
/** @param {unknown} result @param {any} metadata @param {any} expected */
async function publish(result,metadata,expected){if(busy||poisoned)return unavailable();const m=clone(catalogueExact(metadata,'sourceCommit,releaseId,releaseVersion,issuedAt,expiresAt,state,rollbackOf,buildReceiptId,verificationReceiptId'));busy=true;let active=true,committing=false;const start=performance.now(),firstWall=Reflect.apply(functions[4],ports,[]),expiry=Date.parse(m.expiresAt);if(!Number.isSafeInteger(firstWall)||!Number.isSafeInteger(expiry)||expiry<=firstWall){busy=false;return unavailable();}let monoEnd=start+Math.min(10000,expiry-firstWall),lastMono=start,scheduledEnd=Infinity;
/** @type {(mono:number)=>void} */
let arm=()=>{};
const check=()=>{if(!active||names.some((n,i)=>own(ports,n)!==functions[i]))return unavailable();const mono=performance.now(),now=Reflect.apply(functions[4],ports,[]);if(!Number.isFinite(mono)||mono<lastMono||!Number.isSafeInteger(now)||now<last)return unavailable();lastMono=mono;last=now;const effective=Math.max(now,firstWall+mono-start);monoEnd=Math.min(monoEnd,mono+Math.max(0,expiry-effective));if(mono>=monoEnd||effective>=expiry)return unavailable();arm(mono);return now;};
/** @param {number} i @param {any[]} args */
const call=async(i,args)=>{check();const value=await Reflect.apply(functions[i],ports,args);check();return value;};
const operation=(async()=>{try{check();const original=readDesktopTrustCompilerProduct(result),compile=original.compile,artifact=original.artifact;if(artifact.purpose!=='DESKTOP_TRUST_KEY_HOST_ARTIFACT'||artifact.namespace!=='ANVIL_DESKTOP_TRUST_SIGNER_V1'||artifact.signerRef.contentHash!==contentHash(original.helper)||artifact.helperBytes!==original.helper.length||compile.inputHash!==artifact.buildInputHash||compile.parentBasis.parentExeHash!==parent.exeHash||compile.parentBasis.parentAsarHash!==parent.asarHash||compile.parentBasis.parentHeaderHash!==parent.headerHash)return unavailable();
 const sourceClosureHash=contentHash(canonicalJson(compile.sources)),toolchainHash=contentHash(canonicalJson({compiler:compile.compiler,references:compile.references})),parentBasisHash=contentHash(compile.basisBytes);
 const buildSnapshot={schemaVersion:1,purpose:'DESKTOP_TRUST_BUILD_RECEIPT',sourceCommit:m.sourceCommit,sourceClosureHash,compileInputHash:compile.inputHash,toolchainHash,helperHash:artifact.signerRef.contentHash,parentBasisHash,parent:clone(parent)};
 const build={ref:{id:m.buildReceiptId,version:1,contentHash:contentHash(canonicalJson(buildSnapshot))},snapshot:buildSnapshot};
 const verificationSnapshot={schemaVersion:1,purpose:'DESKTOP_TRUST_VERIFICATION_RECEIPT',buildReceiptRef:build.ref,helperHash:artifact.signerRef.contentHash,parentBasisHash,parent:clone(parent),entryPoint:'DesktopTrustKeyHostSource',resourceName:'Anvil.Desktop.TrustKeyHost.ParentBasis.v1'};
 const verification={ref:{id:m.verificationReceiptId,version:1,contentHash:contentHash(canonicalJson(verificationSnapshot))},snapshot:verificationSnapshot};
 const before=await call(0,[profile.profileId,parent.releaseId]);if(before===null?expected!==null:canonicalJson(before.releaseRef)!==canonicalJson(expected))return unavailable();const sequence=before===null?1:before.sequence+1;
 const snapshot={releaseId:m.releaseId,releaseVersion:m.releaseVersion,publisherId:profile.publisherId,profileId:profile.profileId,parent:clone(parent),entries:[{role:'DESKTOP_TRUST_KEY_HOST',fileName:'AnvilTrustKeyHost.exe',bytes:original.helper.length,sha256:artifact.signerRef.contentHash,parentBasisHash,sourceClosureHash,toolchainHash,entryPoint:'DesktopTrustKeyHostSource',resourceName:'Anvil.Desktop.TrustKeyHost.ParentBasis.v1',platform:clone(profile.platform)}],buildEvidence:{sourceCommit:m.sourceCommit,sourceClosureHash,compileInputHash:compile.inputHash,toolchainHash,buildReceiptRef:build.ref,verificationReceiptRef:verification.ref},issuedAt:m.issuedAt,expiresAt:m.expiresAt,state:m.state,rollbackOf:m.rollbackOf};
 const value={schemaVersion:1,purpose:'DESKTOP_RUNTIME_CATALOGUE',profileId:profile.profileId,sequence,previousRef:clone(expected),releaseRef:{id:m.releaseId,version:sequence,contentHash:contentHash(canonicalJson(snapshot))},snapshot};readDesktopRuntimeCatalogue(value,profile,parent.releaseId,check());
 if(before!==null){readDesktopRuntimeCatalogue(before,profile,parent.releaseId,Date.parse(before.snapshot.issuedAt));if(canonicalJson(before.snapshot.parent)!==canonicalJson(parent))return unavailable();}
 if(m.rollbackOf!==null){const old=await call(1,[clone(m.rollbackOf)]);if(!old||canonicalJson(old.releaseRef)!==canonicalJson(m.rollbackOf))return unavailable();readDesktopRuntimeCatalogue(old,profile,parent.releaseId,Date.parse(old.snapshot.issuedAt));if(canonicalJson(old.snapshot.parent)!==canonicalJson(parent)||canonicalJson(old.snapshot.entries)!==canonicalJson(snapshot.entries))return unavailable();}
 const publication=Object.freeze({});publications.set(publication,{profile:freeze(clone(profile)),value:freeze(clone(value)),build:freeze(clone(build)),verification:freeze(clone(verification)),helper:Buffer.from(original.helper)});original.helper.fill(0);
 committing=true;await call(2,[publication,clone(expected)]);const committed=await call(3,[profile.profileId,parent.releaseId]);if(!committed||canonicalJson(committed.value)!==canonicalJson(value)||canonicalJson(committed.build)!==canonicalJson(build)||canonicalJson(committed.verification)!==canonicalJson(verification)||committed.helperHash!==artifact.signerRef.contentHash)return unavailable();check();return freeze(clone(value));
 }catch{if(committing)poisoned=true;return unavailable();}finally{busy=false;}})();
/** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
try{return await Promise.race([operation,new Promise((_resolve,reject)=>{arm=mono=>{if(monoEnd>=scheduledEnd)return;scheduledEnd=monoEnd;if(timer!==undefined)clearTimeout(timer);timer=setTimeout(()=>{active=false;if(committing)poisoned=true;reject(Error('RUNTIME_CATALOGUE_UNAVAILABLE'));},Math.max(1,Math.floor(monoEnd-mono)));};arm(lastMono);})]);}finally{active=false;if(timer!==undefined)clearTimeout(timer);void operation.catch(()=>{});}}
return Object.freeze({publish});}
module.exports={createDesktopRuntimeCataloguePublisher,readDesktopRuntimePublication};
