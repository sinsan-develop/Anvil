import { test, expect } from '@playwright/test';

const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => { unexpected.set(page, []); await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); }); });
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

const one = { id: '32b5f276-13e6-4d8a-b93f-27a15d21c788', name: 'Anvil', purpose: '프로젝트 주도권 유지', version: 1, updatedAt: '2026-10-16T01:02:03.456789Z' };
const two = { ...one, id: '51c0439f-791e-4bb5-8471-70938d6afaf1', name: '두 번째 프로젝트' };
test('프로젝트 화면 계약: 목록/검색/다음 화면은 조회만 하고 뒤로 와도 검색을 유지한다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: one.id, displayName: 'QA 사용자' }, clientId: one.id, csrfToken: 'A'.repeat(43) } }));
  const commands: string[] = [];
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
