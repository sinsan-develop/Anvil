import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {Codex0161Codec,type CodecFact} from './codec.ts';
import {SyntheticObservationSpool} from '../../runtime/execution-observation-spool.ts';
import type {ProviderWireAttempt} from './provider-bound-wire.ts';
type Reason='NONE'|'PROVIDER_ACK_ONLY'|'RESPONSE_LOST'|'PROTOCOL_UNCERTAIN'|'ATTEMPT_UNCERTAIN';
type ResponseFact={transport:'SYNTHETIC_ONLY';source:'CODEX_0161_PROVIDER_CLAIM';fact:CodecFact};
type Entry={ref:RuntimeRefV1;snapshot:{sequence:number;state:'STOP_ATTEMPTED'|'STOP_UNCONFIRMED';key:ReceiptKeyV1;envelopeHash:string;bindingHash:string;at:string;responseRef:RuntimeRefV1|null;responseFact:ResponseFact|null;previousRef:RuntimeRefV1|null;reason:Reason}};
export interface SyntheticStopTransaction{read():Promise<{complete:boolean;events:Entry[]}>;appendAndSync(entry:Entry):Promise<void>}
export interface SyntheticStopStore{transport:'SYNTHETIC_ONLY';exclusive<T>(scope:{projectId:string;executionId:string;executionGeneration:number},body:(tx:SyntheticStopTransaction)=>Promise<T>):Promise<T>}
export interface SyntheticStopVerifier{transport:'SYNTHETIC_ONLY';/** 현재 서버 지시·소유/정확 target을 저장소와 대조한다. caller 입력을 인증하지 않는다. */current(envelope:DispatchEnvelopeV1):Promise<unknown>}
export interface SyntheticStopWire{transport:'SYNTHETIC_ONLY';exchange(bytes:Uint8Array,signal:AbortSignal,attempt?:ProviderWireAttempt):Promise<Uint8Array>}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
class StopFailure extends Error{}
const fail=(code:string):never=>{throw new StopFailure(code);};
/** P1의 graceful stop 전용 연결. 실제 socket/Agent/OS·credential fallback이 없다.
 * 현재 정상 실행의 중지 지시만 소비한다. RECOVERY 자격·START/SEND·강제 kill은 제공하지 않는다.
 * interrupt 응답은 provider claim뿐이며 STOPPED/writer 회수로 승격하지 않는다. */
