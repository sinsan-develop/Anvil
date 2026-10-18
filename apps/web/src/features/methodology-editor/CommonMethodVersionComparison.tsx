import {useEffect,useMemo,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {MethodSummary,MethodVersion} from './api.ts';
import {readCommonMethodAtVersion} from './common-method-version-read.ts';
import {ordered} from '../knowledge/review-view.ts';
import {compareDocumentBodies} from '../design-trace/document-version-comparison.ts';
const text=(v:MethodVersion)=>JSON.stringify(JSON.parse(ordered({name:v.name,purpose:v.purpose,graph:v.graph})),null,2);
export function CommonMethodVersionComparison({client,selected,base,onAuthenticationLost}:{client:ApiClient;selected:MethodSummary;base:MethodVersion;onAuthenticationLost:()=>void}){
 const [version,setVersion]=useState(String(Math.max(1,base.ref.version-1))),[result,setResult]=useState<MethodVersion|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const requested=Number(version),valid=Number.isSafeInteger(requested)&&requested>=1&&requested<=selected.ref.version;
 const comparison=useMemo(()=>result?compareDocumentBodies(text(base),text(result)):null,[base,result]);
 async function compare(){
  if(!valid||loading)return;const request=++generation.current;setLoading(true);setResult(null);setError(null);
  try{
   if(base.ref.id!==selected.ref.id||base.ref.version!==selected.ref.version||base.ref.contentHash!==selected.ref.contentHash||base.scope!==selected.scope||base.systemCode!==selected.systemCode)throw new ApiError('RESPONSE_INVALID');
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(base.graph))))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(request!==generation.current)return;if(hash!==base.ref.contentHash)throw new ApiError('RESPONSE_INVALID');
   const value=await readCommonMethodAtVersion(client,selected,requested);if(request===generation.current)setResult(value);
  }catch(cause){if(request!==generation.current)return;const next=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(next);if(next.status===401)onAuthenticationLost();}
  finally{if(request===generation.current)setLoading(false);}
 }
 return <section className="status-card" aria-label="공통 저장 방법론 버전 비교"><h3>공통 저장 방법론 버전 비교</h3><p>기준 v{base.ref.version} · {base.name}</p>
  <label>비교할 공통 방법론 버전<input type="number" min="1" max={selected.ref.version} value={version} onChange={e=>{generation.current++;setVersion(e.target.value);setResult(null);setError(null);setLoading(false);}}/></label><button disabled={!valid||loading} onClick={()=>void compare()}>공통 저장 버전 비교</button>
  {loading?<p role="status">공통 저장본 무결성 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
  {result&&comparison?<><p>기준 v{base.ref.version} ↔ 비교 v{result.ref.version} · {result.name}</p><details><summary>공통 비교 식별 정보와 범위</summary><p className="meta">기준 {base.ref.id} · v{base.ref.version} · 그래프 SHA256 {base.ref.contentHash}</p><p className="meta">비교 {result.ref.id} · v{result.ref.version} · 그래프 SHA256 {result.ref.contentHash}</p><p>이름·목적·절차 구조를 키 정렬한 JSON의 차이 포함 구간으로 표시합니다. 최소 편집 diff나 의미 적합 판정이 아니며, 그래프 hash를 이름·목적까지 인증한 것으로 확대하지 않습니다. 검토·확정·적용 이력은 별도이고 미저장 입력·명령은 바꾸지 않습니다.</p></details>
   {comparison.kind==='IDENTICAL'?<p>두 저장본의 표시 내용이 같습니다. 검토·확정·적용 상태가 같다는 뜻은 아닙니다.</p>:comparison.kind==='UNVERIFIED'?<p role="status">비교 미확인 · 각 표시 원문 131072자/4000줄 한도 초과. 기존 원본 조회는 유지합니다.</p>:<><p className="meta">공통 앞 {comparison.commonBeforeLines}줄 · 뒤 {comparison.commonAfterLines}줄 제외</p><h4>기준 v{base.ref.version} 차이 포함 구간</h4><pre aria-label="기준 공통 방법론 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.before}</pre><h4>비교 v{result.ref.version} 차이 포함 구간</h4><pre aria-label="비교 공통 방법론 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.after}</pre></>}
  </>:null}
 </section>;
}
