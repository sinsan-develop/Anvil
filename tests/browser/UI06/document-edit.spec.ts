import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', artifactId = 'a6f30000-0000-4000-8000-000000000099';
const formRef = { id: artifactId, version: 1, contentHash: 'a'.repeat(64) }, csrf = 'C'.repeat(43), initial = '\uFEFF# 원본\r\n이전 내용\r\n';
const unknown = new WeakMap<object, string[]>();
test('문서 편집은 직접 저장과 별도 수정 제안 저장을 구분한다', async ({ page }) => {
  const state = await documents(page), uploads: any[] = [], proposals: any[] = [], applications: any[] = []; let uploaded: any, proposal: any, diffBytes = Buffer.alloc(0), text = '';
  const original = { artifactId, bytes: Buffer.byteLength(initial), contentHash: createHash('sha256').update(initial).digest('hex'), mediaType: 'text/markdown;charset=utf-8' }, beforeContent = { body: original, attachments: [], sections: [{ itemId: 'REQ', anchor: 'line:1' }], sourceRefs: [] };
  await page.route(`**/api/v1/projects/${project}/files`, route => {
    const c = JSON.parse(route.request().headers()['x-anvil-command']!); uploads.push(c); text = route.request().postDataBuffer()!.toString('utf8'); uploaded = { artifactId: crypto.randomUUID(), ...c.payload };
    return route.fulfill({ status: 201, json: receipt(c, { status: 'ARTIFACT_READY', artifactRef: uploaded }, null, uploaded.artifactId) });
  });
  await page.route(`**/api/v1/projects/${project}/commands`, route => {
    const c = route.request().postDataJSON();
    if (c.operation === 'proposeDocumentChange') {
      proposals.push(c); expect(c.expectedVersion).toBe(2); expect(c.payload.proposedContent.body).toEqual(uploaded);
      if (!proposal) { diffBytes = Buffer.from(JSON.stringify({ format: 'ANVIL_TEXT_DIFF_1', startLine: 1, unchangedBefore: 0, unchangedAfter: 0, before: [initial], after: [text], baseRef: c.payload.baseRef, baseBodyRef: original, proposedBodyRef: uploaded, beforeContent, afterContent: c.payload.proposedContent })); proposal = { id: crypto.randomUUID(), baseRef: c.payload.baseRef, proposedContentRef: uploaded, diffRef: { artifactId: crypto.randomUUID(), bytes: diffBytes.length, contentHash: createHash('sha256').update(diffBytes).digest('hex'), mediaType: 'application/json;charset=utf-8' }, status: 'PENDING' }; }
      return proposals.length === 1 ? route.abort('connectionreset') : route.fulfill({ json: receipt(c, { status: 'PROPOSAL_RECORDED', ref: proposal.baseRef, proposal }, 2, id) });
    }
    applications.push(c); expect(c.operation).toBe('saveDocumentDraft'); expect(c.payload.proposalRef).toBe(proposal.id); expect(c.expectedVersion).toBe(2); state.apply(c, uploaded, text);
    const ref = { id, version: 3, contentHash: contentHash(canonicalJson({ title: c.payload.title, formRef, stageNodeRef: null, content: c.payload.content })) };
    return applications.length === 1 ? route.abort('connectionreset') : route.fulfill({ json: receipt(c, { status: 'DRAFT', proposalRef: proposal.id, ref }, 3, id) });
  });
  await page.route(`**/api/v1/projects/${project}/proposals/*`, route => route.fulfill({ json: { ...proposal, proposedContent: proposals[0].payload.proposedContent, reason: proposals[0].payload.reason, createdAt: '2026-10-16T05:00:00Z', proposedBy: id, selections: [] } }));
  await page.route(`**/api/v1/projects/${project}/files/*`, route => { const target = new URL(route.request().url()).pathname.split('/').pop(); return route.fulfill({ contentType: 'application/octet-stream', body: target === artifactId ? Buffer.from(initial) : target === proposal?.diffRef.artifactId ? diffBytes : Buffer.from(text) }); });
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button', { name: '원본 문서 열기', exact: true }).click(); await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  await page.getByLabel('문서 본문 편집', { exact: true }).fill('# 제안\n별도로 검토할 변경'); await page.getByLabel('문서 변경 이유', { exact: true }).fill('원본을 바꾸지 않는 제안');
  await expect(page.getByRole('button', { name: '수정 제안으로 저장', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '수정 제안으로 저장', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.getByRole('link', { name: '프로젝트 작업', exact: true }).click(); await page.getByRole('link', { name: '문서·설계 추적', exact: true }).click();
  await expect(page.getByRole('button', { name: '새 문서 작성', exact: true })).toBeDisabled(); await page.getByRole('button', { name: '같은 제안 명령 결과 확인', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('수정 제안 저장 확인'); expect(uploads).toHaveLength(1); expect(proposals).toHaveLength(2); expect(proposals[1]).toEqual(proposals[0]); expect(applications).toHaveLength(0);
  await page.getByRole('button', { name: '제안 차이 비교', exact: true }).click(); await expect(page.getByLabel('제안 기준 원문', { exact: true })).toContainText('이전 내용'); await expect(page.getByLabel('제안 새 원문', { exact: true })).toHaveText('# 제안\n별도로 검토할 변경');
  await expect(page.getByRole('button', { name: '이 제안으로 새 초안 저장', exact: true })).toBeDisabled(); await page.getByLabel('원문·첨부·항목 차이를 확인했고 이 제안을 새 초안으로 반영하겠습니다', { exact: true }).check(); await page.getByRole('button', { name: '이 제안으로 새 초안 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST'); await page.getByRole('link', { name: '프로젝트 작업', exact: true }).click(); await page.getByRole('link', { name: '문서·설계 추적', exact: true }).click(); await page.getByRole('button', { name: '같은 제안 반영 명령 결과 확인', exact: true }).click();
  await expect(page.getByText('제안 반영 버전 3 저장 확인 · 별도 확정 전', { exact: true })).toBeVisible(); expect(applications).toHaveLength(2); expect(applications[1]).toEqual(applications[0]); expect(uploads).toHaveLength(1);
});
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
  await expect(page.getByRole('button', { name: '최신 버전과 비교', exact: true })).toHaveCount(0);
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
test('확정된 버전 충돌은 최신 원문과 내 입력을 비교한 뒤 명시 선택으로만 새 기준 초안을 만든다', async ({ page }) => {
  const state = await documents(page), writes: any[] = [], uploads: any[] = []; let uploaded: any, text = '';
  const own = '# 내 편집\n보존할 내용', serverBody = '# 다른 사용자의 개정\n서버 원문도 보존';
  await page.route(`**/api/v1/projects/${project}/files`, route => {
    const c = JSON.parse(route.request().headers()['x-anvil-command']!); uploads.push(c); text = route.request().postDataBuffer()!.toString('utf8'); uploaded = { artifactId: crypto.randomUUID(), ...c.payload };
    return route.fulfill({ status: 201, json: receipt(c, { artifactRef: uploaded, status: 'ARTIFACT_READY' }, null, uploaded.artifactId) });
  });
  await page.route(`**/api/v1/projects/${project}/commands`, route => {
    const c = route.request().postDataJSON(); writes.push(c);
    if (writes.length === 1) {
      state.apply({ expectedVersion: 2, payload: { title: '다른 사용자의 개정' } }, { artifactId: 'a6f30000-0000-4000-8000-000000000097', bytes: Buffer.byteLength(serverBody), contentHash: createHash('sha256').update(serverBody).digest('hex'), mediaType: 'text/markdown;charset=utf-8' }, serverBody);
      return route.fulfill({ status: 409, json: { code: 'VERSION_CONFLICT' } });
    }
    expect(c.expectedVersion).toBe(3); expect(c.commandId).not.toBe(writes[0].commandId); state.apply(c, uploaded, text);
    return route.fulfill({ json: receipt(c, { ref: { id, version: 4, contentHash: contentHash(canonicalJson({ title: c.payload.title, formRef, stageNodeRef: null, content: c.payload.content })) }, status: 'DRAFT' }, 4, id) });
  });
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button', { name: '원본 문서 열기', exact: true }).click(); await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  await page.getByLabel('문서 본문 편집', { exact: true }).fill(own); await page.getByLabel('문서 변경 이유', { exact: true }).fill('충돌 비교 후 명시 개정'); await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('VERSION_CONFLICT');
  await page.getByRole('button', { name: '최신 버전과 비교', exact: true }).click();
  await expect(page.getByLabel('서버 최신 원문', { exact: true })).toHaveText(serverBody); await expect(page.getByLabel('내 미저장 원문', { exact: true })).toHaveText(own);
  expect(writes).toHaveLength(1); expect(uploads).toHaveLength(1);
  await expect(page.getByRole('button', { name: '내 입력으로 새 기준 초안 준비', exact: true })).toBeDisabled();
  await page.getByLabel('양쪽 내용을 비교했고 내 입력을 새 초안으로 저장하겠습니다', { exact: true }).check();
  await page.getByRole('button', { name: '내 입력으로 새 기준 초안 준비', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveValue(own); expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click(); await expect(page.getByText('초안 버전 4 저장 확인', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); await expect(page.getByLabel('문서 원문', { exact: true })).toHaveText(own);
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

test('빈 프로젝트에서 공식 양식을 선택하고 새 문서를 초안으로 저장한다', async ({ page }) => {
  const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
  const form = catalog.forms[0]!; let created = false, bytes = Buffer.alloc(0), uploaded: any, saved: any;
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: catalog.forms.map(value => ({ ref: value.ref, name: value.definition.name, formCode: value.definition.formCode, scope: 'SYSTEM' })), observedAt: '2026-10-16T05:00:00.000Z', hasMore: false, nextCursor: null, baselineVersion: null } }));
  await page.route(`**/api/v1/forms/${form.ref.id}/versions/1`, route => route.fulfill({ json: { ...form, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } }));
  await page.route(`**/api/v1/projects/${project}/documents?*`, route => route.fulfill({ json: { items: created ? [{ id, title: saved.payload.title, headVersion: 1, confirmedVersion: null, updatedAt: '2026-10-16T05:00:00.000Z' }] : [], hasMore: false, nextCursor: null, observedAt: '2026-10-16T05:00:00.000Z' } }));
  await page.route(`**/api/v1/projects/${project}/files`, route => {
    const command = JSON.parse(route.request().headers()['x-anvil-command']!); bytes = Buffer.from(route.request().postDataBuffer()!); uploaded = { artifactId, ...command.payload };
    return route.fulfill({ status: 201, json: receipt(command, { artifactRef: uploaded, status: 'ARTIFACT_READY' }, null, artifactId) });
  });
  await page.route(`**/api/v1/projects/${project}/commands`, route => {
    saved = route.request().postDataJSON(); expect(saved.targetId).toBeNull(); expect(saved.expectedVersion).toBe(0); expect(saved.payload.formRef).toEqual(form.ref);
    created = true; return route.fulfill({ json: receipt(saved, { ref: { id, version: 1, contentHash: contentHash(canonicalJson({ title: saved.payload.title, formRef: form.ref, stageNodeRef: null, content: saved.payload.content })) }, status: 'DRAFT' }, 1, id) });
  });
  await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/1`, route => route.fulfill({ json: { id, version: 1, title: saved.payload.title, formRef: form.ref, stageNodeRef: null, contentHash: 'b'.repeat(64), confirmed: false, content: saved.payload.content, validation: { validForConfirmation: false, issues: [] }, statusHistory: [], contentReviewCriteria: { criteriaVersion: 1, formRef: form.ref, items: form.definition.items.map(item => ({ criterionId: item.itemId, title: item.title, reviewCriteria: item.reviewCriteria })) }, contentReviews: [], reviewRefs: [] } }));
  await page.route(`**/api/v1/projects/${project}/files/${artifactId}`, route => route.fulfill({ contentType: 'application/octet-stream', body: bytes }));
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '새 문서 작성', exact: true }).click();
  await page.getByLabel('새 문서 양식', { exact: true }).selectOption(form.ref.id);
  await page.getByRole('button', { name: '선택 양식으로 작성', exact: true }).click();
  await page.getByLabel('문서 제목', { exact: true }).fill('처음 작성한 요구사항');
  await page.getByLabel('문서 본문 편집', { exact: true }).fill('# 목적\n프로젝트의 요구 원문');
  await page.getByLabel('문서 변경 이유', { exact: true }).fill('새 요구사항 작성');
  await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByText('초안 버전 1 저장 확인', { exact: true })).toBeVisible();
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveText('# 목적\n프로젝트의 요구 원문');
});
