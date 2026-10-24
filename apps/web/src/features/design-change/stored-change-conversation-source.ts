import {ApiClient,ApiError} from '../../api/client.ts';
import {readDesignChange} from './api.ts';
import {readConversationMessage} from '../knowledge/conversation-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
export interface ChangeConversationSelection{projectId:string;userId:string;clientId:string;changeRef:PlanRef;source:{kind:'CONVERSATION'|'USER_INSTRUCTION';id:string;contentHash:string};conversationId:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
/** 출처에 없는 대화방 ID는 사용자가 목록에서 선택한다. 새 endpoint/자동 검색/최신 원문 대체 없음. */
export async function readStoredChangeConversationSource(client:ApiClient,selection:ChangeConversationSelection,active:()=>boolean){
 const r=selection?.changeRef,s=selection?.source;
 if(!selection||![selection.projectId,selection.userId,selection.clientId,selection.conversationId].every(v=>typeof v==='string'&&uuid.test(v))||!r||Object.keys(r).sort().join(',')!=='contentHash,id,version'||!uuid.test(r.id)||r.version!==1||!hash.test(r.contentHash)||!s||Object.keys(s).sort().join(',')!=='contentHash,id,kind'||!['CONVERSATION','USER_INSTRUCTION'].includes(s.kind)||!uuid.test(s.id)||!hash.test(s.contentHash))throw new ApiError('DESIGN_CHANGE_SOURCE_INVALID');
 const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('DESIGN_CHANGE_SOURCE_PAUSED');};check();
 const page=await readDesignChange(client,chosen.projectId,chosen.changeRef.id,null);check();
 if(page.change.ref.version!==chosen.changeRef.version||page.change.ref.contentHash!==chosen.changeRef.contentHash||page.change.sourceRefs.filter(v=>v.kind===chosen.source.kind&&v.id===chosen.source.id&&v.contentHash===chosen.source.contentHash).length!==1)throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');
 const result=await readConversationMessage(client,chosen.projectId,chosen.conversationId,{kind:'CONVERSATION',id:chosen.source.id,contentHash:chosen.source.contentHash});check();
 if(chosen.source.kind==='USER_INSTRUCTION'&&result.message.kind!=='USER_INSTRUCTION')throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');return result;
}
