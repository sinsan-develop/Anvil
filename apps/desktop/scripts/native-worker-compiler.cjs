'use strict';
const {types}=require('node:util'),{createHash}=require('node:crypto');
const {prepareNativeWorkerCompile}=require('./native-worker-build.cjs'),{verifyNativeWorker}=require('./verify-native-worker.cjs');
/** @type {WeakMap<object,any>} */const originals=new WeakMap();
/** 원 child/전용 작업 소유권은 UNKNOWN 뒤에도 보존한다. 종료 event는 결과 불명을 치유하지 않는다.
 * @type {WeakMap<object,any>} */const attempts=new WeakMap();
/** @type {Set<any>} */const unknownAttempts=new Set();
/** @type {Set<any>} */const nodeOwners=new Set();
/** @returns {never} */function fail(){throw Error('NATIVE_WORKER_COMPILER_INVALID');}
/** @param {any} o @param {string} key */function own(o,key){if(!o||typeof o!=='object'||types.isProxy(o))fail();const d=Object.getOwnPropertyDescriptor(o,key);if(!d||!('value'in d))fail();return d.value;}
/** @param {any} v @param {number} [depth] @returns {any} */function snapshot(v,depth=0){if(depth>8)fail();if(v===null||typeof v==='string'||typeof v==='boolean')return v;if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return v;}if(!v||typeof v!=='object'||types.isProxy(v))fail();const a=Array.isArray(v),p=Object.getPrototypeOf(v),ds=Object.getOwnPropertyDescriptors(v);if(a?p!==Array.prototype:p!==Object.prototype&&p!==null)fail();const keys=Reflect.ownKeys(ds);if(keys.length>32||keys.some(k=>typeof k!=='string'||!('value'in ds[k])||(!ds[k].enumerable&&k!=='length')))fail();if(a){if(keys.length!==v.length+1)fail();return Object.freeze(Array.from({length:v.length},(_,i)=>{if(!ds[i])fail();return snapshot(ds[i].value,depth+1);}));}const out={};for(const k of keys){if(typeof k!=='string')fail();Object.defineProperty(out,k,{value:snapshot(ds[k].value,depth+1),enumerable:true});}return Object.freeze(out);}
/** @param {unknown} v @param {number} max */function bytes(v,max){if(types.isProxy(v)||!Buffer.isBuffer(v)||Object.getPrototypeOf(v)!==Buffer.prototype)fail();for(const k of ['length','byteLength','copy','subarray','constructor',Symbol.iterator])if(Object.getOwnPropertyDescriptor(v,k))fail();const get=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')?.get;if(!get)fail();const n=Reflect.apply(get,v,[]);if(n<1||n>max)fail();const out=Buffer.alloc(n);Uint8Array.prototype.set.call(out,v);return out;}
/** 원 token 판독은 caller 선언을 받지 않는다. 실제 compiler driver 등록은 별도 배포 조립이며 기본값 없다.
 * @param {unknown} token */
function readWorkerCompilation(token){if(!token||typeof token!=='object'||types.isProxy(token))fail();const p=originals.get(token);if(!p)fail();p.check();return{compile:p.compile,worker:bytes(p.worker,20*1024*1024),workerHash:p.workerHash,observedAt:p.now(),remainingMs:p.remaining()};}
/** @param {unknown} token @param {string} path */async function readWorkerCompilationInput(token,path){readWorkerCompilation(token);const p=originals.get(/** @type {object} */(token)),compile=p.compile;const expected=[compile.compiler,...compile.references,{path:require('node:path').win32.join(compile.workingDirectory,...compile.source.path.split('/')),sha256:compile.source.sha256}].find(f=>f.path===path);if(!expected)fail();const b=bytes(await p.read(path,64*1024*1024),64*1024*1024);p.check();if(createHash('sha256').update(b).digest('hex')!==expected.sha256)fail();return b;}
/** @param {unknown} token */async function checkWorkerCompilation(token){readWorkerCompilation(token);const p=originals.get(/** @type {object} */(token));await p.validate();p.check();}
/** 원 source reader + 한정 compiler driver/작업파일 IO. driver는 exit 관측을 제공하며 verifier 주입은 없다.
 * input={configuration,expiresAt}; ports={read,check,inspect,readOutput,driver,now,monotonic,schedule}.
 * inspect는 {state:'ABSENT'} 또는 {state:'FILE',identity,nlink:1,link:false,bytes}를 반환한다.
 * @param {any} input @param {any} ports */
async function runNativeWorkerCompiler(input,ports){
 const configuration=snapshot(own(input,'configuration')),expiresAt=own(input,'expiresAt');if(typeof expiresAt!=='string'||new Date(expiresAt).toISOString()!==expiresAt)fail();
 const names=['read','check','inspect','readOutput','driver','now','monotonic','schedule'],functions=names.map(k=>own(ports,k));if(functions.some(f=>typeof f!=='function'))fail();
 if(attempts.has(ports))fail();
 /** @type {any} */
 const ownership={state:'ACTIVE',child:null,invocation:null,outputPath:configuration.outputPath,closeObserved:false,closeCode:null};attempts.set(ports,ownership);
 const [read,checkPort,inspect,readOutput,driver,now,mono,schedule]=functions,start=mono.call(ports),wall=now.call(ports),end=Math.min(start+120000,start+Date.parse(expiresAt)-wall);let lastWall=wall,lastMono=start,closed=false,active=true,sent=false;
 /** @type {undefined|(()=>void)} */let unwatch;
 /** @type {undefined|(()=>void)} */let clear;
 const stable=()=>{if(names.some((k,i)=>own(ports,k)!==functions[i]))fail();checkPort.call(ports);const w=now.call(ports),m=mono.call(ports);if(!Number.isSafeInteger(w)||!Number.isFinite(m)||w<lastWall||m<lastMono||m>=end||w>=Date.parse(expiresAt)||!active)fail();lastWall=w;lastMono=m;};
 let abort=()=>{};const stopped=new Promise((_,reject)=>{abort=()=>{active=false;reject(Error('NATIVE_WORKER_COMPILER_UNKNOWN'));};});
 const call=async(/** @type {Function} */f,/** @type {any[]} */args)=>{stable();const r=await Promise.race([Reflect.apply(f,ports,args),stopped]);stable();return r;};
 const work=(async()=>{stable();clear=schedule.call(ports,abort,Math.max(1,end-start));if(typeof clear!=='function')fail();
  const prepared=await prepareNativeWorkerCompile(configuration,{read:async(/** @type {string} */p,/** @type {number} */max)=>call(read,[p,max]),check:stable});stable();const output=prepared.compile.outputPath;
  const absent=await call(inspect,[output]);if(!absent||types.isProxy(absent)||Object.keys(absent).join(',')!=='state'||absent.state!=='ABSENT')fail();
  let settle=()=>{};
  /** @type {Promise<void>} */const finished=new Promise(resolve=>{settle=()=>resolve();});let code=null,stdio=0,bad=false;
  const sink=Object.freeze({stdout:(/** @type {unknown} */v)=>{try{stdio+=bytes(v,65536).length;if(stdio>65536)abort();}catch{abort();}},stderr:(/** @type {unknown} */v)=>{try{stdio+=bytes(v,65536).length;if(stdio>65536)abort();}catch{abort();}},error:abort,close:(/** @type {number|null} */v,/** @type {string|null} */signal)=>{if(closed){bad=true;abort();return;}closed=true;code=v;ownership.closeObserved=true;ownership.closeCode=v;if(signal!==null)bad=true;settle();}});
  ownership.invocation=Object.freeze({file:prepared.compile.compiler.path,args:prepared.compile.arguments,cwd:prepared.compile.workingDirectory,shell:false,windowsHide:true,stdio:Object.freeze(['ignore','pipe','pipe'])});sent=true;const child=driver.call(ports,ownership.invocation);ownership.child=child;
  const watch=own(child,'watch');if(typeof watch!=='function')fail();unwatch=watch.call(child,sink);if(typeof unwatch!=='function')fail();await Promise.race([finished,stopped]);stable();if(bad||code!==0||!closed)fail();
  const before=await call(inspect,[output]),worker=bytes(await call(readOutput,[output,20*1024*1024]),20*1024*1024),verified=await verifyNativeWorker(worker),after=await call(inspect,[output]);
  if(!before||types.isProxy(before)||!after||types.isProxy(after)||before.state!=='FILE'||before.nlink!==1||before.link!==false||typeof before.identity!=='string'||!before.identity||before.bytes!==worker.length||JSON.stringify(before)!==JSON.stringify(after))fail();
  await prepared.validate();stable();if(createHash('sha256').update(worker).digest('hex')!==verified.workerHash)fail();
  const token=Object.freeze({});originals.set(token,{compile:prepared.compile,worker,workerHash:verified.workerHash,now:()=>now.call(ports),remaining:()=>Math.max(0,Math.min(end-mono.call(ports),Date.parse(expiresAt)-now.call(ports))),read:(/** @type {string} */p,/** @type {number} */max)=>read.call(ports,p,max),check:()=>{if(names.some((k,i)=>own(ports,k)!==functions[i]))fail();checkPort.call(ports);const w=now.call(ports),m=mono.call(ports);if(w<lastWall||m<lastMono||w>=Date.parse(expiresAt)||m>=end)fail();lastWall=w;lastMono=m;},validate:async()=>{const info=await inspect.call(ports,output),b=bytes(await readOutput.call(ports,output,20*1024*1024),20*1024*1024);if(JSON.stringify(info)!==JSON.stringify(before)||!b.equals(worker))fail();for(const f of [prepared.compile.compiler,...prepared.compile.references,{path:require('node:path').win32.join(prepared.compile.workingDirectory,...prepared.compile.source.path.split('/')),sha256:prepared.compile.source.sha256}])if(createHash('sha256').update(bytes(await read.call(ports,f.path,64*1024*1024),64*1024*1024)).digest('hex')!==f.sha256)fail();}});ownership.state='VERIFIED';return token;
 })();
 try{return await Promise.race([work,stopped]);}catch(e){ownership.state=sent?'UNKNOWN':'REJECTED';if(sent){unknownAttempts.add(ownership);throw Error('NATIVE_WORKER_COMPILER_UNKNOWN');}throw e;}
 finally{active=false;try{if(clear)clear();if(unwatch)unwatch();}catch{ownership.state='UNKNOWN';unknownAttempts.add(ownership);throw Error('NATIVE_WORKER_COMPILER_UNKNOWN');}finally{void work.catch(()=>{});}}
}
/** 실제 build 조립용 Node adapter. 호출 시에만 전용 새 작업 폴더/고정 csc를 사용한다.
 * 이 함수는 기본 앱에 등록하지 않는다. 테스트는 이 OS 분기를 실행하지 않는다.
 * @param {any} input */
async function runNodeNativeWorkerCompiler(input){
 const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
 const configuration=snapshot(own(input,'configuration')),expiresAt=own(input,'expiresAt'),c=configuration;
 // 입력은 준비 검산기에서 다시 검산한다. output은 새 폴더에서만 생성하며 기존 결과를 채택하지 않는다.
 const output=own(configuration,'outputPath');if(typeof output!=='string'||path.win32.basename(output)!=='OwnershipEvidenceWorker.exe'||!/^[A-Z]:\\/.test(output)||path.win32.normalize(output)!==output)fail();
 const root=path.win32.dirname(output),parent=path.win32.dirname(root),parentInfo=await fs.lstat(parent);if(!parentInfo.isDirectory()||parentInfo.isSymbolicLink()||await fs.realpath(parent)!==parent)fail();
 const system=process.env.SystemRoot;if(!system||!/^[A-Za-z]:\\/.test(system)||path.win32.normalize(system)!==system)fail();
 const env=Object.freeze({SystemRoot:system,WINDIR:system});
 /** @type {any} */
 const owner={root,output,parentIdentity:String(parentInfo.dev)+':'+String(parentInfo.ino),rootIdentity:null,child:null,state:'CREATING',closeObserved:false,closeCode:null,killRequested:false};nodeOwners.add(owner);await fs.mkdir(root);const rootInfo=await fs.lstat(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())fail();
 const identity=(/** @type {any} */s)=>String(s.dev)+':'+String(s.ino);owner.rootIdentity=identity(rootInfo);owner.state='OWNED';
 const rootCheck=async()=>{const s=await fs.lstat(root);if(!s.isDirectory()||s.isSymbolicLink()||identity(s)!==identity(rootInfo)||await fs.realpath(root)!==root)fail();};
 const read=async(/** @type {string} */p,/** @type {number} */max)=>{await rootCheck();const before=await fs.lstat(p);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>max||await fs.realpath(p)!==p)fail();const h=await fs.open(p,'r');try{const held=await h.stat();if(identity(held)!==identity(before)||held.nlink!==1)fail();const b=await h.readFile();const after=await h.stat(),again=await fs.lstat(p);if(b.length>max||identity(after)!==identity(again)||after.nlink!==1||again.isSymbolicLink()||after.size!==b.length||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)fail();return b;}finally{await h.close();}};
 const inspect=async(/** @type {string} */p)=>{await rootCheck();if(p!==output)fail();try{const s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||await fs.realpath(p)!==p)fail();return{state:'FILE',identity:identity(s),nlink:1,link:false,bytes:s.size};}catch(e){if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return{state:'ABSENT'};throw e;}};
 const exactArgs=['/noconfig','/nostdlib+','/nologo','/target:exe','/platform:x64','/optimize+','/debug-','/main:Anvil.Native.OwnershipEvidence.OwnershipEvidenceWorker','/out:'+output,...c.references.map((/** @type {any} */r)=>'/reference:'+r.path),path.win32.join(c.repoRoot,'apps','connector','native','OwnershipEvidenceWorker.cs')];
 return runNativeWorkerCompiler({configuration:c,expiresAt},{read,inspect,readOutput:read,check:()=>{},now:Date.now,monotonic:()=>performance.now(),schedule:(/** @type {()=>void} */cb,/** @type {number} */ms)=>{const t=setTimeout(cb,ms);return()=>clearTimeout(t);},driver:(/** @type {any} */inv)=>{
  if(inv.file!==c.compiler.path||inv.cwd!==c.repoRoot||JSON.stringify(inv.args)!==JSON.stringify(exactArgs)||inv.shell!==false||inv.windowsHide!==true)fail();
  const child=cp.spawn(inv.file,[...exactArgs],{cwd:inv.cwd,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});owner.child=child;owner.state='RUNNING';child.on('close',(code,signal)=>{owner.closeObserved=true;owner.closeCode=code;if(owner.state!=='UNKNOWN')owner.state=code===0&&signal===null?'EXITED':'UNKNOWN';});child.on('error',()=>{owner.state='UNKNOWN';});let watched=false;
  return{watch:(/** @type {any} */sink)=>{if(watched)fail();watched=true;child.stdout.on('data',sink.stdout);child.stderr.on('data',sink.stderr);child.on('error',sink.error);child.on('close',sink.close);return()=>{child.stdout.removeListener('data',sink.stdout);child.stderr.removeListener('data',sink.stderr);child.removeListener('close',sink.close);if(!owner.closeObserved){owner.state='UNKNOWN';owner.killRequested=true;child.kill();}/* kill은 종료 확인이 아니며 UNKNOWN 결과를 바꾸지 않는다. */};}};
 }});
}
module.exports={runNativeWorkerCompiler,runNodeNativeWorkerCompiler,readWorkerCompilation,checkWorkerCompilation,readWorkerCompilationInput};
