import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {DesignChangePage} from './api.ts';
import {readStoredChangeDocumentSource,type ChangeDocumentSelection} from './stored-change-document-source.ts';

function DocumentOriginal({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:ChangeDocumentSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
  const [result,setResult]=useState<{client:ApiClient;selection:ChangeDocumentSelection;value:Awaited<ReturnType<typeof readStoredChangeDocumentSource>>|null;error:ApiError|null}|null>(null);
  useEffect(()=>{let active=true;readStoredChangeDocumentSource(client,selection,()=>active).then(value=>{if(active)setResult({client,selection,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setResult({client,selection,value:null,error});if(error.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
  const current=result?.client===client&&result.selection===selection?result:null;
  return <section aria-label="보관 변경 요청 문서 출처 원문"><h4>변경 근거 문서 · v{selection.source.version}</h4><button type="button" onClick={onClose}>변경 근거 원문 닫기</button>
    <p className="meta">저장 요청의 고정 출처 · 최신 문서/현재 적용 여부는 미확인 · 승인·변경 적용·Agent 전달 없음</p>
    <p className="meta">문서 SHA256 {selection.source.contentHash}</p>
    {current?.error?<p role="alert">{current.error.code} · 출처 원문을 채택하지 않았습니다.</p>:current?.value?<><h5>{current.value.document.title}</h5><pre className="document-plain" aria-label="변경 근거 문서 원문">{current.value.body}</pre></>:<p role="status">변경 근거 문서 확인 중</p>}
  </section>;
}

export function StoredChangeSources({client,projectId,session,change,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;change:DesignChangePage['change'];onAuthenticationLost:()=>void}){
  const context=JSON.stringify([projectId,session.user.id,session.clientId,change.ref]);
  const [selected,setSelected]=useState<{context:string;client:ApiClient;selection:ChangeDocumentSelection;nonce:number}|null>(null);
  const current=selected?.context===context&&selected.client===client?selected:null;
  return <section aria-label="보관 변경 요청 출처"><details><summary>요청 출처 참조·원문</summary>
    {change.sourceRefs.length?<ul>{change.sourceRefs.map((source,index)=><li key={index}>{source.kind} · {source.id}{source.kind==='DOCUMENT_VERSION'?' · v'+source.version:''} · {source.contentHash}
      {source.kind==='DOCUMENT_VERSION'?<button type="button" aria-label={'변경 문서 출처 '+(index+1)+' 원문 보기'} onClick={()=>setSelected(old=>({context,client,nonce:(old?.nonce??0)+1,selection:{projectId,userId:session.user.id,clientId:session.clientId,changeRef:structuredClone(change.ref),source:structuredClone(source)}}))}>변경 근거 문서 원문 보기</button>:<span> · 직접 열기 미연결 · 원 참조 유지</span>}
    </li>)}</ul>:<p>출처 참조 없음</p>}
  </details>{current?<DocumentOriginal key={current.nonce} client={client} selection={current.selection} onClose={()=>setSelected(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</section>;
}
