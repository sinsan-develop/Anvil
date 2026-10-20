import { test, expect } from '@playwright/test';
import { installWorkspaceBundle } from '../UI04/bundle.ts';

test.beforeEach(async ({ page }) => { await installWorkspaceBundle(page); });

const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => { unexpected.set(page, []); await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); }); });
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

const one = { id: '32b5f276-13e6-4d8a-b93f-27a15d21c788', name: 'Anvil', purpose: '프로젝트 주도권 유지', version: 1, updatedAt: '2026-10-16T01:02:03.456789Z' };
const two = { ...one, id: '51c0439f-791e-4bb5-8471-70938d6afaf1', name: '두 번째 프로젝트' };

function accessDetail(status='OTHER_CLIENT') {return {...one,desiredOutcome:'사용자 제어 유지',createdAt:one.updatedAt,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[{code:'METHODOLOGY_CONNECTION_PENDING'}],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:status==='UNASSIGNED'?null:two.id,clientId:status==='UNASSIGNED'?null:two.id,generation:status==='UNASSIGNED'?null:3,status}};}
async function installAccessList(page:import('@playwright/test').Page){
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:one.id,displayName:'QA'},clientId:one.id,csrfToken:'A'.repeat(43)}}));
 await page.route(/\/api\/v1\/projects(?:\?|$)/,r=>r.fulfill({json:{items:[one],nextCursor:null,hasMore:false,observedAt:one.updatedAt,baselineVersion:null}}));
 const writes:string[]=[],errors:string[]=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+new URL(r.url()).pathname);});page.on('pageerror',e=>errors.push(e.message));return{writes,errors};
}

test('프로젝트 카드의 승인 바로가기는 정확 프로젝트 조회 화면만 열고 명령을 보내지 않는다',async({page})=>{
 const f=await installAccessList(page);await page.route('**/api/v1/projects/'+one.id,r=>r.fulfill({json:accessDetail()}));await page.goto('/');
 await page.route('**/api/v1/projects/'+one.id+'/approvals?*',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:one.updatedAt}}));
 await expect(page.getByRole('link',{name:'Anvil 프로젝트 열기',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'프로젝트 검색',exact:true}).fill('Anvil');await page.getByRole('button',{name:'검색',exact:true}).click();
 const link=page.getByRole('link',{name:'Anvil 승인 요청 보기',exact:true});await expect(link).toBeVisible({timeout:1000});await expect(link).toHaveAttribute('href',`#/projects/${one.id}/approvals`);await link.click();
 await expect(page.getByRole('heading',{name:'승인·중요 문제',level:2,exact:true})).toBeVisible();await expect(page).toHaveURL(new RegExp(one.id+'/approvals$'));await page.goBack();
 await expect(page.getByRole('textbox',{name:'프로젝트 검색',exact:true})).toHaveValue('Anvil');expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});

test('프로젝트 목록에서 명시 조회한 참여·제어·준비 상태만 표시하고 시작/인수를 하지 않는다',async({page})=>{
 const f=await installAccessList(page);let calls=0,state='OTHER_CLIENT';await page.route('**/api/v1/projects/'+one.id,r=>{calls++;return r.fulfill({json:accessDetail(state)});});
 await page.goto('/');const region=page.getByRole('region',{name:'Anvil 제어·준비 상태',exact:true});await expect(region.getByRole('button',{name:'Anvil 제어·준비 상태 조회',exact:true})).toBeVisible();expect(calls).toBe(0);
 await region.getByRole('button',{name:'Anvil 제어·준비 상태 조회',exact:true}).click();await expect(region).toContainText('다른 사용자 또는 기기에 제어 기록 있음');await expect(region).toContainText('조회자');await expect(region).toContainText('METHODOLOGY_CONNECTION_PENDING');await expect(region).toContainText('브라우저 수신 시각');expect(calls).toBe(1);
 state='HELD';await region.getByRole('button',{name:'Anvil 제어·준비 상태 다시 조회',exact:true}).click();await expect(region).toContainText('이 로그인·기기에 제어 기록 있음');
 state='UNASSIGNED';await region.getByRole('button',{name:'Anvil 제어·준비 상태 다시 조회',exact:true}).click();await expect(region).toContainText('현재 유효한 제어 기록 없음');await expect(region).not.toContainText(two.id);
 await region.getByRole('button',{name:'제어·준비 조회 닫기',exact:true}).click();await expect(region).not.toContainText('METHODOLOGY_CONNECTION_PENDING');expect(calls).toBe(3);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});

