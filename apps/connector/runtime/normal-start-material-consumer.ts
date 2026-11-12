import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';

/** FN08 A안(§2·§3) 정상 START 자료의 실행기 쪽 응답 소비 codec.
 * 서버 응답을 받은 뒤의 형태·결박·길이·hash 검산만 한다. HTTP·키·credential·challenge 발급·저장·자동 재요청은 하지 않으며
 * 검산 성공은 실행 허가가 아니다(executionAuthorized=false를 그대로 요구한다).
 * 호출자 책임: (1) now는 서버 시각과 맞춰진 시계여야 한다. envelope issuedAt/expiresAt와 응답 기한을 오차 허용 없이 대조한다.
 * (2) 실행기 등록·connector 결박은 이 codec이 보지 않으므로 실행 단계에서 따로 대조한다.
 * (3) HTTP 계층이 JSON.parse 전에 응답 본문을 계약 상한(명령 페이지 2MiB, 자료 2,812,587 bytes)으로 자른다. */
const pageLimit=2*1024*1024,sourceLimit=2*1024*1024,maxItems=50,maxPageParts=200;
const maxEncoded=2796203,maxMetadata=16384;
const kinds=['CONTEXT_BUNDLE','START_OPTIONS'] as const;
export type NormalStartMaterialKind=typeof kinds[number];
export interface NormalStartMaterialPart{materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}
export interface NormalStartMaterialGroup{kind:NormalStartMaterialKind;payloadRef:Ref;sourceRef:Ref;sourceBytes:number;contentHash:string;
 mediaType:'application/json';parts:NormalStartMaterialPart[]}
export interface NormalStartMaterialDescriptor{manifestRef:Ref;groups:NormalStartMaterialGroup[]}
export interface NormalCommandPageItem{sequence:number;commandRef:Ref;envelope:DispatchEnvelopeV1;materials:NormalStartMaterialDescriptor;
 /** 서버 고정 page receipt의 materialsDescriptorHash와 같은 방식(canonical JSON SHA256)으로 계산한 값 */
 materialsDescriptorHash:string}
export interface NormalCommandPage{proofResultRef:Ref;items:NormalCommandPageItem[];nextCursor:string;hasMore:boolean;observedAt:string;expiresAt:string}
export interface NormalCommandPageScope{projectId:string;executionId:string;executionGeneration:number;afterSequence:number}
export interface NormalMaterialReceived{proofResultRef:Ref;materialId:string;partIndex:number;bytes:Uint8Array;observedAt:string;expiresAt:string}

export class NormalMaterialConsumerFailure extends Error{
 readonly code:string;
 constructor(code:string){super(code);this.name='NormalMaterialConsumerFailure';this.code=code;}
}
function fail(code:string):never{throw new NormalMaterialConsumerFailure(code);}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const sequenceOk=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const ref1=(v:unknown):v is Ref=>refV1(v)&&v.version===1;
const flags=(o:Record<string,any>)=>o.transport==='NORMAL_PROTECTED'&&o.cacheControl==='no-store'&&o.nonceConsumed===true&&
 o.executionAuthorized===false&&o.dispatchPerformed===false;
function window(o:Record<string,any>,now:number){
 if(!isoV1(o.observedAt)||!isoV1(o.expiresAt)||!Number.isSafeInteger(now))return false;
 const observed=Date.parse(o.observedAt),expires=Date.parse(o.expiresAt);
 return observed<expires&&now<expires;
}
function scopeOk(s:unknown):s is NormalCommandPageScope{
 return recordV1(s,['projectId','executionId','executionGeneration','afterSequence'])&&uuidV1(s.projectId)&&uuidV1(s.executionId)&&
  positive(s.executionGeneration)&&Number.isSafeInteger(s.afterSequence)&&s.afterSequence>=0;
}

