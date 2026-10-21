import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentVersion} from './api.ts';
import {readStoredDocumentAttachment} from './stored-document-attachment.ts';
import {readStoredDocumentPng,type StoredDocumentPng} from './stored-document-image.ts';
export function StoredDocumentAttachments({client,projectId,document,onAuthenticationLost}:{client:ApiClient;projectId:string;document:DocumentVersion;onAuthenticationLost:()=>void}){
 const live=useRef(true),attempt=useRef(0),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[opened,setOpened]=useState<{index:number;body:string|null;image:StoredDocumentPng|null;attempt:number;decoded:boolean}|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;attempt.current++;};},[]);
 function close(){attempt.current++;setOpened(null);setError(null);setLoading(false);}
 async function read(index:number){
  const current=++attempt.current;setOpened(null);setError(null);setLoading(true);const active=()=>live.current&&current===attempt.current;
  try{const ref={id:document.id,version:document.version,contentHash:document.contentHash},attachment=document.content.attachments[index]!;if(attachment.mediaType==='image/png'){const image=await readStoredDocumentPng(client,projectId,ref,attachment,active);if(active())setOpened({index,body:null,image,attempt:current,decoded:false});}else{const body=await readStoredDocumentAttachment(client,projectId,ref,attachment,active);if(active())setOpened({index,body,image:null,attempt:current,decoded:false});}}
  catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e.code);if(e.status===401)onAuthenticationLost();}}
  finally{if(active())setLoading(false);}
 }
 function imageFailure(current:number){if(live.current&&attempt.current===current){setOpened(null);setError('DOCUMENT_PNG_DECODE_FAILED');}}
 return <section aria-label="저장된 문서 첨부"><h3>이 버전의 저장 첨부</h3>{document.content.attachments.length?<ul>{document.content.attachments.map((a,i)=><li key={a.artifactId}><code>{a.artifactId}</code> · {a.bytes}바이트 · SHA256 {a.contentHash}<button type="button" disabled={loading||a.bytes>2097152||!['text/plain;charset=utf-8','text/markdown;charset=utf-8','image/png'].includes(a.mediaType)} onClick={()=>void read(i)}>저장 첨부 {i+1} {a.mediaType==='image/png'?'PNG 시안':'원문'} 열기</button></li>)}</ul>:<p>이 버전에 저장된 첨부가 없습니다.</p>}
 <p className="meta">고정 버전·첨부 귀속과 원문 바이트/해시를 다시 검사합니다. UTF-8 텍스트 또는 8비트 RGB/RGBA·비인터레이스 PNG 2MiB 이하만 지원합니다. PNG는 각변4096·총4194304픽셀·비애니메이션만 표시하며 압축 메타데이터·EXIF·알 수 없는 부가 청크는 미지원입니다. SVG/HTML/PDF/JPEG 및 다른 바이너리는 미지원이며 현재 권한 인증·내용 합격 판정은 아닙니다.</p>
 {loading?<p role="status">저장 첨부 무결성 확인 중</p>:null}{loading||opened||error?<button type="button" onClick={close}>저장 첨부 원문 닫기</button>:null}
 {opened?<section aria-label="고정 저장첨부 원문"><p>문서 버전 {document.version} · 첨부 {opened.index+1}</p>{opened.image?<><p>PNG {opened.image.width} × {opened.image.height} · {opened.decoded?'브라우저 이미지 해석 확인':'브라우저 이미지 해석 대기'} · 내용 적합/검수 아님</p><img className="document-image-preview" src={opened.image.dataUrl} alt={'저장 첨부 '+(opened.index+1)+' PNG 시안'} onError={()=>imageFailure(opened.attempt)} onLoad={e=>{if(e.currentTarget.naturalWidth!==opened.image!.width||e.currentTarget.naturalHeight!==opened.image!.height){imageFailure(opened.attempt);return;}if(live.current&&attempt.current===opened.attempt)setOpened(v=>v&&v.attempt===opened.attempt?{...v,decoded:true}:v);}}/></>:<pre>{opened.body}</pre>}</section>:null}{error?<p role="alert">{error} · 앞선 첨부 원문을 숨겼습니다.</p>:null}</section>;
}
