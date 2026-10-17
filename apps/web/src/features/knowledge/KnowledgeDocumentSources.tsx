import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeView} from './api.ts';
import {readKnowledgeDocumentSource,type KnowledgeDocumentSelection} from './knowledge-document-source.ts';
function Original({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:KnowledgeDocumentSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
 const [value,setValue]=useState<Awaited<ReturnType<typeof readKnowledgeDocumentSource>>|null>(null),[error,setError]=useState<ApiError|null>(null);
 useEffect(()=>{let active=true;readKnowledgeDocumentSource(client,selection,()=>active).then(v=>{if(active)setValue(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
 return <section className="status-card" aria-label="지식 문서 출처 원문"><h3>문서 출처 · v{selection.source.version}</h3><button type="button" onClick={onClose}>출처 원문 닫기</button><p className="meta">읽기 전용 · 지식 v{selection.knowledgeRef.version}의 고정 출처 · 최신 버전/현재 적용 미확인</p><p className="meta">문서 SHA256 {selection.source.contentHash}</p>{error?<p role="alert">{error.message} · {error.code} · 출처 원문으로 채택하지 않았습니다.</p>:value?<><h4>{value.document.title}</h4><pre aria-label="출처 문서 원문">{value.body}</pre></>:<p role="status">출처 원문 확인 중</p>}</section>;
}
/** 고정 문서 조회는 지식/정정/제외/확정 buffer나 pending을 수정하지 않는다. */
export function KnowledgeDocumentSources({client,projectId,session,view,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;view:KnowledgeView;onAuthenticationLost:()=>void}){
 const [selected,setSelected]=useState<{selection:KnowledgeDocumentSelection;nonce:number}|null>(null);
 return <section aria-label="지식의 고정 문서 출처"><h3>고정 원문 출처</h3>{view.entry.sourceRefs.length?<ul>{view.entry.sourceRefs.map((r,i)=><li key={i}>{r.kind==='DOCUMENT_VERSION'?<>{r.id} · v{r.version} <button type="button" aria-label={'문서 출처 '+(i+1)+' 원문 보기'} onClick={()=>setSelected(old=>({nonce:(old?.nonce??0)+1,selection:{projectId,userId:session.user.id,clientId:session.clientId,knowledgeRef:structuredClone(view.ref),source:structuredClone(r)}}))}>문서 원문 보기</button></>:<span>{r.kind} · 직접 열기 미연결 · 원 참조는 이력에 보존됩니다.</span>}</li>)}</ul>:<p>연결한 출처가 없습니다.</p>}{selected?<Original key={selected.nonce} client={client} selection={selected.selection} onClose={()=>setSelected(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</section>;
}
