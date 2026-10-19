import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {routeHref} from '../../shell/routes.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readSessionDetail,type SessionDetail} from './api.ts';
import {readAssignmentResults,readAssignmentResult,type AssignmentResults,type ResultSummary,type SubmittedResultView} from './result-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {ResultReviewSources} from './ResultReviewSources.tsx';
import type {CriteriaEditorProps} from './ResultCriteriaEditor.tsx';

type Loaded={key:string;revision:number;value:SessionDetail|null;error:string|null};
export function SessionDetailPage({client,projectId,assignmentRef,onAuthenticationLost,criteria}:{client:ApiClient;projectId:string;assignmentRef?:PlanRef;onAuthenticationLost:()=>void;criteria:CriteriaEditorProps}){
 const [loaded,setLoaded]=useState<Loaded|null>(null),[revision,setRevision]=useState(0),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const id=assignmentRef?.id,version=assignmentRef?.version,hash=assignmentRef?.contentHash,key=[projectId,id,version,hash].join(':');
 const shown=loaded?.key===key&&loaded.revision===revision?loaded:null,pending=!!assignmentRef&&!shown;
 useEffect(()=>{
  if(!id||!version||!hash)return;let active=true;
  readSessionDetail(client,projectId,{id,version,contentHash:hash},()=>active).then(value=>{if(active&&value)setLoaded({key,revision,value,error:null});}).catch((cause:unknown)=>{
   if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setLoaded({key,revision,value:null,error:/^[A-Z_]{1,80}$/.test(error.code)?error.code:'RESPONSE_INVALID'});if(error.status===401)lost.current();
  });return()=>{active=false;};
 },[client,projectId,id,version,hash,revision,key]);
 return <section aria-label="단계책임자·실행 상세" lang="ko">
  <div className="project-toolbar"><a href={routeHref('workspace',projectId)}>프로젝트 작업으로 돌아가기</a>{assignmentRef?<button type="button" disabled={pending} onClick={()=>setRevision(v=>v+1)}>상세 원본 새로고침</button>:null}</div>
  {!assignmentRef?<p>프로젝트 작업에서 임무를 선택하고 확정 원본의 ‘책임자·실행 상세’로 이동하세요.</p>:null}
  {pending?<p role="status">선택 임무의 고정 원본·책임 역할 조회 중</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 상세 원본을 확인하지 못했습니다. 이전 조회 결과를 현재 상태로 표시하지 않습니다.</p>:null}
  {shown?.value?<><SessionDetailContent detail={shown.value}/>{shown.value.confirmed?<SessionResults key={key+':'+revision} client={client} projectId={projectId} confirmed={shown.value.confirmed} onAuthenticationLost={onAuthenticationLost} criteria={criteria} responsibleState={shown.value.state}/>:null}</>:null}
 </section>;
}
const errorCode=(cause:unknown)=>cause instanceof ApiError&&/^[A-Z_]{1,80}$/.test(cause.code)?cause.code:'RESULT_RESPONSE_INVALID';
function SessionResults({client,projectId,confirmed,onAuthenticationLost,criteria,responsibleState}:{client:ApiClient;projectId:string;confirmed:ConfirmedAssignmentView;onAuthenticationLost:()=>void;criteria:CriteriaEditorProps;responsibleState:SessionDetail['state']}){
 const assignmentRef=confirmed.ref;
 const [page,setPage]=useState<AssignmentResults|null>(null),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0),[selected,setSelected]=useState<ResultSummary|null>(null),[attempt,setAttempt]=useState(0),[original,setOriginal]=useState<{key:string;value:SubmittedResultView|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const {id,version,contentHash}=assignmentRef,scopeKey=[projectId,id,version,contentHash,revision].join(':'),[pageKey,setPageKey]=useState(''),itemKey=selected?scopeKey+':'+selected.ref.id+':'+selected.ref.contentHash+':'+attempt:null,shown=original?.key===itemKey?original:null,currentPage=pageKey===scopeKey?page:null;
 useEffect(()=>{let active=true;setError(null);
  readAssignmentResults(client,projectId,{id,version,contentHash},()=>active).then(value=>{if(active&&value){setPage(value);setPageKey(scopeKey);}}).catch(cause=>{if(active){setError(errorCode(cause));setPage(null);setSelected(null);if(cause instanceof ApiError&&cause.status===401)lost.current();}});return()=>{active=false;};
 },[client,projectId,id,version,contentHash,revision,scopeKey]);
 useEffect(()=>{if(!selected||!itemKey||!currentPage)return;let active=true;
  readAssignmentResult(client,projectId,{id,version,contentHash},selected,()=>active).then(value=>{if(active&&value)setOriginal({key:itemKey,value,error:null});}).catch(cause=>{if(active){setOriginal({key:itemKey,value:null,error:errorCode(cause)});if(cause instanceof ApiError&&cause.status===401){setPage(null);setSelected(null);setError('AUTH_REQUIRED');lost.current();}}});return()=>{active=false;};
 },[client,projectId,id,version,contentHash,selected,itemKey,currentPage]);
 return <section className="status-card" aria-label="제출 결과" lang="ko"><div className="project-toolbar"><h3>제출 결과 · 검수 전</h3><button type="button" onClick={()=>{setSelected(null);setOriginal(null);setPage(null);setError(null);setRevision(v=>v+1);}}>결과 목록 새로고침</button></div>
  <p>제출자 주장과 실제 관측·검수는 다릅니다. 기록이 없거나 제출 상태가 COMPLETED여도 Anvil의 완료 판정이 아닙니다.</p>
  {error?<p role="alert">{error} · 결과 조회 미확인. 이전 결과를 현재 자료로 표시하지 않습니다.</p>:!currentPage?<p role="status">정확 임무의 제출 결과 조회 중</p>:<><p>조회 시각: <time dateTime={currentPage.observedAt}>{currentPage.observedAt}</time></p>{currentPage.items.length?<ul>{currentPage.items.map(item=><li key={item.ref.id}><button type="button" aria-pressed={selected?.ref.id===item.ref.id} onClick={()=>{setOriginal(null);setAttempt(v=>v+1);setSelected(item);}}>제출 원문 {item.ref.id}</button><p>{item.submissionState} · 제출자 주장 · 검수 전 · <time dateTime={item.submittedAt}>{item.submittedAt}</time></p></li>)}</ul>:<p>확인된 제출 결과 없음 · 작업 미수행/정상/완료로 추정하지 않습니다.</p>}{currentPage.hasMore?<p>최근 20건만 조회했습니다. 더 오래된 제출 이력은 이 화면에서 아직 미연결입니다.</p>:null}</>}
  {currentPage&&selected&&!shown?<p role="status">선택 제출의 고정 원문 조회 중</p>:null}
  {currentPage&&shown?.error?<p role="alert">{shown.error} · 원문 미확인. 다른 제출로 대체하지 않습니다.</p>:null}
  {currentPage&&shown?.value?<><ResultContent value={shown.value}/><ResultReviewSources key={itemKey} client={client} projectId={projectId} result={shown.value} assignment={confirmed} onAuthenticationLost={onAuthenticationLost} criteria={criteria} responsibleState={responsibleState} onAccessUnavailable={code=>{setOriginal(null);setSelected(null);setPage(null);setError(code);}}/></>:null}
 </section>;
}
export function ResultContent({value}:{value:SubmittedResultView}){
 const s=value.snapshot,m=s.manifest;
 return <article aria-label="선택 제출 원문"><h4>제출자 주장 · 검수 전</h4><p>제출 상태: {m.submissionState} · 합성 실행 연결 원문 · 증거 출처 미검증</p><dl><Reference label="제출 원문" value={value.ref}/><Reference label="제출 임무" value={s.scope.assignmentRef}/><Reference label="원 실행" value={s.scope.executionRef}/><Reference label="제출자" value={s.submittedByRef}/><Reference label="허가 영수증" value={s.authorizationReceiptRef}/></dl>
  <h4>파일 변경</h4>{m.changes.length?<pre>{JSON.stringify(m.changes,null,2)}</pre>:<p>보고된 변경 없음 · 실제 파일 대조 미실행</p>}
  <h4>명령 결과</h4>{m.commandResults.length?<pre>{JSON.stringify(m.commandResults,null,2)}</pre>:<p>보고된 명령 결과 없음</p>}
  <h4>시험 결과 · 제출 원문, 실제 재검증 아님</h4>{m.testResults.length?<pre>{JSON.stringify(m.testResults,null,2)}</pre>:<p>보고된 시험 결과 없음</p>}
  <h4>미실행</h4>{m.unexecuted.length?<pre>{JSON.stringify(m.unexecuted,null,2)}</pre>:<p>미실행 내역 보고 없음 · 모두 수행했다는 판정 아님</p>}
  <h4>잔여 위험</h4><pre>{JSON.stringify(m.risks,null,2)}</pre><h4>되돌리기</h4><p>{m.rollback||'미기재'}</p>
  <details><summary>전체 제출 원문·기준/산출물 참조</summary><pre>{JSON.stringify(value,null,2)}</pre></details><p>산출물·diff의 실제 바이트 조회, 증거 검수·보완·중지·이전 처리는 아직 미연결입니다.</p>
 </article>;
}
function Reference({label,value}:{label:string;value:PlanRef|null}){return <div><dt>{label}</dt><dd>{value?<>{value.id} · v{value.version}<br/>{value.contentHash}</>:'미연결'}</dd></div>;}
function Tool({detail,reference}:{detail:SessionDetail;reference:PlanRef}){
 const tool=detail.tools.find(t=>t.connectionRef.id===reference.id&&t.connectionRef.version===reference.version&&t.connectionRef.contentHash===reference.contentHash);
 if(!tool?.value)return <p>도구 후보 원문 미확인{tool?.error?' · '+tool.error:''} · 다른 후보로 대체하지 않습니다.</p>;
 const c=tool.value.candidate.input.candidate;
 return <div><p>{c.label} · 사용자 등록 후보</p><p>제품: {typeof c.toolProduct==='string'&&c.toolProduct?c.toolProduct:'미기재'} · 버전: {typeof c.toolVersion==='string'&&c.toolVersion?c.toolVersion:'미기재'} · 유형: {typeof c.adapterKind==='string'&&c.adapterKind?c.adapterKind:'미기재'}</p><p>{tool.value.expired?'조회상 기한 경과':'조회상 기한 이내'} · 능력·실제 연결·가동 미확인</p></div>;
}
export function SessionDetailContent({detail}:{detail:SessionDetail}){
 const d=detail.draft.snapshot.definition,s=detail.state;
 return <>
  <header><h2>{d.goal||'임무 목표 미입력'}</h2><p>{d.taskRef.taskCode} · {d.taskRef.nodeId}</p><p className="meta">고정 원문 조회 · 현재 실행 미확인 · 조회만으로 Agent를 호출하거나 허가하지 않습니다.</p></header>
  <section className="status-card" aria-label="고정 임무와 완료 조건"><h3>임무·기준</h3><p>{d.purpose}</p><p>책임 역할: {d.ownerRole||'미입력'}</p><p>통합 책임: {d.integrationResponsibility||'미입력'}</p>
   <h4>완료 조건</h4>{d.acceptanceCriteria.length?<ul>{d.acceptanceCriteria.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>완료 조건 미입력</p>}
   <h4>검증 조건</h4>{d.verificationRequirements.length?<ul>{d.verificationRequirements.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>검증 조건 미입력</p>}
   <dl><Reference label="선택 초안" value={detail.draft.ref}/><Reference label="내용 확정본" value={detail.confirmed?.ref??null}/><Reference label="작업계획" value={d.taskRef.planRef}/><Reference label="설계" value={detail.draft.snapshot.basis.designRef}/><Reference label="방법론 적용본" value={d.taskRef.applicationRef}/><Reference label="환경" value={d.environmentRef}/><Reference label="예산" value={d.budgetRef}/></dl>
   <p>{detail.confirmed?'과거 내용 확정 원문 있음':'내용 확정 원문 없음'} · {detail.decision.latestReviewAccepted&&!detail.decision.currentIssue?'저장된 최신 내용 검토 적합':'재검토 필요'} · 실행 허가 아님</p>
   <details><summary>허용 의도·제외 범위·입출력 원문</summary><h4>포함 범위</h4><ul>{d.included.map((v,i)=><li key={i}>{v}</li>)}</ul><h4>제외 범위</h4><ul>{d.excluded.map((v,i)=><li key={i}>{v}</li>)}</ul><h4>입력</h4><ul>{d.inputs.map((v,i)=><li key={i}>{v}</li>)}</ul><h4>산출물</h4><ul>{d.outputs.map((v,i)=><li key={i}>{v}</li>)}</ul><pre>{JSON.stringify(d.allowedScopes,null,2)}</pre><p>저장된 의도이며 현재 파일 접근·실행 권한은 미확인입니다.</p></details>
  </section>
  <section className="status-card" aria-label="책임 도구와 세션"><h3>책임 역할·예약 세션</h3>
   {s?.roles.length?<ul>{s.roles.map(r=><li key={r.ref.id}>{r.snapshot.kind==='COORDINATOR'?'총괄':'단계책임자'} · {r.ref.id} · v{r.ref.version}</li>)}</ul>:<p>확인된 책임 역할 없음</p>}
   {s?.bindings.length?<ul>{s.bindings.map(b=><li key={b.ref.id}>{detail.confirmed!==null&&b.snapshot.assignmentRef.id===detail.confirmed.ref.id&&b.snapshot.assignmentRef.version===detail.confirmed.ref.version&&b.snapshot.assignmentRef.contentHash===detail.confirmed.ref.contentHash?'선택 임무의 예약':'다른 임무의 현재 예약'} · 외부 Agent 세션 미생성<dl><Reference label="예약 대상 임무" value={b.snapshot.assignmentRef}/><Reference label="역할" value={b.snapshot.roleRef}/><Reference label="도구 연결 후보" value={b.snapshot.connectionRef}/><Reference label="Anvil 세션" value={b.snapshot.sessionRef}/></dl><Tool detail={detail} reference={b.snapshot.connectionRef}/><p>세대 {b.snapshot.generation} · 후보 연결이며 실제 가동 상태가 아닙니다.</p></li>)}</ul>:<p>확인된 세션 예약 없음 · 실제 외부 세션으로 추정하지 않습니다.</p>}
   <p>현재 권한·OS 소유·외부 도구 상태 미재검사</p>
  </section>
  <section className="status-card" aria-label="실행 준비 이력"><h3>저장된 실행 준비 이력</h3>
   {s?.preparations.length?<ul>{s.preparations.map(p=><li key={p.ref.id}><dl><Reference label="준비 원본" value={p.ref}/></dl><p>{p.snapshot.intent.mode==='WORK'?'작업 준비':'맥락 확인 준비'} · 허가되지 않음 · <time dateTime={p.snapshot.checkedAt}>{p.snapshot.checkedAt}</time></p><p>부족 항목: {p.snapshot.missingConditions.join(', ')||'보고 없음 · 현재 준비 완료 판정 아님'}</p></li>)}</ul>:<p>확인된 실행 준비 기록 없음</p>}
   {s?.hasMorePreparations?<p>최근 20건만 조회했습니다. 이전 준비 이력은 이 화면에서 미연결입니다.</p>:null}
  </section>
  <section className="status-card" aria-label="실제 결과와 누락 증거"><h3>실제 관측·증거 검수 미연결</h3><p>제출된 변경·시험 주장은 아래 결과 원문에서 확인합니다. 실제 Agent 관측·작업현황 파일·파일 diff 원본·하위 임무와 증거 검수는 아직 연결되지 않았습니다. 기록 부재를 대기·정상·완료로 판단하지 않습니다.</p><p>중지·보완·이전의 실제 처리도 미연결입니다. 이 조회 화면에는 실행 버튼이나 임의 명령 입력을 제공하지 않습니다.</p></section>
 </>;
}
