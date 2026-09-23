/* C28 local mockup only. No fetch, sender, BFF client or approval authority. */
const menus=Object.freeze({team:'Agent Team',moa:'MoA',sns:'SNS / Daon User',adapters:'보조 채널'});
const conditions=Object.freeze({ready:'레이아웃 예시',permission:'권한 없음',error:'오류',empty:'결과 없음',offline:'오프라인'});
const risks=Object.freeze(['approve','apply','deploy','delete','provider','permission']);
const notices=Object.freeze(['','ACTION_BLOCKED','REQUESTED_NOT_APPLIED','HUMAN_APPROVAL_REQUIRED']);
function record(value,keys){
  if(value===null||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('INPUT_INVALID');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(descriptors[k],'value')))throw Error('INPUT_INVALID');
  return descriptors;
}
function checked(state){
  record(state,['menu','condition','modal','notice']);
  if(Object.keys(state).length!==4||typeof state.menu!=='string'||!Object.hasOwn(menus,state.menu)
    ||typeof state.condition!=='string'||!Object.hasOwn(conditions,state.condition)
    ||!(state.modal===null||risks.includes(state.modal))||!notices.includes(state.notice))throw Error('STATE_INVALID');
  return state;
}
export function createState(){return Object.freeze({menu:'team',condition:'ready',modal:null,notice:''});}
export function transition(current,event){
  checked(current);record(event,['type','value']);
  if(typeof event.type!=='string'||(Object.hasOwn(event,'value')&&typeof event.value!=='string'))throw Error('EVENT_INVALID');
  const next={...current};
  switch(event.type){
    case 'MENU':
      if(!Object.hasOwn(menus,event.value))throw Error('MENU_INVALID');
      next.menu=event.value;next.modal=null;next.notice='';break;
    case 'CONDITION':
      if(!Object.hasOwn(conditions,event.value))throw Error('CONDITION_INVALID');
      next.condition=event.value;next.modal=null;next.notice='';break;
    case 'REQUEST_CONTROL':
      if(!['pause','resume'].includes(event.value))throw Error('COMMAND_INVALID');
      next.notice=current.condition==='ready'?'REQUESTED_NOT_APPLIED':'ACTION_BLOCKED';break;
    case 'HIGH_RISK':
      if(!risks.includes(event.value))throw Error('ACTION_INVALID');
      if(current.condition!=='ready'){next.notice='ACTION_BLOCKED';break;}
      next.modal=event.value;break;
    case 'RECONFIRM':next.notice=current.modal?'HUMAN_APPROVAL_REQUIRED':'ACTION_BLOCKED';next.modal=null;break;
    case 'CANCEL':next.modal=null;break;
    default:throw Error('EVENT_INVALID');
  }
  return Object.freeze(next);
}
export function view(state){
  checked(state);
  return Object.freeze({title:menus[state.menu],mode:'MOCKUP_ONLY',userConfirmation:'PENDING',integrationAllowed:false,
    runtime:'NOT_EXECUTED',requestCount:0,canRequest:state.condition==='ready',condition:conditions[state.condition]});
}
export function sameOriginPath(path){
  if(typeof path!=='string'||path.length>160||!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(path))throw Error('PATH_INVALID');
  return path;
}
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const badge=(text,kind='muted')=>`<span class="badge ${kind}">${escape(text)}</span>`;
function team(){
  const rows=[['ORCH','계획 · 조정','parent task','Main 통합 대기'],['CODE','단일 writer','child implementation','lease / fence 필요'],
    ['REVIEW','독립 read-only','child review','독립 evidence 필요'],['TEST','test-scope-only','child verification','실행 증거 필요'],
    ['DEPLOY','배포 준비 점검','child readiness','NOT_EXECUTED']];
  return `<section class="panel"><div class="panel-heading"><h2>역할 및 작업 계보</h2>${badge('MOCKUP DATA')}</div>
    <div class="trace" aria-label="작업 단계 예시">요구사항 <span>→</span> 계획 <span>→</span> 구현 <span>→</span> 검토 <span>→</span> 테스트 <span>→</span> 배포준비</div>
    <div class="table-scroll"><table><caption class="sr-only">예시 역할 구성 — 실제 Agent 없음</caption><thead><tr><th>role</th><th>권한 경계</th><th>parent / child trace</th><th>상태</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>${r.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <div class="two-column"><section class="panel"><h2>owner / role 대화</h2><p class="empty-message">실제 대화는 연결되지 않았습니다.</p><p class="muted">원문 대신 bounded summary와 artifact ref를 표시할 자리입니다.</p></section>
    <section class="panel"><h2>실행 및 증거</h2><dl><dt>provider / model</dt><dd>미연결 · Quota not reported</dd><dt>artifact / evidence</dt><dd>없음 · NOT_EXECUTED</dd><dt>deploy readiness</dt><dd>BLOCKED — 실제 검증 필요</dd></dl></section></div>`;
}
function moa(){return `<section class="panel"><div class="panel-heading"><h2>MoA 검토 흐름</h2>${badge('Main 통합만 허용')}</div><div class="three-column">
  ${[['proposal','독립 제안'],['critique','반론 · 증거 검토'],['synthesis','Main 검토 입력']].map(([id,title])=>`<article class="stage-card"><small>${id}</small><h3>${title}</h3><p>아직 수집된 결과 없음</p>${badge('NOT_EXECUTED')}</article>`).join('')}</div>
  <p class="muted">provenance: provider · model · target · baseline · artifact/evidence hash</p><p>다수결이나 합의가 사용자 승인, Release 또는 Apply를 자동 생성하지 않습니다.</p></section>`;}
