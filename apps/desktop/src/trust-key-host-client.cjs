'use strict';
const path=require('node:path'),{types}=require('node:util'),{EventEmitter}=require('node:events');
const {canonicalJson,contentHash,catalogueExact}=require('./runtime-catalogue-profile.cjs');
const sdkBootstrapMode=Symbol('sdk-bootstrap');
const sdkBootstrapEndpoints=new WeakMap();
const sdkChildSources=new WeakMap(),preparedSdkChildOwners=new WeakMap();
const liveChannels=new WeakMap(),sdkBootstrapWorkers=new WeakMap(),sdkBootstrapPorts=new WeakMap();
const unconfirmedSdkWorkers=new Map();
const intrinsicLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')?.get;

/** @typedef {{leaseId:string,sourceHash:string,bindingHash:string,expiresAt:string,childCreated:false,executionAuthorized:false,dispatchPerformed:false}} SdkSourceMetadata */
/** @typedef {Readonly<{read:()=>SdkSourceMetadata&{state:'SDK_CHILD_SOURCE_PREPARED'}}>} PreparedSdkChildSource */
/** @typedef {{state:'SDK_HOOK_EFFECT_UNAVAILABLE',reason:'PRESPAWN_CURRENT_UNAVAILABLE'}} SdkHookUnavailable */
/** @typedef {Readonly<{read:()=>SdkSourceMetadata&{endpointId:string},inspectQueryAdmission:(signal:AbortSignal)=>Promise<never>,verifyHook:(spec:unknown,signal:AbortSignal)=>Promise<SdkHookUnavailable>,close:()=>Promise<{state:'UNKNOWN'}>}>} SdkSupervisorOwner */
/** @typedef {Readonly<{acknowledge:()=>Promise<void>,afterClose:()=>Promise<SdkSupervisorOwner>,discard:()=>Promise<{state:'UNKNOWN'}>}>} PreparedSdkSupervisorHandoff */
/** @typedef {{schemaVersion:number,purpose:string,leaseId:string,endpointId:string,sourceHash:string,bindingHash:string}&Record<string,unknown>} SdkBrokerFrame */

/** @returns {never} */function unavailable(){throw Error('PROTECTION_UNAVAILABLE');}

/** @returns {never} */function uncertain(){throw Error('OUTCOME_UNKNOWN');}

/** @param {any} v @param {string} k */function own(v,k){if(types.isProxy(v)||!v||typeof v!=='object')return unavailable();const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))return unavailable();return d.value;}

/** @param {any} object @param {string} name */function method(object,name){if(types.isProxy(object)||!object||typeof object!=='object')return unavailable();let current=object;for(let i=0;i<12&&current;i++,current=Object.getPrototypeOf(current)){if(types.isProxy(current))return unavailable();const d=Object.getOwnPropertyDescriptor(current,name);if(d){if(!('value'in d)||typeof d.value!=='function')return unavailable();return d.value;}}return unavailable();}

/** @param {any} raw @param {number} max */function copyBuffer(raw,max){if(types.isProxy(raw)||!Buffer.isBuffer(raw)||Object.getPrototypeOf(raw)!==Buffer.prototype||!intrinsicLength)return unavailable();for(const k of ['length','byteLength','constructor','subarray','copy','equals',Symbol.iterator])if(Object.getOwnPropertyDescriptor(raw,k))return unavailable();const n=Reflect.apply(intrinsicLength,raw,[]);if(n<0||n>max)return unavailable();const b=Buffer.alloc(n);Reflect.apply(Uint8Array.prototype.set,b,[raw]);return b;}

