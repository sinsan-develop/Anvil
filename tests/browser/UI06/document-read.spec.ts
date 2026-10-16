import { expect, test } from '@playwright/test';

test('문서 화면에서 보관한 가져오기 후보와 제안을 다시 조회할 수 있다', async ({ page }) => {
  await page.goto('/#/projects/51c0439f-791e-4bb5-8471-70938d6afaf1/documents');
  await expect(page.getByRole('button', { name: '보관한 후보·제안 조회', exact: true })).toBeVisible();
});
import { createHash } from 'node:crypto';
import { canonicalJson,contentHash } from '../../../contracts/canonical.ts';

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
    const targetRef = { id, version, contentHash: 'b'.repeat(64) }, formRef = { id: artifactId, version: 1, contentHash: 'a'.repeat(64) };
    const review = { ref: { id: artifactId, criteriaVersion: 1, targetRef, outcome: 'REWORK' }, items: [{ criterionId: 'REQ', outcome: 'REWORK', evidenceRefs: [], reason: '요구 출처를 더 적어야 합니다' }], reviewer: { kind: 'HUMAN', userId: id, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: '원문 대조 후 보완 요청', reviewedAt: '2026-10-16T04:00:01.000Z', serverSequence: 7 };
    return route.fulfill({ json: { id, version, title: version === 1 ? '이전 요구사항' : '요구사항 원본', formRef, contentHash: targetRef.contentHash, confirmed: false, content: { body: ref, attachments: [], sections: [], sourceRefs: [] }, validation: { validForConfirmation: false, issues: [{ code: 'REQUIRED_SECTION_MISSING', location: 'sections.REQ', message: '필수 항목 미연결', severity: 'ERROR' }] }, statusHistory: [{ kind: 'DRAFT_SAVED', reason: '사람이 저장한 원문', at: '2026-10-16T04:00:00.000Z' }], contentReviewCriteria: { criteriaVersion: 1, formRef, items: [{ criterionId: 'REQ', title: '요구 출처', reviewCriteria: ['원문과 비교'] }] }, contentReviews: [review], reviewRefs: [review.ref], proposalRefs: [], sourceLinks: [] } });
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
  await expect(page.getByText('원문 대조 후 보완 요청', { exact: true })).toBeVisible();
  await expect(page.getByText('작성 기록자와 같은 사용자 · 독립 검수 아님', { exact: true })).toBeVisible();
  await page.getByLabel('조회 버전', { exact: true }).fill('1');
  await page.getByRole('button', { name: '지정 버전 조회', exact: true }).click();
  await expect(page.getByRole('heading', { name: '이전 요구사항', exact: true })).toBeVisible();
});

test('선택한 문서 버전에서 설계 항목·화면 위치 추적 조회를 열 수 있다', async ({ page }) => {
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
  await expect(page.getByRole('button',{name:'이 버전 설계 추적 조회',exact:true})).toBeVisible();
});

test('설계 추적은 별도 GET에서 정확 버전 항목을 보이고 변조/미구현을 완료로 숨기지 않는다', async ({ page }) => {
  const documentRef={id,version:2,contentHash:'b'.repeat(64)},data={documentRef,localCode:'D01',title:'원문 위치 조회',anchor:'line:1'};let reads=0,broken=false;
  await page.route(`**/api/v1/projects/${project}/design-index?*`,r=>{reads++;expect(r.request().method()).toBe('GET');expect(new URL(r.request().url()).searchParams.get('version')).toBe('2');return r.fulfill({json:{documentRef,items:[{id:artifactId,...data,itemHash:broken?'0'.repeat(64):contentHash(canonicalJson(data))}],screenRegions:[],status:'INDEXED',observedAt:'2026-10-16T05:00:00Z'}});});
  await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();expect(reads).toBe(0);
  await page.getByRole('button',{name:'이 버전 설계 추적 조회',exact:true}).click();const panel=page.getByRole('region',{name:'설계 항목·화면 위치 추적',exact:true});await expect(panel.getByText('D01 · 원문 위치 조회',{exact:true})).toBeVisible();await expect(panel).toContainText('작업계획·구현/시험 증거 연결은 아직 미구현');
  broken=true;await panel.getByRole('button',{name:'설계 추적 새로고침',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('DESIGN_INDEX_INTEGRITY_FAILED');await expect(panel.getByText('D01 · 원문 위치 조회',{exact:true})).toHaveCount(0);expect(reads).toBe(2);
});
test('원문 바이트가 hash와 다르면 문서를 표시하지 않고 명확히 실패한다', async ({ page }) => {
  await page.route(`**/api/v1/projects/${project}/files/${artifactId}`, route => route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from('다른 파일') }));
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '요구사항 원본 열기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED');
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveCount(0);
});
