import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,recordV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
type Material={ref:RuntimeRefV1;snapshot:{projectId:string;executionId:string;executionGeneration:number;commandId:string;envelopeHash:string;payloadRef:RuntimeRefV1;sourceRef:RuntimeRefV1;partIndex:number;partCount:number;byteOffset:number;sourceBytes:number;utf8Bytes:number;contentHash:string;mediaType:string}};
type Entry={ref:RuntimeRefV1;snapshot:{sequence:number;scope:ReceiptKeyV1;envelopeHash:string;manifestHash:string;materialRef:RuntimeRefV1;recordedAt:string;previousRef:RuntimeRefV1|null}};
export interface SyntheticMaterialInboxTransaction{
 read():Promise<{complete:boolean;events:Entry[]}>;
 readPart(receiptRef:RuntimeRefV1):Promise<Uint8Array>;
 /** bytes와 metadata를 함께 sync한다. 불명 기록을 incomplete로 보존하고 callback 실패로 삭제/rollback하지 않는다. */
 appendAndSync(entry:Entry,bytes:Uint8Array):Promise<void>;
}
export interface SyntheticMaterialInbox{transport:'SYNTHETIC_ONLY';exclusive<T>(scope:ReceiptKeyV1,body:(tx:SyntheticMaterialInboxTransaction)=>Promise<T>):Promise<T>}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
class ReceiveFailure extends Error{}
const fail=(code:string):never=>{throw new ReceiveFailure(code);};
/** 합성 자료·저장 port만 소비한다. 등록 부분 수신은 필수 맥락·현재 서버 권한·이해·실행 허가가 아니다. */
export class SyntheticMaterialReceiver{
 readonly store:SyntheticMaterialInbox;#expected:{context:AdapterContextV1;executorRegistrationRef:RuntimeRefV1};#materials:Material[];#manifestHash:string;#clock:()=>number;
 constructor(store:SyntheticMaterialInbox,expected:{context:AdapterContextV1;executorRegistrationRef:RuntimeRefV1},materials:unknown,options:{maxBytes:number;maxParts:number;clock:()=>number}){
  this.store=store;this.#port();if(!recordV1(expected,['context','executorRegistrationRef'])||!refV1(expected.executorRegistrationRef)||!options||typeof options.clock!=='function'||!positive(options.maxBytes)||options.maxBytes>1024*1024*1024||!positive(options.maxParts)||options.maxParts>200||!arrayV1(materials,options.maxParts)||!materials.length)fail('MATERIAL_RECEIVER_CONFIG_INVALID');this.#clock=options.clock;this.#expected=cloneV1(expected);this.#materials=cloneV1(materials) as Material[];this.#manifestHash=hash(this.#materials);
  const ids=new Set<string>(),groups=new Map<string,Material[]>();let total=0;
  for(const m of this.#materials){const d=m?.snapshot;if(!recordV1(m,['ref','snapshot'])||!refV1(m.ref)||m.ref.contentHash!==hash(d)||ids.has(m.ref.id)||!recordV1(d,['projectId','executionId','executionGeneration','commandId','envelopeHash','payloadRef','sourceRef','partIndex','partCount','byteOffset','sourceBytes','utf8Bytes','contentHash','mediaType'])||!uuidV1(d.projectId)||!uuidV1(d.executionId)||!positive(d.executionGeneration)||!uuidV1(d.commandId)||!hashV1(d.envelopeHash)||!refV1(d.payloadRef)||!refV1(d.sourceRef)||!positive(d.partIndex)||!positive(d.partCount)||d.partCount>options.maxParts||d.partIndex>d.partCount||!Number.isSafeInteger(d.byteOffset)||d.byteOffset<0||!positive(d.sourceBytes)||!positive(d.utf8Bytes)||d.utf8Bytes>2*1024*1024||!hashV1(d.contentHash)||!['text/plain','application/json'].includes(d.mediaType))fail('MATERIAL_MANIFEST_INVALID');ids.add(m.ref.id);total+=d.utf8Bytes;const key=canonicalJson({payloadRef:d.payloadRef,sourceRef:d.sourceRef}),group=groups.get(key)??[];group.push(m);groups.set(key,group);}
  if(total>options.maxBytes)fail('MATERIAL_RECEIVER_QUOTA');
  for(const group of groups.values()){group.sort((a,b)=>a.snapshot.partIndex-b.snapshot.partIndex);let offset=0;const first=group[0]!.snapshot;for(const [i,m]of group.entries()){const d=m.snapshot;if(d.partIndex!==i+1||d.partCount!==group.length||d.byteOffset!==offset||d.sourceBytes!==first.sourceBytes||d.mediaType!==first.mediaType)fail('MATERIAL_MANIFEST_INVALID');offset+=d.utf8Bytes;}if(offset!==first.sourceBytes)fail('MATERIAL_MANIFEST_INVALID');}
 }
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.exclusive!=='function')fail('SYNTHETIC_MATERIAL_INBOX_REQUIRED');}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail('MATERIAL_RECEIVER_CLOCK_INVALID');return n;}
 #safe(bytes:Buffer){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // 서버와 같은 알려진 비밀 표식을 수신 경계에서도 거절한다. 완전한 비밀 탐지가 아니다.
  if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i.test(text))fail('MATERIAL_PART_SENSITIVE');return bytes;
 }
 #bytes(raw:unknown,m:Material){if(!(raw instanceof Uint8Array)||raw.byteLength!==m.snapshot.utf8Bytes)fail('MATERIAL_PART_INVALID');const bytes=Buffer.from(raw as Uint8Array);if(contentHash(bytes)!==m.snapshot.contentHash)fail('MATERIAL_PART_INVALID');return this.#safe(bytes);}
 async #journal(tx:SyntheticMaterialInboxTransaction,scope:ReceiptKeyV1,envelopeHash:string){
  const raw=await tx.read();if(!recordV1(raw,['complete','events'])||raw.complete!==true||!arrayV1(raw.events,this.#materials.length)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)fail('MATERIAL_INBOX_INCOMPLETE');const events:Entry[]=cloneV1(raw.events),seen=new Set<string>(),parts=new Map<string,Buffer>();let last=-Infinity;
  for(const [i,e]of events.entries()){const s=e?.snapshot,m=this.#materials.find(m=>same(m.ref,s?.materialRef));if(!recordV1(e,['ref','snapshot'])||!refV1(e.ref)||e.ref.version!==1||e.ref.contentHash!==hash(s)||!recordV1(s,['sequence','scope','envelopeHash','manifestHash','materialRef','recordedAt','previousRef'])||s.sequence!==i+1||!same(s.scope,scope)||s.envelopeHash!==envelopeHash||s.manifestHash!==this.#manifestHash||!m||seen.has(m.ref.id)||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)<last||Date.parse(s.recordedAt)>this.#now()||!same(s.previousRef,events[i-1]?.ref??null))fail('MATERIAL_INBOX_INVALID');parts.set(m!.ref.id,this.#bytes(await tx.readPart(cloneV1(e.ref)),m!));seen.add(m!.ref.id);last=Date.parse(s.recordedAt);}
  const groups=new Map<string,Material[]>();for(const m of this.#materials){const key=canonicalJson({payloadRef:m.snapshot.payloadRef,sourceRef:m.snapshot.sourceRef}),group=groups.get(key)??[];group.push(m);groups.set(key,group);}for(const group of groups.values())if(group.every(m=>parts.has(m.ref.id))){group.sort((a,b)=>a.snapshot.partIndex-b.snapshot.partIndex);this.#safe(Buffer.concat(group.map(m=>parts.get(m.ref.id)!)));}
  return events;
 }
 #result(events:Entry[]){const received=new Set(events.map(e=>e.snapshot.materialRef.id)),missing=this.#materials.filter(m=>!received.has(m.ref.id));return{transport:'SYNTHETIC_ONLY' as const,state:missing.length?'PARTIAL' as const:'REGISTERED_PARTS_RECEIVED' as const,manifestHash:this.#manifestHash,receivedMaterialRefs:this.#materials.filter(m=>received.has(m.ref.id)).map(m=>cloneV1(m.ref)),missingMaterialIds:missing.map(m=>m.ref.id),completeContextVerified:false,executionAuthorized:false,dispatchPerformed:false};}
 async record(rawEnvelope:unknown,response:unknown){
  try{
   this.#port();const envelope=readDispatchEnvelopeV1(rawEnvelope,this.#now()),scope=receiptKeyV1(envelope);if(envelope.operation==='REQUEST_STOP'||!same(envelope.context,this.#expected.context)||!same(envelope.executorRegistrationRef,this.#expected.executorRegistrationRef))return fail('MATERIAL_ENVELOPE_MISMATCH');
   const payloadRefs=envelope.operation==='START_SESSION'?[envelope.payload.contextBundleRef,envelope.payload.optionsRef]:[envelope.payload.instructionRef,envelope.payload.partsRef];for(const m of this.#materials){const d=m.snapshot;if(d.projectId!==scope.projectId||d.executionId!==scope.executionId||d.executionGeneration!==scope.executionGeneration||d.commandId!==scope.commandId||d.envelopeHash!==envelope.envelopeHash||!payloadRefs.some(r=>same(r,d.payloadRef)))fail('MATERIAL_MANIFEST_MISMATCH');}
   if(!recordV1(response,['transport','materialId','materialRef','sourceRef','partIndex','partCount','byteOffset','sourceBytes','contentHash','mediaType','bytes','cacheControl','completeContextVerified','executionAuthorized','dispatchPerformed'])||response.transport!=='SYNTHETIC_ONLY'||response.cacheControl!=='no-store'||response.completeContextVerified!==false||response.executionAuthorized!==false||response.dispatchPerformed!==false) return fail('MATERIAL_RESPONSE_INVALID');
   const material=this.#materials.find(m=>m.ref.id===response.materialId);if(!material||!same(material.ref,response.materialRef)||!['sourceRef','partIndex','partCount','byteOffset','sourceBytes','contentHash','mediaType'].every(k=>same((material.snapshot as any)[k],response[k])))fail('MATERIAL_RESPONSE_INVALID');const bytes=this.#bytes(response.bytes,material!);
   return await this.store.exclusive(cloneV1(scope),async tx=>{
    readDispatchEnvelopeV1(envelope,this.#now());this.#port();const events=await this.#journal(tx,scope,envelope.envelopeHash);if(events.some(e=>same(e.snapshot.materialRef,material!.ref)))return this.#result(events);
    readDispatchEnvelopeV1(envelope,this.#now());const snapshot={sequence:events.length+1,scope:cloneV1(scope),envelopeHash:envelope.envelopeHash,manifestHash:this.#manifestHash,materialRef:cloneV1(material!.ref),recordedAt:new Date(this.#now()).toISOString(),previousRef:events.at(-1)?.ref??null},entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(cloneV1(entry),new Uint8Array(bytes));this.#port();const saved=await this.#journal(tx,scope,envelope.envelopeHash);if(!same(saved,[...events,entry]))fail('MATERIAL_INBOX_INCOMPLETE');readDispatchEnvelopeV1(envelope,this.#now());return this.#result(saved);
   });
  }catch(error){if(error instanceof ReceiveFailure)throw error;return fail('MATERIAL_RECEIVE_UNAVAILABLE');}
 }
}
