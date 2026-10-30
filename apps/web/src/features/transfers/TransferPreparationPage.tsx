import {listStoredCheckpoints,readStoredCheckpoint} from '../session-detail/checkpoint-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {routeHref,sessionDetailHref} from '../../shell/routes.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {SessionDetailContent} from '../session-detail/SessionDetailPage.tsx';
import {readTransferRecords,readTransferContext} from './transfer-read.ts';
import {TransferContextOriginals} from './TransferContextOriginals.tsx';
import {TransferTargetCandidates} from './TransferTargetCandidates.tsx';
type Records=NonNullable<Awaited<ReturnType<typeof readTransferRecords>>>;
type Context=NonNullable<Awaited<ReturnType<typeof readTransferContext>>>;
const labels={PURPOSE_REASON:'목적과 이유',RULES_SCOPE:'헌법과 범위',LATEST_INSTRUCTIONS:'최신 관련 지시',DECISIONS_REASON:'결정과 이유',CURRENT_POSITION:'현재 위치',ACTUAL_GAPS:'실제 공백',NEXT_ACTION:'다음 행동'};
/** 기존 원본의 명시 조회만 제공한다. 새 인계 저장본·안전 판정·writer를 만들지 않는다. */
export function TransferPreparationPage({client,projectId,assignmentRef,onAuthenticationLost}:{client:ApiClient;projectId:string;assignmentRef?:PlanRef;onAuthenticationLost:()=>void}){
 const [rawRecords,setRecords]=useState<Records|null>(null),[rawContext,setContext]=useState<Context|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
 const sequence=useRef(0),flight=useRef(false),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const key=JSON.stringify([projectId,assignmentRef]),latest=useRef(key);latest.current=key;
 const owner=useRef({client,transport:client.transport,key,epoch:0}),recordOwner=useRef<object|null>(null),contextOwner=useRef<object|null>(null);if(owner.current.client!==client||owner.current.transport!==client.transport||owner.current.key!==key)owner.current={client,transport:client.transport,key,epoch:owner.current.epoch+1};const scope=owner.current,owned=()=>owner.current===scope&&client.transport===scope.transport;
 const records=owned()&&recordOwner.current===scope?rawRecords:null,context=owned()&&contextOwner.current===scope?rawContext:null;
 useEffect(()=>{setPending(false);flight.current=false;return()=>{sequence.current++;flight.current=false;};},[scope]);
 function begin(){const ticket=++sequence.current;flight.current=true;setPending(true);setError(null);return()=>owned()&&sequence.current===ticket&&latest.current===key;}
 function fail(cause:unknown,active:()=>boolean){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('TRANSFER_READ_INVALID');setRecords(null);setContext(null);setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'TRANSFER_READ_INVALID');if(e.status===401)lost.current();}
 function finish(active:()=>boolean){if(active()){flight.current=false;setPending(false);}}
 async function read(){if(!owned()||!assignmentRef||flight.current)return;const selected=structuredClone(assignmentRef),active=begin();setRecords(null);setContext(null);try{const v=await readTransferRecords(client,projectId,selected,active);if(active()&&v){recordOwner.current=scope;setRecords(v);}}catch(e){fail(e,active);}finally{finish(active);}}
 async function inspect(ref:PlanRef){if(!owned()||!records?.detail.confirmed||flight.current)return;const expected=structuredClone(records.detail.confirmed.ref),selected=structuredClone(ref),active=begin();setContext(null);try{const v=await readTransferContext(client,projectId,expected,selected,active);if(active()&&v){contextOwner.current=scope;setContext(v);}}catch(e){fail(e,active);}finally{finish(active);}}
 return <section aria-label="읽기 인계 준비" lang="ko"><h2>읽기 인계 준비</h2>
  <p>단계책임자 임무의 기존 기록·대상 후보 조회입니다. 총괄/새 대상 채택·인계 확정·이해 대조·재개는 아직 미구현입니다.</p>
  <p role="status">실제 중지·쓰기 회수 미확인 · 새 쓰기 불가. 기존 기록을 읽어도 안전이나 이전 완료로 판정하지 않습니다.</p>
  <ol aria-label="이전 단계"><li>기록·안전 상태: 기존 원문 조회만 제공</li><li>인계 내용: 기존 맥락의 누락·참조 확인만 제공</li><li>대상 도구: 보관 후보 비교만 제공 · 새 세션 미구현</li><li>이해 대조·재개: 미구현</li></ol>
  <a href={assignmentRef?sessionDetailHref(projectId,assignmentRef):routeHref('session',projectId)}>임무 상세로 돌아가기</a>
  {assignmentRef?<><p>선택 임무 {assignmentRef.id} · v{assignmentRef.version} · {assignmentRef.contentHash}</p><button type="button" disabled={pending} onClick={()=>void read()}>{records||error?'인계 기록 다시 조회':'기존 인계 기록 조회'}</button></>:<p>임무 상세에서 고정 임무를 선택해 읽기 인계 준비로 이동하세요.</p>}
  {pending?<p role="status">고정 기록 조회 중 · 앞선 선택 원문 숨김</p>:null}{error?<p role="alert">{error} · 인계 기록 미확인. 다른 버전이나 빈 결과로 대체하지 않습니다.</p>:null}
  {records?<section aria-label="인계 기록 조회 결과"><SessionDetailContent detail={records.detail}/>
   <h3>보관 맥락 후보</h3><p>목록은 현재 의미 적합·전달 확인이 아닙니다. 현황 파일/실제 파일 차이·회수 공백은 임무 상세에서 별도 확인해야 합니다.</p>
   {!records.contexts?<p>내용 확정 임무 없음 · 맥락 후보를 추정하지 않습니다.</p>:<><p>조회 시각 {records.contexts.observedAt} · 읽은 후보 {records.contexts.items.length}개</p><ul>{records.contexts.items.map(item=><li key={item.ref.id}><p>{item.ref.id} · v{item.ref.version} · {item.ref.contentHash}</p><p>필수 누락 {item.missingRequired.length}개 · {item.currentCheck.state}</p><button type="button" disabled={pending} onClick={()=>void inspect(item.ref)}>고정 맥락 확인</button></li>)}</ul>{!records.contexts.items.length?<p>조회 범위의 맥락 후보 없음 · 인계 자료 완비나 작업 없음이 아닙니다.</p>:null}{records.contexts.hasMore?<p>이전 후보가 더 있습니다 · 최근50건만 조회, 전체 인계 이력 아님</p>:null}</>}
  </section>:null}
  {records?.detail.confirmed&&!pending?<TransferCheckpointHistory client={client} confirmed={records.detail.confirmed} onUnavailable={e=>{sequence.current++;flight.current=false;setPending(false);setRecords(null);setContext(null);setError(e.code);if(e.status===401)lost.current();}}/>:null}
  {records?.detail.confirmed&&!pending?<TransferTargetCandidates key={JSON.stringify([projectId,records.detail.confirmed.ref])} client={client} confirmed={records.detail.confirmed} onAuthenticationLost={onAuthenticationLost}/>:null}
  {context&&!pending?<section aria-label="인계 맥락 고정 원문"><h3>선택 맥락의 보관 metadata 원문</h3><p>{context.ref.id} · v{context.ref.version} · {context.ref.contentHash}</p><p>현재 원문 대조 {context.currentCheck.state} · {context.currentCheck.issues.join(', ')||'추가 보고 없음 · 의미 적합 미확인'}</p><p>필수 누락 {context.manifest.missingRequired.length}개 · 실제 전달 0 · 안전/권한/예산 미검증</p><ul>{context.manifest.items.map(item=><li key={item.itemId}>{labels[item.category as keyof typeof labels]} ({item.category}) · {item.includedState} · {item.reason}</li>)}</ul><p>누락: {context.manifest.missingRequired.join(', ')||'당시 metadata상 없음 · 전체 맥락 완비 판정 아님'}</p><ul>{context.manifest.unverified.map(issue=><li key={issue}>{issue}</li>)}</ul><details><summary>고정 참조·누락·전달 계획 metadata</summary><pre>{JSON.stringify(context.manifest,null,2)}</pre></details><p>이 metadata 조회만으로 본문을 수집하지 않습니다. 항목 원문은 아래에서 명시 선택하며 새 인계 manifest 저장·Agent 전달·자동 재개는 하지 않습니다.</p></section>:null}
  {context&&!pending&&records?.detail.confirmed?<TransferContextOriginals key={JSON.stringify([records.detail.confirmed.ref,context.ref])} client={client} projectId={projectId} assignmentRef={records.detail.confirmed.ref} context={context} onUnavailable={e=>{sequence.current++;flight.current=false;setPending(false);setRecords(null);setContext(null);setError(e.code);if(e.status===401)lost.current();}}/>:null}
 </section>;
}

