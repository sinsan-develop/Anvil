import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { installWorkspaceBundle } from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  await installWorkspaceBundle(page);
  unexpected.set(page, []);
  await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: catalog.forms[0]!.ref.id, displayName: '양식 조회 QA' }, clientId: catalog.forms[0]!.ref.id, csrfToken: 'A'.repeat(43) } }));
  await page.route('**/api/v1/methodologies', route => route.fulfill({ json: { items: [], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: catalog.forms.map(form => ({ ref: form.ref, formCode: form.definition.formCode, name: form.definition.name, scope: 'SYSTEM' })), observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
});
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

test('FORM_FIELD_DETAILS 같은 제목의 필수·선택 필드를 ID/형식으로 구분하고 HTML을 실행하지 않는다',async({page})=>{
 const definition=structuredClone(catalog.forms[0]!.definition);definition.scope='USER_COMMON';definition.name='필드 상세 QA';
 const row=definition.items.find(item=>item.fields.length>1)!;
 row.fields[0]!.title='<img src=x onerror="window.FORM_FIELD_EXECUTED=1">';row.fields[1]!.title=row.fields[0]!.title;row.fields[1]!.required=false;
 const ref={id:'a6f30000-0000-4000-8000-000000000095',version:1,contentHash:contentHash(canonicalJson(definition))};
 const writes:string[]=[],offOrigin:string[]=[],errors:string[]=[];
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[{ref,formCode:definition.formCode,name:definition.name,scope:definition.scope}],observedAt:new Date().toISOString(),hasMore:false,nextCursor:null,baselineVersion:null}}));
 await page.route(`**/api/v1/forms/${ref.id}/versions/1`,r=>r.fulfill({json:{ref,definition,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}}}));
 await page.goto('/#/methodologies');const original=page.getByRole('article',{name:'선택 양식 원본',exact:true});
 await expect(original.getByRole('heading',{name:'AF01 필드 상세 QA',exact:true})).toBeVisible();
 await expect(original.getByText(`${row.fields[0]!.fieldId} · 필수 · TEXT`,{exact:true})).toBeVisible();
 await expect(original.getByText(`${row.fields[1]!.fieldId} · 선택 · TEXT`,{exact:true})).toBeVisible();
 await expect(original.getByText(row.fields[0]!.title,{exact:true})).toHaveCount(2);await expect(original.locator('img')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).FORM_FIELD_EXECUTED)).toBeUndefined();expect(writes).toEqual([]);expect(offOrigin).toEqual([]);expect(errors).toEqual([]);
});

