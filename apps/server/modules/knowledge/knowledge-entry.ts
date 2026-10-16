import {AuthFailure} from '../access/repository.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';

export interface TextArtifactRef{artifactId:string;bytes:number;contentHash:string;mediaType:string}
export type SourceRef={kind:'ARTIFACT'|'CONVERSATION'|'USER_INSTRUCTION';id:string;contentHash:string}|{kind:'DOCUMENT_VERSION';id:string;version:number;contentHash:string};
export interface KnowledgeEntry{kind:'PURPOSE'|'CONSTITUTION'|'DECISION'|'FACT'|'HYPOTHESIS'|'FAILURE_SOLUTION'|'CAUTION';title:string;contentRef:TextArtifactRef;sourceRefs:SourceRef[];reason:string;scope:{projectId:string;stageRefs:never[];taskRefs:never[]};relatedRefs:never[]}
export function exact(value:unknown,keys:string[]):value is Record<string,unknown>{return!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
export function uuid(value:unknown):value is string{return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);}
export function textArtifact(value:unknown):value is TextArtifactRef{return exact(value,['artifactId','bytes','contentHash','mediaType'])&&uuid(value.artifactId)&&Number.isSafeInteger(value.bytes)&&Number(value.bytes)>=0&&Number(value.bytes)<=2*1024*1024&&typeof value.contentHash==='string'&&/^[0-9a-f]{64}$/.test(value.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(String(value.mediaType));}
// 알려진 표식의 보수적 차단이다. 모든 비밀 탐지나 안전 판정으로 사용하지 않는다.
export function assertKnowledgeTextSafe(text:string){
  if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i.test(text))throw new AuthFailure('KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED',412);
}
export function readKnowledgeEntry(value:unknown,pid:string):KnowledgeEntry{
  if(!exact(value,['kind','title','contentRef','sourceRefs','reason','scope','relatedRefs'])||!['PURPOSE','CONSTITUTION','DECISION','FACT','HYPOTHESIS','FAILURE_SOLUTION','CAUTION'].includes(String(value.kind))||typeof value.title!=='string'||!value.title.trim()||value.title.length>200||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>20000||!textArtifact(value.contentRef)||!Array.isArray(value.sourceRefs)||value.sourceRefs.length>200||!exact(value.scope,['projectId','stageRefs','taskRefs'])||value.scope.projectId!==pid||!Array.isArray(value.scope.stageRefs)||!Array.isArray(value.scope.taskRefs)||!Array.isArray(value.relatedRefs))throw new AuthFailure('KNOWLEDGE_INPUT_INVALID',422);
  if(value.scope.stageRefs.length||value.scope.taskRefs.length||value.relatedRefs.length)throw new AuthFailure('KNOWLEDGE_REFERENCE_NOT_READY',412);
  const seen=new Set<string>();for(const r of value.sourceRefs){
    if(!r||typeof r!=='object'||Array.isArray(r))throw new AuthFailure('KNOWLEDGE_SOURCE_INVALID',422);
    if(!(['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(r.kind)&&exact(r,['kind','id','contentHash'])&&uuid(r.id)&&typeof r.contentHash==='string'&&/^[0-9a-f]{64}$/.test(r.contentHash)||r.kind==='DOCUMENT_VERSION'&&exact(r,['kind','id','version','contentHash'])&&isVersionRef({id:r.id,version:r.version,contentHash:r.contentHash})))throw new AuthFailure('KNOWLEDGE_SOURCE_INVALID',422);
    const key=canonicalJson(r);if(seen.has(key))throw new AuthFailure('KNOWLEDGE_SOURCE_DUPLICATED',422);seen.add(key);
  }
  return structuredClone(value) as unknown as KnowledgeEntry;
}
