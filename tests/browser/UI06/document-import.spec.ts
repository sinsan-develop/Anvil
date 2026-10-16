import { expect, test } from '@playwright/test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', user = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
test('새 문서 작성에서 원본 가져오기는 후보 확인·명시 선택 전 본문을 덮어쓰지 않는다', async ({ page }) => {
  const unknown: string[] = [];
  await page.route('**/api/v1/**', r => { unknown.push(r.request().url()); return r.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', r => r.fulfill({ json: { user: { id: user, displayName: '가져오기 QA' }, clientId: user, csrfToken: 'C'.repeat(43) } }));
  await page.route(`**/api/v1/projects/${project}`, r => r.fulfill({ json: { id: project, name: '가져오기 QA', participation: 'OWNER', controlState: { actorId: user, clientId: user, generation: 1, status: 'HELD' }, readinessIssues: [] } }));
  await page.route(`**/api/v1/projects/${project}/documents?*`, r => r.fulfill({ json: { items: [], hasMore: false, nextCursor: null, observedAt: '2026-10-16T05:00:00Z' } }));
  // 실제 승인 양식은 제품이 검증하는 원문/hash 그대로 공급한다.
  const { buildOfficialForms } = await import('../../../apps/server/modules/documents/forms.ts');
  const { readFile } = await import('node:fs/promises');
  const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url))), form = catalog.forms[0]!;
  await page.route('**/api/v1/forms', r => r.fulfill({ json: { items: catalog.forms.map(f => ({ ref: f.ref, name: f.definition.name, formCode: f.definition.formCode, scope: 'SYSTEM' })), hasMore: false, nextCursor: null, observedAt: '2026-10-16T05:00:00Z', baselineVersion: null } }));
  await page.route(`**/api/v1/forms/${form.ref.id}/versions/1`, r => r.fulfill({ json: { ...form, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } }));
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '새 문서 작성', exact: true }).click();
  await page.getByLabel('새 문서 양식', { exact: true }).selectOption(form.ref.id);
  await page.getByRole('button', { name: '선택 양식으로 작성', exact: true }).click();
  await expect(page.getByLabel('가져올 원본 파일', { exact: true })).toBeVisible();
  const original = Buffer.from('\uFEFF# 원본\r\n<script>window.IMPORT_SHOULD_NOT_RUN=1</script>  \r\n');
  const uploads: any[] = [], commands: any[] = [], files = new Map<string, Buffer>(); let candidate: any, saved: any;
  const receipt = (c: any, data: any, targetId: string, version: number | null) => ({ operationId: user, commandId: c.commandId, projectId: project, status: 'APPLIED', targetId, version, data, serverReceivedAt: '2026-10-16T05:00:00Z' });
  await page.route(`**/api/v1/projects/${project}/files`, r => {
    const c = JSON.parse(r.request().headers()['x-anvil-command']!), bytes = r.request().postDataBuffer()!, ref = { artifactId: crypto.randomUUID(), ...c.payload };
    uploads.push(c); files.set(ref.artifactId, bytes);
    return r.fulfill({ status: 201, json: receipt(c, { status: 'ARTIFACT_READY', artifactRef: ref }, ref.artifactId, null) });
  });
  await page.route(`**/api/v1/projects/${project}/commands`, r => {
    const c = r.request().postDataJSON(); commands.push(c);
    if (c.operation === 'importDocument') {
      candidate ??= { id: crypto.randomUUID(), originalRef: c.payload.fileRef, extractedContentRef: c.payload.fileRef, intendedFormRef: c.payload.intendedFormRef, parserVersion: 'UTF8_IDENTITY_1', status: 'READY', losses: [], issues: [] };
      return commands.length === 1 ? r.abort('connectionreset') : r.fulfill({ json: receipt(c, { status: 'IMPORT_CANDIDATE', artifactRef: candidate.originalRef, candidate }, candidate.originalRef.artifactId, null) });
    }
    expect(c.operation).toBe('saveDocumentDraft'); expect(c.payload.importCandidateRef).toBe(candidate.id); expect(c.payload.content.attachments).toEqual([candidate.originalRef]);
    saved = c;
    const ref = { id: user, version: 1, contentHash: contentHash(canonicalJson({ title: c.payload.title, formRef: c.payload.formRef, stageNodeRef: null, content: c.payload.content })) };
    return r.fulfill({ json: receipt(c, { status: 'DRAFT', ref, importCandidateRef: candidate.id }, user, 1) });
  });
  await page.route(`**/api/v1/projects/${project}/imports/*`, r => r.fulfill({ json: { ...candidate, originalRef: { mediaType: candidate.originalRef.mediaType, bytes: candidate.originalRef.bytes, contentHash: candidate.originalRef.contentHash, artifactId: candidate.originalRef.artifactId }, createdAt: '2026-10-16T05:00:00Z', selections: [] } }));
  await page.route(`**/api/v1/projects/${project}/files/*`, r => r.fulfill({ contentType: 'application/octet-stream', body: files.get(new URL(r.request().url()).pathname.split('/').pop()!)! }));
  await page.route(`**/api/v1/projects/${project}/documents/${user}/versions/1`, r => r.fulfill({ json: { id: user, version: 1, title: saved.payload.title, formRef: form.ref, stageNodeRef: null, content: saved.payload.content, contentHash: contentHash(canonicalJson({ title: saved.payload.title, formRef: form.ref, stageNodeRef: null, content: saved.payload.content })), confirmed: false, validation: { validForConfirmation: false, issues: [] }, statusHistory: [], contentReviewCriteria: { criteriaVersion: 1, formRef: form.ref, items: form.definition.items.map(i => ({ criterionId: i.itemId, title: i.title, reviewCriteria: i.reviewCriteria })) }, contentReviews: [] } }));
  await page.getByLabel('문서 본문 편집', { exact: true }).fill('기존 미저장 입력');
  await page.getByLabel('가져올 원본 파일', { exact: true }).setInputFiles({ name: '보존할 원문.md', mimeType: 'text/markdown', buffer: original });
  await expect(page.getByRole('button', { name: '원본 보관·가져오기 후보 만들기', exact: true })).toBeVisible(); expect(uploads).toHaveLength(0);
  await page.getByRole('button', { name: '원본 보관·가져오기 후보 만들기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST'); expect(uploads).toHaveLength(1); expect(commands).toHaveLength(1);
  await page.getByRole('link', { name: '프로젝트 작업', exact: true }).click(); await page.getByRole('link', { name: '문서·설계 추적', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveValue('기존 미저장 입력');
  await page.getByRole('button', { name: '같은 가져오기 명령 결과 확인', exact: true }).click();
  await expect(page.getByLabel('가져오기 후보 원문', { exact: true })).toContainText('<script>');
  expect(uploads).toHaveLength(1); expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]);
  await expect(page.getByRole('button', { name: '이 후보로 초안 준비', exact: true })).toBeDisabled();
  await page.getByLabel('원문을 확인했고 현재 편집 본문을 이 후보로 바꾸겠습니다', { exact: true }).check(); await page.getByRole('button', { name: '이 후보로 초안 준비', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveValue(original.toString('utf8').replace(/\r\n/g, '\n'));
  expect(commands).toHaveLength(2); expect(await page.evaluate(() => (window as any).IMPORT_SHOULD_NOT_RUN)).toBeUndefined();
  await page.getByLabel('문서 변경 이유', { exact: true }).fill('가져온 원문을 명시적으로 새 초안에 반영'); await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByText('초안 버전 1 저장 확인', { exact: true })).toBeVisible(); expect(uploads).toHaveLength(2); expect(commands).toHaveLength(3);
  expect(files.get(candidate.originalRef.artifactId)).toEqual(original); expect(files.get(saved.payload.content.body.artifactId)).toEqual(original);
  expect(unknown).toEqual([]);
});
