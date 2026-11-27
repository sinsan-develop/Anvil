import {useLayoutEffect,useMemo,useRef,useState,type MouseEvent} from 'react';
import {documentVersionHref} from '../../shell/routes.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readStoredProposal,type ProposalComparison} from '../design-trace/proposal-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {DesignChangePage} from './api.ts';

/** 저장된 요청과 같은 원본만 읽는다. 선택·승인·기준 적용 명령은 발행하지 않는다. */
export function StoredChangeComparison({client,projectId,change,isCurrent,onAuthenticationLost}:{client:ApiClient;projectId:string;change:DesignChangePage['change'];isCurrent:()=>boolean;onAuthenticationLost:()=>void}){
 const transport=client.transport;
 const scope=useMemo(()=>({client,projectId,change,transport}),[client,projectId,change,transport]);
 type Ticket={scope:typeof scope};
 type Read={ticket:Ticket;value:ProposalComparison|null;error:ApiError|null;busy:boolean};
 const [read,setRead]=useState<Read|null>(null);
 const committed=useRef<typeof scope|null>(null),request=useRef<Ticket|null>(null),flight=useRef<Ticket|null>(null);
 useLayoutEffect(()=>{
  committed.current=scope;
  return ()=>{committed.current=null;request.current=null;flight.current=null;};
 },[scope]);
 const current=()=>committed.current===scope&&client.transport===transport&&isCurrent();
 const shown=read?.ticket.scope===scope&&request.current===read.ticket&&isCurrent()?read:null;
 const value=shown?.value??null,busy=shown?.busy??false,error=shown?.error??null;
 async function load(){
  if(!current()||flight.current?.scope===scope)return;
  const ticket={scope},active=()=>current()&&request.current===ticket;
  request.current=ticket;flight.current=ticket;
  setRead({ticket,value:null,error:null,busy:true});
  try{
   const comparison=await readStoredProposal(client,projectId,change.afterProposalRef,active);
   if(!active())return;
   if(comparison.proposal.id!==change.afterProposalRef||ordered(comparison.proposal.baseRef)!==ordered(change.beforeRef))throw new ApiError('DESIGN_CHANGE_COMPARISON_MISMATCH');
   setRead({ticket,value:comparison,error:null,busy:false});
  }catch(cause){
   if(!active())return;
   const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setRead({ticket,value:null,error:failure,busy:false});
   if(failure.status===401)onAuthenticationLost();
  }finally{if(flight.current===ticket)flight.current=null;}
 }
 function guardLink(event:MouseEvent<HTMLAnchorElement>){
  if(!current()||request.current!==shown?.ticket)event.preventDefault();
 }
 function close(){
  if(!current()||request.current!==shown?.ticket)return;
  request.current=null;setRead(null);
 }
 return <section aria-label="보관 변경 전후 비교"><h3>변경 전후 원문·diff</h3><p className="meta">저장된 요청의 정확 제안·기준 버전만 읽습니다. 현재 최신 설계/적용 상태는 미확인이며, 이 조회는 제안 선택·승인·확정·기준 적용을 하지 않습니다.</p>
  <button disabled={busy} onClick={()=>void load()}>보관 변경 전후 원문·diff 조회</button>
  {busy?<p role="status">보관 변경 원문·diff 확인 중</p>:null}{error?<p role="alert">{error.code} · 앞선 전후 원문은 숨겼습니다.</p>:null}
  {value?<><p className="meta">설계 {value.proposal.baseRef.id} · v{value.proposal.baseRef.version} · {value.proposal.baseRef.contentHash}<br/>수정 제안 {value.proposal.id} · 작성자 {value.proposal.proposedBy} · {value.proposal.createdAt}</p><p>제안 이유: {value.proposal.reason}</p>
   <h4>변경 전</h4><a href={documentVersionHref(projectId,value.proposal.baseRef)} onClick={guardLink} onAuxClick={guardLink}>변경 전 고정 설계 원문 열기</a><pre className="document-plain" aria-label="보관 변경 전 원문">{value.base.body}</pre><h4>변경 제안</h4><pre className="document-plain" aria-label="보관 변경 제안 원문">{value.proposedBody}</pre>
   <section aria-label="보관 변경 diff"><h4>검증한 변경 구간</h4><p>시작 줄 {value.diff.startLine} · 앞 유지 {value.diff.unchangedBefore}줄 · 뒤 유지 {value.diff.unchangedAfter}줄</p><h5>제거 구간</h5><pre className="document-plain">{value.diff.before.join('')}</pre><h5>추가 구간</h5><pre className="document-plain">{value.diff.after.join('')}</pre></section>
   <button disabled={busy} onClick={close}>보관 변경 원문 닫기</button>
  </>:null}
 </section>;
}
