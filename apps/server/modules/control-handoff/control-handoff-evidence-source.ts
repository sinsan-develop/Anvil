import type {PoolClient} from 'pg';
import {AuthFailure} from '../access/repository.ts';
import {isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {checkWriterChain,readWriterHead,writerLimits,writerBytes,type WriterReport} from '../../../../contracts/runtime/project-writer-authority-v1.ts';
import {verifyFn15WriterLedger,verifyWriterObservationSignature} from '../executions/project-writer-authority.ts';
import {copyControlData,controlHash,freezeControl,isControlBasis,sameControl,type ControlBasis} from './control-grant.ts';
const fail=(code='HANDOFF_EVIDENCE_INVALID'):never=>{throw new AuthFailure(code,503);};
export type HandoffClock={now():number;monotonic():number;schedule?:(callback:()=>void,ms:number)=>unknown;cancel?:(handle:unknown)=>void};
export class HandoffBudget{
 readonly signal:AbortSignal;readonly #controller=new AbortController();readonly #clock:HandoffClock;readonly #pending=new Set<Promise<unknown>>();
 readonly #waiters=new Map<(e:unknown)=>void,boolean>();#active=true;#expired:AuthFailure|null=null;#wall:number;#mono:number;#wallEnd:number;#monoEnd:number;#timer:unknown;#timerAt=Infinity;
 constructor(duration=30000,clock:HandoffClock={now:()=>Date.now(),monotonic:()=>performance.now()}){
  if(!Number.isFinite(duration)||duration<=0||duration>30000||!!clock.schedule!==!!clock.cancel)fail();this.#clock=clock;this.#wall=clock.now();this.#mono=clock.monotonic();this.#wallEnd=this.#wall+duration;this.#monoEnd=this.#mono+duration;this.signal=this.#controller.signal;
 }
 #cancelTimer(){if(this.#timer!==undefined){if(this.#clock.cancel)this.#clock.cancel(this.#timer);else clearTimeout(this.#timer as ReturnType<typeof setTimeout>);this.#timer=undefined;this.#timerAt=Infinity;}}
 #expire(){if(!this.#expired)this.#expired=new AuthFailure('HANDOFF_TIME_LIMIT',503);this.#active=false;this.#controller.abort();this.#cancelTimer();for(const reject of [...this.#waiters.keys()])reject(this.#expired);return this.#expired;}
 #sample(requireActive=true){
  if(this.#expired)throw this.#expired;if(requireActive&&!this.#active)throw new AuthFailure('HANDOFF_OPERATION_ENDED',503);
  const wall=this.#clock.now(),mono=this.#clock.monotonic();if(!Number.isFinite(wall)||!Number.isFinite(mono)||mono<this.#mono)throw this.#expire();const effective=Math.max(wall,this.#wall+mono-this.#mono);this.#wall=effective;this.#mono=mono;this.#monoEnd=Math.min(this.#monoEnd,mono+this.#wallEnd-effective);const remaining=Math.min(this.#wallEnd-effective,this.#monoEnd-mono);if(remaining<=0)throw this.#expire();this.#arm(remaining);return remaining;
 }
 #arm(remaining:number){if(!this.#waiters.size||this.#expired||this.#timerAt<=this.#monoEnd)return;this.#cancelTimer();this.#timerAt=this.#monoEnd;const callback=()=>{this.#timer=undefined;this.#timerAt=Infinity;try{this.#sample(false);}catch{this.#expire();}};this.#timer=this.#clock.schedule?this.#clock.schedule(callback,Math.max(1,Math.ceil(remaining))):setTimeout(callback,Math.max(1,Math.ceil(remaining)));}
 check(){this.#sample();}
 remaining(){return this.#sample();}
 at(){this.#sample();return this.#wall;}
 observe(at:string){if(!isoV1(at))fail();this.#sample();this.#wall=Math.max(this.#wall,Date.parse(at));this.#monoEnd=Math.min(this.#monoEnd,this.#mono+this.#wallEnd-this.#wall);const remaining=Math.min(this.#wallEnd-this.#wall,this.#monoEnd-this.#mono);if(remaining<=0)throw this.#expire();this.#arm(remaining);}
 narrow(expiresAt:string){if(!isoV1(expiresAt))fail();this.#wallEnd=Math.min(this.#wallEnd,Date.parse(expiresAt));this.#sample();}
 /** 외부 응답과 원 IO 소유를 구분한다. external은 cleanup 완료를 기다리는 promise를 추적집합에 넣지 않는다. */
 boundary<T>(task:Promise<T>,external=false):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
   const finish=()=>{this.#waiters.delete(rejectBound);if(!this.#waiters.size)this.#cancelTimer();};const rejectBound=(error:unknown)=>{finish();reject(error);};this.#waiters.set(rejectBound,external);
   task.then(value=>{try{if(!external)this.#sample();finish();resolve(value);}catch(error){rejectBound(error);}},rejectBound);
   try{this.#sample(!external);}catch(error){rejectBound(error);}
  });
 }
 own<T>(work:()=>Promise<T>):Promise<T>{
  this.check();const task=Promise.resolve().then(()=>{this.check();return work();});this.#pending.add(task);task.then(()=>this.#pending.delete(task),()=>this.#pending.delete(task));return this.boundary(task);
 }
 async close(){this.#active=false;this.#controller.abort();for(const [reject,external]of [...this.#waiters])if(!external)reject(this.#expired??new AuthFailure('HANDOFF_OPERATION_ENDED',503));await Promise.allSettled([...this.#pending]);if(!this.#waiters.size)this.#cancelTimer();}
}
export const handoffCategories=['activeExecutions','pendingCommands','pendingApprovals','sourceCheckpointRefs']as const;
export type HandoffCategory=typeof handoffCategories[number];
export type HandoffEvidenceScope={projectId:string;requestRef:RuntimeRefV1;baseControl:ControlBasis;sessionId:string;actorId:string;clientId:string};
export type HandoffItem={kind:string;ref:RuntimeRefV1;observedAt:string;expiresAt:string;provenance:'SERVER_LEDGER'|'REGISTERED_CURRENT_PROOF'|'HISTORICAL_CLAIM';handoffDisposition:'CONTINUE_CONFIRMED'|'PRESERVE_BLOCKED_INPUT'|'BLOCKED'|'UNKNOWN';reasonCode:string};
export type HandoffCollection={state:'VERIFIED_CURRENT'|'WAITING'|'UNKNOWN';scope:{projectId:string;requestRef:RuntimeRefV1;baseControl:ControlBasis};observedAt:string;expiresAt:string;coverage:{profile:'FN15_KNOWN_SOURCE_SET_V1';sources:string[];scopeHash:string;watermarkHash:string};items:HandoffItem[];gaps:string[]};
export type HandoffEvidence={collections:Record<HandoffCategory,HandoffCollection>;transferState:'READY'|'WAITING'|'UNKNOWN';gaps:string[];validUntil:string};
export interface HandoffCurrentProvider{read(db:Pick<PoolClient,'query'>,scope:Readonly<HandoffEvidenceScope>,signal:AbortSignal):Promise<{report:WriterReport;signature:string;proofRef:RuntimeRefV1}>}
const issued=new WeakMap<object,{db:object;scope:string;lease:HandoffBudget}>();
export function assertHandoffEvidence(value:HandoffEvidence,db:object,scope:HandoffEvidenceScope,lease:HandoffBudget){lease.check();const p=issued.get(value);if(!p||p.db!==db||p.scope!==controlHash(scope)||p.lease!==lease)fail();}
/** 명시 서버 내부 보호 포트만 소비하고 caller JSON/true를 받지 않는다. */
export function createControlHandoffEvidenceSource(options:{current?:HandoffCurrentProvider}={}){
 const provider=options.current,method=provider?.read;
 return Object.freeze({async collect(db:Pick<PoolClient,'query'>,scope:HandoffEvidenceScope,lease:HandoffBudget):Promise<HandoffEvidence>{
  const fixed=freezeControl(copyControlData(scope));if(!isControlBasis(fixed.baseControl)||!refV1(fixed.requestRef))fail();
  const raw=await lease.own(()=>db.query('SELECT anvil.fn15_handoff_facts($1,$2,$3,$4,$5::jsonb) AS packet',[fixed.sessionId,fixed.actorId,fixed.clientId,fixed.projectId,JSON.stringify(fixed.requestRef)]));
  if(raw.rows.length!==1)fail();const packet=copyControlData(raw.rows[0].packet,writerLimits.journalBytes+8*1024*1024);
  if(!recordV1(packet,['projectId','requestRef','baseControl','writer','executions','pendingCommands','pendingApprovals','checkpoints','proofBasis'])||packet.projectId!==fixed.projectId||!sameControl(packet.requestRef,fixed.requestRef)||!sameControl(packet.baseControl,fixed.baseControl)||!recordV1(packet.writer,['head','events','commands','receipts','audits','approvals']))fail();
  const {events,head}=await verifyFn15WriterLedger(packet.writer,fixed.projectId,async id=>{const r=await lease.own(()=>db.query('SELECT anvil.fn15_handoff_writer_command($1,$2,$3,$4,$5::jsonb,$6) AS packet',[fixed.sessionId,fixed.actorId,fixed.clientId,fixed.projectId,JSON.stringify(fixed.requestRef),id]));if(r.rows.length!==1)fail();return r.rows[0].packet;});
  const gaps:string[]=[];let current=false,until=lease.at()+30000;
  // 과거 chain 검산과 현재 보호 관측은 분리한다. 실제 core 조립 전에는 성공을 만들지 않는다.
  if(!provider||typeof method!=='function')gaps.push('CURRENT_PROVIDER_NOT_CONNECTED');
  else if(packet.proofBasis===null)gaps.push('CURRENT_PROOF_BASIS_UNAVAILABLE');
  else{
   const b=packet.proofBasis;if(!recordV1(b,['publicKeySpki','hostFingerprint','report']))fail();
   const observed=copyControlData(await lease.own(()=>method.call(provider,db,fixed,lease.signal)));lease.check();if(provider.read!==method||!refV1(observed.proofRef))fail();
   verifyWriterObservationSignature(b.publicKeySpki,observed.signature,observed.report,b.report,b.hostFingerprint,lease.at());
   if(observed.report.projectId!==fixed.projectId||!sameControl(observed.report.expectedHeadRef,head?.ref??null))fail();
   until=Math.min(until,Date.parse(observed.report.expiresAt));lease.narrow(new Date(until).toISOString());current=true;
  }
  const now=new Date(lease.at()).toISOString(),expiresAt=new Date(until).toISOString(),collections={}as Record<HandoffCategory,HandoffCollection>;
  const names={activeExecutions:'executions',pendingCommands:'pendingCommands',pendingApprovals:'pendingApprovals',sourceCheckpointRefs:'checkpoints'}as const;
  for(const category of handoffCategories){const rows=packet[names[category]];if(!Array.isArray(rows)||rows.length>10000)fail();const local:string[]=[];if(rows.length>200)local.push('SUMMARY_REFERENCE_LIMIT');
   const items:HandoffItem[]=[];for(const row of rows){if(!recordV1(row,['ref','snapshot','recordedAt','expiresAt','provenance'])||!refV1(row.ref)||row.ref.contentHash!==controlHash(row.snapshot)||!isoV1(row.recordedAt)||!isoV1(row.expiresAt)||!['SERVER_LEDGER','REGISTERED_CURRENT_PROOF','HISTORICAL_CLAIM'].includes(row.provenance))fail();
    if(items.length<200)items.push({kind:category,ref:row.ref,observedAt:row.recordedAt,expiresAt:row.expiresAt,provenance:row.provenance,handoffDisposition:category==='activeExecutions'?'UNKNOWN':current?'PRESERVE_BLOCKED_INPUT':'UNKNOWN',reasonCode:category==='activeExecutions'?'CONTINUATION_NOT_VERIFIED':current?'ORIGINAL_INPUT_PRESERVED':'CURRENT_PROOF_UNAVAILABLE'});
   }
   if(!current)local.push('CURRENT_PROOF_UNAVAILABLE');if(category==='activeExecutions'&&rows.length)local.push('CONTINUATION_NOT_VERIFIED');
   collections[category]={state:local.length?'UNKNOWN':'VERIFIED_CURRENT',scope:{projectId:fixed.projectId,requestRef:fixed.requestRef,baseControl:fixed.baseControl},observedAt:now,expiresAt,coverage:{profile:'FN15_KNOWN_SOURCE_SET_V1',sources:[names[category]],scopeHash:controlHash({projectId:fixed.projectId,requestRef:fixed.requestRef,baseControl:fixed.baseControl}),watermarkHash:controlHash(rows.map((r:Record<string,unknown>)=>r.ref))},items,gaps:local};gaps.push(...local.map(x=>category+':'+x));
  }
  const result=freezeControl({collections,transferState:gaps.length?'UNKNOWN' as const:'READY' as const,gaps:[...new Set(gaps)],validUntil:expiresAt});issued.set(result,{db,scope:controlHash(fixed),lease});lease.check();return result;
 }});
}
export type ControlHandoffEvidenceSource=ReturnType<typeof createControlHandoffEvidenceSource>;
