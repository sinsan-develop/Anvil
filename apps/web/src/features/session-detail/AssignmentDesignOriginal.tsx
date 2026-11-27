import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {DesignAnchorOriginal} from '../design-trace/DesignAnchorOriginal.tsx';
import type {DesignAnchorSelection} from '../design-trace/design-anchor.ts';
import type {ScreenRegion} from '../design-trace/design-index-api.ts';
import {traceAnchorSelection} from '../design-trace/trace-anchor-selection.ts';
import type {TraceRef} from '../design-trace/trace-api.ts';
import {readTraceScreenRegion} from '../design-trace/trace-screen-region.ts';
import type {WorkPlanView} from '../design-trace/work-plan-api.ts';
import {readAssignmentDesignOriginal} from './assignment-design-original.ts';
import {assignmentPlanDesignTrace} from './assignment-plan-design-trace.ts';
import type {SessionDetail} from './api.ts';
type Original=Awaited<ReturnType<typeof readAssignmentDesignOriginal>>;
export function AssignmentDesignOriginal({client,detail,plan,isPlanCurrent,onAuthenticationLost}:{client:ApiClient;detail:Pick<SessionDetail,'projectId'|'draft'|'confirmed'>;plan?:WorkPlanView;isPlanCurrent:()=>boolean;onAuthenticationLost:()=>void}){
 const latest=useRef<number|null>(null),sequence=useRef(0),living=useRef(false);
 const [request,setRequest]=useState<number|null>(null),[loaded,setLoaded]=useState<{request:number;value:Original|null;error:ApiError|null}|null>(null);
 const shown=loaded?.request===request?loaded:null;
 useLayoutEffect(()=>{living.current=true;return()=>{living.current=false;};},[]);
 const active=()=>living.current&&isPlanCurrent();
 const close=()=>{latest.current=null;setRequest(null);};
 async function open(){
  if(!active())return;
  const attempt=++sequence.current;
  latest.current=attempt;setRequest(attempt);
  const current=()=>active()&&latest.current===attempt;
  try{
   const value=await readAssignmentDesignOriginal(client,detail,current);
   if(current())setLoaded({request:attempt,value,error:null});
  }catch(cause){
   if(!current())return;
   const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setLoaded({request:attempt,value:null,error});
   if(error.status===401)onAuthenticationLost();
  }
 }
 return <section aria-label="고정 임무 설계 원문"><h4>임무의 원 설계서</h4><p>확정 임무와 원초안에 고정된 설계 버전만 읽습니다. 현재 기준 적용·권한·실행 준비 확인이 아닙니다.</p>
  <button type="button" onClick={()=>void open()}>{request?'고정 설계 원문 다시 조회':'고정 설계 원문 보기'}</button>
  {request?<button type="button" onClick={close}>설계 원문 조회 닫기</button>:null}
  {request&&!shown?<p role="status">고정 설계 원문 확인 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.code} · 설계 원문 미확인. 이전 본문은 표시하지 않습니다.</p>:null}
  {shown?.value?<article><h5>{shown.value.document.title}</h5><p>{shown.value.document.id} · v{shown.value.document.version} · {shown.value.document.contentHash}</p><p>저장된 확정 이력: {shown.value.document.confirmed?'있음':'없음'} · 현재 내용 검토·적용 효력은 미확인</p>
   {plan?<AssignmentDesignTrace key={shown.request} client={client} projectId={detail.projectId} plan={plan} taskCode={detail.draft.snapshot.basis.taskCode} original={shown.value}
     isCurrent={()=>active()&&latest.current===shown.request} onAuthenticationLost={onAuthenticationLost}/>:<pre>{shown.value.body}</pre>}
  </article>:null}
 </section>;
}

