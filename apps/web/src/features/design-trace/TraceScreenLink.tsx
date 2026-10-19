import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from './work-plan-api.ts';
import type {TraceRef} from './trace-api.ts';
import type {ScreenRegion} from './design-index-api.ts';
import {readTraceScreenRegion} from './trace-screen-region.ts';
export function TraceScreenLink({client,projectId,sourceRef,target,onScreenOpen,onUnavailable,disabled=false}:{client:ApiClient;projectId:string;sourceRef:PlanRef;target:TraceRef;onScreenOpen:(source:PlanRef,region:ScreenRegion)=>void;onUnavailable:(error:ApiError)=>void;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),alive=useRef(true),working=useRef(false);
 const available=useRef(!disabled);available.current=!disabled;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function open(){
  if(disabled||working.current)return;working.current=true;setBusy(true);setError(null);
  try{const region=await readTraceScreenRegion(client,projectId,sourceRef,target,()=>alive.current&&available.current);if(region&&alive.current&&available.current)onScreenOpen(structuredClone(sourceRef),region);}
  catch(cause){if(!alive.current||!available.current)return;const e=cause instanceof ApiError?cause:new ApiError('TRACE_SCREEN_REFERENCE_UNVERIFIED');setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'TRACE_SCREEN_REFERENCE_UNVERIFIED');if([401,403,404].includes(e.status))onUnavailable(e);}
  finally{working.current=false;if(alive.current)setBusy(false);}
 }
 return <><button disabled={disabled||busy} onClick={()=>void open()}>{target.localCode} 연결 시안 원문 보기</button>{busy?<p role="status">고정 시안 등록 대조 중 · 최신 시안으로 대체하지 않음</p>:null}{error?<p role="alert">{error} · 시안 원문 이동 미확인</p>:null}</>;
}
