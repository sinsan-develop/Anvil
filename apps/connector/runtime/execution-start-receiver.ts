import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {SyntheticObservationSpool} from './execution-observation-spool.ts';

type State='RECEIVED'|'START_ATTEMPTED'|'PERMIT_RECORDED'|'RESPONSE_RECORDED'|'UNKNOWN';
type Reason='NONE'|'PERMIT_UNCERTAIN'|'RESPONSE_UNCERTAIN'|'STORAGE_UNCERTAIN'|'START_UNCERTAIN';
type Scope={projectId:string;executionId:string;executionGeneration:number};
interface Entry{ref:RuntimeRefV1;snapshot:{sequence:number;state:State;key:ReceiptKeyV1;envelopeHash:string;grantRef:RuntimeRefV1;permitRef:RuntimeRefV1|null;responseRef:RuntimeRefV1|null;at:string;previousRef:RuntimeRefV1|null;reason:Reason}}
export interface SyntheticStartTransaction{
 read():Promise<{complete:boolean;events:Entry[]}>;
 /** 성공한 append는 callback의 이후 실패로 rollback하지 않고 내구 보존해야 한다.
  * 쓰기/sync가 불명확하면 incomplete로 보존하고 자동 삭제·재생성하지 않는다. */
 appendAndSync(value:Entry):Promise<void>;
}
export interface SyntheticStartStore{
 transport:'SYNTHETIC_ONLY';
 /** 같은 project/execution/generation의 전 journal을 단일 writer로 잠근다. */
 exclusive<T>(scope:Scope,body:(tx:SyntheticStartTransaction)=>Promise<T>):Promise<T>;
}
export interface SyntheticStartAuthority{transport:'SYNTHETIC_ONLY';consume(envelope:DispatchEnvelopeV1,localAttemptRef:RuntimeRefV1):Promise<unknown>}
export interface SyntheticStartWire{transport:'SYNTHETIC_ONLY';send(value:{envelope:DispatchEnvelopeV1;permitRef:RuntimeRefV1}):Promise<unknown>}
interface Expected{context:AdapterContextV1;executorRegistrationRef:RuntimeRefV1;grantRef:RuntimeRefV1}
class StartFailure extends Error{}
const fail=(code:string):never=>{throw new StartFailure(code);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));

/** P1 합성 시작 수신기. 실제 credential/OS/helper/Agent 기본값 또는 환경 fallback은 없다.
 * store의 durability·exclusive 구현은 별도 검증 대상이며 fake port 통과는 실제 fsync 증거가 아니다.
 * 이 상태는 기존 비권위 DispatchReceiptV1을 승격하지 않고 모든 authority flag=false를 유지한다. */
