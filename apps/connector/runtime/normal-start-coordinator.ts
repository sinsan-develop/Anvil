import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,recordV1,refV1,isoV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {NormalStartIntake} from './normal-start-intake.ts';
import {NormalProtectedPostClient,type NormalPermitResult} from './normal-protected-post-client.ts';
import {NormalObservationSpool} from './normal-observation-spool.ts';
import type {NormalJournalStore,NormalJournalTransaction} from './normal-start-file-store.ts';
type Materials=Awaited<ReturnType<NormalStartIntake['startMaterials']>>;
type Options=Materials['options'];
export interface NormalStartCurrent{transport:'NORMAL_PROTECTED';current(envelope:DispatchEnvelopeV1,localAttemptRef:Ref,signal:AbortSignal):Promise<unknown>}
export interface NormalStartWire{transport:'NORMAL_PROTECTED';send(value:{envelope:DispatchEnvelopeV1;contextBundle:Materials['contextBundle'];options:Options;localAttemptRef:Ref;permit:NormalPermitResult['permit']},signal:AbortSignal):Promise<unknown>}
export interface NormalStartPorts{intake:NormalStartIntake;store:NormalJournalStore;post:NormalProtectedPostClient;current:NormalStartCurrent;wire:NormalStartWire;
 spool:NormalObservationSpool;grantRef:Ref;clock:()=>number;timeoutMs:number}
type State='START_ATTEMPTED'|'PERMIT_RECORDED'|'RESPONSE_RECORDED'|'UNKNOWN';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code:string):never=>{throw Error(code);};
/** 정상 source 연결기. 원문 옵션을 변환하거나 SYNTHETIC/CODEX 표식을 정상 실행 권위로 승격하지 않는다.
 * 명시 wire 공급자의 응답도 관측 주장일 뿐 실제 Agent 성공·writer 해제를 뜻하지 않는다. */
