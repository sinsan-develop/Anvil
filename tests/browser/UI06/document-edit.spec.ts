import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', artifactId = 'a6f30000-0000-4000-8000-000000000099';
const formRef = { id: artifactId, version: 1, contentHash: 'a'.repeat(64) }, csrf = 'C'.repeat(43), initial = '\uFEFF# 원본\r\n이전 내용\r\n';
const unknown = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unknown.set(page, []);
  await page.route('**/api/v1/**', route => { unknown.get(page)!.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: '문서 편집 QA' }, clientId: id, csrfToken: csrf } }));
  await page.route(`**/api/v1/projects/${project}`, route => route.fulfill({ json: { id: project, name: '자료 보존', purpose: '사용자가 소유하는 개발 자료', participation: 'OWNER', controlState: { actorId: id, clientId: id, generation: 4, status: 'HELD' }, readinessIssues: [] } }));
});
test.afterEach(async ({ page }) => { expect(unknown.get(page)).toEqual([]); });

async function documents(page: any) {
  let head = 2, title = '원본 문서', body = initial;
  const original = { artifactId, bytes: Buffer.byteLength(initial), contentHash: createHash('sha256').update(initial).digest('hex'), mediaType: 'text/markdown;charset=utf-8' };
  let artifact = original;
  await page.route(`**/api/v1/projects/${project}/documents?*`, (route: any) => route.fulfill({ json: { items: [{ id, title, headVersion: head, confirmedVersion: null, updatedAt: '2026-10-16T05:00:00.000Z' }], nextCursor: null, hasMore: false, observedAt: '2026-10-16T05:00:00.000Z' } }));
  await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/*`, (route: any) => {
    const version = Number(new URL(route.request().url()).pathname.split('/').pop()), content = { body: version < 3 ? original : artifact, attachments: [], sections: [{ itemId: 'REQ', anchor: 'line:1' }], sourceRefs: [] };
    const versionTitle = version < 3 ? '원본 문서' : title;
    return route.fulfill({ json: { id, version, title: versionTitle, formRef, stageNodeRef: null, contentHash: contentHash(canonicalJson({ title: versionTitle, formRef, stageNodeRef: null, content })), confirmed: false, content, sourceRefs: [], authorRef: { kind: 'HUMAN', userId: id }, createdAt: '2026-10-16T05:00:00.000Z', validation: { validForConfirmation: true, issues: [], formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' }, statusHistory: [{ kind: 'DRAFT_SAVED', actorRef: { kind: 'HUMAN', userId: id }, reason: '원본 보관', at: '2026-10-16T05:00:00.000Z' }], contentReviewCriteria: { criteriaVersion: 1, formRef, items: [{ criterionId: 'REQ', title: '요구 내용', reviewCriteria: ['원문 대조'] }] }, contentReviews: [], reviewRefs: [], proposalRefs: [], sourceLinks: [] } });
  });
  await page.route(`**/api/v1/projects/${project}/files/*`, (route: any) => route.request().method() === 'GET' ? route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from(new URL(route.request().url()).pathname.endsWith(artifactId) ? initial : body) }) : route.fallback());
  return { apply(request: any, uploaded: typeof original, text: string) { artifact = uploaded; body = text; title = request.payload.title; head = request.expectedVersion + 1; } };
}
function receipt(command: any, data: any, version: number | null, targetId: string) { return { operationId: artifactId, commandId: command.commandId, projectId: project, status: 'APPLIED', targetId, version, data, evidenceRefs: [], warnings: [], serverReceivedAt: '2026-10-16T05:00:00.000Z' }; }

test('편집 입력은 화면 이동·업로드 응답 단절에도 보존되고 같은 명령으로 새 불변 버전을 저장한다', async ({ page }) => {
  const state = await documents(page), uploads: any[] = [], saves: any[] = []; let uploaded: any, text = '';
  await page.route(`**/api/v1/projects/${project}/files`, route => {
    const request = JSON.parse(route.request().headers()['x-anvil-command']!); uploads.push(request);
    expect(route.request().headers()['x-anvil-csrf']).toBe(csrf); expect(request.controlGeneration).toBe(4);
    const bytes = route.request().postDataBuffer()!; text = bytes.toString('utf8');
    expect(request.payload.bytes).toBe(bytes.length); expect(request.payload.contentHash).toBe(createHash('sha256').update(bytes).digest('hex'));
    uploaded = { artifactId: 'a6f30000-0000-4000-8000-000000000098', ...request.payload };
    return uploads.length === 1 ? route.abort('connectionreset') : route.fulfill({ status: 201, json: receipt(request, { artifactRef: uploaded, status: 'ARTIFACT_READY' }, null, uploaded.artifactId) });
  });
  await page.route(`**/api/v1/projects/${project}/commands`, route => {
    const request = route.request().postDataJSON(); saves.push(request); expect(request.operation).toBe('saveDocumentDraft'); expect(request.expectedVersion).toBe(2);
    expect(request.payload.content.sections).toEqual([{ itemId: 'REQ', anchor: 'line:1' }]);
    const ref = { id, version: 3, contentHash: contentHash(canonicalJson({ title: request.payload.title, formRef, stageNodeRef: null, content: request.payload.content })) };
    state.apply(request, uploaded, text);
    return route.fulfill({ json: receipt(request, { ref, status: 'DRAFT', validation: { validForConfirmation: true, issues: [], formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } }, 3, id) });
  });
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '원본 문서 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  await page.getByLabel('문서 제목', { exact: true }).fill('개정한 문서');
  await page.getByLabel('문서 본문 편집', { exact: true }).fill('# 변경\n사용자 입력 보존');
  await page.getByLabel('문서 변경 이유', { exact: true }).fill('내용을 명확하게 보완');
  await page.getByRole('link', { name: '프로젝트 작업', exact: true }).click();
  await page.getByRole('link', { name: '문서·설계 추적', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveValue('# 변경\n사용자 입력 보존');
  expect(uploads).toHaveLength(0);
  await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 저장 명령 결과 확인', exact: true })).toBeVisible();
  expect(uploads).toHaveLength(1); expect(saves).toHaveLength(0);
  await page.getByRole('button', { name: '같은 저장 명령 결과 확인', exact: true }).click();
  await expect(page.getByText('초안 버전 3 저장 확인', { exact: true })).toBeVisible();
  expect(uploads).toHaveLength(2); expect(uploads[1]).toEqual(uploads[0]); expect(saves).toHaveLength(1);
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveText('# 변경\n사용자 입력 보존');
});

test('버전 충돌은 본문과 기존 저장 명령을 보존하고 자동 덮어쓰기·새 명령을 만들지 않는다', async ({ page }) => {
  await documents(page); const writes: any[] = [];
  await page.route(`**/api/v1/projects/${project}/files`, route => { const request = JSON.parse(route.request().headers()['x-anvil-command']!); return route.fulfill({ status: 201, json: receipt(request, { artifactRef: { artifactId, ...request.payload }, status: 'ARTIFACT_READY' }, null, artifactId) }); });
  await page.route(`**/api/v1/projects/${project}/commands`, route => { writes.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { code: 'VERSION_CONFLICT' } }); });
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '원본 문서 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  await page.getByLabel('문서 본문 편집', { exact: true }).fill('충돌에도 사라지면 안 되는 입력');
  await page.getByLabel('문서 변경 이유', { exact: true }).fill('충돌 시험');
  await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('VERSION_CONFLICT');
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveValue('충돌에도 사라지면 안 되는 입력');
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '같은 저장 명령 결과 확인', exact: true }).click();
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
});

test('저장 중 인증이 만료돼도 입력을 보존하고 다른 로그인 사용자에게 편집 내용을 노출하지 않는다', async ({ page }) => {
  await documents(page); let writes = 0;
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { user: { id: artifactId, displayName: '다른 사용자' }, clientId: artifactId, csrfToken: csrf } }));
  await page.route(`**/api/v1/projects/${project}/files`, route => { writes++; return route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }); });
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '원본 문서 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  await page.getByLabel('문서 본문 편집', { exact: true }).fill('이전 사용자의 미저장 내용');
  await page.getByLabel('문서 변경 이유', { exact: true }).fill('인증 경계 확인');
  await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인', exact: true })).toBeVisible();
  await page.getByLabel('사용자명', { exact: true }).fill('synthetic-other-user');
  await page.getByLabel('비밀번호', { exact: true }).fill('QA-only-not-real-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('다른 사용자 또는 프로젝트의 편집 입력은 숨겨 보존했습니다. 이 화면에서 자동 교체하지 않습니다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveCount(0);
  await expect(page.getByText('이전 사용자의 미저장 내용', { exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
});
