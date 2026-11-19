'use strict';
const {types}=require('node:util');
const {randomUUID}=require('node:crypto');
const {MessageChannel,MessagePort}=require('node:worker_threads');
const {canonicalJson,catalogueExact}=require('./runtime-catalogue-profile.cjs');
const {takeSdkBootstrapEndpoint}=require('./trust-key-host-client.cjs');
const {createTrustRegistrationClient}=require('./trust-registration-client.cjs');
/** @typedef {'human'|'enroll'|'exchangeChallenge'|'issue'|'prove'} RegistrationMethod */
const methods=Object.freeze({human:2,enroll:2,exchangeChallenge:4,issue:3,prove:3});
/** @param {unknown} value @returns {RegistrationMethod} */
function method(value){if(value==='human'||value==='enroll'||value==='exchangeChallenge'||value==='issue'||value==='prove')return value;return fail();}
const fixedErrors=new Set(['INPUT_INVALID','CONTEXT_CHANGED','PROTECTION_UNAVAILABLE','DEADLINE','OUTCOME_UNKNOWN','CONNECTOR_RESULT_UNKNOWN','CONNECTOR_REDIRECT_DENIED','CONNECTOR_HUMAN_CONFIRMATION_REQUIRED','CONNECTOR_REGISTRATION_NOT_PENDING','CONNECTOR_ENROLLMENT_ALREADY_USED','CONNECTOR_CHALLENGE_EXPIRED','CONNECTOR_CHALLENGE_NOT_PENDING','CONNECTOR_PROOF_NOT_PENDING','CONNECTOR_PROOF_ATTEMPT_LIMIT','CONNECTOR_FRESH_CLIENT_NONCE_REQUIRED','CONNECTOR_HOST_OR_CODE_MISMATCH','HOST_PROOF_INVALID','CONNECTOR_PROTOCOL_INPUT_INVALID','CONNECTOR_BASIS_NOT_CURRENT','NOT_FOUND','AUTH_REQUIRED','CONNECTOR_REQUEST_FAILED']);
/** @param {string} [code] @returns {never} */
function fail(code='PROTECTION_UNAVAILABLE'){throw Error(code);}
/** @param {unknown} raw */
function safe(raw){const text=canonicalJson(raw);if(Buffer.byteLength(text)>65536)fail();return JSON.parse(text);}
/** 기존 등록 client와 같은 Session 메서드 identity를 endpoint 수명에도 고정한다. @param {object} session */
function sessionTransport(session){let current=session;for(let depth=0;current&&depth<16;depth++){if(types.isProxy(current))fail();const d=Object.getOwnPropertyDescriptor(current,'fetch');if(d){if(!('value'in d)||typeof d.value!=='function'||types.isProxy(d.value))fail();return d.value;}current=Object.getPrototypeOf(current);}return fail();}
/** 원 인증 package 채널을 소비한 main의 전용 등록 Session broker. URL/헤더/메서드 선택 RPC가 아니다.
 * @param {object} bootstrap @param {object} session @param {()=>{origin:string,identity:string,authEpoch:number}} context
 */
