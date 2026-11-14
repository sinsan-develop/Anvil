'use strict';
const path=require('node:path'),{types}=require('node:util');
const {readWorkerCompilation,checkWorkerCompilation}=require('./native-worker-compiler.cjs');
const RELATIVE='resources/native-workers/OwnershipEvidenceWorker.exe';
/** @type {WeakMap<object,any>} */const packages=new WeakMap();
/** @type {WeakMap<object,any>} */const attempts=new WeakMap();
/** @type {Set<any>} */const unknownOwners=new Set();
/** @returns {never} */function fail(){throw Error('NATIVE_WORKER_PACKAGE_INVALID');}
/** @param {any} o @param {string} k */function own(o,k){if(!o||types.isProxy(o))fail();const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!('value'in d))fail();return d.value;}
/** @param {any} token */async function readWorkerPackage(token){const p=packages.get(token);if(!p)fail();await p.check();return{compilation:p.compilation,root:p.root,relativePath:RELATIVE,workerHash:p.workerHash};}
/** 원 compile bytes를 부모 확정 전에 고정 payload로 한 번 복사한다. IO는 보호 build 조립 포트이며 기본 제공하지 않는다.
 * @param {unknown} compilation @param {string} root @param {any} io */
async function packageNativeWorker(compilation,root,io){
 const product=readWorkerCompilation(compilation);if(typeof root!=='string'||!/^[A-Z]:\\/.test(root)||path.win32.normalize(root)!==root||/[\x00-\x1f,@]/.test(root))fail();
 const names=['inspectRoot','inspect','create','read','check'],fns=names.map(k=>own(io,k));if(fns.some(f=>typeof f!=='function'))fail();
 if(attempts.has(io))fail();
 /** @type {any} */
 const owner={state:'ACTIVE',root,handle:null,close:null,closed:false,pending:null,closing:null};attempts.set(io,owner);let active=true;
 const stable=()=>{if(names.some((k,i)=>own(io,k)!==fns[i]))fail();fns[4].call(io);readWorkerCompilation(compilation);};
 const wait=async(/** @type {Promise<any>} */p)=>{void p.catch(()=>{});const ms=readWorkerCompilation(compilation).remainingMs;if(!(ms>0))fail();/** @type {ReturnType<typeof setTimeout>|undefined} */let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;owner.state='UNKNOWN';unknownOwners.add(owner);reject(Error('NATIVE_WORKER_PACKAGE_UNKNOWN'));},ms);})]);}finally{clearTimeout(timer);void p.catch(()=>{});}};
 const beginClose=()=>{if(!owner.closing){owner.closing=Promise.resolve().then(()=>owner.close.call(owner.handle)).then(()=>{owner.closed=true;});void owner.closing.catch(()=>{});}return owner.closing;};
 const closeOwned=async()=>{if(!owner.handle||owner.closed||typeof owner.close!=='function')return;const closing=beginClose();owner.pending=closing;if(!active)return;try{await wait(closing);}catch{owner.state='UNKNOWN';unknownOwners.add(owner);}};
 const call=async(/** @type {number} */n,/** @type {any[]} */args)=>{stable();if(!active)fail();const pending=Promise.resolve().then(()=>fns[n].apply(io,args)).then(v=>{if(n===2){owner.handle=v;owner.close=own(v,'close');if(!active)void closeOwned();}return v;});owner.pending=pending;const v=await wait(pending);stable();return v;};
 const rootState=await call(0,[root]);if(!rootState||types.isProxy(rootState)||rootState.link!==false||typeof rootState.identity!=='string'||!rootState.identity)fail();const rootIdentity=JSON.stringify(rootState),target=path.win32.join(root,...RELATIVE.split('/'));
 if((await call(1,[target])).state!=='ABSENT')fail();let closed=false,effect=false;
 /** @type {any} */let handle;
 try{await wait(checkWorkerCompilation(compilation));effect=true;handle=await call(2,[target]);const identity=own(handle,'identity'),write=own(handle,'write'),sync=own(handle,'sync'),close=own(handle,'close');if(typeof identity!=='string'||!identity||![write,sync,close].every(f=>typeof f==='function'))fail();
  const same=()=>{stable();if(own(handle,'identity')!==identity||own(handle,'write')!==write||own(handle,'sync')!==sync||own(handle,'close')!==close)fail();};
  let offset=0;while(offset<product.worker.length){same();const copy=Buffer.from(product.worker),n=await wait(Promise.resolve().then(()=>write.call(handle,copy,offset)));same();if(!copy.equals(product.worker)||!Number.isSafeInteger(n)||n<=0||n>product.worker.length-offset)fail();offset+=n;}
  await wait(Promise.resolve().then(()=>sync.call(handle)));same();await wait(beginClose());closed=true;owner.closed=true;same();
  const check=async()=>{stable();await checkWorkerCompilation(compilation);if(JSON.stringify(await call(0,[root]))!==rootIdentity)fail();const info=await call(1,[target]);if(info.state!=='FILE'||info.identity!==identity||info.link!==false||info.nlink!==1||info.bytes!==product.worker.length)fail();const b=await call(3,[target,20*1024*1024]);if(types.isProxy(b)||!Buffer.isBuffer(b)||!b.equals(product.worker))fail();};
  await check();const token=Object.freeze({});packages.set(token,{compilation,root,workerHash:product.workerHash,check});owner.state='VERIFIED';return token;
 }catch(e){if(effect){owner.state='UNKNOWN';unknownOwners.add(owner);throw Error('NATIVE_WORKER_PACKAGE_UNKNOWN');}throw e;}
 finally{if(owner.state!=='VERIFIED')active=false;if(!closed)await closeOwned();}
}
/** 기본 build 공급자는 미등록이다. 환경변수/renderer로 발급하거나 패키지에 worker를 추정하지 않는다.
 * @param {any} base @param {any} [producer] */
