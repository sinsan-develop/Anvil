import {randomUUID} from 'node:crypto';
import {isProxy,isUint8Array} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,recordV1,refV1,isoV1,uuidV1,arrayV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {readNormalInstructionItem,assembleNormalInstructionMaterial,type NormalMaterialReceived,type NormalCommandPageItem} from './normal-start-material-consumer.ts';
import type {NormalLocalObservation} from './normal-observation-spool.ts';
import type {NormalProtectedGetClient} from './normal-protected-get-client.ts';
import type {NormalJournalTransaction} from './normal-start-file-store.ts';
export interface NormalInstructionStore{transport:'NORMAL_PROTECTED';exclusive<T>(key:ReceiptKeyV1,body:(tx:NormalJournalTransaction)=>Promise<T>):Promise<T>}
type Expected={context:AdapterContextV1;executorRegistrationRef:Ref};
type Send=Extract<DispatchEnvelopeV1,{operation:'SEND_INSTRUCTION'}>;
type Item=ReturnType<typeof readNormalInstructionItem>;
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail(code='NORMAL_INSTRUCTION_INTAKE_INVALID'):never{throw Error(code);}
/** 새 SEND JSON 경계는 Proxy/접근자를 실행하지 않고 하나의 data snapshot만 소비한다. */
export function captureInstructionInput<T>(value:T):T{
 const seen=new Set<object>();
 const check=(v:unknown,depth:number)=>{
  if(v===null||typeof v!=='object')return;
  if(depth>64||isProxy(v)||seen.has(v))fail();seen.add(v);
  if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();
  for(const d of Object.values(Object.getOwnPropertyDescriptors(v))){if(!('value'in d))fail();check(d.value,depth+1);}
  seen.delete(v);
 };check(value,0);return cloneV1(value);
}
const common=(c:AdapterContextV1)=>{const {authorizationReceiptRef:_,budgetRef:__,...rest}=c;return rest;};
const sensitive=/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i;
/** SEND 전용 행. MATERIAL bytes는 canonical base64url이며 RECEIVED에는 원 item만 기록한다. */
export interface NormalInstructionEntry{ref:Ref;snapshot:{sequence:number;kind:'MATERIAL'|'RECEIVED';key:ReceiptKeyV1;envelopeHash:string;descriptorHash:string;
 materialId:string|null;partContentHash:string|null;proofResultRef:Ref;item:Item|null;recordedAt:string;previousRef:Ref|null};bytes:string|null}
