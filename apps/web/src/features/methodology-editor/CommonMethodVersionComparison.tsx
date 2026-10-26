import {useEffect,useMemo,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {MethodSummary,MethodVersion} from './api.ts';
import {readCommonMethodAtVersion} from './common-method-version-read.ts';
import {ordered} from '../knowledge/review-view.ts';
import {compareDocumentBodies} from '../design-trace/document-version-comparison.ts';
const text=(v:MethodVersion)=>JSON.stringify(JSON.parse(ordered({name:v.name,purpose:v.purpose,graph:v.graph})),null,2);
export interface CommonMethodCopyAccess{context:object;current:()=>boolean;disabled:boolean;onSelect:(value:MethodVersion,current:()=>boolean)=>void;onInvalidate:()=>void}
export function CommonMethodVersionComparison({client,selected,base,onAuthenticationLost,copyAccess}:{client:ApiClient;selected:MethodSummary;base:MethodVersion;onAuthenticationLost:()=>void;copyAccess?:CommonMethodCopyAccess}){
 const generation=useRef(0),liveScope=useRef<{client:ApiClient;transport:typeof fetch;base:MethodVersion;selected:string;owner:object|null}|null>(null);
 const selectedBinding=JSON.stringify([selected.ref,selected.scope,selected.systemCode,selected.name,selected.purpose]);
 if(!liveScope.current||liveScope.current.client!==client||liveScope.current.transport!==client.transport||liveScope.current.base!==base||liveScope.current.selected!==selectedBinding||liveScope.current.owner!==(copyAccess?.context??null)){generation.current++;liveScope.current={client,transport:client.transport,base,selected:selectedBinding,owner:copyAccess?.context??null};}
 const scope=liveScope.current;
 const [version,setVersion]=useState(String(Math.max(1,base.ref.version-1))),[resultState,setResult]=useState<{value:MethodVersion;scope:typeof scope;request:number}|null>(null),[errorState,setError]=useState<{error:ApiError;scope:typeof scope}|null>(null),[work,setWork]=useState<{scope:typeof scope;request:number}|null>(null);
 const current=(request:number)=>liveScope.current===scope&&client.transport===scope.transport&&generation.current===request;
 const result=resultState&&resultState.scope===scope&&current(resultState.request)?resultState.value:null,error=errorState?.scope===scope?errorState.error:null,loading=work?.scope===scope&&current(work.request);

 useEffect(()=>()=>{generation.current++;},[]);
 const requested=Number(version),valid=Number.isSafeInteger(requested)&&requested>=1&&requested<=selected.ref.version;
 const comparison=useMemo(()=>result?compareDocumentBodies(text(base),text(result)):null,[base,result]);
 async function compare(){
  if(!valid||loading)return;const request=++generation.current;copyAccess?.onInvalidate();setWork({scope,request});setResult(null);setError(null);
  try{
   if(base.ref.id!==selected.ref.id||base.ref.version!==selected.ref.version||base.ref.contentHash!==selected.ref.contentHash||base.scope!==selected.scope||base.systemCode!==selected.systemCode)throw new ApiError('RESPONSE_INVALID');
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(base.graph))))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(!current(request))return;if(hash!==base.ref.contentHash)throw new ApiError('RESPONSE_INVALID');
   const value=await readCommonMethodAtVersion(client,selected,requested);if(current(request))setResult({value,scope,request});
  }catch(cause){if(!current(request))return;const next=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError({error:next,scope});if(next.status===401)onAuthenticationLost();}
  finally{if(current(request))setWork(null);}
 }
 return <section className="status-card" aria-label="공통 저장 방법론 버전 비교"><h3>공통 저장 방법론 버전 비교</h3><p>기준 v{base.ref.version} · {base.name}</p>
  <label>비교할 공통 방법론 버전<input type="number" min="1" max={selected.ref.version} value={version} onChange={e=>{generation.current++;copyAccess?.onInvalidate();setVersion(e.target.value);setResult(null);setError(null);setWork(null);}}/></label><button disabled={!valid||loading} onClick={()=>void compare()}>공통 저장 버전 비교</button>
  {loading?<p role="status">공통 저장본 무결성 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
  {result&&comparison?<>{copyAccess&&result.scope==='USER_COMMON'?<button disabled={copyAccess.disabled||!copyAccess.current()} onClick={()=>{const selectedResult=resultState;if(!selectedResult)return;const selectedCurrent=()=>current(selectedResult.request)&&liveScope.current===selectedResult.scope&&copyAccess.current();if(selectedCurrent())copyAccess.onSelect(selectedResult.value,selectedCurrent);}}>이 버전을 복사 원본으로 선택</button>:null}<p>기준 v{base.ref.version} ↔ 비교 v{result.ref.version} · {result.name}</p><details><summary>공통 비교 식별 정보와 범위</summary><p className="meta">기준 {base.ref.id} · v{base.ref.version} · 그래프 SHA256 {base.ref.contentHash}</p><p className="meta">비교 {result.ref.id} · v{result.ref.version} · 그래프 SHA256 {result.ref.contentHash}</p><p>이름·목적·절차 구조를 키 정렬한 JSON의 차이 포함 구간으로 표시합니다. 최소 편집 diff나 의미 적합 판정이 아니며, 그래프 hash를 이름·목적까지 인증한 것으로 확대하지 않습니다. 검토·확정·적용 이력은 별도이고 미저장 입력·명령은 바꾸지 않습니다.</p></details>
   {comparison.kind==='IDENTICAL'?<p>두 저장본의 표시 내용이 같습니다. 검토·확정·적용 상태가 같다는 뜻은 아닙니다.</p>:comparison.kind==='UNVERIFIED'?<p role="status">비교 미확인 · 각 표시 원문 131072자/4000줄 한도 초과. 기존 원본 조회는 유지합니다.</p>:<><p className="meta">공통 앞 {comparison.commonBeforeLines}줄 · 뒤 {comparison.commonAfterLines}줄 제외</p><h4>기준 v{base.ref.version} 차이 포함 구간</h4><pre aria-label="기준 공통 방법론 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.before}</pre><h4>비교 v{result.ref.version} 차이 포함 구간</h4><pre aria-label="비교 공통 방법론 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.after}</pre></>}
  </>:null}
 </section>;
}
