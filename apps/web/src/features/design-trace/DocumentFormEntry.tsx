import {Fragment,useId,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {applyFormContentEntry,prepareFormContentEntry,type FormContentEntry} from './form-content-entry.ts';
export function DocumentFormEntry({client,session,buffer,locked,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;locked:boolean;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const prefix=useId();const [busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null),live=useRef(true),latest=useRef(buffer),flight=useRef(false);latest.current=buffer;
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const disabled=locked||busy,entry=buffer.formEntry;
 async function begin(){if(disabled||flight.current)return;flight.current=true;setBusy(true);setError(null);const source=buffer;
  try{const value=await prepareFormContentEntry(client,source,session,()=>live.current&&latest.current===source);if(value)onChange(p=>p===source?value:p);}
  catch(cause){if(live.current&&latest.current===source){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();}}
  finally{flight.current=false;if(live.current)setBusy(false);}
 }
 function update(edit:(value:FormContentEntry)=>void){if(disabled||!entry)return;try{const copy=structuredClone(entry);edit(copy);const next=applyFormContentEntry(buffer,copy);onChange(p=>p===buffer?next:p);setError(null);}catch(cause){setError(cause instanceof ApiError?cause:new ApiError('FORM_ENTRY_INPUT_INVALID'));}}
 if(buffer.documentId!==null||buffer.ownerUserId!==session.user.id)return null;
 return <section aria-label="양식 항목 내용 작성">
 {!entry?<button type="button" disabled={disabled||buffer.body!==''||!!buffer.content.sections.length||!!buffer.importCandidateRef} onClick={()=>void begin()}>양식 내용 입력 열기</button>:<>
 <p className="meta">직접 입력한 내용만 새 초안 본문으로 만듭니다. 반복행은 필드 ID의 Markdown 표이며 셀 개행은 &lt;br&gt;로 표시합니다. 본문 줄바꿈은 LF로 정리하며 필수항목 적합·내용검토·확정은 별도입니다. 저장은 아래 버튼으로 직접 진행하세요.</p>
 <fieldset disabled={disabled}>{entry.form.items.map((item,i)=><fieldset key={item.itemId}><legend>{item.title}{item.required?' · 필수':''}</legend>
 {item.valueType==='TEXT'?<><label htmlFor={prefix+'-item-'+i}>{item.title} 내용</label><textarea id={prefix+'-item-'+i} value={entry.values[item.itemId] as string} rows={4} onChange={e=>update(v=>{v.values[item.itemId]=e.target.value;})}/></>:<>
 {(entry.values[item.itemId] as Record<string,string>[]).map((row,n)=><fieldset key={n}><legend>{item.title} {n+1}행</legend>{item.fields.map((field,c)=><Fragment key={field.fieldId}><label htmlFor={prefix+'-item-'+i+'-row-'+n+'-field-'+c}>{item.title} {n+1}행 {field.title}</label><textarea id={prefix+'-item-'+i+'-row-'+n+'-field-'+c} rows={2} value={row[field.fieldId]} onChange={e=>update(v=>{(v.values[item.itemId] as Record<string,string>[])[n]![field.fieldId]=e.target.value;})}/></Fragment>)}<button type="button" onClick={()=>{if(Object.values(row).some(v=>v.length)&&!confirm('이 행의 미저장 입력을 지울까요?'))return;update(v=>{(v.values[item.itemId] as Record<string,string>[]).splice(n,1);});}}>{item.title} {n+1}행 삭제</button></fieldset>)}
 <button type="button" disabled={(entry.values[item.itemId] as Record<string,string>[]).length>=200} onClick={()=>update(v=>{(v.values[item.itemId] as Record<string,string>[]).push(Object.fromEntries(item.fields.map(f=>[f.fieldId,''])));})}>{item.title} 행 추가</button></>}
 </fieldset>)}</fieldset>
 <button type="button" disabled={disabled} onClick={()=>onChange(p=>p===buffer?{...p,formEntry:undefined}:p)}>입력 본문을 유지하고 원문 편집으로 전환</button>
 </>}{error?<p role="alert">{error.message} · {error.code} · 기존 입력을 유지했습니다.</p>:null}
 </section>;
}