function sns(){return `<section class="panel"><h2>SNS / Daon User 연결 계약</h2><dl><dt>channel / session</dt><dd>미연결 · 세션 선택 필요</dd><dt>identity / 권한</dt><dd>현재 host authority 확인 필요</dd><dt>receipt / privacy</dt><dd>없음 · PRIVATE artifact ref only</dd><dt>delivery</dt><dd>NOT_EXECUTED</dd></dl>
  <p class="muted">원문·토큰·개인정보를 이 화면의 mockup 데이터로 가져오지 않습니다.</p><div class="actions"><button data-event="REQUEST_CONTROL" data-value="pause">Pause 요청 예시</button><button data-event="REQUEST_CONTROL" data-value="resume">Resume 요청 예시</button></div></section>`;}
function adapters(){return `<div class="two-column"><section class="panel"><div class="panel-heading"><h2>Telegram</h2>${badge('보조 채널')}</div><p>상태 / 저위험 intent / Console 확인 경로</p>${badge('REQUESTED_NOT_APPLIED')}<p class="muted">인증·외부 전송·runtime NOT_EXECUTED</p></section>
  <section class="panel"><div class="panel-heading"><h2>Kakao</h2>${badge('OPEN_DECISION','warn')}</div><p>contract-only · allowed=false</p><p class="muted">공식 API · auth · 사용자 매핑 · quota · 메시지 정책 · 운영 계정 미결정</p><button disabled>연결 불가</button></section></div>`;}
