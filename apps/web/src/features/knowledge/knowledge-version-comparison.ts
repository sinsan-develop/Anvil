import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledge,validateKnowledgeView,type KnowledgeView} from './api.ts';
export interface StoredKnowledgeComparison{before:KnowledgeView;after:KnowledgeView}
/** 선택한 보관 버전과 바로 앞 불변 버전만 조회한다. 최신/확정 효력·Agent 전달을 판정하지 않는다. */
export async function readKnowledgeVersionComparison(client:ApiClient,projectId:string,raw:KnowledgeView,active:()=>boolean):Promise<StoredKnowledgeComparison|null>{
 if(!active())return null;
 const after=structuredClone(raw);await validateKnowledgeView(after,projectId,after.ref);
 if(!after.supersedesRef)throw new ApiError('KNOWLEDGE_PREVIOUS_VERSION_UNAVAILABLE',422);
 if(!active())return null;
 const before=await readKnowledge(client,projectId,after.supersedesRef);
 if(!active())return null;
 if(before.entry.kind!==after.entry.kind)throw new ApiError('KNOWLEDGE_VERSION_COMPARISON_INVALID',422);
 return{before,after};
}
