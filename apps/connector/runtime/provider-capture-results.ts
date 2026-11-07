import {canonicalJson} from '../../../contracts/canonical.ts';
import {providerBindingHash,validateProviderSessionClaim,verifyProviderHandleBinding,type ProviderRef,type ProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,hashV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticPreparedProviderCaptureSource} from './provider-handle-protocol-capture.ts';
import type {SyntheticProviderHandleMetadata} from './provider-handle-protocol-store.ts';
import type {SyntheticStartCaptureReceiptStore} from './start-protected-capture-bridge.ts';
type Row={claim:ProviderSessionClaim;claimRef:ProviderRef;ciphertextHash:string;parent:ProviderSessionClaim|null};
export interface SyntheticProviderCaptureResultStore{
 transport:'SYNTHETIC_ONLY';
 /** Global metadata lock; successful append sync is not rolled back on a later
  * callback failure. This port is not a concrete durable storage implementation. */
 exclusive<T>(body:(tx:{read():Promise<unknown>;appendAndSync(row:Row):Promise<void>})=>Promise<T>,signal:AbortSignal):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw Error('PROVIDER_CAPTURE_RESULTS_UNAVAILABLE');};
const event=(r:Row)=>canonicalJson({projectId:r.claim.projectId,execution:r.claim.execution,commandId:r.claim.commandId,kind:r.claim.kind,method:r.claim.source.method,requestIdDigest:r.claim.source.requestIdDigest});
/** Source-only metadata ledger, explicitly injected into the START receipt and
 * protected-reader ports. Contains no raw handles or plaintext. Exact equality
 * does not authenticate provider/native identity, storage durability or current
 * OS/command permission; upper reader guards remain mandatory. No retry/UUID,
 * native launch, file root, credential or production registration is supplied. */
export class SyntheticProviderCaptureResults implements SyntheticProviderHandleMetadata,SyntheticStartCaptureReceiptStore{
 readonly transport='SYNTHETIC_ONLY' as const;
 #prepared:SyntheticPreparedProviderCaptureSource;#store:SyntheticProviderCaptureResultStore;#clock:()=>number;#timeout:number;
 constructor(prepared:SyntheticPreparedProviderCaptureSource,store:SyntheticProviderCaptureResultStore,options:{clock:()=>number;timeoutMs:number}){
  this.#prepared=prepared;this.#store=store;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports(){if(this.#prepared?.transport!=='SYNTHETIC_ONLY'||typeof this.#prepared.read!=='function'||this.#store?.transport!=='SYNTHETIC_ONLY'||typeof this.#store.exclusive!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 #row(raw:unknown):Row{
  if(!recordV1(raw,['claim','claimRef','ciphertextHash','parent'])||!hashV1(raw.ciphertextHash))return fail();const r=cloneV1(raw) as Row;
  const checked=validateProviderSessionClaim(r.claim,r.parent===null?undefined:r.parent);if(!same(checked.ref,r.claimRef))return fail();verifyProviderHandleBinding(r.claim,r.ciphertextHash,r.parent===null?undefined:r.parent);return r;
 }
 #rows(raw:unknown):Row[]{
  if(!recordV1(raw,['complete','entries'])||raw.complete!==true||!Array.isArray(raw.entries)||raw.entries.length>512||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)return fail();
  const rows=raw.entries.map(v=>this.#row(v)),ids=new Set<string>(),events=new Set<string>();
  for(const row of rows){const key=event(row);if(ids.has(row.claim.claimId)||events.has(key))fail();ids.add(row.claim.claimId);events.add(key);
   if(row.parent){const parent=rows.find(p=>same(p.claimRef,row.claim.parentThreadClaimRef));if(!parent||!same(parent.claim,row.parent))fail();}
  }return rows;
 }
 #live(claim:ProviderSessionClaim){const now=this.#now();if(now<Date.parse(claim.capturedAt)||now>=Date.parse(claim.usableBefore))fail();}
 async #run<T>(signal:AbortSignal,body:(guard:()=>void,inner:AbortSignal)=>Promise<T>,final:(value:T)=>void):Promise<T>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)fail();const deadline=this.#now()+this.#timeout;
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=deadline)fail();};
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('PROVIDER_CAPTURE_RESULTS_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,this.#timeout);});
   const value=await Promise.race([Promise.resolve().then(()=>{guard();return body(guard,controller.signal);}),cancelled]);guard();final(value);return value;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
 async appendAndSync(raw:unknown,signal:AbortSignal):Promise<{complete:true;claimRef:ProviderRef;ciphertextHash:string}>{
  let v:any;try{v=cloneV1(raw);if(!recordV1(v,['claim','claimRef','ciphertextHash','executionAuthorized','dispatchPerformed'])||v.executionAuthorized!==false||v.dispatchPerformed!==false)fail();}catch{return fail();}
  let row:Row|undefined;
  return this.#run(signal,async(guard,inner)=>{const{protectedHandleRef:_,...input}=v.claim,bindingHash=providerBindingHash(input),prepared=cloneV1(await this.#prepared.read(bindingHash,inner));guard();
   if(!recordV1(prepared,['complete','bindingInput','parent'])||prepared.complete!==true||!same(prepared.bindingInput,input))return fail();
   row=this.#row({claim:v.claim,claimRef:v.claimRef,ciphertextHash:v.ciphertextHash,parent:prepared.parent});this.#live(row.claim);const fixed=row;
   await this.#store.exclusive(async tx=>{const rows=this.#rows(await tx.read());guard();this.#live(fixed.claim);const found=rows.find(r=>r.claim.claimId===fixed.claim.claimId||event(r)===event(fixed));
    if(found){if(!same(found,fixed))fail();return;}
    this.#rows({complete:true,entries:[...rows,fixed]});guard();this.#live(fixed.claim);await tx.appendAndSync(cloneV1(fixed));guard();this.#live(fixed.claim);
   },inner);guard();this.#live(fixed.claim);return{complete:true as const,claimRef:cloneV1(fixed.claimRef),ciphertextHash:fixed.ciphertextHash};
  },()=>{if(!row)return fail();this.#live(row.claim);});
 }
 async read(rawRef:ProviderRef,signal:AbortSignal):Promise<{claimRef:ProviderRef;ciphertextHash:string;parent:ProviderSessionClaim|null}>{
  let selected:ProviderRef;try{selected=cloneV1(rawRef);if(!refV1(selected))return fail();}catch{return fail();}let row:Row|undefined;
  return this.#run(signal,async(guard,inner)=>this.#store.exclusive(async tx=>{const rows=this.#rows(await tx.read());guard();row=rows.find(r=>same(r.claimRef,selected));if(!row)return fail();this.#live(row.claim);return{claimRef:cloneV1(row.claimRef),ciphertextHash:row.ciphertextHash,parent:cloneV1(row.parent)};},inner),()=>{if(!row)return fail();this.#live(row.claim);});
 }
}
