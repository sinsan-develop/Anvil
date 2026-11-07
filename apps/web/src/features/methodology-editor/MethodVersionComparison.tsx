import {useEffect,useMemo,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {MethodVersion} from './api.ts';
import {readProjectMethodAtVersion} from './project-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {compareDocumentBodies} from '../design-trace/document-version-comparison.ts';

// 비교 전용 표현이다. 그래프 hash를 이름/목적의 hash나 의미 적합 판정으로 확대하지 않는다.
const text=(v:MethodVersion)=>JSON.stringify(JSON.parse(ordered({name:v.name,purpose:v.purpose,graph:v.graph})),null,2);
export function MethodVersionComparison({client,projectId,base,maxVersion,onAuthenticationLost}:{client:ApiClient;projectId:string;base:MethodVersion;maxVersion:number;onAuthenticationLost:()=>void}){
 const [version,setVersion]=useState(String(Math.max(1,base.ref.version-1))),[result,setResult]=useState<MethodVersion|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const requested=Number(version),valid=Number.isSafeInteger(requested)&&requested>=1&&requested<=maxVersion;
 const comparison=useMemo(()=>result?compareDocumentBodies(text(base),text(result)):null,[base,result]);
 async function compare(){
  if(!valid||loading)return;const request=++generation.current;setLoading(true);setResult(null);setError(null);
  try{const value=await readProjectMethodAtVersion(client,projectId,base.ref.id,requested);if(request===generation.current)setResult(value);}
  catch(cause){if(request!==generation.current)return;const next=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(next);if(next.status===401)onAuthenticationLost();}
  finally{if(request===generation.current)setLoading(false);}
 }
 return <section className="status-card" aria-label="저장 방법론 버전 비교"><h3>저장 방법론 버전 비교</h3><p>기준 v{base.ref.version} · {base.name}</p>
  <label>비교할 방법론 버전<input type="number" min="1" max={maxVersion} value={version} onChange={e=>{generation.current++;setVersion(e.target.value);setResult(null);setError(null);setLoading(false);}}/></label>
  <button disabled={!valid||loading} onClick={()=>void compare()}>저장 방법론 버전 비교</button>
  {loading?<p role="status">비교할 저장 방법론 무결성 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
  {result&&comparison?<><p>기준 v{base.ref.version} ↔ 비교 v{result.ref.version} · {result.name}</p><details><summary>식별 정보와 비교 범위</summary><p className="meta">기준 {base.ref.id} · v{base.ref.version} · 그래프 SHA256 {base.ref.contentHash}</p><p className="meta">비교 {result.ref.id} · v{result.ref.version} · 그래프 SHA256 {result.ref.contentHash}</p><p>서버에서 조회한 이름·목적·절차 구조를 키 정렬한 JSON으로 비교합니다. 공통 앞뒤 줄을 제외한 차이 포함 구간이며 최소 편집 diff가 아닙니다. 검토·확정·적용 이력이나 의미 적합을 비교하지 않고 미저장 입력·명령을 바꾸지 않습니다.</p></details>
   {comparison.kind==='IDENTICAL'?<p>두 버전의 표시 내용이 같습니다. 검토·확정·적용 상태가 같다는 뜻은 아닙니다.</p>:comparison.kind==='UNVERIFIED'?<p role="status">비교 미확인 · 각 표시 원문 131072자/4000줄 한도 초과. 기존 원본 조회는 유지합니다.</p>:<><p className="meta">공통 앞 {comparison.commonBeforeLines}줄 · 뒤 {comparison.commonAfterLines}줄 제외</p><h4>기준 v{base.ref.version}의 차이 포함 구간</h4><pre aria-label="기준 방법론 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.before}</pre><h4>비교 v{result.ref.version}의 차이 포함 구간</h4><pre aria-label="비교 방법론 차이 구간" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comparison.after}</pre></>}
  </>:null}
 </section>;
}
