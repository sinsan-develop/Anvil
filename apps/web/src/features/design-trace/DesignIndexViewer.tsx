import { useEffect,useState } from 'react';
import { ApiClient,ApiError } from '../../api/client.ts';
import { readDesignIndex,type DesignIndexView } from './design-index-api.ts';

export function DesignIndexViewer({client,projectId,documentRef,onAuthenticationLost}:{client:ApiClient;projectId:string;documentRef:DesignIndexView['documentRef'];onAuthenticationLost:()=>void}) {
  const [value,setValue]=useState<DesignIndexView|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  const {id,version,contentHash}=documentRef;
  useEffect(()=>{
    let current=true;setLoading(true);setValue(null);setError(null);
    readDesignIndex(client,projectId,{id,version,contentHash}).then(v=>{if(current)setValue(v);}).catch(cause=>{if(!current)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[client,projectId,id,version,contentHash,reload]);
  return <section className="status-card" aria-label="설계 항목·화면 위치 추적"><h3>설계 항목·화면 위치</h3><p className="meta">정확한 설계 문서 v{version}의 원문 위치 연결입니다. 구현 완료·시험 합격·Agent 실행을 의미하지 않습니다.</p><button disabled={loading} onClick={()=>setReload(n=>n+1)}>설계 추적 새로고침</button>
    {loading?<p role="status">설계 원문 위치 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}{error.code==='DESIGN_DOCUMENT_KIND_INVALID'?' · AF02 설계서에 등록한 항목만 조회합니다.':''}</p>:null}
    {value ? <><p className="meta">관측 {new Date(value.observedAt).toLocaleString('ko-KR')}</p>{!value.items.length?<p>이 설계 버전에 등록된 항목이 없습니다. 등록 화면·업무/시험 연결은 아직 연결 전입니다.</p>:<ul>{value.items.map(i=><li key={i.id}><strong>{i.localCode} · {i.title}</strong><p>원문 {i.anchor} · 항목 SHA256 {i.itemHash}</p><ul>{value.screenRegions.filter(s=>s.designItemId===i.id).map(s=><li key={s.id}>{s.screenCode} · 화면시안 v{s.documentRef.version} · {s.anchor}<p className="meta">문서 {s.documentRef.id} · 원문 SHA256 {s.artifactRef.contentHash}</p></li>)}</ul></li>)}</ul>}<p>작업계획·구현/시험 증거 연결은 아직 미구현입니다. 빈 연결을 완료나 영향 없음으로 표시하지 않습니다.</p></>:null}
  </section>;
}
