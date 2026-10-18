import assert from 'node:assert/strict';
import test from 'node:test';
const module = await import('../../../apps/server/modules/projects/baseline-decision-input.ts').catch((error: NodeJS.ErrnoException) => {
 if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error;
});
const read = (value: unknown) => { assert.equal(typeof (module as any).readBaselineContentReview, 'function'); return (module as any).readBaselineContentReview(value); };
const confirm = (value: unknown) => { assert.equal(typeof (module as any).readBaselineConfirmation, 'function'); return (module as any).readBaselineConfirmation(value); };
const id = '11111111-1111-4111-8111-111111111111', ref = { id, version: 2, contentHash: 'a'.repeat(64) };
const artifact = () => ({ artifactId: id, bytes: 42, contentHash: 'b'.repeat(64), mediaType: 'text/plain;charset=utf-8' });
const sample = (): any => ({ draftRef: { ...ref }, criteriaVersion: 1, reviewerKind: 'HUMAN',
 items: [{ itemId: 'FN01', featureState: 'IMPLEMENTED_CORE_CHECKED', outcome: 'ACCEPTED', reason: '원문을 확인하고 분류를 검토함', evidenceRefs: [artifact()],
 coreEvidence: { basis: 'ACTUAL', environment: 'WSL 개발 환경·정확 후보 버전은 첨부 근거 참조', checkedAt: '2026-10-18T07:21:31.000Z', normalFlow: [artifact()], storageRead: [artifact()], importantFailure: [artifact()] } }],
 coverage: { outcome: 'ACCEPTED', reason: '현재 합의 기능과 대조한 검토 범위' }, outcome: 'ACCEPTED', reason: '분류 내용 검토이며 source 실행 허가는 아님' });

