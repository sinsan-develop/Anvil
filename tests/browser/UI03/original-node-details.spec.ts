import { test, expect, type Page } from '@playwright/test';
import { installWorkspaceBundle } from '../UI04/bundle.ts';
const id = '10000000-0000-4000-8000-000000000001';
function version(n = 1, scope = 'SYSTEM') {
 const node = { nodeId: 'N', name: '설계 단계', purpose: '설계 원본 목적', kind: 'JOIN', position: { x: 0, y: 0 }, role: n === 1 ? 'STAGE_OWNER' : 'USER', mode: n === 1 ? 'AUTO' : 'CASE_BY_CASE', taskScope: { included: [`포함-v${n}`], excluded: [`제외-v${n}`] }, inputs: [], outputs: [], completionCriteria: ['원본 검수'], approvalBoundary: ['USER_CHECK'], recordRequirements: ['원본 기록'], requirements: { capabilities: [`능력-v${n}`], environment: [`환경-v${n}`] }, limitPolicyRef: { id, version: n, contentHash: 'b'.repeat(64) }, joinRule: { mode: n === 1 ? 'ALL' : 'DECLARED_CONDITION', ...(n === 2 ? { condition: { fieldRef: { nodeId: 'N', field: 'USER_DECISION' }, operator: 'EQ', value: 'PROCEED' } } : {}) } };
 return { ref: { id, version: n, contentHash: String(n).repeat(64) }, name: '원본 절차', purpose: '원본 판단', scope, systemCode: scope === 'SYSTEM' ? 'SYS-M01' : null, graph: { nodes: [node], edges: [], entryNodeId: 'N', terminalNodeIds: ['N'] }, confirmation: null, validation: { validForConfirmation: false, issues: [] }, runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
}
async function setup(page: Page) {
 let current = version(), deny = false; const writes: string[] = [], unknown: string[] = [], errors: string[] = [], offOrigin: string[] = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('request', r => { if (r.method() !== 'GET') writes.push(r.method()); if (new URL(r.url()).origin !== 'https://localhost:3830') offOrigin.push(r.url()); });
 await installWorkspaceBundle(page);
 await page.route('**/api/v1/**', r => { unknown.push(new URL(r.request().url()).pathname); return r.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
 await page.route('**/api/v1/auth/setup', r => r.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
 await page.route('**/api/v1/session', r => r.fulfill({ json: { user: { id, displayName: '조회 QA' }, clientId: id, csrfToken: 'A'.repeat(43) } }));
 await page.route('**/api/v1/forms', r => r.fulfill({ json: { items: [], observedAt: new Date().toISOString(), hasMore: false, nextCursor: null, baselineVersion: null } }));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/, r => r.fulfill({ json: { items: [{ ...current, status: 'DRAFT', sourceAvailable: true }], observedAt: new Date().toISOString(), hasMore: false, nextCursor: null, baselineVersion: null } }));
 await page.route(/\/api\/v1\/methodologies\/[^/]+\/versions\/\d+$/, r => deny ? r.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } }) : r.fulfill({ json: current }));
 await page.goto('/#/methodologies');
 return { set(n: number, scope = 'SYSTEM') { current = version(n, scope); }, malformed() { Object.assign(current.graph.nodes[0]!, { role: 'UNDEFINED_ROLE' }); }, deny() { deny = true; }, clean() { expect(writes).toEqual([]); expect(unknown).toEqual([]); expect(errors).toEqual([]); expect(offOrigin).toEqual([]); } };
}
const detail = (page: Page) => page.getByRole('region', { name: '원본 단계 책임·실행 조건', exact: true });
test('시스템·공통 원본의 상세를 복사/저장 없이 읽고 버전 전환 시 새 정의만 표시한다', async ({ page }) => {
 const s = await setup(page);
 await expect(detail(page)).toContainText('단계책임자');
 await detail(page).getByText('작업 범위·환경·한도·합류 정의', { exact: true }).click();
 for (const text of ['포함-v1', '제외-v1', '능력-v1', '환경-v1', '모든 선행 결과']) await expect(detail(page)).toContainText(text);
 await expect(page.getByRole('region', { name: '선택 단계 상세', exact: true })).toContainText('원본 검수');
 s.set(2, 'USER_COMMON'); await page.getByRole('button', { name: '방법론 목록 처음부터 갱신', exact: true }).click();
 await expect(detail(page)).toContainText('건별'); await expect(detail(page)).not.toContainText('단계책임자');
 const toggle = detail(page).locator('details'); if (await toggle.getAttribute('open') === null) await toggle.locator('summary').click();
 for (const text of ['포함-v2', '환경-v2', 'PROCEED']) await expect(detail(page)).toContainText(text);
 await expect(detail(page)).not.toContainText('포함-v1'); s.clean();
});
test('403 재조회는 이전 실행 정의를 숨기되 미저장 방법론을 보존한다', async ({ page }) => {
 const s = await setup(page); await expect(detail(page)).toBeVisible();
 await page.getByRole('button', { name: '새 방법론 작성', exact: true }).click();
 await page.getByLabel('방법론 이름', { exact: true }).fill('보존할 미저장 이름');
 s.deny(); const rejected = page.waitForResponse(r => /\/methodologies\/[^/]+\/versions\/1$/.test(r.url()) && r.status() === 403);
 await page.getByRole('button', { name: '방법론 다시 조회', exact: true }).click();
 expect((await rejected).status()).toBe(403);
 await expect(detail(page)).toHaveCount(0); await expect(page.getByRole('alert').first()).toHaveText('요청을 처리하지 못했습니다. 결과를 확인한 뒤 다시 시도하세요.');
 await expect(page.getByLabel('방법론 이름', { exact: true })).toHaveValue('보존할 미저장 이름'); s.clean();
});

test('잘못된 책임 원본 재조회는 이전 정의를 새 정상 자료로 표시하지 않는다', async ({ page }) => {
 const s = await setup(page); await expect(detail(page)).toContainText('단계책임자');
 await page.getByLabel('복사본 이름', { exact: true }).fill('복사 가능 여부 대조');
 await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeEnabled();
 s.malformed(); await page.getByRole('button', { name: '방법론 다시 조회', exact: true }).click();
 await expect(page.getByRole('alert').first()).toContainText('서버 응답 형식을 확인할 수 없습니다.');
 await expect(detail(page)).toHaveCount(0);
 await expect(page.getByRole('button', { name: '내 공통본으로 복사', exact: true })).toBeDisabled(); s.clean();
});
