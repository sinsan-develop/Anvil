import {canonicalJson} from '../../../contracts/canonical.ts';
import {providerBindingHash,providerProtectedHandleRef,validateProviderSessionClaim,type ProviderBindingInput} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import type {ProtectedSessionCapture} from '../adapters/primary/codec.ts';
import type {SyntheticProviderHandleBytePipe} from './provider-handle-protocol-store.ts';
import {encodeProviderCaptureRequest,readProviderCaptureReply} from './provider-handle-protocol.ts';
export interface SyntheticPreparedProviderCaptureSource{
 transport:'SYNTHETIC_ONLY';
 /** Immutable preparation lookup only. Complete/hash equality does not prove
  * durability, native identity, provider authenticity or current authority. */
 read(bindingHash:string,signal:AbortSignal):Promise<unknown>;
}
const fail=():never=>{throw Error('PROVIDER_HANDLE_CAPTURE_UNAVAILABLE');};
/** Source-only asynchronous CREATE consumer, deliberately NOT a synchronous
 * codec RECORDED port or a registered native caller. No retries/UUID allocation,
 * filesystem/spawn/permission issuance or raw identifiers in returned metadata.
 * Caller must preserve UNKNOWN after an uncertain write; JS string GC erasure
 * cannot be guaranteed. Returned metadata is a claim, not execution authority. */
export class SyntheticProviderHandleProtocolCapture{
 readonly transport='SYNTHETIC_ONLY' as const;
 #prepared:SyntheticPreparedProviderCaptureSource;#pipe:SyntheticProviderHandleBytePipe;#clock:()=>number;#timeout:number;
 constructor(prepared:SyntheticPreparedProviderCaptureSource,pipe:SyntheticProviderHandleBytePipe,options:{clock:()=>number;timeoutMs:number}){
  this.#prepared=prepared;this.#pipe=pipe;if(typeof options?.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail();this.#clock=options.clock;this.#timeout=options.timeoutMs;this.#ports();
 }
 #ports(){if(this.#prepared?.transport!=='SYNTHETIC_ONLY'||typeof this.#prepared.read!=='function'||this.#pipe?.transport!=='SYNTHETIC_ONLY'||typeof this.#pipe.invoke!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async capturePrepared(rawInput:ProviderBindingInput,rawCapture:Readonly<ProtectedSessionCapture>,signal:AbortSignal){
  const controller=new AbortController(),frames=new Set<Uint8Array>();let request:Uint8Array|undefined,timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)fail();
   const input=cloneV1(rawInput),capture=cloneV1(rawCapture),bindingHash=providerBindingHash(input);
   if(!recordV1(capture,['method','requestIdDigest','payloadDigest','threadId','turnId'])||capture.method!==input.source.method||capture.requestIdDigest!==input.source.requestIdDigest||capture.payloadDigest!==input.source.responsePayloadDigest)fail();
   const now=this.#now(),deadline=Math.min(now+this.#timeout,Date.parse(input.usableBefore));if(now<Date.parse(input.capturedAt)||now>=deadline)fail();
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=deadline)fail();};
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('PROVIDER_HANDLE_CAPTURE_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,deadline-this.#now()));});
   const work=async()=>{
    guard();const prepared=cloneV1(await this.#prepared.read(bindingHash,controller.signal));guard();
    if(!recordV1(prepared,['complete','bindingInput','parent'])||prepared.complete!==true||canonicalJson(prepared.bindingInput)!==canonicalJson(input))return fail();
    const parent=prepared.parent===null?undefined:prepared.parent;
    // Pure parent/schema validation before any CREATE. This placeholder never
    // becomes a stored/returned ref or an assertion about an existing ciphertext.
    validateProviderSessionClaim({...input,protectedHandleRef:providerProtectedHandleRef(input,'0'.repeat(64))},parent);
    request=encodeProviderCaptureRequest(input,{threadId:capture.threadId,turnId:capture.turnId});guard();
    const response=await this.#pipe.invoke(request,controller.signal);if(response instanceof Uint8Array){frames.add(response);if(signal.aborted||controller.signal.aborted)response.fill(0);}
    guard();if(!(response instanceof Uint8Array)||response.byteLength<1||response.byteLength>16384)return fail();
    const value=readProviderCaptureReply(response,input),claim={...input,protectedHandleRef:value.protectedHandleRef},checked=validateProviderSessionClaim(claim,parent);guard();
    return{claim:checked.claim,claimRef:checked.ref,ciphertextHash:value.ciphertextHash,executionAuthorized:false as const,dispatchPerformed:false as const};
   };
   const value=await Promise.race([work(),cancelled]);guard();return value;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);request?.fill(0);for(const frame of frames)frame.fill(0);}
 }
}
