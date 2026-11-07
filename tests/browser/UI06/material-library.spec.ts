import { expect, test, type Page } from '@playwright/test';
import { installWorkspaceBundle } from '../UI04/bundle.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', user = '32b5f276-13e6-4d8a-b93f-27a15d21c788', candidateId = 'a6f30000-0000-4000-8000-000000000090', proposalId = 'a6f30000-0000-4000-8000-000000000091', documentId = 'a6f30000-0000-4000-8000-000000000092';
const at = '2026-10-16T05:00:00.000Z', importedText = '\uFEFF# 보관 원문\r\n<script>window.STORED_EXECUTED=1</script>  \r\n', baseText = '# 기존 문서\n기존 원문', proposedText = '# 보관 제안\n명시 선택 후 반영';
async function fixture(page: Page, viewer = false, used = false) {
  const dist = process.env.ANVIL_UI06_QA_DIST;
  if (dist) {
    await page.route(/^https:\/\/localhost:3830\/(?:assets\/index-[A-Za-z0-9_-]+\.(?:js|css))?$/, async route => {
      if (route.request().method() !== 'GET') return route.abort();
      const path = new URL(route.request().url()).pathname;
      const contentType = path === '/' ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
      return route.fulfill({ contentType, body: await readFile(join(dist, path === '/' ? 'index.html' : path.slice(1))) });
    });
  } else if (process.env.ANVIL_UI04_QA_DIST === 'apps/web/dist') await installWorkspaceBundle(page);
  const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url))), form = catalog.forms[0]!;
  const files = new Map<string, Buffer>();
  const file = (text: string, mediaType = 'text/markdown;charset=utf-8') => { const artifactId = crypto.randomUUID(), bytes = Buffer.from(text); files.set(artifactId,bytes); return { artifactId, bytes: bytes.length, contentHash: createHash('sha256').update(bytes).digest('hex'), mediaType }; };
  const original = file(importedText), baseBody = file(baseText), proposedBody = file(proposedText);
  const baseContent = { body: baseBody, attachments: [], sections: [], sourceRefs: [] }, proposedContent = { body: proposedBody, attachments: [], sections: [], sourceRefs: [] };
  const baseRef = { id: documentId, version: 1, contentHash: contentHash(canonicalJson({ title: '기존 문서', formRef: form.ref, stageNodeRef: null, content: baseContent })) };
  const diffRef = file(JSON.stringify({ format: 'ANVIL_TEXT_DIFF_1', startLine: 1, unchangedBefore: 0, unchangedAfter: 0, before: [baseText], after: [proposedText], baseRef, baseBodyRef: baseBody, proposedBodyRef: proposedBody, beforeContent: baseContent, afterContent: proposedContent }), 'application/json;charset=utf-8');
  const candidate = { id: candidateId, originalRef: original, extractedContentRef: original, intendedFormRef: form.ref, parserVersion: 'UTF8_IDENTITY_1', losses: [], issues: [], status: 'READY' }, proposal = { id: proposalId, baseRef, proposedContentRef: proposedBody, diffRef, status: 'PENDING' };
  const requests: any[] = [], uploads: any[] = [], unknown: string[] = []; let saved: any = null, controlReads = 0;
  await page.route('**/api/v1/**', r => { unknown.push(r.request().method() + ' ' + new URL(r.request().url()).pathname); return r.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', r => r.fulfill({ json: { user: { id: user, displayName: '보관 자료 QA' }, clientId: user, csrfToken: 'C'.repeat(43) } }));
  await page.route(`**/api/v1/projects/${project}`, r => { controlReads++; return r.fulfill({ json: { id: project, participation: viewer ? 'VIEWER' : 'OWNER', controlState: { actorId: user, clientId: user, generation: 1, status: 'HELD' } } }); });
  await page.route(`**/api/v1/projects/${project}/documents?*`, r => r.fulfill({ json: { items: [{ id: documentId, title: '기존 문서', headVersion: saved?.targetId === documentId ? 2 : 1, confirmedVersion: null, updatedAt: at }], hasMore: false, nextCursor: null, observedAt: at } }));
  await page.route(`**/api/v1/projects/${project}/imports?*`, r => r.fulfill({ json: { items: [{ ...candidate, createdAt: at, integrity: 'NOT_RECHECKED' }], hasMore: false, nextCursor: null, observedAt: at } }));
  await page.route(`**/api/v1/projects/${project}/proposals?*`, r => r.fulfill({ json: { items: [{ ...proposal, title: '기존 문서', createdAt: at, integrity: 'NOT_RECHECKED' }], hasMore: false, nextCursor: null, observedAt: at } }));
  await page.route(`**/api/v1/projects/${project}/imports/${candidateId}`, r => r.fulfill({ json: { ...candidate, createdAt: at, selections: used ? [{documentId,version:1,selectedBy:user,at}] : [] } }));
  await page.route(`**/api/v1/projects/${project}/proposals/${proposalId}`, r => r.fulfill({ json: { ...proposal, proposedContent, proposedBy: user, reason: '보관해 둔 수정 제안', createdAt: at, selections: [] } }));
  await page.route(`**/api/v1/forms/${form.ref.id}/versions/1`, r => r.fulfill({ json: { ...form, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } }));
  await page.route(`**/api/v1/projects/${project}/files/*`, r => r.fulfill({ contentType: 'application/octet-stream', body: files.get(new URL(r.request().url()).pathname.split('/').pop()!)! }));
  const receipt = (c: any, data: any, targetId: string, version: number | null) => ({ operationId: user, commandId: c.commandId, projectId: project, status: 'APPLIED', targetId, version, data, serverReceivedAt: at });
  await page.route(`**/api/v1/projects/${project}/files`, r => { const c = JSON.parse(r.request().headers()['x-anvil-command']!); uploads.push(c); const bytes = r.request().postDataBuffer()!, ref = { artifactId: crypto.randomUUID(), ...c.payload }; files.set(ref.artifactId,bytes); return r.fulfill({ status: 201, json: receipt(c,{ status: 'ARTIFACT_READY', artifactRef: ref },ref.artifactId,null) }); });
  await page.route(`**/api/v1/projects/${project}/commands`, r => { const c = r.request().postDataJSON(); requests.push(c); expect(c.operation).toBe('saveDocumentDraft'); const id = c.targetId ?? crypto.randomUUID(), version = c.expectedVersion + 1, ref = { id, version, contentHash: contentHash(canonicalJson({ title: c.payload.title, formRef: c.payload.formRef, stageNodeRef: null, content: c.payload.content })) }; saved = { ...c, targetId: id, version }; return r.fulfill({ json: receipt(c,{ status: 'DRAFT', ref, proposalRef: c.payload.proposalRef ?? null },id,version) }); });
  await page.route(`**/api/v1/projects/${project}/documents/*/versions/*`, r => { const parts = new URL(r.request().url()).pathname.split('/'), id = parts[6]!, version = Number(parts[8]), content = version === 1 && id === documentId ? baseContent : saved.payload.content, title = version === 1 && id === documentId ? '기존 문서' : saved.payload.title; return r.fulfill({ json: { id, version, title, formRef: form.ref, stageNodeRef: null, content, contentHash: contentHash(canonicalJson({ title, formRef: form.ref, stageNodeRef: null, content })), confirmed: false, validation: { validForConfirmation: false, issues: [] }, statusHistory: [], contentReviewCriteria: { criteriaVersion: 1, formRef: form.ref, items: form.definition.items.map(i => ({ criterionId: i.itemId, title: i.title, reviewCriteria: i.reviewCriteria })) }, contentReviews: [] } }); });
  return { requests, uploads, unknown, original, files, controlReads: () => controlReads };
}
test('MATERIAL_ACCESS_RACE 권한 상실 뒤 지연된 후보는 숨기고 명시 재조회로 복구한다', async ({ page }) => {
  const state = await fixture(page);
  let entered = false, allowed = false, importReads = 0, proposalReads = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const imports = `**/api/v1/projects/${project}/imports?*`, proposals = `**/api/v1/projects/${project}/proposals?*`;
  await page.route(imports, async route => {
    if (++importReads === 1) { entered = true; await gate; }
    await route.fallback();
  });
  await page.route(proposals, route => {
    proposalReads++;
    return allowed ? route.fallback() : route.fulfill({ status: 404, json: { code: 'PROJECT_NOT_FOUND' } });
  });
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '보관한 후보·제안 조회', exact: true }).click();
  const library = page.getByRole('region', { name: '보관한 후보·제안', exact: true });
  const candidate = library.getByRole('button', { name: `가져오기 후보 ${candidateId} 열기`, exact: true });
  const proposal = library.getByRole('button', { name: `보관 제안 ${proposalId} 열기`, exact: true });
  const refresh = library.getByRole('button', { name: '보관 자료 새로고침', exact: true });
  try {
    await expect.poll(() => entered).toBe(true);
    await expect(library.getByRole('alert')).toContainText('PROJECT_NOT_FOUND');
    await expect(candidate).toHaveCount(0);
  } finally {
    const settled = page.waitForResponse(response => response.status() === 200 && new URL(response.url()).pathname.endsWith('/imports'));
    release();
    await (await settled).finished();
  }
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(refresh).toBeEnabled();
  await expect(library.getByRole('alert')).toContainText('PROJECT_NOT_FOUND');
  await expect(candidate).toHaveCount(0); await expect(proposal).toHaveCount(0);
  expect([importReads, proposalReads]).toEqual([1, 1]);
  allowed = true;
  await refresh.click();
  await expect(candidate).toBeEnabled(); await expect(proposal).toBeEnabled();
  await expect(library.getByRole('alert')).toHaveCount(0);
  expect([importReads, proposalReads]).toEqual([2, 2]);
  expect(state.requests).toEqual([]); expect(state.uploads).toEqual([]); expect(state.controlReads()).toBe(0); expect(state.unknown).toEqual([]);
});

