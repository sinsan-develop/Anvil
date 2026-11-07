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

test('이름·범위·확정 상태 검색은 정확 필터를 보내고 이전 선택을 재사용하지 않는다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099', ref = { id: target, version: 1, contentHash: 'b'.repeat(64) };
  const own = { ...version(0), ref, scope: 'USER_COMMON', systemCode: null, name: '내 개발 절차' };
  const queries: Record<string, string>[] = [];
  await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/, route => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams); queries.push(query);
    const selected = query.name ? [own] : [version(0)];
    return route.fulfill({ json: { items: selected.map(item => ({ ...item, status: 'DRAFT', sourceAvailable: item.scope === 'SYSTEM' })), observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } });
  });
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/[12]$/, route => route.fulfill({ json: route.request().url().includes(target) ? own : version(0) }));
  await page.goto('/#/methodologies'); await expect(page.getByRole('button', { name: '구조적 방법론 상세 보기', exact: true })).toBeVisible();
  await page.getByLabel('방법론 이름 검색', { exact: true }).fill('내 개발'); await page.getByLabel('방법론 범위', { exact: true }).selectOption('USER_COMMON'); await page.getByLabel('방법론 확정 상태', { exact: true }).selectOption('DRAFT');
  await page.getByRole('button', { name: '방법론 검색 적용', exact: true }).click();
  await expect(page.getByRole('button', { name: '내 개발 절차 상세 보기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '구조적 방법론 상세 보기', exact: true })).toHaveCount(0);
  expect(queries).toEqual([{}, { name: '내 개발', scope: 'USER_COMMON', status: 'DRAFT' }]);
});

test('방법론 다음 페이지와 이전 페이지를 읽고 목록 갱신은 첫 페이지에서 다시 시작한다', async ({ page }) => {
  const calls: string[] = [];
  await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/, route => {
    const query = new URL(route.request().url()).searchParams; calls.push(query.get('cursor') ?? 'first');
    const indices = query.get('cursor') === 'second-page' ? [2] : [0, 1];
    return route.fulfill({ json: { items: indices.map(index => { const v = version(index); return { ...v, status: 'DRAFT', sourceAvailable: true }; }), observedAt: new Date().toISOString(), nextCursor: indices[0] === 2 ? null : 'second-page', hasMore: indices[0] !== 2, baselineVersion: null } });
  });
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/2$/, route => route.fulfill({ json: version(methods.findIndex(method => route.request().url().includes(method.id))) }));
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '구조적 방법론 상세 보기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '애자일 방법론 상세 보기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '방법론 다음 페이지', exact: true }).click();
  await expect(page.getByRole('button', { name: '애자일 방법론 상세 보기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '방법론 다음 페이지', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '방법론 이전 페이지', exact: true }).click();
  await expect(page.getByRole('button', { name: '구조적 방법론 상세 보기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '방법론 목록 처음부터 갱신', exact: true }).click();
  await expect(page.getByRole('button', { name: '방법론 이전 페이지', exact: true })).toBeDisabled();
  expect(calls).toEqual(['first', 'second-page', 'first', 'first']);
});

test('방법론 내용 검토를 기록하고 단절 때 같은 명령을 확인한 뒤 정확 버전을 별도 확정한다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099', owner = methods[0]!.id;
  const ref = { id: target, version: 1, contentHash: 'e'.repeat(64) };
  const criteria = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'];
  const reviewRef = { id: 'a6f20000-0000-4000-8000-000000000055', criteriaVersion: 1, targetRef: ref, outcome: 'ACCEPTED' };
  let reviews: any[] = [], confirmation: any = null;
  const writes: any[] = [];
  const summary = { ref, name: '검토할 개발 절차', purpose: methods[0]!.purpose, scope: 'USER_COMMON', systemCode: null, status: 'DRAFT', sourceAvailable: false };
  await page.route('**/api/v1/methodologies', route => route.fulfill({ json: { items: [summary], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route(`**/api/v1/methodologies/${target}/versions/1`, route => route.fulfill({ json: { ...version(0), ...summary, confirmation,
    contentReviewCriteria: { criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, title: criterionId + ' 내용 확인' })) }, contentReviews: reviews } }));
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); writes.push(body);
    expect(body.targetId).toBe(target); expect(body.expectedVersion).toBe(1); expect(body.clientId).toBe(owner);
    expect(route.request().headers()['x-anvil-csrf']).toBe('A'.repeat(43));
    if (body.operation === 'recordContentReview') {
      expect(body.payload.targetKind).toBe('METHODOLOGY'); expect(body.payload.targetRef).toEqual(ref);
      expect(body.payload.items.map((item: any) => item.criterionId)).toEqual(criteria);
      reviews = [{ ref: reviewRef, items: body.payload.items, reviewer: { kind: 'HUMAN', userId: owner, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: body.payload.reason, reviewedAt: new Date().toISOString(), serverSequence: 1 }];
      if (writes.length === 1) { await route.abort('failed'); return; }
    } else {
      expect(body.operation).toBe('confirmMethodology'); expect(body.payload).toEqual({ versionRef: ref, reviewRefs: [reviewRef] });
      confirmation = { id: 'a6f20000-0000-4000-8000-000000000066', decision: 'CONFIRMED', decidedBy: owner, decided_at: new Date().toISOString(), reviewRefs: [reviewRef] };
    }
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: owner, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version: 1,
      data: { ref, status: body.operation === 'recordContentReview' ? 'REVIEW_RECORDED' : 'CONFIRMED', ...(body.operation === 'recordContentReview' ? { reviewRef } : { confirmationId: confirmation.id }) }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await page.getByRole('button', { name: '이 방법론 내용 검토 시작', exact: true }).click();
  const panel = page.getByRole('region', { name: '방법론 내용 검토·확정' });
  await expect(panel.getByRole('button', { name: '이 방법론 버전 확정', exact: true })).toBeDisabled();
  for (const criterionId of criteria) { await panel.getByLabel(criterionId + ' 판정', { exact: true }).selectOption('ACCEPTED'); await panel.getByLabel(criterionId + ' 검토 이유', { exact: true }).fill('원문과 절차를 확인함'); }
  await panel.getByLabel('내용 검토 종합 판정', { exact: true }).selectOption('ACCEPTED');
  await panel.getByLabel('내용 검토 종합 이유', { exact: true }).fill('이 절차로 진행할 기준을 확인함');
  await panel.getByRole('button', { name: '내용 검토 기록', exact: true }).click();
  await expect(panel.getByRole('button', { name: '같은 검토·확정 명령 결과 확인', exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  await panel.getByRole('button', { name: '같은 검토·확정 명령 결과 확인', exact: true }).click();
  await expect(panel.getByText('서버 내용 검토 기록 확인', { exact: true })).toBeVisible();
  expect(writes[1]).toEqual(writes[0]);
  await expect(panel.getByText('작성 기록자와 같은 사용자 · 독립 검수 아님', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '이 방법론 버전 확정', exact: true }).click();
  await expect(panel.getByText('현재 버전 사용자 확정 이력 있음 · 실행 승인은 별도', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(3);
});

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

test('빈 방법론에서 사람 단계2개·순서/판단 조건과 위치를 정의해 그대로 저장한다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099';
  let stored: any = null;
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/[12]$/, route => route.fulfill({ json: route.request().url().includes(target)
    ? { ref: { id: target, version: 1, contentHash: 'd'.repeat(64) }, name: '두 단계 방법론', purpose: '사용자 판단 순서 정의', scope: 'USER_COMMON', systemCode: null, graph: stored,
      confirmation: null, validation: validateMethodologyGraph(stored, forms.forms.map(form => form.ref)), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' } : version(0) }));
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); stored = body.payload.graph;
    expect(body.operation).toBe('saveMethodologyDraft'); expect(body.targetId).toBeNull(); expect(body.expectedVersion).toBe(0);
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: methods[0]!.id, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version: 1,
      data: { ref: { id: target, version: 1, contentHash: 'd'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await page.getByRole('button', { name: '새 방법론 작성', exact: true }).click();
  await page.getByLabel('방법론 이름', { exact: true }).fill('두 단계 방법론'); await page.getByLabel('방법론 목적', { exact: true }).fill('사용자 판단 순서 정의');
  await page.getByRole('button', { name: '단계 추가', exact: true }).click();
  await expect(page.getByLabel('단계 유형', { exact: true })).toBeVisible({ timeout: 1000 });
  for (const name of ['요구 확인', '최종 확인']) {
    if (name === '최종 확인') await page.getByRole('button', { name: '단계 추가', exact: true }).click();
    await page.getByLabel('단계 이름 편집', { exact: true }).fill(name); await page.getByLabel('단계 목적 편집', { exact: true }).fill(name + ' 판단');
    await page.getByLabel('단계 유형', { exact: true }).selectOption('HUMAN');
    await page.getByLabel('포함 작업', { exact: true }).fill('대상을 읽고 판단');
    await page.getByLabel('완료·검수 조건 편집', { exact: true }).fill('판단과 이유 저장');
    await page.getByLabel('작업 기록 요구 편집', { exact: true }).fill('현재 위치와 판단 이유');
  }
  await page.getByRole('button', { name: '선택 단계 오른쪽 이동', exact: true }).click();
  await page.getByRole('group', { name: '방법론 공간형 흐름도', exact: true }).getByRole('button', { name: /: 최종 확인$/ }).press('ArrowDown');
  await page.getByRole('button', { name: '단계 연결 추가', exact: true }).click();
  await page.getByLabel('연결 출발 단계', { exact: true }).selectOption({ label: '요구 확인' });
  await page.getByLabel('연결 도착 단계', { exact: true }).selectOption({ label: '최종 확인' });
  await page.getByLabel('연결 이유', { exact: true }).fill('앞선 사용자 확인 이후 진행');
  await page.getByLabel('연결 조건 형식', { exact: true }).selectOption('COMPARE');
  await page.getByLabel('연결 조건 판단 필드', { exact: true }).selectOption('USER_DECISION');
  await page.getByLabel('연결 조건 비교 값', { exact: true }).fill('CONTINUE');
  await page.getByLabel('요구 확인 종료 단계', { exact: true }).uncheck(); await page.getByLabel('최종 확인 종료 단계', { exact: true }).check();
  await page.getByLabel('개정 이유', { exact: true }).fill('최소 판단 절차 직접 작성');
  await page.getByRole('button', { name: '공통본 새 버전 저장', exact: true }).click();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 1', { exact: true })).toBeVisible();
  expect(stored.nodes).toHaveLength(2); expect(stored.nodes[1].position.x).toBe(260); expect(stored.nodes[1].position.y).toBe(20); expect(stored.nodes.every((node: any) => node.kind === 'HUMAN' && node.role === 'USER')).toBe(true);
  expect(stored.edges[0].condition).toEqual({ fieldRef: { nodeId: stored.nodes[0].nodeId, field: 'USER_DECISION' }, operator: 'EQ', value: 'CONTINUE' });
  expect(validateMethodologyGraph(stored, forms.forms.map(form => form.ref)).validForConfirmation).toBe(true);
  await expect(page.getByRole('group', { name: '방법론 공간형 흐름도', exact: true })).toBeVisible();
  if (process.env.ANVIL_CAPTURE_UI === '1') await page.getByRole('group', { name: '방법론 공간형 흐름도', exact: true }).screenshot({ path: test.info().outputPath('method-graph-final.png') });
});

test('복합 판단·유한 재작업과 입력 양식의 정확 버전을 같은 방법론 개정에 보존한다', async ({ page }) => {
  const target = 'a6f20000-0000-4000-8000-000000000099'; let graph = structuredClone(methods[0]!.graph), savedVersion = 1;
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: forms.forms.map(form => ({ ref: form.ref, formCode: form.definition.formCode, name: form.definition.name, scope: 'SYSTEM' })), observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route(/\/api\/v1\/forms\/[^/]+\/versions\/1$/, route => { const form = forms.forms.find(item => route.request().url().includes(item.ref.id))!; return route.fulfill({ json: { ...form, authoringStandard: { ref: forms.standard.ref, content: forms.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } }); });
  await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/[12]$/, route => route.fulfill({ json: route.request().url().includes(target)
    ? { ...version(0), ref: { id: target, version: savedVersion, contentHash: 'e'.repeat(64) }, name: '복합 조건 방법론', scope: 'USER_COMMON', systemCode: null, graph, validation: validateMethodologyGraph(graph, forms.forms.map(form => form.ref)) } : version(0) }));
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); if (body.operation === 'saveMethodologyDraft') { graph = body.payload.graph; savedVersion = 2; }
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: methods[0]!.id, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version: savedVersion,
      data: { ref: { id: target, version: savedVersion, contentHash: 'e'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies'); await page.getByLabel('복사본 이름', { exact: true }).fill('복합 조건 방법론');
  await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeEnabled(); await page.getByRole('button', { name: '내 공통본으로 복사', exact: true }).click();
  await expect(page.getByRole('region', { name: '공통 방법론 편집' })).toBeVisible();
  await page.getByText('단계의 입력·산출 문서 양식', { exact: true }).click();
  await page.getByRole('button', { name: '입력 문서 추가', exact: true }).click();
  await page.getByLabel('입력 1 양식', { exact: true }).selectOption({ label: 'AF08 개발환경 정의서 / v1' });
  await page.getByLabel('입력 1 내용 검수 기준', { exact: true }).fill('개발환경 선행 조건 확인');
  await page.getByRole('button', { name: '단계 연결 추가', exact: true }).click();
  await page.getByLabel('연결 출발 단계', { exact: true }).selectOption({ label: '기능·데이터 분석' }); await page.getByLabel('연결 도착 단계', { exact: true }).selectOption({ label: '요구·현행 분석' });
  await page.getByLabel('연결 유형', { exact: true }).selectOption('REWORK'); await page.getByLabel('연결 이유', { exact: true }).fill('보완 필요·진행 가능일 때 앞 단계 재작업');
  await page.getByLabel('같은 실패의 최대 재작업 횟수', { exact: true }).fill('2');
  await page.getByLabel('연결 조건 형식', { exact: true }).selectOption('ALL');
  await page.getByLabel('연결 조건 1 판단 단계', { exact: true }).selectOption('ST02'); await page.getByLabel('연결 조건 1 비교 값', { exact: true }).selectOption('REWORK');
  await page.getByRole('button', { name: '하위 조건 추가', exact: true }).click(); await page.getByLabel('연결 조건 2 형식', { exact: true }).selectOption('NOT');
  await page.getByLabel('연결 조건 2 반대 대상 판단 단계', { exact: true }).selectOption('ST02'); await page.getByLabel('연결 조건 2 반대 대상 비교 값', { exact: true }).selectOption('BLOCKED');
  await page.getByLabel('개정 이유', { exact: true }).fill('환경 문서와 제한된 보완 경로 정의'); await page.getByRole('button', { name: '공통본 새 버전 저장', exact: true }).click();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 2', { exact: true })).toBeVisible();
  expect(graph.nodes[0]!.inputs[0]!.formRef.id).toBe('a6f30000-0000-4000-8000-000000000008'); expect(graph.nodes[0]!.inputs[0]!.formRef.version).toBe(1);
  expect(graph.edges.at(-1)!.retryPolicy?.maxAttempts).toBe(2);
  expect(graph.edges.at(-1)!.condition).toEqual({ all: [{ fieldRef: { nodeId: 'ST02', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'REWORK' }, { not: { fieldRef: { nodeId: 'ST02', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'BLOCKED' } }] });
  expect(validateMethodologyGraph(graph, forms.forms.map(form => form.ref)).validForConfirmation).toBe(true);
});
