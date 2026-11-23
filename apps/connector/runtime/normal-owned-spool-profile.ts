import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import * as fs from 'node:fs/promises';
import {unlinkSync} from 'node:fs';
import {basename,resolve,isAbsolute} from 'node:path';
import {isPromise,isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,refV1,recordV1,uuidV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import {frameUnderstandingRangeResult,readPreparedUnderstandingRangeResult,type NormalPreparedUnderstandingRangeResult,type NormalUnderstandingRangeResultSendOperation,frameUnderstandingResult,readPreparedUnderstandingResult,type NormalOwnedSdkSupervisor,type NormalOwnedHostFactory,type NormalOwnedHostSession,type NormalOwnedMetadata,type HostCloseDisposition,type NormalUnderstandingResultBinding,type NormalPreparedUnderstandingResult,type NormalUnderstandingResultSendOperation} from './normal-credential-bootstrap-client.ts';
import {isOwnedSpoolPath,NormalStartFileStore,type NormalFilePorts,type NormalLocalScope,type ProfileJournalAccess} from './normal-start-file-store.ts';
import {NormalStartIntake,type NormalStartStore} from './normal-start-intake.ts';
import {NormalClaudeStartWire} from '../adapters/secondary/normal-start-wire.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkOpaqueId} from '../adapters/secondary/schemas.ts';
import {confirmNormalLiveInputDelivery,takeFirstOutputOrigin,takeFirstSidOrigin,takeNormalFirstPermitHandoff,type LiveInputPort,type NormalFirstSendSource} from './normal-first-send-owner.ts';
import type {NormalStartWire,NormalStartCurrent} from './normal-start-coordinator.ts';
import type {RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {receiveProfiledEnvelope,type InboxFilePorts,type InboxLimits} from './receipt-inbox.ts';
import {takeNormalUnderstandingRangeAcquisition,takeNormalUnderstandingDiscovery,type NormalUnderstandingDiscoveryTicket,takeNormalUnderstandingRead,type NormalUnderstandingReadTicket,type NormalProtectedGetClient,type NormalUnderstandingRangeAcquisition} from './normal-protected-get-client.ts';
import {readNormalUnderstandingRange,type NormalUnderstandingRangeProjection,readNormalUnderstandingDiscovery,type NormalUnderstandingDiscoveryProjection,readNormalUnderstandingResponse,type NormalUnderstandingResponseProjection} from './normal-understanding-response-source.ts';
import type {NormalOwnedCredentialPort} from './normal-credential-bootstrap-client.ts';

import type {NormalProtectedPostClient} from './normal-protected-post-client.ts';

declare const resultSeal:unique symbol;
export type NormalUnderstandingResultSeal=Readonly<{[resultSeal]:true}>;
declare const rangeReadSeal:unique symbol;
export type NormalUnderstandingRangeReadResult=Readonly<{[rangeReadSeal]:true;kind:'RANGE_READ_VERIFIED';requestRef:RuntimeRefV1;acquisitionRef:RuntimeRefV1;bodyHash:string;executionAuthorized:false;dispatchPerformed:false}>;
const rangeReadResults=new WeakMap<object,{client:NormalProtectedGetClient;owned:NormalOwnedCredentialPort;projection:NormalUnderstandingRangeProjection;body:Buffer;closed?:ClosedUnderstanding;check:Guard;dispose:()=>void}>();
/** 원문은 이 모듈의 단회 상태에만 남긴다. 폐기는 서명/전송 권위를 발급하지 않는다. */
export function discardNormalUnderstandingRangeReadResult(result:NormalUnderstandingRangeReadResult){rangeReadResults.get(result)?.dispose();}
/** 원문과 준비 capability는 같은 비공개 상태의 단회 소비에만 전달한다. */
async function transmitNormalUnderstandingRangeResult(result:NormalUnderstandingRangeReadResult,client:NormalProtectedGetClient,owned:NormalOwnedCredentialPort,signal:AbortSignal){
 const saved=rangeReadResults.get(result);if(!saved)invalid();rangeReadResults.delete(result);
 try{
  if(saved.client!==client||saved.owned!==owned||signal.aborted)invalid();saved.check();
  const binding={requestRef:result.requestRef,acquisitionRef:result.acquisitionRef,bodyHash:result.bodyHash};
  if(contentHash(saved.body)!==binding.bodyHash)invalid();
  const outcome={requestRef:result.requestRef,acquisitionRef:result.acquisitionRef,bodyHash:result.bodyHash,executionAuthorized:false as const,dispatchPerformed:false as const};
  if(!saved.closed)return Object.freeze({state:'SIGNING_UNAVAILABLE' as const,...outcome});
  await saved.closed.transmit(saved.body,binding,signal);saved.check();if(signal.aborted)invalid();
  return Object.freeze({state:'TRANSMISSION_UNCONFIRMED' as const,...outcome});
 }finally{saved.dispose();}
}
type DiscoveryReadResult={metadata:NormalUnderstandingDiscoveryProjection;seal:NormalUnderstandingResultSeal};
type ClosedUnderstanding={transmit(body:Buffer,binding:NormalUnderstandingResultBinding,signal:AbortSignal):Promise<void>};
const discoveryResults=new WeakMap<object,{client:NormalProtectedGetClient;owned:NormalOwnedCredentialPort;post:NormalProtectedPostClient;metadata:NormalUnderstandingDiscoveryProjection;closed?:ClosedUnderstanding;check:Guard;finish:Guard}>();
/** 발급 함수는 없다. 원 outputSource의 정상 read/close 뒤에만 등록한 인계를 한 번 소비한다. */
function takeNormalUnderstandingResult(seal:NormalUnderstandingResultSeal,client:NormalProtectedGetClient,post:NormalProtectedPostClient,owned:NormalOwnedCredentialPort){
 const saved=discoveryResults.get(seal);if(!saved)invalid('NORMAL_POST_RESULT_SEAL_INVALID');discoveryResults.delete(seal);
 try{if(saved.client!==client||saved.post!==post||saved.owned!==owned)invalid('NORMAL_POST_RESULT_SEAL_INVALID');saved.check();return saved;}
 catch(error){saved.finish();throw error;}
}
/** 물리 종료를 끝낸 원 신뢰 호스트의 결박만 비공개 단회 전송으로 이어진다. */
export async function prepareNormalUnderstandingResult(seal:NormalUnderstandingResultSeal,client:NormalProtectedGetClient,post:NormalProtectedPostClient,owned:NormalOwnedCredentialPort,signal:AbortSignal){
 const saved=takeNormalUnderstandingResult(seal,client,post,owned);let bytes:Buffer|undefined;
 try{
  if(!(signal instanceof AbortSignal)||signal.aborted)invalid('NORMAL_POST_RESULT_SEAL_INVALID');
  saved.check();const m=saved.metadata,s=owned.metadata.scope;
  if(m.projectId!==s.projectId||m.executionId!==s.executionId||m.executionGeneration!==s.executionGeneration)invalid('NORMAL_POST_RESULT_SEAL_INVALID');
  bytes=Buffer.from(canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:m}),'utf8');
  if(bytes.length>2*1024*1024)invalid('NORMAL_POST_RESULT_SEAL_INVALID');
  const bodyHash=contentHash(bytes);
  saved.check();if(signal.aborted)invalid('NORMAL_POST_RESULT_SEAL_INVALID');
  const binding={requestRef:cloneV1(m.requestRef),acquisitionRef:cloneV1(m.acquisitionRef),bodyHash};
  const outcome={requestRef:Object.freeze(cloneV1(m.requestRef)),acquisitionRef:Object.freeze(cloneV1(m.acquisitionRef)),bodyHash,executionAuthorized:false as const,dispatchPerformed:false as const};
  if(!saved.closed)return Object.freeze({state:'SIGNING_UNAVAILABLE' as const,...outcome});
  await saved.closed.transmit(bytes,binding,signal);
  saved.check();if(signal.aborted)invalid('NORMAL_POST_RESULT_SEAL_INVALID');
  // 서버 영수증 계약이 조립될 때까지 전송 결과를 보관 성공으로 해석하지 않는다.
  return Object.freeze({state:'TRANSMISSION_UNCONFIRMED' as const,...outcome});
 }finally{bytes?.fill(0);saved.finish();}
}
export function discardNormalUnderstandingResult(seal:NormalUnderstandingResultSeal){const saved=discoveryResults.get(seal);discoveryResults.delete(seal);saved?.finish();}

type Writer='NORMAL_EXECUTION'|'UNVERIFIED_RECEIPT_INBOX';
type IO=NormalFilePorts&InboxFilePorts;
type Guard=()=>void;
type Session={host:NormalOwnedHostSession;invalidated:AbortSignal;current:()=>void;send:NormalOwnedHostSession['send'];scope:string;writer:Writer;slot:NormalOwnedMetadata|null;
 signal:AbortSignal;wall:number;mono:number;frames:number;sending:boolean;borrowed:boolean;dead:boolean;
 profile:string;allocation:string;path:string;stamp:string};
type Ticket={session:Session;live:boolean;child:boolean};
function invalid(code='NORMAL_SPOOL_UNKNOWN'):never{throw Error(code);}
const capacity=Object.freeze(new Error('NORMAL_SPOOL_CAPACITY_EXCEEDED'));
const defaultIO:IO={lstat:fs.lstat,realpath:fs.realpath,open:fs.open,opendir:fs.opendir,readdir:fs.readdir,unlink:fs.unlink,unlinkSync};
const byRef=(value:unknown)=>canonicalJson(value);
const tickets=new AsyncLocalStorage<Ticket>();
const outside=new AsyncLocalStorage<boolean>();
const profileJournals=new WeakSet<ProfileJournalAccess>();
type OutputPorts=NormalFirstSendSource['storage'];
export type WorkerSdkPorts=Pick<NormalFirstSendSource,'expiresAt'|'create'|'close'|'check'>&{classify:OutputPorts['classify']};
type Hold=Awaited<ReturnType<OutputPorts['reserve']>>;
type OutputTx=Parameters<OutputPorts['strictExclusive']>[1];
type Handoff={reservation:string;challenge:string;scopeDigest:string;requestDigest:string};
type PhaseControls={resume?:Handoff;readOnly?:boolean;closeReservation?:string;challenge?:string;understanding?:NormalUnderstandingResultBinding;range?:NormalUnderstandingResultBinding&{selection:NormalUnderstandingRangeAcquisition['selection']};resultDeadline?:number;prepareRange?:true;closed?:ClosedUnderstanding;guard:()=>void};
const outputBinders=new WeakMap<OutputPorts,(ticket:object)=>void>();
const outputJournals=new WeakSet<ProfileJournalAccess>();
type FirstSidBasis=Omit<Parameters<NormalFirstSendSource['check']>[0],'plannedSidDigest'>;
const firstSidSources=new WeakMap<NormalFirstSendSource,{worker:NormalStartWire;spent:boolean;verify(basis:FirstSidBasis):void}>();
/** 등록 outputSource의 원 FIRST만 소비한다. bundle/public API에는 이 내부 함수가 노출되지 않는다. */
export function takeProfileFirstSid(ticket:object,source:NormalFirstSendSource,worker:NormalStartWire):string|null{
 const original=firstSidSources.get(source);if(!original)return null;
 if(original.spent||original.worker!==worker)invalid();
 const origin=takeFirstSidOrigin(ticket,source,worker);original.spent=true;
 const check=()=>{origin.check();original.verify(origin.basis);};
 check();const sid=randomUUID();
 if(typeof sid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sid))invalid();
 check();return sid;
}

