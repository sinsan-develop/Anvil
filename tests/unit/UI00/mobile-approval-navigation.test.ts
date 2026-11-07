import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as routing from '../../../apps/web/src/shell/routes.ts';
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
test('모바일 정확 승인 경로는 PC와 같은 프로젝트·요청 ID만 선택하며 결정 suffix를 거절한다',()=>{
 const build=(routing as any).mobileApprovalRequestHref;assert.equal(typeof build,'function');
 const href=build(pid,id);assert.equal(href,'#/projects/'+pid+'/mobile/approvals/requests/'+id);
 assert.deepEqual(routing.parseRoute(href),{screen:'mobile',projectId:pid,mobileScreen:'approvals',approvalRequestId:id});
 assert.deepEqual(routing.parseRoute(routing.approvalRequestHref(pid,id)),{screen:'approvals',projectId:pid,approvalRequestId:id});
 for(const suffix of ['/decide','?approve=true','/../'+pid,'/consume'])assert.equal(routing.parseRoute(href+suffix).screen,'not-found');
 for(const [project,request] of [['bad',id],[pid,'../other'],[pid,id+'?approve=true']])assert.throws(()=>build(project,request),/CLIENT_PATH_INVALID/);
});
test('읽기 링크는 PC·모바일에 동일 요청을 전달하고 결정·입력 제어를 만들지 않는다',async()=>{
 const {ApprovalRequestLinks}=await import('../../../apps/web/src/features/mobile/ApprovalRequestLinks.ts');
 const html=renderToStaticMarkup(createElement(ApprovalRequestLinks,{projectId:pid,requestId:id}));
 for(const href of ['#/projects/'+pid+'/approvals/requests/'+id,'#/projects/'+pid+'/mobile/approvals/requests/'+id])assert.ok(html.includes(href),href);
 assert.equal((html.match(/<a /g)??[]).length,2);assert.ok(html.includes('이동만으로 승인·소비·실행하지 않습니다'));assert.doesNotMatch(html,/<button|<input|<form/);
});
