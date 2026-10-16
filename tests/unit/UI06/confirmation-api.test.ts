import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { prepareDocumentConfirmation, sendDocumentConfirmation, type DocumentConfirmationBuffer } from '../../../apps/web/src/features/design-trace/confirmation-api.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1', ref = { id, version: 2, contentHash: 'a'.repeat(64) };
const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) };
function buffer(): DocumentConfirmationBuffer { return { ownerUserId: id, projectId: project, title: '명시 확정', ref, formRef: ref, reviewRefs: [{ id, criteriaVersion: 1, targetRef: ref, outcome: 'ACCEPTED' }], controlGeneration: 4, acknowledged: true, pending: null, saved: false, failure: null }; }
test('별도 확인·현재 주체·정확 대상/세대가 없는 확정이나 중단 화면은 요청하지 않는다', async () => {
  const b = buffer(); b.pending = prepareDocumentConfirmation(b, session); let calls = 0;
  const client = new ApiClient(async () => { calls++; throw Error('unexpected request'); });
  assert.throws(() => prepareDocumentConfirmation({ ...b, acknowledged: false }, session), ApiError);
  for (const modified of [{ ...b, ownerUserId: project }, { ...b, pending: { ...b.pending, operation: 'executeAgent' } }, { ...b, pending: { ...b.pending, clientId: project } }, { ...b, pending: { ...b.pending, controlGeneration: 5 } }, { ...b, reviewRefs: [{ ...b.reviewRefs[0]!, outcome: 'REWORK' }] }]) await assert.rejects(sendDocumentConfirmation(client, modified as DocumentConfirmationBuffer, session, () => true), ApiError);
  await assert.rejects(sendDocumentConfirmation(client, b, session, () => false), ApiError); assert.equal(calls, 0);
});
test('확정 성공 응답도 다른 문서/hash/명령이면 실제 저장 확인으로 승격하지 않는다', async () => {
  const b = buffer(); b.pending = prepareDocumentConfirmation(b, session);
  const valid = { operationId: id, commandId: b.pending.commandId, projectId: project, targetId: id, version: 2, status: 'APPLIED', data: { status: 'CONFIRMED', ref, confirmationId: id }, serverReceivedAt: '2026-10-16T05:00:00Z' };
  for (const v of [{ ...valid, commandId: project }, { ...valid, targetId: project }, { ...valid, data: { ...valid.data, ref: { ...ref, contentHash: 'b'.repeat(64) } } }, { ...valid, data: { ...valid.data, status: 'REVIEW_RECORDED' } }]) await assert.rejects(sendDocumentConfirmation(new ApiClient(async () => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } })), b, session, () => true), (e: unknown) => e instanceof ApiError && e.code === 'RESPONSE_INVALID');
  assert.deepEqual(await sendDocumentConfirmation(new ApiClient(async () => new Response(JSON.stringify(valid), { headers: { 'content-type': 'application/json' } })), b, session, () => true), { ref, confirmationId: id });
});
