import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,recordV1,refV1,hashV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {SyntheticProviderHandleReader} from './provider-handle-reader.ts';
export interface ProviderWireAttempt{key:ReceiptKeyV1;envelopeHash:string;localAttemptRef:RuntimeRefV1;permitRef:RuntimeRefV1|null;instructionContentHash:string|null;bindingHash:string}
type Selection=Parameters<SyntheticProviderHandleReader['use']>[0];
type Wire={transport:'SYNTHETIC_ONLY';exchange(bytes:Uint8Array,signal:AbortSignal):Promise<Uint8Array>};
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw Error('PROVIDER_BOUND_WIRE_UNAVAILABLE');}
/** Optional in-process guard for the existing synthetic transports. No socket/native fallback.
 * Factory must independently bind the durable local attempt/consumed permit and current server
 * command to the reader; these metadata are not authority merely because the caller supplied them. */
export class SyntheticProviderBoundWire{
 readonly transport='SYNTHETIC_ONLY' as const;
 #selection:Selection;#reader:(attempt:ProviderWireAttempt)=>SyntheticProviderHandleReader|Promise<SyntheticProviderHandleReader>;#wire:Wire;#used=false;
 constructor(selection:Selection,reader:(attempt:ProviderWireAttempt)=>SyntheticProviderHandleReader|Promise<SyntheticProviderHandleReader>,wire:Wire){
  this.#selection=cloneV1(selection);this.#reader=reader;this.#wire=wire;this.#ports();
 }
 #ports(){if(typeof this.#reader!=='function'||this.#wire?.transport!=='SYNTHETIC_ONLY'||typeof this.#wire.exchange!=='function')fail();}
 async exchange(input:Uint8Array,signal:AbortSignal,raw?:ProviderWireAttempt):Promise<Uint8Array>{
  let bytes:Uint8Array|undefined,result:Uint8Array|undefined,delivered=false;
  try{
   this.#ports();if(this.#used||!(signal instanceof AbortSignal)||signal.aborted)fail();this.#used=true;
   const e=this.#selection.envelope as any,stop=e?.operation==='REQUEST_STOP';
   if(!['SEND_INSTRUCTION','REQUEST_STOP'].includes(e?.operation)||!recordV1(raw,['key','envelopeHash','localAttemptRef','permitRef','instructionContentHash','bindingHash'])||!same(raw.key,receiptKeyV1(e))||raw.envelopeHash!==e.envelopeHash||!refV1(raw.localAttemptRef)||raw.localAttemptRef.version!==1||!hashV1(raw.bindingHash)
    ||(stop?raw.permitRef!==null||raw.instructionContentHash!==null:!refV1(raw.permitRef)||raw.permitRef.version!==1||!hashV1(raw.instructionContentHash))||!(input instanceof Uint8Array)||input.byteLength<1||input.byteLength>2097152)fail();
   const attempt=cloneV1(raw);bytes=new Uint8Array(input);const request=parseWireJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!recordV1(request,['id','method','params'])||request.id!==hash({key:receiptKeyV1(e),envelopeHash:e.envelopeHash})||request.method!==(stop?'turn/interrupt':'turn/start')||!recordV1(request.params,stop?['threadId','turnId']:['threadId','input']))fail();
   if(!stop&&(!Array.isArray(request.params.input)||request.params.input.length!==1||!recordV1(request.params.input[0],['type','text'])||request.params.input[0].type!=='text'||typeof request.params.input[0].text!=='string'||contentHash(Buffer.from(request.params.input[0].text,'utf8'))!==attempt.instructionContentHash))fail();
   const reader=await this.#reader(attempt);this.#ports();if(signal.aborted||!(reader instanceof SyntheticProviderHandleReader))fail();
   await reader.use(this.#selection,async(handles,localSignal)=>{
    this.#ports();const combined=AbortSignal.any([signal,localSignal]);if(combined.aborted||request.params.threadId!==handles.threadId||stop&&request.params.turnId!==handles.turnId||!stop&&handles.turnId!==null)fail();
    try{result=await this.#wire.exchange(bytes!,combined);this.#ports();if(combined.aborted||!(result instanceof Uint8Array)||result.byteLength>2097152)fail();}
    catch{if(result instanceof Uint8Array)result.fill(0);return fail();}
   });
   if(signal.aborted||!result)fail();delivered=true;return result;
  }catch{return fail();}finally{bytes?.fill(0);if(!delivered&&result instanceof Uint8Array)result.fill(0);}
 }
}
