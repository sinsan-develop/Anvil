'use strict';
const path=require('node:path'),{types}=require('node:util'),{EventEmitter}=require('node:events');
const {canonicalJson,contentHash,catalogueExact}=require('./runtime-catalogue-profile.cjs');
const sdkBootstrapMode=Symbol('sdk-bootstrap');
const sdkBootstrapEndpoints=new WeakMap();
const intrinsicLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')?.get;

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
const finish=()=>{if(pending&&pending.written&&pending.reply!==undefined){const p=pending;pending=null;clearTimeout(p.timer);p.resolve(p.reply);}};
const tryEnd=()=>{if(!endRequested||ending||closed||writes!==0)return;ending=true;try{stable();end.call(stdin,undefined,'utf8',()=>{});}catch{latch();}};

/** @param {any} raw */const data=raw=>{try{stable();guard();if(!pending||pending.reply!==undefined||closed)return uncertain();const chunk=copyBuffer(raw,65536-buffer.length);buffer=Buffer.concat([buffer,chunk]);chunk.fill(0);const at=buffer.indexOf(10);if(at<0)return;if(at!==buffer.length-1)return uncertain();const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,at));buffer.fill(0);buffer=Buffer.alloc(0);const reply=catalogueExact(JSON.parse(text),'schemaVersion,purpose,requestId,sequence,rootIdentity,data');if(canonicalJson(reply)!==text||reply.schemaVersion!==1||reply.purpose!=='DESKTOP_TRUST_KEY_RESULT_V1'||reply.sequence!==pending.sequence||reply.requestId!==pending.requestId||typeof reply.rootIdentity!=='string'||reply.rootIdentity.length<1||reply.rootIdentity.length>512||rootIdentity!==null&&reply.rootIdentity!==rootIdentity)return uncertain();rootIdentity=reply.rootIdentity;if(reply.data?.state==='UNKNOWN'&&reply.data?.problem==='MAPPING_STORE'){pending.reply=reply.data;finish();return;}pending.reply=reply.data;finish();}catch{latch();}};
const error=()=>latch(),done=()=>{if(!ending||pending)latch();};
const listeners=[[stdout,'data',data],[stdout,'end',done],[stdout,'error',error],[stderr,'data',error],[stderr,'error',error],[stdin,'error',error],[child,'error',error]];for(const [emitter,event,fn] of listeners)EventEmitter.prototype.on.call(emitter,event,fn);
const cleanup=()=>{for(const [emitter,event,fn] of listeners)EventEmitter.prototype.off.call(emitter,event,fn);signal.removeEventListener('abort',abort);};
EventEmitter.prototype.once.call(child,'close',/** @param {any} code */code=>{closed=true;if(code!==0||!ending||pending)latch();resolveExit({closed:true,code,unknown:sticky});cleanup();});
const abort=()=>{latch();endRequested=true;tryEnd();};signal.addEventListener('abort',abort,{once:true});

/** @param {string} operation @param {any} payload */async function send(operation,payload){if(busy||sticky||closed||ending)return uncertain();guard();stable();if(sequence>=64)return uncertain();const n=++sequence,requestId=Reflect.apply(functions[4],ports,[]);if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId))return unavailable();const frame=Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_OPERATION_V1',requestId,sequence:n,callExpiresAt:expiry(),remainingMs:Math.floor(remaining()),signerRef:binding.signerRef,operation,payload})+'\n');if(frame.length>65536)return unavailable();busy=true;try{return await new Promise((resolve,reject)=>{pending={sequence:n,requestId,written:false,reply:undefined,resolve,reject,timer:setTimeout(latch,Math.max(1,Math.floor(remaining())))};try{guard();stable();writes++;write.call(stdin,frame,'utf8',/** @param {any} error */error=>{writes--;frame.fill(0);if(error)latch();else if(pending){try{guard();stable();pending.written=true;finish();}catch{latch();}}tryEnd();});}catch{if(writes>0)writes--;latch();}});}finally{busy=false;}}
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
retained=Object.freeze({send,close,executionConfiguration});if(signal.aborted){abort();return uncertain();}guard();return retained;}
return Object.freeze({open,closeOwned:async()=>retained?retained.close():{state:'UNKNOWN'}});}

