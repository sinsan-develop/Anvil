import { test, expect, type Page } from '@playwright/test';
import { installWorkspaceBundle } from './bundle.ts';
import { createHash } from 'node:crypto';
const pid = '32b5f276-13e6-4d8a-b93f-27a15d21c788', other = '51c0439f-791e-4bb5-8471-70938d6afaf1';
const data = (id = pid) => ({ id, name: id === pid ? 'Anvil 원본' : '다른 프로젝트', purpose: '개발 절차를 내가 관리', desiredOutcome: '도구를 바꿔도 지식 유지', version: 2,
  createdAt: '2026-10-16T01:02:03Z', updatedAt: '2026-10-17T01:02:03Z', currentMethodologyRef: { id: other, version: 1, contentHash: 'a'.repeat(64) }, baselineRef: null,
  sourceMode: 'EMPTY', sourceDeclaration: null, readinessIssues: [{ code: 'PERMISSION_POLICY_UNCONFIGURED' }], viewerPermissions: ['READ_PROJECT'], participation: 'OWNER',
  controlState: { actorId: other, clientId: pid, generation: 1, status: 'HELD' } });
const documentId = 'a6f30000-0000-4000-8000-000000000098', artifactId = 'a6f30000-0000-4000-8000-000000000099';
const documentBody = '# 요구 원문\r\n<script>window.WORKSPACE_DOCUMENT_EXECUTED=1</script>\r\n', documentBytes = Buffer.from(documentBody);
const document = { id: documentId, version: 2, title: '원문을 보존하는 요구사항', confirmed: false, contentHash: 'b'.repeat(64),
  formRef: { id: artifactId, version: 1, contentHash: 'a'.repeat(64) }, stageNodeRef: null, stageBinding: null,
  content: { body: { artifactId, bytes: documentBytes.length, contentHash: createHash('sha256').update(documentBytes).digest('hex'), mediaType: 'text/markdown;charset=utf-8' }, attachments: [], sections: [], sourceRefs: [] },
  validation: { validForConfirmation: false, issues: [] }, statusHistory: [],
  contentReviewCriteria: { criteriaVersion: 1, formRef: { id: artifactId, version: 1, contentHash: 'a'.repeat(64) }, items: [] }, contentReviews: [] };
const documents = { items: [{ id: documentId, title: document.title, headVersion: 2, confirmedVersion: null, updatedAt: '2026-10-17T01:02:03Z' }], hasMore: false, nextCursor: null, observedAt: '2026-10-17T01:02:03Z' };
async function setup(page: Page) {
  const unexpected: string[] = [], writes: string[] = [], errors: string[] = [];
  await page.route('**/api/v1/**', route => { unexpected.push(route.request().url()); return route.abort(); });
  await installWorkspaceBundle(page);
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: other, displayName: 'QA' }, clientId: pid, csrfToken: 'A'.repeat(43) } }));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); if (new URL(request.url()).origin !== 'https://localhost:3830') unexpected.push(request.url()); }); page.on('pageerror', error => errors.push(error.message));
  return { unexpected, writes, errors };
}

async function documentSetup(page: Page) {
  const facts = await setup(page);
  await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ json: data() }));
  await page.route(`**/api/v1/projects/${pid}/documents?*`, route => route.fulfill({ json: documents }));
  await page.route(`**/api/v1/projects/${pid}/documents/${documentId}/versions/2`, route => route.fulfill({ json: document }));
  await page.route(`**/api/v1/projects/${pid}/files/${artifactId}`, route => route.fulfill({ body: documentBytes, contentType: 'application/octet-stream' }));
  await page.goto(`/#/projects/${pid}/workspace`);
  return facts;
}

test('주 작업에서 문서 목록과 선택한 고정 버전 원문을 읽고 문서 안 지시는 실행하지 않는다', async ({ page }) => {
  const facts = await documentSetup(page);
  await page.getByRole('button', { name: '프로젝트 문서 조회', exact: true }).click();
  const panel = page.getByRole('region', { name: '주 작업 문서 조회', exact: true });
  await panel.getByRole('button', { name: '문서: 원문을 보존하는 요구사항 v2 조회', exact: true }).click();
  await expect(panel.getByLabel('주 작업 문서 원문', { exact: true })).toHaveText(documentBody);
  await expect(panel).toContainText('저장 버전 2'); await expect(panel).toContainText('단계별 필터·실행 결과는 미연결');
  expect(await page.evaluate(() => (window as any).WORKSPACE_DOCUMENT_EXECUTED)).toBeUndefined();
  expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});

test('주 작업 문서 목록 조회가 거절되면 앞선 목록과 원문을 남기지 않는다', async ({ page }) => {
  const facts = await documentSetup(page);
  await page.getByRole('button', { name: '프로젝트 문서 조회', exact: true }).click();
  const panel = page.getByRole('region', { name: '주 작업 문서 조회', exact: true });
  await panel.getByRole('button', { name: '문서: 원문을 보존하는 요구사항 v2 조회', exact: true }).click();
  await expect(panel.getByLabel('주 작업 문서 원문', { exact: true })).toBeVisible();
  await page.route(`**/api/v1/projects/${pid}/documents?*`, route => route.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } }));
  await panel.getByRole('button', { name: '문서 목록 새로고침', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeVisible(); await expect(panel.getByLabel('주 작업 문서 원문', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '문서: 원문을 보존하는 요구사항 v2 조회', exact: true })).toHaveCount(0);
  expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});