/** @param {any} value */function fixedPath(value){return typeof value==='string'&&value.length<=1024&&/^[A-Za-z]:\\/.test(value)&&path.win32.normalize(value)===value&&!/[<>:"|?*\x00-\x1f]/.test(value.slice(2));}

/** 명시 생성한 원 child만 소유한다. import/생성자는 process/FS 효과가 없다.
 * @param {any} input @param {any} ports @param {symbol} [mode]
 */
function createTrustKeyHostClient(input,ports,mode){const binding=JSON.parse(canonicalJson(catalogueExact(input,'path,signerRef,helperHash')));if(!fixedPath(binding.path)||path.win32.basename(binding.path)!=='AnvilTrustKeyHost.exe'||!binding.signerRef||binding.signerRef.contentHash!==binding.helperHash||!/^[0-9a-f]{64}$/.test(binding.helperHash))return unavailable();const names=['readImage','companion','environment','spawn','uuid'];const functions=names.map(k=>own(ports,k));if(functions.some(f=>typeof f!=='function'))return unavailable();let used=false;
/** @type {any} */let retained=null;

/** @param {any} lease */async function open(lease){if(used)return unavailable();used=true;const check=own(lease,'check'),remaining=own(lease,'remainingMs'),expiry=own(lease,'callExpiresAt'),signal=own(lease,'signal');if(typeof check!=='function'||typeof remaining!=='function'||typeof expiry!=='function'||!(signal instanceof AbortSignal))return unavailable();let active=true,sticky=false,closed=false,ending=false,endRequested=false,writes=0,busy=false,sequence=0,buffer=Buffer.alloc(0);
/** @type {string|null} */let rootIdentity=null;

/** @type {any} */let pending=null;
const guard=()=>{if(!active||signal.aborted||names.some((k,i)=>own(ports,k)!==functions[i])||own(lease,'check')!==check||own(lease,'remainingMs')!==remaining||own(lease,'callExpiresAt')!==expiry||own(lease,'signal')!==signal)return unavailable();check();const ms=remaining();if(!Number.isFinite(ms)||ms<1||ms>10000)return unavailable();};

/** @param {number} i @param {any[]} args */const call=async(i,args)=>{guard();const value=await Reflect.apply(functions[i],ports,args);guard();return value;};
const image1=copyBuffer(await call(0,[binding.path,signal]),67108864);if(image1.length<1||contentHash(image1)!==binding.helperHash)return unavailable();image1.fill(0);const environment=Reflect.apply(functions[2],ports,[]),system=own(environment,'SystemRoot'),windir=own(environment,'WINDIR');if(!fixedPath(system)||!fixedPath(windir)||system.toLowerCase()!==windir.toLowerCase())return unavailable();const env=Object.freeze({SystemRoot:system,WINDIR:windir});for(const suffix of ['.config','.local','.manifest'])if(await call(1,[binding.path+suffix])!=='ABSENT')return unavailable();const image2=copyBuffer(await call(0,[binding.path,signal]),67108864);if(contentHash(image2)!==binding.helperHash)return unavailable();image2.fill(0);guard();const child=Reflect.apply(functions[3],ports,[binding.path,mode===sdkBootstrapMode?['--normal-sdk-bootstrap']:[],Object.freeze({shell:false,windowsHide:true,stdio:Object.freeze(['overlapped','overlapped','overlapped']),cwd:path.win32.dirname(binding.path),env})]);const stdin=own(child,'stdin'),stdout=own(child,'stdout'),stderr=own(child,'stderr'),write=method(stdin,'write'),end=method(stdin,'end');
const stable=()=>{if(own(child,'stdin')!==stdin||own(child,'stdout')!==stdout||own(child,'stderr')!==stderr||method(stdin,'write')!==write||method(stdin,'end')!==end)return uncertain();};
const latch=()=>{sticky=true;active=false;if(pending){clearTimeout(pending.timer);pending.reject(Error('OUTCOME_UNKNOWN'));pending=null;}};

/** @type {(value:any)=>void} */let resolveExit=()=>{};const exited=new Promise(resolve=>{resolveExit=resolve;});
const finish=()=>{if(pending&&pending.written&&pending.reply!==undefined){const p=pending;p.checkBudget?.();pending=null;clearTimeout(p.timer);p.resolve(p.reply);}};
const tryEnd=()=>{if(!endRequested||ending||closed||writes!==0)return;ending=true;try{stable();end.call(stdin,undefined,'utf8',()=>{});}catch{latch();}};

/** @param {any} raw */const data=raw=>{try{stable();guard();if(!pending||pending.reply!==undefined||closed)return uncertain();pending.checkBudget?.();const chunk=copyBuffer(raw,65536-buffer.length);buffer=Buffer.concat([buffer,chunk]);chunk.fill(0);const at=buffer.indexOf(10);if(at<0)return;if(at!==buffer.length-1)return uncertain();const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,at));buffer.fill(0);buffer=Buffer.alloc(0);const reply=catalogueExact(JSON.parse(text),'schemaVersion,purpose,requestId,sequence,rootIdentity,data');if(canonicalJson(reply)!==text||reply.schemaVersion!==1||reply.purpose!=='DESKTOP_TRUST_KEY_RESULT_V1'||reply.sequence!==pending.sequence||reply.requestId!==pending.requestId||typeof reply.rootIdentity!=='string'||reply.rootIdentity.length<1||reply.rootIdentity.length>512||rootIdentity!==null&&reply.rootIdentity!==rootIdentity)return uncertain();rootIdentity=reply.rootIdentity;if(reply.data?.state==='UNKNOWN'&&reply.data?.problem==='MAPPING_STORE'){pending.reply=reply.data;finish();return;}pending.reply=reply.data;finish();}catch{latch();}};
const error=()=>latch(),done=()=>{if(!ending||pending)latch();};
const listeners=[[stdout,'data',data],[stdout,'end',done],[stdout,'error',error],[stderr,'data',error],[stderr,'error',error],[stdin,'error',error],[child,'error',error]];for(const [emitter,event,fn] of listeners)EventEmitter.prototype.on.call(emitter,event,fn);
const cleanup=()=>{for(const [emitter,event,fn] of listeners)EventEmitter.prototype.off.call(emitter,event,fn);signal.removeEventListener('abort',abort);};
EventEmitter.prototype.once.call(child,'close',/** @param {any} code */code=>{closed=true;if(code!==0||!ending||pending)latch();resolveExit({closed:true,code,unknown:sticky});cleanup();});
const abort=()=>{latch();endRequested=true;tryEnd();};signal.addEventListener('abort',abort,{once:true});

/** @param {string} operation @param {any} payload @param {()=>{expiresAt:number,remainingMs:number}} [readBudget] */
async function send(operation,payload,readBudget){
 if(busy||sticky||closed||ending)return uncertain();guard();stable();if(sequence>=64)return uncertain();
 if(operation==='SIGN_NORMAL_START_PREPARATION_RESULT_V1'?typeof readBudget!=='function'||types.isProxy(readBudget):readBudget!==undefined)return unavailable();
 const frameBudget=()=>{
  const hostEnd=expiry(),hostRemaining=Math.floor(remaining());
  if(!readBudget)return{callExpiresAt:hostEnd,remainingMs:hostRemaining};
  const cap=catalogueExact(readBudget(),'expiresAt,remainingMs'),end=Math.min(Date.parse(hostEnd),cap.expiresAt),left=Math.min(hostRemaining,cap.remainingMs);
  if(!Number.isSafeInteger(cap.expiresAt)||!Number.isSafeInteger(end)||!Number.isSafeInteger(cap.remainingMs)||cap.remainingMs>2000||left<1)return unavailable();
  return{callExpiresAt:new Date(end).toISOString(),remainingMs:left};
 };
 const requestId=Reflect.apply(functions[4],ports,[]);if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId))return unavailable();
 const n=sequence+1,bounds=frameBudget(),frame=Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_OPERATION_V1',requestId,sequence:n,...bounds,signerRef:binding.signerRef,operation,payload})+'\n');
 if(frame.length>65536){frame.fill(0);return unavailable();}
 busy=true;try{return await new Promise((resolve,reject)=>{
  const checkBudget=readBudget?frameBudget:undefined;
  try{
   guard();stable();const delay=checkBudget?Math.min(bounds.remainingMs,checkBudget().remainingMs):Math.max(1,Math.floor(remaining()));
   pending={sequence:n,requestId,written:false,reply:undefined,resolve,reject,checkBudget,timer:setTimeout(latch,delay)};
   sequence=n;writes++;write.call(stdin,frame,'utf8',/** @param {any} error */error=>{
    writes--;frame.fill(0);if(error)latch();else if(pending){try{guard();stable();pending.checkBudget?.();pending.written=true;finish();}catch{latch();}}tryEnd();
   });
  }catch(error){frame.fill(0);if(pending){if(writes>0)writes--;latch();}else reject(error);}
 });}finally{busy=false;}
}
async function close(){endRequested=true;active=false;if(pending)latch();tryEnd();let timer;try{const ms=Math.max(0,Math.floor(remaining()));if(ms<1)return{state:'UNKNOWN'};const result=/** @type {any} */(await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(()=>resolve({unknown:true}),ms);})]));if(result.unknown)return{state:'UNKNOWN'};signal.removeEventListener('abort',abort);return{state:'CLOSED_CONFIRMED'};}catch{return{state:'UNKNOWN'};}finally{if(timer!==undefined)clearTimeout(timer);}}
/** 원 보호 host의 같은 10초/64 frame 안에서만 목적별 입력을 유계 전달한다.
 * @param {string} action @param {string} attemptId @param {unknown} value
 */
