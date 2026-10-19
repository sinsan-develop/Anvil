import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readResultReviewSources,type ResultReviewSourcesView} from './result-review-api.ts';
import {ResultCriteriaEditor,type CriteriaEditorProps} from './ResultCriteriaEditor.tsx';
import {readStoredCriteriaList,readStoredCriteria,type StoredCriteriaList,type StoredCriteriaSummary,type RegisteredCriteria} from './result-criteria-api.ts';
const labels:Record<string,string>={TYPED_CRITERIA_NOT_REGISTERED:'시험 기준 미연결',RESULT_BASELINES_MISMATCH:'제출 기준 불일치',ENVIRONMENT_NOT_DEFINED:'환경 미정',ACCEPTANCE_CRITERIA_MISSING:'완료 조건 누락',VERIFICATION_REQUIREMENTS_MISSING:'검증 조건 누락'};
/** 부모는 선택 원문/조회 세대로 key를 지정한다. 재조회 중에는 앞선 원문을 노출하지 않는다. */
export function ResultReviewSources({client,projectId,result,assignment,onAuthenticationLost,onAccessUnavailable,criteria}:{client:ApiClient;projectId:string;result:SubmittedResultView;assignment:ConfirmedAssignmentView;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void;criteria:CriteriaEditorProps}){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{revision:number;value:ResultReviewSourcesView|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const shown=loaded?.revision===revision?loaded:null,pending=revision>0&&!shown;
 useEffect(()=>{if(!revision)return;let active=true;
  readResultReviewSources(client,projectId,result,assignment,()=>active).then(value=>{if(active&&value)setLoaded({revision,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESULT_REVIEW_SOURCE_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(error.code)?error.code:'RESULT_REVIEW_SOURCE_RESPONSE_INVALID';setLoaded({revision,value:null,error:code});if([401,403,404].includes(error.status))unavailable.current(code);if(error.status===401)lost.current();});
  return()=>{active=false;};
 },[client,projectId,result,assignment,revision]);
 const d=shown?.value?.assignment.snapshot.definition;
 return <section aria-label="검수 기준 원문"><h4>검수 기준 원문</h4><button type="button" disabled={pending} onClick={()=>setRevision(v=>v+1)}>{revision?'검수 기준 원문 다시 조회':'검수 기준 원문 조회'}</button>
  <p>확정 임무의 완료·검증 조건과 선택 제출을 대조해 조회합니다. 조회는 검수 합격이나 현재 기준 적용 확인이 아닙니다.</p>
  {pending?<p role="status">선택 제출·확정 임무 원문 대조 중 · 이전 조회 자료는 숨깁니다.</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 검수 기준 원문 미확인. 다른 자료로 대체하지 않습니다.</p>:null}
  {shown?.value&&d?<div><p>확정 임무: {shown.value.assignment.ref.id} · v{shown.value.assignment.ref.version} · {shown.value.assignment.ref.contentHash}</p><h5>완료 조건 원문</h5><ul>{d.acceptanceCriteria.map((v,i)=><li key={i}>{v}</li>)}</ul><h5>검증 조건 원문</h5><ul>{d.verificationRequirements.map((v,i)=><li key={i}>{v}</li>)}</ul><h5>아직 확인되지 않은 항목</h5><ul>{shown.value.issues.map(code=><li key={code}>{labels[code]}</li>)}</ul><details><summary>확정 기준·환경 참조 원문</summary><pre>{JSON.stringify({baselineRefs:d.baselineRefs,environmentRef:d.environmentRef},null,2)}</pre></details><p>검수 저장·보완 배정 미연결 · 원 제출의 실패/미실행은 유지됩니다.</p></div>:null}
  {shown?.value?<ResultCriteriaEditor key={revision} client={client} assignment={shown.value.assignment} {...criteria} onAuthenticationLost={onAuthenticationLost} onAccessUnavailable={onAccessUnavailable}/>:null}
  {shown?.value?<StoredCriteria key={'stored:'+revision} client={client} assignment={shown.value.assignment} onAuthenticationLost={onAuthenticationLost} onAccessUnavailable={onAccessUnavailable}/>:null}
 </section>;
}
/** 별도 명시 목록/원문 조회다. 조회한 버전을 프로젝트의 활성 기준으로 적용하지 않는다. */
export function StoredCriteria({client,assignment,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;assignment:ConfirmedAssignmentView;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{revision:number;value:StoredCriteriaList|null;error:string|null}|null>(null),[selected,setSelected]=useState<StoredCriteriaSummary|null>(null),[attempt,setAttempt]=useState(0),[original,setOriginal]=useState<{key:string;value:RegisteredCriteria|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const shown=loaded?.revision===revision?loaded:null,key=selected?[revision,selected.ref.id,selected.ref.version,selected.ref.contentHash,attempt].join(':'):null,detail=key&&original?.key===key?original:null;
 const failure=(cause:unknown)=>{const error=cause instanceof ApiError?cause:new ApiError('RESULT_CRITERIA_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(error.code)?error.code:'RESULT_CRITERIA_RESPONSE_INVALID';if([401,403,404].includes(error.status))unavailable.current(code);if(error.status===401)lost.current();return code;};
 useEffect(()=>{if(!revision)return;let active=true;readStoredCriteriaList(client,assignment,()=>active).then(value=>{if(active&&value)setLoaded({revision,value,error:null});}).catch(cause=>{if(active)setLoaded({revision,value:null,error:failure(cause)});});return()=>{active=false;};},[client,assignment,revision]);
 useEffect(()=>{if(!key||!selected||!shown?.value)return;let active=true;readStoredCriteria(client,assignment,selected,()=>active).then(value=>{if(active&&value)setOriginal({key,value,error:null});}).catch(cause=>{if(active)setOriginal({key,value:null,error:failure(cause)});});return()=>{active=false;};},[client,assignment,selected,key,shown?.value]);
 return <section className="status-card" aria-label="보관된 검수 기준"><h5>보관된 검수 기준</h5><button type="button" disabled={revision>0&&!shown} onClick={()=>{setSelected(null);setOriginal(null);setRevision(v=>v+1);}}>{revision?'보관 기준 목록 다시 조회':'보관 기준 목록 조회'}</button><p>현재 임무에 등록된 불변 버전을 조회합니다. 최신 자동선택·기준 적용·검수 합격은 하지 않습니다.</p>
  {revision>0&&!shown?<p role="status">보관 기준 목록 조회 중 · 이전 원문은 숨깁니다.</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 보관 기준 미확인</p>:null}
  {shown?.value?<><p>저장된 기준 {shown.value.items.length}개 · 활성 기준 미선택</p>{shown.value.items.length?<ul>{shown.value.items.map(item=><li key={item.ref.id+':'+item.ref.version}><button type="button" aria-pressed={selected?.ref.id===item.ref.id&&selected.ref.version===item.ref.version} onClick={()=>{setOriginal(null);setAttempt(v=>v+1);setSelected(item);}}>보관 기준 원문 {item.ref.id} v{item.ref.version}</button><p>조건 {item.conditionCount}개 · 작성자 {item.createdBy} · <time dateTime={item.registeredAt}>{item.registeredAt}</time></p></li>)}</ul>:<p>등록된 보관 기준 없음 · 정상/완료로 판단하지 않습니다.</p>}{shown.value.hasMore?<p>최근20개 버전만 조회했습니다. 오래된 추가 이력은 이 목록에서 미연결입니다.</p>:null}</>:null}
  {selected&&!detail?<p role="status">선택한 고정 버전 원문 대조 중 · 이전 원문은 숨깁니다.</p>:null}
  {detail?.error?<p role="alert">{detail.error} · 선택 기준 원문 미확인</p>:null}
  {detail?.value?<article aria-label="보관 기준 원문"><h5>조회한 기준 · 활성/검수 합격 아님</h5><p>{detail.value.ref.id} · v{detail.value.ref.version} · {detail.value.ref.contentHash}</p><p>{detail.value.input.reason}</p><ul>{detail.value.snapshot.items.map(i=><li key={i.criterionId}>{i.criterionId} · {i.testId} · {i.kind} · 필수</li>)}</ul><details><summary>기준·원조건 연결·환경 전체 원문</summary><pre>{JSON.stringify(detail.value,null,2)}</pre></details><p>이 조회를 검수 저장·업무 완료·실행 허가로 사용하지 않습니다.</p></article>:null}
 </section>;
}
