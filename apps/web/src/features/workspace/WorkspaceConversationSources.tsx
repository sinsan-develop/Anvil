import {useEffect,useRef,useState} from 'react';
import {ApiClient} from '../../api/client.ts';
import {WorkspaceConversationReader,newWorkspaceConversationState} from './workspace-conversation-reader.ts';
import {ConversationSourceReadOnly} from './conversation-source-read-only.ts';

export function WorkspaceConversationSources({client,projectId,onAuthenticationLost}:{client:ApiClient;projectId:string;onAuthenticationLost:()=>void}){
 const [state,setState]=useState(newWorkspaceConversationState),[reader,setReader]=useState<WorkspaceConversationReader|null>(null);
 const authenticationLost=useRef(onAuthenticationLost);authenticationLost.current=onAuthenticationLost;
 useEffect(()=>{setState(newWorkspaceConversationState());const value=new WorkspaceConversationReader(client,projectId,setState,()=>authenticationLost.current());setReader(value);return()=>value.dispose();},[client,projectId]);
 const locked=!reader||state.pending;
 return <section aria-label="사용자 발언·지시 원문 조회"><h4>사용자 발언·지시 원문</h4>
  <p className="meta">프로젝트 공통 원문을 명시 선택해 읽습니다. 단계 세션·최신 지시 효력·임무 맥락 묶음과 실제 전달은 미연결입니다.</p>
  <button type="button" disabled={locked} onClick={()=>void reader?.list()}>사용자 대화 목록 조회</button>
  {state.pending?<p role="status">사용자 원문 조회 중</p>:null}{state.error?<p role="alert">{state.error.code} · 이전 원문은 표시하지 않습니다.</p>:null}
  {state.conversations?<><ul>{state.conversations.items.map(item=><li key={item.id}>대화 {item.id} · 관측 순번 {item.headSequence}<button type="button" disabled={locked} onClick={()=>void reader?.open(item.id)}>대화 발언 목록 열기: {item.id}</button></li>)}</ul>{!state.conversations.items.length?<p>조회된 프로젝트 대화 없음</p>:null}{state.conversations.hasMore?<button type="button" disabled={locked} onClick={()=>void reader?.list(state.conversations!.nextCursor)}>사용자 대화 다음 목록</button>:null}</>:null}
  {state.selectedConversation&&state.messages?<section aria-label="선택 대화 발언 목록"><p>대화 관측 순번 {state.selectedConversation.head} · 목록 순서와 현재 지시 효력은 별개입니다.</p><ul>{state.messages.items.map(item=><li key={item.sourceRef.id}>순번 {item.serverSequence} · {item.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'}<button type="button" disabled={locked} onClick={()=>void reader?.read(item.sourceRef)}>발언 원문 열기: {item.serverSequence}</button></li>)}</ul>{state.messages.hasMore?<button type="button" disabled={locked} onClick={()=>void reader?.open(state.selectedConversation!.id,state.messages!.nextCursor)}>대화 발언 다음 목록</button>:null}</section>:null}
  {state.source?<ConversationSourceReadOnly source={state.source}/>:null}
 </section>;
}
