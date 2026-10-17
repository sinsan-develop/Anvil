import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', other = '51c0439f-791e-4bb5-8471-70938d6afaf2';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', artifact = 'a6f30000-0000-4000-8000-000000000099';
const older = '\uFEFF# 제목\r\n이전 내용\r\n끝\n', current = '\uFEFF# 제목\r\n<script>window.COMPARE_EXECUTED=1</script>\r\n끝\n';
const at = '2026-10-17T10:00:00Z';
const bodyFor = (version: number) => version === 1 ? older : current;
const artifactFor = (version: number) => artifact.slice(0, -1) + String(version);

async function fixture(page: Page, options: { corrupt?: boolean; wrongVersion?: boolean; delayed?: boolean; large?: boolean; unauthorized?: boolean } = {}) {
  const dist = process.env.ANVIL_UI06_COMPARE_DIST;
  if (!dist) throw Error('REGISTERED_CANDIDATE_DIST_REQUIRED');
  const errors: string[] = [], unknown: string[] = [], writes: string[] = [], offOrigin: string[] = [];
  const reads: number[] = []; let release = () => {}, seen = () => {};
  const pending = new Promise<void>(r => { release = r; }), requested = new Promise<void>(r => { seen = r; });
  page.on('pageerror', e => errors.push(e.name));
  page.on('request', r => { if (r.method() !== 'GET') writes.push(r.method()); if (new URL(r.url()).origin !== 'https://localhost:3830') offOrigin.push(new URL(r.url()).origin); });
  await page.route('**/*', r => new URL(r.request().url()).origin === 'https://localhost:3830' ? r.fallback() : r.abort('blockedbyclient'));
  await page.route('https://localhost:3830/**', async r => {
    const path = new URL(r.request().url()).pathname;
    if (path.startsWith('/api/')) return r.fallback();
    if (r.request().method() !== 'GET' || path !== '/' && !/^\/assets\/[A-Za-z0-9_.-]+$/.test(path)) return r.abort('blockedbyclient');
    const name = path === '/' ? 'index.html' : path.slice(1);
    return r.fulfill({ body: await readFile(new URL(name, pathToFileURL(dist + '/'))), contentType: name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'application/javascript' });
  });
  await page.route('**/api/v1/**', r => { unknown.push(new URL(r.request().url()).pathname); return r.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', r => r.fulfill({ json: { user: { id, displayName: '버전 비교 QA' }, clientId: id, csrfToken: 'C'.repeat(43) } }));
  await page.route('**/api/v1/auth/setup', r => r.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  await page.route(`**/api/v1/projects/${project}`, r => r.fulfill({ json: { id: project, participation: 'OWNER', controlState: { actorId: id, clientId: id, generation: 1, status: 'HELD' } } }));
  for (const p of [project, other]) await page.route(`**/api/v1/projects/${p}/documents?*`, r => r.fulfill({ json: { items: [{ id, title: '저장 문서', headVersion: 3, confirmedVersion: null, updatedAt: at }], hasMore: false, nextCursor: null, observedAt: at } }));
  await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/*`, r => {
    const version = Number(new URL(r.request().url()).pathname.split('/').pop()); reads.push(version);
    if (options.unauthorized && version === 1) return r.fulfill({ status: 401, json: { code: 'AUTHENTICATION_REQUIRED' } });
    const body = options.large && version === 1 ? '가'.repeat(131073) : bodyFor(version);
    const formRef = { id: artifact, version: 1, contentHash: 'a'.repeat(64) };
    return r.fulfill({ json: { id, version: options.wrongVersion && version === 1 ? 2 : version, title: '저장 문서', contentHash: String(version).repeat(64), confirmed: false, formRef, stageNodeRef: null, content: { body: { artifactId: artifactFor(version), bytes: Buffer.byteLength(body), contentHash: createHash('sha256').update(body).digest('hex'), mediaType: 'text/markdown;charset=utf-8' }, attachments: [], sections: [], sourceRefs: [] }, validation: { validForConfirmation: false, issues: [] }, statusHistory: [], contentReviewCriteria: { criteriaVersion: 1, formRef, items: [] }, contentReviews: [] } });
  });
  for (const version of [1, 2, 3]) await page.route(`**/api/v1/projects/${project}/files/${artifactFor(version)}`, async r => {
    if (options.delayed && version === 1) { seen(); await pending; }
    const body = options.corrupt && version === 1 ? '변조' : options.large && version === 1 ? '가'.repeat(131073) : bodyFor(version);
    return r.fulfill({ contentType: 'application/octet-stream', body: Buffer.from(body) });
  });
  return { reads, errors, unknown, writes, offOrigin, requested, release };
}
async function open(page: Page) {
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '저장 문서 열기', exact: true }).click();
  await expect(page.getByLabel('문서 원문', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '저장 버전 비교 열기', exact: true }).click();
}
const panel = (page: Page) => page.getByRole('region', { name: '저장 버전 비교', exact: true });
async function compare(page: Page, version = '1') {
  await panel(page).getByLabel('비교할 저장 버전', { exact: true }).fill(version);
  await panel(page).getByRole('button', { name: '지정 저장 버전과 비교', exact: true }).click();
}
function clean(s: Awaited<ReturnType<typeof fixture>>, writes: string[] = []) { expect(s.errors).toEqual([]); expect(s.unknown).toEqual([]); expect(s.writes).toEqual(writes); expect(s.offOrigin).toEqual([]); }

test('두 저장 버전의 실제 본문 구간·hash를 조회하고 원문 지시를 실행하거나 저장하지 않는다', async ({ page }) => {
  const s = await fixture(page); await open(page); await compare(page);
  await expect(panel(page).getByLabel('기준 버전 차이 구간', { exact: true })).toHaveText('<script>window.COMPARE_EXECUTED=1</script>\r\n');
  expect(await panel(page).getByLabel('비교 버전 차이 구간', { exact: true }).textContent()).toBe('이전 내용\r\n');
  await expect(panel(page)).toContainText('기준 v3'); await expect(panel(page)).toContainText('비교 v1');
  await expect(panel(page)).toContainText('1'.repeat(64));
  await expect(panel(page).locator('script,img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).COMPARE_EXECUTED)).toBeUndefined();
  expect(await page.getByLabel('문서 원문', { exact: true }).textContent()).toBe(current);
  expect(s.reads).toEqual([3, 1]); clean(s);
});

test('동일 원문과 비교 한계를 미확인/변경으로 혼동하지 않는다', async ({ page }) => {
  const s = await fixture(page, { large: true }); await open(page); await compare(page, '2');
  await expect(panel(page)).toContainText('본문이 같습니다');
  await compare(page); await expect(panel(page)).toContainText('비교 미확인');
  await expect(panel(page).getByLabel('기준 버전 차이 구간', { exact: true })).toHaveCount(0);
  expect(await page.getByLabel('문서 원문', { exact: true }).textContent()).toBe(current); clean(s);
});

for (const kind of ['corrupt', 'wrongVersion'] as const) test(`${kind} 비교 응답은 결과로 표시하지 않고 원래 문서를 유지한다`, async ({ page }) => {
  const s = await fixture(page, { [kind]: true }); await open(page); await compare(page);
  await expect(panel(page).getByRole('alert')).toContainText(kind === 'corrupt' ? 'ARTIFACT_INTEGRITY_FAILED' : 'RESPONSE_INVALID');
  await expect(panel(page).getByLabel('비교 버전 차이 구간', { exact: true })).toHaveCount(0);
  expect(await page.getByLabel('문서 원문', { exact: true }).textContent()).toBe(current); clean(s);
});

test('선택 변경 뒤 늦게 완료된 본문이 새 비교 결과를 덮지 않는다', async ({ page }) => {
  const s = await fixture(page, { delayed: true }); await open(page); await compare(page); await s.requested;
  await compare(page, '2'); await expect(panel(page)).toContainText('본문이 같습니다');
  const late = page.waitForResponse(r => r.url().endsWith('/files/' + artifactFor(1))); s.release(); await (await late).finished();
  await expect(panel(page)).toContainText('비교 v2'); await expect(panel(page)).toContainText('본문이 같습니다');
  await expect(panel(page).getByLabel('비교 버전 차이 구간', { exact: true })).toHaveCount(0); clean(s);
});

test('닫기와 프로젝트 이동 뒤 늦은 비교가 이전 문서 내용을 되살리지 않는다', async ({ page }) => {
  const s = await fixture(page, { delayed: true }); await open(page); await compare(page); await s.requested;
  await page.getByRole('button', { name: '저장 버전 비교 닫기', exact: true }).click();
  await page.evaluate(p => { location.hash = '#/projects/' + p + '/documents'; }, other);
  const late = page.waitForResponse(r => r.url().endsWith('/files/' + artifactFor(1))); s.release(); await (await late).finished();
  await expect(panel(page)).toHaveCount(0); await expect(page.getByLabel('문서 원문', { exact: true })).toHaveCount(0); clean(s);
});

test('범위 밖 버전은 조회하지 않고 비교 중 인증 만료를 성공으로 숨기지 않는다', async ({ page }) => {
  const s = await fixture(page, { unauthorized: true }); await open(page);
  for (const v of ['0', '4', '1.5']) { await panel(page).getByLabel('비교할 저장 버전', { exact: true }).fill(v); await expect(panel(page).getByRole('button', { name: '지정 저장 버전과 비교', exact: true })).toBeDisabled(); }
  expect(s.reads).toEqual([3]); await compare(page); await expect(panel(page)).toHaveCount(0); clean(s);
});

test('저장 버전 비교는 dirty 입력과 결과 미확인 pending 명령을 교체하지 않는다', async ({ page }) => {
  const s = await fixture(page); await open(page);
  await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  const input = page.getByLabel('문서 본문 편집', { exact: true });
  await input.fill('반드시 보존할 미저장 입력');
  await page.getByLabel('문서 변경 이유', { exact: true }).fill('사용자 작업 보존');
  await compare(page); await expect(panel(page)).toContainText('비교 v1');
  await expect(input).toHaveValue('반드시 보존할 미저장 입력'); expect(s.writes).toEqual([]);
  await page.route(`**/api/v1/projects/${project}/files`, r => r.abort('connectionreset'));
  await page.getByRole('button', { name: '새 초안 버전 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 저장 명령 결과 확인', exact: true })).toBeVisible();
  await compare(page, '2'); await expect(panel(page)).toContainText('본문이 같습니다');
  await expect(input).toHaveValue('반드시 보존할 미저장 입력'); await expect(input).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: '같은 저장 명령 결과 확인', exact: true })).toBeVisible();
  clean(s, ['POST']);
});
