import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';

const limit=2*1024*1024;
function deny(code='EXECUTION_MATERIAL_REJECTED',status=412):never{throw new AuthFailure(code,status);}
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const kinds=['CONTEXT_BUNDLE','START_OPTIONS'] as const;
export const maxPageMaterialParts=200;
type Part={materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string};
export interface StartMaterialDescriptor{manifestRef:Ref;groups:{kind:typeof kinds[number];payloadRef:Ref;sourceRef:Ref;sourceBytes:number;
 contentHash:string;mediaType:'application/json';parts:Part[]}[]}
type Binding={projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number};
type Envelope={commandId:string;envelopeHash:string;payload:{contextBundleRef:Ref;optionsRef:Ref}};
/** 원 START가 같은 거래에서 등록한 manifest/material 행만으로 발견 descriptor를 재구성한다.
 * 경로·본문·임의 문서 목록은 포함하지 않으며 누락·불일치 행을 생략하거나 사후 보정하지 않는다. */
export function startMaterialDescriptor(row:unknown,b:Binding,e:Envelope):StartMaterialDescriptor{
 if(!recordV1(row,['command_record_id','manifest_ref','manifest','materials'])||!refV1(row.manifest_ref)||row.manifest_ref.version!==1)deny();
 const m=row.manifest,ref=row.manifest_ref as Ref;
 if(!recordV1(m,['schemaVersion','purpose','id','sourceKind','scope','commandId','payload','groups','expiresAt'])||digest(m)!==ref.contentHash||
   m.schemaVersion!==1||m.purpose!=='START_CONTEXT_OPTIONS_MATERIAL_V1'||m.id!==ref.id||m.sourceKind!=='PROTECTED_START_REFERENCE_V1'||
   !same(m.scope,{mode:'EXECUTION',projectId:b.projectId,connectorId:b.connectorId,executionId:b.executionId,executionGeneration:b.executionGeneration,
    grantRef:b.grantRef,credentialGeneration:b.credentialGeneration})||m.commandId!==e.commandId||!same(m.payload,e.payload)||!isoV1(m.expiresAt)||
   !arrayV1(m.groups,2)||m.groups.length!==2||!arrayV1(row.materials,maxPageMaterialParts))deny();
 const stored=new Map<string,any>();
 for(const x of row.materials as unknown[]){
  if(!recordV1(x,['ref','snapshot'])||!refV1(x.ref)||x.ref.version!==1||x.ref.contentHash!==digest(x.snapshot)||stored.has(x.ref.id))deny();
  stored.set(x.ref.id,x.snapshot);
 }
 let total=0;
 const groups=(m.groups as unknown[]).map((g,i)=>{
  const payloadRef=i===0?e.payload.contextBundleRef:e.payload.optionsRef;
  if(!recordV1(g,['kind','payloadRef','source','parts'])||g.kind!==kinds[i]||!same(g.payloadRef,payloadRef)||
    !recordV1(g.source,['sourceRef','bodyRef','originRef','contentHash','sourceBytes','mediaType'])||!refV1(g.source.sourceRef)||!hashV1(g.source.contentHash)||
    !positive(g.source.sourceBytes)||g.source.sourceBytes>limit||g.source.mediaType!=='application/json'||!arrayV1(g.parts,maxPageMaterialParts)||!g.parts.length)deny();
  const src=g.source;let offset=0;
  const parts=(g.parts as unknown[]).map((p,n):Part=>{
   if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||p.partIndex!==n+1||p.byteOffset!==offset||
     !positive(p.utf8Bytes)||!hashV1(p.contentHash)||!same(stored.get(p.materialId),{projectId:b.projectId,executionId:b.executionId,
      executionGeneration:b.executionGeneration,commandId:e.commandId,envelopeHash:e.envelopeHash,payloadRef,sourceRef:src.sourceRef,partIndex:n+1,
      partCount:g.parts.length,byteOffset:offset,sourceBytes:src.sourceBytes,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash,mediaType:'application/json'}))deny();
   offset+=p.utf8Bytes;total++;
   return {materialId:p.materialId,partIndex:p.partIndex,byteOffset:p.byteOffset,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash};
  });
  if(offset!==src.sourceBytes)deny();
  return {kind:kinds[i]!,payloadRef,sourceRef:src.sourceRef as Ref,sourceBytes:src.sourceBytes as number,contentHash:src.contentHash as string,
   mediaType:'application/json' as const,parts};
 });
 if(total!==stored.size||total>maxPageMaterialParts)deny();
 return {manifestRef:ref,groups};
}
export const startMaterialParts=(d:StartMaterialDescriptor)=>d.groups.reduce((n,g)=>n+g.parts.length,0);
/** 재구성한 원본 전체와 등록된 부분을 각각 검산한다. 원본이 등록 hash/길이와 다르면 부분 bytes를 만들지 않는다.
 * 이 함수는 보호 읽기·nonce 소비·전달을 수행하지 않으며 결과는 실행 허가가 아니다. */
export function checkedMaterialPart(raw:string,source:{sourceBytes:unknown;contentHash:unknown},part:{byteOffset:unknown;utf8Bytes:unknown;contentHash:unknown}){
 if(typeof raw!=='string'||!positive(source?.sourceBytes)||source.sourceBytes>limit||!hashV1(source.contentHash)||
   !Number.isSafeInteger(part?.byteOffset)||Number(part.byteOffset)<0||!positive(part.utf8Bytes)||!hashV1(part.contentHash))deny();
 const bytes=Buffer.from(raw,'utf8'),offset=Number(part.byteOffset),end=offset+part.utf8Bytes;
 if(bytes.length!==source.sourceBytes||end>bytes.length||bytes.toString('utf8')!==raw||contentHash(bytes)!==source.contentHash)deny();
 const selected=bytes.subarray(offset,end);
 if(selected.length!==part.utf8Bytes||contentHash(selected)!==part.contentHash)deny();
 return selected;
}