test('주 작업에서 문서 원문 해시 불일치를 빈 성공으로 표시하지 않는다', async ({ page }) => {
  const facts = await documentSetup(page);
  await page.route(`**/api/v1/projects/${pid}/files/${artifactId}`, route => route.fulfill({ body: Buffer.from('다른 원문'), contentType: 'application/octet-stream' }));
  await page.getByRole('button', { name: '프로젝트 문서 조회', exact: true }).click();
  const panel = page.getByRole('region', { name: '주 작업 문서 조회', exact: true });
  await panel.getByRole('button', { name: '문서: 원문을 보존하는 요구사항 v2 조회', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED');
  await expect(panel.getByLabel('주 작업 문서 원문', { exact: true })).toHaveCount(0); expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});

test('주 작업 문서 다음 목록은 서버 cursor로 조회하고 앞선 목록을 현재 목록으로 남기지 않는다', async ({ page }) => {
  const facts = await documentSetup(page), cursors: (string | null)[] = [];
  await page.route(`**/api/v1/projects/${pid}/documents?*`, route => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor'); cursors.push(cursor);
    return route.fulfill({ json: cursor === null ? { ...documents, hasMore: true, nextCursor: 'synthetic-next-page' } : { ...documents, items: [{ ...documents.items[0], id: other, title: '다음 문서' }] } });
  });
  await page.getByRole('button', { name: '프로젝트 문서 조회', exact: true }).click();
  const panel = page.getByRole('region', { name: '주 작업 문서 조회', exact: true });
  await panel.getByRole('button', { name: '문서 다음 목록', exact: true }).click();
  await expect(panel.getByRole('button', { name: '문서: 다음 문서 v2 조회', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: '문서: 원문을 보존하는 요구사항 v2 조회', exact: true })).toHaveCount(0);
  expect(cursors).toEqual([null, 'synthetic-next-page']); expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});

test('다른 프로젝트로 이동한 뒤 완료된 옛 문서 원문은 주 작업에 섞이지 않는다', async ({ page }) => {
  await page.addInitScript(({ expectedHash }) => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (algorithm, bytes) => {
      const digest = await original(algorithm, bytes);
      if ([...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') === expectedHash) {
        const boundary = globalThis as typeof globalThis & { ui04DocumentReady?: boolean; ui04ReleaseDocument?: () => void; ui04DocumentReturned?: boolean };
        boundary.ui04DocumentReady = true;
        await new Promise<void>(resolve => { boundary.ui04ReleaseDocument = resolve; });
        setTimeout(() => { boundary.ui04DocumentReturned = true; }, 0);
      }
      return digest;
    };
  }, { expectedHash: document.content.body.contentHash });
  const facts = await documentSetup(page);
  await page.route('**/api/v1/projects/' + other, route => route.fulfill({ json: data(other) }));
  await page.getByRole('button', { name: '프로젝트 문서 조회', exact: true }).click();
  await page.getByRole('button', { name: '문서: 원문을 보존하는 요구사항 v2 조회', exact: true }).click();
  await page.waitForFunction(() => (globalThis as any).ui04DocumentReady === true);
  await page.evaluate(value => { location.hash = `/projects/${value}/workspace`; }, other);
  await expect(page.getByRole('heading', { name: '다른 프로젝트', exact: true })).toBeVisible();
  await page.evaluate(() => { (globalThis as any).ui04ReleaseDocument(); });
  await page.waitForFunction(() => (globalThis as any).ui04DocumentReturned === true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByLabel('주 작업 문서 원문', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: document.title, exact: true })).toHaveCount(0);
  expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});

test('기존 소스 선언은 실제 관측과 구분하고 소유자에게 저장된 원문을 표시한다', async ({ page }) => {
  const facts = await setup(page);
  const declaration = { displayName: '기존 개발 소스', hostLabel: 'QA PC', pathHint: 'D:\\qa\\project', reason: '기존 프로젝트 이어가기' };
  const sourceDeclaration = { ref: { id: other, version: 3, contentHash: createHash('sha256').update(JSON.stringify(declaration)).digest('hex') }, authority: 'USER_DECLARED', readiness: 'UNVERIFIED', declaration };
  await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ json: { ...data(), sourceMode: 'EXISTING', sourceDeclaration } }));
  await page.goto(`/#/projects/${pid}/workspace`);
  await page.getByText('기존 소스 사용자 선언 · 실제 관측 미확인', { exact: true }).click();
  const source = page.getByRole('group', { name: '기존 소스 사용자 선언 · 실제 관측 미확인', exact: true });
  await expect(source).toContainText('QA PC'); await expect(source).toContainText('기존 개발 소스');
  await expect(source.getByText('D:\\qa\\project', { exact: true })).toBeVisible(); await expect(source).toContainText('기존 프로젝트 이어가기');
  await expect(source).toContainText('선언 버전 3'); await expect(source).toContainText('파일 접근·검증·실행 권한이 아닙니다.');
  await expect(page.getByRole('button', { name: '지시 전송 · 미연결' })).toBeDisabled(); expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});

