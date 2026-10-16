import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';
import { validateMethodologyGraph } from '../../../apps/server/modules/methodologies/service.ts';
const forms = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const source = buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md', import.meta.url)), forms.forms)[0]!;
const pid = 'a6f20000-0000-4000-8000-000000000080', uid = 'a6f20000-0000-4000-8000-000000000081', cid = 'a6f20000-0000-4000-8000-000000000082', mid = 'a6f20000-0000-4000-8000-000000000083';
const original = { ref: { id: source.id, version: source.version, contentHash: source.contentHash }, name: source.name, purpose: source.purpose, scope: 'SYSTEM', systemCode: source.systemCode, graph: source.graph, sourceApproval: { productAcceptance: false }, reason: '승인 시안 원문', createdAt: '2026-10-17T00:00:00.000Z', confirmation: null, contentReviews: [], validation: validateMethodologyGraph(source.graph, forms.forms.map(form => form.ref)), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };

test('프로젝트 전용 복사·개정은 공통본과 분리되고 미확인 명령을 화면 이동 뒤 보존한다', async ({ page }) => {
  const unexpected: string[] = [], requests: any[] = [];
  let copied = false, cutReceipt = true, rejectRecheck = true;
  const criteria = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'];
  const own: any = { ...original, projectId: pid, ref: { id: mid, version: 1, contentHash: source.contentHash }, headVersion: 1, name: '프로젝트 전용 절차', scope: 'PROJECT', systemCode: null, applicationTransition: 'EXECUTION_STATE_UNVERIFIED', contentReviewCriteria: { criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, title: criterionId })) } };
  const history: Record<number, any> = {};
  await page.route('**/api/v1/**', route => { unexpected.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: uid, displayName: '전용 방법론 QA' }, clientId: cid, csrfToken: 'A'.repeat(43) } }));
  await page.route('**/api/v1/projects?*', route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/, route => route.fulfill({ json: { items: [{ ...original, status: 'DRAFT', sourceAvailable: true }], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/methodologies/' + source.id + '/versions/' + source.version, route => route.fulfill({ json: original }));
  await page.route('**/api/v1/projects/' + pid, route => route.fulfill({ json: { id: pid, currentMethodologyRef: { id: 'a6f20000-0000-4000-8000-000000000087', version: 1, contentHash: 'a'.repeat(64) }, participation: 'OWNER', controlState: { actorId: uid, clientId: cid, generation: 3, status: 'HELD' } } }));
  await page.route(/\/api\/v1\/projects\/[^/]+\/methodologies\?limit=20$/, route => route.fulfill({ json: { projectId: pid, items: copied ? [{ ref: own.ref, name: own.name, purpose: own.purpose, scope: 'PROJECT' }] : [], hasMore: false, nextAfterId: null, observedAt: new Date().toISOString(), applicationTransition: 'EXECUTION_STATE_UNVERIFIED' } }));
  await page.route(new RegExp('/api/v1/projects/' + pid + '/methodologies/' + mid + '/versions/[12]$'), route => { const version = Number(new URL(route.request().url()).pathname.split('/').at(-1)); return route.fulfill({ json: { ...(history[version] ?? own), headVersion: own.headVersion } }); });
  await page.route('**/api/v1/projects/' + pid + '/commands', async route => {
    const request = route.request().postDataJSON(); requests.push(request); copied = true;
    if (cutReceipt) { cutReceipt = false; return route.abort('failed'); }
    if (rejectRecheck) { rejectRecheck = false; return route.fulfill({ status: 403, json: { code: 'PROJECT_OPERATION_DENIED' } }); }
    let data: any = { ref: own.ref, status: 'DRAFT' };
    if (request.operation === 'recordContentReview') {
      const reviewRef = { id: 'a6f20000-0000-4000-8000-000000000085', criteriaVersion: 1, targetRef: own.ref, outcome: 'ACCEPTED' };
      own.contentReviews = [{ ref: reviewRef, items: request.payload.items, reviewer: { kind: 'HUMAN', userId: uid, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: request.payload.reason, reviewedAt: '2026-10-17T00:00:00.000Z', serverSequence: 2 }];
      data = { ref: own.ref, status: 'REVIEW_RECORDED', reviewRef };
    } else if (request.operation === 'confirmMethodology') {
      const confirmationId = 'a6f20000-0000-4000-8000-000000000086';
      own.confirmation = { id: confirmationId, decision: 'CONFIRMED', decided_at: '2026-10-17T00:00:00.000Z', decidedBy: uid, reviewRefs: request.payload.reviewRefs };
      data = { ref: own.ref, status: 'CONFIRMED', confirmationId };
    } else if (request.operation === 'saveMethodologyDraft') {
      history[1] = structuredClone(own); own.ref = { ...own.ref, version: 2 }; own.headVersion = 2; own.name = request.payload.name; own.purpose = request.payload.purpose; own.graph = request.payload.graph; own.confirmation = null; own.contentReviews = [];
      data = { ref: own.ref, status: 'DRAFT' };
    }
    await route.fulfill({ json: { operationId: mid, commandId: request.commandId, projectId: pid, status: 'APPLIED', targetId: mid, version: own.ref.version, data, serverReceivedAt: '2026-10-17T00:00:00.000Z' } });
  });
  await page.goto('/#/projects/' + pid + '/methodologies');
  await expect(page.getByRole('heading', { name: '프로젝트 전용 방법론', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '고정 적용본 조회', exact: true }).getByText('적용 세대 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: source.name + ' 전용 복사 원본', exact: true }).click();
  await page.getByLabel('복사본 이름', { exact: true }).fill(own.name);
  await page.getByRole('button', { name: '프로젝트 전용으로 복사', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true })).toBeVisible();
  await page.evaluate(() => { location.hash = '#/projects'; });
  await page.evaluate(hash => { location.hash = hash; }, '#/projects/' + pid + '/methodologies');
  await page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '요청을 처리하지 못했습니다. 결과를 확인한 뒤 다시 시도하세요. 입력은 보존했습니다.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '같은 명령 결과 다시 확인', exact: true }).click();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 1', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(3); expect(requests[0]).toEqual(requests[1]); expect(requests[0]).toEqual(requests[2]); expect(requests[0].projectId).toBe(pid); expect(requests[0].controlGeneration).toBe(3); expect(requests[0].payload.scope).toBe('PROJECT');
  await page.getByRole('button', { name: own.name + ' v1 열기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 전용본 편집', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이 방법론 내용 검토 시작', exact: true }).click();
  for (const criterion of criteria) { await page.getByLabel(criterion + ' 판정', { exact: true }).selectOption('ACCEPTED'); await page.getByLabel(criterion + ' 검토 이유', { exact: true }).fill('원문 확인'); }
  await page.getByLabel('내용 검토 종합 판정', { exact: true }).selectOption('ACCEPTED'); await page.getByLabel('내용 검토 종합 이유', { exact: true }).fill('절차 원문 대조');
  await page.getByRole('button', { name: '내용 검토 기록', exact: true }).click();
  await expect(page.getByText('서버 내용 검토 기록 확인', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이 방법론 버전 확정', exact: true }).click();
  await expect(page.getByText('현재 버전 사용자 확정 이력 있음 · 실행 승인은 별도', { exact: true })).toBeVisible();
  expect(requests.map(item => item.operation)).toEqual(['copyMethodology', 'copyMethodology', 'copyMethodology', 'recordContentReview', 'confirmMethodology']);
  await page.getByRole('button', { name: '이 전용본 편집', exact: true }).click();
  await page.getByLabel('방법론 이름', { exact: true }).fill('개정 전용 절차');
  await page.getByLabel('개정 이유', { exact: true }).fill('현재 프로젝트 목적 구체화');
  await page.getByRole('button', { name: '전용본 새 버전 저장', exact: true }).click();
  await expect(page.getByText('서버 저장·재조회 확인 · 버전 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '개정 전용 절차 v2 열기', exact: true }).click();
  await page.getByRole('button', { name: '이전 방법론 버전', exact: true }).click();
  await expect(page.getByText('이 버전의 확정 이력 있음 · 적용 여부와 별도', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '고정 적용본 조회', exact: true }).getByText('적용 세대 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '프로젝트 적용 전환', exact: true })).toBeDisabled();
  await expect(page.getByText('실행 상태 미확인 · 적용 전환 불가', { exact: true })).toBeVisible();
  expect(unexpected).toEqual([]);
});
