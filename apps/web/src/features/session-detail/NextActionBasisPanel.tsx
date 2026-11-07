import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {RecordedResultReview} from './result-review-write-api.ts';
import {readNextActionBasis,type NextActionBasis} from './next-action-basis-api.ts';
/** 부모는 사용자·클라이언트·고정 제출/검수·조회 세대별 key로 원문을 분리한다. */
export function NextActionBasisPanel({client,result,assignment,review,onAuthenticationLost,onAccessUnavailable,reworkPreparationAvailable=true}:{client:ApiClient;result:SubmittedResultView;assignment:ConfirmedAssignmentView;review:RecordedResultReview;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void;reworkPreparationAvailable?:boolean}){
 const [view,setView]=useState<NextActionBasis|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),live=useRef(false),working=useRef(false),lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 async function read(){if(working.current)return;working.current=true;setBusy(true);setView(null);setError(null);try{const v=await readNextActionBasis(client,result,assignment,review,()=>live.current);if(live.current&&v)setView(v);}catch(cause){if(!live.current)return;const e=cause instanceof ApiError?cause:new ApiError('NEXT_ACTION_BASIS_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'NEXT_ACTION_BASIS_INVALID';setError(code);if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();}finally{working.current=false;if(live.current)setBusy(false);}}
 return <section className="status-card" aria-label="선택 검수의 다음 행동 근거"><h5>선택 검수 기준 다음 행동</h5><p>서버가 선택한 원검수·원제출·확정 임무·현재 적용 방법론을 함께 대조합니다. 최신 검수 자동 선택·완료 승인·자동 분기/합류·모드별 실행은 하지 않습니다.</p><button type="button" disabled={busy} onClick={()=>void read()}>{view?'다음 행동 근거 다시 확인':'다음 행동 근거 확인'}</button>
  {busy?<p role="status">근거 조회 중 · 이전 안내 숨김</p>:null}{error?<p role="alert">{error} · 다음 행동 미확인. 다른 단계로 대체하지 않습니다.</p>:null}
  {view?<article aria-label="선택 다음 행동 근거"><p>{view.action==='REVIEW_REWORK_FOR_SELECTED_STAGE'?(reworkPreparationAvailable?'선택한 단계의 보완 검토가 필요합니다. 아래 기존 보완 초안 준비에서 부족 조건과 담당 세션을 별도로 선택하세요.':'선택한 단계의 보완 검토가 필요합니다. 원 임무 상세에서 부족 조건과 담당 세션을 별도로 확인하세요. 이 화면은 보완 초안을 만들거나 실행하지 않습니다.'):'차단 해제에 필요한 사람의 판단이 필요합니다. 이 안내만으로 차단을 해제하거나 보완 실행을 시작하지 않습니다.'}</p><p>고정 단계 {view.nodeId} · {view.nodeName}</p><p>후속 단계로 이동하거나 Agent를 실행하지 않습니다. 단계 실행 상태·완료 승인·현재 권한/예산은 미확인입니다.</p><p>제출 원본 형식: {view.resultTransport} · 실제 Agent 수행 인증 아님</p><p>검수 조회 {view.reviewObservedAt} · 적용본 관측 {view.applicationObservedAt} · 조회시점 이후 변경은 별도 재확인 대상입니다.</p><details><summary>선택 근거·미확인 항목</summary><pre>{JSON.stringify(view,null,2)}</pre></details></article>:null}
 </section>;
}
