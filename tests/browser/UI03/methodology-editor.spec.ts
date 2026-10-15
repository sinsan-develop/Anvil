import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';
import { validateMethodologyGraph } from '../../../apps/server/modules/methodologies/service.ts';

const forms = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const methods = buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md', import.meta.url)), forms.forms);
const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unexpected.set(page, []);
  await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: methods[0]!.id, displayName: '방법론 QA' }, clientId: methods[0]!.id, csrfToken: 'A'.repeat(43) } }));
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/methodologies', route => route.fulfill({ json: { items: methods.map(method => ({ ref: { id: method.id, version: method.version, contentHash: method.contentHash }, systemCode: method.systemCode, name: method.name, purpose: method.purpose, scope: 'SYSTEM', status: 'DRAFT', sourceAvailable: true })), observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
});
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });
const version = (index: number) => {
  const method = methods[index]!;
  return { ref: { id: method.id, version: method.version, contentHash: method.contentHash }, name: method.name, purpose: method.purpose, scope: 'SYSTEM', systemCode: method.systemCode, graph: method.graph,
    sourceApproval: { productAcceptance: false }, reason: '승인 원문의 단계 자료', createdAt: new Date().toISOString(), confirmation: null,
    validation: validateMethodologyGraph(method.graph, forms.forms.map(form => form.ref)), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
};

test('방법론 화면 계약: 내장3종의7단계·선택 단계 문서/사람확인/재작업을 읽으며 실행하지 않는다', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/1$/, route => route.fulfill({ json: version(methods.findIndex(method => route.request().url().includes(method.id))) }));
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '구조적 방법론 상세 보기', exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('button', { name: '3. 상세 설계·화면', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '구조적 방법론 상세 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '3. 상세 설계·화면', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '3. 상세 설계·화면', exact: true }).click();
  await expect(page.getByRole('region', { name: '선택 단계 상세' })).toContainText('ST03');
  await expect(page.getByRole('region', { name: '선택 단계 상세' })).toContainText('AF03');
  await expect(page.getByRole('region', { name: '선택 단계 상세' })).toContainText('사용자 설계·화면 확인');
  await page.getByRole('button', { name: '애자일 방법론 상세 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '7. 개선·다음 반복/전체 확인', exact: true })).toBeVisible();
  await expect(page.getByText('실제 Agent·환경·한도 연결 전 · 실행 불가', { exact: true })).toBeVisible();
  await expect(page.getByText('Anvil 안의 사람 확정 이력 없음', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('방법론 화면 계약: 조회 권한 회수 뒤 이전 그래프를 재사용하지 않는다', async ({ page }) => {
  let calls = 0;
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/1$/, route => ++calls === 1 ? route.fulfill({ json: version(0) }) : route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } }));
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '3. 상세 설계·화면', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '방법론 다시 조회', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '3. 상세 설계·화면', exact: true })).toHaveCount(0);
});
