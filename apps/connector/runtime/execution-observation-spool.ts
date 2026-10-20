import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {SyntheticExecutionClient} from './execution-client.ts';
import {readClientScope} from './execution-ledger.ts';
type Scope={projectId:string;executionId:string;executionGeneration:number};
type Input=Scope&{eventId:string;type:string;commandId:string;envelopeHash:string;localRecordRef:Ref;processRef:Ref|null;occurredAt:string;reasonCode:string};
type Event=Input&{sequence:number};
type Entry={ref:Ref;snapshot:{event:Event;transport:'SYNTHETIC_ONLY';verification:'PROVIDER_CLAIM_ONLY';recordedAt:string;previousRef:Ref|null}};
export interface SyntheticObservationSpoolStore{
 transport:'SYNTHETIC_ONLY';
 /** execution 전체 잠금. sync 실패/부분 파일은 complete=false로 보존하며 임의 초기화하지 않는다. */
 exclusive<T>(scope:Scope,body:(tx:{read():Promise<{complete:boolean;events:Entry[]}>;appendAndSync(entry:Entry):Promise<void>})=>Promise<T>):Promise<T>;
}
type Options={clock:()=>number;maxEntries:number;maxBytes:number;maxBatchEntries:number;maxBatchBytes:number};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v)),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const inputKeys=['projectId','executionId','executionGeneration','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode'];
const types=['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'];
const reasons=['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'];
class SpoolFailure extends Error{}
const fail=(code:string):never=>{throw new SpoolFailure(code);};
/** 합성 관측 주장만 순번 보관한다. OS/Agent 관측·현재 권한·물리 내구성을 만들지 않는다.
 * 명시 afterSequence는 조회 선택일 뿐 서버 ACK/삭제 허가가 아니다. 자동 전송/삭제/회수/완료 판정은 없다. */
