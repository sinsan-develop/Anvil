import { test, expect, type Page } from '@playwright/test';
import { transferFixture, pid, aid, at } from '../../unit/UI09/transfer-fixture.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { readCandidateInput, candidateReadiness, candidateCapabilities } from '../../../apps/server/modules/connections/candidate-input.ts';
import { installWorkspaceBundle } from '../UI04/bundle.ts';

const hash = (v: unknown) => contentHash(canonicalJson(v));
function candidate() {
  const id = '88888888-8888-4888-8888-888888888888';
  const input = readCandidateInput('registerConnection', { kind: 'CONNECTION_CANDIDATE', policyRef: { id: pid, version: 1, contentHash: 'a'.repeat(64) }, candidateRef: null, expiresAt: '2027-01-01T00:00:00.000Z', reason: '이전 검토 후보', candidate: { label: '다른 코딩 도구', toolProduct: '기존 CLI', toolVersion: '1.0', adapterKind: 'CLI', documentation: [{ code: 'INSTRUCTION_SESSION', source: 'https://example.test/reference', observedAt: at, versionCompatibility: 'CONFIRMED' }, { code: 'STOP_RECLAIM', source: 'https://example.test/stop', observedAt: at, versionCompatibility: 'UNSUPPORTED' }] } }, { now: new Date(at), policyExpiresAt: new Date('2027-01-02T00:00:00.000Z') });
  const snapshot = { kind: input.kind, input, readiness: candidateReadiness(input), capabilities: candidateCapabilities(input) };
  const ref = { id, version: 1, contentHash: hash(snapshot) };
  return { view: { ref, candidate: snapshot, expired: false, createdAt: at, recordedBy: pid, executionAuthorized: false, observedAt: at }, hit: { ref, kind: 'CONNECTION_CANDIDATE', label: input.candidate.label, readiness: 'NOT_READY', expiresAt: input.expiresAt, integrity: 'NOT_RECHECKED' } };
}
async function install(page: Page) {
  const f = transferFixture(), c = candidate(), reads: string[] = [], unexpected: string[] = [], writes: string[] = [], errors: string[] = [];
  (f.draft.snapshot.definition.requiredCapabilities as string[]).push('INSTRUCTION_SESSION', 'STOP_RECLAIM');
  f.draft.ref.contentHash = hash(f.draft.snapshot);
  f.confirmed.snapshot.draftRef = f.draft.ref; f.confirmed.ref.contentHash = hash(f.confirmed.snapshot);
  f.decision.draftRef = f.draft.ref; f.decision.confirmedRef = f.confirmed.ref;
  f.state.assignmentRef = f.confirmed.ref; f.contexts.assignmentRef = f.confirmed.ref;
  let mode = 'NORMAL', release = () => {}, lists = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).origin !== 'https://localhost:3830') unexpected.push(r.url()); });
  await page.route('**/*', r => { unexpected.push(r.request().url()); return r.abort(); });
  await installWorkspaceBundle(page);
  await page.route('**/api/v1/session', r => r.fulfill({ json: { user: { id: pid, displayName: '이전 후보 QA' }, clientId: pid, csrfToken: 'A'.repeat(43) } }));
  await page.route('**/api/v1/projects/' + pid + '/**', async r => {
    const url = new URL(r.request().url()), path = url.pathname.slice(('/api/v1/projects/' + pid + '/').length);
    if (r.request().method() !== 'GET') { writes.push(path); return r.abort(); }
    reads.push(path);
    if (path === 'connection-candidates') {
      expect(url.searchParams.get('kind')).toBe('CONNECTION_CANDIDATE'); expect(url.searchParams.get('limit')).toBe('50'); lists++;
      const next = url.searchParams.get('cursor'); if (next) expect(next).toBe('NEXT_QA');
      return r.fulfill({ json: { view: 'CANDIDATES_ONLY', items: next ? [] : [c.hit], hasMore: !next, nextCursor: next ? null : 'NEXT_QA', observedAt: at } });
    }
    if (path === 'connection-candidates/' + c.view.ref.id + '/versions/1') {
      if (mode === 'DELAY') await gate;
      if (mode === 'DENIED') return r.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } });
      const value = structuredClone(c.view);
      if (mode === 'TAMPER') value.candidate.input.candidate.label = '해시가 다른 라벨';
      if (mode === 'EXPIRED') value.expired = true;
      return r.fulfill({ json: value });
    }
    const body = f.responses[path];
    if (!body) { unexpected.push(path); return r.abort(); }
    return r.fulfill({ json: body });
  });
  await page.goto('/#/projects/' + pid + '/transfers/assignments/' + aid + '/versions/1/' + f.draft.ref.contentHash);
  await page.getByRole('button', { name: '기존 인계 기록 조회', exact: true }).click();
  await expect(page.getByRole('region', { name: '인계 기록 조회 결과', exact: true })).toBeVisible();
  return { ...f, ...c, reads, unexpected, writes, errors, mode: (v: string) => { mode = v; }, release, lists: () => lists };
}
test('TRANSFER_TARGET 정상 후보의 6능력과 고정 임무 요구를 비교하지만 이전·실행하지 않는다', async ({ page }) => {
  const f = await install(page);
  expect(f.lists()).toBe(0);
  await page.getByRole('button', { name: '이전 대상 후보 목록 조회', exact: true }).click();
  await page.getByRole('button', { name: '다른 코딩 도구 고정 후보 검토', exact: true }).click();
  const detail = page.getByRole('region', { name: '이전 검토 후보 원문', exact: true });
  await expect(detail).toBeVisible();
  const table = detail.getByRole('table', { name: '임무 요구와 후보 능력', exact: true });
  await expect(table.getByRole('row')).toHaveCount(7);
  await expect(table.getByRole('row').filter({ hasText: '지시·세션' })).toContainText('임무에서 요구');
  await expect(table.getByRole('row').filter({ hasText: '중지·회수' })).toContainText('UNSUPPORTED');
  await expect(table.getByRole('row').filter({ hasText: '결과·근거' })).toContainText('명시 요구 없음');
  await expect(detail).toContainText('실측 미확인');
  await expect(detail.getByRole('button', { name: '이 후보로 이전·재개 · 미구현', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '다음 이전 대상 후보', exact: true }).click();
  await expect(detail).toHaveCount(0); await expect(page.getByText('이 페이지의 이전 대상 후보 없음', { exact: true })).toBeVisible();
  expect(f.lists()).toBe(2); expect(f.writes).toEqual([]); expect(f.unexpected).toEqual([]); expect(f.errors).toEqual([]);
});
for (const mode of ['DENIED', 'TAMPER', 'EXPIRED'] as const) test('TRANSFER_TARGET_' + mode + ' 후보의 거절·무결성·기한을 실제 이전 가능으로 승격하지 않는다', async ({ page }) => {
  const f = await install(page);
  await page.getByRole('button', { name: '이전 대상 후보 목록 조회', exact: true }).click();
  await page.getByRole('button', { name: '다른 코딩 도구 고정 후보 검토', exact: true }).click();
  const detail = page.getByRole('region', { name: '이전 검토 후보 원문', exact: true });
  await expect(detail).toBeVisible();
  f.mode(mode); await page.getByRole('button', { name: '다른 코딩 도구 고정 후보 검토', exact: true }).click();
  if (mode === 'EXPIRED') { await expect(detail).toContainText('기한 경과'); await expect(detail.getByRole('button')).toBeDisabled(); }
  else { await expect(page.getByRole('region', { name: '이전 대상 후보 비교', exact: true }).getByRole('alert')).toBeVisible(); await expect(detail).toHaveCount(0); }
  expect(f.writes).toEqual([]); expect(f.unexpected).toEqual([]); expect(f.errors).toEqual([]);
});

test('TRANSFER_TARGET_LEAVE 후보의 늦은 JSON·해시 완료 뒤에도 이탈한 본문을 다시 표시하지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch, digest = crypto.subtle.digest.bind(crypto.subtle), state = window as any;
    crypto.subtle.digest = async (...args) => {
      const track = (state.TARGET_JSON ?? 0) > 0;
      if (track) { state.TARGET_DIGESTS = (state.TARGET_DIGESTS ?? 0) + 1; state.TARGET_PENDING = (state.TARGET_PENDING ?? 0) + 1; }
      try { return await digest(...args); } finally { if (track) state.TARGET_PENDING--; }
    };
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      if (/connection-candidates\/[^/]+\/versions\/1$/.test(String(args[0]))) {
        const json = response.json.bind(response);
        response.json = async () => { try { return await json(); } finally { state.TARGET_JSON = (state.TARGET_JSON ?? 0) + 1; } };
      }
      return response;
    };
  });
  const f = await install(page);
  await page.getByRole('button', { name: '이전 대상 후보 목록 조회', exact: true }).click();
  f.mode('DELAY'); await page.getByRole('button', { name: '다른 코딩 도구 고정 후보 검토', exact: true }).click();
  await expect.poll(() => f.reads.filter(p => p.includes('connection-candidates/') && p.endsWith('/versions/1')).length).toBe(1);
  await page.evaluate(projectId => { location.hash = '#/projects/' + projectId + '/transfers'; }, pid);
  await expect(page.getByText('임무 상세에서 고정 임무를 선택해 읽기 인계 준비로 이동하세요.', { exact: true })).toBeVisible();
  f.release();
  await expect.poll(() => page.evaluate(() => ({ json: (window as any).TARGET_JSON ?? 0, digests: (window as any).TARGET_DIGESTS ?? 0, pending: (window as any).TARGET_PENDING ?? 0 }))).toEqual({ json: 1, digests: 1, pending: 0 });
  await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  await expect(page.getByRole('region', { name: '이전 검토 후보 원문', exact: true })).toHaveCount(0);
  expect(f.writes).toEqual([]); expect(f.unexpected).toEqual([]); expect(f.errors).toEqual([]);
});
