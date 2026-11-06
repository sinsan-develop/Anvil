import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {materialReject as reject,readMaterialScope,type MaterialScope} from './execution-material-registration-input.ts';
export interface StartMaterialPart {materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}
export interface StartMaterialSource {sourceRef:Ref;bodyRef:Ref;originRef:Ref;contentHash:string;sourceBytes:number;mediaType:'text/plain'|'application/json'}
export interface StartMaterialGroup {kind:'CONTEXT_BUNDLE'|'START_OPTIONS';payloadRef:Ref;source:StartMaterialSource;parts:StartMaterialPart[]}
export interface StartMaterialDescriptor {schemaVersion:1;purpose:'START_CONTEXT_OPTIONS_MATERIAL_V1';id:string;sourceKind:'SYNTHETIC_REFERENCE_ONLY_V1';scope:MaterialScope;commandId:string;payload:{contextBundleRef:Ref;optionsRef:Ref};groups:[StartMaterialGroup,StartMaterialGroup];expiresAt:string}
export interface PreparedStartMaterial {descriptor:StartMaterialDescriptor;manifestRef:Ref}
export const startMaterialHash=(v:unknown)=>contentHash(canonicalJson(v));
export const startMaterialSame=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
/** getter/Proxy를 실행하지 않고 닫힌 데이터만 복사한다. wire 문자열은 중복 JSON 키도 거절한다. */
function plain(v:unknown,active=new Set<object>(),depth=0):void {
 if(depth>64)return reject();if(v===null||typeof v!=='object')return;
 if(types.isProxy(v)||active.has(v))return reject();active.add(v);
 try {const p=Object.getPrototypeOf(v);if(Array.isArray(v)?p!==Array.prototype:p!==Object.prototype&&p!==null)return reject();
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(v))){if(Array.isArray(v)&&key==='length')continue;if(!d.enumerable||!('value'in d))return reject();plain(d.value,active,depth+1);}
 } finally{active.delete(v);}
}
export function readStartMaterialDescriptor(input:unknown):PreparedStartMaterial {
 try {
  plain(input);const raw=typeof input==='string'?parseWireJson(input):input;
  if(!recordV1(raw,['schemaVersion','purpose','id','sourceKind','scope','commandId','payload','groups','expiresAt'])||raw.schemaVersion!==1||raw.purpose!=='START_CONTEXT_OPTIONS_MATERIAL_V1'||!uuidV1(raw.id)||!uuidV1(raw.commandId)||raw.sourceKind!=='SYNTHETIC_REFERENCE_ONLY_V1'||!isoV1(raw.expiresAt)||Buffer.byteLength(canonicalJson(raw),'utf8')>2097152)return reject();
  readMaterialScope(raw.scope);
  const payload=raw.payload;if(!recordV1(payload,['contextBundleRef','optionsRef'])||!refV1(payload.contextBundleRef)||!refV1(payload.optionsRef)||startMaterialSame(payload.contextBundleRef,payload.optionsRef)||!arrayV1(raw.groups,2)||raw.groups.length!==2)return reject();
  const ids=new Set<string>();let totalBytes=0,totalParts=0;
  for(let index=0;index<2;index++){const g=raw.groups[index];
   const kind=index===0?'CONTEXT_BUNDLE':'START_OPTIONS',expected=index===0?payload.contextBundleRef:payload.optionsRef;
   if(!recordV1(g,['kind','payloadRef','source','parts'])||g.kind!==kind||!refV1(g.payloadRef)||!startMaterialSame(g.payloadRef,expected))return reject();
   const s=g.source;if(!recordV1(s,['sourceRef','bodyRef','originRef','contentHash','sourceBytes','mediaType'])||![s.sourceRef,s.bodyRef,s.originRef].every(refV1)||!hashV1(s.contentHash)||!positive(s.sourceBytes)||s.sourceBytes>2097152||!['text/plain','application/json'].includes(s.mediaType)||kind==='START_OPTIONS'&&s.mediaType!=='application/json'||!arrayV1(g.parts,200)||g.parts.length<1)return reject();
   totalBytes+=s.sourceBytes;totalParts+=g.parts.length;if(totalBytes>2097152||totalParts>200)return reject();
   let offset=0;for(let i=0;i<g.parts.length;i++){const p=g.parts[i];
    if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||ids.has(p.materialId)||p.partIndex!==i+1||p.byteOffset!==offset||!positive(p.utf8Bytes)||p.utf8Bytes>2097152||!hashV1(p.contentHash))return reject();
    ids.add(p.materialId);offset+=p.utf8Bytes;if(offset>s.sourceBytes)return reject();
   }if(offset!==s.sourceBytes)return reject();
  }
  const descriptor=cloneV1(raw) as unknown as StartMaterialDescriptor;
  return{descriptor,manifestRef:{id:descriptor.id,version:1,contentHash:startMaterialHash(descriptor)}};
 }catch{return reject();}
}
export function readPreparedStartMaterial(raw:unknown):PreparedStartMaterial{
 try {plain(raw);if(!recordV1(raw,['descriptor','manifestRef']))return reject();const p=readStartMaterialDescriptor(raw.descriptor);if(!startMaterialSame(p.manifestRef,raw.manifestRef))return reject();return p;}catch{return reject();}
}
