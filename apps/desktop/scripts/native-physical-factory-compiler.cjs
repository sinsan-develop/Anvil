'use strict';
const path=require('node:path'),{types}=require('node:util');
const {produceCompileInput}=require('./native-physical-factory-build.cjs');
const bufferByteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')?.get;
const bufferPrototype=Buffer.prototype,typedArraySet=Uint8Array.prototype.set,allocateBuffer=Buffer.alloc,compareBuffers=Buffer.compare;
const MAX_STDIO=65536,MAX_OUTPUT=64*1024*1024,MAX_MS=120000;
/** @typedef {{path:string,identity:string,owner:string,kind:'DIRECTORY',link:false,entries:string[]}} Directory */
/** @typedef {{state:'ABSENT'}|{state:'FILE',path:string,identity:string,owner:string,link:false,nlink:1,bytes:number}} FileState */
/** @typedef {{identity:string,write:(bytes:Buffer,offset:number)=>Promise<number>,sync:()=>Promise<void>,close:()=>Promise<void>}} BasisHandle */
/** @typedef {{inspectDirectory:(p:string)=>Promise<Directory>,inspectFile:(p:string)=>Promise<FileState>,openExclusive:(p:string)=>Promise<BasisHandle>,read:(p:string,max:number)=>Promise<Buffer>}} CompileIO */
/** @typedef {{stdout:(v:unknown)=>void,stderr:(v:unknown)=>void,error:()=>void,close:(code:number|null,signal:string|null)=>void}} Sink */
/** @typedef {{watch:(sink:Readonly<Sink>)=>()=>void}} ChildPort */
/** @typedef {{file:string,args:readonly string[],cwd:string,env:Readonly<{SystemRoot:string,WINDIR:string}>,shell:false,windowsHide:true,stdio:readonly ['ignore','pipe','pipe']}} Invocation */
/** @typedef {{build:Parameters<typeof produceCompileInput>[0],work:{root:string,identity:string,owner:string},expiresAt:string}} Input */
/** @typedef {{io:CompileIO,inputIO:import('./verify-installer-development.cjs').IO,driver:(value:Readonly<Invocation>)=>ChildPort,environment:{SystemRoot:string,WINDIR:string},now:()=>number,monotonic:()=>number,schedule:(callback:()=>void,ms:number)=>()=>void}} Ports */
/** @returns {never} */function invalid(){throw Error('NATIVE_COMPILER_INPUT_INVALID');}
/** 원 IO Buffer의 getter/메서드를 호출하지 않는다. 복사 전 actual byte bounds를 확인한다.
 * @param {unknown} value @param {number} max
 */
