import {useEffect,useId,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {listDocuments,type DocumentSummary} from '../design-trace/api.ts';
import type {BaselineBuffer} from './baseline-api.ts';
import {readBaselineDesign,setBaselineDesign} from './baseline-design-selection.ts';
export function BaselineDesignPicker({client,session,buffer,index,disabled,onApply,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:BaselineBuffer;index:number;disabled:boolean;onApply:(captured:BaselineBuffer,next:BaselineBuffer)=>void;onAuthenticationLost:()=>void}){
 const id=useId(),[open,setOpen]=useState(false),[items,setItems]=useState<DocumentSummary[]>([]),[next,setNext]=useState<string|null>(null),[selected,setSelected]=useState<DocumentSummary|null>(null),[version,setVersion]=useState(''),[preview,setPreview]=useState<{captured:BaselineBuffer;value:Awaited<ReturnType<typeof readBaselineDesign>>}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null);
 const ticket=useRef(0),alive=useRef(true),current=useRef({buffer,disabled});current.current={buffer,disabled};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;ticket.current++;};},[]);
 useEffect(()=>{ticket.current++;setPreview(null);setBusy(false);},[buffer,disabled]);
 function reset(){ticket.current++;setPreview(null);setBusy(false);setError(null);}
 function failure(e:unknown){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a);if(a.status===401)onAuthenticationLost();}
 async function list(cursor:string|null=null){if(disabled||busy)return;reset();setOpen(true);setBusy(true);setSelected(null);const n=++ticket.current,captured=buffer;const active=()=>alive.current&&ticket.current===n&&current.current.buffer===captured&&!current.current.disabled;
  try{const value=await listDocuments(client,buffer.projectId,cursor);if(active()){setItems(old=>cursor?[...new Map([...old,...value.items].map(v=>[v.id,v])).values()]:value.items);setNext(value.nextCursor);}}catch(e){if(active()){setItems([]);setNext(null);failure(e);}}finally{if(active())setBusy(false);}
 }
 async function inspect(){if(disabled||busy||!selected)return;reset();setBusy(true);const n=++ticket.current,captured=buffer,active=()=>alive.current&&ticket.current===n&&current.current.buffer===captured&&!current.current.disabled;
  try{const value=await readBaselineDesign(client,captured,session,index,selected.id,version,active);if(active())setPreview({captured,value});}catch(e){if(active())failure(e);}finally{if(active())setBusy(false);}
 }
 function apply(remove=false){if(disabled||busy||!remove&&(!preview||preview.captured!==buffer))return;try{onApply(buffer,setBaselineDesign(buffer,session,index,remove?null:preview!.value.ref));reset();setOpen(false);}catch(e){failure(e);}}
 return<section aria-label={'기능 '+(index+1)+' 설계 문서 선택'}><button type="button" disabled={disabled||busy} onClick={()=>void list()}>설계 문서 선택</button>{buffer.input.items[index]?.designRef?<button type="button" disabled={disabled||busy} onClick={()=>apply(true)}>이 항목의 설계 연결 해제</button>:null}
 {open?<><h4>이 프로젝트의 설계 버전 선택</h4><button type="button" onClick={()=>{reset();setOpen(false);}}>설계 선택 닫기</button><p className="meta">AF02와 보호 원문·hash를 확인한 참조만 연결합니다. 기준선 저장·검토·채택과 현재 실행 권한은 별도입니다.</p><ul>{items.map(d=><li key={d.id}><button type="button" disabled={disabled||busy} onClick={()=>{reset();setSelected(d);setVersion(String(d.headVersion));}}>설계 후보: {d.title}</button> · 최신 v{d.headVersion}</li>)}</ul>{next?<button type="button" disabled={disabled||busy} onClick={()=>void list(next)}>설계 후보 다음 목록</button>:null}{selected?<><label htmlFor={id}>설계 후보 버전</label><input id={id} inputMode="numeric" value={version} disabled={disabled||busy} onChange={e=>{reset();setVersion(e.target.value);}}/><button type="button" disabled={disabled||busy} onClick={()=>void inspect()}>설계 원문·양식 확인</button></>:null}
 {busy?<p role="status">설계 원문 확인 중</p>:null}{error?<p role="alert">{error.code} · 기존 연결과 입력은 보존했습니다.</p>:null}{preview&&preview.captured===buffer?<><p>{preview.value.title} · v{preview.value.ref.version} · {preview.value.confirmed?'문서 확정 이력 있음':'문서 미확정'}</p><code>{preview.value.ref.contentHash}</code><pre aria-label="연결할 설계 원문">{preview.value.body}</pre><button type="button" disabled={disabled||busy} onClick={()=>apply()}>확인한 설계 버전 연결</button></>:null}</>:null}</section>;
}
