import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {listDocumentMaterials,type MaterialPage,type ImportSummary} from './materials-api.ts';
import {readDocumentAttachment,attachDocumentOriginal,removeDocumentAttachment,type DocumentAttachmentSelection} from './document-attachments.ts';
export function DocumentAttachments({client,session,buffer,locked,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;locked:boolean;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const live=useRef(true),flight=useRef(false),attempt=useRef(0),latest=useRef(buffer);latest.current=buffer;
 const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
 const [list,setList]=useState<{buffer:DocumentBuffer;page:MaterialPage<ImportSummary>}|null>(null);
 const [preview,setPreview]=useState<{buffer:DocumentBuffer;value:DocumentAttachmentSelection&{body:string}}|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;attempt.current++;};},[]);
 const disabled=locked||loading||buffer.ownerUserId!==session.user.id;
 const page=list?.buffer===buffer?list.page:null,shown=preview?.buffer===buffer?preview.value:null;
 async function read(source?:ImportSummary,cursor:string|null=null){
  if(disabled||flight.current)return;const captured=buffer,id=++attempt.current;flight.current=true;setLoading(true);setError(null);setPreview(null);
  const active=()=>live.current&&attempt.current===id&&latest.current===captured;
  try{
   if(source){const value=await readDocumentAttachment(client,buffer.projectId,source,active);if(active())setPreview({buffer:captured,value});}
   else{setList(null);const value=await listDocumentMaterials(client,buffer.projectId,'imports',cursor,'READY') as MaterialPage<ImportSummary>;if(active())setList({buffer:captured,page:value});}
  }catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e.code);if(e.status===401)onAuthenticationLost();}}
  finally{flight.current=false;if(live.current)setLoading(false);}
 }
 function attach(){if(disabled||!shown)return;try{const captured=buffer,next=attachDocumentOriginal(captured,session,shown);onChange(current=>current===captured?next:current);setPreview(null);setList(null);setError(null);}catch(cause){setError(cause instanceof ApiError?cause.code:'RESPONSE_INVALID');}}
 function remove(index:number){if(disabled)return;try{const captured=buffer,next=removeDocumentAttachment(captured,session,captured.content.attachments[index]!);onChange(current=>current===captured?next:current);setError(null);}catch(cause){setError(cause instanceof ApiError?cause.code:'RESPONSE_INVALID');}}
 return <section aria-label="문서 첨부 작성"><h3>문서 첨부</h3><p>이 프로젝트에서 보관한 READY 텍스트 원본만 선택합니다. 원문 바이트·해시를 확인해도 내용 검토·권한 허가가 아니며, 별도 문서 저장 전에는 편집 입력뿐입니다. 바이너리/미지원 원본은 선택하지 않습니다.</p>
 <ul>{buffer.content.attachments.map((a,i)=><li key={a.artifactId}><code>{a.artifactId}</code> · {a.bytes}바이트 · {a.contentHash}<button type="button" disabled={disabled||!!buffer.importCandidateRef} onClick={()=>remove(i)}>첨부 {i+1} 제외</button></li>)}</ul>
 {buffer.importCandidateRef?<p>가져오기 원본 보존 첨부는 이 화면에서 제외하지 않습니다.</p>:null}
 <button type="button" disabled={disabled} onClick={()=>void read()}>첨부할 보관 원본 조회</button>
 {page?<><ul>{page.items.map((source,i)=><li key={source.id}>원본 {source.originalRef.artifactId} · {source.originalRef.bytes}바이트<button type="button" disabled={disabled} onClick={()=>void read(source)}>첨부 원문 {i+1} 확인</button></li>)}</ul>{!page.items.length?<p>첨부할 READY 텍스트 후보가 없습니다.</p>:null}{page.hasMore?<button type="button" disabled={disabled} onClick={()=>void read(undefined,page.nextCursor)}>첨부 원본 다음 목록</button>:null}</>:null}
 {shown?<section aria-label="확인한 첨부 원문"><pre>{shown.body}</pre><p>원본 SHA256 {shown.artifact.contentHash}</p><button type="button" disabled={disabled||buffer.content.attachments.some(a=>a.artifactId===shown.artifact.artifactId)} onClick={attach}>이 원본을 문서에 첨부</button></section>:null}
 {loading?<p role="status">첨부 원본 확인 중</p>:null}{error?<p role="alert">{error} · 문서 입력/명령은 변경하지 않았습니다.</p>:null}</section>;
}