async function executionConfiguration(action,attemptId,value){
 if(!['PREPARE_EXECUTION_CONFIGURATION','CONFIRM_EXECUTION_CONFIGURATION','REVOKE_EXECUTION_CONFIGURATION'].includes(action)||typeof attemptId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attemptId))return unavailable();
 guard();const bytes=Buffer.from(canonicalJson(value),'utf8');let dispatched=false;
 try{if(bytes.length<1||bytes.length>1048576||sequence+Math.ceil(bytes.length/32768)>64)return unavailable();const transferId=Reflect.apply(functions[4],ports,[]);if(typeof transferId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(transferId))return unavailable();
  const hash=contentHash(bytes);let result;
  for(let offset=0,index=0;offset<bytes.length;offset+=32768,index++){
   guard();const end=Math.min(bytes.length,offset+32768),final=end===bytes.length;
   dispatched=true;result=await send(action,{attemptId,transferId,totalBytes:bytes.length,contentHash:hash,index,data:bytes.subarray(offset,end).toString('base64'),final});guard();
   if(!final){const r=catalogueExact(result,'state,transferId,index');if(r.state!=='PART_ACCEPTED'||r.transferId!==transferId||r.index!==index)return uncertain();}
  }
  return result;
 }catch(error){if(dispatched)latch();throw error;}finally{bytes.fill(0);}
}
/** 원 source bytes를 같은 등록 native host에 단회 전달한다. 반환은 비실행 준비의 opaque 소유자다.
 * 보존은 현재 channel/process 한정이다. 재시작 소진·supervisor/child 실행을 보장하지 않는다.
 * @param {unknown} raw
 * @returns {Promise<PreparedSdkChildSource>}
 */