export class SyntheticPrimaryStopTransport{
 readonly store:SyntheticStopStore;readonly verifier:SyntheticStopVerifier;readonly wire:SyntheticStopWire;readonly codec:Codex0161Codec;
 #expected:{context:AdapterContextV1;envelopeExecutorRef:RuntimeRefV1};#clock:()=>number;#timeout:number;
 constructor(store:SyntheticStopStore,verifier:SyntheticStopVerifier,wire:SyntheticStopWire,codec:Codex0161Codec,expected:{context:AdapterContextV1;envelopeExecutorRef:RuntimeRefV1},options:{clock:()=>number;timeoutMs:number}){
  this.store=store;this.verifier=verifier;this.wire=wire;this.codec=codec;this.#ports();if(!(codec instanceof Codex0161Codec)||!recordV1(expected,['context','envelopeExecutorRef'])||!refV1(expected.envelopeExecutorRef)||!options||typeof options.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail('STOP_CONFIG_INVALID');this.#expected=cloneV1(expected);this.#clock=options.clock;this.#timeout=options.timeoutMs;
 }
 #ports(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.exclusive!=='function'||this.verifier?.transport!=='SYNTHETIC_ONLY'||typeof this.verifier.current!=='function'||this.wire?.transport!=='SYNTHETIC_ONLY'||typeof this.wire.exchange!=='function')fail('SYNTHETIC_STOP_PORTS_REQUIRED');}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail('STOP_CLOCK_INVALID');return n;}
 async #bounded<T>(fn:(signal:AbortSignal)=>Promise<T>,deadline:number){const wait=Math.min(this.#timeout,deadline-this.#now());if(wait<=0)return fail('STOP_EXPIRED');const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve().then(()=>{this.#ports();if(this.#now()>=deadline)return fail('STOP_EXPIRED');return fn(controller.signal);}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new StopFailure('STOP_TIMEOUT'));},wait);})]);}finally{if(timer)clearTimeout(timer);}}
 async #current(e:DispatchEnvelopeV1,selectionEnd=Date.parse(e.expiresAt)){
  this.#ports();const c=cloneV1(await this.#bounded(()=>this.verifier.current(cloneV1(e)),Math.min(selectionEnd,Date.parse(e.expiresAt),this.#now()+this.#timeout))),now=this.#now();
  if(e.operation!=='REQUEST_STOP'||!recordV1(c,['transport','key','envelopeHash','sessionBindingRef','stopScopeRef','ownershipRef','commandReceiptRef','threadId','turnId','checkedAt','expiresAt','forceAllowed'])||c.transport!=='SYNTHETIC_ONLY'||!same(c.key,receiptKeyV1(e))||c.envelopeHash!==e.envelopeHash||!same(c.sessionBindingRef,e.payload.sessionBindingRef)||!same(c.stopScopeRef,e.payload.stopScopeRef)||!refV1(c.ownershipRef)||!refV1(c.commandReceiptRef)||typeof c.threadId!=='string'||!/^[A-Za-z0-9._:-]{1,512}$/.test(c.threadId)||typeof c.turnId!=='string'||!/^[A-Za-z0-9._:-]{1,512}$/.test(c.turnId)||!isoV1(c.checkedAt)||!isoV1(c.expiresAt)||Date.parse(c.checkedAt)>now||now-Date.parse(c.checkedAt)>30000||Date.parse(c.expiresAt)<=now||Date.parse(c.expiresAt)>Date.parse(c.checkedAt)+30000||c.forceAllowed!==false)return fail('STOP_CURRENT_REQUIRED');
  const deadline=Math.min(selectionEnd,Date.parse(e.expiresAt),Date.parse(c.expiresAt));if(now>=deadline)fail('STOP_EXPIRED');const {checkedAt:_,expiresAt:__,...binding}=c;this.#ports();return{bindingHash:hash(binding),deadline,params:{threadId:c.threadId,turnId:c.turnId}};
 }
 #journal(raw:unknown,e:DispatchEnvelopeV1){
  if(!recordV1(raw,['complete','events'])||raw.complete!==true||!arrayV1(raw.events,2)||Buffer.byteLength(canonicalJson(raw))>65536)return fail('STOP_JOURNAL_INCOMPLETE');const events:Entry[]=cloneV1(raw.events);let last=-Infinity;const ids=new Set<string>();
  for(const [i,r]of events.entries()){const s=r?.snapshot;if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||ids.has(r.ref.id)||r.ref.contentHash!==hash(s)||!recordV1(s,['sequence','state','key','envelopeHash','bindingHash','at','responseRef','responseFact','previousRef','reason'])||s.sequence!==i+1||s.envelopeHash!==e.envelopeHash||!same(s.key,receiptKeyV1(e))||!hashV1(s.bindingHash)||!isoV1(s.at)||Date.parse(s.at)<last||Date.parse(s.at)>this.#now()||!same(s.previousRef,events[i-1]?.ref??null))fail('STOP_JOURNAL_INVALID');
   if(i===0&&(s.state!=='STOP_ATTEMPTED'||s.reason!=='NONE'||s.responseRef!==null||s.responseFact!==null)||i===1&&(s.state!=='STOP_UNCONFIRMED'||s.bindingHash!==events[0]!.snapshot.bindingHash||!['PROVIDER_ACK_ONLY','RESPONSE_LOST','PROTOCOL_UNCERTAIN','ATTEMPT_UNCERTAIN'].includes(s.reason)||(s.reason==='PROVIDER_ACK_ONLY'? !refV1(s.responseRef)||s.responseRef.contentHash!==hash(s.responseFact)||!this.#response(s.responseFact,e):s.responseRef!==null||s.responseFact!==null)))fail('STOP_JOURNAL_INVALID');last=Date.parse(s.at);ids.add(r.ref.id);
  }return events;
 }
 #response(raw:unknown,e:DispatchEnvelopeV1){if(!recordV1(raw,['transport','source','fact'])||raw.transport!=='SYNTHETIC_ONLY'||raw.source!=='CODEX_0161_PROVIDER_CLAIM'||!recordV1(raw.fact,['kind','method','requestIdDigest','payloadDigest','executionAuthorized','workAccepted','ownership']))return false;const f=raw.fact;return f.kind==='INTERRUPT_RESPONSE'&&f.method==='turn/interrupt'&&f.requestIdDigest===hash(hash({key:receiptKeyV1(e),envelopeHash:e.envelopeHash}))&&hashV1(f.payloadDigest)&&f.executionAuthorized===false&&f.workAccepted===false&&f.ownership==='UNVERIFIED';}
 #result(events:Entry[]){const e=events.at(-1)!;return{transport:'SYNTHETIC_ONLY' as const,key:cloneV1(e.snapshot.key),state:'STOP_UNCONFIRMED' as const,reason:e.snapshot.reason,receiptRef:cloneV1(e.ref),responseRef:cloneV1(e.snapshot.responseRef),writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false};}
 /** 역사 중지 요청/미확인만 읽는다. interrupt ACK도 STOPPED/실제 writer 회수로 승격하지 않는다. */
 async observations(rawEnvelope:unknown){
  try{
   this.#ports();const raw=cloneV1(rawEnvelope),e=readDispatchEnvelopeV1(raw,Date.parse((raw as any)?.issuedAt));
   if(e.operation!=='REQUEST_STOP'||Date.parse(e.issuedAt)>this.#now()||!same(e.context,this.#expected.context)||!same(e.executorRegistrationRef,this.#expected.envelopeExecutorRef))return fail('STOP_OBSERVATION_ENVELOPE_INVALID');
   const scope={projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration},inputs=await this.store.exclusive(cloneV1(scope),async tx=>{
    this.#ports();return this.#journal(await tx.read(),e).map(entry=>{const s=entry.snapshot;return{...scope,eventId:entry.ref.id,type:s.state==='STOP_ATTEMPTED'?'STOP_REQUESTED':'STOP_UNCONFIRMED',commandId:e.commandId,envelopeHash:e.envelopeHash,localRecordRef:cloneV1(entry.ref),processRef:null,occurredAt:s.at,reasonCode:s.state==='STOP_ATTEMPTED'?'NONE':'STOP_UNCONFIRMED'};});
   });this.#ports();return{transport:'SYNTHETIC_ONLY' as const,inputs,verification:'PROVIDER_CLAIM_ONLY' as const,currentAuthorityVerified:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof StopFailure)throw error;return fail('STOP_OBSERVATION_UNAVAILABLE');}
 }
 /** 명시 보관만 연결한다. 원 ID 중복 검사로 재수집하며 서버 전송·자동 회수/삭제는 하지 않는다. */
 async recordObservations(rawEnvelope:unknown,spool:SyntheticObservationSpool){
  try{
   if(!(spool instanceof SyntheticObservationSpool))return fail('STOP_OBSERVATION_SPOOL_REQUIRED');const source=await this.observations(rawEnvelope),recordedRefs:RuntimeRefV1[]=[];
   for(const input of source.inputs){this.#ports();const saved=await spool.append(input);this.#ports();recordedRefs.push(cloneV1(saved.ref));}
   return{transport:'SYNTHETIC_ONLY' as const,recordedRefs,verification:'PROVIDER_CLAIM_ONLY' as const,ackAudited:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof StopFailure)throw error;return fail('STOP_OBSERVATION_RECORD_UNAVAILABLE');}
 }
 async stop(rawEnvelope:unknown,selection?:{expiresAt:string}){
  try{
   this.#ports();const raw=cloneV1(rawEnvelope),e=readDispatchEnvelopeV1(raw,Date.parse((raw as any)?.issuedAt));if(e.operation!=='REQUEST_STOP'||Date.parse(e.issuedAt)>this.#now()||!same(e.context,this.#expected.context)||!same(e.executorRegistrationRef,this.#expected.envelopeExecutorRef))return fail('STOP_ENVELOPE_INVALID');const scope={projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration};
   let selectionEnd=Date.parse(e.expiresAt);if(selection!==undefined){if(!recordV1(selection,['expiresAt'])||!isoV1(selection.expiresAt)||Date.parse(selection.expiresAt)>selectionEnd||Date.parse(selection.expiresAt)<=this.#now())fail('STOP_SELECTION_INVALID');selectionEnd=Date.parse(selection.expiresAt);}
   return await this.store.exclusive(cloneV1(scope),async tx=>{
    let events=this.#journal(await tx.read(),e);const append=async(state:Entry['snapshot']['state'],bindingHash:string,reason:Reason,responseFact:ResponseFact|null)=>{const responseRef=responseFact?{id:randomUUID(),version:1,contentHash:hash(responseFact)}:null,snapshot={sequence:events.length+1,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,bindingHash,at:new Date(this.#now()).toISOString(),responseRef,responseFact,previousRef:events.at(-1)?.ref??null,reason},entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};this.#journal({complete:true,events:[...events,entry]},e);await tx.appendAndSync(cloneV1(entry));events.push(entry);};
    if(selection!==undefined&&this.#now()>=selectionEnd)fail('STOP_SELECTION_EXPIRED');if(events.length===2)return this.#result(events);if(events.length===1){await append('STOP_UNCONFIRMED',events[0]!.snapshot.bindingHash,'ATTEMPT_UNCERTAIN',null);return this.#result(events);}
    readDispatchEnvelopeV1(e,this.#now());const before=await this.#current(e,selectionEnd);await append('STOP_ATTEMPTED',before.bindingHash,'NONE',null);const current=await this.#current(e,selectionEnd);if(current.bindingHash!==before.bindingHash)fail('STOP_CURRENT_CHANGED');
    const requestId=hash({key:receiptKeyV1(e),envelopeHash:e.envelopeHash}),encoded=this.codec.encodeRequest('turn/interrupt',requestId,current.params);if(encoded.kind!=='ENCODED')return fail('STOP_CODEC_UNAVAILABLE');const final=await this.#current(e,selectionEnd);if(final.bindingHash!==current.bindingHash)fail('STOP_CURRENT_CHANGED');const deadline=Math.min(before.deadline,current.deadline,final.deadline);
    let reason:Reason='PROVIDER_ACK_ONLY',responseFact:ResponseFact|null=null;
    try{const response=await this.#bounded(signal=>this.wire.exchange(new Uint8Array(encoded.wire),signal,{key:receiptKeyV1(e),envelopeHash:e.envelopeHash,localAttemptRef:cloneV1(events[0]!.ref),permitRef:null,instructionContentHash:null,bindingHash:before.bindingHash}),deadline);if(!(response instanceof Uint8Array)||response.byteLength>2*1024*1024||this.#now()>=deadline)throw Error('STOP_RESPONSE_UNCERTAIN');const facts=this.codec.push(new Uint8Array(response)),matched=facts.find(f=>f.kind==='INTERRUPT_RESPONSE'&&f.requestIdDigest===hash(requestId));if(facts.some(f=>['PROTOCOL_UNKNOWN','CONTEXT_UNVERIFIED','RPC_ERROR','TOOL_ERROR_FACT','TOOL_APPROVAL_REQUIRED'].includes(f.kind))||!matched){reason='PROTOCOL_UNCERTAIN';}else{responseFact={transport:'SYNTHETIC_ONLY',source:'CODEX_0161_PROVIDER_CLAIM',fact:cloneV1(matched)};}}catch{reason='RESPONSE_LOST';}
    await append('STOP_UNCONFIRMED',before.bindingHash,reason,responseFact);return this.#result(events);
   });
  }catch(error){if(error instanceof StopFailure)throw error;return fail('STOP_STORAGE_UNAVAILABLE');}
 }
}
