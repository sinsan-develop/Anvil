import {SyntheticClaudeInstructionBootstrap,consumeBootstrapForOwner} from './instruction-bootstrap.ts';
import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1} from '../../../../contracts/runtime/validation-v1.ts';
import {ClaudeSdkMessageCodec} from './codec.ts';
import {boundedSdkObject,sdkOpaqueId,maxSdkObjectBytes} from './schemas.ts';
type Call={signal:AbortSignal;expiresAt:string};
type Options={transport:'SYNTHETIC_ONLY';context:unknown;expectedSessionId:string;query:any;current:any;expiresAt:string;clock:()=>number;timeoutMs:number;maxMessageBytes:number;maxIdentities:number};
type Lane='input'|'observe'|'control';
type Task={controller:AbortController;parent:AbortSignal;end:number;timer:ReturnType<typeof setTimeout>|null;underlyingDone:boolean;externalDone:boolean;cleanup:boolean;cancel:(code:string)=>void};
type Instruction={digest:string;user:any;result:any|null;attempted:boolean};
const flags=Object.freeze({actualExecutionVerified:false,executionAuthorized:false,dispatched:false,workAccepted:false,ownership:'UNVERIFIED' as const});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=(code:string):never=>{throw Error(code);};
function member(object:any,key:PropertyKey):any{
 if(!object||typeof object!=='object'||isProxy(object))fail('SDK_OWNER_PORT_INVALID');let node=object;
 for(let depth=0;node&&depth<64;depth++){if(isProxy(node))fail('SDK_OWNER_PORT_INVALID');const d=Object.getOwnPropertyDescriptor(node,key);if(d){if(!('value'in d))fail('SDK_OWNER_PORT_INVALID');return d.value;}node=Object.getPrototypeOf(node);}
 fail('SDK_OWNER_PORT_INVALID');
}
function iso(v:unknown):v is string{return typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;}
function output(state:string,extra:Record<string,unknown>={}){return Object.freeze({state,...extra,...flags});}
/** 명시 합성 Query의 메모리 입력/관측 소비만 소유한다. SDK 생성·보호permit·실제전달ACK·서버claim·process회수는 제공하지 않는다. */
export class SyntheticClaudeSdkSessionOwner{
 readonly transport='SYNTHETIC_ONLY' as const;
 #query:any;#source:any;#iterator:any;#stream!:Function;#iterate!:Function;#next!:Function;#interrupt!:Function;#close!:Function;#current!:Function;
 #codec!:ClaudeSdkMessageCodec;#contextDigest!:string;#sessionDigest!:string;#until!:number;#clock!:()=>number;#last=-Infinity;#timeout!:number;#bytes!:number;
 #lanes=new Map<Lane,Task>();#instructions=new Map<string,Instruction>();#slot:any=null;#capturing:string|null=null;
 #closed=false;#inputBlocked=false;#stopping=false;#eof=false;#stopResult:any=null;#closeResult:any=null;#stopAttempted=false;#closeAttempted=false;
 constructor(options:Options){
  try{
   if(!options||isProxy(options)||options.transport!=='SYNTHETIC_ONLY'||!iso(options.expiresAt)||typeof options.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail('SDK_OWNER_CONFIG_INVALID');
   this.#query=options.query;this.#source=options.current;if(member(this.#query,'transport')!=='SYNTHETIC_ONLY'||member(this.#source,'transport')!=='SYNTHETIC_ONLY')fail('SDK_OWNER_PORT_INVALID');
   this.#stream=member(this.#query,'streamInput');this.#iterate=member(this.#query,Symbol.asyncIterator);this.#interrupt=member(this.#query,'interrupt');this.#close=member(this.#query,'close');this.#current=member(this.#source,'current');
   if([this.#stream,this.#iterate,this.#interrupt,this.#close,this.#current].some(f=>typeof f!=='function'))fail('SDK_OWNER_PORT_INVALID');
   const context=boundedSdkObject(options.context,maxSdkObjectBytes).value;this.#contextDigest=hash(context);this.#sessionDigest=hash(options.expectedSessionId);this.#until=Date.parse(options.expiresAt);this.#clock=options.clock;this.#timeout=options.timeoutMs;this.#bytes=options.maxMessageBytes;
   this.#codec=new ClaudeSdkMessageCodec({context:context as any,expectedSessionId:options.expectedSessionId,maxMessageBytes:options.maxMessageBytes,maxIdentities:options.maxIdentities},{capture:value=>{
    if(Object.hasOwn(value,'preparedUser')){if(this.#capturing===null||value.commandId!==this.#capturing||value.contextDigest!==this.#contextDigest||value.sessionDigest!==this.#sessionDigest||this.#slot!==null)fail('SDK_OWNER_CAPTURE_UNCERTAIN');this.#slot=value.preparedUser;}
    return{state:'RECORDED'};
   }});
   this.#iterator=Reflect.apply(this.#iterate,this.#query,[]);this.#next=member(this.#iterator,'next');if(typeof this.#next!=='function')fail('SDK_OWNER_PORT_INVALID');this.#ports();
  }catch{fail('SDK_OWNER_CONFIG_INVALID');}
 }
 #ports(){
  if(member(this.#query,'transport')!=='SYNTHETIC_ONLY'||member(this.#source,'transport')!=='SYNTHETIC_ONLY'||member(this.#query,'streamInput')!==this.#stream||member(this.#query,Symbol.asyncIterator)!==this.#iterate||member(this.#query,'interrupt')!==this.#interrupt||member(this.#query,'close')!==this.#close||member(this.#source,'current')!==this.#current||member(this.#iterator,'next')!==this.#next)fail('SDK_OWNER_CONTEXT_CHANGED');
 }
 #now(){const now=this.#clock();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime())||now<this.#last)fail('SDK_OWNER_CLOCK_INVALID');this.#last=now;return now;}
 #call(call:Call,cleanup:boolean){
  if(!call||isProxy(call)||!recordV1(call,['signal','expiresAt'])||!iso(call.expiresAt)||isProxy(call.signal))fail('SDK_OWNER_CALL_INVALID');
  try{Reflect.apply(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')!.get!,call.signal,[]);}catch{fail('SDK_OWNER_CALL_INVALID');}
  this.#ports();if(!cleanup&&this.#closed)fail('SDK_OWNER_CLOSED');const now=this.#now(),end=Math.min(now+this.#timeout,Date.parse(call.expiresAt),cleanup?Infinity:this.#until);
  if(call.signal.aborted)fail('SDK_OWNER_CANCELLED');if(now>=end)fail('SDK_OWNER_EXPIRED');return end;
 }
 #guard(task:Task,allowStopping=false){
  this.#ports();if(task.controller.signal.aborted||task.parent.aborted)fail('SDK_OWNER_CANCELLED');if(!task.cleanup&&(this.#closed||!allowStopping&&this.#stopping))fail('SDK_OWNER_CLOSED');
  if(this.#now()>=Math.min(task.end,task.cleanup?Infinity:this.#until))fail('SDK_OWNER_EXPIRED');
 }
 #arm(task:Task){if(task.timer)clearTimeout(task.timer);const remaining=Math.min(task.end,task.cleanup?Infinity:this.#until)-this.#now();if(remaining<=0){task.cancel('SDK_OWNER_EXPIRED');return;}task.timer=setTimeout(()=>task.cancel('SDK_OWNER_TIMEOUT'),Math.max(1,Math.ceil(remaining)));}
 #shrink(until:number){this.#until=Math.min(this.#until,until);for(const task of this.#lanes.values())if(!task.cleanup)this.#arm(task);}
 async #run<T>(lane:Lane,call:Call,work:(task:Task)=>Promise<T>,cleanup=false,allowStopping=false):Promise<T>{
  if(this.#lanes.has(lane))fail('SDK_OWNER_BUSY');const end=this.#call(call,cleanup),controller=new AbortController();let rejectCancel:((e:Error)=>void)|undefined;
  const task:Task={controller,parent:call.signal,end,timer:null,underlyingDone:true,externalDone:false,cleanup,cancel:code=>{controller.abort();rejectCancel?.(Error(code));}};
  const listener=()=>task.cancel('SDK_OWNER_CANCELLED');const release=()=>{if(task.underlyingDone&&task.externalDone&&this.#lanes.get(lane)===task)this.#lanes.delete(lane);};
  this.#lanes.set(lane,task);
  try{
   const cancelled=new Promise<never>((_,reject)=>{rejectCancel=reject;EventTarget.prototype.addEventListener.call(call.signal,'abort',listener,{once:true});});
   void cancelled.catch(()=>{});this.#arm(task);const underlying=Promise.resolve().then(()=>{this.#guard(task,allowStopping);return work(task);});task.underlyingDone=false;
   void underlying.then(()=>{task.underlyingDone=true;release();},()=>{task.underlyingDone=true;release();});
   const value=await Promise.race([underlying,cancelled]);this.#guard(task,allowStopping);return value;
  }finally{task.externalDone=true;if(task.timer)clearTimeout(task.timer);EventTarget.prototype.removeEventListener.call(call.signal,'abort',listener);controller.abort();release();}
 }
 async #fresh(task:Task,operation:string,instructionDigest:string|null){
  this.#guard(task,operation==='INTERRUPT');const expected={contextDigest:this.#contextDigest,sessionDigest:this.#sessionDigest,operation,instructionDigest};
  const raw=await Reflect.apply(this.#current,this.#source,[Object.freeze(expected),task.controller.signal]);this.#guard(task,operation==='INTERRUPT');
  const c=boundedSdkObject(raw,65536).value;
  if(!recordV1(c,['transport','contextDigest','sessionDigest','operation','instructionDigest','checkedAt','expiresAt'])||c.transport!=='SYNTHETIC_ONLY'||c.contextDigest!==expected.contextDigest||c.sessionDigest!==expected.sessionDigest||c.operation!==operation||c.instructionDigest!==instructionDigest||!iso(c.checkedAt)||!iso(c.expiresAt)||Date.parse(c.checkedAt)>this.#now()||Date.parse(c.expiresAt)<=this.#now())fail('SDK_OWNER_CURRENT_INVALID');
  this.#shrink(Date.parse(c.expiresAt));this.#guard(task,operation==='INTERRUPT');
 }
 /** 내부 bridge의 기대 identity/고정 기한만 비교한다. 현재 권위·새 수명·SDK 효과는 만들지 않는다. */
 matchesIdentity(contextDigest:string,sessionDigest:string,deadline:number,unusedCommandId?:string):boolean{
  try{this.#ports();const now=this.#now();return !this.#closed&&!this.#stopping&&!this.#inputBlocked&&contextDigest===this.#contextDigest&&sessionDigest===this.#sessionDigest&&Number.isSafeInteger(deadline)&&now<deadline&&deadline<=this.#until&&(unusedCommandId===undefined||sdkOpaqueId(unusedCommandId)&&!this.#instructions.has(unusedCommandId));}catch{return false;}
 }
 /** 실제 bootstrap yield 근거를 원 Query와 이 owner 장부에 단 한 번 인계한다. */
 adoptBootstrap(source:SyntheticClaudeInstructionBootstrap,identity:object,startEnvelopeHash:string){
  this.#ports();if(this.#closed||this.#now()>=this.#until||isProxy(source)||Object.getPrototypeOf(source)!==SyntheticClaudeInstructionBootstrap.prototype)fail('SDK_OWNER_BOOTSTRAP_INVALID');
  const proof=consumeBootstrapForOwner(source,this.#contextDigest,this.#sessionDigest,identity,this.#query,startEnvelopeHash,this);
  if(this.#instructions.has(proof.commandId))fail('SDK_OWNER_INSTRUCTION_CONFLICT');this.#capturing=proof.commandId;this.#slot=null;let prepared:any;
  try{prepared=this.#codec.prepareUser(proof.commandId,proof.user);}finally{this.#capturing=null;this.#slot=null;}
  if(prepared.kind!=='USER_PREPARED'||prepared.payloadDigest!==proof.userDigest)fail('SDK_OWNER_BOOTSTRAP_INVALID');
  const result=output('BOOTSTRAP_INPUT_YIELDED_ONLY',{instructionDigest:hash(proof.commandId),payloadDigest:proof.userDigest});this.#instructions.set(proof.commandId,{digest:proof.userDigest,user:null,result,attempted:true});return result;
 }
 async sendInstruction(instructionId:string,rawUser:unknown,call:Call){
  this.#ports();if(this.#closed)fail('SDK_OWNER_CLOSED');if(!sdkOpaqueId(instructionId))fail('SDK_OWNER_INSTRUCTION_INVALID');
  const input=boundedSdkObject(rawUser,this.#bytes),prior=this.#instructions.get(instructionId);
  if(prior){if(prior.digest!==input.digest)fail('SDK_OWNER_INSTRUCTION_CONFLICT');if(prior.result)return prior.result;fail('SDK_OWNER_BUSY');}
  if(this.#inputBlocked||this.#stopping)fail('SDK_OWNER_INPUT_BLOCKED');if(this.#lanes.has('input'))fail('SDK_OWNER_BUSY');
  let prepared:any;this.#capturing=instructionId;this.#slot=null;
  try{prepared=this.#codec.prepareUser(instructionId,input.value);}finally{this.#capturing=null;}
  const entry:Instruction={digest:input.digest,user:this.#slot,result:null,attempted:false};this.#slot=null;
  if(prepared.kind!=='USER_PREPARED'||!entry.user)return output(prepared.kind==='REJECTED'?'REJECTED':'UNKNOWN',{code:prepared.code??'SDK_OWNER_CAPTURE_UNCERTAIN'});
  this.#instructions.set(instructionId,entry);const instructionDigest=hash(instructionId);
  try{
   await this.#run('input',call,async task=>{
    try{await this.#fresh(task,'SEND',instructionDigest);let yielded=false;const owner=this,held=entry.user;
     const stream:AsyncIterable<unknown>={[Symbol.asyncIterator](){let step=0;return{next:async()=>{owner.#guard(task);if(step++)return{done:true,value:undefined};if(yielded)fail('SDK_OWNER_INPUT_REUSED');yielded=true;return{done:false,value:held};}};}};
     this.#guard(task);entry.attempted=true;await Reflect.apply(this.#stream,this.#query,[stream]);this.#guard(task);if(!yielded)fail('SDK_OWNER_INPUT_NOT_CONSUMED');
    }finally{entry.user=null;}
   });
   entry.result=output('INPUT_METHOD_SETTLED',{instructionDigest,payloadDigest:entry.digest});return entry.result;
  }catch{
   entry.result=output(entry.attempted?'UNKNOWN':'REJECTED',{instructionDigest,payloadDigest:entry.digest,code:entry.attempted?'SDK_OWNER_INPUT_OUTCOME_UNKNOWN':'SDK_OWNER_INPUT_NOT_SENT'});
   if(entry.attempted)this.#inputBlocked=true;return entry.result;
  }finally{entry.user=null;}
 }
 async observe(call:Call){
  this.#ports();if(this.#closed)fail('SDK_OWNER_CLOSED');if(this.#eof)return output('EOF');
  try{return await this.#run('observe',call,async task=>{
   await this.#fresh(task,'OBSERVE',null);const raw=await Reflect.apply(this.#next,this.#iterator,[]);this.#guard(task);
   if(!raw||isProxy(raw)||typeof raw!=='object')return fail('SDK_OWNER_ITERATOR_INVALID');const done=Object.getOwnPropertyDescriptor(raw,'done'),value=Object.getOwnPropertyDescriptor(raw,'value');
   if(!done||!('value'in done)||typeof done.value!=='boolean'||value&&!('value'in value))return fail('SDK_OWNER_ITERATOR_INVALID');
   if(done.value){this.#eof=true;return output('EOF');}if(!value)return fail('SDK_OWNER_ITERATOR_INVALID');
   const observation=this.#codec.normalize(value.value);this.#guard(task);return output(observation.kind==='OBSERVED'?'OBSERVED':observation.kind==='UNSUPPORTED'?'UNSUPPORTED':'UNKNOWN',{correlation:'SESSION_ONLY',observation});
  });}catch(error){if(error instanceof Error&&error.message==='SDK_OWNER_BUSY')throw error;return output('UNKNOWN',{code:'SDK_OWNER_OBSERVATION_UNKNOWN'});}
 }
 async requestStop(call:Call){
  this.#ports();if(this.#closed)fail('SDK_OWNER_CLOSED');if(this.#stopResult)return this.#stopResult;if(this.#lanes.has('control'))fail('SDK_OWNER_BUSY');this.#stopping=true;
  try{await this.#run('control',call,async task=>{await this.#fresh(task,'INTERRUPT',null);this.#guard(task,true);this.#stopAttempted=true;await Reflect.apply(this.#interrupt,this.#query,[]);this.#guard(task,true);},false,true);this.#stopResult=output('REQUESTED',{methodInvoked:true});}
  catch{this.#stopResult=output('UNKNOWN',{methodInvoked:this.#stopAttempted,code:'SDK_OWNER_STOP_UNCONFIRMED'});}return this.#stopResult;
 }
 async close(call:Call){
  this.#closed=true;for(const [lane,task] of this.#lanes)if(lane!=='control')task.cancel('SDK_OWNER_CLOSED');
  if(this.#closeResult)return this.#closeResult;if(this.#lanes.has('control'))return output('UNKNOWN',{methodInvoked:false,code:'SDK_OWNER_CONTROL_PENDING'});
  try{await this.#run('control',call,async task=>{this.#guard(task,true);this.#closeAttempted=true;await Reflect.apply(this.#close,this.#query,[]);this.#guard(task,true);},true,true);this.#closeResult=output('REQUEST_SETTLED',{methodInvoked:true});}
  catch{this.#closeResult=output('UNKNOWN',{methodInvoked:this.#closeAttempted,code:'SDK_OWNER_CLOSE_UNCONFIRMED'});}return this.#closeResult;
 }
}

const originalOwnerBootstrapAdoption=SyntheticClaudeSdkSessionOwner.prototype.adoptBootstrap;
export function ownerBootstrapMethodCurrent():boolean{return SyntheticClaudeSdkSessionOwner.prototype.adoptBootstrap===originalOwnerBootstrapAdoption;}
/** 원 private owner에만 소비 근거를 인계한다. 모듈 초기화 시 다른 클래스 값을 읽지 않는다. */
export function adoptOwnerBootstrap(owner:SyntheticClaudeSdkSessionOwner,source:SyntheticClaudeInstructionBootstrap,factory:object,startHash:string){
 if(isProxy(owner)||Object.getPrototypeOf(owner)!==SyntheticClaudeSdkSessionOwner.prototype||member(owner,'adoptBootstrap')!==originalOwnerBootstrapAdoption||!ownerBootstrapMethodCurrent())fail('SDK_OWNER_BOOTSTRAP_INVALID');return Reflect.apply(originalOwnerBootstrapAdoption,owner,[source,factory,startHash]);
}
