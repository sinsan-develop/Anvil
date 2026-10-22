import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticSentTurnPrivateCurrent} from './sent-turn-current-binding.ts';
type Input=Parameters<SyntheticSentTurnPrivateCurrent['readCurrent']>[0];
/** Existing receiver.instructionSource returns an exclusively owned byte array.
 * Do not provide shared inbox/cache buffers: received arrays are zeroed, even late. */
export interface SyntheticOwnedInstructionSource{transport:'SYNTHETIC_ONLY';read(envelope:DispatchEnvelopeV1):Promise<unknown>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw Error('SENT_TURN_MATERIAL_CURRENT_UNAVAILABLE');}
/** Read-only response-current composition, not a receipt writer/Agent/authority.
 * Consumes existing receiver parts, never re-receives, retries or changes SEND IDLE.
 * Inbox/OS durability, private-current provenance and JS string erasure are not proved. */
export class SyntheticSentTurnMaterialCurrent implements SyntheticSentTurnPrivateCurrent{
 readonly transport='SYNTHETIC_ONLY' as const;
 #materials:SyntheticOwnedInstructionSource;#local:SyntheticSentTurnPrivateCurrent;#clock:()=>number;#timeout:number;
 constructor(materials:SyntheticOwnedInstructionSource,local:SyntheticSentTurnPrivateCurrent,options:{clock:()=>number;timeoutMs:number}){
  this.#materials=materials;this.#local=local;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports(){if(this.#materials?.transport!=='SYNTHETIC_ONLY'||typeof this.#materials.read!=='function'||this.#local?.transport!=='SYNTHETIC_ONLY'||typeof this.#local.readCurrent!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async readCurrent(raw:Input,signal:AbortSignal):Promise<unknown>{
  const controller=new AbortController(),owned=new Set<Uint8Array>();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)return fail();const input=cloneV1(raw),e=readDispatchEnvelopeV1(input.envelope,this.#now()),pre:any=input.preSendSnapshot;
   if(e.operation!=='SEND_INSTRUCTION'||pre?.transport!=='SYNTHETIC_ONLY'||!same(pre.key,receiptKeyV1(e))||pre.envelopeHash!==e.envelopeHash||!same(pre.instructionRef,e.payload.instructionRef)||!same(pre.partsRef,e.payload.partsRef)||!refV1(pre.materialReceiptRef)||!hashV1(pre.instructionContentHash)||!isoV1(pre.expiresAt))return fail();
   let end=Math.min(this.#now()+this.#timeout,Date.parse(e.expiresAt),Date.parse(pre.expiresAt));
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=end)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('SENT_TURN_MATERIAL_CURRENT_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,end-this.#now()));});
   const material=async()=>{
    guard();const value=await this.#materials.read(cloneV1(e));
    const bytes=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'bytes')?.value:undefined;
    if(bytes instanceof Uint8Array){owned.add(bytes);if(controller.signal.aborted||signal.aborted){bytes.fill(0);return fail();}}
    try{
     guard();if(!recordV1(value,['transport','key','envelopeHash','instructionRef','partsRef','materialReceiptRef','utf8Bytes','contentHash','bytes'])||value.transport!=='SYNTHETIC_ONLY'||!same(value.key,receiptKeyV1(e))||value.envelopeHash!==e.envelopeHash||!same(value.instructionRef,e.payload.instructionRef)||!same(value.partsRef,e.payload.partsRef)||!same(value.materialReceiptRef,pre.materialReceiptRef)||value.contentHash!==pre.instructionContentHash||!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>2*1024*1024||value.utf8Bytes!==bytes.byteLength||contentHash(bytes)!==value.contentHash)return fail();
     const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
     if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i.test(text))fail();
     guard();return{materialReceiptRef:cloneV1(value.materialReceiptRef),instructionContentHash:value.contentHash};
    }finally{if(bytes instanceof Uint8Array){bytes.fill(0);owned.delete(bytes);}}
   };
   const work=async()=>{
    const before=await material();guard();const current=cloneV1(await this.#local.readCurrent(cloneV1(input),controller.signal));guard();
    if(!recordV1(current,Object.keys(pre))||current.transport!=='SYNTHETIC_ONLY'||!same(current.materialReceiptRef,before.materialReceiptRef)||current.instructionContentHash!==before.instructionContentHash||!isoV1(current.checkedAt)||!isoV1(current.expiresAt)||Date.parse(current.checkedAt)>this.#now()||this.#now()-Date.parse(current.checkedAt)>30000||Date.parse(current.expiresAt)>Date.parse(current.checkedAt)+30000)return fail();
    end=Math.min(end,Date.parse(current.expiresAt),Date.parse(current.checkedAt)+30000);guard();
    const after=await material();guard();if(!same(before,after))fail();return{...current,expiresAt:new Date(end).toISOString()};
   };
   const result=await Promise.race([work(),cancelled]);guard();return result;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);for(const b of owned)b.fill(0);}
 }
}
