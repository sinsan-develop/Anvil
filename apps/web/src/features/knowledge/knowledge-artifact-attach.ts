import {ApiError} from '../../api/client.ts';import type {DocumentSession} from '../design-trace/editor-api.ts';import type {DocumentAttachmentSelection} from '../design-trace/document-attachments.ts';import type {KnowledgeBuffer} from './api.ts';import type {KnowledgeArtifactSource} from './knowledge-artifact-source.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
function editable(b:KnowledgeBuffer,s:DocumentSession,pid:string){if(!b||![pid,s.user.id,s.clientId].every(v=>uuid.test(v))||b.projectId!==pid||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.pending||b.resultRef||b.uncertain)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');}
export function attachKnowledgeArtifact(b:KnowledgeBuffer,s:DocumentSession,selection:DocumentAttachmentSelection):KnowledgeBuffer{
 editable(b,s,selection.projectId);const a=selection.artifact;
 if(!a||!uuid.test(a.artifactId)||!hash.test(a.contentHash)||!Number.isSafeInteger(a.bytes)||a.bytes<0||a.bytes>2097152||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(a.mediaType))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 if(!Array.isArray(b.sourceRefs)||b.sourceRefs.length>=199)throw new ApiError('KNOWLEDGE_SOURCE_LIMIT');if(b.sourceRefs.some(r=>r.kind==='ARTIFACT'&&r.id===a.artifactId))throw new ApiError('KNOWLEDGE_SOURCE_DUPLICATE');
 return{...b,sourceRefs:[...b.sourceRefs,{kind:'ARTIFACT',id:a.artifactId,contentHash:a.contentHash}],dirty:true,failure:null};
}
export function detachKnowledgeArtifact(b:KnowledgeBuffer,s:DocumentSession,pid:string,source:KnowledgeArtifactSource):KnowledgeBuffer{
 editable(b,s,pid);if(!source||Object.keys(source).sort().join(',')!=='contentHash,id,kind'||source.kind!=='ARTIFACT'||!uuid.test(source.id)||!hash.test(source.contentHash))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 const matches=(r:KnowledgeBuffer['sourceRefs'][number])=>r.kind==='ARTIFACT'&&r.id===source.id&&r.contentHash===source.contentHash;
 if(b.sourceRefs.filter(matches).length!==1)throw new ApiError('KNOWLEDGE_SOURCE_INVALID');return{...b,sourceRefs:b.sourceRefs.filter(r=>!matches(r)),dirty:true,failure:null};
}