export function render(state){
  const v=view(state);
  const content={team,moa,sns,adapters}[state.menu]();
  const banner=state.condition==='ready'?'':`<section class="state-banner" role="status"><h2>${escape(v.condition)}</h2><p>${{permission:'권한을 우회할 수 없습니다. Web Console에서 현재 권한을 확인하세요.',error:'실제 오류가 아닌 상태 디자인 예시입니다. 실행을 성공으로 표시하지 않습니다.',empty:'아직 검증된 결과가 없습니다. 빈 상태를 성공으로 간주하지 않습니다.',offline:'연결되지 않았습니다. 오래된 상태를 최신 실행 증거로 사용하지 않습니다.'}[state.condition]}</p></section>`;
  return `<div class="console-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">A</span><strong>Anvil</strong><small>Agent Console</small></div><nav aria-label="Console 메뉴">${Object.entries(menus).map(([id,title],i)=>`<button data-event="MENU" data-value="${id}" ${id===state.menu?'aria-current="page"':''}><span class="nav-number">0${i+1}</span>${title}</button>`).join('')}</nav><div class="sidebar-foot">C-28 · MOCKUP ONLY<br>외부 요청 0 · 실제 데이터 없음</div></aside>
    <main><header><div><p class="eyebrow">WORKSPACE / AGENT OPERATIONS</p><h1>${v.title}</h1></div>${badge('사용자 확인 PENDING','warn')}</header>
    <div class="notice-strip"><strong>검토용 mockup</strong><span>실제 Agent·API·Provider는 연결하지 않았습니다. C-29 연결은 사용자 확인 후 별도 진행합니다.</span></div>
    <section class="scenario" aria-label="상태 예시 선택"><span>상태 예시</span>${Object.entries(conditions).map(([id,label])=>`<button data-event="CONDITION" data-value="${id}" aria-pressed="${state.condition===id}">${label}</button>`).join('')}</section>
    <div class="summary"><article><small>실행</small><strong>NOT_EXECUTED</strong></article><article><small>권한 / 승인</small><strong>미발급</strong></article><article><small>API 연결</small><strong>BLOCKED</strong></article><article><small>Provider quota</small><strong>Quota not reported</strong></article></div>
    ${banner}<div class="content ${v.canRequest?'':'restricted'}">${content}</div>
    <section class="panel approval"><div><h2>고위험 작업 재확인 흐름</h2><p class="muted">클릭은 대화상자 예시만 엽니다. 승인·변경·배포를 수행하지 않습니다.</p></div><div class="actions">${risks.map(action=>`<button data-event="HIGH_RISK" data-value="${action}" ${v.canRequest?'':'disabled'}>${action}</button>`).join('')}</div></section>
    <p class="result-notice" role="status" aria-live="polite">${escape(state.notice)}</p><footer>USER_CONFIRMATION_PENDING · BFF/API NOT_INTEGRATED · C-22~C-27 owner 계약 유지</footer></main>
    ${state.modal?`<div class="backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="reconfirm-title" tabindex="-1"><p class="eyebrow">MOCKUP / HIGH-RISK RECONFIRM</p><h2 id="reconfirm-title">${escape(state.modal)} 작업 재확인</h2><p>실제 수행에는 현재 target·독립 evidence·권한·인증된 사람 승인 원장의 재검증이 필요합니다.</p><p>이 버튼은 사용자 승인 증거를 생성하지 않습니다.</p><div class="actions"><button data-event="CANCEL">취소</button><button data-event="RECONFIRM">확인 흐름 예시 · 실행 안 함</button></div></section></div>`:''}</div>`;
}
export function mount(root){
  let state=createState();
  const draw=()=>{root.innerHTML=render(state);if(state.modal)root.querySelector('[role="dialog"]')?.focus();};
  const click=event=>{const button=event.target.closest('[data-event]');if(!button||!root.contains(button)||button.disabled)return;
    state=transition(state,{type:button.dataset.event,...(button.dataset.value?{value:button.dataset.value}:{})});draw();
    if(!state.modal)root.querySelector(`[data-event="MENU"][data-value="${state.menu}"]`)?.focus();};
  const key=event=>{if(!state.modal)return;if(event.key==='Escape'){event.preventDefault();state=transition(state,{type:'CANCEL'});draw();root.querySelector('[data-event="HIGH_RISK"]')?.focus();}
    if(event.key==='Tab'){const buttons=[...root.querySelectorAll('.dialog button')];const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&(event.target===first||!buttons.includes(event.target))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&event.target===last){event.preventDefault();first?.focus();}}};
  root.addEventListener('click',click);root.addEventListener('keydown',key);draw();
  return Object.freeze({getState:()=>state,unmount:()=>{root.removeEventListener('click',click);root.removeEventListener('keydown',key);}});
}
if(typeof document!=='undefined'){const root=document.querySelector('[data-c28-console]');if(root)mount(root);}
