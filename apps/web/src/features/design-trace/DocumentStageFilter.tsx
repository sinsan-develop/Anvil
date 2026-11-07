import {useEffect,useId,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocumentStageOptions,type StageNodeRef,type StageOptions} from './stage-api.ts';
export function DocumentStageFilter({client,projectId,formRef,disabled,onSelect,onAuthenticationLost}:{client:ApiClient;projectId:string;formRef:StageOptions['formRef'];disabled:boolean;onSelect:(value:{ref:StageNodeRef;name:string})=>void;onAuthenticationLost:()=>void}){
 const id=useId(),live=useRef(true),flight=useRef(false),attempt=useRef(0),[page,setPage]=useState<StageOptions|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;attempt.current++;};},[]);
 async function load(){
  if(disabled||flight.current)return;const n=++attempt.current;flight.current=true;setBusy(true);setPage(null);setError(null);
  try{const value=await readDocumentStageOptions(client,projectId,formRef);if(live.current&&n===attempt.current)setPage(value);}
  catch(cause){if(live.current&&n===attempt.current){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID');if(e.status===401)onAuthenticationLost();}}
  finally{flight.current=false;if(live.current&&n===attempt.current)setBusy(false);}
 }
 return <section aria-label="문서 목록 단계 찾기"><button type="button" disabled={disabled||busy} onClick={()=>void load()}>이 문서 양식의 적용 단계 조회</button>
  <p className="meta">열린 문서의 정확 양식 버전이 정의된 단계만 조회합니다. 단계 선택은 문서 목록 조건이며 문서 연결/방법론·편집 입력을 변경하지 않습니다.</p>
  {busy?<p role="status">양식의 적용 단계 조회 중 · 이전 선택 숨김</p>:null}{error?<p role="alert">{error} · 단계 선택 미확인</p>:null}
  {page&&!disabled?<><p>{page.methodologyName??'적용 방법론 없음'} · 관측 {page.observedAt} · 현재 실행 단계 판정 아님</p>{page.items.length?<><label htmlFor={id}>문서를 찾을 개발 단계</label><select id={id} value="" disabled={busy} onChange={e=>{const selected=page.items.find(item=>item.stageNodeRef.nodeId===e.target.value);if(selected&&!disabled&&!busy)onSelect({ref:{...selected.stageNodeRef},name:selected.nodeName});}}><option value="">조회 단계 선택</option>{page.items.map(item=><option key={item.stageNodeRef.nodeId} value={item.stageNodeRef.nodeId}>{item.nodeName}</option>)}</select></>:<p>{page.status==='NO_APPLICATION'?'현재 적용 방법론이 없습니다.':'이 양식 버전이 연결된 단계가 없습니다.'} 전체 문서 목록은 유지합니다.</p>}</>:null}
 </section>;
}
