import{useEffect,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import{readTrace,type TraceView,type TraceRef}from'./trace-api.ts';
import type{PlanRef}from'./work-plan-api.ts';
import type { DesignAnchorSelection } from './design-anchor.ts';
import { traceAnchorSelection } from './trace-anchor-selection.ts';
import { TraceMissingLinks } from './TraceMissingLinks.tsx';
import {TracePlanTaskOriginal} from './TracePlanTaskOriginal.tsx';
import type {ScreenRegion} from './design-index-api.ts';
import {TraceScreenLink} from './TraceScreenLink.tsx';
const key=(r:TraceRef)=>[r.kind,r.id,r.versionRef.version,r.versionRef.contentHash,r.localCode??'',r.anchor??''].join(':');
export function TraceViewer({client,projectId,designRef,bodyHash,onAnchorSelect,onScreenOpen,onAuthenticationLost}:{client:ApiClient;projectId:string;designRef:PlanRef;bodyHash?:string;onAnchorSelect?:(selection:DesignAnchorSelection|null)=>void;onScreenOpen?:(source:PlanRef,region:ScreenRegion)=>void;onAuthenticationLost:()=>void}){
 const[value,setValue]=useState<TraceView|null>(null),[direction,setDirection]=useState<'FORWARD'|'REVERSE'>('FORWARD'),[cursor,setCursor]=useState<string|null>(null),[reload,setReload]=useState(0),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(true);
 const[planTarget,setPlanTarget]=useState<TraceRef|null>(null);
 const{id,version,contentHash}=designRef;
 useEffect(()=>{let current=true;setLoading(true);setError(null);readTrace(client,projectId,{id,version,contentHash},direction,cursor).then(v=>{if(current)setValue(old=>cursor&&old?{...v,nodes:[...new Map([...old.nodes,...v.nodes].map(n=>[key(n.ref),n])).values()],edges:[...new Map([...old.edges,...v.edges].map(e=>[e.id,e])).values()],traversal:[...new Map([...old.traversal,...v.traversal].map(t=>[t.edgeId,t])).values()]}:v);}).catch(cause=>{if(!current)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setValue(null);setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[client,projectId,id,version,contentHash,direction,cursor,reload]);
 const title=(r:TraceRef)=>value?.nodes.find(n=>key(n.ref)===key(r))?.title??r.id;
 const anchors=(endpoints:TraceRef[])=>endpoints.map(endpoint=>{
  if(endpoint.kind==='PLAN_TASK')return <button key={key(endpoint)} disabled={loading} onClick={()=>setPlanTarget(structuredClone(endpoint))}>{endpoint.localCode} 연결 계획 업무 원문 보기</button>;
  if(endpoint.kind==='SCREEN_REGION'&&onScreenOpen)return <TraceScreenLink key={'screen:'+key(endpoint)} client={client} projectId={projectId} sourceRef={designRef} target={endpoint} disabled={loading} onScreenOpen={onScreenOpen} onUnavailable={e=>{setValue(null);setPlanTarget(null);setError(e);if(e.status===401)onAuthenticationLost();}}/>;
  const selection=bodyHash&&onAnchorSelect?traceAnchorSelection({projectId,documentRef:designRef,bodyHash},endpoint):null;
  return selection&&onAnchorSelect?<button key={key(endpoint)} disabled={loading} onClick={()=>onAnchorSelect(selection)}>{endpoint.localCode} 연결 설계 원문 보기</button>:null;
 });
 return <section className="status-card" aria-label="설계·업무 연결 조회"><h3>설계·업무 연결 조회</h3><p className="meta">원문과 계획 버전의 실제 저장 연결입니다. 연결 자체는 구현/실행/시험 합격이 아니며 기준 활성화도 아닙니다.</p><label htmlFor="trace-direction">추적 방향</label><select id="trace-direction" disabled={loading} value={direction} onChange={e=>{setPlanTarget(null);setValue(null);setCursor(null);setDirection(e.target.value as typeof direction);}}><option value="FORWARD">정방향</option><option value="REVERSE">역방향</option></select><button disabled={loading} onClick={()=>{setPlanTarget(null);setValue(null);setCursor(null);setReload(n=>n+1);}}>업무 연결 새로고침</button>
  {loading?<p role="status">원문·업무 연결 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
  {value&&planTarget?<TracePlanTaskOriginal key={JSON.stringify([projectId,designRef,planTarget])} client={client} projectId={projectId} target={planTarget} context={bodyHash?{projectId,documentRef:designRef,bodyHash}:null} onClose={()=>setPlanTarget(null)} onAnchorSelect={onAnchorSelect} onScreenOpen={onScreenOpen} onUnavailable={e=>{setValue(null);setPlanTarget(null);setError(e);if(e.status===401)onAuthenticationLost();}}/>:null}
  {value?<><p>{direction==='FORWARD'?'정방향 · 같은 저장 연결':'역방향 · 같은 저장 연결'}</p><p>실제 실행/시험 증거는 아직 미연결</p><p className="meta">기준 활성화 없음 · 관측 {new Date(value.observedAt).toLocaleString('ko-KR')}</p>{!value.edges.length?<p>저장된 업무 연결이 없습니다. 완료나 영향 없음이 아닙니다.</p>:<ul>{value.traversal.map(t=>{const e=value.edges.find(e=>e.id===t.edgeId)!;return <li key={e.id}><strong>{title(t.from)} → {title(t.to)}</strong><p>{t.from.localCode??t.from.kind} v{t.from.versionRef.version} → {t.to.localCode??t.to.kind} v{t.to.versionRef.version} · {e.relation}</p><p>{e.reason}</p>{anchors([t.from,t.to])}<p className="meta">연결 {e.id} · SHA256 {e.edgeHash}</p></li>;})}</ul>}<TraceMissingLinks projectId={projectId} documentRef={designRef} bodyHash={bodyHash} missingLinks={value.missingLinks} loading={loading} onAnchorSelect={onAnchorSelect}/><ul>{value.unknownEvidence.map(i=><li key={i.code}>{i.code}</li>)}</ul>{value.hasMore?<button disabled={loading} onClick={()=>setCursor(value.nextCursor)}>다음 업무 연결 더 보기</button>:null}</>:null}
 </section>;
}
