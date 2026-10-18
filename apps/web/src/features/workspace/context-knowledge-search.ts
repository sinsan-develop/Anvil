import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledge,searchKnowledge} from '../knowledge/api.ts';
import type {ContextSlotCode,ContextSourceSelection} from '../../../../server/modules/context/context-input.ts';
const filters={PURPOSE_REASON:'PURPOSE',RULES_SCOPE:'CONSTITUTION',DECISIONS_REASON:'DECISION',CURRENT_POSITION:'',ACTUAL_GAPS:'',NEXT_ACTION:''} as const;
interface Preview{selection:ContextSourceSelection;body:string;label:string}
interface Candidate{key:string;label:string;inspect:()=>Promise<Preview>}
/** 기존 제목·이유 검색만 소비하며 원문은 명시 inspect에서 고정버전으로 재조회한다. */
export async function loadContextKnowledgeCandidates(client:ApiClient,projectId:string,code:ContextSlotCode,query:string,cursor:string|null){
 if(!Object.hasOwn(filters,code))throw new ApiError('CONTEXT_SLOT_INVALID');
 if(typeof query!=='string'||query.length>200||!query.isWellFormed())throw new ApiError('CLIENT_PATH_INVALID');
 const normalized=query.trim(),filter=filters[code as keyof typeof filters],page=await searchKnowledge(client,projectId,normalized,filter,cursor);
 const items:Candidate[]=page.items.map(hit=>({key:hit.versionRef.id+':'+hit.versionRef.version,label:hit.title+' · '+hit.kind+' · '+hit.state,
  inspect:async()=>{const value=await readKnowledge(client,projectId,hit.versionRef);return{selection:{kind:'KNOWLEDGE_VERSION',versionRef:value.ref},body:value.body,label:value.entry.title+' · '+value.state+' · 의미 적합/효력 미확인'};}}));
 return{items,nextCursor:page.nextCursor,query:normalized};
}