for (const code of ['NOT_FOUND', 'ARTIFACT_READ_FAILED'] as const) {
  test('MATERIAL_DETAIL_ACCESS_' + code + ' 사용 문서 조회 오류의 범위를 구분한다', async ({ page }) => {
    const state = await fixture(page, false, true);
    let entered = false, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/v1/projects/${project}/proposals?*`, async route => {
      if (new URL(route.request().url()).searchParams.get('status') === 'PENDING') {
        entered = true;
        await gate;
      }
      await route.fallback();
    });
    if (code === 'NOT_FOUND') {
      await page.route(`**/api/v1/projects/${project}/documents/${documentId}/versions/1`, route =>
        route.fulfill({ status: 404, json: { code } }));
    } else {
      let artifactReads = 0;
      await page.route(`**/api/v1/projects/${project}/files/${state.original.artifactId}`, route =>
        ++artifactReads === 1 ? route.fallback() : route.fulfill({ status: 403 }));
    }
    await page.goto(`/#/projects/${project}/documents`);
    await page.getByRole('button', { name: '보관한 후보·제안 조회', exact: true }).click();
    const library = page.getByRole('region', { name: '보관한 후보·제안', exact: true });
    const candidate = library.getByRole('button', { name: `가져오기 후보 ${candidateId} 열기`, exact: true });
    const proposal = library.getByRole('button', { name: `보관 제안 ${proposalId} 열기`, exact: true });
    const candidateBody = library.getByLabel('보관 후보 원문', { exact: true });
    await candidate.click();
    await expect(candidateBody).toBeVisible();
    await expect(proposal).toBeEnabled();
    await library.getByLabel('보관 제안 상태', { exact: true }).selectOption('PENDING');
    try {
      await expect.poll(() => entered).toBe(true);
      await library.getByRole('button', { name: `사용 문서 ${documentId} 버전 1 원문 보기`, exact: true }).click();
      await expect(library.getByRole('alert')).toContainText(code);
    } finally {
      const settled = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.status() === 200 && url.pathname.endsWith('/proposals') && url.searchParams.get('status') === 'PENDING';
      });
      release();
      await (await settled).finished();
    }
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(library.getByRole('button', { name: '보관 자료 새로고침', exact: true })).toBeEnabled();
    await expect(library.getByRole('alert')).toContainText(code);
    if (code === 'NOT_FOUND') {
      await expect(candidate).toHaveCount(0); await expect(candidateBody).toHaveCount(0); await expect(proposal).toHaveCount(0);
    } else {
      await expect(candidate).toBeEnabled(); await expect(candidateBody).toBeVisible(); await expect(proposal).toBeEnabled();
      await expect(library.getByRole('region', { name: '보관 후보 원문 확인', exact: true }).getByRole('alert')).toContainText(code);
    }
    expect(state.requests).toEqual([]); expect(state.uploads).toEqual([]); expect(state.controlReads()).toBe(0); expect(state.unknown).toEqual([]);
  });
}