test('내용 검토는 정확 draft/항목/실제 근거 분류를 격리 보존하고 확정·실행 필드를 만들지 않는다', () => {
 const value = sample(), before = structuredClone(value), result = read(value);
 assert.deepEqual(result, before); assert.deepEqual(value, before); value.items[0].coreEvidence.environment = '이후변경';
 assert.equal(result.items[0].coreEvidence.environment, before.items[0].coreEvidence.environment);
 for (const key of ['contentConfirmed', 'executionAuthorized', 'sourceAuthorizationVerified']) assert.equal(Object.hasOwn(result, key), false);
 for (const featureState of ['IMPLEMENTED_UNCHECKED', 'PARTIAL', 'NOT_IMPLEMENTED']) {
  const unverified = sample(); unverified.items[0].featureState = featureState; unverified.items[0].coreEvidence = null;
  unverified.items[0].evidenceRefs = []; assert.deepEqual(read(unverified), unverified);
 }
});
test('CORE 합격은 mock/static·미실행·빈 중요실패 근거·다른 첨부를 실제 합격으로 채택하지 않는다', () => {
 for (const mutate of [
  (v: any) => { v.items[0].coreEvidence = null; },
  ...['MOCK', 'STATIC', 'NOT_EXECUTED', 'UNKNOWN'].map(basis => (v: any) => { v.items[0].coreEvidence.basis = basis; }),
  ...['normalFlow', 'storageRead', 'importantFailure'].map(key => (v: any) => { v.items[0].coreEvidence[key] = []; }),
  (v: any) => { v.items[0].coreEvidence.normalFlow[0].contentHash = 'c'.repeat(64); },
  (v: any) => { v.items[0].coreEvidence.checkedAt = '2026-02-30T00:00:00.000Z'; },
  (v: any) => { v.items[0].coreEvidence.environment = ''; },
 ]) { const value = sample(); mutate(value); assert.throws(() => read(value), /BASELINE_REVIEW_INPUT_INVALID/); }
 const rejected = sample(); rejected.items[0].coreEvidence.basis = 'STATIC'; rejected.items[0].outcome = 'REWORK'; rejected.outcome = 'REWORK';
 assert.equal(read(rejected).items[0].coreEvidence.basis, 'STATIC');
});
test('배열형 featureState가 문자열로 변환되어 CORE 합격 근거를 우회하지 못한다', () => {
 const state = sample(); state.items[0].featureState = ['IMPLEMENTED_CORE_CHECKED']; state.items[0].evidenceRefs = []; state.items[0].coreEvidence = null;
 assert.throws(() => read(state), /BASELINE_REVIEW_INPUT_INVALID/);
});
test('배열형 basis를 실제 동작 근거의 문자열 분류로 소비하지 않는다', () => {
 const basis = sample(); basis.items[0].featureState = 'PARTIAL'; basis.items[0].coreEvidence.basis = ['ACTUAL'];
 assert.throws(() => read(basis), /BASELINE_REVIEW_INPUT_INVALID/);
});
test('전체 합격 위장·중복항목/첨부·다른 주체·잘못된 버전·추가키를 거절하고 미실행 검토는 보존한다', () => {
 for (const mutate of [
  (v: any) => { v.items[0].outcome = 'REWORK'; }, (v: any) => { v.coverage.outcome = 'NOT_EXECUTED'; },
  (v: any) => { v.reviewerKind = 'AGENT'; }, (v: any) => { v.items = []; },
  (v: any) => { v.items.push(structuredClone(v.items[0])); }, (v: any) => { v.items[0].evidenceRefs.push(artifact()); },
  (v: any) => { v.items[0].coreEvidence.storageRead.push(artifact()); },
  (v: any) => { v.draftRef = { ...ref, version: 0 }; }, (v: any) => { v.criteriaVersion = 2; },
  (v: any) => { v.confirmed = true; }, (v: any) => { v.items[0].featureState = 'DONE'; },
  (v: any) => { v.items[0].evidenceRefs[0].bytes = 20 * 1024 * 1024 + 1; },
 ]) { const value = sample(); mutate(value); assert.throws(() => read(value), /BASELINE_REVIEW_INPUT_INVALID/); }
 const unexecuted = sample(); unexecuted.outcome = 'NOT_EXECUTED'; unexecuted.items[0].outcome = 'NOT_EXECUTED'; unexecuted.items[0].coreEvidence = null;
 assert.deepEqual(read(unexecuted), unexecuted);
});
test('별도 채택은 정확 draft/검토 refs·명시 acknowledged를 요구하고 원본을 수정하지 않는다', () => {
 const value = { draftRef: ref, reviewRefs: [{ ...ref, id: '22222222-2222-4222-8222-222222222222' }], reason: '검토한 기능 상태 기준선만 별도 채택', acknowledged: true };
 const result = confirm(value); assert.deepEqual(result, value); assert.notEqual(result.reviewRefs, value.reviewRefs);
 for (const bad of [{ ...value, acknowledged: false }, { ...value, reviewRefs: [] }, { ...value, reviewRefs: [ref, ref] }, { ...value, draftRef: id }, { ...value, executionAuthorized: true }, { ...value, reason: '' }]) assert.throws(() => confirm(bad), /BASELINE_CONFIRMATION_INPUT_INVALID/);
});
test('검토/채택은 getter·순환/2MiB 초과·민감표식을 반향 없이 거절한다', () => {
 let called = 0; const getter = sample(); Object.defineProperty(getter, 'reason', { enumerable: true, get() { called++; return '위장'; } });
 assert.throws(() => read(getter), /BASELINE_REVIEW_INPUT_INVALID/); assert.equal(called, 0);
 const cycle = sample(); cycle.reason = cycle; assert.throws(() => read(cycle), /BASELINE_REVIEW_INPUT_INVALID/);
 const many = sample(); many.items = Array.from({ length: 200 }, (_, i) => ({ ...structuredClone(many.items[0]), itemId: String(i), reason: '한'.repeat(4000) }));
 assert.throws(() => read(many), /BASELINE_REVIEW_INPUT_INVALID/);
 const secret = sample(); secret.reason = 'token=SYNTHETIC_NOT_REAL'; assert.throws(() => read(secret), { message: 'BASELINE_SENSITIVE_CONTENT_SUSPECTED' });
 assert.throws(() => confirm({ draftRef: ref, reviewRefs: [ref], acknowledged: true, reason: 'token=SYNTHETIC_NOT_REAL' }), { message: 'BASELINE_SENSITIVE_CONTENT_SUSPECTED' });
});
