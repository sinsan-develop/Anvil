import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient} from '../../api/client.ts';
import {WorkspaceConversationReader,newWorkspaceConversationState,type WorkspaceConversationState} from './workspace-conversation-reader.ts';
import {ConversationSourceReadOnly} from './conversation-source-read-only.ts';

import {InstructionPartsLookup} from '../knowledge/ConversationPanel.tsx';

type ConversationOwner={client:ApiClient;projectId:string;transport:typeof fetch;route:string|undefined;reader:WorkspaceConversationReader};
type ConversationScreen={owner:ConversationOwner;state:Readonly<WorkspaceConversationState>;revision:number};

export function WorkspaceConversationSources({client,projectId,onAuthenticationLost}:{client:ApiClient;projectId:string;onAuthenticationLost:()=>void}){
 const [screen,setScreen]=useState<ConversationScreen|null>(null);
 const owner=useRef<ConversationOwner|null>(null),authenticationLost=useRef(onAuthenticationLost);
 const transport=client.transport,route=globalThis.location?.hash;
 useLayoutEffect(()=>{authenticationLost.current=onAuthenticationLost;},[onAuthenticationLost]);
 useLayoutEffect(()=>{
  let revision=0;
  const current=()=>owner.current===scope&&client.transport===transport&&globalThis.location?.hash===route;
  const publish=(state:Readonly<WorkspaceConversationState>)=>{
   if(current())setScreen({owner:scope,state,revision:++revision});
  };
  const reader=new WorkspaceConversationReader(client,projectId,publish,()=>{if(current())authenticationLost.current();});
  const scope={client,projectId,transport,route,reader};
  owner.current=scope;publish(reader.state);
  return()=>{owner.current=null;reader.dispose();};
 },[client,projectId,transport,route]);
 const shown=screen?.owner.client===client&&screen.owner.projectId===projectId&&screen.owner.transport===transport&&screen.owner.route===route?screen:null;
 const reader=shown?.owner.reader,state=shown?.state??newWorkspaceConversationState(),source=state.source;
 const locked=!reader||state.pending;
 const active=()=>!!shown&&owner.current===shown.owner&&client.transport===transport&&globalThis.location?.hash===route&&
  shown.owner.reader.state.source===source&&!shown.owner.reader.state.pending;
 return <section aria-label="사용자 발언·지시 원문 조회"><h4>사용자 발언·지시 원문</h4>
  <p className="meta">프로젝트 공통 원문을 명시 선택해 읽습니다. 단계 세션·최신 지시 효력·임무 맥락 묶음과 실제 전달은 미연결입니다.</p>
  <button type="button" disabled={locked} onClick={()=>void reader?.list()}>사용자 대화 목록 조회</button>
  {state.pending?<p role="status">사용자 원문 조회 중</p>:null}{state.error?<p role="alert">{state.error.code} · 이전 원문은 표시하지 않습니다.</p>:null}
  {state.conversations?<><ul>{state.conversations.items.map(item=><li key={item.id}>대화 {item.id} · 관측 순번 {item.headSequence}<button type="button" disabled={locked} onClick={()=>void reader?.open(item.id)}>대화 발언 목록 열기: {item.id}</button></li>)}</ul>{!state.conversations.items.length?<p>조회된 프로젝트 대화 없음</p>:null}{state.conversations.hasMore?<button type="button" disabled={locked} onClick={()=>void reader?.list(state.conversations!.nextCursor)}>사용자 대화 다음 목록</button>:null}</>:null}
  {state.selectedConversation&&state.messages?<section aria-label="선택 대화 발언 목록"><p>대화 관측 순번 {state.selectedConversation.head} · 목록 순서와 현재 지시 효력은 별개입니다.</p><ul>{state.messages.items.map(item=><li key={item.sourceRef.id}>순번 {item.serverSequence} · {item.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'}<button type="button" disabled={locked} onClick={()=>void reader?.read(item.sourceRef)}>발언 원문 열기: {item.serverSequence}</button></li>)}</ul>{state.messages.hasMore?<button type="button" disabled={locked} onClick={()=>void reader?.open(state.selectedConversation!.id,state.messages!.nextCursor)}>대화 발언 다음 목록</button>:null}</section>:null}
  {source?<><ConversationSourceReadOnly source={source}/>
   {!locked&&shown&&source.message.kind==='USER_INSTRUCTION'&&source.conversationId===state.selectedConversation?.id?
    <InstructionPartsLookup key={shown.revision} client={client} projectId={projectId} conversationId={source.conversationId} view={source} active={active} onAuthenticationLost={()=>authenticationLost.current()}/>:null}
   {source.message.replyTo?<button type="button" disabled={locked} onClick={()=>void reader?.replyOriginal()}>답글의 원 발언 열기</button>:null}
   {source.message.kind==='USER_INSTRUCTION'&&source.message.supersedesInstructionRef?<button type="button" disabled={locked} onClick={()=>void reader?.previous()}>정정 전 사용자 지시 원문 열기</button>:null}</>:null}
 </section>;
}