function createRegistrationSessionBroker(bootstrap,session,context){
 const proof=takeSdkBootstrapEndpoint(bootstrap),original=safe(context()),transport=sessionTransport(session);
 const url=new URL(original.origin);if(url.protocol!=='https:'||url.origin!==original.origin||typeof original.identity!=='string'||!Number.isSafeInteger(original.authEpoch)||original.authEpoch<0)fail();
 let closed=false,busy=false,sequence=0;const operations=new Map();
 const guard=()=>{if(closed||sessionTransport(session)!==transport||canonicalJson(context())!==canonicalJson(original))fail('CONTEXT_CHANGED');};
 const stop=()=>{closed=true;for(const state of operations.values())state.abort.abort();operations.clear();};
 return Object.freeze({endpoint:Object.freeze({endpointId:proof.endpointId,epoch:proof.epoch}),close:stop,
  cancel:(/** @type {string} */id)=>{const state=operations.get(id);if(state)state.abort.abort();},
  request:async(/** @type {unknown} */raw)=>{
   guard();const v=catalogueExact(raw,'endpointId,epoch,operationId,sequence,deadline,method,args');
   const selected=method(v.method);
   if(v.endpointId!==proof.endpointId||v.epoch!==proof.epoch||typeof v.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.operationId)||typeof v.method!=='string'||!Object.hasOwn(methods,v.method)||types.isProxy(v.args)||!Array.isArray(v.args)||v.args.length!==methods[selected]||!Number.isSafeInteger(v.deadline))fail();
   const args=safe(v.args),wall=Date.now(),mono=performance.now();if(v.deadline<=wall||v.deadline>wall+10000)fail('DEADLINE');
   if(busy||!Number.isSafeInteger(v.sequence)||v.sequence!==sequence+1)fail();sequence=v.sequence;busy=true;
   const abort=new AbortController();let end=v.deadline,lastWall=wall,lastMono=mono;
   const check=()=>{guard();const now=Date.now(),tick=performance.now();if(abort.signal.aborted||now<lastWall||tick<lastMono||now>=end||tick-mono>=end-wall)fail('CONTEXT_CHANGED');lastWall=now;lastMono=tick;};
   const state={abort};operations.set(v.operationId,state);
   const timer=setTimeout(()=>abort.abort(),Math.max(1,end-wall));
   const lease={signal:abort.signal,check,markEffect:check,narrow:(/** @type {number} */deadline)=>{check();if(!Number.isSafeInteger(deadline))fail();end=Math.min(end,deadline);check();}};
   try{
    const client=createTrustRegistrationClient(session,original.origin,lease,guard);check();
    const value=await Reflect.apply(client[selected],client,args);check();return safe({ok:true,value,deadline:end});
   }catch(error){
    guard();const code=error instanceof Error&&fixedErrors.has(error.message)?error.message:'PROTECTION_UNAVAILABLE';return{ok:false,code};
   }finally{clearTimeout(timer);abort.abort();operations.delete(v.operationId);busy=false;}
  }
 });
}
/** worker의 기존 등록 owner가 요청별 원 lease를 그대로 사용하는 고정 client.
 * 메시지 전송자는 원 전용 endpoint만이며 일반 Session/URL 입력은 받지 않는다.
 * @param {{endpointId:string,epoch:number}} endpoint @param {{request:(v:unknown)=>Promise<any>,cancel:(id:string)=>void}} channel
 * @param {{check:()=>void,signal:AbortSignal,callExpiresAt:()=>string,narrow:(n:number)=>void,markEffect:()=>void}} lease
 */