async function prepareSdkChildSource(raw){
 guard();stable();if(mode===sdkBootstrapMode||sdkChildSources.has(retained))return unavailable();
 const value=JSON.parse(canonicalJson(catalogueExact(raw,'attemptId,slotId,startCommandId,sendCommandId,scope,handoff')));
 const validId=(/** @type {unknown} */v)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
 if(![value.attemptId,value.slotId,value.startCommandId,value.sendCommandId].every(validId))return unavailable();
 const bytes=Buffer.from(canonicalJson(value));let dispatched=false;
 const state={closed:false,expiresAt:Infinity,check:()=>{guard();stable();if(state.closed||Date.now()>=state.expiresAt)return unavailable();}};
 sdkChildSources.set(retained,state);
 try{
  if(bytes.length<1||bytes.length>2097152||sequence+Math.ceil(bytes.length/32768)>64)return unavailable();
  const hash=contentHash(bytes),transferId=Reflect.apply(functions[4],ports,[]);if(!validId(transferId))return unavailable();let result;
  for(let offset=0,index=0;offset<bytes.length;offset+=32768,index++){
   state.check();const stop=Math.min(bytes.length,offset+32768),final=stop===bytes.length;
   dispatched=true;result=await send('NORMAL_SDK_CHILD_SOURCE_PREPARE',{attemptId:value.attemptId,slotId:value.slotId,transferId,totalBytes:bytes.length,contentHash:hash,index,data:bytes.subarray(offset,stop).toString('base64'),final});state.check();
   if(!final){const row=catalogueExact(result,'state,transferId,index');if(row.state!=='PART_ACCEPTED'||row.transferId!==transferId||row.index!==index)return uncertain();}
  }
  const r=catalogueExact(result,'state,leaseId,sourceHash,bindingHash,expiresAt,childCreated,executionAuthorized,dispatchPerformed');
  if(r.state!=='SDK_CHILD_SOURCE_PREPARED'||!validId(r.leaseId)||r.sourceHash!==hash||typeof r.bindingHash!=='string'||!/^[a-f0-9]{64}$/.test(r.bindingHash)||r.childCreated!==false||r.executionAuthorized!==false||r.dispatchPerformed!==false||typeof r.expiresAt!=='string'||new Date(r.expiresAt).toISOString()!==r.expiresAt||Date.parse(r.expiresAt)<=Date.now()||Date.parse(r.expiresAt)>Date.parse(expiry()))return uncertain();
  const metadata=JSON.parse(canonicalJson(r));state.expiresAt=Date.parse(r.expiresAt);state.check();
  const prepared=Object.freeze({read:()=>{state.check();return JSON.parse(canonicalJson(metadata));}});
  preparedSdkChildOwners.set(prepared,{channel:retained,state,value,metadata,used:false});return prepared;
 }catch(error){state.closed=true;if(dispatched)latch();throw error;}finally{bytes.fill(0);}
}
/** 원 host가 만든 endpoint만 연결한다. Node는 supervisor process를 시작하지 않는다.
 * @param {object} original @param {()=>void} [firstCurrent] @returns {Promise<PreparedSdkSupervisorHandoff>}
 */
async function beginSdkChildSupervisor(original,firstCurrent){
 guard();stable();firstCurrent?.();const owned=preparedSdkChildOwners.get(original);if(!owned||owned.channel!==retained||owned.used)return unavailable();owned.used=true;owned.state.check();
 const m=owned.metadata,v=owned.value,payload={attemptId:v.attemptId,slotId:v.slotId,leaseId:m.leaseId,sourceHash:m.sourceHash,bindingHash:m.bindingHash};
 /** @type {ReturnType<typeof createSdkSupervisorBroker>|undefined} */let broker;try{
  const raw=await send('NORMAL_SDK_CHILD_SUPERVISOR_BEGIN',payload);owned.state.check();
  const r=catalogueExact(raw,'state,leaseId,endpointId,pipeName,sourceHash,bindingHash,expiresAt,childCreated,executionAuthorized,dispatchPerformed');
  const meta=catalogueExact({...r},'state,leaseId,endpointId,pipeName,sourceHash,bindingHash,expiresAt,childCreated,executionAuthorized,dispatchPerformed');
  if(meta.state!=='SDK_SUPERVISOR_ENDPOINT'||meta.leaseId!==m.leaseId||meta.sourceHash!==m.sourceHash||meta.bindingHash!==m.bindingHash||meta.expiresAt!==m.expiresAt||meta.childCreated!==false||meta.executionAuthorized!==false||meta.dispatchPerformed!==false||typeof meta.endpointId!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/).test(meta.endpointId)||meta.pipeName!==['','','.','pipe','anvil-sdk-'+meta.endpointId].join(String.fromCharCode(92)))return uncertain();
  const descriptor=Object.getOwnPropertyDescriptor(ports,'openSdkBroker');if(descriptor&&!('value'in descriptor)||descriptor&&typeof descriptor.value!=='function')return unavailable();
  const connect=descriptor?.value??((/** @type {string} */name)=>require('node:net').createConnection({path:name}));
  const originalBroker=createSdkSupervisorBroker(meta,connect,()=>{firstCurrent?.();if(Object.getOwnPropertyDescriptor(ports,'openSdkBroker')?.value!==descriptor?.value)return unavailable();});broker=originalBroker;
  let acknowledged=false,consumed=false;
  return Object.freeze({acknowledge:async()=>{
   owned.state.check();if(acknowledged)return unavailable();acknowledged=true;await originalBroker.acknowledge();owned.state.check();
   const answer=catalogueExact(await send('NORMAL_SDK_CHILD_SUPERVISOR_ACK',{...payload,endpointId:meta.endpointId}),'state,leaseId,endpointId,sourceHash,bindingHash');owned.state.check();
   if(answer.state!=='SDK_SUPERVISOR_ACKNOWLEDGED'||answer.leaseId!==meta.leaseId||answer.endpointId!==meta.endpointId||answer.sourceHash!==meta.sourceHash||answer.bindingHash!==meta.bindingHash)return uncertain();
  },afterClose:async()=>{
   // 원 host의 실제 close와 supervisor 자신의 원 parent exit 검산이 모두 필요하다.
   if(!acknowledged||consumed||!closed||sticky||!ending)return uncertain();consumed=true;await originalBroker.consumed();
   const {state:_state,pipeName:_pipe,...metadata}=meta;
   const adapter=require('./normal-sdk-worker-entry.cjs').createOwnedSdkQueryPreflight(Object.freeze({check:()=>originalBroker.check(),readIntent:()=>originalBroker.readIntent(),verifyHook:hash=>originalBroker.verifyHook(hash),admitQuery:()=>originalBroker.admitQuery(),close:async()=>{originalBroker.close();return{state:/** @type {'UNKNOWN'} */('UNKNOWN')};}}));
   originalBroker.onDispose(()=>{void adapter.close().catch(()=>{});});
   return Object.freeze({read:()=>{originalBroker.check();return JSON.parse(canonicalJson(metadata));},inspectQueryAdmission:adapter.inspectQueryAdmission,verifyHook:adapter.verifyHook,close:adapter.close});
  },discard:async()=>{originalBroker.close();return{state:/** @type {'UNKNOWN'} */('UNKNOWN')};}});
 }catch(error){broker?.close();latch();throw error;}
}
retained=Object.freeze({send,close,executionConfiguration,prepareSdkChildSource,beginSdkChildSupervisor,inspectionBudget:()=>{guard();stable();if(busy||sticky||closed||ending)return uncertain();return {frames:64-sequence,remainingMs:Math.max(0,Math.floor(remaining()))};}});liveChannels.set(retained,{check:()=>{guard();stable();if(sticky||closed||ending)return uncertain();},env});if(signal.aborted){abort();return uncertain();}guard();return retained;}
return Object.freeze({open,closeOwned:async()=>retained?retained.close():{state:'UNKNOWN'}});}

