import { expect, test } from '@playwright/test';
import{canonicalJson,contentHash}from'../../../contracts/canonical.ts';

const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unexpected.set(page, []);
  await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
});
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', csrf = 'C'.repeat(43);
const input = { name: '내 프로젝트', purpose: '개발 주도권', desiredOutcome: '원본 유지', sourceMode: 'EMPTY', methodologySelection: null, artifactRefs: [] };
test('기존 소스 위치 설명은 미확인 선언으로 저장·재조회되고 실제 파일 접근을 요청하지 않는다',async({page})=>{
 let draft:any=null;const writes:any[]=[];await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id,displayName:'QA'},clientId:id,csrfToken:csrf}}));
 await page.route('**/api/v1/project-drafts',r=>{const c=r.request().postDataJSON();writes.push(c);const {name,purpose,desiredOutcome,sourceMode,sourceDeclaration,methodologySelection,artifactRefs}=c;draft={draftId:id,version:1,step:1,input:{name,purpose,desiredOutcome,sourceMode,sourceDeclaration,methodologySelection,artifactRefs},sourceDeclaration:{ref:{id,version:1,contentHash:contentHash(canonicalJson(sourceDeclaration))},authority:'USER_DECLARED',readiness:'UNVERIFIED',declaration:sourceDeclaration}};return r.fulfill({status:201,json:draft});});
 await page.route('**/api/v1/project-drafts/'+id,r=>r.fulfill({json:{...draft,editable:true,consumedProjectId:null}}));await page.goto('/#/projects/new');await page.getByLabel('프로젝트 이름',{exact:true}).fill(input.name);await page.getByLabel('왜 만드는가',{exact:true}).fill(input.purpose);await page.getByLabel('기대 결과',{exact:true}).fill(input.desiredOutcome);await page.getByLabel('프로젝트 소스 방식',{exact:true}).selectOption('EXISTING');await page.getByLabel('소스가 있는 기기',{exact:true}).fill('내 Windows PC');await page.getByLabel('소스 표시 이름',{exact:true}).fill('내 기존 소스');await page.getByLabel('소스 위치 설명',{exact:true}).fill('D:\\Synthetic\\NotOpened');await page.getByLabel('소스 선언 이유',{exact:true}).fill('파일을 열지 않은 설명');await page.getByRole('button',{name:'중간 저장',exact:true}).click();await expect(page.getByRole('status').last()).toContainText('초안 버전 1');await page.reload();await expect(page.getByLabel('소스 위치 설명',{exact:true})).toHaveValue('D:\\Synthetic\\NotOpened');await expect(page.getByText('기존 소스 사용자 선언 · 미확인',{exact:true})).toBeVisible();expect(writes).toHaveLength(1);expect(writes[0].sourceMode).toBe('EXISTING');
});
test('프로젝트 초안 안에 두 단계 방법론을 직접 작성하고 명시 저장 뒤 재조회한다', async ({ page }) => {
  let draft: any = null; const writes: any[] = [];
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  for (const path of ['methodologies', 'forms']) await page.route('**/api/v1/' + path, route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/project-drafts', route => { writes.push(route.request().postDataJSON()); draft = { draftId: id, version: 1, step: 1, input }; return route.fulfill({ status: 201, json: draft }); });
  await page.route('**/api/v1/project-drafts/' + id, route => {
    if (route.request().method() === 'PATCH') { const body = route.request().postDataJSON(); writes.push(body); draft = { draftId: id, version: 2, step: 2, input: body.input }; }
    return route.fulfill({ json: { ...draft, editable: true, consumedProjectId: null } });
  });
  await page.goto('/#/projects/new');
  await page.getByLabel('프로젝트 이름', { exact: true }).fill(input.name); await page.getByLabel('왜 만드는가', { exact: true }).fill(input.purpose); await page.getByLabel('기대 결과', { exact: true }).fill(input.desiredOutcome);
  await page.getByRole('button', { name: '중간 저장', exact: true }).click(); await expect(page.getByRole('status').last()).toContainText('초안 버전 1');
  await page.getByRole('button', { name: '방법론·자료로 다음', exact: true }).click();
  await page.getByRole('button', { name: '이 프로젝트 방법론 직접 작성', exact: true }).click();
  const editor = page.getByRole('region', { name: '프로젝트 전용 방법론 편집' });
  await editor.getByLabel('전용 방법론 이름', { exact: true }).fill('내 프로젝트 두 단계'); await editor.getByLabel('전용 방법론 목적', { exact: true }).fill('사람 판단 뒤 진행');
  for (const name of ['요구 확인', '결과 확인']) {
    await editor.getByRole('button', { name: '단계 추가', exact: true }).click();
    await editor.getByLabel('단계 이름 편집', { exact: true }).fill(name); await editor.getByLabel('단계 목적 편집', { exact: true }).fill(name + '을 판단');
    await editor.getByLabel('단계 유형', { exact: true }).selectOption('HUMAN'); await editor.getByLabel('포함 작업', { exact: true }).fill('내용 직접 확인');
    await editor.getByLabel('완료·검수 조건 편집', { exact: true }).fill('판단 기록'); await editor.getByLabel('작업 기록 요구 편집', { exact: true }).fill('판단 이유 보존');
  }
  await editor.getByRole('button', { name: '단계 연결 추가', exact: true }).click(); await editor.getByLabel('연결 이유', { exact: true }).fill('요구 확인 뒤 결과를 확인');
  await editor.getByLabel('요구 확인 종료 단계', { exact: true }).uncheck(); await editor.getByLabel('결과 확인 종료 단계', { exact: true }).check();
  await editor.getByRole('button', { name: '선택 단계 오른쪽 이동', exact: true }).click();
  expect(writes).toHaveLength(1); // 편집 부품의 버튼이 form submit으로 저장하면 실패한다.
  await page.getByRole('button', { name: '중간 저장', exact: true }).click(); await expect(page.getByRole('status').last()).toContainText('초안 버전 2');
  const selected = draft.input.methodologySelection;
  expect(selected.kind).toBe('NEW_PROJECT_DRAFT'); expect(selected.name).toBe('내 프로젝트 두 단계'); expect(selected.sourceRefs).toEqual([]); expect(selected.reviewRefs).toEqual([]);
  expect(selected.graph.nodes.map((node: any) => node.name)).toEqual(['요구 확인', '결과 확인']); expect(selected.graph.nodes[1].position.x).toBe(260); expect(selected.graph.edges).toHaveLength(1);
  await page.reload(); await expect(page.getByLabel('전용 방법론 이름', { exact: true })).toHaveValue('내 프로젝트 두 단계');
  await expect(page.getByText('프로젝트 전용 초안 · 검토·확정 전', { exact: true })).toBeVisible(); expect(writes).toHaveLength(2);
});
test('선택한 방법론을 프로젝트 전용으로 복사하며 늦은 조회 동안 저장을 막고 원본을 바꾸지 않는다', async ({ page }) => {
  const ref = { id: 'a6f20000-0000-4000-8000-000000000001', version: 2, contentHash: 'a'.repeat(64) };
  const summary = { ref, name: '구조적 방법론', purpose: '기본 판단 절차', scope: 'SYSTEM', systemCode: 'SYS-M01', status: 'DRAFT', sourceAvailable: true };
  const graph = { nodes: [{ nodeId: 'START', name: '기본 확인', purpose: '원래 목적', kind: 'HUMAN', role: 'USER', mode: 'CASE_BY_CASE', position: { x: 10, y: 20 }, inputs: [], outputs: [], taskScope: { included: ['직접 판단'], excluded: [] }, completionCriteria: ['판단 기록'], approvalBoundary: [], limitPolicyRef: null, recordRequirements: ['이유 기록'] }], edges: [], entryNodeId: 'START', terminalNodeIds: ['START'] };
  let draft: any = null, release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const writes: any[] = [];
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  await page.route('**/api/v1/methodologies', route => route.fulfill({ json: { items: [summary], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route(`**/api/v1/methodologies/${ref.id}/versions/2`, async route => { await gate; await route.fulfill({ json: { ...summary, graph, confirmation: null, validation: { validForConfirmation: true, issues: [] }, runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' } }); });
  await page.route('**/api/v1/project-drafts', route => { writes.push(route.request().postDataJSON()); draft = { draftId: id, version: 1, step: 1, input }; return route.fulfill({ status: 201, json: draft }); });
  await page.route('**/api/v1/project-drafts/' + id, route => { const body = route.request().postDataJSON(); writes.push(body); draft = { draftId: id, version: 2, step: 2, input: body.input }; return route.fulfill({ json: draft }); });
  await page.goto('/#/projects/new'); await page.getByLabel('프로젝트 이름', { exact: true }).fill(input.name); await page.getByLabel('왜 만드는가', { exact: true }).fill(input.purpose); await page.getByLabel('기대 결과', { exact: true }).fill(input.desiredOutcome);
  await page.getByRole('button', { name: '중간 저장', exact: true }).click(); await expect(page.getByRole('status').last()).toContainText('초안 버전 1');
  await page.getByRole('button', { name: '방법론·자료로 다음', exact: true }).click();
  await page.getByRole('button', { name: '선택 방법론을 이 프로젝트 초안으로 복사', exact: true }).click();
  await expect(page.getByRole('button', { name: '중간 저장', exact: true })).toBeDisabled(); expect(writes).toHaveLength(1);
  release(); await expect(page.getByLabel('전용 방법론 이름', { exact: true })).toHaveValue('구조적 방법론');
  await page.getByLabel('단계 목적 편집', { exact: true }).fill('이 프로젝트만의 수정 목적');
  await page.getByRole('button', { name: '중간 저장', exact: true }).click(); await expect(page.getByRole('status').last()).toContainText('초안 버전 2');
  expect(draft.input.methodologySelection.sourceRefs).toEqual([ref]); expect(draft.input.methodologySelection.reviewRefs).toEqual([]); expect(draft.input.methodologySelection.graph.nodes[0].purpose).toBe('이 프로젝트만의 수정 목적');
  expect(graph.nodes[0]!.purpose).toBe('원래 목적'); expect(writes).toHaveLength(2);
});

test('저장한 목적에서 내 확정 방법론을 선택해 초안2단계에 저장하고 새로고침 뒤 재조회한다', async ({ page }) => {
  const ref = { id: 'a6f20000-0000-4000-8000-000000000099', version: 2, contentHash: 'e'.repeat(64) };
  const summary = { ref, name: '검토한 내 개발 절차', purpose: '개발 기준을 유지', scope: 'USER_COMMON', systemCode: null, status: 'CONFIRMED', sourceAvailable: false };
  let draft: any = null; const writes: any[] = [];
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/, route => {
    const next = new URL(route.request().url()).searchParams.get('cursor') === 'picker-next';
    return route.fulfill({ json: { items: next ? [summary] : [{ ...summary, ref: { ...ref, id: 'a6f20000-0000-4000-8000-000000000001' }, scope: 'SYSTEM', systemCode: 'SYS-M01', status: 'DRAFT', name: '기본 방법론', sourceAvailable: true }], observedAt: new Date().toISOString(), nextCursor: next ? null : 'picker-next', hasMore: !next, baselineVersion: null } });
  });
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
  await page.getByRole('button', { name: '방법론 선택 목록 더 보기', exact: true }).click();
  await expect(page.getByLabel('사용할 방법론', { exact: true }).getByRole('option')).toHaveCount(3);
  await page.getByLabel('사용할 방법론', { exact: true }).selectOption(ref.id);
  await page.getByRole('button', { name: '선택한 방법론 연결', exact: true }).click();
  await page.getByRole('button', { name: '중간 저장', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('초안 버전 2');
  expect(draft.input.methodologySelection).toEqual({ kind: 'CONFIRMED_REFERENCE', versionRef: ref });
  await page.reload();
  await expect(page.getByText('선택한 고정 방법론 · 버전 2', { exact: true })).toBeVisible();
  // 승인된 최초 생성 연결 후에는 저장한 확정 선택에서만 활성화한다. 자동 생성0은 catch-all API로 검사한다.
  await expect(page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true })).toBeEnabled();
  await page.getByLabel('왜 만드는가', { exact: true }).fill('아직 저장하지 않은 목적 변경');
  await expect(page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true })).toBeDisabled();
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
