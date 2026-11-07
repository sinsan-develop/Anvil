import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

export interface ObservationScope{mode:'EXECUTION'|'RECOVERY';projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:RuntimeRefV1;credentialGeneration:number}
type ExecutionScope=Pick<ObservationScope,'projectId'|'executionId'|'executionGeneration'>;
type Event={projectId:string;executionId:string;executionGeneration:number;sequence:number;eventId:string;type:string;commandId:string;envelopeHash:string;localRecordRef:RuntimeRefV1;processRef:RuntimeRefV1|null;occurredAt:string;reasonCode:string};
type Observation={ref:RuntimeRefV1;snapshot:{event:Event;grantRef:RuntimeRefV1;credentialGeneration:number;mode:'EXECUTION'|'RECOVERY';receivedAt:string;transport:'SYNTHETIC_ONLY';verification:'PROVIDER_CLAIM_ONLY'}};
type Summary={execution:{projectId:string;executionId:string;executionGeneration:number};highestContiguous:number;maxSequence:number;contiguousDigest:string;gaps:{from:number;to:number}[];storedCount:number;writerReleaseVerified:false;executionAuthorized:false;dispatchPerformed:false};
type Ack={ref:RuntimeRefV1;snapshot:Summary&{recordedAt:string}};
export interface SyntheticObservationTransaction{
 clock():Promise<string>;
 /** 서버 내부의 현재 허가 결정이다. 실제 구현은 로그인/제어/host proof/nonce/정책/회수 권한을 같은 tx에서 검사해야 한다. */
 current():Promise<unknown>;
 read():Promise<{complete:boolean;events:Observation[];ack:Ack|null}>;
 append(value:Observation):Promise<void>;
 saveAck(value:Ack):Promise<void>;
}
export interface SyntheticObservationStore{
 transport:'SYNTHETIC_ONLY';
 /** 잠금과 순번은 grant가 아닌 project/execution/generation 기준이다. 관측/ACK/nonce를 같이 COMMIT/rollback해야 한다. */
 transaction<T>(scope:ObservationScope,body:(tx:SyntheticObservationTransaction)=>Promise<T>):Promise<T>;
}
class ObservationFailure extends Error{}
const fail=(code:string):never=>{throw new ObservationFailure(code);};
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const execution=(s:ExecutionScope)=>({projectId:s.projectId,executionId:s.executionId,executionGeneration:s.executionGeneration});
const types=['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'];
const reasons=['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'];
function readScope(raw:unknown):ObservationScope{
 if(!recordV1(raw,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||!['EXECUTION','RECOVERY'].includes(raw.mode)
  ||!uuidV1(raw.projectId)||!uuidV1(raw.connectorId)||!uuidV1(raw.executionId)||!positive(raw.executionGeneration)||!refV1(raw.grantRef)||!positive(raw.credentialGeneration))return fail('OBSERVATION_SCOPE_INVALID');
 return cloneV1(raw) as unknown as ObservationScope;
}
function readEvent(raw:unknown,scope:ExecutionScope,now:string):Event{
 if(Buffer.byteLength(canonicalJson(raw))>65536)return fail('OBSERVATION_EVENT_TOO_LARGE');
 if(!recordV1(raw,['projectId','executionId','executionGeneration','sequence','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode'])
  ||!same({projectId:raw.projectId,executionId:raw.executionId,executionGeneration:raw.executionGeneration},execution(scope))||!positive(raw.sequence)||raw.sequence>10000
  ||!uuidV1(raw.eventId)||!types.includes(raw.type)||!uuidV1(raw.commandId)||!hashV1(raw.envelopeHash)||!refV1(raw.localRecordRef)||raw.processRef!==null&&!refV1(raw.processRef)
  ||!isoV1(raw.occurredAt)||Date.parse(raw.occurredAt)>Date.parse(now)+30000||!reasons.includes(raw.reasonCode))return fail('OBSERVATION_EVENT_INVALID');
 return cloneV1(raw) as unknown as Event;
}
function summarize(events:Observation[],scope:ExecutionScope):Summary{
 const sorted=[...events].sort((a,b)=>a.snapshot.event.sequence-b.snapshot.event.sequence);let highest=0,digest=hash([]);const gaps:{from:number;to:number}[]=[];let expected=1;
 for(const entry of sorted){const event=entry.snapshot.event;if(event.sequence>expected)gaps.push({from:expected,to:event.sequence-1});expected=event.sequence+1;
  if(event.sequence===highest+1){highest++;digest=hash({previous:digest,eventHash:hash(event)});}
 }
 return{execution:execution(scope),highestContiguous:highest,maxSequence:sorted.at(-1)?.snapshot.event.sequence??0,contiguousDigest:digest,gaps,storedCount:events.length,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false};
}
/** P1 합성 관측 주장 저장/연속 ACK. STARTED/STOPPED/heartbeat는 공급자 주장일 뿐 writer 회수/업무완료를 확정하지 않는다.
 * 실제 HTTP/proof/DB adapter·OS/Agent fallback은 없고, generic transaction의 합성 검수만으로 실제 원자성을 주장하지 않는다. */
export class SyntheticExecutionObservations{
 readonly store:SyntheticObservationStore;
 constructor(store:SyntheticObservationStore){if(!store||store.transport!=='SYNTHETIC_ONLY'||typeof store.transaction!=='function')fail('SYNTHETIC_OBSERVATION_STORE_REQUIRED');this.store=store;}
 async #current(tx:SyntheticObservationTransaction,scope:ObservationScope){
  const c=cloneV1(await tx.current()),now=await tx.clock();if(!isoV1(now)||!recordV1(c,['transport','scope','operation','authorityRef','checkedAt','expiresAt'])||c.transport!=='SYNTHETIC_ONLY'
   ||!same(c.scope,scope)||c.operation!=='SYNC_OBSERVATIONS'||!refV1(c.authorityRef)||!isoV1(c.checkedAt)||!isoV1(c.expiresAt)||Date.parse(c.checkedAt)>Date.parse(now)
   ||Date.parse(now)-Date.parse(c.checkedAt)>30000||Date.parse(c.expiresAt)<=Date.parse(now))return fail('OBSERVATION_CURRENT_AUTHORITY_REQUIRED');
  return{now,binding:{transport:c.transport,scope:c.scope,operation:c.operation,authorityRef:c.authorityRef}};
 }
 #journal(raw:unknown,scope:ObservationScope,now:string){return inspectStoredObservationJournal(execution(scope),raw,now);}
 async ingest(rawScope:unknown,rawBatch:unknown):Promise<Ack>{
  let scope:ObservationScope,batch:any;
  try{scope=readScope(rawScope);if(!recordV1(rawBatch,['events','batchHash'])||!arrayV1(rawBatch.events,200)||!rawBatch.events.length||!hashV1(rawBatch.batchHash)||Buffer.byteLength(canonicalJson(rawBatch))>1024*1024||rawBatch.batchHash!==hash(rawBatch.events))return fail('OBSERVATION_BATCH_INVALID');batch=cloneV1(rawBatch);}catch(error){if(error instanceof ObservationFailure)throw error;return fail('OBSERVATION_BATCH_INVALID');}
  try{
   if(this.store.transport!=='SYNTHETIC_ONLY')fail('SYNTHETIC_OBSERVATION_STORE_REQUIRED');
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const current=await this.#current(tx,scope),incoming:Event[]=batch.events.map((e:unknown)=>readEvent(e,scope,current.now));
    const ledger=this.#journal(await tx.read(),scope,current.now),bySequence=new Map(ledger.events.map(e=>[e.snapshot.event.sequence,e])),ids=new Set(ledger.events.map(e=>e.snapshot.event.eventId));let added=0;
    for(const event of incoming){const old=bySequence.get(event.sequence);if(old){if(!same(old.snapshot.event,event))fail('OBSERVATION_SEQUENCE_CONFLICT');continue;}
     if(ids.has(event.eventId))fail('OBSERVATION_EVENT_ID_CONFLICT');if(ledger.events.length>=10000)fail('OBSERVATION_LIFETIME_LIMIT');
     const snapshot:Observation['snapshot']={event,grantRef:cloneV1(scope.grantRef),credentialGeneration:scope.credentialGeneration,mode:scope.mode,receivedAt:current.now,transport:'SYNTHETIC_ONLY',verification:'PROVIDER_CLAIM_ONLY'};
     const entry:Observation={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.append(cloneV1(entry));ledger.events.push(entry);bySequence.set(event.sequence,entry);ids.add(event.eventId);added++;
    }
    const final=await this.#current(tx,scope);if(!same(current.binding,final.binding))fail('OBSERVATION_CURRENT_BINDING_CHANGED');
    if(!added&&ledger.ack)return cloneV1(ledger.ack);
    const snapshot={...summarize(ledger.events,scope),recordedAt:final.now},ack:Ack={ref:{id:ledger.ack?.ref.id??randomUUID(),version:(ledger.ack?.ref.version??0)+1,contentHash:hash(snapshot)},snapshot};
    await tx.saveAck(cloneV1(ack));const committed=await this.#current(tx,scope);if(!same(final.binding,committed.binding))fail('OBSERVATION_CURRENT_BINDING_CHANGED');return cloneV1(ack);
   });
  }catch(error){if(error instanceof ObservationFailure)throw error;return fail('OBSERVATION_STORAGE_UNAVAILABLE');}
 }
}

