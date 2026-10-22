import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,hashV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {ProviderWireAttempt} from './provider-bound-wire.ts';
import {SyntheticProviderHandleReader} from './provider-handle-reader.ts';
export interface SyntheticLockedProviderAttemptSource{
 transport:'SYNTHETIC_ONLY';
 /** Called under the EXISTING sender/stopper exclusive journal lock after sync. Supply only
  * validated current attempt/permit rows from that journal. Must not acquire a nested lock,
  * adopt caller metadata as a row, or select an older completed/unknown attempt. No default FS port. */
 readLocked(attempt:ProviderWireAttempt):Promise<unknown>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail():never{throw Error('PROVIDER_READER_FACTORY_UNAVAILABLE');}
/** Shape/hash binding of an already locked durable journal, not proof of fsync/OS ownership. */
export class SyntheticProviderReaderFactory{
 #source:SyntheticLockedProviderAttemptSource;#build:(attempt:ProviderWireAttempt)=>SyntheticProviderHandleReader|Promise<SyntheticProviderHandleReader>;
 constructor(source:SyntheticLockedProviderAttemptSource,build:(attempt:ProviderWireAttempt)=>SyntheticProviderHandleReader|Promise<SyntheticProviderHandleReader>){this.#source=source;this.#build=build;this.#ports();}
 #ports(){if(this.#source?.transport!=='SYNTHETIC_ONLY'||typeof this.#source.readLocked!=='function'||typeof this.#build!=='function')fail();}
 #row(raw:unknown,stop:boolean){
  if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||raw.ref.contentHash!==hash(raw.snapshot))fail();const s=raw.snapshot;
  const fields=stop?['sequence','state','key','envelopeHash','bindingHash','at','responseRef','responseFact','previousRef','reason']:['sequence','key','envelopeHash','state','bindingHash','materialReceiptRef','instructionContentHash','grantRef','permitRef','responseFact','at','previousRef','reason'];
  if(!recordV1(s,fields)||!Number.isSafeInteger(s.sequence)||s.sequence<1||!isoV1(s.at)||s.reason!=='NONE'||s.responseFact!==null||!hashV1(s.bindingHash)||!hashV1(s.envelopeHash)||s.previousRef!==null&&!refV1(s.previousRef))fail();
  if(stop?(s.sequence!==1||s.state!=='STOP_ATTEMPTED'||s.previousRef!==null||s.responseRef!==null):(!refV1(s.materialReceiptRef)||!refV1(s.grantRef)||!hashV1(s.instructionContentHash)))fail();return raw;
 }
 async resolve(raw:ProviderWireAttempt):Promise<SyntheticProviderHandleReader>{
  try{
   this.#ports();if(!recordV1(raw,['key','envelopeHash','localAttemptRef','permitRef','instructionContentHash','bindingHash'])||!refV1(raw.localAttemptRef)||!hashV1(raw.envelopeHash)||!hashV1(raw.bindingHash))fail();const a=cloneV1(raw),stop=a.permitRef===null;
   const value=cloneV1(await this.#source.readLocked(cloneV1(a)));this.#ports();if(!recordV1(value,['complete','attemptRecord','permitRecord'])||value.complete!==true||Buffer.byteLength(canonicalJson(value))>32768)fail();
   const attempt=this.#row(value.attemptRecord,stop),first=attempt.snapshot;
   if(!same(attempt.ref,a.localAttemptRef)||!same(first.key,a.key)||first.envelopeHash!==a.envelopeHash||first.bindingHash!==a.bindingHash)fail();
   if(stop){if(a.instructionContentHash!==null||value.permitRecord!==null)fail();}
   else{
    if(!refV1(a.permitRef)||!hashV1(a.instructionContentHash)||first.state!=='SEND_ATTEMPTED'||first.permitRef!==null||first.instructionContentHash!==a.instructionContentHash)fail();
    const permit=this.#row(value.permitRecord,false),s=permit.snapshot;
    if(s.state!=='PERMIT_RECORDED'||!same(s.permitRef,a.permitRef)||s.sequence!==first.sequence+1||!same(s.previousRef,attempt.ref)||Date.parse(s.at)<Date.parse(first.at)||!['key','envelopeHash','bindingHash','materialReceiptRef','instructionContentHash','grantRef'].every(k=>same(s[k],first[k])))fail();
   }
   const reader=await this.#build(cloneV1(a));this.#ports();if(!(reader instanceof SyntheticProviderHandleReader))fail();return reader;
  }catch{return fail();}
 }
}
