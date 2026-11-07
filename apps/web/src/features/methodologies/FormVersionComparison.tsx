import {useEffect,useMemo,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {FormVersion} from './forms-api.ts';
import {readFormAtVersion} from './form-version-read.ts';
import {ordered} from '../knowledge/review-view.ts';
import {compareDocumentBodies} from '../design-trace/document-version-comparison.ts';
const display=(value:FormVersion)=>JSON.stringify(JSON.parse(ordered(value.definition)),null,2);
export interface FormCopyAccess{context:object;current:()=>boolean;disabled:boolean;onSelect:(value:FormVersion,current:()=>boolean)=>void;onInvalidate:()=>void}
export function FormVersionComparison({client,base,onAccessLost,copyAccess}:{client:ApiClient;base:FormVersion;onAccessLost:(cause:ApiError)=>void;copyAccess?:FormCopyAccess}){
 const generation=useRef(0),liveScope=useRef<{client:ApiClient;transport:typeof fetch;base:FormVersion;binding:string;owner:object|null}|null>(null);
 const binding=JSON.stringify(base.ref);
 if(!liveScope.current||liveScope.current.client!==client||liveScope.current.transport!==client.transport||liveScope.current.base!==base||liveScope.current.binding!==binding||liveScope.current.owner!==(copyAccess?.context??null)){generation.current++;liveScope.current={client,transport:client.transport,base,binding,owner:copyAccess?.context??null};}
 const scope=liveScope.current;
 const [version,setVersion]=useState(String(Math.max(1,base.ref.version-1))),[resultState,setResult]=useState<{value:FormVersion;scope:typeof scope;request:number}|null>(null),[errorState,setError]=useState<{error:ApiError;scope:typeof scope}|null>(null),[work,setWork]=useState<{scope:typeof scope;request:number}|null>(null);
 const current=(request:number)=>liveScope.current===scope&&client.transport===scope.transport&&JSON.stringify(base.ref)===scope.binding&&generation.current===request;
 const result=resultState&&resultState.scope===scope&&current(resultState.request)?resultState.value:null,error=errorState?.scope===scope?errorState.error:null,loading=work?.scope===scope&&current(work.request);
 useEffect(()=>()=>{generation.current++;},[]);
 const requested=Number(version),valid=/^[1-9][0-9]*$/.test(version)&&Number.isSafeInteger(requested)&&requested<=base.ref.version;
 const comparison=useMemo(()=>result?compareDocumentBodies(display(base),display(result)):null,[base,result]);
 async function compare(){
  if(!valid||loading)return;const request=++generation.current;copyAccess?.onInvalidate();setWork({scope,request});setResult(null);setError(null);
  try{const value=await readFormAtVersion(client,base,requested);if(current(request))setResult({value,scope,request});}
  catch(cause){if(!current(request))return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError({error:failure,scope});if(failure.status===401||failure.status===403)onAccessLost(failure);}
  finally{if(current(request))setWork(null);}
 }
 return <section className="status-card" aria-label="저장 양식 버전 비교"><h3>저장 양식 버전 비교</h3><p>기준 v{base.ref.version} · {base.definition.name}</p>
  <label>비교할 양식 버전<input type="number" min="1" max={base.ref.version} value={version} onChange={event=>{generation.current++;copyAccess?.onInvalidate();setVersion(event.target.value);setResult(null);setError(null);setWork(null);}}/></label>
  <button disabled={!valid||loading} onClick={()=>void compare()}>저장 양식 비교</button>
  {loading?<p role="status">저장 양식·작성 기준 무결성 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
  {result&&comparison?<>{copyAccess&&result.definition.scope==='USER_COMMON'?<button disabled={copyAccess.disabled||!copyAccess.current()} onClick={()=>{const selected=resultState;if(!selected)return;const selectedCurrent=()=>current(selected.request)&&liveScope.current===selected.scope&&copyAccess.current();if(selectedCurrent())copyAccess.onSelect(selected.value,selectedCurrent);}}>이 버전을 복사 원본으로 선택</button>:null}<p>기준 v{base.ref.version} ↔ 비교 v{result.ref.version} · {result.definition.name}</p>
   <details><summary>양식 비교 식별 정보와 범위</summary><p className="meta">기준 {base.ref.id} · v{base.ref.version} · SHA256 {base.ref.contentHash}</p><p className="meta">비교 {result.ref.id} · v{result.ref.version} · SHA256 {result.ref.contentHash}</p><p>정의 전체를 키 정렬한 JSON의 차이 포함 구간입니다. 이름·목적·항목·작성/검수 규칙·역할과 작성 기준 참조를 포함합니다. 정의 및 각 작성 기준 바이트 hash만 대조하며 의미 적합·현재 확정/권한이나 실제 시험을 인증하지 않습니다. 최소 편집 diff가 아니며 미저장 편집·검토·명령은 바꾸지 않습니다.</p></details>
   {comparison.kind==='IDENTICAL'?<p>두 저장 양식의 정의가 같습니다. 검토·확정 이력이 같다는 뜻은 아닙니다.</p>:comparison.kind==='UNVERIFIED'?<p role="status">비교 미확인 · 표시 원문 131072자/4000줄 한도 초과. 기존 최신 원본 조회는 유지합니다.</p>:<><h4>기준 v{base.ref.version} 차이 포함 구간</h4><pre aria-label="기준 양식 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.before}</pre><h4>비교 v{result.ref.version} 차이 포함 구간</h4><pre aria-label="비교 양식 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.after}</pre></>}
   <details><summary>비교 버전 작성 기준 원문</summary><p className="meta">{result.authoringStandard.ref.id} · v{result.authoringStandard.ref.version} · {result.authoringStandard.ref.contentHash}</p><pre aria-label="비교 양식 작성 기준 원문">{result.authoringStandard.content}</pre></details>
  </>:null}
 </section>;
}
