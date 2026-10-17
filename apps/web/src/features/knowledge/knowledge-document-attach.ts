import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeBuffer} from './api.ts';
import type {KnowledgeDocumentSource} from './knowledge-document-source.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** 저장을 실행하지 않고 현재 소유 초안에 검증된 참조만 추가한다. */
export function attachKnowledgeDocument(buffer:KnowledgeBuffer,session:DocumentSession,projectId:string,source:KnowledgeDocumentSource):KnowledgeBuffer{
 if(!buffer||![projectId,session.user.id,session.clientId].every(v=>uuid.test(v))||buffer.projectId!==projectId||buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||buffer.pending||buffer.resultRef||buffer.uncertain)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');
 if(!source||Object.keys(source).sort().join(',')!=='contentHash,id,kind,version'||source.kind!=='DOCUMENT_VERSION'||!uuid.test(source.id)||!Number.isSafeInteger(source.version)||source.version<1||!/^[0-9a-f]{64}$/.test(source.contentHash))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 if(!Array.isArray(buffer.sourceRefs)||buffer.sourceRefs.length>=199)throw new ApiError('KNOWLEDGE_SOURCE_LIMIT');
 if(buffer.sourceRefs.some(r=>r.kind==='DOCUMENT_VERSION'&&r.id===source.id&&r.version===source.version))throw new ApiError('KNOWLEDGE_SOURCE_DUPLICATE');
 return{...buffer,sourceRefs:[...buffer.sourceRefs,{...source}],dirty:true,failure:null};
}
