import { expect, test } from '@playwright/test';

const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', projectId = '51c0439f-791e-4bb5-8471-70938d6afaf1', reviewId = 'a6f20000-0000-4000-8000-000000000099';
const ref = { id: 'a6f20000-0000-4000-8000-000000000001', version: 2, contentHash: 'a'.repeat(64) }, csrf = 'C'.repeat(43);
const input = { name: '사용자 소유 프로젝트', purpose: 'Agent 교체에도 원본 보존', desiredOutcome: '방법론대로 작업', sourceMode: 'EMPTY', methodologySelection: { kind: 'CONFIRMED_REFERENCE', versionRef: ref }, artifactRefs: [] };
const criteria = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'];
const project = { id: projectId, name: input.name, purpose: input.purpose, desiredOutcome: input.desiredOutcome, version: 1, createdAt: '2026-10-16T01:00:00.000Z', updatedAt: '2026-10-16T01:00:00.000Z', currentMethodologyRef: { id: reviewId, version: 1, contentHash: 'b'.repeat(64) }, baselineRef: null, sourceMode:'EMPTY',sourceDeclaration:null, readinessIssues: [{ code: 'PERMISSION_POLICY_UNCONFIGURED' }], participation: 'OWNER', viewerPermissions: ['READ_PROJECT'], controlState: { actorId: id, clientId: id, generation: 1, status: 'HELD' } };
const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unexpected.set(page, []);
  await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: 'QA' }, clientId: id, csrfToken: csrf } }));
  await page.route('**/api/v1/projects/'+projectId, route=>route.fulfill({json:project}));
  for (const path of ['methodologies', 'forms']) await page.route('**/api/v1/' + path, route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
});
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

test('저장 초안 생성 결과 단절은 새 명령 없이 유지하고 같은 요청 재확인 후 원본/준비 필요를 표시한다', async ({ page }) => {
  const calls: any[] = [];
  await page.route('**/api/v1/project-drafts/' + id, route => route.fulfill({ json: { draftId: id, version: 2, step: 2, input, editable: true, consumedProjectId: null, methodologyState: null } }));
  await page.route('**/api/v1/projects', route => { calls.push(route.request().postDataJSON()); return calls.length === 1 ? route.abort('connectionreset') : route.fulfill({ status: 201, json: project }); });
  await page.goto('/?draftId=' + id + '#/projects/new');
  await page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 생성 명령 결과 확인', exact: true })).toBeVisible();
  await expect(page.getByLabel('왜 만드는가', { exact: true })).toHaveValue(input.purpose);
  expect(calls).toHaveLength(1);
  await page.getByRole('button', { name: '같은 생성 명령 결과 확인', exact: true }).click();
  await expect(page.getByText('프로젝트 원본 생성 확인', { exact: true })).toBeVisible();
  await expect(page.getByText('PERMISSION_POLICY_UNCONFIGURED', { exact: true })).toBeVisible();
  await expect(page.getByText('Agent는 실행하지 않았습니다.', { exact: true })).toBeVisible();
  expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
  expect(calls[0]).toEqual({ schemaVersion: 1, commandId: calls[0].commandId, clientId: id, draftId: id, draftVersion: 2 });
});

test('전용 초안은 사람의 항목별 검토와 별도 확정을 저장한 뒤에만 생성한다', async ({ page }) => {
  const graph = { nodes: [{ nodeId: 'CHECK', name: '사람 확인', purpose: '목적을 대조', kind: 'HUMAN', role: 'USER', mode: 'CASE_BY_CASE', position: { x: 0, y: 0 }, inputs: [], outputs: [], taskScope: { included: ['내용 확인'], excluded: [] }, completionCriteria: ['판단 기록'], approvalBoundary: [], limitPolicyRef: null, recordRequirements: ['판단 이유'] }], edges: [], entryNodeId: 'CHECK', terminalNodeIds: ['CHECK'] };
  const direct = { ...input, methodologySelection: { kind: 'NEW_PROJECT_DRAFT', name: '내 절차', purpose: '사람의 기준', graph, sourceRefs: [], reviewRefs: [] } };
  const target = { id, version: 2, contentHash: 'c'.repeat(64) };
  const state: any = { ref: target, validation: { validForConfirmation: true, issues: [] }, contentReviewCriteria: { criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, title: criterionId + ' 내용 확인' })) }, contentReviews: [], confirmation: null };
  const commands: any[] = []; let creates = 0;
  await page.route('**/api/v1/project-drafts/' + id, route => route.fulfill({ json: { draftId: id, version: 2, step: 2, input: direct, editable: true, consumedProjectId: null, methodologyState: state } }));
  await page.route('**/api/v1/project-drafts/' + id + '/commands', route => {
    const body = route.request().postDataJSON(); commands.push(body);
    let data: any;
    if (body.operation === 'recordContentReview') {
      const reviewRef = { id: reviewId, targetRef: target, criteriaVersion: 1, outcome: 'ACCEPTED' };
      state.contentReviews = [{ reviewRef, items: body.payload.items, reason: body.payload.reason, reviewerSubjectRef: { kind: 'HUMAN', userId: id, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reviewedAt: '2026-10-16T01:00:00.000Z' }];
      data = { ref: target, status: 'REVIEW_RECORDED', reviewRef };
    } else {
      state.confirmation = { id: reviewId, decidedBy: id, decidedAt: '2026-10-16T01:00:01.000Z', reviewRefs: [state.contentReviews[0].reviewRef] };
      data = { ref: target, status: 'CONFIRMED', confirmationId: reviewId };
    }
    return route.fulfill({ json: { scopeKind: 'DRAFT', draftId: id, targetId: id, version: 2, commandId: body.commandId, status: 'APPLIED', data, evidenceRefs: [] } });
  });
  await page.route('**/api/v1/projects', route => { creates++; return route.fulfill({ status: 201, json: project }); });
  await page.goto('/?draftId=' + id + '#/projects/new');
  await expect(page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '이 초안 내용 검토 시작', exact: true }).click();
  for (const code of criteria) {
    await page.getByLabel(code + ' 초안 판정', { exact: true }).selectOption('ACCEPTED');
    await page.getByLabel(code + ' 초안 검토 이유', { exact: true }).fill('설계한 절차와 산출 기준을 확인');
  }
  await page.getByLabel('초안 검토 종합 판정', { exact: true }).selectOption('ACCEPTED');
  await page.getByLabel('초안 검토 종합 이유', { exact: true }).fill('합성 검토 판단');
  await page.getByRole('button', { name: '초안 내용 검토 기록', exact: true }).click();
  await expect(page.getByText('작성 기록자와 같은 사용자 · 독립 검수 아님', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '이 초안 방법론 확정', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '저장 초안으로 프로젝트 생성', exact: true }).click();
  await expect(page.getByText('프로젝트 원본 생성 확인', { exact: true })).toBeVisible();
  expect(creates).toBe(1); expect(commands.map(command => command.operation)).toEqual(['recordContentReview', 'confirmDraftMethodology']);
  expect(commands[1].payload).toEqual({ draftVersion: 2, graphHash: target.contentHash, reviewRefs: [state.contentReviews[0].reviewRef] });
});
