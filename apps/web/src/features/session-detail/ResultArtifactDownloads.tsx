import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readResultArtifactDownload} from './result-artifact-api.ts';

type DownloadOwner={client:ApiClient;transport:typeof fetch;binding:string};
type DownloadRequest={owner:DownloadOwner;controller:AbortController|null};
export function ResultArtifactDownloads({client,result,session,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;result:SubmittedResultView;session:DocumentSession;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const binding=ordered({session,result}),transport=client.transport;
 const owner=useRef<DownloadOwner|null>(null),pending=useRef<DownloadRequest|null>(null);
 const [state,setState]=useState<{owner:DownloadOwner;selected:PlanRef;status:'PENDING'|'REQUESTED'|'ERROR';error?:string}|null>(null);
 const callbacks=useRef({onAuthenticationLost,onAccessUnavailable});
 useLayoutEffect(()=>{callbacks.current={onAuthenticationLost,onAccessUnavailable};},[onAuthenticationLost,onAccessUnavailable]);
 useLayoutEffect(()=>{
  const bound={client,transport,binding};owner.current=bound;
  return()=>{
   if(owner.current===bound)owner.current=null;
   const request=pending.current;
   if(request?.owner===bound){pending.current=null;request.controller?.abort();}
  };
 },[client,transport,binding]);
 const shown=state&&state.owner===owner.current&&state.owner.client===client&&state.owner.transport===transport&&state.owner.binding===binding?state:null;
 async function download(selected:PlanRef){
  const bound=owner.current;
  if(!bound||bound.client!==client||bound.transport!==transport||bound.binding!==binding)return;
  const previous=pending.current;
  pending.current=null;previous?.controller?.abort();
  if(owner.current!==bound||client.transport!==transport||pending.current)return;
  const chosen=structuredClone(selected),controller=new AbortController(),signal=controller.signal;
  const request:DownloadRequest={owner:bound,controller};
  pending.current=request;
  const current=()=>owner.current===bound&&pending.current===request&&client.transport===transport&&!signal.aborted;
  setState({owner:bound,selected:chosen,status:'PENDING'});
  try{
   const value=await readResultArtifactDownload(client,result,chosen,current,signal).finally(()=>{request.controller=null;});
   if(!current()||!value)return;
   const blob=new Blob([value.bytes],{type:'application/octet-stream'}),url=URL.createObjectURL(blob),link=document.createElement('a');
   try{if(!current())return;link.href=url;link.download=value.filename;link.hidden=true;document.body.appendChild(link);link.click();if(current())setState({owner:bound,selected:chosen,status:'REQUESTED'});}
   finally{link.remove();URL.revokeObjectURL(url);}
  }catch(cause){
   if(!current())return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_ARTIFACT_DOWNLOAD_FAILED');
   setState({owner:bound,selected:chosen,status:'ERROR',error:e.status?String(e.status):'DOWNLOAD_FAILED'});
   if([401,403,404].includes(e.status)){
    const {onAccessUnavailable,onAuthenticationLost}=callbacks.current;
    onAccessUnavailable(e.code);
    if(e.status===401&&current())onAuthenticationLost();
   }
  }finally{if(pending.current===request)pending.current=null;}
 }
 return <section className="status-card" aria-label="등록 산출물 원본 다운로드"><h5>등록 산출물 원본 다운로드</h5><p>선택 제출의 등록 파일을 20MiB 이내 원본으로 받습니다. 수행자 자료이며 시험 PASS·검수 합격을 증명하지 않습니다.</p>
  {result.snapshot.manifest.artifactRefs.length?<ul>{result.snapshot.manifest.artifactRefs.map((ref:PlanRef,index:number)=><li key={ordered(ref)+':'+index}><button type="button" disabled={ref.version!==1} onClick={()=>void download(ref)}>원본 다운로드 {ref.id}</button><p>v{ref.version} · SHA256 {ref.contentHash}</p></li>)}</ul>:<p>선언된 산출물 참조가 없습니다.</p>}
  {shown?<p>선택 산출물 {shown.selected.id}</p>:null}
  {shown?.status==='PENDING'?<p role="status">원본 크기·SHA256 대조 중</p>:null}
  {shown?.status==='REQUESTED'?<p role="status">브라우저에 다운로드를 요청했습니다. 저장 여부는 브라우저에서 확인하세요.</p>:null}
  {shown?.status==='ERROR'?<p role="alert">원본 다운로드 실패 ({shown.error}) · 선택 파일과 접근 권한을 확인한 뒤 다시 요청하세요.</p>:null}
 </section>;
}
