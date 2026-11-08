import {types} from 'node:util';
import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {SourceRef} from '../knowledge/knowledge-entry.ts';
export type {SourceRef};
const invalid=():never=>{throw new AuthFailure('DOCUMENT_SOURCE_INVALID',422);};
/** getter/Proxy를 실행하지 않고 요청 시점의 자료 사본을 고정한다. 권한 증명이 아니다. */
export function documentSourceSnapshot<T>(raw:T):T{
 const active=new Set<object>();
 const check=(value:unknown,depth:number):void=>{
  if(depth>64)invalid();
  if(value===null||typeof value!=='object')return;
  if(types.isProxy(value)||active.has(value))invalid();
  const proto=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null)invalid();
  active.add(value);
  try{
   const descriptors=Object.getOwnPropertyDescriptors(value);
   for(const property of Object.values(descriptors)){
    if(!('value'in property))invalid();check(property.value,depth+1);
   }
  }finally{active.delete(value);}
 };
 check(raw,0);
 try{return JSON.parse(canonicalJson(raw)) as T;}catch{ return invalid(); }
}
export function readDocumentSourceRefs(raw:unknown):SourceRef[]{
 const value=documentSourceSnapshot(raw);
 if(!Array.isArray(value)||value.length>200)return invalid();
 const seen=new Set<string>();
 for(const ref of value){
  if(!ref||typeof ref!=='object'||Array.isArray(ref))invalid();
  const keys=Object.keys(ref).sort().join(','),versioned=ref.kind==='DOCUMENT_VERSION';
  if(versioned?keys!=='contentHash,id,kind,version'||!isVersionRef({id:ref.id,version:ref.version,contentHash:ref.contentHash})
   :keys!=='contentHash,id,kind'||!['USER_INSTRUCTION','CONVERSATION','ARTIFACT'].includes(ref.kind)||!isVersionRef({id:ref.id,version:1,contentHash:ref.contentHash}))invalid();
  const key=canonicalJson(ref);if(seen.has(key))throw new AuthFailure('DOCUMENT_SOURCE_DUPLICATED',422);seen.add(key);
 }
 return value as SourceRef[];
}