export function isProfileOutputJournal(access:ProfileJournalAccess){return outputJournals.has(access);}
export function bindProfileOutput(store:OutputPorts,ticket:object){outputBinders.get(store)?.(ticket);}
function gate<T>(){
 let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;
 const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});void promise.catch(()=>{});
 return {promise,resolve,reject};
}
// SDK 입력에는 첫 명령 한 개와 다음 명령을 기다리는 pull 한 개만 둔다.
function workerInput(first:AsyncIterable<unknown>,life:AbortSignal,check:Guard){
 type Step=IteratorResult<unknown>;
 let taken=false,firstUsed=false,pulling=false,offered=false,closed=false;
 let demand=gate<void>(),request:ReturnType<typeof gate<Step>>|undefined;
 const error=()=>Error('NORMAL_WORKER_INPUT_UNAVAILABLE');
 const close=()=>{closed=true;life.removeEventListener('abort',close);demand.reject(error());request?.reject(error());};
 const live=()=>{if(closed||life.aborted)throw error();check();if(closed||life.aborted)throw error();};
 life.addEventListener('abort',close,{once:true});if(life.aborted)close();
 const stream=Object.freeze({[Symbol.asyncIterator](){
  if(taken)throw error();taken=true;live();
  return Object.freeze({
   next():Promise<Step>{
    if(pulling)return Promise.reject(error());pulling=true;
    try{
     live();
     if(!firstUsed){
      firstUsed=true;
      return (async()=>{try{const value=await first[Symbol.asyncIterator]().next();live();if(value.done)throw error();return value;}
       catch(cause){close();throw cause;}finally{pulling=false;}})();
     }
     request=gate<Step>();demand.resolve();return request.promise;
    }catch(cause){close();return Promise.reject(cause);}
   },
   async return(){close();return {done:true as const,value:undefined};}
  });
 }});
 const provide=async(input:AsyncIterable<unknown>,signal:AbortSignal,confirm:Guard)=>{
  if(offered||closed||!firstUsed||signal.aborted)throw error();
  offered=true;signal.addEventListener('abort',close,{once:true});
  try{
   live();await demand.promise;live();const next=request;if(!next||signal.aborted)throw error();
   // 이 명령의 진짜 iterable이 current/원장 재검산을 마친 뒤에만 대기한 SDK pull에 제공한다.
   const value=await input[Symbol.asyncIterator]().next();live();
   if(value.done)throw error();const upcoming=gate<void>();
   confirm();
   if(closed||life.aborted||signal.aborted||request!==next)throw error();
   request=undefined;pulling=false;demand=upcoming;next.resolve(value);
  }catch(cause){close();throw cause;}finally{offered=false;signal.removeEventListener('abort',close);}
 };
 return {stream,provide,close};
}
const profileReceipts=new WeakMap<InboxFilePorts,string>();
export function isProfileJournal(access:ProfileJournalAccess){return profileJournals.has(access);}
export function isProfileReceipt(ports:InboxFilePorts,path:string){return profileReceipts.get(ports)===path;}
export function outsideOwnedSpoolCallback<T>(call:()=>T):T{return tickets.exit(()=>outside.run(true,call));}
function summary(value:unknown){return recordV1(value,['count','bytes','tail'])&&Number.isSafeInteger(value.count)&&Number.isSafeInteger(value.bytes)&&value.count>=0&&value.count<=10000&&value.bytes>=0&&(value.count===0?value.bytes===0&&value.tail===null:value.bytes>0&&hashV1(value.tail));}
const pathEqual=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

