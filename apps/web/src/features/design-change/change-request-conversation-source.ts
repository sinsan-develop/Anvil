import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConversationView} from '../knowledge/conversation-api.ts';
import type {ChangeRequestBuffer} from './request-api.ts';
import {changeRequestSourceBindingMatches} from './change-request-document-source.ts';
/** 원문 GET/hash 확인 뒤 사용자의 명시 첨부만 수행한다. 저장/현재 지시 적용/Agent 전달이 아니다. */
export function attachChangeRequestConversationSource(current:ChangeRequestBuffer|null,expected:ChangeRequestBuffer,session:DocumentSession,view:ConversationView):ChangeRequestBuffer|null{
 const r=view?.sourceRef,m=view?.message;
 if(!changeRequestSourceBindingMatches(current,expected,session)||!r||Object.keys(r).sort().join(',')!=='contentHash,id,kind'||r.kind!=='CONVERSATION'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.id)||!/^[0-9a-f]{64}$/.test(r.contentHash)||!m||!['USER_MESSAGE','USER_INSTRUCTION'].includes(m.kind)||m.effectiveScope?.projectId!==current!.projectId||view.deliveryState!=='STORED'||current!.sourceRefs.length>=200||current!.sourceRefs.some(v=>['CONVERSATION','USER_INSTRUCTION'].includes(v.kind)&&v.id===r.id))return current;
 return {...current!,sourceRefs:[...current!.sourceRefs,{kind:m.kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION',id:r.id,contentHash:r.contentHash}],dirty:true,failure:null};
}
