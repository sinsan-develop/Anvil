import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { prepareDocumentReview, retireRejectedDocumentReview, sendDocumentReview, type DocumentReviewBuffer } from '../../../apps/web/src/features/design-trace/review-api.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1';
const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) };
function buffer(): DocumentReviewBuffer { return { ownerUserId: id, projectId: project, title: '검토 문서', ref: { id, version: 2, contentHash: 'a'.repeat(64) }, controlGeneration: 4, criteria: [{ criterionId: 'REQ', title: '요구', reviewCriteria: ['원문과 대조'] }], items: [{ criterionId: 'REQ', outcome: 'REWORK', evidenceRefs: [], reason: '누락 확인' }], outcome: 'REWORK', reason: '보완 필요', dirty: true, pending: null, saved: false, failure: null }; }
test('다른 사용자/세대/연산 또는 중단된 화면의 검토는 네트워크 요청 전에 거절한다', async () => {
  const b = buffer(); b.pending = prepareDocumentReview(b, session); let calls = 0;
  const client = new ApiClient(async () => { calls++; throw Error('unexpected request'); });
  for (const modified of [{ ...b, ownerUserId: project }, { ...b, pending: { ...b.pending, operation: 'executeAgent' } }, { ...b, pending: { ...b.pending, controlGeneration: 5 } }, { ...b, pending: { ...b.pending, clientId: project } }, { ...b, pending: { ...b.pending, payload: { ...b.pending.payload, targetRef: { ...b.ref, contentHash: 'b'.repeat(64) } } } }]) {
    await assert.rejects(sendDocumentReview(client, modified as DocumentReviewBuffer, session, () => true), ApiError);
  }
  await assert.rejects(sendDocumentReview(client, b, session, () => false), (e: unknown) => e instanceof ApiError && e.code === 'REVIEW_CONTINUATION_PAUSED'); assert.equal(calls, 0);
  assert.throws(() => prepareDocumentReview({ ...b, outcome: 'ACCEPTED' }, session), (e: unknown) => e instanceof ApiError && e.code === 'REVIEW_INCOMPLETE');
});
test('성공 응답도 다른 문서/hash/판단/명령의 결과이면 저장 확인으로 승격하지 않는다', async () => {
  const b = buffer(); b.pending = prepareDocumentReview(b, session); const c = b.pending;
  const valid = { operationId: id, commandId: c.commandId, projectId: project, targetId: id, version: 2, status: 'APPLIED', data: { status: 'REVIEW_RECORDED', reviewRef: { id, criteriaVersion: 1, targetRef: b.ref, outcome: 'REWORK' } }, serverReceivedAt: '2026-10-16T05:00:00Z' };
  for (const response of [{ ...valid, commandId: project }, { ...valid, projectId: id }, { ...valid, data: { ...valid.data, reviewRef: { ...valid.data.reviewRef, targetRef: { ...b.ref, contentHash: 'b'.repeat(64) } } } }, { ...valid, data: { ...valid.data, reviewRef: { ...valid.data.reviewRef, outcome: 'ACCEPTED' } } }]) {
    await assert.rejects(sendDocumentReview(new ApiClient(async () => new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } })), b, session, () => true), (e: unknown) => e instanceof ApiError && e.code === 'RESPONSE_INVALID');
  }
  const result = await sendDocumentReview(new ApiClient(async () => new Response(JSON.stringify(valid), { headers: { 'content-type': 'application/json' } })), b, session, () => true);
  assert.deepEqual(result.targetRef, b.ref); assert.equal(result.outcome, 'REWORK');
});

test('검토의 명확한 거절 보관은 원래 명령·판단을 보존하고 미확인·다른 주체를 허용하지 않는다', () => {
  const b=buffer(); b.pending=prepareDocumentReview(b,session); b.failure={code:'VERSION_CONFLICT',status:409};
  const next=retireRejectedDocumentReview(b,session); assert.equal(next.pending,null); assert.deepEqual(next.rejectedAttempts?.[0]?.command,b.pending); assert.equal(b.pending.expectedVersion,2); assert.deepEqual(next.items,b.items);
  for(const bad of [{...b,uncertain:true},{...b,failure:{code:'RESPONSE_INVALID',status:409}},{...b,ownerUserId:project},{...b,pending:{...b.pending,clientId:project}}]) assert.throws(()=>retireRejectedDocumentReview(bad,session),ApiError);
});
