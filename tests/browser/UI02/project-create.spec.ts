import { expect, test } from '@playwright/test';

const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unexpected.set(page, []);
  await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
});
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', csrf = 'C'.repeat(43);
const input = { name: '내 프로젝트', purpose: '개발 주도권', desiredOutcome: '원본 유지', sourceMode: 'EMPTY', methodologySelection: null, artifactRefs: [] };
test('저장한 목적에서 내 확정 방법론을 선택해 초안2단계에 저장하고 새로고침 뒤 재조회한다', async ({ page }) => {
  const ref = { id: 'a6f20000-0000-4000-8000-000000000099', version: 2, contentHash: 'e'.repeat(64) };
  const summary = { ref, name: '검토한 내 개발 절차', purpose: '개발 기준을 유지', scope: 'USER_COMMON', systemCode: null, status: 'CONFIRMED', sourceAvailable: false };
  let draft: any = null; const writes: any[] = [];
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  await page.route('**/api/v1/methodologies', route => route.fulfill({ json: { items: [summary], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/project-drafts', route => {
    writes.push(route.request().postDataJSON()); draft = { draftId: id, version: 1, step: 1, input };
    return route.fulfill({ status: 201, json: draft });
  });
  await page.route('**/api/v1/project-drafts/' + id, route => {
    if (route.request().method() === 'PATCH') { const body = route.request().postDataJSON(); writes.push(body); expect(body.expectedVersion).toBe(1); expect(body.step).toBe(2); draft = { draftId: id, version: 2, step: 2, input: body.input }; }
    return route.fulfill({ json: { ...draft, editable: true, consumedProjectId: null } });
  });
  await page.goto('/#/projects/new');
  await page.getByLabel('프로젝트 이름', { exact: true }).fill(input.name); await page.getByLabel('왜 만드는가', { exact: true }).fill(input.purpose); await page.getByLabel('기대 결과', { exact: true }).fill(input.desiredOutcome);
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('초안 버전 1');
  await page.getByRole('button', { name: '방법론·자료로 다음', exact: true }).click();
  await page.getByLabel('사용할 방법론', { exact: true }).selectOption(ref.id);
  await page.getByRole('button', { name: '선택한 방법론 연결', exact: true }).click();
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('초안 버전 2');
  expect(draft.input.methodologySelection).toEqual({ kind: 'CONFIRMED_REFERENCE', versionRef: ref });
  await page.reload();
  await expect(page.getByText('선택한 고정 방법론 · 버전 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '프로젝트 생성 — 필수 기준 연결 전', exact: true })).toBeDisabled();
  expect(writes).toHaveLength(2);
});
test('초안 화면 계약: 중간 저장/재조회는 최종 생성이나 Agent 실행이 아니며 새로고침 뒤 저장본이 유지된다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  let draft: unknown = null, writes = 0;
  const forbidden: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && !request.url().endsWith('/project-drafts')) forbidden.push(request.url()); });
  await page.route('**/api/v1/project-drafts', route => {
    writes++; expect(route.request().headers()['x-anvil-csrf']).toBe(csrf);
    const body = route.request().postDataJSON();
    expect(body.expectedVersion).toBe(0); expect(body.targetId).toBeNull();
    draft = { draftId: id, version: 1, step: 1, input };
    return route.fulfill({ status: 201, json: draft });
  });
  await page.route('**/api/v1/project-drafts/' + id, route => route.fulfill({ json: { ...(draft as object), editable: true, consumedProjectId: null } }));
  await page.goto('/#/projects/new');
  await expect(page.getByRole('heading', { name: '목적·소스', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('프로젝트 이름', { exact: true }).fill(input.name);
  await page.getByLabel('왜 만드는가', { exact: true }).fill(input.purpose);
  await page.getByLabel('기대 결과', { exact: true }).fill(input.desiredOutcome);
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('초안 버전 1');
  await page.reload();
  await expect(page.getByLabel('왜 만드는가', { exact: true })).toHaveValue(input.purpose);
  expect(writes).toBe(1); expect(forbidden).toEqual([]);
});

test('초안 화면 계약: 응답 단절 뒤 같은 명령을 명시 재확인하며 입력·명령을 자동 재발행하지 않는다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  const commands: string[] = [];
  await page.route('**/api/v1/project-drafts', route => {
    commands.push(route.request().postDataJSON().commandId);
    if (commands.length === 1) return route.abort('failed');
    return route.fulfill({ status: 201, json: { draftId: id, version: 1, step: 1, input } });
  });
  await page.goto('/#/projects/new');
  await page.getByLabel('프로젝트 이름', { exact: true }).fill(input.name, { timeout: 1000 });
  await page.getByLabel('왜 만드는가', { exact: true }).fill(input.purpose);
  await page.getByLabel('기대 결과', { exact: true }).fill(input.desiredOutcome);
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('자동으로');
  expect(commands.length).toBe(1);
  await expect(page.getByLabel('왜 만드는가', { exact: true })).toHaveValue(input.purpose);
  await page.getByRole('button', { name: '저장 결과 다시 확인', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('초안 버전 1');
  expect(commands.length).toBe(2); expect(commands[1]).toBe(commands[0]);
});

test('초안 화면 계약: 로그인 만료 후에도 미저장 목적을 유지하고 내부 화면 왕복으로 버리지 않는다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  await page.route('**/api/v1/project-drafts', route => route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: '51c0439f-791e-4bb5-8471-70938d6afaf1', csrfToken: 'B'.repeat(43) } }));
  await page.route(/\/api\/v1\/projects(?:\?|$)/, route => route.fulfill({ json: { items: [], hasMore: false, nextCursor: null, observedAt: new Date().toISOString(), baselineVersion: null } }));
  await page.goto('/#/projects/new');
  await page.getByLabel('왜 만드는가', { exact: true }).fill('서버에 아직 저장하지 않은 목적', { timeout: 1000 });
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible();
  await page.getByLabel('사용자명', { exact: true }).fill('qa-user');
  await page.getByLabel('비밀번호', { exact: true }).fill('synthetic login passphrase');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByLabel('왜 만드는가', { exact: true })).toHaveValue('서버에 아직 저장하지 않은 목적');
  await page.getByRole('link', { name: '프로젝트 목록으로 · 입력은 탭에 유지' }).click();
  await page.goBack();
  await expect(page.getByLabel('왜 만드는가', { exact: true })).toHaveValue('서버에 아직 저장하지 않은 목적');
});

test('다른 사용자로 재로그인하면 앞선 소유자의 초안 입력을 표시하거나 전송하지 않는다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: '첫 사용자' }, clientId: id, csrfToken: csrf } }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  const writes: any[] = [];
  await page.route('**/api/v1/project-drafts', route => { writes.push(route.request().postDataJSON()); return route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }); });
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { user: { id: 'a6f20000-0000-4000-8000-000000000099', displayName: '다른 사용자' }, clientId: '51c0439f-791e-4bb5-8471-70938d6afaf1', csrfToken: 'B'.repeat(43) } }));
  await page.goto('/#/projects/new');
  await page.getByLabel('왜 만드는가', { exact: true }).fill('앞선 사용자에게만 속하는 미저장 목적');
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible();
  await page.getByLabel('사용자명', { exact: true }).fill('other-user'); await page.getByLabel('비밀번호', { exact: true }).fill('synthetic login passphrase');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('banner').getByText('다른 사용자', { exact: true })).toBeVisible();
  await expect(page.getByLabel('왜 만드는가', { exact: true })).toHaveCount(0);
  await expect(page.getByText('이 탭의 초안은 다른 로그인 사용자의 자료입니다. 내용을 표시하거나 전송하지 않습니다.', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
});
