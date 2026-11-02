'use strict';
const path=require('node:path'),{createHash}=require('node:crypto');
const {verifyPackageHardening,packageIO}=require('./verify-package-hardening.cjs');
const {snapshot,nativeIO}=require('./verify-installer-development.cjs');
const {readBasis,canonical,verifyNativePhysicalFactory}=require('./verify-native-physical-factory.cjs');
const SOURCE_FILES=Object.freeze(['OwnershipEvidenceJobFactorySource.cs','OwnershipEvidenceJobAssignmentSource.cs','OwnershipEvidenceProcessStartupSource.cs','OwnershipEvidenceProcessOwnerSource.cs','OwnershipEvidenceWorkerInputSource.cs','OwnershipEvidencePreparedFactsSource.cs','OwnershipEvidenceImageOwnerSource.cs','OwnershipEvidenceImageBindingSource.cs','OwnershipEvidenceRootSource.cs','OwnershipEvidenceHost.cs','NativePreparationOwnerBridgeSource.cs','NativePreparationOwnerParentBasisSource.cs','NativePreparationOwnerPeerSource.cs','NativePreparationOwnerHostSource.cs'].map(p=>'apps/connector/native/'+p));
const REFERENCE_FILES=Object.freeze(['mscorlib.dll','System.dll','System.Core.dll','System.Web.Extensions.dll']);
/** @typedef {{path:string,sha256:string}} FileBinding */
/** @typedef {{factoryId:string,factoryVersion:number,compiler:FileBinding,references:FileBinding[],sources:FileBinding[],repoRoot:string,basisPath:string,outputPath:string}} CompileConfiguration */
/** @returns {never} */function fail(){throw Error('NATIVE_FACTORY_BUILD_INVALID');}
/** @param {unknown} v @param {string[]} keys */
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;const d=Object.getOwnPropertyDescriptors(v);return Reflect.ownKeys(d).length===keys.length&&keys.every(k=>d[k]&&d[k].enumerable&&'value'in d[k]);}
/** @param {unknown} v @param {number} length */
function dataArray(v,length){if(!Array.isArray(v)||v.length!==length)return false;const d=Object.getOwnPropertyDescriptors(v);return Reflect.ownKeys(d).length===length+1&&Array.from({length},(_,i)=>d[String(i)]).every(p=>p&&'value'in p&&p.enumerable);}
/** @param {unknown} v */
function absolute(v){return typeof v==='string'&&/^[A-Za-z]:\\/.test(v)&&v.length<=1024&&path.win32.normalize(v)===v&&!/[<>"|?*\x00-\x1f]/.test(v)&&!v.slice(2).includes(':')&&!v.includes(',')&&!v.includes('@')&&!v.includes('"');}
/** @param {Buffer|string} v */const hash=v=>createHash('sha256').update(v).digest('hex');
/** @param {unknown} v */
function file(v){if(!exact(v,['path','sha256']))fail();const f=/** @type {FileBinding} */(v);if(!absolute(f.path)||typeof f.sha256!=='string'||!/^[0-9a-f]{64}$/.test(f.sha256)||f.sha256==='0'.repeat(64))fail();return Object.freeze({...f});}
/** @template T @param {T} v @returns {Readonly<T>} */
function immutable(v){if(v&&typeof v==='object'){for(const child of Object.values(v))immutable(child);Object.freeze(v);}return v;}
/** 명령 인자/입력 결박만 생산한다. compiler 실행이나 provenance 증명이 아니다.
 * @param {unknown} input @param {unknown} parent
 */
function createCompileInput(input,parent){
 if(!exact(input,['factoryId','factoryVersion','compiler','references','sources','repoRoot','basisPath','outputPath']))fail();const c=/** @type {CompileConfiguration} */(input),basis=readBasis(parent);
 if(!absolute(c.repoRoot)||c.factoryId!==basis.factoryId||c.factoryVersion!==basis.factoryVersion||!absolute(c.basisPath)||!absolute(c.outputPath)||path.win32.extname(c.outputPath)!=='.exe'||!dataArray(c.sources,14)||!dataArray(c.references,4))fail();
 const compiler=file(c.compiler);if(path.win32.basename(compiler.path).toLowerCase()!=='csc.exe')fail();
 const sources=c.sources.map((v,i)=>{if(!exact(v,['path','sha256'])||v.path!==SOURCE_FILES[i]||!/^[0-9a-f]{64}$/.test(v.sha256)||v.sha256==='0'.repeat(64))fail();return{...v};});
 const references=c.references.map((v,i)=>{const f=file(v);if(path.win32.basename(f.path)!==REFERENCE_FILES[i])fail();return f;});
 const names=[compiler.path,c.outputPath,c.basisPath,...references.map(f=>f.path)].map(p=>p.toLowerCase());if(new Set(names).size!==names.length)fail();
 const basisBytes=canonical(basis),args=['/noconfig','/nostdlib+','/nologo','/target:exe','/platform:x64','/optimize+','/debug-','/main:NativePreparationOwnerHostSource','/out:'+c.outputPath,'/resource:'+c.basisPath+',Anvil.Native.NativePreparationOwner.ParentBasis.v1,private',...references.map(f=>'/reference:'+f.path),...SOURCE_FILES.map(f=>path.win32.join(c.repoRoot,...f.split('/')))];
 const bound={workingDirectory:c.repoRoot,schemaVersion:1,purpose:'NATIVE_PHYSICAL_FACTORY_COMPILE_INPUT',factoryId:c.factoryId,factoryVersion:c.factoryVersion,compiler,references,sources,basisPath:c.basisPath,outputPath:c.outputPath,parentBasis:basis,basisBytes,arguments:args};
 return immutable({...bound,inputHash:hash(canonical(bound)),compilerExecuted:false,nativeAdmissionVerified:false});
}
/** @typedef {import('./verify-installer-development.cjs').IO} IO */
/** FN18의 실제 공식 path reader를 고정 소비한다. verifier 대역 주입 포트는 없다.
 * @param {{repoRoot:string,parentRoot:string,configuration:Omit<CompileConfiguration,'sources'|'repoRoot'>}} input
 * @param {{io?:IO,check?:()=>void}} [ports]
 */
async function produceCompileInput(input,ports={}){
 if(!exact(input,['repoRoot','parentRoot','configuration'])||!absolute(input.repoRoot)||!absolute(input.parentRoot))fail();
 const repoRoot=input.repoRoot,parentRoot=input.parentRoot,raw=input.configuration;
 if(!exact(raw,['factoryId','factoryVersion','compiler','references','basisPath','outputPath'])||!dataArray(raw.references,4))fail();
 const c=Object.freeze({factoryId:raw.factoryId,factoryVersion:raw.factoryVersion,compiler:file(raw.compiler),references:Object.freeze(raw.references.map(file)),basisPath:raw.basisPath,outputPath:raw.outputPath});
 const started=performance.now(),check=()=>{ports.check?.();if(performance.now()-started>=120000)fail();},parentIO=packageIO(),io=ports.io??nativeIO();check();
 const before=await snapshot(parentRoot,parentIO);check();const observed=await verifyPackageHardening(parentRoot,{check});check();const after=await snapshot(parentRoot,parentIO);check();
 if(canonical(before)!==canonical(after)||after.files.find(f=>f.path==='Anvil.exe')?.sha256!==observed.exeHash||after.files.find(f=>f.path==='resources/app.asar')?.sha256!==observed.asarHash)fail();
 const parent={schemaVersion:1,purpose:'NATIVE_PREPARATION_PARENT_PACKAGE_BASIS',physicalNamespace:'ANVIL_NATIVE_OWNER_FACTORY_V1',factoryId:c.factoryId,factoryVersion:c.factoryVersion,parentExeHash:observed.exeHash,parentAsarHash:observed.asarHash,parentHeaderHash:observed.headerHash};
 const sources=[];for(const relative of SOURCE_FILES){const location=path.join(repoRoot,...relative.split('/'));const bytes=await io.read(location,1048576);check();sources.push({path:relative,sha256:hash(bytes)});}
 for(const binding of [c.compiler,...c.references]){const b=await io.read(binding.path,64*1024*1024);check();if(hash(b)!==binding.sha256)fail();}
 const compile=createCompileInput({...c,references:[...c.references],sources,repoRoot},parent);const final=await snapshot(parentRoot,parentIO);check();if(canonical(before)!==canonical(final))fail();
 const expected=canonical(final),root=parentRoot;
 const checkInputs=async()=>{for(const source of compile.sources){const b=await io.read(path.join(repoRoot,...source.path.split('/')),1048576);check();if(hash(b)!==source.sha256)fail();}for(const binding of [compile.compiler,...compile.references]){const b=await io.read(binding.path,64*1024*1024);check();if(hash(b)!==binding.sha256)fail();}};

 /** @type {string|null} */
 let issuedHash=null;let busy=false;
 // 이 closure만 원 snapshot을 보유한다. 외부 JSON은 build proof가 아니다.
 return Object.freeze({compile,verifyOutput:async(/** @type {Buffer} */ bytes)=>{
  if(busy)fail();busy=true;try{check();await checkInputs();if(canonical(await snapshot(root,parentIO))!==expected)fail();check();const output=await verifyNativePhysicalFactory(bytes,compile.parentBasis);check();await checkInputs();if(canonical(await snapshot(root,parentIO))!==expected)fail();check();
  if(issuedHash!==null&&issuedHash!==output.helperHash)fail();issuedHash=output.helperHash;
  return immutable({schemaVersion:1,purpose:'NATIVE_PHYSICAL_FACTORY_ARTIFACT',physicalNamespace:'ANVIL_NATIVE_OWNER_FACTORY_V1',factoryRef:{id:compile.factoryId,version:compile.factoryVersion,contentHash:output.helperHash},parentBasis:compile.parentBasis,helperBytes:output.helperBytes,buildInputHash:compile.inputHash});}finally{busy=false;}
 }});
}
module.exports={SOURCE_FILES,REFERENCE_FILES,createCompileInput,produceCompileInput};
