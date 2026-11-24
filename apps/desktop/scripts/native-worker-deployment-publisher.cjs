'use strict';
const {types}=require('node:util'),{createHash}=require('node:crypto');
const {readWorkerCompilation,checkWorkerCompilation}=require('./native-worker-compiler.cjs');
const {readWorkerPackage}=require('./native-worker-package.cjs');
const {createNativeWorkerBuild,readNativeWorkerProduct}=require('./native-worker-build.cjs');
const {readNativeFactoryProvenance}=require('./native-physical-factory-build.cjs');
/** @type {WeakMap<object,any>} */const publications=new WeakMap();
/** @returns {never} */function fail(){throw Error('NATIVE_WORKER_PUBLICATION_INVALID');}
/** @param {any} v @param {number} [depth] @returns {any} */function data(v,depth=0){if(types.isProxy(v)||depth>16)fail();if(v&&typeof v==='object'){if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();const ds=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(ds).length>128||Reflect.ownKeys(ds).some(k=>typeof k!=='string'||!('value'in ds[k])))fail();if(Array.isArray(v)){const n=ds.length.value;if(Object.keys(ds).length!==n+1)fail();return Array.from({length:n},(_,i)=>{if(!ds[i])fail();return data(ds[i].value,depth+1);});}const out={};for(const k of Object.keys(ds))Object.defineProperty(out,k,{enumerable:true,value:data(ds[k].value,depth+1)});return out;}if(v===null||typeof v==='string'||typeof v==='boolean'||Number.isSafeInteger(v))return v;fail();}
/** @param {any} v @returns {string} */function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
/** @param {unknown} token */function readWorkerPublication(token){if(!token||typeof token!=='object'||types.isProxy(token))fail();const p=publications.get(token);if(!p)fail();readWorkerCompilation(p.compilation);return{bundle:data(p.bundle)};}
/** @param {unknown} token @param {{signal?:AbortSignal}} [context] */async function readCurrentWorkerPublication(token,context={}){const first=readWorkerPublication(token),p=publications.get(/** @type {object} */(token));if(context.signal?.aborted)fail();await p.check();if(context.signal?.aborted)fail();const after=readWorkerPublication(token);if(canonical(after)!==canonical(first))fail();return after;}
/** 원 compiler + 고정 package payload + 원 factory의 보호 readback 후 새 publication capability를 만든다.
 * 기존 SOURCE_ONLY_MODEL build 토큰 입력을 받지 않는다. 실제 배포 publisher role 연결은 기본 미등록이다.
 * @param {any} input */