/** 실제 driver는 명시 호출 때만 동작한다. 자동 fallback/재시작/재접속은 없다.
 * @param {string} exe @param {string[]} args @param {any} options
 */function nodeKeyHostSpawn(exe,args,options){return require('node:child_process').spawn(exe,args,options);}
/** 원 endpoint의 메타 수령/ACK만 맡는다. EOF를 supervisor 종료 증거로 만들지 않는다.
 * @param {any} meta @param {(name:string)=>any} connect @param {()=>void} current
 */
function createSdkSupervisorBroker(meta,connect,current){
 const end=Date.parse(meta.expiresAt),started=Date.now(),mono=performance.now(),monoEnd=mono+end-started;
 if(!Number.isFinite(end)||end<=started||end-started>10000)return unavailable();
 current();const socket=connect(meta.pipeName),on=method(socket,'on'),off=method(socket,'removeListener'),write=method(socket,'write'),destroy=method(socket,'destroy');
 /** @type {(error:Error)=>void} */let stop;
 /** @type {Promise<never>} */const stopped=new Promise((resolve,reject)=>{stop=reject;});void stopped.catch(()=>{});
 let receiveLimit=4096;
 /** @type {(()=>void)|null} */let disposeCallback=null;
 let dead=false,ack=false,used=false,bytes=Buffer.alloc(0);
 /** @type {{resolve:(frame:SdkBrokerFrame)=>void,reject:(error:Error)=>void}|null} */let pending=null;
 /** @type {SdkBrokerFrame[]} */let queued=[];
 /** @type {Array<[string,(value?:unknown)=>void]>} */const listeners=[];
 const close=()=>{if(dead)return;dead=true;stop(Error('OUTCOME_UNKNOWN'));clearTimeout(timer);for(const [event,fn] of listeners)off.call(socket,event,fn);bytes.fill(0);bytes=Buffer.alloc(0);queued=[];pending?.reject(Error('OUTCOME_UNKNOWN'));pending=null;try{destroy.call(socket);}catch{}const callback=disposeCallback;disposeCallback=null;try{callback?.();}catch{}};
 const check=()=>{current();if(dead||Date.now()<started||Date.now()>=end||performance.now()>=monoEnd||method(socket,'write')!==write||method(socket,'destroy')!==destroy)return uncertain();};
 /** @param {Record<string,unknown>} row @returns {SdkBrokerFrame} */
 const equal=row=>{const base='schemaVersion,purpose,leaseId,endpointId,sourceHash,bindingHash';const extra=row?.purpose==='NORMAL_SDK_INTENT_PART_RESULT_V1'?',sequence,index,totalBytes,intentHash,data,final':row?.purpose==='NORMAL_SDK_HOOK_EFFECT_UNAVAILABLE_V1'?',sequence,hookHash,reason':row?.purpose==='NORMAL_SDK_QUERY_UNAVAILABLE_V1'?',sequence,reason':'';const r=catalogueExact(row,base+extra);if(r.schemaVersion!==1||r.leaseId!==meta.leaseId||r.endpointId!==meta.endpointId||r.sourceHash!==meta.sourceHash||r.bindingHash!==meta.bindingHash)return uncertain();return r;};
 const fail=()=>close();const timer=setTimeout(close,Math.max(1,end-started));timer.unref?.();
 /** @param {unknown} raw */
 const data=raw=>{try{check();const b=copyBuffer(raw,receiveLimit-bytes.length);bytes=Buffer.concat([bytes,b]);b.fill(0);const at=bytes.indexOf(10);if(at<0)return;if(at!==bytes.length-1)return uncertain();const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,at)),value=equal(JSON.parse(text));if(canonicalJson(value)!==text)return uncertain();bytes.fill(0);bytes=Buffer.alloc(0);if(pending){const p=pending;pending=null;p.resolve(value);}else{if(queued.length)return uncertain();queued.push(value);}}catch{close();}};
 for(const [event,fn] of /** @type {Array<[string,(value?:unknown)=>void]>} */([['data',data],['error',fail],['end',fail],['close',fail]])){on.call(socket,event,fn);listeners.push([event,fn]);}
 /** @param {string} purpose @returns {Promise<SdkBrokerFrame>} */
 const receive=async purpose=>{check();const row=queued.length?/** @type {SdkBrokerFrame} */(queued.shift()):await new Promise(/** @param {(value:SdkBrokerFrame)=>void} resolve */(resolve,reject)=>{if(pending)return reject(Error('OUTCOME_UNKNOWN'));pending={resolve,reject};});check();if(row.purpose!==purpose)return uncertain();return row;};
 let sequence=0,busy=false,intentRead=false,hookUsed=false,queryUsed=false;
 /** @param {string} purpose @param {Record<string,unknown>} fields @param {string} resultPurpose */
 const request=async(purpose,fields,resultPurpose)=>{check();if(!used||busy||sequence>=66)return unavailable();busy=true;receiveLimit=purpose==='NORMAL_SDK_INTENT_PART_V1'?65536:4096;const n=++sequence,frame=Buffer.from(canonicalJson({schemaVersion:1,purpose,leaseId:meta.leaseId,endpointId:meta.endpointId,sourceHash:meta.sourceHash,bindingHash:meta.bindingHash,sequence:n,...fields})+'\n');
  try{if(frame.length>4096)return unavailable();await Promise.race([new Promise((resolve,reject)=>{check();write.call(socket,frame,(/** @type {Error|null|undefined} */error)=>error?reject(error):resolve(null));}),stopped]);const r=await receive(resultPurpose);check();if(r.sequence!==n)return uncertain();return r;}catch(error){close();throw error;}finally{frame.fill(0);busy=false;receiveLimit=4096;}};
 const readIntent=async()=>{check();if(intentRead||hookUsed||queryUsed)return unavailable();intentRead=true;/** @type {Buffer|null} */let owned=null;let total=0,at=0;/** @type {string|null} */let expected=null;
  try{for(let index=0;index<64;index++){
   const p=await request('NORMAL_SDK_INTENT_PART_V1',{index},'NORMAL_SDK_INTENT_PART_RESULT_V1');
   if(p.index!==index||!Number.isSafeInteger(p.totalBytes)||/** @type {number} */(p.totalBytes)<1||/** @type {number} */(p.totalBytes)>2097152||typeof p.intentHash!=='string'||!(/^[0-9a-f]{64}$/).test(p.intentHash)||typeof p.data!=='string'||p.data.length>43692||typeof p.final!=='boolean')return uncertain();
   if(!owned){total=/** @type {number} */(p.totalBytes);expected=p.intentHash;owned=Buffer.alloc(total);}if(total!==p.totalBytes||expected!==p.intentHash)return uncertain();
   const part=Buffer.from(p.data,'base64');try{if(part.toString('base64')!==p.data||part.length!==Math.min(32768,total-at)||p.final!==(at+part.length===total))return uncertain();part.copy(owned,at);at+=part.length;}finally{part.fill(0);}
   if(p.final){if(contentHash(owned)!==expected)return uncertain();const text=new TextDecoder('utf-8',{fatal:true}).decode(owned),v=JSON.parse(text);if(canonicalJson(v)!==text||v.sourceHash!==meta.sourceHash||v.bindingHash!==meta.bindingHash)return uncertain();check();return v;}
  }return uncertain();}catch(error){close();throw error;}finally{owned?.fill(0);}};
 /** @param {string} hookHash @returns {Promise<SdkHookUnavailable>} */
 const verifyHook=async hookHash=>{check();if(!intentRead||hookUsed||queryUsed||typeof hookHash!=='string'||!(/^[0-9a-f]{64}$/).test(hookHash))return unavailable();hookUsed=true;const r=await request('NORMAL_SDK_HOOK_VERIFY_V1',{hookHash},'NORMAL_SDK_HOOK_EFFECT_UNAVAILABLE_V1');if(r.hookHash!==hookHash||r.reason!=='PRESPAWN_CURRENT_UNAVAILABLE')return uncertain();return Object.freeze({state:'SDK_HOOK_EFFECT_UNAVAILABLE',reason:r.reason});};
 const admitQuery=async()=>{check();if(!intentRead||queryUsed)return unavailable();queryUsed=true;const r=await request('NORMAL_SDK_QUERY_ADMIT_V1',{},'NORMAL_SDK_QUERY_UNAVAILABLE_V1');if(r.reason!=='PRESPAWN_CURRENT_UNAVAILABLE')return uncertain();throw Error('SDK_CONFIGURATION_UNAVAILABLE');};
 return Object.freeze({check,close,onDispose:(/** @type {()=>void} */callback)=>{check();if(disposeCallback||typeof callback!=='function')return unavailable();disposeCallback=callback;},readIntent,verifyHook,admitQuery,acknowledge:async()=>{
  check();if(ack)return unavailable();ack=true;const frame=Buffer.from(canonicalJson({schemaVersion:1,purpose:'NORMAL_SDK_BROKER_ACK_V1',leaseId:meta.leaseId,endpointId:meta.endpointId,sourceHash:meta.sourceHash,bindingHash:meta.bindingHash})+'\n');
  try{await Promise.race([new Promise((resolve,reject)=>{check();write.call(socket,frame,(/** @type {Error|null|undefined} */error)=>error?reject(error):resolve(null));}),stopped]);check();await receive('NORMAL_SDK_BROKER_ACKED_V1');}finally{frame.fill(0);}
 },consumed:async()=>{check();if(!ack||used)return unavailable();used=true;await receive('NORMAL_SDK_BROKER_CONSUMED_V1');}});
}
/** 원 인증 채널의 패키지 검산을 원 endpoint 1회에 결박한다. 일반 등록/SDK 권한은 발급하지 않는다.
 * @param {any} input @param {any} ports
 */
