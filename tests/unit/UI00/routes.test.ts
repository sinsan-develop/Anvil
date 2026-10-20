import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as routing from '../../../apps/web/src/shell/routes.ts';
const {parseRoute,routeHref}=routing;

test('설계에서 선택한 고정 계획 업무 경로는 정확 참조·코드를 임무 준비 화면에 전달한다',()=>{
 const pid='11111111-1111-4111-8111-111111111111',planRef={id:'33333333-3333-4333-8333-333333333333',version:2,contentHash:'a'.repeat(64)},build=(routing as any).workspaceTaskHref;assert.equal(typeof build,'function');
 const expected='#/projects/'+pid+'/workspace/plans/'+planRef.id+'/versions/2/'+planRef.contentHash+'/tasks/FN01';assert.equal(build(pid,planRef,'FN01'),expected);assert.deepEqual(parseRoute(expected),{screen:'workspace',projectId:pid,planTask:{planRef,taskCode:'FN01'}});
 for(const code of ['','../OTHER','FN01?start=true'])assert.throws(()=>build(pid,planRef,code),/CLIENT_PATH_INVALID/);
 for(const suffix of ['/start','?execute=1'])assert.equal(parseRoute(expected+suffix).screen,'not-found');
 assert.throws(()=>build(pid,{...planRef,version:0},'FN01'),/CLIENT_PATH_INVALID/);assert.throws(()=>build(pid,{...planRef,contentHash:'wrong'},'FN01'),/CLIENT_PATH_INVALID/);
});

test('정확 승인 요청 경로는 프로젝트·요청을 유지하며 조회 경로만 만든다',()=>{
 const project='11111111-1111-4111-8111-111111111111',request='33333333-3333-4333-8333-333333333333';
 const build=(routing as any).approvalRequestHref;assert.equal(typeof build,'function');
 const href=build(project,request);assert.equal(href,'#/projects/'+project+'/approvals/requests/'+request);
 assert.deepEqual(parseRoute(href),{screen:'approvals',projectId:project,approvalRequestId:request});
});
test('정확 승인 요청 경로는 ID 오류·부가 명령·외부 주소를 거절한다',()=>{
 const project='11111111-1111-4111-8111-111111111111',request='33333333-3333-4333-8333-333333333333',build=(routing as any).approvalRequestHref;assert.equal(typeof build,'function');
 for(const value of ['wrong',request+'/decide','https://outside.invalid']){assert.throws(()=>build(project,value),/CLIENT_PATH_INVALID/);assert.equal(parseRoute('#/projects/'+project+'/approvals/requests/'+value).screen,'not-found');}
 assert.throws(()=>build('wrong',request),/CLIENT_PATH_INVALID/);
 assert.equal(parseRoute('#/projects/'+project+'/approvals/requests/'+request+'?approve=1').screen,'not-found');
});

test('프로젝트가 첫 화면이며 정확 프로젝트 ID를 URL에 유지하고 잘못된 경로는 다른 프로젝트로 대체하지 않는다', () => {
  assert.deepEqual(parseRoute(''), { screen: 'projects', projectId: null });
  const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
  assert.deepEqual(parseRoute(`#/projects/${id}/workspace`), { screen: 'workspace', projectId: id });
  assert.equal(routeHref('documents', id), `#/projects/${id}/documents`);
  for (const route of ['#/dashboard', '#/projects/' + '-'.repeat(36) + '/workspace', '#/projects/private-name/workspace', '#//other.test']) {
    assert.equal(parseRoute(route).screen, 'not-found');
    assert.equal(parseRoute(route).projectId, null);
  }
});
