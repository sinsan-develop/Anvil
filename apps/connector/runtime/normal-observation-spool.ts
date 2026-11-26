import {randomUUID} from 'node:crypto';
import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {arrayV1,cloneV1,recordV1,refV1,hashV1,isoV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import type {NormalJournalStore,NormalLocalScope} from './normal-start-file-store.ts';
import type {NormalProtectedPostClient,NormalObservationResult} from './normal-protected-post-client.ts';
export interface NormalLocalObservation{type:string;commandId:string;envelopeHash:string;localRecordRef:Ref;processRef:Ref|null;occurredAt:string;reasonCode:string}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const types=['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'];
const reasons=['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'];
const fail=():never=>{throw Error('NORMAL_OBSERVATION_INVALID');};
const integer=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000;
type AckSnapshot={execution:NormalLocalScope;highestContiguous:number;maxSequence:number;contiguousDigest:string;gaps:{from:number;to:number}[];storedCount:number;
 writerReleaseVerified:false;executionAuthorized:false;dispatchPerformed:false;recordedAt:string};
type Ack={ref:Ref;snapshot:AckSnapshot};
export class NormalObservationSpool{
 readonly executionAuthorized=false;readonly dispatchPerformed=false;
 #store:NormalJournalStore;#scope:NormalLocalScope;#clock:()=>number;
 constructor(store:NormalJournalStore,scope:NormalLocalScope,clock:()=>number){
  if(store?.transport!=='NORMAL_PROTECTED'||typeof store.exclusive!=='function'||typeof clock!=='function'||
   !recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||
   !Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1)fail();
  this.#store=store;this.#scope=cloneV1(scope);this.#clock=clock;
 }
 /** 원 명령의 실행 범위만 대조한다. 원장 읽기·관측 저장·실행 효과가 없다. */
 matchesExecutionScope(scope:NormalLocalScope){
  return recordV1(scope,['projectId','executionId','executionGeneration'])&&scope.projectId===this.#scope.projectId
   &&scope.executionId===this.#scope.executionId&&scope.executionGeneration===this.#scope.executionGeneration;
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
 #ack(raw:unknown,eventCount:number,prefix:(highest:number)=>string){
  const a=cloneV1(raw) as Ack,v=a?.snapshot;
  if(!recordV1(a,['ref','snapshot'])||!refV1(a.ref)||!recordV1(v,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])||
   a.ref.contentHash!==hash(v)||!same(v.execution,this.#scope)||!integer(v.highestContiguous)||!integer(v.maxSequence)||!integer(v.storedCount)||
   v.highestContiguous>v.maxSequence||v.maxSequence<1||v.storedCount<1||v.maxSequence>eventCount||!hashV1(v.contiguousDigest)||!Array.isArray(v.gaps)||v.gaps.length>10000||
   v.writerReleaseVerified!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false||!isoV1(v.recordedAt)||Date.parse(v.recordedAt)>this.#now())fail();
  let last=0,missing=0;for(const gap of v.gaps){
   if(!recordV1(gap,['from','to'])||!integer(gap.from)||!integer(gap.to)||gap.from<1||gap.from>gap.to||gap.to>=v.maxSequence||
    gap.from<=v.highestContiguous||last&&gap.from<=last+1)fail();last=gap.to;missing+=gap.to-gap.from+1;
  }
  if(v.storedCount!==v.maxSequence-missing||v.highestContiguous<v.maxSequence&&v.gaps[0]?.from!==v.highestContiguous+1||
   v.highestContiguous===v.maxSequence&&v.gaps.length)fail();
  if(v.contiguousDigest!==prefix(v.highestContiguous))fail();return a;
 }
 #ackReader(events:any[]){
  const digests=[hash([])];
  const prefix=(highest:number)=>{
   for(let i=digests.length;i<=highest;i++)digests.push(hash({previous:digests[i-1],eventHash:hash(events[i-1])}));
   return digests[highest]!;
  };
  return (raw:unknown)=>this.#ack(raw,events.length,prefix);
 }
 async #withEvents<T>(body:(events:any[])=>Promise<T>){
  return this.#store.exclusive('observations',async tx=>body(this.#rows(await tx.read()).map(r=>r.snapshot.event)));
 }
 /** server append-only: 이전에 저장됐다고 한 순번은 뒤 ACK에서 빠질 수 없다. */
 #covers(newer:AckSnapshot,older:AckSnapshot){
  if(newer.maxSequence<older.maxSequence||newer.highestContiguous<older.highestContiguous||newer.storedCount<older.storedCount)return false;
  // 이전 범위 안에서 새로 빠진 구간이 있다면 당시에도 같은 구간이 비어 있어야 한다.
  let i=0;
  for(const gap of newer.gaps){
   if(gap.from>older.maxSequence)break;
   while(older.gaps[i]&&older.gaps[i]!.to<gap.from)i++;
   const previous=older.gaps[i];
   if(!previous||previous.from>gap.from||previous.to<gap.to)return false;
  }
  return true;
 }
 #ackHistory(rows:unknown,read:(raw:unknown)=>Ack){
  if(isProxy(rows)||!arrayV1(rows,10000))return fail();
  const history:Ack[]=[];
  for(const row of rows){
   const ack=read(row),previous=history.at(-1);
   if(previous&&(ack.ref.id!==previous.ref.id||ack.ref.version<=previous.ref.version||!this.#covers(ack.snapshot,previous.snapshot)))fail();
   history.push(ack);
  }
  return history;
 }
 async acceptAck(raw:unknown){
  return this.#withEvents(events=>this.#store.exclusive('acks',async tx=>{
   const read=this.#ackReader(events),prior=this.#ackHistory(await tx.read(),read),latest=prior.at(-1),ack=read(raw);
   if(latest){
    if(ack.ref.id!==latest.ref.id)fail();
    const retained=prior.find(a=>a.ref.version===ack.ref.version);
    if(retained){if(!same(retained,ack))fail();return cloneV1(latest);}
    if(ack.ref.version<latest.ref.version){
     // 저장본 사이에 늦게 도착한 ACK도 양쪽 범위 안에 있을 때 최신을 그대로 반환한다.
     const nextIndex=prior.findIndex(a=>a.ref.version>ack.ref.version),next=prior[nextIndex]!,previous=prior[nextIndex-1];
     if(!this.#covers(next.snapshot,ack.snapshot)||previous&&!this.#covers(ack.snapshot,previous.snapshot))fail();
     return cloneV1(latest);
    }
    if(!this.#covers(ack.snapshot,latest.snapshot))fail();
   }
   if(prior.length===10000)fail();
   await tx.appendAndSync(ack);
   const reread=await tx.read();
   if(isProxy(reread)||!arrayV1(reread,10000)||reread.length!==prior.length+1||
    prior.some((saved,i)=>!same(reread[i],saved))||!same(reread.at(-1),ack))fail();
   return cloneV1(ack);
  }));
 }
 async latestAck(){
  return this.#withEvents(events=>this.#store.exclusive('acks',async tx=>{
   return this.#ackHistory(await tx.read(),this.#ackReader(events)).at(-1)??null;
  }));
 }
 /** 현재 원장 끝을 고정하거나 이미 고정한 원 관측 ref까지의 연속 ACK를 확인한다. 전송/권한 발급은 없다. */
 async coverage(required?:Ref){
  if(required!==undefined&&(isProxy(required)||!refV1(required)))fail();
  const ref=required===undefined?undefined:cloneV1(required);
  return this.#store.exclusive('observations',async tx=>{
   const rows=this.#rows(await tx.read()),events=rows.map(r=>r.snapshot.event),target=ref===undefined?rows.at(-1):rows.find(r=>same(r.ref,ref));
   if(ref!==undefined&&!target)fail();
   const latest=await this.#store.exclusive('acks',async a=>this.#ackHistory(await a.read(),this.#ackReader(events)).at(-1)??null);
   const sequence=target?.snapshot.sequence??0,highestContiguous=latest?.snapshot.highestContiguous??0;
   return{ref:target?cloneV1(target.ref):null,sequence,highestContiguous,covered:highestContiguous>=sequence,executionAuthorized:false as const,dispatchPerformed:false as const};
  });
 }
 /** 명시 호출 1회당 POST 1회. 불명은 자동 재송신하지 않고 같은 로컬 events를 보존한다. */
 async sync(client:NormalProtectedPostClient,signal:AbortSignal){
  const latest=await this.latestAck(),body=await this.batch(latest?.snapshot.highestContiguous??0);
  if(!body.events.length)return latest;
  const packet=await client.prepareObservations(body,signal),reply=await client.send(packet,signal) as NormalObservationResult;
  if(reply.executionAuthorized!==false||!reply.ack)fail();return this.acceptAck(reply.ack);
 }
}
