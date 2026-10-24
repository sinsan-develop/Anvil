import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../contracts/canonical.ts';
import { validateMethodologyGraph } from '../../../apps/server/modules/methodologies/service.ts';
import { installWorkspaceBundle } from '../UI04/bundle.ts';
import type { MethodologyGraph } from '../../../contracts/methodologies.ts';

const pid = 'b3100000-0000-4000-8000-000000000001', uid = 'b3100000-0000-4000-8000-000000000002', cid = 'b3100000-0000-4000-8000-000000000003', mid = 'b3100000-0000-4000-8000-000000000004';
const at = '2026-10-24T00:00:00.000Z';
const hash = (graph: MethodologyGraph) => createHash('sha256').update(canonicalJson(graph)).digest('hex');
const original: MethodologyGraph = { nodes: [{ nodeId: 'N1', name: '합류 정의', purpose: '원 단계', kind: 'JOIN', position: { x: 0, y: 0 }, role: 'STAGE_OWNER', inputs: [], outputs: [], taskScope: { included: ['정의 편집'], excluded: ['운영'] }, completionCriteria: ['조건 확인'], approvalBoundary: [], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['현재상황'], joinRule: { mode: 'ALL' } }], edges: [], entryNodeId: 'N1', terminalNodeIds: ['N1'] };

for (const scenario of ['HUMAN', 'AGENT', 'DECISION', 'HASH_TAMPER'] as const) {
  const kind = scenario === 'HASH_TAMPER' ? 'HUMAN' : scenario;
  test(`합류에서 ${scenario} 유형 변경 저장 응답과 재조회 경계를 확인한다`, async ({ page }) => {
    const requests: any[] = [], unexpected: string[] = [], offOrigin: string[] = [], errors: string[] = [], versions: number[] = [];
    let graph = structuredClone(original), version = 1;
    const ref = () => ({ id: mid, version, contentHash: hash(graph) });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).origin !== 'https://localhost:3830') offOrigin.push(request.url()); });
    await page.route('**/*', route => { unexpected.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.abort(); });
    await installWorkspaceBundle(page);
    await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: uid, displayName: '유형 저장 QA' }, clientId: cid, csrfToken: 'A'.repeat(43) } }));
    const empty = { items: [], observedAt: at, nextCursor: null, hasMore: false, baselineVersion: null };
    await page.route('**/api/v1/forms', route => route.fulfill({ json: empty }));
    await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/, route => route.fulfill({ json: empty }));
    await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ json: { id: pid, currentMethodologyRef: null, participation: 'OWNER', controlState: { actorId: uid, clientId: cid, generation: 3, status: 'HELD' } } }));
    await page.route('**/api/v1/projects/' + pid + '/methodologies?limit=20', route => route.fulfill({ json: { projectId: pid, items: [{ ref: ref(), name: '유형 전환 방법론', purpose: '유형 편집 저장 확인', scope: 'PROJECT' }], hasMore: false, nextAfterId: null, observedAt: at, applicationTransition: 'EXECUTION_STATE_UNVERIFIED' } }));
    await page.route(new RegExp('/api/v1/projects/' + pid + '/methodologies/' + mid + '/versions/[12]$'), route => {
      const selected = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      versions.push(selected);
      const selectedGraph = selected === 1 ? original : graph;
      return route.fulfill({ json: { projectId: pid, ref: { id: mid, version: selected, contentHash: hash(selectedGraph) }, headVersion: version, name: '유형 전환 방법론', purpose: '유형 편집 저장 확인', scope: 'PROJECT', systemCode: null, graph: selectedGraph, confirmation: null, contentReviews: [], validation: validateMethodologyGraph(selectedGraph, []), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED', applicationTransition: 'EXECUTION_STATE_UNVERIFIED' } });
    });
    await page.route('**/api/v1/projects/' + pid + '/commands', async route => {
      expect(route.request().method()).toBe('POST');
      const request = route.request().postDataJSON(); requests.push(request);
      expect(request.operation).toBe('saveMethodologyDraft');
      expect(request.projectId).toBe(pid); expect(request.clientId).toBe(cid); expect(request.controlGeneration).toBe(3);
      expect(request.targetId).toBe(mid); expect(request.expectedVersion).toBe(1);
      expect(request.baselineRefs).toEqual([]); expect(request.approvalRef).toBeNull();
      graph = request.payload.graph; version = 2;
      const receiptRef = scenario === 'HASH_TAMPER' ? { ...ref(), contentHash: 'f'.repeat(64) } : ref();
      await route.fulfill({ json: { operationId: mid, commandId: request.commandId, projectId: pid, status: 'APPLIED', targetId: mid, version, data: { ref: receiptRef, status: 'DRAFT' }, serverReceivedAt: at } });
    });
    await page.goto('/#/projects/' + pid + '/methodologies');
    await page.getByRole('button', { name: '유형 전환 방법론 v1 열기', exact: true }).click();
    await page.getByRole('button', { name: '이 전용본 편집', exact: true }).click();
    await page.getByLabel('단계 유형', { exact: true }).selectOption(kind);
    await page.getByLabel('개정 이유', { exact: true }).fill('합류 대신 개별 단계로 정의');
    await page.getByRole('button', { name: '전용본 새 버전 저장', exact: true }).click();
    await expect.poll(() => requests.length).toBe(1);
    if (scenario === 'HASH_TAMPER') {
      await expect(page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true })).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: '서버 응답 형식을 확인할 수 없습니다. 입력은 보존했습니다.' })).toBeVisible();
      await expect(page.getByText('서버 저장·재조회 확인 · 버전 2', { exact: true })).toHaveCount(0);
      expect(versions).not.toContain(2); expect(requests).toHaveLength(1);
      expect(unexpected).toEqual([]); expect(offOrigin).toEqual([]); expect(errors).toEqual([]);
      return;
    }
    await expect(page.getByText('서버 저장·재조회 확인 · 버전 2', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    const expected = { ...original.nodes[0]!, kind, ...(kind === 'HUMAN' ? { role: 'USER' as const, mode: 'CASE_BY_CASE' as const } : {}) };
    delete expected.joinRule;
    expect(graph.nodes[0]).toEqual(expected);
    expect(Object.hasOwn(graph.nodes[0]!, 'joinRule')).toBe(false);
    expect(original.nodes[0]!.kind).toBe('JOIN'); expect(original.nodes[0]!.joinRule).toEqual({ mode: 'ALL' });
    expect(versions).toContain(2);
    expect(unexpected).toEqual([]); expect(offOrigin).toEqual([]); expect(errors).toEqual([]);
  });
}
