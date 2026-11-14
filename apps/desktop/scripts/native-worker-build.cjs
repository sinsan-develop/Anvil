'use strict';
const path=require('node:path'),{createHash}=require('node:crypto'),{types}=require('node:util');
const {readNativeFactoryProvenance}=require('./native-physical-factory-build.cjs');
const {verifyNativeWorker}=require('./verify-native-worker.cjs');
const SOURCE='apps/connector/native/OwnershipEvidenceWorker.cs';
const REFERENCES=Object.freeze(['mscorlib.dll','System.dll']);
/** @type {WeakMap<object,any>} */const products=new WeakMap();
/** 같은 factory fullref에 대한 원 build 결과의 변경을 이 프로세스에서도 거절한다. 배포 원장의 유일성 대체 아님.
 * @type {Map<string,string>} */const descriptors=new Map();
/** @returns {never} */function fail(){throw Error('NATIVE_WORKER_BUILD_INVALID');}
/** @param {any} v @param {number} [depth] @returns {any} */function data(v,depth=0){
 if(depth>16)fail();if(v===null||typeof v==='string'||typeof v==='boolean')return v;if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return v;}
 if(!v||typeof v!=='object'||types.isProxy(v))fail();const p=Object.getPrototypeOf(v),a=Array.isArray(v);if(a?p!==Array.prototype:p!==Object.prototype&&p!==null)fail();const ds=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(ds);if(keys.length>128||keys.some(k=>typeof k!=='string'||!('value'in ds[k])||!ds[k].enumerable&&k!=='length'))fail();
 if(a){if(keys.length!==v.length+1)fail();return Array.from({length:v.length},(_,i)=>{if(!ds[i])fail();return data(ds[i].value,depth+1);});}
 const out={};for(const k of keys){if(typeof k!=='string')fail();Object.defineProperty(out,k,{value:data(ds[k].value,depth+1),enumerable:true});}return out;
}
/** @param {any} v @returns {string} */function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
/** @param {Buffer|string} v */const hash=v=>createHash('sha256').update(v).digest('hex');
/** @param {any} v @param {string} names */function exact(v,names){if(!v||Array.isArray(v)||Object.keys(v).sort().join(',')!==names.split(',').sort().join(','))fail();}
/** @param {any} r */function ref(r){exact(r,'id,version,contentHash');if(!uuid(r.id)||!Number.isSafeInteger(r.version)||r.version<1||!sha(r.contentHash))fail();}
/** @param {any} v */const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
/** @param {any} v */const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)&&v!=='0'.repeat(64);
/** @param {any} v */const iso=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
/** @param {any} v */function absolute(v){if(typeof v!=='string'||!/^[A-Z]:\\/.test(v)||v.length>1024||path.win32.normalize(v)!==v||/[<>"|?*\x00-\x1f,@]/.test(v)||v.slice(2).includes(':'))fail();return v;}
/** @param {any} v */function frozen(v){if(v&&typeof v==='object'){for(const x of Object.values(v))frozen(x);Object.freeze(v);}return v;}
/** 원 build 토큰만 판독한다. 이 결과는 설치/회수/current 확인을 대신하지 않는다.
 * @param {unknown} token */
function readNativeWorkerProduct(token){if(!token||typeof token!=='object'||types.isProxy(token))fail();const p=products.get(token);if(!p)fail();return data(p);}
/** 고정 worker build 입력과 결과 검산 source. compiler/process 기본 실행 경로는 없다.
 * factoryArtifact는 기존 실제 build closure가 발급한 원 객체여야 한다.
 * read/compile는 보호 build 조립용 IO 경계이며 RAM 시험도 동일 경계만 대역한다.
 * @param {any} input @param {any} ports */
async function createNativeWorkerBuild(input,ports){
 if(!input||typeof input!=='object'||types.isProxy(input))fail();const ds=Object.getOwnPropertyDescriptors(input);if(Reflect.ownKeys(ds).length!==2||!ds.factoryArtifact||!ds.configuration||!('value'in ds.factoryArtifact)||!('value'in ds.configuration))fail();
 const artifact=ds.factoryArtifact.value,c=data(ds.configuration.value);exact(c,'repoRoot,compiler,references,sourceHash,outputPath,packageRecord,buildReceiptId,rootId,issuedAt,expiresAt');
 const provenance=await readNativeFactoryProvenance(artifact).catch(fail);
 absolute(c.repoRoot);absolute(c.outputPath);if(path.win32.basename(c.outputPath)!=='OwnershipEvidenceWorker.exe'||!uuid(c.rootId)||!uuid(c.buildReceiptId)||!sha(c.sourceHash)||!iso(c.issuedAt)||!iso(c.expiresAt)||Date.parse(c.expiresAt)<=Date.parse(c.issuedAt))fail();
 exact(c.packageRecord,'ref,snapshot');ref(c.packageRecord.ref);const parent=c.packageRecord.snapshot;exact(parent,'schemaVersion,purpose,parentExeHash,parentAsarHash,parentHeaderHash,issuedAt,expiresAt');
 if(parent.schemaVersion!==1||parent.purpose!=='NATIVE_FACTORY_PACKAGE_BASIS'||c.packageRecord.ref.contentHash!==hash(canonical(parent))||!iso(parent.issuedAt)||!iso(parent.expiresAt)||Date.parse(c.issuedAt)<Date.parse(parent.issuedAt)||Date.parse(c.expiresAt)>Date.parse(parent.expiresAt))fail();
 for(const k of ['parentExeHash','parentAsarHash','parentHeaderHash'])if(parent[k]!==provenance.artifact.parentBasis[k])fail();
 exact(c.compiler,'path,sha256');absolute(c.compiler.path);if(path.win32.basename(c.compiler.path).toLowerCase()!=='csc.exe'||!sha(c.compiler.sha256)||canonical(c.compiler)!==canonical(provenance.compile.compiler))fail();
 if(!Array.isArray(c.references)||c.references.length!==2)fail();c.references.forEach((/** @type {any} */r,/** @type {number} */i)=>{exact(r,'path,sha256');absolute(r.path);if(path.win32.basename(r.path)!==REFERENCES[i]||!provenance.compile.references.some((/** @type {any} */x)=>canonical(x)===canonical(r)))fail();});
 if(!ports||types.isProxy(ports))fail();const own=(/** @type {string} */k)=>{const d=Object.getOwnPropertyDescriptor(ports,k);if(!d||!('value'in d)||typeof d.value!=='function')fail();return d.value;},read=own('read'),now=own('now'),checkPort=own('check');let last=-Infinity,used=false;const start=performance.now();
 const check=()=>{if(own('read')!==read||own('now')!==now||own('check')!==checkPort)fail();checkPort.call(ports);const at=now.call(ports);if(!Number.isSafeInteger(at)||at<last||at<Date.parse(c.issuedAt)||at>=Date.parse(c.expiresAt)||performance.now()-start>=120000)fail();last=at;};
 const inputs=async()=>{check();for(const f of [{path:path.win32.join(c.repoRoot,...SOURCE.split('/')),sha256:c.sourceHash},c.compiler,...c.references]){const bytes=await read.call(ports,f.path,64*1024*1024);check();if(types.isProxy(bytes)||!Buffer.isBuffer(bytes)||bytes.length>64*1024*1024||hash(bytes)!==f.sha256)fail();}await readNativeFactoryProvenance(artifact);check();};
 await inputs();
 const compile=frozen({schemaVersion:1,purpose:'NATIVE_WORKER_COMPILE_INPUT',source:{path:SOURCE,sha256:c.sourceHash},compiler:c.compiler,references:c.references,workingDirectory:c.repoRoot,outputPath:c.outputPath,arguments:['/noconfig','/nostdlib+','/nologo','/target:exe','/platform:x64','/optimize+','/debug-','/main:Anvil.Native.OwnershipEvidence.OwnershipEvidenceWorker','/out:'+c.outputPath,...c.references.map((/** @type {any} */r)=>'/reference:'+r.path),path.win32.join(c.repoRoot,...SOURCE.split('/'))]});
 return Object.freeze({compile,/** 원 고정 입력을 받는 compiler 경계. callback의 선언만으로 배포 권위를 만들지 않는다.
  * @param {(compile:any)=>Promise<Buffer>} invoke */
  build:async(/** @type {(compile:any)=>Promise<Buffer>} */invoke)=>{if(used||typeof invoke!=='function')fail();used=true;await inputs();const output=await invoke(compile);check();if(types.isProxy(output)||!Buffer.isBuffer(output))fail();const bytes=Buffer.from(output),verified=await verifyNativeWorker(bytes);await inputs();
   const bs={schemaVersion:1,purpose:'NATIVE_WORKER_BUILD_RECEIPT',nativeFactoryRef:provenance.artifact.factoryRef,packageRef:c.packageRecord.ref,compileInputHash:hash(canonical(compile)),sourceHash:c.sourceHash,workerHash:verified.workerHash,issuedAt:c.issuedAt,expiresAt:c.expiresAt};
   const buildReceipt={ref:{id:c.buildReceiptId,version:1,contentHash:hash(canonical(bs))},snapshot:bs};
   const snapshot={schemaVersion:1,purpose:'NATIVE_PREPARATION_WORKER_DESCRIPTOR',nativeFactoryRef:provenance.artifact.factoryRef,packageRef:c.packageRecord.ref,buildReceiptRef:buildReceipt.ref,rootId:c.rootId,relativePath:'OwnershipEvidenceWorker.exe',workerHash:verified.workerHash,issuedAt:c.issuedAt,expiresAt:c.expiresAt};
   const descriptor={ref:{id:snapshot.nativeFactoryRef.id,version:snapshot.nativeFactoryRef.version,contentHash:hash(canonical(snapshot))},snapshot},key=canonical(snapshot.nativeFactoryRef),old=descriptors.get(key);if(old&&old!==canonical(descriptor))fail();check();descriptors.set(key,canonical(descriptor));const token=Object.freeze({});products.set(token,frozen({descriptor,buildReceipt,packageRecord:c.packageRecord,compile,assurance:'SOURCE_ONLY_MODEL',compilerExecuted:false,installationVerified:false}));return token;}
 });
}
/** 부모 확정 전의 고정 worker 입력. 원 read/check를 전후 재검산하며 결과 발급은 compiler 모듈만 한다.
 * @param {any} configuration @param {any} ports */
async function prepareNativeWorkerCompile(configuration,ports){
 const c=data(configuration);exact(c,'repoRoot,compiler,references,sourceHash,outputPath');absolute(c.repoRoot);absolute(c.outputPath);exact(c.compiler,'path,sha256');absolute(c.compiler.path);
 if(path.win32.basename(c.outputPath)!=='OwnershipEvidenceWorker.exe'||path.win32.basename(c.compiler.path).toLowerCase()!=='csc.exe'||!sha(c.compiler.sha256)||!sha(c.sourceHash)||!Array.isArray(c.references)||c.references.length!==2)fail();
 c.references.forEach((/** @type {any} */r,/** @type {number} */i)=>{exact(r,'path,sha256');absolute(r.path);if(path.win32.basename(r.path)!==REFERENCES[i]||!sha(r.sha256))fail();});
 const source=path.win32.join(c.repoRoot,...SOURCE.split('/'));if(new Set([source,c.outputPath,c.compiler.path,...c.references.map((/** @type {any} */r)=>r.path)].map(p=>p.toLowerCase())).size!==5)fail();
 const own=(/** @type {string} */k)=>{if(!ports||types.isProxy(ports))fail();const d=Object.getOwnPropertyDescriptor(ports,k);if(!d||!('value'in d)||typeof d.value!=='function')fail();return d.value;},read=own('read'),check=own('check');
 const validate=async()=>{if(own('read')!==read||own('check')!==check)fail();check.call(ports);for(const f of [{path:source,sha256:c.sourceHash},c.compiler,...c.references]){const bytes=await read.call(ports,f.path,64*1024*1024);check.call(ports);if(own('read')!==read||own('check')!==check||types.isProxy(bytes)||!Buffer.isBuffer(bytes)||bytes.length>64*1024*1024||hash(bytes)!==f.sha256)fail();}};
 const compile=frozen({schemaVersion:1,purpose:'NATIVE_WORKER_COMPILE_INPUT',source:{path:SOURCE,sha256:c.sourceHash},compiler:c.compiler,references:c.references,workingDirectory:c.repoRoot,outputPath:c.outputPath,arguments:['/noconfig','/nostdlib+','/nologo','/target:exe','/platform:x64','/optimize+','/debug-','/main:Anvil.Native.OwnershipEvidence.OwnershipEvidenceWorker','/out:'+c.outputPath,...c.references.map((/** @type {any} */r)=>'/reference:'+r.path),source]});
 await validate();return Object.freeze({compile,validate});
}
module.exports={createNativeWorkerBuild,readNativeWorkerProduct,prepareNativeWorkerCompile,SOURCE,REFERENCES};
