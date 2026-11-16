import {isPromise,isProxy} from 'node:util/types';
import {randomUUID} from 'node:crypto';
import {readNormalStopProjectionV1} from '../../../contracts/runtime/normal-stop-target-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readNormalStopItem,type NormalStopOriginal,type NormalStopCommandPageItem} from './normal-start-material-consumer.ts';
import {captureInstructionInput} from './normal-instruction-intake.ts';
import type {NormalStopStore} from './normal-stop-coordinator.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkOpaqueId,supportedSdkUser} from '../adapters/secondary/schemas.ts';
import {copyNormalWorkerStart} from '../adapters/secondary/normal-start-wire.ts';
import {takeNormalFirstStart,type NormalStartWire} from './normal-start-coordinator.ts';
import {originalNormalLiveDispatch,type NormalDispatchClaim,type NormalInstructionDriverInput} from './normal-instruction-coordinator.ts';
import {NormalSdkSessionOutput} from './normal-sdk-session-output.ts';

type OutputOptions=ConstructorParameters<typeof NormalSdkSessionOutput>[0];
type Scope=OutputOptions['scope'];
type Query=AsyncIterable<unknown>;
type Parent=ReturnType<typeof takeNormalFirstStart>;
export type FirstSendSummary={startReadyRef:Ref;inputEvidence:{dispatchAttemptRef:Ref;instructionRef:Ref;partsRef:Ref;instructionDigest:string;messageDigest:string};initConfirmationRef:Ref};
export type LiveSendParent={registrationRef:Ref;startReadyRef:Ref;firstSendKey:ReturnType<typeof receiptKeyV1>;firstEnvelopeHash:string;firstTerminalRef:Ref;initConfirmationRef:Ref};
export type LiveInputPort={provide(query:Query,input:AsyncIterable<unknown>,signal:AbortSignal):Promise<void>};
export type FirstSendCompletion={kind:'FIRST';summary:FirstSendSummary;commit(terminal:Ref):void;abandon():void};
export type LiveSendCompletion={kind:'LIVE';summary:LiveSendParent & Pick<FirstSendSummary,'inputEvidence'>;check():void;commit(terminal:Ref):void;abandon():void};
/** 명시 source 의존성. 이 포트에 SDK 서명·등록 권한·보호 배정의 기본 구현은 없다. */
export interface NormalFirstSendSource{
 profileRef:Ref;assignmentRef:Ref;slotRef:Ref;plannedSid:string;expiresAt:number;ownerSignal:AbortSignal;clock():number;
 check(scope:Scope):{scopeDigest:string;expiresAt:number}|null;
 storage:Pick<OutputOptions['ports'],'classify'|'reserve'|'strictExclusive'|'settle'>;
 create(request:{start:Parent['start'];send:NormalInstructionDriverInput;scope:Scope;plannedSid:string},prompt:AsyncIterable<unknown>,lifetime:AbortSignal):Promise<Query>;
 close(query:Query):Promise<void>;
 /** 원 owner에 조립되는 독립 보호 기록 판독 포트. 서명·현 head의 실제 생산/검증은 배포 공급자의 책임이다. */
 stop?:{store:NormalStopStore;readCurrent(signal:AbortSignal):Promise<unknown>};
}
type Lease={raw?:unknown;query?:Query;iterate?:Query[typeof Symbol.asyncIterator];iterator?:AsyncIterator<unknown>;output?:NormalSdkSessionOutput;state:'PENDING'|'COMMITTING'|'LIVE'|'UNKNOWN';life:AbortController;closeStarted:boolean};
type InputOwner={wire:object;lease:Lease;parent:LiveSendParent;scope:Scope;sid:string;port:LiveInputPort|undefined;provide:LiveInputPort['provide']|undefined;check():void;token:object|null;stopEpoch:number;uncertain:boolean};
const inputOwners=new WeakMap<NormalStartWire,InputOwner>();
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
export async function runNormalFirstSend(worker:NormalStartWire,claim:NormalDispatchClaim,source:NormalFirstSendSource,signal:AbortSignal,wire:object,port?:LiveInputPort):Promise<FirstSendCompletion>{
 const parent=takeNormalFirstStart(worker,claim);
 const keys=source&&!isProxy(source)&&Object.hasOwn(source,'stop')?[...sourceKeys,'stop']:sourceKeys;
 if(leases.has(worker)||!shape(source,keys))return fail();
 const lease:Lease={state:'PENDING',life:new AbortController(),closeStarted:false};leases.set(worker,lease);
 const provide=port&&!isProxy(port)?Object.getOwnPropertyDescriptor(port,'provide')?.value:undefined;
 if(port&&(!shape(port,['provide'])||typeof provide!=='function'||isProxy(provide)))return fail();
 const pinned={...source},stop=pinned.stop;
 if(stop&&(!shape(stop,['store','readCurrent'])||typeof stop.readCurrent!=='function'||!shape(stop.store,['transport','exclusive'])||stop.store.transport!=='NORMAL_PROTECTED'||typeof stop.store.exclusive!=='function'))return fail();
 const stopRead=stop?.readCurrent,stopStore=stop?.store,stopExclusive=stopStore?.exclusive;
 const store=source.storage;if(!shape(store,[...storageKeys]))return fail();const methods={...store};
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
  if(lease.state==='UNKNOWN'||!shape(source,keys)||source.create!==pinned.create||source.close!==pinned.close||source.check!==pinned.check||source.clock!==pinned.clock||
   source.stop!==stop||stop&&(!shape(stop,['store','readCurrent'])||stop.readCurrent!==stopRead||stop.store!==stopStore||!shape(stopStore,['transport','exclusive'])||stopStore!.exclusive!==stopExclusive)||source.ownerSignal!==pinned.ownerSignal||pinned.ownerSignal.aborted||!Number.isSafeInteger(source.expiresAt)||source.plannedSid!==plannedSid||source.storage!==store||!shape(store,[...storageKeys])||storageKeys.some(k=>store[k]!==methods[k])||
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
  const interrupt=stop?interruptMethod(query):undefined;
  if(stop&&stopStore&&stopRead&&stopExclusive&&interrupt){
   stopOwners.set(worker,{lease,query,interrupt,scope,parent,port:stop,store:stopStore,exclusive:stopExclusive,read:stopRead,check:current,now:()=>last,stopToken:null});
  }
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
  const drain=async()=>{
   try{
    while(lease.state==='LIVE'){
     if(leases.get(worker)!==lease||lease.output!==output||lease.query!==query||lease.iterator!==iterator||output.next!==normalizeNext)return fail();
     current();
     const step=await Reflect.apply(normalizeNext,output,[lease.life.signal]);
     if(step.state==='DONE')return;
     if(step.state!=='OUTPUT_RECORDED')return fail();
     await new Promise<void>(resolve=>setImmediate(resolve));
    }
   }catch{abandon();}
  };
  return{kind:'FIRST',summary:{startReadyRef:cloneV1(parent.startReadyRef),inputEvidence,initConfirmationRef:cloneV1(confirmed)},abandon,
   commit(terminal){
    if(!refV1(terminal)||terminal.version!==1)return fail();
    if(lease.state!=='PENDING'||performance.now()>=handoffEnd)return fail();
    // current 포트의 동기 재진입보다 먼저 단발 commit을 선점한다.
    lease.state='COMMITTING';current();if(lease.state!=='COMMITTING'||lease.life.signal.aborted)return fail();
    clearTimeout(ownerTimer);lease.state='LIVE';
    inputOwners.set(worker,{wire,lease,scope,sid:plannedSid,port,provide,check:current,token:null,stopEpoch:0,uncertain:false,
     parent:cloneV1({registrationRef:e.executorRegistrationRef,startReadyRef:parent.startReadyRef,firstSendKey:receiptKeyV1(e),firstEnvelopeHash:e.envelopeHash,firstTerminalRef:terminal,initConfirmationRef:confirmed!})});
    ownerTimer=setTimeout(abandon,Math.max(0,Math.min(monoEnd-performance.now(),expiresAt-last,2147483647)));ownerTimer.unref();
    queueMicrotask(()=>void drain());
   }};
 }finally{
  if(!readyToCommit)abandon();
  clearTimeout(timer);signal.removeEventListener('abort',cancel);pinned.ownerSignal.removeEventListener('abort',cancel);boundedSignal.signal.removeEventListener('abort',rejectWait);
 }
}


