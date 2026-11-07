import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
export type MaterialScope={mode:'EXECUTION';projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number};
export interface MaterialDescriptor {schemaVersion:1;id:string;sourceKind:'SYNTHETIC_REFERENCE_ONLY_V1';scope:MaterialScope;commandId:string;source:{sourceRef:Ref;bodyRef:Ref;partsRef:Ref;originRef:Ref;contentHash:string;sourceBytes:number;mediaType:'text/plain'|'application/json'};parts:{materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}[];expiresAt:string}
export interface PreparedMaterial {descriptor:MaterialDescriptor;manifestRef:Ref}
export const materialHash=(v:unknown)=>contentHash(canonicalJson(v)),materialSame=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export const materialReject=(code='MATERIAL_REGISTRATION_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
const integer=(v:unknown,min=0)=>Number.isSafeInteger(v)&&Number(v)>=min;
export function readMaterialScope(raw:unknown):MaterialScope {
 if(!recordV1(raw,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||raw.mode!=='EXECUTION'||![raw.projectId,raw.connectorId,raw.executionId].every(uuidV1)||!integer(raw.executionGeneration,1)||!integer(raw.credentialGeneration,1)||!refV1(raw.grantRef))return materialReject();return cloneV1(raw) as MaterialScope;
}
/** 원문/경로/최종 envelope를 받지 않는 등록 전 정확 descriptor다. */
export function readMaterialDescriptor(raw:unknown):PreparedMaterial {
 if(!recordV1(raw,['schemaVersion','id','sourceKind','scope','commandId','source','parts','expiresAt'])||raw.schemaVersion!==1||!uuidV1(raw.id)||!uuidV1(raw.commandId)||raw.sourceKind!=='SYNTHETIC_REFERENCE_ONLY_V1'||!isoV1(raw.expiresAt)||Buffer.byteLength(canonicalJson(raw))>2097152)return materialReject();readMaterialScope(raw.scope);
 const s=raw.source;if(!recordV1(s,['sourceRef','bodyRef','partsRef','originRef','contentHash','sourceBytes','mediaType'])||![s.sourceRef,s.bodyRef,s.partsRef,s.originRef].every(refV1)||!hashV1(s.contentHash)||!integer(s.sourceBytes,1)||s.sourceBytes>2097152||typeof s.mediaType!=='string'||!['text/plain','application/json'].includes(s.mediaType)||!arrayV1(raw.parts,200)||raw.parts.length<1)return materialReject();
 let offset=0;const ids=new Set<string>();for(const [i,p] of raw.parts.entries()){if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||ids.has(p.materialId)||p.partIndex!==i+1||p.byteOffset!==offset||!integer(p.utf8Bytes,1)||p.utf8Bytes>2097152||!hashV1(p.contentHash))return materialReject();ids.add(p.materialId);offset+=p.utf8Bytes;if(offset>s.sourceBytes)return materialReject();}if(offset!==s.sourceBytes)return materialReject();
 const descriptor=cloneV1(raw) as unknown as MaterialDescriptor;return {descriptor,manifestRef:{id:descriptor.id,version:1,contentHash:materialHash(descriptor)}};
}
export function readPreparedMaterial(raw:unknown):PreparedMaterial {if(!recordV1(raw,['descriptor','manifestRef']))return materialReject();const plan=readMaterialDescriptor(raw.descriptor);if(!materialSame(plan.manifestRef,raw.manifestRef))return materialReject();return plan;}
export function assertMaterialCapacity(t:{projectCount:number;projectBytes:number;grantCount:number;grantBytes:number},addCount:number,addBytes:number){
 if(!recordV1(t,['projectCount','projectBytes','grantCount','grantBytes'])||![...Object.values(t),addCount,addBytes].every(v=>integer(v))||t.projectCount+addCount>100000||t.projectBytes+addBytes>1073741824||t.grantCount+addCount>10000||t.grantBytes+addBytes>67108864)return materialReject('MATERIAL_REGISTRATION_LIMIT');
}