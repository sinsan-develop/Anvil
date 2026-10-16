import{AuthFailure}from'../access/repository.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{exactKeys}from'./work-plan-card.ts';
import type{SourceRef}from'../knowledge/knowledge-entry.ts';
/** 형식 검사일 뿐이다. 실제 원문·프로젝트·출처 종류 검증은 저장/조회 경로에서 수행한다. */
export function readDesignChangeSources(value:unknown):SourceRef[]{
 if(!Array.isArray(value)||value.length>200)throw new AuthFailure('DESIGN_CHANGE_SOURCE_INVALID',422);
 const seen=new Set<string>();
 for(const r of value){
  if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.kind!=='string'||!(r.kind==='DOCUMENT_VERSION'?exactKeys(r,['kind','id','version','contentHash'])&&isVersionRef({id:r.id,version:r.version,contentHash:r.contentHash}):['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(r.kind)&&exactKeys(r,['kind','id','contentHash'])&&isVersionRef({id:r.id,version:1,contentHash:r.contentHash})))throw new AuthFailure('DESIGN_CHANGE_SOURCE_INVALID',422);
  const key=canonicalJson(r);if(seen.has(key))throw new AuthFailure('DESIGN_CHANGE_SOURCE_DUPLICATED',422);seen.add(key);
 }
 return structuredClone(value)as SourceRef[];
}