export class SyntheticStartReceiver{
 readonly store:SyntheticStartStore;readonly authority:SyntheticStartAuthority;readonly wire:SyntheticStartWire;
 #expected:Expected;readonly clock:()=>number;
 constructor(store:SyntheticStartStore,authority:SyntheticStartAuthority,wire:SyntheticStartWire,expected:Expected,clock:()=>number){
  this.store=store;this.authority=authority;this.wire=wire;this.clock=clock;this.#ports();
  if(typeof clock!=='function'||!recordV1(expected,['context','executorRegistrationRef','grantRef'])||!refV1(expected.executorRegistrationRef)||!refV1(expected.grantRef))fail('START_CONTEXT_INVALID');
  this.#expected=cloneV1(expected);
 }
 #ports(){if(!this.store||this.store.transport!=='SYNTHETIC_ONLY'||typeof this.store.exclusive!=='function'||!this.authority||this.authority.transport!=='SYNTHETIC_ONLY'||typeof this.authority.consume!=='function'||!this.wire||this.wire.transport!=='SYNTHETIC_ONLY'||typeof this.wire.send!=='function')fail('SYNTHETIC_START_PORTS_REQUIRED');}
 #now(){const n=this.clock();if(!Number.isSafeInteger(n)||!isoV1(new Date(n).toISOString()))return fail('START_CLOCK_INVALID');return n;}
 #input(raw:unknown){this.#ports();const e=readDispatchEnvelopeV1(raw,this.#now());if(e.operation!=='START_SESSION')fail('START_OPERATION_NOT_SUPPORTED');if(!same(e.context,this.#expected.context)||!same(e.executorRegistrationRef,this.#expected.executorRegistrationRef))fail('START_CONTEXT_MISMATCH');return e;}
 #scope(e:DispatchEnvelopeV1):Scope{return{projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration};}
 #validNow(e:DispatchEnvelopeV1){try{readDispatchEnvelopeV1(e,this.#now());}catch(error){if(error instanceof Error&&['ENVELOPE_INVALID','ENVELOPE_EXPIRED','ENVELOPE_NOT_YET_VALID'].includes(error.message))return fail(error.message);return fail('ENVELOPE_INVALID');}}
 async #exclusive<T>(e:DispatchEnvelopeV1,body:(tx:SyntheticStartTransaction)=>Promise<T>):Promise<T>{
  try{return await this.store.exclusive(this.#scope(e),body);}catch(error){if(error instanceof StartFailure)throw error;if(error instanceof Error&&['START_INBOX_BUSY','START_SCOPE_MISMATCH'].includes(error.message))return fail(error.message);return fail('START_STORAGE_UNAVAILABLE');}
 }
 #journal(raw:unknown,e:DispatchEnvelopeV1):Entry[]{
  if(!recordV1(raw,['complete','events'])||raw.complete!==true)return fail('START_LEDGER_INCOMPLETE');
  if(!Array.isArray(raw.events)||raw.events.length>4||Buffer.byteLength(canonicalJson(raw))>65536)fail('START_LEDGER_INVALID');
  const events:Entry[]=cloneV1(raw.events);let last=-Infinity;
  for(let i=0;i<events.length;i++){
   const entry=events[i]!,s=entry?.snapshot,prior=events[i-1];
   if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||!recordV1(s,['sequence','state','key','envelopeHash','grantRef','permitRef','responseRef','at','previousRef','reason'])
    ||entry.ref.contentHash!==hash(s)||entry.ref.version!==1||s.sequence!==i+1||!hashV1(s.envelopeHash)||!isoV1(s.at)||Date.parse(s.at)<last||Date.parse(s.at)>this.#now()
    ||!same(s.grantRef,this.#expected.grantRef)||!refV1(s.grantRef)||!same(s.previousRef,prior?.ref??null)
    ||!recordV1(s.key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(s.key.commandId)
    ||!same({projectId:s.key.projectId,executionId:s.key.executionId,executionGeneration:s.key.executionGeneration},this.#scope(e))
    ||(s.permitRef!==null&&!refV1(s.permitRef))||(s.responseRef!==null&&!refV1(s.responseRef)))fail('START_LEDGER_INVALID');
   if(!prior){if(s.state!=='RECEIVED'||s.permitRef!==null||s.responseRef!==null||s.reason!=='NONE')fail('START_LEDGER_INVALID');}
   else if(!same(s.key,prior.snapshot.key)||s.envelopeHash!==prior.snapshot.envelopeHash)fail('START_LEDGER_INVALID');
   if(i===1&&(s.state!=='START_ATTEMPTED'||s.permitRef!==null||s.responseRef!==null||s.reason!=='NONE'))fail('START_LEDGER_INVALID');
   if(i===2&&(s.responseRef!==null||!((s.state==='PERMIT_RECORDED'&&refV1(s.permitRef)&&s.reason==='NONE')||(s.state==='UNKNOWN'&&s.permitRef===null&&s.reason==='PERMIT_UNCERTAIN'))))fail('START_LEDGER_INVALID');
   if(i===3&&(prior!.snapshot.state!=='PERMIT_RECORDED'||!same(s.permitRef,prior!.snapshot.permitRef)
    ||!((s.state==='RESPONSE_RECORDED'&&refV1(s.responseRef)&&s.reason==='NONE')||(s.state==='UNKNOWN'&&s.responseRef===null&&s.reason==='RESPONSE_UNCERTAIN'))))fail('START_LEDGER_INVALID');
   last=Date.parse(s.at);
  }
  if(events.length&&(!same(events[0]!.snapshot.key,receiptKeyV1(e))||events[0]!.snapshot.envelopeHash!==e.envelopeHash))fail('START_RECORD_CONFLICT');
  return events;
 }
 #result(e:DispatchEnvelopeV1,state:State,reason:Reason,responseRef:RuntimeRefV1|null=null){return{transport:'SYNTHETIC_ONLY' as const,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,state,reason,responseRef:cloneV1(responseRef),executionAuthorized:false as const,dispatchPerformed:false as const};}
 #existing(e:DispatchEnvelopeV1,events:Entry[]){const s=events.at(-1)!.snapshot;return ['START_ATTEMPTED','PERMIT_RECORDED'].includes(s.state)?this.#result(e,'UNKNOWN','START_UNCERTAIN'):this.#result(e,s.state,s.reason,s.responseRef);}
 async #append(tx:SyntheticStartTransaction,e:DispatchEnvelopeV1,events:Entry[],state:State,reason:Reason='NONE',permitRef:RuntimeRefV1|null=null,responseRef:RuntimeRefV1|null=null){
  const snapshot:Entry['snapshot']={sequence:events.length+1,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,grantRef:cloneV1(this.#expected.grantRef),permitRef:cloneV1(permitRef),responseRef:cloneV1(responseRef),at:new Date(this.#now()).toISOString(),previousRef:cloneV1(events.at(-1)?.ref??null),reason};
  const entry:Entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(cloneV1(entry));events.push(entry);
 }
 /** grant를 가진 상위 수신 경로는 append 전에 고정 expected와 대조한다. 기존 단일인자 호출은 보존한다. */
 async receive(raw:unknown,expectedGrantRef?:unknown){const e=this.#input(raw);if(expectedGrantRef!==undefined&&(!refV1(expectedGrantRef)||!same(expectedGrantRef,this.#expected.grantRef)))fail('START_GRANT_MISMATCH');return this.#exclusive(e,async tx=>{
  const events=this.#journal(await tx.read(),e);if(events.length)return this.#existing(e,events);
  this.#validNow(e);
  try{await this.#append(tx,e,events,'RECEIVED');return this.#existing(e,events);}catch{return this.#result(e,'UNKNOWN','STORAGE_UNCERTAIN');}
 });}
 /** 만료 후에도 기존 불명 기록을 회수할 수 있는 관측 전용 조회다. permit/wire/현재 실행 허가를 호출하지 않는다. */
 async observationBatch(raw:unknown){
  if(this.store.transport!=='SYNTHETIC_ONLY')fail('SYNTHETIC_START_PORTS_REQUIRED');
  if(!recordV1(raw,['schemaVersion','commandId','issuedAt','expiresAt','executorRegistrationRef','context','operation','payload','envelopeHash'])||!isoV1(raw.issuedAt))return fail('START_HISTORY_ENVELOPE_INVALID');
  const e=readDispatchEnvelopeV1(raw,Date.parse(raw.issuedAt));
  if(e.operation!=='START_SESSION'||!same(e.context,this.#expected.context)||!same(e.executorRegistrationRef,this.#expected.executorRegistrationRef))fail('START_CONTEXT_MISMATCH');
  return this.#exclusive(e,async tx=>{
   const entries=this.#journal(await tx.read(),e),events=entries.map(entry=>{const s=entry.snapshot;
    return{projectId:s.key.projectId,executionId:s.key.executionId,executionGeneration:s.key.executionGeneration,sequence:s.sequence,eventId:entry.ref.id,
     type:s.state==='RESPONSE_RECORDED'?'PROVIDER_RESPONSE_RECEIVED':s.state,commandId:s.key.commandId,envelopeHash:s.envelopeHash,localRecordRef:cloneV1(entry.ref),processRef:null,
     occurredAt:s.at,reasonCode:s.state==='UNKNOWN'?(s.reason==='RESPONSE_UNCERTAIN'?'PROVIDER_RESPONSE_LOST':'RECORD_UNCERTAIN'):'NONE'};
   });return{events,batchHash:hash(events)};
  });
 }
 /** 기존 source batch는 그대로 두고 명시 global spool 수집만 연결한다. source 순번은 global 순번/ACK가 아니다. */
 async recordObservations(raw:unknown,spool:SyntheticObservationSpool){
  try{
   this.#ports();if(!(spool instanceof SyntheticObservationSpool))return fail('START_OBSERVATION_SPOOL_REQUIRED');const packet=await this.observationBatch(raw);this.#ports();
   if(!Array.isArray(packet.events)||packet.events.length>4||packet.batchHash!==hash(packet.events))return fail('START_OBSERVATION_BATCH_INVALID');const recordedRefs:RuntimeRefV1[]=[];
   for(const source of packet.events){const{sequence:_,...input}=source;if(input.type==='PROVIDER_RESPONSE_RECEIVED')input.reasonCode='UNVERIFIED_PROVIDER_CLAIM';this.#ports();const saved=await spool.append(input);this.#ports();recordedRefs.push(cloneV1(saved.ref));}
   return{transport:'SYNTHETIC_ONLY' as const,recordedRefs,verification:'PROVIDER_CLAIM_ONLY' as const,currentAuthorityVerified:false as const,ackAudited:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof StartFailure)throw error;return fail('START_OBSERVATION_RECORD_UNAVAILABLE');}
 }
 async start(raw:unknown){const e=this.#input(raw);return this.#exclusive(e,async tx=>{
  const events=this.#journal(await tx.read(),e);if(!events.length)fail('START_NOT_RECEIVED');if(events.length>1)return this.#existing(e,events);
  this.#validNow(e);
  try{await this.#append(tx,e,events,'START_ATTEMPTED');}catch{return this.#result(e,'UNKNOWN','STORAGE_UNCERTAIN');}
  let permit:RuntimeRefV1|null=null,reason:Reason='PERMIT_UNCERTAIN';
  try{
   this.#ports();this.#validNow(e);const p=cloneV1(await this.authority.consume(cloneV1(e),cloneV1(events.at(-1)!.ref))),at=this.#now();
   if(!recordV1(p,['transport','key','envelopeHash','grantRef','permitRef','checkedAt','expiresAt'])||p.transport!=='SYNTHETIC_ONLY'||!same(p.key,receiptKeyV1(e))||p.envelopeHash!==e.envelopeHash||!same(p.grantRef,this.#expected.grantRef)||!refV1(p.permitRef)
    ||!isoV1(p.checkedAt)||!isoV1(p.expiresAt)||Date.parse(p.checkedAt)>at||at-Date.parse(p.checkedAt)>30000||Date.parse(p.expiresAt)<=at||Date.parse(p.expiresAt)>Date.parse(p.checkedAt)+30000||Date.parse(p.expiresAt)>Date.parse(e.expiresAt)||at>=Date.parse(e.expiresAt))throw Error('SYNTHETIC_PERMIT_INVALID');
   permit=cloneV1(p.permitRef);
   try{await this.#append(tx,e,events,'PERMIT_RECORDED','NONE',permit);}catch{return this.#result(e,'UNKNOWN','STORAGE_UNCERTAIN');}
   reason='RESPONSE_UNCERTAIN';this.#ports();this.#validNow(e);if(this.#now()>=Date.parse(p.expiresAt))throw Error('SYNTHETIC_PERMIT_EXPIRED');
   const response=cloneV1(await this.wire.send({envelope:cloneV1(e),permitRef:cloneV1(permit)}));
   if(!recordV1(response,['transport','responseRef'])||response.transport!=='SYNTHETIC_ONLY'||!refV1(response.responseRef))throw Error('SYNTHETIC_RESPONSE_INVALID');
   try{await this.#append(tx,e,events,'RESPONSE_RECORDED','NONE',permit,response.responseRef);return this.#existing(e,events);}catch{return this.#result(e,'UNKNOWN','STORAGE_UNCERTAIN');}
  }catch{
   try{await this.#append(tx,e,events,'UNKNOWN',reason,permit);return this.#existing(e,events);}catch{return this.#result(e,'UNKNOWN','STORAGE_UNCERTAIN');}
  }
 });}
}