function fixedNativeWorkerForgeHooks(base,producer=null){
 return{...base,postPackage:async(/** @type {any} */config,/** @type {any} */result)=>{
  if(producer){const stage=own(producer,'stage');if(typeof stage!=='function'||result.platform!=='win32'||result.arch!=='x64'||result.outputPaths?.length!==1)fail();await stage.call(producer,result.outputPaths[0]);if(own(producer,'stage')!==stage)fail();}
  if(base.postPackage)await base.postPackage(config,result);
 }};
}
/** 원 package output 전용 실제 IO. worker runtime 설치 root와는 다른 build 대상이다. */
function nodePackageIO(){const fs=require('node:fs/promises'),id=(/** @type {any} */s)=>String(s.dev)+':'+String(s.ino);return{
 inspectRoot:async(/** @type {string} */root)=>{const s=await fs.lstat(root);if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(root)!==root)fail();return{identity:id(s),link:false};},
 inspect:async(/** @type {string} */p)=>{try{const s=await fs.lstat(p);return{state:'FILE',identity:id(s),link:s.isSymbolicLink(),nlink:s.nlink,bytes:s.size};}catch(e){if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return{state:'ABSENT'};throw e;}},
 create:async(/** @type {string} */p)=>{const dir=path.win32.dirname(p),parent=path.win32.dirname(dir),s=await fs.lstat(parent);if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(parent)!==parent)fail();await fs.mkdir(dir);const h=await fs.open(p,'wx',0o600),held=await h.stat();if(held.nlink!==1){await h.close();fail();}return{identity:id(held),write:async(/** @type {Buffer} */b,/** @type {number} */offset)=>(await h.write(b,offset,b.length-offset,offset)).bytesWritten,sync:()=>h.sync(),close:()=>h.close()};},
 read:async(/** @type {string} */p,/** @type {number} */max)=>{const before=await fs.lstat(p);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>max||await fs.realpath(p)!==p)fail();const h=await fs.open(p,'r');try{const held=await h.stat();if(id(held)!==id(before)||held.nlink!==1)fail();const b=await h.readFile(),after=await h.stat(),again=await fs.lstat(p);if(b.length>max||id(after)!==id(again)||after.nlink!==1||again.isSymbolicLink()||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)fail();return b;}finally{await h.close();}},check:()=>{}
 };}
/** 명시 build 설정이 있을 때 concrete compiler/복사 producer를 Forge에 연결한다. 자동 설정/게시 없다.
 * @param {any} input @param {any} [ramPorts] */
function createWorkerPackageProducer(input,ramPorts=null){let attempted=false,finalized=false;
 /** @type {object|null} */let compilation=null;
 /** @type {object|null} */let packageToken=null;
 return Object.freeze({
 stage:async(/** @type {string} */root)=>{if(attempted)fail();attempted=true;const c=require('./native-worker-compiler.cjs');compilation=ramPorts?await c.runNativeWorkerCompiler(input,own(ramPorts,'compiler')):await c.runNodeNativeWorkerCompiler(input);packageToken=await packageNativeWorker(compilation,root,ramPorts?own(ramPorts,'package'):nodePackageIO());},
 finalize:async(/** @type {any} */factoryArtifact,/** @type {any} */configuration,/** @type {any} */store,/** @type {string} */requestId)=>{if(finalized||!compilation||!packageToken)fail();finalized=true;const publisher=require('./native-worker-deployment-publisher.cjs'),product=await publisher.createWorkerPublication({compilation,packageToken,factoryArtifact,configuration});return publisher.publishWorkerDeployment(store,requestId,product);}
 });}
module.exports={packageNativeWorker,readWorkerPackage,fixedNativeWorkerForgeHooks,createWorkerPackageProducer,nodePackageIO,RELATIVE};