function createSdkBootstrapClient(input,ports){
 const client=createTrustKeyHostClient(input,ports,sdkBootstrapMode),uuid=own(ports,'uuid');let used=false;
 return Object.freeze({open:async(/** @type {any} */lease,/** @type {number} */epoch)=>{
  if(used||!Number.isSafeInteger(epoch)||epoch<1)return unavailable();used=true;
  const endpointId=Reflect.apply(uuid,ports,[]);if(typeof endpointId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(endpointId))return unavailable();
  let attempted=false,accepted=false,closed=false;
/** @type {Promise<any>|undefined} */
/** @type {Promise<any>|undefined} */let closeWork;const narrow=own(lease,'narrow');if(typeof narrow!=='function')return unavailable();const channel=await client.open(lease);
  try{
   const r=catalogueExact(await channel.send('SDK_BOOTSTRAP_PREPARE',{endpointId,epoch}),'state,endpointId,epoch,manifestHash,recipeRef,expiresAt');
   const ref=catalogueExact(r.recipeRef,'id,version,contentHash');
   if(r.state!=='SDK_BOOTSTRAP_PREPARED'||r.endpointId!==endpointId||r.epoch!==epoch||typeof r.manifestHash!=='string'||!/^[0-9a-f]{64}$/.test(r.manifestHash)||typeof ref.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.id)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(ref.contentHash)||typeof r.expiresAt!=='string'||!Number.isFinite(Date.parse(r.expiresAt))||new Date(r.expiresAt).toISOString()!==r.expiresAt||Date.parse(r.expiresAt)>Date.parse(lease.callExpiresAt()))return uncertain();
   Reflect.apply(narrow,lease,[Date.parse(r.expiresAt)]);
   const proof=JSON.parse(canonicalJson(r));
   const check=()=>{const current=liveChannels.get(channel);if(!current)return unavailable();current.check();lease.check();if(closed||own(lease,'narrow')!==narrow||lease.signal.aborted||lease.remainingMs()<=0)return unavailable();};check();
   const original=Object.freeze({read:()=>{check();return JSON.parse(canonicalJson(proof));},accept:async()=>{
    check();if(attempted)return unavailable();attempted=true;
    const reply=catalogueExact(await channel.send('SDK_BOOTSTRAP_ACCEPT',{endpointId,epoch,manifestHash:proof.manifestHash}),'state,endpointId,epoch,manifestHash');check();
    if(reply.state!=='SDK_BOOTSTRAP_ACCEPTED'||reply.endpointId!==endpointId||reply.epoch!==epoch||reply.manifestHash!==proof.manifestHash)return uncertain();accepted=true;
   },close:()=>{closed=true;if(!closeWork)closeWork=channel.close();return closeWork;}});
   sdkBootstrapEndpoints.set(original,()=>{check();if(!accepted)return unavailable();return JSON.parse(canonicalJson(proof));});
   sdkBootstrapWorkers.set(original,{check:()=>{check();if(!accepted)return unavailable();},proof,lease,channel,helper:bindingForWorker(input)});
   return original;
  }catch(error){try{if((await channel.close()).state!=='CLOSED_CONFIRMED')return uncertain();}catch{return uncertain();}throw error;}
 }});
}
/** 원 package 채널을 보유한 수령 직후 전용 endpoint 조립자가 1회 소비한다. 폐쇄 뒤 발급은 없다. @param {object} original */
function takeSdkBootstrapEndpoint(original){const read=sdkBootstrapEndpoints.get(original);if(!read)return unavailable();sdkBootstrapEndpoints.delete(original);return read();}
/** 원 native admission을 소비하며 두 port를 직접 발급한다. 외부 port는 받지 않는다. @param {object} original */
function createSdkBootstrapEndpoint(original){const proof=takeSdkBootstrapEndpoint(original),{MessageChannel}=require('node:worker_threads'),{port1,port2}=new MessageChannel();
 const endpoint=Object.freeze({endpoint:Object.freeze({endpointId:proof.endpointId,epoch:proof.epoch}),port:port2,brokerPort:port1,close:()=>{port1.close();port2.close();}});
 sdkBootstrapPorts.set(endpoint,{original,port:port2});return endpoint;
}
/** 원 helper와 같은 보호 ASAR의 고정 entry만 선택한다. @param {any} input */
function bindingForWorker(input){return catalogueExact(input,'path,signerRef,helperHash').path;}
/** 열린 원 package 채널에서만 고정 worker를 생성한다. 공개 IPC/파일 경로/Worker factory 입력은 없다.
 * endpoint는 같은 조립 함수가 만든 전용 port이며 proof 복사본은 생성 권위가 아니다.
 * @param {any} original @param {any} endpoint @param {any} context @param {string} connectorVersion
 */
