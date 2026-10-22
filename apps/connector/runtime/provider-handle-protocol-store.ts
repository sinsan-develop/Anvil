import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerBindingHash,validateProviderSessionClaim,verifyProviderHandleBinding,type ProviderRef,type ProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,recordV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import {encodeProviderResolveRequest,readProviderResolveReply} from './provider-handle-protocol.ts';

export interface SyntheticProviderHandleMetadata{
 transport:'SYNTHETIC_ONLY';
 /** Private immutable-preparation lookup only. Neither this interface nor matching
  * metadata proves durable storage, native identity, OS ownership or current permission. */
 read(claimRef:ProviderRef,signal:AbortSignal):Promise<unknown>;
}
export interface SyntheticProviderHandleBytePipe{
 transport:'SYNTHETIC_ONLY';
 /** In-process fake only: no production registration/spawn implementation here.
  * Reply is exclusively owned by the caller, including late/failed replies. */
 invoke(request:Uint8Array,signal:AbortSignal):Promise<unknown>;
}
const fail=():never=>{throw Error('PROVIDER_HANDLE_UNAVAILABLE');};
/** Source-only protocol consumer for the existing synthetic SEND/STOP reader.
 * Upper current/grant/permit/OS checks remain mandatory. No capture, authority,
 * native launch, filesystem, credential operation or raw-handle export endpoint.
 * Byte buffers are wiped; JS strings and GC erasure are not guaranteed. */
export class SyntheticProviderHandleProtocolStore{
 readonly transport='SYNTHETIC_ONLY' as const;
 #metadata:SyntheticProviderHandleMetadata;#pipe:SyntheticProviderHandleBytePipe;#clock:()=>number;#timeout:number;
 constructor(metadata:SyntheticProviderHandleMetadata,pipe:SyntheticProviderHandleBytePipe,options:{clock:()=>number;timeoutMs:number}){
  this.#metadata=metadata;this.#pipe=pipe;
  if(typeof options?.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail();
  this.#clock=options.clock;this.#timeout=options.timeoutMs;this.#ports();
 }
 #ports(){if(this.#metadata?.transport!=='SYNTHETIC_ONLY'||typeof this.#metadata.read!=='function'||this.#pipe?.transport!=='SYNTHETIC_ONLY'||typeof this.#pipe.invoke!=='function')fail();}
 #now(){const value=this.#clock();if(!Number.isSafeInteger(value)||!Number.isFinite(new Date(value).getTime()))return fail();return value;}
 async read(raw:ProviderSessionClaim,signal:AbortSignal):Promise<{ciphertextHash:string;plaintext:Uint8Array}>{
  const controller=new AbortController(),frames=new Set<Uint8Array>();let request:Uint8Array|undefined,plaintext:Uint8Array|undefined,timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)fail();
   const claim=cloneV1(raw),{protectedHandleRef,...input}=claim;providerBindingHash(input);
   if(!recordV1(protectedHandleRef,['id','version','contentHash'])||protectedHandleRef.id!==claim.claimId||protectedHandleRef.version!==1||!hashV1(protectedHandleRef.contentHash))fail();
   const claimRef={id:claim.claimId,version:1,contentHash:contentHash(canonicalJson(claim))},now=this.#now(),deadline=Math.min(now+this.#timeout,Date.parse(claim.usableBefore));
   if(now<Date.parse(claim.capturedAt)||now>=deadline)fail();
   const guard=()=>{this.#ports();if(controller.signal.aborted||signal.aborted||this.#now()>=deadline)fail();};
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('PROVIDER_HANDLE_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,deadline-this.#now()));});
   const work=async()=>{
    guard();const metadata=cloneV1(await this.#metadata.read(cloneV1(claimRef),controller.signal));guard();
    if(!recordV1(metadata,['claimRef','ciphertextHash','parent'])||canonicalJson(metadata.claimRef)!==canonicalJson(claimRef)||!hashV1(metadata.ciphertextHash))return fail();
    const parent=metadata.parent===null?undefined:metadata.parent;
    const checked=validateProviderSessionClaim(claim,parent);if(canonicalJson(checked.ref)!==canonicalJson(claimRef))fail();verifyProviderHandleBinding(claim,metadata.ciphertextHash,parent);
    request=encodeProviderResolveRequest(claim,metadata.ciphertextHash,parent);guard();
    const reply=await this.#pipe.invoke(request,controller.signal);
    if(reply instanceof Uint8Array){frames.add(reply);if(controller.signal.aborted||signal.aborted)reply.fill(0);}
    guard();if(!(reply instanceof Uint8Array)||reply.byteLength<1||reply.byteLength>16384)return fail();
    plaintext=readProviderResolveReply(reply,claim,metadata.ciphertextHash,parent);guard();
    return{ciphertextHash:metadata.ciphertextHash,plaintext};
   };
   const value=await Promise.race([work(),cancelled]);guard();
   // Do not transfer candidate ownership before the final await/authority window.
   plaintext=undefined;return value;
  }catch{return fail();}finally{
   controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);
   request?.fill(0);plaintext?.fill(0);for(const frame of frames)frame.fill(0);
  }
 }
}