export class NormalStartCoordinator{
 #p:NormalStartPorts;
 constructor(p:NormalStartPorts){
  if(!(p?.intake instanceof NormalStartIntake)||!(p?.post instanceof NormalProtectedPostClient)||!(p?.spool instanceof NormalObservationSpool)||
   p.store?.transport!=='NORMAL_PROTECTED'||typeof p.store.exclusive!=='function'||p.current?.transport!=='NORMAL_PROTECTED'||
   typeof p.current.current!=='function'||p.wire?.transport!=='NORMAL_PROTECTED'||typeof p.wire.send!=='function'||!refV1(p.grantRef)||
   typeof p.clock!=='function'||!Number.isSafeInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>10000)fail('NORMAL_START_PORTS_REQUIRED');
  this.#p={...p,grantRef:cloneV1(p.grantRef)};
 }
 #now(){const n=this.#p.clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail('NORMAL_START_CLOCK_INVALID');return n;}
 async #bounded<T>(fn:(s:AbortSignal)=>Promise<T>,signal:AbortSignal,deadline:number):Promise<T>{
  const ms=Math.min(this.#p.timeoutMs,deadline-this.#now());if(signal.aborted||ms<=0)fail('NORMAL_START_EXPIRED');
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener=()=>{};
  const stop=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('NORMAL_START_UNAVAILABLE'));};
   signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,ms);});
  try{const pending=Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error();return fn(controller.signal);});
   const out=await Promise.race([pending,stop]);if(signal.aborted||controller.signal.aborted||this.#now()>=deadline)fail('NORMAL_START_EXPIRED');return out;
  }finally{if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',listener);controller.abort();}
 }
 async #current(e:DispatchEnvelopeV1,attempt:Ref,signal:AbortSignal,ceiling:number){
  const v:any=cloneV1(await this.#bounded(s=>this.#p.current.current(cloneV1(e),cloneV1(attempt),s),signal,ceiling)),now=this.#now();
  const refs=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()];
  if(!recordV1(v,['transport','key','envelopeHash','grantRef','localAttemptRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||
   v.transport!=='NORMAL_PROTECTED'||!same(v.key,receiptKeyV1(e))||v.envelopeHash!==e.envelopeHash||!same(v.grantRef,this.#p.grantRef)||!same(v.localAttemptRef,attempt)||
   !Array.isArray(v.sourceObservationRefs)||v.sourceObservationRefs.length<1||v.sourceObservationRefs.length>200||!v.sourceObservationRefs.every(refV1)||
   !same(v.sourceObservationRefs,refs)||!refV1(v.osOwnershipRef)||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>now||
   now-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)>Date.parse(v.checkedAt)+30000)fail('NORMAL_START_CURRENT_INVALID');
  const {checkedAt,expiresAt,...binding}=v;return{binding,deadline:Math.min(ceiling,Date.parse(expiresAt))};
 }
 #rows(raw:any[],e:DispatchEnvelopeV1){
  if(raw.length>3)fail('NORMAL_START_RECORD_INVALID');
  raw.forEach((r,i)=>{
   if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||r.ref.contentHash!==hash(r.snapshot)||
    !recordV1(r.snapshot,['sequence','state','key','envelopeHash','grantRef','receivedRef','previousRef','permit','responseRef','processRef','recordedAt'])||
    r.snapshot.sequence!==i+1||!same(r.snapshot.key,receiptKeyV1(e))||r.snapshot.envelopeHash!==e.envelopeHash||
    !same(r.snapshot.grantRef,this.#p.grantRef)||!refV1(r.snapshot.receivedRef)||!same(r.snapshot.previousRef,i?raw[i-1].ref:null)||
    !isoV1(r.snapshot.recordedAt)||Date.parse(r.snapshot.recordedAt)>this.#now()||!['START_ATTEMPTED','PERMIT_RECORDED','RESPONSE_RECORDED','UNKNOWN'].includes(r.snapshot.state))fail('NORMAL_START_RECORD_INVALID');
   const v=r.snapshot;
   if(i===0&&v.state!=='START_ATTEMPTED'||i===1&&!['PERMIT_RECORDED','UNKNOWN'].includes(v.state)||i===2&&!['RESPONSE_RECORDED','UNKNOWN'].includes(v.state))fail('NORMAL_START_RECORD_INVALID');
   if(i&&(!same(v.receivedRef,raw[0].snapshot.receivedRef)||raw[i-1].snapshot.state==='UNKNOWN'))fail('NORMAL_START_RECORD_INVALID');
   if(v.state==='START_ATTEMPTED'&&(v.permit!==null||v.responseRef!==null||v.processRef!==null))fail('NORMAL_START_RECORD_INVALID');
   if(v.permit!==null&&(!recordV1(v.permit,['ref','commandId','envelopeHash','issuedAt','expiresAt'])||!refV1(v.permit.ref)||
    v.permit.commandId!==e.commandId||v.permit.envelopeHash!==e.envelopeHash||!isoV1(v.permit.issuedAt)||!isoV1(v.permit.expiresAt)||
    Date.parse(v.permit.expiresAt)<=Date.parse(v.permit.issuedAt)||Date.parse(v.permit.expiresAt)>Date.parse(v.permit.issuedAt)+30000))fail('NORMAL_START_RECORD_INVALID');
   if(v.state==='PERMIT_RECORDED'&&(v.permit===null||v.responseRef!==null||v.processRef!==null)||
    v.state==='RESPONSE_RECORDED'&&(!refV1(v.responseRef)||v.permit===null)||v.processRef!==null&&!refV1(v.processRef))fail('NORMAL_START_RECORD_INVALID');
   if(i===2&&!same(v.permit,raw[1].snapshot.permit))fail('NORMAL_START_RECORD_INVALID');
  });return raw;
 }
 #result(e:DispatchEnvelopeV1,r:any,state?:State){return{transport:'NORMAL_PROTECTED' as const,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,
  state:state??r.snapshot.state,recordRef:cloneV1(r.ref),executionAuthorized:false as const,agentSuccessVerified:false as const};}
 async start(raw:unknown,signal:AbortSignal){
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_START_CANCELLED');
  const e=readDispatchEnvelopeV1(cloneV1(raw),Date.parse((raw as any)?.issuedAt));
  if(e.operation!=='START_SESSION'||Date.parse(e.issuedAt)>this.#now())fail('NORMAL_START_ENVELOPE_INVALID');
  const p=this.#p;
  return p.store.exclusive('attempt-'+e.commandId,async tx=>{
   let rows=this.#rows(await tx.read(),e);
   // 새 실행 전에는 readStatus가 아니라 자료 bytes·원문·descriptor 전체를 재검산한다.
   const materials=rows.length?null:await p.intake.startMaterials(e),options=materials?.options,received=rows[0]?.snapshot.receivedRef??options!.receivedRef;
   const observe=async(type:string,ref:Ref,at:string,processRef:Ref|null=null,reasonCode='NONE')=>p.spool.record({type,commandId:e.commandId,envelopeHash:e.envelopeHash,
    localRecordRef:cloneV1(ref),processRef,occurredAt:at,reasonCode});
   // 원 durable record의 시각/ref로 복구하므로 다른 occurrence나 새 wire를 만들지 않는다.
   const reconcile=async()=>{
    if(!rows.length)return;
    await observe('RECEIVED',received,rows[0].snapshot.recordedAt);await observe('PREPARED',received,rows[0].snapshot.recordedAt);
    for(const r of rows){const v=r.snapshot;await observe(v.state==='RESPONSE_RECORDED'?'PROVIDER_RESPONSE_RECEIVED':v.state,r.ref,v.recordedAt,v.processRef,
     v.state==='RESPONSE_RECORDED'?'UNVERIFIED_PROVIDER_CLAIM':v.state==='UNKNOWN'?'RECORD_UNCERTAIN':'NONE');}
   };
   const append=async(state:State,permit:NormalPermitResult['permit']|null,responseRef:Ref|null=null,processRef:Ref|null=null)=>{
    const snapshot={sequence:rows.length+1,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,grantRef:cloneV1(p.grantRef),receivedRef:cloneV1(received),
     previousRef:rows.at(-1)?.ref??null,permit:permit===null?null:cloneV1(permit),responseRef,processRef,recordedAt:new Date(this.#now()).toISOString()};
    const entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(entry);
    const reread=this.#rows(await tx.read(),e);if(reread.length!==rows.length+1||!same(reread.at(-1),entry))fail('NORMAL_START_SYNC_UNCERTAIN');rows=reread;return entry;
   };
   if(rows.length){
    try{
     if(!['RESPONSE_RECORDED','UNKNOWN'].includes(rows.at(-1).snapshot.state))await append('UNKNOWN',rows.at(-1).snapshot.permit);
     await reconcile();return this.#result(e,rows.at(-1));
    }catch{return this.#result(e,rows.at(-1),'UNKNOWN');}
   }
   let permit:NormalPermitResult['permit']|null=null,attempt:any;
   try{
    attempt=await append('START_ATTEMPTED',null);await reconcile();
    const first=await this.#current(e,attempt.ref,signal,Date.parse(e.expiresAt));
    const packet=await p.post.preparePermit(e.commandId,{envelopeHash:e.envelopeHash,localAttemptRef:attempt.ref,
     sourceObservationRefs:first.binding.sourceObservationRefs,osOwnershipRef:first.binding.osOwnershipRef},signal);
    const reply=await p.post.send(packet,signal) as NormalPermitResult;
    if(reply.executionAuthorized!==true||!reply.permit)fail('NORMAL_START_PERMIT_INVALID');permit=reply.permit;
    await append('PERMIT_RECORDED',permit);await reconcile();
    const ceiling=Math.min(first.deadline,Date.parse(permit.expiresAt)),latest=await this.#current(e,attempt.ref,signal,ceiling);
    if(!same(first.binding,latest.binding))fail('NORMAL_START_CURRENT_CHANGED');
    // permit 내구화 뒤에도 원문이 동일한지 다시 읽는다.
    const currentMaterials=await p.intake.startMaterials(e),reread=currentMaterials.options;
    for(const kind of ['contextBundle','options'] as const){
     const before=materials![kind],after=currentMaterials[kind];
     if(!same({...before,bytes:null},{...after,bytes:null})||!Buffer.from(before.bytes).equals(Buffer.from(after.bytes)))fail('NORMAL_START_MATERIAL_CHANGED');
    }
    const final=await this.#current(e,attempt.ref,signal,Math.min(ceiling,latest.deadline));
    if(!same(first.binding,final.binding))fail('NORMAL_START_CURRENT_CHANGED');
    const deadline=Math.min(ceiling,latest.deadline,final.deadline);if(this.#now()>=deadline||signal.aborted)fail('NORMAL_START_EXPIRED');
    const wireValue:any=await this.#bounded(s=>p.wire.send({envelope:cloneV1(e),contextBundle:{...cloneV1({...currentMaterials.contextBundle,bytes:null}),bytes:new Uint8Array(currentMaterials.contextBundle.bytes)},options:{...cloneV1({...reread,bytes:null}),bytes:new Uint8Array(reread.bytes)},localAttemptRef:cloneV1(attempt.ref),permit:cloneV1(permit!)},s),signal,deadline);
    if(!recordV1(wireValue,['transport','responseRef','processRef'])||wireValue.transport!=='NORMAL_PROTECTED'||!refV1(wireValue.responseRef)||wireValue.processRef!==null&&!refV1(wireValue.processRef))fail('NORMAL_START_RESPONSE_INVALID');
    const out=await append('RESPONSE_RECORDED',permit,cloneV1(wireValue.responseRef),cloneV1(wireValue.processRef));
    await reconcile();
    return this.#result(e,out);
   }catch{
    // 시도 기록 이후에는 permit/POST/wire 어느 단계 실패든 자동 재전송하지 않는다.
    if(rows.length&&rows.length<3){
     try{const unknown=await append('UNKNOWN',rows.at(-1).snapshot.permit);await reconcile();return this.#result(e,unknown);}catch{}
    }
    const last=rows.at(-1)??attempt;if(last)return this.#result(e,last,'UNKNOWN');
    return fail('NORMAL_START_RECORD_UNCERTAIN');
   }
  });
 }
}
