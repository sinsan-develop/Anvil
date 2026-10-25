import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import type { MethodVersion } from '../../../apps/web/src/features/methodology-editor/api.ts';
import { emptyMethodBuffer, type MethodGateway } from '../../../apps/web/src/features/methodology-editor/common-api.ts';
import { emptyFormBuffer } from '../../../apps/web/src/features/methodologies/form-editor-state.ts';
import type { FormVersion } from '../../../apps/web/src/features/methodologies/forms-api.ts';

const compiler = await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), configLoader: 'runner', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
after(async () => { await compiler.close(); });
const { MethodReviewPanel } = await compiler.ssrLoadModule('/src/features/methodology-editor/MethodReviewPanel.tsx');
const { FormReviewPanel } = await compiler.ssrLoadModule('/src/features/methodologies/FormReviewPanel.tsx');
const userId = '11111111-1111-4111-8111-111111111111';
const ref = { id: '22222222-2222-4222-8222-222222222222', version: 3, contentHash: 'a'.repeat(64) };
type Review = NonNullable<FormVersion['contentReviews']>[number];
function review(id = '33333333-3333-4333-8333-333333333333'): Review {
  return { ref: { id, criteriaVersion: 1, targetRef: ref, outcome: 'REWORK' }, items: [{ criterionId: 'OLD-01', outcome: 'REWORK', reason: '과거 기준의 저장된 항목 이유', evidenceRefs: [] }],
    reviewer: { kind: 'HUMAN', userId, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: '저장된 종합 이유', reviewedAt: '2026-10-20T01:02:03Z', serverSequence: 1 };
}
function sources(reviews: Review[]) {
  const common = { ref, contentReviewCriteria: { criteriaVersion: 2, items: [{ criterionId: 'OLD-01', title: '현재 기준 제목을 과거에 붙이지 말 것' }] }, contentReviews: reviews };
  const method: MethodVersion = { ...common, name: '방법론', purpose: '목적', scope: 'USER_COMMON', systemCode: null, graph: { nodes: [], edges: [], entryNodeId: '', terminalNodeIds: [] }, confirmation: null, validation: { validForConfirmation: false, issues: [] }, runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
  const form: FormVersion = { ...common, definition: { name: '양식', formCode: 'FORM-01', purpose: '목적', scope: 'USER_COMMON', authorRole: '작성자', reviewerRole: '검토자', confirmerRole: '사용자', requiredInputs: [], items: [], authoringStandardRef: ref },
    authoringStandard: { ref, content: '작성 기준' }, validation: { formatOnly: true, contentReview: 'RECORDED', userAcceptance: 'NOT_PERFORMED' }, confirmation: null };
  return { method, form };
}
const gateway: MethodGateway = { prepare: async () => { throw Error('렌더 중 준비 금지'); }, write: async () => { throw Error('렌더 중 쓰기 금지'); }, read: async () => { throw Error('렌더 중 조회 금지'); } };
for (const kind of ['method', 'project', 'form'] as const) {
  function render(reviews: Review[], configure?: (buffer: ReturnType<typeof emptyMethodBuffer> | ReturnType<typeof emptyFormBuffer>) => void) {
    const source = sources(reviews), buffer = kind === 'form' ? emptyFormBuffer() : emptyMethodBuffer();
    configure?.(buffer);
    let calls = 0;
    const props = { client: new ApiClient(async () => { calls++; throw Error('렌더 중 API 금지'); }), session: { user: { id: userId }, clientId: '44444444-4444-4444-8444-444444444444', csrfToken: 'c'.repeat(43) }, buffer,
      onChange: () => { calls++; }, onVerified: () => { calls++; }, onAuthenticationLost: () => { calls++; } };
    if (kind === 'project') source.method.scope = 'PROJECT';
    const snapshot = JSON.stringify({ source, buffer });
    const html = renderToStaticMarkup(createElement(kind === 'form' ? FormReviewPanel : MethodReviewPanel, { ...props, source: kind === 'form' ? source.form : source.method, ...(kind === 'project' ? { gateway } : {}) }));
    assert.equal(JSON.stringify({ source, buffer }), snapshot); assert.equal(calls, 0);
    return html;
  }
  test(`${kind}: 저장 검토마다 기본 접힌 항목별 판정·이유와 빈 증거 참조 상태를 읽는다`, () => {
    const first = review(), second = review('55555555-5555-4555-8555-555555555555'); second.items[0]!.reason = '두 번째 검토의 별도 이유'; second.reviewer.sameAsTargetRecorder = false; second.ref.criteriaVersion = 2;
    first.items.push({ criterionId: 'OLD-02', outcome: 'ACCEPTED', evidenceRefs: [], reason: '저장된 적합 판단 근거' });
    const html = render([first, second]);
    const details = [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)]; assert.equal(details.length, 2);
    for (const [index, entry] of details.entries()) {
      assert.doesNotMatch(entry[1]!, /\bopen(?:=|\s|$)/);
      assert.match(entry[2]!, /<summary\b/); assert.ok(entry[1]!.includes([first, second][index]!.ref.id));
      for (const text of ['OLD-01', '보완 필요', '등록된 증거 참조 없음', [first, second][index]!.items[0]!.reason]) assert.ok(entry[2]!.includes(text), text);
      assert.equal(entry[2]!.includes('현재 기준 제목을 과거에 붙이지 말 것'), false);
    }
    assert.equal(details[0]![2]!.includes(second.items[0]!.reason), false); assert.equal(details[1]![2]!.includes(first.items[0]!.reason), false);
    assert.ok(details[0]![2]!.includes('적합')); assert.ok(details[0]![2]!.includes('저장된 적합 판단 근거'));
    assert.ok(html.includes('작성 기록자와 같은 사용자 · 독립 검수 아님')); assert.ok(html.includes('작성 기록자와 다른 사용자')); assert.ok(html.includes('저장된 종합 이유'));
  });
  test(`${kind}: 미검토와 알 수 없는 판정을 적합으로 승격하지 않는다`, () => {
    const value = review(); value.items = [{ criterionId: 'WAIT-01', outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '아직 판단하지 않음' }, { criterionId: 'UNKNOWN-01', outcome: '__proto__' as Review['items'][number]['outcome'], evidenceRefs: [], reason: '알 수 없는 값' }];
    const html = render([value]), detail = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/)?.[1];
    assert.ok(detail); assert.ok(detail.includes('미검토')); assert.ok(detail.includes('알 수 없는 판정')); assert.equal(detail.includes('적합'), false);
  });
  test(`${kind}: HTML·긴 다중행 이유를 실행·절단하지 않고 빈 정보도 드러낸다`, () => {
    const value = review(), reason = '<img src=x onerror=alert(1)>\n' + '긴원문'.repeat(1000) + '\n마지막 원문';
    value.items = [{ criterionId: '<script>항목</script>', outcome: 'BLOCKED', evidenceRefs: [], reason }, { criterionId: '', outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '' }];
    const html = render([value]); assert.ok(html.includes('&lt;script&gt;항목&lt;/script&gt;')); assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;\n' + '긴원문'.repeat(1000) + '\n마지막 원문'));
    assert.doesNotMatch(html, /<(script|img|a)\b/); assert.ok(html.includes('항목 ID 없음')); assert.ok(html.includes('저장된 이유 없음'));
    assert.ok(html.includes('white-space:pre-wrap')); assert.ok(html.includes('overflow-wrap:anywhere'));
    value.items = []; assert.ok(render([value]).includes('저장된 항목별 검토 정보 없음')); assert.doesNotMatch(render([]), /<details\b/);
  });
  test(`${kind}: 다른 사용자 입력은 노출하지 않고 미저장 검토·확정 잠금을 유지한다`, () => {
    assert.equal(render([review()], buffer => { buffer.ownerUserId = '66666666-6666-4666-8666-666666666666'; }), '');
    const html = render([review()], buffer => { buffer.ownerUserId = userId; buffer.review = { ref, criteriaVersion: 2, criteria: [{ criterionId: 'OLD-01', title: '미저장 검토 기준' }], items: [{ criterionId: 'OLD-01', outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '미저장 항목 이유' }], outcome: 'NOT_EXECUTED', reason: '미저장 종합 이유', dirty: true, pending: null }; });
    assert.ok(html.includes('미저장 항목 이유')); assert.ok(html.includes('미저장 종합 이유'));
    assert.match(html, /<button disabled="">이 (방법론|양식) 버전 확정<\/button>/);
  });
  test(`${kind}: 손상된 항목 배열·null·primitive·필드는 내용을 합성하지 않고 확인 불가로 남긴다`, () => {
    const valid = review().items[0]!;
    for (const items of [null, 'malformed-items', 7, {}, [null], ['primitive-item'], [7], [{ ...valid, reason: null }], [{ ...valid, criterionId: null }], [{ ...valid, evidenceRefs: null }], [{ ...valid, evidenceRefs: 'bad' }], [{ ...valid, outcome: null }]]) {
      const value = review(); (value as any).items = items;
      const html = render([value]);
      assert.ok(html.includes('저장된 항목 정보 확인 불가'));
      assert.equal(html.includes('과거 기준의 저장된 항목 이유'), false); assert.equal(html.includes('저장된 항목별 검토 정보 없음'), false);
      assert.ok(html.includes('저장된 종합 이유'));
    }
    const mixed = review(); (mixed as any).items = [valid, null];
    const html = render([mixed]); assert.ok(html.includes(valid.reason)); assert.ok(html.includes('저장된 항목 정보 확인 불가'));
  });
}
test('form: 확정 상세는 저장 당시 참조와 원 결정을 보이고 미확정이면 숨긴다', () => {
  const source = sources([]).form;
  const older = { id: '66666666-6666-4666-8666-666666666666', criteriaVersion: 1, targetRef: { ...ref }, outcome: 'ACCEPTED' as const };
  const newest = { id: '77777777-7777-4777-8777-777777777777', criteriaVersion: 2, targetRef: { ...ref }, outcome: 'ACCEPTED' as const };
  source.contentReviews = [review(newest.id)]; source.contentReviews[0]!.ref = newest;
  const savedConfirmation = { id: '88888888-8888-4888-8888-888888888888', decidedBy: userId, decidedAt: '2026-10-20T01:02:03.123456Z', reviewRefs: [older] };
  source.confirmation = savedConfirmation;
  source.validation.userAcceptance = 'CONFIRMED';
  const buffer = emptyFormBuffer(); let calls = 0;
  const props = { client: new ApiClient(async () => { calls++; throw Error('SSR 렌더 중 API 호출 금지'); }),
    session: { user: { id: userId }, clientId: '44444444-4444-4444-8444-444444444444', csrfToken: 'c'.repeat(43) }, buffer,
    onChange: () => { calls++; }, onVerified: () => { calls++; }, onAuthenticationLost: () => { calls++; } };
  const html = renderToStaticMarkup(createElement(FormReviewPanel, { ...props, source }));
  assert.equal(calls, 0, 'SSR 렌더 중 API 호출 없음');
  const details = [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)];
  const confirmation = details.find(entry => entry[1]!.includes('aria-label="저장된 사용자 확정 기록"'));
  assert.ok(confirmation, '저장된 확정 기록 상세가 표시됨');
  assert.doesNotMatch(confirmation[1]!, /\bopen(?:=|\s|$)/);
  const fullRef = `${ref.id} · v${ref.version} · ${ref.contentHash}`;
  for (const value of [savedConfirmation.id, userId, savedConfirmation.decidedAt, fullRef,
    older.id, fullRef, '기준 버전 1', '적합']) assert.ok(confirmation[2]!.includes(value), value);
  assert.equal(confirmation[2]!.includes(newest.id), false, '확정 근거를 최신 검토에서 다시 만들지 않음');
  assert.equal(confirmation[2]!.includes('현재 기준 제목을 과거에 붙이지 말 것'), false);
  assert.ok(html.includes('이 확정 이력은 현재 실행 권한이나 Agent 허가를 부여하지 않습니다'));

  const unsafe = sources([]).form; unsafe.confirmation = { ...savedConfirmation, decidedBy: '<img src=x onerror=window.CONFIRMATION_XSS=1>' };
  unsafe.validation.userAcceptance = 'CONFIRMED';
  const escaped = renderToStaticMarkup(createElement(FormReviewPanel, { ...props, source: unsafe }));
  assert.ok(escaped.includes('&lt;img src=x onerror=window.CONFIRMATION_XSS=1&gt;'));
  assert.doesNotMatch(escaped, /<img\b/);

  const unconfirmed = sources([]).form;
  const unconfirmedHtml = renderToStaticMarkup(createElement(FormReviewPanel, { ...props, source: unconfirmed }));
  assert.doesNotMatch(unconfirmedHtml, /aria-label="저장된 사용자 확정 기록"/);
});