function interruptMethod(query:Query):((this:Query)=>Promise<void>)|undefined{
 for(let object:object|null=query;object;object=Object.getPrototypeOf(object)){
  if(isProxy(object))return undefined;
  const method=Object.getOwnPropertyDescriptor(object,'interrupt');
  if(method)return 'value' in method&&typeof method.value==='function'&&!isProxy(method.value)?method.value:undefined;
 }
 return undefined;
}

type StopPort=NonNullable<NormalFirstSendSource['stop']>;
type StopOwner={lease:Lease;query:Query;interrupt:NonNullable<ReturnType<typeof interruptMethod>>;scope:Scope;parent:Parent;port:StopPort;store:NormalStopStore;
 exclusive:NormalStopStore['exclusive'];read:StopPort['readCurrent'];check():void;now():number;stopToken:object|null};
const stopOwners=new WeakMap<NormalStartWire,StopOwner>();
const unavailable=():never=>{throw Error('NORMAL_STOP_OWNER_UNAVAILABLE');};
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);

/** 원 owner가 보유한 저장/판독 포트에서만 선기록·엄격 닫힘 후 단발 전달한다. 이 함수는 CURRENT를 발급하지 않는다. */
export async function requestNormalLiveStop(worker:NormalStartWire,item:NormalStopCommandPageItem,original:NormalStopOriginal,store:NormalStopStore,signal:AbortSignal,outerCheck:()=>void){
 const owner=stopOwners.get(worker);
 if(!owner||owner.lease.state!=='LIVE'||owner.stopToken!==null||store!==owner.store)return unavailable();
 const token={};owner.stopToken=token;
 const inputOwner=inputOwners.get(worker);if(inputOwner)inputOwner.stopEpoch++;
 let attempted=false;
 try{
  const {lease,query,scope,parent}=owner;
  let monoEnd=performance.now()+10000,end=Infinity,checkedAt=-Infinity;
  item=captureInstructionInput(item);original=captureInstructionInput(original);
  const check=()=>{
   outerCheck();owner.check();
   const now=owner.now();
   if(owner.stopToken!==token||signal.aborted||lease.state!=='LIVE'||lease.life.signal.aborted||lease.query!==query||leases.get(worker)!==lease||
    interruptMethod(query)!==owner.interrupt||owner.port.readCurrent!==owner.read||owner.port.store!==store||store.exclusive!==owner.exclusive||now>=end||performance.now()>=monoEnd)return unavailable();
   monoEnd=Math.min(monoEnd,performance.now()+end-now);return now;
  };
  const now=check();item=readNormalStopItem(item,original,now);end=Date.parse(item.envelope.expiresAt);
  const target=item.stopTarget;
  if(!equal(original.startEnvelope,parent.start.envelope)||!equal(target.grantRef,parent.grantRef)||!equal(target.sessionBindingRef,scope.sessionBindingRef)||
   !equal(target.executorRegistrationRef,scope.registrationRef)||target.projectId!==scope.projectId||target.executionId!==scope.executionId||target.executionGeneration!==scope.generation)return unavailable();
  const witness=async()=>{
   check();const raw=await native(owner.read.call(owner.port,signal));const at=check();
   if(isProxy(raw)||!recordV1(raw,['owner','query','scopeDigest','commandRef','envelopeHash','projection'])||raw.owner!==worker||raw.query!==query||
    raw.scopeDigest!==digest(scope)||isProxy(raw.commandRef)||!refV1(raw.commandRef)||!equal(raw.commandRef,item.commandRef)||raw.envelopeHash!==item.envelope.envelopeHash)return unavailable();
   const projection=readNormalStopProjectionV1(raw.projection,parent.start.envelope.commandId,at);
   if(!equal(projection.target,target)||!equal(projection.stopScopeRef,item.envelope.payload.stopScopeRef)||Date.parse(projection.checkedAt)<checkedAt)return unavailable();
   checkedAt=Date.parse(projection.checkedAt);end=Math.min(end,Date.parse(projection.expiresAt));check();
  };
  const key=receiptKeyV1(item.envelope);
  const makeRow=(sequence:1|2,state:'STOP_ATTEMPTED'|'STOP_UNCONFIRMED',previousRef:Ref|null)=>{
   const snapshot={sequence,state,key,commandRef:item.commandRef,envelopeHash:item.envelope.envelopeHash,stopScopeRef:item.envelope.payload.stopScopeRef,target,previousRef,recordedAt:new Date(check()).toISOString()};
   return{ref:{id:randomUUID(),version:1,contentHash:digest(snapshot)},snapshot};
  };
  const append=async(previous:ReturnType<typeof makeRow>|null)=>{
   const expected=previous?[previous]:[],row=makeRow(previous?2:1,previous?'STOP_UNCONFIRMED':'STOP_ATTEMPTED',previous?.ref??null);
   let entered=false,readBack=false,closed=false;
   const active=()=>{if(closed)return unavailable();check();};
   try{
    await owner.exclusive.call(store,key,async tx=>{
     active();if(entered||typeof tx.requireStartReadyClose!=='function')return unavailable();
     entered=true;tx.requireStartReadyClose(key);
     const rows=await tx.read();active();if(!equal(rows,expected))return unavailable();
     if(!previous)attempted=true;
     await tx.appendAndSync(cloneV1(row));active();
     const written=await tx.read();active();if(!equal(written,[...expected,row]))return unavailable();
     readBack=true;
    });
   }finally{closed=true;}
   check();if(!readBack)return unavailable();return row;
  };
  await witness();const first=await append(null);
  await witness();check();
  const occurredAt=new Date(owner.now()).toISOString();
  try{await native(Reflect.apply(owner.interrupt,query,[]));}catch{/* 호출 경계를 통과했다. 실제 종료는 여전히 미확인이다. */}
  check();const second=await append(first);
  return{rows:[first,second],requestedAt:occurredAt};
 }finally{if(!attempted&&owner.stopToken===token)owner.stopToken=null;}
}