// Only application source uses this class. The desktop bundle exports a purpose factory, not this store or its host.
export class OwnedSpoolRuntime {
 readonly #als=tickets;
 readonly #workers=new WeakMap<NormalStartWire,{journal:NormalStartFileStore;scope:NormalLocalScope;registration:RuntimeRefV1;grant:RuntimeRefV1}>();
 readonly #workerReads=new WeakMap<NormalStartFileStore,NormalStartStore>();
 #foreground?:AbortSignal;#turn?:ReturnType<typeof gate<void>>;
 #binding?:{update:(profile:RuntimeRefV1,allocation:RuntimeRefV1)=>void};
 #session?:Session;#opening=false;#unknown=false;
 readonly #host:NormalOwnedHostFactory;readonly #open:NormalOwnedHostFactory['open'];readonly #io:IO;
 readonly #attempt:string;readonly #now:()=>number;readonly #owner:AbortSignal;
 readonly #slot:()=>NormalOwnedMetadata|null;
 constructor(host:NormalOwnedHostFactory,attempt:string,now:()=>number,owner:AbortSignal,slot:()=>NormalOwnedMetadata|null,io?:IO){
  if(!host||typeof host.open!=='function'||!uuidV1(attempt)||!(owner instanceof AbortSignal))invalid('NORMAL_SPOOL_UNSUPPORTED');
  this.#host=host;this.#open=host.open;this.#attempt=attempt;this.#now=now;this.#owner=owner;this.#slot=slot;this.#io=io??defaultIO;
 }
 external<T>(call:()=>T):T{return outsideOwnedSpoolCallback(call);}
 async #enterTurn(eligible:boolean,signal:AbortSignal){
  if(!this.#binding)return ()=>{};
  if(this.#turn&&(!eligible||outside.getStore()))invalid('NORMAL_OWNED_BUSY');
  const prior=this.#turn,next=gate<void>();this.#turn=next;
  const release=()=>{if(this.#turn===next)this.#turn=undefined;next.resolve();};
  if(prior)await prior.promise;
  if(this.#unknown||signal.aborted||this.#owner.aborted){release();invalid();}
  return release;
 }
 #clock(){return this.external(this.#now);}
 #check(s:Session,physical=true){
  this.external(()=>{
   if(s.host.send!==s.send||this.#open!==this.#host.open)invalid();
   if(physical){
    if(s.current!==s.host.current||s.invalidated!==s.host.invalidated||s.invalidated.aborted)invalid();
    Reflect.apply(s.current,s.host,[]);
   }
  });
  const wall=this.#clock(),slot=s.writer==='NORMAL_EXECUTION'?byRef(this.external(this.#slot)):s.scope;
  if(this.#unknown||s.dead||this.#owner.aborted||s.signal.aborted||s!==this.#session||
     wall>=s.wall||performance.now()>=s.mono||slot!==s.scope)invalid();
 }
 async #bounded<T>(s:Session,run:()=>Promise<T>,physical=true):Promise<T>{
  this.#check(s,physical);
  let reject!:(error:Error)=>void;
  const lost=new Promise<never>((_,r)=>{reject=r;}),signals=physical?[s.signal,this.#owner,s.invalidated]:[s.signal,this.#owner];
  void lost.catch(()=>{});
  const cancel=()=>{s.dead=true;reject(Error('NORMAL_SPOOL_UNKNOWN'));};
  const timer=setTimeout(cancel,Math.max(1,Math.min(s.wall-this.#clock(),s.mono-performance.now())));
  for(const signal of signals)signal.addEventListener('abort',cancel,{once:true});
  try{this.#check(s,physical);return await Promise.race([run(),lost]);}
  finally{clearTimeout(timer);for(const signal of signals)signal.removeEventListener('abort',cancel);}
 }
 async #frame(s:Session,op:string,p:unknown){
  this.#check(s);if(s.sending||++s.frames>64)invalid();s.sending=true;
  try{const answer=await this.external(()=>Reflect.apply(s.send,s.host,[op,p]));this.#check(s);return answer;}
  catch(e){s.dead=true;throw e;}finally{s.sending=false;}
 }
 async #openUnderstanding(signal:AbortSignal,wall:number,mono:number,check:Guard,slot?:NormalOwnedMetadata){
  const local=new AbortController(),combined=AbortSignal.any([signal,this.#owner,local.signal]);
  const remaining=()=>Math.min(wall-this.#clock(),mono-performance.now());
  const current=()=>{
   check();if(combined.aborted||remaining()<=0||this.#host.open!==this.#open)invalid();
  };
  current();
  let reject!:(error:Error)=>void,host:NormalOwnedHostSession|undefined,finished=false,kept=false,closing=false;
  const cancelled=new Promise<never>((_,fail)=>{reject=fail;});
  void cancelled.catch(()=>{});
  const abort=()=>reject(Error('NORMAL_SPOOL_UNKNOWN'));
  const closeLate=()=>{
   if(closing||!host)return;
   closing=true;const late=host;
   try{void this.external(()=>late.close('OPERATION_UNKNOWN')).catch(()=>{});}catch{}
  };
  const timer=setTimeout(()=>local.abort(),Math.max(1,remaining()));
  combined.addEventListener('abort',abort,{once:true});
  try{
   current();
   const opening=Promise.resolve(this.external(()=>Reflect.apply(this.#open,this.#host,slot?[combined,cloneV1(slot)]:[combined])))
    .then(opened=>{host=opened;if(finished&&!kept)closeLate();return opened;});
   const opened=await Promise.race([opening,cancelled]);
   current();kept=true;return opened;
  }finally{
   finished=true;clearTimeout(timer);combined.removeEventListener('abort',abort);
   if(!kept){local.abort();closeLate();}
  }
 }
 /** The closure created after the original physical close is the only caller. */
 async #transmitUnderstanding(slot:NormalOwnedMetadata,proof:NormalPreparedUnderstandingResult|NormalPreparedUnderstandingRangeResult,binding:NormalUnderstandingResultBinding,body:Buffer,signal:AbortSignal,check:Guard,wall:number,mono:number){
  check();
  const range=proof.state==='NATIVE_RANGE_RESULT_PREPARED';
  const framed=range?frameUnderstandingRangeResult(this.#attempt,slot,proof,binding,body):frameUnderstandingResult(this.#attempt,slot,proof,binding,body);
  const release=await this.#enterTurn(true,signal);
  let host:NormalOwnedHostSession|undefined,s:Session|undefined,close:NormalOwnedHostSession['close']|undefined,opened=false,success=false;
  try{
   check();
   if(this.#als.getStore()||this.#session||this.#opening||signal.aborted||this.#host.open!==this.#open)invalid();
   this.#opening=true;opened=true;
   host=await this.#openUnderstanding(signal,wall,mono,check,slot);
   close=host.close;
   const physical=host,current=host.current,invalidated=host.invalidated,send=range?host.sendUnderstandingRangeResult:host.sendUnderstandingResult;
   if(typeof current!=='function'||isProxy(current)||!(invalidated instanceof AbortSignal)||typeof send!=='function'||isProxy(send))invalid();
   const session:Session={host,current,invalidated,send:host.send,scope:byRef(slot),writer:'NORMAL_EXECUTION',slot,signal,wall,mono,
    frames:0,sending:false,borrowed:false,dead:false,profile:'',allocation:'',path:'',stamp:''};
   s=session;this.#session=session;
   const frame=async(op:NormalUnderstandingResultSendOperation|NormalUnderstandingRangeResultSendOperation,p:unknown)=>{
    check();if((range?physical.sendUnderstandingRangeResult:physical.sendUnderstandingResult)!==send||++session.frames>64||Buffer.byteLength(canonicalJson(p))>64500)invalid();
    const reply=await this.#bounded(session,()=>this.external(()=>Reflect.apply(send,physical,[op,p])));
    this.#check(session);check();if((range?physical.sendUnderstandingRangeResult:physical.sendUnderstandingResult)!==send)invalid();
    return reply;
   };
   if(framed.kind==='DIRECT')await frame(range?'NORMAL_EXECUTION_UNDERSTANDING_RANGE_RESULT_SEND':'NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND',framed.payload);
   else{
    const start=await frame('NORMAL_EXECUTION_BEGIN',framed.begin);
    if(!recordV1(start,['handle'])||!uuidV1(start.handle))invalid();
    for(let offset=0;offset<body.length;offset+=framed.chunkSize){
     const part=body.subarray(offset,offset+framed.chunkSize);
     const ack=await frame('NORMAL_EXECUTION_WRITE',{handle:start.handle,offset,bytes:part.toString('base64url')});
     if(!recordV1(ack,['handle','offset'])||ack.handle!==start.handle||ack.offset!==offset+part.length)invalid();
    }
    await frame('NORMAL_EXECUTION_EXECUTE',{handle:start.handle});
   }
   success=true;
  }finally{
   if(host){
    try{
     const physical=host;
     if(physical.close!==close)invalid();
     const closing=this.external(()=>Reflect.apply(close!,physical,[success?'HOST_REQUEST_VALIDATED':'OPERATION_UNKNOWN']));
     void closing.catch(()=>{});
     const result=success&&s?await this.#bounded(s,()=>closing,false):await closing;
     if(result?.state!=='CLOSED_CONFIRMED'||physical.close!==close)success=false;
     if(success&&s){this.#check(s,false);check();}
    }catch{success=false;}
   }
   if(s){s.dead=true;this.#session=undefined;}
   if(opened)this.#opening=false;
   release();
   if(opened&&!success){this.#unknown=true;invalid();}
  }
 }
 // Channel.operation supplies its captured credential metadata only for a protected HTTP request.
 credentialHost():NormalOwnedHostFactory{
  return {open:async(signal,request)=>{
   const t=this.#als.getStore();
   if(!t){
    if(!this.#binding){if(this.#unknown||this.#owner.aborted||this.#opening||this.#session)invalid('NORMAL_OWNED_BUSY');return this.external(()=>Reflect.apply(this.#open,this.#host,[signal]));}
    const eligible=!!request&&byRef(request)===byRef(this.external(this.#slot));
    const release=await this.#enterTurn(eligible,signal);
    try{
     if(this.#opening||this.#session||eligible&&byRef(request)!==byRef(this.external(this.#slot)))invalid('NORMAL_OWNED_BUSY');
     const raw=await this.external(()=>Reflect.apply(this.#open,this.#host,eligible?[signal,cloneV1(request)]:[signal]));
     const send=raw.send,close=raw.close,budget=raw.inspectionBudget,prepare=raw.prepareSdkChildSource;let returned=false;
     return {...(typeof prepare==='function'?{prepareSdkChildSource:(source:Readonly<Record<string,unknown>>)=>{if(returned||raw.prepareSdkChildSource!==prepare||!eligible||byRef(request)!==byRef(this.external(this.#slot)))invalid();return this.external(()=>Reflect.apply(prepare,raw,[source]));}}:{}),...(typeof budget==='function'?{inspectionBudget:()=>{if(returned||raw.inspectionBudget!==budget)invalid();return this.external(()=>Reflect.apply(budget,raw,[]));}}:{}),send:(op:string,p:unknown)=>{if(returned||raw.send!==send)invalid();return this.external(()=>Reflect.apply(send,raw,[op,p]));},
      close:async(d:HostCloseDisposition)=>{if(returned)invalid();returned=true;try{return await this.external(()=>Reflect.apply(close,raw,[d]));}finally{release();}}};
    }catch(error){release();throw error;}
   }
   const s=t.session;this.#check(s);
   if(!t.live||t.child||!request||s.writer!=='NORMAL_EXECUTION'||s.borrowed||s.scope!==byRef(request)||signal.aborted)invalid('NORMAL_OWNED_BUSY');
   s.borrowed=true;let returned=false,began=false;
   const check=()=>{this.#check(s);if(!t.live||returned||!s.borrowed||signal.aborted)invalid();};
   return {send:async(op:string,p:unknown)=>{
    check();if(!began){
     if(!['NORMAL_EXECUTION_BEGIN','NORMAL_EXECUTION_CALL'].includes(op)||p===null||typeof p!=='object'||isProxy(p)||
        Object.getOwnPropertyDescriptor(p,'slotId')?.value!==s.slot?.slotId||Object.getOwnPropertyDescriptor(p,'attemptId')?.value!==this.#attempt)invalid();
     began=true;
    }else if(!['NORMAL_EXECUTION_WRITE','NORMAL_EXECUTION_EXECUTE','NORMAL_EXECUTION_READ'].includes(op))invalid();
    const answer=await this.#frame(s,op,p);check();return answer;
   },close:async(disposition:HostCloseDisposition)=>{
    if(returned||!t.live||this.#session!==s||s.sending||!began||disposition!=='HOST_REQUEST_VALIDATED')s.dead=true;
    returned=true;s.borrowed=false;this.#check(s);return {state:'CLOSED_CONFIRMED'};
   }};
  }};
 }
 #auth(s:Session){return s.slot?{writer:s.writer,attemptId:this.#attempt,slotId:s.slot.slotId}:{writer:s.writer,attemptId:this.#attempt};}
 async #root<T>(writer:Writer,signal:AbortSignal,body:(t:Ticket)=>Promise<T>,phase?:PhaseControls):Promise<T>{
  if(this.#als.getStore()||!this.#binding)return this.#openRoot(writer,signal,body,phase);
  const release=await this.#enterTurn(signal===this.#foreground||!!phase,signal);
  try{phase?.guard();return await this.#openRoot(writer,signal,body,phase);}finally{release();}
 }
 async #openRoot<T>(writer:Writer,signal:AbortSignal,body:(t:Ticket)=>Promise<T>,phase?:PhaseControls):Promise<T>{
  const parent=this.#als.getStore();
  if(parent){
   if(phase)invalid();this.#check(parent.session);if(!parent.live||parent.child||parent.session.borrowed||parent.session.writer!==writer||parent.session.signal!==signal)invalid('NORMAL_OWNED_BUSY');
   parent.child=true;const t={session:parent.session,live:true,child:false};
   try{return await this.#als.run(t,()=>body(t));}finally{t.live=false;parent.child=false;}
  }
  if(this.#unknown||this.#session||this.#opening||this.#owner.aborted||signal.aborted||this.#host.open!==this.#open)invalid('NORMAL_OWNED_BUSY');
  this.#opening=true;
  let host:NormalOwnedHostSession|undefined,s:Session|undefined,success=false,openingStarted=false;
  let closePhysical:NormalOwnedHostSession['close']|undefined,prepared:NormalPreparedUnderstandingResult|NormalPreparedUnderstandingRangeResult|undefined;
  try{
   const slot=writer==='NORMAL_EXECUTION'?this.external(this.#slot):null;
   if(writer==='NORMAL_EXECUTION'&&!slot)invalid('NORMAL_SPOOL_UNSUPPORTED');
   const now=this.#clock(),wall=Math.min(now+10000,slot?Date.parse(slot.expiresAt):Infinity,phase?.resultDeadline??Infinity),mono=performance.now()+wall-now;
   if(wall<=now||this.#owner.aborted||signal.aborted)invalid();
   openingStarted=true;
   host=phase?.understanding||phase?.range?await this.#openUnderstanding(signal,wall,mono,phase.guard,slot!):await this.external(()=>Reflect.apply(this.#open,this.#host,[signal]));
   closePhysical=host.close;
   const purposeSend=phase?.prepareRange?host.sendUnderstandingRangeResult:phase?.understanding?host.sendUnderstandingResult:undefined;
   const prepare=typeof purposeSend==='function'?(phase?.prepareRange?host.prepareUnderstandingRangeResult:host.prepareUnderstandingResult):undefined;
   const current=host.current,invalidated=host.invalidated;if(typeof current!=='function'||isProxy(current)||!(invalidated instanceof AbortSignal))invalid();
   s={host,current,invalidated,send:host.send,scope:byRef(slot),writer,slot,signal,wall,mono,frames:0,sending:false,borrowed:false,dead:false,profile:'',allocation:'',path:'',stamp:''};
   this.#session=s;const auth=this.#auth(s);
   const state=await this.#frame(s,'NORMAL_SPOOL_PROFILE_STATE',auth);
   if(recordV1(state,['state'])&&state.state==='UNSUPPORTED'){success=true;invalid('NORMAL_SPOOL_UNSUPPORTED');}
   if(!recordV1(state,['profileId','allocated'])||!uuidV1(state.profileId)||typeof state.allocated!=='boolean')invalid('NORMAL_SPOOL_UNSUPPORTED');
   const binding=writer==='NORMAL_EXECUTION'&&!!this.#binding&&!phase?.resume;
   if((phase?.resume||phase?.readOnly)&&!state.allocated)invalid();phase?.guard();
   const a=await this.#frame(s,state.allocated?'NORMAL_SPOOL_RESUME':'NORMAL_SPOOL_ALLOCATE',
    phase?.resume?{...auth,...phase.resume}:binding?{...auth,outputBinding:true}:auth);
   if(!recordV1(a,['state','profileId','allocation','root','directoryIdentity',...(binding?['profileRef','assignmentRef']:[])])||a.state!==(state.allocated?'RESUMED':'ALLOCATED')||
      a.profileId!==state.profileId||!uuidV1(a.allocation)||typeof a.directoryIdentity!=='string'||!a.directoryIdentity||
      typeof a.root!=='string'||!isAbsolute(a.root)||!pathEqual(a.root,resolve(a.root))||!isOwnedSpoolPath(a.root)||basename(a.root)!=='data-'+a.allocation)invalid();
   if(binding){
    if(!refV1(a.profileRef)||a.profileRef.version!==1||a.profileRef.id!==a.profileId||!refV1(a.assignmentRef)||a.assignmentRef.version!==1||a.assignmentRef.id!==a.allocation)invalid();
    this.#binding!.update(cloneV1(a.profileRef),cloneV1(a.assignmentRef));
   }
   s.profile=a.profileId;s.allocation=a.allocation;s.path=a.root;
   const path=s.path,st=await this.#bounded(s,()=>this.#io.lstat(path));this.#check(s);
   if(!st.isDirectory()||st.isSymbolicLink()||!pathEqual(await this.#bounded(s,()=>this.#io.realpath(path)),path))invalid();
   s.stamp=String(st.dev)+':'+String(st.ino);this.#check(s);
   const t={session:s,live:true,child:false};let result:T;
   let denied=false;
   try{result=await this.#bounded(s,()=>this.#als.run(t,()=>body(t)));this.#check(s);if(t.child||s.borrowed)invalid();}catch(error){if(error!==capacity)throw error;denied=true;}finally{t.live=false;}
   phase?.guard();
   const closed=await this.#frame(s,'NORMAL_SPOOL_CLOSE',{...auth,allocation:s.allocation,...(phase?.closeReservation?{reservation:phase.closeReservation}:phase?.range?{understandingRange:phase.range}:phase?.understanding?{understanding:phase.understanding}:{})});
   if(phase?.range){
    if(!recordV1(closed,['state','understandingRange'])||closed.state!=='CLOSED_CONFIRMED')invalid();const proof=closed.understandingRange;
    if(!recordV1(proof,['state','requestRef','acquisitionRef','bodyHash'])||proof.state!=='NATIVE_RANGE_CLOSED'||byRef(proof.requestRef)!==byRef(phase.range.requestRef)||byRef(proof.acquisitionRef)!==byRef(phase.range.acquisitionRef)||proof.bodyHash!==phase.range.bodyHash)invalid();
   }else if(phase?.closeReservation){
    if(!recordV1(closed,['state','challenge'])||closed.state!=='SDK_READ_CLOSED'||typeof closed.challenge!=='string'||!uuidV1(closed.challenge.slice(0,36))||!uuidV1(closed.challenge.slice(36)))invalid();
    phase.challenge=closed.challenge;
   }else if(phase?.understanding){
    if(!recordV1(closed,['state','understanding'])||closed.state!=='CLOSED_CONFIRMED')invalid();
    const proof=closed.understanding;
    if(!recordV1(proof,['state','requestRef','acquisitionRef','bodyHash'])||proof.state!=='NATIVE_METADATA_CLOSED'||byRef(proof.requestRef)!==byRef(phase.understanding.requestRef)||byRef(proof.acquisitionRef)!==byRef(phase.understanding.acquisitionRef)||proof.bodyHash!==phase.understanding.bodyHash)invalid();
    if(prepare!==undefined){
     if(!slot||typeof prepare!=='function'||isProxy(prepare)||isProxy(purposeSend)||host.prepareUnderstandingResult!==prepare||host.sendUnderstandingResult!==purposeSend||host.close!==closePhysical||s.sending||++s.frames>64)invalid();
     phase.guard();
     const binding=phase.understanding;
     const payload={attemptId:this.#attempt,slotId:slot.slotId,...cloneV1(binding)};
     const answer=await this.#bounded(s,()=>this.external(()=>Reflect.apply(prepare,host!,[payload])));
     this.#check(s);phase.guard();
     if(host.prepareUnderstandingResult!==prepare||host.sendUnderstandingResult!==purposeSend||host.close!==closePhysical)invalid();
     prepared=readPreparedUnderstandingResult(answer,binding,slot,this.#clock(),s.wall);
     const expiry=Date.parse(prepared.expiresAt);
     s.mono=Math.min(s.mono,performance.now()+expiry-this.#clock());s.wall=expiry;
    }
   }else if(!recordV1(closed,['state'])||closed.state!=='CLOSED_CONFIRMED')invalid();
   if(phase?.prepareRange&&prepare!==undefined){
    if(!phase.range||!slot||typeof prepare!=='function'||isProxy(prepare)||isProxy(purposeSend)||host.prepareUnderstandingRangeResult!==prepare||host.sendUnderstandingRangeResult!==purposeSend||host.close!==closePhysical||s.sending||++s.frames>64)invalid();
    phase.guard();const {requestRef,acquisitionRef,bodyHash}=phase.range,binding={requestRef,acquisitionRef,bodyHash};
    const answer=await this.#bounded(s,()=>this.external(()=>Reflect.apply(prepare,host!,[{attemptId:this.#attempt,slotId:slot.slotId,...cloneV1(binding)}])));
    this.#check(s);phase.guard();if(host.prepareUnderstandingRangeResult!==prepare||host.sendUnderstandingRangeResult!==purposeSend||host.close!==closePhysical)invalid();
    prepared=readPreparedUnderstandingRangeResult(answer,binding,slot,this.#clock(),s.wall);
    const expiry=Date.parse(prepared.expiresAt);s.mono=Math.min(s.mono,performance.now()+expiry-this.#clock());s.wall=expiry;
   }
   success=true;if(denied)throw capacity;return result!;
  }finally{
   if(host){
    try{
     const physical=host;
     const close=()=>this.external(()=>Reflect.apply(closePhysical!,physical,[success?'HOST_REQUEST_VALIDATED':'OPERATION_UNKNOWN']));
     if(physical.close!==closePhysical)invalid();
     if((prepared||phase?.range)&&s&&phase&&success){
      try{this.#check(s,false);phase.guard();}catch{success=false;}
     }
     const closing=close();
     void closing.catch(()=>{});
     const closed=(prepared||phase?.range)&&s&&success?await this.#bounded(s,()=>closing,false):await closing;
     if(closed?.state!=='CLOSED_CONFIRMED'||physical.close!==closePhysical)success=false;
     if(success&&s){
      this.#check(s,false);if(phase?.range)phase.guard();
      if(prepared&&phase){
       const {wall,mono,scope,slot}=s,proof=prepared,binding=phase.prepareRange&&phase.range?{requestRef:phase.range.requestRef,acquisitionRef:phase.range.acquisitionRef,bodyHash:phase.range.bodyHash}:phase.understanding;
       if(!slot||!binding)invalid();
       const check=()=>{
        phase.guard();
        if(signal.aborted||this.#owner.aborted||this.#unknown||this.#clock()>=wall||performance.now()>=mono||byRef(this.external(this.#slot))!==scope)invalid();
       };
       check();
       phase.closed={transmit:(body,exact,requestSignal)=>{
        if(requestSignal.aborted||byRef(exact)!==byRef(binding))invalid();
        return this.#transmitUnderstanding(slot,proof,binding,body,AbortSignal.any([signal,requestSignal]),check,wall,mono);
       }};
      }
     }
    }catch{success=false;}
   }
   if(s)s.dead=true;this.#session=undefined;this.#opening=false;
   if(!success&&openingStarted){this.#unknown=true;invalid();}
  }
 }
 async #transaction<T>(writer:Writer,channel:string,signal:AbortSignal,run:(path:string,io:IO)=>Promise<T>):Promise<T>{
  return this.#root(writer,signal,async t=>{
   const s=t.session,auth={...this.#auth(s),allocation:s.allocation,channel};
   const hold=await this.#frame(s,'NORMAL_SPOOL_RESERVE',{...auth,nodeStamp:s.stamp});
   if(recordV1(hold,['state'])&&hold.state==='CAPACITY_EXCEEDED')throw capacity;
   if(!recordV1(hold,['reservation','before'])||!uuidV1(hold.reservation)||!summary(hold.before))invalid();
   let pending=0,sealed=false;
   const check=()=>{this.#check(s);if(!t.live||sealed||this.#als.getStore()!==t)invalid();};
   const io=guardFiles(this.#io,check,()=>{pending++;},()=>{pending--;},s.path,s.stamp);
   if(writer==='UNVERIFIED_RECEIPT_INBOX')profileReceipts.set(io,s.path);
   let completed=false;
   try{
    const result=await run(s.path,io);check();sealed=true;
    if(pending||t.child||s.borrowed)invalid();
    const settled=await this.#frame(s,'NORMAL_SPOOL_SETTLE',{...auth,reservation:hold.reservation});
    if(!recordV1(settled,['state','summary'])||settled.state!=='SETTLED'||!summary(settled.summary))invalid();completed=true;return result;
   }finally{sealed=true;profileReceipts.delete(io);if(!completed)s.dead=true;}
  });
 }
 journal(scope:NormalLocalScope,signal:AbortSignal){
  const verify=()=>{
   const slot=this.external(this.#slot);
   if(!slot||slot.scope.projectId!==scope.projectId||slot.scope.executionId!==scope.executionId||slot.scope.executionGeneration!==scope.executionGeneration)
    invalid('NORMAL_SPOOL_SCOPE_INVALID');
  };
  let activeRead:{ticket:Ticket;channel:string;used:boolean}|undefined;
  const access:ProfileJournalAccess={transaction:(channel,run)=>{
   verify();
   return this.#transaction('NORMAL_EXECUTION',channel,signal,async(path,io)=>{
    if(!channel.startsWith('attempt-'))return run(path,io);
    const ticket=this.#als.getStore();
    if(activeRead||!ticket||!ticket.live||ticket.session.signal!==signal)invalid();
    const original={ticket,channel,used:false};activeRead=original;
    try{return await run(path,io);}finally{if(activeRead===original)activeRead=undefined;}
   });
  }};
  Object.freeze(access);profileJournals.add(access);
  const journal=new NormalStartFileStore(access,scope),source=journal.intake();
  const reader:NormalStartStore={transport:'NORMAL_PROTECTED',exclusive:async(key,read)=>{
   const claim=activeRead;
   if(!claim||claim.used||this.#als.getStore()||!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||
      key.projectId!==scope.projectId||key.executionId!==scope.executionId||key.executionGeneration!==scope.executionGeneration||
      !uuidV1(key.commandId)||claim.channel!=='attempt-'+key.commandId)invalid();
   // Consume before current/clock or any async work. Only the private forWorker intake has this reader.
   claim.used=true;
   const t=claim.ticket,s=t.session;
   const current=()=>{
    if(activeRead!==claim||!t.live||s!==this.#session||s.writer!=='NORMAL_EXECUTION'||s.signal!==signal||signal.aborted||s.borrowed)invalid();
    this.#check(s);
   };
   current();if(t.child)invalid();
   const result=await this.#als.run(t,()=>source.exclusive(key,async tx=>{
    const out=await read({
     read:async()=>{current();const v=await tx.read();current();return v;},
     readPart:async ref=>{current();const bytes=await tx.readPart(ref);current();return bytes;},
     appendAndSync:async()=>invalid()
    });
    current();return out;
   }));
   current();if(t.child)invalid();return result;
  }};
  this.#workerReads.set(journal,Object.freeze(reader));return journal;
 }
 workerWire(journal:NormalStartFileStore,expected:ConstructorParameters<typeof NormalStartIntake>[1],current:NormalStartCurrent,
  grantRef:RuntimeRefV1,clock:()=>number,timeoutMs:number){
  const reader=this.#workerReads.get(journal);if(!reader)invalid('NORMAL_SPOOL_SCOPE_INVALID');
  this.#workerReads.delete(journal);
  const intake=new NormalStartIntake(reader,expected,clock);
  const worker=NormalClaudeStartWire.forWorker({intake,current,grantRef,clock,timeoutMs});
  const {projectId,executionId,executionGeneration}=expected.context;
  this.#workers.set(worker,{journal,scope:{projectId,executionId,executionGeneration},registration:cloneV1(expected.executorRegistrationRef),grant:cloneV1(grantRef)});
  return worker;
 }
 #outputPorts(local:NormalLocalScope,origin:()=>{scope:ReturnType<typeof takeFirstOutputOrigin>['scope'];signal:AbortSignal;end:number;profile:string;allocation:string},classify:OutputPorts['classify']){
  type Request=Parameters<OutputPorts['reserve']>[0];
  type Closed={holdId:string;tailRef:RuntimeRefV1|null;rows:number};
  const make=(req:Request)=>({req,ready:gate<Hold>(),pre:gate<OutputTx>(),post:gate<number>(),written:gate<Closed>(),
   held:undefined as Hold|undefined,seal:undefined as Handoff|undefined,stage:'RESERVING',read:undefined as Promise<Closed>|undefined,
   write:undefined as Promise<{holdId:string;dataBytes:number;managementBytes:number}>|undefined});
  let ongoing:ReturnType<typeof make>|undefined,unknown=false;
  function check(){if(unknown)return invalid();return origin();}
  function sameHold(hold:Hold){
   check();const op=ongoing;if(!op?.held||isProxy(hold)||byRef(hold)!==byRef(op.held))return invalid();return op;
  }
  const inspect=async(t:Ticket,body:OutputTx,readOnly:boolean):Promise<{tailRef:RuntimeRefV1|null;tail:string|null;rows:number;bytes:number}>=>{
   const s=t.session;let active=true,pending=0,open=false;
   const guard=()=>{const b=check();this.#check(s);if(!active||!t.live||s.profile!==b.profile||s.allocation!==b.allocation)invalid();};
   const io=guardFiles(this.#io,guard,()=>{pending++;},()=>{pending--;},s.path,s.stamp);
   const access:ProfileJournalAccess={transaction:async(channel,run)=>{
    guard();if(open||channel!=='sdk-session-output')invalid();open=true;return run(s.path,io);
   }};
   profileJournals.add(access);outputJournals.add(access);
   try{
    const store=new NormalStartFileStore(access,local);
    const end=await store.outputExclusive(async tx=>{
     guard();
     let verified:string[]|undefined;
     const result={read:async()=>{guard();const v=await tx.read();guard();verified=v.map(row=>contentHash(byRef(row)));return v;},
      appendAndSync:async(value:unknown)=>{guard();if(readOnly)invalid();await tx.appendAndSync(value);guard();}};
     await this.external(()=>body(Object.freeze(result)));guard();
     const rows=await tx.read();guard();if(!verified||verified.length!==rows.length)invalid();
     const scope=byRef(check().scope);let bytes=0,tailRef:RuntimeRefV1|null=null,index=0,tail:string|null=null;
     for(const row of rows){
      if(!recordV1(row,['ref','snapshot'])||!refV1(row.ref)||row.ref.contentHash!==contentHash(byRef(row.snapshot))||
       byRef(row.snapshot.scope)!==scope)invalid();
      const encoded=byRef(row);if(contentHash(encoded)!==verified![index++])invalid();
      bytes+=Buffer.byteLength(encoded)+1;tailRef=cloneV1(row.ref);tail=contentHash(encoded+'\n');
     }
     return {tailRef,tail,rows:rows.length,bytes};
    });
    guard();if(!open||pending||t.child||s.borrowed)invalid();return end;
   }finally{active=false;outputJournals.delete(access);profileJournals.delete(access);}
  };
  let reading=false,readFinished=Promise.resolve();
  const storage:OutputPorts=Object.freeze({classify,
   reserve:async(request:Request)=>{
    if(reading)await readFinished;
    const b=check(),sd=contentHash(byRef(b.scope));if(ongoing||this.#als.getStore()||request.scopeDigest!==sd||request.channel!=='SDK_SESSION_OUTPUT'||request.pool!=='NORMAL_EXECUTION')invalid();
    const op=make(cloneV1(request));ongoing=op;
    const phase:PhaseControls={guard:()=>{check();}};
    op.read=this.#root('NORMAL_EXECUTION',b.signal,async t=>{
     const s=t.session;if(s.profile!==b.profile||s.allocation!==b.allocation)invalid();
     const result=await this.#frame(s,'NORMAL_SPOOL_RESERVE',{...this.#auth(s),allocation:s.allocation,channel:'sdk-session-output',nodeStamp:s.stamp,
      request:op.req,scope:b.scope,expiresAt:new Date(Math.min(check().end,Date.parse(s.slot!.expiresAt))).toISOString()});
     if(recordV1(result,['state'])&&result.state==='CAPACITY_EXCEEDED')throw capacity;
     if(!recordV1(result,['id','requestDigest','normalUsed','normalHeldBefore','channelRows','channelBytes','channelHeldBytes','channelHeldRows','managementBytes'])||
        !uuidV1(result.id)||result.requestDigest!==contentHash(byRef(request)))invalid();
     const h=cloneV1(result) as Hold;op.held=h;op.stage='PRE';op.ready.resolve(cloneV1(h));
     const read=await op.pre.promise;check();
     const end=await inspect(t,read,true);
     if(end.bytes!==h.channelBytes||end.rows!==h.channelRows||byRef(end.tailRef)!==byRef(op.req.tailRef))invalid();
     phase.closeReservation=h.id;return {holdId:h.id,tailRef:end.tailRef,rows:end.rows};
    },phase).then(result=>{
     if(!phase.challenge||!op.held) return invalid();check();
     op.seal={reservation:op.held.id,challenge:phase.challenge,scopeDigest:sd,requestDigest:op.held.requestDigest};
     op.stage='WRITE';return result;
    }).catch(error=>{unknown=true;op.ready.reject(error);op.pre.reject(error);throw error;});
    void op.read.catch(()=>{});return op.ready.promise;
   },
   strictExclusive:async(hold:Hold,body:OutputTx)=>{
    const op=sameHold(hold);
    if(typeof body!=='function'||isProxy(body))return invalid();
    if(op.stage==='PRE'&&op.read){op.stage='READING';op.pre.resolve(body);return op.read;}
    if(op.stage!=='WRITE'||!op.seal)return invalid();op.stage='WRITING';
    const b=check(),resume=op.seal;op.seal=undefined;
    op.write=this.#root('NORMAL_EXECUTION',b.signal,async t=>{
     const s=t.session;if(s.profile!==b.profile||s.allocation!==b.allocation)invalid();
     const end=await inspect(t,body,false);check();
     op.stage='SETTLE';op.written.resolve({holdId:hold.id,tailRef:end.tailRef,rows:end.rows});
     const added=await op.post.promise;check();if(added!==end.bytes-hold.channelBytes||added<0||added>op.req.dataBytes||
       end.rows<hold.channelRows||end.rows-hold.channelRows>op.req.rows)invalid();
     const answer=await this.#frame(s,'NORMAL_SPOOL_SETTLE',{...this.#auth(s),allocation:s.allocation,channel:'sdk-session-output',reservation:hold.id});
     if(!recordV1(answer,['state','summary'])||answer.state!=='SETTLED'||!summary(answer.summary)||answer.summary.bytes!==end.bytes||answer.summary.count!==end.rows||answer.summary.tail!==end.tail)invalid();
     return {holdId:hold.id,dataBytes:added,managementBytes:hold.managementBytes};
    },{guard:()=>{check();},resume}).catch(error=>{unknown=true;op.post.reject(error);op.written.reject(error);throw error;});
    void op.write.catch(()=>{});return op.written.promise;
   },
   settle:async(hold:Hold,dataBytes:number)=>{
    const op=sameHold(hold);if(op.stage!=='SETTLE'||!op.write)return invalid();op.stage='SETTLING';op.post.resolve(dataBytes);
    const closed=await op.write;check();ongoing=undefined;return closed;
   }
  });
  return {storage,read:async(body:OutputTx,guard:Guard,deadline?:number)=>{
   const b=check();guard();if(reading||ongoing||this.#als.getStore())invalid();reading=true;const completed=gate<void>();readFinished=completed.promise;
   try{await this.#root('NORMAL_EXECUTION',b.signal,async t=>{guard();await inspect(t,body,true);guard();},{readOnly:true,resultDeadline:deadline,guard:()=>{check();guard();}});guard();}
   catch(error){unknown=true;throw error;}finally{reading=false;completed.resolve();}
  }};
 }
 outputSource(worker:NormalStartWire,journal:NormalStartFileStore,sdk:WorkerSdkPorts,signal:AbortSignal):{source:NormalFirstSendSource;port:LiveInputPort;readUnderstandingRange(acquired:NormalUnderstandingRangeAcquisition,client:NormalProtectedGetClient,owned:NormalOwnedCredentialPort,readSignal:AbortSignal,current:Guard):Promise<NormalUnderstandingRangeReadResult>;transmitUnderstandingRange(acquired:NormalUnderstandingRangeAcquisition,client:NormalProtectedGetClient,owned:NormalOwnedCredentialPort,readSignal:AbortSignal,current:Guard):Promise<Awaited<ReturnType<typeof transmitNormalUnderstandingRangeResult>>>;checkUnderstandingRangeAcquisition(context?:NormalUnderstandingRangeAcquisition['context']):void;readUnderstanding(ticket:NormalUnderstandingReadTicket,client:NormalProtectedGetClient,owned:NormalOwnedCredentialPort):Promise<NormalUnderstandingResponseProjection>;readUnderstandingDiscovery(ticket:NormalUnderstandingDiscoveryTicket,client:NormalProtectedGetClient,owned:NormalOwnedCredentialPort,post:NormalProtectedPostClient,readSignal:AbortSignal,current:Guard):Promise<DiscoveryReadResult>}{
  const saved=this.#workers.get(worker),slot=this.external(this.#slot);
  if(this.#binding||!saved||saved.journal!==journal||!slot||!refV1(slot.receiptRef)||this.#owner.aborted||signal.aborted||
   isProxy(sdk)||!recordV1(sdk,['expiresAt','check','create','close','classify'])||
   [sdk.check,sdk.create,sdk.close,sdk.classify].some(fn=>typeof fn!=='function'||isProxy(fn)))return invalid();
  const fixed={...sdk},slotKey=byRef(slot),lifetime=AbortSignal.any([signal,this.#owner]);
  let binding:{profile:RuntimeRefV1;allocation:RuntimeRefV1}|undefined,origin:ReturnType<typeof takeFirstOutputOrigin>|undefined;
  const verify=()=>{
   if(lifetime.aborted||isProxy(sdk)||!recordV1(sdk,['expiresAt','check','create','close','classify'])||byRef(this.external(this.#slot))!==slotKey||sdk.check!==fixed.check||sdk.create!==fixed.create||
      sdk.close!==fixed.close||sdk.classify!==fixed.classify||sdk.expiresAt!==fixed.expiresAt)invalid();
  };
  const output=this.#outputPorts(saved.scope,()=>{
   verify();if(!origin||!binding||origin.signal.aborted)return invalid();
   const end=this.external(origin.check);
   return {scope:origin.scope,signal:origin.signal,end,profile:binding.profile.id,allocation:binding.allocation.id};
  },raw=>this.external(()=>Reflect.apply(fixed.classify,sdk,[raw])));
  const storage=output.storage;
  // These two fields are populated only by the verified native allocation, before the first protected START completes.
  let inputStream:ReturnType<typeof workerInput>|undefined,query:AsyncIterable<unknown>|undefined;
  const core={storage,plannedSid:null,expiresAt:sdk.expiresAt,ownerSignal:lifetime,slotRef:cloneV1(slot.receiptRef),
   clock:()=>{verify();return this.#clock();},
   check:(scope:Parameters<NormalFirstSendSource['check']>[0])=>{verify();return this.external(()=>Reflect.apply(fixed.check,sdk,[scope]));},
   create:async(...args:Parameters<NormalFirstSendSource['create']>)=>{
    verify();if(inputStream)invalid();
    const [request,first,life]=args;
    const handoff=takeNormalFirstPermitHandoff(request,source);
    if(handoff){
     try{await this.#prepareSdkFirst(handoff,life,verify);}
     finally{if(this.#sdkFirstOwner){this.#unknown=true;await this.#sdkFirstOwner.close();}}
     return invalid('SDK_CONFIGURATION_UNAVAILABLE');
    }
    const active=workerInput(first,life,()=>{verify();if(origin)this.external(origin.check);});inputStream=active;
    try{
     const result=this.external(()=>Reflect.apply(fixed.create,sdk,[request,active.stream,life]));
     if(isProxy(result)||!isPromise(result))invalid();
     return new Promise<AsyncIterable<unknown>>((accept,reject)=>Reflect.apply(Promise.prototype.then,result,[
      (original:AsyncIterable<unknown>)=>{query=original;accept(original);},(error:unknown)=>{active.close();reject(error);}
     ]));
    }catch(error){active.close();throw error;}
   },
   close:(...args:Parameters<NormalFirstSendSource['close']>)=>this.external(()=>Reflect.apply(fixed.close,sdk,args))};
  const source=core as NormalFirstSendSource;this.#foreground=signal;
  firstSidSources.set(source,{worker,spent:false,verify:basis=>{
   verify();const now=this.external(()=>this.#clock()),end=Math.min(fixed.expiresAt,Date.parse(slot.expiresAt));
   if(!binding||this.#unknown||!Number.isSafeInteger(now)||!Number.isSafeInteger(end)||now>=end||
    byRef(basis.registrationRef)!==byRef(saved.registration)||byRef(basis.grantRef)!==byRef(saved.grant)||
    byRef(basis.slotRef)!==byRef(slot.receiptRef)||byRef(basis.profileRef)!==byRef(binding.profile)||
    byRef(basis.assignmentRef)!==byRef(binding.allocation)||basis.projectId!==saved.scope.projectId||
    basis.executionId!==saved.scope.executionId||basis.generation!==saved.scope.executionGeneration)invalid();
  }});

  this.#binding={update:(profile,allocation)=>{
   verify();if(binding){if(byRef(profile)!==byRef(binding.profile)||byRef(allocation)!==byRef(binding.allocation))invalid();return;}
   binding={profile,allocation};source.profileRef=cloneV1(profile);source.assignmentRef=cloneV1(allocation);Object.freeze(source);
  }};
  outputBinders.set(storage,proof=>{
   outputBinders.delete(storage);
   verify();const original=takeFirstOutputOrigin(proof,storage,worker),s=original.scope;
   if(!binding||byRef(s.registrationRef)!==byRef(saved.registration)||byRef(s.grantRef)!==byRef(saved.grant)||byRef(s.slotRef)!==byRef(slot.receiptRef)||
    byRef(s.profileRef)!==byRef(binding.profile)||byRef(s.assignmentRef)!==byRef(binding.allocation)||s.projectId!==saved.scope.projectId||
    s.executionId!==saved.scope.executionId||s.generation!==saved.scope.executionGeneration)invalid();
   origin=original;
  });
  const port:LiveInputPort=Object.freeze({provide:(original,input,signal)=>{
   if(!inputStream||!query||original!==query||!origin||origin.signal.aborted)return Promise.reject(Error('NORMAL_WORKER_INPUT_UNAVAILABLE'));
   return inputStream.provide(input,signal,()=>confirmNormalLiveInputDelivery(input,worker,original,port));
  }});
  const withRead=async(body:Parameters<Parameters<typeof readNormalUnderstandingResponse>[1]['withRead']>[0],guard:()=>void,deadline?:number)=>{await output.read(async tx=>{
   guard();const rows=await tx.read();guard();let active=true;
   try{await body({rowCount:rows.length,read:async sequence=>{guard();if(!active||!Number.isSafeInteger(sequence)||sequence<1||sequence>rows.length)invalid();return cloneV1(rows[sequence-1]);}});guard();}
   finally{active=false;rows.length=0;}
  },guard,deadline);};
  const checkRange=(context?:NormalUnderstandingRangeAcquisition['context'])=>{
   verify();if(!origin||!binding||this.#unknown||origin.signal.aborted)invalid();
   this.external(origin.check);
   const s=origin.scope;
   if(byRef(s.slotRef)!==byRef(slot.receiptRef)||byRef(s.registrationRef)!==byRef(saved.registration)||byRef(s.grantRef)!==byRef(saved.grant)||
    byRef(s.profileRef)!==byRef(binding.profile)||byRef(s.assignmentRef)!==byRef(binding.allocation)||s.projectId!==saved.scope.projectId||s.executionId!==saved.scope.executionId||s.generation!==saved.scope.executionGeneration)invalid();
   if(context){
    // origin의 assignmentRef는 물리 allocation이다. 업무 fullref/준비/queue ref는 원 서버 grant·영수증 검산을 유지한다.
    if(context.projectId!==s.projectId||context.executionId!==s.executionId||context.executionGeneration!==s.generation||context.connectorId!==slot.scope.connectorId||
     context.credentialGeneration!==slot.scope.credentialGeneration||byRef(context.registrationRef)!==byRef(s.registrationRef)||byRef(context.grantRef)!==byRef(s.grantRef)||
     byRef(context.sessionBindingRef)!==byRef(s.sessionBindingRef)||context.startCommandId!==origin.start.startCommandId||
     context.assignmentRef.id!==origin.start.assignmentId||byRef(context.contextBundleRef)!==byRef(origin.start.contextBundleRef))invalid();
   }
   verify();this.external(origin.check);
  };
  const readRange=async(acquired:NormalUnderstandingRangeAcquisition,client:NormalProtectedGetClient,owned:NormalOwnedCredentialPort,readSignal:AbortSignal,current:Guard,prepareRange:boolean)=>{
   checkRange();if(!origin||byRef(owned.metadata)!==slotKey)invalid();
   const original=takeNormalUnderstandingRangeAcquisition(acquired,client,owned),v=original.value;
   const scopeSignal=AbortSignal.any([readSignal,origin.signal]);
   const guard=()=>{this.external(current);original.check();checkRange(v.context);if(scopeSignal.aborted)invalid();};
   guard();const expected={scope:cloneV1(origin.scope),requestRef:v.rangeRequestRef,acquisitionRef:v.acquisitionRef,contextBundleRef:v.context.contextBundleRef,selection:v.selection,checkedAt:v.observedAt,expiresAt:v.expiresAt};
   const projection=await readNormalUnderstandingRange(expected,{clock:()=>{guard();return this.#clock();},current:()=>{guard();return expected;},withRead:body=>withRead(body,guard,Date.parse(v.expiresAt))},scopeSignal);guard();
   const body=Buffer.from(canonicalJson(projection));let transferred=false;
   try{
    if(body.length>2*1024*1024)invalid();const bodyHash=contentHash(body);
    const phase:PhaseControls={readOnly:true,resultDeadline:Date.parse(v.expiresAt),...(prepareRange?{prepareRange:true as const}:{}),range:{requestRef:v.rangeRequestRef,acquisitionRef:v.acquisitionRef,selection:v.selection,bodyHash},guard};
    await this.#root('NORMAL_EXECUTION',scopeSignal,async()=>{guard();},phase);guard();
    const result=Object.freeze({kind:'RANGE_READ_VERIFIED',requestRef:Object.freeze(cloneV1(v.rangeRequestRef)),acquisitionRef:Object.freeze(cloneV1(v.acquisitionRef)),bodyHash,executionAuthorized:false,dispatchPerformed:false}) as NormalUnderstandingRangeReadResult;
    const delay=Math.max(1,Math.min(Date.parse(v.expiresAt),this.external(origin.check))-this.#clock());guard();
    let timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
    const dispose=()=>{if(disposed)return;disposed=true;if(timer!==undefined)clearTimeout(timer);scopeSignal.removeEventListener('abort',dispose);rangeReadResults.delete(result);body.fill(0);for(const part of projection.parts)part.text='';projection.parts.length=0;};
    try{
     rangeReadResults.set(result,{client,owned,projection,body,closed:phase.closed,check:()=>{if(disposed)invalid();guard();},dispose});
     scopeSignal.addEventListener('abort',dispose,{once:true});timer=setTimeout(dispose,delay);timer.unref();
     guard();if(disposed)invalid();transferred=true;return result;
    }catch(error){dispose();throw error;}
   }finally{if(!transferred){body.fill(0);for(const part of projection.parts)part.text='';projection.parts.length=0;}}
  };
  return {source,port,checkUnderstandingRangeAcquisition:checkRange,
   readUnderstandingRange:(a,c,o,s,g)=>readRange(a,c,o,s,g,false),
   transmitUnderstandingRange:async(a,c,o,s,g)=>{const result=await readRange(a,c,o,s,g,true);return transmitNormalUnderstandingRangeResult(result,c,o,s);},
   readUnderstandingDiscovery:async(ticket,client,owned,post,readSignal,current)=>{
   verify();if(!origin||!binding||this.#unknown||byRef(owned.metadata)!==slotKey)invalid();
   const original=takeNormalUnderstandingDiscovery(ticket,client,owned,origin.scope,origin.start);
   const scopeSignal=AbortSignal.any([readSignal,origin.signal]);
   const guard=()=>{this.external(current);verify();original.check();if(!origin||scopeSignal.aborted||this.#unknown)invalid();this.external(origin.check);};
   const phase:PhaseControls={readOnly:true,resultDeadline:Date.parse(original.binding.expiresAt),guard};
   let issued=false;
   try{
    guard();const metadata=await readNormalUnderstandingDiscovery(original.binding,{clock:()=>{guard();return this.#clock();},current:()=>{guard();return original.binding;},withRead:body=>withRead(body,guard)},scopeSignal);guard();
    // TS projection은 비교값일 뿐이다. 같은 native 원 GET pickup과 독립 파일 읽기/close가
    // 동일 body를 확인하고 원 host까지 정상 닫힌 뒤에만 local seal을 발급한다.
    const body=Buffer.from(canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata}));
    try{
     if(body.length>2*1024*1024)invalid();
     phase.understanding={requestRef:cloneV1(metadata.requestRef),acquisitionRef:cloneV1(metadata.acquisitionRef),bodyHash:contentHash(body)};
     await this.#root('NORMAL_EXECUTION',scopeSignal,async()=>{guard();},phase);guard();
    }finally{body.fill(0);}
    const seal=Object.freeze({}) as NormalUnderstandingResultSeal;
    discoveryResults.set(seal,{client,owned,post,metadata,closed:phase.closed,check:guard,finish:original.finish});issued=true;
    return {metadata,seal};
   }finally{if(!issued)original.finish();}
  },readUnderstanding:async(ticket,client,owned)=>{
   verify();if(!origin||!binding||this.#unknown||byRef(owned.metadata)!==slotKey)invalid();
   const original=takeNormalUnderstandingRead(ticket,client,owned,this.#attempt,origin.scope);
   const guard=()=>{verify();original.check();if(!origin||origin.signal.aborted||this.#unknown)invalid();this.external(origin.check);};
   try{guard();return await readNormalUnderstandingResponse(original.selection.request,{clock:()=>{guard();return this.#clock();},current:()=>{guard();return original.selection.binding;},
    withRead:body=>withRead(body,guard)
   },origin.signal);}finally{original.finish();}
  }};
 }
 // 원 FIRST의 core만 이 읽기 수송을 호출한다. 응답을 실행 lease로 승격하지 않는다.
 #sdkFirstOwner:NormalOwnedSdkSupervisor|undefined;
 async #prepareSdkFirst(handoff:NonNullable<ReturnType<typeof takeNormalFirstPermitHandoff>>,life:AbortSignal,verify:Guard){
  const slot=this.external(this.#slot);if(!slot||this.#sdkFirstOwner)invalid();const key=byRef(slot);
  try{this.#sdkFirstOwner=await prepareNormalSdkChildHandoff(handoff,{attemptId:this.#attempt,slot,host:this.credentialHost(),now:()=>this.#clock(),signal:AbortSignal.any([life,this.#owner]),check:()=>{verify();if(this.#unknown||byRef(this.external(this.#slot))!==key)invalid();}});}
  catch(error){this.#unknown=true;throw error;}
 }
 async #inspectFirst(handoff:NonNullable<ReturnType<typeof takeNormalFirstPermitHandoff>>,life:AbortSignal,verify:Guard){
  const slot=this.external(this.#slot);if(!slot)invalid();const key=byRef(slot);
  try{await inspectNormalFirstPermitHandoff(handoff,{attemptId:this.#attempt,slot,host:this.credentialHost(),now:()=>this.#clock(),signal:AbortSignal.any([life,this.#owner]),
   check:()=>{verify();if(this.#unknown||byRef(this.external(this.#slot))!==key)invalid();}});}
  catch(error){this.#unknown=true;throw error;}
 }

 receive(limits:InboxLimits,input:unknown,expected:Parameters<typeof receiveProfiledEnvelope>[3],signal:AbortSignal){
  return this.#transaction('UNVERIFIED_RECEIPT_INBOX','inbox',signal,async(path,io)=>{
   const receipt=await receiveProfiledEnvelope(path,limits,input,expected,this.#clock(),io);
   if(receipt.state==='UNKNOWN')invalid();return receipt;
  });
 }
}

// Track actual pending Node I/O. After loss, closing a previously obtained handle is the only new operation allowed.
function guardFiles(raw:IO,check:Guard,begin:Guard,end:Guard,root:string,stamp:string):IO{
 const keys=['lstat','realpath','open','readdir','opendir','unlink'] as const;
 const captured=keys.map(k=>raw[k]);
 const method=<K extends typeof keys[number]>(k:K):IO[K]=>{
  check();const fn=raw[k];if(typeof fn!=='function'||isProxy(fn)||fn!==captured[keys.indexOf(k)])invalid();return fn;
 };
 const guarded=async<T>(fn:()=>Promise<T>,late?:(v:T)=>Promise<void>)=>{
  check();begin();try{const v=await fn();try{check();}catch(e){if(late)await late(v);throw e;}return v;}finally{end();}
 };
 const wrap=<T extends object>(handle:T,methods:readonly string[])=>{
  const exposed:Record<string|symbol,unknown>={};
  for(const key of methods){
   const method:unknown=Reflect.get(handle,key);
   if(method===undefined)continue;
   if(typeof method!=='function'||isProxy(method))invalid();
   exposed[key]=key==='close'?async()=>{begin();try{return await Reflect.apply(method,handle,[]);}finally{end();}}:
    (...args:unknown[])=>guarded(async()=>Reflect.apply(method,handle,args));
  }
  return exposed;
 };
 const sync=raw.unlinkSync;
 const io={
  lstat:(...a:Parameters<IO['lstat']>)=>guarded(async()=>{
   const st=await Reflect.apply(method('lstat'),raw,a);
   if(a[0]===root&&!st.isSymbolicLink()&&String(st.dev)+':'+String(st.ino)!==stamp)invalid();return st;
  }),
  readdir:(...a:Parameters<IO['readdir']>)=>guarded(()=>Reflect.apply(method('readdir'),raw,a)),
  realpath:(...a:Parameters<IO['realpath']>)=>guarded(()=>Reflect.apply(method('realpath'),raw,a)),
  unlink:(...a:Parameters<IO['unlink']>)=>guarded(()=>Reflect.apply(method('unlink'),raw,a)),
  open:async(...a:Parameters<IO['open']>)=>{
   const f=await guarded(()=>Reflect.apply(method('open'),raw,a),v=>v.close());return wrap(f,['stat','read','writeFile','sync','close']);
  },
  opendir:async(...a:Parameters<IO['opendir']>)=>{
   const d=await guarded(()=>Reflect.apply(method('opendir'),raw,a),v=>v.close()),view=wrap(d,['close']);
   view[Symbol.asyncIterator]=()=>{check();const it=d[Symbol.asyncIterator]();return {next:()=>guarded(()=>it.next())};};return view;
  },
  ...(typeof sync==='function'&&!isProxy(sync)?{unlinkSync:(path:string)=>{check();if(raw.unlinkSync!==sync)invalid();return Reflect.apply(sync,raw,[path]);}}:{}),
 };
 // FileHandle/Dir expose more methods in Node's types; these private views implement only the operations of the two stores.
 return io as unknown as IO;
}

// 전용 인계 수송. 전달 객체는 native 원 행 검산 이전에는 실행 권위가 아니다.
/** 원 FIRST source의 준비와 같은 helper 인계를 실제 host session에서만 소비한다. */
export async function prepareNormalSdkChildHandoff(handoff:NonNullable<ReturnType<typeof takeNormalFirstPermitHandoff>>,ports:{attemptId:string;slot:NormalOwnedMetadata;host:NormalOwnedHostFactory;now():number;signal:AbortSignal;check():void}):Promise<NormalOwnedSdkSupervisor>{
 const {slot,host:factory,signal}=ports,open=factory.open,began=ports.now(),mono=performance.now(),slotKey=byRef(slot);
 handoff=boundedSdkObject(handoff,maxSdkObjectBytes).value as typeof handoff;
 if(!recordV1(handoff,['startEnvelope','sendEnvelope','grantRef','startReadyRef','localAttemptRef','dispatchAttemptRef','permit','proofResultRef','scope','executionAuthority','plannedSid'])||!sdkOpaqueId(handoff.plannedSid)||!handoff.scope||contentHash(canonicalJson(handoff.plannedSid))!==handoff.scope.plannedSidDigest||byRef(slot.receiptRef)!==byRef(handoff.scope.slotRef))invalid();
 const end=Math.min(began+10000,Date.parse(slot.expiresAt),Date.parse(handoff.permit.expiresAt)),monoEnd=mono+end-began;
 if(!Number.isSafeInteger(began)||!Number.isFinite(end)||end<=began)invalid();
 const local=new AbortController(),life=AbortSignal.any([signal,local.signal]);let host:NormalOwnedHostSession|undefined,prepared:Awaited<ReturnType<NonNullable<NormalOwnedHostSession['prepareSdkChildSource']>>>|undefined,closed=false,finished=false;
 const raw={attemptId:ports.attemptId,slotId:slot.slotId,startCommandId:handoff.startEnvelope.commandId,sendCommandId:handoff.sendEnvelope.commandId,scope:handoff.scope,handoff},bytes=Buffer.from(canonicalJson(raw)),sourceHash=contentHash(bytes);
 const check=()=>{ports.check();if(life.aborted||factory.open!==open||byRef(ports.slot)!==slotKey||ports.now()<began||ports.now()>=end||performance.now()>=monoEnd)invalid('SDK_CONFIGURATION_UNAVAILABLE');};
 let reject!:(error:Error)=>void;const cancelled=new Promise<never>((_,fail)=>{reject=fail;});void cancelled.catch(()=>{});const abort=()=>reject(Error('NORMAL_SPOOL_UNKNOWN'));
 const timer=setTimeout(()=>local.abort(),Math.max(1,end-began));life.addEventListener('abort',abort,{once:true});
 try{
  check();if(bytes.length<1||bytes.length>2097152)invalid();
  const opening=Reflect.apply(open,factory,[life,slot]);void opening.then(late=>{if(finished)void late.close('OPERATION_UNKNOWN').catch(()=>{});},()=>{});
  host=await Promise.race([opening,cancelled]);check();const prepare=host.prepareSdkChildSource;
  if(typeof prepare!=='function'||isProxy(prepare))invalid('SDK_CONFIGURATION_UNAVAILABLE');
  const pending=Reflect.apply(prepare,host,[cloneV1(raw)]);void pending.then(late=>{if(finished)void late.discard().catch(()=>{});},()=>{});
  prepared=await Promise.race([pending,cancelled]);check();const acknowledge=prepared.acknowledge,afterClose=prepared.afterClose,discard=prepared.discard;
  if([acknowledge,afterClose,discard].some(fn=>typeof fn!=='function'||isProxy(fn)))invalid();
  await Promise.race([Reflect.apply(acknowledge,prepared,[]),cancelled]);check();
  const close=host.close,result=await Promise.race([Reflect.apply(close,host,['HOST_REQUEST_VALIDATED']),cancelled]);
  if(result.state!=='CLOSED_CONFIRMED')invalid();closed=true;check();
  const receiving=Reflect.apply(afterClose,prepared,[]);void receiving.then((late:NormalOwnedSdkSupervisor)=>{if(finished)void late.close().catch(()=>{});},()=>{});
  const owner=await Promise.race([receiving,cancelled]);check();const read=owner.read,closeOwner=owner.close;
  if([read,closeOwner].some(fn=>typeof fn!=='function'||isProxy(fn)))invalid();
  const value=Reflect.apply(read,owner,[]);
  if(!recordV1(value,['leaseId','endpointId','sourceHash','bindingHash','expiresAt','childCreated','executionAuthorized','dispatchPerformed'])||!uuidV1(value.leaseId)||!uuidV1(value.endpointId)||value.sourceHash!==sourceHash||!hashV1(value.bindingHash)||typeof value.expiresAt!=='string'||Date.parse(value.expiresAt)<=ports.now()||Date.parse(value.expiresAt)>end||value.childCreated!==false||value.executionAuthorized!==false||value.dispatchPerformed!==false)invalid();
  prepared=undefined;return owner;
 }finally{
  finished=true;bytes.fill(0);clearTimeout(timer);life.removeEventListener('abort',abort);
  const cleanup=async(call:()=>Promise<unknown>)=>{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([call(),new Promise(resolve=>{timer=setTimeout(resolve,Math.max(0,Math.min(end-ports.now(),monoEnd-performance.now())));})]);}catch{}finally{if(timer!==undefined)clearTimeout(timer);}};
  if(prepared)await cleanup(()=>prepared!.discard());
  if(host&&!closed)await cleanup(()=>host!.close('OPERATION_UNKNOWN'));
  local.abort();
 }
}

export async function inspectNormalFirstPermitHandoff(handoff:NonNullable<ReturnType<typeof takeNormalFirstPermitHandoff>>,ports:{attemptId:string;slot:NormalOwnedMetadata;host:NormalOwnedHostFactory;now():number;signal:AbortSignal;check():void}){
  const {slot,host:factory,signal,check:verify}=ports;const open=factory.open,begin=ports.now(),beganMono=performance.now();let unknown=false;
  // 원 FIRST 자료의 독립 사본만 수송한다. 원 SDK 입력/원장 형상은 확장하지 않는다.
  try{handoff=boundedSdkObject(handoff,maxSdkObjectBytes).value as typeof handoff;}catch{invalid();}
  if(!recordV1(handoff,['startEnvelope','sendEnvelope','grantRef','startReadyRef','localAttemptRef','dispatchAttemptRef','permit','proofResultRef','scope','executionAuthority','plannedSid'])||
   !sdkOpaqueId(handoff.plannedSid)||!handoff.scope||contentHash(canonicalJson(handoff.plannedSid))!==handoff.scope.plannedSidDigest)invalid();
  if(!slot||byRef(slot.receiptRef)!==byRef(handoff.scope.slotRef))invalid();
  const slotKey=byRef(slot);let end=Math.min(begin+10000,Date.parse(slot.expiresAt),Date.parse(handoff.permit.expiresAt));
  if(!Number.isSafeInteger(begin)||!Number.isFinite(end)||end<=begin)invalid();
  let mono=beganMono+end-begin;const local=new AbortController(),originalSignal=signal,combined=AbortSignal.any([originalSignal,local.signal]);
  const bytes=Buffer.from(canonicalJson({attemptId:ports.attemptId,slotId:slot.slotId,startCommandId:handoff.startEnvelope.commandId,
   sendCommandId:handoff.sendEnvelope.commandId,scope:handoff.scope,handoff}));
  let host:NormalOwnedHostSession|undefined,closing:Promise<{state:string}>|undefined,finished=false,sent=false,validated=false;
  const close=()=>closing??=host!.close(validated?'HOST_REQUEST_VALIDATED':'OPERATION_UNKNOWN');
  const check=()=>{verify();if(combined.aborted||unknown||ports.now()<begin||ports.now()>=end||performance.now()>=mono||
   factory.open!==open||byRef(ports.slot)!==slotKey)invalid();};
  let reject!:(e:Error)=>void;const cancelled=new Promise<never>((_,r)=>{reject=r;});void cancelled.catch(()=>{});
  const abort=()=>reject(Error('NORMAL_SPOOL_UNKNOWN'));combined.addEventListener('abort',abort,{once:true});
  let timer=setTimeout(()=>local.abort(),Math.max(1,end-ports.now()));
  try{
   check();if(bytes.length<1||bytes.length>2097152)invalid();
   const opening=Reflect.apply(open,factory,[combined,slot]);
   void opening.then(late=>{if(finished){host=late;unknown=true;void close().catch(()=>{});}},()=>{});
   host=await Promise.race([opening,cancelled]);check();const send=host.send,budget=host.inspectionBudget,transferId=randomUUID(),hash=contentHash(bytes);
   if(typeof budget!=='function'||isProxy(budget))invalid();const left=Reflect.apply(budget,host,[]);
   if(isProxy(left)||!recordV1(left,['frames','remainingMs'])||!Number.isSafeInteger(left.frames)||left.frames<Math.ceil(bytes.length/32768)||left.frames>64||
    !Number.isSafeInteger(left.remainingMs)||left.remainingMs<1||left.remainingMs>10000)invalid();
   end=Math.min(end,ports.now()+left.remainingMs);mono=Math.min(mono,performance.now()+left.remainingMs);check();
   clearTimeout(timer);timer=setTimeout(()=>local.abort(),Math.max(1,Math.min(end-ports.now(),mono-performance.now())));
   for(let offset=0,index=0;offset<bytes.length;offset+=32768,index++){
    check();if(index>=64||host.send!==send||host.inspectionBudget!==budget)invalid();const part=bytes.subarray(offset,offset+32768),final=offset+part.length===bytes.length;
    sent=true;const result=await Promise.race([Reflect.apply(send,host,[ 'NORMAL_SDK_FIRST_INSPECT',
     {attemptId:ports.attemptId,slotId:slot.slotId,transferId,totalBytes:bytes.length,contentHash:hash,index,data:part.toString('base64'),final}]),cancelled]);check();
    if(final){if(isProxy(result)||!recordV1(result,['state'])||result.state!=='SDK_CONFIGURATION_UNAVAILABLE')invalid();validated=true;}
    else if(isProxy(result)||!recordV1(result,['state','transferId','index'])||result.state!=='PART_ACCEPTED'||result.transferId!==transferId||result.index!==index)invalid();
   }
  }catch(error){if(sent)unknown=true;throw error;}
  finally{
   finished=true;bytes.fill(0);clearTimeout(timer);combined.removeEventListener('abort',abort);
   if(host){let closeTimer:ReturnType<typeof setTimeout>|undefined;try{
    const remaining=Math.max(0,Math.min(end-ports.now(),mono-performance.now()));
    const result=await Promise.race([close(),new Promise<{state:string}>(r=>{closeTimer=setTimeout(()=>r({state:'UNKNOWN'}),remaining);})]);
    if(result.state!=='CLOSED_CONFIRMED')unknown=true;
   }catch{unknown=true;}finally{if(closeTimer!==undefined)clearTimeout(closeTimer);}}
   local.abort();if(unknown)invalid();
  }
 }
