import { test, expect, type Page } from '@playwright/test';
import { installWorkspaceBundle } from '../UI04/bundle.ts';
import { designChangeFixture, projectId, changeId } from '../../unit/UI07/design-change-fixture.ts';
const otherProject = '77777777-7777-4777-8777-777777777777';
async function setup(page: Page) {
  const requests: string[] = [], writes: string[] = [], unexpected: string[] = [], errors: string[] = [];
  await installWorkspaceBundle(page); await page.route('**/api/v1/**', route => { unexpected.push(route.request().url()); return route.abort(); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: projectId, displayName: 'QA' }, clientId: changeId, csrfToken: 'C'.repeat(43) } }));
  await page.route(`**/api/v1/projects/${projectId}/design-changes/${changeId}?*`, route => { requests.push(route.request().url()); return route.fulfill({ json: designChangeFixture() }); });
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); if (new URL(request.url()).origin !== 'https://localhost:3830') unexpected.push(request.url()); }); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/#/projects/${projectId}/changes`); return { requests, writes, unexpected, errors };
}
test('설계변경 화면은 명시한 요청을 읽고 사람 미확인과 기계 영향을 구분하며 쓰지 않는다', async ({ page }) => {
  const facts = await setup(page); await expect(page.getByRole('textbox', { name: '변경 요청 ID', exact: true })).toBeVisible(); expect(facts.requests).toHaveLength(0);
  await page.getByRole('textbox', { name: '변경 요청 ID', exact: true }).fill(changeId); await page.getByRole('button', { name: '변경 요청 조회', exact: true }).click();
  await expect(page.getByRole('region', { name: '보관 설계 변경', exact: true })).toContainText('실패 시 복구 절차를 명확히 한다');
  await expect(page.getByRole('cell', { name: '미확인 · 영향 없음 아님', exact: true })).toBeVisible(); await expect(page.getByText('실제 실행 결과가 없어 영향은 미확인입니다.', { exact: true })).toBeVisible();
  await page.getByText('영향 v1 · 기계적 연결 추적', { exact: true }).click(); await expect(page.getByRole('cell', { name: '재확인 대상', exact: true })).toBeVisible();
  await expect(page.getByText('EXECUTION_SOURCE_NOT_CONNECTED', { exact: true })).toHaveCount(2); expect(facts.requests).toHaveLength(1); expect(facts.writes).toEqual([]); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
test('설계변경 재조회 거절은 앞선 요청 원문과 영향 이력을 남기지 않는다', async ({ page }) => {
  const facts = await setup(page); await page.getByRole('textbox', { name: '변경 요청 ID', exact: true }).fill(changeId); await page.getByRole('button', { name: '변경 요청 조회', exact: true }).click(); await expect(page.getByRole('region', { name: '보관 설계 변경', exact: true })).toBeVisible();
  await page.route(`**/api/v1/projects/${projectId}/design-changes/${changeId}?*`, route => route.fulfill({ status: 403, json: { code: 'PROJECT_READ_DENIED' } }));
  await page.getByRole('button', { name: '변경 요청 조회', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('PROJECT_READ_DENIED'); await expect(page.getByRole('region', { name: '보관 설계 변경', exact: true })).toHaveCount(0); expect(facts.writes).toEqual([]); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
test('다른 프로젝트로 이동한 뒤 도착한 설계변경 응답은 새 화면에 혼입되지 않는다', async ({ page }) => {
  const facts = await setup(page); let release!: () => void, arrived!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; }), sent = new Promise<void>(resolve => { arrived = resolve; });
  await page.route(`**/api/v1/projects/${projectId}/design-changes/${changeId}?*`, async route => { arrived(); await wait; return route.fulfill({ json: designChangeFixture() }); });
  await page.getByRole('textbox', { name: '변경 요청 ID', exact: true }).fill(changeId); await page.getByRole('button', { name: '변경 요청 조회', exact: true }).click(); await sent;
  await page.evaluate(pid => { location.hash = `/projects/${pid}/changes`; }, otherProject); await expect(page.getByRole('textbox', { name: '변경 요청 ID', exact: true })).toHaveValue(''); release();
  await expect(page.getByRole('region', { name: '보관 설계 변경', exact: true })).toHaveCount(0); expect(facts.writes).toEqual([]); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
