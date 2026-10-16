import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
const artifactId = 'a6f30000-0000-4000-8000-000000000099';
const body = '\uFEFF# 사용자 원문\r\n<script>window.DOCUMENT_EXECUTED=1</script>\r\n';
const bytes = Buffer.from(body), hash = createHash('sha256').update(bytes).digest('hex');
const ref = { artifactId, bytes: bytes.length, contentHash: hash, mediaType: 'text/markdown;charset=utf-8' };
const unknown = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unknown.set(page, []);
  await page.route('**/api/v1/**', route => { unknown.get(page)!.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: '문서 조회 QA' }, clientId: id, csrfToken: 'C'.repeat(43) } }));
  await page.route(`**/api/v1/projects/${project}/documents?*`, route => route.fulfill({ json: { items: [{ id, title: '요구사항 원본', headVersion: 2, confirmedVersion: null, updatedAt: '2026-10-16T04:00:00.000Z' }], nextCursor: null, hasMore: false, observedAt: '2026-10-16T04:00:00.000Z' } }));
  await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/*`, route => {
    const version = Number(new URL(route.request().url()).pathname.split('/').pop());
    return route.fulfill({ json: { id, version, title: version === 1 ? '이전 요구사항' : '요구사항 원본', formRef: { id: artifactId, version: 1, contentHash: 'a'.repeat(64) }, contentHash: 'b'.repeat(64), confirmed: false, content: { body: ref, attachments: [], sections: [], sourceRefs: [] }, validation: { validForConfirmation: false, issues: [{ code: 'REQUIRED_SECTION_MISSING', location: 'sections.REQ', message: '필수 항목 미연결', severity: 'ERROR' }] }, statusHistory: [{ kind: 'DRAFT_SAVED', reason: '사람이 저장한 원문', at: '2026-10-16T04:00:00.000Z' }], reviewRefs: [] } });
  });
  await page.route(`**/api/v1/projects/${project}/files/${artifactId}`, route => route.fulfill({ contentType: 'application/octet-stream', body: bytes }));
});
test.afterEach(async ({ page }) => { expect(unknown.get(page)).toEqual([]); });
test('문서 목록에서 정확 버전과 원문을 열고 구버전을 조회하되 본문 지시는 실행하지 않는다', async ({ page }) => {
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '요구사항 원본 열기', exact: true }).click();
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveText(body);
  await expect(page.getByText('필수 항목 미연결', { exact: true })).toBeVisible();
  await expect(page.getByText('초안 · 내용 검토/사용자 확정과 별개', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).DOCUMENT_EXECUTED)).toBeUndefined();
  await page.getByLabel('조회 버전', { exact: true }).fill('1');
  await page.getByRole('button', { name: '지정 버전 조회', exact: true }).click();
  await expect(page.getByRole('heading', { name: '이전 요구사항', exact: true })).toBeVisible();
});
test('원문 바이트가 hash와 다르면 문서를 표시하지 않고 명확히 실패한다', async ({ page }) => {
  await page.route(`**/api/v1/projects/${project}/files/${artifactId}`, route => route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from('다른 파일') }));
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '요구사항 원본 열기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED');
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveCount(0);
});
