'use strict';
const {types}=require('node:util');
const {randomUUID}=require('node:crypto');
const {MessagePort}=require('node:worker_threads');
const {canonicalJson,catalogueExact}=require('./runtime-catalogue-profile.cjs');
const {createSdkBootstrapEndpoint}=require('./trust-key-host-client.cjs');
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
 * @param {{endpointId:string,epoch:number}} proof @param {object} session @param {()=>{origin:string,identity:string,authEpoch:number}} context
 */
function createRegistrationSessionBroker(proof,session,context){
 const original=safe(context()),transport=sessionTransport(session);
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
 const endpoint=createSdkBootstrapEndpoint(bootstrap);let broker;try{broker=createRegistrationSessionBroker(endpoint.endpoint,session,context);}catch(error){endpoint.close();throw error;}const port1=endpoint.brokerPort,port2=endpoint.port;let closed=false;
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
 return endpoint;
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


// 원 worker의 보호 client만 사용하는 닫힌 HUMAN 목적 표. binary OPEN/STREAM은 여기로 나오지 않는다.
const humanRoutes=Object.freeze([
 ['SESSION','GET',/^\/api\/v1\/session$/,8192],
 ['PROFILE','GET',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-channel-profile$/,2097152],
 ['WINDOW_PREPARE','POST',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-windows$/,8192],
 ['OPEN_CHALLENGE','POST',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-windows\/([0-9a-f-]{36})\/open-challenge$/,8192],
 ['OFFER','GET',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-offers\/([0-9a-f-]{36})$/,2293760],
 ['WINDOW_CLOSE','POST',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-windows\/([0-9a-f-]{36})\/close$/,8192],
 ['WINDOW_STATE','GET',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-windows\/([0-9a-f-]{36})$/,8192],
 ['SIGNING_CURRENT','GET',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-windows\/([0-9a-f-]{36})\/signing-current$/,2097152],
 ['PHASE_CURRENT','POST',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/native-receive-windows\/([0-9a-f-]{36})\/phase-signing-current$/,2097152],
 ['ENVIRONMENT','GET',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/environments\/([0-9a-f-]{36})\/versions\/([1-9][0-9]*)$/,4256256],
 ['COMMAND_PROFILE','GET',/^\/api\/v1\/projects\/([0-9a-f-]{36})\/command-profile-metadata\/([0-9a-f-]{36})\/versions\/([1-9][0-9]*)$/,4256256]
]);
/** @param {any} raw @param {number} max */
function bounded(raw,max){const text=canonicalJson(raw);if(Buffer.byteLength(text)>max)fail();return JSON.parse(text);}
/** 고정 client가 만든 경로만 목적 코드/참조로 옮긴다. @param {string} path @param {string} method */
function humanRoute(path,method){for(const r of humanRoutes){const m=/** @type {RegExp} */(r[2]).exec(path);if(m&&method===r[1]){for(const id of m.slice(1)){if(id.length===36&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))fail();if(id.length!==36&&(!Number.isSafeInteger(Number(id))||Number(id)<1))fail();}return{kind:r[0],args:m.slice(1),maximum:r[3]};}}return fail();}
/** @param {any} raw */
function humanPath(raw){const v=catalogueExact(raw,'kind,args,body,csrf');if(!Array.isArray(v.args)||v.args.length>3)fail();const [p,id,version]=v.args;const base='/api/v1/projects/'+p;let path;
 switch(v.kind){case'SESSION':path='/api/v1/session';break;case'PROFILE':path=base+'/native-channel-profile';break;case'WINDOW_PREPARE':path=base+'/native-receive-windows';break;case'OFFER':path=base+'/native-receive-offers/'+id;break;case'ENVIRONMENT':path=base+'/environments/'+id+'/versions/'+version;break;case'COMMAND_PROFILE':path=base+'/command-profile-metadata/'+id+'/versions/'+version;break;default:{const suffix={OPEN_CHALLENGE:'/open-challenge',WINDOW_CLOSE:'/close',WINDOW_STATE:'',SIGNING_CURRENT:'/signing-current',PHASE_CURRENT:'/phase-signing-current'};if(!Object.hasOwn(suffix,v.kind))return fail();path=base+'/native-receive-windows/'+id+suffix[/** @type {keyof typeof suffix} */(v.kind)];}}
 const method=v.body===null?'GET':'POST',r=humanRoute(path,method);if(r.kind!==v.kind||canonicalJson(r.args)!==canonicalJson(v.args)||method==='POST'&&(typeof v.csrf!=='string'||!(/^[A-Za-z0-9_-]{43}$/).test(v.csrf)||typeof v.body!=='string'||Buffer.byteLength(v.body)>2097152)||method==='GET'&&v.csrf!==null)fail();return{...v,path,method,maximum:Number(r.maximum)};
}
/** 원 owner 내부 기능의 두 방향 제어 메시지는 이 하나의 전용 port만 사용한다.
 * @param {MessagePort} port @param {(kind:string,value:any,deadline:number,signal:AbortSignal)=>Promise<any>} handler @param {()=>void} guard
 */
