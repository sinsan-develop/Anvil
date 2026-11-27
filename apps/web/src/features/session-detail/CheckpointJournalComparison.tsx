import type {DocumentSession} from '../design-trace/editor-api.ts';
import {StopRequestPages} from './StoredStopRequests.tsx';
import {ObservationJournalPages} from './ObservationJournalPages.tsx';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {compareCheckpointJournal,isCheckpointResumeComparison,readCheckpointResumeEvidence,type CheckpointFileInspection,type CheckpointStoredInspection} from './checkpoint-journal-comparison.ts';
type Comparison=NonNullable<Awaited<ReturnType<typeof compareCheckpointJournal>>>;
type ResumeEvidence=NonNullable<Awaited<ReturnType<typeof readCheckpointResumeEvidence>>>;
type ComparisonOwner={client:ApiClient;transport:typeof fetch;binding:string;file:CheckpointFileInspection|null;stored:CheckpointStoredInspection|null;result:SubmittedResultView;route:string|undefined};
const changeLabels:Record<string,string>={AMBIGUOUS_PATH:'경로가 중복돼 대응 미확인',FILE_ONLY:'현황 파일에만 기재',RESULT_ONLY:'제출 보고서에만 기재',RECORDS_DIFFER:'선언 내용 불일치',HASH_UNKNOWN:'비교할 hash 미확인',REFERENCE_UNKNOWN:'한쪽 diff 참조 미확인',DECLARED_FIELDS_EQUAL:'경로·선언 필드 일치 · 실제 파일 인증 아님'};
function CheckpointChangeComparison({value}:{value:NonNullable<Comparison['changeComparison']>}){
 return <section aria-label="현황·제출 변경 선언 대조"><h5>현황·제출 변경 선언 대조</h5><p>소스 root·현재 디스크 내용 미확인 · 재개 근거로 사용하지 않습니다.</p><p>현황 파일과 선택 제출 보고서의 선언만 비교합니다. 한쪽에만 있다는 표시가 실제 파일의 존재·삭제를 뜻하지 않습니다.</p>{value.rows.length?<ul>{value.rows.map(row=><li key={row.path}><p>{row.path}</p><p>{changeLabels[row.state]}</p>{row.different.length?<p>다른 선언 필드: {row.different.join(', ')}</p>:null}<details><summary>양쪽 변경 선언 원문</summary><pre>{JSON.stringify({checkpoint:row.fileEntries,result:row.resultEntries},null,2)}</pre></details></li>)}</ul>:<p>양쪽 기록에 변경 선언 없음 · 실제 미변경 판정 아님</p>}</section>;
}
const ackLabels:Record<string,string>={NOT_COMPARED:'미대조',SERVER_ACK_NOT_RECORDED:'보관 ACK 없음',FILE_ACK_UNKNOWN:'파일 ACK 미확인',SAME_REF_AND_SEQUENCE:'참조·순번 일치 · 현재 진위 인증 아님',DIFFERENT_REF_OR_SEQUENCE:'참조 또는 순번 불일치'},localLabels:Record<string,string>={NOT_COMPARED:'실행 미연결로 미대조',LOCAL_SEQUENCE_UNKNOWN:'파일 로컬 순번 미확인',SERVER_ACK_NOT_RECORDED:'보관 ACK 없어 미대조',DECLARED_LOCAL_AHEAD:'파일 선언 순번이 연속 ACK보다 앞섬',DECLARED_LOCAL_BEHIND_STORED_MAX:'파일 선언 순번이 보관 최대보다 작음',DECLARED_RANGE_EQUAL:'선언 범위 일치 · 실제 전송 완료 인증 아님'};
function StoredResumeEvidence({value}:{value:ResumeEvidence}){
 const {stopRequests,observations}=value;
 return <section aria-label="재개 전 보관 중지 기록 대조 결과">
  <h5>재개 전 보관 중지 기록 대조</h5>
  <p>합성 원장입니다. 개별 중지 요청과 관측의 대응은 확인되지 않았습니다.</p>
  <h6>보관 중지 의도</h6>
  <p>조회 시각 <time dateTime={stopRequests.observedAt}>{stopRequests.observedAt}</time></p>
  {stopRequests.items.length?<ul>{stopRequests.items.map(item=><li key={item.ref.id}>{item.reason} · {item.requestedAt} · {item.ref.id} · v{item.ref.version} · {item.ref.contentHash}</li>)}</ul>:<p>조회 범위에 보관 중지 요청 없음</p>}
  {stopRequests.hasMore?<p>최근 20건만 표시 · 이전 중지 요청이 더 있습니다.</p>:null}
  <h6>보관 STOP 관측</h6>
  <p>최근 관측 {observations.displayedCount}건 / 보관 {observations.storedCount}건 중 STOP 기록 · 조회 시각 <time dateTime={observations.observedAt}>{observations.observedAt}</time></p>
  {observations.items.length?<ul>{observations.items.map(item=><li key={item.ref.id}>순번 {item.snapshot.event.sequence} · {item.snapshot.event.type} · 공급자 주장 · {item.snapshot.event.occurredAt} · {item.ref.id} · v{item.ref.version} · {item.ref.contentHash}</li>)}</ul>:<p>조회 범위에 보관 STOP 관측 없음</p>}
  {observations.hasMore?<p>이전 관측이 더 있습니다.</p>:null}
  {observations.highestContiguous===null?<p>보관 ACK 없음 · 미수신 범위 미확인</p>:<p>연속 ACK {observations.highestContiguous} · 보관 공백 {observations.gaps.length?observations.gaps.map(g=>g.from+'~'+g.to).join(', '):'기재 없음'}</p>}
  <p>실제 프로세스 정지·파일 상태·쓰기 소유와 권한 회수 미확인 · 재개 불가</p>
 </section>;
}
export function CheckpointJournalComparison({client,file,stored,result,session,onUnavailable,isSourceCurrent,sourceMode}:{client:ApiClient;file:CheckpointFileInspection|null;stored:CheckpointStoredInspection|null;result:SubmittedResultView;session?:DocumentSession;onUnavailable:(code:string)=>void;isSourceCurrent?:()=>boolean;sourceMode?:'STORED_ONLY'}){
 const binding=ordered([result.snapshot.scope,result.ref,result.snapshot.manifest.checkpointRef,file?.prepared.recordFile.contentHash??null,stored?.projectId??null,stored?.ref??null,session?.user.id??null,session?.clientId??null,session?.csrfToken??null]),
  generation=useRef(0),resumeGeneration=useRef(0),alive=useRef(false),unavailable=useRef(onUnavailable),owner=useRef<ComparisonOwner|null>(null);unavailable.current=onUnavailable;
 if(!owner.current||owner.current.client!==client||owner.current.transport!==client.transport||owner.current.binding!==binding||
    owner.current.file!==file||owner.current.stored!==stored||owner.current.result!==result||owner.current.route!==globalThis.location?.hash)owner.current={client,transport:client.transport,binding,file,stored,result,route:globalThis.location?.hash};
 const context=owner.current,[value,setValue]=useState<{owner:ComparisonOwner;data:Comparison}|null>(null),[pending,setPending]=useState<ComparisonOwner|null>(null),[error,setError]=useState<{owner:ComparisonOwner;code:string}|null>(null);
 const [resume,setResume]=useState<{comparison:Comparison;pending:boolean;data?:ResumeEvidence;error?:string}|null>(null);
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;resumeGeneration.current++;};},[]);
 useEffect(()=>{
  const clear=()=>{generation.current++;resumeGeneration.current++;setValue(null);setPending(null);setError(null);setResume(null);};clear();
  const hash=(value:string)=>{try{return new URL(value).hash;}catch{return null;}};
  const changed=(event:HashChangeEvent)=>{if(owner.current===context&&((event.oldURL?hash(event.oldURL):context.route)!==context.route||(event.newURL?hash(event.newURL):globalThis.location?.hash)!==context.route))clear();};
  globalThis.addEventListener?.('hashchange',changed);return()=>globalThis.removeEventListener?.('hashchange',changed);
 },[context]);
 const sourceCurrent=()=>isSourceCurrent?.()!==false&&globalThis.location?.hash===context.route,storedOnly=sourceMode==='STORED_ONLY';
 const displayedResume=useRef<typeof resume>(null);
 const closeResume=()=>{resumeGeneration.current++;displayedResume.current=null;setResume(null);};
 const failure=(cause:unknown)=>{
  const e=cause instanceof ApiError?cause:new ApiError('CHECKPOINT_JOURNAL_RESPONSE_INVALID');
  return {status:e.status,code:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'CHECKPOINT_JOURNAL_RESPONSE_INVALID'};
 };
 async function compare(source:'LOCAL'|'STORED'){
  const selected=source==='LOCAL'?(storedOnly?null:file):stored?{source:'SERVER_STORED_CHECKPOINT' as const,value:stored}:null;if(!selected||!sourceCurrent()||!alive.current||owner.current!==context||client.transport!==context.transport)return;
  const ticket=++generation.current,owned=()=>alive.current&&ticket===generation.current&&owner.current===context,active=()=>owned()&&sourceCurrent()&&client.transport===context.transport;
  closeResume();setPending(context);setValue(null);setError(null);
  try{const v=await compareCheckpointJournal(client,selected,result,active);if(active()&&v)setValue({owner:context,data:v});}
  catch(cause){if(!active())return;const {status,code}=failure(cause);setError({owner:context,code});if([401,403,404].includes(status))unavailable.current(status===401?'AUTH_REQUIRED':code);}
  finally{if(owned())setPending(null);}
 }
 const v=value?.owner===context&&sourceCurrent()?value.data:null,isPending=pending===context,visibleError=error?.owner===context?error.code:null;
 const canReadResume=!!stored&&!!v&&isCheckpointResumeComparison(v);
 const shownResume=canReadResume&&resume?.comparison===v?resume:null;displayedResume.current=shownResume;
 const comparisonTicket=generation.current,resumeTicket=resumeGeneration.current;
 const pageOwner=useRef({resume:shownResume,route:globalThis.location?.hash,valid:true});
 if(pageOwner.current.resume!==shownResume)pageOwner.current={resume:shownResume,route:globalThis.location?.hash,valid:true};
 const selectedPageOwner=pageOwner.current;
 const pageCurrent=()=>{
  if(globalThis.location?.hash!==selectedPageOwner.route)selectedPageOwner.valid=false;
  return selectedPageOwner.valid&&pageOwner.current===selectedPageOwner&&alive.current&&owner.current===context&&client.transport===context.transport&&sourceCurrent()&&generation.current===comparisonTicket&&resumeGeneration.current===resumeTicket&&displayedResume.current===shownResume;
 };
 async function readResume(){
  if(!stored||!v||!canReadResume||shownResume?.pending||!pageCurrent())return;
  const ticket=++resumeGeneration.current;
  const owned=()=>alive.current&&owner.current===context&&generation.current===comparisonTicket&&resumeGeneration.current===ticket;
  const current=()=>owned()&&sourceCurrent()&&client.transport===context.transport;
  if(!current())return;
  displayedResume.current=null;setResume({comparison:v,pending:true});
  try{const evidence=await readCheckpointResumeEvidence(client,v,stored,result,current);if(current()&&evidence)setResume({comparison:v,pending:false,data:evidence});}
  catch(cause){
   if(!current())return;const {status,code}=failure(cause);setResume({comparison:v,pending:false,error:code});
   if([401,403,404].includes(status))unavailable.current(status===401?'AUTH_REQUIRED':code);
  }finally{if(owned())setResume(previous=>previous?.comparison===v&&previous.pending?null:previous);}
 }
 return <section className="status-card" aria-label="현황 기록·보관 ACK 비교" lang="ko"><h4>현황 기록·보관 ACK 비교</h4><p>{storedOnly?'검산된 서버 기록':'로컬 선택 파일 또는 검산된 서버 기록'}의 수행자 선언과 새로 조회한 서버 보관 합성 주장만 대조합니다. 자료를 덮거나 작업을 재개하지 않습니다.</p>{!storedOnly&&!file?<p>로컬 파일 대조는 위의 현황 기록 파일을 선택하고 ‘선택 기록 대조’를 먼저 실행하세요.</p>:null}{!stored?<p>서버 기록 대조는 보관 기록 원문을 명시 조회하세요.</p>:null}{!storedOnly?<button type="button" disabled={!file||isPending} onClick={()=>void compare('LOCAL')}>선택 기록과 보관 ACK 대조</button>:null}<button type="button" disabled={!stored||isPending} onClick={()=>void compare('STORED')}>서버 기록과 보관 ACK 대조</button>
 {isPending?<p role="status">고정 파일·선택 제출 대조 중 · 이전 비교 숨김</p>:null}{visibleError?<p role="alert">{visibleError} · 대조 미확인. 같음/정상으로 추정하지 않습니다.</p>:null}
 {v?<><p>{v.localFileHash?<>선택 로컬 파일 SHA-256: {v.localFileHash} · 출처·실제 저장 미확인</>:<>서버 보관 기록 본문 SHA-256: {v.recordBodyHash} · 로컬 파일 바이트/저장 미확인</>}</p>{v.checkpointRef?<p>서버 체크포인트: {v.checkpointRef.id} · {v.checkpointRef.contentHash}</p>:null}<p>결과의 체크포인트 참조 대조: {v.checkpointReferenceComparison}</p><p>{v.executionMatched?'기록 선언에 같은 실행 참조 있음 · 실제 귀속 인증 아님':'기록에 같은 실행 참조 없음 · 숫자 비교하지 않음'}</p><p>기록 선언 로컬 순번: {v.declaredLocalSequence===null?'미확인':v.declaredLocalSequence}</p><p>기록 선언 ACK: {v.declaredAckSequence===null?'미확인':v.declaredAckSequence}</p><p>서버 보관 연속 ACK: {v.serverHighestContiguous===null?'미확인':v.serverHighestContiguous}</p><p>서버 보관 최대 순번: {v.serverMaxSequence===null?'미확인':v.serverMaxSequence}</p><p>ACK 참조 대조: {ackLabels[v.ackReferenceComparison]}</p><p>로컬 선언 대조: {localLabels[v.localComparison]}</p><p>기록 선언과 연속 ACK 순번 차이: {v.declaredContiguousAckDistance===null?'미확인':v.declaredContiguousAckDistance} · 보관된 비연속 순번도 포함</p><p>보관 범위 공백: {v.serverRead?v.serverGaps.map(g=>g.from+'~'+g.to).join(', ')||'기재 없음 · 실제 전송 완료 인증 아님':'미조회'}</p>{v.observedAt?<p>보관 원장 조회 시각: <time dateTime={v.observedAt}>{v.observedAt}</time></p>:null}<p>재개 불가 · 현재 파일/프로세스·쓰기 소유 미확인</p><details><summary>대조 원문·미확인 보기</summary><pre>{JSON.stringify(v,null,2)}</pre></details></>:null}
 {v?.changeComparison?<CheckpointChangeComparison value={v.changeComparison}/>:null}
 {canReadResume?<div>
  <button type="button" disabled={shownResume?.pending} onClick={()=>void readResume()}>재개 전 중지 기록 대조</button>
  {shownResume?<button type="button" onClick={()=>{if(pageCurrent())closeResume();}}>재개 전 중지 기록 닫기</button>:null}
  {shownResume?.pending?<p role="status">선택한 실행의 보관 중지 기록 조회 중</p>:null}
  {shownResume?.error?<p role="alert">{shownResume.error} · 보관 중지 기록 미확인</p>:null}
  {shownResume?.data?<>
   <StoredResumeEvidence value={shownResume.data}/>
   {shownResume.data.stopRequests.hasMore&&pageCurrent()?(session?<StopRequestPages key={'requests:'+comparisonTicket+':'+resumeTicket} client={client} result={result} session={session} isCurrent={pageCurrent} onUnavailable={code=>{if(pageCurrent())unavailable.current(code);}}/>:<p>현재 조회자 문맥 미확인 · 과거 중지 요청 페이지 조회 불가</p>):null}
   {shownResume.data.observations.hasMore&&pageCurrent()?<ObservationJournalPages key={comparisonTicket+':'+resumeTicket} client={client} result={result} stopOnly isSourceCurrent={pageCurrent} onOpen={()=>{}} onUnavailable={code=>{if(pageCurrent())unavailable.current(code);}}/>:null}
  </>:null}
 </div>:null}</section>;
}
