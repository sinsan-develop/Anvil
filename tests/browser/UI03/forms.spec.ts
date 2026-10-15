import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';

const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unexpected.set(page, []);
  await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: catalog.forms[0]!.ref.id, displayName: '양식 조회 QA' }, clientId: catalog.forms[0]!.ref.id, csrfToken: 'A'.repeat(43) } }));
  await page.route('**/api/v1/methodologies', route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: catalog.forms.map(form => ({ ref: form.ref, formCode: form.definition.formCode, name: form.definition.name, scope: 'SYSTEM' })), observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
});
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

test('양식 화면 계약: 공식8종의 정확 버전·목차·반복필드·작성 기준을 읽으며 작성/승인 완료로 오인하지 않는다', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.route(/\/api\/v1\/forms\/[^/]+\/versions\/1$/, route => {
    const form = catalog.forms.find(item => route.request().url().includes(item.ref.id))!;
    return route.fulfill({ json: { ...form, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByLabel('공식 산출물 양식', { exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByLabel('공식 산출물 양식', { exact: true }).getByRole('option')).toHaveCount(8);
  await expect(page.getByRole('heading', { name: 'AF01 요구사항정의서', exact: true })).toBeVisible();
  await expect(page.getByText('R ID', { exact: true })).toBeVisible();
  await page.getByLabel('공식 산출물 양식', { exact: true }).selectOption(catalog.forms[7]!.ref.id);
  await expect(page.getByRole('heading', { name: 'AF08 개발환경 정의서', exact: true })).toBeVisible();
  await expect(page.getByText('비밀 참조·보호', { exact: true })).toBeVisible();
  await page.getByText('문서 작성 공통 기준 원문', { exact: true }).click();
  await expect(page.getByRole('region', { name: '작성 기준 원문' })).toContainText('작업계획서');
  await expect(page.getByText('문서 내용 검수·사용자 확정은 아직 수행하지 않았습니다.', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('양식 화면 계약: 재조회 실패는 오래된 자료 표시, 다른 선택의 과거 본문 재사용은 금지한다', async ({ page }) => {
  let calls = 0;
  await page.route(/\/api\/v1\/forms\/[^/]+\/versions\/1$/, route => {
    if (++calls > 1) return route.fulfill({ status: 503, json: { code: 'STORAGE_FAILED' } });
    return route.fulfill({ json: { ...catalog.forms[0], authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByRole('heading', { name: 'AF01 요구사항정의서', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '양식 다시 조회', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('오래된 자료');
  await page.getByLabel('공식 산출물 양식', { exact: true }).selectOption(catalog.forms[1]!.ref.id);
  await expect(page.getByRole('heading', { name: 'AF01 요구사항정의서', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'AF02 설계서', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
});
