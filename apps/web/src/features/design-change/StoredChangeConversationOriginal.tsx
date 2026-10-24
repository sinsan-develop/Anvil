import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {listConversations,type ConversationSummary} from '../knowledge/conversation-api.ts';
import {readStoredChangeConversationSource,type ChangeConversationSelection} from './stored-change-conversation-source.ts';
export type ChangeConversationSourceSelection=Omit<ChangeConversationSelection,'conversationId'>;
function Message({client,selection,onAuthenticationLost}:{client:ApiClient;selection:ChangeConversationSelection;onAuthenticationLost:()=>void}){
 const[value,setValue]=useState<Awaited<ReturnType<typeof readStoredChangeConversationSource>>|null>(null),[error,setError]=useState<ApiError|null>(null);
 useEffect(()=>{let active=true;readStoredChangeConversationSource(client,selection,()=>active).then(v=>{if(active)setValue(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
 return error?<p role="alert">{error.message} · {error.code} · 원문을 채택하지 않았습니다. 다른 대화방 여부와 접근 권한을 확인하세요.</p>:value?<><p>{value.message.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'} · 기록 {new Date(value.recordedAt).toLocaleString('ko-KR')} · 순번 {value.serverSequence}</p><pre aria-label="변경 근거 대화 원문">{value.body}</pre><p className="meta">저장된 발언 원문 · 현재 지시 효력/최신성·Agent 전달은 미확인</p></>:<p role="status">고정 대화 출처 확인 중</p>;
}
/** 출처에 대화방 ID가 없으므로 사람이 목록에서 선택한다. 자동 전체검색·쓰기·원문 대체 없음. */
export function StoredChangeConversationOriginal({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:ChangeConversationSourceSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
 const[page,setPage]=useState<{items:ConversationSummary[];hasMore:boolean;nextCursor:string|null}|null>(null),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<ApiError|null>(null),[chosen,setChosen]=useState<{selection:ChangeConversationSelection;nonce:number}|null>(null);
 useEffect(()=>{let active=true;setLoading(true);setPage(null);setError(null);listConversations(client,selection.projectId,cursor).then(v=>{if(active)setPage(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[client,selection,cursor]);
 return <section className="status-card" aria-label="변경 대화 출처 원문"><h3>대화·지시 출처 원문</h3><button type="button" onClick={onClose}>변경 대화 출처 닫기</button><p className="meta">변경 요청 v{selection.changeRef.version} · 발언 {selection.source.id} · SHA256 {selection.source.contentHash}</p><p>원문이 속한 대화방을 선택하세요. 출처에 대화방 ID가 없어 자동으로 검색하거나 최신 발언으로 대체하지 않습니다.</p>
 {loading?<p role="status">출처 대화 목록 조회 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
 {page?<><ul>{page.items.map(c=><li key={c.id}><span>{new Date(c.updatedAt).toLocaleString('ko-KR')} · {c.headSequence}개 발언</span><button type="button" onClick={()=>setChosen(old=>({nonce:(old?.nonce??0)+1,selection:{...structuredClone(selection),conversationId:c.id}}))}>대화 {c.id}에서 원문 확인</button></li>)}</ul>{!page.items.length?<p>이 페이지에 조회 가능한 대화가 없습니다.</p>:null}{page.hasMore?<button type="button" disabled={loading} onClick={()=>{setChosen(null);setCursor(page.nextCursor);}}>출처 대화 목록 다음 페이지</button>:null}{cursor?<button type="button" disabled={loading} onClick={()=>{setChosen(null);setCursor(null);}}>출처 대화 목록 처음으로</button>:null}</>:null}
 {chosen?<Message key={chosen.nonce} client={client} selection={chosen.selection} onAuthenticationLost={onAuthenticationLost}/>:null}
 </section>;
}
