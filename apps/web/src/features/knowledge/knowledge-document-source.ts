import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledge,type KnowledgeView} from './api.ts';
import {readDocument} from '../design-trace/api.ts';
export type KnowledgeDocumentSource=Extract<KnowledgeView['entry']['sourceRefs'][number],{kind:'DOCUMENT_VERSION'}>;
export interface KnowledgeDocumentSelection{projectId:string;userId:string;clientId:string;knowledgeRef:KnowledgeView['ref'];source:KnowledgeDocumentSource}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const ref=(r:KnowledgeView['ref'])=>r&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&hash.test(r.contentHash);
/** 현재 지식의 정확 출처 귀속을 다시 확인하는 조회만. caller는 주체/보기 변경 시 active를 닫는다. */
export async function readKnowledgeDocumentSource(client:ApiClient,selection:KnowledgeDocumentSelection,active:()=>boolean){
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(v=>uuid.test(v))||!ref(selection.knowledgeRef)||selection.source?.kind!=='DOCUMENT_VERSION'||!ref(selection.source))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 const selected=structuredClone(selection),check=()=>{if(!active())throw new ApiError('KNOWLEDGE_SOURCE_PAUSED');};check();
 const knowledge=await readKnowledge(client,selected.projectId,selected.knowledgeRef);check();const source=selected.source;
 if(knowledge.entry.sourceRefs.filter(r=>r.kind==='DOCUMENT_VERSION'&&r.id===source.id&&r.version===source.version&&r.contentHash===source.contentHash).length!==1)throw new ApiError('KNOWLEDGE_SOURCE_CHANGED');
 const value=await readDocument(client,selected.projectId,source.id,source.version,{active});check();if(value.document.contentHash!==source.contentHash)throw new ApiError('KNOWLEDGE_SOURCE_CHANGED');return value;
}
