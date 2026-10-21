import {useEffect,useRef,useState} from 'react';
import {ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {importWorkPlanDraftFile,exportWorkPlanDraftFile} from './work-plan-draft-file.ts';

export function WorkPlanDraftFile({buffer,session,disabled,onApply}:{buffer:DocumentBuffer;session:DocumentSession;disabled:boolean;onApply:(captured:DocumentBuffer,next:DocumentBuffer)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<{buffer:DocumentBuffer;code:string}|null>(null),live=useRef(true),flight=useRef(false),latest=useRef({buffer,disabled});latest.current={buffer,disabled};
 const [prepared,setPrepared]=useState<{buffer:DocumentBuffer;url:string;size:number}|null>(null),shown=prepared?.buffer===buffer&&!disabled&&!busy?prepared:null;
 useEffect(()=>()=>{if(prepared)URL.revokeObjectURL(prepared.url);},[prepared]);
 useEffect(()=>{if(prepared&&(prepared.buffer!==buffer||disabled||busy))setPrepared(null);},[buffer,disabled,busy,prepared]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 function prepare(){
  if(disabled||flight.current)return;
  try{const raw=exportWorkPlanDraftFile(buffer,session),blob=new Blob([raw],{type:'application/json;charset=utf-8'});setPrepared({buffer,url:URL.createObjectURL(blob),size:blob.size});setError(null);}
  catch(cause){setPrepared(null);setError({buffer,code:cause instanceof ApiError?cause.code:'WORK_PLAN_DRAFT_FILE_INVALID'});}
 }
 async function read(file:File){
  if(disabled||flight.current)return;const captured=buffer;flight.current=true;setBusy(true);setError(null);
  const active=()=>live.current&&!latest.current.disabled&&latest.current.buffer===captured;
  try{
   if(file.size<1||file.size>2097152)throw new ApiError('WORK_PLAN_DRAFT_FILE_INVALID');
   const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(!active())return;
   const next=importWorkPlanDraftFile(captured,session,raw);
   if(!confirm('현재 초안의 업무 카드와 저장 이유를 파일 입력으로 바꿀까요? 현재 문서·설계·검토 참조와 서버 원문은 유지합니다.'))return;
   if(active())onApply(captured,next);
  }catch(cause){if(active())setError({buffer:captured,code:cause instanceof ApiError?cause.code:'WORK_PLAN_DRAFT_FILE_INVALID'});}
  finally{flight.current=false;if(live.current)setBusy(false);}
 }
 return <section aria-label="작업계획 초안 파일 입력"><p className="meta">현재 documentRef·designRef·screenReviewRefs와 같은 기존 저장 payload만 읽습니다. UTF-8 JSON 최대 2MiB, 업무 tasks와 reason만 교체합니다. 파일은 권한·내용검토·확정·실행의 증거가 아니며 가져온 뒤 별도 저장·서버 검사를 거칩니다. 알려진 비밀만 거절하며 완전한 탐지는 아닙니다.</p>
  <label>작업계획 초안 JSON 가져오기<input type="file" accept=".json,application/json" disabled={disabled||busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void read(file);}}/></label>
  <button type="button" disabled={disabled||busy} onClick={prepare}>작업계획 초안 파일 준비</button>
  {shown?<><p>UTF-8 JSON {shown.size} bytes · 가져오기 형식만 확인 · 계획 구조/내용·권한 미검수 · 서버 저장 아님</p><a href={shown.url} download="anvil-work-plan-draft.json">작업계획 초안 JSON 내려받기</a></>:null}
  {busy?<p role="status">작업계획 파일 확인 중 · 아직 입력/서버 저장 전</p>:null}
  {error?.buffer===buffer?<p role="alert">{error.code} · 기존 입력과 고정 명령을 보존합니다.</p>:null}
 </section>;
}