function duplex(port,handler,guard){
 let closed=false,retiring=false,serial=0;const pending=new Map(),running=new Map();
 const close=()=>{if(closed)return;closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.remove();p.reject(Error('CONTEXT_CHANGED'));}pending.clear();for(const a of running.values())a.abort();running.clear();port.close();};
 port.on('message',async raw=>{try{if(closed)return;const v=bounded(raw,5000000);if(v.kind==='RETIRE'&&v.type==='CALL')retiring=true;if(!retiring)guard();if(v.type==='CANCEL'){catalogueExact(v,'type,id');running.get(v.id)?.abort();return;}
  if(v.type==='RESULT'){catalogueExact(v,'type,id,ok,value');const p=pending.get(v.id);if(!p)return;pending.delete(v.id);clearTimeout(p.timer);p.remove();if(v.ok===true)p.resolve(v.value);else p.reject(Error(fixedErrors.has(v.value)?v.value:'PROTECTION_UNAVAILABLE'));return;}
  catalogueExact(v,'type,id,kind,value,deadline');if(retiring&&v.kind!=='RETIRE')return;if(v.type!=='CALL'||typeof v.id!=='string'||v.id.length>100||running.has(v.id)||running.size>=4||!Number.isSafeInteger(v.deadline)||v.deadline<=Date.now()||v.deadline>Date.now()+(v.kind==='DIRECTORY'||v.kind==='COMMAND'?300000:10000))fail();
  const abort=new AbortController(),started=performance.now(),wall=Date.now();running.set(v.id,abort);const timer=setTimeout(()=>abort.abort(),v.deadline-wall);
  try{const value=await handler(v.kind,v.value,v.deadline,abort.signal);if(!retiring)guard();if(abort.signal.aborted||Date.now()>=v.deadline||performance.now()-started>=v.deadline-wall)fail('DEADLINE');if(!closed)port.postMessage({type:'RESULT',id:v.id,ok:true,value:bounded(value,5000000)});}
  catch(error){if(!closed)port.postMessage({type:'RESULT',id:v.id,ok:false,value:error instanceof Error&&fixedErrors.has(error.message)?error.message:'PROTECTION_UNAVAILABLE'});}
  finally{clearTimeout(timer);running.delete(v.id);}
 }catch{close();}});port.on('close',close);port.on('messageerror',close);
 return Object.freeze({close,call:async(/** @type {string} */kind,/** @type {any} */value,/** @type {number} */deadline,/** @type {AbortSignal} */signal)=>{if(kind==='RETIRE'){retiring=true;for(const p of pending.values()){clearTimeout(p.timer);p.remove();p.reject(Error('CONTEXT_CHANGED'));}pending.clear();for(const a of running.values())a.abort();}else{if(retiring)fail('CONTEXT_CHANGED');guard();}if(closed||signal.aborted||pending.size>=4||!Number.isSafeInteger(deadline)||deadline<=Date.now()||deadline>Date.now()+(kind==='DIRECTORY'||kind==='COMMAND'?300000:10000))fail();const id=randomUUID()+':'+(++serial);return new Promise((resolve,reject)=>{const abort=()=>{const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);p.remove();port.postMessage({type:'CANCEL',id});reject(Error('CONTEXT_CHANGED'));};const timer=setTimeout(abort,deadline-Date.now());const remove=()=>signal.removeEventListener('abort',abort);pending.set(id,{resolve,reject,timer,remove});signal.addEventListener('abort',abort,{once:true});try{port.postMessage({type:'CALL',id,kind,value:bounded(value,5000000),deadline});}catch{abort();}});}});
}
/** 동일 원 Session과 고정 HUMAN 요청/로컬 폴더 dialog만 중계한다.
 * @param {any} session @param {any} original @param {()=>any} context @param {(lease:any)=>Promise<any>} directory
 */
