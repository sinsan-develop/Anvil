import {canonicalJson} from '../../../contracts/canonical.ts';
import {providerBindingHash,providerProtectedHandleRef,validateProviderSessionClaim,type ProviderBindingInput,type ProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,hashV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticPreparedProviderCaptureSource} from './provider-handle-protocol-capture.ts';
type Prepared={bindingHash:string;bindingInput:ProviderBindingInput;parent:ProviderSessionClaim|null};
export interface SyntheticProviderCapturePreparationStore {
 transport:'SYNTHETIC_ONLY';
 /** Global preparation lock. appendAndSync must not roll back a completed write
  * merely because its callback later fails. This interface is not durable storage. */
 exclusive<T>(body:(tx:{read():Promise<unknown>;appendAndSync(value:Prepared):Promise<void>})=>Promise<T>,signal:AbortSignal):Promise<T>;
}
const fail=():never=>{throw Error('PROVIDER_CAPTURE_PREPARATION_UNAVAILABLE');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const event=(v:ProviderBindingInput)=>canonicalJson({projectId:v.projectId,execution:v.execution,commandId:v.commandId,kind:v.kind,method:v.source.method,requestIdDigest:v.source.requestIdDigest});
/** Explicit synthetic metadata preparation only. No raw handle, UUID issuance,
 * native/OS/file access, authority issuance or registered default. Existing
 * preparations may be reread after uncertain sync, never reconstructed under a
 * new claim ID. A read proves neither ciphertext existence nor permission. */
export class SyntheticProviderCapturePreparation implements SyntheticPreparedProviderCaptureSource {
 readonly transport='SYNTHETIC_ONLY' as const;
 #store:SyntheticProviderCapturePreparationStore;#clock:()=>number;#timeout:number;
 constructor(store:SyntheticProviderCapturePreparationStore,options:{clock:()=>number;timeoutMs?:number}){
  this.#store=store;this.#clock=options?.clock;this.#timeout=options?.timeoutMs??1000;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports(){if(this.#store?.transport!=='SYNTHETIC_ONLY'||typeof this.#store.exclusive!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 #entry(raw:unknown):Prepared{
  if(!recordV1(raw,['bindingHash','bindingInput','parent'])||!hashV1(raw.bindingHash))return fail();
  const value=cloneV1(raw) as Prepared,input=value.bindingInput;
  validateProviderSessionClaim({...input,protectedHandleRef:providerProtectedHandleRef(input,'0'.repeat(64))},value.parent===null?undefined:value.parent);
  if(value.bindingHash!==providerBindingHash(input))return fail();return value;
 }
 #entries(raw:unknown):Prepared[]{
  if(!recordV1(raw,['complete','entries'])||raw.complete!==true||!Array.isArray(raw.entries)||raw.entries.length>512||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)return fail();
  const rows=raw.entries.map(v=>this.#entry(v)),keys=new Set<string>(),ids=new Set<string>();
  for(const row of rows){const key=event(row.bindingInput);if(keys.has(key)||ids.has(row.bindingInput.claimId))fail();keys.add(key);ids.add(row.bindingInput.claimId);}return rows;
 }
 async #run<T>(signal:AbortSignal,body:(guard:()=>void,signal:AbortSignal)=>Promise<T>):Promise<T>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)fail();const deadline=this.#now()+this.#timeout;
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=deadline)fail();};
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('PROVIDER_CAPTURE_PREPARATION_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,this.#timeout);});
   const value=await Promise.race([Promise.resolve().then(()=>{guard();return body(guard,controller.signal);}),cancelled]);guard();return value;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
 async prepare(raw:ProviderBindingInput,parent:ProviderSessionClaim|null,signal:AbortSignal):Promise<void>{
  let row:Prepared;try{row=this.#entry({bindingHash:providerBindingHash(raw),bindingInput:cloneV1(raw),parent:cloneV1(parent)});}catch{return fail();}
  return this.#run(signal,async(guard,inner)=>{
   const current=()=>{guard();const now=this.#now();if(now<Date.parse(row.bindingInput.capturedAt)||now>=Date.parse(row.bindingInput.usableBefore))fail();};current();
   await this.#store.exclusive(async tx=>{const rows=this.#entries(await tx.read());current();const found=rows.find(r=>event(r.bindingInput)===event(row.bindingInput));
    if(found){if(!same(found,row))fail();return;}
    if(rows.length>=512||rows.some(r=>r.bindingInput.claimId===row.bindingInput.claimId))fail();
    this.#entries({complete:true,entries:[...rows,row]});current();
    await tx.appendAndSync(cloneV1(row));current();
   },inner);current();
  });
 }
 async read(bindingHash:string,signal:AbortSignal):Promise<{complete:true;bindingInput:ProviderBindingInput;parent:ProviderSessionClaim|null}>{
  const value=await this.#run(signal,async(guard,inner)=>{if(!hashV1(bindingHash))return fail();return this.#store.exclusive(async tx=>{const rows=this.#entries(await tx.read());guard();const found=rows.find(r=>r.bindingHash===bindingHash);if(!found)return fail();const now=this.#now();if(now<Date.parse(found.bindingInput.capturedAt)||now>=Date.parse(found.bindingInput.usableBefore))return fail();return{complete:true as const,bindingInput:cloneV1(found.bindingInput),parent:cloneV1(found.parent)};},inner);});
  this.#ports();const now=this.#now();if(signal.aborted||now<Date.parse(value.bindingInput.capturedAt)||now>=Date.parse(value.bindingInput.usableBefore))return fail();return value;
 }
}