function createWorkerRegistrationClient(endpoint,channel,lease){
 const binding=safe(catalogueExact(endpoint,'endpointId,epoch')),request=channel.request,cancel=channel.cancel;
 if(typeof request!=='function'||typeof cancel!=='function')fail();
 const check=()=>{lease.check();if(lease.signal.aborted||channel.request!==request||channel.cancel!==cancel)fail('CONTEXT_CHANGED');};
 const call=async(/** @type {string} */method,/** @type {unknown[]} */args)=>{
  check();const operationId=randomUUID(),deadline=Date.parse(lease.callExpiresAt());if(!Number.isSafeInteger(deadline))fail();
  const abort=()=>Reflect.apply(cancel,channel,[operationId]);lease.signal.addEventListener('abort',abort,{once:true});
  try{check();const message=safe({...binding,operationId,deadline,method,args});if(method!=='human')lease.markEffect();check();const raw=await Reflect.apply(request,channel,[message]);check();
   if(raw?.ok===false){const r=catalogueExact(raw,'ok,code');return fail(fixedErrors.has(r.code)?r.code:'PROTECTION_UNAVAILABLE');}
   const r=catalogueExact(raw,'ok,value,deadline');if(r.ok!==true||!Number.isSafeInteger(r.deadline)||r.deadline>deadline)fail();lease.narrow(r.deadline);check();return safe(r.value);
  }finally{lease.signal.removeEventListener('abort',abort);}
 };
 return Object.freeze({human:(/** @type {string} */project,/** @type {string} */registration)=>call('human',[project,registration]),
  enroll:(/** @type {unknown} */request,/** @type {unknown} */human)=>call('enroll',[request,human]),
  exchangeChallenge:(/** @type {unknown} */payload,/** @type {unknown} */signature,/** @type {unknown} */human,/** @type {unknown} */original)=>call('exchangeChallenge',[payload,signature,human,original]),
  issue:(/** @type {unknown} */request,/** @type {unknown} */human,/** @type {unknown} */prior)=>call('issue',[request,human,prior]),
  prove:(/** @type {unknown} */request,/** @type {unknown} */human,/** @type {unknown} */prior)=>call('prove',[request,human,prior])});
}
/** 고정 등록 목적의 원 MessageChannel을 생성한다. 외부 port/URL 선택을 받지 않는다.
 * @param {object} bootstrap @param {object} session @param {()=>{origin:string,identity:string,authEpoch:number}} context
 */
function createRegistrationSessionEndpoint(bootstrap,session,context){
 const broker=createRegistrationSessionBroker(bootstrap,session,context),{port1,port2}=new MessageChannel();let closed=false;
 const close=()=>{if(closed)return;closed=true;broker.close();port1.close();port2.close();};
 port1.on('message',async raw=>{
  try{
   const msg=catalogueExact(raw,raw?.kind==='CANCEL'?'kind,id':'kind,id,value');
   if(closed||typeof msg.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(msg.id))fail();
   if(msg.kind==='CANCEL'){broker.cancel(msg.id);return;}
   if(msg.kind!=='REQUEST'||msg.value?.operationId!==msg.id)fail();
   const result=await broker.request(msg.value);if(!closed)port1.postMessage({id:msg.id,result});
  }catch{close();}
 });
 port1.on('messageerror',close);port1.on('close',close);
 return Object.freeze({endpoint:broker.endpoint,port:port2,close});
}
/** 원 worker가 이전받은 등록 전용 port만 소비한다. @param {MessagePort} port */
function createRegistrationWorkerChannel(port){
 if(types.isProxy(port)||!(port instanceof MessagePort))fail();let closed=false,sequence=0;
 const pending=new Map();
 const close=()=>{if(closed)return;closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('CONTEXT_CHANGED'));}pending.clear();port.close();};
 port.on('message',raw=>{try{const r=catalogueExact(raw,'id,result'),p=pending.get(r.id);if(!p)return;pending.delete(r.id);clearTimeout(p.timer);p.resolve(safe(r.result));}catch{close();}});
 port.on('messageerror',close);port.on('close',close);
 return Object.freeze({close,cancel:(/** @type {string} */id)=>{if(closed)return;const p=pending.get(id);if(p){pending.delete(id);clearTimeout(p.timer);p.reject(Error('CONTEXT_CHANGED'));}port.postMessage({kind:'CANCEL',id});},
  request:(/** @type {any} */value)=>{if(closed||pending.size||sequence>=Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(value.deadline)||value.deadline<=Date.now()||value.deadline>Date.now()+10000)return Promise.reject(Error('CONTEXT_CHANGED'));
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(value.operationId);reject(Error('DEADLINE'));if(!closed)port.postMessage({kind:'CANCEL',id:value.operationId});},Math.max(1,value.deadline-Date.now()));
    pending.set(value.operationId,{resolve,reject,timer});try{port.postMessage({kind:'REQUEST',id:value.operationId,value:safe({...value,sequence:++sequence})});}catch{close();}
   });
  }});
}
module.exports={createRegistrationSessionEndpoint,createRegistrationWorkerChannel,createWorkerRegistrationClient};
