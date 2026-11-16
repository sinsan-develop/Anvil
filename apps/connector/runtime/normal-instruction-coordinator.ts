import {randomUUID} from 'node:crypto';
import {NormalObservationSpool,type NormalLocalObservation} from './normal-observation-spool.ts';
import {isNormalInstructionWire,isNormalFirstSendWire,consumeNormalFirstSendResult,abandonNormalFirstSendResult,normalWireLiveParent} from '../adapters/secondary/normal-instruction-wire.ts';
import type {FirstSendSummary,FirstSendCompletion,LiveSendCompletion,LiveSendParent} from './normal-first-send-owner.ts';
import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,recordV1,refV1,isoV1,arrayV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {NormalInstructionIntake,captureInstructionInput,type NormalInstructionStore} from './normal-instruction-intake.ts';
import {NormalProtectedPostClient,type NormalPermitResult} from './normal-protected-post-client.ts';
import type {NormalJournalTransaction} from './normal-start-file-store.ts';
import type {NormalStartCurrent} from './normal-start-coordinator.ts';
export interface NormalInstructionPreparationResult{transport:'NORMAL_PROTECTED';state:'PERMIT_RECORDED'|'UNKNOWN';key:ReturnType<typeof receiptKeyV1>;envelopeHash:string;recordRef:Ref;permit:NormalPermitResult['permit']|null;proofResultRef:Ref|null;readOnly:true;executionAuthorized:false;dispatchPerformed:false}
type Send=Extract<DispatchEnvelopeV1,{operation:'SEND_INSTRUCTION'}>;
export interface NormalInstructionObservation{transport:'NORMAL_PROTECTED';responseRef:Ref;processRef:Ref|null}
export interface NormalInstructionWirePort{transport:'NORMAL_PROTECTED';send(capability:object,signal:AbortSignal):Promise<unknown>}
export interface NormalInstructionDriverInput{envelope:Send;instruction:Awaited<ReturnType<NormalInstructionIntake['instruction']>>;localAttemptRef:Ref;dispatchAttemptRef:Ref;permit:NonNullable<NormalInstructionPreparationResult['permit']>;proofResultRef:Ref;actualExecutionVerified:false;executionAuthorized:false}
export interface NormalInstructionDispatchResult{transport:'NORMAL_PROTECTED';state:'RESPONSE_RECORDED'|'FIRST_SEND_INPUT_AND_INIT_RECORDED'|'LIVE_SEND_INPUT_YIELDED'|'UNKNOWN';recordRef:Ref;responseRef:Ref|null;processRef:Ref|null;actualExecutionVerified:false;executionAuthorized:false;dispatchPerformed:false}
type Fresh={material:NormalInstructionDriverInput['instruction'];end:number;monoEnd:number;current:unknown};
type Ticket={parent?:LiveSendParent;grantRef:Ref;input:NormalInstructionDriverInput;signal:AbortSignal;active:boolean;claimed:boolean;verify:()=>Promise<void>;remaining:()=>number};
const claimedDispatches=new WeakMap<object,Ticket>();
export type NormalDispatchClaim=ReturnType<typeof claimNormalInstructionDispatch>;
export function originalNormalDispatchGrant(claim:NormalDispatchClaim){
 const ticket=claimedDispatches.get(claim);return ticket?.active&&ticket.claimed&&!ticket.signal.aborted?cloneV1(ticket.grantRef):null;
}
export function originalNormalLiveDispatch(claim:NormalDispatchClaim){
 const t=claimedDispatches.get(claim);return t?.parent&&t.active&&t.claimed&&!t.signal.aborted?{parent:cloneV1(t.parent),grant:cloneV1(t.grantRef)}:null;
}
const dispatchTickets=new WeakMap<object,Ticket>();
const copyInstruction=(v:NormalInstructionDriverInput['instruction'])=>({...captureInstructionInput({...v,bytes:null}),bytes:new Uint8Array(v.bytes)});
/** issuer는 아래 coordinator의 private 경로뿐이다. JSON/복제 객체는 원 dispatch 소유권을 만들지 않는다. */
export function claimNormalInstructionDispatch(capability:object,signal:AbortSignal){
 const t=dispatchTickets.get(capability);if(!t||!t.active||t.claimed||t.signal!==signal||signal.aborted)fail('NORMAL_INSTRUCTION_DISPATCH_NOT_ELIGIBLE');t.claimed=true;
 const input={...captureInstructionInput({...t.input,instruction:null}),instruction:copyInstruction(t.input.instruction)};
 const claim={input,verify:async()=>{if(!t.active||signal.aborted)fail();await t.verify();if(!t.active||signal.aborted)fail();},remaining:()=>{if(!t.active||signal.aborted)fail();return t.remaining();}};
 claimedDispatches.set(claim,t);return claim;
}
type Ports={intake:NormalInstructionIntake;store:NormalInstructionStore;post:NormalProtectedPostClient;current:NormalStartCurrent;grantRef:Ref;clock:()=>number;timeoutMs:number};
const originalFirstMaterial=NormalInstructionIntake.prototype.firstMaterial;
const originalHasReceived=NormalInstructionIntake.prototype.hasReceived;
const originalObservations=NormalInstructionIntake.prototype.observations,originalRecord=NormalObservationSpool.prototype.record;
const originalRead=NormalInstructionIntake.prototype.instruction,originalPrepare=NormalProtectedPostClient.prototype.preparePermit,originalSend=NormalProtectedPostClient.prototype.send;
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail(code='NORMAL_INSTRUCTION_ATTEMPT_INVALID'):never{throw Error(code);}
/** prepare는 내구 허가 기록 조회를 유지한다. dispatch는 같은 owner의 새 결과를 명시 소비하며 SDK 성공/cursor 권한을 만들지 않는다. */
export class NormalInstructionCoordinator{
 #p:Ports;#current:NormalStartCurrent['current'];#exclusive:NormalInstructionStore['exclusive'];#last=-Infinity;#busy=false;#unknown=false;#ready=new WeakMap<object,{envelope:Send;result:NormalInstructionPreparationResult;material:NormalInstructionDriverInput['instruction'];end:number;monoEnd:number;mintedMono:number;current:unknown}>();
 constructor(p:Ports){
  if(!p||isProxy(p)||!recordV1(p,['intake','store','post','current','grantRef','clock','timeoutMs'])||isProxy(p.intake)||Object.getPrototypeOf(p.intake)!==NormalInstructionIntake.prototype||
   isProxy(p.post)||Object.getPrototypeOf(p.post)!==NormalProtectedPostClient.prototype||!p.store||isProxy(p.store)||p.store.transport!=='NORMAL_PROTECTED'||typeof p.store.exclusive!=='function'||
   !p.current||isProxy(p.current)||p.current.transport!=='NORMAL_PROTECTED'||typeof p.current.current!=='function'||!refV1(p.grantRef)||typeof p.clock!=='function'||isProxy(p.clock)||isProxy(p.current.current)||isProxy(p.store.exclusive)||!Number.isSafeInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>10000)fail();
  this.#p={...p,grantRef:cloneV1(p.grantRef)};this.#current=p.current.current;this.#exclusive=p.store.exclusive;this.#ports();
 }
 #ports(){const p=this.#p;if(p.intake.firstMaterial!==originalFirstMaterial||NormalInstructionIntake.prototype.firstMaterial!==originalFirstMaterial||p.intake.hasReceived!==originalHasReceived||NormalInstructionIntake.prototype.hasReceived!==originalHasReceived||p.intake.observations!==originalObservations||NormalInstructionIntake.prototype.observations!==originalObservations||p.intake.instruction!==originalRead||NormalInstructionIntake.prototype.instruction!==originalRead||p.post.preparePermit!==originalPrepare||p.post.send!==originalSend||NormalProtectedPostClient.prototype.preparePermit!==originalPrepare||NormalProtectedPostClient.prototype.send!==originalSend||p.current.current!==this.#current||p.store.exclusive!==this.#exclusive||p.store.transport!=='NORMAL_PROTECTED')fail('NORMAL_INSTRUCTION_PORT_CHANGED');}
 #now(){const n=this.#p.clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)fail('NORMAL_INSTRUCTION_CLOCK_INVALID');this.#last=n;return n;}
 #permit(p:any,e:Send){if(!recordV1(p,['ref','commandId','envelopeHash','issuedAt','expiresAt'])||!refV1(p.ref)||p.ref.version!==1||p.commandId!==e.commandId||p.envelopeHash!==e.envelopeHash||!isoV1(p.issuedAt)||!isoV1(p.expiresAt)||Date.parse(p.issuedAt)>this.#now()||Date.parse(p.expiresAt)<=Date.parse(p.issuedAt)||Date.parse(p.expiresAt)>Math.min(Date.parse(p.issuedAt)+30000,Date.parse(e.expiresAt)))fail('NORMAL_INSTRUCTION_PERMIT_INVALID');}
 #rows(raw:unknown,e:Send,received:Ref){
  if(!arrayV1(raw,5)||Buffer.byteLength(canonicalJson(raw))>2097152)fail();const rows=cloneV1(raw) as any[];let at=-Infinity;const ids=new Set<string>();
  const base=['sequence','state','key','envelopeHash','grantRef','sessionBindingRef','receivedRef','previousRef','permit','proofResultRef','recordedAt'];
  for(const [i,r] of rows.entries()){const s=r?.snapshot,prior=rows[i-1]?.snapshot,dispatch=i>=2&&rows[2]?.snapshot.state==='SEND_DISPATCH_ATTEMPTED';
   if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||ids.has(r.ref.id)||r.ref.contentHash!==hash(s)||!recordV1(s,dispatch?[...base,'localAttemptRef','dispatchAttemptRef','responseRef','processRef',...(i===3&&s?.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'?['startReadyRef','inputEvidence','initConfirmationRef']:i===3&&s?.state==='LIVE_SEND_INPUT_YIELDED'?['registrationRef','startReadyRef','firstSendKey','firstEnvelopeHash','firstTerminalRef','initConfirmationRef','inputEvidence']:[])]:base)||
    s.sequence!==i+1||!same(s.key,receiptKeyV1(e))||s.envelopeHash!==e.envelopeHash||!same(s.grantRef,this.#p.grantRef)||!same(s.sessionBindingRef,e.payload.sessionBindingRef)||!same(s.receivedRef,received)||!same(s.previousRef,rows[i-1]?.ref??null)||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)<at||Date.parse(s.recordedAt)>this.#now())fail();
   ids.add(r.ref.id);at=Date.parse(s.recordedAt);
   if(i===0){if(s.state!=='SEND_ATTEMPTED'||s.permit!==null||s.proofResultRef!==null)fail();continue;}
   if(prior.state==='UNKNOWN')fail();
   if(dispatch){
    if(i===2&&(prior.state!=='PERMIT_RECORDED'||s.state!=='SEND_DISPATCH_ATTEMPTED'||s.dispatchAttemptRef!==null||s.responseRef!==null||s.processRef!==null)||
     i===3&&!['RESPONSE_RECORDED','FIRST_SEND_INPUT_AND_INIT_RECORDED','LIVE_SEND_INPUT_YIELDED','UNKNOWN'].includes(s.state)||i===4&&(!['FIRST_SEND_INPUT_AND_INIT_RECORDED','RESPONSE_RECORDED','LIVE_SEND_INPUT_YIELDED'].includes(prior.state)||s.state!=='UNKNOWN')||
     !same(s.localAttemptRef,rows[0].ref)||i>2&&!same(s.dispatchAttemptRef,rows[2].ref)||!same(s.permit,rows[1].snapshot.permit)||!same(s.proofResultRef,rows[1].snapshot.proofResultRef))fail();
    if(s.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'||s.state==='LIVE_SEND_INPUT_YIELDED'){
     if(s.state==='LIVE_SEND_INPUT_YIELDED')this.#parentShape(s,e);
     const v=s.inputEvidence;
     if(i!==3||s.responseRef!==null||s.processRef!==null||!refV1(s.startReadyRef)||s.startReadyRef.version!==1||!refV1(s.initConfirmationRef)||s.initConfirmationRef.version!==1||
      !recordV1(v,['dispatchAttemptRef','instructionRef','partsRef','instructionDigest','messageDigest'])||!same(v.dispatchAttemptRef,s.dispatchAttemptRef)||
      !same(v.instructionRef,e.payload.instructionRef)||!same(v.partsRef,e.payload.partsRef)||![v.instructionDigest,v.messageDigest].every(h=>typeof h==='string'&&/^[0-9a-f]{64}$/.test(h)))fail();
    }
    if(s.state==='RESPONSE_RECORDED'&&(!refV1(s.responseRef)||s.processRef!==null&&!refV1(s.processRef))||s.state==='UNKNOWN'&&(s.responseRef!==null||s.processRef!==null))fail();
   }else{
    // 원 1~3행 형상과 UNKNOWN 전이는 그대로 보존한다.
    if(i>2||i===2&&s.state!=='UNKNOWN'||!['PERMIT_RECORDED','UNKNOWN'].includes(s.state)||i===2&&prior.state!=='PERMIT_RECORDED')fail();
    if(i===2&&(!same(s.permit,prior.permit)||!same(s.proofResultRef,prior.proofResultRef)))fail();
   }
   if(s.permit!==null){this.#permit(s.permit,e);if(!refV1(s.proofResultRef))fail();}else if(s.proofResultRef!==null||s.state!=='UNKNOWN')fail();
  }return rows;
 }
 #parentShape(p:Record<string,any>,e:Send){
  const k=p.firstSendKey;
  if(!recordV1(k,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(k.commandId)||k.commandId===e.commandId||
   !same(k,{...receiptKeyV1(e),commandId:k.commandId})||!same(p.registrationRef,e.executorRegistrationRef)||
   ![p.firstTerminalRef,p.startReadyRef,p.initConfirmationRef].every(r=>refV1(r)&&r.version===1)||typeof p.firstEnvelopeHash!=='string'||!/^[0-9a-f]{64}$/.test(p.firstEnvelopeHash))fail();
 }
 async #strict<T>(e:Send,check:()=>void,body:(tx:NormalJournalTransaction)=>Promise<T>,terminalClose=false){
  const key=receiptKeyV1(e);let entered=false,finished=false,closed=false,finalCalls=0,releaseChecked=false,result:T|undefined;
  const guard=()=>{if(closed)fail();check();};
  try{await Reflect.apply(this.#exclusive,this.#p.store,[key,async(tx:NormalJournalTransaction)=>{
   if(entered||closed||!tx||isProxy(tx))fail();entered=true;guard();
   const methods=['requireStartReadyClose','read','appendAndSync'].map(k=>Object.getOwnPropertyDescriptor(tx,k)?.value);
   if(methods.some(fn=>typeof fn!=='function'||isProxy(fn)))fail();
   const invoke=(i:number,args:unknown[])=>{guard();const key=['requireStartReadyClose','read','appendAndSync'][i]!;if(Object.getOwnPropertyDescriptor(tx,key)?.value!==methods[i])fail();return Reflect.apply(methods[i],tx,args);};
   invoke(0,[key]);
   if(terminalClose){
    const arm=Object.getOwnPropertyDescriptor(tx,'requireLiveInputClose')?.value;
    if(typeof arm!=='function'||isProxy(arm))fail();
    Reflect.apply(arm,tx,[key,()=>{
     if(++finalCalls!==1||!finished||closed)fail('NORMAL_INSTRUCTION_CLOSE_ORDER');guard();releaseChecked=true;
    }]);
   }
   result=await body({read:async()=>captureInstructionInput(await invoke(1,[])) as unknown[],appendAndSync:async value=>{await invoke(2,[value]);guard();}});guard();finished=true;
  }]);}finally{closed=true;}
  if(!finished||terminalClose&&(!releaseChecked||finalCalls!==1))fail('NORMAL_INSTRUCTION_SYNC_UNCERTAIN');if(!terminalClose)check();return result as T;
 }
 async #parent(p:LiveSendParent,e:Send,check:()=>void){
  this.#parentShape(p,e);check();
  const first=await Reflect.apply(originalFirstMaterial,this.#p.intake,[p.firstSendKey,p.firstEnvelopeHash]);check();
  if(!same(first.envelope.executorRegistrationRef,p.registrationRef)||!same(first.envelope.payload.sessionBindingRef,e.payload.sessionBindingRef))fail();
  await this.#strict(first.envelope,check,async tx=>{
   const rows=this.#rows(await tx.read(),first.envelope,first.receivedRef),last=rows.at(-1);
   if(rows.length!==4||last.snapshot.state!=='FIRST_SEND_INPUT_AND_INIT_RECORDED'||!same(last.ref,p.firstTerminalRef)||
    !same(last.snapshot.startReadyRef,p.startReadyRef)||!same(last.snapshot.initConfirmationRef,p.initConfirmationRef)||last.snapshot.inputEvidence.instructionDigest!==first.instructionDigest)fail('NORMAL_INSTRUCTION_HISTORY_CONFLICT');
  });
 }
 #result(e:Send,row:any,state=row.snapshot.state){return{transport:'NORMAL_PROTECTED' as const,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,recordRef:cloneV1(row.ref),permit:cloneV1(row.snapshot.permit),proofResultRef:cloneV1(row.snapshot.proofResultRef),readOnly:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};}
 async #bounded<T>(fn:(signal:AbortSignal)=>Promise<T>,outer:AbortSignal,end:number){
  const c=new AbortController(),duration=Math.min(this.#p.timeoutMs,end-this.#now()),mono=performance.now();let timer:ReturnType<typeof setTimeout>|undefined,listener=()=>{};
  if(outer.aborted||duration<=0)fail('NORMAL_INSTRUCTION_EXPIRED');
  const stop=new Promise<never>((_,reject)=>{listener=()=>{c.abort();reject(Error('NORMAL_INSTRUCTION_INTERRUPTED'));};outer.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,duration);});
  try{const out=await Promise.race([Promise.resolve().then(()=>{if(c.signal.aborted)fail();return fn(c.signal);}),stop]);if(c.signal.aborted||outer.aborted||performance.now()-mono>=duration||this.#now()>=end)fail('NORMAL_INSTRUCTION_EXPIRED');this.#ports();return out;}
  finally{c.abort();clearTimeout(timer);outer.removeEventListener('abort',listener);}
 }
 /** 조회 실패를 신규 실행으로 바꾸지 않는다. 완전 미수신/부분 수신이며 attempt도 비어 있을 때만 GET을 허용한다. */
 async history(raw:unknown,signal:AbortSignal){
  if(this.#busy)fail('NORMAL_INSTRUCTION_BUSY');if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  this.#ports();const item=captureInstructionInput(raw),e=readDispatchEnvelopeV1((item as any)?.envelope,Date.parse((item as any)?.envelope?.issuedAt));if(e.operation!=='SEND_INSTRUCTION')fail();
  this.#busy=true;let received=false;
  try{
   received=await originalHasReceived.call(this.#p.intake,item);this.#ports();if(signal.aborted)fail();
   if(!received){
    await this.#exclusive.call(this.#p.store,receiptKeyV1(e),async tx=>{const rows=await tx.read();this.#ports();if(signal.aborted||!arrayV1(rows,0))fail('NORMAL_INSTRUCTION_HISTORY_CONFLICT');});
    this.#ports();if(signal.aborted)fail();return{state:'NOT_RECEIVED',inputs:[] as NormalLocalObservation[]};
   }
  }finally{this.#busy=false;}
  return this.observations(e,signal);
 }
 /** 완전한 원 intake/attempt 체인의 역사 조회. 결과는 dispatch eligibility를 만들지 않는다. */
 async observations(raw:unknown,signal:AbortSignal){
  if(this.#busy)fail('NORMAL_INSTRUCTION_BUSY');if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  this.#ports();const input=captureInstructionInput(raw),e=readDispatchEnvelopeV1(input,Date.parse((input as any)?.issuedAt));if(e.operation!=='SEND_INSTRUCTION'||Date.parse(e.issuedAt)>this.#now())fail();
  this.#busy=true;
  try{
   const received=await originalObservations.call(this.#p.intake,e);this.#ports();if(signal.aborted)fail();
   let historyRows:any[]=[];
   const historyCheck=()=>{this.#ports();if(signal.aborted)fail();};
   const captured:{value?:{state:string;inputs:NormalLocalObservation[]}}={};let entered=false,closed=false;
   try{await Reflect.apply(this.#exclusive,this.#p.store,[receiptKeyV1(e),async(tx:NormalJournalTransaction)=>{
    if(entered||closed)fail();entered=true;
    const rows=this.#rows(await tx.read(),e,received.localRecordRef);historyRows=rows;this.#ports();if(signal.aborted)fail();
    if(rows[3]?.snapshot.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'){
     const material=await originalRead.call(this.#p.intake,cloneV1(e),true);this.#ports();
     if(signal.aborted||rows[3].snapshot.inputEvidence.instructionDigest!==contentHash(material.bytes))fail('NORMAL_INSTRUCTION_HISTORY_CONFLICT');
    }
    const inputs:NormalLocalObservation[]=[received];
    for(const r of rows){const v=r.snapshot;if(v.state==='SEND_DISPATCH_ATTEMPTED'||v.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'||v.state==='LIVE_SEND_INPUT_YIELDED')continue;
     inputs.push({type:v.state==='SEND_ATTEMPTED'?'PREPARED':v.state==='RESPONSE_RECORDED'?'PROVIDER_RESPONSE_RECEIVED':v.state,
      commandId:e.commandId,envelopeHash:e.envelopeHash,localRecordRef:cloneV1(r.ref),processRef:v.processRef??null,occurredAt:v.recordedAt,
      reasonCode:v.state==='RESPONSE_RECORDED'?'UNVERIFIED_PROVIDER_CLAIM':v.state==='UNKNOWN'?'RECORD_UNCERTAIN':'NONE'});
    }
    if(closed)fail();captured.value={state:rows.at(-1)?.snapshot.state??'NOT_PREPARED',inputs};return cloneV1(captured.value);
   }]);}finally{closed=true;}
   historyCheck();const value=captured.value;if(!value)fail();
   if(value.state==='LIVE_SEND_INPUT_YIELDED'){
    const snapshot=historyRows[3].snapshot,material=await Reflect.apply(originalRead,this.#p.intake,[e,true]);historyCheck();
    if(contentHash(material.bytes)!==snapshot.inputEvidence.instructionDigest)fail();
    await this.#parent(snapshot,e,historyCheck);
    await this.#strict(e,historyCheck,async tx=>{if(!same(this.#rows(await tx.read(),e,received.localRecordRef),historyRows))fail();});
   }
   return value as {state:string;inputs:NormalLocalObservation[]};
  }finally{this.#busy=false;}
 }
 async recordObservations(raw:unknown,spool:NormalObservationSpool,signal:AbortSignal){
  const check=()=>{this.#ports();if(signal.aborted||isProxy(spool)||Object.getPrototypeOf(spool)!==NormalObservationSpool.prototype||spool.record!==originalRecord||NormalObservationSpool.prototype.record!==originalRecord)fail('NORMAL_INSTRUCTION_OBSERVATION_PORT_INVALID');};
  check();const source=await this.observations(raw,signal),recordedRefs:Ref[]=[];check();
  for(const input of source.inputs){check();const ref=await originalRecord.call(spool,input);check();recordedRefs.push(cloneV1(ref));}
  const first=source.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'||source.state==='LIVE_SEND_INPUT_YIELDED';
  if(first&&!same(source.inputs.map(v=>v.type),['RECEIVED','PREPARED','PERMIT_RECORDED']))fail();
  return{state:source.state,recordedRefs,...(first?{requiredAckRef:recordedRefs.at(-1)}:{}),executionAuthorized:false as const,dispatchPerformed:false as const,actualExecutionVerified:false as const};
 }
 async prepare(raw:unknown,signal:AbortSignal):Promise<NormalInstructionPreparationResult>{
  if(this.#busy)fail('NORMAL_INSTRUCTION_BUSY');if(this.#unknown)fail('NORMAL_INSTRUCTION_UNKNOWN');if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  this.#ports();const captured=captureInstructionInput(raw),e=readDispatchEnvelopeV1(captured,Date.parse((captured as any)?.issuedAt));if(e.operation!=='SEND_INSTRUCTION'||Date.parse(e.issuedAt)>this.#now())fail();
  const prepareMono=performance.now(),prepareWall=this.#now();this.#busy=true;let attempted=false,eligibility:Fresh|null=null;
  try{
   const material=await this.#p.intake.instruction(e,true);this.#ports();if(signal.aborted)fail();
   const result=await this.#exclusive.call(this.#p.store,receiptKeyV1(e),async tx=>{
    let rows=this.#rows(await tx.read(),e,material.receivedRef);this.#ports();
    const append=async(state:string,permit:any=null,proofResultRef:Ref|null=null)=>{
     const snapshot={sequence:rows.length+1,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,grantRef:cloneV1(this.#p.grantRef),sessionBindingRef:cloneV1(e.payload.sessionBindingRef),receivedRef:cloneV1(material.receivedRef),previousRef:rows.at(-1)?.ref??null,permit:cloneV1(permit),proofResultRef:cloneV1(proofResultRef),recordedAt:new Date(this.#now()).toISOString(),...(rows[2]?.snapshot.state==='SEND_DISPATCH_ATTEMPTED'?{localAttemptRef:rows[0].ref,dispatchAttemptRef:rows[2].ref,responseRef:null,processRef:null}:{})};
     const entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(entry);
     const reread=this.#rows(await tx.read(),e,material.receivedRef);if(!same(reread,[...rows,entry]))fail('NORMAL_INSTRUCTION_SYNC_UNCERTAIN');rows=reread;return entry;
    };
    if(rows.length){if(['SEND_ATTEMPTED','SEND_DISPATCH_ATTEMPTED'].includes(rows.at(-1).snapshot.state))await append('UNKNOWN',rows.at(-1).snapshot.permit,rows.at(-1).snapshot.proofResultRef);return this.#result(e,rows.at(-1).snapshot.state==='RESPONSE_RECORDED'?rows[1]:rows.at(-1));}
    readDispatchEnvelopeV1(e,this.#now());if(signal.aborted)fail();
    const currentMaterial=await this.#p.intake.instruction(e);if(!same({...currentMaterial,bytes:null},{...material,bytes:null})||!Buffer.from(currentMaterial.bytes).equals(Buffer.from(material.bytes)))fail();
    this.#ports();readDispatchEnvelopeV1(e,this.#now());if(signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
    attempted=true;const attempt=await append('SEND_ATTEMPTED');
    let end=Date.parse(e.expiresAt);
    try{
     const v:any=cloneV1(await this.#bounded(s=>this.#current.call(this.#p.current,cloneV1(e),cloneV1(attempt.ref),s),signal,end));
     const refs=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()],now=this.#now();
     if(!recordV1(v,['transport','key','envelopeHash','grantRef','localAttemptRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||v.transport!=='NORMAL_PROTECTED'||!same(v.key,receiptKeyV1(e))||v.envelopeHash!==e.envelopeHash||!same(v.grantRef,this.#p.grantRef)||!same(v.localAttemptRef,attempt.ref)||!same(v.sourceObservationRefs,refs)||!refV1(v.osOwnershipRef)||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>now||now-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)>Date.parse(v.checkedAt)+30000)fail('NORMAL_INSTRUCTION_CURRENT_INVALID');
     end=Math.min(end,Date.parse(v.expiresAt));
     const packet=await this.#bounded(s=>this.#p.post.preparePermit(e.commandId,{envelopeHash:e.envelopeHash,localAttemptRef:attempt.ref,sourceObservationRefs:v.sourceObservationRefs,osOwnershipRef:v.osOwnershipRef},s),signal,end);
     const reply=await this.#bounded(s=>this.#p.post.send(packet,s),signal,end) as NormalPermitResult;
     if(!recordV1(reply,['transport','proofResultRef','permit','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||reply.transport!=='NORMAL_PROTECTED'||!refV1(reply.proofResultRef)||reply.cacheControl!=='no-store'||reply.nonceConsumed!==true||reply.executionAuthorized!==true||reply.dispatchPerformed!==false)fail('NORMAL_INSTRUCTION_PERMIT_INVALID');
     this.#permit(reply.permit,e);end=Math.min(end,Date.parse(reply.permit.expiresAt));
     const latest=await this.#p.intake.instruction(e);this.#ports();if(!same({...latest,bytes:null},{...material,bytes:null})||!Buffer.from(latest.bytes).equals(Buffer.from(material.bytes))||signal.aborted||this.#now()>=end)fail();
     const saved=await append('PERMIT_RECORDED',reply.permit,reply.proofResultRef);this.#ports();if(signal.aborted||this.#now()>=end)fail();const {checkedAt:_,expiresAt:__,...currentBinding}=v;eligibility={material:latest,end,monoEnd:prepareMono+end-prepareWall,current:cloneV1(currentBinding)};return this.#result(e,saved);
    }catch{
     this.#unknown=true;const last=rows.at(-1);await append('UNKNOWN',last.snapshot.permit,last.snapshot.proofResultRef);return this.#result(e,rows.at(-1));
    }
   });
   // strict-close 실패이면 이 지점에 도달하지 않는다. 역사 조회는 eligibility를 설정하지 않는다.
   const fresh=eligibility as Fresh|null;
   if(fresh&&!signal.aborted&&this.#now()<fresh.end&&performance.now()<fresh.monoEnd){this.#ports();this.#ready.set(result as object,{envelope:cloneV1(e),result:cloneV1(result) as NormalInstructionPreparationResult,material:copyInstruction(fresh.material),end:fresh.end,monoEnd:fresh.monoEnd,mintedMono:performance.now(),current:cloneV1(fresh.current)});}
   return result as NormalInstructionPreparationResult;
  }catch(error){if(attempted)this.#unknown=true;throw error;}finally{this.#busy=false;}
 }
 async dispatch(raw:unknown,prepared:NormalInstructionPreparationResult,wire:NormalInstructionWirePort,signal:AbortSignal):Promise<NormalInstructionDispatchResult>{
  if(this.#busy)fail('NORMAL_INSTRUCTION_BUSY');if(this.#unknown)fail('NORMAL_INSTRUCTION_UNKNOWN');if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  const ready=this.#ready.get(prepared);if(!ready)fail('NORMAL_INSTRUCTION_DISPATCH_NOT_ELIGIBLE');this.#ready.delete(prepared);
  if(performance.now()<ready.mintedMono||performance.now()>=ready.monoEnd)fail('NORMAL_INSTRUCTION_DISPATCH_EXPIRED');
  const e=readDispatchEnvelopeV1(captureInstructionInput(raw),this.#now());if(e.operation!=='SEND_INSTRUCTION'||!same(e,ready.envelope)||!same(captureInstructionInput(prepared),ready.result)||prepared.state!=='PERMIT_RECORDED'||!prepared.permit||!prepared.proofResultRef)fail('NORMAL_INSTRUCTION_DISPATCH_NOT_ELIGIBLE');
  prepared=cloneV1(ready.result);
  if(!isNormalInstructionWire(wire))fail('NORMAL_INSTRUCTION_WIRE_REQUIRED');
  const send=wire.send,started=performance.now(),wall=this.#now();let end=Math.min(ready.end,Date.parse(e.expiresAt),Date.parse(prepared.permit!.expiresAt),wall+this.#p.timeoutMs,wall+ready.monoEnd-started),ticket:Ticket|undefined,lastTick=started;
  const live=()=>{this.#ports();const tick=performance.now();if(tick<lastTick)fail('NORMAL_INSTRUCTION_CLOCK_INVALID');lastTick=tick;if(!isNormalInstructionWire(wire)||wire.send!==send||wire.transport!=='NORMAL_PROTECTED'||signal.aborted||this.#now()>=end||performance.now()-started>=end-wall)fail('NORMAL_INSTRUCTION_DISPATCH_EXPIRED');};
  const verifyCurrent=async(attemptRef:Ref)=>{
     const material=await Reflect.apply(originalRead,this.#p.intake,[cloneV1(e)]);live();if(!same({...material,bytes:null},{...ready.material,bytes:null})||!Buffer.from(material.bytes).equals(Buffer.from(ready.material.bytes)))fail('NORMAL_INSTRUCTION_MATERIAL_CHANGED');
     const v:any=captureInstructionInput(await this.#bounded(s=>Reflect.apply(this.#current,this.#p.current,[cloneV1(e),cloneV1(attemptRef),s]),signal,end));live();
     const refs=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()],now=this.#now();
     if(!recordV1(v,['transport','key','envelopeHash','grantRef','localAttemptRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||v.transport!=='NORMAL_PROTECTED'||!same(v.key,receiptKeyV1(e))||v.envelopeHash!==e.envelopeHash||!same(v.grantRef,this.#p.grantRef)||!same(v.localAttemptRef,attemptRef)||!same(v.sourceObservationRefs,refs)||!refV1(v.osOwnershipRef)||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>now||now-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)>Date.parse(v.checkedAt)+30000)fail('NORMAL_INSTRUCTION_CURRENT_INVALID');
     const {checkedAt:_,expiresAt:__,...binding}=v;if(!same(ready.current,binding))fail('NORMAL_INSTRUCTION_CURRENT_CHANGED');end=Math.min(end,Date.parse(v.expiresAt));live();
  };
  let capability:object|undefined,completion:FirstSendCompletion|LiveSendCompletion|undefined,committed=false;
  this.#busy=true;
  try{
   const parent=normalWireLiveParent(wire);
   if(parent){
    let chain:any[]=[];
    const checkParent=()=>{live();if(!same(normalWireLiveParent(wire),parent))fail();};
    const readChain=async(tx:NormalJournalTransaction)=>this.#rows(await tx.read(),e,ready.material.receivedRef);
    const compare=async(tx:NormalJournalTransaction)=>{if(!same(await readChain(tx),chain))fail('NORMAL_INSTRUCTION_HISTORY_CONFLICT');};
    const append=async(tx:NormalJournalTransaction,state:string,summary?:LiveSendCompletion['summary'])=>{
     const snapshot={...cloneV1(chain[1].snapshot),sequence:chain.length+1,state,previousRef:cloneV1(chain.at(-1).ref),recordedAt:new Date(this.#now()).toISOString(),
      localAttemptRef:cloneV1(chain[0].ref),dispatchAttemptRef:chain[2]?.ref??null,responseRef:null,processRef:null,...(summary??{})};
     const entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
     await tx.appendAndSync(entry);const saved=await readChain(tx);if(!same(saved,[...chain,entry]))fail('NORMAL_INSTRUCTION_SYNC_UNCERTAIN');chain=saved;return entry;
    };
    await this.#strict(e,checkParent,async tx=>{
     chain=await readChain(tx);if(chain.length!==2||!same(chain[1].ref,prepared.recordRef)||!same(chain[1].snapshot.permit,prepared.permit)||!same(chain[1].snapshot.proofResultRef,prepared.proofResultRef))fail();
     await append(tx,'SEND_DISPATCH_ATTEMPTED');
    });
    const verify=async()=>{
     checkParent();await this.#parent(parent,e,checkParent);checkParent();
     await verifyCurrent(chain[0].ref);checkParent();await this.#strict(e,checkParent,compare);
    };
    const issued=Object.freeze({});capability=issued;
    const value=await this.#bounded(async child=>{
     ticket={parent:cloneV1(parent),grantRef:cloneV1(this.#p.grantRef),input:{envelope:cloneV1(e),instruction:copyInstruction(ready.material),localAttemptRef:cloneV1(chain[0].ref),dispatchAttemptRef:cloneV1(chain[2].ref),permit:cloneV1(prepared.permit!),proofResultRef:cloneV1(prepared.proofResultRef!),actualExecutionVerified:false,executionAuthorized:false},signal:child,active:true,claimed:false,
      verify:async()=>{if(child.aborted||!ticket?.active)fail();await verify();if(child.aborted||!ticket.active)fail();},remaining:()=>{checkParent();return Math.min(end-this.#now(),end-wall-(performance.now()-started));}};
     dispatchTickets.set(issued,ticket);return Reflect.apply(send,wire,[issued,child]);
    },signal,end);
    completion=consumeNormalFirstSendResult(wire,issued,value);if(!ticket?.claimed||completion.kind!=='LIVE')fail();
    const delivery=completion;signal.addEventListener('abort',delivery.abandon,{once:true});
    const active=()=>{checkParent();delivery.check();};
    active();await verify();active();
    // 마지막 본문 검산과 strict close가 모두 정상인 입력 제공 사실은 후행 취소로 역행하지 않는다.
    const last=await this.#strict(e,active,async tx=>{await compare(tx);active();return append(tx,'LIVE_SEND_INPUT_YIELDED',delivery.summary);},true);
    delivery.commit(last.ref);committed=true;
    return{transport:'NORMAL_PROTECTED',state:'LIVE_SEND_INPUT_YIELDED',recordRef:cloneV1(last.ref),responseRef:null,processRef:null,actualExecutionVerified:false,executionAuthorized:false,dispatchPerformed:false};
   }
   const result=await this.#exclusive.call(this.#p.store,receiptKeyV1(e),async tx=>{
    live();let rows=this.#rows(await tx.read(),e,ready.material.receivedRef);live();
    if(rows.length!==2||!same(rows[1].ref,prepared.recordRef)||!same(rows[1].snapshot.permit,prepared.permit)||!same(rows[1].snapshot.proofResultRef,prepared.proofResultRef))fail('NORMAL_INSTRUCTION_DISPATCH_NOT_ELIGIBLE');
    const append=async(state:string,observation:NormalInstructionObservation|null=null,first?:FirstSendSummary)=>{
     const snapshot={sequence:rows.length+1,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,grantRef:cloneV1(this.#p.grantRef),sessionBindingRef:cloneV1(e.payload.sessionBindingRef),receivedRef:cloneV1(ready.material.receivedRef),previousRef:rows.at(-1).ref,
      permit:cloneV1(prepared.permit),proofResultRef:cloneV1(prepared.proofResultRef),recordedAt:new Date(this.#now()).toISOString(),localAttemptRef:cloneV1(rows[0].ref),dispatchAttemptRef:rows[2]?.ref??null,responseRef:observation?.responseRef??null,processRef:observation?.processRef??null,...(first??{})};
     const entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(entry);
     const reread=this.#rows(await tx.read(),e,ready.material.receivedRef);if(!same(reread,[...rows,entry]))fail('NORMAL_INSTRUCTION_SYNC_UNCERTAIN');rows=reread;return entry;
    };
    const output=(row:any):NormalInstructionDispatchResult=>({transport:'NORMAL_PROTECTED',state:row.snapshot.state,recordRef:cloneV1(row.ref),responseRef:cloneV1(row.snapshot.responseRef),processRef:cloneV1(row.snapshot.processRef),actualExecutionVerified:false,executionAuthorized:false,dispatchPerformed:false});
    const verify=async()=>{
     live();const saved=this.#rows(await tx.read(),e,ready.material.receivedRef);live();if(!same(saved,rows))fail();
     await verifyCurrent(rows[0].ref);
    };
    try{
     await verify();live();const dispatch=await append('SEND_DISPATCH_ATTEMPTED');live();
     const issued=Object.freeze({});capability=issued;
     const observation=await this.#bounded(async child=>{
      ticket={grantRef:cloneV1(this.#p.grantRef),input:{envelope:cloneV1(e),instruction:copyInstruction(ready.material),localAttemptRef:cloneV1(rows[0].ref),dispatchAttemptRef:cloneV1(dispatch.ref),permit:cloneV1(prepared.permit!),proofResultRef:cloneV1(prepared.proofResultRef!),actualExecutionVerified:false,executionAuthorized:false},signal:child,active:true,claimed:false,
       verify:async()=>{if(!ticket?.active||child.aborted)fail();await verify();if(!ticket.active||child.aborted)fail();},remaining:()=>{live();return Math.min(end-this.#now(),end-wall-(performance.now()-started));}};
      dispatchTickets.set(issued,ticket);return send.call(wire,issued,child);
     },signal,end);live();
     if(isNormalFirstSendWire(wire)){
      if(!ticket?.claimed)fail();completion=consumeNormalFirstSendResult(wire,issued,observation);if(completion.kind!=='FIRST')fail();
      signal.addEventListener('abort',completion.abandon,{once:true});live();
      const last=await append('FIRST_SEND_INPUT_AND_INIT_RECORDED',null,completion.summary);live();return output(last);
     }
     const observed=captureInstructionInput(observation);if(!ticket?.claimed||!recordV1(observed,['transport','responseRef','processRef'])||observed.transport!=='NORMAL_PROTECTED'||!refV1(observed.responseRef)||observed.processRef!==null&&!refV1(observed.processRef))fail('NORMAL_INSTRUCTION_RESPONSE_INVALID');
     const last=await append('RESPONSE_RECORDED',{transport:'NORMAL_PROTECTED',responseRef:observed.responseRef,processRef:observed.processRef});live();return output(last);
    }catch{
     this.#unknown=true;if(ticket)ticket.active=false;
     // 검사 실패도 같은 새 결과 객체를 재사용하지 않는다. dispatch 이전 UNKNOWN은 기존 닫힌 행형상을 쓴다.
     if(rows.length===2){const snapshot={...cloneV1(rows[1].snapshot),sequence:3,state:'UNKNOWN',previousRef:rows[1].ref,recordedAt:new Date(this.#now()).toISOString()},entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(entry);const saved=this.#rows(await tx.read(),e,ready.material.receivedRef);if(!same(saved,[...rows,entry]))fail();return{transport:'NORMAL_PROTECTED',state:'UNKNOWN',recordRef:entry.ref,responseRef:null,processRef:null,actualExecutionVerified:false,executionAuthorized:false,dispatchPerformed:false} as NormalInstructionDispatchResult;}
     return output(await append('UNKNOWN'));
    }finally{if(ticket)ticket.active=false;}
   });
   const completed=result as NormalInstructionDispatchResult;if(completed.state==='RESPONSE_RECORDED')live();
   if(completed.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'){live();if(!completion)return fail();completion.commit(completed.recordRef);live();committed=true;}
   return completed;
  }catch(error){this.#unknown=true;throw error;}finally{if(completion)signal.removeEventListener('abort',completion.abandon);if(!committed)completion?.abandon();if(capability)abandonNormalFirstSendResult(capability);if(ticket)ticket.active=false;this.#busy=false;}
 }

}
