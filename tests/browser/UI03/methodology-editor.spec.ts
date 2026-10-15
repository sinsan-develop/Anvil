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
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/2$/, route => route.fulfill({ json: version(methods.findIndex(method => route.request().url().includes(method.id))) }));
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
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/2$/, route => ++calls === 1 ? route.fulfill({ json: version(0) }) : route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } }));
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '3. 상세 설계·화면', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '방법론 다시 조회', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '3. 상세 설계·화면', exact: true })).toHaveCount(0);
});

test('방법론 편집 계약: 내장본 복사 후 단계 목적·좌표를 저장하고 새 버전을 다시 읽는다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099';
  let graph = structuredClone(methods[0]!.graph), currentVersion = 1;
  const writes: Record<string, any>[] = [];
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/[12]$/, route => {
    const common = route.request().url().includes(target);
    return route.fulfill({ json: common ? { ...version(0), ref: { id: target, version: currentVersion, contentHash: 'b'.repeat(64) }, name: '내 개발 절차', purpose: methods[0]!.purpose, scope: 'USER_COMMON', systemCode: null, graph } : version(0) });
  });
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); writes.push(body);
    expect(route.request().headers()['x-anvil-csrf']).toBe('A'.repeat(43));
    if (body.operation === 'saveMethodologyDraft') { graph = body.payload.graph; currentVersion = 2; }
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: methods[0]!.id, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version: currentVersion,
      data: { ref: { id: target, version: currentVersion, contentHash: 'b'.repeat(64) }, validation: validateMethodologyGraph(graph, forms.forms.map(form => form.ref)), status: 'DRAFT' }, evidenceRefs: [], warnings: [], serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('복사본 이름', { exact: true }).fill('내 개발 절차');
  await page.getByRole('button', { name: '내 공통본으로 복사', exact: true }).click();
  await expect(page.getByRole('region', { name: '공통 방법론 편집' })).toBeVisible();
  await page.getByLabel('단계 목적 편집', { exact: true }).fill('요구사항의 이유를 확인한다');
  await page.getByLabel('단계 X 위치', { exact: true }).fill('345');
  await page.getByLabel('개정 이유', { exact: true }).fill('목적과 배치 구체화');
  await page.getByRole('button', { name: '공통본 새 버전 저장', exact: true }).click();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 2', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[0]!.operation).toBe('copyMethodology');
  expect(writes[1]!.expectedVersion).toBe(1); expect(writes[1]!.targetId).toBe(target);
  expect(writes[1]!.payload.graph.nodes[0].purpose).toBe('요구사항의 이유를 확인한다');
  expect(writes[1]!.payload.graph.nodes[0].position.x).toBe(345);
  await expect(page.getByLabel('단계 목적 편집', { exact: true })).toHaveValue('요구사항의 이유를 확인한다');
});

test('공통본 저장 응답 단절 시 새 명령 없이 같은 요청으로 결과를 확인한다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099';
  const writes: unknown[] = [];
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/[12]$/, route => route.fulfill({ json: route.request().url().includes(target)
    ? { ...version(0), ref: { id: target, version: 1, contentHash: 'b'.repeat(64) }, scope: 'USER_COMMON', systemCode: null, name: '응답 단절 복사본' } : version(0) }));
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); writes.push(body);
    if (writes.length === 1) { await route.abort('failed'); return; }
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: methods[0]!.id, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version: 1,
      data: { ref: { id: target, version: 1, contentHash: 'b'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await page.getByLabel('복사본 이름', { exact: true }).fill('응답 단절 복사본');
  await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '내 공통본으로 복사', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true }).click();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 1', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
});

test('저장 성공 뒤 재조회가 거절되어도 명령을 폐기해 중복 복사하지 않는다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099';
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/[12]$/, route => route.request().url().includes(target)
    ? route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } }) : route.fulfill({ json: version(0) }));
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON();
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: methods[0]!.id, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version: 1,
      data: { ref: { id: target, version: 1, contentHash: 'b'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await page.getByLabel('복사본 이름', { exact: true }).fill('조회 거절 복사본');
  await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '내 공통본으로 복사', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeDisabled();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 1', { exact: true })).toHaveCount(0);
});
