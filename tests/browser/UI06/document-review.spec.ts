import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', file = 'a6f30000-0000-4000-8000-000000000099';
const ref = { id, version: 2, contentHash: 'b'.repeat(64) }, formRef = { id: file, version: 1, contentHash: 'a'.repeat(64) }, csrf = 'C'.repeat(43);
const body = '# 요구사항\n원문 대조 대상', unknown = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  unknown.set(page, []);
  await page.route('**/api/v1/**', route => { unknown.get(page)!.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: '검토 QA' }, clientId: id, csrfToken: csrf } }));
  await page.route(`**/api/v1/projects/${project}`, route => route.fulfill({ json: { id: project, participation: 'OWNER', controlState: { actorId: id, clientId: id, generation: 4, status: 'HELD' } } }));
  await page.route(`**/api/v1/projects/${project}/documents?*`, route => route.fulfill({ json: { items: [{ id, title: '검토 대상', headVersion: 2, confirmedVersion: null, updatedAt: '2026-10-16T05:00:00Z' }], hasMore: false, nextCursor: null, observedAt: '2026-10-16T05:00:00Z' } }));
  await page.route(`**/api/v1/projects/${project}/files/${file}`, route => route.fulfill({ contentType: 'application/octet-stream', body }));
});
test.afterEach(async ({ page }) => { expect(unknown.get(page)).toEqual([]); });
async function document(page: Page, reviews: any[] = [], state = { validForConfirmation: false, confirmed: false }, version = 2) {
  await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/${version}`, route => route.fulfill({ json: {
    ...ref, version, title: '검토 대상', confirmed: state.confirmed, formRef, stageNodeRef: null,
    content: { body: { artifactId: file, bytes: Buffer.byteLength(body), contentHash: createHash('sha256').update(body).digest('hex'), mediaType: 'text/markdown;charset=utf-8' }, attachments: [], sections: [], sourceRefs: [] },
    validation: { validForConfirmation: state.validForConfirmation, issues: [] }, statusHistory: [],
    contentReviewCriteria: { criteriaVersion: 1, formRef, items: [{ criterionId: 'REQ', title: '요구 내용', reviewCriteria: ['실제 원문과 대조'] }, { criterionId: 'SCOPE', title: '범위', reviewCriteria: ['누락 구분'] }] }, contentReviews: reviews,
  } }));
}
async function start(page: Page) {
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전 내용 검토 작성', exact: true }).click();
}
async function fill(page: Page) {
  await page.getByLabel('요구 내용 판단', { exact: true }).selectOption('ACCEPTED');
  await page.getByLabel('요구 내용 근거', { exact: true }).fill('실제 원문 대조');
  await page.getByLabel('범위 판단', { exact: true }).selectOption('REWORK');
  await page.getByLabel('범위 근거', { exact: true }).fill('경계 조건 누락');
  await page.getByLabel('내용 검토 종합 판단', { exact: true }).selectOption('REWORK');
  await page.getByLabel('내용 검토 종합 이유', { exact: true }).fill('보완 후 다시 검토');
}
test('검토 입력과 미확인 명령을 보존하고 같은 명령으로 기록하되 문서 확정·실행은 하지 않는다', async ({ page }) => {
  const reviews: any[] = [], writes: any[] = []; await document(page, reviews);
  await page.route(`**/api/v1/projects/${project}/commands`, route => {
    const c = route.request().postDataJSON(); writes.push(c);
    expect(c.operation).toBe('recordContentReview'); expect(c.targetId).toBe(id); expect(c.expectedVersion).toBe(2); expect(c.controlGeneration).toBe(4);
    expect(c.payload.targetRef).toEqual(ref); expect(c.payload.items).toEqual([{ criterionId: 'REQ', outcome: 'ACCEPTED', evidenceRefs: [], reason: '실제 원문 대조' }, { criterionId: 'SCOPE', outcome: 'REWORK', evidenceRefs: [], reason: '경계 조건 누락' }]);
    expect(route.request().headers()['x-anvil-csrf']).toBe(csrf); expect(route.request().headers()['idempotency-key']).toBe(c.commandId);
    const reviewRef = { id: file, criteriaVersion: 1, targetRef: ref, outcome: 'REWORK' };
    if (!reviews.length) reviews.push({ ref: reviewRef, items: c.payload.items, reviewer: { kind: 'HUMAN', userId: id, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: c.payload.reason, reviewedAt: '2026-10-16T05:00:00Z', serverSequence: 8 });
    return writes.length === 1 ? route.abort('connectionreset') : route.fulfill({ json: { operationId: file, commandId: c.commandId, projectId: project, status: 'APPLIED', targetId: id, version: 2, data: { status: 'REVIEW_RECORDED', reviewRef }, evidenceRefs: [], warnings: [], serverReceivedAt: '2026-10-16T05:00:00Z' } });
  });
  await start(page); await fill(page);
  await page.evaluate(() => { location.hash = '#/runs'; });
  await page.getByRole('heading', { name: '아직 연결되지 않은 화면', exact: true }).waitFor();
  await page.evaluate(p => { location.hash = '#/projects/' + p + '/documents'; }, project);
  await expect(page.getByLabel('내용 검토 종합 이유', { exact: true })).toHaveValue('보완 후 다시 검토');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: '내용 검토 기록 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.evaluate(() => { location.hash = '#/runs'; });
  await page.getByRole('heading', { name: '아직 연결되지 않은 화면', exact: true }).waitFor();
  await page.evaluate(p => { location.hash = '#/projects/' + p + '/documents'; }, project);
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '같은 검토 명령 결과 확인', exact: true }).click();
  await expect(page.getByText('내용 검토 저장 확인 · 문서 확정 아님', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
  await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await expect(page.getByText('작성 기록자와 같은 사용자 · 독립 검수 아님', { exact: true })).toBeVisible();
  await expect(page.getByText('초안 · 내용 검토/사용자 확정과 별개', { exact: true })).toBeVisible();
});
test('일부 항목 재작업을 종합 합격으로 제출하지 않고 충돌 후에도 원래 검토 명령을 유지한다', async ({ page }) => {
  await document(page); const writes: any[] = [];
  await page.route(`**/api/v1/projects/${project}/commands`, route => { writes.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { code: 'VERSION_CONFLICT' } }); });
  await start(page); await fill(page);
  await page.getByLabel('내용 검토 종합 판단', { exact: true }).selectOption('ACCEPTED');
  await page.getByRole('button', { name: '내용 검토 기록 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('REVIEW_INCOMPLETE'); expect(writes).toHaveLength(0);
  await page.getByLabel('내용 검토 종합 판단', { exact: true }).selectOption('REWORK');
  await page.getByRole('button', { name: '내용 검토 기록 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('VERSION_CONFLICT');
  await expect(page.getByLabel('범위 근거', { exact: true })).toHaveValue('경계 조건 누락');
  await page.getByRole('button', { name: '같은 검토 명령 결과 확인', exact: true }).click();
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
});

test('명확히 거절된 검토는 원래 명령을 보관한 뒤에만 새 대상의 판단을 다시 작성한다', async ({ page }) => {
  await document(page); await document(page,[],{ validForConfirmation:false,confirmed:false },3); const writes: any[] = [];
  await page.route(`**/api/v1/projects/${project}/documents?*`, r => r.fulfill({json:{items:[{id,title:'검토 대상',headVersion:writes.length ? 3 : 2,confirmedVersion:null,updatedAt:'2026-10-16T05:00:00Z'}],hasMore:false,nextCursor:null,observedAt:'2026-10-16T05:00:00Z'}}));
  await page.route(`**/api/v1/projects/${project}/commands`, r => { const c = r.request().postDataJSON(); writes.push(c); return writes.length === 1 ? r.fulfill({status:409,json:{code:'VERSION_CONFLICT'}}) : r.fulfill({json:{operationId:file,commandId:c.commandId,projectId:project,status:'APPLIED',targetId:id,version:3,data:{status:'REVIEW_RECORDED',reviewRef:{id:file,criteriaVersion:1,targetRef:{...ref,version:3},outcome:'REWORK'}},serverReceivedAt:'2026-10-16T05:00:00Z'}}); });
  await start(page); await fill(page); await page.getByRole('button',{name:'내용 검토 기록 저장',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('VERSION_CONFLICT');
  await page.getByRole('button',{name:'거절된 검토 명령 보관하고 입력 다시 열기',exact:true}).click();
  await page.getByRole('button',{name:'문서 목록 새로고침',exact:true}).click(); await page.getByRole('button',{name:'검토 대상 열기',exact:true}).click();
  page.once('dialog', d => d.accept()); await page.getByRole('button',{name:'이 버전 내용 검토 작성',exact:true}).click();
  await expect(page.getByLabel('내용 검토 종합 판단',{exact:true})).toHaveValue('NOT_EXECUTED'); await expect(page.getByLabel('내용 검토 종합 이유',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('거절된 검토 명령 이력',{exact:true})).toContainText(writes[0].commandId); expect(writes).toHaveLength(1);
  await fill(page); await page.getByRole('button',{name:'내용 검토 기록 저장',exact:true}).click(); await expect(page.getByText('내용 검토 저장 확인 · 문서 확정 아님',{exact:true})).toBeVisible(); expect(writes[1].commandId).not.toBe(writes[0].commandId); expect(writes[1].expectedVersion).toBe(3);
});
test('인증 만료 후 다른 사용자는 이전 검토 입력을 볼 수 없고 자동 재전송도 없다', async ({ page }) => {
  await document(page); let writes = 0;
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { user: { id: file, displayName: '다른 사용자' }, clientId: file, csrfToken: csrf } }));
  await page.route(`**/api/v1/projects/${project}/commands`, route => { writes++; return route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }); });
  await start(page); await fill(page);
  await page.getByRole('button', { name: '내용 검토 기록 저장', exact: true }).click();
  await page.getByRole('heading', { name: 'Anvil 로그인', exact: true }).waitFor();
  await page.getByLabel('사용자명', { exact: true }).fill('synthetic-review-other');
  await page.getByLabel('비밀번호', { exact: true }).fill('QA-only-not-real-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('다른 사용자 또는 프로젝트의 검토 입력은 숨겨 보존했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('내용 검토 종합 이유', { exact: true })).toHaveCount(0); expect(writes).toBe(1);
});
test('내용 검토 작성 중에는 앞서 열었던 초안 편집기로 다른 버전을 동시에 저장하지 않는다', async ({ page }) => {
  await document(page);
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전에서 편집', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이 버전 내용 검토 작성', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이 버전에서 편집', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '새 문서 작성', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '검토 작성 닫기', exact: true }).click();
  await expect(page.getByLabel('문서 본문 편집', { exact: true })).toHaveValue(body);
});
function acceptedReview(sequence = 8, outcome = 'ACCEPTED') { return { ref: { id: file, criteriaVersion: 1, targetRef: ref, outcome }, items: ['REQ','SCOPE'].map(criterionId => ({ criterionId, outcome, evidenceRefs: [], reason: '실제 원문 확인' })), reviewer: { kind: 'HUMAN', userId: id, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: '사람의 내용 대조', reviewedAt: '2026-10-16T05:00:00Z', serverSequence: sequence }; }

test('명확히 거절된 확정만 보관 후 새 버전·검토를 선택하고 별도 확인을 다시 받는다', async ({ page }) => {
  const accepted = acceptedReview(), nextRef = { ...ref, version:3 }, nextReview = { ...accepted,ref:{ ...accepted.ref,targetRef:nextRef } }, writes: any[] = [];
  await document(page,[accepted],{validForConfirmation:true,confirmed:false}); await document(page,[nextReview],{validForConfirmation:true,confirmed:false},3);
  await page.route(`**/api/v1/projects/${project}/documents?*`, r => r.fulfill({json:{items:[{id,title:'검토 대상',headVersion:writes.length ? 3 : 2,confirmedVersion:null,updatedAt:'2026-10-16T05:00:00Z'}],hasMore:false,nextCursor:null,observedAt:'2026-10-16T05:00:00Z'}}));
  await page.route(`**/api/v1/projects/${project}/commands`, r => { const c=r.request().postDataJSON(); writes.push(c); return writes.length===1 ? r.fulfill({status:409,json:{code:'VERSION_CONFLICT'}}) : r.fulfill({json:{operationId:file,commandId:c.commandId,projectId:project,targetId:id,version:3,status:'APPLIED',data:{ref:nextRef,status:'CONFIRMED',confirmationId:file},serverReceivedAt:'2026-10-16T05:00:00Z'}}); });
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{name:'검토 대상 열기',exact:true}).click(); await page.getByRole('button',{name:'이 버전 확정 준비',exact:true}).click(); await page.getByLabel('이 문서 버전과 검토 결과를 확인했습니다',{exact:true}).check(); await page.getByRole('button',{name:'문서 버전 확정',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('VERSION_CONFLICT'); await page.getByRole('button',{name:'거절된 확정 명령 보관하고 대상 다시 선택',exact:true}).click();
  await page.getByRole('button',{name:'문서 목록 새로고침',exact:true}).click(); await page.getByRole('button',{name:'검토 대상 열기',exact:true}).click(); await page.getByRole('button',{name:'열어 둔 버전으로 확정 대상 변경',exact:true}).click();
  await expect(page.getByLabel('이 문서 버전과 검토 결과를 확인했습니다',{exact:true})).not.toBeChecked(); await expect(page.getByRole('button',{name:'문서 버전 확정',exact:true})).toBeDisabled(); await expect(page.getByLabel('거절된 확정 명령 이력',{exact:true})).toContainText(writes[0].commandId); expect(writes).toHaveLength(1);
  await page.getByLabel('이 문서 버전과 검토 결과를 확인했습니다',{exact:true}).check(); await page.getByRole('button',{name:'문서 버전 확정',exact:true}).click(); await expect(page.getByText('문서 확정 저장 확인 · Agent 실행 아님',{exact:true})).toBeVisible(); expect(writes[1].commandId).not.toBe(writes[0].commandId); expect(writes[1].payload.reviewRefs).toEqual([nextReview.ref]);
});

for (const kind of ['검토','확정'] as const) test(`${kind} 응답 단절 뒤 권한 거절이 와도 이전 결과 미확인을 지우거나 대상 교체를 열지 않는다`, async ({ page }) => {
  const writes: any[]=[]; await document(page,kind==='확정' ? [acceptedReview()] : [],{validForConfirmation:kind==='확정',confirmed:false});
  await page.route(`**/api/v1/projects/${project}/commands`,r=>{ writes.push(r.request().postDataJSON()); return writes.length===1 ? r.abort('connectionreset') : r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}); });
  if(kind==='검토') { await start(page); await fill(page); await page.getByRole('button',{name:'내용 검토 기록 저장',exact:true}).click(); }
  else { await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{name:'검토 대상 열기',exact:true}).click(); await page.getByRole('button',{name:'이 버전 확정 준비',exact:true}).click(); await page.getByLabel('이 문서 버전과 검토 결과를 확인했습니다',{exact:true}).check(); await page.getByRole('button',{name:'문서 버전 확정',exact:true}).click(); }
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.getByRole('button',{name:`같은 ${kind} 명령 결과 확인`,exact:true}).click(); await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED'); expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
  await expect(page.getByRole('button',{name:kind==='검토' ? '거절된 검토 명령 보관하고 입력 다시 열기' : '거절된 확정 명령 보관하고 대상 다시 선택',exact:true})).toHaveCount(0);
});
test('문서 확정은 별도 확인 뒤 명시 요청하고 단절/화면 이동에도 같은 명령으로 결과를 확인한다', async ({ page }) => {
  const accepted = acceptedReview(), state = { validForConfirmation: true, confirmed: false }, writes: any[] = []; await document(page, [accepted], state);
  await page.route(`**/api/v1/projects/${project}/commands`, route => {
    const c = route.request().postDataJSON(); writes.push(c); expect(c.operation).toBe('confirmDocument'); expect(c.targetId).toBe(id); expect(c.expectedVersion).toBe(2);
    expect(c.payload).toEqual({ versionRef: ref, formRef, reviewRefs: [accepted.ref] }); expect(route.request().headers()['x-anvil-csrf']).toBe(csrf);
    state.confirmed = true;
    return writes.length === 1 ? route.abort('connectionreset') : route.fulfill({ json: { operationId: file, commandId: c.commandId, projectId: project, targetId: id, version: 2, status: 'APPLIED', data: { ref, status: 'CONFIRMED', confirmationId: file }, serverReceivedAt: '2026-10-16T05:00:00Z' } });
  });
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전 확정 준비', exact: true }).click();
  await expect(page.getByRole('button', { name: '문서 버전 확정', exact: true })).toBeDisabled(); expect(writes).toHaveLength(0);
  await page.getByLabel('이 문서 버전과 검토 결과를 확인했습니다', { exact: true }).check();
  await page.getByRole('button', { name: '문서 버전 확정', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.evaluate(() => { location.hash = '#/runs'; }); await page.getByRole('heading', { name: '아직 연결되지 않은 화면', exact: true }).waitFor();
  await page.evaluate(p => { location.hash = '#/projects/' + p + '/documents'; }, project); expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '같은 확정 명령 결과 확인', exact: true }).click();
  await expect(page.getByText('문서 확정 저장 확인 · Agent 실행 아님', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
  await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click(); await expect(page.getByText('확정된 버전', { exact: true })).toBeVisible();
});
test('형식 미완성 또는 최신 재작업 검토는 옛 적합 기록이 있어도 확정 준비를 허용하지 않는다', async ({ page }) => {
  const state = { validForConfirmation: false, confirmed: false }, reviews = [acceptedReview()]; await document(page, reviews, state);
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 버전 확정 준비', exact: true })).toBeDisabled();
  state.validForConfirmation = true; reviews.push(acceptedReview(9, 'REWORK'));
  await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 버전 확정 준비', exact: true })).toBeDisabled();
});
test('확정 요청의 인증 만료 후 다른 사용자는 이전 대상이나 미확인 명령을 보지 못한다', async ({ page }) => {
  await document(page, [acceptedReview()], { validForConfirmation: true, confirmed: false }); let writes = 0;
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { user: { id: file, displayName: '다른 사용자' }, clientId: file, csrfToken: csrf } }));
  await page.route(`**/api/v1/projects/${project}/commands`, route => { writes++; return route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }); });
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button', { name: '검토 대상 열기', exact: true }).click();
  await page.getByRole('button', { name: '이 버전 확정 준비', exact: true }).click();
  await page.getByLabel('이 문서 버전과 검토 결과를 확인했습니다', { exact: true }).check(); await page.getByRole('button', { name: '문서 버전 확정', exact: true }).click();
  await page.getByRole('heading', { name: 'Anvil 로그인', exact: true }).waitFor();
  await page.getByLabel('사용자명', { exact: true }).fill('synthetic-confirm-other'); await page.getByLabel('비밀번호', { exact: true }).fill('QA-only-not-real-password'); await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('다른 사용자 또는 프로젝트의 확정 요청은 숨겨 보존했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '문서 별도 확정', exact: true })).toHaveCount(0); expect(writes).toBe(1);
});
