import {useState} from 'react';
import {getPushSupport,type BrowserPushSupport} from './browser-push-support.ts';
const labels={SUPPORTED:'브라우저 API·권한 사용 가능',PERMISSION_REQUIRED:'브라우저 알림 권한 미허용',DENIED:'브라우저 알림 권한 거절됨',UNSUPPORTED:'이 브라우저·접속 환경에서 미지원',UNVERIFIED:'현재 브라우저 상태 미확인'};
const reasons:Record<string,string>={BROWSER_API_AND_PERMISSION_AVAILABLE:'필요한 브라우저 API와 현재 알림 권한이 있습니다.',BROWSER_PERMISSION_NOT_GRANTED:'권한이 아직 허용되지 않았습니다. 이 조회는 권한을 요청하지 않습니다.',BROWSER_PERMISSION_DENIED:'현재 브라우저 설정에서 알림이 거절돼 있습니다. 설정을 자동 변경하지 않습니다.',SECURE_CONTEXT_REQUIRED:'보안 연결 환경이 필요합니다.',NOTIFICATION_API_UNAVAILABLE:'Notification API가 없습니다.',PUSH_API_UNAVAILABLE:'Push API가 없습니다.',SERVICE_WORKER_API_UNAVAILABLE:'Service Worker API가 없습니다.',BROWSER_STATE_UNVERIFIED:'API 또는 권한 상태를 확인하지 못했습니다. 지원된다고 추정하지 않습니다.'};
export function BrowserPushSupportPanel(){
 const [result,setResult]=useState<BrowserPushSupport|null>(null);
 return<section className="status-card" aria-label="브라우저 알림 지원"><h2>브라우저 알림 지원</h2><button type="button" onClick={()=>setResult(getPushSupport())}>이 브라우저 알림 지원 확인</button>
  {result?<><p role="status">{labels[result.state]} · {result.state}</p><p>{reasons[result.reason]}</p></>:<p role="status">미확인 · 아직 조회하지 않았습니다.</p>}
  <p>현재 브라우저의 API·권한 조회만 제공합니다. 권한 요청·구독 등록·알림 설정 저장은 하지 않습니다. 서버 알림 연결·실제 전달은 미검증이며, 앱 내 본인 승인 알림은 별도 명시 조회로 확인하며, 알림 저장소 상태는 조회 결과에서 안내합니다.</p>
 </section>;
}
