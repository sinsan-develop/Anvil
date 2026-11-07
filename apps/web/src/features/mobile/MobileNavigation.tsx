import type {MouseEvent} from 'react';
import {routeHref,type Route} from '../../shell/routes.ts';
import './mobile.css';
/** PC와 같은 프로젝트·세션·명령을 소비하는 진입 탐색이다. 별도 승인 저장소/실행기를 만들지 않는다. */
export type MobilePane='chat'|'steps'|'docs';
export function MobileNavigation({route,pane,onPaneChange}:{route:Route;pane:MobilePane;onPaneChange:(pane:MobilePane)=>void}){
 if(route.screen!=='mobile'||!route.projectId)return null;
 const home=routeHref('mobile',route.projectId);
 function select(event:MouseEvent<HTMLAnchorElement>,next:MobilePane){if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();onPaneChange(next);}
 return <section aria-label="모바일 작업 진입"><p className="meta">같은 프로젝트·현재 로그인 세션을 사용합니다. 화면 전환으로 제어권을 얻거나 Agent 작업을 시작하지 않습니다.</p>
 <nav aria-label="모바일 작업 탐색" className="mobile-navigation"><a href={home} onClick={event=>select(event,'chat')} aria-current={!route.mobileScreen&&pane==='chat'?'page':undefined}>대화·작업</a><a href={home} onClick={event=>select(event,'steps')} aria-current={!route.mobileScreen&&pane==='steps'?'page':undefined}>절차 상세</a><a href={home} onClick={event=>select(event,'docs')} aria-current={!route.mobileScreen&&pane==='docs'?'page':undefined}>문서</a><a href={home+'/approvals'} aria-current={route.mobileScreen==='approvals'?'page':undefined}>승인</a></nav>
 <details><summary>지원 범위·미확인</summary><p>기존 프로젝트 작업과 승인 기능을 연결한 부분 화면입니다. 실제 Agent 지시 전달·역할 전환·중지/재개·기기 제어권 인수·원격 접속·푸시는 이 화면에서 지원 또는 확인하지 않았습니다. 문서·흐름도 상세 편집은 PC 사용을 권장합니다. 승인은 요청의 전체 범위·위험과 현재 권한을 확인한 뒤 별도로 결정합니다.</p></details>
 </section>;
}