/** 보관 원장의 무결성/연속 ACK만 검사한다. 현재 허가·OS 상태를 확인하거나 저장하지 않는다. */
export function inspectStoredObservationJournal(rawScope:unknown,raw:unknown,now:string){
 if(!recordV1(rawScope,['projectId','executionId','executionGeneration'])||!uuidV1(rawScope.projectId)||!uuidV1(rawScope.executionId)||!positive(rawScope.executionGeneration)||!isoV1(now))return fail('OBSERVATION_SCOPE_INVALID');
 const scope=cloneV1(rawScope) as ExecutionScope;

  if(!recordV1(raw,['complete','events','ack'])||raw.complete!==true)return fail('OBSERVATION_LEDGER_INCOMPLETE');
  if(!arrayV1(raw.events,10000)||Buffer.byteLength(canonicalJson(raw))>16*1024*1024)return fail('OBSERVATION_LEDGER_INVALID');
  const entries:Observation[]=cloneV1(raw.events),sequences=new Set<number>(),ids=new Set<string>(),refs=new Set<string>();
  for(const entry of entries){const s=entry?.snapshot;
   if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||entry.ref.version!==1||!recordV1(s,['event','grantRef','credentialGeneration','mode','receivedAt','transport','verification'])
    ||entry.ref.contentHash!==hash(s)||!refV1(s.grantRef)||!positive(s.credentialGeneration)||!['EXECUTION','RECOVERY'].includes(s.mode)||!isoV1(s.receivedAt)||Date.parse(s.receivedAt)>Date.parse(now)
    ||s.transport!=='SYNTHETIC_ONLY'||s.verification!=='PROVIDER_CLAIM_ONLY'||refs.has(entry.ref.id))return fail('OBSERVATION_LEDGER_INVALID');
   try{readEvent(s.event,scope,now);}catch{return fail('OBSERVATION_LEDGER_INVALID');}
   if(sequences.has(s.event.sequence)||ids.has(s.event.eventId))return fail('OBSERVATION_LEDGER_INVALID');sequences.add(s.event.sequence);ids.add(s.event.eventId);refs.add(entry.ref.id);
  }
  const ack=cloneV1(raw.ack) as Ack|null;
  if(ack===null){if(entries.length)return fail('OBSERVATION_LEDGER_INVALID');}
  else{
   if(!recordV1(ack,['ref','snapshot'])||!refV1(ack.ref)||ack.ref.contentHash!==hash(ack.snapshot)||!recordV1(ack.snapshot,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])||!isoV1(ack.snapshot.recordedAt)||Date.parse(ack.snapshot.recordedAt)>Date.parse(now))return fail('OBSERVATION_LEDGER_INVALID');
   const {recordedAt:_,...summary}=ack.snapshot;if(!same(summary,summarize(entries,scope)))return fail('OBSERVATION_LEDGER_INVALID');
  }
  return{events:entries,ack};
}
