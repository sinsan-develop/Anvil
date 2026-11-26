import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,recordV1,refV1,isoV1,arrayV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {requestNormalLiveStop} from './normal-first-send-owner.ts';
import type {NormalStartWire} from './normal-start-coordinator.ts';
import {NormalStartIntake} from './normal-start-intake.ts';
import {captureInstructionInput} from './normal-instruction-intake.ts';
import {readNormalStopItem,type NormalStopOriginal} from './normal-start-material-consumer.ts';
import {NormalObservationSpool,type NormalLocalObservation} from './normal-observation-spool.ts';
import type {NormalJournalTransaction} from './normal-start-file-store.ts';
export interface NormalStopStore{transport:'NORMAL_PROTECTED';exclusive<T>(key:ReceiptKeyV1,body:(tx:NormalJournalTransaction)=>Promise<T>):Promise<T>}
export interface NormalStopHistoryPorts{intake:NormalStartIntake;store:NormalStopStore;original:NormalStopOriginal;clock:()=>number;timeoutMs:number}
const originalStatus=NormalStartIntake.prototype.readStatus,originalRecord=NormalObservationSpool.prototype.record;
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='NORMAL_STOP_HISTORY_INVALID'):never=>{throw Error(code);};
type StopHistoryRow={ref:Ref;snapshot:{state:'STOP_ATTEMPTED'|'STOP_UNCONFIRMED';recordedAt:string;requestedAt?:string}};
/** 원 START/STOP 이력과 선택된 live owner를 소비한다. CURRENT나 원 Query를 발급하지 않는다. */
export class NormalStopCoordinator{
 #p:NormalStopHistoryPorts;#exclusive:NormalStopStore['exclusive'];#last=-Infinity;#busy=false;#unknown=false;
 constructor(p:NormalStopHistoryPorts){
  if(!p||isProxy(p)||!recordV1(p,['intake','store','original','clock','timeoutMs'])||isProxy(p.intake)||Object.getPrototypeOf(p.intake)!==NormalStartIntake.prototype||
   !p.store||isProxy(p.store)||!recordV1(p.store,['transport','exclusive'])||p.store.transport!=='NORMAL_PROTECTED'||typeof p.store.exclusive!=='function'||typeof p.clock!=='function'||!Number.isSafeInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>10000)fail();
  this.#p={...p,original:captureInstructionInput(p.original)};this.#exclusive=p.store.exclusive;this.#ports();
 }
 #ports(){if(this.#p.intake.readStatus!==originalStatus||NormalStartIntake.prototype.readStatus!==originalStatus||this.#p.store.exclusive!==this.#exclusive||this.#p.store.transport!=='NORMAL_PROTECTED')fail('NORMAL_STOP_PORT_CHANGED');}
 #now(){const n=this.#p.clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)fail('NORMAL_STOP_CLOCK_INVALID');this.#last=n;return n;}
 async #bounded<T>(signal:AbortSignal,work:(check:()=>void,bounded:AbortSignal)=>Promise<T>):Promise<T>{
  const controller=new AbortController(),wall=this.#now(),mono=performance.now();let timer:ReturnType<typeof setTimeout>|undefined,listener=()=>{};let stopped=false;
  const check=()=>{this.#ports();if(stopped||signal.aborted||this.#now()-wall>=this.#p.timeoutMs||performance.now()-mono>=this.#p.timeoutMs)fail('NORMAL_STOP_INTERRUPTED');};
  const stop=new Promise<never>((_,reject)=>{listener=()=>{stopped=true;controller.abort();reject(Error('NORMAL_STOP_INTERRUPTED'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,this.#p.timeoutMs);});
  try{check();const out=await Promise.race([Promise.resolve().then(()=>{check();return work(check,controller.signal);}),stop]);check();return out;}
  finally{stopped=true;controller.abort();clearTimeout(timer);signal.removeEventListener('abort',listener);}
 }
 #rows(raw:unknown,item:ReturnType<typeof readNormalStopItem>){
  const captured=captureInstructionInput(raw);if(!arrayV1(captured,2)||Buffer.byteLength(canonicalJson(captured))>2097152)fail();const rows=captured as any[];let at=Date.parse(item.envelope.issuedAt);const expires=Date.parse(item.envelope.expiresAt),ids=new Set<string>();
  for(const [i,r] of rows.entries()){const s=r?.snapshot;
   const hasRequest=Object.hasOwn(s??{},'requestedAt');
   if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||ids.has(r.ref.id)||r.ref.contentHash!==hash(s)||
    !recordV1(s,['sequence','state','key','commandRef','envelopeHash','stopScopeRef','target','previousRef','recordedAt',...(hasRequest?['requestedAt']:[])])||s.sequence!==i+1||s.state!==(i===0?'STOP_ATTEMPTED':'STOP_UNCONFIRMED')||
    !same(s.key,receiptKeyV1(item.envelope))||!same(s.commandRef,item.commandRef)||s.envelopeHash!==item.envelope.envelopeHash||!same(s.stopScopeRef,item.envelope.payload.stopScopeRef)||!same(s.target,item.stopTarget)||
    !same(s.previousRef,rows[i-1]?.ref??null)||!isoV1(s.recordedAt))fail();
   const recorded=Date.parse(s.recordedAt);
   if(recorded<at||recorded>this.#now()||(i===0||hasRequest)&&recorded>=expires)fail();
   if(hasRequest&&(i!==1||!isoV1(s.requestedAt)||Date.parse(s.requestedAt)<at||Date.parse(s.requestedAt)>recorded))fail();
   at=recorded;ids.add(r.ref.id);
  }return rows as StopHistoryRow[];
 }
 async #readRows(item:ReturnType<typeof readNormalStopItem>,check:()=>void){
  const key=receiptKeyV1(item.envelope);
  let rows:StopHistoryRow[]|undefined,entered=false,closed=false;
  try{
   await this.#exclusive.call(this.#p.store,key,async tx=>{
    check();if(entered||closed)return fail();
    const requireClose=tx.requireStartReadyClose;
    if(typeof requireClose!=='function')return fail();
    entered=true;requireClose.call(tx,key);
    const raw=await tx.read();check();if(closed)fail();
    rows=this.#rows(raw,item);
   });
  }finally{closed=true;}
  check();return rows??fail();
 }
 observations(raw:unknown,signal:AbortSignal){return this.#history(raw,signal);}
 async #history(raw:unknown,signal:AbortSignal,worker?:NormalStartWire){
  if(this.#busy)fail('NORMAL_STOP_BUSY');if(this.#unknown)fail('NORMAL_STOP_UNKNOWN');if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_STOP_CANCELLED');
  const input=captureInstructionInput(raw),item=readNormalStopItem(input,this.#p.original,Date.parse((input as any)?.envelope?.issuedAt));if(Date.parse(item.envelope.issuedAt)>this.#now())fail();
  this.#busy=true;
  try{
   const value=await this.#bounded(signal,async(check,bounded)=>{
    const start=await originalStatus.call(this.#p.intake,this.#p.original.startEnvelope);check();if(start.state!=='RECEIVED')fail('NORMAL_STOP_START_NOT_RECEIVED');
    let rows=await this.#readRows(item,check);check();
    if(!rows.length){
     if(!worker)return {state:'OWNER_UNAVAILABLE',inputs:[] as NormalLocalObservation[]};
     const written=await requestNormalLiveStop(worker,item,this.#p.original,this.#p.store,bounded,check);check();
     rows=this.#rows(written,item);
     if(rows.length!==2||rows[1]?.snapshot.requestedAt===undefined)fail();
    }
    // ATTEMPTED만으로 실제 협력 요청의 호출/수락을 증명하지 않는다. 불명 원 행을 그대로 관측한다.
    const inputs:NormalLocalObservation[]=rows.map(r=>({type:'STOP_UNCONFIRMED',commandId:item.envelope.commandId,envelopeHash:item.envelope.envelopeHash,localRecordRef:cloneV1(r.ref),processRef:null,occurredAt:r.snapshot.recordedAt,reasonCode:r.snapshot.state==='STOP_ATTEMPTED'?'RECORD_UNCERTAIN':'STOP_UNCONFIRMED'}));
    const requestedAt=rows[1]?.snapshot.requestedAt;
    if(requestedAt!==undefined)inputs.splice(1,0,{type:'STOP_REQUESTED',commandId:item.envelope.commandId,envelopeHash:item.envelope.envelopeHash,localRecordRef:cloneV1(rows[0]!.ref),processRef:null,occurredAt:requestedAt,reasonCode:'NONE'});
    return{state:rows.length===2?'STOP_UNCONFIRMED':'UNKNOWN',inputs};
   });
   if(value.state==='OWNER_UNAVAILABLE')fail('NORMAL_STOP_OWNER_UNAVAILABLE');return value;
  }catch(e){this.#unknown=true;throw e;}finally{this.#busy=false;}
 }
 async recordObservations(raw:unknown,spool:NormalObservationSpool,signal:AbortSignal,worker?:NormalStartWire){
  const check=()=>{this.#ports();if(signal.aborted||isProxy(spool)||Object.getPrototypeOf(spool)!==NormalObservationSpool.prototype||spool.record!==originalRecord||NormalObservationSpool.prototype.record!==originalRecord)fail('NORMAL_STOP_OBSERVATION_PORT_INVALID');};
  check();const source=await this.#history(raw,signal,worker),recordedRefs:Ref[]=[];
  try{await this.#bounded(signal,async current=>{for(const input of source.inputs){check();current();const ref=await originalRecord.call(spool,input);check();current();recordedRefs.push(cloneV1(ref));}});}
  catch(e){this.#unknown=true;throw e;}
  return{state:source.state,recordedRefs,executionAuthorized:false as const,dispatchPerformed:false as const,actualExecutionVerified:false as const,writerReleaseVerified:false as const};
 }
}
