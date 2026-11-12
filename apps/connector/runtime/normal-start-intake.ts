import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {assembleNormalStartMaterial,type NormalCommandPageItem,type NormalMaterialReceived,type NormalStartMaterialDescriptor} from './normal-start-material-consumer.ts';
import type {NormalProtectedGetClient} from './normal-protected-get-client.ts';

/** normal START 수신기. 보호 GET으로 받아 codec이 검산한 명령 item과 자료 부분을 내구 journal에 기록하고 RECEIVED에서 멈춘다.
 * 합성 전용(SYNTHETIC_ONLY) 수신기와 경계를 섞지 않도록 transport는 NORMAL_PROTECTED로 둔다.
 * permit·wire·Agent 시작은 하지 않으며(서버에 normal permit 경로가 없다) 결과는 실행 허가나 전체 맥락 검증이 아니다. */
type Kind='MATERIAL'|'RECEIVED';
export interface NormalStartEntry{ref:Ref;snapshot:{sequence:number;kind:Kind;key:ReceiptKeyV1;envelopeHash:string;descriptorHash:string;
 materialId:string|null;partContentHash:string|null;proofResultRef:Ref;materials:NormalStartMaterialDescriptor|null;recordedAt:string;previousRef:Ref|null}}
export interface NormalStartTransaction{
 read():Promise<{complete:boolean;events:NormalStartEntry[]}>;
 readPart(entryRef:Ref):Promise<Uint8Array>;
 /** MATERIAL은 bytes와 metadata를 함께, RECEIVED는 metadata만 sync한다. 불명 기록은 incomplete로 보존하고 자동 삭제하지 않는다. */
 appendAndSync(entry:NormalStartEntry,bytes:Uint8Array|null):Promise<void>;
}
export interface NormalStartStore{transport:'NORMAL_PROTECTED';exclusive<T>(key:ReceiptKeyV1,body:(tx:NormalStartTransaction)=>Promise<T>):Promise<T>}
interface Expected{context:AdapterContextV1;executorRegistrationRef:Ref}
type StartEnvelope=Extract<DispatchEnvelopeV1,{operation:'START_SESSION'}>;

export class NormalStartIntakeFailure extends Error{
 readonly code:string;
 constructor(code:string){super(code);this.name='NormalStartIntakeFailure';this.code=code;}
}
function fail(code:string):never{throw new NormalStartIntakeFailure(code);}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
// 합성 수신기·서버와 같은 알려진 비밀 표식. 완전한 비밀 탐지가 아니다.
const sensitive=/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i;

