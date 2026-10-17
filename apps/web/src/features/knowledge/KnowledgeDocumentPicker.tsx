import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {listDocuments,readDocument,type DocumentSummary} from '../design-trace/api.ts';
import type {KnowledgeDocumentSource} from './knowledge-document-source.ts';
type Preview=Awaited<ReturnType<typeof readDocument>>;
export function KnowledgeDocumentPicker({client,projectId,disabled,onAttach,onAuthenticationLost}:{client:ApiClient;projectId:string;disabled:boolean;onAttach:(source:KnowledgeDocumentSource)=>void;onAuthenticationLost:()=>void}){
 const[open,setOpen]=useState(false),[items,setItems]=useState<DocumentSummary[]>([]),[next,setNext]=useState<string|null>(null),[selected,setSelected]=useState<DocumentSummary|null>(null),[version,setVersion]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<ApiError|null>(null),[attached,setAttached]=useState(false);
 const sequence=useRef(0),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{if(disabled){sequence.current++;setLoading(false);}},[disabled]);
 function failed(e:unknown){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a);if(a.status===401)onAuthenticationLost();}
 function resetSelection(){sequence.current++;setPreview(null);setAttached(false);setError(null);setLoading(false);}
 async function list(cursor:string|null=null){if(disabled)return;const id=++sequence.current;setOpen(true);setLoading(true);setError(null);setPreview(null);setSelected(null);setAttached(false);if(!cursor)setItems([]);
  try{const value=await listDocuments(client,projectId,cursor);if(!alive.current||sequence.current!==id)return;setItems(old=>cursor?[...new Map([...old,...value.items].map(i=>[i.id,i])).values()]:value.items);setNext(value.nextCursor);}
  catch(e){if(alive.current&&sequence.current===id){setItems([]);setNext(null);failed(e);}}finally{if(alive.current&&sequence.current===id)setLoading(false);}
 }
 async function inspect(){if(disabled||loading||!selected)return;resetSelection();const n=Number(version);if(!/^\d+$/.test(version)||!Number.isSafeInteger(n)||n<1){failed(new ApiError('KNOWLEDGE_SOURCE_INVALID'));return;}const id=++sequence.current;setLoading(true);
  try{const value=await readDocument(client,projectId,selected.id,n);if(alive.current&&sequence.current===id)setPreview(value);}
  catch(e){if(alive.current&&sequence.current===id)failed(e);}finally{if(alive.current&&sequence.current===id)setLoading(false);}
 }
 function attach(){if(disabled||loading||!preview)return;try{const d=preview.document;onAttach({kind:'DOCUMENT_VERSION',id:d.id,version:d.version,contentHash:d.contentHash});setError(null);setAttached(true);}catch(e){failed(e);}}
 return<><button type="button" disabled={disabled} onClick={()=>void list()}>문서 출처 선택</button>{open?<section aria-label="지식 문서 출처 선택"><h4>저장된 문서에서 출처 선택</h4><button type="button" onClick={()=>{resetSelection();setOpen(false);}}>문서 선택 닫기</button><p>확인한 버전 참조만 붙입니다. 지식 본문 변경·자동 저장·문서 확정은 하지 않습니다.</p>
  <ul>{items.map(i=><li key={i.id}><button type="button" disabled={disabled||loading} onClick={()=>{resetSelection();setSelected(i);setVersion(String(i.headVersion));}}>출처 문서 선택: {i.title}</button> · 최신 v{i.headVersion}</li>)}</ul>{next?<button type="button" disabled={disabled||loading} onClick={()=>void list(next)}>출처 문서 다음 목록</button>:null}{!loading&&!items.length?<p>선택할 문서가 없습니다.</p>:null}
  {selected?<><label>출처 문서 버전<input aria-label="출처 문서 버전" inputMode="numeric" value={version} disabled={disabled} onChange={e=>{resetSelection();setVersion(e.target.value);}}/></label><button type="button" disabled={disabled||loading} onClick={()=>void inspect()}>선택 버전 원문 확인</button></>:null}
  {loading?<p role="status">문서 출처 확인 중</p>:null}{error?<p role="alert">{error.code}</p>:null}{preview?<><p>{preview.document.title} · v{preview.document.version} · {preview.document.confirmed?'문서 확정 이력 있음':'문서 미확정'}</p><code>{preview.document.contentHash}</code><pre aria-label="붙일 문서 원문">{preview.body}</pre><button type="button" disabled={disabled||loading} onClick={attach}>이 버전을 지식 출처에 붙이기</button>{attached?<p role="status">선택 출처에 추가했습니다 · 지식 저장 전</p>:null}</>:null}</section>:null}</>;
}