function ownedBuffer(value,max){
 if(types.isProxy(value)||!Buffer.isBuffer(value)||Object.getPrototypeOf(value)!==bufferPrototype||!bufferByteLength)invalid();
 for(const key of ['length','byteLength','equals','copy','set','subarray','slice','constructor',Symbol.iterator,Symbol.toPrimitive])if(Object.getOwnPropertyDescriptor(value,key))invalid();
 const length=Reflect.apply(bufferByteLength,value,[]);if(!Number.isSafeInteger(length)||length<0||length>max)invalid();
 const bytes=allocateBuffer(length);Reflect.apply(typedArraySet,bytes,[value]);return Object.freeze({bytes,length});
}
/** @param {unknown} value @param {string[]} keys */
function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(d).length===keys.length&&keys.every(k=>d[k]&&d[k].enumerable&&'value'in d[k]);}
/** @param {unknown} value @param {string} key */
function own(value,key){if(!value||typeof value!=='object')return invalid();const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))return invalid();return d.value;}
/** @param {unknown} value @param {number} [depth] */
function dataOnly(value,depth=0){if(depth>16)invalid();if(value&&typeof value==='object'){if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))invalid();const d=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(d).length>128)invalid();for(const key of Reflect.ownKeys(d)){if(typeof key!=='string'||!('value'in d[key]))invalid();dataOnly(d[key].value,depth+1);}}else if(!['string','number','boolean'].includes(typeof value)&&value!==null)invalid();}
/** @param {unknown} value */
function absolute(value){return typeof value==='string'&&/^[A-Za-z]:\\/.test(value)&&path.win32.normalize(value)===value&&value.length<=1024&&!/[<>"|?*\x00-\x1f]/.test(value)&&!value.slice(2).includes(':')&&!value.includes('@')&&!value.includes(',');}
/** @param {unknown} value @param {number} max */
function dataArray(value,max){if(!Array.isArray(value)||value.length>max)return false;const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(d).length===value.length+1&&Array.from({length:value.length},(_,i)=>d[String(i)]).every(p=>p&&'value'in p&&p.enumerable);}
/** @template T @param {T} value @returns {Readonly<T>} */
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
/** 실제 spawn/파일 IO 기본값은 없다. 기본 앱/CLI 등록도 없다.
 * @param {Input} input
 * @param {Ports} ports
 */
async function runNativePhysicalFactoryCompiler(input,ports){
 if(!exact(input,['build','work','expiresAt'])||!exact(input.work,['root','identity','owner'])||!absolute(input.work.root)||typeof input.work.identity!=='string'||!input.work.identity||input.work.identity.length>512||typeof input.work.owner!=='string'||!input.work.owner||input.work.owner.length>256||typeof input.expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.expiresAt)||!Number.isFinite(Date.parse(input.expiresAt))||!exact(ports,['io','inputIO','driver','environment','now','monotonic','schedule']))invalid();
 const root=input.work.root,owner=input.work.owner,identity=input.work.identity,expires=Date.parse(input.expiresAt),io=own(ports,'io'),inputIO=own(ports,'inputIO'),driver=own(ports,'driver'),now=own(ports,'now'),monotonic=own(ports,'monotonic'),schedule=own(ports,'schedule'),environment=own(ports,'environment');
 if(!exact(io,['inspectDirectory','inspectFile','openExclusive','read'])||!exact(environment,['SystemRoot','WINDIR'])||![driver,now,monotonic,schedule].every(f=>typeof f==='function'))invalid();
 const env=Object.freeze({SystemRoot:own(environment,'SystemRoot'),WINDIR:own(environment,'WINDIR')});if(!absolute(env.SystemRoot)||!absolute(env.WINDIR)||env.SystemRoot.toLowerCase()!==env.WINDIR.toLowerCase())invalid();
 const ioNames=['inspectDirectory','inspectFile','openExclusive','read'],ioFns=ioNames.map(k=>own(io,k)),readInput=own(inputIO,'read');if(ioFns.some(f=>typeof f!=='function')||typeof readInput!=='function')invalid();
 const initialWall=now(),initialMono=monotonic();if(!Number.isFinite(initialWall)||!Number.isFinite(initialMono)||expires<=initialWall)invalid();
 const deadline=initialMono+Math.min(MAX_MS,expires-initialWall);let lastMono=initialMono,lastWall=initialWall,stopped=false,started=false,closed=false,uncertain=false,exitCode=null,stdoutBytes=0,stderrBytes=0;
 /** @type {ReturnType<typeof produceCompileInput> extends Promise<infer T>?T:never|undefined} */
 let production;
 /** @type {(()=>void)|undefined} */
 let unwatch;
 /** @type {(()=>void)|undefined} */
 let cancelTimer;
 let notifyUnknown=()=>{};
 const unknown=new Promise(resolve=>{notifyUnknown=()=>{stopped=true;resolve(null);};});
 /** @returns {never} */const expired=()=>{notifyUnknown();throw Error('NATIVE_COMPILER_UNKNOWN');};
 const stable=()=>{if(!exact(ports,['io','inputIO','driver','environment','now','monotonic','schedule'])||own(ports,'io')!==io||own(ports,'inputIO')!==inputIO||own(ports,'driver')!==driver||own(ports,'now')!==now||own(ports,'monotonic')!==monotonic||own(ports,'schedule')!==schedule||own(ports,'environment')!==environment||!exact(environment,['SystemRoot','WINDIR'])||own(environment,'SystemRoot')!==env.SystemRoot||own(environment,'WINDIR')!==env.WINDIR||!exact(io,ioNames)||ioNames.some((k,i)=>own(io,k)!==ioFns[i])||own(inputIO,'read')!==readInput)return expired();};
 const check=()=>{stable();const wall=now(),mono=monotonic();if(!Number.isFinite(wall)||!Number.isFinite(mono)||wall<lastWall||mono<lastMono||wall>=expires||mono>=deadline||stopped)return expired();lastMono=mono;lastWall=wall;};
 /** @param {number} i @param {unknown[]} args */
 const callIO=async(i,args)=>{check();const result=await Reflect.apply(ioFns[i],io,args);check();return result;};
 const basisPath=path.win32.join(root,'ParentBasis.json'),outputPath=path.win32.join(root,'NativeOwner.exe');
 if(!exact(input.build,['repoRoot','parentRoot','configuration'])||!exact(input.build.configuration,['factoryId','factoryVersion','compiler','references','basisPath','outputPath'])||input.build.configuration.basisPath!==basisPath||input.build.configuration.outputPath!==outputPath)invalid();
 // 작업 인자를 먼저 복사한다. 원 producer는 이 복사본을 다시 검산한다.
 dataOnly(input.build);const build=JSON.parse(JSON.stringify(input.build));
 /** @param {string[]} expected */
 const directory=async expected=>{const s=await callIO(0,[root]);if(!exact(s,['path','identity','owner','kind','link','entries'])||s.path!==root||s.identity!==identity||s.owner!==owner||s.kind!=='DIRECTORY'||s.link!==false||!dataArray(s.entries,4)||JSON.stringify([...s.entries].sort())!==JSON.stringify([...expected].sort()))invalid();};
 /** @param {string} file */
 const absent=async file=>{const s=await callIO(1,[file]);if(!exact(s,['state'])||s.state!=='ABSENT')invalid();};
 /** @param {string} file */
 const regular=async file=>{const s=await callIO(1,[file]);if(!exact(s,['state','path','identity','owner','link','nlink','bytes'])||s.state!=='FILE'||s.path!==file||s.owner!==owner||s.link!==false||s.nlink!==1||typeof s.identity!=='string'||!s.identity||!Number.isSafeInteger(s.bytes)||s.bytes<1||s.bytes>MAX_OUTPUT)invalid();return s;};
 const companions=async()=>{for(const suffix of ['.config','.local','.manifest'])await absent(outputPath+suffix);};
 /** @param {string} text */
 const basis=async text=>{
  const expected=Buffer.from(text,'utf8'),expectedLength=expected.length;if(expectedLength<1||expectedLength>8192)invalid();
  /** @type {BasisHandle|undefined} */
  let handle;
  /** @type {unknown[]} */
  let functions=[];
  let handleIdentity='';
  const sameHandle=()=>{if(!handle||!exact(handle,['identity','write','sync','close'])||own(handle,'identity')!==handleIdentity||['write','sync','close'].some((k,i)=>own(handle,k)!==functions[i]))invalid();};
  try{check();handle=await Reflect.apply(ioFns[2],io,[basisPath]);if(!handle||!exact(handle,['identity','write','sync','close'])||typeof handle.identity!=='string'||!handle.identity)invalid();handleIdentity=handle.identity;functions=['write','sync','close'].map(k=>own(handle,k));if(functions.some(f=>typeof f!=='function'))invalid();check();sameHandle();
   let offset=0;while(offset<expectedLength){check();sameHandle();const writeCopy=ownedBuffer(expected,8192).bytes,n=await Reflect.apply(/** @type {Function} */(functions[0]),handle,[writeCopy,offset]);check();sameHandle();if(compareBuffers(ownedBuffer(writeCopy,8192).bytes,expected)!==0||!Number.isSafeInteger(n)||n<1||n>expectedLength-offset)invalid();offset+=n;}
   await Reflect.apply(/** @type {Function} */(functions[1]),handle,[]);check();sameHandle();
  }finally{
   // 이미 호출한 IO의 await가 정착한 뒤 자기 handle만 닫는다. 만료는 필수 close를 막지 않는다.
   if(handle&&functions.length===3&&typeof functions[2]==='function'){if(own(handle,'close')!==functions[2])throw Error('NATIVE_COMPILER_UNKNOWN');await Reflect.apply(functions[2],handle,[]);}
  }
  check();sameHandle();const b=ownedBuffer(await callIO(3,[basisPath,8192]),8192);if(compareBuffers(b.bytes,expected)!==0)invalid();const info=await regular(basisPath);if(!handle||info.identity!==handle.identity||info.bytes!==expectedLength)invalid();
 };
 /** @type {Promise<{state:'VERIFIED_OUTPUT'|'REJECTED'|'FAILED'|'UNKNOWN',code:string,artifact?:Awaited<ReturnType<Awaited<ReturnType<typeof produceCompileInput>>['verifyOutput']>>}>} */
 const work=(async()=>{
  try{
   check();const cancel=schedule(notifyUnknown,Math.max(1,Math.floor(deadline-initialMono)));if(typeof cancel!=='function')invalid();cancelTimer=cancel;
   await directory([]);await absent(basisPath);await absent(outputPath);await companions();
   production=await produceCompileInput(build,{io:inputIO,check});check();
   await basis(production.compile.basisBytes);await directory(['ParentBasis.json']);await absent(outputPath);await companions();
   /** @type {(code:number|null,signal:string|null)=>void} */
   let onClose=()=>{};
   const settled=new Promise(resolve=>{onClose=(code,signal)=>{if(closed){uncertain=true;notifyUnknown();return;}closed=true;exitCode=code;if(signal!==null||!Number.isInteger(code)||code===null)uncertain=true;resolve(null);};});
   /** @param {'stdout'|'stderr'} which @param {unknown} value */
   const stream=(which,value)=>{try{if(stopped)return;const n=ownedBuffer(value,MAX_STDIO).length;if(which==='stdout')stdoutBytes+=n;else stderrBytes+=n;if(stdoutBytes>MAX_STDIO||stderrBytes>MAX_STDIO)notifyUnknown();}catch{notifyUnknown();}};
   const sink=Object.freeze({stdout:/** @param {unknown} v */v=>stream('stdout',v),stderr:/** @param {unknown} v */v=>stream('stderr',v),error:()=>{uncertain=true;notifyUnknown();},close:onClose});
   const child=await production.enterCompiler(c=>{check();started=true;return driver(freeze({file:c.compiler.path,args:[...c.arguments],cwd:c.workingDirectory,env:{...env},shell:false,windowsHide:true,stdio:/** @type {['ignore','pipe','pipe']} */(['ignore','pipe','pipe'])}));});
   if(!exact(child,['watch'])){uncertain=true;return{state:'UNKNOWN',code:'NATIVE_COMPILER_UNKNOWN'};}const watch=own(child,'watch');if(typeof watch!=='function'){uncertain=true;return{state:'UNKNOWN',code:'NATIVE_COMPILER_UNKNOWN'};}
   unwatch=watch.call(child,sink);if(typeof unwatch!=='function'){uncertain=true;return{state:'UNKNOWN',code:'NATIVE_COMPILER_UNKNOWN'};}
   await settled;check();if(own(child,'watch')!==watch||uncertain)return{state:'UNKNOWN',code:'NATIVE_COMPILER_UNKNOWN'};if(exitCode!==0)return{state:'FAILED',code:'NATIVE_COMPILER_FAILED'};
   await directory(['NativeOwner.exe','ParentBasis.json']);await companions();const before=await regular(outputPath),output=ownedBuffer(await callIO(3,[outputPath,MAX_OUTPUT]),Math.min(before.bytes,MAX_OUTPUT));if(output.length!==before.bytes)invalid();const after=await regular(outputPath);if(JSON.stringify(before)!==JSON.stringify(after))invalid();
   const artifact=await production.verifyOutput(output.bytes);check();return{state:'VERIFIED_OUTPUT',code:'NATIVE_COMPILER_OUTPUT_VERIFIED',artifact};
  }catch{if(stopped||started&&!closed||uncertain)return{state:'UNKNOWN',code:'NATIVE_COMPILER_UNKNOWN'};return{state:started?'FAILED':'REJECTED',code:started?'NATIVE_COMPILER_FAILED':'NATIVE_COMPILER_REJECTED'};}
  finally{if(closed&&unwatch){try{unwatch();}catch{uncertain=true;}}}
 })();
 const settled=work.then(()=>undefined,()=>undefined);void settled.catch(()=>{});
 const outcome=await Promise.race([work,unknown.then(()=>({state:/** @type {const} */('UNKNOWN'),code:'NATIVE_COMPILER_UNKNOWN'}))]);
 if(cancelTimer){try{cancelTimer();}catch{uncertain=true;}}
 const final=uncertain||stopped?{state:'UNKNOWN',code:'NATIVE_COMPILER_UNKNOWN'}:outcome;
 return Object.freeze({...final,preserved:true,compilerStarted:started,stdoutBytes,stderrBytes,settled});
}
module.exports={runNativePhysicalFactoryCompiler};
