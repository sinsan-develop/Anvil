import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {readImportedPng,selectImportedPng,type ImportedPngSelection} from './imported-png-attachment.ts';
export function ImportedPngAttachment({client,session,buffer,disabled,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;disabled:boolean;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const live=useRef(true),attempt=useRef(0),flight=useRef(false),latest=useRef(buffer);latest.current=buffer;
 const[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[preview,setPreview]=useState<{buffer:DocumentBuffer;selection:ImportedPngSelection;attempt:number;decoded:boolean}|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;attempt.current++;};},[]);
 const shown=preview?.buffer===buffer?preview:null;
 function close(){attempt.current++;setPreview(null);setError(null);setBusy(false);}
 async function read(){
  if(disabled||flight.current)return;const captured=buffer,id=++attempt.current;flight.current=true;setBusy(true);setPreview(null);setError(null);
  const active=()=>live.current&&id===attempt.current&&latest.current===captured;
  try{const selection=await readImportedPng(client,captured,session,active);if(active())setPreview({buffer:captured,selection,attempt:id,decoded:false});}
  catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e.code);if(e.status===401)onAuthenticationLost();}}
  finally{flight.current=false;if(live.current&&id===attempt.current)setBusy(false);}
 }
 function choose(){if(disabled||busy||!shown?.decoded)return;try{const captured=buffer,next=selectImportedPng(captured,session,shown.selection);onChange(current=>current===captured?next:current);close();}catch(e){setError(e instanceof ApiError?e.code:'RESPONSE_INVALID');setPreview(null);}}
 function invalid(id:number){if(live.current&&attempt.current===id){setPreview(null);setError('DOCUMENT_PNG_DECODE_FAILED');}}
 return <section aria-label="PNG 원본 첨부 선택"><p>본문 추출은 미지원입니다. 보관한 PNG를 별도 첨부로 확인·선택할 수 있습니다. 기존 본문·양식은 바꾸지 않으며 최종 문서 저장은 별도입니다.</p><p className="meta">2MiB 이하·8비트 RGB/RGBA·비인터레이스·비애니메이션, 각변4096/총4194304픽셀 한정입니다. 기존 저장 시안 조회와 같은 구조/압축 검사를 사용하며 비밀 없음·내용 적합 판정은 아닙니다.</p>
 <button type="button" disabled={disabled||busy} onClick={()=>void read()}>보관 PNG 시안 확인</button>{busy?<p role="status">보관 PNG 바이트·참조 확인 중</p>:null}
 {busy||shown||error?<button type="button" onClick={close}>PNG 확인 닫기</button>:null}
 {shown?<><img className="document-image-preview" src={shown.selection.image.dataUrl} alt="첨부할 보관 PNG 시안" onError={()=>invalid(shown.attempt)} onLoad={e=>{if(e.currentTarget.naturalWidth!==shown.selection.image.width||e.currentTarget.naturalHeight!==shown.selection.image.height){invalid(shown.attempt);return;}if(live.current&&attempt.current===shown.attempt)setPreview(p=>p?.attempt===shown.attempt?{...p,decoded:true}:p);}}/><p>PNG {shown.selection.image.width} × {shown.selection.image.height} · 원문 해시 확인 · 내용 검수 아님</p><button type="button" disabled={disabled||busy||!shown.decoded} onClick={choose}>이 PNG를 문서 첨부로 선택</button></>:null}
 {error?<p role="alert">{error} · 앞선 PNG를 숨겼으며 문서 입력은 보존했습니다.</p>:null}</section>;
}
