import{useEffect,useLayoutEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import{readTrace,type TraceView,type TraceRef}from'./trace-api.ts';
import type{PlanRef}from'./work-plan-api.ts';
import type { DesignAnchorSelection } from './design-anchor.ts';
import { traceAnchorSelection } from './trace-anchor-selection.ts';
import { TraceMissingLinks } from './TraceMissingLinks.tsx';
import {TracePlanTaskOriginal} from './TracePlanTaskOriginal.tsx';
import {TraceDocumentOriginal} from './TraceDocumentOriginal.tsx';
import {readTraceArtifactOriginal} from './trace-artifact-original.ts';
import type {ScreenRegion} from './design-index-api.ts';
import {TraceScreenLink} from './TraceScreenLink.tsx';
import {traceReferenceKey as key} from './trace-reference-key.ts';
import {TraceTaskEvidence} from './TraceTaskEvidence.tsx';
type TraceViewerProps={client:ApiClient;projectId:string;designRef:PlanRef;bodyHash?:string;onAnchorSelect?:(selection:DesignAnchorSelection|null)=>void;onScreenOpen?:(source:PlanRef,region:ScreenRegion)=>void;onAuthenticationLost:()=>void};
export function TraceViewer(props:TraceViewerProps){
 const {client,projectId,designRef:{id,version,contentHash},bodyHash}=props;
 const binding=JSON.stringify([projectId,id,version,contentHash,bodyHash]);
 const transport=client.transport;
 const [scope,setScope]=useState({client,transport,binding,epoch:0});
 if(scope.client!==client||scope.transport!==transport||scope.binding!==binding){
  // 새 렌더가 커밋될 때만 이전 조회의 소유권을 끝낸다.
  setScope({client,transport,binding,epoch:scope.epoch+1});
  return null;
 }
 return <TraceScope key={scope.epoch} {...props} transport={scope.transport}/>;
}

function TraceScope({client,projectId,designRef,bodyHash,onAnchorSelect,onScreenOpen,onAuthenticationLost,transport}:TraceViewerProps&{transport:ApiClient['transport']}){
 const mounted=useRef(false);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const live=()=>mounted.current&&client.transport===transport;
 const[value,setValue]=useState<TraceView|null>(null),[direction,setDirection]=useState<'FORWARD'|'REVERSE'>('FORWARD'),[cursor,setCursor]=useState<string|null>(null),[reload,setReload]=useState(0),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(true);
 const[planTarget,setPlanTarget]=useState<TraceRef|null>(null);
 const[documentTarget,setDocumentTarget]=useState<{client:ApiClient;context:string;target:TraceRef}|null>(null),documentContext=JSON.stringify([projectId,designRef,direction,reload]);
 const[artifactTarget,setArtifactTarget]=useState<{target:TraceRef;context:string;serial:number}|null>(null);
 const artifactRequest=useRef<typeof artifactTarget>(null),artifactSerial=useRef(0);
 const clearArtifact=()=>{artifactRequest.current=null;setArtifactTarget(null);};
 const{id,version,contentHash}=designRef;
 useEffect(()=>{let active=true;const current=()=>active&&live();if(!current())return;setLoading(true);setError(null);readTrace(client,projectId,{id,version,contentHash},direction,cursor).then(v=>{if(current())setValue(old=>cursor&&old?{...v,nodes:[...new Map([...old.nodes,...v.nodes].map(n=>[key(n.ref),n])).values()],edges:[...new Map([...old.edges,...v.edges].map(e=>[e.id,e])).values()],traversal:[...new Map([...old.traversal,...v.traversal].map(t=>[t.edgeId,t])).values()]}:v);}).catch(cause=>{if(!current())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setValue(null);setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(current())setLoading(false);});return()=>{active=false;};},[client,projectId,id,version,contentHash,direction,cursor,reload]);
 function unavailable(error:ApiError){
  if(!live())return;
  clearArtifact();setDocumentTarget(null);setPlanTarget(null);setValue(null);setError(error);
  if(error.status===401)onAuthenticationLost();
 }
 const selectAnchor=onAnchorSelect?(selection:DesignAnchorSelection|null)=>{if(live()){clearArtifact();onAnchorSelect(selection);}}:undefined;
 const openScreen=onScreenOpen?(source:PlanRef,region:ScreenRegion)=>{if(live()){clearArtifact();onScreenOpen(source,region);}}:undefined;
 const title=(r:TraceRef)=>value?.nodes.find(n=>key(n.ref)===key(r))?.title??r.id;
 const anchors=(endpoints:TraceRef[])=>endpoints.map(endpoint=>{
  if(endpoint.kind==='ARTIFACT')return <div key={'artifact:'+key(endpoint)}><p className="meta">등록 산출물 참조 {endpoint.id} · v{endpoint.versionRef.version} · 원본 SHA256 {endpoint.versionRef.contentHash}</p><button disabled={loading} onClick={()=>{if(!live())return;setDocumentTarget(null);setPlanTarget(null);const request={target:structuredClone(endpoint),context:documentContext,serial:++artifactSerial.current};artifactRequest.current=request;setArtifactTarget(request);}}>{title(endpoint)} 등록 산출물 텍스트 원문 보기</button></div>;
  if(endpoint.kind==='DOCUMENT_VERSION')return <button key={key(endpoint)} disabled={loading} onClick={()=>{if(!live())return;clearArtifact();setPlanTarget(null);setDocumentTarget({client,context:documentContext,target:structuredClone(endpoint)});}}>{title(endpoint)} 연결 문서 원문 보기</button>;
  if(endpoint.kind==='PLAN_TASK')return <div key={key(endpoint)}><button disabled={loading} onClick={()=>{if(!live())return;clearArtifact();setDocumentTarget(null);setPlanTarget(structuredClone(endpoint));}}>{endpoint.localCode} 연결 계획 업무 원문 보기</button><TraceTaskEvidence client={client} projectId={projectId} target={endpoint} context={documentContext} onAuthenticationLost={onAuthenticationLost}/></div>;
  if(endpoint.kind==='SCREEN_REGION'&&onScreenOpen)return <TraceScreenLink key={'screen:'+key(endpoint)} client={client} projectId={projectId} sourceRef={designRef} target={endpoint} disabled={loading} onScreenOpen={openScreen!} onUnavailable={unavailable} scopeCurrent={live}/>;
  const selection=bodyHash&&onAnchorSelect?traceAnchorSelection({projectId,documentRef:designRef,bodyHash},endpoint):null;
  return selection&&onAnchorSelect?<button key={key(endpoint)} disabled={loading} onClick={()=>selectAnchor?.(selection)}>{endpoint.localCode} 연결 설계 원문 보기</button>:null;
 });
 return <section className="status-card" aria-label="설계·업무 연결 조회"><h3>설계·업무 연결 조회</h3><p className="meta">원문과 계획 버전의 실제 저장 연결입니다. 연결 자체는 구현/실행/시험 합격이 아니며 기준 활성화도 아닙니다.</p><label htmlFor="trace-direction">추적 방향</label><select id="trace-direction" disabled={loading} value={direction} onChange={e=>{clearArtifact();setDocumentTarget(null);setPlanTarget(null);setValue(null);setCursor(null);setDirection(e.target.value as typeof direction);}}><option value="FORWARD">정방향</option><option value="REVERSE">역방향</option></select><button disabled={loading} onClick={()=>{clearArtifact();setDocumentTarget(null);setPlanTarget(null);setValue(null);setCursor(null);setReload(n=>n+1);}}>업무 연결 새로고침</button>
  {loading?<p role="status">원문·업무 연결 확인 중</p>:null}{error?<p role="alert">{error.message} · {error.code}</p>:null}
  {value&&!loading&&!error&&documentTarget?.client===client&&documentTarget.context===documentContext&&value.nodes.some(n=>key(n.ref)===key(documentTarget.target))?<TraceDocumentOriginal key={JSON.stringify([documentContext,documentTarget.target])} client={client} projectId={projectId} target={documentTarget.target} onClose={()=>setDocumentTarget(null)} onUnavailable={unavailable} scopeCurrent={live}/>:null}
  {value&&!loading&&!error&&artifactTarget&&artifactTarget.context===documentContext&&value.nodes.some(n=>key(n.ref)===key(artifactTarget.target))?<TraceArtifactOriginal key={artifactTarget.serial} client={client} projectId={projectId} target={artifactTarget.target} onClose={clearArtifact} onUnavailable={unavailable} scopeCurrent={()=>live()&&artifactRequest.current===artifactTarget}/>:null}
  {value&&planTarget?<TracePlanTaskOriginal key={JSON.stringify([projectId,designRef,planTarget])} client={client} projectId={projectId} target={planTarget} context={bodyHash?{projectId,documentRef:designRef,bodyHash}:null} onClose={()=>setPlanTarget(null)} onAnchorSelect={selectAnchor} onScreenOpen={openScreen} onUnavailable={unavailable} scopeCurrent={live}/>:null}
  {value?<><p>{direction==='FORWARD'?'정방향 · 같은 저장 연결':'역방향 · 같은 저장 연결'}</p><p>실제 실행/시험 증거는 아직 미연결</p><p className="meta">기준 활성화 없음 · 관측 {new Date(value.observedAt).toLocaleString('ko-KR')}</p>{!value.edges.length?<p>저장된 업무 연결이 없습니다. 완료나 영향 없음이 아닙니다.</p>:<ul>{value.traversal.map(t=>{const e=value.edges.find(e=>e.id===t.edgeId)!;return <li key={e.id}><strong>{title(t.from)} → {title(t.to)}</strong><p>{t.from.localCode??t.from.kind} v{t.from.versionRef.version} → {t.to.localCode??t.to.kind} v{t.to.versionRef.version} · {e.relation}</p><p>{e.reason}</p>{anchors([t.from,t.to])}<p className="meta">연결 {e.id} · SHA256 {e.edgeHash}</p></li>;})}</ul>}<TraceMissingLinks projectId={projectId} documentRef={designRef} bodyHash={bodyHash} missingLinks={value.missingLinks} loading={loading} onAnchorSelect={selectAnchor}/><ul>{value.unknownEvidence.map(i=><li key={i.code}>{i.code}</li>)}</ul>{value.hasMore?<button disabled={loading} onClick={()=>{clearArtifact();setCursor(value.nextCursor);}}>다음 업무 연결 더 보기</button>:null}</>:null}
 </section>;
}

function TraceArtifactOriginal({client,projectId,target,onClose,onUnavailable,scopeCurrent}:{client:ApiClient;projectId:string;target:TraceRef;onClose:()=>void;onUnavailable:(error:ApiError)=>void;scopeCurrent:()=>boolean}){
 const[result,setResult]=useState<Awaited<ReturnType<typeof readTraceArtifactOriginal>>|null>(null);
 const mounted=useRef(false);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let active=true;const current=()=>active&&mounted.current&&scopeCurrent();
 void readTraceArtifactOriginal(client,projectId,target,current).then(v=>{if(current())setResult(v);}).catch(cause=>{if(current())onUnavailable(cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID'));});
 return()=>{active=false;};},[client,projectId,target]);
 return <section aria-label="등록 산출물 텍스트 원문"><h4>등록 산출물 텍스트 원문</h4><button onClick={onClose}>등록 산출물 원문 닫기</button><p className="meta">명시 조회 · 최대 2MiB UTF-8 텍스트 · 파일·시험·diff의 실행 연동이나 완료 확인이 아닙니다.</p>{result?<><p>{result.ref.id} · v{result.ref.version} · SHA256 {result.ref.contentHash} · {result.bytes} bytes</p><pre>{result.body}</pre></>:<p role="status">등록 산출물 원문 확인 중</p>}</section>;
}
