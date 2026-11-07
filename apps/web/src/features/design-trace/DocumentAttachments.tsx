import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {listDocumentMaterials,type MaterialPage,type ImportSummary} from './materials-api.ts';
import {readDocumentAttachment,readDocumentPngAttachment,attachDocumentOriginal,removeDocumentAttachment,moveDocumentAttachment,type DocumentAttachmentSelection} from './document-attachments.ts';
import type {StoredDocumentPng} from './stored-document-image.ts';
export function DocumentAttachments({client,session,buffer,locked,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;locked:boolean;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const live=useRef(true),flight=useRef(false),attempt=useRef(0),latest=useRef(buffer);latest.current=buffer;
 const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
 const [list,setList]=useState<{buffer:DocumentBuffer;page:MaterialPage<ImportSummary>;status:'READY'|'UNSUPPORTED'}|null>(null);
 const [preview,setPreview]=useState<{buffer:DocumentBuffer;value:DocumentAttachmentSelection&{body:string|null;image:StoredDocumentPng|null};attempt:number;decoded:boolean}|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;attempt.current++;};},[]);
 const disabled=locked||loading||buffer.ownerUserId!==session.user.id;
 const page=list?.buffer===buffer?list.page:null,shown=preview?.buffer===buffer?preview:null,status=page?list!.status:'READY';
 async function read(source?:ImportSummary,cursor:string|null=null,status:'READY'|'UNSUPPORTED'='READY'){
  if(disabled||flight.current)return;const captured=buffer,id=++attempt.current;flight.current=true;setLoading(true);setError(null);setPreview(null);
  const active=()=>live.current&&attempt.current===id&&latest.current===captured;
  try{
   if(source){if(status==='UNSUPPORTED'){const value=await readDocumentPngAttachment(client,buffer.projectId,source,active);if(active())setPreview({buffer:captured,value:{...value,body:null},attempt:id,decoded:false});}else{const value=await readDocumentAttachment(client,buffer.projectId,source,active);if(active())setPreview({buffer:captured,value:{...value,image:null},attempt:id,decoded:true});}}
   else{setList(null);const value=await listDocumentMaterials(client,buffer.projectId,'imports',cursor,status) as MaterialPage<ImportSummary>;if(active())setList({buffer:captured,page:value,status});}
  }catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e.code);if(e.status===401)onAuthenticationLost();}}
  finally{flight.current=false;if(live.current)setLoading(false);}
 }
 function attach(){if(disabled||!shown?.decoded)return;try{const captured=buffer,next=attachDocumentOriginal(captured,session,shown.value);onChange(current=>current===captured?next:current);setPreview(null);setList(null);setError(null);}catch(cause){setError(cause instanceof ApiError?cause.code:'RESPONSE_INVALID');}}
 function remove(index:number){if(disabled)return;try{const captured=buffer,next=removeDocumentAttachment(captured,session,captured.content.attachments[index]!);onChange(current=>current===captured?next:current);setError(null);}catch(cause){setError(cause instanceof ApiError?cause.code:'RESPONSE_INVALID');}}
 function move(index:number,direction:-1|1){if(disabled)return;try{const captured=buffer,next=moveDocumentAttachment(captured,session,index,direction);onChange(current=>current===captured?next:current);setError(null);}catch(cause){setError(cause instanceof ApiError?cause.code:'RESPONSE_INVALID');}}
 function close(){attempt.current++;setPreview(null);setError(null);setLoading(false);}
 function imageFailed(id:number){if(live.current&&attempt.current===id){setPreview(null);setError('DOCUMENT_PNG_DECODE_FAILED');}}
 function supported(source:ImportSummary){const a=source.originalRef;return a.bytes<=2097152&&(status==='UNSUPPORTED'?source.status==='UNSUPPORTED'&&a.mediaType==='image/png'&&a.bytes>=57:source.status==='READY'&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(a.mediaType));}
 return <section aria-label="문서 첨부 작성"><h3>문서 첨부</h3><p>이 프로젝트의 보관 텍스트 또는 제한 PNG를 확인해 별도 첨부로 선택합니다. 원문 바이트·해시 확인은 내용 검토·권한 허가가 아니며 별도 저장 전에는 편집 입력뿐입니다. PNG 본문 추출은 미지원이며 PDF/SVG/HTML 등은 선택하지 않습니다.</p><p className="meta">PNG는 기존 시안 조회와 같은 2MiB·8비트 RGB/RGBA·비인터레이스·비애니메이션·각변4096/총4194304픽셀/청크 제한을 사용합니다. 새 파일 업로드가 아닌 보관 원본 선택입니다.</p>
 <ul>{buffer.content.attachments.map((a,i)=><li key={a.artifactId}><code>{a.artifactId}</code> · {a.bytes}바이트 · {a.contentHash}<button type="button" disabled={disabled||i===0} onClick={()=>move(i,-1)}>첨부 {i+1} 위로</button><button type="button" disabled={disabled||i===buffer.content.attachments.length-1} onClick={()=>move(i,1)}>첨부 {i+1} 아래로</button><button type="button" disabled={disabled||!!buffer.importCandidateRef} onClick={()=>remove(i)}>첨부 {i+1} 제외</button></li>)}</ul>
 <p className="meta">첨부 순서는 별도 초안 저장 뒤 반영됩니다. 파일·본문·과거 버전은 바꾸지 않습니다.</p>
 {buffer.importCandidateRef?<p>가져오기 원본 보존 첨부는 이 화면에서 제외하지 않습니다.</p>:null}
 <button type="button" disabled={disabled} onClick={()=>void read()}>첨부할 보관 원본 조회</button>
 <button type="button" disabled={disabled} onClick={()=>void read(undefined,null,'UNSUPPORTED')}>첨부할 보관 PNG 조회</button>
 {page?<><ul>{page.items.map((source,i)=><li key={source.id}>원본 {source.originalRef.artifactId} · {source.originalRef.mediaType} · {source.originalRef.bytes}바이트<button type="button" disabled={disabled||!supported(source)} onClick={()=>void read(source,null,status)}>첨부 {status==='UNSUPPORTED'?'PNG':'원문'} {i+1} 확인</button></li>)}</ul>{!page.items.length?<p>이 페이지에는 첨부 후보가 없습니다.</p>:null}{page.hasMore?<button type="button" disabled={disabled} onClick={()=>void read(undefined,page.nextCursor,status)}>첨부 원본 다음 목록</button>:null}</>:null}
 {shown?<section aria-label="확인한 첨부 원문">{shown.value.image?<><img className="document-image-preview" src={shown.value.image.dataUrl} alt="첨부할 보관 PNG 원문" onError={()=>imageFailed(shown.attempt)} onLoad={e=>{if(e.currentTarget.naturalWidth!==shown.value.image!.width||e.currentTarget.naturalHeight!==shown.value.image!.height){imageFailed(shown.attempt);return;}if(live.current&&attempt.current===shown.attempt&&latest.current===shown.buffer)setPreview(p=>p?.attempt===shown.attempt?{...p,decoded:true}:p);}}/><p>PNG {shown.value.image.width} × {shown.value.image.height} · 본문 추출/내용 검수 아님</p></>:<pre>{shown.value.body}</pre>}<p>원본 SHA256 {shown.value.artifact.contentHash}</p><button type="button" disabled={disabled||!shown.decoded||buffer.content.attachments.some(a=>a.artifactId===shown.value.artifact.artifactId)} onClick={attach}>이 원본을 문서에 첨부</button></section>:null}
 {loading||shown||error?<button type="button" onClick={close}>첨부 원문 확인 닫기</button>:null}
 {loading?<p role="status">첨부 원본 확인 중</p>:null}{error?<p role="alert">{error} · 문서 입력/명령은 변경하지 않았습니다.</p>:null}</section>;
}
