import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,hashV1,isoV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import type {NormalJournalStore,NormalLocalScope} from './normal-start-file-store.ts';
import type {NormalProtectedPostClient,NormalObservationResult} from './normal-protected-post-client.ts';
export interface NormalLocalObservation{type:string;commandId:string;envelopeHash:string;localRecordRef:Ref;processRef:Ref|null;occurredAt:string;reasonCode:string}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const types=['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'];
const reasons=['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'];
const fail=():never=>{throw Error('NORMAL_OBSERVATION_INVALID');};
const integer=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000;
export class NormalObservationSpool{
 readonly executionAuthorized=false;readonly dispatchPerformed=false;
 #store:NormalJournalStore;#scope:NormalLocalScope;#clock:()=>number;
 constructor(store:NormalJournalStore,scope:NormalLocalScope,clock:()=>number){
  if(store?.transport!=='NORMAL_PROTECTED'||typeof store.exclusive!=='function'||typeof clock!=='function'||
   !recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||
   !Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1)fail();
  this.#store=store;this.#scope=cloneV1(scope);this.#clock=clock;
 }
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n))return fail();return n;}
 #event(e:any){
  if(!recordV1(e,['projectId','executionId','executionGeneration','sequence','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode'])||
   !Object.entries(this.#scope).every(([k,v])=>e[k]===v)||!integer(e.sequence)||!e.sequence||!uuidV1(e.eventId)||!uuidV1(e.commandId)||
   !hashV1(e.envelopeHash)||!refV1(e.localRecordRef)||e.processRef!==null&&!refV1(e.processRef)||!isoV1(e.occurredAt)||Date.parse(e.occurredAt)>this.#now()||
   !types.includes(e.type)||!reasons.includes(e.reasonCode))fail();
 }
 #rows(rows:any[]){
  if(rows.length>10000)fail();const ids=new Set<string>();
  rows.forEach((r,i)=>{if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||!recordV1(r.snapshot,['sequence','event','previousRef'])||
   r.ref.contentHash!==hash(r.snapshot)||r.snapshot.sequence!==i+1||!same(r.snapshot.previousRef,i?rows[i-1].ref:null))fail();
   this.#event(r.snapshot.event);if(r.snapshot.event.sequence!==i+1||ids.has(r.snapshot.event.eventId))fail();ids.add(r.snapshot.event.eventId);});
  return rows;
 }
 async record(raw:NormalLocalObservation){
  const v=cloneV1(raw);if(!recordV1(v,['type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode']))fail();
  return this.#store.exclusive('observations',async tx=>{
   const rows=this.#rows(await tx.read());const old=rows.find(r=>r.snapshot.event.type===v.type&&same(r.snapshot.event.localRecordRef,v.localRecordRef));
   if(old){const {sequence,eventId,projectId,executionId,executionGeneration,...saved}=old.snapshot.event;if(!same(saved,v))fail();return cloneV1(old.ref);}
   if(rows.length>=10000)fail();const event={...this.#scope,sequence:rows.length+1,eventId:randomUUID(),...v};this.#event(event);
   const snapshot={sequence:rows.length+1,event,previousRef:rows.at(-1)?.ref??null},entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
   await tx.appendAndSync(entry);const reread=this.#rows(await tx.read());if(!same(reread.at(-1),entry))fail();return cloneV1(entry.ref);
  });
 }
 async batch(afterSequence=0){
  if(!integer(afterSequence))fail();
  return this.#store.exclusive('observations',async tx=>{
   const rows=this.#rows(await tx.read());if(afterSequence>rows.length)fail();const events:any[]=[];
   for(const r of rows.slice(afterSequence,afterSequence+200)){
    const next=[...events,r.snapshot.event];if(Buffer.byteLength(canonicalJson({events:next,batchHash:hash(next)}))>1024*1024)break;events.push(cloneV1(r.snapshot.event));
   }
   return{events,batchHash:hash(events)};
  });
 }
 #ack(raw:any,events:any[]){
  const a=cloneV1(raw),v=a?.snapshot;
  if(!recordV1(a,['ref','snapshot'])||!refV1(a.ref)||!recordV1(v,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])||
   a.ref.contentHash!==hash(v)||!same(v.execution,this.#scope)||!integer(v.highestContiguous)||!integer(v.maxSequence)||!integer(v.storedCount)||
   v.highestContiguous>v.maxSequence||v.maxSequence<1||v.storedCount<1||v.maxSequence>events.length||!hashV1(v.contiguousDigest)||!Array.isArray(v.gaps)||v.gaps.length>10000||
   v.writerReleaseVerified!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false||!isoV1(v.recordedAt)||Date.parse(v.recordedAt)>this.#now())fail();
  let last=0,missing=0;for(const gap of v.gaps){
   if(!recordV1(gap,['from','to'])||!integer(gap.from)||!integer(gap.to)||gap.from<1||gap.from>gap.to||gap.to>=v.maxSequence||
    gap.from<=v.highestContiguous||last&&gap.from<=last+1)fail();last=gap.to;missing+=gap.to-gap.from+1;
  }
  if(v.storedCount!==v.maxSequence-missing||v.highestContiguous<v.maxSequence&&v.gaps[0]?.from!==v.highestContiguous+1||
   v.highestContiguous===v.maxSequence&&v.gaps.length)fail();
  let digest=hash([]);for(const e of events.slice(0,v.highestContiguous))digest=hash({previous:digest,eventHash:hash(e)});
  if(v.contiguousDigest!==digest)fail();return a;
 }
 async #withEvents<T>(body:(events:any[])=>Promise<T>){
  return this.#store.exclusive('observations',async tx=>body(this.#rows(await tx.read()).map(r=>r.snapshot.event)));
 }
 /** server append-only: 이전에 저장됐다고 한 순번은 뒤 ACK에서 빠질 수 없다. */
 #covers(newer:any,older:any){
  if(older.maxSequence>newer.maxSequence)return false;
  const bits=(v:any)=>{const out=new Uint8Array(v.maxSequence+1).fill(1);out[0]=0;
   for(const gap of v.gaps)out.fill(0,gap.from,gap.to+1);return out;};
  const a=bits(newer),b=bits(older);for(let n=1;n<b.length;n++)if(b[n]&&!a[n])return false;return true;
 }
 async acceptAck(raw:unknown){
  return this.#withEvents(events=>this.#store.exclusive('acks',async tx=>{
   const ack=this.#ack(raw,events),prior=(await tx.read()).map(a=>this.#ack(a,events)),latest=prior.at(-1);
   if(latest){
    if(same(latest.ref,ack.ref)){if(!same(latest,ack))fail();return cloneV1(latest);}
    if(ack.snapshot.maxSequence<latest.snapshot.maxSequence||ack.ref.version<latest.ref.version){
     // 최초 packet의 과거 ACK는 검증한 이력 prefix이며 최신 ACK를 덮어쓰지 않는다.
     if(ack.ref.id!==latest.ref.id||!this.#covers(latest.snapshot,ack.snapshot)||ack.snapshot.highestContiguous>latest.snapshot.highestContiguous||ack.snapshot.storedCount>latest.snapshot.storedCount||prior.some(a=>a.ref.version===ack.ref.version&&!same(a,ack)))fail();return cloneV1(latest);
    }
    if(!this.#covers(ack.snapshot,latest.snapshot)||ack.snapshot.highestContiguous<latest.snapshot.highestContiguous||ack.snapshot.storedCount<latest.snapshot.storedCount||
     ack.ref.id!==latest.ref.id||ack.ref.version<=latest.ref.version)fail();
   }
   await tx.appendAndSync(ack);const reread=await tx.read();if(!same(reread.at(-1),ack))fail();return cloneV1(ack);
  }));
 }
 async latestAck(){
  return this.#withEvents(events=>this.#store.exclusive('acks',async tx=>{
   const rows=await tx.read();return rows.length?this.#ack(rows.at(-1),events):null;
  }));
 }
 /** 명시 호출 1회당 POST 1회. 불명은 자동 재송신하지 않고 같은 로컬 events를 보존한다. */
 async sync(client:NormalProtectedPostClient,signal:AbortSignal){
  const latest=await this.latestAck(),body=await this.batch(latest?.snapshot.highestContiguous??0);
  if(!body.events.length)return latest;
  const packet=await client.prepareObservations(body,signal),reply=await client.send(packet,signal) as NormalObservationResult;
  if(reply.executionAuthorized!==false||!reply.ack)fail();return this.acceptAck(reply.ack);
 }
}
