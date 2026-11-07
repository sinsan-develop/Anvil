import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../api/client.ts';
import type {DocumentSession} from '../features/design-trace/editor-api.ts';
import {ApprovalRequestLinks} from '../features/mobile/ApprovalRequestLinks.ts';
import {NotificationScope,listNotifications,readNotification,prepareNotificationRead,sendNotificationRead,notificationPendingMatches,type NotificationPage,type NotificationPending,type NotificationTicket,type NotificationView,type ReadState} from './project-notifications-api.ts';
interface Ticket{local:NotificationTicket;owner:NotificationTicket}
interface View{ticket:Ticket|null;page:NotificationPage|null;selected:NotificationView|null;busy:boolean;error:ApiError|null;followupFailed:boolean}
const empty=():View=>({ticket:null,page:null,selected:null,busy:false,error:null,followupFailed:false});
const asError=(e:unknown)=>e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');
function errorText(e:ApiError){
 if(e.status===401)return '로그인이 만료되었습니다. 다시 로그인하세요.';
 if(e.status===404)return '현재 프로젝트 또는 알림에 접근할 수 없습니다. 이전 내용을 숨겼습니다.';
 if(e.code==='NOTIFICATION_READ_APPROVAL_NOT_CONNECTED')return '읽음에 필요한 승인 연결이 없습니다. 이 화면에서 승인이나 정책을 새로 만들지 않습니다.';
 if(e.status===403)return '현재 제어 또는 읽음 권한이 없습니다. 서버가 현재 권한을 다시 검사합니다.';
 if(e.code==='NOTIFICATION_READ_RESULT_UNCERTAIN'||e.code==='CONNECTION_LOST')return '처리 결과 미확인. 자동으로 다시 보내지 않았습니다. 같은 명령 결과만 재확인하세요.';
 if(e.code==='NOTIFICATION_CONTEXT_CHANGED')return '로그인·기기·제어 또는 접속 조건이 변경되었습니다. 보존한 명령을 새 명령으로 바꾸지 않았습니다.';
 if(e.status===503)return '알림 저장소가 연결되지 않았거나 자료를 확인할 수 없습니다. 빈 목록으로 확인된 상태가 아닙니다.';
 if(e.status===412)return '현재 읽음 정책 또는 선행 조건을 충족하지 못했습니다. 정책은 자동 변경하지 않습니다.';
 return '알림 응답을 확인하지 못했습니다. 이전 조회 내용을 숨겼습니다. 명시적으로 다시 조회하세요.';
}
export function ProjectNotificationsPanel({client,session,projectId,buffer,scope:ownerScope,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;projectId:string|null;buffer:NotificationPending|null;scope:NotificationScope;onChange:(expected:string|null,next:NotificationPending|null)=>boolean;onAuthenticationLost:()=>void}){
 const local=useRef(new NotificationScope());local.current.bind(session,client,projectId);
 const live=useRef({client,session,projectId,buffer});live.current={client,session,projectId,buffer};
 const [view,setView]=useState<View>(empty),[filter,setFilter]=useState<ReadState>('ALL');const lock=useRef<Ticket|null>(null);
 useEffect(()=>()=>local.current.dispose(),[]);
 const matches=(t:Ticket)=>local.current.current(t.local)&&ownerScope.current(t.owner)&&live.current.client===client&&live.current.session===session&&live.current.projectId===projectId;
 const shown=view.ticket&&matches(view.ticket)?view:empty();
 const rendered=useRef({page:shown.page,selected:shown.selected,filter});rendered.current={page:shown.page,selected:shown.selected,filter};
 const work=buffer&&projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId&&buffer.projectId===projectId?buffer:null;
 const bound=!!work&&notificationPendingMatches(work,client,session,projectId!);
 const unresolved=!!work&&!work.receipt;
 const selected=shown.selected??(bound&&!work?.accessLost?work?.view??null:null);
 function begin():Ticket|null{
  if(live.current.buffer!==buffer||!projectId||live.current.client!==client||live.current.session!==session||live.current.projectId!==projectId)return null;
  if(lock.current&&matches(lock.current))return null;
  const t={local:local.current.ticket(),owner:ownerScope.ticket()};if(!matches(t))return null;lock.current=t;setView({...shown,ticket:t,busy:true,error:null,followupFailed:false});return t;
 }
 function finish(t:Ticket){if(lock.current===t)lock.current=null;if(matches(t))setView(v=>({...v,busy:false}));}
 function fail(cause:unknown,t:Ticket,followupFailed=false){if(!matches(t))return;const e=asError(cause);setView(v=>({...v,ticket:t,page:null,selected:null,busy:false,error:e,followupFailed}));if([403,404].includes(e.status)){const p=live.current.buffer;if(p)onChange(p.bindingId,{...p,accessLost:true});}if(e.status===401)onAuthenticationLost();}
 async function list(cursor:string|null=null){if(unresolved||rendered.current.filter!==filter)return;const t=begin();if(!t)return;if(work?.receipt&&!onChange(work.bindingId,null)){finish(t);return;}setView({...empty(),ticket:t,busy:true});try{const page=await listNotifications(client,projectId!,session.user.id,filter,cursor);if(matches(t))setView({...empty(),ticket:t,page});}catch(e){fail(e,t);}finally{finish(t);}}
 async function inspect(item:NotificationView){if(unresolved||rendered.current.page!==shown.page||!shown.page?.items.includes(item))return;const t=begin();if(!t)return;if(work?.receipt&&!onChange(work.bindingId,null)){finish(t);return;}setView({...shown,ticket:t,selected:null,busy:true,error:null,followupFailed:false});try{const value=await readNotification(client,projectId!,session.user.id,item.ref);if(matches(t))setView(v=>({...v,selected:value}));}catch(e){fail(e,t);}finally{finish(t);}}
 async function access(){if(!work||!bound)return;const t=begin();if(!t)return;try{const value=await readNotification(client,projectId!,session.user.id,work.view.ref);if(matches(t)&&onChange(work.bindingId,{...work,accessLost:false}))setView({...empty(),ticket:t,selected:value});}catch(e){fail(e,t);}finally{finish(t);}}
 async function mark(){
  if(!selected||work?.receipt||work?.accessLost||work&&!bound||!!selected.notification.readAt&&!unresolved)return;
  const t=begin();if(!t)return;const active=()=>matches(t);let p=work;
  try{
   if(!p){p=await prepareNotificationRead(client,projectId!,session,selected,active);if(!active()||!onChange(null,p))return;}
   // The App owns the original immutable command before any POST, including lost responses.
   const receipt=await sendNotificationRead(client,p,session,active);if(!active())return;
   const confirmed={...p,receipt};if(!onChange(p.bindingId,confirmed))return;
   try{const value=await readNotification(client,projectId!,session.user.id,p.view.ref);if(value.notification.readAt!==receipt.readAt)throw new ApiError('RESPONSE_INVALID');if(active())setView(v=>({...v,ticket:t,selected:value,error:null,followupFailed:false}));}catch(e){fail(e,t,true);}
  }catch(e){fail(e,t);}finally{finish(t);}
 }
 const frozen=shown.busy||unresolved;
 return<section className="status-card" aria-label="본인 프로젝트 승인 알림"><h2>본인 프로젝트 승인 알림</h2>
  <details className="help"><summary aria-label="알림 조회 안내">i</summary><p>조회와 요청 이동은 읽음·승인·제어 인수를 수행하지 않습니다. 읽음 표시는 현재 제어와 서버 정책 확인이 필요합니다. 미확인 명령은 현재 앱 메모리에 보존합니다. 앱 전체 새로고침·장애 후 영속 복구는 지원하지 않습니다.</p></details>
  {!projectId?<p role="status">프로젝트를 선택한 뒤 프로젝트 설정에서 본인 알림을 조회하세요.</p>:<>
   <p className="meta">현재 프로젝트 {projectId} · 본인에게 보관된 승인 요청</p>
   <label>읽음 상태 <select value={filter} disabled={frozen} onChange={e=>{if(!frozen){local.current.ticket();setFilter(e.target.value as ReadState);setView(empty());}}}><option value="ALL">전체</option><option value="UNREAD">미읽음</option><option value="READ">읽음</option></select></label>{' '}
   <button type="button" disabled={frozen} onClick={()=>void list()}>알림 처음 조회</button>{' '}
   <button type="button" disabled={frozen||!shown.page?.hasMore} onClick={()=>void list(shown.page?.nextCursor??null)}>알림 다음 조회</button>
   {shown.busy?<p role="status">알림 조회·결과 확인 중</p>:null}
   {shown.error?<p role="alert">{shown.followupFailed?'후속 조회 실패. ':''}{errorText(shown.error)}</p>:null}
   {work?.receipt?<p role="status">읽음 처리 확인 · <time dateTime={work.receipt.readAt}>{work.receipt.readAt}</time>{shown.followupFailed?' · 후속 조회는 확인하지 못했습니다.':''}</p>:null}
   {unresolved?<p role="status">처리 결과 미확인 · 원래 명령을 보존했습니다. 다른 읽음이나 대상 변경 전 같은 명령 결과를 재확인하세요.</p>:null}
   {work&&!bound?<p role="alert">로그인 또는 접속 조건이 변경되어 보존한 명령을 재전송할 수 없습니다. 새 명령을 만들지 않았습니다.</p>:null}
   {bound&&work?.accessLost?<><p>현재 접근을 다시 확인하기 전 과거 상세는 숨깁니다. 원래 명령은 유지합니다.</p><button type="button" disabled={shown.busy} onClick={()=>void access()}>원알림 접근 다시 확인</button></>:null}
   {!shown.page&&!selected&&!unresolved&&!shown.error&&!shown.busy?<p role="status">아직 조회하지 않았습니다.</p>:null}
   {shown.page?<><p className="meta">서버 관측 <time dateTime={shown.page.observedAt}>{shown.page.observedAt}</time> · 이번 응답 {shown.page.items.length}건</p>{!shown.page.items.length?<p>조회된 알림이 없습니다.</p>:<ul>{shown.page.items.map(item=><li key={item.ref.id}><strong>승인 요청</strong> · {item.notification.readAt?'읽음':'미읽음'} · <time dateTime={item.notification.eventRef.occurredAt}>{item.notification.eventRef.occurredAt}</time>{' '}<button type="button" disabled={frozen} onClick={()=>void inspect(item)}>알림 상세 조회</button></li>)}</ul>}</>:null}
   {selected&&!(work?.accessLost)?<div aria-label="선택한 승인 알림"><h3>선택한 승인 알림</h3><dl><dt>발생 시각</dt><dd><time dateTime={selected.notification.eventRef.occurredAt}>{selected.notification.eventRef.occurredAt}</time></dd><dt>마지막 조회 읽음 상태</dt><dd>{selected.notification.readAt?'읽음 · '+selected.notification.readAt:'미읽음'}</dd></dl><ApprovalRequestLinks projectId={projectId} requestId={selected.notification.authenticatedTarget.approvalRequestId}/>
    <button type="button" disabled={shown.busy||!!work?.receipt||!!selected.notification.readAt&&!unresolved||!!work&&!bound} onClick={()=>void mark()}>{unresolved?'같은 명령 결과 재확인':'명시적으로 읽음 표시'}</button>{' '}
    <button type="button" disabled={frozen} onClick={()=>{if(frozen)return;if(work&&!onChange(work.bindingId,null))return;local.current.ticket();setView(empty());}}>상세 닫기</button>
   </div>:null}
  </>}
 </section>;
}