test('보관 후보를 다시 찾아 원문 확인·명시 새 문서 준비 후 저장하되 후보를 재생성하지 않는다', async ({ page }) => {
  const s = await fixture(page); await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{ name: '보관한 후보·제안 조회', exact: true }).click(); await page.getByRole('button',{ name: `가져오기 후보 ${candidateId} 열기`, exact: true }).click();
  await expect(page.getByLabel('보관 후보 원문',{ exact: true })).toContainText('<script>'); expect(s.requests).toHaveLength(0); expect(s.uploads).toHaveLength(0); expect(await page.evaluate(() => (window as any).STORED_EXECUTED)).toBeUndefined();
  await page.getByLabel('보관 원문을 확인했고 새 문서 초안으로 준비하겠습니다',{ exact: true }).check(); await page.getByRole('button',{ name: '보관 후보로 새 문서 준비', exact: true }).click(); await expect(page.getByLabel('문서 본문 편집',{ exact: true })).toHaveValue(importedText.replace(/\r\n/g,'\n'));
  await page.getByLabel('문서 변경 이유',{ exact: true }).fill('보관 후보의 명시 재개'); await page.getByRole('button',{ name: '새 초안 버전 저장', exact: true }).click(); await expect(page.getByText('초안 버전 1 저장 확인',{ exact: true })).toBeVisible(); expect(s.requests).toHaveLength(1); expect(s.requests[0].payload.importCandidateRef).toBe(candidateId); expect(s.requests[0].payload.content.attachments).toEqual([s.original]); expect(s.uploads).toHaveLength(1); expect(s.unknown).toEqual([]);
});
test('보관 제안을 다시 열어 비교·명시 반영하며 과거 업로드/제안 명령을 새로 만들지 않는다', async ({ page }) => {
  const s = await fixture(page); await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{ name: '보관한 후보·제안 조회', exact: true }).click(); await page.getByRole('button',{ name: `보관 제안 ${proposalId} 열기`, exact: true }).click(); await expect(page.getByLabel('보관 제안 새 원문',{ exact: true })).toHaveText(proposedText); expect(s.controlReads()).toBe(0); expect(s.requests).toHaveLength(0);
  await page.getByLabel('보관 제안의 차이를 확인했고 반영 작업을 열겠습니다',{ exact: true }).check(); await page.getByRole('button',{ name: '보관 제안 반영 작업 열기', exact: true }).click(); await expect(page.getByLabel('제안 새 원문',{ exact: true })).toHaveText(proposedText); expect(s.uploads).toHaveLength(0); expect(s.requests).toHaveLength(0);
  await page.getByLabel('원문·첨부·항목 차이를 확인했고 이 제안을 새 초안으로 반영하겠습니다',{ exact: true }).check(); await page.getByRole('button',{ name: '이 제안으로 새 초안 저장', exact: true }).click(); await expect(page.getByText('제안 반영 버전 2 저장 확인 · 별도 확정 전',{ exact: true })).toBeVisible(); expect(s.requests).toHaveLength(1); expect(s.requests[0].payload.proposalRef).toBe(proposalId); expect(s.uploads).toHaveLength(0); expect(s.unknown).toEqual([]);
});
test('조회 사용자는 보관 제안을 읽을 때 제어권이나 쓰기 요청을 요구받지 않는다', async ({ page }) => {
  const s = await fixture(page,true); await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{ name: '보관한 후보·제안 조회', exact: true }).click(); await page.getByRole('button',{ name: `보관 제안 ${proposalId} 열기`, exact: true }).click(); await expect(page.getByLabel('보관 제안 기준 원문',{ exact: true })).toHaveText(baseText); expect(s.controlReads()).toBe(0); expect(s.requests).toHaveLength(0); expect(s.uploads).toHaveLength(0); expect(s.unknown).toEqual([]);
});

