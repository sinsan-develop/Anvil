import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as routing from '../../../apps/web/src/shell/routes.ts';
const {parseRoute,routeHref}=routing;
test('생성귀속 원문 경로는 초안과 artifact 조회 hint만 보존하고 실행·hash·추가 경로를 받지 않는다',()=>{
 const project='11111111-1111-4111-8111-111111111111',hint={draftId:'33333333-3333-4333-8333-333333333333',artifactId:'44444444-4444-4444-8444-444444444444'},build=(routing as any).createdOriginalImportHref;assert.equal(typeof build,'function');
 const href='#/projects/'+project+'/documents/from-draft/'+hint.draftId+'/artifacts/'+hint.artifactId;assert.equal(build(project,hint),href);assert.deepEqual(parseRoute(href),{screen:'documents',projectId:project,createdOriginal:hint});
 for(const suffix of ['/import','?run=1','/../other'])assert.equal(parseRoute(href+suffix).screen,'not-found');for(const patch of[{draftId:'bad'},{artifactId:'../escape'},{contentHash:'a'.repeat(64)}])assert.throws(()=>build(project,{...hint,...patch}),/CLIENT_PATH_INVALID/);
});
test('인계 준비는 같은 프로젝트·고정 임무를 보존하고 임의 실행 하위 경로를 거절한다',()=>{const build=(routing as any).transferPreparationHref,pid='11111111-1111-4111-8111-111111111111',ref={id:'22222222-2222-4222-8222-222222222222',version:1,contentHash:'a'.repeat(64)};assert.equal(typeof build,'function');const href='#/projects/'+pid+'/transfers/assignments/'+ref.id+'/versions/1/'+ref.contentHash;assert.equal(build(pid,ref),href);assert.deepEqual(parseRoute(href),{screen:'transfers',projectId:pid,assignmentRef:ref});for(const tail of ['/resume','?grant=true','/../1'])assert.equal(parseRoute(href+tail).screen,'not-found');assert.throws(()=>build(pid,{...ref,version:0}));});
test('모바일 승인 진입도 동일 프로젝트를 유지하고 실행·임의 하위 경로를 받지 않는다',()=>{const pid='11111111-1111-4111-8111-111111111111',href=routeHref('mobile',pid)+'/approvals';assert.deepEqual(parseRoute(href),{screen:'mobile',projectId:pid,mobileScreen:'approvals'});assert.deepEqual(parseRoute(routeHref('mobile',pid)),{screen:'mobile',projectId:pid});for(const suffix of ['/decide','?approve=true','/../approvals'])assert.equal(parseRoute(href+suffix).screen,'not-found');});
test('주 작업의 정확 문서 참조를 작성 화면에 전달하며 자동 편집 명령은 없다',()=>{const pid='11111111-1111-4111-8111-111111111111',ref={id:'33333333-3333-4333-8333-333333333333',version:2,contentHash:'a'.repeat(64)},build=(routing as any).documentVersionHref;assert.equal(typeof build,'function');const expected='#/projects/'+pid+'/documents/'+ref.id+'/versions/2/'+ref.contentHash;assert.equal(build(pid,ref),expected);assert.deepEqual(parseRoute(expected),{screen:'documents',projectId:pid,documentRef:ref});for(const suffix of ['?edit=true','/save','/../1'])assert.equal(parseRoute(expected+suffix).screen,'not-found');});
test('문서 고정 경로의 잘못된 주체/참조·비유한 버전은 거절한다',()=>{const build=(routing as any).documentVersionHref;assert.equal(typeof build,'function');const pid='11111111-1111-4111-8111-111111111111',ref={id:'33333333-3333-4333-8333-333333333333',version:1,contentHash:'a'.repeat(64)};for(const patch of [{version:0},{version:NaN},{version:9007199254740992},{id:'../escape'},{contentHash:'bad'},{edit:true}])assert.throws(()=>build(pid,{...ref,...patch}),/CLIENT_PATH_INVALID/);assert.throws(()=>build('bad',ref),/CLIENT_PATH_INVALID/);assert.equal(parseRoute('#/projects/'+pid+'/documents/'+ref.id+'/versions/9007199254740992/'+ref.contentHash).screen,'not-found');});

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
