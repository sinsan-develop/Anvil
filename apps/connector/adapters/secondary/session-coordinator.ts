import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticMaterialReceiver} from '../../runtime/execution-material-receiver.ts';
import {SyntheticClaudeSdkQueryFactory} from './sdk-query-factory.ts';
import {SyntheticClaudeSdkSessionOwner} from './sdk-session-owner.ts';
import {SyntheticClaudeInstructionBridge} from './instruction-bridge.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkOpaqueId} from './schemas.ts';
type Call={signal:AbortSignal;expiresAt:string};
type Options={transport:'SYNTHETIC_ONLY';receiver:SyntheticMaterialReceiver;envelope:unknown;expectedSessionId:string;sessionBindingRef:unknown;driver:any;current:any;clock:()=>number;expiresAt:string;timeoutMs:number;maxMessageBytes:number;maxIdentities:number};
type Selection={receiver:SyntheticMaterialReceiver;envelope:unknown;grantRef:unknown;expiresAt:string};
type Task={controller:AbortController};
type SendEntry={binding:string;bridge:SyntheticClaudeInstructionBridge;pending:Promise<any>|null;result:any;called:boolean};
const original={open:SyntheticClaudeSdkQueryFactory.prototype.open,take:SyntheticClaudeSdkQueryFactory.prototype.takeOwner,close:SyntheticClaudeSdkQueryFactory.prototype.close,send:SyntheticClaudeInstructionBridge.prototype.send,observe:SyntheticClaudeSdkSessionOwner.prototype.observe,stop:SyntheticClaudeSdkSessionOwner.prototype.requestStop};
const flags=Object.freeze({actualExecutionVerified:false,executionAuthorized:false,dispatched:false,workAccepted:false,ownership:'UNVERIFIED' as const});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const output=(state:string,extra:Record<string,unknown>={})=>Object.freeze({state,...extra,...flags});
const fail=():never=>{throw Error('CLAUDE_SESSION_UNAVAILABLE');};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
function member(value:any,key:PropertyKey):any{
 if(!value||typeof value!=='object'||isProxy(value))return fail();for(let node=value,depth=0;node&&depth<64;node=Object.getPrototypeOf(node),depth++){if(isProxy(node))return fail();const d=Object.getOwnPropertyDescriptor(node,key);if(d){if(!('value'in d))return fail();return d.value;}}return fail();
}
/** 합성 START부터 원 owner의 입력/관측/정리까지 수명과 경합만 조정한다. 실제 세션/실행 권위는 만들지 않는다. */
export class SyntheticClaudeSessionCoordinator{
 readonly transport='SYNTHETIC_ONLY' as const;
 #factory!:SyntheticClaudeSdkQueryFactory;#owner:SyntheticClaudeSdkSessionOwner|null=null;#envelope:any;#session!:string;#bindingRef:any;#clock!:()=>number;#last=-Infinity;#until!:number;#sessionEnd!:number;#timeout!:number;
 #driver:any;#source:any;#create!:Function;#current!:Function;#phase='NEW';#terminal:string|null=null;#inputBlocked=false;#tasks=new Set<Task>();
 #attempt:string|null=null;#startPending:Promise<any>|null=null;#startResult:any=null;#sends=new Map<string,SendEntry>();#observing=false;#stopPending:Promise<any>|null=null;#stopResult:any=null;#closePending:Promise<any>|null=null;#closeResult:any=null;
 constructor(raw:Options){
  try{
   if(!raw||isProxy(raw)||!recordV1(raw,['transport','receiver','envelope','expectedSessionId','sessionBindingRef','driver','current','clock','expiresAt','timeoutMs','maxMessageBytes','maxIdentities'])||raw.transport!=='SYNTHETIC_ONLY'||!sdkOpaqueId(raw.expectedSessionId)||!refV1(raw.sessionBindingRef)||!isoV1(raw.expiresAt)||typeof raw.clock!=='function'||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>10000)return fail();
   this.#session=raw.expectedSessionId;this.#bindingRef=freeze(boundedSdkObject(raw.sessionBindingRef,65536).value);this.#clock=raw.clock;this.#timeout=raw.timeoutMs;this.#driver=raw.driver;this.#source=raw.current;this.#create=member(raw.driver,'create');this.#current=member(raw.current,'current');
   const now=this.#now();this.#envelope=freeze(readDispatchEnvelopeV1(boundedSdkObject(raw.envelope,maxSdkObjectBytes).value,now));if(this.#envelope.operation!=='START_SESSION')return fail();this.#until=Math.min(Date.parse(raw.expiresAt),Date.parse(this.#envelope.expiresAt));this.#sessionEnd=this.#until;
   this.#factory=new SyntheticClaudeSdkQueryFactory({transport:'SYNTHETIC_ONLY',receiver:raw.receiver,envelope:this.#envelope,expectedSessionId:this.#session,driver:this.#driver,current:this.#source,clock:()=>this.#now(),expiresAt:new Date(this.#until).toISOString(),timeoutMs:this.#timeout,maxMessageBytes:raw.maxMessageBytes,maxIdentities:raw.maxIdentities});this.#ports();
  }catch{return fail();}
 }
 #ports(){
  if(member(this.#factory,'open')!==original.open||member(this.#factory,'takeOwner')!==original.take||member(this.#factory,'close')!==original.close||SyntheticClaudeSdkQueryFactory.prototype.open!==original.open||SyntheticClaudeSdkQueryFactory.prototype.takeOwner!==original.take||SyntheticClaudeSdkQueryFactory.prototype.close!==original.close||member(this.#driver,'transport')!=='SYNTHETIC_ONLY'||member(this.#source,'transport')!=='SYNTHETIC_ONLY'||member(this.#driver,'create')!==this.#create||member(this.#source,'current')!==this.#current||SyntheticClaudeInstructionBridge.prototype.send!==original.send)return fail();
  if(this.#owner&&(Object.getPrototypeOf(this.#owner)!==SyntheticClaudeSdkSessionOwner.prototype||member(this.#owner,'observe')!==original.observe||member(this.#owner,'requestStop')!==original.stop))return fail();
 }
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)return fail();this.#last=n;return n;}
 #snapshot(call:Call){
  if(!call||isProxy(call)||!recordV1(call,['signal','expiresAt']))return fail();const fixed=Object.freeze({signal:Object.getOwnPropertyDescriptor(call,'signal')!.value as AbortSignal,expiresAt:Object.getOwnPropertyDescriptor(call,'expiresAt')!.value as string});if(!isoV1(fixed.expiresAt)||isProxy(fixed.signal))return fail();try{Reflect.apply(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')!.get!,fixed.signal,[]);}catch{return fail();}return fixed;
 }
 #end(call:Call,cleanup=false,selection=Infinity){const now=this.#now(),end=Math.min(now+this.#timeout,Date.parse(call.expiresAt),cleanup?Infinity:this.#sessionEnd,selection);if(call.signal.aborted||now>=end)return fail();return end;}
 #live(end:number){this.#ports();if(this.#terminal||this.#now()>=end)return fail();}
 #ready(){if(this.#terminal||this.#phase!=='READY'||!this.#owner)return fail();this.#ports();}
 async #invoke<T>(call:Call,end:number,work:(fixed:Call)=>Promise<T>,cleanup=false):Promise<T>{
  const controller=new AbortController(),task={controller};let timer:ReturnType<typeof setTimeout>|undefined;const abort=()=>controller.abort();this.#tasks.add(task);
  try{
   EventTarget.prototype.addEventListener.call(call.signal,'abort',abort,{once:true});if(call.signal.aborted)abort();const remaining=end-this.#now();if(remaining<=0)abort();else timer=setTimeout(abort,remaining);
   if(!cleanup)this.#live(end);if(controller.signal.aborted)return fail();const result=await work(Object.freeze({signal:controller.signal,expiresAt:new Date(end).toISOString()}));
   if(!cleanup)this.#live(end);if(controller.signal.aborted||this.#now()>=end)return fail();return result;
  }finally{if(timer)clearTimeout(timer);EventTarget.prototype.removeEventListener.call(call.signal,'abort',abort);controller.abort();this.#tasks.delete(task);}
 }
 start(attemptId:string,call:Call):Promise<any>{
  try{
   if(this.#terminal)return Promise.resolve(output('REJECTED'));if(!sdkOpaqueId(attemptId))return fail();const fixed=this.#snapshot(call);
   if(this.#attempt!==null){if(this.#attempt!==attemptId)return fail();return this.#startResult?Promise.resolve(this.#startResult):this.#startPending!;}
   this.#ports();const end=this.#end(fixed);this.#sessionEnd=Math.min(this.#sessionEnd,end);this.#attempt=attemptId;this.#phase='STARTING';
   this.#startPending=Promise.resolve().then(async()=>{
    try{const result=await this.#invoke(fixed,end,async inner=>{
     const raw=await Reflect.apply(original.open,this.#factory,[attemptId,inner]);this.#live(end);
     if(raw.state!=='OWNER_AVAILABLE'){this.#phase=raw.state==='REJECTED'?'START_REJECTED':'START_UNKNOWN';return output(raw.state==='REJECTED'?'REJECTED':'UNKNOWN');}
     const owner=Reflect.apply(original.take,this.#factory,[]);if(!owner||isProxy(owner)||Object.getPrototypeOf(owner)!==SyntheticClaudeSdkSessionOwner.prototype)return fail();this.#owner=owner;this.#ports();this.#live(end);this.#phase='READY';return output('READY',{attemptDigest:hash(attemptId)});
    });this.#startResult=result;return result;}
    catch{if(!this.#terminal)this.#phase='START_UNKNOWN';this.#startResult=output('UNKNOWN');return this.#startResult;}
   });return this.#startPending;
  }catch{return Promise.resolve(output('REJECTED'));}
 }
 send(raw:Selection,call:Call):Promise<any>{
  try{
   const fixed=this.#snapshot(call);this.#ready();if(!raw||isProxy(raw)||!recordV1(raw,['receiver','envelope','grantRef','expiresAt'])||!isoV1(raw.expiresAt)||!refV1(raw.grantRef))return fail();
   const selected={receiver:raw.receiver,envelope:freeze(readDispatchEnvelopeV1(boundedSdkObject(raw.envelope,maxSdkObjectBytes).value,this.#now())),grantRef:freeze(boundedSdkObject(raw.grantRef,65536).value),expiresAt:raw.expiresAt};const e=selected.envelope;
   if(e.operation!=='SEND_INSTRUCTION'||hash(e.context)!==hash(this.#envelope.context)||hash(e.executorRegistrationRef)!==hash(this.#envelope.executorRegistrationRef)||hash(e.payload.sessionBindingRef)!==hash(this.#bindingRef))return fail();
   const binding=hash({envelopeHash:e.envelopeHash,grantRef:selected.grantRef,selectionExpiresAt:selected.expiresAt,callExpiresAt:fixed.expiresAt});const prior=this.#sends.get(e.commandId);if(prior){if(prior.binding!==binding)return fail();return prior.result?Promise.resolve(prior.result):prior.pending!;}
   if(this.#inputBlocked||this.#sends.size>=1024)return fail();const end=this.#end(fixed,false,Date.parse(selected.expiresAt));this.#live(end);
   const bridge=new SyntheticClaudeInstructionBridge({transport:'SYNTHETIC_ONLY',receiver:selected.receiver,owner:this.#owner!,envelope:e,expectedSessionId:this.#session,grantRef:selected.grantRef,selectionExpiresAt:selected.expiresAt,expiresAt:new Date(this.#sessionEnd).toISOString(),clock:()=>this.#now(),timeoutMs:this.#timeout});
   const entry:SendEntry={binding,bridge,pending:null,result:null,called:false};this.#sends.set(e.commandId,entry);
   entry.pending=Promise.resolve().then(async()=>{
    try{const result=await this.#invoke(fixed,end,inner=>{this.#ready();entry.called=true;return Reflect.apply(original.send,bridge,[inner]);});if(result.state==='UNKNOWN')this.#inputBlocked=true;entry.result=result;return result;}
    catch{if(entry.called)this.#inputBlocked=true;entry.result=output(entry.called?'UNKNOWN':'REJECTED');return entry.result;}
   });return entry.pending;
  }catch{return Promise.resolve(output('REJECTED'));}
 }
 observe(call:Call):Promise<any>{
  try{const fixed=this.#snapshot(call);this.#ready();if(this.#observing)return fail();const end=this.#end(fixed);this.#observing=true;
   return this.#invoke(fixed,end,inner=>Reflect.apply(original.observe,this.#owner!,[inner])).catch(()=>output('UNKNOWN')).finally(()=>{this.#observing=false;});
  }catch{return Promise.resolve(output('REJECTED'));}
 }
 requestStop(call:Call):Promise<any>{
  if(this.#terminal)return Promise.resolve(output('REJECTED'));if(!this.#owner)return this.#finish(call,'STOPPED_BEFORE_HANDOFF');
  try{const fixed=this.#snapshot(call);this.#ready();if(this.#stopResult)return Promise.resolve(this.#stopResult);if(this.#stopPending)return this.#stopPending;const end=this.#end(fixed);this.#inputBlocked=true;
   this.#stopPending=Promise.resolve().then(async()=>{try{this.#stopResult=await this.#invoke(fixed,end,inner=>Reflect.apply(original.stop,this.#owner!,[inner]));}catch{this.#stopResult=output('UNKNOWN');}return this.#stopResult;});return this.#stopPending;
  }catch{return Promise.resolve(output('REJECTED'));}
 }
 close(call:Call){return this.#finish(call,'CLOSED');}
 disconnect(call:Call){return this.#finish(call,'DISCONNECTED');}
 #finish(call:Call,reason:string):Promise<any>{
  if(this.#closeResult)return Promise.resolve(this.#closeResult);if(this.#closePending)return this.#closePending;this.#terminal??=reason;this.#inputBlocked=true;for(const task of this.#tasks)task.controller.abort();
  try{const fixed=this.#snapshot(call),end=this.#end(fixed,true);
   this.#closePending=Promise.resolve().then(async()=>{
    try{const result=await this.#invoke(fixed,end,inner=>Reflect.apply(original.close,this.#factory,[inner]),true);this.#closeResult=output(result.state==='UNKNOWN'?'UNKNOWN':result.state,{lifecycle:this.#terminal,interruptInvoked:false});}
    catch{this.#closeResult=output('UNKNOWN',{lifecycle:this.#terminal,interruptInvoked:false});}return this.#closeResult;
   });return this.#closePending;
  }catch{return Promise.resolve(output('UNKNOWN',{lifecycle:this.#terminal,interruptInvoked:false}));}
 }
}