test('프로젝트 상태 재조회403은 과거 제어 기록을 숨기고 미확인으로 표시한다',async({page})=>{
 const f=await installAccessList(page);let denied=false;await page.route('**/api/v1/projects/'+one.id,r=>denied?r.fulfill({status:403,json:{code:'PROJECT_ACCESS_DENIED'}}):r.fulfill({json:accessDetail()}));await page.goto('/');
 const region=page.getByRole('region',{name:'Anvil 제어·준비 상태',exact:true});await region.getByRole('button',{name:'Anvil 제어·준비 상태 조회',exact:true}).click();await expect(region).toContainText('다른 사용자 또는 기기에 제어 기록 있음');denied=true;await region.getByRole('button',{name:'Anvil 제어·준비 상태 다시 조회',exact:true}).click();await expect(region.getByRole('alert')).toContainText('PROJECT_ACCESS_DENIED');await expect(region).not.toContainText(two.id);await expect(region).not.toContainText('METHODOLOGY_CONNECTION_PENDING');expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});

test('프로젝트 상태 응답 대기 중 닫으면 늦은 결과를 다시 펼치지 않는다',async({page})=>{
 await page.addInitScript(id=>{const original=globalThis.fetch;(globalThis as any).projectAccessQa={consumed:false};globalThis.fetch=async(...args)=>{const response=await original(...args);if(new URL(String(args[0]),location.href).pathname==='/api/v1/projects/'+id){const json=response.json.bind(response);response.json=async()=>{const value=await json();setTimeout(()=>{(globalThis as any).projectAccessQa.consumed=true;},0);return value;};}return response;};},one.id);
 const f=await installAccessList(page);let entered=false,returned=false,release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/v1/projects/'+one.id,async r=>{entered=true;await gate;await r.fulfill({json:accessDetail()});returned=true;});await page.goto('/');
 const region=page.getByRole('region',{name:'Anvil 제어·준비 상태',exact:true});await region.getByRole('button',{name:'Anvil 제어·준비 상태 조회',exact:true}).click();await expect.poll(()=>entered).toBe(true);await region.getByRole('button',{name:'제어·준비 조회 닫기',exact:true}).click();release();await expect.poll(()=>returned).toBe(true);await expect.poll(()=>page.evaluate(()=>(globalThis as any).projectAccessQa.consumed)).toBe(true);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
 await expect(region.getByRole('button',{name:'Anvil 제어·준비 상태 조회',exact:true})).toHaveAttribute('aria-expanded','false');await expect(region).not.toContainText(two.id);await expect(region).not.toContainText('METHODOLOGY_CONNECTION_PENDING');expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});
test('프로젝트 화면 계약: 목록/검색/다음 화면은 조회만 하고 뒤로 와도 검색을 유지한다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: one.id, displayName: 'QA 사용자' }, clientId: one.id, csrfToken: 'A'.repeat(43) } }));
  const commands: string[] = [];
  await page.route('**/api/v1/projects/' + one.id, route => route.fulfill({ json: { ...one, desiredOutcome: '프로젝트 자료 유지', createdAt: one.updatedAt, currentMethodologyRef: null, baselineRef: null, sourceMode: 'EMPTY', sourceDeclaration: null, readinessIssues: [{ code: 'METHODOLOGY_CONNECTION_PENDING' }], viewerPermissions: ['READ_PROJECT'], participation: 'VIEWER', controlState: { actorId: null, clientId: null, generation: null, status: 'UNASSIGNED' } } }));
  page.on('request', request => { if (request.method() !== 'GET') commands.push(request.url()); });
  await page.route(/\/api\/v1\/projects(?:\?|$)/, route => route.fulfill({ json: { items: new URL(route.request().url()).searchParams.get('query') === 'Anvil' ? [one] : [one, two], nextCursor: null, hasMore: false, observedAt: new Date().toISOString(), baselineVersion: null } }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Anvil 프로젝트 열기', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('프로젝트 검색', { exact: true }).fill('Anvil');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByText('두 번째 프로젝트', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Anvil 프로젝트 열기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#/projects/' + one.id + '/workspace$'));
  await page.goBack();
  await expect(page.getByLabel('프로젝트 검색', { exact: true })).toHaveValue('Anvil');
  await expect(page.getByRole('link', { name: 'Anvil 프로젝트 열기', exact: true })).toBeVisible();
  expect(commands).toEqual([]);
});

test('프로젝트 화면 계약: 새 조회가 실패하면 앞선 목록을 오래된 자료로 표시하고 빈 성공으로 바꾸지 않는다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: one.id, displayName: 'QA 사용자' }, clientId: one.id, csrfToken: 'A'.repeat(43) } }));
  let calls = 0;
  await page.route(/\/api\/v1\/projects(?:\?|$)/, route => ++calls === 1 ? route.fulfill({ json: { items: [one], nextCursor: null, hasMore: false, observedAt: new Date().toISOString(), baselineVersion: null } }) : route.fulfill({ status: 503, json: { code: 'STORAGE_FAILED' } }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Anvil 프로젝트 열기', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '목록 새로고침', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('오래된 자료');
  await expect(page.getByRole('link', { name: 'Anvil 프로젝트 열기', exact: true })).toBeVisible();
  await expect(page.getByText('프로젝트가 없습니다', { exact: true })).toHaveCount(0);
});