test('보관 후보 원문이 hash와 다르면 새 초안 준비나 쓰기로 진행하지 않는다', async ({ page }) => {
  const s = await fixture(page); s.files.set(s.original.artifactId, Buffer.from('변조된 원문'));
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{ name: '보관한 후보·제안 조회', exact: true }).click(); await page.getByRole('button',{ name: `가져오기 후보 ${candidateId} 열기`, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED'); await expect(page.getByRole('button',{ name: '보관 후보로 새 문서 준비', exact: true })).toHaveCount(0);
  expect(s.requests).toHaveLength(0); expect(s.uploads).toHaveLength(0); expect(s.controlReads()).toBe(0); expect(s.unknown).toEqual([]);
});

test('조회 사용자의 제안 재개는 제어권 검사에서 거절하고 원본을 쓰지 않는다', async ({ page }) => {
  const s = await fixture(page,true); await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{ name: '보관한 후보·제안 조회', exact: true }).click(); await page.getByRole('button',{ name: `보관 제안 ${proposalId} 열기`, exact: true }).click();
  await page.getByLabel('보관 제안의 차이를 확인했고 반영 작업을 열겠습니다',{ exact: true }).check(); await page.getByRole('button',{ name: '보관 제안 반영 작업 열기', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('button',{ name: '이 제안으로 새 초안 저장', exact: true })).toHaveCount(0);
  expect(s.controlReads()).toBe(1); expect(s.requests).toHaveLength(0); expect(s.uploads).toHaveLength(0); expect(s.unknown).toEqual([]);
});