/** 명령 item의 materials를 envelope 참조와 대조한다. 부분은 1부터 연속, byteOffset은 이어지고 합계는 원본 길이와 같아야 한다. */
function readDescriptor(raw:unknown,envelope:DispatchEnvelopeV1,seen:Set<string>):NormalStartMaterialDescriptor{
 if(!recordV1(raw,['manifestRef','groups'])||!ref1(raw.manifestRef)||!arrayV1(raw.groups,2)||raw.groups.length!==2)fail('MATERIAL_DESCRIPTOR_INVALID');
 const payload=(envelope as any).payload;
 if(!recordV1(payload,['contextBundleRef','optionsRef'])||!refV1(payload.contextBundleRef)||!refV1(payload.optionsRef))fail('MATERIAL_DESCRIPTOR_INVALID');
 const groups=(raw.groups as unknown[]).map((g,i):NormalStartMaterialGroup=>{
  const payloadRef=i===0?payload.contextBundleRef:payload.optionsRef;
  if(!recordV1(g,['kind','payloadRef','sourceRef','sourceBytes','contentHash','mediaType','parts'])||g.kind!==kinds[i]||!same(g.payloadRef,payloadRef)||
    !refV1(g.sourceRef)||!positive(g.sourceBytes)||g.sourceBytes>sourceLimit||!hashV1(g.contentHash)||g.mediaType!=='application/json'||
    !arrayV1(g.parts,maxPageParts)||!g.parts.length)fail('MATERIAL_DESCRIPTOR_INVALID');
  let offset=0;
  const parts=(g.parts as unknown[]).map((p,n):NormalStartMaterialPart=>{
   if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||seen.has(p.materialId)||
     p.partIndex!==n+1||p.byteOffset!==offset||!positive(p.utf8Bytes)||!hashV1(p.contentHash))fail('MATERIAL_DESCRIPTOR_INVALID');
   seen.add(p.materialId);offset+=p.utf8Bytes;
   return {materialId:p.materialId,partIndex:p.partIndex,byteOffset:p.byteOffset,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash};
  });
  if(offset!==g.sourceBytes)fail('MATERIAL_DESCRIPTOR_INVALID');
  return {kind:kinds[i]!,payloadRef:cloneV1(payloadRef),sourceRef:cloneV1(g.sourceRef),sourceBytes:g.sourceBytes,contentHash:g.contentHash,mediaType:'application/json',parts};
 });
 return {manifestRef:cloneV1(raw.manifestRef),groups};
}