async function launchSdkBootstrapWorker(original,endpoint,context,connectorVersion){
 const owned=sdkBootstrapWorkers.get(original);if(!owned||unconfirmedSdkWorkers.size)return unavailable();sdkBootstrapWorkers.delete(original);owned.check();
 const {Worker,MessageChannel}=require('node:worker_threads'),ports=sdkBootstrapPorts.get(endpoint);
 if(!ports||ports.original!==original||ports.port!==endpoint.port)return unavailable();sdkBootstrapPorts.delete(endpoint);
 const binding=catalogueExact(endpoint.endpoint,'endpointId,epoch'),ctx=catalogueExact(context,'origin,identity,authEpoch');
 if(canonicalJson(binding)!==canonicalJson({endpointId:owned.proof.endpointId,epoch:owned.proof.epoch})||typeof connectorVersion!=='string'||!(/^[A-Za-z0-9._+-]{1,80}$/).test(connectorVersion))return unavailable();
 const native=liveChannels.get(owned.channel);if(!native)return unavailable();owned.check();
 const {port1,port2}=new MessageChannel(),entry=path.win32.join(path.win32.dirname(owned.helper),'app.asar','src','normal-sdk-worker-entry.cjs');
 /** @type {any} */let worker;let settled=false,lost=false;
/** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
 try{
  owned.check();worker=new Worker(entry,{execArgv:[],argv:[],env:{...native.env},stdin:false,stdout:true,stderr:true,
   workerData:{purpose:'NORMAL_SDK_ENROLLMENT_OWNER_V1',endpoint:JSON.parse(canonicalJson(binding)),context:JSON.parse(canonicalJson(ctx)),connectorVersion,port:port2,registrationPort:endpoint.port},transferList:[port2,endpoint.port]});
  owned.check();
  await new Promise((resolve,reject)=>{
   const fail=()=>{lost=true;if(settled)return;settled=true;clearTimeout(timer);reject(Error('OUTCOME_UNKNOWN'));};
   const ready=(/** @type {unknown} */raw)=>{try{owned.check();const r=catalogueExact(raw,'purpose,endpointId,epoch');if(r.purpose!=='NORMAL_SDK_ENROLLMENT_OWNER_READY'||r.endpointId!==binding.endpointId||r.epoch!==binding.epoch)return fail();if(settled)return;settled=true;clearTimeout(timer);resolve(null);}catch{fail();}};
   worker.once('message',ready);worker.once('error',fail);worker.once('exit',fail);worker.stdout?.on('data',fail);worker.stderr?.on('data',fail);
   timer=setTimeout(fail,Math.max(1,Math.floor(owned.lease.remainingMs())));
  });
  owned.check();if(lost)return uncertain();const closed=await original.close();if(closed.state!=='CLOSED_CONFIRMED'||lost)return uncertain();
  return Object.freeze({worker,port:port1,check:()=>{if(lost)return uncertain();},endpoint:JSON.parse(canonicalJson(binding)),retain:()=>unconfirmedSdkWorkers.set(worker,{worker,port:port1,endpoint}),stop:()=>stopSdkWorker(worker,10000)});
 }catch(error){port1.close();port2.close();endpoint.close();let unknown=false;if(worker){let ms=0;try{ms=Math.max(0,Math.min(10000,owned.lease.remainingMs()));}catch{}if((await stopSdkWorker(worker,ms)).state!=='CLOSED_CONFIRMED')unknown=true;}try{if((await original.close()).state!=='CLOSED_CONFIRMED')unknown=true;}catch{unknown=true;}if(unknown)return uncertain();throw error;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
/** 원 worker 한 개의 종료만 수거한다. 불명 결과는 재시도/재발급하지 않는다. @param {any} worker @param {number} ms */
async function stopSdkWorker(worker,ms){if(!unconfirmedSdkWorkers.has(worker))unconfirmedSdkWorkers.set(worker,{worker});let timer;
 try{const termination=worker.terminate();const code=await Promise.race([termination,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms);})]);if(!Number.isInteger(code))return{state:'UNKNOWN'};unconfirmedSdkWorkers.delete(worker);return{state:'CLOSED_CONFIRMED'};}catch{return{state:'UNKNOWN'};}finally{if(timer!==undefined)clearTimeout(timer);}
}
module.exports={createTrustKeyHostClient,createSdkBootstrapClient,takeSdkBootstrapEndpoint,createSdkBootstrapEndpoint,launchSdkBootstrapWorker,nodeKeyHostSpawn};