type NextPage=ReturnType<typeof assignmentPlanDesignTrace>;
type TracePage=Awaited<ReturnType<NextPage>>;
function AssignmentDesignTrace({client,projectId,plan,taskCode,original,isCurrent,onAuthenticationLost}:{client:ApiClient;projectId:string;plan:WorkPlanView;taskCode:string;original:Original;isCurrent:()=>boolean;onAuthenticationLost:()=>void}){
 const {id,version,contentHash,content}=original.document,designRef={id,version,contentHash};
 const context={projectId,documentRef:designRef,bodyHash:content.body.contentHash};
 const living=useRef(false),working=useRef(false),next=useRef<NextPage|null>(null),latestPage=useRef<TracePage>(null);
 const [busy,setBusy]=useState(false),[page,setPage]=useState<TracePage>(null),[error,setError]=useState<string|null>(null);
 const [selection,setSelection]=useState<DesignAnchorSelection|null>(null),[region,setRegion]=useState<ScreenRegion|null>(null);
 useLayoutEffect(()=>{living.current=true;return()=>{living.current=false;};},[]);
 const current=()=>living.current&&isCurrent();
 const pageCurrent=()=>current()&&page!==null&&latestPage.current===page;
 const showPage=(value:TracePage)=>{latestPage.current=value;setPage(value);};

 async function run(load:()=>Promise<void>){
  if(!current()||working.current)return;
  working.current=true;setBusy(true);setError(null);setSelection(null);setRegion(null);
  try{await load();}catch(cause){
   if(!current())return;
   const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   next.current=null;showPage(null);setError(failure.code);
   if(failure.status===401)onAuthenticationLost();
  }finally{working.current=false;if(current())setBusy(false);}
 }
 async function readPage(first:boolean){
  if(!first&&(!pageCurrent()||!page?.hasMore))return;
  await run(async()=>{
   if(first)next.current=assignmentPlanDesignTrace(client,projectId,plan,taskCode,designRef,current);
   const read=next.current;
   showPage(null);
   const value=await read?.();
   if(current()&&value)showPage(value);
  });
 }
 async function readScreen(target:TraceRef){
  if(!pageCurrent())return;
  await run(async()=>{
   const value=await readTraceScreenRegion(client,projectId,designRef,target,pageCurrent);
   if(pageCurrent()&&value)setRegion(value);
  });
 }
 return <>
  <button type="button" disabled={busy} onClick={()=>void readPage(true)}>고정 업무의 설계 연결 조회</button>
  {busy?<p role="status">고정 연결 확인 중</p>:null}
  {error?<p role="alert">{error} · 고정 업무의 설계 연결 확인 실패</p>:null}
  {page?<><p>실제 실행·시험 근거 미확인</p>
   {page.matches.length?<ul>{page.matches.map(({target,title,edgeId,edgeHash})=>{
    const anchor=traceAnchorSelection(context,target);
    return <li key={edgeId}><p>{title} · {target.localCode} · {edgeHash}</p>
     {anchor?<button type="button" disabled={busy} onClick={()=>{if(pageCurrent()&&!working.current){setRegion(null);setSelection(anchor);}}}>{target.localCode} 원 설계 위치 보기</button>:
      target.kind==='SCREEN_REGION'?<button type="button" disabled={busy} onClick={()=>void readScreen(target)}>{target.localCode} 등록 시안 위치 확인</button>:null}
    </li>;
   })}</ul>:!page.hasMore?<p>확인한 페이지에서 일치하는 연결 없음</p>:null}
   {page.hasMore?<button type="button" disabled={busy} onClick={()=>void readPage(false)}>다음 설계 연결 페이지</button>:null}
  </>:null}
  {region?<p role="status">등록 시안 위치 · {region.screenCode} · v{region.documentRef.version} · {region.anchor.slice(5)}줄 · {region.documentRef.id} · {region.documentRef.contentHash}</p>:null}
  <DesignAnchorOriginal body={original.body} context={context} selection={selection} onClear={()=>setSelection(null)}/>
 </>;
}