/** 실제 driver는 명시 호출 때만 동작한다. 자동 fallback/재시작/재접속은 없다.
 * @param {string} exe @param {string[]} args @param {any} options
 */function nodeKeyHostSpawn(exe,args,options){return require('node:child_process').spawn(exe,args,options);}
/** 원 인증 채널의 패키지 검산을 원 endpoint 1회에 결박한다. 일반 등록/SDK 권한은 발급하지 않는다.
 * @param {any} input @param {any} ports
 */
function createSdkBootstrapClient(input,ports){
 const client=createTrustKeyHostClient(input,ports,sdkBootstrapMode),uuid=own(ports,'uuid');let used=false;
 return Object.freeze({open:async(/** @type {any} */lease,/** @type {number} */epoch)=>{
  if(used||!Number.isSafeInteger(epoch)||epoch<1)return unavailable();used=true;
  const endpointId=Reflect.apply(uuid,ports,[]);if(typeof endpointId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(endpointId))return unavailable();
  let attempted=false,accepted=false,closed=false;const narrow=own(lease,'narrow');if(typeof narrow!=='function')return unavailable();const channel=await client.open(lease);
  try{
   const r=catalogueExact(await channel.send('SDK_BOOTSTRAP_PREPARE',{endpointId,epoch}),'state,endpointId,epoch,manifestHash,recipeRef,expiresAt');
   const ref=catalogueExact(r.recipeRef,'id,version,contentHash');
   if(r.state!=='SDK_BOOTSTRAP_PREPARED'||r.endpointId!==endpointId||r.epoch!==epoch||typeof r.manifestHash!=='string'||!/^[0-9a-f]{64}$/.test(r.manifestHash)||typeof ref.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.id)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(ref.contentHash)||typeof r.expiresAt!=='string'||!Number.isFinite(Date.parse(r.expiresAt))||new Date(r.expiresAt).toISOString()!==r.expiresAt||Date.parse(r.expiresAt)>Date.parse(lease.callExpiresAt()))return uncertain();
   Reflect.apply(narrow,lease,[Date.parse(r.expiresAt)]);
   const proof=JSON.parse(canonicalJson(r));
   const check=()=>{lease.check();if(closed||own(lease,'narrow')!==narrow||lease.signal.aborted||lease.remainingMs()<=0)return unavailable();};check();
   const original=Object.freeze({read:()=>{check();return JSON.parse(canonicalJson(proof));},accept:async()=>{
    check();if(attempted)return unavailable();attempted=true;
    const reply=catalogueExact(await channel.send('SDK_BOOTSTRAP_ACCEPT',{endpointId,epoch,manifestHash:proof.manifestHash}),'state,endpointId,epoch,manifestHash');check();
    if(reply.state!=='SDK_BOOTSTRAP_ACCEPTED'||reply.endpointId!==endpointId||reply.epoch!==epoch||reply.manifestHash!==proof.manifestHash)return uncertain();accepted=true;
   },close:async()=>{closed=true;return channel.close();}});
   sdkBootstrapEndpoints.set(original,()=>{check();if(!accepted)return unavailable();return JSON.parse(canonicalJson(proof));});
   return original;
  }catch(error){try{await channel.close();}catch{}throw error;}
 }});
}
/** 원 package 채널을 보유한 수령 직후 전용 endpoint 조립자가 1회 소비한다. 폐쇄 뒤 발급은 없다. @param {object} original */
function takeSdkBootstrapEndpoint(original){const read=sdkBootstrapEndpoints.get(original);if(!read)return unavailable();sdkBootstrapEndpoints.delete(original);return read();}
module.exports={createTrustKeyHostClient,createSdkBootstrapClient,takeSdkBootstrapEndpoint,nodeKeyHostSpawn};