function humanRelay(session,original,context,directory){const fetch=sessionTransport(session),signature=canonicalJson(original);return async(/** @type {string} */kind,/** @type {any} */value,/** @type {number} */deadline,/** @type {AbortSignal} */signal)=>{
 const start=Date.now(),tick=performance.now();const check=()=>{if(signal.aborted||Date.now()<start||performance.now()<tick||performance.now()-tick>=deadline-start||Date.now()>=deadline||canonicalJson(context())!==signature||sessionTransport(session)!==fetch)fail('CONTEXT_CHANGED');};check();
 if(kind==='DIRECTORY'){if(value!==null)fail();const result=await directory(Object.freeze({check}));check();if(result!==null&&(typeof result!=='string'||result.length>1024))fail();return result;}
 if(kind!=='HUMAN')fail();const request=humanPath(value),headers=request.method==='GET'?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json',Origin:original.origin,'X-Anvil-CSRF':request.csrf};
 const response=await Reflect.apply(fetch,session,[original.origin+request.path,{method:request.method,credentials:'include',redirect:'error',cache:'no-store',bypassCustomProtocolHandlers:true,signal,headers,...(request.method==='POST'?{body:request.body}:{})}]);
 let reader,done=false;const chunks=[];let total=0;
 try{check();if(!response||response.redirected||![200,400,401,403,404,409,412,413,503].includes(response.status)||response.headers.has('location')||response.headers.has('content-encoding')||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers.get('content-type')||''))fail();reader=response.body?.getReader();if(!reader)fail();for(;;){check();const part=await reader.read();check();if(part.done){done=true;break;}if(!(part.value instanceof Uint8Array)||part.value.byteLength>request.maximum-total)fail();total+=part.value.byteLength;chunks.push(Buffer.from(part.value));}
  const bytes=Buffer.concat(chunks,total);try{check();const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes),headers={'content-type':response.headers.get('content-type')};if(response.headers.has('content-length'))Reflect.set(headers,'content-length',response.headers.get('content-length'));return{status:response.status,headers,body};}finally{bytes.fill(0);}
 }finally{if(!done){try{if(reader)await reader.cancel();else await response?.body?.cancel();}catch{}}reader?.releaseLock();for(const chunk of chunks)chunk.fill(0);}
};}
/** 실제 고정 entry에서만 호출. owner/credential/설정/receiver를 밖으로 돌려주지 않는다. @param {any} data @param {any} parent */
function runEnrollmentWorker(data,parent){
 const d=catalogueExact({...data,port:null,registrationPort:null},'purpose,endpoint,context,connectorVersion,port,registrationPort');
 if(d.purpose!=='NORMAL_SDK_ENROLLMENT_OWNER_V1'||!(data.port instanceof MessagePort)||!(data.registrationPort instanceof MessagePort)||!parent)fail();
 const original=safe(catalogueExact(d.context,'origin,identity,authEpoch'));let closed=false;const life=new AbortController();const check=()=>{if(closed||life.signal.aborted)fail('CONTEXT_CHANGED');};
 const channel=createRegistrationWorkerChannel(data.registrationPort),operations=new Set();
/** @type {ReturnType<typeof import('./trust-enrollment-owner.cjs').createTrustEnrollmentSession>} */let owner;
 const rpc=duplex(data.port,async(kind,value,deadline,signal)=>{check();if(kind==='RETIRE'){if(value!==null)fail();owner.close();channel.close();let unknown=false;for(const operation of operations){try{if((await operation.close()).state!=='CLOSED_CONFIRMED')unknown=true;}catch{unknown=true;}}return{state:unknown?'UNKNOWN':'CLOSED_CONFIRMED'};}if(kind!=='COMMAND')fail();const v=catalogueExact(value,'name,input');if(v.name==='INVALIDATE'){owner.invalidate();return owner.getState();}if(v.name==='CLOSE_CONFIGURATION'){owner.closeConfiguration();return owner.getState();}if(v.name==='DISPOSE_RECEIVE'){owner.disposeReceive();return owner.getState();}
  if(v.name==='CONFIGURATION'){const c=catalogueExact(v.input,'action,value');return owner.configuration(c.action,c.value);}
  if(['native-receive-begin','native-receive-status','native-receive-refresh','native-receive-arm','native-receive-close'].includes(v.name))return owner.handleReceive(v.name,v.input);
  if(!['trust-status','trust-begin','trust-pair','trust-act'].includes(v.name))fail();return owner.handle(v.name,v.input);
 },check);
 const session=Object.freeze({fetch:async(/** @type {string} */url,/** @type {any} */options)=>{check();const parsed=new URL(url);if(parsed.origin!==original.origin||parsed.href!==original.origin+parsed.pathname||options.credentials!=='include'||options.redirect!=='error'||options.cache!=='no-store')fail();const r=humanRoute(parsed.pathname,options.method),value={kind:r.kind,args:r.args,body:options.body??null,csrf:options.headers?.['X-Anvil-CSRF']??null};humanPath(value);const response=await rpc.call('HUMAN',value,Date.now()+10000,options.signal);check();return new Response(response.body,{status:response.status,headers:response.headers});}});
 const module=require('./trust-enrollment-owner.cjs'),root=require('node:path').win32.dirname(__dirname);
 /** @type {any} */const deps=module.createDesktopTrustDependencies({app:{getVersion:()=>d.connectorVersion,getPath:()=>process.execPath,getAppPath:()=>root}});if(!deps)fail();
 const createOperation=deps.createOperation;deps.createOperation=async(/** @type {any} */lease,/** @type {any} */pending)=>{check();const original=await createOperation(lease,pending);
/** @type {Promise<any>|undefined} */let closeWork;const tracked={...original,close:()=>{if(!closeWork)closeWork=Promise.resolve().then(()=>original.close()).then(result=>{if(result?.state==='CLOSED_CONFIRMED')operations.delete(tracked);return result;});return closeWork;}};operations.add(tracked);return tracked;};
 deps.createRegistrationClient=async(/** @type {any} */lease)=>createWorkerRegistrationClient(d.endpoint,channel,lease);
 deps.createFirstReceiveClient=async(/** @type {any} */lease)=>require('./native-first-receive-client.cjs').createNativeFirstReceiveClient(session,original.origin,lease,check);
 deps.createExecutionConfigurationClient=async(/** @type {any} */lease)=>require('./execution-configuration-read-client.cjs').createExecutionConfigurationReadClient(session,original.origin,lease,check);
 deps.selectExecutionDirectory=async(/** @type {any} */lease)=>{lease.check();const result=await rpc.call('DIRECTORY',null,lease.expiresAt,life.signal);lease.check();return result;};
 owner=module.createTrustEnrollmentSession(()=>original,Object.freeze(deps),()=>{if(!closed)parent.postMessage({purpose:'NORMAL_SDK_OWNER_STATE',value:owner.getState()});},d.endpoint.epoch);
 const close=()=>{if(closed)return;closed=true;life.abort();owner.close();channel.close();rpc.close();};data.port.on('close',close);parent.on('close',close);
 parent.postMessage({purpose:'NORMAL_SDK_ENROLLMENT_OWNER_READY',endpointId:d.endpoint.endpointId,epoch:d.endpoint.epoch});
}
/** 원 bootstrap의 원 endpoint를 고정 entry에 넘기고 일반 UI는 기존 상태만 본다.
 * @param {any} bootstrap @param {any} session @param {()=>any} context @param {string} version @param {(lease:any)=>Promise<any>} directory @param {()=>void} notify
 */