export class SyntheticObservationSpool{
 readonly transport='SYNTHETIC_ONLY' as const;readonly store:SyntheticObservationSpoolStore;
 #scope:Scope;#options:Options;
 constructor(store:SyntheticObservationSpoolStore,scope:unknown,options:Options){
  this.store=store;this.#port();
  if(!recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||!positive(scope.executionGeneration)||typeof options?.clock!=='function'||!positive(options.maxEntries)||options.maxEntries>10000||!positive(options.maxBytes)||options.maxBytes>16*1024*1024||!positive(options.maxBatchEntries)||options.maxBatchEntries>200||!positive(options.maxBatchBytes)||options.maxBatchBytes>1024*1024)fail('OBSERVATION_SPOOL_CONFIG_INVALID');
  this.#scope=cloneV1(scope) as Scope;this.#options={...options};
 }
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.exclusive!=='function')fail('SYNTHETIC_OBSERVATION_SPOOL_REQUIRED');}
 #now(){const at=this.#options.clock();if(!Number.isSafeInteger(at)||!Number.isFinite(new Date(at).getTime()))return fail('OBSERVATION_SPOOL_CLOCK_INVALID');return at;}
 #input(raw:unknown):Input{
  if(!recordV1(raw,inputKeys)||!same({projectId:raw.projectId,executionId:raw.executionId,executionGeneration:raw.executionGeneration},this.#scope)||!uuidV1(raw.eventId)||!types.includes(raw.type)||!uuidV1(raw.commandId)||!hashV1(raw.envelopeHash)||!refV1(raw.localRecordRef)||raw.processRef!==null&&!refV1(raw.processRef)||!isoV1(raw.occurredAt)||Date.parse(raw.occurredAt)>this.#now()+30000||!reasons.includes(raw.reasonCode)||['STARTED','STOPPED','PROVIDER_RESPONSE_RECEIVED'].includes(raw.type)&&raw.reasonCode!=='UNVERIFIED_PROVIDER_CLAIM'||Buffer.byteLength(canonicalJson(raw))>65536)return fail('OBSERVATION_SPOOL_EVENT_INVALID');
  return cloneV1(raw) as Input;
 }
 #source(e:Input){return hash({type:e.type,commandId:e.commandId,envelopeHash:e.envelopeHash,localRecordRef:e.localRecordRef});}
 #journal(raw:unknown):Entry[]{
  if(!recordV1(raw,['complete','events'])||raw.complete!==true||!arrayV1(raw.events,this.#options.maxEntries)||Buffer.byteLength(canonicalJson(raw))>this.#options.maxBytes)return fail('OBSERVATION_SPOOL_INCOMPLETE');
  const events:Entry[]=cloneV1(raw.events),ids=new Set<string>(),refs=new Set<string>(),sources=new Set<string>();
  for(const [i,entry] of events.entries()){
   const s=entry?.snapshot,e=s?.event;
   if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||entry.ref.version!==1||refs.has(entry.ref.id)||entry.ref.contentHash!==hash(s)||!recordV1(s,['event','transport','verification','recordedAt','previousRef'])||s.transport!=='SYNTHETIC_ONLY'||s.verification!=='PROVIDER_CLAIM_ONLY'||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)>this.#now()+30000||!same(s.previousRef,events[i-1]?.ref??null)||!recordV1(e,[...inputKeys,'sequence'])||e.sequence!==i+1)fail('OBSERVATION_SPOOL_JOURNAL_INVALID');
   const{sequence:_,...input}=e;this.#input(input);const source=this.#source(input as Input);if(ids.has(e.eventId)||sources.has(source))fail('OBSERVATION_SPOOL_JOURNAL_INVALID');ids.add(e.eventId);refs.add(entry.ref.id);sources.add(source);
  }return events;
 }
 async append(raw:unknown){
  try{this.#port();const input=this.#input(raw),result=await this.store.exclusive(cloneV1(this.#scope),async tx=>{
   this.#port();const events=this.#journal(await tx.read()),old=events.find(v=>v.snapshot.event.eventId===input.eventId);
   if(old){const{sequence:_,...prior}=old.snapshot.event;if(!same(prior,input))fail('OBSERVATION_SPOOL_EVENT_CONFLICT');return cloneV1(old);}
   if(events.some(v=>this.#source(v.snapshot.event)===this.#source(input)))fail('OBSERVATION_SPOOL_SOURCE_CONFLICT');if(events.length>=this.#options.maxEntries)fail('OBSERVATION_SPOOL_FULL');
   const snapshot:Entry['snapshot']={event:{...input,sequence:events.length+1},transport:'SYNTHETIC_ONLY',verification:'PROVIDER_CLAIM_ONLY',recordedAt:new Date(this.#now()).toISOString(),previousRef:events.at(-1)?.ref??null},entry:Entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
   this.#journal({complete:true,events:[...events,entry]});this.#port();await tx.appendAndSync(cloneV1(entry));this.#port();const saved=this.#journal(await tx.read());if(!same(saved,[...events,entry]))fail('OBSERVATION_SPOOL_SYNC_UNCERTAIN');return cloneV1(entry);
  });this.#port();return result;}catch(error){if(error instanceof SpoolFailure)throw error;return fail('OBSERVATION_SPOOL_APPEND_UNAVAILABLE');}
 }
 async prepareBatch(afterSequence:unknown){
  try{this.#port();if(!Number.isSafeInteger(afterSequence)||Number(afterSequence)<0||Number(afterSequence)>10000)fail('OBSERVATION_SPOOL_CURSOR_INVALID');
   const result=await this.store.exclusive(cloneV1(this.#scope),async tx=>{
    this.#port();const stored=this.#journal(await tx.read());if(Number(afterSequence)>stored.length)fail('OBSERVATION_SPOOL_CURSOR_INVALID');const events:Event[]=[];
    for(const row of stored.slice(Number(afterSequence),Number(afterSequence)+this.#options.maxBatchEntries)){const next=[...events,row.snapshot.event];if(Buffer.byteLength(canonicalJson({events:next,batchHash:hash(next)}))>this.#options.maxBatchBytes)break;events.push(cloneV1(row.snapshot.event));}
    if(Number(afterSequence)<stored.length&&!events.length)fail('OBSERVATION_SPOOL_BATCH_LIMIT');const batchHash=hash(events);return{transport:'SYNTHETIC_ONLY' as const,execution:cloneV1(this.#scope),events,batchHash,operation:events.length?{kind:'OBSERVATIONS' as const,commandId:null,bodyRaw:canonicalJson({events,batchHash})}:null,ackAudited:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   });this.#port();return result;
  }catch(error){if(error instanceof SpoolFailure)throw error;return fail('OBSERVATION_SPOOL_READ_UNAVAILABLE');}
 }
 async sync(client:SyntheticExecutionClient,rawScope:unknown,afterSequence:unknown){
  try{this.#port();if(!(client instanceof SyntheticExecutionClient))fail('OBSERVATION_SPOOL_CLIENT_INVALID');const scope=readClientScope(rawScope);if(!same({projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration},this.#scope))fail('OBSERVATION_SPOOL_CLIENT_SCOPE_INVALID');
   const batch=await this.prepareBatch(afterSequence);if(!batch.operation)fail('OBSERVATION_SPOOL_BATCH_EMPTY');const delivery=await client.execute(scope,batch.operation);this.#port();
   if(delivery.transport!=='SYNTHETIC_ONLY'||!['UNKNOWN','RESPONSE_RECORDED'].includes(delivery.state)||!refV1(delivery.resultRef)||delivery.executionAuthorized!==false||delivery.dispatchPerformed!==false||delivery.writerReleaseVerified!==false||delivery.ackAudited!==false)fail('OBSERVATION_SPOOL_DELIVERY_UNCERTAIN');
   return{transport:'SYNTHETIC_ONLY' as const,batch,delivery:cloneV1(delivery),ackAudited:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof SpoolFailure)throw error;return fail('OBSERVATION_SPOOL_SYNC_UNAVAILABLE');}
 }
}
