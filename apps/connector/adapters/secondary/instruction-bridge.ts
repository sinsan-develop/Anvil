import {isProxy,isUint8Array} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticMaterialReceiver} from '../../runtime/execution-material-receiver.ts';
import {SyntheticClaudeSdkSessionOwner} from './sdk-session-owner.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkOpaqueId} from './schemas.ts';
type Call={signal:AbortSignal;expiresAt:string};
type Options={transport:'SYNTHETIC_ONLY';receiver:SyntheticMaterialReceiver;owner:SyntheticClaudeSdkSessionOwner;envelope:unknown;expectedSessionId:string;grantRef:unknown;selectionExpiresAt:string;expiresAt:string;clock:()=>number;timeoutMs:number};
type Entry={binding:string;end:number;pending:Promise<any>|null;result:any;invoked:boolean;workDone:boolean;externalDone:boolean;bodyHash:string|null;receiptRef:any};
type Ledger={entries:Map<string,Entry>;active:Entry|null;blocked:boolean};
const ledgers=new WeakMap<SyntheticClaudeSdkSessionOwner,Ledger>();
const originalRead=SyntheticMaterialReceiver.prototype.instruction,originalSend=SyntheticClaudeSdkSessionOwner.prototype.sendInstruction,originalIdentity=SyntheticClaudeSdkSessionOwner.prototype.matchesIdentity;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const flags=Object.freeze({actualExecutionVerified:false,executionAuthorized:false,dispatched:false,workAccepted:false,ownership:'UNVERIFIED' as const});
const fail=():never=>{throw Error('CLAUDE_INSTRUCTION_UNAVAILABLE');};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
function member(value:any,key:PropertyKey):any{
 if(!value||typeof value!=='object'||isProxy(value))return fail();for(let node=value,depth=0;node&&depth<64;node=Object.getPrototypeOf(node),depth++){if(isProxy(node))return fail();const d=Object.getOwnPropertyDescriptor(node,key);if(d){if(!('value'in d))return fail();return d.value;}}return fail();
}
/** 내구 수신된 SEND 문장을 합성 owner에만 연결한다. 선택·수신·메서드 정착은 실행 권위가 아니다. */
export class SyntheticClaudeInstructionBridge{
 readonly transport='SYNTHETIC_ONLY' as const;
 #receiver!:SyntheticMaterialReceiver;#owner!:SyntheticClaudeSdkSessionOwner;#store:any;#exclusive!:Function;#envelope:any;#session!:string;#grant:any;#selection!:string;#expires!:string;#clock!:()=>number;#timeout!:number;#last=-Infinity;#contextDigest!:string;#sessionDigest!:string;#until!:number;
 constructor(raw:Options){
  try{
   if(!raw||isProxy(raw)||!recordV1(raw,['transport','receiver','owner','envelope','expectedSessionId','grantRef','selectionExpiresAt','expiresAt','clock','timeoutMs'])||raw.transport!=='SYNTHETIC_ONLY'||!sdkOpaqueId(raw.expectedSessionId)||!isoV1(raw.selectionExpiresAt)||!isoV1(raw.expiresAt)||!refV1(raw.grantRef)||typeof raw.clock!=='function'||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>10000)return fail();
   this.#receiver=raw.receiver;this.#owner=raw.owner;this.#session=raw.expectedSessionId;this.#grant=freeze(boundedSdkObject(raw.grantRef,65536).value);this.#selection=raw.selectionExpiresAt;this.#expires=raw.expiresAt;this.#clock=raw.clock;this.#timeout=raw.timeoutMs;
   if(isProxy(this.#receiver)||Object.getPrototypeOf(this.#receiver)!==SyntheticMaterialReceiver.prototype||isProxy(this.#owner)||Object.getPrototypeOf(this.#owner)!==SyntheticClaudeSdkSessionOwner.prototype)return fail();
   this.#store=member(this.#receiver,'store');this.#exclusive=member(this.#store,'exclusive');this.#ports();
   const now=this.#now();this.#envelope=freeze(readDispatchEnvelopeV1(boundedSdkObject(raw.envelope,maxSdkObjectBytes).value,now));if(this.#envelope.operation!=='SEND_INSTRUCTION')return fail();this.#contextDigest=hash(this.#envelope.context);this.#sessionDigest=hash(this.#session);this.#until=Math.min(Date.parse(this.#expires),Date.parse(this.#selection),Date.parse(this.#envelope.expiresAt));
  }catch{return fail();}
 }
 #ports(){
  if(isProxy(this.#receiver)||Object.getPrototypeOf(this.#receiver)!==SyntheticMaterialReceiver.prototype||isProxy(this.#owner)||Object.getPrototypeOf(this.#owner)!==SyntheticClaudeSdkSessionOwner.prototype||member(this.#receiver,'instruction')!==originalRead||SyntheticMaterialReceiver.prototype.instruction!==originalRead||member(this.#owner,'sendInstruction')!==originalSend||SyntheticClaudeSdkSessionOwner.prototype.sendInstruction!==originalSend||member(this.#owner,'matchesIdentity')!==originalIdentity||SyntheticClaudeSdkSessionOwner.prototype.matchesIdentity!==originalIdentity||member(this.#receiver,'store')!==this.#store||member(this.#store,'exclusive')!==this.#exclusive||member(this.#store,'transport')!=='SYNTHETIC_ONLY')return fail();
 }
 #now(){const now=this.#clock();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime())||now<this.#last)return fail();this.#last=now;return now;}
 #snapshot(call:Call){
  if(!call||isProxy(call)||!recordV1(call,['signal','expiresAt']))return fail();const fixed=Object.freeze({signal:Object.getOwnPropertyDescriptor(call,'signal')!.value as AbortSignal,expiresAt:Object.getOwnPropertyDescriptor(call,'expiresAt')!.value as string});
  if(!isoV1(fixed.expiresAt)||isProxy(fixed.signal))return fail();try{Reflect.apply(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')!.get!,fixed.signal,[]);}catch{return fail();}return fixed;
 }
 #guard(end:number,signal:AbortSignal,unused=false){this.#ports();if(signal.aborted||Reflect.apply(originalIdentity,this.#owner,[this.#contextDigest,this.#sessionDigest,end])!==true)return fail();const now=this.#now();this.#ports();if(signal.aborted||now>=end)return fail();readDispatchEnvelopeV1(this.#envelope,now);if(unused&&Reflect.apply(originalIdentity,this.#owner,[this.#contextDigest,this.#sessionDigest,end,this.#envelope.commandId])!==true)return fail();}
 #output(state:string,entry:Entry){return freeze({state,commandId:this.#envelope.commandId,envelopeHash:this.#envelope.envelopeHash,instructionRef:this.#envelope.payload.instructionRef,partsRef:this.#envelope.payload.partsRef,sessionBindingRef:this.#envelope.payload.sessionBindingRef,grantRef:this.#grant,materialReceiptRef:entry.receiptRef,contentHash:entry.bodyHash,...flags});}
 send(call:Call):Promise<any>{
  try{
   const fixed=this.#snapshot(call);this.#ports();let ledger=ledgers.get(this.#owner);if(!ledger){ledger={entries:new Map(),active:null,blocked:false};ledgers.set(this.#owner,ledger);}
   const binding=hash({envelopeHash:this.#envelope.envelopeHash,grantRef:this.#grant,selectionExpiresAt:this.#selection,expiresAt:this.#expires,contextDigest:this.#contextDigest,sessionDigest:this.#sessionDigest,callExpiresAt:fixed.expiresAt,timeoutMs:this.#timeout});
   const prior=ledger.entries.get(this.#envelope.commandId);if(prior){if(prior.binding!==binding)return fail();return prior.result?Promise.resolve(prior.result):prior.pending!;}
   if(ledger.blocked||ledger.active||ledger.entries.size>=1024)return fail();const end=Math.min(this.#now()+this.#timeout,this.#until,Date.parse(fixed.expiresAt));this.#guard(end,fixed.signal);
   const entry:Entry={binding,end,pending:null,result:null,invoked:false,workDone:false,externalDone:false,bodyHash:null,receiptRef:null};ledger.entries.set(this.#envelope.commandId,entry);ledger.active=entry;
   entry.pending=Promise.resolve().then(()=>this.#send(fixed,ledger!,entry));return entry.pending;
  }catch{return Promise.reject(Error('CLAUDE_INSTRUCTION_UNAVAILABLE'));}
 }
 async #send(call:Call,ledger:Ledger,entry:Entry){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let rejectCancel!:(e:Error)=>void;let receivedOwned:Uint8Array|undefined,owned:Uint8Array|undefined;
  const cancelled=new Promise<never>((_,reject)=>rejectCancel=reject);void cancelled.catch(()=>{});const cancel=()=>{controller.abort();rejectCancel(Error('CLAUDE_INSTRUCTION_UNAVAILABLE'));};
  const release=()=>{if(entry.workDone&&entry.externalDone&&ledger.active===entry)ledger.active=null;};
  let work:Promise<any>|null=null;
  try{
   EventTarget.prototype.addEventListener.call(call.signal,'abort',cancel,{once:true});if(call.signal.aborted)cancel();const remaining=entry.end-this.#now();if(remaining<=0)cancel();else timer=setTimeout(cancel,remaining);
   work=Promise.resolve().then(async()=>{
    try{
     this.#guard(entry.end,controller.signal);const received=await Reflect.apply(originalRead,this.#receiver,[this.#envelope]);
     // 외부 취소 뒤 늦게 도착한 소유 bytes도 검사 전에 붙잡아 finally에서 지운다.
     if(received&&!isProxy(received)&&typeof received==='object'){const d=Object.getOwnPropertyDescriptor(received,'bytes');if(d&&'value'in d&&!isProxy(d.value)&&isUint8Array(d.value))receivedOwned=d.value;}
     this.#guard(entry.end,controller.signal);
     if(!received||isProxy(received)||!recordV1(received,['transport','key','envelopeHash','instructionRef','partsRef','materialReceiptRef','utf8Bytes','contentHash','bytes'])||!receivedOwned)return fail();
     const metadata=boundedSdkObject(Object.fromEntries(Object.entries(received).filter(([key])=>key!=='bytes')),maxSdkObjectBytes).value;
     const key={projectId:this.#envelope.context.projectId,executionId:this.#envelope.context.executionId,executionGeneration:this.#envelope.context.executionGeneration,commandId:this.#envelope.commandId};
     if(metadata.transport!=='SYNTHETIC_ONLY'||hash(metadata.key)!==hash(key)||metadata.envelopeHash!==this.#envelope.envelopeHash||hash(metadata.instructionRef)!==hash(this.#envelope.payload.instructionRef)||hash(metadata.partsRef)!==hash(this.#envelope.payload.partsRef)||!refV1(metadata.materialReceiptRef)||metadata.materialReceiptRef.version!==1||!Number.isSafeInteger(metadata.utf8Bytes)||metadata.utf8Bytes<1||metadata.utf8Bytes>maxSdkObjectBytes)return fail();
     const length=Reflect.apply(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')!.get!,receivedOwned,[]);if(length!==metadata.utf8Bytes)return fail();owned=new Uint8Array(length);Uint8Array.prototype.set.call(owned,receivedOwned);
     if(contentHash(owned)!==metadata.contentHash)return fail();const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(owned);if(!text.trim())return fail();entry.bodyHash=metadata.contentHash;entry.receiptRef=metadata.materialReceiptRef;
     const user=freeze({type:'user',message:{role:'user',content:text},parent_tool_use_id:null,session_id:this.#session});boundedSdkObject(user,maxSdkObjectBytes);this.#guard(entry.end,controller.signal,true);entry.invoked=true;
     const result=await Reflect.apply(originalSend,this.#owner,[this.#envelope.commandId,user,Object.freeze({signal:controller.signal,expiresAt:new Date(entry.end).toISOString()})]);
     if(result?.state==='UNKNOWN')ledger.blocked=true;this.#guard(entry.end,controller.signal);
     if(!result||!['INPUT_METHOD_SETTLED','REJECTED','UNKNOWN'].includes(result.state)||result.actualExecutionVerified!==false||result.executionAuthorized!==false||result.dispatched!==false||result.workAccepted!==false||result.ownership!=='UNVERIFIED')return fail();return this.#output(result.state,entry);
    }finally{owned?.fill(0);receivedOwned?.fill(0);}
   });
   void work.then(()=>{entry.workDone=true;release();},()=>{entry.workDone=true;release();});
   entry.result=await Promise.race([work,cancelled]);return entry.result;
  }catch{
   controller.abort();if(entry.invoked)ledger.blocked=true;entry.result=this.#output(entry.invoked?'UNKNOWN':'REJECTED',entry);return entry.result;
  }finally{
   entry.externalDone=true;if(timer)clearTimeout(timer);EventTarget.prototype.removeEventListener.call(call.signal,'abort',cancel);controller.abort();if(!work)entry.workDone=true;release();
  }
 }
}