async function createSdkEnrollmentSession(bootstrap,session,context,version,directory,notify){
 const original=safe(context()),endpoint=createRegistrationSessionEndpoint(bootstrap,session,context);let started;try{started=await require('./trust-key-host-client.cjs').launchSdkBootstrapWorker(bootstrap,endpoint,original,version);}catch(error){endpoint.close();throw error;}
 let closed=false,busy=0;
/** @type {any} */let state;const life=new AbortController(),signature=canonicalJson(original),check=()=>{started.check();if(closed||canonicalJson(context())!==signature)fail('CONTEXT_CHANGED');};
 const rpc=duplex(started.port,humanRelay(session,original,context,directory),check);

/** @type {Promise<any>|undefined} */let closeWork;const close=()=>{if(closeWork)return closeWork;endpoint.close();closeWork=(async()=>{let result={state:'UNKNOWN'};try{const answer=await rpc.call('RETIRE',null,Date.now()+10000,new AbortController().signal);if(answer?.state==='CLOSED_CONFIRMED')result=await started.stop();}catch{}finally{closed=true;life.abort();if(result.state==='CLOSED_CONFIRMED')rpc.close();else started.retain();if(result.state!=='CLOSED_CONFIRMED'&&state){state={...state,phase:'UNKNOWN',problem:'OUTCOME_UNKNOWN'};notify();}}return result;})();return closeWork;};
 started.worker.on('error',close);started.worker.on('exit',close);started.worker.stdout?.on('data',close);started.worker.stderr?.on('data',close);started.worker.on('message',(/** @type {unknown} */raw)=>{try{check();const m=catalogueExact(raw,'purpose,value');if(m.purpose!=='NORMAL_SDK_OWNER_STATE')fail();state=safe(m.value);notify();}catch{close();}});
 const command=async(/** @type {string} */name,/** @type {any} */input)=>{check();busy++;try{const result=await rpc.call('COMMAND',{name,input},Date.now()+300000,life.signal);check();if(result?.state?.schemaVersion===1&&Object.hasOwn(result.state,'contextEpoch'))state=safe(result.state);return result;}finally{busy--;}};
 try{const initial=await command('trust-status',{attemptId:null,epoch:null});if(initial?.ok!==true)fail();state=safe(initial.state);}catch(error){close();throw error;}
 return Object.freeze({getState:()=>safe(state),isBusy:()=>busy>0,handle:command,configuration:(/** @type {string} */action,/** @type {any} */value)=>command('CONFIGURATION',{action,value}),handleReceive:command,
  closeConfiguration:()=>{void command('CLOSE_CONFIGURATION',null).catch(close);},disposeReceive:()=>{void command('DISPOSE_RECEIVE',null).catch(close);},invalidate:close,close});
}
/** @typedef {{sdkVersion:'0.3.224',sdkEntry:string,runtime:string,cli:string,manifestHash:string,hookHash:string,plannedSid:string,model:string,maxTurns:number|null,program:{application:string,cwd:string,args:string[],env:Record<string,string>},sourceHash:string,bindingHash:string}} SdkIntent */
/** 같은 supervisor의 private source만 조립한다. 원 포트의 반환은 실행 허가가 아니다.
 * @param {{check:()=>void,readIntent:()=>Promise<unknown>,verifyHook:(h:string)=>Promise<import('./trust-key-host-client.cjs').SdkHookUnavailable>,admitQuery:()=>Promise<never>,close:()=>Promise<{state:'UNKNOWN'}>}} source
 */