export class NormalStartIntake{
 readonly store:NormalStartStore;readonly executionAuthorized=false;readonly dispatchPerformed=false;
 #expected:Expected;#clock:()=>number;
 constructor(store:NormalStartStore,expected:Expected,clock:()=>number){
  this.store=store;this.#port();
  if(typeof clock!=='function'||!recordV1(expected,['context','executorRegistrationRef'])||!refV1(expected.executorRegistrationRef))
   fail('NORMAL_INTAKE_CONFIG_INVALID');
  this.#expected=cloneV1(expected);this.#clock=clock;
 }
 #port(){if(this.store?.transport!=='NORMAL_PROTECTED'||typeof this.store.exclusive!=='function')fail('NORMAL_INTAKE_STORE_REQUIRED');}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail('NORMAL_INTAKE_CLOCK_INVALID');return n;}
 /** at을 주면 그 시각 기준(이력 조회), 없으면 현재 시각 기준으로 봉투를 읽는다. */
 #envelope(raw:unknown,at?:number):StartEnvelope{
  let e:DispatchEnvelopeV1;
  try{e=readDispatchEnvelopeV1(cloneV1(raw),at??this.#now());}catch(error){
   const m=error instanceof Error?error.message:'';return fail(['ENVELOPE_EXPIRED','ENVELOPE_NOT_YET_VALID'].includes(m)?m:'NORMAL_INTAKE_ENVELOPE_INVALID');}
  // codec은 실행기 등록·connector 결박을 보지 않으므로 여기서 대조한다.
  if(e.operation!=='START_SESSION'||!same(e.context,this.#expected.context)||!same(e.executorRegistrationRef,this.#expected.executorRegistrationRef))fail('NORMAL_INTAKE_CONTEXT_MISMATCH');
  const start=e as StartEnvelope;
  if(same(start.payload.contextBundleRef,start.payload.optionsRef))fail('NORMAL_INTAKE_ENVELOPE_INVALID');
  return start;
 }
 #parts(d:NormalStartMaterialDescriptor){return d.groups.flatMap(g=>g.parts.map(p=>({group:g,part:p})));}
 /** codec이 만든 것이 아닐 수 있는 descriptor를 기록 전에 다시 확인한다: 두 그룹 순서·envelope 참조·부분 연속·합계·전역 ID 유일. */
 #descriptor(d:unknown,e:StartEnvelope):NormalStartMaterialDescriptor{
  const kinds=['CONTEXT_BUNDLE','START_OPTIONS'],refs=[e.payload.contextBundleRef,e.payload.optionsRef],ids=new Set<string>();let total=0;
  if(!recordV1(d,['manifestRef','groups'])||!refV1(d.manifestRef)||!arrayV1(d.groups,2)||d.groups.length!==2)return fail('NORMAL_INTAKE_DESCRIPTOR_INVALID');
  for(const [i,g] of (d.groups as any[]).entries()){
   if(!recordV1(g,['kind','payloadRef','sourceRef','sourceBytes','contentHash','mediaType','parts'])||g.kind!==kinds[i]||!same(g.payloadRef,refs[i])||!refV1(g.sourceRef)||
     !Number.isSafeInteger(g.sourceBytes)||g.sourceBytes<1||g.sourceBytes>2*1024*1024||!hashV1(g.contentHash)||g.mediaType!=='application/json'||!arrayV1(g.parts,200)||!g.parts.length)
    fail('NORMAL_INTAKE_DESCRIPTOR_INVALID');
   let offset=0;
   for(const [n,p] of (g.parts as any[]).entries()){
    if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||ids.has(p.materialId)||p.partIndex!==n+1||p.byteOffset!==offset||
      !Number.isSafeInteger(p.utf8Bytes)||p.utf8Bytes<1||!hashV1(p.contentHash))fail('NORMAL_INTAKE_DESCRIPTOR_INVALID');
    ids.add(p.materialId);offset+=p.utf8Bytes;total++;
   }
   if(offset!==g.sourceBytes)fail('NORMAL_INTAKE_DESCRIPTOR_INVALID');
  }
  if(total>200)fail('NORMAL_INTAKE_DESCRIPTOR_INVALID');
  return d as NormalStartMaterialDescriptor;
 }
 #safe(bytes:Uint8Array){
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return fail('NORMAL_INTAKE_MATERIAL_INVALID');}
  if(sensitive.test(text))fail('NORMAL_INTAKE_MATERIAL_SENSITIVE');
 }
 /** 내구 journal을 검산한다. MATERIAL은 descriptor 순서대로 0개 이상, RECEIVED는 모든 부분 뒤 한 번만 올 수 있다.
  * 합성 수신기처럼 읽을 때마다 저장된 부분 bytes를 다시 읽어 길이·hash를 확인하고, 다 모인 그룹은 조립해 표식을 검사한다.
  * 불명 기록(complete=false)은 복구 경로 없이 LEDGER_INCOMPLETE로 멈추며 운영자 확인 대상이다. */
 async #journal(tx:NormalStartTransaction,key:ReceiptKeyV1,e:StartEnvelope,descriptor:NormalStartMaterialDescriptor|null){
  const raw=await tx.read();
  if(!recordV1(raw,['complete','events'])||raw.complete!==true)return fail('NORMAL_INTAKE_LEDGER_INCOMPLETE');
  if(!arrayV1(raw.events,201)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)fail('NORMAL_INTAKE_LEDGER_INVALID');
  const events:NormalStartEntry[]=cloneV1(raw.events);let last=-Infinity,received:NormalStartEntry|null=null;const ids=new Set<string>();
  const first=events[0]?.snapshot.descriptorHash;
  for(const [i,entry] of events.entries()){
   const s=entry?.snapshot;
   if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||entry.ref.version!==1||entry.ref.contentHash!==hash(s)||
     !recordV1(s,['sequence','kind','key','envelopeHash','descriptorHash','materialId','partContentHash','proofResultRef','materials','recordedAt','previousRef'])||
     s.sequence!==i+1||!same(s.key,key)||s.envelopeHash!==e.envelopeHash||!hashV1(s.descriptorHash)||s.descriptorHash!==first||!refV1(s.proofResultRef)||
     !isoV1(s.recordedAt)||Date.parse(s.recordedAt)<last||Date.parse(s.recordedAt)>this.#now()||!same(s.previousRef,events[i-1]?.ref??null)||received)
    fail('NORMAL_INTAKE_LEDGER_INVALID');
   if(s.kind==='MATERIAL'){
    if(!uuidV1(s.materialId)||ids.has(s.materialId)||!hashV1(s.partContentHash)||s.materials!==null)fail('NORMAL_INTAKE_LEDGER_INVALID');
    ids.add(s.materialId);
   }else if(s.kind==='RECEIVED'){
    if(s.materialId!==null||s.partContentHash!==null||!recordV1(s.materials,['manifestRef','groups'])||hash(s.materials)!==s.descriptorHash)fail('NORMAL_INTAKE_LEDGER_INVALID');
    const all=this.#parts(s.materials as NormalStartMaterialDescriptor);
    if(all.length!==ids.size||!all.every(x=>ids.has(x.part.materialId)))fail('NORMAL_INTAKE_LEDGER_INVALID');
    received=entry;
   }else fail('NORMAL_INTAKE_LEDGER_INVALID');
   last=Date.parse(s.recordedAt);
  }
  if(descriptor&&events.length&&first!==hash(descriptor))fail('NORMAL_INTAKE_RECORD_CONFLICT');
  const recorded=events.filter(x=>x.snapshot.kind==='MATERIAL'),stored=new Map<string,Uint8Array>();
  const desc=descriptor??(received?this.#descriptor((received as NormalStartEntry).snapshot.materials,e):null);
  if(desc){
   const order=this.#parts(desc);
   // 기록된 MATERIAL은 descriptor 부분 순서의 앞부분과 정확히 같아야 한다.
   for(const [i,ev] of recorded.entries()){const x=order[i];
    if(!x||x.part.materialId!==ev.snapshot.materialId||x.part.contentHash!==ev.snapshot.partContentHash)fail(descriptor?'NORMAL_INTAKE_RECORD_CONFLICT':'NORMAL_INTAKE_LEDGER_INVALID');}
  }
  for(const ev of recorded){
   const bytes=await tx.readPart(cloneV1(ev.ref)),part=desc?this.#parts(desc).find(x=>x.part.materialId===ev.snapshot.materialId)!.part:null;
   if(!(bytes instanceof Uint8Array)||contentHash(bytes)!==ev.snapshot.partContentHash||(part&&bytes.byteLength!==part.utf8Bytes))fail('NORMAL_INTAKE_PART_INVALID');
   stored.set(ev.snapshot.materialId!,new Uint8Array(bytes));
  }
  if(desc)for(const g of desc.groups)if(g.parts.every(p=>stored.has(p.materialId))){
   const whole=Buffer.concat(g.parts.map(p=>stored.get(p.materialId)!));
   if(whole.length!==g.sourceBytes||contentHash(whole)!==g.contentHash)fail('NORMAL_INTAKE_PART_INVALID');
   this.#safe(whole);
  }
  return {events,received:received as NormalStartEntry|null,stored};
 }
 #result(e:StartEnvelope,events:NormalStartEntry[],received:NormalStartEntry){
  return {transport:'NORMAL_PROTECTED' as const,state:'RECEIVED' as const,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,descriptorHash:received.snapshot.descriptorHash,
   receivedRef:cloneV1(received.ref),materialEntryRefs:events.filter(x=>x.snapshot.kind==='MATERIAL').map(x=>cloneV1(x.ref)),
   completeContextVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }
 /** 저장소·입력 오류를 코드로 바꾼다. 원문 bytes는 오류에 넣지 않는다. */
 async #guard<T>(code:string,body:()=>Promise<T>):Promise<T>{
  try{return await body();}catch(error){if(error instanceof NormalStartIntakeFailure)throw error;return fail(code);}
 }
 /** 검산된 명령 item과 그 모든 자료 부분을 기록한다. 이미 RECEIVED면 같은 descriptor인지 확인하고 기존 결과를 돌려준다.
  * 중간에 끊긴 기록은 같은 입력으로 다시 호출해 이어서 완성한다(이미 기록된 부분은 다시 쓰지 않는다).
  * 봉투가 만료되면 receive는 ENVELOPE_EXPIRED로 거절하며 기존 결과도 readStatus로만 본다. 만료된 PARTIAL은 그대로 남는다. */
 receive(item:NormalCommandPageItem,pageProofResultRef:Ref,materials:readonly NormalMaterialReceived[]){return this.#guard('NORMAL_INTAKE_UNAVAILABLE',async()=>{
  this.#port();
  if(!refV1(pageProofResultRef)||!arrayV1(materials,200)||!materials.every(m=>recordV1(m,['proofResultRef','materialId','partIndex','bytes','observedAt','expiresAt'])&&refV1(m.proofResultRef)&&m.bytes instanceof Uint8Array))
   fail('NORMAL_INTAKE_INPUT_INVALID');
  const e=this.#envelope(item?.envelope),descriptor=this.#descriptor(item.materials,e),key=receiptKeyV1(e),descriptorHash=hash(descriptor);
  if(item.materialsDescriptorHash!==descriptorHash)fail('NORMAL_INTAKE_INPUT_INVALID');
  // 그룹별로 전체를 조립해 길이·hash·엄격 UTF-8을 다시 확인한 뒤 표식을 검사한다.
  const byId=new Map<string,NormalMaterialReceived>();
  for(const group of descriptor.groups){
   const own=materials.filter(m=>group.parts.some(p=>p.materialId===m.materialId));
   try{this.#safe(assembleNormalStartMaterial(group,own).bytes);}catch(error){if(error instanceof NormalStartIntakeFailure)throw error;return fail('NORMAL_INTAKE_MATERIAL_INVALID');}
   for(const m of own)byId.set(m.materialId,m);
  }
  if(byId.size!==materials.length)fail('NORMAL_INTAKE_INPUT_INVALID');
  const result=await this.store.exclusive(cloneV1(key),async tx=>{
   this.#port();let {events,received}=await this.#journal(tx,key,e,descriptor);
   if(received)return this.#result(e,events,received);
   const append=async(kind:Kind,materialId:string|null,partContentHash:string|null,proofResultRef:Ref,bytes:Uint8Array|null)=>{
    this.#envelope(e);
    const snapshot:NormalStartEntry['snapshot']={sequence:events.length+1,kind,key:cloneV1(key),envelopeHash:e.envelopeHash,descriptorHash,materialId,partContentHash,
     proofResultRef:cloneV1(proofResultRef),materials:kind==='RECEIVED'?cloneV1(descriptor):null,recordedAt:new Date(this.#now()).toISOString(),previousRef:cloneV1(events.at(-1)?.ref??null)};
    const entry:NormalStartEntry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
    await tx.appendAndSync(cloneV1(entry),bytes?new Uint8Array(bytes):null);
    const saved=await this.#journal(tx,key,e,descriptor);
    if(!same(saved.events,[...events,entry]))fail('NORMAL_INTAKE_LEDGER_INCOMPLETE');
    events=saved.events;received=saved.received;
   };
   for(const {part} of this.#parts(descriptor)){
    if(events.some(x=>x.snapshot.materialId===part.materialId))continue;
    const m=byId.get(part.materialId)!;await append('MATERIAL',part.materialId,part.contentHash,m.proofResultRef,m.bytes);
   }
   await append('RECEIVED',null,null,pageProofResultRef,null);
   return this.#result(e,events,received!);
  });
  this.#port();return result;
 });}
 /** 재시작 뒤 진행 상태를 읽기만 한다. 만료된 봉투도 이력으로 조회하며 현재 허가를 만들지 않는다. 아직 발행 전인 봉투는 거절한다. */
 readStatus(rawEnvelope:unknown){return this.#guard('NORMAL_INTAKE_STATUS_UNAVAILABLE',async()=>{
  this.#port();const e=this.#envelope(rawEnvelope,Date.parse((rawEnvelope as any)?.issuedAt)),key=receiptKeyV1(e),at=this.#now();
  if(Date.parse(e.issuedAt)>at)fail('ENVELOPE_NOT_YET_VALID');
  const {events,received}=await this.store.exclusive(cloneV1(key),async tx=>this.#journal(tx,key,e,null));
  const now=this.#now();
  return {transport:'NORMAL_PROTECTED' as const,state:received?'RECEIVED' as const:events.length?'PARTIAL' as const:'NONE' as const,
   recordedParts:events.filter(x=>x.snapshot.kind==='MATERIAL').length,envelopeTimeState:now>=Date.parse(e.expiresAt)?'EXPIRED' as const:'WITHIN_ENVELOPE_WINDOW' as const,
   readOnly:true as const,currentAuthorityVerified:false as const,executionAuthorized:false as const};
 });}
 /** RECEIVED로 기록된 START의 실행 옵션 원문을 읽는다. 봉투가 유효한 동안만 돌려주며 기본 옵션을 만들지 않는다. */
 startOptions(rawEnvelope:unknown){return this.#guard('NORMAL_INTAKE_START_UNAVAILABLE',async()=>{
  this.#port();const e=this.#envelope(rawEnvelope),key=receiptKeyV1(e);
  const out=await this.store.exclusive(cloneV1(key),async tx=>{
   // #journal이 저장 bytes 전부를 다시 읽고 RECEIVED descriptor로 길이·hash·조립·표식을 확인한다.
   const {received,stored}=await this.#journal(tx,key,e,null);
   if(!received)return fail('NORMAL_INTAKE_NOT_RECEIVED');
   const group=received.snapshot.materials!.groups[1]!;
   const bytes=Buffer.concat(group.parts.map(p=>stored.get(p.materialId)!));
   this.#envelope(e);
   return {transport:'NORMAL_PROTECTED' as const,key:cloneV1(key),envelopeHash:e.envelopeHash,contextBundleRef:cloneV1(e.payload.contextBundleRef),optionsRef:cloneV1(e.payload.optionsRef),
    receivedRef:cloneV1(received.ref),utf8Bytes:bytes.length,contentHash:contentHash(bytes),bytes:new Uint8Array(bytes),executionAuthorized:false as const};
  });
  this.#port();this.#envelope(e);return out;
 });}
}

/** 한 명령 item의 모든 자료를 보호 GET으로 차례로 받아 수신기에 기록한다. 실패는 그대로 던지며 자동 재시도하지 않는다.
 * 결과 불명(outcomeUnknown) 오류를 받은 호출자는 같은 packet 재전송이나 기다림을 스스로 정한다. */
export async function receiveNormalStart(client:NormalProtectedGetClient,intake:NormalStartIntake,item:NormalCommandPageItem,pageProofResultRef:Ref,signal:AbortSignal){
 const received:NormalMaterialReceived[]=[];
 for(const group of item.materials.groups)for(const part of group.parts){
  const prepared=await client.prepareMaterial(item,part.materialId,signal);
  received.push(await client.send(prepared,signal));
 }
 return intake.receive(item,pageProofResultRef,received);
}
