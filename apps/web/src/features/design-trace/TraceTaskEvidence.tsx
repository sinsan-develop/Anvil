import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {TraceRef} from './trace-api.ts';
import {readTraceTaskEvidence,traceTaskEvidenceHref,type TraceTaskEvidenceView} from './trace-task-evidence.ts';

const reasons:Record<string,string>={ASSIGNMENT_NOT_FOUND:'같은 고정 계획·업무의 확정 배정이 없습니다.',ASSIGNMENT_AMBIGUOUS:'같은 고정 계획·업무의 확정 배정이 복수여서 자동 선택하지 않습니다.',PLAN_REFERENCE_MISMATCH:'업무 코드는 같지만 계획 fullref가 일치하지 않습니다.'};

type Request={serial:number;scope:string;client:ApiClient;transport:ApiClient['transport'];projectId:string;target:TraceRef};
type Settled={serial:number;scope:string;value:TraceTaskEvidenceView|null;error:string|null};
export function TraceTaskEvidence({client,projectId,target,context,onAuthenticationLost}:{client:ApiClient;projectId:string;target:TraceRef;context:string;onAuthenticationLost:()=>void}){
 const mounted=useRef(false),serial=useRef(0),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const scope=JSON.stringify([context,projectId,target.kind,target.id,target.versionRef,target.localCode]),scopeRef=useRef(scope),requestRef=useRef<Request|null>(null);scopeRef.current=scope;
 const[request,setRequest]=useState<Request|null>(null),[settled,setSettled]=useState<Settled|null>(null);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestRef.current=null;};},[]);
 useEffect(()=>{if(!request)return;const current=()=>mounted.current&&requestRef.current===request&&scopeRef.current===request.scope&&request.client.transport===request.transport;
  readTraceTaskEvidence(request.client,request.projectId,request.target,current).then(result=>{if(current()&&result)setSettled({serial:request.serial,scope:request.scope,value:result,error:null});}).catch(cause=>{if(!current())return;const problem=cause instanceof ApiError?cause:new ApiError('TRACE_TASK_EVIDENCE_RESPONSE_INVALID');setSettled({serial:request.serial,scope:request.scope,value:null,error:problem.code});if(problem.status===401)lost.current();});
  return()=>{if(requestRef.current===request)requestRef.current=null;};
 },[request]);
 const owned=request?.scope===scope&&request.client===client&&request.transport===client.transport?request:null,shown=owned&&settled?.serial===owned.serial&&settled.scope===scope?settled:null,loading=!!owned&&!shown,value=shown?.value??null,error=shown?.error??null;
 const begin=()=>{const next={serial:++serial.current,scope,client,transport:client.transport,projectId,target:structuredClone(target)};requestRef.current=next;setSettled(null);setRequest(next);};
 return <section aria-label={`${target.localCode} 결과·검수 근거 연결`}><button type="button" disabled={loading} onClick={begin}>{owned?'같은 확정 배정 다시 확인':'결과·검수·원문 조회 연결 확인'}</button>
  {loading?<p role="status">고정 계획·업무의 확정 배정 확인 중</p>:null}
  {error?<p role="alert">{error} · 다른 배정으로 대체하지 않습니다.</p>:null}
  {value?.state==='MATCHED'&&value.assignmentRef&&value.draftRef?<><p>고정 계획 fullref와 업무 코드에 정확히 일치하는 확정 배정 1건입니다.</p><a href={traceTaskEvidenceHref(value)}>기존 결과·검수·원문 보호 조회 열기</a><p className="meta">확정 배정 {value.assignmentRef.id} · v{value.assignmentRef.version} · {value.assignmentRef.contentHash}</p><p className="meta">초기 상세 원문 {value.draftRef.id} · v{value.draftRef.version} · {value.draftRef.contentHash}</p></>:value?<p>{reasons[value.state]}</p>:null}
 </section>;
}
