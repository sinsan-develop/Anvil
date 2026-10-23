import {createElement as h,useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from './editor-api.ts';
import type {WorkPlanView} from './work-plan-api.ts';
import {readPlanTraceCoverage,type PlanCoverageSelection} from './plan-trace-coverage-read.ts';
import {PlanTraceCoverage} from './PlanTraceCoverage.ts';

type ReadState={key:string;value:Awaited<ReturnType<typeof readPlanTraceCoverage>>|null;error:ApiError|null};
/** 문맥 변경 직후 effect가 정리되기 전에도 다른 조회 결과를 표시하지 않는다. */
export function PlanTraceCoverageReadState({selection,readState}:{selection:PlanCoverageSelection;readState:ReadState|null}){
 const shown=readState?.key===JSON.stringify(selection)?readState:null;
 if(!shown)return h('p',{role:'status'},'고정 계획·설계 연결 확인 중');
 if(shown.error)return h('p',{role:'alert'},`연결 분석 미확인 · ${shown.error.code} · 앞선 결과로 대체하지 않습니다.`);
 return h(PlanTraceCoverage,{value:shown.value,expected:{projectId:selection.projectId,designRef:selection.designRef,planRef:selection.planRef}});
}

export function StoredPlanTraceCoverage({client,projectId,session,view,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;view:WorkPlanView;onAuthenticationLost:()=>void}){
 const selected:PlanCoverageSelection={projectId,userId:session.user.id,clientId:session.clientId,planRef:view.ref,designRef:view.designRef},key=JSON.stringify(selected);
 const [readState,setReadState]=useState<ReadState|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{
  let active=true;
  readPlanTraceCoverage(client,selected,()=>active).then(value=>{if(active)setReadState({key,value,error:null});}).catch(cause=>{
   if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setReadState({key,value:null,error});if(error.status===401)lost.current();
  });
  return()=>{active=false;};
 },[client,key]);
 return h('section',{'aria-label':'보관 계획 누락 연결 조회'},h('h3',null,'보관 계획 누락 연결 조회'),
  h('p',{className:'meta'},'기존 계획·설계 버전을 읽기 전용으로 다시 대조합니다. 편집·제어권·실행 상태를 변경하지 않습니다.'),
  h(PlanTraceCoverageReadState,{selection:selected,readState}));
}