/** GET .../commands 응답. 현재 normal START만 받으며 SEND/STOP 등 다른 operation을 START로 해석하지 않는다. */
export function readNormalCommandPage(raw:unknown,scope:NormalCommandPageScope,now:number):NormalCommandPage{
 if(!scopeOk(scope))fail('COMMAND_PAGE_SCOPE_INVALID');
 if(!recordV1(raw,['transport','proofResultRef','items','nextCursor','hasMore','observedAt','expiresAt','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||
   !flags(raw)||!ref1(raw.proofResultRef)||!arrayV1(raw.items,maxItems)||typeof raw.nextCursor!=='string'||!raw.nextCursor.length||raw.nextCursor.length>4096||
   typeof raw.hasMore!=='boolean'||(raw.hasMore&&!raw.items.length)||!window(raw,now))fail('COMMAND_PAGE_INVALID');
 if(Buffer.byteLength(canonicalJson(raw))>pageLimit)fail('COMMAND_PAGE_TOO_LARGE');
 let previous=scope.afterSequence,parts=0;
 const commands=new Set<string>(),records=new Set<string>(),materials=new Set<string>();
 const items=(raw.items as unknown[]).map((x):NormalCommandPageItem=>{
  if(!recordV1(x,['sequence','commandRef','envelope','materials'])||!sequenceOk(x.sequence)||x.sequence<=previous||!refV1(x.commandRef)||
    records.has(x.commandRef.id))fail('COMMAND_PAGE_ITEM_INVALID');
  let envelope:DispatchEnvelopeV1;
  try{envelope=readDispatchEnvelopeV1(x.envelope,now);}catch{return fail('COMMAND_PAGE_ITEM_INVALID');}
  if(envelope.operation!=='START_SESSION'||envelope.context.projectId!==scope.projectId||envelope.context.executionId!==scope.executionId||
    envelope.context.executionGeneration!==scope.executionGeneration||commands.has(envelope.commandId))fail('COMMAND_PAGE_ITEM_INVALID');
  const descriptor=readDescriptor(x.materials,envelope,materials);
  parts+=descriptor.groups.reduce((n,g)=>n+g.parts.length,0);
  if(parts>maxPageParts)fail('COMMAND_PAGE_TOO_LARGE');
  previous=x.sequence;records.add(x.commandRef.id);commands.add(envelope.commandId);
  return {sequence:x.sequence,commandRef:cloneV1(x.commandRef),envelope,materials:descriptor,materialsDescriptorHash:digest(descriptor)};
 });
 return {proofResultRef:cloneV1(raw.proofResultRef),items,nextCursor:raw.nextCursor,hasMore:raw.hasMore,observedAt:raw.observedAt,expiresAt:raw.expiresAt};
}

/** 서버에 서명해 보낼 정확한 자료 GET 경로. 쿼리는 붙이지 않는다(서버는 빈 query hash만 받는다). */
export function normalMaterialPath(connectorId:string,executionId:string,commandId:string,materialId:string){
 if(![connectorId,executionId,commandId,materialId].every(uuidV1))fail('MATERIAL_PATH_INVALID');
 return '/api/v1/connectors/'+connectorId+'/executions/'+executionId+'/commands/'+commandId+'/materials/'+materialId;
}

/** 자료 하나를 페이지 descriptor에서 찾는다. 같은 명령의 descriptor에 없는 ID는 요청하지 않는다. */
export function findNormalMaterial(item:NormalCommandPageItem,materialId:string){
 for(const group of item.materials.groups){
  const part=group.parts.find(p=>p.materialId===materialId);
  if(part)return {group,part};
 }
 return fail('MATERIAL_NOT_IN_DESCRIPTOR');
}

/** canonical unpadded base64url만 받는다. decode→encode가 정확히 같아야 하며 길이·hash는 디코드한 원본 bytes 기준이다. */
function decodeCanonical(value:unknown):Buffer{
 if(typeof value!=='string'||!value.length||value.length>maxEncoded||!/^[A-Za-z0-9_-]+$/.test(value)||value.length%4===1)fail('MATERIAL_BYTES_INVALID');
 const bytes=Buffer.from(value as string,'base64url');
 if(bytes.toString('base64url')!==value)fail('MATERIAL_BYTES_INVALID');
 return bytes;
}

/** GET .../commands/:commandId/materials/:materialId 응답. 요청한 부분과 descriptor의 sourceRef·순번·부분 hash·길이를 대조한다. */
export function readNormalMaterialResponse(raw:unknown,item:NormalCommandPageItem,materialId:string,now:number):NormalMaterialReceived{
 const {group,part}=findNormalMaterial(item,materialId);
 if(!recordV1(raw,['transport','proofResultRef','material','observedAt','expiresAt','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||
   !flags(raw)||!ref1(raw.proofResultRef)||!window(raw,now)||
   !recordV1(raw.material,['materialId','sourceRef','partIndex','partCount','contentHash','bytes']))fail('MATERIAL_RESPONSE_INVALID');
 const m=raw.material as Record<string,any>;
 if(m.materialId!==part.materialId||!same(m.sourceRef,group.sourceRef)||m.partIndex!==part.partIndex||m.partCount!==group.parts.length||
   m.contentHash!==part.contentHash)fail('MATERIAL_RESPONSE_MISMATCH');
 const {bytes:_encoded,...metadata}=m;
 if(Buffer.byteLength(canonicalJson({...raw,material:metadata}))>maxMetadata)fail('MATERIAL_RESPONSE_INVALID');
 const bytes=decodeCanonical(m.bytes);
 if(bytes.length!==part.utf8Bytes||contentHash(bytes)!==part.contentHash)fail('MATERIAL_BYTES_MISMATCH');
 return {proofResultRef:cloneV1(raw.proofResultRef),materialId:part.materialId,partIndex:part.partIndex,bytes:new Uint8Array(bytes),
  observedAt:raw.observedAt,expiresAt:raw.expiresAt};
}

/** 한 그룹의 모든 부분을 순서대로 이어 원본을 만든다. 누락·중복·다른 그룹 부분은 거절하고,
 * 원본 길이·SHA256·엄격 UTF-8을 검산한 뒤 텍스트를 돌려준다. 부분 하나만으로는 UTF-8 경계를 판정하지 않는다. */
export function assembleNormalStartMaterial(group:NormalStartMaterialGroup,received:readonly NormalMaterialReceived[]):{bytes:Uint8Array;text:string}{
 if(!arrayV1(received,maxPageParts)||received.length!==group.parts.length)fail('MATERIAL_ASSEMBLY_INCOMPLETE');
 const chunks=group.parts.map(p=>{
  const own=received.filter(r=>r.materialId===p.materialId);
  if(own.length!==1||own[0]!.partIndex!==p.partIndex||!(own[0]!.bytes instanceof Uint8Array)||own[0]!.bytes.length!==p.utf8Bytes||
    contentHash(own[0]!.bytes)!==p.contentHash)fail('MATERIAL_ASSEMBLY_INCOMPLETE');
  return own[0]!.bytes;
 });
 const bytes=Buffer.concat(chunks);
 if(bytes.length!==group.sourceBytes||contentHash(bytes)!==group.contentHash)fail('MATERIAL_ASSEMBLY_MISMATCH');
 let text:string;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return fail('MATERIAL_ASSEMBLY_MISMATCH');}
 return {bytes:new Uint8Array(bytes),text};
}
