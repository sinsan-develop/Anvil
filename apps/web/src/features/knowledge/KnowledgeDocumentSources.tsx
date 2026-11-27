import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeView} from './api.ts';
import {readKnowledgeDocumentSource,type KnowledgeDocumentSelection} from './knowledge-document-source.ts';
import {KnowledgeArtifactOriginal} from './KnowledgeArtifactOriginal.tsx';
import type {KnowledgeArtifactSelection} from './knowledge-artifact-source.ts';
import {KnowledgeConversationOriginal,type KnowledgeConversationSourceSelection,type OpenKnowledgeConversation} from './KnowledgeConversationOriginal.tsx';
import {ordered} from './review-view.ts';
interface DocumentSourceScope {client:ApiClient;transport:typeof fetch;projectId:string;userId:string;clientId:string;csrfToken:string;viewKey:string}
interface DocumentRead {scope:DocumentSourceScope;selection:KnowledgeDocumentSelection;nonce:number}

function Original({client,read,isCurrent,onClose,onAuthenticationLost}:{client:ApiClient;read:DocumentRead;isCurrent:(read:DocumentRead)=>boolean;onClose:()=>void;onAuthenticationLost:()=>void}){
 const {selection}=read;
 const [value,setValue]=useState<Awaited<ReturnType<typeof readKnowledgeDocumentSource>>|null>(null),[error,setError]=useState<ApiError|null>(null);
 useEffect(()=>{
  let live=true;
  const active=()=>live&&isCurrent(read);
  if(!active())return;
  readKnowledgeDocumentSource(client,selection,active).then(value=>{if(active())setValue(value);}).catch(cause=>{
   if(!active())return;
   const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setError(error);
   if(error.status===401&&active())onAuthenticationLost();
  });
  return()=>{live=false;};
 },[client,read,isCurrent]);
 return <section className="status-card" aria-label="지식 문서 출처 원문"><h3>문서 출처 · v{selection.source.version}</h3><button type="button" onClick={onClose}>출처 원문 닫기</button><p className="meta">읽기 전용 · 지식 v{selection.knowledgeRef.version}의 고정 출처 · 최신 버전/현재 적용 미확인</p><p className="meta">문서 SHA256 {selection.source.contentHash}</p>{error?<p role="alert">{error.message} · {error.code} · 출처 원문으로 채택하지 않았습니다.</p>:value?<><h4>{value.document.title}</h4><pre aria-label="출처 문서 원문">{value.body}</pre></>:<p role="status">출처 원문 확인 중</p>}</section>;
}
/** 고정 문서 조회는 지식/정정/제외/확정 buffer나 pending을 수정하지 않는다. */
export function KnowledgeDocumentSources({client,projectId,session,view,onAuthenticationLost,onOpenConversation}:{client:ApiClient;projectId:string;session:DocumentSession;view:KnowledgeView;onAuthenticationLost:()=>void;onOpenConversation?:OpenKnowledgeConversation}){
 const transport=client.transport,userId=session.user.id,clientId=session.clientId,csrfToken=session.csrfToken;
 const viewKey=ordered([view.ref,view.state,view.entry.sourceRefs]);
 const scope=useMemo(()=>({client,transport,projectId,userId,clientId,csrfToken,viewKey}),[client,transport,projectId,userId,clientId,csrfToken,viewKey]);
 const committedScope=useRef<DocumentSourceScope|null>(null),activeRead=useRef<DocumentRead|null>(null),sequence=useRef(0);
 const [selected,setSelected]=useState<DocumentRead|null>(null);
 useLayoutEffect(()=>{
  committedScope.current=scope;
  return()=>{committedScope.current=null;activeRead.current=null;};
 },[scope]);
 const isCurrent=useCallback((read:DocumentRead)=>activeRead.current===read&&committedScope.current===read.scope&&read.scope.client.transport===read.scope.transport,[]);
 function clearDocument(expected?:DocumentRead){
  if(committedScope.current!==scope||expected&&activeRead.current!==expected)return;
  activeRead.current=null;
  setSelected(null);
 }
 function openDocument(source:KnowledgeDocumentSelection['source']){
  if(committedScope.current!==scope||client.transport!==transport)return;
  setConversation(null);setArtifact(null);
  const read={scope,nonce:++sequence.current,selection:{projectId,userId,clientId,knowledgeRef:structuredClone(view.ref),source:structuredClone(source)}};
  activeRead.current=read;
  setSelected(read);
 }
 const [artifact,setArtifact]=useState<{selection:KnowledgeArtifactSelection;nonce:number}|null>(null);
 const [conversation,setConversation]=useState<{selection:KnowledgeConversationSourceSelection;nonce:number}|null>(null);
 return <section aria-label="지식의 고정 문서 출처"><h3>고정 원문 출처</h3>{view.entry.sourceRefs.length?<ul>{view.entry.sourceRefs.map((r,i)=><li key={i}>{r.kind==='DOCUMENT_VERSION'?<>{r.id} · v{r.version} <button type="button" aria-label={'문서 출처 '+(i+1)+' 원문 보기'} onClick={()=>openDocument(r)}>문서 원문 보기</button></>:r.kind==='ARTIFACT'?<>{r.id} <button type="button" aria-label={'파일 출처 '+(i+1)+' 원문 보기'} onClick={()=>{setConversation(null);clearDocument();setArtifact(old=>({nonce:(old?.nonce??0)+1,selection:{projectId,userId:session.user.id,clientId:session.clientId,knowledgeRef:structuredClone(view.ref),source:{kind:'ARTIFACT',id:r.id,contentHash:r.contentHash}}}));}}>파일 원문 보기</button></>:r.kind==='CONVERSATION'||r.kind==='USER_INSTRUCTION'?<>{r.kind} · {r.id} <button type="button" aria-label={'대화 출처 '+(i+1)+' 원문 보기'} onClick={()=>{setArtifact(null);clearDocument();setConversation(old=>({nonce:(old?.nonce??0)+1,selection:{projectId,userId:session.user.id,clientId:session.clientId,knowledgeRef:structuredClone(view.ref),source:{kind:r.kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION',id:r.id,contentHash:r.contentHash}}}));}}>대화 원문 보기</button></>:<span>{r.kind} · 직접 열기 미연결 · 원 참조는 이력에 보존됩니다.</span>}</li>)}</ul>:<p>연결한 출처가 없습니다.</p>}{selected&&selected.scope===scope&&isCurrent(selected)?<Original key={selected.nonce} client={client} read={selected} isCurrent={isCurrent} onClose={()=>clearDocument(selected)} onAuthenticationLost={onAuthenticationLost}/>:null}{artifact?<KnowledgeArtifactOriginal key={artifact.nonce} client={client} selection={artifact.selection} onClose={()=>setArtifact(null)} onAuthenticationLost={onAuthenticationLost}/>:null}{conversation?<KnowledgeConversationOriginal key={conversation.nonce} client={client} selection={conversation.selection} onClose={()=>setConversation(null)} onAuthenticationLost={onAuthenticationLost} onOpenConversation={onOpenConversation}/>:null}</section>;
}