export class NormalInstructionIntake{
 #store:NormalInstructionStore;#exclusive:NormalInstructionStore['exclusive'];#expected:Expected;#clock:()=>number;#monotonic:()=>number;#last=-Infinity;
 constructor(store:NormalInstructionStore,expected:Expected,clock:()=>number,monotonic:()=>number=()=>performance.now()){
  if(!store||isProxy(store)||!recordV1(store,['transport','exclusive'])||store.transport!=='NORMAL_PROTECTED'||typeof store.exclusive!=='function'||
   !recordV1(expected,['context','executorRegistrationRef'])||!refV1(expected.executorRegistrationRef)||typeof clock!=='function'||typeof monotonic!=='function')fail();
  this.#store=store;this.#exclusive=store.exclusive;this.#expected=captureInstructionInput(expected);this.#clock=clock;this.#monotonic=monotonic;
 }
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)fail('NORMAL_INSTRUCTION_CLOCK_INVALID');this.#last=n;return n;}
 #port(){if(this.#store.transport!=='NORMAL_PROTECTED'||this.#store.exclusive!==this.#exclusive)fail('NORMAL_INSTRUCTION_STORE_CHANGED');}
 #envelope(raw:unknown,historical=false):Send{
  const saved=captureInstructionInput(raw);const e=readDispatchEnvelopeV1(saved,historical?Date.parse((saved as any)?.issuedAt):this.#now());
  if(e.operation!=='SEND_INSTRUCTION'||!same(common(e.context),common(this.#expected.context))||!same(e.executorRegistrationRef,this.#expected.executorRegistrationRef)||Date.parse(e.issuedAt)>this.#now())fail('NORMAL_INSTRUCTION_CONTEXT_MISMATCH');return e;
 }
 #result(e:Send,row:NormalInstructionEntry){return{transport:'NORMAL_PROTECTED' as const,state:'RECEIVED' as const,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,receivedRef:cloneV1(row.ref),executionAuthorized:false as const,dispatchPerformed:false as const};}
 async #journal(tx:NormalJournalTransaction,e:Send,item:Item|null){
  const raw=await tx.read();this.#port();if(!arrayV1(raw,201)||Buffer.byteLength(canonicalJson(raw))>3*1024*1024)fail('NORMAL_INSTRUCTION_LEDGER_INVALID');
  const rows=cloneV1(raw) as NormalInstructionEntry[],ids=new Set<string>();let last=-Infinity,received:NormalInstructionEntry|null=null;
  for(const [i,row] of rows.entries()){
   const s=row?.snapshot;
   if(!recordV1(row,['ref','snapshot','bytes'])||!refV1(row.ref)||row.ref.version!==1||ids.has(row.ref.id)||row.ref.contentHash!==hash(s)||
    !recordV1(s,['sequence','kind','key','envelopeHash','descriptorHash','materialId','partContentHash','proofResultRef','item','recordedAt','previousRef'])||s.sequence!==i+1||!same(s.key,receiptKeyV1(e))||s.envelopeHash!==e.envelopeHash||!refV1(s.proofResultRef)||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)<last||Date.parse(s.recordedAt)>this.#now()||!same(s.previousRef,rows[i-1]?.ref??null)||received)fail('NORMAL_INSTRUCTION_LEDGER_INVALID');
   ids.add(row.ref.id);last=Date.parse(s.recordedAt);
   if(s.kind==='RECEIVED'){
    if(row.bytes!==null||s.materialId!==null||s.partContentHash!==null)fail();
    const stored=readNormalInstructionItem(s.item,Date.parse(e.issuedAt));if(!same(stored.envelope,e)||item&&!same(stored,item))fail('NORMAL_INSTRUCTION_RECORD_CONFLICT');item=stored;received=row;
   }else if(s.kind!=='MATERIAL'||s.item!==null||typeof row.bytes!=='string')fail();
  }
  if(!item){if(rows.length)fail('NORMAL_INSTRUCTION_PARTIAL');return{rows,received,material:null};}
  const group=item.materials.groups[0]!,parts=rows.filter(r=>r.snapshot.kind==='MATERIAL');
  if(parts.length>group.parts.length||received&&parts.length!==group.parts.length)fail('NORMAL_INSTRUCTION_LEDGER_INVALID');
  const materials:NormalMaterialReceived[]=[];
  for(const [i,row] of parts.entries()){
   const p=group.parts[i]!,s=row.snapshot,b=Buffer.from(row.bytes!,'base64url');
   if(s.descriptorHash!==item.materialsDescriptorHash||s.materialId!==p.materialId||s.partContentHash!==p.contentHash||b.toString('base64url')!==row.bytes||b.length!==p.utf8Bytes||contentHash(b)!==p.contentHash)fail('NORMAL_INSTRUCTION_PART_INVALID');
   materials.push({materialId:p.materialId,partIndex:p.partIndex,bytes:new Uint8Array(b),proofResultRef:s.proofResultRef,observedAt:s.recordedAt,expiresAt:e.expiresAt});
  }
  if(received&&received.snapshot.descriptorHash!==item.materialsDescriptorHash)fail();
  const material=parts.length===group.parts.length?assembleNormalInstructionMaterial(group,materials):null;
  if(material&&sensitive.test(material.text))fail('NORMAL_INSTRUCTION_MATERIAL_SENSITIVE');
  return{rows,received,material};
 }
 /** 기존 직접 수신 signature는 유지한다. 네트워크 수신은 아래 원 요청 guard를 같은 저장 작업까지 전달한다. */
 async receive(raw:NormalCommandPageItem,pageProof:Ref,input:readonly NormalMaterialReceived[],signal:AbortSignal=new AbortController().signal){return this.#save(raw,pageProof,input,signal,()=>{});}
 async #save(raw:NormalCommandPageItem,pageProof:Ref,input:readonly NormalMaterialReceived[],signal:AbortSignal,requestCurrent:()=>void){
  this.#port();const captured=captureInstructionInput(raw),item=readNormalInstructionItem(captured,this.#now()),e=this.#envelope(item.envelope);
  if(isProxy(pageProof)||!refV1(pageProof)||isProxy(input)||!arrayV1(input,200))fail();const proof=cloneV1(pageProof);
  const materials=input.map(m=>{
   if(isProxy(m)||!recordV1(m,['proofResultRef','materialId','partIndex','bytes','observedAt','expiresAt'])||!refV1(m.proofResultRef)||isProxy(m.bytes)||!isUint8Array(m.bytes)||!isoV1(m.observedAt)||!isoV1(m.expiresAt)||Date.parse(m.observedAt)>this.#now()||Date.parse(m.expiresAt)<=this.#now())return fail();
   return{...cloneV1({...m,bytes:null}),bytes:new Uint8Array(m.bytes)} as NormalMaterialReceived;
  });
  const assembled=assembleNormalInstructionMaterial(item.materials.groups[0]!,materials);if(sensitive.test(assembled.text))fail('NORMAL_INSTRUCTION_MATERIAL_SENSITIVE');
  const live=()=>{requestCurrent();if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');this.#port();this.#envelope(e);if(materials.some(m=>Date.parse(m.expiresAt)<=this.#now()))fail('NORMAL_INSTRUCTION_MATERIAL_EXPIRED');};
  const out=await this.#exclusive.call(this.#store,receiptKeyV1(e),async tx=>{
   live();let {rows,received}=await this.#journal(tx,e,item);live();if(received)return this.#result(e,received);
   const append=async(kind:'MATERIAL'|'RECEIVED',m:NormalMaterialReceived|null)=>{
    live();const p=m?item.materials.groups[0]!.parts.find(p=>p.materialId===m.materialId)!:null;
    const snapshot:NormalInstructionEntry['snapshot']={sequence:rows.length+1,kind,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,descriptorHash:item.materialsDescriptorHash,materialId:p?.materialId??null,partContentHash:p?.contentHash??null,proofResultRef:cloneV1(m?.proofResultRef??proof),item:kind==='RECEIVED'?cloneV1(item):null,recordedAt:new Date(this.#now()).toISOString(),previousRef:rows.at(-1)?.ref??null};
    const entry:NormalInstructionEntry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot,bytes:m?Buffer.from(m.bytes).toString('base64url'):null};
    await tx.appendAndSync(entry);live();const saved=await this.#journal(tx,e,item);live();if(!same(saved.rows,[...rows,entry]))fail('NORMAL_INSTRUCTION_SYNC_UNCERTAIN');rows=saved.rows;received=saved.received;
   };
   for(const p of item.materials.groups[0]!.parts){if(rows.some(r=>r.snapshot.materialId===p.materialId))continue;await append('MATERIAL',materials.find(m=>m.materialId===p.materialId)!);}
   await append('RECEIVED',null);return this.#result(e,received!);
  });live();return out as {transport:'NORMAL_PROTECTED';state:'RECEIVED';key:ReceiptKeyV1;envelopeHash:string;receivedRef:Ref;executionAuthorized:false;dispatchPerformed:false};
 }
 /** 원 요청 wall/monotonic 기한은 부분/challenge/저장마다 새로 시작하지 않는다. */
 async receiveProtected(client:NormalProtectedGetClient,raw:NormalCommandPageItem,pageProof:Ref,signal:AbortSignal){
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  const wall=this.#now(),tick=this.#monotonic();if(!Number.isFinite(tick))fail('NORMAL_INSTRUCTION_CLOCK_INVALID');
  const item=readNormalInstructionItem(captureInstructionInput(raw),wall),e=this.#envelope(item.envelope),proof=captureInstructionInput(pageProof);
  if(!refV1(proof))fail();this.#port();
  const prepare=client.prepareMaterial,send=client.send;if(typeof prepare!=='function'||typeof send!=='function')fail();
  let end=Date.parse(e.expiresAt),lastTick=tick;
  const current=()=>{
   this.#port();if(client.prepareMaterial!==prepare||client.send!==send)fail('NORMAL_INSTRUCTION_PORT_CHANGED');
   const now=this.#now(),mono=this.#monotonic();if(!Number.isFinite(mono)||mono<lastTick)fail('NORMAL_INSTRUCTION_CLOCK_INVALID');lastTick=mono;
   this.#envelope(e);if(signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
   if(now>=end||mono-tick>=end-wall)fail('NORMAL_INSTRUCTION_MATERIAL_EXPIRED');
  };
  const received:NormalMaterialReceived[]=[];
  try{
   for(const part of item.materials.groups[0]!.parts){
    current();const packet=await client.prepareMaterial(item,part.materialId,signal);current();
    if(!isoV1(packet.expiresAt))fail();end=Math.min(end,Date.parse(packet.expiresAt));current();
    const material=await client.send(packet,signal);received.push(material);current();
    if(!isoV1(material.expiresAt))fail();end=Math.min(end,Date.parse(material.expiresAt));current();
   }
   current();const result=await this.#save(item,proof,received,signal,current);current();return result;
  }finally{for(const part of received)part.bytes.fill(0);}
 }
 /** 원 page descriptor와 기존 부분/수신 행을 함께 검산한다. 정상 미완료만 false이며 오류는 전파한다. */
 async hasReceived(raw:unknown){
  this.#port();const captured=captureInstructionInput(raw),e=this.#envelope((captured as any)?.envelope,true),item=readNormalInstructionItem(captured,Date.parse(e.issuedAt));
  const result=await this.#exclusive.call(this.#store,receiptKeyV1(e),async tx=>{const v=await this.#journal(tx,e,item);return Boolean(v.received&&v.material);});
  this.#port();this.#envelope(e,true);return result as boolean;
 }
 /** 첫 SEND 키로 보호 수신행의 원 envelope와 완전한 부분 자료를 재검산한다. */
 async firstMaterial(key:ReceiptKeyV1,envelopeHash:string){
  const k=captureInstructionInput(key),ctx=this.#expected.context;
  if(!recordV1(k,['projectId','executionId','executionGeneration','commandId'])||k.projectId!==ctx.projectId||k.executionId!==ctx.executionId||k.executionGeneration!==ctx.executionGeneration||!uuidV1(k.commandId)||!/^[0-9a-f]{64}$/.test(envelopeHash))fail();
  this.#port();let found:{envelope:Send;receivedRef:Ref;instructionDigest:string}|undefined,entered=false,closed=false;
  try{await Reflect.apply(this.#exclusive,this.#store,[k,async(tx:NormalJournalTransaction)=>{
   if(entered||closed||!tx||isProxy(tx))fail();entered=true;
   const read=Object.getOwnPropertyDescriptor(tx,'read')?.value;
   if(typeof read!=='function'||isProxy(read))fail();
   const raw=captureInstructionInput(await Reflect.apply(read,tx,[]));this.#port();
   if(closed||!arrayV1(raw,201)||!raw.length||Buffer.byteLength(canonicalJson(raw))>3*1024*1024)fail();
   const e=this.#envelope((raw.at(-1) as NormalInstructionEntry)?.snapshot?.item?.envelope,true);
   if(!same(receiptKeyV1(e),k)||e.envelopeHash!==envelopeHash)fail();
   const {received,material}=await this.#journal({read:async()=>raw,appendAndSync:async()=>fail()},e,null);if(closed||!received||!material)fail();
   found={envelope:e,receivedRef:cloneV1(received.ref),instructionDigest:contentHash(material.bytes)};
  }]);}finally{closed=true;}
  this.#port();if(!found)fail();return found;
 }
 /** 역사 수신 원장을 완전 재검산한 관측 입력. 새 자료 GET/수신 권한을 발급하지 않는다. */
 async observations(raw:unknown){
  this.#port();const e=this.#envelope(raw,true);
  const out=await this.#exclusive.call(this.#store,receiptKeyV1(e),async tx=>{
   const {received,material}=await this.#journal(tx,e,null);if(!received||!material)fail('NORMAL_INSTRUCTION_NOT_RECEIVED');
   return{type:'RECEIVED',commandId:e.commandId,envelopeHash:e.envelopeHash,localRecordRef:cloneV1(received.ref),processRef:null,occurredAt:received.snapshot.recordedAt,reasonCode:'NONE'};
  });this.#port();this.#envelope(e,true);return out as NormalLocalObservation;
 }
 async instruction(raw:unknown,historical=false){
  this.#port();const e=this.#envelope(raw,historical);
  const out=await this.#exclusive.call(this.#store,receiptKeyV1(e),async tx=>{
   const {received,material}=await this.#journal(tx,e,null);if(!received||!material)fail('NORMAL_INSTRUCTION_NOT_RECEIVED');
   return{...this.#result(e,received!),sessionBindingRef:cloneV1(e.payload.sessionBindingRef),instructionRef:cloneV1(e.payload.instructionRef),partsRef:cloneV1(e.payload.partsRef),bytes:material!.bytes,text:material!.text};
  });this.#port();this.#envelope(e,historical);return out as {transport:'NORMAL_PROTECTED';state:'RECEIVED';key:ReceiptKeyV1;envelopeHash:string;receivedRef:Ref;sessionBindingRef:Ref;instructionRef:Ref;partsRef:Ref;bytes:Uint8Array;text:string;executionAuthorized:false;dispatchPerformed:false};
 }
}
/** 보호 GET 부분을 모두 검산한 뒤 SEND 전용 내구 수신기에 넘긴다. 자동 재전송·cursor 확정은 없다. */
export async function receiveNormalInstruction(client:NormalProtectedGetClient,intake:NormalInstructionIntake,raw:NormalCommandPageItem,pageProof:Ref,signal:AbortSignal){
 return intake.receiveProtected(client,raw,pageProof,signal);
}