test('조회 전용 소스 선언은 서버가 숨긴 원문을 요구하거나 표시하지 않는다', async ({ page }) => {
  const facts = await setup(page);
  await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ json: { ...data(), participation: 'VIEWER', sourceMode: 'EXISTING', sourceDeclaration: null } }));
  await page.goto(`/#/projects/${pid}/workspace`);
  await expect(page.getByText('기존 소스 사용자 선언 있음 · 원문은 소유자에게만 표시됩니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '기존 소스 사용자 선언 · 실제 관측 미확인', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0); expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});
test('프로젝트 목록에서 실제 원본 조회 화면으로 열고 저장 자료로 이동할 경로를 제공한다', async ({ page }) => {
  const facts = await setup(page);
  await page.route(/\/api\/v1\/projects\?/, route => route.fulfill({ json: { items: [{ id: pid, name: 'Anvil 원본', purpose: '개발 절차를 내가 관리', version: 2, updatedAt: '2026-10-17T01:02:03Z' }], hasMore: false, nextCursor: null, observedAt: '2026-10-17T01:02:03Z', baselineVersion: null } }));
  await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ json: data() }));
  await page.goto('/'); await page.getByRole('link', { name: 'Anvil 원본 프로젝트 열기', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 원본', exact: true })).toBeVisible(); await expect(page.getByText('도구를 바꿔도 지식 유지', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '개발 절차', exact: true })).toContainText('고정 적용 참조');
  await expect(page.getByRole('link', { name: '문서·설계·작업계획 열기' })).toHaveAttribute('href', `#/projects/${pid}/documents`);
  await expect(page.getByRole('button', { name: '지시 전송 · 미연결' })).toBeDisabled(); await expect(page.getByText('명시 권한 정책 미설정', { exact: true })).toBeVisible();
  expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});
test('조회 실패·권한 회수 때 앞선 원본을 현재 프로젝트로 남기지 않는다', async ({ page }) => {
  const facts = await setup(page); let status = 200;
  await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ status, json: status === 200 ? data() : { code: 'ACCESS_DENIED' } }));
  await page.goto(`/#/projects/${pid}/workspace`); await expect(page.getByRole('heading', { name: 'Anvil 원본', exact: true })).toBeVisible();
  status = 403; await page.getByRole('button', { name: '프로젝트 원본 새로고침' }).click(); await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anvil 원본', exact: true })).toHaveCount(0); await expect(page.getByText('도구를 바꿔도 지식 유지', { exact: true })).toHaveCount(0);
  expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});
test('다른 프로젝트로 이동한 뒤 늦게 도착한 원 응답은 표시하지 않는다', async ({ page }) => {
  const facts = await setup(page); let release!: () => void, entered!: () => void;
  await page.addInitScript(({ id }) => {
    const original = Response.prototype.json;
    Response.prototype.json = async function () {
      const value = await original.call(this);
      if (new URL(this.url).pathname === '/api/v1/projects/' + id) {
        const boundary = globalThis as typeof globalThis & { ui04JsonReady?: boolean; ui04ReleaseJson?: () => void; ui04JsonReturned?: boolean };
        boundary.ui04JsonReady = true;
        await new Promise<void>(resolve => { boundary.ui04ReleaseJson = resolve; });
        setTimeout(() => { boundary.ui04JsonReturned = true; }, 0);
      }
      return value;
    };
  }, { id: pid });
  const gate = new Promise<void>(resolve => { release = resolve; }), observed = new Promise<void>(resolve => { entered = resolve; });
  await page.route('**/api/v1/projects/' + pid, async route => { entered(); await gate; await route.fulfill({ json: data() }); });
  await page.route('**/api/v1/projects/' + other, route => route.fulfill({ json: data(other) }));
  await page.goto(`/#/projects/${pid}/workspace`); await observed; await page.evaluate(value => { location.hash = `/projects/${value}/workspace`; }, other);
  await expect(page.getByRole('heading', { name: '다른 프로젝트', exact: true })).toBeVisible(); const finished = page.waitForResponse(response => response.url().endsWith('/projects/' + pid)); release(); const response = await finished; await response.finished();
  await page.waitForFunction(() => (globalThis as typeof globalThis & { ui04JsonReady?: boolean }).ui04JsonReady === true);
  await page.evaluate(() => { (globalThis as typeof globalThis & { ui04ReleaseJson?: () => void }).ui04ReleaseJson!(); });
  await page.waitForFunction(() => (globalThis as typeof globalThis & { ui04JsonReturned?: boolean }).ui04JsonReturned === true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('heading', { name: '다른 프로젝트', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anvil 원본', exact: true })).toHaveCount(0); expect(facts).toEqual({ unexpected: [], writes: [], errors: [] });
});
