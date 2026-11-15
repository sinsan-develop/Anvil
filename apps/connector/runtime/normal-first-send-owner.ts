import {isPromise,isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkOpaqueId,supportedSdkUser} from '../adapters/secondary/schemas.ts';
import {copyNormalWorkerStart} from '../adapters/secondary/normal-start-wire.ts';
import {takeNormalFirstStart,type NormalStartWire} from './normal-start-coordinator.ts';
import type {NormalDispatchClaim,NormalInstructionDriverInput} from './normal-instruction-coordinator.ts';
import {NormalSdkSessionOutput} from './normal-sdk-session-output.ts';

type OutputOptions=ConstructorParameters<typeof NormalSdkSessionOutput>[0];
type Scope=OutputOptions['scope'];
type Query=AsyncIterable<unknown>;
type Parent=ReturnType<typeof takeNormalFirstStart>;
export type FirstSendSummary={startReadyRef:Ref;inputEvidence:{dispatchAttemptRef:Ref;instructionRef:Ref;partsRef:Ref;instructionDigest:string;messageDigest:string};initConfirmationRef:Ref};
export type FirstSendCompletion={summary:FirstSendSummary;commit():void;abandon():void};
/** 명시 source 의존성. 이 포트에 SDK 서명·등록 권한·보호 배정의 기본 구현은 없다. */
export interface NormalFirstSendSource{
 profileRef:Ref;assignmentRef:Ref;slotRef:Ref;plannedSid:string;expiresAt:number;ownerSignal:AbortSignal;clock():number;
 check(scope:Scope):{scopeDigest:string;expiresAt:number}|null;
 storage:Pick<OutputOptions['ports'],'classify'|'reserve'|'strictExclusive'|'settle'>;
 create(request:{start:Parent['start'];send:NormalInstructionDriverInput;scope:Scope;plannedSid:string},prompt:AsyncIterable<unknown>,lifetime:AbortSignal):Promise<Query>;
 close(query:Query):Promise<void>;
}
type Lease={raw?:unknown;query?:Query;iterate?:Query[typeof Symbol.asyncIterator];iterator?:AsyncIterator<unknown>;output?:NormalSdkSessionOutput;state:'PENDING'|'LIVE'|'UNKNOWN';life:AbortController;closeStarted:boolean};
const issuedHandles=new WeakSet<object>();
const leases=new WeakMap<NormalStartWire,Lease>();
const normalizeNext=NormalSdkSessionOutput.prototype.next,consumeInit=NormalSdkSessionOutput.prototype.consumeInit;
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const fail=():never=>{throw Error('NORMAL_FIRST_SEND_UNKNOWN');};
const shape=(v:unknown,keys:string[])=>!isProxy(v)&&recordV1(v,keys);
const sourceKeys=['profileRef','assignmentRef','slotRef','plannedSid','expiresAt','ownerSignal','clock','check','storage','create','close'];
const storageKeys=['classify','reserve','strictExclusive','settle'] as const;
function native<T>(p:Promise<T>){if(!isPromise(p)||isProxy(p))return fail();return new Promise<T>((resolve,reject)=>Reflect.apply(Promise.prototype.then,p,[resolve,reject]));}
function queryIterator(query:Query):Query[typeof Symbol.asyncIterator]{
 for(let object:object|null=query;object;object=Object.getPrototypeOf(object)){
  if(isProxy(object))return fail();const d=Object.getOwnPropertyDescriptor(object,Symbol.asyncIterator);
  if(d)return 'value' in d&&typeof d.value==='function'?d.value:fail();
 }
 return fail();
}
export async function runNormalFirstSend(worker:NormalStartWire,claim:NormalDispatchClaim,source:NormalFirstSendSource,signal:AbortSignal):Promise<FirstSendCompletion>{
 const parent=takeNormalFirstStart(worker,claim);
 if(leases.has(worker)||!shape(source,sourceKeys))return fail();
 const lease:Lease={state:'PENDING',life:new AbortController(),closeStarted:false};leases.set(worker,lease);
 const pinned={...source},store=source.storage;if(!shape(store,[...storageKeys]))return fail();const methods={...store};
 if(![pinned.profileRef,pinned.assignmentRef,pinned.slotRef].every(v=>!isProxy(v)&&refV1(v))||!sdkOpaqueId(pinned.plannedSid)||
  !(pinned.ownerSignal instanceof AbortSignal)||pinned.ownerSignal.aborted||!Number.isSafeInteger(pinned.expiresAt)||[pinned.clock,pinned.check,pinned.create,pinned.close,...Object.values(methods)].some(fn=>typeof fn!=='function'))return fail();
 const {input}=claim,e=input.envelope,plannedSid=pinned.plannedSid,scope:Scope=cloneV1({projectId:e.context.projectId,executionId:e.context.executionId,generation:e.context.executionGeneration,
  registrationRef:e.executorRegistrationRef,profileRef:pinned.profileRef,assignmentRef:pinned.assignmentRef,slotRef:pinned.slotRef,grantRef:parent.grantRef,
  startReadyRef:parent.startReadyRef,dispatchAttemptRef:input.dispatchAttemptRef,sessionBindingRef:e.payload.sessionBindingRef,plannedSidDigest:digest(plannedSid)});
 const scopeDigest=digest(scope);
 let expiresAt=pinned.expiresAt,last=-Infinity,monoEnd=Infinity,readyToCommit=false;
 let ownerTimer:ReturnType<typeof setTimeout>|undefined;
 const abandon=()=>{
  lease.state='UNKNOWN';lease.life.abort();clearTimeout(ownerTimer);pinned.ownerSignal.removeEventListener('abort',abandon);
  if(lease.query&&!lease.closeStarted){lease.closeStarted=true;try{void native(pinned.close.call(source,lease.query)).catch(()=>undefined);}catch{}}
 };
 const current=()=>{
  if(lease.state==='UNKNOWN'||!shape(source,sourceKeys)||source.create!==pinned.create||source.close!==pinned.close||source.check!==pinned.check||source.clock!==pinned.clock||
   source.ownerSignal!==pinned.ownerSignal||pinned.ownerSignal.aborted||!Number.isSafeInteger(source.expiresAt)||source.plannedSid!==plannedSid||source.storage!==store||!shape(store,[...storageKeys])||storageKeys.some(k=>store[k]!==methods[k])||
   digest(source.profileRef)!==digest(scope.profileRef)||digest(source.slotRef)!==digest(scope.slotRef)||digest(source.assignmentRef)!==digest(scope.assignmentRef))return fail();
  const c=pinned.check.call(source,cloneV1(scope)),now=pinned.clock.call(source);
  if(!shape(c,['scopeDigest','expiresAt'])||!c||c.scopeDigest!==scopeDigest||!Number.isSafeInteger(c.expiresAt)||!Number.isSafeInteger(now)||now<last)return fail();
  last=now;expiresAt=Math.min(expiresAt,c.expiresAt,source.expiresAt);monoEnd=Math.min(monoEnd,performance.now()+expiresAt-now);
  if(now>=expiresAt||performance.now()>=monoEnd||lease.life.signal.aborted)return fail();
 };
 pinned.ownerSignal.addEventListener('abort',abandon,{once:true});
 const guard=()=>{if(signal.aborted||claim.remaining()<=0)return fail();current();};
 const boundedSignal=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const cancel=()=>{boundedSignal.abort();abandon();};
 const arm=()=>{guard();clearTimeout(timer);timer=setTimeout(cancel,Math.max(0,Math.min(claim.remaining(),expiresAt-last,monoEnd-performance.now())));};
 let rejectWait!:()=>void;const interrupted=new Promise<never>((_,reject)=>{rejectWait=()=>reject(Error('NORMAL_FIRST_SEND_UNKNOWN'));});
 void interrupted.catch(()=>undefined);
 boundedSignal.signal.addEventListener('abort',rejectWait,{once:true});signal.addEventListener('abort',cancel,{once:true});pinned.ownerSignal.addEventListener('abort',cancel,{once:true});
 try{
  arm();const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(input.instruction.bytes);
  if(text!==input.instruction.text||!Buffer.from(text).equals(input.instruction.bytes)||!text.trim())return fail();
  const message=boundedSdkObject({type:'user',message:{role:'user',content:text},parent_tool_use_id:null,session_id:plannedSid},maxSdkObjectBytes);
  if(supportedSdkUser(message.value)!=='SUPPORTED')return fail();
  const inputEvidence={dispatchAttemptRef:cloneV1(input.dispatchAttemptRef),instructionRef:cloneV1(e.payload.instructionRef),partsRef:cloneV1(e.payload.partsRef),instructionDigest:contentHash(input.instruction.bytes),messageDigest:message.digest};
  let iterated=false,pulled=false,yielded=false,resolveYield!:()=>void;
  const provided=new Promise<void>(resolve=>{resolveYield=resolve;});
  const prompt=Object.freeze({[Symbol.asyncIterator](){
   if(iterated)return fail();iterated=true;guard();
   return Object.freeze({async next(){if(pulled)return{done:true,value:undefined};pulled=true;arm();const value=cloneV1(message.value);yielded=true;resolveYield();return{done:false,value};}});
  }});
  const send={...cloneV1({...input,instruction:null}),instruction:{...cloneV1({...input.instruction,bytes:null}),bytes:new Uint8Array(input.instruction.bytes)}};
  if(NormalSdkSessionOutput.prototype.next!==normalizeNext||NormalSdkSessionOutput.prototype.consumeInit!==consumeInit)return fail();
  const created=native(pinned.create.call(source,{start:copyNormalWorkerStart(parent.start),send,scope:cloneV1(scope),plannedSid},prompt,lease.life.signal)).then(query=>{
   if(!query||typeof query!=='object'||isProxy(query)||issuedHandles.has(query))return fail();
   issuedHandles.add(query);lease.raw=query;lease.iterate=queryIterator(query);lease.query=query;if(lease.state==='UNKNOWN'){abandon();return fail();}return query;
  });
  const query=await Promise.race([created,interrupted]);arm();
  const iterate=lease.iterate;if(!iterate||queryIterator(query)!==iterate)return fail();
  const iterator=iterate.call(query);
  if(!iterator||typeof iterator!=='object'||isProxy(iterator)||(!Object.is(iterator,query)&&issuedHandles.has(iterator))){
   // 같은 iterator를 이미 가진 다른 owner에 대한 close 권위를 추론하지 않는다.
   lease.closeStarted=true;return fail();
  }
  issuedHandles.add(iterator);lease.iterator=iterator;arm();
  const origin={owner:worker,attempt:claim,query,iterator};
  const output=new NormalSdkSessionOutput({origin,scope,context:e.context,plannedSid,expiresAt,ports:{
   clock:()=>pinned.clock.call(source),current:()=>{current();return{...origin,scopeDigest,expiresAt};},
   classify:raw=>methods.classify.call(store,raw),reserve:req=>methods.reserve.call(store,req),
   strictExclusive:(hold,body)=>methods.strictExclusive.call(store,hold,body),settle:(hold,n)=>methods.settle.call(store,hold,n)
  }});lease.output=output;
  let confirmed:Ref|null=null;
  while(!confirmed){
   arm();if(output.next!==normalizeNext||output.consumeInit!==consumeInit)return fail();
   const step=await Promise.race([normalizeNext.call(output,boundedSignal.signal),interrupted]);arm();
   if(step.state==='SESSION_CONFIRMED'){confirmed=consumeInit.call(output,step.initEvidence,origin);if(!confirmed)return fail();}
   else if(step.state!=='PENDING_SESSION')return fail();
  }
  await Promise.race([provided,interrupted]);arm();if(!yielded)return fail();
  const handoffEnd=performance.now()+Math.min(claim.remaining(),monoEnd-performance.now());
  ownerTimer=setTimeout(abandon,Math.max(0,handoffEnd-performance.now()));ownerTimer.unref();readyToCommit=true;
  return{summary:{startReadyRef:cloneV1(parent.startReadyRef),inputEvidence,initConfirmationRef:cloneV1(confirmed)},abandon,
   commit(){if(lease.state!=='PENDING'||performance.now()>=handoffEnd)return fail();current();clearTimeout(ownerTimer);lease.state='LIVE';ownerTimer=setTimeout(abandon,Math.max(0,Math.min(monoEnd-performance.now(),expiresAt-last,2147483647)));ownerTimer.unref();}};
 }finally{
  if(!readyToCommit)abandon();
  clearTimeout(timer);signal.removeEventListener('abort',cancel);pinned.ownerSignal.removeEventListener('abort',cancel);boundedSignal.signal.removeEventListener('abort',rejectWait);
 }
}