function createOwnedSdkQueryPreflight(source){
 if(!source||types.isProxy(source)||Object.getPrototypeOf(source)!==Object.prototype)fail();
 const names=['check','readIntent','verifyHook','admitQuery','close'],methods=names.map(name=>{const d=Object.getOwnPropertyDescriptor(source,name);if(!d||!('value'in d)||typeof d.value!=='function'||types.isProxy(d.value))fail();return d.value;});
 let attempted=false,hookAttempted=false,dead=false;
 /** @type {Promise<SdkIntent>|null|undefined} */let intentPromise;
 const guard=()=>{if(dead||names.some((name,i)=>Object.getOwnPropertyDescriptor(source,name)?.value!==methods[i]))fail('CONTEXT_CHANGED');methods[0]();};
 const read=async()=>{guard();if(!intentPromise){intentPromise=(async()=>{const raw=await methods[1]();guard();return safeSdkIntent(raw);})();}return await intentPromise;};
 /** @returns {Promise<{state:'UNKNOWN'}>} */
 const close=async()=>{if(dead)return{state:'UNKNOWN'};dead=true;intentPromise=null;return await methods[4]();};
 /** @param {AbortSignal} signal */
 const watch=signal=>{if(types.isProxy(signal)||!signal||Object.getPrototypeOf(signal)!==AbortSignal.prototype||['aborted','addEventListener','removeEventListener'].some(key=>Object.hasOwn(signal,key))||signal.aborted)fail('CONTEXT_CHANGED');const abort=()=>{void close().catch(()=>{});};EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});if(signal.aborted){abort();fail('CONTEXT_CHANGED');}return()=>EventTarget.prototype.removeEventListener.call(signal,'abort',abort);};
 /** @param {unknown} spec @param {AbortSignal} signal @returns {Promise<import('./trust-key-host-client.cjs').SdkHookUnavailable>} */
 const verifyHook=async(spec,signal)=>{guard();if(hookAttempted)fail();hookAttempted=true;const unwatch=watch(signal);try{const v=await read();guard();if(signal.aborted)fail('CONTEXT_CHANGED');const {observeSdkHook}=require('./normal-sdk-child-bridge.cjs'),observed=observeSdkHook(spec,signal);if(observed.hookHash!==v.hookHash)fail('CONTEXT_CHANGED');const answer=await methods[2](observed.hookHash);guard();if(signal.aborted)fail('CONTEXT_CHANGED');return answer;}finally{unwatch();}};
 return Object.freeze({verifyHook,close,inspectQueryAdmission:async(/** @type {AbortSignal} */signal)=>{
  guard();if(attempted)fail();attempted=true;const unwatch=watch(signal);
  try{await read();guard();if(signal.aborted)fail('CONTEXT_CHANGED');
   // 실제 PRESPAWN 생산자가 없는 현재 native 응답은 반드시 여기서 거절한다.
   // 그 응답을 caller bool/함수 반환으로 실행 허가로 치환하지 않는다.
   await methods[3]();guard();fail('PROTECTION_UNAVAILABLE');
  }finally{unwatch();}
 }});
}
/** @param {unknown} raw @returns {SdkIntent} */
function safeSdkIntent(raw){
 const v=JSON.parse(canonicalJson(catalogueExact(raw,'sdkVersion,sdkEntry,runtime,cli,manifestHash,hookHash,plannedSid,model,maxTurns,program,sourceHash,bindingHash'))),p=catalogueExact(v.program,'application,cwd,args,env');
 if(Buffer.byteLength(canonicalJson(v))>2097152||v.sdkVersion!=='0.3.224'||![v.sourceHash,v.bindingHash,v.manifestHash,v.hookHash].every(h=>typeof h==='string'&&/^[0-9a-f]{64}$/.test(h))||typeof v.plannedSid!=='string'||!v.plannedSid||v.plannedSid.length>512||typeof v.model!=='string'||!v.model||v.maxTurns!==null&&(!Number.isSafeInteger(v.maxTurns)||v.maxTurns<1)||typeof v.sdkEntry!=='string'||!v.sdkEntry.endsWith('\\sdk.mjs')||!Array.isArray(p.args)||p.args.length>200||!p.env||Object.keys(p.env).length>6)fail();
 for(const path of [v.sdkEntry,v.runtime,v.cli,p.application,p.cwd])if(typeof path!=='string'||path.length>1024||!(/^[A-Za-z]:\\/).test(path)||path!==require('node:path').win32.normalize(path))fail();
 for(const x of [...p.args,...Object.values(p.env)])if(typeof x!=='string'||x.length>4096||!x.isWellFormed()||/[\x00-\x1f\x7f]/.test(x))fail();
 if(!Object.keys(p.env).every(k=>['SystemRoot','WINDIR','TEMP','TMP','CLAUDE_CODE_ENTRYPOINT','CLAUDE_AGENT_SDK_VERSION'].includes(k))||p.env.CLAUDE_CODE_ENTRYPOINT!=='sdk-ts'||p.env.CLAUDE_AGENT_SDK_VERSION!=='0.3.224')fail();
 return v;
}
module.exports={createRegistrationSessionEndpoint,createRegistrationWorkerChannel,createWorkerRegistrationClient,createSdkEnrollmentSession,createOwnedSdkQueryPreflight};
const thread=require('node:worker_threads');
if(!thread.isMainThread&&thread.workerData?.purpose==='NORMAL_SDK_ENROLLMENT_OWNER_V1')runEnrollmentWorker(thread.workerData,thread.parentPort);
