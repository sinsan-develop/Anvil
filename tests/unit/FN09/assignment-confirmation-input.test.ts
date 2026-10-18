import assert from 'node:assert/strict';
import test from 'node:test';
const module: any = await import('../../../apps/server/modules/assignments/assignment-confirmation-input.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const review = (value: unknown) => { assert.equal(typeof module.readAssignmentContentReview, 'function'); return module.readAssignmentContentReview(value); };
const confirm = (value: unknown) => { assert.equal(typeof module.readAssignmentConfirmation, 'function'); return module.readAssignmentConfirmation(value); };
const ref = { id: '11111111-1111-4111-8111-111111111111', version: 1, contentHash: 'a'.repeat(64) };
const criteria = ['PURPOSE_SCOPE', 'BASELINE_TASK', 'INPUT_OUTPUT', 'COMPLETION_VERIFICATION', 'BOUNDARIES', 'RECORD_RECOVERY'];
const sample = () => ({ draftRef: { ...ref }, criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, outcome: 'ACCEPTED', reason: '내용과 미확인 경계를 검토', evidenceRefs: [] })), outcome: 'ACCEPTED', reason: '내용 검토·실행 미승인' });

test('6개 사람 판단을 그대로 복제하고 기본 적합·실행 허가를 합성하지 않는다', () => {
  const value = sample(), result = review(value); assert.deepEqual(result, value);
  value.items[0]!.reason = '나중 변경'; assert.equal(result.items[0]!.reason, '내용과 미확인 경계를 검토');
  assert.equal((result as any).ready, undefined); assert.equal((result as any).executionAuthorized, undefined);
});
test('누락·중복·다른 기준·증거 종류·부분 부적합의 종합 적합을 거절한다', () => {
  for (const change of [(v: any) => v.items.pop(), (v: any) => { v.items[5] = v.items[0]; }, (v: any) => { v.items[0].criterionId = 'OTHER'; }, (v: any) => { v.items[0].evidenceRefs = [ref]; }, (v: any) => { v.items[1].outcome = 'REWORK'; }, (v: any) => { delete v.items[0].outcome; }, (v: any) => { v.outcome = ['ACCEPTED']; }, (v: any) => { v.items[0].outcome = ['ACCEPTED']; }]) {
    const value = sample(); change(value); assert.throws(() => review(value), /ASSIGNMENT_REVIEW_INPUT_INVALID/);
  }
  const blocked = sample(); blocked.items[0]!.outcome = 'NOT_EXECUTED'; blocked.outcome = 'BLOCKED'; assert.equal(review(blocked).outcome, 'BLOCKED');
});
test('공백 이유·비정상 Unicode·초과 이유·unknown키·getter·의심 비밀을 보존 없이 거절한다', () => {
  for (const change of [(v: any) => { v.reason = ' '; }, (v: any) => { v.items[1].reason = ''; }, (v: any) => { v.reason = '\uD800'; }, (v: any) => { v.reason = 'x'.repeat(20001); }, (v: any) => { v.ready = true; }]) {
    const value = sample(); change(value); assert.throws(() => review(value), /ASSIGNMENT_REVIEW_INPUT_INVALID/);
  }
  const value = sample(); let called = 0; Object.defineProperty(value, 'reason', { enumerable: true, get() { called++; return '위장'; } });
  assert.throws(() => review(value), /ASSIGNMENT_REVIEW_INPUT_INVALID/); assert.equal(called, 0);
  const secret = sample(); secret.reason = 'api_key=DO_NOT_ECHO'; assert.throws(() => review(secret), /ASSIGNMENT_SENSITIVE_CONTENT_SUSPECTED/);
});
test('별도 확정은 정확 초안·실제 검토ref 한 건·명시적 확인과 이유만 허용한다', () => {
  const value = { draftRef: ref, reviewRefs: [{ ...ref, id: '22222222-2222-4222-8222-222222222222' }], reason: '내용만 확정', acknowledged: true };
  assert.deepEqual(confirm(value), value);
  for (const change of [(v: any) => { v.acknowledged = false; }, (v: any) => { v.reviewRefs = []; }, (v: any) => { v.reviewRefs.push(v.reviewRefs[0]); }, (v: any) => { v.draftRef.contentHash = 'wrong'; }, (v: any) => { v.reason = ''; }, (v: any) => { v.executionAuthorized = true; }]) {
    const changed = structuredClone(value); change(changed); assert.throws(() => confirm(changed), /ASSIGNMENT_CONFIRMATION_INPUT_INVALID/);
  }
});
