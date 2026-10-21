import{ApiError}from'../../api/client.ts';import type{DocumentSession}from'../design-trace/editor-api.ts';import type{KnowledgeBuffer}from'./api.ts';import type{ConversationView}from'./conversation-api.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** ConversationPanel이 GET/hash 확인한 발언의 참조만 붙인다. 본문 대체·저장·Agent 전달은 하지 않는다. */
export function attachKnowledgeConversation(buffer:KnowledgeBuffer,session:DocumentSession,projectId:string,source:Pick<ConversationView,'sourceRef'|'message'>):KnowledgeBuffer{
 if(!buffer||![projectId,session.user.id,session.clientId].every(v=>uuid.test(v))||buffer.projectId!==projectId||buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||buffer.pending||buffer.resultRef||buffer.uncertain)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');
 const r=source?.sourceRef,m=source?.message;
 if(!r||Object.keys(r).sort().join(',')!=='contentHash,id,kind'||r.kind!=='CONVERSATION'||!uuid.test(r.id)||!/^[0-9a-f]{64}$/.test(r.contentHash)||!m||!['USER_MESSAGE','USER_INSTRUCTION'].includes(m.kind)||m.effectiveScope?.projectId!==projectId)throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 if(!Array.isArray(buffer.sourceRefs)||buffer.sourceRefs.length>=199)throw new ApiError('KNOWLEDGE_SOURCE_LIMIT');
 if(buffer.sourceRefs.some(v=>['CONVERSATION','USER_INSTRUCTION'].includes(v.kind)&&v.id===r.id))throw new ApiError('KNOWLEDGE_SOURCE_DUPLICATE');
 return{...buffer,sourceRefs:[...buffer.sourceRefs,{...r,kind:m.kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION'}],dirty:true,failure:null};
}
/** 현재 미저장 초안의 참조만 해제한다. 대화 원문·지식 본문·저장 이력은 삭제하지 않는다. */
export function detachKnowledgeConversation(buffer:KnowledgeBuffer,session:DocumentSession,projectId:string,source:KnowledgeBuffer['sourceRefs'][number]):KnowledgeBuffer{
 if(!buffer||![projectId,session.user.id,session.clientId].every(v=>uuid.test(v))||buffer.projectId!==projectId||buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||buffer.pending||buffer.resultRef||buffer.uncertain)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');
 if(!source||Object.keys(source).sort().join(',')!=='contentHash,id,kind'||!['CONVERSATION','USER_INSTRUCTION'].includes(source.kind)||!uuid.test(source.id)||!/^[0-9a-f]{64}$/.test(source.contentHash))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 const matches=(r:KnowledgeBuffer['sourceRefs'][number])=>r.kind===source.kind&&r.id===source.id&&r.contentHash===source.contentHash;
 if(!Array.isArray(buffer.sourceRefs)||buffer.sourceRefs.filter(matches).length!==1)throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 return{...buffer,sourceRefs:buffer.sourceRefs.filter(r=>!matches(r)),dirty:true,failure:null};
}