test('양식 화면 계약: 공식8종의 정확 버전·목차·반복필드·작성 기준을 읽으며 작성/승인 완료로 오인하지 않는다', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.route(/\/api\/v1\/forms\/[^/]+\/versions\/1$/, route => {
    const form = catalog.forms.find(item => route.request().url().includes(item.ref.id))!;
    return route.fulfill({ json: { ...form, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByLabel('공식 산출물 양식', { exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByLabel('공식 산출물 양식', { exact: true }).getByRole('option')).toHaveCount(8);
  await expect(page.getByRole('heading', { name: 'AF01 요구사항정의서', exact: true })).toBeVisible();
  await expect(page.getByText('R ID', { exact: true })).toBeVisible();
  await page.getByLabel('공식 산출물 양식', { exact: true }).selectOption(catalog.forms[7]!.ref.id);
  await expect(page.getByRole('heading', { name: 'AF08 개발환경 정의서', exact: true })).toBeVisible();
  await expect(page.getByText('비밀 참조·보호', { exact: true })).toBeVisible();
  await page.getByText('문서 작성 공통 기준 원문', { exact: true }).click();
  await expect(page.getByRole('region', { name: '작성 기준 원문' })).toContainText('작업계획서');
  await expect(page.getByText('문서 내용 검수·사용자 확정은 아직 수행하지 않았습니다.', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('양식 화면 계약: 재조회 실패는 오래된 자료 표시, 다른 선택의 과거 본문 재사용은 금지한다', async ({ page }) => {
  let calls = 0;
  await page.route(/\/api\/v1\/forms\/[^/]+\/versions\/1$/, route => {
    if (++calls > 1) return route.fulfill({ status: 503, json: { code: 'STORAGE_FAILED' } });
    return route.fulfill({ json: { ...catalog.forms[0], authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByRole('heading', { name: 'AF01 요구사항정의서', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '양식 다시 조회', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('오래된 자료');
  await page.getByLabel('공식 산출물 양식', { exact: true }).selectOption(catalog.forms[1]!.ref.id);
  await expect(page.getByRole('heading', { name: 'AF01 요구사항정의서', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'AF02 설계서', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
});

test('양식 편집 계약: 공식본을 공통본으로 복사해 항목 제목을 개정·저장·재조회한다', async ({ page }) => {
  const target = 'a6f30000-0000-4000-8000-000000000099';
  let definition = { ...structuredClone(catalog.forms[0]!.definition), name: '내 문서 양식', scope: 'USER_COMMON' }, version = 1;
  const writes: any[] = [];
  await page.route(/\/api\/v1\/forms\/[^/]+\/versions\/[12]$/, route => {
    const common = route.request().url().includes(target);
    const form = catalog.forms.find(item => route.request().url().includes(item.ref.id)) ?? catalog.forms[0]!;
    return route.fulfill({ json: { ref: common ? { id: target, version, contentHash: 'b'.repeat(64) } : form.ref, definition: common ? definition : form.definition,
      authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } } });
  });
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); writes.push(body);
    if (body.operation === 'saveFormDraft') { definition = body.payload.definition; version = 2; }
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: catalog.forms[0]!.ref.id, operationId: 'a6f30000-0000-4000-8000-000000000088', commandId: body.commandId, status: 'APPLIED', targetId: target, version,
      data: { ref: { id: target, version, contentHash: 'b'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '내 공통 양식으로 복사', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('양식 복사본 이름', { exact: true }).fill('내 문서 양식');
  await page.getByRole('button', { name: '내 공통 양식으로 복사', exact: true }).click();
  await page.getByLabel('양식 항목 제목', { exact: true }).fill('요구사항 작성 목적');
  await page.getByLabel('양식 개정 이유', { exact: true }).fill('항목 설명 구체화');
  await page.getByRole('button', { name: '공통 양식 새 버전 저장', exact: true }).click();
  await expect(page.getByText('양식 서버 저장·재조회 확인 · 버전 2', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[1].operation).toBe('saveFormDraft'); expect(writes[1].expectedVersion).toBe(1);
  expect(writes[1].payload.definition.items[0].title).toBe('요구사항 작성 목적');
});

test('내용 검토와 사용자 확정은 각각 직접 조작하고 같은 버전의 서버 기록을 다시 읽는다', async ({ page }) => {
  const ref = { id: 'a6f30000-0000-4000-8000-000000000099', version: 1, contentHash: 'c'.repeat(64) };
  const criteria = ['FORM_PURPOSE', 'FORM_ROLES', 'FORM_STRUCTURE', 'FORM_AUTHORING', 'FORM_REVIEW'].map(criterionId => ({ criterionId, title: criterionId + ' 확인' }));
  const reviewRef = { id: 'a6f30000-0000-4000-8000-000000000088', criteriaVersion: 1, targetRef: ref, outcome: 'ACCEPTED' };
  const writes: any[] = []; let reviews: any[] = [], confirmation: any = null;
  const definition = { ...catalog.forms[0]!.definition, name: '검토할 내 양식', scope: 'USER_COMMON' };
  await page.route('**/api/v1/forms', route => route.fulfill({ json: { items: [{ ref, formCode: definition.formCode, name: definition.name, scope: 'USER_COMMON' }], observedAt: new Date().toISOString(), nextCursor: null, hasMore: false, baselineVersion: null } }));
  await page.route('**/api/v1/forms/' + ref.id + '/versions/1', route => route.fulfill({ json: { ref, definition, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, contentReviewCriteria: { criteriaVersion: 1, items: criteria }, contentReviews: reviews, confirmation,
    validation: { formatOnly: true, contentReview: reviews.length ? 'RECORDED' : 'NOT_PERFORMED', userAcceptance: confirmation ? 'CONFIRMED' : 'NOT_PERFORMED' } } }));
  await page.route('**/api/v1/user-common/commands', async route => {
    const body = route.request().postDataJSON(); writes.push(body);
    if (body.operation === 'recordContentReview') reviews = [{ ref: reviewRef, items: body.payload.items, reviewer: { kind: 'HUMAN', userId: catalog.forms[0]!.ref.id, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: body.payload.reason, reviewedAt: new Date().toISOString(), serverSequence: 1 }];
    else confirmation = { id: 'a6f30000-0000-4000-8000-000000000077', decidedBy: catalog.forms[0]!.ref.id, decidedAt: new Date().toISOString(), reviewRefs: [reviewRef] };
    await route.fulfill({ json: { scopeKind: 'USER_COMMON', ownerUserId: catalog.forms[0]!.ref.id, operationId: 'a6f30000-0000-4000-8000-000000000066', commandId: body.commandId, status: 'APPLIED', targetId: ref.id, version: 1,
      data: { ref, status: body.operation === 'recordContentReview' ? 'REVIEW_RECORDED' : 'CONFIRMED', ...(body.operation === 'recordContentReview' ? { reviewRef } : { confirmationId: confirmation.id }) }, serverReceivedAt: new Date().toISOString() } });
  });
  await page.goto('/#/methodologies');
  await expect(page.getByRole('button', { name: '이 양식 내용 검토 시작', exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '이 양식 내용 검토 시작', exact: true }).click();
  for (const criterion of criteria) { await page.getByLabel(criterion.criterionId + ' 판정', { exact: true }).selectOption('ACCEPTED'); await page.getByLabel(criterion.criterionId + ' 검토 이유', { exact: true }).fill('본문을 직접 읽고 기준을 확인함'); }
  await page.getByLabel('내용 검토 종합 판정', { exact: true }).selectOption('ACCEPTED');
  await page.getByLabel('내용 검토 종합 이유', { exact: true }).fill('직접 확인한 내용으로 기록한다');
  await page.getByRole('button', { name: '내용 검토 기록', exact: true }).click();
  await expect(page.getByText('서버 내용 검토 기록 확인', { exact: true })).toBeVisible(); expect(writes).toHaveLength(1);
  const verdictBox = await page.getByLabel('FORM_PURPOSE 판정', { exact: true }).boundingBox();
  const reasonBox = await page.getByLabel('FORM_PURPOSE 검토 이유', { exact: true }).boundingBox();
  expect(verdictBox).not.toBeNull(); expect(reasonBox).not.toBeNull();
  expect(reasonBox!.y).toBeGreaterThanOrEqual(verdictBox!.y + verdictBox!.height);
  await expect(page.getByText('작성 기록자와 같은 사용자 · 독립 검수 아님', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이 양식 버전 확정', exact: true }).click();
  await expect(page.getByText('현재 버전 사용자 확정 이력 있음 · 실행 승인은 별도', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[1].payload.reviewRefs).toEqual([reviewRef]); expect(writes[1].expectedVersion).toBe(1);
  if (process.env.ANVIL_CAPTURE_UI === '1') await page.screenshot({ path: test.info().outputPath('form-review-final.png'), fullPage: true });
});
