import { useEffect,useState } from 'react';
import { ApiClient,ApiError } from '../../api/client.ts';
import { readDesignIndex,type DesignIndexView } from './design-index-api.ts';
import { TraceViewer } from './TraceViewer.tsx';
import type{DesignAnchorSelection}from'./design-anchor.ts';

export function DesignIndexViewer({client,projectId,documentRef,bodyHash,onAnchorSelect,onAuthenticationLost}:{client:ApiClient;projectId:string;documentRef:DesignIndexView['documentRef'];bodyHash?:string;onAnchorSelect?:(selection:DesignAnchorSelection|null)=>void;onAuthenticationLost:()=>void}) {
  const [showTrace,setShowTrace]=useState(false);
  const [value,setValue]=useState<DesignIndexView|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  const {id,version,contentHash}=documentRef;
  useEffect(()=>{
    let current=true;setLoading(true);setValue(null);setError(null);onAnchorSelect?.(null);
    readDesignIndex(client,projectId,{id,version,contentHash}).then(v=>{if(current)setValue(v);}).catch(cause=>{if(!current)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[client,projectId,id,version,contentHash,reload]);
  return <section className="status-card" aria-label="설계 항목·화면 위치 추적"><h3>설계 항목·화면 위치</h3><p className="meta">정확한 설계 문서 v{version}의 원문 위치 연결입니다. 구현 완료·시험 합격·Agent 실행을 의미하지 않습니다.</p><button disabled={loading} onClick={()=>{onAnchorSelect?.(null);setReload(n=>n+1);}}>설계 추적 새로고침</button>
    <button disabled={loading||!!error} onClick={()=>setShowTrace(v=>!v)}>{showTrace?'업무 연결 조회 닫기':'업무 연결 조회'}</button>
    {showTrace?<TraceViewer key={id+':'+version+':'+contentHash} client={client} projectId={projectId} designRef={documentRef} onAuthenticationLost={onAuthenticationLost}/>:null}
    {loading?<p role="status">설계 원문 위치 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}{error.code==='DESIGN_DOCUMENT_KIND_INVALID'?' · AF02 설계서에 등록한 항목만 조회합니다.':''}</p>:null}
    {value ? <><p className="meta">관측 {new Date(value.observedAt).toLocaleString('ko-KR')}</p>{!value.items.length?<p>이 설계 버전에 등록된 항목이 없습니다. 문서의 설계 위치 등록에서 추가할 수 있습니다.</p>:<ul>{value.items.map(i=><li key={i.id}><strong>{i.localCode} · {i.title}</strong><button disabled={loading||!bodyHash||!onAnchorSelect} onClick={()=>{if(bodyHash)onAnchorSelect?.({projectId,documentRef:{...i.documentRef},bodyHash,anchor:i.anchor});}}>{i.localCode} 원문 위치 보기</button><p>원문 {i.anchor} · 항목 SHA256 {i.itemHash}</p><ul>{value.screenRegions.filter(s=>s.designItemId===i.id).map(s=><li key={s.id}>{s.screenCode} · 화면시안 v{s.documentRef.version} · {s.anchor}<p className="meta">문서 {s.documentRef.id} · 원문 SHA256 {s.artifactRef.contentHash}</p></li>)}</ul></li>)}</ul>}<p>작업계획 초안 작성과 저장된 업무 연결 조회를 제공합니다. 실제 실행/시험 증거는 아직 미연결이며 빈 연결은 완료나 영향 없음이 아닙니다.</p></>:null}
  </section>;
}
