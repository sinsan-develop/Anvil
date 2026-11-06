import {SyntheticClaudeInstructionBootstrap,prepareBootstrap,waitBootstrapYield,bootstrapOutcomeUnknown} from './instruction-bootstrap.ts';
import {isProxy,isPromise} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticMaterialReceiver} from '../../runtime/execution-material-receiver.ts';
import {readClaudeStartOptions} from './start-options.ts';
import {SyntheticClaudeSdkSessionOwner,adoptOwnerBootstrap,ownerBootstrapMethodCurrent} from './sdk-session-owner.ts';
import {ClaudeSdkMessageCodec} from './codec.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkOpaqueId} from './schemas.ts';
type Call={signal:AbortSignal;expiresAt:string};
type Options={sessionBindingRef?:unknown;bootstrap?:SyntheticClaudeInstructionBootstrap;transport:'SYNTHETIC_ONLY';receiver:SyntheticMaterialReceiver;envelope:unknown;expectedSessionId:string;driver:any;current:any;clock:()=>number;expiresAt:string;timeoutMs:number;maxMessageBytes:number;maxIdentities:number};
const flags=Object.freeze({actualExecutionVerified:false,executionAuthorized:false,dispatched:false,workAccepted:false,ownership:'UNVERIFIED' as const});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=(code='SDK_FACTORY_INVALID'):never=>{throw Error(code);};
const iso=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const output=(state:string)=>Object.freeze({state,...flags});
function member(object:any,key:PropertyKey):any{
 if(!object||typeof object!=='object'||isProxy(object))return fail();
 for(let node=object,depth=0;node&&depth<64;node=Object.getPrototypeOf(node),depth++){
  if(isProxy(node))return fail();const d=Object.getOwnPropertyDescriptor(node,key);if(d){if(!('value'in d))return fail();return d.value;}
 }
 return fail();
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
/** 실제 SDK/OS가 아닌 명시 메모리 driver의 단발 생성과 기존 owner 인계만 소유한다. */
export class SyntheticClaudeSdkQueryFactory{
 readonly transport='SYNTHETIC_ONLY' as const;
 #receiver!:SyntheticMaterialReceiver;#envelope:any;#session!:string;#driver:any;#source:any;#create!:Function;#current!:Function;#clock!:()=>number;#last=-Infinity;#until!:number;#timeout!:number;#bytes!:number;#identities!:number;#contextDigest!:string;#sessionDigest!:string;
 #bootstrap:SyntheticClaudeInstructionBootstrap|null=null;#bootstrapSessionBindingHash:string|null=null;#bootstrapInput:AsyncIterable<unknown>|null=null;#facade:object|null=null;#attempt:string|null=null;#pending:Promise<any>|null=null;#result:any=null;#attempted=false;#closed=false;#controller:AbortController|null=null;#cancel:(()=>void)|null=null;
 #query:any=null;#iterator:any=null;#methods:{stream:Function;iterate:Function;next:Function;interrupt:Function;close:Function}|null=null;
 #prefix:any[]=[];#owner:SyntheticClaudeSdkSessionOwner|null=null;#taken=false;#closePending:Promise<any>|null=null;#closeResult:any=null;
 constructor(raw:Options){
  try{
   if(!raw||isProxy(raw)||!recordV1(raw,['transport','receiver','envelope','expectedSessionId','driver','current','clock','expiresAt','timeoutMs','maxMessageBytes','maxIdentities',...(Object.hasOwn(raw,'bootstrap')?['bootstrap',...(Object.hasOwn(raw,'sessionBindingRef')?['sessionBindingRef']:[])]:[])])||raw.transport!=='SYNTHETIC_ONLY'||!iso(raw.expiresAt)||typeof raw.clock!=='function'||!sdkOpaqueId(raw.expectedSessionId)||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>10000)return fail();
   if(raw.bootstrap!==undefined){if(!refV1(raw.sessionBindingRef))return fail();this.#bootstrapSessionBindingHash=hash(boundedSdkObject(raw.sessionBindingRef,65536).value);if(isProxy(raw.bootstrap)||Object.getPrototypeOf(raw.bootstrap)!==SyntheticClaudeInstructionBootstrap.prototype)return fail();this.#bootstrap=raw.bootstrap;}this.#receiver=raw.receiver;this.#session=raw.expectedSessionId;this.#driver=raw.driver;this.#source=raw.current;this.#clock=raw.clock;this.#timeout=raw.timeoutMs;this.#bytes=raw.maxMessageBytes;this.#identities=raw.maxIdentities;this.#until=Date.parse(raw.expiresAt);
   this.#create=member(this.#driver,'create');this.#current=member(this.#source,'current');this.#ports();
   const now=this.#now();this.#envelope=freeze(readDispatchEnvelopeV1(boundedSdkObject(raw.envelope,maxSdkObjectBytes).value,now));if(this.#envelope.operation!=='START_SESSION')return fail();
   this.#until=Math.min(this.#until,Date.parse(this.#envelope.expiresAt));this.#contextDigest=hash(this.#envelope.context);this.#sessionDigest=hash(this.#session);this.#codec();
  }catch{return fail('SDK_FACTORY_CONFIG_INVALID');}
 }
 #codec(){return new ClaudeSdkMessageCodec({context:this.#envelope.context,expectedSessionId:this.#session,maxMessageBytes:this.#bytes,maxIdentities:this.#identities},{capture:()=>({state:'RECORDED'})});}
 #ports(){if(this.#bootstrap&&!ownerBootstrapMethodCurrent())return fail('SDK_FACTORY_CONTEXT_CHANGED');if(member(this.#driver,'transport')!=='SYNTHETIC_ONLY'||member(this.#source,'transport')!=='SYNTHETIC_ONLY'||member(this.#driver,'create')!==this.#create||member(this.#source,'current')!==this.#current||typeof this.#create!=='function'||typeof this.#current!=='function')fail('SDK_FACTORY_CONTEXT_CHANGED');}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)return fail('SDK_FACTORY_CLOCK_INVALID');this.#last=n;return n;}
 #call(call:Call,cleanup=false){
  if(!call||isProxy(call)||!recordV1(call,['signal','expiresAt']))return fail();
  // clock/current 등 외부 callback보다 먼저 검산한 원 호출 값을 고정한다.
  const snapshot=Object.freeze({signal:Object.getOwnPropertyDescriptor(call,'signal')!.value as AbortSignal,expiresAt:Object.getOwnPropertyDescriptor(call,'expiresAt')!.value as string});
  if(!iso(snapshot.expiresAt)||isProxy(snapshot.signal))return fail();
  try{Reflect.apply(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')!.get!,snapshot.signal,[]);}catch{return fail();}
  if(!cleanup)this.#ports();const now=this.#now(),end=Math.min(now+this.#timeout,Date.parse(snapshot.expiresAt),cleanup?Infinity:this.#until);if(snapshot.signal.aborted||now>=end)return fail('SDK_FACTORY_EXPIRED');return{end,call:snapshot};
 }
 #guard(signal:AbortSignal,end:number){this.#ports();if(this.#closed||signal.aborted)return fail('SDK_FACTORY_CANCELLED');if(this.#now()>=Math.min(end,this.#until))return fail('SDK_FACTORY_EXPIRED');}
 #queryPorts(){
  this.#ports();const m=this.#methods;if(!m||member(this.#query,'transport')!=='SYNTHETIC_ONLY'||member(this.#query,'streamInput')!==m.stream||member(this.#query,Symbol.asyncIterator)!==m.iterate||member(this.#query,'interrupt')!==m.interrupt||member(this.#query,'close')!==m.close||member(this.#iterator,'next')!==m.next)fail('SDK_FACTORY_QUERY_CHANGED');
 }
 async #fresh(signal:AbortSignal,end:number,arm:()=>void){
  this.#guard(signal,end);const expected=Object.freeze({contextDigest:this.#contextDigest,sessionDigest:this.#sessionDigest,operation:'CREATE_QUERY',instructionDigest:hash(this.#attempt)});
  const value=await Reflect.apply(this.#current,this.#source,[expected,signal]);this.#guard(signal,end);const c=boundedSdkObject(value,65536).value;
  if(!recordV1(c,['transport','contextDigest','sessionDigest','operation','instructionDigest','checkedAt','expiresAt'])||c.transport!=='SYNTHETIC_ONLY'||c.contextDigest!==expected.contextDigest||c.sessionDigest!==expected.sessionDigest||c.operation!==expected.operation||c.instructionDigest!==expected.instructionDigest||!iso(c.checkedAt)||!iso(c.expiresAt)||Date.parse(c.checkedAt)>this.#now()||Date.parse(c.expiresAt)<=this.#now())return fail('SDK_FACTORY_CURRENT_INVALID');
  this.#until=Math.min(this.#until,Date.parse(c.expiresAt));arm();this.#guard(signal,end);
 }
 open(attemptId:string,call:Call):Promise<any>{
  try{
   if(!sdkOpaqueId(attemptId))return fail();
   if(this.#attempt!==null){if(this.#attempt!==attemptId)return fail('SDK_FACTORY_CONFLICT');if(this.#result)return Promise.resolve(this.#result);return this.#pending!;}
   if(this.#closed)return fail('SDK_FACTORY_CLOSED');const prepared=this.#call(call),end=prepared.end;call=prepared.call;this.#until=Math.min(this.#until,end);this.#attempt=attemptId;
   // 작업을 microtask로 시작해 동시 open보다 먼저 원 시도의 점유를 결박한다.
   this.#pending=Promise.resolve().then(()=>this.#open(call,end));return this.#pending;
  }catch(error){return Promise.reject(error);}
 }
 async #open(call:Call,end:number){
  const controller=new AbortController();this.#controller=controller;let timer:ReturnType<typeof setTimeout>|undefined;let rejectCancel!:(e:Error)=>void;
  const cancelled=new Promise<never>((_,reject)=>rejectCancel=reject);void cancelled.catch(()=>{});
  const cancel=()=>{controller.abort();rejectCancel(Error('SDK_FACTORY_CANCELLED'));};this.#cancel=cancel;
  const arm=()=>{if(timer)clearTimeout(timer);const remaining=Math.min(end,this.#until)-this.#now();if(remaining<=0){cancel();return;}timer=setTimeout(cancel,remaining);};
  let work:Promise<any>|null=null;
  try{
   EventTarget.prototype.addEventListener.call(call.signal,'abort',cancel,{once:true});if(call.signal.aborted)cancel();arm();
   work=Promise.resolve().then(async()=>{
    try{
     await this.#fresh(controller.signal,end,arm);
     const options=await readClaudeStartOptions(this.#receiver,this.#envelope,{clock:()=>this.#now(),check:()=>{this.#guard(controller.signal,end);return true;}});this.#guard(controller.signal,end);
     await this.#fresh(controller.signal,end,arm);
     const first=this.#bootstrap?await prepareBootstrap(this.#bootstrap,this.#attempt!,this,Object.freeze({signal:controller.signal,expiresAt:new Date(Math.min(end,this.#until)).toISOString()}),this.#envelope):null;if(first){this.#bootstrapInput=first.input;this.#until=Math.min(this.#until,Date.parse(first.expiresAt));arm();this.#guard(controller.signal,end);}
     const request=freeze({...(first?{input:first.input}:{}),transport:'SYNTHETIC_ONLY',options,context:this.#envelope.context,expectedSessionId:this.#session,contextDigest:this.#contextDigest,sessionDigest:this.#sessionDigest,attemptDigest:hash(this.#attempt),expiresAt:new Date(Math.min(end,this.#until)).toISOString(),...flags});
     this.#guard(controller.signal,end);this.#attempted=true;
     const created=Reflect.apply(this.#create,this.#driver,[request,controller.signal]);if(isProxy(created))return fail();const query=isPromise(created)?await created:created;
     // 늦은 원 Query도 cleanup 대상을 잃지 않는다. 일반 결과에는 절대 내보내지 않는다.
     this.#query=query;
     const close=member(query,'close');if(typeof close!=='function')return fail();
     const stream=member(query,'streamInput'),iterate=member(query,Symbol.asyncIterator),interrupt=member(query,'interrupt');if(member(query,'transport')!=='SYNTHETIC_ONLY'||[stream,iterate,interrupt].some(f=>typeof f!=='function'))return fail();
     this.#methods={close,stream,iterate,interrupt,next:()=>fail()};this.#guard(controller.signal,end);
     this.#iterator=Reflect.apply(iterate,query,[]);this.#methods.next=member(this.#iterator,'next');if(typeof this.#methods.next!=='function')return fail();this.#queryPorts();
     const codec=this.#codec();let total=0;
     while(true){
      this.#guard(controller.signal,end);this.#queryPorts();const pendingStep=Reflect.apply(this.#methods.next,this.#iterator,[]);if(isProxy(pendingStep))return fail();const step=isPromise(pendingStep)?await pendingStep:pendingStep;this.#guard(controller.signal,end);this.#queryPorts();
      if(!step||isProxy(step)||typeof step!=='object')return fail();const done=Object.getOwnPropertyDescriptor(step,'done'),value=Object.getOwnPropertyDescriptor(step,'value');if(!done||!('value'in done)||typeof done.value!=='boolean'||done.value||!value||!('value'in value))return fail();
      const bounded=boundedSdkObject(value.value,this.#bytes);total+=Buffer.byteLength(canonicalJson(bounded.value),'utf8');if(this.#prefix.length>=1024||total>2097152)return fail('SDK_FACTORY_PREFIX_LIMIT');
      const normalized=codec.normalize(bounded.value);if(normalized.kind!=='OBSERVED')return fail('SDK_FACTORY_OBSERVATION_UNKNOWN');this.#prefix.push(freeze(bounded.value));
      await this.#fresh(controller.signal,end,arm);this.#queryPorts();
      if(bounded.value.type==='system'&&bounded.value.subtype==='init')break;
     }
     this.#guard(controller.signal,end);this.#queryPorts();const factory=this;let iterated=false;
     const mux={async next(){factory.#queryPorts();if(factory.#prefix.length)return{done:false,value:factory.#prefix.shift()};const pendingStep=Reflect.apply(factory.#methods!.next,factory.#iterator,[]);if(isProxy(pendingStep))return fail();const step=isPromise(pendingStep)?await pendingStep:pendingStep;factory.#queryPorts();return step;}};
     const facade={transport:'SYNTHETIC_ONLY',async streamInput(input:AsyncIterable<unknown>){factory.#queryPorts();const value=await Reflect.apply(factory.#methods!.stream,factory.#query,[input]);factory.#queryPorts();return value;},[Symbol.asyncIterator](){if(iterated)return fail('SDK_FACTORY_ITERATOR_REUSED');iterated=true;return mux;},async interrupt(){factory.#queryPorts();const value=await Reflect.apply(factory.#methods!.interrupt,factory.#query,[]);factory.#queryPorts();return value;},close(){return factory.#closeRaw();}};
     // 같은 underlying Query에 this를 보존한다. facade의 함수와 원 iterator는 고정된다.
     this.#facade=facade;if(this.#bootstrap){await waitBootstrapYield(this.#bootstrap,this,facade,this.#envelope.envelopeHash);this.#guard(controller.signal,end);this.#queryPorts();}
     this.#owner=new SyntheticClaudeSdkSessionOwner({transport:'SYNTHETIC_ONLY',context:this.#envelope.context,expectedSessionId:this.#session,query:Object.freeze(facade),current:this.#source,clock:()=>this.#now(),expiresAt:new Date(Math.min(end,this.#until)).toISOString(),timeoutMs:this.#timeout,maxMessageBytes:this.#bytes,maxIdentities:this.#identities});
     if(this.#bootstrap)adoptOwnerBootstrap(this.#owner,this.#bootstrap,this,this.#envelope.envelopeHash);this.#guard(controller.signal,end);this.#queryPorts();return output('OWNER_AVAILABLE');
    }finally{
     if(controller.signal.aborted||this.#closed){this.#prefix.length=0;void this.#cleanup();}
    }
   });
   void work.catch(()=>{});
   this.#result=await Promise.race([work,cancelled]);this.#guard(controller.signal,end);return this.#result;
  }catch{
   this.#result=output(this.#attempted||this.#bootstrap&&bootstrapOutcomeUnknown(this.#bootstrap)?'UNKNOWN':'REJECTED');this.#prefix.length=0;controller.abort();void this.#cleanup();return this.#result;
  }finally{if(timer)clearTimeout(timer);EventTarget.prototype.removeEventListener.call(call.signal,'abort',cancel);this.#controller=null;this.#cancel=null;}
 }
 /** 내부 bootstrap의 원 생성 출처를 읽기만 한다. raw 자원·권위·새 상태를 반환하지 않는다. */
 verifyBootstrap(source:object,attemptDigest:string,startHash:string,contextDigest:string,sessionDigest:string,sessionBindingHash:string,stage:string,input?:object,target?:object,owner?:object,userBytes?:number):boolean{
  try{this.#ports();if(this.#closed||this.#controller?.signal.aborted||this.#bootstrap!==source||this.#attempt===null||hash(this.#attempt)!==attemptDigest||this.#envelope.envelopeHash!==startHash||this.#contextDigest!==contextDigest||this.#sessionDigest!==sessionDigest||this.#bootstrapSessionBindingHash!==sessionBindingHash||this.#now()>=this.#until)return false;
   if(stage==='INPUT')return Number.isSafeInteger(userBytes)&&Number(userBytes)>0&&Number(userBytes)<=this.#bytes;
   if(stage==='PREPARE')return !this.#attempted&&this.#query===null;
   if(stage==='ACTIVE')return this.#result===null||this.#result.state==='OWNER_AVAILABLE';
   if(stage!=='HANDOFF'&&stage!=='ADOPT')return false;this.#queryPorts();return this.#attempted&&this.#query!==null&&this.#bootstrapInput===input&&this.#facade===target&&(stage!=='ADOPT'||this.#owner===owner);
  }catch{return false;}
 }
 takeOwner(){if(this.#taken||this.#closed||this.#result?.state!=='OWNER_AVAILABLE')return null;this.#ports();this.#queryPorts();if(this.#now()>=this.#until)return fail('SDK_FACTORY_EXPIRED');this.#taken=true;return this.#owner;}
 #rawCloseCalled=false;#rawClosePromise:Promise<any>|null=null;
 #closeRaw(){
  if(this.#rawCloseCalled)return this.#rawClosePromise!;if(!this.#query)return Promise.resolve();
  let close:Function;try{close=this.#methods?.close??member(this.#query,'close');if(typeof close!=='function')return Promise.reject(Error('SDK_FACTORY_CLOSE_UNKNOWN'));}catch{return Promise.reject(Error('SDK_FACTORY_CLOSE_UNKNOWN'));}
  this.#rawCloseCalled=true;this.#prefix.length=0;this.#rawClosePromise=Promise.resolve().then(()=>Reflect.apply(close,this.#query,[]));void this.#rawClosePromise.catch(()=>{});return this.#rawClosePromise;
 }
 async #cleanup(){try{await this.#closeRaw();}catch{/* 원 handle 회수 불명은 일반 성공으로 바꾸지 않는다. */}}
 close(call:Call):Promise<any>{
  if(this.#closeResult)return Promise.resolve(this.#closeResult);if(this.#closePending)return this.#closePending;
  let end:number;try{const prepared=this.#call(call,true);end=prepared.end;call=prepared.call;}catch{return Promise.resolve(output('UNKNOWN'));}
  this.#closed=true;this.#cancel?.();this.#controller?.abort();this.#prefix.length=0;
  this.#closePending=(async()=>{let timer:ReturnType<typeof setTimeout>|undefined;const cancelled=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('SDK_FACTORY_CLOSE_TIMEOUT')),Math.max(1,end-this.#now()));});void cancelled.catch(()=>{});const abort=()=>rejectAbort?.(Error('SDK_FACTORY_CLOSED'));let rejectAbort:((e:Error)=>void)|undefined;
   const stopped=new Promise<never>((_,reject)=>rejectAbort=reject);void stopped.catch(()=>{});
   try{EventTarget.prototype.addEventListener.call(call.signal,'abort',abort,{once:true});if(call.signal.aborted)abort();
    if(!this.#query){this.#closeResult=output(this.#attempted?'UNKNOWN':'CLOSED');return this.#closeResult;}
    const ownerClose=this.#owner?.close(call);const work=ownerClose?Promise.all([ownerClose,this.#closeRaw()]).then(([result])=>result):this.#closeRaw();const result=await Promise.race([work,cancelled,stopped]);this.#closeResult=output(result?.state==='UNKNOWN'||call.signal.aborted||this.#now()>=end?'UNKNOWN':'CLOSE_METHOD_SETTLED');return this.#closeResult;
   }catch{this.#closeResult=output('UNKNOWN');return this.#closeResult;}finally{if(timer)clearTimeout(timer);EventTarget.prototype.removeEventListener.call(call.signal,'abort',abort);}
  })();return this.#closePending;
 }
}

const originalBootstrapVerifier=SyntheticClaudeSdkQueryFactory.prototype.verifyBootstrap;
/** 같은 내부 모듈들의 읽기 전용 출처 검사다. 임의 등록·상태 변경은 없다. */
export function verifyBootstrapFactory(factory:object,source:object,attemptDigest:string,startHash:string,contextDigest:string,sessionDigest:string,sessionBindingHash:string,stage:string,input?:object,target?:object,owner?:object,userBytes?:number):boolean{
 try{if(isProxy(factory)||Object.getPrototypeOf(factory)!==SyntheticClaudeSdkQueryFactory.prototype||member(factory,'verifyBootstrap')!==originalBootstrapVerifier||SyntheticClaudeSdkQueryFactory.prototype.verifyBootstrap!==originalBootstrapVerifier)return false;return Reflect.apply(originalBootstrapVerifier,factory,[source,attemptDigest,startHash,contextDigest,sessionDigest,sessionBindingHash,stage,input,target,owner,userBytes]);}catch{return false;}
}
