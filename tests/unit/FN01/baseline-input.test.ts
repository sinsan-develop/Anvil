import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../../../apps/server/modules/projects/baseline-input.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const read = (value: unknown) => {
  assert.equal(typeof (module as any).readBaselineDraftInput, 'function', '기준선 초안 입력 검사가 필요하다');
  return (module as any).readBaselineDraftInput(value);
};
const id = '11111111-1111-4111-8111-111111111111';
const ref = { id, version: 1, contentHash: 'a'.repeat(64) };
const evidence = () => ({ artifactId: id, bytes: 12, contentHash: 'b'.repeat(64), mediaType: 'image/png' });
const sample = (): any => ({
  baseRef: null,
  source: { kind: 'NONE_SELECTED', declarationRef: null, sourceRootRef: null, snapshotRef: null, grantRef: null, unverifiedReason: '아직 소스를 선택하지 않음' },
  items: [{ itemId: '기능-01', title: '요구사항 작성', designRef: null, featureState: 'NOT_IMPLEMENTED', evidenceRefs: [], limitations: '실제 기능은 미구현', reason: '현재 상태를 분리 기록' }],
  coverageReason: '전체 기능 포함 여부는 사용자 검토 전', reason: '시작 기준선 후보 작성',
});

test('기준선 초안의 네 기능 상태와 원입력 순서를 보존하지만 내용·source·범위·실행은 확정하지 않는다', () => {
  for (const state of ['IMPLEMENTED_CORE_CHECKED', 'IMPLEMENTED_UNCHECKED', 'PARTIAL', 'NOT_IMPLEMENTED']) {
    const value = sample(); value.items[0].featureState = state; value.items[0].evidenceRefs = [evidence()];
    const before = structuredClone(value), result = read(value);
    assert.deepEqual(value, before); assert.deepEqual(result.input, before);
    for (const flag of ['contentConfirmed', 'sourceAuthorizationVerified', 'coverageVerified', 'executionAuthorized', 'dispatchPerformed']) assert.equal(result[flag], false, flag);
    for (const code of ['CONTENT_REVIEW_REQUIRED', 'SOURCE_UNVERIFIED', 'COVERAGE_UNVERIFIED', 'EXECUTION_NOT_CONNECTED']) assert(result.issues.some((issue: any) => issue.code === code), code);
    value.items[0].reason = '나중에 수정'; value.items[0].evidenceRefs[0].bytes = 77;
    assert.equal(result.input.items[0].reason, before.items[0].reason); assert.equal(result.input.items[0].evidenceRefs[0].bytes, 12);
  }
  const value = sample(); value.items.push({ ...structuredClone(value.items[0]), itemId: '1' }, { ...structuredClone(value.items[0]), itemId: id });
  assert.deepEqual(read(value).input.items.map((item: any) => item.itemId), ['기능-01', '1', id]);
});
test('source 선언/속성보고는 nullable와 정확한 버전 참조를 보존하고 보고를 실제 소스 검증으로 올리지 않는다', () => {
  const declaration = sample(); declaration.baseRef = { ...ref, version: 7 };
  declaration.source = { ...declaration.source, kind: 'DECLARATION_ONLY', declarationRef: { ...ref } };
  assert.deepEqual(read(declaration).input, declaration);
  for (const declarationRef of [null, { ...ref }]) {
    const value = sample(); value.source = { ...value.source, kind: 'ATTRIBUTE_REPORT', declarationRef, sourceRootRef: { ...ref, version: 3 }, snapshotRef: { ...ref }, grantRef: { ...ref } };
    const result = read(value); assert.deepEqual(result.input.source, value.source); assert.equal(result.sourceAuthorizationVerified, false);
  }
});
test('근거 없는 CORE_CHECKED·누락/위장 키·잘못된 source/ref와 상태를 거절한다', () => {
  const mutations = [
    (v: any) => { v.items[0].featureState = 'IMPLEMENTED_CORE_CHECKED'; },
    (v: any) => { v.verified = true; }, (v: any) => { v.items[0].verified = true; },
    (v: any) => { delete v.source.snapshotRef; }, (v: any) => { v.source.kind = 'VERIFIED'; },
    (v: any) => { v.source.declarationRef = ref; },
    (v: any) => { v.source.kind = 'DECLARATION_ONLY'; },
    (v: any) => { v.source.kind = 'DECLARATION_ONLY'; v.source.declarationRef = id; },
    (v: any) => { v.source.kind = 'ATTRIBUTE_REPORT'; v.source.sourceRootRef = ref; v.source.snapshotRef = { ...ref, version: 2 }; v.source.grantRef = ref; },
    (v: any) => { v.source.kind = 'ATTRIBUTE_REPORT'; v.source.sourceRootRef = ref; v.source.snapshotRef = ref; v.source.grantRef = { ...ref, version: 2 }; },
    (v: any) => { v.baseRef = { ...ref, contentHash: 'bad' }; },
    (v: any) => { v.items[0].designRef = { ...ref, version: 0 }; },
    (v: any) => { v.items[0].featureState = 'DONE'; }, (v: any) => { v.items = []; },
    (v: any) => { v.items.push(structuredClone(v.items[0])); },
  ];
  for (const mutate of mutations) { const value = sample(); mutate(value); assert.throws(() => read(value), /BASELINE_INPUT_INVALID/); }
});
test('항목·텍스트·UTF8 전체 크기 상한과 증거 개수/중복/유형을 검사한다', () => {
  const mutations = [
    (v: any) => { v.items = Array.from({ length: 201 }, (_, n) => ({ ...v.items[0], itemId: String(n) })); },
    (v: any) => { v.items[0].itemId = 'a\nb'; }, (v: any) => { v.items[0].itemId = 'a'.repeat(201); },
    (v: any) => { v.items[0].title = 'a'.repeat(201); }, (v: any) => { v.reason = 'a'.repeat(20001); },
    (v: any) => { v.coverageReason = ' '; }, (v: any) => { v.source.unverifiedReason = ''; },
    (v: any) => { v.items[0].limitations = ''; }, (v: any) => { v.items[0].reason = '\ud800'; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), bytes: -1 }]; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), bytes: 20 * 1024 * 1024 + 1 }]; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), bytes: 0.5 }]; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), artifactId: 'invalid' }]; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), mediaType: 'image/png\nextra' }]; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), contentHash: 'bad' }]; },
    (v: any) => { v.items[0].evidenceRefs = [{ ...evidence(), accepted: true }]; },
    (v: any) => { v.items[0].evidenceRefs = [evidence(), evidence()]; },
    (v: any) => { v.items = Array.from({ length: 200 }, (_, n) => ({ ...v.items[0], itemId: String(n), reason: '한'.repeat(4000) })); },
  ];
  for (const mutate of mutations) { const value = sample(); mutate(value); assert.throws(() => read(value), /BASELINE_INPUT_INVALID/); }
  const boundary = sample(); boundary.items[0].evidenceRefs = [{ ...evidence(), bytes: 20 * 1024 * 1024 }];
  boundary.reason = 'a'.repeat(20000); assert.deepEqual(read(boundary).input, boundary);
  const many = sample(); many.items = Array.from({ length: 200 }, (_, n) => ({ ...structuredClone(many.items[0]), itemId: String(n), evidenceRefs: [evidence()] }));
  assert.equal(read(many).input.items.length, 200);
  many.items[199].evidenceRefs.push({ ...evidence(), artifactId: '22222222-2222-4222-8222-222222222222' });
  assert.throws(() => read(many), /BASELINE_INPUT_INVALID/);
});
test('getter·순환·JSON이 아닌 객체는 실행/변환하지 않고 거절하며 알려진 비밀을 반향하지 않는다', () => {
  const value = sample(); let called = 0;
  Object.defineProperty(value.items[0], 'title', { enumerable: true, get() { called++; return '위장'; } });
  assert.throws(() => read(value), /BASELINE_INPUT_INVALID/); assert.equal(called, 0);
  const cycle = sample(); cycle.reason = cycle;
  for (const bad of [cycle, undefined, new Date(), { ...sample(), reason: NaN }, { ...sample(), reason: BigInt(1) }]) assert.throws(() => read(bad), /BASELINE_INPUT_INVALID/);
  for (const secret of ['api_key=SYNTHETIC_NOT_REAL', 'Bearer\nSYNTHETIC_NOT_REAL_1234567890']) {
    const value = sample(); value.reason = secret;
    assert.throws(() => read(value), error => error instanceof Error && error.message === 'BASELINE_SENSITIVE_CONTENT_SUSPECTED');
  }
});
