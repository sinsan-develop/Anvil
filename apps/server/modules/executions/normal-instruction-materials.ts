import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw new AuthFailure('EXECUTION_INSTRUCTION_MATERIAL_REJECTED',412);};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
type Binding={projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number};
type Envelope={commandId:string;envelopeHash:string;payload:{sessionBindingRef:Ref;instructionRef:Ref;partsRef:Ref}};
export interface InstructionMaterialDescriptor{manifestRef:Ref;groups:{kind:'INSTRUCTION';payloadRef:Ref;sourceRef:Ref;sourceBytes:number;contentHash:string;mediaType:'text/plain;charset=utf-8'|'text/markdown;charset=utf-8';parts:{materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}[]}[]}
/** 권위를 생산하지 않는다. 원 등록된 SEND manifest와 모든 material 행을 exact 대조한다. */
export function instructionMaterialDescriptor(row:unknown,b:Binding,e:Envelope):InstructionMaterialDescriptor{
 if(!recordV1(row,['command_record_id','manifest_ref','manifest','materials'])||!uuidV1(row.command_record_id)||!refV1(row.manifest_ref)||row.manifest_ref.version!==1)return fail();
 const m=row.manifest,ref=row.manifest_ref as Ref;
 if(!recordV1(m,['schemaVersion','id','sourceKind','scope','commandId','source','parts','expiresAt'])||hash(m)!==ref.contentHash||m.id!==ref.id||m.schemaVersion!==1||m.sourceKind!=='PROTECTED_INSTRUCTION_REFERENCE_V1'||!isoV1(m.expiresAt)||m.commandId!==e.commandId||!same(m.scope,{mode:'EXECUTION',projectId:b.projectId,connectorId:b.connectorId,executionId:b.executionId,executionGeneration:b.executionGeneration,grantRef:b.grantRef,credentialGeneration:b.credentialGeneration})||!recordV1(m.source,['sourceRef','bodyRef','partsRef','originRef','contentHash','sourceBytes','mediaType'])||![m.source.sourceRef,m.source.bodyRef,m.source.partsRef,m.source.originRef].every(refV1)||!same(m.source.sourceRef,e.payload.instructionRef)||!same(m.source.partsRef,e.payload.partsRef)||!same(m.source.originRef,e.payload.instructionRef)||!hashV1(m.source.contentHash)||m.source.bodyRef.contentHash!==m.source.contentHash||!positive(m.source.sourceBytes)||m.source.sourceBytes>2097152||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(m.source.mediaType)||!arrayV1(m.parts,200)||!m.parts.length||!arrayV1(row.materials,200)||row.materials.length!==m.parts.length)return fail();
 const stored=new Map<string,any>();
 for(const r of row.materials){if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||r.ref.contentHash!==hash(r.snapshot)||stored.has(r.ref.id))return fail();stored.set(r.ref.id,r.snapshot);}
 let offset=0;const parts=m.parts.map((p:any,i:number)=>{
  if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||p.partIndex!==i+1||p.byteOffset!==offset||!positive(p.utf8Bytes)||p.utf8Bytes>65536||!hashV1(p.contentHash)||!same(stored.get(p.materialId),{projectId:b.projectId,executionId:b.executionId,executionGeneration:b.executionGeneration,commandId:e.commandId,envelopeHash:e.envelopeHash,payloadRef:m.source.partsRef,sourceRef:m.source.sourceRef,partIndex:i+1,partCount:m.parts.length,byteOffset:offset,sourceBytes:m.source.sourceBytes,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash,mediaType:m.source.mediaType}))return fail();
  offset+=p.utf8Bytes;return{materialId:p.materialId,partIndex:p.partIndex,byteOffset:p.byteOffset,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash};
 });
 if(offset!==m.source.sourceBytes)return fail();
 return{manifestRef:ref,groups:[{kind:'INSTRUCTION',payloadRef:m.source.partsRef,sourceRef:m.source.sourceRef,sourceBytes:m.source.sourceBytes,contentHash:m.source.contentHash,mediaType:m.source.mediaType,parts}]};
}
