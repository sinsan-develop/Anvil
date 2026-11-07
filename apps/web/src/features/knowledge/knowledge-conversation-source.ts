import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledge,type KnowledgeView} from './api.ts';
import {readConversationMessage} from './conversation-api.ts';
export interface KnowledgeConversationSelection{projectId:string;userId:string;clientId:string;knowledgeRef:KnowledgeView['ref'];source:{kind:'CONVERSATION'|'USER_INSTRUCTION';id:string;contentHash:string};conversationId:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
/** 대화방은 사용자가 고른다. 고정 출처만 열며 현재 지시 효력·Agent 전달 여부를 추정하지 않는다. */
export async function readKnowledgeConversationSource(client:ApiClient,selection:KnowledgeConversationSelection,active:()=>boolean){
 const r=selection?.knowledgeRef,s=selection?.source;
 if(!selection||![selection.projectId,selection.userId,selection.clientId,selection.conversationId].every(v=>typeof v==='string'&&uuid.test(v))||!r||!uuid.test(r.id)||!Number.isSafeInteger(r.version)||r.version<1||!hash.test(r.contentHash)||!s||Object.keys(s).sort().join(',')!=='contentHash,id,kind'||!['CONVERSATION','USER_INSTRUCTION'].includes(s.kind)||!uuid.test(s.id)||!hash.test(s.contentHash))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 const selected=structuredClone(selection),check=()=>{if(!active())throw new ApiError('KNOWLEDGE_SOURCE_PAUSED');};check();
 const knowledge=await readKnowledge(client,selected.projectId,selected.knowledgeRef);check();
 if(knowledge.entry.sourceRefs.filter(v=>v.kind===selected.source.kind&&v.id===selected.source.id&&v.contentHash===selected.source.contentHash).length!==1)throw new ApiError('KNOWLEDGE_SOURCE_CHANGED');
 const value=await readConversationMessage(client,selected.projectId,selected.conversationId,{...selected.source,kind:'CONVERSATION'});check();
 if(selected.source.kind==='USER_INSTRUCTION'&&value.message.kind!=='USER_INSTRUCTION')throw new ApiError('KNOWLEDGE_SOURCE_CHANGED');
 return value;
}
