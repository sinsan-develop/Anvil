import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeCorrectionBuffer,KnowledgeCorrectionChange} from './correction-api.ts';
import {listConversations,listConversationMessages,readConversationMessage,type ConversationSummary,type MessageSummary,type ConversationView} from './conversation-api.ts';
import type {MessageRef} from '../../../../server/modules/knowledge/conversation-input.ts';
import {attachKnowledgeCorrectionConversation,detachKnowledgeCorrectionConversation} from './knowledge-correction-sources.ts';
type Data={buffer:KnowledgeCorrectionBuffer;conversations:ConversationSummary[];conversationNext:string|null;cid:string|null;messages:MessageSummary[];messageNext:string|null;view:ConversationView|null};
export function KnowledgeCorrectionConversationSources({client,session,buffer,disabled,isLocked,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeCorrectionBuffer;disabled:boolean;isLocked:()=>boolean;onChange:(value:KnowledgeCorrectionChange)=>void;onAuthenticationLost:()=>void}){
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),alive=useRef(true),sequence=useRef(0),latest=useRef(buffer),frozenRef=useRef(false);latest.current=buffer;
 const frozen=disabled||!!buffer.pending||!!buffer.savedRef||buffer.uncertain;frozenRef.current=frozen;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 const shown=data?.buffer===buffer?data:null;
 function failed(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('KNOWLEDGE_SOURCE_INVALID');setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'KNOWLEDGE_SOURCE_INVALID');if(e.status===401)onAuthenticationLost();}
 function close(){sequence.current++;setData(null);setError(null);setBusy(false);}
 async function load(kind:'CONVERSATIONS'|'MESSAGES'|'ORIGINAL',cid:string|null=null,cursor:string|null=null,ref?:MessageRef){
  if(frozen||busy||isLocked())return;const captured=buffer,id=++sequence.current,prior=shown;setBusy(true);setError(null);setData(prior?{...prior,view:null}:null);
  const active=()=>alive.current&&sequence.current===id&&latest.current===captured&&!frozenRef.current&&!isLocked();
  try{
   const next:Data=prior?{...prior,view:null}:{buffer:captured,conversations:[],conversationNext:null,cid:null,messages:[],messageNext:null,view:null};
   if(kind==='CONVERSATIONS'){const page=await listConversations(client,captured.projectId,cursor);if(!active())return;next.conversations=cursor?[...new Map([...next.conversations,...page.items].map(v=>[v.id,v])).values()]:page.items;next.conversationNext=page.nextCursor;next.cid=null;next.messages=[];next.messageNext=null;}
   else if(kind==='MESSAGES'&&cid){const page=await listConversationMessages(client,captured.projectId,cid,cursor);if(!active())return;next.cid=cid;next.messages=cursor&&prior?.cid===cid?[...new Map([...next.messages,...page.items].map(v=>[v.sourceRef.id,v])).values()]:page.items;next.messageNext=page.nextCursor;}
   else if(kind==='ORIGINAL'&&cid&&ref){const value=await readConversationMessage(client,captured.projectId,cid,structuredClone(ref));if(!active())return;next.cid=cid;next.view=value;}
   else throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
   if(active())setData(next);
  }catch(cause){if(active()){setData(null);failed(cause);}}finally{if(alive.current&&sequence.current===id)setBusy(false);}
 }
 function change(next:()=>KnowledgeCorrectionBuffer){if(!alive.current||frozen||isLocked()||latest.current!==buffer)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');const value=next(),expected=buffer;onChange(current=>current===expected?value:current);setError(null);}
 return <section aria-label="지식 정정 발언 근거"><h4>이번 정정에 추가할 사용자 발언·지시 근거</h4><button type="button" disabled={frozen||busy} onClick={()=>void load('CONVERSATIONS')}>정정 근거 대화 선택</button>
  {(buffer.additionalConversationSources??[]).map(source=><p key={source.id}>{source.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'} · {source.id}<button type="button" disabled={frozen||busy} onClick={()=>{try{change(()=>detachKnowledgeCorrectionConversation(buffer,session,buffer.projectId,source));}catch(cause){failed(cause);}}}>이번 발언 근거 선택 해제</button></p>)}
  {shown||busy||error?<button type="button" onClick={close}>정정 발언 근거 닫기</button>:null}
  {shown?<><ul>{shown.conversations.map(c=><li key={c.id}>{c.id}<button type="button" disabled={frozen||busy} onClick={()=>void load('MESSAGES',c.id)}>정정 근거 대화 발언 보기</button></li>)}</ul>{shown.conversationNext?<button type="button" disabled={frozen||busy} onClick={()=>void load('CONVERSATIONS',null,shown.conversationNext)}>정정 근거 대화 다음 목록</button>:null}
   <ul>{shown.messages.map(m=><li key={m.sourceRef.id}>순번 {m.serverSequence} · {m.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'}<button type="button" disabled={frozen||busy} onClick={()=>void load('ORIGINAL',shown.cid,null,m.sourceRef)}>정정 근거 발언 원문 확인</button></li>)}</ul>{shown.messageNext?<button type="button" disabled={frozen||busy} onClick={()=>void load('MESSAGES',shown.cid,shown.messageNext)}>정정 근거 이전 발언</button>:null}
   {shown.view?<><pre aria-label="정정 근거 발언 원문">{shown.view.body}</pre><code>{shown.view.sourceRef.contentHash}</code><button type="button" disabled={frozen||busy} onClick={()=>{try{change(()=>attachKnowledgeCorrectionConversation(buffer,session,buffer.projectId,shown.view!));}catch(cause){failed(cause);}}}>이 발언을 정정 근거에 붙이기</button></>:null}</>:null}
  {busy?<p role="status">정정 발언 근거 확인 중</p>:null}{error?<p role="alert">{error} · 원문과 지식 입력은 보존합니다.</p>:null}<p>직접 선택한 보관 발언의 참조만 추가합니다. 지시의 현재 효력·공유·Agent 전달·자동 저장은 판정하거나 실행하지 않습니다.</p>
 </section>;
}