/** 기존 보호 GET의 명시 표시만 담당하며 저장·이전·재개를 실행하지 않는다. */
function TransferCheckpointHistory({client,confirmed,onUnavailable}:{client:ApiClient;confirmed:ConfirmedAssignmentView;onUnavailable:(error:ApiError)=>void}){
 const key=JSON.stringify([confirmed.projectId,confirmed.ref]),owner=useRef({client,transport:client.transport,key,epoch:0});if(owner.current.client!==client||owner.current.transport!==client.transport||owner.current.key!==key)owner.current={client,transport:client.transport,key,epoch:owner.current.epoch+1};const scope=owner.current,active=()=>owner.current===scope&&client.transport===scope.transport;
 const[rawPage,setPage]=useState<{owner:object;value:NonNullable<Awaited<ReturnType<typeof listStoredCheckpoints>>>}|null>(null),[rawRecord,setRecord]=useState<{owner:object;value:NonNullable<Awaited<ReturnType<typeof readStoredCheckpoint>>>}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),sequence=useRef(0),flight=useRef(false);
 useEffect(()=>{flight.current=false;setBusy(false);setError(null);return()=>{sequence.current++;flight.current=false;};},[scope]);
 const page=active()&&rawPage?.owner===scope?rawPage.value:null,record=active()&&rawRecord?.owner===scope?rawRecord.value:null;
 async function run(action:(current:()=>boolean)=>Promise<void>){if(!active()||flight.current)return;flight.current=true;const ticket=++sequence.current,current=()=>active()&&sequence.current===ticket;setBusy(true);setError(null);setRecord(null);try{await action(current);}catch(cause){if(!current())return;setPage(null);setRecord(null);const e=cause instanceof ApiError?cause:new ApiError('CHECKPOINT_RESPONSE_INVALID');setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'CHECKPOINT_RESPONSE_INVALID');if([401,403,404].includes(e.status))onUnavailable(e);}finally{if(current()){flight.current=false;setBusy(false);}}}
 async function list(cursor:string|null){await run(async current=>{setPage(null);const v=await listStoredCheckpoints(client,confirmed,cursor,current);if(current()&&v)setPage({owner:scope,value:v});});}
 async function read(ref:Parameters<typeof readStoredCheckpoint>[2]){await run(async current=>{const v=await readStoredCheckpoint(client,confirmed,ref,current);if(current()&&v)setRecord({owner:scope,value:v});});}
 return <section aria-label="이전 작업현황 기록"><h3>이전 작업현황 기록</h3><p>과거 사람의 선언입니다. 현재 사실·중지·쓰기 회수·인계 확정·새 writer·재개는 미확인입니다. 전체 프로젝트 저장량 검증 공급자 미연결로 신규 저장은 412로 차단됩니다.</p><button type="button" disabled={busy} onClick={()=>void list(null)}>이전 작업현황 목록 조회</button>{busy?<p role="status">정확 확정 임무의 보관 기록 대조 중 · 이전 본문 숨김</p>:null}{error?<p role="alert">{error} · 보관 기록 미확인</p>:null}{page?<section aria-label="이전 작업현황 목록"><p>관측 시각 {page.observedAt}</p>{page.items.length?<ul>{page.items.map((item:any)=><li key={item.ref.id}><p>{item.recordedAt} · 순번 {item.serverSequence}</p><button type="button" disabled={busy} onClick={()=>void read(item.ref)}>작업현황 원문 {item.ref.id}</button></li>)}</ul>:<p>이 조회 범위의 보관 기록 없음 · 작업 없음이나 회수 완료가 아닙니다.</p>}{page.hasMore?<button type="button" disabled={busy} onClick={()=>void list(page.nextCursor)}>더 이전 작업현황</button>:null}</section>:null}{record?<section aria-label="이전 작업현황 고정 원문"><p>{record.ref.id} · v{record.ref.version} · {record.ref.contentHash}</p><p>기록 시각 {record.snapshot.recordedAt} · 공유 감사 순번 {record.serverSequence}</p><p>당시 미확인: {record.snapshot.gaps.join(', ')}</p><p>원문·hash 검산은 현재 사실·완료·안전한 이전·실행 허가가 아닙니다.</p><pre>{record.recordText}</pre><button type="button" onClick={()=>{sequence.current++;setRecord(null);}}>이전 작업현황 원문 닫기</button></section>:null}</section>;
}
