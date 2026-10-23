import {createElement as h} from 'react';
import {approvalRequestHref,mobileApprovalRequestHref} from '../../shell/routes.ts';
export function ApprovalRequestLinks({projectId,requestId}:{projectId:string;requestId:string}){
 return h('nav',{'aria-label':'같은 승인 요청 보기'},
  h('a',{href:approvalRequestHref(projectId,requestId)},'같은 요청 PC 화면'),
  h('span',{'aria-hidden':true},' · '),
  h('a',{href:mobileApprovalRequestHref(projectId,requestId)},'같은 요청 모바일 화면'),
  h('p',{className:'meta'},'동일 프로젝트·요청 원문을 조회합니다. 이동만으로 승인·소비·실행하지 않습니다. 작성 중 입력과 미확인 명령은 기존 보관 상태를 사용합니다.'));
}
