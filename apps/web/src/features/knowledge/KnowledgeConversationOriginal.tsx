import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {listConversations,type ConversationSummary,type ConversationView} from './conversation-api.ts';
import {readKnowledgeConversationSource,type KnowledgeConversationSelection} from './knowledge-conversation-source.ts';
export type KnowledgeConversationSourceSelection=Omit<KnowledgeConversationSelection,'conversationId'>;
export type OpenKnowledgeConversation=(selection:KnowledgeConversationSelection,value:ConversationView)=>void;
function Message({client,selection,onAuthenticationLost,onOpenConversation}:{client:ApiClient;selection:KnowledgeConversationSelection;onAuthenticationLost:()=>void;onOpenConversation?:OpenKnowledgeConversation}){
 const[value,setValue]=useState<Awaited<ReturnType<typeof readKnowledgeConversationSource>>|null>(null),[error,setError]=useState<ApiError|null>(null);
 const alive=useRef(true),flight=useRef<object|null>(null),[moving,setMoving]=useState(false),owner=useRef({client,transport:client.transport,selection});
 if(owner.current.client!==client||owner.current.transport!==client.transport||owner.current.selection!==selection)owner.current={client,transport:client.transport,selection};
 const observed=owner.current,current=()=>alive.current&&owner.current===observed&&client.transport===observed.transport;
 useEffect(()=>{alive.current=true;setValue(null);setError(null);readKnowledgeConversationSource(client,selection,current).then(v=>{if(current())setValue(v);}).catch(cause=>{if(!current())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();});return()=>{alive.current=false;flight.current=null;};},[observed]);
 async function open(){
  if(!value||error||!onOpenConversation||flight.current||!current())return;const token={};flight.current=token;setMoving(true);
  const active=()=>current()&&flight.current===token;
  try{const original=await readKnowledgeConversationSource(client,selection,active);if(active())onOpenConversation(structuredClone(selection),original);}
  catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setValue(null);setError(e);if(e.status===401)onAuthenticationLost();}
  finally{if(flight.current===token){flight.current=null;if(current())setMoving(false);}}
 }
 return error?<p role="alert">{error.message} · {error.code} · 원문을 채택하지 않았습니다. 다른 대화방 여부와 접근 권한을 확인하세요.</p>:value?<><p>{value.message.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'} · 기록 {new Date(value.recordedAt).toLocaleString('ko-KR')} · 순번 {value.serverSequence}</p><pre aria-label="출처 대화 원문">{value.body}</pre>{onOpenConversation?<button type="button" disabled={moving} onClick={()=>void open()}>이 원발언의 대화 열기</button>:null}<p className="meta">저장된 발언 원문 · 현재 지시 효력/최신성·Agent 전달은 미확인</p></>:<p role="status">고정 대화 출처 확인 중</p>;
}
/** 출처에 대화방 ID가 없으므로 사람이 목록에서 선택한다. 자동 전체검색·쓰기·원문 대체 없음. */
export function KnowledgeConversationOriginal({client,selection,onClose,onAuthenticationLost,onOpenConversation}:{client:ApiClient;selection:KnowledgeConversationSourceSelection;onClose:()=>void;onAuthenticationLost:()=>void;onOpenConversation?:OpenKnowledgeConversation}){
 const[page,setPage]=useState<{items:ConversationSummary[];hasMore:boolean;nextCursor:string|null}|null>(null),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<ApiError|null>(null),[chosen,setChosen]=useState<{selection:KnowledgeConversationSelection;nonce:number}|null>(null);
 useEffect(()=>{let active=true;setLoading(true);setPage(null);setError(null);listConversations(client,selection.projectId,cursor).then(v=>{if(active)setPage(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[client,selection,cursor]);
 return <section className="status-card" aria-label="지식 대화 출처 원문"><h3>대화·지시 출처 원문</h3><button type="button" onClick={onClose}>대화 출처 원문 닫기</button><p className="meta">지식 v{selection.knowledgeRef.version} · 발언 {selection.source.id} · SHA256 {selection.source.contentHash}</p><p>원문이 속한 대화방을 선택하세요. 출처에 대화방 ID가 없어 자동으로 검색하거나 최신 발언으로 대체하지 않습니다.</p>
 {loading?<p role="status">출처 대화 목록 조회 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
 {page?<><ul>{page.items.map(c=><li key={c.id}><span>{new Date(c.updatedAt).toLocaleString('ko-KR')} · {c.headSequence}개 발언</span><button type="button" onClick={()=>setChosen(old=>({nonce:(old?.nonce??0)+1,selection:{...structuredClone(selection),conversationId:c.id}}))}>대화 {c.id}에서 원문 확인</button></li>)}</ul>{!page.items.length?<p>이 페이지에 조회 가능한 대화가 없습니다.</p>:null}{page.hasMore?<button type="button" disabled={loading} onClick={()=>{setChosen(null);setCursor(page.nextCursor);}}>출처 대화 목록 다음 페이지</button>:null}{cursor?<button type="button" disabled={loading} onClick={()=>{setChosen(null);setCursor(null);}}>출처 대화 목록 처음으로</button>:null}</>:null}
 {chosen?<Message key={chosen.nonce} client={client} selection={chosen.selection} onAuthenticationLost={onAuthenticationLost} onOpenConversation={onOpenConversation}/>:null}
 </section>;
}