export function liveSendParent(worker:NormalStartWire,wire:object):LiveSendParent|null{
 const owner=inputOwners.get(worker);
 if(!owner)return null;
 if(owner.wire!==wire||owner.lease.state!=='LIVE'||owner.uncertain)return fail();
 return cloneV1(owner.parent);
}

/** 원 coordinator의 dispatch 증표와 첫 strict-close의 lease를 함께 소비한다. */
export async function runNormalLiveSend(worker:NormalStartWire,wire:object,claim:NormalDispatchClaim,signal:AbortSignal):Promise<LiveSendCompletion>{
 const owner=inputOwners.get(worker);
 if(!owner||owner.wire!==wire||owner.lease.state!=='LIVE'||owner.uncertain||owner.token||stopOwners.get(worker)?.stopToken)return fail();
 const token={};owner.token=token;const epoch=owner.stopEpoch;
 let yielded=false,returned=false,handed=false,invalid=false;
 const release=()=>{if(owner.token===token)owner.token=null;};
 const abandon=()=>{if(owner.token===token){if(yielded)owner.uncertain=true;invalid=true;release();}};
 try{
  const {lease,port,provide,parent,scope}=owner,query=lease.query,iterator=lease.iterator;
  if(!port||!provide||!query||!iterator)return fail();
  const binding=originalNormalLiveDispatch(claim),{input}=claim,e=input.envelope;
  if(!binding||!equal(binding.parent,parent)||!equal(binding.grant,scope.grantRef)||e.commandId===parent.firstSendKey.commandId||
   !equal(e.executorRegistrationRef,parent.registrationRef)||!equal(e.payload.sessionBindingRef,scope.sessionBindingRef)||
   e.context.projectId!==scope.projectId||e.context.executionId!==scope.executionId||e.context.executionGeneration!==scope.generation)return fail();
  const checkOwner=()=>{
   if(invalid||owner.token!==token||owner.stopEpoch!==epoch||stopOwners.get(worker)?.stopToken||owner.uncertain||leases.get(worker)!==lease||lease.state!=='LIVE'||
    lease.life.signal.aborted||lease.query!==query||lease.iterator!==iterator||Object.getOwnPropertyDescriptor(port,'provide')?.value!==provide)return fail();
  };
  const check=()=>{checkOwner();owner.check();checkOwner();};
  const active=()=>{check();if(signal.aborted||claim.remaining()<=0)return fail();};
  const bytes=new Uint8Array(input.instruction.bytes),text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  if(text!==input.instruction.text||!Buffer.from(text).equals(bytes)||!text.trim())return fail();
  const message=boundedSdkObject({type:'user',message:{role:'user',content:text},parent_tool_use_id:null,session_id:owner.sid},maxSdkObjectBytes);
  if(supportedSdkUser(message.value)!=='SUPPORTED')return fail();
  let iterated=false,pulled=false;
  const prompt=Object.freeze({[Symbol.asyncIterator](){
   active();if(iterated){invalid=true;return fail();}iterated=true;
   return Object.freeze({async next(){
    active();if(pulled)return{done:true as const,value:undefined};pulled=true;
    await claim.verify();active();if(returned)return fail();yielded=true;return{done:false as const,value:cloneV1(message.value)};
   }});
  }});
  let reject!:()=>void;
  const interrupted=new Promise<never>((_,stop)=>{reject=()=>stop(Error('NORMAL_LIVE_SEND_UNKNOWN'));});
  const cancel=()=>{abandon();reject();};signal.addEventListener('abort',cancel,{once:true});lease.life.signal.addEventListener('abort',cancel,{once:true});
  try{active();await Promise.race([native(Reflect.apply(provide,port,[query,prompt,signal])),interrupted]);returned=true;active();}
  finally{signal.removeEventListener('abort',cancel);lease.life.signal.removeEventListener('abort',cancel);}
  if(!yielded)return fail();await claim.verify();active();
  const inputEvidence={dispatchAttemptRef:cloneV1(input.dispatchAttemptRef),instructionRef:cloneV1(e.payload.instructionRef),partsRef:cloneV1(e.payload.partsRef),instructionDigest:contentHash(bytes),messageDigest:message.digest};
  handed=true;
  return{kind:'LIVE',summary:{...cloneV1(parent),inputEvidence},check,abandon,commit(){release();}};
 }finally{if(!handed)abandon();}
}
