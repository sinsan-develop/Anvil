import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeCorrectionBuffer} from './correction-api.ts';
import type {KnowledgeDocumentSource} from './knowledge-document-source.ts';
import type {KnowledgeArtifactSource} from './knowledge-artifact-source.ts';
import type {DocumentAttachmentSelection} from '../design-trace/document-attachments.ts';
import type {KnowledgeEntry,TextArtifactRef} from '../../../../server/modules/knowledge/knowledge-entry.ts';
import {ordered} from './review-view.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=(code:string):never=>{throw new ApiError(code);};
function source(v:any):v is KnowledgeDocumentSource{return v&&Object.keys(v).sort().join(',')==='contentHash,id,kind,version'&&v.kind==='DOCUMENT_VERSION'&&uuid.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);}
function added(b:KnowledgeCorrectionBuffer):KnowledgeDocumentSource[]{
 const refs=b.additionalDocumentSources??[],old=b.target?.entry?.sourceRefs;
 if(!Array.isArray(refs)||refs.length>199||!refs.every(source)||!Array.isArray(old))return fail('KNOWLEDGE_SOURCE_INVALID');
 const seen=new Set<string>();for(const r of refs){const key=r.id+':'+r.version;if(seen.has(key)||old.some(v=>v.kind==='DOCUMENT_VERSION'&&v.id===r.id&&v.version===r.version))return fail('KNOWLEDGE_SOURCE_DUPLICATE');seen.add(key);}
 return refs;
}
function artifacts(b:KnowledgeCorrectionBuffer):KnowledgeArtifactSource[]{
 const refs=b.additionalArtifactSources??[];
 if(!Array.isArray(refs)||refs.length>199||refs.some(r=>!r||Object.keys(r).sort().join(',')!=='contentHash,id,kind'||r.kind!=='ARTIFACT'||!uuid.test(r.id)||!/^([a-f0-9]{64})$/.test(r.contentHash)))return fail('KNOWLEDGE_SOURCE_INVALID');
 const seen=new Set<string>();for(const r of refs){if(seen.has(r.id)||r.id===b.target.entry.contentRef.artifactId||b.target.entry.sourceRefs.some(old=>old.kind==='ARTIFACT'&&old.id===r.id))return fail('KNOWLEDGE_SOURCE_DUPLICATE');seen.add(r.id);}return refs;
}
export function knowledgeCorrectionSourceRefs(b:KnowledgeCorrectionBuffer,fresh?:TextArtifactRef):KnowledgeEntry['sourceRefs']{
 const old=b.target.entry.contentRef;
 const refs:KnowledgeEntry['sourceRefs']=[...b.target.entry.sourceRefs,...added(b),...artifacts(b),{kind:'ARTIFACT',id:old.artifactId,contentHash:old.contentHash},...(fresh?[{kind:'ARTIFACT' as const,id:fresh.artifactId,contentHash:fresh.contentHash}]:[])];
 return[...new Map(refs.map(r=>[ordered(r),structuredClone(r)])).values()];
}
function editable(b:KnowledgeCorrectionBuffer,s:DocumentSession,pid:string){
 if(!b||![pid,s.user.id,s.clientId].every(v=>uuid.test(v))||b.projectId!==pid||b.target?.entry?.scope?.projectId!==pid||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.pending||b.savedRef||b.uncertain)fail('KNOWLEDGE_SOURCE_LOCKED');
 added(b);artifacts(b);
}
/** Local only. Old target/entry references are immutable and cannot be detached here. */
export function attachKnowledgeCorrectionDocument(b:KnowledgeCorrectionBuffer,s:DocumentSession,pid:string,selected:KnowledgeDocumentSource):KnowledgeCorrectionBuffer{
 editable(b,s,pid);if(!source(selected))return fail('KNOWLEDGE_SOURCE_INVALID');
 const next={...b,additionalDocumentSources:[...added(b),{...selected}],dirty:true,failure:null};
 if(knowledgeCorrectionSourceRefs(next).length>=200)return fail('KNOWLEDGE_SOURCE_LIMIT');return next;
}
export function detachKnowledgeCorrectionDocument(b:KnowledgeCorrectionBuffer,s:DocumentSession,pid:string,selected:KnowledgeDocumentSource):KnowledgeCorrectionBuffer{
 editable(b,s,pid);if(!source(selected))return fail('KNOWLEDGE_SOURCE_INVALID');
 const current=added(b),matches=(r:KnowledgeDocumentSource)=>ordered(r)===ordered(selected);
 if(current.filter(matches).length!==1)return fail('KNOWLEDGE_SOURCE_INVALID');
 return{...b,additionalDocumentSources:current.filter(r=>!matches(r)),dirty:true,failure:null};
}
export function attachKnowledgeCorrectionArtifact(b:KnowledgeCorrectionBuffer,s:DocumentSession,selection:DocumentAttachmentSelection):KnowledgeCorrectionBuffer{
 editable(b,s,selection.projectId);const a=selection.artifact;
 if(!a||!uuid.test(a.artifactId)||!Number.isSafeInteger(a.bytes)||a.bytes<0||a.bytes>2097152||!/^([a-f0-9]{64})$/.test(a.contentHash)||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(a.mediaType))return fail('KNOWLEDGE_SOURCE_INVALID');
 const next={...b,additionalArtifactSources:[...artifacts(b),{kind:'ARTIFACT' as const,id:a.artifactId,contentHash:a.contentHash}],dirty:true,failure:null};
 if(knowledgeCorrectionSourceRefs(next).length>=200)return fail('KNOWLEDGE_SOURCE_LIMIT');return next;
}
export function detachKnowledgeCorrectionArtifact(b:KnowledgeCorrectionBuffer,s:DocumentSession,pid:string,selected:KnowledgeArtifactSource):KnowledgeCorrectionBuffer{
 editable(b,s,pid);const current=artifacts(b),matches=(r:KnowledgeArtifactSource)=>ordered(r)===ordered(selected);
 if(current.filter(matches).length!==1)return fail('KNOWLEDGE_SOURCE_INVALID');return{...b,additionalArtifactSources:current.filter(r=>!matches(r)),dirty:true,failure:null};
}
