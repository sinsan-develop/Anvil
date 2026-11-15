import {randomUUID} from 'node:crypto';
import {isPromise,isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import type {AdapterContextV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {ClaudeSdkMessageCodec} from '../adapters/secondary/codec.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkMessageShape,sdkOpaqueId} from '../adapters/secondary/schemas.ts';

const KiB=1024,MiB=KiB*KiB,fileBytes=3*MiB,channelLimit=64*MiB,normalLimit=256*MiB,maxRows=10000;
const digest=(value:unknown)=>contentHash(canonicalJson(value));
const size=(value:unknown)=>Buffer.byteLength(canonicalJson(value),'utf8')+1;
const equal=(left:unknown,right:unknown)=>canonicalJson(left)===canonicalJson(right);
const fail=():never=>{throw Error('NORMAL_SDK_OUTPUT_UNCERTAIN');};
const count=(v:number)=>Number.isSafeInteger(v)&&v>=0;
const nativeThen=Promise.prototype.then;
const claimed=new WeakSet<object>();
const shape=(v:unknown,keys:string[])=>!isProxy(v)&&recordV1(v,keys);

type Scope={projectId:string;executionId:string;generation:number;registrationRef:Ref;profileRef:Ref;assignmentRef:Ref;slotRef:Ref;
 grantRef:Ref;startReadyRef:Ref;dispatchAttemptRef:Ref;sessionBindingRef:Ref;plannedSidDigest:string};
type Origin={owner:object;attempt:object;query:AsyncIterable<unknown>;iterator:AsyncIterator<unknown>};
type Current=Origin&{scopeDigest:string;expiresAt:number};
type Request={channel:'SDK_SESSION_OUTPUT';pool:'NORMAL_EXECUTION';id:string;scopeDigest:string;dataBytes:number;rows:number;tailRef:Ref|null};
type Hold={id:string;requestDigest:string;normalUsed:number;normalHeldBefore:number;channelBytes:number;channelRows:number;channelHeldBytes:number;channelHeldRows:number;managementBytes:number};
type Transaction={read():Promise<unknown[]>;appendAndSync(value:unknown):Promise<void>};
interface Ports{
 clock():number;current():Current|null;classify(raw:Readonly<Record<string,unknown>>):string;
 reserve(request:Request):Promise<Hold>;
 strictExclusive(hold:Hold,body:(tx:Transaction)=>Promise<void>):Promise<{holdId:string;tailRef:Ref|null;rows:number}>;
 settle(hold:Hold,dataBytes:number):Promise<{holdId:string;dataBytes:number;managementBytes:number}>;
}
interface Options{origin:Origin;scope:Scope;context:AdapterContextV1;plannedSid:string;expiresAt:number;ports:Ports}
type Row={ref:Ref;snapshot:Record<string,unknown>};
type Stored={ref:Ref;bytes:number;identity:string|null;payload:string|null;ordinary:boolean};
type Receipt={attribution:'SESSION_ONLY';outputRef:Ref;initConfirmationRef:Ref;processRef:null};
interface Output{state:'PENDING_SESSION'|'SESSION_CONFIRMED'|'OUTPUT_RECORDED'|'DONE'|'UNKNOWN';receipts:Receipt[];initEvidence?:object}
function row(snapshot:Record<string,unknown>):Row{return{ref:{id:randomUUID(),version:1,contentHash:digest(snapshot)},snapshot};}
const scopeRefs=['registrationRef','profileRef','assignmentRef','slotRef','grantRef','startReadyRef','dispatchAttemptRef','sessionBindingRef'] as const;
const originKeys=['owner','attempt','query','iterator'];
function iteratorNext(iterator:AsyncIterator<unknown>):AsyncIterator<unknown>['next']{
 for(let object:object|null=iterator;object;object=Object.getPrototypeOf(object)){
  if(isProxy(object))return fail();
  const descriptor=Object.getOwnPropertyDescriptor(object,'next');
  if(descriptor)return 'value' in descriptor&&typeof descriptor.value==='function'?descriptor.value:fail();
 }
 return fail();
}
function sameOrigin(a:Origin,b:Origin){return a.owner===b.owner&&a.attempt===b.attempt&&a.query===b.query&&a.iterator===b.iterator;}
function confirmation(scope:Scope,sequence:number,tail:Ref,at:string,prefixDigest:string){
 return{schemaVersion:1,state:'SESSION_INIT_CONFIRMED',scope,sequence,previousRef:tail,initOutputRef:tail,
  observedSidDigest:scope.plannedSidDigest,prefixCount:sequence-1,tailRef:tail,prefixDigest,observedAt:at};
}
const widestRef:Ref={id:'00000000-0000-4000-8000-000000000000',version:1,contentHash:'f'.repeat(64)};

/** 원 iterator 소비 경계. 보호 배정·현재성·엄격한 close·공동 예약을 이 모듈 자체가 발급하지 않는다. */
export class NormalSdkSessionOutput{
 #origin:Origin;#scope:Scope;#scopeDigest:string;#ports:Ports;#original:Ports;#next?:AsyncIterator<unknown>['next'];#codec:ClaudeSdkMessageCodec;
 #captured:Readonly<Record<string,unknown>>|null=null;
 #end:number;#monoEnd:number;#last:number;#busy=false;#failed=false;#done=false;
 #index:Stored[]=[];#bytes=0;#confirmation:Ref|null=null;#evidence:object|null=null;

 constructor(p:Options){
  if(!shape(p,['origin','scope','context','plannedSid','expiresAt','ports'])||!shape(p.origin,originKeys))fail();
  this.#origin={...p.origin};
  for(const value of Object.values(this.#origin))if(!value||typeof value!=='object'||isProxy(value))fail();
  const {query,iterator,attempt}=this.#origin;
  if(claimed.has(query)||claimed.has(iterator)||claimed.has(attempt))fail();
  claimed.add(query);claimed.add(iterator);claimed.add(attempt);
  this.#next=iteratorNext(iterator);
  if(!shape(p.scope,['projectId','executionId','generation',...scopeRefs,'plannedSidDigest'])||
    !sdkOpaqueId(p.plannedSid)||p.scope.plannedSidDigest!==digest(p.plannedSid)||!scopeRefs.every(k=>refV1(p.scope[k]))||
    !uuidV1(p.scope.projectId)||!uuidV1(p.scope.executionId)||p.scope.projectId!==p.context.projectId||p.scope.executionId!==p.context.executionId||
    p.scope.generation!==p.context.executionGeneration||!shape(p.ports,['clock','current','classify','reserve','strictExclusive','settle'])||
    !Object.values(p.ports).every(f=>typeof f==='function')||!Number.isSafeInteger(p.expiresAt))fail();
  this.#scope=cloneV1(p.scope);this.#scopeDigest=digest(this.#scope);
  this.#ports=p.ports;this.#original={...p.ports};this.#last=p.ports.clock();this.#end=p.expiresAt;
  this.#monoEnd=performance.now()+(this.#end-this.#last);
  this.#codec=new ClaudeSdkMessageCodec({context:p.context,expectedSessionId:p.plannedSid,maxMessageBytes:maxSdkObjectBytes,maxIdentities:1024},
   {capture:fact=>{this.#captured=fact;return{state:'RECORDED'};}});
  this.#guard();
 }
 #guard(){
  if(this.#failed||this.#next&&this.#next!==iteratorNext(this.#origin.iterator)||!shape(this.#ports,['clock','current','classify','reserve','strictExclusive','settle'])||
     (Object.keys(this.#original) as (keyof Ports)[]).some(k=>this.#ports[k]!==this.#original[k]))fail();
  const current=this.#ports.current(),at=this.#ports.clock();
  if(!current||!shape(current,[...originKeys,'scopeDigest','expiresAt'])||!sameOrigin(current,this.#origin)||
     current.scopeDigest!==this.#scopeDigest||!Number.isSafeInteger(current.expiresAt)||!Number.isSafeInteger(at)||at<this.#last||
     new Date(at).toISOString().length!==24)return fail();
  this.#last=at;this.#end=Math.min(this.#end,current.expiresAt);this.#monoEnd=Math.min(this.#monoEnd,performance.now()+this.#end-at);
  if(at>=this.#end||performance.now()>=this.#monoEnd)fail();
 }
 consumeInit(evidence:unknown,origin:Origin){
  if(this.#busy||!this.#evidence||evidence!==this.#evidence||!shape(origin,originKeys)||!sameOrigin(origin,this.#origin))return null;
  this.#evidence=null;
  try{this.#guard();return cloneV1(this.#confirmation);}catch{this.#failed=true;return null;}
 }
 #verify(raw:unknown[],index:Stored[]){
  if(!Array.isArray(raw)||isProxy(raw)||raw.length!==index.length||raw.length>maxRows)fail();
  let bytes=0;
  for(let i=0;i<index.length;i++){
   const stored=index[i]!,v=boundedSdkObject(raw[i],fileBytes).value;
   if(!shape(v,['ref','snapshot'])||!refV1(v.ref)||!equal(v.ref,stored.ref)||v.ref.contentHash!==digest(v.snapshot)||
      v.snapshot.sequence!==i+1||!equal(v.snapshot.previousRef,index[i-1]?.ref??null)||!equal(v.snapshot.scope,this.#scope))fail();
   const length=size(v);bytes+=length;if(length!==stored.bytes||length>fileBytes||bytes>channelLimit)fail();
   if(stored.payload){
    if(typeof v.snapshot.body!=='string')fail();
    const body=Buffer.from(v.snapshot.body,'base64');
    if(body.byteLength>maxSdkObjectBytes||body.toString('base64')!==v.snapshot.body||contentHash(body)!==stored.payload)fail();
   }
  }
 }
 #receipt(v:Stored,confirmed:Ref):Receipt{return{attribution:'SESSION_ONLY',outputRef:cloneV1(v.ref),initConfirmationRef:cloneV1(confirmed),processRef:null};}

 async next(signal:AbortSignal):Promise<Output>{
  if(this.#busy)throw Error('NORMAL_SDK_OUTPUT_BUSY');
  if(this.#failed)return{state:'UNKNOWN',receipts:[]};
  if(this.#done)return{state:'DONE',receipts:[]};
  this.#busy=true;
  let timer:ReturnType<typeof setTimeout>|undefined,abort=()=>{},open=true;
  const expired=new Promise<never>((_,reject)=>{abort=()=>{open=false;reject(Error('NORMAL_SDK_OUTPUT_UNCERTAIN'));};});
  void expired.catch(()=>undefined);
  const guard=()=>{if(!open||!(signal instanceof AbortSignal)||signal.aborted)fail();this.#guard();};
  const wait=async<T>(call:()=>Promise<T>)=>{
   guard();if(timer!==undefined)clearTimeout(timer);
   timer=setTimeout(abort,Math.max(0,Math.min(this.#end-this.#last,this.#monoEnd-performance.now(),2147483647)));
   const pending=call();if(!isPromise(pending)||isProxy(pending))fail();
   const observed=new Promise<T>((yes,no)=>Reflect.apply(nativeThen,pending,[yes,no]));
   const value=await Promise.race([observed,expired]);guard();return value;
  };
  try{
   guard();signal.addEventListener('abort',abort,{once:true});
   const index=this.#index.slice(),initial=index.length,at=new Date(this.#last).toISOString();
   let confirmed=this.#confirmation,added=0,hasInit=false,done=false,completed=false,entered=false;
   let wanted:Stored[]=[];
   const allowRows=confirmed?1:2;
   const confirmMax=size({ref:widestRef,snapshot:confirmation(this.#scope,maxRows,widestRef,at,widestRef.contentHash)});
   const dataBytes=fileBytes+(confirmed?0:confirmMax);
   if(index.length+allowRows>maxRows||this.#bytes+dataBytes>channelLimit)fail();
   const request:Request={channel:'SDK_SESSION_OUTPUT',pool:'NORMAL_EXECUTION',id:randomUUID(),scopeDigest:this.#scopeDigest,
    dataBytes,rows:allowRows,tailRef:index.at(-1)?.ref??null};
   const held=await wait(()=>this.#ports.reserve(cloneV1(request)));
   if(!shape(held,['id','requestDigest','normalUsed','normalHeldBefore','channelBytes','channelRows','channelHeldBytes','channelHeldRows','managementBytes'])||
     !uuidV1(held.id)||held.requestDigest!==digest(request)||held.channelRows!==initial||held.channelBytes!==this.#bytes||
     !count(held.channelHeldBytes)||!count(held.channelHeldRows)||held.channelBytes+held.channelHeldBytes+dataBytes>channelLimit||
     held.channelRows+held.channelHeldRows+allowRows>maxRows||held.channelHeldBytes>held.normalHeldBefore||
     !count(held.normalUsed)||held.normalUsed<this.#bytes||!count(held.normalHeldBefore)||!count(held.managementBytes)||held.managementBytes<1||
     held.normalUsed+held.normalHeldBefore+held.managementBytes+dataBytes>normalLimit)fail();
   const hold=Object.freeze(cloneV1(held));
   const closed=await wait(()=>this.#ports.strictExclusive(hold,async tx=>{
    guard();if(entered||!shape(tx,['read','appendAndSync']))fail();entered=true;
    const read=tx.read,append=tx.appendAndSync;const stable=()=>{guard();if(tx.read!==read||tx.appendAndSync!==append)fail();};
    const verify=async()=>{stable();this.#verify(await wait(()=>Reflect.apply(read,tx,[]) as Promise<unknown[]>),index);stable();};
    await verify();
    const next=this.#next;if(!next||iteratorNext(this.#origin.iterator)!==next)return fail();
    const item=await wait(()=>Reflect.apply(next,this.#origin.iterator,[]) as Promise<IteratorResult<unknown>>);
    if(!shape(item,['value','done'])||typeof item.done!=='boolean')fail();
    if(item.done){if(!confirmed)fail();done=true;completed=true;return;}
    const parsed=boundedSdkObject(item.value,maxSdkObjectBytes),message=parsed.value;
    this.#captured=null;const observation=this.#codec.normalize(message),type=sdkMessageShape(message);
    if(type.state!=='SUPPORTED'||observation.kind!=='OBSERVED'||observation.payloadDigest!==parsed.digest||
       observation.sessionDigest!==this.#scope.plannedSidDigest||type.family!==observation.family)return fail();
    const identity=digest(type.uuid),prior=index.find(v=>v.identity===identity);
    const classification=this.#ports.classify(cloneV1(message));stable();
    const ordinary=classification==='ORDINARY';
    if(observation.duplicate){
     if(!prior||prior.payload!==parsed.digest||this.#captured!==null)fail();
     if(prior!.ordinary&&!ordinary)fail();
     wanted=prior!.ordinary?[prior!]:[];completed=true;return;
    }
    const captured=this.#captured as Readonly<Record<string,unknown>>|null;
    if(prior||!captured||captured.messageId!==type.uuid||captured.sessionId!==type.sessionId||captured.payloadDigest!==parsed.digest||
      captured.sessionDigest!==this.#scope.plannedSidDigest||captured.contextDigest!==observation.contextDigest)fail();
    if(type.family==='SYSTEM_INIT'&&confirmed)fail();
    const appendChecked=async(snapshot:Record<string,unknown>,familyId:string|null,payload:string|null,visible:boolean)=>{
     const entry=row(snapshot),bytes=size(entry);if(bytes>fileBytes||index.length>=maxRows||added+bytes>dataBytes||this.#bytes+added+bytes>channelLimit)fail();
     const stored:Stored={ref:entry.ref,bytes,identity:familyId,payload,ordinary:visible};
     stable();await wait(()=>Reflect.apply(append,tx,[cloneV1(entry)]) as Promise<void>);
     index.push(stored);added+=bytes;await verify();return stored;
    };
    const saved=await appendChecked({schemaVersion:1,state:confirmed?'SESSION_OUTPUT':'OUTPUT_PENDING_SESSION',scope:this.#scope,
     sequence:index.length+1,previousRef:index.at(-1)?.ref??null,initConfirmationRef:confirmed,observedAt:new Date(this.#last).toISOString(),
     family:type.family,identity,payloadDigest:parsed.digest,classification:ordinary?'ORDINARY':'QUARANTINED',
     body:Buffer.from(canonicalJson(message),'utf8').toString('base64')},identity,parsed.digest,ordinary);
    wanted=ordinary?[saved]:[];
    if(type.family==='SYSTEM_INIT'){
     const prefixDigest=index.reduce((previous,v)=>digest({previous,ref:v.ref,payloadDigest:v.payload}),digest([]));
     const mark=await appendChecked(confirmation(this.#scope,index.length+1,saved.ref,new Date(this.#last).toISOString(),prefixDigest),null,null,false);
     confirmed=mark.ref;hasInit=true;wanted=index.filter(v=>v.ordinary);
    }
    completed=true;
   }));
   if(!completed||!shape(closed,['holdId','tailRef','rows'])||closed.holdId!==hold.id||
      closed.rows!==index.length||!equal(closed.tailRef,index.at(-1)?.ref??null))fail();
   const settled=await wait(()=>this.#ports.settle(hold,added));
   if(!shape(settled,['holdId','dataBytes','managementBytes'])||settled.holdId!==hold.id||
     settled.dataBytes!==added||settled.managementBytes!==hold.managementBytes)fail();
   this.#index=index;this.#bytes+=added;this.#confirmation=confirmed;this.#done=done;
   if(done)return{state:'DONE',receipts:[]};
   const receipts=confirmed?wanted.map(v=>this.#receipt(v,confirmed!)):[];
   if(hasInit){this.#evidence=Object.freeze(Object.create(null) as object);return{state:'SESSION_CONFIRMED',receipts,initEvidence:this.#evidence!};}
   return{state:confirmed?'OUTPUT_RECORDED':'PENDING_SESSION',receipts};
  }catch{this.#failed=true;this.#evidence=null;return{state:'UNKNOWN',receipts:[]};}
  finally{open=false;this.#busy=false;this.#captured=null;if(timer!==undefined)clearTimeout(timer);if(signal instanceof AbortSignal)signal.removeEventListener('abort',abort);}
 }
}
