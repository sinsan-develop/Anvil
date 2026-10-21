import {useEffect,useState} from 'react';
import {ApiError} from '../../api/client.ts';
import type {MethodBuffer} from './common-api.ts';
import {exportMethodDraftFile} from './method-draft-export.ts';

export function MethodDraftExport({buffer,userId,scope,disabled}:{buffer:MethodBuffer;userId:string;scope:'USER_COMMON'|'PROJECT';disabled:boolean}){
 const [prepared,setPrepared]=useState<{buffer:MethodBuffer;url:string;size:number}|null>(null),[failure,setFailure]=useState<{buffer:MethodBuffer;code:string}|null>(null);
 const locked=disabled||buffer.ownerUserId!==userId||!!buffer.pending||!!buffer.preparationId||!!buffer.review||!!buffer.application;
 const current=prepared?.buffer===buffer&&!locked?prepared:null;
 useEffect(()=>()=>{if(prepared)URL.revokeObjectURL(prepared.url);},[prepared]);
 useEffect(()=>{if(prepared&&(prepared.buffer!==buffer||locked))setPrepared(null);},[buffer,locked,prepared]);
 function prepare(){
  if(locked)return;
  try{const text=exportMethodDraftFile(buffer,userId,scope),blob=new Blob([text],{type:'application/json;charset=utf-8'});setPrepared({buffer,url:URL.createObjectURL(blob),size:blob.size});setFailure(null);}
  catch(cause){setPrepared(null);setFailure({buffer,code:cause instanceof ApiError?cause.code:'METHOD_DRAFT_FILE_INVALID'});}
 }
 return <section aria-label="방법론 초안 파일 내보내기"><p className="meta">현재 편집한 정의 5필드만 내려받습니다. 전체 프로젝트 백업·서버 저장·확정·적용·권한 이전이 아닙니다. 다른 프로젝트에서는 고정 양식·예산 참조를 다시 확인해야 합니다. 알려진 비밀만 검사하며 파일의 보관·전달은 직접 관리하세요.</p>
  <button type="button" disabled={locked} onClick={prepare}>방법론 초안 파일 준비</button>
  {failure?.buffer===buffer&&!locked?<p role="alert">{failure.code} · 파일을 만들지 않았으며 작성 입력은 보존합니다.</p>:null}
  {current?<><p>UTF-8 JSON {current.size} bytes · 가져오기 형식 확인 · 그래프 구조·내용 미검수 · 실행 허가 아님</p><a href={current.url} download="anvil-method-draft.json">방법론 초안 JSON 내려받기</a></>:null}
 </section>;
}