async function createWorkerPublication(input){
 if(!input||types.isProxy(input))fail();const ds=Object.getOwnPropertyDescriptors(input);if(Reflect.ownKeys(ds).length!==4||!['compilation','packageToken','factoryArtifact','configuration'].every(k=>ds[k]&&'value'in ds[k]))fail();
 const compilation=ds.compilation.value,packageToken=ds.packageToken.value,artifact=ds.factoryArtifact.value,c=data(ds.configuration.value),compiled=readWorkerCompilation(compilation),packaged=await readWorkerPackage(packageToken);if(packaged.compilation!==compilation||packaged.workerHash!==compiled.workerHash)fail();
 const provenance=await readNativeFactoryProvenance(artifact);if(!provenance.parentSnapshot.files.some((/** @type {any} */f)=>f.path==='resources/native-workers/OwnershipEvidenceWorker.exe'&&f.sha256===compiled.workerHash))fail();
 if(c.repoRoot!==compiled.compile.workingDirectory||c.outputPath!==compiled.compile.outputPath||canonical(c.compiler)!==canonical(compiled.compile.compiler)||canonical(c.references)!==canonical(compiled.compile.references)||c.sourceHash!==compiled.compile.source.sha256)fail();
 // 기존 descriptor 생산/부모 검산은 그대로 재사용한다. 컴파일은 다시 수행하지 않는다.
 const inputByPath=new Map([[require('node:path').win32.join(c.repoRoot,...compiled.compile.source.path.split('/')),compiled.compile.source.sha256],...compiled.compile.references.map((/** @type {any} */r)=>[r.path,r.sha256]),[compiled.compile.compiler.path,compiled.compile.compiler.sha256]]);
 const model=await createNativeWorkerBuild({factoryArtifact:artifact,configuration:c},{read:async(/** @type {string} */p)=>{
  // 원 build 함수는 실제 입력 bytes를 요구한다. 별도 hash 대역을 생성하지 않고 원 compiler가 보유한 판독기를 사용한다.
  const b=await require('./native-worker-compiler.cjs').readWorkerCompilationInput(compilation,p);if(createHash('sha256').update(b).digest('hex')!==inputByPath.get(p))fail();return b;
 },now:()=>readWorkerCompilation(compilation).observedAt,check:()=>readWorkerCompilation(compilation)});
 const checked=readNativeWorkerProduct(await model.build(async()=>Buffer.from(compiled.worker)));await checkWorkerCompilation(compilation);await readWorkerPackage(packageToken);await readNativeFactoryProvenance(artifact);
 const bundle={descriptor:checked.descriptor,packageRecord:checked.packageRecord,buildReceipt:checked.buildReceipt},token=Object.freeze({});publications.set(token,{compilation,bundle,check:async()=>{await checkWorkerCompilation(compilation);await readWorkerPackage(packageToken);await readNativeFactoryProvenance(artifact);}});return token;
}
/** 게시 실패/불명 후 자동 재발행하지 않는다. 원 request/hash 조회는 store.lookup에 별도 명시한다.
 * @param {any} store @param {string} requestId @param {unknown} product */
async function publishWorkerDeployment(store,requestId,product){await readCurrentWorkerPublication(product);if(!store||typeof store.publish!=='function')fail();return store.publish(requestId,product);}
/** 원 게시 거래 확정 뒤 전달할 기대자료다. 프로세스 간 token/설치/실행 권위가 아니며,
 * packaged owner는 기존 deployment GET와 native 보호 readback을 새로 수행해야 한다.
 * @param {any} store @param {string} requestId @param {unknown} product */
async function publishNormalStartWorkerDeployment(store,requestId,product){
 const before=await readCurrentWorkerPublication(product),head=data(await publishWorkerDeployment(store,requestId,product));
 const after=await readCurrentWorkerPublication(product);if(canonical(before)!==canonical(after))fail();
 if(!head||Object.keys(head).sort().join(',')!=='ref,snapshot')fail();const h=head.snapshot,r=head.ref,b=after.bundle,d=b.descriptor.snapshot;
 if(!h||Object.keys(h).sort().join(',')!=='descriptorRef,expiresAt,nativeFactoryRef,previousHeadRef,purpose,schemaVersion,sequence,state,updatedAt'
  ||!r||Object.keys(r).sort().join(',')!=='contentHash,id,version'||typeof r.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.id)||r.version!==1
  ||h.schemaVersion!==1||h.purpose!=='NATIVE_WORKER_DEPLOYMENT_HEAD'||h.state!=='ACTIVE'||h.sequence!==1||h.previousHeadRef!==null
  ||canonical(h.nativeFactoryRef)!==canonical(d.nativeFactoryRef)||canonical(h.descriptorRef)!==canonical(b.descriptor.ref)
  ||r.contentHash!==createHash('sha256').update(canonical(h)).digest('hex')||!Number.isFinite(Date.parse(h.updatedAt))||new Date(h.updatedAt).toISOString()!==h.updatedAt
  ||!Number.isFinite(Date.parse(h.expiresAt))||new Date(h.expiresAt).toISOString()!==h.expiresAt||Date.parse(h.updatedAt)<Date.parse(d.issuedAt)||Date.parse(h.expiresAt)>Date.parse(d.expiresAt)||Date.parse(h.expiresAt)<=Date.parse(h.updatedAt))fail();
 return data({purpose:'NORMAL_START_WORKER_PUBLICATION_V1',bundle:after.bundle,head});
}
module.exports={createWorkerPublication,readWorkerPublication,readCurrentWorkerPublication,publishWorkerDeployment,publishNormalStartWorkerDeployment};
